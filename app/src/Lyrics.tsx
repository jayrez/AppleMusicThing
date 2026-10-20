import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { LyricsPayload } from '@shared/types'
import { fillAt, wordSpans, WordSpan } from './timing'

type Props = {
  lyrics: LyricsPayload | null
  position: number // coarse (4x/second); drives which line is current and scrolling
  getPosition: () => number // precise, read every frame for the word fill
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

export const Lyrics: React.FC<Props> = ({ lyrics, position, getPosition, playing, duration, active }) => {
  const viewport = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const wordEls = useRef<(HTMLSpanElement | null)[]>([])
  const [offset, setOffset] = useState(0)

  const synced = lyrics?.status === 'synced' ? lyrics.synced || [] : null
  const plain = lyrics?.status === 'plain' ? lyrics.plain || [] : null

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

  // Smooth word-by-word fill on the current line, painted directly each frame.
  useEffect(() => {
    if (!active || current < 0 || !spans[current]) return
    const line = spans[current]
    let raf = 0
    const paint = () => {
      const pos = getPosition()
      for (let i = 0; i < line.length; i++) {
        const el = wordEls.current[i]
        if (el) el.style.backgroundPosition = `${(1 - fillAt(line[i], pos)) * 100}% 0`
      }
      if (playing) raf = requestAnimationFrame(paint)
    }
    paint()
    return () => cancelAnimationFrame(raf)
  }, [active, current, spans, playing, getPosition])

  useLayoutEffect(() => {
    const vp = viewport.current, ls = list.current
    if (!vp || !ls || !active) return
    const vpH = vp.clientHeight
    if (synced) {
      const el = ls.children[Math.max(0, current)] as HTMLElement | undefined
      if (!el) return setOffset(0)
      setOffset(Math.max(0, el.offsetTop + el.offsetHeight / 2 - vpH * ANCHOR))
    } else if (plain) {
      // No timing info: scroll through the words in step with the song.
      const ratio = duration ? Math.min(1, Math.max(0, (position - 8000) / (duration - 16000))) : 0
      setOffset(Math.max(0, ls.scrollHeight - vpH) * ratio)
    } else {
      setOffset(0)
    }
  }, [current, synced, plain, active, position, duration])

  if (!lyrics || !(synced || plain)) {
    return (
      <div className="lyrics-viewport">
        <p className="lyrics-status">{statusText[lyrics?.status || 'loading']}</p>
      </div>
    )
  }

  wordEls.current = []

  return (
    <div className="lyrics-viewport" ref={viewport}>
      <div
        className={`lyrics-list${plain ? ' is-plain' : ''}`}
        ref={list}
        style={{ transform: `translate3d(0, ${-offset}px, 0)` }}
      >
        {synced
          ? synced.map((l, i) => {
              const state = i === current ? 'now' : i < current ? 'past' : 'next'
              return (
                <p key={i} className={`line ${state}${l.text ? '' : ' gap'}`}>
                  {spans[i].map((w, j) => (
                    <React.Fragment key={j}>
                      {j > 0 && ' '}
                      <span
                        className="w"
                        ref={i === current ? (el) => { wordEls.current[j] = el } : undefined}
                      >
                        {w.text}
                      </span>
                    </React.Fragment>
                  ))}
                </p>
              )
            })
          : plain!.map((l, i) => <p key={i} className={`line${l ? '' : ' gap'}`}>{l || ' '}</p>)}
      </div>
    </div>
  )
}
