import { STICKERS, sticker, type StickerId } from './stickers'

// Ась's car: chosen in the garage (only while parked), shown instead of the arrow in Карты.
// Renders are our own Blender model (public/car): top view for the map, a 3/4 view for the garage.

export type Body = 'compact' | 'sedan' | 'pickup'
type Slot = 'roof' | 'hood'

export const BODIES: { id: Body; name: string }[] = [
  { id: 'compact', name: 'Капля' },
  { id: 'sedan', name: 'Седан' },
  { id: 'pickup', name: 'Пикап' },
]
// all read on the dark map; no black or navy, they sink into it
export const COLORS = [
  { id: 'blue', name: 'Небо', hex: '#3D7BFF' },
  { id: 'mint', name: 'Мята', hex: '#3DD9B0' },
  { id: 'yellow', name: 'Лимон', hex: '#FFC83D' },
  { id: 'orange', name: 'Мандарин', hex: '#FF8A3D' },
  { id: 'red', name: 'Коралл', hex: '#E5484D' },
  { id: 'pink', name: 'Фламинго', hex: '#FF7AB8' },
  { id: 'violet', name: 'Сирень', hex: '#9B6BFF' },
  { id: 'white', name: 'Снег', hex: '#F5F6F8' },
]

// the visit's car; a reload starts with a blue «Капля» and no stickers
export const car = {
  body: 'compact' as Body,
  color: 'blue',
  slots: { roof: null, hood: null } as Record<Slot, StickerId | null>,
  earned: new Set<StickerId>(),
  fresh: new Set<StickerId>(),
}

export const carSrc = (view: 'top' | 'hero') => `./car/${view}-${car.body}-${car.color}.webp`

// roof and hood corners in the hero image (0..1), projected from the Blender camera (scratchpad quads.py)
const QUADS: Record<Body, Record<Slot, number[][]>> = {
  compact: { roof: [[0.6225, 0.3767], [0.4738, 0.4295], [0.3199, 0.3667], [0.467, 0.3214]], hood: [[0.7884, 0.5328], [0.6312, 0.6058], [0.547, 0.567], [0.7045, 0.4994]] },
  sedan: { roof: [[0.6399, 0.3967], [0.4917, 0.4513], [0.3416, 0.3889], [0.4885, 0.342]], hood: [[0.8338, 0.558], [0.6771, 0.6346], [0.5637, 0.5819], [0.721, 0.5129]] },
  pickup: { roof: [[0.7194, 0.3871], [0.5629, 0.4461], [0.437, 0.3959], [0.5931, 0.3436]], hood: [[0.8462, 0.5386], [0.6826, 0.6174], [0.6282, 0.5926], [0.7923, 0.5176]] },
}

// a square of side s mapped onto four points: the projective transform as a CSS matrix3d
function matrixTo(s: number, q: number[][]) {
  const src = [[0, 0], [s, 0], [s, s], [0, s]]
  const A: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = q[i]
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u)
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v)
  }
  // Gaussian elimination on the 8 × 8 system
  for (let c = 0; c < 8; c++) {
    let p = c
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r
    ;[A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]]
    for (let r = 0; r < 8; r++) {
      if (r === c) continue
      const f = A[r][c] / A[c][c]
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]
      b[r] -= f * b[c]
    }
  }
  const h = b.map((v, i) => v / A[i][i])
  return `matrix3d(${h[0]},${h[3]},0,${h[6]},${h[1]},${h[4]},0,${h[7]},0,0,1,0,${h[2]},${h[5]},0,1)`
}

// shrink a slot toward its centre, so a round sticker sits inside the panel, not on its edge
function inset(q: number[][], k: number) {
  const cx = q.reduce((a, p) => a + p[0], 0) / 4, cy = q.reduce((a, p) => a + p[1], 0) / 4
  return q.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k])
}

export class Garage {
  readonly el: HTMLElement
  private ro: ResizeObserver
  constructor(private onClose: () => void) {
    this.el = document.createElement('section')
    this.el.className = 'dv-garage'
    this.el.setAttribute('aria-label', 'Гараж')
    this.el.setAttribute('aria-hidden', 'true')
    this.el.innerHTML = `
<div class="dv-status" aria-hidden="true"><b>9:41</b><span><i class="dv-sig"></i><i class="dv-bat"></i></span></div>
<header class="dv-gtop"><button class="dv-round" data-g="close" aria-label="Назад"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button><h2>Гараж</h2><span class="dv-gcount"></span></header>
<div class="dv-gscroll">
  <div class="dv-ghero"><img alt=""><i data-slot="roof"></i><i data-slot="hood"></i></div>
  <p class="dv-gnote">Машинку меняем только на стоянке. На карте она без наклеек, чтобы не отвлекать</p>
  <div class="dv-gseg" role="radiogroup" aria-label="Кузов">${BODIES.map((b) => `<button role="radio" data-body="${b.id}">${b.name}</button>`).join('')}</div>
  <div class="dv-gcolors" role="radiogroup" aria-label="Цвет">${COLORS.map((c) => `<button role="radio" data-color="${c.id}" aria-label="${c.name}" style="--c:${c.hex}"></button>`).join('')}</div>
  <p class="dv-gcname"></p>
  <h3 class="dv-gh">Наклейки</h3>
  <p class="dv-gsub">Нажмите на свою, она встанет на крышу, следующая на капот</p>
  <div class="dv-ggrid">${STICKERS.map((s) => `<button data-st="${s.id}"><span class="dv-gst">${s.svg}</span><b>${s.name}</b><small>${s.how}</small></button>`).join('')}</div>
</div>`
    this.el.addEventListener('click', (e) => this.click(e))
    this.ro = new ResizeObserver(() => this.paintSlots())
    this.ro.observe(this.q('.dv-ghero'))
  }

  private q<T extends Element = HTMLElement>(s: string) { return this.el.querySelector(s) as T }

  open() {
    this.el.setAttribute('aria-hidden', 'false')
    this.el.classList.add('is-open')
    this.render()
  }

  close() {
    this.el.classList.remove('is-open')
    this.el.setAttribute('aria-hidden', 'true')
    car.fresh.clear()
  }

  destroy() { this.ro.disconnect() }

  private click(e: MouseEvent) {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-g], [data-body], [data-color], [data-st]')
    if (!t) return
    if (t.dataset.g === 'close') { this.close(); this.onClose(); return }
    if (t.dataset.body) car.body = t.dataset.body as Body
    if (t.dataset.color) car.color = t.dataset.color
    if (t.dataset.st) {
      const id = t.dataset.st as StickerId
      if (!car.earned.has(id)) return
      const at = (Object.keys(car.slots) as Slot[]).find((k) => car.slots[k] === id)
      if (at) car.slots[at] = null
      else if (!car.slots.roof) car.slots.roof = id
      else car.slots.hood = id
    }
    this.render()
  }

  render() {
    this.q<HTMLImageElement>('.dv-ghero img').src = carSrc('hero')
    for (const b of this.el.querySelectorAll<HTMLElement>('[data-body]')) b.setAttribute('aria-checked', String(b.dataset.body === car.body))
    for (const b of this.el.querySelectorAll<HTMLElement>('[data-color]')) b.setAttribute('aria-checked', String(b.dataset.color === car.color))
    this.q('.dv-gcname').textContent = `${BODIES.find((b) => b.id === car.body)!.name} · ${COLORS.find((c) => c.id === car.color)!.name}`
    this.q('.dv-gcount').textContent = `${car.earned.size} из ${STICKERS.length}`
    for (const b of this.el.querySelectorAll<HTMLButtonElement>('[data-st]')) {
      const id = b.dataset.st as StickerId
      b.classList.toggle('is-locked', !car.earned.has(id))
      b.classList.toggle('is-on', Object.values(car.slots).includes(id))
      b.classList.toggle('is-fresh', car.fresh.has(id))
      b.setAttribute('aria-disabled', String(!car.earned.has(id)))
    }
    this.paintSlots()
  }

  private paintSlots() {
    const box = this.q('.dv-ghero')
    const w = box.clientWidth
    if (!w) return
    for (const el of box.querySelectorAll<HTMLElement>('[data-slot]')) {
      const slot = el.dataset.slot as Slot
      const id = car.slots[slot]
      el.innerHTML = id ? sticker(id).svg : ''
      if (!id) continue
      const raw = QUADS[car.body][slot]
      // corners as top-left, top-right, bottom-right, bottom-left of the sticker: it reads across the panel
      const q = inset([raw[2], raw[3], raw[0], raw[1]], slot === 'roof' ? 0.82 : 0.9).map(([x, y]) => [x * w, y * w])
      el.style.transform = matrixTo(100, q)
    }
  }
}
