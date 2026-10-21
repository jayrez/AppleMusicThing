import React, { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { LyricLine, LyricsPayload } from '@shared/types'
import { fillAt, wordSpans, WordSpan } from './timing'

type Props = {
  lyrics: LyricsPayload | null
  position: number // coarse (4x/second); decides which line is current
  getPosition: () => number // smooth, read every frame for the word fill
  playing: boolean
  duration: number
  active: boolean
}

const LEAD_MS = 150 // move to a line just before it's sung
const ANCHOR = 0.36 // current line sits about a third of the way down

const statusText: Record<string, string> = {
  loading: 'Finding lyrics…',
  none: 'No lyrics found for this song',
  instrumental: 'Instrumental',
  error: "Couldn't reach the lyrics service"
}

// The list only re-renders when the current line changes, not on every clock
// tick; the Car Thing's CPU can't afford to diff hundreds of words 4x a second.
const SyncedList = memo(function SyncedList({ lines, spans, current }: { lines: LyricLine[]; spans: WordSpan[][]; current: number }) {
  return (
    <>
      {lines.map((l, i) => {
        const state = i === current ? 'now' : i < current ? 'past' : 'next'
        return (
          <p key={i} className={`line ${state}${l.text ? '' : ' gap'}`}>
            {spans[i].map((w, j) => (
              <React.Fragment key={j}>
                {j > 0 && ' '}
                <span className="w">{w.text}</span>
              </React.Fragment>
            ))}
          </p>
        )
      })}
    </>
  )
})

const PlainList = memo(function PlainList({ lines }: { lines: string[] }) {
  return <>{lines.map((l, i) => <p key={i} className={`line${l ? '' : ' gap'}`}>{l || ' '}</p>)}</>
})

export const Lyrics: React.FC<Props> = ({ lyrics, position, getPosition, playing, duration, active }) => {
  const viewport = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)

  const synced = lyrics?.status === 'synced' ? lyrics.synced || null : null
  const plain = lyrics?.status === 'plain' ? lyrics.plain || null : null

  // Word timings for every line, computed once per song.
  const spans = useMemo<WordSpan[][]>(() => {
    if (!synced) return []
    return synced.map((l, i) => {
      if (!l.text) return [{ text: '♪', start: l.t, end: synced[i + 1] ? synced[i + 1].t - 200 : l.t + 3000 }]
      return wordSpans(l, synced[i + 1]?.t, duration)
    })
  }, [synced, duration])

  const current = useMemo(() => {
    if (!synced) return -1
    let idx = -1
    for (let i = 0; i < synced.length; i++) {
      if (synced[i].t <= position + LEAD_MS) idx = i
      else break
    }
    return idx
  }, [synced, position])

  // Word fill on the current line, written straight to the DOM each frame.
  // Only words whose fill actually changed get touched, so usually one repaint.
  useEffect(() => {
    if (!active || current < 0 || !spans[current] || !list.current) return
    const lineEl = list.current.children[current] as HTMLElement | undefined
    if (!lineEl) return
    const els = Array.prototype.slice.call(lineEl.querySelectorAll('.w')) as HTMLElement[]
    const words = spans[current]
    const last: number[] = words.map(() => -1)
    let raf = 0
    const paint = () => {
      const pos = getPosition()
      for (let i = 0; i < words.length && i < els.length; i++) {
        const f = Math.round(fillAt(words[i], pos) * 400) / 400 // quantize: skip sub-pixel writes
        if (f !== last[i]) {
          last[i] = f
          els[i].style.backgroundPosition = `${(1 - f) * 100}% 0`
        }
      }
      if (playing) raf = requestAnimationFrame(paint)
    }
    paint()
    return () => {
      cancelAnimationFrame(raf)
      // Hand the words back to the stylesheet (past/next states).
      els.forEach((el) => { el.style.backgroundPosition = '' })
    }
  }, [active, current, spans, playing, getPosition])

  // Scroll so the current line sits near the top third.
  useLayoutEffect(() => {
    const vp = viewport.current, ls = list.current
    if (!vp || !ls || !active) return
    if (synced) {
      const el = ls.children[Math.max(0, current)] as HTMLElement | undefined
      setOffset(el ? Math.max(0, el.offsetTop + el.offsetHeight / 2 - vp.clientHeight * ANCHOR) : 0)
    }
  }, [current, synced, active])

  // Plain lyrics have no timing: drift through them in step with the song, in coarse steps.
  const plainStep = plain && duration ? Math.round((position / duration) * 60) : 0
  useLayoutEffect(() => {
    const vp = viewport.current, ls = list.current
    if (!vp || !ls || !active || !plain) return
    const ratio = duration ? Math.min(1, Math.max(0, (position - 8000) / (duration - 16000))) : 0
    setOffset(Math.max(0, ls.scrollHeight - vp.clientHeight) * ratio)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plainStep, plain, active, duration])

  if (!lyrics || !(synced || plain)) {
    return (
      <div className="lyrics-viewport">
        <p className="lyrics-status">{statusText[lyrics?.status || 'loading']}</p>
      </div>
    )
  }

  return (
    <div className="lyrics-viewport" ref={viewport}>
      <div
        className={`lyrics-list${plain ? ' is-plain' : ''}`}
        ref={list}
        style={{ transform: `translate3d(0, ${-offset}px, 0)` }}
      >
        {synced ? <SyncedList lines={synced} spans={spans} current={current} /> : <PlainList lines={plain!} />}
      </div>
    </div>
  )
}
