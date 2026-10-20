import type { LyricLine, LyricsPayload, TrackState } from '../shared/types'

// Lyrics come from LRCLIB (https://lrclib.net), a free open lyrics database
// with time-synced lyrics. Requests are made from the computer, not the Car Thing.

const API = 'https://lrclib.net/api'
const CLIENT_ID = 'DeskThing-AppleMusic/1.0.0 (https://github.com/ItsRiprod/DeskThing)'
const HEADERS = { 'User-Agent': CLIENT_ID, 'Lrclib-Client': CLIENT_ID }
const cache = new Map<string, LyricsPayload>()
const CACHE_MAX = 60

type LrclibRecord = {
  trackName: string
  artistName: string
  albumName?: string
  duration?: number
  instrumental?: boolean
  plainLyrics?: string | null
  syncedLyrics?: string | null
}

export const parseLrc = (lrc: string): LyricLine[] => {
  const lines: LyricLine[] = []
  const stamp = /\[(\d{1,2}):(\d{1,2}(?:\.\d{1,3})?)\]/g
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps: number[] = []
    let m: RegExpExecArray | null
    stamp.lastIndex = 0
    while ((m = stamp.exec(raw))) stamps.push((parseInt(m[1], 10) * 60 + parseFloat(m[2])) * 1000)
    if (!stamps.length) continue
    const text = raw.replace(stamp, '').trim()
    for (const t of stamps) lines.push({ t: Math.round(t), text })
  }
  lines.sort((a, b) => a.t - b.t)
  // Collapse runs of empty lines into a single break marker.
  return lines.filter((l, i) => l.text || (i > 0 && lines[i - 1].text))
}

const simplify = (s = '') =>
  s
    .replace(/\s*[([](feat\.?|ft\.?|with)\s[^)\]]*[)\]]/gi, '')
    .replace(/\s*-\s*(single|ep|remaster(ed)?( \d{4})?)$/i, '')
    .trim()

const toPayload = (trackId: string, r: LrclibRecord | null): LyricsPayload => {
  if (!r) return { trackId, status: 'none' }
  if (r.instrumental) return { trackId, status: 'instrumental' }
  if (r.syncedLyrics) {
    const synced = parseLrc(r.syncedLyrics)
    if (synced.length) return { trackId, status: 'synced', synced }
  }
  if (r.plainLyrics) {
    return { trackId, status: 'plain', plain: r.plainLyrics.split(/\r?\n/).map((l) => l.trim()) }
  }
  return { trackId, status: 'none' }
}

// The computer's own network path can fail on managed networks (DeskThing's
// runtime ignores the Windows proxy). The extension can fetch through Edge
// instead, which does use the proxy.
export type FallbackFetch = (url: string) => Promise<{ status: number; body: string }>
let fallbackFetch: FallbackFetch | null = null
let directFailedAt = 0
const DIRECT_RETRY_MS = 10 * 60 * 1000

export const setFallbackFetch = (fn: FallbackFetch | null) => { fallbackFetch = fn }

const directJson = async <T>(url: string): Promise<T | null> => {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 6000)
  try {
    const res = await fetch(url, { headers: HEADERS, signal: ctrl.signal })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`LRCLIB ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

const viaBrowserJson = async <T>(url: string): Promise<T | null> => {
  const { status, body } = await fallbackFetch!(url)
  if (status === 404) return null
  if (status < 200 || status >= 300) throw new Error(`LRCLIB via browser ${status}`)
  return JSON.parse(body) as T
}

const getJson = async <T>(url: string): Promise<T | null> => {
  const skipDirect = fallbackFetch && Date.now() - directFailedAt < DIRECT_RETRY_MS
  if (!skipDirect) {
    try {
      return await directJson<T>(url)
    } catch (err) {
      // A real HTTP error from LRCLIB means the network is fine; don't fall back.
      if (err instanceof Error && err.message.startsWith('LRCLIB ')) throw err
      directFailedAt = Date.now()
      if (!fallbackFetch) throw err
      console.warn('[applemusic] direct lyrics request failed, using the browser instead')
    }
  }
  return viaBrowserJson<T>(url)
}

const exactLookup = async (t: TrackState, title: string, artist: string) => {
  const q = new URLSearchParams({ track_name: title, artist_name: artist })
  if (t.album) q.set('album_name', simplify(t.album))
  if (t.durationMs) q.set('duration', String(Math.round(t.durationMs / 1000)))
  return getJson<LrclibRecord>(`${API}/get?${q}`)
}

const searchLookup = async (t: TrackState, title: string, artist: string) => {
  const q = new URLSearchParams({ track_name: title, artist_name: artist })
  const results = (await getJson<LrclibRecord[]>(`${API}/search?${q}`)) || []
  if (!results.length) return null
  const dur = (t.durationMs || 0) / 1000
  const score = (r: LrclibRecord) =>
    (r.syncedLyrics ? 0 : 30) + (dur && r.duration ? Math.abs(r.duration - dur) : 10)
  const best = results.slice().sort((a, b) => score(a) - score(b))[0]
  // Reject matches whose length is way off; they're usually a different version.
  if (dur && best.duration && Math.abs(best.duration - dur) > 8) return null
  return best
}

export const fetchLyrics = async (t: TrackState): Promise<LyricsPayload> => {
  const trackId = t.id || ''
  const cached = cache.get(trackId)
  if (cached) return cached

  const title = t.title || ''
  const artist = (t.artist || '').split(/,|&| x /i)[0].trim() || t.artist || ''
  let payload: LyricsPayload
  try {
    let rec = await exactLookup(t, title, t.artist || artist)
    if (!rec) rec = await exactLookup(t, simplify(title), artist)
    if (!rec || (!rec.syncedLyrics && !rec.instrumental)) {
      const found = await searchLookup(t, simplify(title), artist)
      if (found && (found.syncedLyrics || !rec)) rec = found
    }
    payload = toPayload(trackId, rec)
  } catch (err) {
    console.warn('[applemusic] lyrics lookup failed', err)
    return { trackId, status: 'error' } // not cached, so it retries next time
  }

  cache.set(trackId, payload)
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string)
  return payload
}
