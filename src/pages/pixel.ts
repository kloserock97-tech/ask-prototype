// Pixel faces for Dynamic Island / Live Activity: an 11×9 speech bubble,
// eyes are holes in it (the black island shows through).

const BASE = ['...#####...', '.#########.', '###########', '###########', '###########', '.#########.', '..#######..', '.##........', '#..........']
const SOS = ['...#####...', '.####.####.', '#####.#####', '#####.#####', '#####.#####', '.#########.', '..###.###..', '.##........', '#..........']
const HOLES: Record<string, [number, number][]> = {
  idle: [[2, 3], [3, 3], [2, 7], [3, 7]],
  listen: [[2, 3], [3, 3], [2, 7], [3, 7]],
  think: [[1, 4], [2, 4], [1, 8], [2, 8]],
  speak: [[2, 3], [3, 2], [3, 4], [2, 7], [3, 6], [3, 8], [4, 5]],
  pause: [[3, 2], [3, 3], [3, 7], [3, 8]],
  unsure: [[2, 3], [3, 3], [3, 7], [4, 5], [4, 6]],
}
const EXTRA: Record<string, [number, number][]> = { think: [[0, 9], [0, 10], [1, 10]] }

export function pixelFace(state: string, px = 4, color = '#2F3BFF'): string {
  let rects = ''
  if (state === 'sos') {
    SOS.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') rects += `<rect x="${c * px}" y="${r * px}" width="${px}" height="${px}" fill="#FF5A1F"/>` }))
  } else {
    const hole = new Set((HOLES[state] ?? []).map(([r, c]) => `${r}_${c}`))
    const col = state === 'pause' ? '#9A9DB8' : color
    BASE.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#' && !hole.has(`${r}_${c}`)) rects += `<rect x="${c * px}" y="${r * px}" width="${px}" height="${px}" fill="${col}"/>` }))
    for (const [r, c] of EXTRA[state] ?? []) rects += `<rect x="${c * px}" y="${r * px}" width="${px}" height="${px}" fill="#8C95FF"/>`
  }
  return `<svg width="${11 * px}" height="${9 * px}" viewBox="0 0 ${11 * px} ${9 * px}" aria-hidden="true" shape-rendering="crispEdges">${rects}</svg>`
}
