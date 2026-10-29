// «Горизонт»: the bottom of the screen is a horizon at dawn, drawn as a halftone
// dot grid. Its height and motion carry the state, so it reads with peripheral
// vision: listening — rises with your voice; thinking — a spot runs along the line;
// speaking — pulses on syllables; paused — sinks to a thin line; offline — amber dashes.
// One full-screen fragment shader, capped at 1.5× device pixels.

export type Glow = 'ready' | 'listen' | 'think' | 'speak' | 'pause' | 'quiet' | 'offline' | 'denied' | 'off'

const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`

const FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uPitch, uT, uH, uAmp, uScan, uDash, uBase, uLine;
uniform vec3 uBg, uA, uB, uFaint;
out vec4 o;
void main(){
  vec2 p = gl_FragCoord.xy;
  vec2 c = (floor(p / uPitch) + .5) * uPitch;
  float x = c.x / uRes.x;
  // the horizon breathes a little even at rest; syllables add a quick ripple
  float h = uH * (1. + .05 * sin(x * 6.3 + uT * .7) + .035 * sin(x * 13. - uT * 1.1))
          + uAmp * uH * .22 * (.6 + .4 * sin(x * 9. + uT * 7.));
  h = max(h, 2.);
  float f = clamp(1. - c.y / h, 0., 1.);
  f = f * f * (3. - 2. * f);
  float sx = .5 + .44 * sin(uT * 1.7);
  float spot = uScan * exp(-pow((x - sx) * 6., 2.)) * exp(-pow((c.y - h) / (uPitch * 5.), 2.));
  float dash = mix(1., step(.45, fract(x * 22.)), uDash);
  float edge = exp(-pow((c.y - h) / (uPitch * .9), 2.)) * uLine * dash;
  float b = clamp(f * .85 + spot * 1.2 + edge, 0., 1.);
  float r = uPitch * .5 * (.16 + .7 * b);
  float d = length(p - c);
  float dot = smoothstep(r, r - 1.2, d) * step(.02, b);
  float faint = smoothstep(uPitch * .09, uPitch * .09 - 1., d) * uBase;
  vec3 col = mix(uA, uB, clamp(b * 1.1, 0., 1.));
  vec3 rgb = uBg + uFaint * faint + col * dot * (.35 + .65 * b);
  // a thin continuous line under the dots keeps the horizon readable in the sun
  float lineY = exp(-pow((p.y - h) / 1.2, 2.)) * uLine * dash;
  rgb += uB * lineY * .55;
  o = vec4(rgb, 1.);
}`

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)

type Target = { h: number; scan: number; dash: number; line: number; a: string; b: string }
const TARGET: Record<Glow, Target> = {
  ready: { h: 0.13, scan: 0, dash: 0, line: 0.9, a: '#2C3790', b: '#8B9BF7' },
  listen: { h: 0.22, scan: 0, dash: 0, line: 1, a: '#3A48C4', b: '#B4C0FF' },
  think: { h: 0.17, scan: 1, dash: 0, line: 0.8, a: '#2C3790', b: '#8B9BF7' },
  speak: { h: 0.24, scan: 0, dash: 0, line: 1, a: '#4F63D8', b: '#C2CBFF' },
  pause: { h: 0.025, scan: 0, dash: 0, line: 0.7, a: '#2C3790', b: '#8B9BF7' },
  quiet: { h: 0.012, scan: 0, dash: 0, line: 0.18, a: '#232A66', b: '#4F5CA8' },
  offline: { h: 0.02, scan: 0, dash: 1, line: 0.9, a: '#6B4A12', b: '#F5B544' },
  denied: { h: 0.02, scan: 0, dash: 1, line: 0.8, a: '#5C1E1E', b: '#F87171' },
  off: { h: 0, scan: 0, dash: 0, line: 0, a: '#000000', b: '#000000' },
}

export class Horizon {
  private gl: WebGL2RenderingContext | null
  private u: Record<string, WebGLUniformLocation | null> = {}
  private raf = 0
  private t0 = performance.now()
  private glow: Glow = 'ready'
  private cur = { h: 0.2, scan: 0, dash: 0, line: 0.9, amp: 0, a: hex('#2C3790'), b: hex('#8B9BF7') }
  private lv = 0
  private amp = 0
  private ro: ResizeObserver
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

  constructor(private canvas: HTMLCanvasElement) {
    this.gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false })
    this.ro = new ResizeObserver(() => this.size())
    this.ro.observe(canvas)
    if (!this.gl) {
      canvas.classList.add('is-flat')
      return
    }
    const gl = this.gl
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return s
    }
    const pr = gl.createProgram()!
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS))
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS))
    gl.linkProgram(pr)
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) {
      this.gl = null
      canvas.classList.add('is-flat')
      return
    }
    gl.useProgram(pr)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(pr, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    for (const n of ['uRes', 'uPitch', 'uT', 'uH', 'uAmp', 'uScan', 'uDash', 'uBase', 'uLine', 'uBg', 'uA', 'uB', 'uFaint']) this.u[n] = gl.getUniformLocation(pr, n)
    this.size()
    this.loop()
  }

  set(g: Glow) {
    this.glow = g
    this.canvas.dataset.glow = g
  }
  /** loudness 0..1 — the driver's voice while listening, Ась's while speaking */
  level(v: number) {
    this.lv = v
  }
  /** a syllable onset */
  pulse() {
    this.amp = Math.min(1, this.amp + 0.55)
  }

  private size() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5)
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr))
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr))
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    const gl = this.gl
    if (!gl || document.hidden) return
    const tg = TARGET[this.glow]
    const k = this.reduced ? 1 : 0.08
    const c = this.cur
    const lift = this.glow === 'listen' ? this.lv * 0.22 : this.glow === 'speak' ? this.lv * 0.1 : 0
    c.h += (tg.h + lift - c.h) * k
    c.scan += (tg.scan - c.scan) * k
    c.dash += (tg.dash - c.dash) * 0.2
    c.line += (tg.line - c.line) * k
    const ta = hex(tg.a), tb = hex(tg.b)
    for (let i = 0; i < 3; i++) {
      c.a[i] += (ta[i] - c.a[i]) * k
      c.b[i] += (tb[i] - c.b[i]) * k
    }
    this.amp *= 0.9
    const dpr = this.canvas.width / Math.max(1, this.canvas.clientWidth)
    const H = this.canvas.height
    gl.viewport(0, 0, this.canvas.width, H)
    gl.uniform2f(this.u.uRes, this.canvas.width, H)
    gl.uniform1f(this.u.uPitch, 7 * dpr)
    gl.uniform1f(this.u.uT, this.reduced ? 0 : (performance.now() - this.t0) / 1000)
    gl.uniform1f(this.u.uH, c.h * H)
    gl.uniform1f(this.u.uAmp, this.reduced ? 0 : this.amp)
    gl.uniform1f(this.u.uScan, c.scan)
    gl.uniform1f(this.u.uDash, c.dash)
    gl.uniform1f(this.u.uLine, c.line)
    gl.uniform1f(this.u.uBase, 1)
    gl.uniform3f(this.u.uBg, 0.043, 0.043, 0.051)
    gl.uniform3f(this.u.uFaint, 0.06, 0.06, 0.075)
    gl.uniform3fv(this.u.uA, c.a)
    gl.uniform3fv(this.u.uB, c.b)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
