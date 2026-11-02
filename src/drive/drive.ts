import { Cat, type Mood } from './cat'

// #/drive — flow 5 of the Figma page (46:2, screens 5.1–5.11), entered from the menu (8.1 + a «В дорогу» row).
// chat → ≡ → «В дорогу» → 5.1 tap Ась → (first time: 5.6 sheet → 5.7–5.10 system alerts → 5.11)
// → 5.2 Карты, Ась in the island asks «Куда едем?» → 5.3 dictation → 5.4 the address flows into Карты → 5.5 navigation.

type State = 'ready' | 'perms' | 'intro' | 'ask' | 'dictate' | 'handoff' | 'nav'
type Perm = 'mic' | 'speech' | 'geo' | 'notif'
type Grant = 'need' | 'ok' | 'off'

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
  turn: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 20v-7a4 4 0 0 1 4-4h8M15 5l4 4-4 4" stroke-width="2.5"/></svg>`,
}

// the map: our own street grid, the route over the main road and the puck, 390 × 844 like the Figma navigator
const MAP = (() => {
  const xs = [-20, 70, 270, 360], ys = [120, 300, 470, 640, 800]
  const streets = xs.map((x) => `<rect x="${x}" y="-20" width="12" height="900"/>`).join('') + ys.map((y) => `<rect x="-20" y="${y}" width="430" height="12"/>`).join('')
  const road = 'M195 900V430C195 340 228 300 290 262L430 176'
  return `<svg class="dv-map-svg" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<rect width="390" height="844" fill="#1d2026"/><g fill="#272b33">${streets}</g>
<path d="${road}" stroke="#30353f" stroke-width="26" fill="none"/><path d="${road}" stroke="#3a404b" stroke-width="14" fill="none"/>
<path class="dv-route-case" d="${road}" pathLength="1" stroke="#163a57" stroke-width="18" fill="none" stroke-linecap="round"/>
<path class="dv-route" d="${road}" pathLength="1" stroke="#4fb4ff" stroke-width="10" fill="none" stroke-linecap="round"/>
<circle class="dv-route-dot" cx="195" cy="420" r="7" fill="#f5a524" stroke="#1d2026" stroke-width="3"/></svg>`
})()

const PERMS: { k: Perm; t: string; sub: string; title: string; msg: string; btns: string[] }[] = [
  { k: 'mic', t: 'Микрофон', sub: 'слышать адрес и вопросы', title: 'Приложение «Ась» запрашивает доступ к микрофону', msg: 'Чтобы слышать адрес и вопросы, пока вы за рулём', btns: ['Не разрешать', 'Разрешить'] },
  { k: 'speech', t: 'Распознавание речи', sub: 'понимать, что вы сказали', title: 'Приложение «Ась» запрашивает доступ к распознаванию речи', msg: 'Чтобы понимать адрес и вопросы без рук. Речь обрабатывается для распознавания', btns: ['Не разрешать', 'Разрешить'] },
  { k: 'geo', t: 'Геопозиция', sub: 'маршрут от того места, где вы сейчас', title: 'Разрешить приложению «Ась» использовать вашу геопозицию?', msg: 'Чтобы строить маршрут от того места, где вы сейчас', btns: ['Однократно', 'При использовании приложения', 'Не разрешать'] },
  { k: 'notif', t: 'Уведомления', sub: 'Ась над Картами и подсказки в пути', title: 'Приложение «Ась» запрашивает разрешение на отправку уведомлений', msg: 'Уведомления могут содержать предупреждения, звуки и наклейки. Их можно настроить в Настройках', btns: ['Не разрешать', 'Разрешить'] },
]

// what the phone already allowed lives for the whole visit: the second trip skips the sheet, a reload starts over
const granted: Record<Perm, Grant> = { mic: 'need', speech: 'need', geo: 'need', notif: 'need' }

const ADDRESS = 'В Пулково, терминал 1'
const PLACE = 'Пулково, терминал 1'

// Dynamic Island geometry in phone pixels: the cat sits in a slot on its left
const ISL = {
  open: { top: 12, h: 84, pad: 16, cat: 52 },
  compact: { top: 12, h: 37, w: 168, pad: 7, cat: 24 },
}

export class DrivePage {
  readonly root: HTMLDivElement
  private cat = new Cat()
  private q = <T extends Element>(s: string) => this.root.querySelector(s) as T
  private state: State | null = null
  private timers: number[] = []
  private raf = 0
  private ro: ResizeObserver
  private still = matchMedia('(prefers-reduced-motion: reduce)').matches
  private onKey = (e: KeyboardEvent) => this.key(e)
  private island: 'off' | 'open' | 'compact' = 'off'

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
    <div class="dv-head" aria-live="polite"><h2 class="dv-h is-long"></h2></div>
    <button class="dv-orb" data-act="orb" aria-label="Ась: открыть Карты и проложить маршрут">
      <span class="dv-ring"></span><span class="dv-ring"></span>
    </button>
    <p class="dv-note">Дальше я в островке над Картами. Адрес передам туда сам, Карты сразу поведут по маршруту</p>
  </section>
  <section class="dv-maps" aria-label="Карты" aria-hidden="true">
    ${status('is-dark')}
    <div class="dv-map">${MAP}<i class="dv-puck"></i></div>
    <div class="dv-mbtns" aria-hidden="true"><i>+</i><i>−</i><i>◎</i></div>
    <div class="dv-man"><span class="dv-man-ic">${I.turn}</span><span><b>300 м</b><small>на Пулковское шоссе</small></span></div>
    <div class="dv-speed" aria-hidden="true"><i>90</i><span><b>87</b> км/ч</span></div>
    <div class="dv-msheet">
      <div class="dv-msearch">${I.search}<span class="dv-mq">Поиск в Картах</span></div>
      <div class="dv-mrecent"><span>Дом</span><span>Работа</span><span>Пулково</span></div>
      <div class="dv-mroute"><b>${PLACE}</b><small>34 мин · 28 км · через Пулковское ш.</small><i><b></b></i><small>Включаю ведение</small></div>
    </div>
    <div class="dv-eta"><span><b>13:27</b><small>34 мин · 28 км</small></span><button class="dv-eta-btn" tabindex="-1">Обзор</button></div>
  </section>
  <div class="dv-isl" data-act="island" aria-live="polite">
    <span class="dv-isl-text"><small></small><b></b></span>
    <span class="dv-isl-wave" aria-hidden="true">${'<i></i>'.repeat(5)}</span>
    <button class="dv-isl-end" data-act="end">Завершить</button>
    <span class="dv-isl-right"></span>
  </div>
  <div class="dv-sdim"></div>
  <div class="dv-sheet" role="dialog" aria-modal="true" aria-label="Разрешения" aria-hidden="true">
    <i class="dv-grip" aria-hidden="true"></i>
    <h3 class="dv-sh-t"></h3>
    <p class="dv-sh-s"></p>
    <ul class="dv-perms">${PERMS.map((p) => `<li data-k="${p.k}"><span><b>${p.t}</b><small>${p.sub}</small></span><em></em></li>`).join('')}</ul>
    <button class="dv-btn dv-btn--primary" data-act="sheet-go"></button>
    <button class="dv-btn" data-act="sheet-later">Позже</button>
  </div>
  <div class="dv-adim"></div>
  <div class="dv-alert" role="alertdialog" aria-modal="true" aria-hidden="true"></div>
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
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')
    const a = el?.dataset.act
    if (!a) return
    if (a === 'menu') this.menu(true)
    else if (a === 'close') this.menu(false)
    else if (a === 'drive') this.enter()
    else if (a === 'exit') this.exit()
    else if (a === 'orb') this.orb()
    else if (a === 'sheet-go') this.sheetGo()
    else if (a === 'sheet-later') this.sheet(false)
    else if (a === 'alert') this.answer(el!.dataset.k as Perm, el!.dataset.yes === '1')
    else if (a === 'end') { e.stopPropagation(); this.exit('Поездка закончилась, «В дороге» выключен') }
    else if (a === 'island') this.islandTap()
  }

  private key(e: KeyboardEvent) {
    const mode = this.root.dataset.mode
    if (mode === 'chat') {
      if (e.key === 'Escape') this.menu(false)
      return
    }
    if (this.state === 'perms') return // the sheet and the alerts take keys through their buttons
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      if (this.state === 'ready') this.orb()
      else if (this.state === 'nav') this.islandTap()
    }
    if (e.key === 'Escape') this.exit()
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
    this.mode('drive')
    this.go('ready')
    this.placeCat(true)
  }

  private exit(msg = 'Режим «В дороге» выключен') {
    this.clear()
    this.state = null
    this.root.dataset.state = ''
    this.sheet(false)
    this.setIsland('off')
    this.mode('chat')
    this.cat.set('calm')
    this.placeCat(true)
    this.toast(msg)
    window.setTimeout(() => this.resetMaps(), 420)
  }

  private mode(m: 'chat' | 'drive' | 'maps') {
    this.root.dataset.mode = m
    this.q('.dv-chat').setAttribute('aria-hidden', String(m !== 'chat'))
    this.q('.dv-drive').setAttribute('aria-hidden', String(m !== 'drive'))
    this.q('.dv-maps').setAttribute('aria-hidden', String(m !== 'maps'))
  }

  // 5.1: Ась is the button. Everything allowed → straight to Карты, otherwise the sheet first
  private orb() {
    if (this.state !== 'ready') return
    if (PERMS.every((p) => granted[p.k] === 'ok')) this.openMaps()
    else this.sheet(true)
  }

  // ---------- states ----------
  private go(s: State) {
    this.clear()
    this.state = s
    this.root.dataset.state = s
    const mood: Record<State, Mood> = { ready: 'calm', perms: 'calm', intro: 'speak', ask: 'listen', dictate: 'listen', handoff: 'speak', nav: 'calm' }
    this.cat.set(mood[s])
    if (s === 'ready') this.swapText('Нажмите на Ась\nили позовите голосом')
    if (s === 'intro') {
      this.swapText('Открою Карты\nи спрошу, куда едем')
      this.later(3200, () => this.openMaps())
    }
    if (s === 'ask') {
      this.islandText('Слушаю', 'Куда едем?')
      this.setIsland('open')
      this.later(2400, () => this.go('dictate'))
    }
    if (s === 'dictate') this.dictate()
    if (s === 'handoff') this.handoff()
    if (s === 'nav') {
      this.q('.dv-maps').classList.add('is-nav')
      this.islandRight('34 мин')
      this.setIsland('compact')
    }
  }

  private openMaps() {
    this.mode('maps')
    this.go('ask')
    this.placeCat(true)
  }

  // 5.3: the transcript types itself out in the island
  private dictate() {
    this.islandText('Куда едем?', '')
    const b = this.q<HTMLElement>('.dv-isl-text b')
    b.classList.add('is-typing')
    let i = 0
    const step = () => {
      b.textContent = ADDRESS.slice(0, ++i)
      if (i < ADDRESS.length) this.later(this.still ? 0 : 55, step)
      else this.later(800, () => { b.classList.remove('is-typing'); this.go('handoff') })
    }
    this.later(300, step)
  }

  // 5.4: Ась folds into the compact island, the address flies down into the Карты search and the route draws
  private handoff() {
    const from = this.q<HTMLElement>('.dv-isl-text b').getBoundingClientRect()
    this.islandRight('передаю')
    this.setIsland('compact')
    const maps = this.q<HTMLElement>('.dv-maps')
    const field = this.q<HTMLElement>('.dv-mq')
    const ph = this.q<HTMLElement>('.dv-phone').getBoundingClientRect()
    const to = field.getBoundingClientRect()
    const fly = document.createElement('span')
    fly.className = 'dv-fly'
    fly.textContent = PLACE
    fly.style.left = `${from.left - ph.left}px`
    fly.style.top = `${from.top - ph.top}px`
    this.q('.dv-phone').append(fly)
    const land = () => {
      fly.remove()
      field.textContent = PLACE
      maps.classList.add('is-route')
      this.later(1900, () => this.go('nav'))
    }
    if (this.still) { land(); return }
    const dx = to.left - from.left, dy = to.top - from.top
    const a = fly.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1, filter: 'blur(0)' },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5}px) scale(0.92)`, opacity: 0.85, filter: 'blur(1px)', offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.85)`, opacity: 1, filter: 'blur(0)' },
      ],
      { duration: 560, easing: 'cubic-bezier(0.77, 0, 0.175, 1)', fill: 'forwards' },
    )
    a.onfinish = land
  }

  private islandTap() {
    if (this.state !== 'nav') return
    if (this.island === 'open') { this.setIsland('compact'); return }
    this.islandText(PLACE, '34 мин')
    this.setIsland('open', true)
    this.later(6000,() => { if (this.state === 'nav') this.setIsland('compact') })
  }

  // ---------- permissions: our sheet (5.6), then the system alerts (5.7–5.10) ----------
  private sheet(open: boolean, title = 'Ась в дороге', sub = 'Нужно четыре разрешения. Телефон спросит по очереди, один раз и пока вы стоите', go = 'Разрешить по очереди') {
    this.root.classList.toggle('is-sheet', open)
    this.q('.dv-sheet').setAttribute('aria-hidden', String(!open))
    if (!open) {
      this.alert(null)
      if (this.state === 'perms') this.go('ready')
      return
    }
    this.state = 'perms'
    this.root.dataset.state = 'perms'
    this.q('.dv-sh-t').textContent = title
    this.q('.dv-sh-s').textContent = sub
    this.q('[data-act="sheet-go"]').textContent = go
    this.paintPerms()
    this.q<HTMLElement>('[data-act="sheet-go"]').focus({ preventScroll: true })
  }

  private paintPerms() {
    for (const li of this.root.querySelectorAll<HTMLElement>('.dv-perms li')) {
      const g = granted[li.dataset.k as Perm]
      li.dataset.g = g
      li.querySelector('em')!.textContent = g === 'ok' ? 'есть' : g === 'off' ? 'выключено' : 'нужно'
    }
  }

  private sheetGo() {
    // 5.E1 → «Открыть Настройки»: in the stand the switch flips as if the person came back from Настройки
    const off = PERMS.find((p) => (p.k === 'mic' || p.k === 'speech') && granted[p.k] === 'off')
    if (off) {
      granted[off.k] = 'ok'
      this.toast(`${off.t}: включено в Настройках`)
      this.sheet(true)
      return
    }
    this.next()
  }

  private next() {
    const p = PERMS.find((x) => granted[x.k] === 'need')
    if (!p) {
      this.sheet(false)
      this.go('intro')
      return
    }
    this.later(this.still ? 0 : 240, () => this.alert(p))
  }

  private alert(p: (typeof PERMS)[number] | null) {
    const box = this.q<HTMLElement>('.dv-alert')
    this.root.classList.toggle('is-alert', !!p)
    box.setAttribute('aria-hidden', String(!p))
    if (!p) return
    const geo = p.k === 'geo'
    const yes = (i: number) => (geo ? i < 2 : i === 1)
    box.className = `dv-alert${geo ? ' is-stack' : ''}`
    box.innerHTML = `<div class="dv-al-text"><b>${p.title}</b><span>${p.msg}</span></div>${geo ? `<div class="dv-al-map">${MAP}<i class="dv-puck"></i><em>Точно: вкл.</em></div>` : ''}<div class="dv-al-btns">${p.btns.map((b, i) => `<button data-act="alert" data-k="${p.k}" data-yes="${yes(i) ? 1 : 0}"${i === (geo ? 1 : p.btns.length - 1) ? ' class="is-main"' : ''}>${b}</button>`).join('')}</div>`
    box.querySelector<HTMLElement>('.is-main')?.focus({ preventScroll: true })
  }

  private answer(k: Perm, yes: boolean) {
    granted[k] = yes ? 'ok' : 'off'
    this.alert(null)
    this.paintPerms()
    // without the microphone or speech Ась cannot hear the address: 5.E1, the only way back is Настройки
    if (!yes && (k === 'mic' || k === 'speech')) {
      const t = k === 'mic' ? 'Микрофон выключен' : 'Распознавание речи выключено'
      this.sheet(true, 'Ась не услышит адрес', `${t}. Включите в Настройках, это один переключатель`, 'Открыть Настройки')
      return
    }
    this.next()
  }

  // ---------- island ----------
  private setIsland(s: 'off' | 'open' | 'compact', withEnd = false) {
    this.island = s
    const el = this.q<HTMLElement>('.dv-isl')
    el.dataset.s = s
    el.classList.toggle('has-end', withEnd)
    if (this.root.dataset.mode === 'maps') this.placeCat('morph')
  }

  private islandText(label: string, main: string) {
    this.q('.dv-isl-text small').textContent = label
    this.q('.dv-isl-text b').textContent = main
  }

  private islandRight(text: string) {
    this.q('.dv-isl-right').textContent = text
  }

  private resetMaps() {
    if (this.root.dataset.mode === 'maps') return
    const maps = this.q<HTMLElement>('.dv-maps')
    maps.classList.remove('is-route', 'is-nav')
    this.q('.dv-mq').textContent = 'Поиск в Картах'
  }

  // ---------- helpers ----------
  private clear() {
    this.timers.forEach(clearTimeout)
    this.timers = []
  }

  private later(ms: number, fn: () => void) {
    this.timers.push(window.setTimeout(fn, ms))
  }

  private swapText(h: string) {
    const head = this.q<HTMLElement>('.dv-head')
    const hEl = this.q<HTMLElement>('.dv-h')
    if (hEl.textContent === h) return
    if (this.still || !hEl.textContent) { hEl.textContent = h; return }
    head.classList.add('is-out')
    window.setTimeout(() => { hEl.textContent = h; head.classList.remove('is-out') }, 160)
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

  // the cat lives in one element and flies between the chat header, the drive orb and the island over Карты
  private placeCat(animate: boolean | 'slide' | 'morph') {
    const ph = this.q<HTMLElement>('.dv-phone').getBoundingClientRect()
    const mode = this.root.dataset.mode
    const orb = this.q<HTMLElement>('.dv-orb').getBoundingClientRect()
    const size = orb.width * (125 / 220) // the cat inside the 220 orb is 125, as in Figma
    let x: number, y: number, s: number
    if (mode === 'drive') {
      x = orb.left - ph.left + orb.width / 2 - size / 2
      y = orb.top - ph.top + orb.height / 2 - size / 2 + orb.width * (4 / 220)
      s = 1
    } else if (mode === 'maps') {
      // the island's final geometry, not its animated one: the cat and the island morph together
      const g = this.island === 'compact' ? ISL.compact : ISL.open
      const left = this.island === 'compact' ? (ph.width - ISL.compact.w) / 2 : 10
      x = left + g.pad + g.cat / 2 - size / 2
      y = g.top + g.h / 2 - size / 2
      s = g.cat / size
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
    el.classList.toggle('is-morph', animate === 'morph' && !this.still)
    el.style.setProperty('--x', `${x}px`)
    el.style.setProperty('--y', `${y}px`)
    el.style.setProperty('--s', String(s))
  }

  // a stand-in for the voice level: syllable-like bursts while someone talks
  private voiceLoop(t: number) {
    const s = this.state
    let lvl = 0
    if (s === 'intro' || s === 'ask' || s === 'dictate' || s === 'handoff') {
      const syl = Math.max(0, Math.sin(t / 95)) * (0.55 + 0.45 * Math.sin(t / 410))
      lvl = Math.min(1, syl * (s === 'ask' ? 0.35 : 0.9))
    }
    this.cat.voice(lvl)
    // set on the two elements that use it, not the root: a root variable restyles the whole tree every frame
    this.q<HTMLElement>('.dv-orb').style.setProperty('--amp', lvl.toFixed(3))
    this.q<HTMLElement>('.dv-isl').style.setProperty('--amp', lvl.toFixed(3))
    this.raf = requestAnimationFrame(this.voiceLoop)
  }
}
