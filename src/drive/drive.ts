import { Cat, type Mood } from './cat'

// #/drive — flow 5 of the Figma page (46:2, screens 5.1–5.7), entered from the menu (8.1 + a «В дорогу» row).
// chat → ≡ → «В дорогу» → Поехали → Готов → Слушаю → Ищу → Отвечаю (parts) → Готов,
// branches: Пауза (tap the answer), Микрофон выключен (tap Ась), exit with the «В дороге ✕» chip.

type State = 'go' | 'ready' | 'listen' | 'think' | 'answer' | 'pause' | 'muted'

const I = {
  menu: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h16M4 15h16"/></svg>`,
  compose: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V12"/><path d="M17.8 3.9l2.3 2.3-7.4 7.4-3 .7.7-3z"/></svg>`,
  more: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h.01M12 12h.01M18 12h.01" stroke-width="3"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
  mic: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>`,
  wave: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10v4M8.5 7v10M12 9v6M15.5 6v12M19 10v4"/></svg>`,
  car: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16v-4l2-5h10l2 5v4M5 16h14M5 16v2M19 16v2M7.5 13.5h1M15.5 13.5h1"/></svg>`,
  close: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>`,
  search: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/></svg>`,
  sliders: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h10M18 8h2M4 16h2M10 16h10"/><circle cx="16" cy="8" r="2"/><circle cx="8" cy="16" r="2"/></svg>`,
}

interface View { h: string; sub?: string; btn?: { text: string; icon?: string; kind: 'primary' | 'secondary' }; mood: Mood }

// texts, buttons and the cat's expression per screen, as in Figma 5.1–5.7
const VIEW: Record<State, View> = {
  go: { h: 'Поехали\nЯ на связи, говорите', mood: 'listen' },
  ready: { h: 'Скажите «Привет, Ась»\nили нажмите кнопку', btn: { text: 'Спросить', icon: I.mic, kind: 'primary' }, mood: 'calm' },
  listen: { h: 'Слушаю', btn: { text: 'Отмена', kind: 'secondary' }, mood: 'listen' },
  think: { h: 'Ставка ЦБ', btn: { text: 'Стоп', icon: I.close, kind: 'primary' }, mood: 'think' },
  answer: { h: 'Отвечаю', btn: { text: 'Стоп', icon: I.close, kind: 'primary' }, mood: 'speak' },
  pause: { h: 'Пауза', sub: 'скажите «дальше» или нажмите', btn: { text: 'Дальше', kind: 'primary' }, mood: 'calm' },
  muted: { h: 'Микрофон выключен', sub: 'Ась не слушает, пока не включите', btn: { text: 'Включить микрофон', kind: 'primary' }, mood: 'calm' },
}

const PARTS = 3
const PART_MS = 2600

export class DrivePage {
  readonly root: HTMLDivElement
  private cat = new Cat()
  private q = <T extends Element>(s: string) => this.root.querySelector(s) as T
  private state: State | null = null
  private timers: number[] = []
  private part = 0
  private partStart = 0
  private partDone = 0
  private raf = 0
  private ro: ResizeObserver
  private still = matchMedia('(prefers-reduced-motion: reduce)').matches
  private onKey = (e: KeyboardEvent) => this.key(e)

  constructor() {
    this.root = document.createElement('div')
    this.root.className = 'dv'
    this.root.dataset.mode = 'chat'
    const status = (cls: string) => `<div class="dv-status ${cls}" aria-hidden="true"><b>9:41</b><span><i class="dv-sig"></i><i class="dv-bat"></i></span></div>`
    this.root.innerHTML = `
<div class="dv-phone">
  <nav class="dv-menu" aria-label="Меню" aria-hidden="true">
    <div class="dv-search">${I.search}<span>Поиск по разговорам</span></div>
    <button class="dv-row">${I.compose}<span>Новый чат</span></button>
    <button class="dv-row" data-act="drive">${I.car}<span>В дорогу</span><i class="dv-new">Новое</i></button>
    <p class="dv-label">Закреплённые</p>
    <button class="dv-item"><span>Подарок маме к 14 ноября</span></button>
    <p class="dv-label">Разговоры</p>
    <button class="dv-item"><span>Анализ встречи с Сергеем</span><small>сегодня, 12:04</small></button>
    <button class="dv-item"><span>Напомнить Сергею про пилот</span><small>сегодня, 09:15</small></button>
    <button class="dv-item"><span>Тарифы на интернет</span><small>вчера</small></button>
    <button class="dv-item"><span>Такси до офиса</span><small>вчера</small></button>
    <div class="dv-me"><i>НГ</i><span>Никита Горбачев</span>${I.sliders}</div>
  </nav>
  <section class="dv-chat" aria-label="Чат">
    ${status('')}
    <header class="dv-top">
      <button class="dv-round" data-act="menu" aria-label="Меню">${I.menu}</button>
      <span class="dv-slot" aria-hidden="true"></span>
      <span class="dv-pill"><button aria-label="Новый чат">${I.compose}</button><button aria-label="Ещё">${I.more}</button></span>
    </header>
    <h1 class="dv-hello">Чем помочь?</h1>
    <div class="dv-sugg">
      <button class="dv-card"><b>Новости дня</b><span>коротко</span></button>
      <button class="dv-card"><b>Ставка ЦБ</b><span>что дальше</span></button>
    </div>
    <div class="dv-input">
      <button class="dv-round" aria-label="Добавить">${I.plus}</button>
      <div class="dv-field"><span>Спросите Ась</span><button class="dv-mic" aria-label="Диктовка">${I.mic}</button><button class="dv-voice" aria-label="Голос">${I.wave}</button></div>
    </div>
    <div class="dv-scrim" data-act="close"></div>
  </section>
  <section class="dv-drive" aria-label="В дороге" aria-hidden="true">
    ${status('is-dark')}
    <button class="dv-chip" data-act="exit" aria-label="Выйти из режима «В дороге»">${I.car}<span>В дороге</span>${I.close}</button>
    <div class="dv-head" aria-live="polite">
      <h2 class="dv-h"></h2>
      <p class="dv-sub"></p>
      <div class="dv-parts" aria-hidden="true">${'<i><b></b></i>'.repeat(PARTS)}</div>
    </div>
    <div class="dv-orb" data-act="orb" role="button" aria-label="Ась">
      <span class="dv-ring"></span><span class="dv-ring"></span><span class="dv-ring dv-ring--arc"></span>
    </div>
    <div class="dv-dock"><button class="dv-big" data-act="big"></button></div>
  </section>
  <div class="dv-toast" role="status"></div>
</div>`
    this.q('.dv-phone').append(this.cat.el)
    this.root.addEventListener('click', (e) => this.click(e))
    addEventListener('keydown', this.onKey)
    this.ro = new ResizeObserver(() => this.placeCat(false))
    this.ro.observe(this.q('.dv-phone'))
    requestAnimationFrame(() => this.placeCat(false))
    this.voiceLoop = this.voiceLoop.bind(this)
    this.raf = requestAnimationFrame(this.voiceLoop)
    if (import.meta.env.DEV) (window as unknown as { dv: DrivePage }).dv = this // for state screenshots
  }

  destroy() {
    this.clear()
    cancelAnimationFrame(this.raf)
    this.ro.disconnect()
    this.cat.destroy()
    removeEventListener('keydown', this.onKey)
  }

  // ---------- events ----------
  private click(e: MouseEvent) {
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act
    if (!a) return
    if (a === 'menu') this.menu(true)
    else if (a === 'close') this.menu(false)
    else if (a === 'drive') this.enter()
    else if (a === 'exit') this.exit()
    else if (a === 'big') this.big()
    else if (a === 'orb') this.orb()
  }

  private key(e: KeyboardEvent) {
    if (this.root.dataset.mode !== 'drive') {
      if (e.key === 'Escape') this.menu(false)
      return
    }
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.big() }
    if (e.key === 'Escape') this.exit()
  }

  private big() {
    switch (this.state) {
      case 'ready': return this.go('listen')
      case 'listen': return this.go('ready')
      case 'think': return this.go('ready')
      case 'answer': return this.go('ready')
      case 'pause': return this.go('answer')
      case 'muted': return this.go('ready')
    }
  }

  private orb() {
    if (this.state === 'ready') this.go('muted') // stands in for «Ась, помолчи»
    else if (this.state === 'answer') this.go('pause') // a tap pauses the answer
    else if (this.state === 'pause') this.go('answer')
  }

  // ---------- menu and mode ----------
  private menu(open: boolean) {
    this.root.classList.toggle('is-menu', open)
    this.q('.dv-menu').setAttribute('aria-hidden', String(!open))
    this.placeCat('slide')
  }

  private enter() {
    this.root.classList.remove('is-menu')
    this.q('.dv-menu').setAttribute('aria-hidden', 'true')
    // the dark screen opens from where the cat sits in the header (the header after the chat slides back)
    const slot = this.slotRect()
    this.root.style.setProperty('--ox', `${slot.x + slot.w / 2}px`)
    this.root.style.setProperty('--oy', `${slot.y + slot.h / 2}px`)
    this.root.dataset.mode = 'drive'
    this.q('.dv-drive').setAttribute('aria-hidden', 'false')
    this.q('.dv-chat').setAttribute('aria-hidden', 'true')
    this.placeCat(true)
    this.go('go')
  }

  private exit() {
    this.clear()
    this.state = null
    this.root.dataset.mode = 'chat'
    this.root.dataset.state = ''
    this.q('.dv-drive').setAttribute('aria-hidden', 'true')
    this.q('.dv-chat').setAttribute('aria-hidden', 'false')
    this.cat.set('calm')
    this.placeCat(true)
    this.toast('Режим «В дороге» выключен')
  }

  // ---------- states ----------
  private go(s: State) {
    this.clear()
    const prev = this.state
    this.state = s
    this.root.dataset.state = s
    const v = VIEW[s]
    this.cat.set(v.mood)
    if (s === 'answer' && prev !== 'pause') { this.part = 0; this.partDone = 0 }
    this.swapText(v.h, s === 'answer' ? `часть ${this.part + 1} из ${PARTS}` : v.sub ?? '')
    this.button(v.btn)
    if (s === 'go') this.later(3200, () => this.go('ready'))
    if (s === 'listen') this.later(2800, () => this.go('think'))
    if (s === 'think') this.later(1700, () => this.go('answer'))
    if (s === 'answer') this.playPart()
    this.paintParts()
  }

  private playPart() {
    this.partStart = performance.now() - this.partDone
    this.later(PART_MS - this.partDone, () => {
      this.part++
      this.partDone = 0
      if (this.part >= PARTS) return this.go('ready')
      this.swapText('Отвечаю', `часть ${this.part + 1} из ${PARTS}`)
      this.playPart()
    })
  }

  private paintParts() {
    const bars = [...this.root.querySelectorAll<HTMLElement>('.dv-parts b')]
    bars.forEach((b, i) => {
      const now = i === this.part && this.state === 'answer'
      b.style.transition = 'none'
      b.style.transform = `scaleX(${i < this.part ? 1 : i === this.part ? this.partDone / PART_MS : 0})`
      if (now) {
        void b.offsetWidth
        b.style.transition = `transform ${PART_MS - this.partDone}ms linear`
        b.style.transform = 'scaleX(1)'
      }
    })
  }

  private clear() {
    if (this.state === 'answer') this.partDone = Math.min(PART_MS, performance.now() - this.partStart)
    this.timers.forEach(clearTimeout)
    this.timers = []
  }

  private later(ms: number, fn: () => void) {
    this.timers.push(window.setTimeout(() => { fn(); if (this.state === 'answer' || this.state === 'pause') this.paintParts() }, ms))
  }

  // ---------- view helpers ----------
  private swapText(h: string, sub: string) {
    const head = this.q<HTMLElement>('.dv-head')
    const hEl = this.q<HTMLElement>('.dv-h')
    const sEl = this.q<HTMLElement>('.dv-sub')
    if (hEl.textContent === h && sEl.textContent === sub) return
    // a sentence is set at 28/34 as in 5.1–5.2, a one- or two-word state at 56/60
    const put = () => { hEl.textContent = h; sEl.textContent = sub; hEl.classList.toggle('is-long', h.includes('\n')) }
    if (this.still || !hEl.textContent) { put(); return }
    head.classList.add('is-out')
    window.setTimeout(() => { put(); head.classList.remove('is-out') }, 160)
  }

  private button(b?: View['btn']) {
    const el = this.q<HTMLButtonElement>('.dv-big')
    if (!b) { el.hidden = true; return }
    el.hidden = false
    el.className = `dv-big dv-big--${b.kind}`
    el.innerHTML = `${b.icon ?? ''}<span>${b.text}</span>`
  }

  private toast(text: string) {
    const t = this.q<HTMLElement>('.dv-toast')
    t.textContent = text
    t.classList.add('is-on')
    window.setTimeout(() => t.classList.remove('is-on'), 2400)
  }

  /** The header slot in phone coordinates, as it sits when the chat is (or will be) in place or slid aside. */
  private slotRect() {
    const ph = this.q<HTMLElement>('.dv-phone').getBoundingClientRect()
    const chat = this.q<HTMLElement>('.dv-chat')
    const slot = this.q<HTMLElement>('.dv-slot').getBoundingClientRect()
    const shift = chat.getBoundingClientRect().left - ph.left // the chat may be mid-slide
    const want = this.root.classList.contains('is-menu') ? this.q<HTMLElement>('.dv-menu').offsetWidth : 0
    return { x: slot.left - ph.left - shift + want, y: slot.top - ph.top, w: slot.width, h: slot.height }
  }

  // the cat lives in one element and flies between the chat header and the drive orb
  private placeCat(animate: boolean | 'slide') {
    const ph = this.q<HTMLElement>('.dv-phone').getBoundingClientRect()
    const drive = this.root.dataset.mode === 'drive'
    const orb = this.q<HTMLElement>('.dv-orb').getBoundingClientRect()
    const size = orb.width * (125 / 220) // the cat inside the 220 orb is 125, as in Figma
    let x: number, y: number, s: number
    if (drive) {
      x = orb.left - ph.left + orb.width / 2 - size / 2
      y = orb.top - ph.top + orb.height / 2 - size / 2 + orb.width * (4 / 220)
      s = 1
    } else {
      const r = this.slotRect()
      x = r.x + r.w / 2 - size / 2
      y = r.y + r.h / 2 - size / 2
      s = r.w / size
    }
    const el = this.cat.el
    el.style.width = el.style.height = `${size}px`
    el.classList.toggle('is-fly', animate === true && !this.still)
    el.classList.toggle('is-slide', animate === 'slide' && !this.still)
    el.style.setProperty('--x', `${x}px`)
    el.style.setProperty('--y', `${y}px`)
    el.style.setProperty('--s', String(s))
  }

  // a stand-in for the microphone level: syllable-like bursts while someone talks
  private voiceLoop(t: number) {
    const s = this.state
    let lvl = 0
    if (s === 'listen' || s === 'answer') {
      const syl = Math.max(0, Math.sin(t / 95)) * (0.55 + 0.45 * Math.sin(t / 410))
      lvl = Math.min(1, syl * (s === 'answer' ? 0.9 : 1))
    }
    this.cat.voice(lvl)
    this.q<HTMLElement>('.dv-orb').style.setProperty('--amp', lvl.toFixed(3))
    this.raf = requestAnimationFrame(this.voiceLoop)
  }
}
