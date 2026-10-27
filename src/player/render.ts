// Builds the DOM of one voice screen from its data.
import type { Block, Control, Screen } from '../data/screens'
import { icon } from '../ui/icons'

const IMG = (name: string) => `./img/${name}.webp`
const POSE_IMG: Record<string, string> = {
  idle: 'ask-idle', listen: 'ask-listen', think: 'ask-glow', speak: 'ask-speak', unsure: 'ask-unsure', pause: 'ask-pause',
}
const PROP_IMG: Record<string, string> = {
  doc: 'prop-doc', rumor: 'prop-rumor', bookmark: 'prop-bookmark', mug: 'prop-mug', antenna: 'prop-antenna', barrier: 'prop-barrier',
}
const POSE_ALT: Record<string, string> = {
  idle: 'ась ждёт', listen: 'ась слушает', think: 'ась думает, светится изнутри', speak: 'ась говорит', unsure: 'ась не уверен', pause: 'ась на паузе, глаза закрыты',
}

export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string) => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html !== undefined) e.innerHTML = html
  return e
}

function block(b: Block): HTMLElement {
  switch (b.t) {
    case 'label': return el('div', 'b-label', b.text)
    case 'line': return el('div', 'b-line', b.text)
    case 'status': return el('div', 'b-status', b.text)
    case 'note': return el('div', 'b-note', b.text)
    case 'figure': {
      const f = el('div', 'b-figure')
      if (b.size) f.dataset.size = b.size
      if (b.accent) f.dataset.accent = ''
      if (b.img) {
        const im = new Image()
        im.src = IMG(b.img)
        im.alt = b.text
        im.decoding = 'async'
        f.append(im)
      } else f.textContent = b.text
      return f
    }
    case 'src': {
      const s = el('div', 'b-src', b.text)
      if (b.quiet) s.dataset.quiet = ''
      return s
    }
    case 'scale': {
      const s = el('div', 'b-scale')
      s.setAttribute('role', 'img')
      s.setAttribute('aria-label', 'достоверность: ' + ['факт', 'вероятно', 'слух'][b.active])
      for (let i = 0; i < 3; i++) {
        const x = el('span')
        if (i === b.active) x.dataset.on = ''
        s.append(x)
      }
      return s
    }
    case 'dots': {
      const d = el('div', 'b-dots')
      d.setAttribute('aria-label', `${b.active + 1} из ${b.total}`)
      for (let i = 0; i < b.total; i++) {
        const x = el('span')
        if (i <= b.active) x.dataset.on = ''
        if (i === b.active) x.dataset.cur = ''
        d.append(x)
      }
      return d
    }
    case 'split':
      return el('div', 'b-split', '<b>14%</b><b>13,75%</b><span>пауза</span><span>снижение</span><div class="bar" aria-label="мнения банков: 40 на 60"><i></i><i></i></div>')
    case 'gap': {
      const g = el('div')
      g.style.height = b.h + 'px'
      return g
    }
  }
}

export function control(c: Control): HTMLButtonElement {
  const b = el('button', 'pill press') as HTMLButtonElement
  b.dataset.kind = c.kind
  if (c.grow) b.dataset.grow = ''
  if (c.go) b.dataset.go = c.go
  if (c.kind === 'glass' || c.kind === 'stop' || c.kind === 'close') b.classList.add('glass')
  if (c.kind === 'stop') {
    b.append(el('span', 'sq'))
    b.setAttribute('aria-label', 'стоп')
  } else if (c.kind === 'close') {
    b.innerHTML = icon.close
    b.setAttribute('aria-label', 'выйти из режима')
  } else {
    if (c.kind === 'mic') b.insertAdjacentHTML('beforeend', icon.mic)
    if (c.label) b.append(document.createTextNode(c.label))
  }
  return b
}

export type Built = {
  root: HTMLElement
  mascot?: HTMLElement
  content: HTMLElement
  controls: HTMLElement
  rays?: HTMLElement
  figureImg?: HTMLImageElement
}

export function buildVoice(s: Screen): Built {
  const root = el('div', 'scr')
  root.dataset.id = s.id
  let mascot: HTMLElement | undefined
  if (s.pose) {
    mascot = el('div', 'mascot')
    const im = new Image()
    im.src = IMG(POSE_IMG[s.pose])
    im.alt = POSE_ALT[s.pose]
    im.className = 'breath'
    mascot.append(im)
    root.append(mascot)
  }
  if (s.prop) {
    const p = el('div', 'prop')
    const im = new Image()
    im.src = IMG(PROP_IMG[s.prop])
    im.alt = ''
    p.append(im)
    root.append(p)
  }
  if (s.hero === 'sos') {
    root.append(el('div', 'sos', `<svg viewBox="0 0 240 240" aria-hidden="true"><circle cx="120" cy="120" r="110" stroke="rgba(255,255,255,.12)" stroke-width="14" fill="none"/><circle class="ring" cx="120" cy="120" r="110" stroke="var(--hot)" stroke-width="14" stroke-linecap="round" fill="none"/></svg><b>5</b>`))
  }
  let rays: HTMLElement | undefined
  if (s.event) {
    rays = el('div', 'rays')
    root.prepend(rays)
  }
  const chip = el('div', 'chip glass', `<i data-dot="${s.chip.dot}"></i><span>${s.chip.label}</span>`)
  chip.setAttribute('role', 'status')
  root.append(chip)

  const content = el('div', 'content')
  for (const b of s.content) content.append(block(b))
  root.append(content)

  const controls = el('div', 'controls')
  if (s.vertical) controls.dataset.vertical = ''
  for (const c of s.controls) controls.append(control(c))
  root.append(controls)
  const n = s.vertical ? s.controls.length : 1
  root.style.setProperty('--ctrl-h', `${112 * n + 12 * (n - 1)}px`)

  return { root, mascot, content, controls, rays, figureImg: content.querySelector('.b-figure img') ?? undefined }
}
