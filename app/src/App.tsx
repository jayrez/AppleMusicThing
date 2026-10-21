import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { Command } from '@shared/types'
import { link, isMock } from './link'
import { useArtwork, useLayout, useNowPlaying, usePreloadArt, usePrefs } from './hooks'
import { Progress } from './Progress'
import { useGlass, useScenes } from './glass'
import { Lyrics } from './Lyrics'
import { IconNext, IconNote, IconPause, IconPlay, IconPrev } from './icons'

const CONTROLS_MS = 3500
const LONG_PRESS_MS = 600
const SLEW_MS = 900

const params = new URLSearchParams(location.search)

const App: React.FC = () => {
  const [showLyrics, setShowLyrics] = useState(isMock && params.get('view') === 'lyrics')
  const toggleLyrics = useCallback(() => setShowLyrics((v) => !v), [])
  const np = useNowPlaying(toggleLyrics)
  const prefs = usePrefs()
  const layout = useLayout()
  const { track } = np
  const art = useArtwork(track.hasTrack ? track.artwork : undefined)
  usePreloadArt(track.next?.artwork)
  const scenes = useScenes(art.src, layout)

  // Backdrop crossfade: keep the previous song's blur underneath while the new one fades in.
  const [backdrops, setBackdrops] = useState<{ url: string; key: number }[]>([])
  useEffect(() => {
    const url = scenes?.backdrop
    setBackdrops((cur) => (url ? [...cur.slice(-1), { url, key: Date.now() }] : []))
  }, [scenes?.backdrop])

  const capsuleRef = useRef<HTMLDivElement>(null)
  const badgeRef = useRef<HTMLDivElement>(null)
  const volumeRef = useRef<HTMLDivElement>(null)

  const [controls, setControls] = useState(isMock && params.get('controls') === '1')
  const [scrubMs, setScrubMs] = useState<number | null>(null)
  const [volToast, setVolToast] = useState<number | null>(null)
  const [playingOverride, setPlayingOverride] = useState<boolean | null>(null)
  const duration = track.durationMs || 0
  const isPlaying = playingOverride ?? !!track.isPlaying

  // Smooth position for per-frame drawing (lyrics fill), without re-rendering.
  // When a fresh position arrives from the computer, small differences are
  // eased in over SLEW_MS instead of jumping; big ones (seeks) jump.
  const clock = useRef({
    base: 0, at: 0, playing: false, scrub: null as number | null, dur: 0,
    corr: 0, corrAt: 0, lastOut: null as number | null, trackId: undefined as string | undefined
  })
  {
    const c = clock.current
    const base = track.positionMs || 0
    if (np.receivedAt !== c.at || track.id !== c.trackId) {
      const now = Date.now()
      const newRaw = track.isPlaying ? base + (now - np.receivedAt) : base
      const diff = c.lastOut == null ? 0 : c.lastOut - newRaw
      const sameSong = track.id === c.trackId
      c.corr = sameSong && c.playing && track.isPlaying && Math.abs(diff) < 1500 ? diff : 0
      c.corrAt = now
      c.base = base
      c.at = np.receivedAt
      c.trackId = track.id
    }
    c.playing = !!track.isPlaying
    c.scrub = scrubMs
    c.dur = duration
  }
  const getPosition = useCallback(() => {
    const c = clock.current
    if (c.scrub != null) return c.scrub
    const now = Date.now()
    const raw = c.playing ? c.base + (now - c.at) : c.base
    const ease = Math.max(0, 1 - (now - c.corrAt) / SLEW_MS)
    let out = raw + c.corr * ease
    if (c.dur) out = Math.min(out, c.dur)
    c.lastOut = out
    return out
  }, [])

  const hideTimer = useRef<number>()
  const volTimer = useRef<number>()
  const localVol = useRef<{ v: number; at: number }>({ v: 1, at: 0 })

  // Server state wins once it arrives; the override only bridges the round trip.
  useEffect(() => setPlayingOverride(null), [track.isPlaying, track.id])
  useEffect(() => {
    if (typeof track.volume === 'number' && Date.now() - localVol.current.at > 1200) {
      localVol.current.v = track.volume
    }
  }, [track.volume])

  const send = useCallback((cmd: Command, value?: number) => link.command(cmd, value), [])

  const playPause = useCallback(() => {
    setPlayingOverride((cur) => !(cur ?? !!track.isPlaying))
    send('playPause')
  }, [send, track.isPlaying])

  // Pressing a control must never move focus to it (focus is what draws the ring).
  const noFocus = {
    tabIndex: -1,
    onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
    onFocus: (e: React.FocusEvent<HTMLButtonElement>) => e.currentTarget.blur()
  }

  const pokeControls = useCallback(() => {
    setControls(true)
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setControls(false), CONTROLS_MS)
  }, [])

  const nudgeVolume = useCallback((dir: 1 | -1) => {
    const base = Date.now() - localVol.current.at < 1200 ? localVol.current.v : track.volume ?? localVol.current.v
    const v = Math.round(Math.max(0, Math.min(1, base + dir * prefs.volumeStep)) * 100) / 100
    localVol.current = { v, at: Date.now() }
    send('volume', v)
    setVolToast(v)
    window.clearTimeout(volTimer.current)
    volTimer.current = window.setTimeout(() => setVolToast(null), 1300)
  }, [prefs.volumeStep, send, track.volume])

  // ---------- hardware: dial, dial press, lyrics button ----------
  const handlers = useRef({ playPause, nudgeVolume, toggleLyrics, send })
  handlers.current = { playPause, nudgeVolume, toggleLyrics, send }

  useEffect(() => {
    const lyricsKey = prefs.lyricsKey === 'none' ? null : prefs.lyricsKey
    const keys = ['wheel', 'Enter', ...(lyricsKey ? [lyricsKey] : [])]
    link.overrideKeys(keys)

    const down: Record<string, { at: number; long: boolean; timer: number }> = {}

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Enter' && e.code !== lyricsKey) return
      e.preventDefault()
      if (e.repeat || down[e.code]) return
      const entry = { at: Date.now(), long: false, timer: 0 }
      entry.timer = window.setTimeout(() => {
        entry.long = true
        // Hold dial = next song. Hold back button = DeskThing's app list (as before).
        if (e.code === 'Enter') handlers.current.send('next')
        else if (e.code === 'Escape') link.openAppList()
      }, LONG_PRESS_MS)
      down[e.code] = entry
    }

    const onKeyUp = (e: KeyboardEvent) => {
      const entry = down[e.code]
      if (!entry) return
      e.preventDefault()
      window.clearTimeout(entry.timer)
      delete down[e.code]
      if (entry.long) return
      if (e.code === 'Enter') handlers.current.playPause()
      else handlers.current.toggleLyrics()
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const up = e.deltaX > 0 || e.deltaY < 0
      if (e.deltaX === 0 && e.deltaY === 0) return
      handlers.current.nudgeVolume(up ? 1 : -1)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      link.restoreKeys(keys)
      Object.values(down).forEach((d) => window.clearTimeout(d.timer))
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('wheel', onWheel)
    }
  }, [prefs.lyricsKey])

  // ---------- touch: tap = controls, swipes = skip / volume, drag bar = seek ----------
  const gesture = useRef<{ x: number; y: number; at: number; scrub: boolean } | null>(null)
  const barRef = useRef<HTMLDivElement>(null)

  const scrubAt = (clientX: number) => {
    const r = barRef.current!.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
    setScrubMs(ratio * duration)
  }

  const point = (e: React.TouchEvent | React.MouseEvent) => {
    const t = 'touches' in e ? e.touches[0] || e.changedTouches[0] : e
    return { x: t.clientX, y: t.clientY }
  }

  const onStart = (e: React.TouchEvent | React.MouseEvent) => {
    if ('button' in e && e.button !== 0) return
    if (!('touches' in e) && 'ontouchstart' in window) return // ignore emulated mouse after touch
    const { x, y } = point(e)
    const target = e.target as HTMLElement
    if (target.closest('[data-ctl]')) { gesture.current = null; return }
    const scrub = controls && !!target.closest('[data-scrub]') && duration > 0
    gesture.current = { x, y, at: Date.now(), scrub }
    if (scrub) { window.clearTimeout(hideTimer.current); scrubAt(x) }
  }

  const onMove = (e: React.TouchEvent | React.MouseEvent) => {
    const g = gesture.current
    if (g && g.scrub) scrubAt(point(e).x)
  }

  const onEnd = (e: React.TouchEvent | React.MouseEvent) => {
    const g = gesture.current
    gesture.current = null
    if (!g) return
    if (g.scrub) {
      if (scrubMs != null) send('seek', Math.round(scrubMs))
      // Hold the scrubbed position briefly so the bar doesn't jump back.
      window.setTimeout(() => setScrubMs(null), 700)
      pokeControls()
      return
    }
    const { x, y } = point(e)
    const dx = x - g.x, dy = y - g.y, dt = Date.now() - g.at
    const ax = Math.abs(dx), ay = Math.abs(dy)
    if (ax < 12 && ay < 12 && dt < 400) {
      if (controls) { window.clearTimeout(hideTimer.current); setControls(false) } else pokeControls()
      return
    }
    if (dt > 700 || Math.max(ax, ay) < 50) return
    if (ax > ay) send(dx < 0 ? 'next' : 'prev')
    else nudgeVolume(dy < 0 ? 1 : -1)
  }

  // ---------- render ----------
  const showBadge = np.connected !== false && track.hasTrack && !isPlaying && !controls
  useGlass(capsuleRef, scenes, [layout, track.hasTrack])
  useGlass(badgeRef, scenes, [layout, showBadge])
  useGlass(volumeRef, scenes, [layout])

  const { art: size, padX, padY, gap, w } = layout
  const colLeft = padX + size + gap
  const colWidth = w - colLeft - padX
  const ready = np.connected !== false && track.hasTrack
  const titleLen = (track.title || '').length
  const titleSize = titleLen > 48 ? 28 : titleLen > 26 ? 32 : 38

  const style = {
    '--base': art.palette.base,
    '--accent': art.palette.accent,
    '--art': `${size}px`,
    '--pad-x': `${padX}px`,
    '--pad-y': `${padY}px`,
    '--col-left': `${colLeft}px`,
    '--col-width': `${colWidth}px`,
    '--title-size': `${titleSize}px`
  } as React.CSSProperties

  return (
    <div
      className={`screen${controls ? ' has-controls' : ''}${showLyrics && ready ? ' lyrics-mode' : ''}`}
      style={style}
      onTouchStart={onStart}
      onTouchMove={onMove}
      onTouchEnd={onEnd}
      onMouseDown={onStart}
      onMouseMove={onMove}
      onMouseUp={onEnd}
    >
      <div className="backdrop" aria-hidden="true">
        {backdrops.map((b) => <img key={b.key} src={b.url} alt="" />)}
      </div>
      <div className="shade" aria-hidden="true" />

      <div className="art">
        {art.src && ready ? <img src={art.src} alt="" draggable={false} /> : <div className="art-empty"><IconNote /></div>}
        {ready && (
          <div className="controls" aria-hidden={!controls}>
            <div className="capsule glass" ref={capsuleRef}>
              <button data-ctl {...noFocus} onClick={() => { send('prev'); pokeControls() }} aria-label="Previous"><IconPrev /></button>
              <button data-ctl {...noFocus} className="play" onClick={() => { playPause(); pokeControls() }} aria-label={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <IconPause /> : <IconPlay />}
              </button>
              <button data-ctl {...noFocus} onClick={() => { send('next'); pokeControls() }} aria-label="Next"><IconNext /></button>
            </div>
          </div>
        )}
        {showBadge && <div className="paused-badge glass" ref={badgeRef}><IconPause /></div>}
      </div>

      <div className="column">
        {!ready ? (
          <div className="empty">
            {np.connected === false ? (
              <>
                <p className="empty-title">Waiting for the browser</p>
                <p className="empty-body">Open music.apple.com in Edge or Chrome with the DeskThing Bridge extension turned on.</p>
              </>
            ) : (
              <>
                <p className="empty-title">Nothing playing</p>
                <p className="empty-body">Start a song in Apple Music and it will show up here.</p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="pane info-pane">
              <h1 className="title">{track.title}</h1>
              <p className="artist">{track.artist}</p>
              {track.album && <p className="album">{track.album}</p>}
            </div>

            <div className="pane lyrics-pane">
              <Lyrics lyrics={np.lyrics} getPosition={getPosition} playing={!!track.isPlaying} duration={duration} active={showLyrics} />
              <div className="mini">
                <p className="mini-title">{track.title}</p>
                <p className="mini-artist">{track.artist}</p>
              </div>
            </div>

            <Progress ref={barRef} getPosition={getPosition} duration={duration} live={!!track.isPlaying || scrubMs != null} />
          </>
        )}
      </div>

      <div className={`volume glass${volToast != null ? ' show' : ''}`} ref={volumeRef}>
        <div className="volume-track"><div className="volume-fill" style={{ height: `${(volToast ?? 0) * 100}%` }} /></div>
        <span>{Math.round((volToast ?? 0) * 100)}</span>
      </div>
    </div>
  )
}

export default App
