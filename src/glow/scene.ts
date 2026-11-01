// One full-screen WebGL2 pass with three layers:
// · trail — the splash into «В дороге»: striped light bands, mirrored and squeezed
//   into one vanishing point, blurred toward it — the road collapses into the globe;
// · globe — the voice: a blurred gradient shape swirled by noise, seen through a
//   lens sphere, with a thin glowing rim (idle / listen / think / speak);
// · field — the answer: a dark colour field with dim light lines.
// Every state is a uniform that eases toward its target, so changes never jump.

const VERT = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uCenter;   // globe centre, css px from top-left
uniform float uRad;     // globe radius, css px
uniform float uDpr;
uniform float uField;   // 0 globe on black .. 1 colour field
uniform float uLevel;   // voice loudness 0..1
uniform float uSpin;    // think: faster swirl
uniform float uShrink;  // listen: the globe gathers in
uniform vec3 uTop;      // field colour, top
uniform vec3 uBottom;   // field colour, bottom
uniform float uBump;    // tap ripple 1 -> 0
uniform float uDim;     // 0.4 waiting .. 1 listening / speaking
uniform float uTrail;   // trail brightness 0..1
uniform float uSqueeze; // 0 road wide open .. 1 collapsed into the globe point
uniform float uGrow;    // globe scale 0..1 (grows out of the collapsed trail)
out vec4 o;

const vec3 EMBER = vec3(1.0, 0.29, 0.12);
const vec3 ICE   = vec3(0.56, 0.69, 1.0);
const vec3 WHITE = vec3(0.95, 0.96, 1.0);
const vec3 COBALT = vec3(0.18, 0.33, 1.0);
const vec3 MAGENTA = vec3(0.89, 0.24, 0.78);

float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }

// ---------------------------------------------------------------- globe
// the source: a five-point shape with a magenta-to-cobalt gradient, blurred,
// pushed around by turbulence (louder voice = stronger turbulence, bigger shape)
vec4 source(vec2 q, float t) {
  float a = t * (0.12 + uSpin * 0.9);
  q = mat2(cos(a), -sin(a), sin(a), cos(a)) * q;
  float amp = 0.32 + uLevel * 0.55 + uSpin * 0.25;
  q += amp * (vec2(fbm(vec3(q * 1.7, t * 0.22)), fbm(vec3(q * 1.7 + 5.2, -t * 0.22))) - 0.5);
  vec2 c = q - 0.3 * vec2(cos(t * 0.21), sin(t * 0.17)); // the shape drifts inside the sphere
  float r = length(c);
  float ang = atan(c.y, c.x) + r * 2.4 - t * (0.3 + uSpin * 1.2); // swirl: the arms wind around the core
  float R = 0.46 + 0.12 * cos(ang * 3.0) + uLevel * 0.3 - uShrink * 0.12;
  float dens = smoothstep(R + 0.45, R - 0.35, r);
  dens *= 0.55 + 0.45 * sin(ang * 2.0 + r * 5.0); // light streaks, not a solid blob
  vec3 col = mix(MAGENTA, COBALT, clamp(dot(q, vec2(0.62, -0.62)) * 0.75 + 0.5, 0.0, 1.0));
  col = mix(col, WHITE, smoothstep(0.6, 1.0, dens) * 0.55);
  return vec4(col, dens);
}

vec3 globe(vec2 px, float t) {
  float rad = uRad * max(uGrow, 0.001) * (1.0 + uBump * 0.04 * sin(uBump * 9.0));
  vec2 p = (px - uCenter) / rad;
  float r = length(p);
  // lens: the centre magnified, the outer source squeezed into the rim
  float z = sqrt(max(0.0, 1.0 - r * r));
  vec2 q = p / (0.3 + 0.7 * z) * 0.62;
  vec4 s = source(q, t);
  float inside = smoothstep(1.0, 0.985, r);
  float fres = pow(1.0 - z, 2.5);
  vec3 c = s.rgb * s.a * (0.85 + 1.1 * fres) * inside;
  // the rim: a thin ring lit by whatever light sits nearest the edge
  vec4 e = source(p / max(r, 0.001) * 1.6, t);
  vec3 rimc = mix(e.rgb, mix(MAGENTA, COBALT, 0.5), 0.35);
  float ring = exp(-pow((r - 1.0) * 38.0, 2.0));
  c += rimc * ring * (0.35 + 0.9 * e.a);
  // deep glow: soft light spilling past the edge, strongest where the rim is lit
  c += rimc * exp(-max(r - 1.0, 0.0) * 4.5) * smoothstep(0.96, 1.08, r) * (0.12 + 0.45 * e.a);
  return c;
}

// ---------------------------------------------------------------- trail
// one band's colour along the cycle ember -> white -> ice -> cobalt -> ember
vec3 cycle(float v) {
  v = fract(v) * 4.0;
  if (v < 1.0) return mix(EMBER, WHITE, smoothstep(0.0, 1.0, v));
  if (v < 2.0) return mix(WHITE, ICE, smoothstep(1.0, 2.0, v));
  if (v < 3.0) return mix(ICE, COBALT, smoothstep(2.0, 3.0, v));
  return mix(COBALT, EMBER, smoothstep(3.0, 4.0, v));
}

vec3 trail(vec2 px, vec2 res, float t) {
  vec2 v = uCenter;                       // the vanishing point is where the globe will be
  float bottom = res.y + 0.08 * res.y;
  float s = (px.y - v.y) / (bottom - v.y); // 0 at the point, 1 below the screen edge
  if (s <= 0.0) return vec3(0.0);
  float open = 1.0 - uSqueeze;
  // squeeze: a long narrow neck that flares out near the bottom edge
  float w = res.x * (0.045 + 0.95 * pow(s, 2.6)) * open + 0.001;
  float x = abs(px.x - v.x) / w;          // mirror
  float n = 7.0, b = x * n;
  float band = floor(b) + smoothstep(0.3, 0.7, fract(b)); // soft band edges
  vec3 c = vec3(0.0);
  // radial blur toward the point: average a few steps of the same band
  for (int i = 0; i < 6; i++) {
    float si = s * (1.0 - float(i) * 0.035);
    c += cycle(si * 1.35 - t * 0.55 + band * 0.085 + 0.12);
  }
  c /= 6.0;
  float body = smoothstep(1.0, 0.86, x);
  float halo = exp(-max(x - 1.0, 0.0) * 5.0) * (1.0 - body) * 0.35;
  float fadeIn = smoothstep(0.0, 0.16, s);
  return (c * body + EMBER * halo) * fadeIn * smoothstep(0.0, 0.2, open);
}

// ---------------------------------------------------------------- field
vec3 field(vec2 uv, float t) {
  vec3 base = mix(uTop, uBottom, smoothstep(0.0, 1.0, uv.y));
  base *= 0.82 + 0.28 * fbm(vec3(uv * 1.6, t * 0.05));
  vec2 q = uv * vec2(2.4, 3.2);
  vec2 w = vec2(fbm(vec3(q, t * 0.07)), fbm(vec3(q + 7.3, t * 0.07)));
  float s1 = abs(sin((q.x + w.x * 2.6) * 3.1 + (q.y + w.y * 1.8) * 1.7 + t * 0.25));
  float s2 = abs(sin((q.y + w.x * 2.2) * 2.6 - (q.x - w.y * 2.0) * 1.2 - t * 0.18));
  // dim and slow: at night a bright line across the screen is glare
  float lines = smoothstep(0.04, 0.0, s1) * 0.28 + smoothstep(0.03, 0.0, s2) * 0.16;
  lines *= 0.5 + uLevel * 0.8;
  return base + mix(uTop, vec3(1.0), 0.55) * lines;
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec2 res = uRes / uDpr;
  vec2 uv = px / res;
  float t = uTime;
  vec3 a = globe(px, t) * uDim;
  if (uTrail > 0.001) a += trail(px, res, t) * uTrail;
  vec3 b = field(uv, t);
  // the globe swells into the field: blend from its centre outward
  float reach = length((px - uCenter) / max(res.x, res.y));
  float m = smoothstep(reach - 0.25, reach + 0.05, uField * 1.6 - 0.2);
  o = vec4(mix(a, b, m), 1.0);
}`

type V3 = [number, number, number]
const ease = (cur: number, to: number, k: number, dt: number) => cur + (to - cur) * (1 - Math.exp(-k * dt))
const out = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3)

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
  private top: V3 = [0.06, 0.1, 0.5]
  private bottom: V3 = [0.01, 0.015, 0.06]
  private topTo: V3 = [0.06, 0.1, 0.5]
  private bottomTo: V3 = [0.01, 0.015, 0.06]
  // the splash: -1 when not playing, else ms since it started
  private trailAt = -1
  private trailMs = 2600
  private trailDone: (() => void) | null = null
  private trailTimer = 0
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
    for (const n of ['uRes', 'uTime', 'uCenter', 'uRad', 'uDpr', 'uField', 'uLevel', 'uSpin', 'uShrink', 'uTop', 'uBottom', 'uBump', 'uDim', 'uTrail', 'uSqueeze', 'uGrow']) this.u[n] = gl.getUniformLocation(p, n)
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

  /** the splash into the mode: the road of light runs, then collapses into the globe */
  playTrail(done: () => void) {
    this.trailMs = this.reduce ? 500 : 2600
    this.trailAt = 0
    this.trailDone = done
    if (!this.gl || !this.prog) return this.finishTrail()
    // ends the splash even when frames stop (a hidden tab pauses requestAnimationFrame)
    this.trailTimer = window.setTimeout(() => this.finishTrail(), this.trailMs + 400)
  }

  /** a tap skips to the collapse */
  skipTrail() {
    if (this.trailAt < 0) return
    this.trailAt = Math.max(this.trailAt, this.trailMs * 0.72)
    clearTimeout(this.trailTimer)
    this.trailTimer = window.setTimeout(() => this.finishTrail(), this.trailMs * 0.28 + 400)
  }

  private finishTrail() {
    clearTimeout(this.trailTimer)
    this.trailAt = -1
    const d = this.trailDone
    this.trailDone = null
    d?.()
  }

  /** brightness, squeeze and globe size for the splash at time ms */
  private trailState(ms: number) {
    const k = ms / this.trailMs
    if (this.reduce) return { trail: 0, squeeze: 1, grow: out(k) }
    const collapse = (k - 0.62) / 0.3 // the last third: the road narrows into the point
    return {
      trail: out(k / 0.12) * (1 - out((k - 0.74) / 0.18)),
      squeeze: out(collapse),
      grow: out((k - 0.72) / 0.28),
    }
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame)
    const gl = this.gl
    if (!gl || !this.prog) return
    const dtMs = Math.min(50, now - this.last)
    const dt = dtMs / 1000
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
    let tr = { trail: 0, squeeze: 1, grow: 1 }
    if (this.trailAt >= 0) {
      this.trailAt += dtMs
      tr = this.trailState(this.trailAt)
      if (this.trailAt >= this.trailMs) this.finishTrail()
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
    gl.uniform1f(u.uTrail, tr.trail)
    gl.uniform1f(u.uSqueeze, tr.squeeze)
    gl.uniform1f(u.uGrow, tr.grow)
    gl.uniform3f(u.uTop, ...this.top)
    gl.uniform3f(u.uBottom, ...this.bottom)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    clearTimeout(this.trailTimer)
    this.trailDone = null
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext()
    this.gl = null
  }
}
