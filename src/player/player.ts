import { SCENARIOS, SCREENS, scenarioOf, type Screen } from '../data/screens'
import { Glass } from '../gl/glass'
import { EASE_OUT, enter, reduced, spring, springIn } from '../motion'
import { icon } from '../ui/icons'
import * as voice from '../voice'
import { buildPark } from './park'
import { buildVoice, el } from './render'

export class Player {
  readonly stage = el('div', 'stage')
  private device = el('div', 'device')
  private side = el('aside', 'side')
  private sheet = el('div', 'sheet')
  private glass: Glass
  private current?: Screen
  private layer?: HTMLElement
  private auto = false
  private autoToken = 0
  private swiped = false
  private sosTimer = 0

  constructor(private go: (hash: string) => void) {
    const canvas = el('canvas', 'glass-canvas') as HTMLCanvasElement
    canvas.setAttribute('aria-hidden', 'true')
    this.device.append(canvas, el('div', 'veil'))
    const menu = el('button', 'menu-btn glass press', icon.menu)
    menu.setAttribute('aria-label', 'меню прототипа')
    menu.addEventListener('click', () => this.openSheet(true))
    this.device.append(menu)
    this.stage.append(this.device, this.side)
    document.body.append(this.sheet)
    this.glass = new Glass(canvas)
    this.bindGestures()
    this.device.addEventListener('click', (e) => this.onClick(e))
    this.side.addEventListener('click', (e) => this.onClick(e))
    this.sheet.addEventListener('click', (e) => this.onClick(e))
    addEventListener('keydown', (e) => {
      if (!this.stage.isConnected) return
      if (e.key === 'ArrowRight') this.step(1)
      if (e.key === 'ArrowLeft') this.step(-1)
      if (e.key === 'Escape') this.openSheet(false)
    })
  }

  get currentId() {
    return this.current?.id
  }

  // ---------------------------------------------------------------- show
  show(id: string, dir = 0) {
    const s = SCREENS[id] ?? SCREENS.A1
    const prev = this.current
    this.current = s
    clearInterval(this.sosTimer)
    voice.stop()

    this.device.dataset.mode = s.mode
    document.documentElement.dataset.mode = s.mode
    this.device.toggleAttribute('data-has-prop', !!s.prop)
    this.device.toggleAttribute('data-tall', s.content.some((b) => b.t === 'figure' && !!b.img) || s.id === 'A6')
    this.glass.set(s.mode, s.kind === 'park' ? 'off' : s.glow)

    const old = this.layer
    if (old) {
      // exit is quicker than enter; a little blur hides the overlap of two states
      const a = old.animate(
        reduced()
          ? [{ opacity: 1 }, { opacity: 0 }]
          : [{ opacity: 1, filter: 'blur(0px)', transform: 'none' }, { opacity: 0, filter: 'blur(6px)', transform: `translateX(${dir * -18}px)` }],
        { duration: 160, easing: EASE_OUT, fill: 'forwards' },
      )
      a.onfinish = () => old.remove()
    }

    if (s.kind === 'park') {
      const p = buildPark()
      this.layer = p
      this.device.append(p)
      enter(p, 60, 24)
      p.querySelectorAll('.p-row').forEach((r, i) => enter(r, 140 + i * 50))
    } else {
      const b = buildVoice(s)
      this.layer = b.root
      this.device.insertBefore(b.root, this.device.querySelector('.menu-btn'))
      const sameMascot = prev && prev.pose && s.pose && prev.kind !== 'park'
      if (b.mascot) {
        b.mascot.animate(
          reduced()
            ? [{ opacity: 0 }, { opacity: 1 }]
            : sameMascot
              ? [{ opacity: 0, filter: 'blur(8px)' }, { opacity: 1, filter: 'blur(0px)' }]
              : [{ opacity: 0, transform: 'translateY(16px) scale(0.94)' }, { opacity: 1, transform: 'none' }],
          { duration: sameMascot ? 220 : 380, easing: EASE_OUT, fill: 'both' },
        )
      }
      const chip = b.root.querySelector('.chip')!
      enter(chip, 40, 8)
      if (s.event) this.answerEvent(b)
      else [...b.content.children].forEach((c, i) => enter(c, 80 + i * 40))
      ;[...b.controls.children].forEach((c, i) => enter(c, 160 + i * 40, 16))
      if (s.hero === 'sos') this.sosCountdown(b.root)
    }

    this.renderSide()
    history.replaceState(null, '', `#/p/${s.id}`)
    if (voice.isOn() && !this.auto) this.speak()
  }

  /** ответ как событие: a fan of light (0–150 ms), the card on a spring, the figure overshoots */
  private answerEvent(b: ReturnType<typeof buildVoice>) {
    const items = [...b.content.children] as HTMLElement[]
    if (reduced()) {
      items.forEach((c) => c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, fill: 'both' }))
      return
    }
    const night = this.device.dataset.mode === 'night'
    b.rays?.animate(
      [
        { opacity: 0, transform: 'scale(0.7) rotate(-6deg)' },
        { opacity: night ? 0.5 : 0.95, transform: 'scale(1) rotate(0deg)', offset: 0.3 },
        { opacity: 0, transform: 'scale(1.25) rotate(4deg)' },
      ],
      { duration: 520, easing: EASE_OUT, fill: 'both' },
    )
    const card = spring(300, 22)
    items.forEach((c, i) => springIn(c, 'translateY(40px)', 150 + i * 35, card))
    if (b.figureImg) {
      const fig = spring(420, 18)
      b.figureImg.animate([{ transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: fig.duration, delay: 200, easing: fig.easing, fill: 'both' })
    }
    if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(8)
  }

  private sosCountdown(root: HTMLElement) {
    const ring = root.querySelector<SVGCircleElement>('.ring')
    const num = root.querySelector('.sos b')!
    let n = 5
    ring?.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: 690 }], { duration: 5000, easing: 'linear', fill: 'forwards' })
    this.sosTimer = window.setInterval(() => {
      n = n > 1 ? n - 1 : 5
      num.textContent = String(n)
      if (n === 5) ring?.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: 690 }], { duration: 5000, easing: 'linear', fill: 'forwards' })
    }, 1000)
  }

  // ---------------------------------------------------------------- navigation
  private step(d: number) {
    const sc = scenarioOf(this.current!.id)
    const i = sc.screens.indexOf(this.current!.id)
    const j = i + d
    if (j >= 0 && j < sc.screens.length) this.show(sc.screens[j], d)
  }

  private resolve(go: string) {
    if (go === 'next') return this.step(1)
    if (go === 'prev') return this.step(-1)
    if (go === 'home') return this.go('#/screens')
    if (go.startsWith('#')) return this.go(go)
    const from = scenarioOf(this.current!.id).screens.indexOf(this.current!.id)
    const to = scenarioOf(go).screens.indexOf(go)
    this.show(go, scenarioOf(go) === scenarioOf(this.current!.id) && to < from ? -1 : 1)
  }

  private onClick(e: Event) {
    if (this.swiped) return
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-go],[data-act]')
    if (!t) return
    if (t.dataset.act) return this.act(t.dataset.act, t)
    this.stopAuto()
    this.openSheet(false)
    this.resolve(t.dataset.go!)
  }

  private act(a: string, t: HTMLElement) {
    if (a === 'sound') {
      voice.setOn(!voice.isOn())
      this.renderSide()
      if (voice.isOn()) this.speak()
    } else if (a === 'auto') {
      this.auto ? this.stopAuto() : this.startAuto()
    } else if (a === 'close-sheet') this.openSheet(false)
    else if (a === 'scenario') {
      const sc = SCENARIOS.find((x) => x.id === t.dataset.sc)!
      this.stopAuto()
      this.show(sc.screens[0], 1)
    } else if (a === 'prev') this.step(-1)
    else if (a === 'next') this.step(1)
  }

  private bindGestures() {
    let x0 = 0, y0 = 0, active = false
    this.device.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('.p-scroll')) return
      active = true
      x0 = e.clientX
      y0 = e.clientY
      this.swiped = false
    })
    this.device.addEventListener('pointerup', (e) => {
      if (!active) return
      active = false
      const dx = e.clientX - x0, dy = e.clientY - y0
      if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        this.swiped = true
        this.stopAuto()
        this.step(dx < 0 ? 1 : -1)
        setTimeout(() => (this.swiped = false), 50)
      }
    })
  }

  // ---------------------------------------------------------------- voice + autoplay
  private async speak() {
    const s = this.current!
    await voice.say(s.voice, () => this.glass.bump())
  }

  private async startAuto() {
    this.auto = true
    if (!voice.isOn()) voice.setOn(true)
    this.renderSide()
    const token = ++this.autoToken
    const sc = scenarioOf(this.current!.id)
    let i = sc.screens.indexOf(this.current!.id)
    if (i === sc.screens.length - 1) i = 0
    this.openSheet(false)
    for (; i < sc.screens.length; i++) {
      if (token !== this.autoToken) return
      this.show(sc.screens[i], 1)
      const t0 = performance.now()
      await voice.say(SCREENS[sc.screens[i]].voice, () => this.glass.bump())
      const wait = Math.max(0, 2200 - (performance.now() - t0))
      await new Promise((r) => setTimeout(r, wait))
    }
    if (token === this.autoToken) this.stopAuto()
  }

  private stopAuto() {
    if (!this.auto) return
    this.auto = false
    this.autoToken++
    voice.stop()
    this.renderSide()
  }

  // ---------------------------------------------------------------- side panel (desktop) and sheet (phone)
  private panelHTML(compact: boolean) {
    const s = this.current!
    const sc = scenarioOf(s.id)
    const i = sc.screens.indexOf(s.id)
    const tabs = SCENARIOS.map(
      (x) => `<button class="tab press" data-act="scenario" data-sc="${x.id}" ${x.id === sc.id ? 'aria-current="true"' : ''}>${x.title}</button>`,
    ).join('')
    const steps = sc.screens
      .map((id) => `<button class="stepbtn press" data-go="${id}" ${id === s.id ? 'aria-current="true"' : ''}><b>${id}</b>${SCREENS[id].title}</button>`)
      .join('')
    return `
      <div class="tabs">${tabs}</div>
      <div class="now">
        <p class="code">${s.id} · ${i + 1} из ${sc.screens.length}</p>
        <h2>${s.title}</h2>
        <p class="lbl">голос</p><p class="voice">${s.voice}</p>
        <p class="lbl">зачем так</p><p class="why">${s.note}</p>
      </div>
      <div class="toolbar">
        <button class="tool press" data-act="prev" aria-label="назад" ${i === 0 ? 'disabled' : ''}>${icon.prev}</button>
        <button class="tool wide press" data-act="auto">${this.auto ? icon.pause + 'стоп' : icon.play + 'показать с голосом'}</button>
        <button class="tool press" data-act="sound" aria-label="${voice.isOn() ? 'выключить голос' : 'включить голос'}">${voice.isOn() ? icon.sound : icon.mute}</button>
        <button class="tool press" data-act="next" aria-label="дальше" ${i === sc.screens.length - 1 ? 'disabled' : ''}>${icon.next}</button>
      </div>
      ${compact ? '' : `<div class="steps">${steps}</div>`}
      <nav class="links">
        <a href="#/">приложение</a><a href="#/screens">концепт</a><a href="#/flow">user flow</a><a href="#/island">вне приложения</a><a href="#/guide">гайд</a>
      </nav>`
  }

  private renderSide() {
    if (!this.current) return
    this.side.innerHTML = this.panelHTML(false)
    if (this.sheet.classList.contains('open')) this.fillSheet()
  }

  private fillSheet() {
    const s = this.current!
    const sc = scenarioOf(s.id)
    this.sheet.innerHTML = `<div class="sheet-scrim" data-act="close-sheet"></div>
      <div class="sheet-body" role="dialog" aria-label="меню прототипа">
        <div class="grab"></div>
        ${this.panelHTML(true)}
        <div class="steps">${sc.screens
          .map((id) => `<button class="stepbtn press" data-go="${id}" ${id === s.id ? 'aria-current="true"' : ''}><b>${id}</b>${SCREENS[id].title}</button>`)
          .join('')}</div>
      </div>`
  }

  private openSheet(open: boolean) {
    if (open) {
      this.sheet.classList.add('open')
      this.fillSheet()
    } else if (this.sheet.classList.contains('open')) {
      const body = this.sheet.querySelector('.sheet-body')
      this.sheet.classList.add('closing')
      setTimeout(() => this.sheet.classList.remove('open', 'closing'), body ? 200 : 0)
    }
  }

  mount(parent: HTMLElement, id: string) {
    parent.replaceChildren(this.stage)
    this.layer?.remove()
    this.layer = undefined
    this.current = undefined
    this.show(id)
  }

  unmount() {
    this.stopAuto()
    voice.stop()
    clearInterval(this.sosTimer)
    this.openSheet(false)
  }
}
