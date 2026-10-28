// Sparks in the light: a few hundred particles (three.js, one draw call, all motion
// in the vertex shader) that live in the glow along the bottom edge and drift up
// out of it. They rise higher with a voice, gather under the scanning light while
// ась thinks, and — the moment the answer arrives — fly up and build its figure,
// which then turns solid: the answer comes out of the light.

import * as THREE from 'three'

type S = 'idle' | 'listening' | 'thinking' | 'speaking' | 'paused'
export type CloudTheme = 'night' | 'light'

const N = 520

const VERT = /* glsl */ `
attribute vec4 aRnd;
attribute vec2 aText;
uniform float uTime, uLv, uThink, uFlat, uMorph, uKick, uSize, uDpr, uBand;
uniform vec2 uView; // css px
varying float vAlpha;
varying float vText;

void main(){
  float speed = (.035 + .07*aRnd.z)*(1. + uLv*2.4 + uThink*1.2);
  float rise = fract(aRnd.y + uTime*speed);
  float band = uBand*(.45 + .55*aRnd.w)*(1. + uLv*.8)*(1. - uFlat*.7);
  float x = aRnd.x*uView.x + sin(uTime*.7 + aRnd.w*20.)*14.;
  // «думаю»: they gather under the light that runs from side to side
  float sx = (.5 + .42*sin(uTime*1.25))*uView.x;
  x = mix(x, sx + (aRnd.x - .5)*uView.x*.28, uThink*.75);
  float y = uView.y - rise*band;
  y += uKick*10.*sin(aRnd.z*40. + uTime*18.);
  vec2 home = vec2(x, y);

  // the answer: particles with a target fly up to it along an arc and settle there
  float isText = step(0., aText.x);
  float t = clamp(uMorph*1.6 - aRnd.w*.6, 0., 1.);
  t = t*t*(3. - 2.*t);
  vec2 mid = mix(home, aText, .5) + vec2((aRnd.y - .5)*90., 40.);
  vec2 arc = mix(mix(home, mid, t), mix(mid, aText, t), t);
  vec2 p = mix(home, arc, isText);
  vText = isText*t;

  gl_Position = projectionMatrix*modelViewMatrix*vec4(p, 0., 1.);
  gl_PointSize = uSize*uDpr*mix(.7 + .8*aRnd.z, 1.15, vText);
  // fade in at the bottom, out near the top of the band
  float life = sin(rise*3.14159);
  vAlpha = mix(life*(.2 + .45*aRnd.z)*(1. - uFlat*.6), 1., vText);
}`

const FRAG = /* glsl */ `
uniform vec3 uCol;
varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - .5);
  float a = smoothstep(.5, .15, d)*vAlpha;
  if (a < .01) discard;
  gl_FragColor = vec4(uCol, a);
}`

const TARGET: Record<S, { think: number; flat: number }> = {
  idle: { think: 0, flat: 0 },
  listening: { think: 0, flat: 0 },
  thinking: { think: 1, flat: 0 },
  speaking: { think: 0, flat: 0 },
  paused: { think: 0, flat: 1 },
}

const PAL: Record<CloudTheme, { col: string; blend: THREE.Blending; size: number }> = {
  night: { col: '#dff3ff', blend: THREE.AdditiveBlending, size: 2.6 },
  light: { col: '#2f3bff', blend: THREE.NormalBlending, size: 2.4 },
}

export class Cloud {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(0, 1, 0, 1, -10, 10)
  private mat: THREE.ShaderMaterial
  private geo = new THREE.BufferGeometry()
  private raf = 0
  private state: S = 'idle'
  private cur = { think: 0, flat: 0, lv: 0, kick: 0, morph: 0 }
  private morphTo = 0
  private morphAt = 0
  private last = performance.now()
  private t0 = performance.now()
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  private ro: ResizeObserver

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' })
    this.renderer.setClearColor(0x000000, 0)
    const rnd = new Float32Array(N * 4), txt = new Float32Array(N * 2).fill(-1)
    for (let i = 0; i < N; i++) rnd.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4)
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
    this.geo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 4))
    this.geo.setAttribute('aText', new THREE.BufferAttribute(txt, 2))
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 }, uLv: { value: 0 }, uThink: { value: 0 }, uFlat: { value: 0 }, uMorph: { value: 0 }, uKick: { value: 0 },
        uSize: { value: 2.6 }, uDpr: { value: 1 }, uBand: { value: 200 }, uView: { value: new THREE.Vector2(1, 1) }, uCol: { value: new THREE.Color() },
      },
    })
    const pts = new THREE.Points(this.geo, this.mat)
    pts.frustumCulled = false
    this.scene.add(pts)
    this.setTheme('night')
    this.ro = new ResizeObserver(() => this.measure())
    this.ro.observe(canvas)
    this.measure()
    this.frame()
  }

  setTheme(t: CloudTheme) {
    const p = PAL[t]
    this.mat.uniforms.uCol.value.set(p.col)
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
  /** a touch or a haptic tick shakes the sparks */
  kick(s = 1) {
    this.cur.kick = Math.min(1, this.cur.kick + s)
  }

  /** sparks fly up out of the light and build `text` over the solid figure in `box`, then fall back */
  buildText(text: string, box: HTMLElement, holdMs = 900) {
    if (this.reduced) return
    const c = this.canvas.getBoundingClientRect(), b = box.getBoundingClientRect()
    const cs = getComputedStyle(box)
    const step = Math.max(2.5, Math.min(5, b.height / 30))
    const w = Math.ceil(b.width / step), h = Math.ceil(b.height / step)
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    const ctx = cv.getContext('2d')!
    const fs = parseFloat(cs.fontSize) / step
    ctx.font = `${cs.fontWeight} ${fs}px ${cs.fontFamily}`
    ctx.textAlign = cs.textAlign === 'center' ? 'center' : 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#fff'
    ctx.fillText(text, ctx.textAlign === 'center' ? w / 2 : 0, h / 2 + fs * 0.04)
    const px = ctx.getImageData(0, 0, w, h).data
    const pts: number[] = []
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 120) pts.push(b.left - c.left + (x + 0.5) * step, b.top - c.top + (y + 0.5) * step)
    const count = pts.length / 2
    const attr = this.geo.getAttribute('aText') as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    arr.fill(-1)
    const take = Math.min(count, Math.floor(N * 0.7))
    const stride = N / take
    for (let k = 0; k < take; k++) {
      const i = Math.floor(k * stride)
      const src = Math.floor((k / take) * count) * 2
      arr[i * 2] = pts[src]
      arr[i * 2 + 1] = pts[src + 1]
    }
    attr.needsUpdate = true
    this.morphTo = 1
    this.morphAt = performance.now() + holdMs + 600
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
    this.mat.uniforms.uView.value.set(r.width, r.height)
    this.mat.uniforms.uBand.value = Math.min(r.height * 0.26, 240)
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
    c.think += (tg.think - c.think) * k * 0.6
    c.flat += (tg.flat - c.flat) * k
    c.kick *= Math.pow(0.02, dt)
    if (this.state !== 'listening' && this.state !== 'speaking') c.lv *= 0.9
    if (this.morphAt && now > this.morphAt) ((this.morphTo = 0), (this.morphAt = 0))
    c.morph += (this.morphTo - c.morph) * (1 - Math.pow(this.morphTo ? 0.02 : 0.08, dt))
    const u = this.mat.uniforms
    u.uTime.value = this.reduced ? 0 : (now - this.t0) / 1000
    u.uLv.value = this.reduced ? 0 : c.lv
    u.uThink.value = this.reduced ? 0 : c.think
    u.uFlat.value = c.flat
    u.uKick.value = this.reduced ? 0 : c.kick
    u.uMorph.value = c.morph
    this.renderer.render(this.scene, this.camera)
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
