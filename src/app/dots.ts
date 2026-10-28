// ась's presence: a sphere of dots instead of a face. Faces pull the eye and hold
// it (attention capture), a driver can't afford that; a shape made of dots reads
// with peripheral vision — breathing sphere, ripple, travelling band, flat line.
// Size and position move, brightness stays put (WCAG 2.3.1).

import type { Theme } from './app'

type S = 'idle' | 'listening' | 'thinking' | 'speaking' | 'paused'

const N = 380
// dots spread evenly over a sphere (golden-angle spiral)
const PTS = Array.from({ length: N }, (_, i) => {
  const y = 1 - (2 * (i + 0.5)) / N
  const r = Math.sqrt(1 - y * y)
  const a = i * 2.39996323
  return { x: Math.cos(a) * r, y, z: Math.sin(a) * r, k: Math.sin(i * 12.9898) * 0.5 + 0.5 }
})

const INK: Record<Theme, { live: string; paused: string; size: number; alpha: number }> = {
  day: { live: '#2f3bff', paused: '#8a8da0', size: 1, alpha: 1 },
  // full sun: bigger, solid, darkest cobalt — thin faint dots vanish under glare first
  sun: { live: '#1f28d6', paused: '#3d4152', size: 1.35, alpha: 1 },
  // night: dim lilac, never white
  night: { live: '#9fa6ff', paused: '#4a4e66', size: 1, alpha: 0.78 },
}

const TARGET: Record<S, { scale: number; spin: number; flat: number; band: number }> = {
  idle: { scale: 0.9, spin: 0.12, flat: 0, band: 0 },
  listening: { scale: 1, spin: 0.22, flat: 0, band: 0 },
  thinking: { scale: 0.94, spin: 0.5, flat: 0, band: 1 },
  speaking: { scale: 1, spin: 0.2, flat: 0, band: 0 },
  // pause: the sphere lies down into a grey line — «I'm here, but quiet»
  paused: { scale: 0.86, spin: 0, flat: 1, band: 0 },
}

export class DotOrb {
  private ctx: CanvasRenderingContext2D | null
  private raf = 0
  private state: S = 'idle'
  private theme: Theme = 'day'
  private cur = { scale: 0.9, spin: 0.12, flat: 0, band: 0, lv: 0 }
  private angle = 0
  private rings: number[] = [] // birth times of «word» rings
  private last = performance.now()
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  private w = 0
  private h = 0

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')
    new ResizeObserver(() => this.resize()).observe(canvas)
    this.resize()
    this.frame()
  }

  setState(s: S) {
    this.state = s
  }
  setTheme(t: Theme) {
    this.theme = t
  }
  /** 0..1 — the driver's voice or ась's own speech */
  level(lv: number) {
    this.cur.lv += (lv - this.cur.lv) * (lv > this.cur.lv ? 0.5 : 0.08)
  }
  /** a spoken word: a ring runs from the centre outward */
  pulse() {
    const t = performance.now()
    if (this.rings.length && t - this.rings[this.rings.length - 1] < 180) return
    this.rings.push(t)
    if (this.rings.length > 4) this.rings.shift()
  }

  private resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2)
    this.w = this.canvas.clientWidth
    this.h = this.canvas.clientHeight
    this.canvas.width = Math.max(1, Math.round(this.w * dpr))
    this.canvas.height = Math.max(1, Math.round(this.h * dpr))
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  private frame = () => {
    this.raf = requestAnimationFrame(this.frame)
    const ctx = this.ctx
    if (!ctx || document.hidden || !this.w) return
    const now = performance.now()
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    const t = now / 1000
    const c = this.cur, tg = TARGET[this.state]
    const k = 1 - Math.pow(0.001, dt) // ~same feel at 60 and 120 Hz
    c.scale += (tg.scale - c.scale) * k
    c.spin += (tg.spin - c.spin) * k
    c.flat += (tg.flat - c.flat) * k
    c.band += (tg.band - c.band) * k
    if (this.state !== 'listening' && this.state !== 'speaking') c.lv *= 0.92
    if (!this.reduced) this.angle += c.spin * dt
    this.rings = this.rings.filter((b) => now - b < 1100)

    const ink = INK[this.theme]
    const R = Math.min(this.w, this.h) * 0.42 * (c.scale + (this.reduced ? 0 : c.lv * 0.08 + (this.state === 'idle' ? 0.02 * Math.sin(t * 1.25) : 0)))
    const cx = this.w / 2, cy = this.h / 2
    const ca = Math.cos(this.angle), sa = Math.sin(this.angle)
    const tilt = 0.32, ct = Math.cos(tilt), st = Math.sin(tilt)
    const bandY = ((t * 0.55) % 1.6) - 0.8 // travels top → bottom for «думаю»
    const base = Math.max(1.1, R * 0.028) * ink.size

    ctx.clearRect(0, 0, this.w, this.h)
    ctx.fillStyle = this.state === 'paused' ? ink.paused : ink.live
    for (const p of PTS) {
      // rotate around y, then tilt toward the viewer
      let x = p.x * ca - p.z * sa
      let z = p.x * sa + p.z * ca
      let y = p.y * ct - z * st
      z = p.y * st + z * ct
      // listening: dots breathe out with the voice, each by its own amount
      let push = 0
      if (!this.reduced) {
        push += c.lv * 0.22 * (0.4 + p.k) * (0.6 + 0.4 * Math.sin(t * 7 + p.k * 9))
        for (const b of this.rings) {
          const age = (now - b) / 1100
          const d = Math.hypot(x, y)
          push += 0.12 * Math.exp(-Math.pow((d - age * 1.2) / 0.16, 2)) * (1 - age)
        }
      }
      x *= 1 + push
      y *= 1 + push
      // paused: squash into a horizontal line of dots
      y *= 1 - c.flat * 0.94
      const depth = (z + 1) / 2 // 0 back … 1 front
      let r = base * (0.35 + 0.85 * depth)
      // the «думаю» band: dots in it grow, never brighten
      if (c.band > 0.01) r *= 1 + c.band * 0.9 * Math.exp(-Math.pow((y - bandY) / 0.16, 2))
      const a = ink.alpha * (0.18 + 0.82 * depth)
      if (a < 0.06 || r < 0.4) continue
      ctx.globalAlpha = a
      ctx.beginPath()
      ctx.arc(cx + x * R, cy - y * R, r, 0, 6.2832)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  destroy() {
    cancelAnimationFrame(this.raf)
  }
}
