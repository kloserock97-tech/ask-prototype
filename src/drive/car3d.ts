// The car on the navigator: a small SVG drawn with our own perspective projection, seen from behind and above,
// laid over the map picture (public/car/map-night.webp) at the start of the route. One colour fill recolours it.

type V3 = [number, number, number]
type Body = 'compact' | 'sedan' | 'pickup'
interface Poly { z: number; svg: string }

// a camera behind and above, close to the tilt of the map picture
const CAM: V3 = [0, -26, 30]
const AIM: V3 = [0, 44, 0]
const FPX = 640

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: V3): V3 => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l] }
const F = norm(sub(AIM, CAM))
const R = norm(cross(F, [0, 0, 1]))
const U = cross(R, F)

// screen coordinates around the car's own origin: (0, 0) is the point under the middle of the car
function project(p: V3): [number, number, number] {
  const d = sub(p, CAM), o = sub([0, 0, 0], CAM)
  const z = dot(d, F), zo = dot(o, F)
  return [(FPX * dot(d, R)) / z - (FPX * dot(o, R)) / zo, -(FPX * dot(d, U)) / z + (FPX * dot(o, U)) / zo, z]
}
const pts = (ps: V3[]) => ps.map((p) => { const [x, y] = project(p); return `${x.toFixed(1)},${y.toFixed(1)}` }).join(' ')
const depth = (ps: V3[]) => ps.reduce((a, p) => a + project(p)[2], 0) / ps.length

const hex = (h: string) => { if (h.startsWith('rgb')) return h.slice(4, -1).split(',').map(Number); const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
const mix = (a: string, b: string, k: number) => { const x = hex(a), y = hex(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',')})` }
const shade = (c: string, k: number) => mix(c, k > 0 ? '#ffffff' : '#000000', Math.abs(k))

// a solid between a bottom and a top rectangle: tapered sides give the windshield and the rear glass their slope
function prism(polys: Poly[], c: V3, bot: [number, number], top: [number, number], h: number, col: { top: string; side: string; ends?: string }, dy = 0) {
  const [x, y, z] = c
  const b = (sx: number, sy: number): V3 => [x + sx * bot[0] / 2, y + sy * bot[1] / 2, z]
  const t = (sx: number, sy: number): V3 => [x + sx * top[0] / 2, y + dy + sy * top[1] / 2, z + h]
  const sun = norm([-0.5, -0.6, 0.9])
  const faces: [V3[], string][] = [
    [[t(-1, -1), t(1, -1), t(1, 1), t(-1, 1)], col.top],
    [[b(-1, -1), b(1, -1), t(1, -1), t(-1, -1)], col.ends ?? col.side],
    [[b(1, 1), b(-1, 1), t(-1, 1), t(1, 1)], col.ends ?? col.side],
    [[b(1, -1), b(1, 1), t(1, 1), t(1, -1)], col.side],
    [[b(-1, 1), b(-1, -1), t(-1, -1), t(-1, 1)], col.side],
  ]
  for (const [f, c0] of faces) {
    const n = norm(cross(sub(f[1], f[0]), sub(f[2], f[0])))
    const cen: V3 = [f.reduce((a, p) => a + p[0], 0) / 4, f.reduce((a, p) => a + p[1], 0) / 4, f.reduce((a, p) => a + p[2], 0) / 4]
    if (dot(n, sub(CAM, cen)) <= 0) continue
    const c1 = shade(c0, dot(n, sun) * 0.3 - 0.05)
    polys.push({ z: depth(f), svg: `<polygon points="${pts(f)}" fill="${c1}" stroke="${c1}" stroke-width=".6" stroke-linejoin="round"/>` })
  }
}

const BODY: Record<Body, { L: number; cab: number; cy: number; bed: boolean }> = {
  compact: { L: 4.0, cab: 2.0, cy: -0.3, bed: false },
  sedan: { L: 4.6, cab: 2.1, cy: -0.1, bed: false },
  pickup: { L: 4.8, cab: 1.7, cy: 0.6, bed: true },
}

/** The car as an SVG string; the ring under it (.dv-ai-ring) shows while Ась talks. */
export function carSvg(color: string, body: Body, k = 1.05) {
  const b = BODY[body]
  const P = (x: number, y: number, z: number): V3 => [x * k, y * k, z * k]
  const glass = '#1d2636'
  const polys: Poly[] = []
  for (const s of [-1, 1]) for (const wy of [b.L / 2 - 0.85, -b.L / 2 + 0.85]) prism(polys, P(s * 0.9, wy, 0), [0.3 * k, 0.7 * k], [0.3 * k, 0.7 * k], 0.6 * k, { top: '#16181c', side: '#0f1114' })
  prism(polys, P(0, 0, 0.22), [1.86 * k, b.L * k], [1.78 * k, (b.L - 0.25) * k], 0.5 * k, { top: color, side: shade(color, -0.12) })
  prism(polys, P(0, -b.L / 2 + 0.02, 0.2), [1.8 * k, 0.16 * k], [1.8 * k, 0.16 * k], 0.22 * k, { top: '#1a1c21', side: '#15171b' })
  for (const s of [-1, 1]) prism(polys, P(s * 0.6, -b.L / 2 - 0.01, 0.5), [0.42 * k, 0.05 * k], [0.42 * k, 0.05 * k], 0.14 * k, { top: '#ff6b72', side: '#ff4a52' })
  prism(polys, P(0, b.cy, 0.72), [1.66 * k, b.cab * k], [1.4 * k, b.cab * 0.62 * k], 0.48 * k, { top: color, side: glass, ends: glass }, -0.08 * k)
  if (b.bed) prism(polys, P(0, -b.L / 2 + 0.78, 0.72), [1.6 * k, 1.35 * k], [1.6 * k, 1.35 * k], 0.02 * k, { top: '#202329', side: '#202329' })
  polys.sort((a, c) => c.z - a.z)
  const [, sy] = project([0, -0.2 * k, 0])
  return `<svg class="dv-car3d" viewBox="-60 -70 120 100" aria-hidden="true">
<ellipse class="dv-ai-ring" cx="0" cy="${(sy + 2).toFixed(1)}" rx="${(26 * k).toFixed(1)}" ry="${(8 * k).toFixed(1)}" fill="rgb(79 180 255 / .14)" stroke="rgb(143 208 255 / .85)" stroke-width="2"/>
<ellipse cx="0" cy="${(sy + 3).toFixed(1)}" rx="${(15 * k).toFixed(1)}" ry="${(5 * k).toFixed(1)}" fill="#000" opacity=".45"/>
${polys.map((p) => p.svg).join('')}</svg>`
}
