// One full-screen WebGL2 pass: the neon blob on black (idle / listen / think)
// and the colour field with drifting light lines (answer). Every state is a
// uniform that eases toward its target, so changes never jump.

const VERT = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uCenter;   // blob centre, css px from top-left
uniform float uRad;     // blob radius, css px
uniform float uDpr;
uniform float uField;   // 0 blob on black .. 1 colour field
uniform float uLevel;   // voice loudness 0..1
uniform float uSpin;    // think: faster swirl
uniform float uShrink;  // listen: blob pulled in
uniform vec3 uTop;      // field colour, top
uniform vec3 uBottom;   // field colour, bottom
uniform float uBump;    // tap ripple 1 -> 0
uniform float uDim;     // 0.4 waiting .. 1 listening / speaking
out vec4 o;

float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }

vec3 blob(vec2 px, float t) {
  vec2 q = (px - uCenter) / uRad;
  float ang = atan(q.y, q.x);
  float r = length(q);
  float sw = t * (0.12 + uSpin * 0.9);
  float n = fbm(vec3(q * 1.4 + vec2(sin(sw), cos(sw * 0.8)) * 0.6, t * 0.18 + uSpin * t * 0.4));
  float edge = 1.0 + 0.1 * sin(ang * 3.0 + t * 0.5 + uSpin * t * 2.0) + 0.22 * (n - 0.5)
             + uLevel * 0.2 - uShrink * 0.14 + uBump * 0.1 * sin(r * 8.0 - uBump * 6.0);
  float d = r / edge;
  vec3 core = vec3(1.0, 0.04, 0.82);
  vec3 hot  = vec3(1.0, 0.02, 0.5);
  vec3 lime = vec3(0.86, 1.0, 0.08);
  vec3 grn  = vec3(0.2, 0.95, 0.3);
  vec3 red  = vec3(0.85, 0.04, 0.12);
  // the rim colour wanders around the edge: lime, green, a touch of red
  float hue = 0.5 + 0.5 * sin(ang * 2.0 - t * 0.35 + n * 3.0);
  vec3 rimc = mix(lime, grn, hue * 0.45);
  rimc = mix(rimc, red, smoothstep(0.55, 1.0, sin(ang + t * 0.27 + 2.0)) * 0.7);
  // one soft glow, no gaps: magenta body fading into a blurred coloured rim
  float body = smoothstep(1.22, 0.5, d);
  vec3 c = mix(hot, core, smoothstep(1.05, 0.35, d)) * body;
  float rim = exp(-pow((d - 1.02) * 3.6, 2.0)) * (0.25 + 0.75 * hue);
  c = mix(c, rimc, rim * 0.42) + rimc * rim * 0.12;
  float halo = exp(-max(d - 0.95, 0.0) * 3.6);
  c += mix(rimc, red, 0.6) * halo * 0.14 * smoothstep(0.9, 1.3, d);
  return c;
}

vec3 field(vec2 uv, float t) {
  vec3 base = mix(uTop, uBottom, smoothstep(0.0, 1.0, uv.y));
  base *= 0.82 + 0.28 * fbm(vec3(uv * 1.6, t * 0.05));
  // light lines: a warped coordinate whose iso-lines are drawn thin and bright
  vec2 q = uv * vec2(2.4, 3.2);
  vec2 w = vec2(fbm(vec3(q, t * 0.07)), fbm(vec3(q + 7.3, t * 0.07)));
  float s1 = abs(sin((q.x + w.x * 2.6) * 3.1 + (q.y + w.y * 1.8) * 1.7 + t * 0.25));
  float s2 = abs(sin((q.y + w.x * 2.2) * 2.6 - (q.x - w.y * 2.0) * 1.2 - t * 0.18));
  // dim and slow: at night a bright line across the screen is glare
  float lines = smoothstep(0.04, 0.0, s1) * 0.28 + smoothstep(0.03, 0.0, s2) * 0.16;
  lines *= 0.5 + uLevel * 0.8;
  vec3 glow = mix(uTop, vec3(1.0), 0.55);
  return base + glow * lines;
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec2 res = uRes / uDpr;
  vec2 uv = px / res;
  float t = uTime;
  vec3 a = blob(px, t) * uDim;
  vec3 b = field(uv, t);
  // the blob swells into the field: blend from its centre outward
  float reach = length((px - uCenter) / max(res.x, res.y));
  float m = smoothstep(reach - 0.25, reach + 0.05, uField * 1.6 - 0.2);
  o = vec4(mix(a, b, m), 1.0);
}`

type V3 = [number, number, number]
const ease = (cur: number, to: number, k: number, dt: number) => cur + (to - cur) * (1 - Math.exp(-k * dt))

export class GlowScene {
  readonly canvas = document.createElement('canvas')
  private gl: WebGL2RenderingContext | null
  private prog: WebGLProgram | null = null
  private u: Record<string, WebGLUniformLocation | null> = {}
  private raf = 0
  private last = performance.now()
  private t = 0
  private reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  // live values and their targets
  private cur = { field: 0, level: 0, spin: 0, shrink: 0, bump: 0, dim: 0.45 }
  target = { field: 0, level: 0, spin: 0, shrink: 0, dim: 0.45 }
  private top: V3 = [0.62, 0.04, 0.42]
  private bottom: V3 = [0.16, 0.0, 0.12]
  private topTo: V3 = [0.62, 0.04, 0.42]
  private bottomTo: V3 = [0.16, 0.0, 0.12]
  center = { x: 195, y: 260 }
  radius = 150

  constructor() {
    this.canvas.className = 'gl-canvas'
    this.gl = this.canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false })
    if (!this.gl) return
    const gl = this.gl
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return s
    }
    const p = gl.createProgram()!
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT))
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return
    this.prog = p
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(p, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    for (const n of ['uRes', 'uTime', 'uCenter', 'uRad', 'uDpr', 'uField', 'uLevel', 'uSpin', 'uShrink', 'uTop', 'uBottom', 'uBump', 'uDim']) this.u[n] = gl.getUniformLocation(p, n)
    this.raf = requestAnimationFrame(this.frame)
  }

  /** colour of the answer field; eases over ~0.7 s */
  setColors(top: V3, bottom: V3) {
    this.topTo = top
    this.bottomTo = bottom
  }

  bump() {
    this.cur.bump = 1
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame)
    const gl = this.gl
    if (!gl || !this.prog) return
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    this.t += dt * (this.reduce ? 0.15 : 1)
    const c = this.cur, g = this.target
    c.field = ease(c.field, g.field, 4.2, dt)
    c.level = ease(c.level, g.level, 14, dt)
    c.spin = ease(c.spin, g.spin, 3, dt)
    c.shrink = ease(c.shrink, g.shrink, 6, dt)
    c.bump = Math.max(0, c.bump - dt * 1.6)
    c.dim = ease(c.dim, g.dim, 3, dt)
    for (let i = 0; i < 3; i++) {
      this.top[i] = ease(this.top[i], this.topTo[i], 3.2, dt)
      this.bottom[i] = ease(this.bottom[i], this.bottomTo[i], 3.2, dt)
    }
    const dpr = Math.min(2, devicePixelRatio || 1) * 0.6 // the image is soft — render it small
    const w = Math.round(this.canvas.clientWidth * dpr), h = Math.round(this.canvas.clientHeight * dpr)
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
    gl.viewport(0, 0, w, h)
    gl.useProgram(this.prog)
    const u = this.u
    gl.uniform2f(u.uRes, w, h)
    gl.uniform1f(u.uDpr, dpr)
    gl.uniform1f(u.uTime, this.t)
    gl.uniform2f(u.uCenter, this.center.x, this.center.y)
    gl.uniform1f(u.uRad, this.radius)
    gl.uniform1f(u.uField, c.field)
    gl.uniform1f(u.uLevel, c.level)
    gl.uniform1f(u.uSpin, c.spin)
    gl.uniform1f(u.uShrink, c.shrink)
    gl.uniform1f(u.uBump, c.bump)
    gl.uniform1f(u.uDim, c.dim)
    gl.uniform3f(u.uTop, ...this.top)
    gl.uniform3f(u.uBottom, ...this.bottom)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext()
    this.gl = null
  }
}
