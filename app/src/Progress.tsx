import React, { forwardRef, memo, useEffect, useRef } from 'react'

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

type Props = {
  getPosition: () => number
  duration: number
  live: boolean // playing or scrubbing: update every frame; otherwise a few times a second
}

/**
 * Progress bar and times, drawn straight into the DOM so the rest of the
 * screen doesn't re-render while a song plays. The fill moves with a
 * transform (no layout or repaint), and the time text only changes once a second.
 */
export const Progress = memo(forwardRef<HTMLDivElement, Props>(function Progress({ getPosition, duration, live }, barRef) {
  const fill = useRef<HTMLDivElement>(null)
  const elapsed = useRef<HTMLSpanElement>(null)
  const remaining = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let raf = 0, timer = 0
    let lastScale = -1, lastA = '', lastB = ''
    // Only move the bar when it would move by a whole pixel.
    const px = Math.max(1, (fill.current && fill.current.parentElement && fill.current.parentElement.clientWidth) || 300)
    const draw = () => {
      const pos = getPosition()
      const scale = duration ? Math.min(1, Math.max(0, pos / duration)) : 0
      const rounded = Math.round(scale * px) / px
      if (rounded !== lastScale && fill.current) {
        lastScale = rounded
        fill.current.style.transform = `scaleX(${rounded})`
      }
      const a = fmt(pos), b = '\u2212' + fmt(Math.max(0, duration - pos))
      if (a !== lastA && elapsed.current) { lastA = a; elapsed.current.textContent = a }
      if (b !== lastB && remaining.current) { lastB = b; remaining.current.textContent = b }
    }
    if (live) {
      const loop = () => { draw(); raf = requestAnimationFrame(loop) }
      loop()
    } else {
      draw()
      timer = window.setInterval(draw, 500)
    }
    return () => { cancelAnimationFrame(raf); clearInterval(timer) }
  }, [getPosition, duration, live])

  return (
    <div className="progress">
      <div className="bar" ref={barRef} data-scrub>
        <div className="track"><div className="fill" ref={fill} /></div>
      </div>
      <div className="times">
        <span ref={elapsed}>0:00</span>
        <span ref={remaining}>{'\u2212'}0:00</span>
      </div>
    </div>
  )
}))
