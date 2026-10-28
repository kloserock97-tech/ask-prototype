// The voice display: a strip of dot-matrix along the bottom of the screen, lit in
// the warm amber of a car's instrument lights — a car-stereo spectrum, not an AI glow.
// One small fragment shader, sized to the strip only.
//   idle      — a low, slow ripple
//   listening — your voice, as a spectrum from the centre out (low notes in the middle)
//   thinking  — one lit segment running side to side with a fading tail (a K.I.T.T. scanner)
//   speaking  — ась's voice, the same spectrum
//   paused    — one dim row
// Touches and haptic ticks travel across it as a bump.

export type BandTheme = 'night' | 'light'
type S = 'idle' | 'listening' | 'thinking' | 'speaking' | 'paused'

const COLS = 48

const VERT = `#version 300 es
in vec2 a; void main(){ gl_Position = vec4(a,0.,1.); }`

const FRAG = `#version 300 es
precision highp float;
out vec4 o;
uniform vec2 uRes; uniform float uPitch; uniform float uCols; uniform float uRows;
uniform float uH[${COLS}];    // lit height per column, 0..1
uniform float uPk[${COLS}];   // peak-hold per column, 0..1
uniform vec3 uBg; uniform vec3 uOff; uniform vec3 uOn; uniform vec3 uHot;
uniform float uGray;

void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  // centre the grid in the strip
  vec2 off = (uRes - vec2(uCols, uRows)*uPitch)*.5;
  vec2 g = (px - off)/uPitch;
  vec2 cell = floor(g);
  vec3 col = uBg;
  if (cell.x >= 0. && cell.x < uCols && cell.y >= 0. && cell.y < uRows) {
    int ci = int(cell.x);
    float h = uH[ci]*uRows, pk = uPk[ci]*uRows;
    float row = uRows - 1. - cell.y;                // 0 at the bottom
    float on = step(row + .5, h);
    float peak = step(abs(row - floor(max(pk - 1., 0.))), .5)*step(1., pk)*(1. - on);
    vec2 f = fract(g) - .5;
    float d = length(f);
    float r = .3 + .06*on;
    float dotm = 1. - smoothstep(r - .06, r + .04, d);
    // a little phosphor: lit dots bleed a touch of light around them
    float bloom = on*exp(-d*d*9.)*.22;
    vec3 lit = mix(uOn, uHot, smoothstep(.55, 1., row/max(uRows - 1., 1.)));
    vec3 c = mix(uOff, lit, max(on, peak*.8));
    c = mix(c, uOff*1.4, uGray*on);
    col = mix(uBg, c, dotm) + lit*bloom*(1. - uGray);
  }
  o = vec4(col, 1.);
}`

const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]

const PAL: Record<BandTheme, { bg: string; off: string; on: string; hot: string }> = {
  night: { bg: '#0b0b0c', off: '#1f1c17', on: '#f2a33a', hot: '#ffd9a0' },
  light: { bg: '#f4f3f0', off: '#e2dfd8', on: '#c4650b', hot: '#7a3a00' },
}

export class Band {
  private gl: WebGL2RenderingContext | null
  private prog: WebGLProgram | null = null
  private u: Record<string, WebGLUniformLocation | null> = {}
  private raf = 0
  private theme: BandTheme = 'night'
  private state: S = 'idle'
  private h = new Float32Array(COLS)
  private pk = new Float32Array(COLS)
  private input = new Float32Array(COLS) // the latest spectrum fed from outside, 0..1
  private bumps: { x: number; t: number; s: number }[] = []
  private gray = 0
  private rows = 12
  private pitch = 8
  private dpr = 1
  private last = performance.now()
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  private ro: ResizeObserver

  constructor(private canvas: HTMLCanvasElement) {
    this.gl = canvas.getContext('webgl2', { antialias: false, alpha: false })
    if (this.gl) this.compile()
    this.ro = new ResizeObserver(() => this.measure())
    this.ro.observe(canvas)
    this.measure()
    this.frame()
  }

  setTheme(t: BandTheme) {
    this.theme = t
  }
  setState(s: S) {
    this.state = s
    if (s !== 'listening' && s !== 'speaking') this.input.fill(0)
  }
  /** a spectrum, low notes first, values 0..1 — mirrored from the centre out */
  feed(spec: ArrayLike<number>) {
    const half = COLS / 2
    for (let i = 0; i < half; i++) {
      const v = spec[Math.min(spec.length - 1, Math.floor((i / half) * spec.length))] ?? 0
      this.input[half - 1 - i] = v
      this.input[half + i] = v
    }
  }
  /** a touch or a haptic tick at x (0..1 across the strip) */
  bump(x: number, s = 1) {
    if (this.reduced) return
    this.bumps.push({ x, t: performance.now(), s })
    if (this.bumps.length > 4) this.bumps.shift()
  }

  private compile() {
    const gl = this.gl!
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(s))
      return s
    }
    const p = gl.createProgram()!
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT))
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return console.warn(gl.getProgramInfoLog(p))
    this.prog = p
    gl.useProgram(p)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(p, 'a')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    for (const n of ['uRes', 'uPitch', 'uCols', 'uRows', 'uH', 'uPk', 'uBg', 'uOff', 'uOn', 'uHot', 'uGray']) this.u[n] = gl.getUniformLocation(p, n)
  }

  private measure() {
    const r = this.canvas.getBoundingClientRect()
    if (!r.width) return
    this.dpr = Math.min(devicePixelRatio || 1, 2)
    this.canvas.width = Math.round(r.width * this.dpr)
    this.canvas.height = Math.round(r.height * this.dpr)
    this.gl?.viewport(0, 0, this.canvas.width, this.canvas.height)
    this.pitch = (r.width - 16) / COLS
    this.rows = Math.max(4, Math.floor((r.height - 8) / this.pitch))
  }

  private frame = () => {
    this.raf = requestAnimationFrame(this.frame)
    if (!this.prog || document.hidden) return
    const now = performance.now()
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    const t = now / 1000
    const target = new Float32Array(COLS)
    const s = this.state
    for (let i = 0; i < COLS; i++) {
      const x = i / (COLS - 1)
      let v = 0
      if (s === 'idle') v = this.reduced ? 0.08 : 0.08 + 0.06 * (0.5 + 0.5 * Math.sin(t * 1.1 + x * 7))
      else if (s === 'listening' || s === 'speaking') v = 0.06 + this.input[i] * 0.94
      else if (s === 'thinking') {
        // one lit segment runs side to side, leaving a fading tail
        const pos = 0.5 + 0.46 * Math.sin(t * 2.4)
        const vel = Math.cos(t * 2.4)
        const dx = (x - pos) * Math.sign(vel || 1)
        v = dx > 0 ? Math.exp(-dx * dx * 900) : Math.exp(-dx * dx * 60)
        v = 0.08 + v * 0.6
      } else v = 1 / this.rows
      // a bump runs out from a touch or a tick
      for (const b of this.bumps) {
        const age = (now - b.t) / 1000
        const d = Math.abs(x - b.x) - age * 1.4
        v += b.s * 0.55 * Math.exp(-d * d * 180) * Math.max(0, 1 - age / 0.9)
      }
      target[i] = Math.min(1, v)
    }
    this.bumps = this.bumps.filter((b) => now - b.t < 900)
    // fast attack, slower fall, peaks hold and drop — the way a stereo meter moves
    for (let i = 0; i < COLS; i++) {
      const a = target[i] > this.h[i] ? 1 - Math.pow(0.0001, dt) : 1 - Math.pow(0.02, dt)
      this.h[i] += (target[i] - this.h[i]) * a
      this.pk[i] = this.h[i] > this.pk[i] ? this.h[i] : Math.max(0, this.pk[i] - dt * 0.35)
    }
    this.gray += ((s === 'paused' ? 1 : 0) - this.gray) * (1 - Math.pow(0.02, dt))
    const gl = this.gl!
    const pal = PAL[this.theme]
    gl.uniform2f(this.u.uRes, this.canvas.width, this.canvas.height)
    gl.uniform1f(this.u.uPitch, this.pitch * this.dpr)
    gl.uniform1f(this.u.uCols, COLS)
    gl.uniform1f(this.u.uRows, this.rows)
    gl.uniform1fv(this.u.uH, this.h)
    gl.uniform1fv(this.u.uPk, this.pk)
    gl.uniform3fv(this.u.uBg, hex(pal.bg))
    gl.uniform3fv(this.u.uOff, hex(pal.off))
    gl.uniform3fv(this.u.uOn, hex(pal.on))
    gl.uniform3fv(this.u.uHot, hex(pal.hot))
    gl.uniform1f(this.u.uGray, this.gray)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext()
    this.prog = null
  }
}
