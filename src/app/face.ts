// The optional character: a cobalt drop with eyes, from the squishmoji engine
// (MIT). Off by default — a face pulls the driver's eye; the dot sphere doesn't.

import { renderLayout, SquishEngine, type SquishExpression } from '@usespaceui/squishmoji'
import type { Theme } from './app'

type S = 'idle' | 'listening' | 'thinking' | 'speaking' | 'paused' | 'unsure'

const EXPR: Record<S, SquishExpression> = {
  idle: 'attentive',
  listening: 'curious',
  thinking: 'doubtful',
  speaking: 'happy',
  unsure: 'confused',
  paused: 'sleepy',
}
const BODY: Record<Theme, { body: string; eye: string }> = {
  sun: { body: '#1f28d6', eye: '#ffffff' },
  night: { body: '#ffffff', eye: '#000000' },
}
const SEED = 'ась'

export class DropFace {
  private engine = new SquishEngine(SEED, { shape: 'drop', expression: 'attentive' })
  private raf = 0
  private theme: Theme = 'night'
  private lv = 0
  private lastDraw = 0
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

  constructor(private host: HTMLElement) {
    this.engine.setShape('drop', -100, 0)
    this.frame()
  }

  setState(s: S) {
    this.engine.setExpression(EXPR[s], performance.now() / 1000)
  }
  setTheme(t: Theme) {
    this.theme = t
  }
  level(lv: number) {
    this.lv += (lv - this.lv) * 0.3
  }

  private frame = () => {
    this.raf = requestAnimationFrame(this.frame)
    const now = performance.now()
    if (document.hidden || now - this.lastDraw < 33) return // 30 fps is plenty for blinking eyes
    this.lastDraw = now
    const t = this.reduced ? 0 : now / 1000
    // blink every ~4.7 s, gaze drifts a little — the same rhythm as the library's own wrapper
    const ph = (t + 1.35) % 4.7
    const lid = this.reduced || ph > 0.18 ? 1 : Math.max(0.035, Math.abs(ph / 0.09 - 1))
    const gx = this.reduced ? 0 : Math.sin(t * 0.64 + 0.8) * 9
    const gy = this.reduced ? 0 : Math.sin(t * 0.43 + 2.2) * 7
    const layout = this.engine.layout(t, (eyes) =>
      eyes.map((e) => {
        const m = [...e.matrix] as typeof e.matrix
        m[3] *= lid
        m[4] += gx
        m[5] += gy
        return { ...e, matrix: m }
      }),
    )
    const c = BODY[this.theme]
    layout.colors.body = c.body
    layout.colors.eye = c.eye
    this.host.innerHTML = renderLayout(layout, { seed: SEED, backgroundStyle: 'solid' })
    if (!this.reduced) this.host.style.transform = `translateY(${-this.lv * 8}px) scale(${1 + this.lv * 0.05})`
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.host.innerHTML = ''
  }
}
