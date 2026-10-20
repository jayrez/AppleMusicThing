// Pulls a representative color out of the album art so the whole screen takes
// on the record's color. Runs once per song on a 24x24 downscale.

export type Palette = { base: string; glow: string; accent: string }

export const FALLBACK: Palette = {
  base: 'hsl(222, 12%, 15%)',
  glow: 'hsla(222, 20%, 60%, 0.16)',
  accent: 'hsl(222, 30%, 78%)'
}

const toHsl = (r: number, g: number, b: number) => {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h *= 60
  return { h, s, l }
}

export const paletteFromImage = (img: HTMLImageElement): Palette => {
  try {
    const n = 24
    const c = document.createElement('canvas')
    c.width = c.height = n
    const g = c.getContext('2d')!
    g.drawImage(img, 0, 0, n, n)
    const px = g.getImageData(0, 0, n, n).data
    // Weight each pixel by saturation and mid-lightness so a colorful element
    // beats a large flat black or white area.
    let x = 0, y = 0, wSum = 0, sSum = 0, lSum = 0
    for (let i = 0; i < px.length; i += 4) {
      const { h, s, l } = toHsl(px[i], px[i + 1], px[i + 2])
      const w = 0.05 + s * s * (1 - Math.abs(l - 0.5) * 1.6)
      if (w <= 0) continue
      const rad = (h * Math.PI) / 180
      x += Math.cos(rad) * w
      y += Math.sin(rad) * w
      sSum += s * w
      lSum += l * w
      wSum += w
    }
    if (!wSum) return FALLBACK
    const hue = Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360)
    const sat = Math.min(1, sSum / wSum)
    const grey = sat < 0.12
    const s = grey ? 8 : Math.round(Math.min(62, 28 + sat * 50))
    const light = lSum / wSum
    return {
      base: `hsl(${hue}, ${s}%, ${grey ? 13 : Math.round(11 + light * 8)}%)`,
      glow: `hsla(${hue}, ${Math.min(80, s + 15)}%, 55%, ${grey ? 0.12 : 0.22})`,
      accent: `hsl(${hue}, ${grey ? 10 : Math.max(55, s)}%, ${grey ? 82 : 74}%)`
    }
  } catch {
    return FALLBACK // canvas read blocked (cross-origin) — keep neutral
  }
}
