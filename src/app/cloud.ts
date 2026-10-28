// ась as a cloud of particles in real 3D (three.js, one draw call, all motion in
// the vertex shader). One hero motion per state:
//   idle      — a ball turning and breathing, nothing blinks
//   listening — the surface ripples with your voice and leans toward you
//   thinking  — the ball spins out into a galaxy disc
//   speaking  — a wave runs over the ball on every syllable; the answer's figure
//               is built from particles that fly out of the ball
//   paused    — the cloud folds into a thin grey ring
// Positions come from DOM placeholders, in css pixels, through an orthographic
// camera — so CSS owns the layout and the cloud follows it everywhere.

import * as THREE from 'three'

type S = 'idle' | 'listening' | 'thinking' | 'speaking' | 'paused'
export type CloudTheme = 'night' | 'light'

const N = 3600

const VERT = /* glsl */ `
attribute vec3 aDir;
attribute vec4 aRnd;
attribute vec2 aText;
uniform float uTime, uRot, uLv, uThink, uFlat, uMorph, uKick, uSize, uDpr;
uniform vec3 uCenter; // x, y (px), radius (px)
uniform vec4 uRings;
varying float vAlpha;
varying float vText;

vec3 rotY(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z); }
vec3 rotX(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(p.x, c*p.y - s*p.z, s*p.y + c*p.z); }

void main(){
  vec3 p = aDir;
  // the surface breathes: slow low waves, plus the voice, plus a kick from a touch
  float n = sin(p.x*3.1 + uTime*.8 + aRnd.x*6.)*.5 + sin(p.y*4.3 - uTime*.6 + aRnd.y*4.)*.5;
  float wob = .035*n;
  wob += uLv*.22*(.4 + .6*sin(aRnd.y*40. + uTime*11.));
  wob += uKick*.18*sin(aRnd.z*30. + uTime*20.);
  // a wave per syllable, running from the front pole over the ball
  float ang = acos(clamp(p.z, -1., 1.));
  for (int i = 0; i < 4; i++) {
    float age = uRings[i];
    if (age >= 0. && age < 1.2) wob += .16*exp(-pow((ang - age*2.8)/.3, 2.))*(1. - age/1.2);
  }
  p *= 1. + wob;
  // listening: the cloud leans down, toward the driver
  p.y -= uLv*.12*(1. - p.y)*.5;

  // thinking: spin out into a disc; inner orbits run faster
  float a0 = atan(aDir.z, aDir.x);
  float r = .35 + aRnd.x*.85;
  float a = a0 + uTime*(.5 + .9/r);
  vec3 disc = vec3(cos(a)*r, (aRnd.z - .5)*.07*(1.3 - r), sin(a)*r);
  p = mix(p, disc, uThink);
  // paused: a thin ring
  vec3 ring = vec3(cos(a0)*.92, (aRnd.z - .5)*.02, sin(a0)*.92);
  p = mix(p, ring, uFlat);

  p = rotY(p, uRot);
  p = rotX(p, .32 + uThink*.75 + uFlat*1.1);
  float persp = 1./(1. - p.z*.3);
  float depth = (p.z + 1.)*.5;
  vec2 screen = uCenter.xy + vec2(p.x, -p.y)*uCenter.z*persp;

  // the answer: particles with a target fly to it along an arc and settle there
  float isText = step(0., aText.x);
  float t = clamp(uMorph*1.7 - aRnd.w*.7, 0., 1.);
  t = t*t*(3. - 2.*t);
  vec2 to = aText;
  vec2 mid = mix(screen, to, .5) + vec2((aRnd.y - .5)*120., -60. - aRnd.z*60.);
  vec2 arc = mix(mix(screen, mid, t), mix(mid, to, t), t);
  screen = mix(screen, arc, isText);
  vText = isText*t;

  gl_Position = projectionMatrix*modelViewMatrix*vec4(screen, 0., 1.);
  gl_PointSize = uSize*uDpr*mix(persp*(.55 + .9*depth), 1.25, vText);
  vAlpha = mix(.18 + .82*depth, 1., vText)*(1. - uFlat*.35);
}`

const FRAG = /* glsl */ `
uniform vec3 uColA, uColB, uGrayCol;
uniform float uGray;
varying float vAlpha;
varying float vText;
void main(){
  float d = length(gl_PointCoord - .5);
  float a = smoothstep(.5, .18, d)*vAlpha;
  if (a < .01) discard;
  vec3 c = mix(uColB, uColA, clamp(vAlpha, 0., 1.));
  c = mix(c, uGrayCol, uGray);
  gl_FragColor = vec4(c, a);
}`

const TARGET: Record<S, { think: number; flat: number; gray: number; spin: number }> = {
  idle: { think: 0, flat: 0, gray: 0, spin: 0.18 },
  listening: { think: 0, flat: 0, gray: 0, spin: 0.3 },
  thinking: { think: 1, flat: 0, gray: 0, spin: 0.9 },
  speaking: { think: 0, flat: 0, gray: 0, spin: 0.35 },
  paused: { think: 0, flat: 1, gray: 1, spin: 0.05 },
}

const PAL: Record<CloudTheme, { a: string; b: string; gray: string; blend: THREE.Blending; size: number }> = {
  // night: white core, lavender rim — additive, so dense parts glow without a bloom pass
  night: { a: '#ffffff', b: '#8f7dff', gray: '#5a5c70', blend: THREE.AdditiveBlending, size: 2.6 },
  light: { a: '#151738', b: '#5b55d9', gray: '#a5a7bb', blend: THREE.NormalBlending, size: 2.4 },
}

export class Cloud {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(0, 1, 0, 1, -10, 10)
  private mat: THREE.ShaderMaterial
  private geo = new THREE.BufferGeometry()
  private raf = 0
  private state: S = 'idle'
  private cur = { think: 0, flat: 0, gray: 0, spin: 0.18, lv: 0, kick: 0, morph: 0 }
  private rot = 0
  private rings: number[] = []
  private morphTo = 0
  private morphAt = 0
  private last = performance.now()
  private t0 = performance.now()
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  private ro: ResizeObserver
  visible = true

  constructor(private canvas: HTMLCanvasElement, private place: { sphere: HTMLElement; text: HTMLElement }) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' })
    this.renderer.setClearColor(0x000000, 0)
    const dir = new Float32Array(N * 3), rnd = new Float32Array(N * 4), txt = new Float32Array(N * 2).fill(-1)
    for (let i = 0; i < N; i++) {
      // evenly over the sphere (golden-angle spiral), with a little depth jitter for volume
      const y = 1 - (2 * (i + 0.5)) / N, r = Math.sqrt(1 - y * y), a = i * 2.39996323, j = 0.94 + Math.random() * 0.08
      dir.set([Math.cos(a) * r * j, y * j, Math.sin(a) * r * j], i * 3)
      rnd.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4)
    }
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
    this.geo.setAttribute('aDir', new THREE.BufferAttribute(dir, 3))
    this.geo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 4))
    this.geo.setAttribute('aText', new THREE.BufferAttribute(txt, 2))
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 }, uRot: { value: 0 }, uLv: { value: 0 }, uThink: { value: 0 }, uFlat: { value: 0 }, uMorph: { value: 0 }, uKick: { value: 0 },
        uSize: { value: 2.6 }, uDpr: { value: 1 }, uCenter: { value: new THREE.Vector3() }, uRings: { value: new THREE.Vector4(-1, -1, -1, -1) },
        uColA: { value: new THREE.Color() }, uColB: { value: new THREE.Color() }, uGrayCol: { value: new THREE.Color() }, uGray: { value: 0 },
      },
    })
    const pts = new THREE.Points(this.geo, this.mat)
    pts.frustumCulled = false
    this.scene.add(pts)
    this.setTheme('night')
    this.ro = new ResizeObserver(() => this.measure())
    this.ro.observe(canvas)
    this.ro.observe(place.sphere)
    this.measure()
    this.frame()
  }

  setTheme(t: CloudTheme) {
    const p = PAL[t]
    this.mat.uniforms.uColA.value.set(p.a)
    this.mat.uniforms.uColB.value.set(p.b)
    this.mat.uniforms.uGrayCol.value.set(p.gray)
    this.mat.uniforms.uSize.value = p.size
    this.mat.blending = p.blend
    this.mat.needsUpdate = true
  }
  setState(s: S) {
    this.state = s
  }
  level(lv: number) {
    this.cur.lv += (lv - this.cur.lv) * (lv > this.cur.lv ? 0.5 : 0.08)
  }
  /** a spoken syllable: one wave over the ball */
  pulse() {
    const t = performance.now()
    if (this.rings.length && t - this.rings[this.rings.length - 1] < 180) return
    this.rings.push(t)
    if (this.rings.length > 4) this.rings.shift()
  }
  /** a touch or a haptic tick shakes the cloud */
  kick(s = 1) {
    this.cur.kick = Math.min(1, this.cur.kick + s)
  }
  get centre() {
    const s = this.place.sphere.getBoundingClientRect(), c = this.canvas.getBoundingClientRect()
    return { x: s.left - c.left + s.width / 2, y: s.top - c.top + s.height / 2 }
  }

  /** particles fly out of the ball and build `text` over the solid figure, then go home */
  buildText(text: string, holdMs = 900) {
    if (this.reduced) return
    const c = this.canvas.getBoundingClientRect(), b = this.place.text.getBoundingClientRect()
    const head = this.place.text.querySelector<HTMLElement>('.a-head')
    const cs = head ? getComputedStyle(head) : null
    const step = Math.max(3, Math.min(5, b.height / 28))
    const w = Math.ceil(b.width / step), h = Math.ceil(b.height / step)
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    const ctx = cv.getContext('2d')!
    const fs = cs ? parseFloat(cs.fontSize) / step : h * 0.9
    ctx.font = `${cs?.fontWeight ?? 500} ${fs}px ${cs?.fontFamily ?? 'Manrope'}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#fff'
    ctx.fillText(text, w / 2, h / 2 + fs * 0.04)
    const px = ctx.getImageData(0, 0, w, h).data
    const pts: number[] = []
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 120) pts.push(b.left - c.left + (x + 0.5) * step, b.top - c.top + (y + 0.5) * step)
    const count = pts.length / 2
    const attr = this.geo.getAttribute('aText') as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    arr.fill(-1)
    // every n-th particle takes a spot; at most 60% leave the ball
    const take = Math.min(count, Math.floor(N * 0.6))
    const stride = N / take
    for (let k = 0; k < take; k++) {
      const i = Math.floor(k * stride)
      const src = Math.floor((k / take) * count) * 2
      arr[i * 2] = pts[src]
      arr[i * 2 + 1] = pts[src + 1]
    }
    attr.needsUpdate = true
    this.morphTo = 1
    this.morphAt = performance.now() + holdMs + 700
  }

  private measure() {
    const r = this.canvas.getBoundingClientRect()
    if (!r.width) return
    const dpr = Math.min(devicePixelRatio || 1, 2)
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(r.width, r.height, false)
    this.camera.left = 0
    this.camera.right = r.width
    this.camera.top = 0
    this.camera.bottom = r.height
    this.camera.updateProjectionMatrix()
    const s = this.place.sphere.getBoundingClientRect()
    this.mat.uniforms.uCenter.value.set(s.left - r.left + s.width / 2, s.top - r.top + s.height / 2, Math.min(s.width, s.height) * 0.42)
    this.mat.uniforms.uDpr.value = dpr
  }

  private frame = () => {
    this.raf = requestAnimationFrame(this.frame)
    if (document.hidden) return
    const now = performance.now()
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    const c = this.cur, tg = TARGET[this.state]
    const k = 1 - Math.pow(0.004, dt)
    c.think += (tg.think - c.think) * k * 0.7
    c.flat += (tg.flat - c.flat) * k
    c.gray += (tg.gray - c.gray) * k
    c.spin += (tg.spin - c.spin) * k * 0.5
    c.kick *= Math.pow(0.02, dt)
    if (this.state !== 'listening' && this.state !== 'speaking') c.lv *= 0.9
    if (this.morphAt && now > this.morphAt) ((this.morphTo = 0), (this.morphAt = 0))
    c.morph += (this.morphTo - c.morph) * (1 - Math.pow(this.morphTo ? 0.03 : 0.08, dt))
    if (!this.reduced) this.rot += c.spin * dt
    const u = this.mat.uniforms
    u.uTime.value = this.reduced ? 0 : (now - this.t0) / 1000
    u.uRot.value = this.rot
    u.uLv.value = this.reduced ? 0 : c.lv
    u.uThink.value = this.reduced ? 0 : c.think
    u.uFlat.value = c.flat
    u.uGray.value = c.gray
    u.uKick.value = this.reduced ? 0 : c.kick
    u.uMorph.value = c.morph
    const ages = [0, 1, 2, 3].map((i) => (this.rings[i] != null && !this.reduced ? (now - this.rings[i]) / 1000 : -1))
    u.uRings.value.set(ages[0], ages[1], ages[2], ages[3])
    this.canvas.style.visibility = this.visible ? '' : 'hidden'
    if (this.visible) this.renderer.render(this.scene, this.camera)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    this.geo.dispose()
    this.mat.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }
}
