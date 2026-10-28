// Figures set in a 5×7 dot matrix — the type of the variable message signs over
// motorways, read at 110 km/h. Dots fly in from below (where ась lives) and
// settle into the glyph; in full sun they're fat enough to fuse into a solid sign.

import { EASE_OUT, reduced } from '../motion'

const G: Record<string, string[]> = {
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  '%': ['##...', '##..#', '...#.', '..#..', '.#...', '#..##', '...##'],
  ',': ['..', '..', '..', '..', '.#', '.#', '#.'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
}

/** an inline SVG of `text` in dots; `fill` = 0..1 how much the dots fuse (1 = touching) */
export function dotFigure(text: string, label: string, fill = 0.8): SVGSVGElement {
  const cols: { x: number; y: number }[] = []
  let x = 0
  for (const ch of text) {
    const g = G[ch]
    if (!g) {
      x += 2
      continue
    }
    g.forEach((row, y) => [...row].forEach((c, i) => c === '#' && cols.push({ x: x + i, y })))
    x += g[0].length + 1
  }
  const w = x - 1
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('viewBox', `-0.5 -0.5 ${w} 7`)
  svg.setAttribute('role', 'img')
  svg.setAttribute('aria-label', label)
  svg.classList.add('dotfig')
  svg.style.setProperty('--fill', String(fill))
  for (const p of cols) {
    const c = document.createElementNS(ns, 'circle')
    c.setAttribute('cx', String(p.x))
    c.setAttribute('cy', String(p.y))
    c.setAttribute('r', String(0.5 * fill))
    svg.append(c)
  }
  return svg
}

/** dots rise from below and land column by column; ≤8 steps of stagger */
export function assemble(svg: SVGSVGElement, delay = 0) {
  if (reduced()) return
  const dots = [...svg.querySelectorAll('circle')]
  const maxX = Math.max(...dots.map((d) => +d.getAttribute('cx')!))
  dots.forEach((d) => {
    const cx = +d.getAttribute('cx')!
    const step = Math.round((cx / Math.max(1, maxX)) * 7)
    const fromX = (cx - maxX / 2) * -0.35 + (Math.sin(cx * 7.1 + +d.getAttribute('cy')! * 3.3) * 1.2)
    d.animate(
      [
        { transform: `translate(${fromX}px, 9px) scale(0.3)`, opacity: 0 },
        { opacity: 1, offset: 0.4 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 520, delay: delay + step * 28, easing: EASE_OUT, fill: 'backwards' },
    )
  })
}
