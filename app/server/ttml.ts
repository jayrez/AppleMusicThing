import type { LyricLine, LyricPart, LyricWord } from '../shared/types'

// Parses Apple Music lyrics (TTML). Apple sends one of:
//  - itunes:timing="Word": <p begin end> with <span begin end> per word or
//    syllable; syllables of one word sit next to each other with no space.
//  - itunes:timing="Line": <p begin end>whole line</p>
//  - no timing: plain lines.
// Background vocals (<span ttm:role="x-bg">) are skipped, like Apple's own
// main lyric line.

export type ParsedTtml = { synced: LyricLine[] } | { plain: string[] } | null

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })

/** "12.345", "1:02.345", "00:01:02.345", "12.345s" → ms */
export const clock = (v?: string): number | undefined => {
  if (!v) return undefined
  const s = v.trim().replace(/s$/, '')
  const parts = s.split(':').map(Number)
  if (parts.some((n) => !Number.isFinite(n))) return undefined
  const sec = parts.reduce((acc, n) => acc * 60 + n, 0)
  return Math.round(sec * 1000)
}

const attr = (attrs: string, name: string) => {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*"([^"]*)"`).exec(attrs)
  return m ? m[1] : undefined
}

type Piece = { kind: 'timed'; text: string; t: number; end: number } | { kind: 'text'; text: string }

const TOKEN = /<(\/?)([\w:-]+)([^>]*?)(\/?)>|([^<]+)/g

const parseParagraph = (inner: string): Piece[] => {
  const pieces: Piece[] = []
  const stack: { bg: boolean; t?: number; end?: number }[] = []
  let m: RegExpExecArray | null
  TOKEN.lastIndex = 0
  while ((m = TOKEN.exec(inner))) {
    const [, closing, tag, attrs, selfClosing, text] = m
    if (text !== undefined) {
      if (stack.some((s) => s.bg)) continue
      const top = stack[stack.length - 1]
      const t = decode(text)
      if (top && top.t !== undefined && top.end !== undefined) pieces.push({ kind: 'timed', text: t, t: top.t, end: top.end })
      else pieces.push({ kind: 'text', text: t })
      continue
    }
    if (tag === 'br') { pieces.push({ kind: 'text', text: ' ' }); continue }
    if (tag !== 'span') continue
    if (closing) { stack.pop(); continue }
    if (selfClosing) continue
    const role = attr(attrs, 'ttm:role') || ''
    stack.push({ bg: role === 'x-bg', t: clock(attr(attrs, 'begin')), end: clock(attr(attrs, 'end')) })
  }
  return pieces
}

/** Group timed syllables into words, splitting wherever whitespace appears. */
const toWords = (pieces: Piece[]): LyricWord[] => {
  const words: LyricWord[] = []
  let parts: (LyricPart & { text: string })[] = []
  const flush = () => {
    if (!parts.length) return
    const text = parts.map((p) => p.text).join('')
    if (text.trim()) {
      words.push({
        t: parts[0].t,
        end: parts[parts.length - 1].end,
        text: text.trim(),
        parts: parts.length > 1 ? parts.map(({ t, end, len }) => ({ t, end, len })) : undefined
      })
    }
    parts = []
  }
  for (const p of pieces) {
    if (p.kind === 'text') {
      if (/\s/.test(p.text)) flush()
      else if (parts.length) parts[parts.length - 1].text += p.text // stray punctuation joins the word
      continue
    }
    // A timed span can itself contain spaces ("Hold the"), so split it.
    const chunks = p.text.split(/(\s+)/)
    const letters = p.text.replace(/\s+/g, '').length || 1
    let cursor = p.t
    for (const c of chunks) {
      if (!c) continue
      if (/^\s+$/.test(c)) { flush(); continue }
      const share = ((p.end - p.t) * c.length) / letters
      parts.push({ text: c, t: cursor, end: cursor + share, len: c.length })
      cursor += share
    }
  }
  flush()
  return words
}

export const parseTtml = (ttml: string): ParsedTtml => {
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(ttml)
  if (!body) return null
  const lines: LyricLine[] = []
  const plain: string[] = []
  let anyTimed = false
  const P = /<p\b([^>]*)>([\s\S]*?)<\/p>/g
  let m: RegExpExecArray | null
  while ((m = P.exec(body[1]))) {
    const t = clock(attr(m[1], 'begin'))
    const end = clock(attr(m[1], 'end'))
    const pieces = parseParagraph(m[2])
    const hasWordTiming = pieces.some((p) => p.kind === 'timed')
    const words = hasWordTiming ? toWords(pieces) : undefined
    const text = (words ? words.map((w) => w.text).join(' ') : pieces.map((p) => p.text).join(''))
      .replace(/\s+/g, ' ')
      .trim()
    plain.push(text)
    if (t === undefined || !text) continue
    anyTimed = true
    lines.push({ t, end, text, words: words && words.length ? words : undefined })
  }
  if (anyTimed && lines.length) {
    lines.sort((a, b) => a.t - b.t)
    // Show a ♪ break where Apple's lines leave a long instrumental gap.
    const withBreaks: LyricLine[] = []
    lines.forEach((l, i) => {
      if (i > 0) {
        const prev = lines[i - 1]
        if (prev.end !== undefined && l.t - prev.end > 9000) withBreaks.push({ t: prev.end + 500, text: '' })
      }
      withBreaks.push(l)
    })
    return { synced: withBreaks }
  }
  const nonEmpty = plain.filter(Boolean)
  return nonEmpty.length ? { plain: nonEmpty } : null
}
