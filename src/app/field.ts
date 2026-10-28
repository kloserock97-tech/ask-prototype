// The dot field: one fine grid of dots over the whole screen. ась's sphere, the
// dots that land into a figure before it turns solid, the drip between them and
// every wave (a touch, a haptic tick) are the same grid dots, lit up — a halftone,
// like the «Expiratory Volume» reference. One fragment shader draws all of it; the
// layout comes from DOM placeholders, so CSS owns the composition and the field
// just follows (portrait, landscape, desktop frame alike).

export type FieldTheme = 'night' | 'light'
type S = 'idle' | 'listening' | 'thinking' | 'speaking' | 'paused'

const VERT = `#version 300 es
in vec2 a; void main(){ gl_Position = vec4(a,0.,1.); }`

const FRAG = `#version 300 es
precision highp float;
out vec4 o;
uniform vec2 uRes; uniform float uPitch; uniform float uT;
uniform vec3 uSphere; uniform float uSphereOn; uniform float uRot;
uniform float uLv; uniform float uBand; uniform float uFlat; uniform float uGray; uniform float uOrbit;
uniform vec4 uRings; uniform float uSpot;
uniform sampler2D uTextA; uniform sampler2D uTextB; uniform float uMix; uniform float uTextOn;
uniform vec4 uTrail;
uniform vec4 uWave[4]; // x, y (px), age (s), strength — touches and haptic ticks
uniform vec3 uBg; uniform vec3 uInk; uniform vec3 uDim; uniform vec3 uSpotA; uniform vec3 uSpotB;
uniform float uBase; uniform float uMaxR; uniform float uSpotK;

float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3. - 2.*f);
  return mix(mix(h21(i), h21(i + vec2(1,0)), f.x), mix(h21(i + vec2(0,1)), h21(i + vec2(1,1)), f.x), f.y); }

void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 cell = floor(px/uPitch);
  vec2 c = (cell + .5)*uPitch;
  float v = 0.;
  float push = 0.; // dots grow a little where a wave passes

  // ---- waves: a ring of grown dots runs out from a touch or a haptic tick
  for (int i = 0; i < 4; i++) {
    vec4 w = uWave[i];
    if (w.w <= 0.) continue;
    float r = w.z*uRes.y*.9;               // ring radius grows with age
    float d = length(c - w.xy);
    float band = exp(-pow((d - r)/(uPitch*2.8), 2.));
    float fade = w.w*exp(-w.z*2.2);
    push += band*fade;
    v = max(v, band*fade);
  }

  // ---- the sphere: grid dots lit by a soft key light from the upper right
  if (uSphereOn > .5) {
    vec2 q = (c - uSphere.xy)/uSphere.z;
    vec2 q0 = q;
    q.y /= max(.06, 1. - uFlat*.92);
    float rr = 1. + uLv*.07 + .015*sin(uT*1.3);
    float d = length(q)/rr;
    if (d < 1.) {
      float z = sqrt(1. - d*d);
      vec3 n = vec3(q.x/rr, -q.y/rr, z);
      float lam = clamp(dot(n, normalize(vec3(.18,.62,.76))), 0., 1.);
      float lit = smoothstep(.04, .8, lam);
      // a turning surface: patches of light and shade travel with the rotation
      float lon = atan(n.x, n.z) + uRot, lat = asin(clamp(n.y, -1., 1.));
      float tex = n2(vec2(lon*2.2, lat*3.)) * .65 + n2(vec2(lon*5., lat*6.))*.35;
      lit *= .55 + .65*smoothstep(.25, .75, tex);
      // «думаю»: a latitude band runs from top to bottom
      float by = 1.25 - fract(uT*.55)*2.5;
      lit = max(lit, uBand*.95*exp(-pow((n.y - by)/.13, 2.))*(.35 + .65*z));
      // a ring per spoken syllable, from the centre out
      for (int i = 0; i < 4; i++) {
        float age = uRings[i];
        if (age >= 0. && age < 1.1) lit = max(lit, .85*exp(-pow((d - age*1.05)/.07, 2.))*(1. - age/1.1));
      }
      // the driver's voice lights scattered dots
      lit = max(lit, uLv*step(.86 - uLv*.3, h21(cell + floor(uT*14.)))*.9*z);
      lit *= smoothstep(1., .88, d);
      v = max(v, lit);
    }
    // «думаю»: two comets circle the sphere
    float dr = length(q0);
    if (uOrbit > .01 && dr > 1.06 && dr < 1.32) {
      float a = atan(q0.y, q0.x);
      float ring = exp(-pow((dr - 1.18)/.06, 2.));
      for (int k = 0; k < 2; k++) {
        float head = uT*2.6 + float(k)*3.14159;
        float lag = mod(head - a, 6.28318);
        v = max(v, uOrbit*ring*exp(-lag*1.7));
      }
    }
  }

  // ---- figures: the dots land in random order, then dissolve into the solid type above them
  ivec2 tc = ivec2(cell);
  float ta = texelFetch(uTextA, tc, 0).r, tb = texelFetch(uTextB, tc, 0).r;
  float hh = h21(cell*1.71)*.7;
  float m = uMix*1.4;
  float txt = max(step(.4, ta)*(1. - smoothstep(hh, hh + .3, m)), step(.4, tb)*smoothstep(hh, hh + .3, m));
  v = max(v, txt*clamp(uTextOn*1.4 - hh*.6, 0., 1.));

  // ---- the drip: columns of dots running down (ась speaks) or up (you speak)
  float tw = abs(uTrail.w) > .5 ? 1.6 : .5;
  if (uTrail.w != 0. && abs(c.x - uTrail.x) < uPitch*tw && c.y > uTrail.y && c.y < uTrail.z) {
    float k = (c.y - uTrail.y)/max(1., uTrail.z - uTrail.y);
    float f = fract(cell.y*.25 + h21(vec2(cell.x, 3.))*.6 - uT*1.4*uTrail.w);
    v = max(v, step(.72, f)*(1. - k*.85)*.75*min(1., abs(uTrail.w)));
  }

  // ---- the background breathes: a few grid dots glint now and then
  float gl = step(.992, h21(cell + floor(uT*.6 + h21(cell)*7.)));
  v = max(v, gl*.35);

  float rad = uPitch*(uBase + (uMaxR - uBase)*v + .07*min(push, 1.));
  float dist = length(px - c);
  float cov = 1. - smoothstep(rad - .8, rad + .8, dist);
  float bright = mix(.22, 1., v);
  vec3 ink = mix(uInk, uDim, uGray*step(.01, v));

  // ---- «думаю»: light pours from the top edge and sways (video reference 4)
  float sway = sin(uT*.7)*.06 + sin(uT*1.9)*.015;
  vec2 sp = (px - vec2(uRes.x*(.5 + sway), -uRes.y*.04))/uRes.y;
  float spot = uSpot*(.92 + .08*sin(uT*2.3))*exp(-(sp.x*sp.x*7. + sp.y*sp.y*4.2));
  float core = uSpot*exp(-(sp.x*sp.x*60. + sp.y*sp.y*26.));
  vec3 bg = mix(uBg, uSpotA, clamp(spot*uSpotK, 0., 1.));
  bg = mix(bg, uSpotB, clamp(core*uSpotK, 0., 1.));
  o = vec4(mix(bg, ink, cov*bright), 1.);
}`

const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]

const PAL: Record<FieldTheme, { bg: string; ink: string; dim: string; spotA: string; spotB: string; spotK: number; base: number; maxR: number }> = {
  night: { bg: '#000000', ink: '#ffffff', dim: '#5a5c70', spotA: '#1a26e0', spotB: '#5fd0ff', spotK: 0.85, base: 0.085, maxR: 0.25 },
  // light: ink dots on a pale lavender-grey; the «думаю» light is a soft cobalt wash
  light: { bg: '#f3f3f8', ink: '#151738', dim: '#a5a7bb', spotA: '#c3c8ff', spotB: '#7f8aff', spotK: 0.9, base: 0.1, maxR: 0.27 },
}

const TARGET: Record<S, { band: number; flat: number; gray: number; spot: number; spin: number; orbit: number }> = {
  idle: { band: 0, flat: 0, gray: 0, spot: 0, spin: 0.22, orbit: 0 },
  listening: { band: 0, flat: 0, gray: 0, spot: 0, spin: 0.4, orbit: 0 },
  thinking: { band: 1, flat: 0, gray: 0, spot: 1, spin: 1.5, orbit: 1 },
  speaking: { band: 0, flat: 0, gray: 0, spot: 0, spin: 0.55, orbit: 0 },
  paused: { band: 0, flat: 1, gray: 1, spot: 0, spin: 0, orbit: 0 },
}

export type FieldLayout = { sphere?: HTMLElement; digits?: HTMLElement; trail?: [HTMLElement, HTMLElement] }

export class Field {
  private gl: WebGL2RenderingContext | null
  private prog: WebGLProgram | null = null
  private u: Record<string, WebGLUniformLocation | null> = {}
  private tex: [WebGLTexture | null, WebGLTexture | null] = [null, null]
  private raf = 0
  private theme: FieldTheme = 'night'
  private state: S = 'idle'
  private cur = { band: 0, flat: 0, gray: 0, spot: 0, spin: 0.22, orbit: 0, lv: 0, mix: 1, textOn: 0 }
  private rot = 0
  private rings: number[] = []
  private waves: { x: number; y: number; t: number; s: number }[] = []
  private text = ''
  private mixFrom = 0
  private dissolveAt = 0
  private pitchCss = 7
  private dpr = 1
  private cols = 1
  private rows = 1
  private sphere = { x: 0, y: 0, r: 0 }
  private trail = { x: 0, y0: 0, y1: 0 }
  private trailDir = 0
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  private t0 = performance.now()
  private last = performance.now()
  private ro: ResizeObserver
  sphereOn = true

  constructor(private canvas: HTMLCanvasElement, private layout: FieldLayout) {
    this.gl = canvas.getContext('webgl2', { antialias: false, alpha: false })
    if (this.gl) this.compile()
    this.ro = new ResizeObserver(() => this.measure())
    this.ro.observe(canvas)
    for (const el of [layout.sphere, layout.digits, ...(layout.trail ?? [])]) if (el) this.ro.observe(el)
    document.fonts?.load('500 40px Manrope').then(() => this.measure())
    this.measure()
    this.frame()
  }

  setTheme(t: FieldTheme) {
    this.theme = t
  }
  setState(s: S) {
    this.state = s
    // the drip never quite stops: slow at rest, up while you talk, down while ась answers
    this.trailDir = s === 'listening' ? -1 : s === 'speaking' ? 1 : s === 'paused' ? 0 : 0.3
  }
  /** 0..1 — voice level */
  level(lv: number) {
    this.cur.lv += (lv - this.cur.lv) * (lv > this.cur.lv ? 0.5 : 0.08)
  }
  /** a spoken syllable: one ring across the sphere */
  pulse() {
    const t = performance.now()
    if (this.rings.length && t - this.rings[this.rings.length - 1] < 200) return
    this.rings.push(t)
    if (this.rings.length > 4) this.rings.shift()
  }
  /** a ring of dots from a point (css px, relative to the canvas) — a touch or a haptic tick */
  wave(x: number, y: number, strength = 1) {
    if (this.reduced) return
    this.waves.push({ x, y, t: performance.now(), s: strength })
    if (this.waves.length > 4) this.waves.shift()
  }
  /** the centre of the sphere in canvas css px — where ась's own waves start */
  get sphereCentre() {
    return { x: this.sphere.x, y: this.sphere.y }
  }
  /** dots land into `s`, then dissolve — the solid type takes over (video 2: preparing → all set) */
  setText(s: string, instant = false) {
    this.text = s
    if (!s || instant || this.reduced) {
      this.cur.textOn = 0
      this.paintText('', true)
      return
    }
    this.paintText(s, false)
    this.cur.textOn = 1
    this.dissolveAt = performance.now() + 820
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
    for (const n of ['uRes', 'uPitch', 'uT', 'uSphere', 'uSphereOn', 'uRot', 'uLv', 'uBand', 'uFlat', 'uGray', 'uOrbit', 'uRings', 'uSpot', 'uTextA', 'uTextB', 'uMix', 'uTextOn', 'uTrail', 'uWave', 'uBg', 'uInk', 'uDim', 'uSpotA', 'uSpotB', 'uBase', 'uMaxR', 'uSpotK'])
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

  /** everything in device pixels; the grid pitch scales with the screen */
  private measure() {
    const r = this.canvas.getBoundingClientRect()
    if (!r.width) return
    this.dpr = Math.min(devicePixelRatio || 1, 2.5)
    this.canvas.width = Math.round(r.width * this.dpr)
    this.canvas.height = Math.round(r.height * this.dpr)
    this.gl?.viewport(0, 0, this.canvas.width, this.canvas.height)
    this.pitchCss = Math.max(6, Math.min(10, Math.min(r.width, r.height) / 54))
    this.cols = Math.ceil(r.width / this.pitchCss) + 1
    this.rows = Math.ceil(r.height / this.pitchCss) + 1
    const s = this.layout.sphere?.getBoundingClientRect()
    if (s?.width) this.sphere = { x: s.left - r.left + s.width / 2, y: s.top - r.top + s.height / 2, r: Math.min(s.width, s.height) / 2 }
    const tr = this.layout.trail
    if (tr) {
      const a = tr[0].getBoundingClientRect(), b = tr[1].getBoundingClientRect()
      this.trail = { x: a.left - r.left + a.width / 2, y0: a.bottom - r.top + this.pitchCss, y1: b.top - r.top - this.pitchCss }
    }
    if (this.cur.textOn > 0) this.paintText(this.text, true)
  }

  /** the figure in a medium face at one pixel per grid cell — a dot where the stroke is */
  private paintText(s: string, instant: boolean) {
    const gl = this.gl
    const box = this.layout.digits?.getBoundingClientRect()
    const r = this.canvas.getBoundingClientRect()
    if (!gl || !box || !r.width) return
    const cv = document.createElement('canvas')
    cv.width = this.cols
    cv.height = this.rows
    const ctx = cv.getContext('2d')!
    if (s) {
      const p = this.pitchCss
      let fs = box.height / p / 0.72
      ctx.font = `500 ${fs}px Manrope, sans-serif`
      const maxW = box.width / p
      const w = ctx.measureText(s).width
      if (w > maxW) ((fs *= maxW / w), (ctx.font = `500 ${fs}px Manrope, sans-serif`))
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(s, (box.left - r.left + box.width / 2) / p, (box.bottom - r.top) / p)
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
    const t = (now - this.t0) / 1000
    const c = this.cur, tg = TARGET[this.state]
    const k = 1 - Math.pow(0.006, dt) // ~0.08 per frame at 60 Hz, same feel at 120 Hz
    c.band += (tg.band - c.band) * k
    c.flat += (tg.flat - c.flat) * k
    c.gray += (tg.gray - c.gray) * k
    c.spot += (tg.spot - c.spot) * k * 0.6
    c.spin += (tg.spin - c.spin) * k * 0.5
    c.orbit += (tg.orbit - c.orbit) * k
    if (!this.reduced) this.rot += c.spin * dt
    if (this.state !== 'listening' && this.state !== 'speaking') c.lv *= 0.9
    if (c.mix < 1) c.mix = Math.min(1, (now - this.mixFrom) / 600)
    if (this.dissolveAt && now > this.dissolveAt) c.textOn = Math.max(0, c.textOn - dt * 2.4)
    this.waves = this.waves.filter((w) => now - w.t < 1600)
    const pal = PAL[this.theme]
    const d = this.dpr
    gl.uniform2f(this.u.uRes, this.canvas.width, this.canvas.height)
    gl.uniform1f(this.u.uPitch, this.pitchCss * d)
    gl.uniform1f(this.u.uT, this.reduced ? 0 : t)
    gl.uniform3f(this.u.uSphere, this.sphere.x * d, this.sphere.y * d, this.sphere.r * d)
    gl.uniform1f(this.u.uSphereOn, this.sphereOn && this.sphere.r > 0 ? 1 : 0)
    gl.uniform1f(this.u.uRot, this.rot)
    gl.uniform1f(this.u.uLv, this.reduced ? 0 : c.lv)
    gl.uniform1f(this.u.uBand, this.reduced ? 0 : c.band)
    gl.uniform1f(this.u.uFlat, c.flat)
    gl.uniform1f(this.u.uGray, c.gray)
    gl.uniform1f(this.u.uOrbit, this.reduced ? 0 : c.orbit)
    const ages = [0, 1, 2, 3].map((i) => (this.rings[i] != null && !this.reduced ? (now - this.rings[i]) / 1000 : -1))
    gl.uniform4f(this.u.uRings, ages[0], ages[1], ages[2], ages[3])
    const wv = new Float32Array(16)
    this.waves.forEach((w, i) => wv.set([w.x * d, w.y * d, (now - w.t) / 1000, w.s], i * 4))
    gl.uniform4fv(this.u.uWave, wv)
    gl.uniform1f(this.u.uSpot, c.spot)
    gl.uniform1f(this.u.uMix, c.mix)
    gl.uniform1f(this.u.uTextOn, c.textOn)
    gl.uniform4f(this.u.uTrail, this.trail.x * d, this.trail.y0 * d, this.trail.y1 * d, this.reduced ? 0 : this.trailDir)
    gl.uniform3fv(this.u.uBg, hex(pal.bg))
    gl.uniform3fv(this.u.uInk, hex(pal.ink))
    gl.uniform3fv(this.u.uDim, hex(pal.dim))
    gl.uniform3fv(this.u.uSpotA, hex(pal.spotA))
    gl.uniform3fv(this.u.uSpotB, hex(pal.spotB))
    gl.uniform1f(this.u.uSpotK, pal.spotK)
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
