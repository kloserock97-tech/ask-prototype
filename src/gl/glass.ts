// "Voice behind glass": a cobalt glow seen through vertical fluted glass.
// Same maths as the Figma shader of the same name; parameters ease toward
// the target of the current state so state changes flow instead of jumping.

const VERT = `#version 300 es
in vec2 a;
out vec2 uv;
void main() { uv = a * 0.5 + 0.5; uv.y = 1.0 - uv.y; gl_Position = vec4(a, 0.0, 1.0); }`

const FRAG = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 o;
uniform vec2 res;
uniform float t;
uniform vec3 bg;
uniform vec3 glow;
uniform float level;
uniform float intensity;
uniform float center;
uniform float speed;
uniform float grain;
uniform float flutes;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float blob(vec2 p, vec2 c, float r, float aspect) {
  vec2 d = (p - c) * vec2(aspect, 1.0);
  return exp(-dot(d, d) / (r * r));
}
void main() {
  float aspect = res.x / max(res.y, 1.0);
  float s = uv.x * flutes;
  float idx = floor(s);
  float f = fract(s) - 0.5;
  vec2 p = uv;
  p.x += f * abs(f) * 0.6;
  p.x = mix(p.x, (idx + 0.5) / flutes, 0.55);

  float tt = t * speed;
  float r = 0.14 + 0.14 * level;
  vec2 c1 = vec2(0.5 + 0.16 * sin(tt * 0.9), center + 0.06 * cos(tt * 0.7));
  vec2 c2 = vec2(0.38 + 0.12 * sin(tt * 1.3 + 2.0), center + 0.09 + 0.07 * sin(tt * 0.8 + 1.0));
  vec2 c3 = vec2(0.64 + 0.12 * cos(tt * 1.1 + 4.0), center - 0.07 + 0.06 * cos(tt * 1.2 + 3.0));
  float dens = blob(p, c1, r, aspect) * (0.8 + 0.4 * level);
  dens += blob(p, c2, r * 0.8, aspect) * 0.75;
  dens += blob(p, c3, r * 0.7, aspect) * 0.65;

  float lens = pow(max(cos(3.14159265 * f), 0.0), 0.6);
  float v = dens * lens * intensity * (0.55 + 0.6 * level);
  float lit = 1.0 - exp(-v * 1.6);

  vec3 col = mix(bg, glow, smoothstep(0.0, 1.0, lit));
  float core = pow(clamp(v / 4.0, 0.0, 1.0), 3.0);
  col = mix(col, mix(glow, vec3(1.0), 0.55), core * 0.6);

  float rim = 1.0 - smoothstep(0.0, 0.035, 0.5 - abs(f));
  col = mix(col, mix(col, vec3(1.0), 0.35), rim * 0.35);
  float sp = exp(-pow((f + 0.3) / 0.04, 2.0));
  col += vec3(1.0) * sp * 0.035 * (0.3 + lit);

  float n = hash12(uv * res + fract(t * 7.0) * 100.0) - 0.5;
  o = vec4(clamp(col + n * grain, 0.0, 1.0), 1.0);
}`

export type GlassParams = {
  bg: [number, number, number]
  glow: [number, number, number]
  level: number
  intensity: number
  center: number
  speed: number
}

const hex = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16) / 255,
  parseInt(h.slice(3, 5), 16) / 255,
  parseInt(h.slice(5, 7), 16) / 255,
]

export const BG = { day: hex('#F2F2F6'), night: hex('#0B0C1A') }
const COBALT = hex('#2F3BFF')
const GREY = hex('#9A9EB8')
const HOT = hex('#FF5A1F')

export const GLOW: Record<string, Omit<GlassParams, 'bg'>> = {
  idle: { glow: COBALT, level: 0.05, intensity: 1.0, center: 0.22, speed: 0.35 },
  listen: { glow: COBALT, level: 0.45, intensity: 2.0, center: 0.22, speed: 0.5 },
  think: { glow: COBALT, level: 0.2, intensity: 1.5, center: 0.2, speed: 0.9 },
  speak: { glow: COBALT, level: 0.55, intensity: 2.6, center: 0.22, speed: 0.5 },
  unsure: { glow: COBALT, level: 0.3, intensity: 1.8, center: 0.22, speed: 0.4 },
  pause: { glow: GREY, level: 0.1, intensity: 1.0, center: 0.22, speed: 0 },
  off: { glow: GREY, level: 0.0, intensity: 0.4, center: 0.22, speed: 0 },
  danger: { glow: HOT, level: 0.6, intensity: 2.6, center: 0.22, speed: 0.6 },
}

export class Glass {
  private gl: WebGL2RenderingContext | null
  private prog: WebGLProgram | null = null
  private u: Record<string, WebGLUniformLocation | null> = {}
  private cur: GlassParams
  private target: GlassParams
  private pulse = 0 // extra level from speech, decays every frame
  private start = performance.now()
  private raf = 0
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  private visible = true

  constructor(private canvas: HTMLCanvasElement) {
    this.gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: false })
    const init: GlassParams = { bg: BG.day, ...GLOW.idle }
    this.cur = structuredClone(init)
    this.target = structuredClone(init)
    if (this.gl) this.compile()
    document.addEventListener('visibilitychange', () => {
      this.visible = !document.hidden
      if (this.visible) this.loop()
    })
    new ResizeObserver(() => this.resize()).observe(canvas)
    this.resize()
    this.loop()
  }

  get ok() {
    return !!this.prog
  }

  destroy() {
    this.visible = false
    cancelAnimationFrame(this.raf)
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext()
    this.prog = null
  }

  set(mode: 'day' | 'night', glow: string) {
    this.target = { bg: BG[mode], ...GLOW[glow] }
  }

  /** a short bump of loudness — called on every spoken word */
  bump(amount = 0.35) {
    this.pulse = Math.min(0.6, this.pulse + amount)
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
    for (const n of ['res', 't', 'bg', 'glow', 'level', 'intensity', 'center', 'speed', 'grain', 'flutes'])
      this.u[n] = gl.getUniformLocation(p, n)
  }

  private resize() {
    // half resolution is plenty for a soft glow behind glass and saves battery
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * 0.5
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr))
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr))
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
      this.gl?.viewport(0, 0, w, h)
    }
  }

  private loop = () => {
    cancelAnimationFrame(this.raf)
    if (!this.visible || !this.prog) return
    const gl = this.gl!
    // exponential ease toward the target: frame-rate independent enough at 60–120 Hz
    const k = 0.08
    const c = this.cur, tg = this.target
    for (let i = 0; i < 3; i++) {
      c.bg[i] += (tg.bg[i] - c.bg[i]) * k
      c.glow[i] += (tg.glow[i] - c.glow[i]) * k
    }
    c.level += (tg.level - c.level) * k
    c.intensity += (tg.intensity - c.intensity) * k
    c.center += (tg.center - c.center) * k
    c.speed += (tg.speed - c.speed) * k
    this.pulse *= 0.9

    const t = (performance.now() - this.start) / 1000
    gl.uniform2f(this.u.res, this.canvas.width, this.canvas.height)
    gl.uniform1f(this.u.t, this.reduced ? 0 : t)
    gl.uniform3fv(this.u.bg, c.bg)
    gl.uniform3fv(this.u.glow, c.glow)
    gl.uniform1f(this.u.level, Math.min(1, c.level + this.pulse))
    gl.uniform1f(this.u.intensity, c.intensity)
    gl.uniform1f(this.u.center, c.center)
    gl.uniform1f(this.u.speed, this.reduced ? 0 : c.speed)
    gl.uniform1f(this.u.grain, this.reduced ? 0 : 0.03)
    gl.uniform1f(this.u.flutes, 7)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    this.raf = requestAnimationFrame(this.loop)
  }
}
