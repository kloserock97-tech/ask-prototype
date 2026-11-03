// The navigator in 3D, drawn as plain SVG: our own small perspective projection.
// A camera behind and above the car, extruded blocks, the route lying on the road, the car itself as shaded boxes.
// Nothing moves: one frame per state, so the road stays the only thing that changes.

type V3 = [number, number, number]
type Body = 'compact' | 'sedan' | 'pickup'

const W = 390, H = 844
const CAM: V3 = [0, -26, 30]
const AIM: V3 = [0, 44, 0]
const FPX = 640 // focal length in px
const CX = 195, CY = 292 // the screen point the camera looks at

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: V3): V3 => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l] }

const F = norm(sub(AIM, CAM))
const R = norm(cross(F, [0, 0, 1]))
const U = cross(R, F)

function project(p: V3): [number, number, number] {
  const d = sub(p, CAM)
  const z = dot(d, F)
  return [CX + (FPX * dot(d, R)) / z, CY - (FPX * dot(d, U)) / z, z]
}
const pts = (ps: V3[]) => ps.map((p) => { const [x, y] = project(p); return `${x.toFixed(1)},${y.toFixed(1)}` }).join(' ')
const depth = (ps: V3[]) => ps.reduce((a, p) => a + project(p)[2], 0) / ps.length

// colours: night map, fading into the haze toward the horizon
const hex = (h: string) => { if (h.startsWith('rgb')) return h.slice(4, -1).split(',').map(Number); const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
const mix = (a: string, b: string, k: number) => { const x = hex(a), y = hex(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',')})` }
const HAZE = '#2b3140'
const fog = (c: string, z: number) => mix(c, HAZE, Math.min(0.85, Math.max(0, (z - 40) / 260)))
const shade = (c: string, k: number) => mix(c, k > 0 ? '#ffffff' : '#000000', Math.abs(k))

// the city: straight roads, our route goes up the main road and turns right
const ROADS_X = [-62, 0, 58] // roads along y
const ROADS_Y = [-10, 40, 84, 150, 220] // roads along x
const TURN_Y = 84

function rnd(i: number) { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }

interface Poly { z: number; svg: string }

function ground(polys: Poly[]) {
  const road = (a: V3[], w: string) => polys.push({ z: 1e6 - 1, svg: `<polygon points="${pts(a)}" fill="${w}"/>` })
  for (const x of ROADS_X) { const w = x === 0 ? 7 : 4.5; road([[x - w, -30, 0], [x + w, -30, 0], [x + w, 400, 0], [x - w, 400, 0]], x === 0 ? '#353a45' : '#2b3039') }
  for (const y of ROADS_Y) { const w = y === TURN_Y ? 6 : 4; road([[-200, y - w, 0], [200, y - w, 0], [200, y + w, 0], [-200, y + w, 0]], y === TURN_Y ? '#353a45' : '#2b3039') }
}

function box(polys: Poly[], c: V3, s: V3, color: string, light = true) {
  const [x, y, z] = c, [w, l, h] = s
  const v = (dx: number, dy: number, dz: number): V3 => [x + dx * w / 2, y + dy * l / 2, z + dz * h]
  const faces: [V3[], V3][] = [
    [[v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)], [0, 0, 1]],
    [[v(-1, -1, 0), v(1, -1, 0), v(1, -1, 1), v(-1, -1, 1)], [0, -1, 0]],
    [[v(1, -1, 0), v(1, 1, 0), v(1, 1, 1), v(1, -1, 1)], [1, 0, 0]],
    [[v(-1, 1, 0), v(-1, -1, 0), v(-1, -1, 1), v(-1, 1, 1)], [-1, 0, 0]],
    [[v(1, 1, 0), v(-1, 1, 0), v(-1, 1, 1), v(1, 1, 1)], [0, 1, 0]],
  ]
  const sun = norm([-0.5, -0.6, 0.9])
  for (const [f, n] of faces) {
    const center: V3 = [f.reduce((a, p) => a + p[0], 0) / 4, f.reduce((a, p) => a + p[1], 0) / 4, f.reduce((a, p) => a + p[2], 0) / 4]
    if (dot(n, sub(CAM, center)) <= 0) continue // back face
    const k = light ? (dot(n, sun) * 0.18) - 0.05 : (n[2] > 0 ? 0.1 : -0.15)
    const z = depth(f)
    polys.push({ z, svg: `<polygon points="${pts(f)}" fill="${fog(shade(color, k), z)}"/>` })
  }
}

function city(polys: Poly[]) {
  let i = 0
  const xs = [-200, ...ROADS_X, 200], ys = [-30, ...ROADS_Y, 400]
  for (let a = 0; a < xs.length - 1; a++) for (let b = 0; b < ys.length - 1; b++) {
    const x0 = xs[a] + 9, x1 = xs[a + 1] - 9, y0 = ys[b] + 8, y1 = ys[b + 1] - 8
    if (x1 - x0 < 6 || y1 - y0 < 6) continue
    // a block splits into two or three houses of different heights
    const n = x1 - x0 > 40 ? 3 : 2
    for (let k = 0; k < n; k++) {
      const bx0 = x0 + ((x1 - x0) / n) * k + 1.5, bx1 = x0 + ((x1 - x0) / n) * (k + 1) - 1.5
      // low near the route, taller toward the edges: the street stays open
      const h = 3 + rnd(++i) * (Math.abs(xs[a]) > 100 ? 14 : 7)
      box(polys, [(bx0 + bx1) / 2, (y0 + y1) / 2, 0], [bx1 - bx0, y1 - y0 - 2, h], '#2a2f38')
    }
  }
}

// the route: a ribbon on the road, so it narrows with distance like the street
function route(polys: Poly[]) {
  const path: V3[] = []
  for (let y = 4; y <= TURN_Y - 14; y += 4) path.push([0, y, 0.05])
  for (let t = 0; t <= 1.0001; t += 0.1) { const a = t * Math.PI / 2; path.push([14 - 14 * Math.cos(a), TURN_Y - 14 + 14 * Math.sin(a), 0.05]) }
  for (let x = 18; x <= 200; x += 6) path.push([x, TURN_Y, 0.05])
  const ribbon = (w: number, color: string, z: number) => {
    const L: V3[] = [], Rr: V3[] = []
    for (let i = 0; i < path.length; i++) {
      const p = path[i], q = path[Math.min(i + 1, path.length - 1)], o = path[Math.max(i - 1, 0)]
      const d = norm([q[0] - o[0], q[1] - o[1], 0]); const nx = -d[1], ny = d[0]
      L.push([p[0] + nx * w, p[1] + ny * w, p[2]]); Rr.push([p[0] - nx * w, p[1] - ny * w, p[2]])
    }
    polys.push({ z, svg: `<polygon points="${pts([...L, ...Rr.reverse()])}" fill="${color}"/>` })
  }
  ribbon(2.5, '#163a57', 1e6 - 2)
  ribbon(1.6, '#4fb4ff', 1e6 - 3)
  const [mx, my] = project([0, TURN_Y - 6, 0.1])
  polys.push({ z: 1e6 - 4, svg: `<circle class="dv-turn-dot" cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="5" fill="#f5a524" stroke="#1d2026" stroke-width="2.5"/>` })
}

const BODY: Record<Body, { L: number; cab: number; cy: number; bed: boolean }> = {
  compact: { L: 4.0, cab: 2.0, cy: -0.3, bed: false },
  sedan: { L: 4.6, cab: 2.1, cy: -0.1, bed: false },
  pickup: { L: 4.8, cab: 1.7, cy: 0.6, bed: true },
}

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

// the car seen from behind and above, a little larger than life so it reads at a glance
export function carParts(polys: Poly[], color: string, body: Body, at: V3 = [0, 0, 0], k = 1.45) {
  const b = BODY[body]
  const P = (x: number, y: number, z: number): V3 => [at[0] + x * k, at[1] + y * k, at[2] + z * k]
  const glass = '#1d2636'
  const local: Poly[] = []
  for (const s of [-1, 1]) for (const wy of [b.L / 2 - 0.85, -b.L / 2 + 0.85]) prism(local, P(s * 0.9, wy, 0), [0.3 * k, 0.7 * k], [0.3 * k, 0.7 * k], 0.6 * k, { top: '#16181c', side: '#0f1114' })
  prism(local, P(0, 0, 0.22), [1.86 * k, b.L * k], [1.78 * k, (b.L - 0.25) * k], 0.5 * k, { top: color, side: shade(color, -0.12) })
  prism(local, P(0, -b.L / 2 + 0.02, 0.2), [1.8 * k, 0.16 * k], [1.8 * k, 0.16 * k], 0.22 * k, { top: '#1a1c21', side: '#15171b' })
  for (const s of [-1, 1]) prism(local, P(s * 0.6, -b.L / 2 - 0.01, 0.5), [0.42 * k, 0.05 * k], [0.42 * k, 0.05 * k], 0.14 * k, { top: '#ff6b72', side: '#ff4a52' })
  prism(local, P(0, b.cy, 0.72), [1.66 * k, b.cab * k], [1.4 * k, b.cab * 0.62 * k], 0.48 * k, { top: color, side: glass, ends: glass }, -0.08 * k)
  if (b.bed) prism(local, P(0, -b.L / 2 + 0.78, 0.72), [1.6 * k, 1.35 * k], [1.6 * k, 1.35 * k], 0.02 * k, { top: '#202329', side: '#202329' })
  // the car always draws above the road and in its own depth order
  local.sort((a, b2) => b2.z - a.z)
  const [sx, sy] = project([at[0], at[1] - 0.2 * k, 0])
  polys.push({ z: -1, svg: `<g class="dv-car3d"><ellipse cx="${sx.toFixed(1)}" cy="${(sy + 3).toFixed(1)}" rx="${(15 * k).toFixed(1)}" ry="${(5 * k).toFixed(1)}" fill="#000" opacity=".4"/>${local.map((p) => p.svg).join('')}</g>` })
}

export function map3d(color = '#3D7BFF', body: Body = 'compact') {
  const polys: Poly[] = []
  ground(polys)
  city(polys)
  route(polys)
  carParts(polys, color, body, [0, 2, 0])
  // the ring under the car shows while Ась talks; CSS turns it on
  const [rx, ry] = project([0, 2 - 0.4, 0.05])
  const ring = '<ellipse class="dv-ai-ring" cx="' + rx.toFixed(1) + '" cy="' + ry.toFixed(1) + '" rx="36" ry="11" fill="rgb(79 180 255 / .14)" stroke="rgb(143 208 255 / .85)" stroke-width="2"/>'
  polys.sort((a, b) => b.z - a.z)
  const carAt = polys.findIndex((p) => p.svg.includes('dv-car3d'))
  polys.splice(carAt, 0, { z: 0, svg: ring })
  const [, hy] = project([0, 900, 0])
  return `<svg class="dv-map3d" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
<defs><linearGradient id="dvsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#151922"/><stop offset="1" stop-color="${HAZE}"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="#1d2026"/><rect width="${W}" height="${Math.max(0, hy + 2).toFixed(1)}" fill="url(#dvsky)"/>
${polys.map((p) => p.svg).join('')}</svg>`
}
