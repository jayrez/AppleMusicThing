import React, { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { LyricsPayload } from '@shared/types'

type Props = { lyrics: LyricsPayload | null; position: number; duration: number; active: boolean }

const LEAD_MS = 250 // show a line slightly before it's sung
const ANCHOR = 0.36 // current line sits about a third of the way down

const statusText: Record<string, string> = {
  loading: 'Finding lyrics…',
  none: 'No lyrics found for this song',
  instrumental: 'Instrumental',
  error: "Couldn't reach the lyrics service"
}

export const Lyrics: React.FC<Props> = ({ lyrics, position, duration, active }) => {
  const viewport = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)

  const synced = lyrics?.status === 'synced' ? lyrics.synced || [] : null
  const plain = lyrics?.status === 'plain' ? lyrics.plain || [] : null

  const current = useMemo(() => {
    if (!synced) return -1
    let idx = -1
    for (let i = 0; i < synced.length; i++) {
      if (synced[i].t <= position + LEAD_MS) idx = i
      else break
    }
    return idx
  }, [synced, position])

  useLayoutEffect(() => {
    const vp = viewport.current, ls = list.current
    if (!vp || !ls || !active) return
    const vpH = vp.clientHeight
    if (synced) {
      const el = ls.children[Math.max(0, current)] as HTMLElement | undefined
      if (!el) return setOffset(0)
      const target = el.offsetTop + el.offsetHeight / 2 - vpH * ANCHOR
      setOffset(Math.max(0, target))
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

  return (
    <div className="lyrics-viewport" ref={viewport}>
      <div
        className={`lyrics-list${plain ? ' is-plain' : ''}`}
        ref={list}
        style={{ transform: `translate3d(0, ${-offset}px, 0)` }}
      >
        {synced
          ? synced.map((l, i) => (
              <p key={i} className={`line${i === current ? ' now' : i < current ? ' past' : ''}${l.text ? '' : ' gap'}`}>
                {l.text || '♪'}
              </p>
            ))
          : plain!.map((l, i) => <p key={i} className={`line${l ? '' : ' gap'}`}>{l || ' '}</p>)}
      </div>
    </div>
  )
}
