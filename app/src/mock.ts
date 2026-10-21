// Demo data for previewing the screen outside DeskThing. Not used on the Car Thing.
import type { Command, LyricLine, ToClient, TrackState } from '@shared/types'

const paintArt = (hues: [number, number], seed: number) => {
  const c = document.createElement('canvas')
  c.width = c.height = 600
  const g = c.getContext('2d')!
  const bg = g.createLinearGradient(0, 0, 600, 600)
  bg.addColorStop(0, `hsl(${hues[0]},70%,45%)`)
  bg.addColorStop(1, `hsl(${hues[1]},60%,22%)`)
  g.fillStyle = bg
  g.fillRect(0, 0, 600, 600)
  for (let i = 0; i < 7; i++) {
    const r = 60 + ((seed * (i + 3) * 37) % 220)
    g.beginPath()
    g.arc((seed * (i + 1) * 97) % 600, (seed * (i + 2) * 53) % 600, r, 0, Math.PI * 2)
    g.fillStyle = `hsla(${hues[i % 2]},80%,${55 + (i % 3) * 10}%,0.35)`
    g.fill()
  }
  return c.toDataURL('image/jpeg', 0.9)
}

const lyrics: LyricLine[] = [
  'Streetlights hum a quiet key',
  'Every window glows for me',
  '',
  'I kept the radio low tonight',
  'Counting headlights on the ceiling',
  'You said the city never sleeps',
  'But it was dreaming when I left it',
  'Hold the line, hold the line',
  'Somewhere a signal finds its way',
  'Hold the line, hold the line',
  'Back to the place we used to stay',
  '',
  'Paper maps in the glovebox',
  'Folded wrong a hundred times',
  'Every exit has a story',
  'Every story rhymes'
].map((text, i) => ({ t: 8000 + i * 4200, text }))

export const startMock = (emit: (m: ToClient) => void) => {
  const params = new URLSearchParams(location.search)
  const tracks: TrackState[] = [
    {
      hasTrack: true, id: 'demo-1', title: 'Night Drive Home', artist: 'The Low Signals',
      album: 'Long Exposure', artwork: paintArt([18, 340], 7), durationMs: 214000, positionMs: 41000,
      isPlaying: true, volume: 0.55, source: 'musickit'
    },
    {
      hasTrack: true, id: 'demo-2', title: 'Fog Lights (Extended Version Recorded Live at the Old Theater)',
      artist: 'Marisol Vega, Harbor Choir & The Quiet Engines', album: 'Rooms We Left',
      artwork: paintArt([190, 220], 3), durationMs: 301000, positionMs: 12000, isPlaying: true, volume: 0.55,
      source: 'musickit'
    }
  ]
  let i = params.get('track') === '2' ? 1 : 0
  let s: TrackState = params.get('state') === 'empty' ? { hasTrack: false } : { ...tracks[i] }
  let started = Date.now()

  const pos = () => (s.positionMs || 0) + (s.isPlaying ? Date.now() - started : 0)
  const push = () => {
    s = { ...s, positionMs: pos() }
    started = Date.now()
    emit({ type: 'am', request: 'state', payload: s })
  }
  const sendLyrics = () => {
    if (!s.hasTrack) return
    emit({ type: 'am', request: 'lyrics', payload: { trackId: s.id!, status: 'loading' } })
    setTimeout(() => {
      emit({
        type: 'am', request: 'lyrics',
        payload: i === 0
          ? { trackId: s.id!, status: 'synced', synced: lyrics }
          : { trackId: s.id!, status: 'none' }
      })
    }, 400)
  }

  // Like the real bridge: resync position every 4s, with a little network/timer error.
  setInterval(() => {
    if (!s.hasTrack || !s.isPlaying) return
    const jitter = (Math.random() - 0.5) * 300
    emit({ type: 'am', request: 'state', payload: { ...s, positionMs: pos() + jitter } })
  }, 4000)

  setTimeout(() => {
    emit({ type: 'am', request: 'bridge', payload: { connected: params.get('state') !== 'offline' } })
    push()
    sendLyrics()
  }, 50)

  return (cmd: Command, value?: number) => {
    s = { ...s, positionMs: pos() }
    started = Date.now()
    if (cmd === 'playPause') s.isPlaying = !s.isPlaying
    if (cmd === 'next' || cmd === 'prev') {
      i = (i + 1) % tracks.length
      s = { ...tracks[i], positionMs: 0 }
      started = Date.now()
      push()
      sendLyrics()
      return
    }
    if (cmd === 'seek') { s.positionMs = value || 0; started = Date.now() }
    if (cmd === 'volume') s.volume = value
    if (cmd === 'volumeDelta') s.volume = Math.max(0, Math.min(1, (s.volume || 0) + (value || 0)))
    push()
  }
}
