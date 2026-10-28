// The live glow at the bottom of the tap zone: light rising from the bottom
// edge, seen through the same fluted glass as the rest of the product.
// Height follows the driver's voice; each state moves it differently.
// Nothing flashes faster than ~1 Hz (WCAG 2.3.1 allows up to 3).

import type { Theme } from './app'

const VERT = `#version 300 es
in vec2 a; out vec2 uv;
void main(){ uv = a*0.5+0.5; gl_Position = vec4(a,0.,1.); }`

const FRAG = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform vec2 res; uniform float t;
uniform vec3 cA; uniform vec3 cB; uniform vec3 cCore;
uniform float height; uniform float energy; uniform float band; uniform float bandPos;
uniform float speed; uniform float flutes; uniform float alpha;
uniform float focus; uniform float focusAmt; uniform float crisp;

float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float noise(float x){ float i=floor(x), f=fract(x); float a=h21(vec2(i,1.7)), b=h21(vec2(i+1.,1.7)); return mix(a,b,f*f*(3.-2.*f)); }

void main(){
  // fluted glass: each strip is a small lens
  float s = uv.x*flutes; float idx = floor(s); float f = fract(s)-.5;
  float x = uv.x + f*abs(f)*.35; x = mix(x,(idx+.5)/flutes,.35);
  float tt = t*speed;
  // ragged top edge of the light — three slow noise layers
  float edge = height*(0.62 + 0.25*noise(x*3.1+tt*.6) + 0.13*noise(x*7.3-tt*.9));
  // the light leans toward the finger (listening) or swells from the centre (speaking)
  edge *= 1. + focusAmt*exp(-pow((x-focus)/.28, 2.));
  float y = uv.y;
  // 1 at the bottom, 0 at the edge; in full sun the edge is crisp — glare eats soft gradients first
  float body = mix(smoothstep(edge, 0., y), smoothstep(edge, edge*.86, y), crisp);
  float glow = pow(body, 1.6);
  // travelling band for «думаю»
  float b = band*exp(-pow((x-bandPos)/.12,2.))*smoothstep(edge*1.15,0.,y);
  float lens = pow(max(cos(3.14159*f),0.),.5);
  // dense at the edge so the colour stays saturated over a light background
  float v = (smoothstep(0.,.35,body)*(.92+.08*energy) + b*.9)*(.82+.18*lens);
  vec3 col = mix(cB, cA, smoothstep(0.,.55,glow));
  col = mix(col, cCore, smoothstep(.55,1.,glow)*(.3+.7*energy) + b*.6);
  float rim = 1.-smoothstep(0.,.04,.5-abs(f));
  col += rim*.06*glow;
  float a = clamp(v,0.,1.)*alpha;
  o = vec4(col*a, a);
}`

type Pal = { a: [number, number, number]; b: [number, number, number]; core: [number, number, number] }
const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]

// Palettes from the glare study (research/08): in full sun a solid deep cobalt band
// with a crisp edge (white label on it ≈ 9:1); by day the brand cobalt; at night a dim,
// never-white light so the eyes keep their dark adaptation.
export const PALETTE: Record<Theme, Record<'live' | 'paused', Pal> & { alpha: number; crisp: number }> = {
  day: { live: { a: hex('#2F3BFF'), b: hex('#6F78FF'), core: hex('#4A55FF') }, paused: { a: hex('#545869'), b: hex('#9A9DB0'), core: hex('#6B6F80') }, alpha: 1, crisp: 0.25 },
  sun: { live: { a: hex('#1F28D6'), b: hex('#1F28D6'), core: hex('#2A34E6') }, paused: { a: hex('#3D4152'), b: hex('#3D4152'), core: hex('#3D4152') }, alpha: 1, crisp: 1 },
  night: { live: { a: hex('#2F3BFF'), b: hex('#1F28D6'), core: hex('#6F78FF') }, paused: { a: hex('#2A2D4D'), b: hex('#1E2140'), core: hex('#3A3D5C') }, alpha: 0.6, crisp: 0 },
}

type S = 'idle' | 'listening' | 'thinking' | 'speaking' | 'paused'

export class Aurora {
  private gl: WebGL2RenderingContext | null
  private prog: WebGLProgram | null = null
  private u: Record<string, WebGLUniformLocation | null> = {}
  private raf = 0
  private t0 = performance.now()
  private state: S = 'idle'
  private theme: Theme = 'day'
  private target = { height: 0.22, energy: 0.1, band: 0, speed: 0.4 }
  private cur = { height: 0.22, energy: 0.1, band: 0, speed: 0.4, a: [0, 0, 0], b: [0, 0, 0], core: [0, 0, 0] }
  private voiceLv = 0
  private bump = 0
  private focusX = 0.5
  private focusAmt = 0
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

  constructor(private canvas: HTMLCanvasElement) {
    this.gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false })
    if (this.gl) this.compile()
    const p = PALETTE.day.live
    this.cur.a = [...p.a]; this.cur.b = [...p.b]; this.cur.core = [...p.core]
    new ResizeObserver(() => this.resize()).observe(canvas)
    this.resize()
    this.frame()
  }

  setTheme(t: Theme) {
    this.theme = t
  }

  setState(s: S) {
    this.state = s
    this.target = {
      idle: { height: 0.24, energy: 0.1, band: 0, speed: 0.35 },
      listening: { height: 0.4, energy: 0.55, band: 0, speed: 0.7 },
      thinking: { height: 0.32, energy: 0.35, band: 1, speed: 0.6 },
      speaking: { height: 0.44, energy: 0.6, band: 0, speed: 0.6 },
      paused: { height: 0.2, energy: 0, band: 0, speed: 0 },
    }[s]
  }

  /** driver's loudness 0..1 — fast attack (~80 ms), slow release (~300 ms) */
  voice(lv: number) {
    this.voiceLv += (lv - this.voiceLv) * (lv > this.voiceLv ? 0.6 : 0.07)
  }
  /** a spoken word: moves the height, never the brightness */
  pulse(amount = 0.35) {
    this.bump = Math.min(0.7, this.bump + amount)
  }
  /** an answer arrived — one slow surge */
  flash() {
    this.bump = 0.9
  }
  /** x of the finger in 0..1 — the light leans toward it */
  touch(x = 0.5) {
    this.focusX = x
    this.bump = Math.max(this.bump, 0.4)
  }
  currentLevel() {
    return Math.min(1, this.voiceLv * (this.state === 'listening' ? 1 : 0) + this.bump * 0.6)
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
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return
    this.prog = p
    gl.useProgram(p)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(p, 'a')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    for (const n of ['res', 't', 'cA', 'cB', 'cCore', 'height', 'energy', 'band', 'bandPos', 'speed', 'flutes', 'alpha', 'focus', 'focusAmt', 'crisp']) this.u[n] = gl.getUniformLocation(p, n)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  }

  private resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2) * 0.6
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr))
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr))
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
      this.gl?.viewport(0, 0, w, h)
    }
  }

  private frame = () => {
    this.raf = requestAnimationFrame(this.frame)
    if (!this.prog || document.hidden) return
    const gl = this.gl!
    const k = 0.07
    const c = this.cur, tg = this.target
    c.height += (tg.height - c.height) * k
    c.energy += (tg.energy - c.energy) * k
    c.band += (tg.band - c.band) * k
    c.speed += (tg.speed - c.speed) * k
    const pal = PALETTE[this.theme][this.state === 'paused' ? 'paused' : 'live']
    for (let i = 0; i < 3; i++) {
      c.a[i] += (pal.a[i] - c.a[i]) * k
      c.b[i] += (pal.b[i] - c.b[i]) * k
      c.core[i] += (pal.core[i] - c.core[i]) * k
    }
    this.bump *= 0.95
    if (this.state !== 'listening') this.voiceLv *= 0.9
    const wantFocus = this.state === 'listening' ? 0.35 + this.voiceLv * 0.5 : this.state === 'speaking' ? 0.25 : 0
    this.focusAmt += (wantFocus - this.focusAmt) * 0.08
    if (this.state === 'speaking') this.focusX += (0.5 - this.focusX) * 0.05
    const t = (performance.now() - this.t0) / 1000
    // idle breathes once every ~5 s
    const breath = this.state === 'idle' && !this.reduced ? 0.03 * Math.sin(t * 1.2) : 0
    const live = this.voiceLv * 0.5 + this.bump * 0.3
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.uniform2f(this.u.res, this.canvas.width, this.canvas.height)
    gl.uniform1f(this.u.t, this.reduced ? 0 : t)
    gl.uniform3fv(this.u.cA, c.a)
    gl.uniform3fv(this.u.cB, c.b)
    gl.uniform3fv(this.u.cCore, c.core)
    gl.uniform1f(this.u.height, Math.min(0.9, c.height + live + breath))
    // brightness stays within ±8 % of the state's level: syllables come 4–5 times a second,
    // faster than the 3 flashes/s that WCAG 2.3.1 allows
    gl.uniform1f(this.u.energy, Math.min(1, c.energy + Math.min(0.08, live * 0.1)))
    gl.uniform1f(this.u.focus, this.focusX)
    gl.uniform1f(this.u.focusAmt, this.reduced ? 0 : this.focusAmt)
    gl.uniform1f(this.u.band, this.reduced ? 0 : c.band)
    gl.uniform1f(this.u.bandPos, ((t * 0.45) % 1.4) - 0.2)
    gl.uniform1f(this.u.speed, this.reduced ? 0 : c.speed)
    gl.uniform1f(this.u.flutes, 9)
    gl.uniform1f(this.u.alpha, PALETTE[this.theme].alpha)
    gl.uniform1f(this.u.crisp, PALETTE[this.theme].crisp)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext()
    this.prog = null
  }
}
