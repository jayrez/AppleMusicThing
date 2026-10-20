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

  // Estimate: the overall sweep (start and end) stays as before; inside it,
  // each word gets time in proportion to how long it takes to sing.
  const words = line.text.split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const chars = words.reduce((n, w) => n + w.length + 1, 0)
  const available = Math.max(300, limit - line.t)
  const sweep = Math.min(available, Math.max(MIN_SWEEP, chars * MS_PER_CHAR))
  const weights = words.map((w, i) => singWeight(w, i === words.length - 1))
  const total = weights.reduce((a, b) => a + b, 0)
  let cursor = line.t
  return words.map((text, i) => {
    const len = (weights[i] / total) * sweep
    const span = { text, start: cursor, end: cursor + len }
    cursor += len
    return span
  })
}

// ---------- how long a word takes to sing ----------

// Short words that are usually sung quickly and unstressed (English and Spanish).
const LIGHT = new Set([
  'a', 'an', 'the', 'to', 'of', 'and', 'in', 'on', 'at', 'for', 'or', 'but', 'so', 'as', 'by',
  'i', "i'm", 'im', 'it', "it's", 'is', 'be', 'am', 'are', 'was', 'my', 'me', 'you', 'your', 'we', 'he', 'she',
  'they', 'his', 'her', 'its', 'our', 'that', 'this', 'with', 'from', 'if', 'no', 'do', 'just', 'when',
  'de', 'la', 'el', 'los', 'las', 'y', 'en', 'que', 'mi', 'tu', 'te', 'se', 'lo', 'un', 'una', 'por', 'con', 'es', 'del', 'al', 'su'
])

const VOWELS = /[aeiouyáéíóúüàèìòùâêîôûäëïöæøå]+/gi

/** Rough syllable count from vowel groups; works for English and Spanish. */
export const syllables = (raw: string) => {
  const w = raw.toLowerCase().replace(/[^a-záéíóúüñàèìòùâêîôûäëïöæøå']/g, '')
  if (!w) return 1
  let n = (w.match(VOWELS) || []).length
  // Silent final e after a single consonant: "time", "love", "make" (not "the", "be").
  if (w.length > 3 && /[^aeiouy][aeiouy][^aeiouy]e$/.test(w) && !/le$/.test(w)) n -= 1
  // "-ed" is usually not its own syllable ("played", "walked"), except after t/d ("wanted").
  if (w.length > 3 && /[^aeiouytd]ed$/.test(w)) n -= 1
  return Math.max(1, n)
}

const singWeight = (word: string, isLast: boolean) => {
  const clean = word.toLowerCase().replace(/[^a-záéíóúüñ']/g, '')
  let weight = syllables(word)
  if (LIGHT.has(clean)) weight *= 0.65
  // Long vowel sounds stretch a little: "oo", "ee", "ay", "igh", "ow".
  if (/(oo|ee|ay|igh|ow|ou)/.test(clean)) weight *= 1.15
  // Phrase endings are held: the line's last word, and words before a comma or dash.
  if (isLast) weight *= 1.6
  else if (/[,;:—–-]$/.test(word)) weight *= 1.3
  // Vocalizations like "ooh", "yeah", "oh" are usually drawn out.
  if (/^(o+h+|oo+h*|ah+|yeah+|whoa+|ay+|la+|na+)$/.test(clean)) weight *= 1.4
  return weight
}

/** 0..1 progress of a word at a given time. */
export const fillAt = (w: WordSpan, pos: number) =>
  pos <= w.start ? 0 : pos >= w.end ? 1 : (pos - w.start) / (w.end - w.start)
