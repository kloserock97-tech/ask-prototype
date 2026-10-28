// The whole picture in one fragment shader (no particles, no CSS blur):
//   · a fine grid of dots over a black screen;
//   · ась — a halftone sphere made of those dots. While it thinks, its outline flows
//     through soft shapes (cookie, flower, pill, sun), the way Material 3 Expressive's
//     loading indicator morphs for short waits;
//   · the answer's figure assembles from dots, then the solid type takes over;
//   · a violet light at the bottom edge;
//   · the bottom panel is liquid glass: it refracts the dots and the light under it,
//     splits colour a little at its edges and carries a lavender rim — done here,
//     in the same pass, instead of an expensive backdrop blur.
// Layout comes from DOM placeholders (sphere, figure, panel), so CSS owns it.

export type SceneTheme = 'night' | 'light'
type S = 'idle' | 'listening' | 'thinking' | 'speaking' | 'paused'

const VERT = `#version 300 es
in vec2 a; void main(){ gl_Position = vec4(a,0.,1.); }`

const FRAG = `#version 300 es
precision highp float;
out vec4 o;
uniform vec2 uRes; uniform float uPitch; uniform float uT;
uniform vec3 uSphere;            // cx, cy, r (px)
uniform float uLv; uniform float uThink; uniform float uFlat; uniform float uGray; uniform float uRot;
uniform vec4 uRings;
uniform sampler2D uTextA; uniform sampler2D uTextB; uniform float uMix; uniform float uTextOn;
uniform vec4 uPanel;             // x, y, w, h (px)
uniform float uPanelR;           // corner radius (px)
uniform float uLight;            // the violet light at the bottom, 0..1
uniform vec4 uWave[4];
uniform vec3 uBg; uniform vec3 uInk; uniform vec3 uDim; uniform vec3 uV1; uniform vec3 uV2; uniform vec3 uRim;
uniform float uBase; uniform float uMaxR; uniform float uGlass;

float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }

// the sphere's outline: a circle that, while ась thinks, flows through lobed shapes
float outline(float th){
  float t = uT*.55;
  float k = floor(t), f = fract(t);
  f = f*f*(3. - 2.*f);
  // shapes: 0 circle, 1 cookie(9), 2 flower(6), 3 pill-ish(2), 4 sun(12)
  vec4 nA = vec4(0., 9., 6., 2.), aA = vec4(0., .07, .11, .14);
  int i0 = int(mod(k, 4.)), i1 = int(mod(k + 1., 4.));
  float n0 = nA[i0], n1 = nA[i1], a0 = aA[i0], a1 = aA[i1];
  float r0 = 1. + a0*cos(n0*th + t*.8), r1 = 1. + a1*cos(n1*th + t*.8);
  return mix(1., mix(r0, r1, f), uThink);
}

// the light at the bottom: a soft violet field with a slow, uneven top edge
float lightAt(vec2 p){
  float x = p.x/uRes.x, yb = (uRes.y - p.y)/uRes.y;
  float e = (.2 + .1*uLight)*(1. + uLv*.6)*(.7 + .2*sin(x*5.3 + uT*.5) + .1*sin(x*11.7 - uT*.8));
  for (int i = 0; i < 4; i++) {
    float age = uRings[i];
    if (age >= 0. && age < 1.2) e += .06*exp(-pow((abs(x - .5) - age*.55)/.07, 2.))*(1. - age/1.2);
  }
  return pow(clamp(1. - yb/max(e, .001), 0., 1.), 1.5)*uLight;
}

// the picture behind the glass, at any point
vec3 scene(vec2 px){
  vec2 cell = floor(px/uPitch);
  vec2 c = (cell + .5)*uPitch;
  float v = 0.;
  vec3 tint = uInk;

  // ась
  vec2 q = (c - uSphere.xy)/max(uSphere.z, 1.);
  q.y /= max(.06, 1. - uFlat*.92);
  float th = atan(q.y, q.x);
  float rr = outline(th)*(1. + uLv*.06 + .012*sin(uT*1.3));
  float d = length(q)/rr;
  if (d < 1.) {
    float z = sqrt(1. - d*d);
    vec3 n = vec3(q.x/rr, -q.y/rr, z);
    float lit = smoothstep(.04, .8, clamp(dot(n, normalize(vec3(.18,.62,.76))), 0., 1.));
    lit *= .8 + .2*sin(atan(n.x, n.z)*7. + uRot);
    for (int i = 0; i < 4; i++) {
      float age = uRings[i];
      if (age >= 0. && age < 1.1) lit = max(lit, .8*exp(-pow((d - age*1.05)/.07, 2.))*(1. - age/1.1));
    }
    lit = max(lit, uLv*step(.86 - uLv*.3, h21(cell + floor(uT*14.)))*.9*z);
    lit *= smoothstep(1., .9, d);
    v = max(v, lit);
  }

  // the figure, dot by dot, before it turns solid
  ivec2 tc = ivec2(cell);
  float ta = texelFetch(uTextA, tc, 0).r, tb = texelFetch(uTextB, tc, 0).r;
  float hh = h21(cell*1.71)*.7, m = uMix*1.4;
  float txt = max(step(.4, ta)*(1. - smoothstep(hh, hh + .3, m)), step(.4, tb)*smoothstep(hh, hh + .3, m));
  v = max(v, txt*clamp(uTextOn*1.4 - hh*.6, 0., 1.));

  // the violet light lights the dots it reaches
  float L = lightAt(c);
  if (L > v) { v = L; tint = mix(uV1, uV2, smoothstep(.2, .9, L)); }

  // rings from touches and haptic ticks
  float push = 0.;
  for (int i = 0; i < 4; i++) {
    vec4 w = uWave[i];
    if (w.w <= 0.) continue;
    float band = exp(-pow((length(c - w.xy) - w.z*uRes.y*.9)/(uPitch*2.8), 2.))*w.w*exp(-w.z*2.2);
    push += band;
    v = max(v, band);
  }

  float rad = uPitch*(uBase + (uMaxR - uBase)*v + .07*min(push, 1.));
  float cov = 1. - smoothstep(rad - .8, rad + .8, length(px - c));
  vec3 ink = mix(tint, uDim, uGray*step(.01, v));
  vec3 bg = mix(uBg, uV1, lightAt(px)*.55);
  return mix(bg, ink, cov*mix(.22, 1., v));
}

float sdRound(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }

void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 pc = uPanel.xy + uPanel.zw*.5, ph = uPanel.zw*.5;
  float sd = sdRound(px - pc, ph, uPanelR);
  if (uPanel.z < 1. || sd > 1.5) { o = vec4(scene(px), 1.); return; }

  // liquid glass: bend the picture toward the edges, split colour a touch, tint it,
  // and light the rim
  vec2 e = vec2(1., 0.);
  vec2 g = normalize(vec2(sdRound(px + e.xy - pc, ph, uPanelR) - sdRound(px - e.xy - pc, ph, uPanelR),
                          sdRound(px + e.yx - pc, ph, uPanelR) - sdRound(px - e.yx - pc, ph, uPanelR)) + 1e-5);
  float depth = clamp(-sd/(uPanelR*1.4), 0., 1.);
  float bend = (1. - depth)*(1. - depth)*uPanelR*.9*uGlass;
  vec2 off = -g*bend;
  vec3 col = vec3(scene(px + off*1.06).r, scene(px + off).g, scene(px + off*.94).b);
  col = mix(col, mix(uBg, uV1, .08), .55*uGlass);       // the glass takes the screen colour, a little violet
  // a lavender inner glow along the rim (the border people liked) and a bright hairline
  float inner = exp(sd/(uPanelR*.55));
  col += uRim*inner*.55*uGlass;
  float top = smoothstep(.0, -1., g.y)*.6 + .4;
  col += uRim*(1. - smoothstep(0., 1.6, abs(sd + .75)))*.85*top*uGlass;
  // outside the hairline (anti-aliasing band)
  vec3 outside = scene(px);
  o = vec4(mix(col, outside, smoothstep(-.5, 1., sd)), 1.);
}`

const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]

const PAL: Record<SceneTheme, { bg: string; ink: string; dim: string; v1: string; v2: string; rim: string; base: number; maxR: number }> = {
  night: { bg: '#000000', ink: '#ffffff', dim: '#5a5c70', v1: '#4b2fd6', v2: '#b9a8ff', rim: '#8f7dff', base: 0.085, maxR: 0.26 },
  light: { bg: '#f3f3f8', ink: '#141633', dim: '#a5a7bb', v1: '#7d6cf0', v2: '#3a2fb8', rim: '#8f7dff', base: 0.1, maxR: 0.28 },
}

const TARGET: Record<S, { think: number; flat: number; gray: number; light: number; spin: number }> = {
  idle: { think: 0, flat: 0, gray: 0, light: 0.55, spin: 0.25 },
  listening: { think: 0, flat: 0, gray: 0, light: 1, spin: 0.4 },
  thinking: { think: 1, flat: 0, gray: 0, light: 0.8, spin: 1.2 },
  speaking: { think: 0, flat: 0, gray: 0, light: 0.95, spin: 0.5 },
  paused: { think: 0, flat: 1, gray: 1, light: 0.15, spin: 0 },
}

export type ScenePlaces = { sphere: HTMLElement; figure: HTMLElement; panel: HTMLElement }

export class Scene {
  private gl: WebGL2RenderingContext | null
  private prog: WebGLProgram | null = null
  private u: Record<string, WebGLUniformLocation | null> = {}
  private tex: [WebGLTexture | null, WebGLTexture | null] = [null, null]
  private raf = 0
  private theme: SceneTheme = 'night'
  private state: S = 'idle'
  private cur = { think: 0, flat: 0, gray: 0, light: 0.55, spin: 0.25, lv: 0, mix: 1, textOn: 0 }
  private rot = 0
  private rings: number[] = []
  private waves: { x: number; y: number; t: number; s: number }[] = []
  private text = ''
  private mixFrom = 0
  private dissolveAt = 0
  private pitch = 7
  private dpr = 1
  private cols = 1
  private rows = 1
  private sphere = { x: 0, y: 0, r: 0 }
  private panel = { x: 0, y: 0, w: 0, h: 0, r: 0 }
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  private t0 = performance.now()
  private last = performance.now()
  private ro: ResizeObserver

  constructor(private canvas: HTMLCanvasElement, private places: ScenePlaces) {
    this.gl = canvas.getContext('webgl2', { antialias: false, alpha: false })
    if (this.gl) this.compile()
    this.ro = new ResizeObserver(() => this.measure())
    for (const el of [canvas, places.sphere, places.figure, places.panel]) this.ro.observe(el)
    this.measure()
    this.frame()
  }

  setTheme(t: SceneTheme) {
    this.theme = t
  }
  setState(s: S) {
    this.state = s
  }
  level(lv: number) {
    this.cur.lv += (lv - this.cur.lv) * (lv > this.cur.lv ? 0.5 : 0.08)
  }
  pulse() {
    const t = performance.now()
    if (this.rings.length && t - this.rings[this.rings.length - 1] < 190) return
    this.rings.push(t)
    if (this.rings.length > 4) this.rings.shift()
  }
  wave(x: number, y: number, s = 1) {
    if (this.reduced) return
    this.waves.push({ x, y, t: performance.now(), s })
    if (this.waves.length > 4) this.waves.shift()
  }
  get centre() {
    return { x: this.sphere.x, y: this.sphere.y }
  }
  /** keep the panel's glass in step with the DOM panel while it moves */
  remeasure() {
    this.measure()
  }
  /** dots of the sphere's grid gather into `s`, then dissolve under the solid type */
  setText(s: string) {
    this.text = s
    if (!s || this.reduced) {
      this.cur.textOn = 0
      return this.paint('', true)
    }
    this.paint(s, false)
    this.cur.textOn = 1
    this.dissolveAt = performance.now() + 760
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
    for (const n of ['uRes', 'uPitch', 'uT', 'uSphere', 'uLv', 'uThink', 'uFlat', 'uGray', 'uRot', 'uRings', 'uTextA', 'uTextB', 'uMix', 'uTextOn', 'uPanel', 'uPanelR', 'uLight', 'uWave', 'uBg', 'uInk', 'uDim', 'uV1', 'uV2', 'uRim', 'uBase', 'uMaxR', 'uGlass'])
      this.u[n] = gl.getUniformLocation(p, n)
    this.tex = [gl.createTexture(), gl.createTexture()]
    this.tex.forEach((t, i) => {
      gl.activeTexture(gl.TEXTURE0 + i)
      gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 1, 1, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array([0]))
    })
    gl.uniform1i(this.u.uTextA, 0)
    gl.uniform1i(this.u.uTextB, 1)
  }

  private measure() {
    const r = this.canvas.getBoundingClientRect()
    if (!r.width) return
    // the glass samples the picture three times inside the panel: keep the pixel count sane
    this.dpr = Math.min(devicePixelRatio || 1, 1.75)
    this.canvas.width = Math.round(r.width * this.dpr)
    this.canvas.height = Math.round(r.height * this.dpr)
    this.gl?.viewport(0, 0, this.canvas.width, this.canvas.height)
    this.pitch = Math.max(6, Math.min(10, Math.min(r.width, r.height) / 54))
    this.cols = Math.ceil(r.width / this.pitch) + 1
    this.rows = Math.ceil(r.height / this.pitch) + 1
    const s = this.places.sphere.getBoundingClientRect()
    this.sphere = { x: s.left - r.left + s.width / 2, y: s.top - r.top + s.height / 2, r: Math.min(s.width, s.height) / 2 }
    const p = this.places.panel.getBoundingClientRect()
    const cr = parseFloat(getComputedStyle(this.places.panel).borderTopLeftRadius) || 36
    this.panel = { x: p.left - r.left, y: p.top - r.top, w: p.width, h: p.height, r: Math.min(cr, p.height / 2, p.width / 2) }
    if (this.cur.textOn > 0) this.paint(this.text, true)
  }

  private paint(s: string, instant: boolean) {
    const gl = this.gl
    const box = this.places.figure.getBoundingClientRect()
    const r = this.canvas.getBoundingClientRect()
    if (!gl || !r.width) return
    const cv = document.createElement('canvas')
    cv.width = this.cols
    cv.height = this.rows
    const ctx = cv.getContext('2d')!
    if (s && box.width) {
      const p = this.pitch
      let fs = box.height / p / 0.72
      ctx.font = `500 ${fs}px Manrope, sans-serif`
      const w = ctx.measureText(s).width, maxW = box.width / p
      if (w > maxW) ((fs *= maxW / w), (ctx.font = `500 ${fs}px Manrope, sans-serif`))
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(s, (box.left - r.left) / p, (box.bottom - r.top) / p)
    }
    const img = ctx.getImageData(0, 0, cv.width, cv.height).data
    const a = new Uint8Array(cv.width * cv.height)
    for (let i = 0; i < a.length; i++) a[i] = img[i * 4 + 3]
    if (!instant) {
      ;[this.tex[0], this.tex[1]] = [this.tex[1], this.tex[0]]
      this.mixFrom = performance.now()
      this.cur.mix = 0
    } else this.cur.mix = 1
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.tex[1])
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, cv.width, cv.height, 0, gl.RED, gl.UNSIGNED_BYTE, a)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.tex[0])
    if (instant) gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, cv.width, cv.height, 0, gl.RED, gl.UNSIGNED_BYTE, a)
  }

  private frame = () => {
    this.raf = requestAnimationFrame(this.frame)
    if (!this.prog || document.hidden) return
    const gl = this.gl!
    const now = performance.now()
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    const c = this.cur, tg = TARGET[this.state]
    const k = 1 - Math.pow(0.006, dt)
    c.think += (tg.think - c.think) * k
    c.flat += (tg.flat - c.flat) * k
    c.gray += (tg.gray - c.gray) * k
    c.light += (tg.light - c.light) * k * 0.6
    c.spin += (tg.spin - c.spin) * k * 0.5
    if (!this.reduced) this.rot += c.spin * dt
    if (this.state !== 'listening' && this.state !== 'speaking') c.lv *= 0.9
    if (c.mix < 1) c.mix = Math.min(1, (now - this.mixFrom) / 600)
    if (this.dissolveAt && now > this.dissolveAt) c.textOn = Math.max(0, c.textOn - dt * 2.6)
    this.waves = this.waves.filter((w) => now - w.t < 1600)
    const pal = PAL[this.theme], d = this.dpr
    gl.uniform2f(this.u.uRes, this.canvas.width, this.canvas.height)
    gl.uniform1f(this.u.uPitch, this.pitch * d)
    gl.uniform1f(this.u.uT, this.reduced ? 0 : (now - this.t0) / 1000)
    gl.uniform3f(this.u.uSphere, this.sphere.x * d, this.sphere.y * d, this.sphere.r * d)
    gl.uniform1f(this.u.uLv, this.reduced ? 0 : c.lv)
    gl.uniform1f(this.u.uThink, this.reduced ? 0 : c.think)
    gl.uniform1f(this.u.uFlat, c.flat)
    gl.uniform1f(this.u.uGray, c.gray)
    gl.uniform1f(this.u.uRot, this.rot)
    const ages = [0, 1, 2, 3].map((i) => (this.rings[i] != null && !this.reduced ? (now - this.rings[i]) / 1000 : -1))
    gl.uniform4f(this.u.uRings, ages[0], ages[1], ages[2], ages[3])
    gl.uniform1f(this.u.uMix, c.mix)
    gl.uniform1f(this.u.uTextOn, c.textOn)
    gl.uniform4f(this.u.uPanel, this.panel.x * d, this.panel.y * d, this.panel.w * d, this.panel.h * d)
    gl.uniform1f(this.u.uPanelR, this.panel.r * d)
    gl.uniform1f(this.u.uLight, c.light)
    const wv = new Float32Array(16)
    this.waves.forEach((w, i) => wv.set([w.x * d, w.y * d, (now - w.t) / 1000, w.s], i * 4))
    gl.uniform4fv(this.u.uWave, wv)
    gl.uniform3fv(this.u.uBg, hex(pal.bg))
    gl.uniform3fv(this.u.uInk, hex(pal.ink))
    gl.uniform3fv(this.u.uDim, hex(pal.dim))
    gl.uniform3fv(this.u.uV1, hex(pal.v1))
    gl.uniform3fv(this.u.uV2, hex(pal.v2))
    gl.uniform3fv(this.u.uRim, hex(pal.rim))
    gl.uniform1f(this.u.uBase, pal.base)
    gl.uniform1f(this.u.uMaxR, pal.maxR)
    gl.uniform1f(this.u.uGlass, this.theme === 'light' ? 0.55 : 1)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext()
    this.prog = null
  }
}
