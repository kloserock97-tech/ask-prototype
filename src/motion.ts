// Motion helpers. Springs are solved once and baked into a CSS linear() curve,
// so they run through WAAPI off the main thread instead of a JS loop per frame.

export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches

export const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'
export const EASE_IN_OUT = 'cubic-bezier(0.77, 0, 0.175, 1)'

type Spring = { easing: string; duration: number }
const cache = new Map<string, Spring>()

/** damped spring from 0 to 1, sampled into linear(); duration = time to settle */
export function spring(stiffness = 300, damping = 22, mass = 1): Spring {
  const key = `${stiffness}/${damping}/${mass}`
  const hit = cache.get(key)
  if (hit) return hit
  const dt = 1 / 120
  let x = 0, v = 0, t = 0
  const pts: number[] = []
  let still = 0
  while (t < 3) {
    const a = (-stiffness * (x - 1) - damping * v) / mass
    v += a * dt
    x += v * dt
    t += dt
    pts.push(x)
    still = Math.abs(x - 1) < 0.001 && Math.abs(v) < 0.01 ? still + 1 : 0
    if (still > 6) break
  }
  const step = Math.max(1, Math.floor(pts.length / 60))
  const sampled = pts.filter((_, i) => i % step === 0)
  sampled[sampled.length - 1] = 1
  const out = { easing: `linear(0, ${sampled.map((p) => +p.toFixed(4)).join(', ')})`, duration: Math.round(t * 1000) }
  cache.set(key, out)
  return out
}

/** enter: fade + small rise; exit is always faster than enter */
export function enter(el: Element, delay = 0, rise = 12) {
  if (reduced()) return el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, delay, fill: 'both' })
  return el.animate(
    [{ opacity: 0, transform: `translateY(${rise}px)` }, { opacity: 1, transform: 'translateY(0)' }],
    { duration: 260, delay, easing: EASE_OUT, fill: 'both' },
  )
}

export function springIn(el: Element, from: string, delay = 0, s = spring(300, 22)) {
  if (reduced()) return el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, delay, fill: 'both' })
  return el.animate(
    [{ opacity: 0, transform: from }, { opacity: 1, transform: 'none' }],
    { duration: s.duration, delay, easing: s.easing, fill: 'both' },
  )
}
