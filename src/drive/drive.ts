import { Cat } from './cat'
import { Garage, car, carSrc } from './garage'
import { sticker, type StickerId } from './stickers'

// #/drive — flow 5 of the Figma page (46:2), entered from the menu (8.1 + a «В дорогу» row).
// No character and no showy motion on the road: Ась is a voice, a status line in the island and big buttons.
// chat → «В дорогу» → (first time: permissions) → «Куда едем?» → the navigator with the route
// → «расскажи про ставку ЦБ» (voice, chips) → «покажи» → Ась's own screens → back to the navigator by itself
// → «что с Half-Life 3?» → «покажи» → the video app, only for a passenger. Narration pauses for manoeuvres.

type Mode = 'chat' | 'drive' | 'maps' | 'video'
type Perm = 'mic' | 'speech' | 'geo' | 'notif'
type Grant = 'need' | 'ok' | 'off'
type Topic = 'rate' | 'hl3'
type Say = 'dest' | 'rate' | 'hl3' | 'yes' | 'no' | 'show' | 'next' | 'stop' | 'passenger' | 'later' | 'route' | 'other' | 'end' | 'turn'

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
  right: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 20v-7a4 4 0 0 1 4-4h8M15 5l4 4-4 4" stroke-width="2.5"/></svg>`,
  left: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 20v-7a4 4 0 0 0-4-4H5M9 5L5 9l4 4" stroke-width="2.5"/></svg>`,
  speaker: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h3l5 4V6L7 10zM16 9.5a3.5 3.5 0 0 1 0 5"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12" stroke-width="2.5"/></svg>`,
  route: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/></svg>`,
  play: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>`,
}

// the map is a picture in the style of city map apps (generated, public/car/map-night.webp):
// the route is drawn in it, our SVG car and the interface lie on top
const MAP_SRC = './car/map-night.webp'
const MAP = `<img class="dv-mapimg" src="${MAP_SRC}" alt="" draggable="false">`

const PERMS: { k: Perm; t: string; sub: string; title: string; msg: string; btns: string[] }[] = [
  { k: 'mic', t: 'Микрофон', sub: 'слышать адрес и вопросы', title: 'Приложение «Ась» запрашивает доступ к микрофону', msg: 'Чтобы слышать адрес и вопросы, пока вы за рулём', btns: ['Не разрешать', 'Разрешить'] },
  { k: 'speech', t: 'Распознавание речи', sub: 'понимать, что вы сказали', title: 'Приложение «Ась» запрашивает доступ к распознаванию речи', msg: 'Чтобы понимать адрес и вопросы без рук. Речь обрабатывается для распознавания', btns: ['Не разрешать', 'Разрешить'] },
  { k: 'geo', t: 'Геопозиция', sub: 'маршрут и повороты, чтобы не говорить на манёврах', title: 'Разрешить приложению «Ась» использовать вашу геопозицию?', msg: 'Чтобы строить маршрут и молчать на поворотах', btns: ['Однократно', 'При использовании приложения', 'Не разрешать'] },
  { k: 'notif', t: 'Уведомления', sub: 'Ась в островке поверх навигатора', title: 'Приложение «Ась» запрашивает разрешение на отправку уведомлений', msg: 'Уведомления могут содержать предупреждения, звуки и наклейки. Их можно настроить в Настройках', btns: ['Не разрешать', 'Разрешить'] },
]

// what the phone already allowed lives for the whole visit: the second trip skips the sheet, a reload starts over
const granted: Record<Perm, Grant> = { mic: 'need', speech: 'need', geo: 'need', notif: 'need' }

// spoken answers: the prototype's recorded chunks (public/voice), each ends with one yes-question
const TALK: Record<Topic, { id: string; title: string; big: string; ask: string }[]> = {
  rate: [
    { id: 'g-rate-1', title: 'Ставка ЦБ', big: '14%', ask: 'Рассказать, от чего это зависит?' },
    { id: 'g-rate-2', title: 'Ставка ЦБ', big: 'от чего зависит', ask: 'Рассказать, что ЦБ обещает дальше?' },
    { id: 'g-rate-3', title: 'Ставка ЦБ', big: 'прогноз на 2027', ask: 'Сохранить в чат поездки?' },
  ],
  hl3: [
    { id: 'g-hl-1', title: 'Half-Life 3', big: 'слух', ask: 'Рассказать, откуда слух?' },
    { id: 'g-hl-2', title: 'Half-Life 3', big: 'Valve молчит', ask: 'Сохранить ссылки в чат поездки?' },
  ],
}

// Ась's own screen for «покажи»: the main fact on top, the rest below it the way a chat answer goes on.
// No paging: nothing to swipe while driving, the navigator comes back by itself
const SHOW = `<p class="dv-kicker">Ставка ЦБ · решение 23 октября</p>
<b class="dv-big">14%</b>
<p class="dv-line">Без изменений. Следующее решение 18 декабря</p>
<h3 class="dv-sh">На что влияет</h3>
<ul class="dv-rows"><li><b>Кредиты и ипотека</b><span>остаются дорогими</span></li><li><b>Вклады</b><span>проценты пока держатся</span></li><li><b>Цены</b><span>ЦБ сдерживает рост, цель 4%</span></li></ul>
<h3 class="dv-sh">Что дальше</h3>
<p class="dv-next"><b>12,5–13,5%</b><span>в среднем в 2027 году, прогноз ЦБ, а не решение</span></p>`
const SHOW_IDLE = 15000 // ms without a touch before the navigator returns

const TURNS = [
  { d: 800, dir: 'right' as const, to: 'на Пулковское шоссе' },
  { d: 1400, dir: 'left' as const, to: 'на КАД' },
  { d: 1600, dir: 'right' as const, to: 'к терминалу 1' },
]
const SPEED = 20 // m/s, about 72 km/h
const ZONE = 150 // m: closer than this Ась is quiet

const SAY: { k: Say; t: string; sim?: true }[] = [
  { k: 'dest', t: 'В Пулково, терминал 1' },
  { k: 'rate', t: 'Расскажи про ставку ЦБ' },
  { k: 'hl3', t: 'Что с Half-Life 3?' },
  { k: 'yes', t: 'Да' },
  { k: 'no', t: 'Нет' },
  { k: 'show', t: 'Покажи' },
  { k: 'next', t: 'Дальше' },
  { k: 'stop', t: 'Стоп' },
  { k: 'route', t: 'Верни маршрут' },
  { k: 'turn', t: 'Поворот через 150 м', sim: true },
]

interface Pop { label: string; main: string; chips?: [Say, string][]; ms?: number }

export class DrivePage {
  readonly root: HTMLDivElement
  private cat = new Cat()
  private q = <T extends Element>(s: string) => this.root.querySelector(s) as T
  private timers: number[] = []
  private ro: ResizeObserver
  private onKey = (e: KeyboardEvent) => this.key(e)
  private view: 'dest' | 'rate' = 'dest'
  private routing = false
  private turn = 0
  private dist = 0
  private quiet = false // inside a manoeuvre zone
  private toldTurn = false // «закончите поворот» is said once a trip, later pauses are silent
  private tick = 0
  private audio = new Audio()
  private topic: Topic | null = null
  private chunk = 0
  private speaking = false
  private held = false // paused for a manoeuvre, resumes by itself
  private asked = false // a yes-question is open
  private queued: (() => void) | null = null
  private popTimer = 0
  private idle = 'Ась слушает'
  private fromChat = false // the route came from a place in the chat: Карты show «◀ Ась»
  private pendingTrip = false // waiting for the permissions sheet before the route
  private trip = { voice: false, rate: false, hl: false, hlLater: false }
  private garage = new Garage(() => { this.root.classList.remove('is-garage'); this.paintCar() })

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
    <button class="dv-row" data-act="garage"><img class="dv-row-car" alt=""><span>Гараж</span></button>
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
    <div class="dv-thread" aria-live="polite"></div>
    <div class="dv-sugg">
      <button class="dv-card" data-act="flight"><b>Рейс из Пулково</b><span>завтра в 15:40</span></button>
      <button class="dv-card"><b>Ставка ЦБ</b><span>что дальше</span></button>
    </div>
    <div class="dv-input">
      <button class="dv-round" aria-label="Добавить">${I.plus}</button>
      <div class="dv-field"><span>Спросите Ась</span><button class="dv-mic" aria-label="Диктовка">${I.mic}</button><button class="dv-voice" aria-label="Голос">${I.wave}</button></div>
    </div>
    <div class="dv-scrim" data-act="close"></div>
  </section>
  <section class="dv-drive" aria-label="Ась в дороге" aria-hidden="true">
    ${status('is-dark')}
    <header class="dv-dhead">
      <button class="dv-chip" data-act="exit" aria-label="Выйти из режима «В дороге»">${I.car}<span>В дороге</span>${I.close}</button>
      <span class="dv-conn">${I.route}<span>Карты</span></span>
    </header>
    <div class="dv-dest">
      <h2 class="dv-q">Куда едем?</h2>
      <p class="dv-heard">Скажите адрес или выберите</p>
      <div class="dv-places">
        <button class="dv-place is-first" data-say="dest"><b>Пулково, терминал 1</b><span>34 мин</span></button>
        <button class="dv-place" data-act="nope"><b>Работа</b><span>22 мин</span></button>
        <button class="dv-place" data-act="nope"><b>Дом</b><span>18 мин</span></button>
      </div>
    </div>
    <div class="dv-show">
      <div class="dv-body" aria-live="polite"></div>
      <div class="dv-actions"><button class="dv-btn dv-btn--primary" data-say="route">К маршруту</button></div>
    </div>
  </section>
  <section class="dv-maps" aria-label="Навигатор" aria-hidden="true">
    <div class="dv-status is-dark" aria-hidden="true"><b><span class="dv-crumb">◀ Ась</span><span class="dv-time">9:41</span></b><span><i class="dv-sig"></i><i class="dv-bat"></i></span></div>
    <div class="dv-map" role="img" aria-label="Карта с маршрутом и вашей машинкой"></div>
    <div class="dv-mbtns" aria-hidden="true"><i>◎</i></div>
    <div class="dv-man"><span class="dv-man-ic"></span><span><b class="dv-dist"></b><small class="dv-to"></small></span></div>
    <div class="dv-speed" aria-hidden="true"><i>90</i><span><b>72</b> км/ч</span></div>
    <div class="dv-eta"><span><b>13:27</b><small>34 мин · 28 км</small></span><span class="dv-eta-btn" aria-hidden="true">Обзор</span></div>
  </section>
  <section class="dv-video" aria-label="Видео" aria-hidden="true">
    ${status('is-dark')}
    <div class="dv-vbar">${I.search}<span>Half-Life 3 тизер</span></div>
    <div class="dv-player"><span class="dv-play">${I.play}</span><b>Half-Life 3 · тизер</b><small>ролик фанатов · 1:42</small></div>
    <p class="dv-vnote">Официального тизера нет: Valve ничего не объявляла. Это ролики фанатов</p>
    <ul class="dv-vlist">
      <li><i></i><span><b>Half-Life 3: что известно про HLX</b><small>обзор · 8:15</small></span></li>
      <li><i></i><span><b>Оговорка на GameSoundCon, разбор</b><small>новости · 4:02</small></span></li>
      <li><i></i><span><b>Half-Life 3 — концепт-тизер</b><small>фанатский ролик · 2:30</small></span></li>
    </ul>
  </section>
  <div class="dv-navi" aria-hidden="true"><span class="dv-navi-ic"></span><b class="dv-dist"></b></div>
  <div class="dv-isl" data-act="island" role="status" aria-live="polite">
    <span class="dv-isl-ic"></span>
    <span class="dv-isl-text"><small></small><b></b></span>
    <span class="dv-isl-chips"></span>
  </div>
  <div class="dv-sdim" data-act="sheet-later"></div>
  <div class="dv-sheet" role="dialog" aria-modal="true" aria-label="Разрешения" aria-hidden="true">
    <i class="dv-grip" aria-hidden="true"></i>
    <h3 class="dv-sh-t"></h3>
    <p class="dv-sh-s"></p>
    <ul class="dv-perms">${PERMS.map((p) => `<li data-k="${p.k}"><span><b>${p.t}</b><small>${p.sub}</small></span><em></em></li>`).join('')}</ul>
    <button class="dv-btn dv-btn--primary" data-act="sheet-go"></button>
  </div>
  <div class="dv-adim"></div>
  <div class="dv-alert" role="alertdialog" aria-modal="true" aria-hidden="true"></div>
  <button class="dv-push" data-act="push" aria-hidden="true"><i class="dv-push-ic" aria-hidden="true">А</i><span><b>Пора выезжать в Пулково</b><small>Рейс в 15:40. С пробками 34 минуты, маршрут готов</small></span><em>сейчас</em></button>
  <div class="dv-toast" role="status"></div>
</div>
<aside class="dv-say" aria-label="Сказать голосом">
  <button class="dv-say-head" data-act="say-toggle">${I.mic}<span>Сказать голосом</span></button>
  <div class="dv-say-list">${SAY.map((s) => `<button data-say="${s.k}"${s.sim ? ' class="is-sim"' : ''}>${s.sim ? '' : '«'}${s.t}${s.sim ? '' : '»'}</button>`).join('')}</div>
  <p class="dv-say-note">Вместо микрофона. Кнопки на экране работают так же</p>
</aside>`
    this.q('.dv-phone').append(this.cat.el)
    this.q('.dv-toast').before(this.garage.el)
    this.paintCar()
    this.root.addEventListener('click', (e) => this.click(e))
    this.q('.dv-body').addEventListener('scroll', () => this.idleShow(), { passive: true })
    this.q('.dv-show').addEventListener('pointerdown', () => this.idleShow())
    addEventListener('keydown', this.onKey)
    this.ro = new ResizeObserver(() => this.placeCat())
    this.ro.observe(this.q('.dv-phone'))
    requestAnimationFrame(() => this.placeCat())
    this.audio.addEventListener('ended', () => this.chunkEnd())
    this.paintSay()
    if (import.meta.env.DEV) (window as unknown as { dv: DrivePage }).dv = this // for state screenshots
  }

  destroy() {
    this.clear()
    clearInterval(this.tick)
    clearTimeout(this.popTimer)
    this.audio.pause()
    this.ro.disconnect()
    this.garage.destroy()
    this.cat.destroy()
    removeEventListener('keydown', this.onKey)
  }

  // ---------- events ----------
  private click(e: MouseEvent) {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act], [data-say]')
    if (!el) return
    if (el.dataset.say) { this.say(el.dataset.say as Say); return }
    const a = el.dataset.act
    if (a === 'menu') this.menu(true)
    else if (a === 'close') this.menu(false)
    else if (a === 'drive') this.enter()
    else if (a === 'exit') this.exit()
    else if (a === 'sheet-go') this.sheetGo()
    else if (a === 'sheet-later') { this.pendingTrip = false; this.sheet(false) }
    else if (a === 'alert') this.answer(el.dataset.k as Perm, el.dataset.yes === '1')
    else if (a === 'island') this.islandTap()
    else if (a === 'say-toggle') this.root.classList.toggle('is-say')
    else if (a === 'nope') this.toast('В демо маршрут есть только в Пулково')
    else if (a === 'flight') this.flight()
    else if (a === 'go-route' || a === 'push') this.tripFromChat()
    else if (a === 'remind') this.remind()
    else if (a === 'garage') this.openGarage()
    else if (a === 'watch') this.toast('Откроется в приложении видео: машина стоит')
  }

  private key(e: KeyboardEvent) {
    if (e.key !== 'Escape') return
    if (this.root.dataset.mode === 'chat') this.menu(false)
    else if (!this.root.classList.contains('is-sheet')) this.exit()
  }

  // everything the driver can do, by voice or by the same words on a button
  private say(k: Say): void {
    if (!this.can(k)) return
    if (k === 'dest') return this.heard()
    if (k === 'turn') { this.dist = Math.min(this.dist, ZONE); return this.paintTurn() }
    if (k === 'rate' || k === 'hl3') return this.start(k)
    if (k === 'route') return this.toRoute()
    if (k === 'end') return this.exit('Поездка закончилась, «В дороге» выключен')
    if (k === 'next') return this.say('yes')
    if (k === 'yes') {
      if (!this.asked || !this.topic) return
      this.asked = false
      if (this.chunk < TALK[this.topic].length - 1) return this.play(this.topic, this.chunk + 1)
      this.toast('Сохранил в чат поездки')
      return this.rest()
    }
    if (k === 'no') { this.asked = false; return this.rest() }
    if (k === 'stop') { this.audio.pause(); this.speaking = this.held = false; this.asked = false; this.queued = null; return this.rest() }
    if (k === 'other') return this.start(this.topic === 'rate' ? 'hl3' : 'rate')
    if (k === 'show') {
      this.audio.pause()
      this.speaking = this.held = this.asked = false
      if (this.topic === 'hl3') {
        // NHTSA and ПДД: no video for the driver while moving. The passenger or a stop opens it
        return this.pop({ label: 'Видео', main: 'За рулём не включаю. Покажу на стоянке', chips: [['passenger', 'Я пассажир'], ['later', 'Хорошо']], ms: 9000 })
      }
      this.pop(null)
      return this.openShow()
    }
    if (k === 'passenger') return this.openVideo()
    if (k === 'later') { this.idle = 'Тизер покажу на стоянке'; this.trip.hlLater = true; return this.rest() }
  }

  // which phrases make sense right now: the rest are greyed out in the voice panel
  private can(k: Say): boolean {
    const m = this.root.dataset.mode as Mode
    if (m === 'chat' || this.root.classList.contains('is-sheet')) return false
    if (k === 'dest') return m === 'drive' && this.view === 'dest' && !this.routing
    if (!this.routing) return false
    if (k === 'rate' || k === 'hl3' || k === 'turn' || k === 'end' || k === 'other') return true
    if (k === 'route') return m !== 'maps'
    if (k === 'next') return this.asked
    if (k === 'yes' || k === 'no') return this.asked
    if (k === 'show') return !!this.topic && m === 'maps'
    if (k === 'stop') return this.speaking || this.held || this.asked
    return true
  }

  private paintSay() {
    for (const b of this.root.querySelectorAll<HTMLButtonElement>('.dv-say-list button')) b.disabled = !this.can(b.dataset.say as Say)
  }

  // ---------- menu and mode ----------
  private menu(open: boolean) {
    this.root.classList.toggle('is-menu', open)
    this.q('.dv-menu').setAttribute('aria-hidden', String(!open))
    this.placeCat()
  }

  private enter() {
    this.root.classList.remove('is-menu')
    this.q('.dv-menu').setAttribute('aria-hidden', 'true')
    this.view = 'dest'
    this.q('.dv-heard').textContent = 'Скажите адрес или выберите'
    this.q<HTMLElement>('.dv-drive').dataset.view = 'dest'
    this.mode('drive')
    if (!PERMS.every((p) => granted[p.k] === 'ok')) this.sheet(true)
  }

  private exit(msg = 'Режим «В дороге» выключен') {
    const drove = this.routing
    this.clear()
    clearInterval(this.tick)
    this.audio.pause()
    Object.assign(this, { routing: false, topic: null, speaking: false, held: false, asked: false, queued: null, quiet: false, toldTurn: false, idle: 'Ась слушает', pendingTrip: false })
    this.sheet(false)
    this.mode('chat')
    if (drove) this.summary()
    else this.toast(msg)
  }

  // ---------- the ecosystem: chat → Карты before the trip, Карты → chat after it ----------
  // a place named in the conversation becomes a card with «Поехали» (Яндекс «Спросить AI», Ask Maps)
  private flight() {
    this.thread(`<div class="dv-msg dv-msg--me">Завтра лечу из Пулково в 15:40</div>
<div class="dv-msg dv-msg--as"><p><b>Выезжайте около 13:00.</b> Дорога сейчас 34 минуты, регистрация до 14:00.</p>
<div class="dv-placecard"><div class="dv-pc-map">${MAP}</div><div class="dv-pc-body"><b>Пулково, терминал 1</b><small>34 мин · 28 км · пробки 4 балла</small>
<div class="dv-pc-act"><button class="dv-pill-btn dv-pill-btn--dark" data-act="go-route">${I.car}<span>Поехали</span></button><button class="dv-pill-btn" data-act="remind">Напомнить выехать</button></div></div></div></div>`)
  }

  // «пора выезжать»: Карты count the traffic, the push leads straight into the ready route (Apple Time to Leave)
  private remind() {
    this.toast('Напомню, когда пора выезжать')
    window.setTimeout(() => {
      if (this.root.dataset.mode !== 'chat') return
      const p = this.q<HTMLElement>('.dv-push')
      p.classList.add('is-on')
      p.setAttribute('aria-hidden', 'false')
      window.setTimeout(() => { p.classList.remove('is-on'); p.setAttribute('aria-hidden', 'true') }, 7000)
    }, 2600)
  }

  private tripFromChat() {
    this.q('.dv-push').classList.remove('is-on')
    this.fromChat = true
    this.trip = { voice: false, rate: false, hl: false, hlLater: false }
    this.root.classList.remove('is-menu')
    if (!PERMS.every((p) => granted[p.k] === 'ok')) { this.pendingTrip = true; this.enter(); return }
    this.startRoute()
  }

  // «Пока вы ехали»: what waited for the stop, the trip in one line, new stickers (given only now, parked)
  private summary() {
    const got: StickerId[] = []
    const give = (id: StickerId, ok: boolean) => { if (ok && !car.earned.has(id)) { car.earned.add(id); car.fresh.add(id); got.push(id) } }
    give('hello', true)
    give('voice', this.trip.voice)
    give('early', this.fromChat)
    const rows: string[] = []
    if (this.trip.rate) rows.push(`<li><b>Ставка ЦБ: 14%</b><span>до 18 декабря. Три экрана сохранил здесь</span></li>`)
    if (this.trip.hl) rows.push(`<li><b>Half-Life 3</b><span>${this.trip.hlLater ? 'тизер ждал стоянки' : 'Valve молчит, есть слух про HLX'}</span>${this.trip.hlLater ? '<button class="dv-link" data-act="watch">Смотреть</button>' : ''}</li>`)
    const st = got.length ? `<div class="dv-sum-st"><span class="dv-sum-icons">${got.map((id) => `<i title="${sticker(id).name}">${sticker(id).svg}</i>`).join('')}</span><span><b>${got.length === 1 ? 'Новая наклейка' : 'Новые наклейки'}</b><small>${got.map((id) => sticker(id).name).join(' · ')}</small></span><button class="dv-pill-btn dv-pill-btn--dark" data-act="garage">Наклеить</button></div>` : ''
    this.thread(`<div class="dv-msg dv-msg--as"><div class="dv-sum"><div class="dv-pc-map">${MAP}</div><div class="dv-sum-in"><p class="dv-sum-k">Пока вы ехали · Пулково, терминал 1</p><div class="dv-sum-n"><span><b>28</b>км</span><span><b>34</b>мин</span><span><b>13:27</b>прибыли</span></div>${rows.length ? `<ul>${rows.join('')}</ul>` : ''}${st}</div></div></div>`)
    this.fromChat = false
  }

  private thread(html: string) {
    const t = this.q<HTMLElement>('.dv-thread')
    t.insertAdjacentHTML('beforeend', html)
    this.q('.dv-chat').classList.add('has-thread')
    t.scrollTop = t.scrollHeight
  }

  // the garage is a chat screen: it opens only while parked, never from the road
  private openGarage() {
    if (this.root.dataset.mode !== 'chat') { this.toast('Гараж откроется на стоянке'); return }
    this.menu(false)
    this.garage.open()
    this.root.classList.add('is-garage')
  }

  private paintCar() {
    // the 3D navigator is one SVG frame with the car in it: a new colour or body redraws it
    this.q('.dv-map').innerHTML = `${MAP}<span class="dv-carw"><i class="dv-ai-ring"></i><img class="dv-carimg" src="${carSrc('nav')}" alt=""></span>`
    this.q<HTMLImageElement>('.dv-row-car').src = carSrc('top')
  }

  private mode(m: Mode) {
    this.root.dataset.mode = m
    for (const [sel, on] of [['.dv-chat', m === 'chat'], ['.dv-drive', m === 'drive'], ['.dv-maps', m === 'maps'], ['.dv-video', m === 'video']] as const) this.q(sel).setAttribute('aria-hidden', String(!on))
    this.placeCat()
    this.paintIsland()
    this.paintSay()
  }

  // ---------- «Куда едем?» → route ----------
  private heard() {
    this.q('.dv-heard').textContent = '«В Пулково, терминал 1»'
    this.q('.dv-place[data-say="dest"]').classList.add('is-on')
    this.trip = { voice: false, rate: false, hl: false, hlLater: false }
    this.later(900, () => {
      this.q('.dv-place[data-say="dest"]').classList.remove('is-on')
      this.startRoute()
    })
  }

  private startRoute() {
    this.routing = true
    this.turn = 0
    this.dist = TURNS[0].d
    this.paintTurn()
    clearInterval(this.tick)
    this.tick = window.setInterval(() => this.drive(), 1000)
    this.paintCar()
    this.q('.dv-maps').classList.toggle('from-chat', this.fromChat)
    this.mode('maps')
    this.pop({ label: 'Маршрут построен', main: 'Пулково, терминал 1 · 34 мин', ms: 3500 })
  }

  // the car moves: the next manoeuvre gets closer once a second (numbers change, nothing slides)
  private drive() {
    this.dist -= SPEED
    if (this.dist <= 0) {
      this.turn = (this.turn + 1) % TURNS.length
      this.dist = TURNS[this.turn].d
      this.quiet = false
      window.setTimeout(() => this.afterTurn(), 1200) // not in this.timers: screen changes must not lose the resume
    } else if (this.dist <= ZONE && !this.quiet) {
      this.quiet = true
      this.beforeTurn()
    }
    this.paintTurn()
  }

  private paintTurn() {
    const t = TURNS[this.turn]
    const d = Math.max(0, Math.round(this.dist / 10) * 10)
    const txt = d >= 1000 ? `${(d / 1000).toFixed(1).replace('.', ',')} км` : `${d} м`
    for (const el of this.root.querySelectorAll('.dv-dist')) el.textContent = txt
    this.q('.dv-to').textContent = t.to
    for (const el of this.root.querySelectorAll('.dv-man-ic, .dv-navi-ic')) el.innerHTML = I[t.dir]
    if (this.dist <= ZONE && !this.quiet) { this.quiet = true; this.beforeTurn() }
  }

  // a manoeuvre is close: the turn gets the top of the screen and the silence. The notice is only spoken,
  // and only the first time a trip; in a city of turns it is a silent pause with «Пауза · поворот» in the island
  private beforeTurn() {
    if (this.q<HTMLElement>('.dv-isl').dataset.s === 'open') this.pop(null)
    if (!this.speaking) return
    this.audio.pause()
    this.speaking = false
    this.held = true
    if (!this.toldTurn) {
      this.toldTurn = true
      this.speak('Скоро поворот. Закончите его, и я продолжу')
    }
    this.paintIsland()
  }

  // a short line without a recording: the system voice, if the browser has a Russian one
  private speak(text: string) {
    const synth = window.speechSynthesis
    if (!synth) return
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ru-RU'
    synth.cancel()
    synth.speak(u)
  }

  private afterTurn() {
    if (this.idle === 'Отвечу после поворота') this.idle = 'Ась слушает'
    if (this.held) {
      this.held = false
      this.audio.currentTime = Math.max(0, this.audio.currentTime - 1.5) // pick the thread up a little earlier
      this.resume()
    } else if (this.queued) {
      const f = this.queued
      this.queued = null
      f()
    }
    this.paintIsland()
  }

  // ---------- answers by voice ----------
  private start(t: Topic) {
    this.play(t, 0)
  }

  private play(t: Topic, i: number) {
    this.audio.pause()
    this.topic = t
    this.chunk = i
    this.asked = this.held = false
    this.idle = 'Ась слушает'
    if (this.root.dataset.mode !== 'maps' && this.root.dataset.mode !== 'video') this.toRoute(false)
    // less than 4 s to the manoeuvre zone: Ась does not start, it waits for the turn to pass
    if (this.quiet || (this.dist - ZONE) / SPEED < 4) {
      this.queued = () => this.play(t, i)
      this.idle = 'Отвечу после поворота'
      this.pop(null)
      return
    }
    // the demo brings the next turn into the middle of the first chunk, to show the pause
    if (i === 0 && this.dist > ZONE + SPEED * 6) this.dist = ZONE + SPEED * 6
    this.paintTurn()
    if (i === 0) { this.trip.voice = true; this.trip[t === 'rate' ? 'rate' : 'hl'] = true }
    this.audio.src = `./voice/${TALK[t][i].id}.mp3`
    this.audio.currentTime = 0
    this.resume()
    this.pop({ label: TALK[t][i].title, main: TALK[t][i].big, chips: [['show', 'Покажи'], ['stop', 'Стоп']], ms: 4000 })
  }

  private resume() {
    this.speaking = true
    this.audio.play().catch(() => {
      // no sound (autoplay blocked or a file missing): keep the timeline as if it played
      this.later(6000, () => { if (this.speaking) this.chunkEnd() })
    })
    this.paintIsland()
  }

  private chunkEnd() {
    if (!this.speaking || !this.topic) return
    this.speaking = false
    this.asked = true
    const c = TALK[this.topic][this.chunk]
    const chips: [Say, string][] = [['yes', 'Да'], ['show', 'Покажи'], ['other', this.topic === 'rate' ? 'Другая тема' : 'Про ставку']]
    this.pop({ label: c.title, main: c.ask, chips, ms: 10000 })
  }

  private rest() {
    this.pop(null)
  }

  // ---------- Ась's own screens (5.x «Покажи») ----------
  private openShow() {
    this.view = 'rate'
    const d = this.q<HTMLElement>('.dv-drive')
    d.dataset.view = 'rate'
    const body = this.q<HTMLElement>('.dv-body')
    body.innerHTML = SHOW
    body.scrollTop = 0
    this.mode('drive')
    this.idleShow()
  }

  // the navigator comes back by itself after a while without a touch; looking around restarts the wait
  private idleShow() {
    this.clear()
    if (this.root.dataset.mode === 'drive' && this.view === 'rate') this.later(SHOW_IDLE, () => this.toRoute())
  }

  private openVideo() {
    this.mode('video')
    this.idle = 'Вернуть маршрут'
    this.pop(null)
  }

  private toRoute(say = true) {
    this.clear()
    if (this.idle === 'Вернуть маршрут') this.idle = 'Ась слушает'
    this.view = 'dest'
    this.mode('maps')
    if (say && this.topic === 'rate') this.idle = 'Ставка ЦБ · в чате поездки'
    if (say && this.root.dataset.mode === 'maps') this.paintIsland()
  }

  // ---------- the island: Ась's Live Activity. Over Ась's own screens the navigator's one shows the turn ----------
  private pop(p: Pop | null) {
    clearTimeout(this.popTimer)
    this.q('.dv-maps').classList.toggle('is-ai', this.speaking || this.asked)
    const el = this.q<HTMLElement>('.dv-isl')
    if (!p) { el.dataset.s = 'compact'; this.paintIsland(); return }
    el.dataset.s = 'open'
    this.q('.dv-isl-text small').textContent = p.label
    this.q('.dv-isl-text b').textContent = p.main
    this.q('.dv-isl-ic').innerHTML = p.label === 'Пауза' ? I.pause : I.speaker
    this.q('.dv-isl-chips').innerHTML = (p.chips ?? []).map(([k, t]) => `<button data-say="${k}">${t}</button>`).join('')
    if (p.ms) this.popTimer = window.setTimeout(() => this.pop(null), p.ms)
    this.paintSay()
  }

  private paintIsland() {
    // Ась speaks or waits for a yes: a quiet ring under the car, no pulse
    this.q('.dv-maps').classList.toggle('is-ai', this.speaking || this.asked)
    const el = this.q<HTMLElement>('.dv-isl')
    this.paintSay()
    if (el.dataset.s === 'open') return
    el.dataset.s = 'compact'
    const text = this.held ? 'Пауза · поворот' : this.speaking && this.topic ? TALK[this.topic][this.chunk].title : this.idle
    this.q('.dv-isl-ic').innerHTML = this.held ? I.pause : this.speaking ? I.speaker : I.mic
    this.q('.dv-isl-text small').textContent = ''
    this.q('.dv-isl-text b').textContent = text
    this.q('.dv-isl-chips').innerHTML = ''
  }

  private islandTap() {
    const m = this.root.dataset.mode
    if (m === 'video') return this.toRoute()
    if (this.q<HTMLElement>('.dv-isl').dataset.s === 'open') return
    this.pop({ label: 'Ась', main: this.speaking ? 'Говорю' : 'Слушаю', chips: this.speaking ? [['show', 'Покажи'], ['stop', 'Стоп']] : [['end', 'Завершить поездку']], ms: 6000 })
  }

  // ---------- permissions: our sheet, then the system alerts ----------
  private sheet(open: boolean, title = 'Ась в дороге', sub = 'Нужно четыре разрешения. Телефон спросит по очереди, один раз и пока вы стоите', go = 'Продолжить') {
    this.root.classList.toggle('is-sheet', open)
    this.q('.dv-sheet').setAttribute('aria-hidden', String(!open))
    if (!open) { this.alert(null); this.paintSay(); return }
    this.q('.dv-sh-t').textContent = title
    this.q('.dv-sh-s').textContent = sub
    this.q('[data-act="sheet-go"]').textContent = go
    this.paintPerms()
    this.paintSay()
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
    // «Открыть Настройки»: in the stand the switch flips as if the person came back from Настройки
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
      if (this.pendingTrip) { this.pendingTrip = false; this.startRoute() }
      return
    }
    this.later(200, () => this.alert(p))
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
    if (!yes && (k === 'mic' || k === 'speech')) {
      const t = k === 'mic' ? 'Микрофон выключен' : 'Распознавание речи выключено'
      this.sheet(true, 'Ась не услышит адрес', `${t}. Включите в Настройках, это один переключатель`, 'Открыть Настройки')
      return
    }
    this.next()
  }

  // ---------- helpers ----------
  private clear() {
    this.timers.forEach(clearTimeout)
    this.timers = []
  }

  private later(ms: number, fn: () => void) {
    this.timers.push(window.setTimeout(fn, ms))
  }

  private toast(text: string) {
    const t = this.q<HTMLElement>('.dv-toast')
    t.textContent = text
    t.classList.add('is-on')
    window.setTimeout(() => t.classList.remove('is-on'), 2400)
  }

  // the cat stays in the chat header only: on the road there is no character
  private placeCat() {
    const ph = this.q<HTMLElement>('.dv-phone').getBoundingClientRect()
    const chat = this.q<HTMLElement>('.dv-chat')
    const slot = this.q<HTMLElement>('.dv-slot').getBoundingClientRect()
    const shift = chat.getBoundingClientRect().left - ph.left
    const want = this.root.classList.contains('is-menu') ? this.q<HTMLElement>('.dv-menu').offsetWidth : 0
    const el = this.cat.el
    el.style.width = el.style.height = `${slot.width}px`
    el.classList.add('is-slide')
    el.style.setProperty('--x', `${slot.left - ph.left - shift + want}px`)
    el.style.setProperty('--y', `${slot.top - ph.top}px`)
    el.style.setProperty('--s', '1')
  }
}
