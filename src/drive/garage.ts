import { STICKERS, sticker, type StickerId } from './stickers'

// Ась's car: chosen in the garage (only while parked). On the map it is the 3D SVG car (map3d.ts),
// in the garage a generated picture per body (public/car/gen-*.webp), recoloured by a filter.

export type Body = 'compact' | 'sedan' | 'pickup'
type Slot = 'hood' | 'door'
type Tab = 'body' | 'color' | 'stickers'

export const BODIES: { id: Body; name: string }[] = [
  { id: 'compact', name: 'Капля' },
  { id: 'sedan', name: 'Седан' },
  { id: 'pickup', name: 'Пикап' },
]
// all read on the dark map; no black or navy, they sink into it.
// `f` turns the blue picture into this colour (the base paint is #3D7BFF)
export const COLORS = [
  { id: 'blue', name: 'Небо', hex: '#3D7BFF', f: 'none' },
  { id: 'mint', name: 'Мята', hex: '#3DD9B0', f: 'hue-rotate(-70deg) saturate(0.8) brightness(1.3)' },
  { id: 'yellow', name: 'Лимон', hex: '#FFC83D', f: 'hue-rotate(190deg) saturate(1.5) brightness(1.8)' },
  { id: 'orange', name: 'Мандарин', hex: '#FF8A3D', f: 'hue-rotate(160deg) saturate(1.6) brightness(1.35)' },
  { id: 'red', name: 'Коралл', hex: '#E5484D', f: 'hue-rotate(135deg) saturate(1.1) brightness(1.08)' },
  { id: 'pink', name: 'Фламинго', hex: '#FF7AB8', f: 'hue-rotate(108deg) saturate(0.75) brightness(1.35)' },
  { id: 'violet', name: 'Сирень', hex: '#9B6BFF', f: 'hue-rotate(32deg) saturate(0.9) brightness(1.12)' },
  { id: 'white', name: 'Снег', hex: '#F5F6F8', f: 'saturate(0) brightness(1.7)' },
]

// the visit's car; a reload starts with a blue «Капля» and no stickers
export const car = {
  body: 'compact' as Body,
  color: 'blue',
  slots: { hood: null, door: null } as Record<Slot, StickerId | null>,
  earned: new Set<StickerId>(),
  fresh: new Set<StickerId>(),
}

export const carSrc = (view: 'top' | 'gen') => (view === 'gen' ? `./car/gen-${car.body}.webp` : `./car/top-${car.body}-${car.color}.webp`)

// hood and door corners (top-left, top-right, bottom-right, bottom-left) in the garage picture, 0..1, measured by hand.
// The roof is a thin sliver from this angle, so the stickers go on the two big flat panels
const QUADS: Record<Body, Record<Slot, number[][]>> = {
  compact: { hood: [[0.3125, 0.426], [0.516, 0.439], [0.5, 0.523], [0.25, 0.498]], door: [[0.617, 0.42], [0.711, 0.4], [0.719, 0.566], [0.625, 0.586]] },
  sedan: { hood: [[0.305, 0.434], [0.547, 0.453], [0.4375, 0.547], [0.172, 0.512]], door: [[0.59, 0.453], [0.672, 0.434], [0.68, 0.596], [0.597, 0.621]] },
  pickup: { hood: [[0.32, 0.445], [0.54, 0.469], [0.47, 0.566], [0.18, 0.531]], door: [[0.547, 0.453], [0.669, 0.434], [0.675, 0.586], [0.553, 0.609]] },
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

// a round sticker sits inside the panel, not on its edge
function inset(q: number[][], k: number) {
  const cx = q.reduce((a, p) => a + p[0], 0) / 4, cy = q.reduce((a, p) => a + p[1], 0) / 4
  return q.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k])
}

// the car on top, one sheet below; the segmented control swaps what the sheet holds instead of stacking three sections
export class Garage {
  readonly el: HTMLElement
  private ro: ResizeObserver
  private tab: Tab = 'body'
  constructor(private onClose: () => void) {
    this.el = document.createElement('section')
    this.el.className = 'dv-garage'
    this.el.setAttribute('aria-label', 'Гараж')
    this.el.setAttribute('aria-hidden', 'true')
    this.el.innerHTML = `
<div class="dv-status" aria-hidden="true"><b>9:41</b><span><i class="dv-sig"></i><i class="dv-bat"></i></span></div>
<header class="dv-gtop"><button class="dv-round" data-g="close" aria-label="Назад"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button><h2>Гараж</h2><span></span></header>
<div class="dv-ghero"><div class="dv-gpic"><img alt=""><i data-slot="hood"></i><i data-slot="door"></i></div><p class="dv-gcname"></p></div>
<div class="dv-gsheet">
  <div class="dv-gseg" role="tablist" aria-label="Что меняем">
    <button role="tab" data-tab="body">Кузов</button><button role="tab" data-tab="color">Цвет</button><button role="tab" data-tab="stickers">Наклейки<span class="dv-gcount"></span></button>
  </div>
  <div class="dv-gpane" data-pane="body"><div class="dv-gbodies">${BODIES.map((b) => `<button role="radio" data-body="${b.id}"><img alt="" src="./car/gen-${b.id}.webp"><b>${b.name}</b></button>`).join('')}</div></div>
  <div class="dv-gpane" data-pane="color"><div class="dv-gcolors" role="radiogroup" aria-label="Цвет">${COLORS.map((c) => `<button role="radio" data-color="${c.id}" aria-label="${c.name}" style="--c:${c.hex}"></button>`).join('')}</div></div>
  <div class="dv-gpane" data-pane="stickers"><div class="dv-ggrid">${STICKERS.map((s) => `<button data-st="${s.id}" aria-label="${s.name}: ${s.how}"><span class="dv-gst">${s.svg}</span><b>${s.name}</b><small>${s.how}</small></button>`).join('')}</div></div>
</div>`
    this.el.addEventListener('click', (e) => this.click(e))
    this.ro = new ResizeObserver(() => this.paintSlots())
    this.ro.observe(this.q('.dv-gpic'))
  }

  private q<T extends Element = HTMLElement>(s: string) { return this.el.querySelector(s) as T }

  open(tab: Tab = car.fresh.size ? 'stickers' : 'body') {
    this.tab = tab
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
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-g], [data-tab], [data-body], [data-color], [data-st]')
    if (!t) return
    if (t.dataset.g === 'close') { this.close(); this.onClose(); return }
    if (t.dataset.tab) this.tab = t.dataset.tab as Tab
    if (t.dataset.body) car.body = t.dataset.body as Body
    if (t.dataset.color) car.color = t.dataset.color
    if (t.dataset.st) {
      const id = t.dataset.st as StickerId
      if (!car.earned.has(id)) return
      const at = (Object.keys(car.slots) as Slot[]).find((k) => car.slots[k] === id)
      if (at) car.slots[at] = null
      else if (!car.slots.hood) car.slots.hood = id
      else car.slots.door = id
    }
    this.render()
  }

  render() {
    const col = COLORS.find((c) => c.id === car.color)!
    const img = this.q<HTMLImageElement>('.dv-gpic img')
    img.src = carSrc('gen')
    img.style.filter = col.f
    this.q('.dv-gcname').textContent = `${BODIES.find((b) => b.id === car.body)!.name} · ${col.name}`
    this.q('.dv-gcount').textContent = car.earned.size ? ` ${car.earned.size}` : ''
    for (const b of this.el.querySelectorAll<HTMLElement>('[data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === this.tab))
    for (const p of this.el.querySelectorAll<HTMLElement>('[data-pane]')) p.hidden = p.dataset.pane !== this.tab
    for (const b of this.el.querySelectorAll<HTMLElement>('[data-body]')) {
      b.setAttribute('aria-checked', String(b.dataset.body === car.body))
      b.querySelector('img')!.style.filter = col.f
    }
    for (const b of this.el.querySelectorAll<HTMLElement>('[data-color]')) b.setAttribute('aria-checked', String(b.dataset.color === car.color))
    // earned first, the rest after with the condition under the name
    const grid = this.q('.dv-ggrid')
    const btns = [...grid.querySelectorAll<HTMLButtonElement>('[data-st]')]
    btns.sort((a, b) => Number(car.earned.has(b.dataset.st as StickerId)) - Number(car.earned.has(a.dataset.st as StickerId))).forEach((b) => grid.append(b))
    for (const b of btns) {
      const id = b.dataset.st as StickerId
      b.classList.toggle('is-locked', !car.earned.has(id))
      b.classList.toggle('is-on', Object.values(car.slots).includes(id))
      b.classList.toggle('is-fresh', car.fresh.has(id))
      b.setAttribute('aria-disabled', String(!car.earned.has(id)))
    }
    this.paintSlots()
  }

  private paintSlots() {
    const box = this.q('.dv-gpic')
    const w = box.clientWidth, h = box.clientHeight
    if (!w) return
    for (const el of box.querySelectorAll<HTMLElement>('[data-slot]')) {
      const slot = el.dataset.slot as Slot
      const id = car.slots[slot]
      el.innerHTML = id ? sticker(id).svg : ''
      if (!id) continue
      const q = inset(QUADS[car.body][slot], slot === 'hood' ? 0.7 : 0.78).map(([x, y]) => [x * w, y * h])
      el.style.transform = matrixTo(100, q)
    }
  }
}
