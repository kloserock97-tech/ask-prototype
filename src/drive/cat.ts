import { SquishEngine, renderLayout, type SquishExpression } from '@usespaceui/squishmoji'

// Ась as a bubble cat: the squishmoji «cat» shape (MIT, the same library as Темп in Marathon, another shape),
// painted with our own iridescent fill. The engine morphs expressions; blinking and the voice swell are ours.

export type Mood = 'calm' | 'listen' | 'think' | 'speak' | 'off'

const EXPR: Record<Mood, SquishExpression> = {
  calm: 'attentive',
  listen: 'curious',
  think: 'doubtful',
  speak: 'happy',
  off: 'sleepy',
}

let uid = 0

export class Cat {
  readonly el: HTMLDivElement
  private body: HTMLDivElement
  private engine = new SquishEngine('ась', { shape: 'cat', expression: 'attentive' })
  private mood: Mood = 'calm'
  private raf = 0
  private t0 = performance.now()
  private nextBlink = 2.4
  private amp = 0
  private target = 0
  private id = `cat${++uid}`
  private still: boolean

  constructor() {
    this.el = document.createElement('div')
    this.el.className = 'dv-cat'
    this.el.setAttribute('aria-hidden', 'true')
    // position flies on the outer element, breathing and voice swell live on the inner one
    this.body = document.createElement('div')
    this.body.className = 'dv-cat-body'
    this.el.append(this.body)
    this.still = matchMedia('(prefers-reduced-motion: reduce)').matches
    this.frame = this.frame.bind(this)
    this.raf = requestAnimationFrame(this.frame)
  }

  set(mood: Mood) {
    if (mood === this.mood) return
    this.mood = mood
    this.engine.setExpression(EXPR[mood], this.now(), this.still ? 0.01 : 0.28)
  }

  /** 0..1, how loud the voice is right now (ours or the person's). */
  voice(level: number) {
    this.target = level
  }

  destroy() {
    cancelAnimationFrame(this.raf)
  }

  private now() {
    return (performance.now() - this.t0) / 1000
  }

  private frame() {
    const t = this.now()
    // blink: a quick close and open every 3–5 s, not while asleep
    let lid = 1
    if (this.mood !== 'off' && !this.still) {
      const d = t - this.nextBlink
      if (d > 0 && d < 0.16) lid = 1 - Math.sin((d / 0.16) * Math.PI) * 0.9
      if (d >= 0.16) this.nextBlink = t + 3 + Math.random() * 2
    }
    const layout = this.engine.layout(t, (eyes) =>
      eyes.map((e) => ({ ...e, matrix: [e.matrix[0], e.matrix[1] * lid, e.matrix[2], e.matrix[3] * lid, e.matrix[4], e.matrix[5]] as typeof e.matrix })),
    )
    this.body.innerHTML = this.paint(renderLayout(layout, { size: 200 }))
    // breathing plus the voice swell
    this.amp += (this.target - this.amp) * 0.25
    const breathe = this.still ? 0 : Math.sin(t * 1.7) * 0.012
    this.body.style.transform = `scale(${(1 + breathe + this.amp * 0.07).toFixed(4)})`
    this.raf = requestAnimationFrame(this.frame)
  }

  private paint(svg: string) {
    const body = svg.match(/<path(?![^>]*data-sq-eye)[^>]*\sd="([^"]+)"/)
    const eyes = [...svg.matchAll(/<path[^>]*data-sq-eye[^>]*\sd="([^"]+)"[^>]*\stransform="([^"]+)"/g)]
    if (!body) return ''
    const d = body[1]
    const id = this.id
    const eyeSvg = eyes.map((m) => `<path d="${m[1]}" transform="${m[2]}" fill="#1a1433"/>`).join('')
    return `<svg viewBox="-92 -92 184 184" width="100%" height="100%" aria-hidden="true">
<defs>
<linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8ad8"/><stop offset=".38" stop-color="#b08cff"/><stop offset=".68" stop-color="#6ec8ff"/><stop offset="1" stop-color="#7ff0d5"/></linearGradient>
<radialGradient id="${id}p" cx=".18" cy=".86" r=".5"><stop offset="0" stop-color="#ffc08a" stop-opacity=".95"/><stop offset="1" stop-color="#ffc08a" stop-opacity="0"/></radialGradient>
<radialGradient id="${id}m" cx=".84" cy=".78" r=".46"><stop offset="0" stop-color="#7ff0d5" stop-opacity=".9"/><stop offset="1" stop-color="#7ff0d5" stop-opacity="0"/></radialGradient>
<radialGradient id="${id}h" cx=".32" cy=".3" r=".24"><stop offset="0" stop-color="#fff" stop-opacity=".92"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
</defs>
<path d="${d}" fill="url(#${id}b)"/><path d="${d}" fill="url(#${id}p)"/><path d="${d}" fill="url(#${id}m)"/><path d="${d}" fill="url(#${id}h)"/>
<path d="${d}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3"/>${eyeSvg}</svg>`
  }
}
