import { RefObject, useEffect, useLayoutEffect, useState } from 'react'

// "Liquid glass" without backdrop-filter (the Car Thing's Chromium predates it).
// Everything behind the glass is static for a whole song (blurred backdrop +
// album art), so we render that scene once per song, blurred, at quarter
// resolution, and paint it inside each glass element lined up with what's
// actually behind it. Costs one small canvas render per song, nothing per frame.

export type Scenes = { backdrop: string; scene: string; w: number; h: number }

type Layout = { w: number; h: number; padX: number; padY: number; art: number }

const SCALE = 4 // render at 1/4 size; it's blurred anyway
export const ART_RADIUS = 18

const roundRect = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

/** Darkening laid over the backdrop: light on the art side, darker under the text. */
const shade = (g: CanvasRenderingContext2D, W: number, H: number) => {
  const grad = g.createLinearGradient(0, 0, W, 0)
  grad.addColorStop(0, 'rgba(0,0,0,0.22)')
  grad.addColorStop(1, 'rgba(0,0,0,0.52)')
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
}

export const renderScenes = (img: HTMLImageElement, L: Layout): Scenes | null => {
  try {
    const W = Math.max(8, Math.round(L.w / SCALE)), H = Math.max(8, Math.round(L.h / SCALE))

    // 1) Backdrop: the art blown up to cover the screen, heavily blurred and a bit richer.
    const back = document.createElement('canvas')
    back.width = W; back.height = H
    const b = back.getContext('2d')!
    const cover = Math.max(W, H) * 1.35
    b.filter = 'blur(7px) saturate(150%)'
    b.drawImage(img, (W - cover) / 2, (H - cover) / 2, cover, cover)
    b.filter = 'none'

    // 2) Scene: what the glass sees — shaded backdrop plus the art in its place — blurred again.
    const comp = document.createElement('canvas')
    comp.width = W; comp.height = H
    const c = comp.getContext('2d')!
    c.drawImage(back, 0, 0)
    shade(c, W, H)
    c.save()
    roundRect(c, L.padX / SCALE, L.padY / SCALE, L.art / SCALE, L.art / SCALE, ART_RADIUS / SCALE)
    c.clip()
    c.drawImage(img, L.padX / SCALE, L.padY / SCALE, L.art / SCALE, L.art / SCALE)
    c.restore()

    const scene = document.createElement('canvas')
    scene.width = W; scene.height = H
    const s = scene.getContext('2d')!
    s.filter = 'blur(2.5px) saturate(130%)'
    s.drawImage(comp, 0, 0)

    return {
      backdrop: back.toDataURL('image/jpeg', 0.85),
      scene: scene.toDataURL('image/jpeg', 0.85),
      w: L.w,
      h: L.h
    }
  } catch {
    return null // canvas blocked (cross-origin) — the screen falls back to flat color
  }
}

/** Renders the backdrop and glass scene whenever the song's art or the layout changes. */
export const useScenes = (src: string, layout: Layout) => {
  const [scenes, setScenes] = useState<Scenes | null>(null)
  const { w, h, padX, padY, art } = layout
  useEffect(() => {
    if (!src) { setScenes(null); return }
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      // Let the art itself paint first; build the glass on the next idle moment.
      setTimeout(() => { if (!cancelled) setScenes(renderScenes(img, { w, h, padX, padY, art })) }, 30)
    }
    img.onerror = () => { if (!cancelled) setScenes(null) }
    img.src = src
    return () => { cancelled = true }
  }, [src, w, h, padX, padY, art])
  return scenes
}

const LENS = 1.07 // slight magnification toward the middle reads as refraction at the edges

/**
 * Paints the blurred scene inside a glass element, aligned with what's behind it.
 * `deps` should include anything that moves the element.
 */
export const useGlass = (ref: RefObject<HTMLElement>, scenes: Scenes | null, deps: unknown[] = []) => {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (!scenes) { el.style.backgroundImage = ''; return }
    // Use the untransformed size (the capsule scales in) around the on-screen center.
    const r = el.getBoundingClientRect()
    const w = el.offsetWidth, h = el.offsetHeight
    const sw = scenes.w * LENS, sh = scenes.h * LENS
    const x = w / 2 - LENS * (r.left + r.width / 2)
    const y = h / 2 - LENS * (r.top + r.height / 2)
    el.style.backgroundImage = `linear-gradient(rgba(255,255,255,0.10), rgba(255,255,255,0.10)), url(${scenes.scene})`
    el.style.backgroundSize = `100% 100%, ${sw}px ${sh}px`
    el.style.backgroundPosition = `0 0, ${x}px ${y}px`
    el.style.backgroundRepeat = 'no-repeat'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes, ...deps])
}
