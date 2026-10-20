import type { LyricLine } from '@shared/types'

/** Start/end (ms, absolute song time) for each word of a line. */
export type WordSpan = { text: string; start: number; end: number }

// Average sung pace. Used only when the lyrics give a start time per line, not per word.
const MS_PER_CHAR = 80
const MIN_SWEEP = 700
const TAIL_GAP = 180 // finish the sweep slightly before the next line starts

export const wordSpans = (line: LyricLine, nextT: number | undefined, songEnd: number): WordSpan[] => {
  const limit = (nextT ?? songEnd ?? line.t + 5000) - TAIL_GAP

  // Exact per-word timing from enhanced LRC.
  if (line.words && line.words.length) {
    return line.words.map((w, i) => {
      const nextStart = i + 1 < line.words!.length ? line.words![i + 1].t : undefined
      // A word lasts until the next word starts, capped so a held last word doesn't crawl forever.
      const end = nextStart ?? Math.min(limit, w.t + Math.max(400, w.text.length * MS_PER_CHAR * 1.6))
      return { text: w.text, start: w.t, end: Math.max(end, w.t + 120) }
    })
  }

  // Estimate: spread the words over a sung-pace sweep, never past the next line.
  const words = line.text.split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const chars = words.reduce((n, w) => n + w.length + 1, 0)
  const available = Math.max(300, limit - line.t)
  const sweep = Math.min(available, Math.max(MIN_SWEEP, chars * MS_PER_CHAR))
  let cursor = line.t
  return words.map((text) => {
    const len = ((text.length + 1) / chars) * sweep
    const span = { text, start: cursor, end: cursor + len }
    cursor += len
    return span
  })
}

/** 0..1 progress of a word at a given time. */
export const fillAt = (w: WordSpan, pos: number) =>
  pos <= w.start ? 0 : pos >= w.end ? 1 : (pos - w.start) / (w.end - w.start)
