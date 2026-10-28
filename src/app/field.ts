// «Light from below»: ась is a light rising from the bottom edge of the screen,
// seen through a fine grid of dots. The light is an aurora-like field with a soft,
// noisy top edge (the idea of a bottom-anchored aurora — written from scratch);
// the grid dots inside it grow and take its colour, and a soft glow sits under them.
// The dots also answer the finger (they lean away from it, like an interactive dot
// grid) and carry rings for every touch and haptic tick.
//   idle — a low, slow glow · listening — it rises with your voice
//   thinking — a bright lobe scans left and right · speaking — ripples on every syllable
//   paused — low and grey

export type FieldTheme = 'night' | 'light'
type S = 'idle' | 'listening' | 'thinking' | 'speaking' | 'paused'

const VERT = `#version 300 es
in vec2 a; void main(){ gl_Position = vec4(a,0.,1.); }`

const FRAG = `#version 300 es
precision highp float;
out vec4 o;
uniform vec2 uRes; uniform float uPitch; uniform float uT;
uniform float uH; uniform float uEnergy; uniform float uLv; uniform float uScan; uniform float uGray;
uniform vec4 uRings;
uniform vec4 uWave[4];          // x, y (px), age (s), strength
uniform vec3 uTouch;            // x, y (px), strength — the finger now
uniform vec3 uBg; uniform vec3 uDot; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform vec3 uGrayC;
uniform float uGlow; uniform float uBase; uniform float uMaxR;

float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float n1(float x){ float i = floor(x), f = fract(x); return mix(h21(vec2(i, 3.1)), h21(vec2(i + 1., 3.1)), f*f*(3. - 2.*f)); }
float fbm(float x){ return .55*n1(x) + .3*n1(x*2.1 + 7.) + .15*n1(x*4.3 + 13.); }

// the height of the light's edge above the bottom, 0..1 of the screen height
float edgeAt(float x){
  float t = uT;
  float e = uH*(.62 + .32*fbm(x*2.6 + t*.18) + .1*sin(x*9.4 - t*.9));
  e *= 1. + uLv*.55;
  // «думаю»: a bright lobe runs from side to side
  float sx = .5 + .42*sin(t*1.25);
  e += uScan*uH*.55*exp(-pow((x - sx)/.13, 2.));
  // a ripple from the centre for every spoken syllable
  for (int i = 0; i < 4; i++) {
    float age = uRings[i];
    if (age >= 0. && age < 1.2) e += uH*.22*exp(-pow((abs(x - .5) - age*.55)/.07, 2.))*(1. - age/1.2);
  }
  return e;
}

void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  // the finger pushes the dots aside a little (sampling space moves the other way)
  vec2 tp = px - uTouch.xy;
  float td = length(tp);
  vec2 q = px - (td > 1. ? tp/td : vec2(0.))*uTouch.z*uPitch*.9*exp(-td*td/(9000.*uTouch.z + 1.));
  vec2 cell = floor(q/uPitch);
  vec2 c = (cell + .5)*uPitch;

  // the light field at this dot and at this pixel
  float xn = c.x/uRes.x, yb = (uRes.y - c.y)/uRes.y;
  float e = edgeAt(xn);
  float L = pow(clamp(1. - yb/max(e, .001), 0., 1.), 1.35);
  float xp = px.x/uRes.x, ypb = (uRes.y - px.y)/uRes.y;
  float ep = edgeAt(xp);
  float Lp = pow(clamp(1. - ypb/max(ep, .001), 0., 1.), 1.6);

  // colour ramp: violet at the rim, cobalt in the body, a pale core near the bottom
  vec3 ramp = mix(uC1, uC2, smoothstep(0., .55, Lp));
  ramp = mix(ramp, uC3, smoothstep(.55, 1., Lp)*(.45 + .55*uEnergy));
  ramp = mix(ramp, uGrayC, uGray);
  vec3 bg = mix(uBg, ramp, Lp*uGlow);

  // dots: the grid everywhere, lit inside the light, rings from touches and ticks
  float v = L*(.55 + .45*uEnergy);
  float push = 0.;
  for (int i = 0; i < 4; i++) {
    vec4 w = uWave[i];
    if (w.w <= 0.) continue;
    float r = w.z*uRes.y*.9;
    float band = exp(-pow((length(c - w.xy) - r)/(uPitch*2.8), 2.));
    float fade = w.w*exp(-w.z*2.2);
    push += band*fade;
    v = max(v, band*fade);
  }
  v = max(v, exp(-td*td/2600.)*uTouch.z*.9);
  float rad = uPitch*(uBase + (uMaxR - uBase)*v + .07*min(push, 1.));
  float cov = 1. - smoothstep(rad - .8, rad + .8, length(q - c));
  vec3 lit = mix(uC3, vec3(1.), .35);
  vec3 dotC = mix(uDot, mix(ramp, lit, .55), smoothstep(.05, .6, v));
  dotC = mix(dotC, uGrayC, uGray*step(.05, L));
  float a = cov*mix(.32, 1., smoothstep(0., .5, v));
  o = vec4(mix(bg, dotC, a), 1.);
}`

const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]

const PAL: Record<FieldTheme, { bg: string; dot: string; c1: string; c2: string; c3: string; gray: string; glow: number; base: number; maxR: number }> = {
  night: { bg: '#000000', dot: '#2a2b36', c1: '#3a1fa8', c2: '#3346ff', c3: '#a8ecff', gray: '#3a3b4a', glow: 0.95, base: 0.09, maxR: 0.3 },
  light: { bg: '#f3f3f8', dot: '#c9cad8', c1: '#ddd6ff', c2: '#9aa2ff', c3: '#4250ff', gray: '#c7c8d4', glow: 0.85, base: 0.1, maxR: 0.3 },
}

const TARGET: Record<S, { h: number; energy: number; scan: number; gray: number }> = {
  // the light owns the lower part of the screen: it shows through the glass cards above it
  idle: { h: 0.3, energy: 0.35, scan: 0, gray: 0 },
  listening: { h: 0.46, energy: 0.8, scan: 0, gray: 0 },
  thinking: { h: 0.38, energy: 0.65, scan: 1, gray: 0 },
  speaking: { h: 0.42, energy: 0.9, scan: 0, gray: 0 },
  paused: { h: 0.16, energy: 0, scan: 0, gray: 1 },
}

export class Field {
  private gl: WebGL2RenderingContext | null
  private prog: WebGLProgram | null = null
  private u: Record<string, WebGLUniformLocation | null> = {}
  private raf = 0
  private theme: FieldTheme = 'night'
  private state: S = 'idle'
  private cur = { h: 0.16, energy: 0.25, scan: 0, gray: 0, lv: 0 }
  private rings: number[] = []
  private waves: { x: number; y: number; t: number; s: number }[] = []
  private finger = { x: -999, y: -999, s: 0, on: false }
  private pitchCss = 7
  private dpr = 1
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  private t0 = performance.now()
  private last = performance.now()
  private ro: ResizeObserver

  constructor(private canvas: HTMLCanvasElement) {
    this.gl = canvas.getContext('webgl2', { antialias: false, alpha: false })
    if (this.gl) this.compile()
    this.ro = new ResizeObserver(() => this.measure())
    this.ro.observe(canvas)
    this.measure()
    this.frame()
  }

  setTheme(t: FieldTheme) {
    this.theme = t
  }
  setState(s: S) {
    this.state = s
  }
  /** 0..1 — the voice that is speaking now (yours or ась's) */
  level(lv: number) {
    this.cur.lv += (lv - this.cur.lv) * (lv > this.cur.lv ? 0.5 : 0.08)
  }
  /** a spoken syllable: one ripple runs out from the centre of the light */
  pulse() {
    const t = performance.now()
    if (this.rings.length && t - this.rings[this.rings.length - 1] < 180) return
    this.rings.push(t)
    if (this.rings.length > 4) this.rings.shift()
  }
  /** a ring of dots from a point (css px, relative to the canvas) — a touch or a haptic tick */
  wave(x: number, y: number, strength = 1) {
    if (this.reduced) return
    this.waves.push({ x, y, t: performance.now(), s: strength })
    if (this.waves.length > 4) this.waves.shift()
  }
  /** the finger on the glass: dots lean away from it while it is down */
  touch(x: number, y: number, on: boolean) {
    this.finger.on = on
    if (on) ((this.finger.x = x), (this.finger.y = y))
  }
  /** where ась's own waves start: the middle of the bottom edge */
  get source() {
    const r = this.canvas.getBoundingClientRect()
    return { x: r.width / 2, y: r.height - 40 }
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
    for (const n of ['uRes', 'uPitch', 'uT', 'uH', 'uEnergy', 'uLv', 'uScan', 'uGray', 'uRings', 'uWave', 'uTouch', 'uBg', 'uDot', 'uC1', 'uC2', 'uC3', 'uGrayC', 'uGlow', 'uBase', 'uMaxR'])
      this.u[n] = gl.getUniformLocation(p, n)
  }

  private measure() {
    const r = this.canvas.getBoundingClientRect()
    if (!r.width) return
    this.dpr = Math.min(devicePixelRatio || 1, 2)
    this.canvas.width = Math.round(r.width * this.dpr)
    this.canvas.height = Math.round(r.height * this.dpr)
    this.gl?.viewport(0, 0, this.canvas.width, this.canvas.height)
    this.pitchCss = Math.max(6, Math.min(10, Math.min(r.width, r.height) / 52))
  }

  private frame = () => {
    this.raf = requestAnimationFrame(this.frame)
    if (!this.prog || document.hidden) return
    const gl = this.gl!
    const now = performance.now()
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    const c = this.cur, tg = TARGET[this.state]
    const k = 1 - Math.pow(0.01, dt)
    c.h += (tg.h - c.h) * k
    c.energy += (tg.energy - c.energy) * k
    c.scan += (tg.scan - c.scan) * k
    c.gray += (tg.gray - c.gray) * k
    if (this.state !== 'listening' && this.state !== 'speaking') c.lv *= 0.9
    // the finger's push springs in and out
    this.finger.s += ((this.finger.on && !this.reduced ? 1 : 0) - this.finger.s) * (1 - Math.pow(0.0005, dt))
    this.waves = this.waves.filter((w) => now - w.t < 1600)
    const pal = PAL[this.theme]
    const d = this.dpr
    gl.uniform2f(this.u.uRes, this.canvas.width, this.canvas.height)
    gl.uniform1f(this.u.uPitch, this.pitchCss * d)
    gl.uniform1f(this.u.uT, this.reduced ? 0 : (now - this.t0) / 1000)
    gl.uniform1f(this.u.uH, c.h)
    gl.uniform1f(this.u.uEnergy, c.energy)
    gl.uniform1f(this.u.uLv, this.reduced ? 0 : c.lv)
    gl.uniform1f(this.u.uScan, this.reduced ? 0 : c.scan)
    gl.uniform1f(this.u.uGray, c.gray)
    const ages = [0, 1, 2, 3].map((i) => (this.rings[i] != null && !this.reduced ? (now - this.rings[i]) / 1000 : -1))
    gl.uniform4f(this.u.uRings, ages[0], ages[1], ages[2], ages[3])
    const wv = new Float32Array(16)
    this.waves.forEach((w, i) => wv.set([w.x * d, w.y * d, (now - w.t) / 1000, w.s], i * 4))
    gl.uniform4fv(this.u.uWave, wv)
    gl.uniform3f(this.u.uTouch, this.finger.x * d, this.finger.y * d, this.finger.s)
    gl.uniform3fv(this.u.uBg, hex(pal.bg))
    gl.uniform3fv(this.u.uDot, hex(pal.dot))
    gl.uniform3fv(this.u.uC1, hex(pal.c1))
    gl.uniform3fv(this.u.uC2, hex(pal.c2))
    gl.uniform3fv(this.u.uC3, hex(pal.c3))
    gl.uniform3fv(this.u.uGrayC, hex(pal.gray))
    gl.uniform1f(this.u.uGlow, pal.glow)
    gl.uniform1f(this.u.uBase, pal.base)
    gl.uniform1f(this.u.uMaxR, pal.maxR)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext()
    this.prog = null
  }
}
