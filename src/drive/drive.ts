import { Cat, type Mood } from './cat'

// #/drive — flow 5 of the Figma page: the drive mode on Ась's own screen, entered from the menu.
// chat → menu → «В дорогу» → Поехали → Готов → Слушаю → Ищу → Отвечаю (parts) → Готов,
// branches: Пауза (tap the answer), Микрофон выключен (tap Ась), exit with the «В дороге ✕» chip.

type State = 'go' | 'ready' | 'listen' | 'think' | 'answer' | 'pause' | 'muted'

const I = {
  menu: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16M4 16h16"/></svg>`,
  compose: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/><path d="M17.5 4.5l2 2-7 7H10v-2.5l7.5-6.5z"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
  mic: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>`,
  wave: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10v4M9.5 7v10M13 9v6M16.5 6v12M20 10v4"/></svg>`,
  car: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16v-4l2-5h10l2 5v4M5 16h14M5 16v2M19 16v2M7.5 13.5h1M15.5 13.5h1"/></svg>`,
  close: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>`,
  search: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/></svg>`,
  stop: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>`,
  play: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6l10 6-10 6z"/></svg>`,
}

interface View { h: string; sub?: string; btn?: { text: string; icon?: string; kind: 'primary' | 'secondary' }; mood: Mood; parts?: boolean }

const VIEW: Record<State, View> = {
  go: { h: 'Поехали', sub: 'Я на связи, говорите', mood: 'speak' },
  ready: { h: 'Скажите «Привет, Ась»', sub: 'или нажмите кнопку', btn: { text: 'Спросить', icon: I.mic, kind: 'primary' }, mood: 'calm' },
  listen: { h: 'Слушаю', btn: { text: 'Отмена', kind: 'secondary' }, mood: 'listen' },
  think: { h: 'Ставка ЦБ', sub: 'ищу ответ', btn: { text: 'Стоп', icon: I.stop, kind: 'primary' }, mood: 'think' },
  answer: { h: 'Отвечаю', btn: { text: 'Стоп', icon: I.stop, kind: 'primary' }, mood: 'speak', parts: true },
  pause: { h: 'Пауза', sub: 'скажите «дальше» или нажмите', btn: { text: 'Дальше', icon: I.play, kind: 'primary' }, mood: 'calm', parts: true },
  muted: { h: 'Микрофон выключен', sub: 'Ась не слушает, пока не включите', btn: { text: 'Включить микрофон', icon: I.mic, kind: 'primary' }, mood: 'off' },
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
    this.root.innerHTML = `
<div class="dv-phone">
  <section class="dv-chat" aria-label="Чат">
    <header class="dv-top">
      <button class="dv-round" data-act="menu" aria-label="Меню">${I.menu}</button>
      <span class="dv-slot" aria-hidden="true"></span>
      <button class="dv-round" aria-label="Новый чат">${I.compose}</button>
    </header>
    <h1 class="dv-hello">Чем помочь?</h1>
    <div class="dv-sugg">
      <button class="dv-card"><b>Новости дня</b><span>коротко</span></button>
      <button class="dv-card"><b>Ставка ЦБ</b><span>что дальше</span></button>
    </div>
    <div class="dv-input">
      <button class="dv-ghost" aria-label="Добавить">${I.plus}</button>
      <span class="dv-field">Спросите Ась</span>
      <button class="dv-ghost" aria-label="Диктовка">${I.mic}</button>
      <button class="dv-voice" aria-label="Голос">${I.wave}</button>
    </div>
  </section>
  <div class="dv-scrim" data-act="close"></div>
  <nav class="dv-menu" aria-label="Меню" aria-hidden="true">
    <div class="dv-search">${I.search}<span>Поиск по разговорам</span></div>
    <button class="dv-row">${I.compose}<span>Новый чат</span></button>
    <button class="dv-row dv-row--drive" data-act="drive"><i class="dv-row-ico">${I.car}</i><span><b>В дорогу</b><small>голос за рулём, карта остаётся на экране</small></span></button>
    <p class="dv-label">Разговоры</p>
    <button class="dv-row dv-row--chat"><span><b>Ставка ЦБ · Half-Life 3</b><small>в дороге · сегодня, 10:42</small></span></button>
    <button class="dv-row dv-row--chat"><span><b>Напомнить Сергею про пилот</b><small>сегодня, 09:15</small></span></button>
    <button class="dv-row dv-row--chat"><span><b>Тарифы на интернет</b><small>вчера</small></span></button>
  </nav>
  <section class="dv-drive" aria-label="В дороге" aria-hidden="true">
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
    if (this.root.dataset.mode !== 'drive') return
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
  }

  private enter() {
    this.menu(false)
    const slot = this.q<HTMLElement>('.dv-slot').getBoundingClientRect()
    const ph = this.q<HTMLElement>('.dv-phone').getBoundingClientRect()
    this.root.style.setProperty('--ox', `${slot.left + slot.width / 2 - ph.left}px`)
    this.root.style.setProperty('--oy', `${slot.top + slot.height / 2 - ph.top}px`)
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
    this.swapText(v.h, s === 'answer' || s === 'pause' ? `часть ${this.part + 1} из ${PARTS}` : v.sub ?? '')
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
      if (this.part >= PARTS) {
        this.go('ready')
        this.swapText('Можно уточнить', '8 секунд без «Привет, Ась»')
        this.later(8000, () => this.state === 'ready' && this.swapText(VIEW.ready.h, VIEW.ready.sub ?? ''))
        return
      }
      this.swapText('Отвечаю', `часть ${this.part + 1} из ${PARTS}`)
      this.playPart()
    })
  }

  private paintParts() {
    const bars = [...this.root.querySelectorAll<HTMLElement>('.dv-parts b')]
    bars.forEach((b, i) => {
      const done = i < this.part
      const now = i === this.part && this.state === 'answer'
      b.style.transition = 'none'
      b.style.transform = `scaleX(${done ? 1 : i === this.part ? this.partDone / PART_MS : 0})`
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
    const put = () => { hEl.textContent = h; sEl.textContent = sub; hEl.classList.toggle('is-long', h.length > 14) }
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

  // the cat lives in one element and flies between the chat header and the drive orb
  private placeCat(animate: boolean) {
    const ph = this.q<HTMLElement>('.dv-phone').getBoundingClientRect()
    const drive = this.root.dataset.mode === 'drive'
    const target = this.q<HTMLElement>(drive ? '.dv-orb' : '.dv-slot').getBoundingClientRect()
    const size = this.q<HTMLElement>('.dv-orb').getBoundingClientRect().width * 0.62
    const tSize = drive ? size : target.width
    const el = this.cat.el
    el.style.width = el.style.height = `${size}px`
    el.classList.toggle('is-fly', animate && !this.still)
    el.style.setProperty('--x', `${target.left - ph.left + target.width / 2 - size / 2}px`)
    el.style.setProperty('--y', `${target.top - ph.top + target.height / 2 - size / 2}px`)
    el.style.setProperty('--s', String(tSize / size))
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
