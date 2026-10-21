import { useEffect, useRef, useState } from 'react'
import type { AppSettings } from '@deskthing/types'
import type { LyricsPayload, TrackState } from '@shared/types'
import { SETTING_IDS } from '@shared/types'
import { link } from './link'
import { FALLBACK, Palette, paletteFromImage } from './color'

export type NowPlaying = {
  track: TrackState
  receivedAt: number
  lyrics: LyricsPayload | null
  connected: boolean | null // null = haven't heard yet
}

export const useNowPlaying = (onToggleLyrics: () => void) => {
  const [np, setNp] = useState<NowPlaying>({
    track: { hasTrack: false }, receivedAt: Date.now(), lyrics: null, connected: null
  })
  const toggleRef = useRef(onToggleLyrics)
  toggleRef.current = onToggleLyrics

  useEffect(() => {
    const off = link.on((msg) => {
      if (msg.request === 'state') {
        setNp((p) => ({
          ...p,
          track: msg.payload,
          receivedAt: Date.now(),
          // Drop lyrics belonging to a previous song right away.
          lyrics: p.lyrics && p.lyrics.trackId === msg.payload.id ? p.lyrics : null
        }))
      } else if (msg.request === 'lyrics') {
        setNp((p) => (p.track.id && msg.payload.trackId !== p.track.id ? p : { ...p, lyrics: msg.payload }))
      } else if (msg.request === 'bridge') {
        setNp((p) => ({ ...p, connected: msg.payload.connected }))
      } else if (msg.request === 'toggleLyrics') {
        toggleRef.current()
      }
    })
    link.start()
    return off
  }, [])

  return np
}

/** Loads artwork fully before showing it, and derives the screen palette from it. */
export const useArtwork = (url?: string) => {
  const [shown, setShown] = useState<string>('')
  const [palette, setPalette] = useState<Palette>(FALLBACK)

  useEffect(() => {
    const src = link.image(url)
    if (!src) { setShown(''); setPalette(FALLBACK); return }
    let cancelled = false
    const display = new Image()
    display.onload = () => { if (!cancelled) setShown(src) }
    display.src = src
    // Separate CORS-enabled copy just for reading pixels.
    const probe = new Image()
    probe.crossOrigin = 'anonymous'
    probe.onload = () => { if (!cancelled) setPalette(paletteFromImage(probe)) }
    probe.onerror = () => { if (!cancelled) setPalette(FALLBACK) }
    probe.src = src
    return () => { cancelled = true }
  }, [url])

  return { src: shown, palette }
}

export type Prefs = { lyricsKey: string; volumeStep: number }

export const usePrefs = (): Prefs => {
  const [prefs, setPrefs] = useState<Prefs>({ lyricsKey: 'Escape', volumeStep: 0.05 })
  useEffect(() => {
    const apply = (s?: AppSettings) => {
      if (!s) return
      const key = s[SETTING_IDS.LYRICS_BUTTON]?.value
      const step = Number(s[SETTING_IDS.VOLUME_STEP]?.value)
      setPrefs((p) => ({
        lyricsKey: typeof key === 'string' ? key : p.lyricsKey,
        volumeStep: step ? step / 100 : p.volumeStep
      }))
    }
    link.settings().then(apply)
    return link.onSettings(apply)
  }, [])
  return prefs
}

/** Art size and margins from the actual viewport (the Car Thing is 800x480). */
export const useLayout = () => {
  const calc = () => {
    const w = window.innerWidth, h = window.innerHeight
    const padY = Math.round(h * 0.117)
    const art = Math.round(Math.min(h - padY * 2, w * 0.47))
    const padX = Math.round(Math.max(24, Math.min(40, w * 0.05)))
    return { w, h, padY: Math.round((h - art) / 2), padX, art, gap: Math.round(w * 0.055) }
  }
  const [layout, setLayout] = useState(calc)
  useEffect(() => {
    const onResize = () => setLayout(calc())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return layout
}

/** Warm the image cache with the next song's art so the switch is instant. */
export const usePreloadArt = (url?: string) => {
  useEffect(() => {
    const src = link.image(url)
    if (!src) return
    const img = new Image()
    img.src = src
  }, [url])
}
