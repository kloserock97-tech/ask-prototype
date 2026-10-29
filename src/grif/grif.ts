// GRIF: a chat-only AI companion (ChatGPT / Grok layout) with a «В дороге» mode.
// research/16 and research/17 describe the flow; Figma page «08 · Компаньон».
//   chat     — empty state, answers with fact / forecast / rumour labels, ≡ menu, «+» sheet
//   entry    — Bluetooth sheet, «you are moving» banner with a 3 s cancel, manual «В дорогу»
//   drive    — one screen: anchor + the sentence that plays; the horizon light carries the state
//   summary  — on a stop; the trip chat pins itself in the menu
// Rule: GRIF may simplify the screen on its own, but never opens the microphone without consent.

import * as voice from '../voice'
import * as ears from '../app/ears'
import * as earcon from '../app/earcon'
import { canWake, startWake, stopWake } from '../app/wake'
import { Horizon, type Glow } from './horizon'
import { CHAIN, DATA_AS_OF, DEMO, FULL, LINE, SOURCES, TOPIC_TITLE, VOICE_IDS, understand, type Chunk, type Intent, type Tag, type Topic } from './talk'

type Msg = { who: 'me' | 'ai'; text?: string; topic?: Topic; voice?: boolean; time: string; saved?: string; tag?: Tag }
type Chat = { id: number; title: string; when: string; pinned?: boolean; trip?: boolean; voice?: boolean; msgs: Msg[] }
type Mode = 'ready' | 'listen' | 'think' | 'speak' | 'pause' | 'quiet' | 'offline' | 'denied' | 'call'
type View = 'chat' | 'drive' | 'summary'
type Auto = 'ask' | 'always' | 'never'

const IC: Record<string, string> = {
  menu: 'M4 8h16M4 16h11',
  edit: 'M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5M17.5 3.5l3 3L12 15l-4 1 1-4z',
  plus: 'M12 5v14M5 12h14',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  wave: 'M6 10v4M10 7v10M14 4v16M18 9v6',
  up: 'M12 19V5M6 11l6-6 6 6',
  car: 'M5 17v-5l2.2-5h9.6l2.2 5v5M3 12h18v5H3zM6.5 17v2.5M17.5 17v2.5M7 14.5h.01M17 14.5h.01',
  search: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM20 20l-4-4',
  pin: 'M9 4h6l-1 6 3 3H7l3-3zM12 13v8',
  gear: 'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
  bookmark: 'M6 4h12v17l-6-4-6 4z',
  copy: 'M9 9h11v11H9zM5 15V4h11',
  speaker: 'M4 10v4h4l5 4V6L8 10zM16 9a4 4 0 0 1 0 6',
  link: 'M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1 1M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1-1',
  stop: 'M7 7h10v10H7z',
  pause: 'M8 5v14M16 5v14',
  play: 'M7 5l12 7-12 7z',
  repeat: 'M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  bt: 'M7 7l10 10-5 4V3l5 4L7 17',
  camera: 'M4 8h4l2-3h4l2 3h4v11H4zM12 10a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7z',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4',
  globe: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z',
  hand: 'M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11V4.5a1.5 1.5 0 0 1 3 0V12M14 11.5V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L3.5 15a1.5 1.5 0 0 1 2.4-1.8L8 15',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  wifioff: 'M3 3l18 18M8.5 16a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 4.5-2.4M14.5 10.1A10 10 0 0 1 19 12.5M2 8.8a15 15 0 0 1 4-2.4M10.5 5.6A15 15 0 0 1 22 8.8M12 19.5h.01',
  micoff: 'M3 3l18 18M9 9v3a3 3 0 0 0 5 2.2M15 9.5V6a3 3 0 0 0-5.7-1.3M5 11a7 7 0 0 0 11.5 5.3M19 11a7 7 0 0 1-.6 2.8M12 18v3',
  moon: 'M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z',
  nfc: 'M7 8a6 6 0 0 1 0 8M11 6a10 10 0 0 1 0 12M15 4a14 14 0 0 1 0 16',
  chev: 'M9 6l6 6-6 6',
  chevd: 'M6 9l6 6 6-6',
  clip: 'M21 11.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9',
  cc: 'M4 6h16v12H4zM10.5 10.2a2.2 2.2 0 1 0 0 3.6M16.5 10.2a2.2 2.2 0 1 0 0 3.6',
  sliders: 'M5 4v6M5 14v6M12 4v2M12 10v10M19 4v10M19 18v2M3 12h4M10 8h4M17 16h4',
  chart: 'M4 19h16M7 16V10M12 16V5M17 16v-4',
  game: 'M6 9h12a4 4 0 0 1 4 4v1a3 3 0 0 1-5.4 1.8L15 14H9l-1.6 1.8A3 3 0 0 1 2 14v-1a4 4 0 0 1 4-4zM8 11v3M6.5 12.5h3M16 12h.01M18 13.5h.01',
}
const ic = (n: string, cls = '') => `<svg class="gr-i ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${IC[n]}"/></svg>`
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const hhmm = () => new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
const dayShort = () => new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '')
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const vib = (p: number | number[]) => {
  try {
    if ((navigator as any).userActivation?.hasBeenActive) navigator.vibrate?.(p)
  } catch {
    /* no vibration */
  }
}
const store = {
  get(k: string) {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* private mode */
    }
  },
}
// p04: the mic sits in a halftone ring — dots thin out outward and to one side
const RING = (() => {
  let d = ''
  for (let r = 32; r <= 68; r += 3) {
    const n = Math.round((2 * Math.PI * r) / 4.2)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const op = (0.2 + 0.8 * (1 - (r - 31) / 40)) * (0.5 + 0.5 * Math.cos(a + 2.4))
      d += `<circle cx="${(70 + r * Math.cos(a)).toFixed(1)}" cy="${(70 + r * Math.sin(a)).toFixed(1)}" r="${(1.75 - (r - 32) / 48).toFixed(2)}" opacity="${Math.max(0.07, op).toFixed(2)}"/>`
    }
  }
  return `<svg class="gr-ring-dots" viewBox="0 0 140 140" aria-hidden="true"><g fill="#B3C0FF">${d}</g></svg>`
})()
// p27: drops that flow into each other — circles under an SVG «goo» filter
const GOO = `<svg class="gr-goo" viewBox="150 160 420 420" aria-hidden="true"><g filter="url(#gr-goo)">${[
  [181, 523, 19],
  [262, 508, 33],
  [355, 446, 42],
  [435, 352, 45],
  [506, 214, 52],
]
  .map(([x, y, r], i) => `<circle cx="${x}" cy="${y}" r="${r}" style="--i:${i}"/>`)
  .join('')}</g></svg>`
// p16: a glass slider pill — icon and value on the fill, «⋮» as the handle, the name on the track
const SL = (k: string, label: string, icon: string, v: number, min: number, max: number, text: string) =>
  `<div class="gr-sl" data-sl="${k}" data-min="${min}" data-max="${max}" data-v="${v}" role="slider" tabindex="0" aria-label="${label}" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${v}">
    <div class="gr-sl-fill" style="--p:${(v - min) / (max - min)}">${ic(icon)}<b>${text}</b><i></i></div><span class="gr-sl-lbl">${label}</span></div>`
type VoicePick = voice.VoiceName | 'none'
const CHAR = (n: 'neutral' | 'attentive' | 'curious' | 'happy' | 'sleepy' | 'proud') => `./grif/${n}.webp`
const TAG_CLS: Record<Tag['kind'], string> = { fact: 'is-fact', forecast: 'is-forecast', rumor: 'is-rumor', info: 'is-info' }

const SEED: Chat[] = [
  {
    id: 1,
    title: 'Подарок маме к 14 апреля',
    when: 'вчера',
    pinned: true,
    msgs: [
      { who: 'me', text: 'Подбери подарок маме до 3000 ₽, она любит сад', time: '18:20' },
      { who: 'ai', text: 'Три варианта до 3000 ₽ с доставкой до 13 апреля: садовые ножницы, семена редких томатов с книгой про рассаду, коленная подушка с перчатками. Заказать первый? Без вашего «да» ничего не оплачу.', time: '18:20' },
    ],
  },
  { id: 2, title: 'Анализ встречи с Сергеем', when: 'сегодня, 12:04', msgs: [{ who: 'me', text: 'Разбери встречу с Сергеем', time: '12:04' }, { who: 'ai', text: 'Сергей хочет пилот на 2 недели, запуск — до конца квартала. Черновик письма готов, отправлю только после вашего «да».', time: '12:04' }] },
  { id: 3, title: 'Напомнить Сергею про пилот', when: 'сегодня, 09:15', voice: true, msgs: [{ who: 'me', text: 'Напомни завтра позвонить Сергею про пилот', voice: true, time: '09:15' }, { who: 'ai', text: 'Напомню завтра в 10:00.', time: '09:15' }] },
  { id: 4, title: 'Тарифы на интернет', when: 'вчера', msgs: [{ who: 'me', text: 'Сравни тарифы на домашний интернет', time: '11:02' }, { who: 'ai', text: 'Нашёл три тарифа дешевле вашего на 200–350 ₽ при той же скорости. Показать?', time: '11:02' }] },
]

export class GrifApp {
  readonly root: HTMLElement
  private q = <T extends HTMLElement = HTMLElement>(s: string) => this.root.querySelector(s) as T
  private hz: Horizon | null = null
  private view: View = 'chat'
  private flavor: 'drive' | 'voice' = 'drive'
  private chats: Chat[] = SEED.map((c) => ({ ...c, msgs: [...c.msgs] }))
  private open: Chat | null = null // the chat on screen; null = new empty chat
  private conv: Chat | null = null // where the drive conversation is written
  private trip: Chat | null = null
  private tripStart = 0
  private clock = 0
  private md: Mode = 'ready'
  private tok = 0 // bumps on every interruption; stale async steps check it
  private topic: Topic | null = null
  private idx = 0
  private last: Chunk | null = null // the last answer chunk, for «повтори»
  private pending: null | 'next' | 'save' | 'clarify' | 'resume' = null
  private saved = new Set<Topic>()
  private demo = 0
  private micOK = false
  private askedMic = false
  private offline = !navigator.onLine
  private denied = false
  private queued: string | null = null
  private changedAt = 0
  private down: { x: number; y: number; t: number; id: number } | null = null
  private meterRaf = 0
  private auto: Auto = (store.get('gr-auto') as Auto) || 'ask'
  private signals: Record<string, boolean> = JSON.parse(store.get('gr-signals') || '{"bt":true,"motion":true,"focus":false,"nfc":true,"charge":false}')
  private geoWatch = 0
  private fastSince = 0
  private stillSince = 0
  private declined = false
  private bannerTimer = 0
  private firstDone = store.get('gr-first') === '1'
  private soundOn = true

  constructor() {
    this.root = document.createElement('div')
    this.root.className = 'gr-wrap'
    this.root.innerHTML = this.shell()
    this.hz = new Horizon(this.q<HTMLCanvasElement>('.gr-hz'))
    voice.prepare(VOICE_IDS)
    const vp = store.get('gr-voice') as VoicePick | null
    if (vp === 'none') this.soundOn = false
    else if (vp) voice.setVoice(vp)
    voice.setRate(Number(store.get('gr-rate')) || 1)
    this.vol = Number(store.get('gr-vol') ?? 1)
    voice.setVolume(this.vol)
    this.bind()
    this.renderChat()
    this.renderDrawer()
    addEventListener('online', this.onNet)
    addEventListener('offline', this.onNet)
    // shortcuts and links: ?drive=1 — straight into the mode, ?ask=rate — and ask
    const p = new URLSearchParams(location.search)
    const ask = p.get('ask')
    if (p.get('drive') || ask) {
      if (ask === 'rate' || ask === 'hl3') this.queuedAsk = ask
      this.enterDrive('drive')
    }
  }
  private queuedAsk: Topic | null = null

  private shell() {
    return `
<div class="gr" data-view="chat">
  <svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="gr-goo"><feGaussianBlur in="SourceGraphic" stdDeviation="10"/><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"/></filter></svg>
  <section class="gr-chat" aria-label="Чат">
    <header class="gr-hdr">
      <button class="gr-ib" data-act="drawer" aria-label="Меню">${ic('menu')}</button>
      <div class="gr-title"></div>
      <button class="gr-ib" data-act="new" aria-label="Новый чат">${ic('edit')}</button>
    </header>
    <div class="gr-banner" hidden></div>
    <div class="gr-thread"></div>
    <div class="gr-sugs"></div>
    <form class="gr-comp" autocomplete="off">
      <input class="gr-input" placeholder="Спросите GRIF" enterkeyhint="send" aria-label="Сообщение">
      <div class="gr-comp-row">
        <button type="button" class="gr-cb" data-act="plus" aria-label="Добавить файл">${ic('clip')}</button>
        <button type="button" class="gr-cb gr-dict" data-act="dictate" aria-label="Надиктовать">${ic('mic')}</button>
        <button type="button" class="gr-cb" data-act="deep" aria-label="Подумать дольше" aria-pressed="false">${ic('bulb')}</button>
        <button type="button" class="gr-modepill" data-act="modes"><span>Чат</span>${ic('chevd')}</button>
        <button type="button" class="gr-voice" data-act="voice" aria-label="Голосовой разговор">${ic('wave')}</button>
      </div>
    </form>
  </section>

  <section class="gr-drive" aria-label="В дороге">
    <canvas class="gr-hz" aria-hidden="true"></canvas>
    <header class="gr-top">
      <button class="gr-chip" data-act="chip">${ic('car')}<span class="gr-chip-t">В дороге</span></button>
      <span class="gr-clock"></span>
      <span class="gr-status" hidden></span>
      <button class="gr-ib gr-tb" data-act="cc" aria-label="Субтитры" aria-pressed="true">${ic('cc')}</button>
      <button class="gr-ib gr-tb is-blue" data-act="voice-sheet" aria-label="Голос и скорость">${ic('sliders')}</button>
      <button class="gr-ib gr-more" data-act="road" aria-label="Что может случиться в дороге">${ic('more')}</button>
    </header>
    <div class="gr-mid" aria-live="polite">
      <img class="gr-char" alt="" src="${CHAR('neutral')}">
      <div class="gr-think">${GOO}</div>
      <div class="gr-label"></div>
      <div class="gr-tag" hidden></div>
      <div class="gr-big" hidden></div>
      <div class="gr-cap" hidden></div>
      <p class="gr-phrase"></p>
      <p class="gr-ask" hidden></p>
    </div>
    <div class="gr-foot">
      <p class="gr-hint"></p>
      <button class="gr-btn" data-act="main"><span class="gr-btn-i"></span><span class="gr-btn-t"></span></button>
      <p class="gr-ring-l">GRIF СЛУШАЕТ…</p>
      <button class="gr-ring" data-act="main" aria-label="Стоп">${RING}<span class="gr-ring-core">${ic('mic')}</span></button>
    </div>
    <div class="gr-call" hidden>
      <div class="gr-call-card">
        <span class="gr-call-av">М</span>
        <span class="gr-call-who"><b>Мама</b><small class="gr-call-st">мобильный</small></span>
        <button class="gr-call-b is-no" data-act="call-end" aria-label="Отклонить">${ic('phone')}</button>
        <button class="gr-call-b is-yes" data-act="call-take" aria-label="Ответить">${ic('phone')}</button>
      </div>
    </div>
    <div class="gr-first" hidden>
      <img class="gr-first-char" alt="" src="${CHAR('happy')}">
      <div class="gr-label">ПЕРЕД ДОРОГОЙ</div>
      <h2 class="gr-first-h">Три слова —<br>и руки на руле</h2>
      <ul class="gr-rules">
        <li>${ic('hand')}<b>«Ась» или касание</b><span>в любом месте экрана — спросить</span></li>
        <li>${ic('stop')}<b>«Стоп»</b><span>замолчать сразу, даже на полуслове</span></li>
        <li>${ic('bookmark')}<b>«Сохрани»</b><span>прочитаете в чате поездки на остановке</span></li>
      </ul>
      <div class="gr-checks"></div>
      <button class="gr-btn is-primary" data-act="go">${ic('car')}<span class="gr-btn-t">Поехали</span></button>
    </div>
  </section>

  <section class="gr-sum" aria-label="Остановка"></section>

  <div class="gr-scrim" data-act="close" hidden></div>
  <aside class="gr-drawer" aria-label="Меню"></aside>
  <div class="gr-sheet" role="dialog" aria-modal="true" hidden></div>
  <div class="gr-toast" role="status"></div>
</div>`
  }

  // ───────────────────────── events

  private bind() {
    this.root.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')
      if (!el || !this.root.contains(el)) return
      this.firstGesture()
      this.act(el.dataset.act!, el)
    })
    const form = this.q<HTMLFormElement>('.gr-comp')
    const input = this.q<HTMLInputElement>('.gr-input')
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      this.firstGesture()
      const t = input.value.trim()
      if (t) {
        input.value = ''
        this.syncComposer()
        this.ask(t)
      }
    })
    input.addEventListener('input', () => this.syncComposer())
    this.root.addEventListener('pointerdown', (e) => {
      const sl = (e.target as HTMLElement).closest<HTMLElement>('.gr-sl')
      if (!sl) return
      try {
        sl.setPointerCapture(e.pointerId)
      } catch {
        /* a synthetic pointer cannot be captured */
      }
      this.slide(sl, e.clientX)
      const move = (m: PointerEvent) => this.slide(sl, m.clientX)
      const up = () => {
        sl.removeEventListener('pointermove', move)
        sl.removeEventListener('pointerup', up)
      }
      sl.addEventListener('pointermove', move)
      sl.addEventListener('pointerup', up)
    })
    this.root.addEventListener('keydown', (e) => {
      const sl = (e.target as HTMLElement).closest<HTMLElement>('.gr-sl')
      if (sl && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault()
        this.slide(sl, null, e.key === 'ArrowRight' ? 1 : -1)
      }
    })
    const drive = this.q('.gr-drive')
    drive.addEventListener('pointerdown', this.onDown)
    drive.addEventListener('pointerup', this.onUp)
    drive.addEventListener('pointercancel', () => (this.down = null))
    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeAll()
      if (this.view === 'drive' && (e.key === ' ' || e.key === 'Enter') && !(e.target as HTMLElement).closest('button,input')) {
        e.preventDefault()
        this.tap()
      }
    })
  }

  private gestured = false
  private firstGesture() {
    if (this.gestured) return
    this.gestured = true
    earcon.unlock()
    if (this.soundOn) voice.setOn(true)
  }

  private act(a: string, el: HTMLElement) {
    switch (a) {
      case 'drawer': return this.openDrawer()
      case 'close': return this.closeAll()
      case 'new': return this.openChat(null)
      case 'plus': return this.sheetPlus()
      case 'voice': {
        const t = this.q<HTMLInputElement>('.gr-input').value.trim()
        if (t) return this.q<HTMLFormElement>('.gr-comp').requestSubmit()
        return this.enterDrive('voice')
      }
      case 'dictate': return this.dictate()
      case 'sug': return el.dataset.drive ? this.enterDrive('drive') : this.ask(el.dataset.q!)
      case 'chat': this.closeAll(); return this.openChat(this.chats.find((c) => c.id === Number(el.dataset.id)) ?? null)
      case 'to-drive': this.closeAll(); return this.enterDrive('drive')
      case 'signals': return this.sheetSignals()
      case 'settings': return this.sheetSettings()
      case 'modes': return this.sheet(`<h2 class="gr-sh-h">Режим</h2>
        <button class="gr-li" data-act="close">${ic('edit')}<span><b>Чат</b><small>текстом и голосом, ответы полные</small></span>${ic('check')}</button>
        <button class="gr-li is-accent" data-act="to-drive">${ic('car')}<span><b>В дороге</b><small>голосом, коротко, крупно</small></span></button>`)
      case 'deep': {
        const on = el.getAttribute('aria-pressed') !== 'true'
        el.setAttribute('aria-pressed', String(on))
        return this.toast(on ? 'Подумаю дольше над следующим вопросом' : 'Обычный режим')
      }
      case 'cc': {
        this.subs = !this.subs
        el.setAttribute('aria-pressed', String(this.subs))
        this.q('.gr-drive').classList.toggle('no-subs', !this.subs)
        return this.toast(this.subs ? 'Фраза на экране — включена' : 'Только голос и опорная цифра')
      }
      case 'voice-sheet': return this.sheetVoice()
      case 'vpick':
        this.pick = el.dataset.v as VoicePick
        this.root.querySelectorAll('.gr-vcard').forEach((c) => c.classList.toggle('is-on', c === el))
        return
      case 'vplay': return this.previewVoice()
      case 'vapply': return this.applyVoice()
      case 'signal': return this.signal(el.dataset.sig!)
      case 'auto': this.auto = el.dataset.v as Auto; store.set('gr-auto', this.auto); return this.sheetSettings()
      case 'toggle': return this.toggleSignal(el.dataset.sig!)
      case 'sound': return this.sheetVoice()
      case 'bt-yes': this.closeAll(); return this.enterDrive('drive')
      case 'bt-no': this.declined = true; return this.closeAll()
      case 'banner-cancel': return this.cancelBanner()
      case 'demo-tile': return this.toast('В прототипе этого нет')
      case 'copy': return this.copyMsg(Number(el.dataset.i))
      case 'listen-msg': return this.readMsg(Number(el.dataset.i))
      case 'later': return this.laterMsg(Number(el.dataset.i))
      // drive
      case 'chip': return this.flavor === 'voice' ? this.toDriveFlavor() : undefined
      case 'road': return this.sheetRoad()
      case 'main': return this.mainButton()
      case 'go': return this.firstGo()
      case 'road-ev': this.closeAll(); return this.road(el.dataset.ev!)
      case 'call-end': return this.endCall()
      case 'call-take': return this.takeCall()
      // summary
      case 'trip-chat': return this.openTripChat()
      case 'continue': return this.enterDrive('drive')
      case 'sum-topic': return this.openTripChat()
    }
  }

  // ───────────────────────── chat

  private syncComposer() {
    const has = this.q<HTMLInputElement>('.gr-input').value.trim().length > 0
    const b = this.q('.gr-voice')
    b.innerHTML = has ? ic('up') : ic('wave')
    b.setAttribute('aria-label', has ? 'Отправить' : 'Голосовой разговор')
    b.classList.toggle('is-send', has)
  }

  private openChat(c: Chat | null) {
    this.open = c
    this.setView('chat')
    this.renderChat()
    this.renderDrawer()
  }

  private renderChat() {
    const c = this.open
    this.q('.gr-title').textContent = c ? c.title : ''
    const th = this.q('.gr-thread')
    const sugs = this.q('.gr-sugs')
    if (!c || !c.msgs.length) {
      const h = new Date().getHours()
      const hi = h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'
      th.innerHTML = `<div class="gr-empty"><img src="${CHAR('neutral')}" alt=""><h1>${hi}, Никита</h1><p>Что обсудим?</p></div>`
      sugs.innerHTML =
        [
          ['chart', 'Ставка ЦБ', 'Как изменится ключевая ставка в ближайший месяц?'],
          ['game', 'Half-Life 3', 'Какие свежие слухи о Half-Life 3?'],
        ]
          .map((s) => `<button class="gr-tile" data-act="sug" data-q="${esc(s[2])}">${ic(s[0])}<b>${s[1]}</b></button>`)
          .join('') +
        `<button class="gr-tile is-drive" data-act="sug" data-drive="1">${ic('car')}<b>В дорогу</b></button><button class="gr-tile" data-act="voice">${ic('wave')}<b>Голосом</b></button>`
      sugs.hidden = false
      return
    }
    sugs.hidden = true
    th.innerHTML = c.msgs.map((m, i) => this.msgHtml(m, i, i === c.msgs.length - 1)).join('')
    th.scrollTop = th.scrollHeight
  }

  private msgHtml(m: Msg, i: number, lastMsg: boolean) {
    if (m.who === 'me')
      return `<div class="gr-me">${m.voice ? `<small>${ic('mic')} голосом · ${m.time}</small>` : ''}${esc(m.text ?? '')}</div>`
    const body = m.topic
      ? FULL[m.topic].map((p) => `<p><b class="${TAG_CLS[p.kind]}">${p.label}</b> ${esc(p.text)}</p>`).join('') +
        `<div class="gr-srcs">${SOURCES[m.topic].map((s) => `<a href="${s.url}" target="_blank" rel="noopener">${ic('link')}${s.name}</a>`).join('')}</div><small class="gr-asof">Данные на ${DATA_AS_OF}</small>`
      : `<p>${esc(m.text ?? '')}</p>`
    const mark = m.saved ? `<div class="gr-mark">${ic('bookmark')} Сохранено в дороге · ${m.saved}</div>` : ''
    const acts = `<div class="gr-acts">
      <button class="gr-ib is-s" data-act="copy" data-i="${i}" aria-label="Копировать">${ic('copy')}</button>
      <button class="gr-ib is-s" data-act="listen-msg" data-i="${i}" aria-label="Озвучить">${ic('speaker')}</button>
      <button class="gr-later${m.saved ? ' is-on' : ''}" data-act="later" data-i="${i}">${ic('bookmark')}${m.saved ? 'Сохранено' : 'На потом'}</button></div>`
    const presence = lastMsg ? `<div class="gr-presence"><img src="${CHAR('happy')}" alt="">Готово — ваш ход</div>` : ''
    return `<div class="gr-ai">${mark}${body}${acts}${presence}</div>`
  }

  /** a typed (or dictated) question in the chat */
  private async ask(text: string) {
    if (!this.open) {
      const c: Chat = { id: Date.now(), title: text.length > 28 ? text.slice(0, 27) + '…' : text, when: hhmm(), msgs: [] }
      this.chats.unshift(c)
      this.open = c
    }
    const c = this.open
    c.msgs.push({ who: 'me', text, time: hhmm() })
    this.renderChat()
    const th = this.q('.gr-thread')
    th.insertAdjacentHTML('beforeend', `<div class="gr-ai gr-thinking"><div class="gr-presence">${GOO}Думаю…</div></div>`)
    th.scrollTop = th.scrollHeight
    await wait(700)
    const it = understand(text)
    const t: Topic | null = it === 'rate' ? 'rate' : it === 'hl3' ? 'hl3' : null
    if (t) c.msgs.push({ who: 'ai', topic: t, time: hhmm() })
    else {
      const l = it === 'ambiguous' ? LINE.clarify : it === 'deposits' ? LINE.deposits : it === 'thanks' ? LINE.thanks : LINE.unknown
      c.msgs.push({ who: 'ai', text: l.text, time: hhmm() })
    }
    this.renderChat()
    this.renderDrawer()
  }

  private dictate() {
    if (!ears.canHear) return this.toast('Браузер не умеет распознавать речь — напишите текстом')
    const input = this.q<HTMLInputElement>('.gr-input')
    const b = this.q('.gr-dict')
    b.classList.add('is-on')
    earcon.listen()
    ears.listen({
      onPartial: (t) => (input.value = t),
      onFinal: (t) => {
        b.classList.remove('is-on')
        input.value = t
        this.syncComposer()
      },
      onSilence: () => b.classList.remove('is-on'),
      onError: (k) => {
        b.classList.remove('is-on')
        if (k === 'denied') this.toast('Нет доступа к микрофону')
      },
    })
  }

  private copyMsg(i: number) {
    const m = this.open?.msgs[i]
    if (!m) return
    const text = m.topic ? FULL[m.topic].map((p) => `${p.label} ${p.text}`).join('\n') : (m.text ?? '')
    navigator.clipboard?.writeText(text).then(() => this.toast('Скопировано'), () => this.toast('Не удалось скопировать'))
  }

  private readMsg(i: number) {
    const m = this.open?.msgs[i]
    if (!m) return
    voice.setOn(true)
    const c = m.topic ? CHAIN[m.topic][0] : null
    if (c) voice.speak(c.id, c.say)
    else voice.speak('-', m.text ?? '')
  }

  private laterMsg(i: number) {
    const c = this.open
    const m = c?.msgs[i]
    if (!c || !m) return
    m.saved = m.saved ? undefined : hhmm()
    if (m.saved) c.pinned = true
    this.toast(m.saved ? 'Отмечено, разговор закреплён в меню' : 'Отметка снята')
    this.renderChat()
    this.renderDrawer()
  }

  // ───────────────────────── menu, sheets

  private renderDrawer(filter = '') {
    const f = filter.toLowerCase()
    const list = this.chats.filter((c) => c.msgs.length && (!f || c.title.toLowerCase().includes(f)))
    const row = (c: Chat) => {
      const n = c.msgs.filter((m) => m.saved).length
      const sub = c.trip ? `${n ? `${n} сохранено · ` : ''}${c.when}` : c.when
      return `<button class="gr-row${c === this.open ? ' is-open' : ''}${c.trip && c.pinned ? ' is-trip' : ''}" data-act="chat" data-id="${c.id}">
        ${c.voice || c.trip ? ic('wave') : c.pinned ? ic('pin') : '<i></i>'}<span><b>${esc(c.title)}</b><small>${esc(sub)}</small></span></button>`
    }
    const pinned = list.filter((c) => c.pinned).sort((a, b) => Number(!!b.trip) - Number(!!a.trip))
    const rest = list.filter((c) => !c.pinned)
    this.q('.gr-drawer').innerHTML = `
      <label class="gr-search">${ic('search')}<input placeholder="Поиск по разговорам" value="${esc(filter)}" aria-label="Поиск по разговорам"></label>
      <button class="gr-nav" data-act="new">${ic('edit')}Новый чат</button>
      <button class="gr-nav is-accent" data-act="to-drive">${ic('car')}В дорогу</button>
      <button class="gr-nav is-dim" data-act="signals">${ic('bt')}Сигналы машины · демо</button>
      <a class="gr-nav is-dim" href="#/outside">${ic('car')}Поверх навигатора и виджет</a>
      ${pinned.length ? `<h3>Закреплённые</h3>${pinned.map(row).join('')}` : ''}
      <h3>Разговоры</h3>${rest.map(row).join('') || '<p class="gr-none">Ничего не нашлось</p>'}
      <div class="gr-me-row"><span class="gr-av">НГ</span><b>Никита Горбачев</b><button class="gr-ib" data-act="settings" aria-label="Настройки">${ic('gear')}</button></div>`
    const s = this.q<HTMLInputElement>('.gr-search input')
    s.addEventListener('input', () => {
      const v = s.value
      this.renderDrawer(v)
      const n = this.q<HTMLInputElement>('.gr-search input')
      n.focus()
      n.setSelectionRange(v.length, v.length)
    })
  }

  private openDrawer() {
    this.renderDrawer()
    this.root.querySelector('.gr')!.classList.add('is-drawer')
    this.q('.gr-scrim').hidden = false
    this.q('.gr-drawer').setAttribute('aria-hidden', 'false')
  }

  private closeAll() {
    const g = this.root.querySelector('.gr')!
    g.classList.remove('is-drawer')
    this.q('.gr-drawer').setAttribute('aria-hidden', 'true')
    const sh = this.q('.gr-sheet')
    sh.classList.remove('is-open')
    setTimeout(() => {
      if (!sh.classList.contains('is-open')) sh.hidden = true
    }, 260)
    this.q('.gr-scrim').hidden = true
  }

  private sheet(html: string, cls = '') {
    this.root.querySelector('.gr')!.classList.remove('is-drawer')
    const sh = this.q('.gr-sheet')
    sh.className = `gr-sheet ${cls}`
    sh.innerHTML = `<div class="gr-grab"></div>${html}`
    sh.hidden = false
    this.q('.gr-scrim').hidden = false
    requestAnimationFrame(() => sh.classList.add('is-open'))
  }

  private sheetPlus() {
    this.sheet(`
      <div class="gr-tiles">
        <button data-act="demo-tile">${ic('camera')}Камера</button><button data-act="demo-tile">${ic('image')}Фото</button><button data-act="demo-tile">${ic('file')}Файл</button>
      </div>
      <button class="gr-li" data-act="demo-tile">${ic('globe')}<span><b>Поиск в сети</b><small>Свежие новости и цифры</small></span></button>
      <button class="gr-li" data-act="demo-tile">${ic('bulb')}<span><b>Подумать дольше</b><small>Для сложных задач</small></span></button>
      <button class="gr-li is-accent" data-act="to-drive">${ic('car')}<span><b>В дорогу</b><small>Голосом, коротко, крупно</small></span></button>`)
  }

  private sheetSignals() {
    const gps = this.geoWatch ? 'вкл' : 'выкл'
    this.sheet(`
      <h2 class="gr-sh-h">Сигналы машины</h2>
      <p class="gr-sh-p">Браузер их не видит, поэтому здесь их можно изобразить. В приложении их ловит телефон: Bluetooth, датчики движения и GPS, фокус «Вождение», NFC-метка.</p>
      <button class="gr-li" data-act="signal" data-sig="bt">${ic('bt')}<span><b>Подключился к «LADA»</b><small>Bluetooth магнитолы, машина стоит</small></span></button>
      <button class="gr-li" data-act="signal" data-sig="motion">${ic('car')}<span><b>Поехали: больше 20 км/ч</b><small>датчики движения и GPS, приложение открыто</small></span></button>
      <button class="gr-li" data-act="signal" data-sig="focus">${ic('moon')}<span><b>Включился фокус «Вождение»</b><small>iPhone, автоматизация «Команд»</small></span></button>
      <button class="gr-li" data-act="signal" data-sig="nfc">${ic('nfc')}<span><b>Телефон в держателе с NFC-меткой</b><small>метка на держателе</small></span></button>
      <button class="gr-li" data-act="toggle" data-sig="gps">${ic('globe')}<span><b>Настоящий GPS: ${gps}</b><small>включится сам, если поедете быстрее 20 км/ч</small></span></button>`)
  }

  private sheetSettings() {
    const seg = (['ask', 'always', 'never'] as Auto[])
      .map((v) => `<button class="${this.auto === v ? 'is-on' : ''}" data-act="auto" data-v="${v}">${{ ask: 'Спрашивать', always: 'Всегда', never: 'Никогда' }[v]}</button>`)
      .join('')
    const tg = (k: string, icon: string, label: string) =>
      `<button class="gr-li gr-tg${this.signals[k] ? ' is-on' : ''}" data-act="toggle" data-sig="${k}">${ic(icon)}<span><b>${label}</b></span><i></i></button>`
    this.sheet(`
      <h2 class="gr-sh-h">В дороге</h2>
      <h3>Включаться сам</h3><div class="gr-seg">${seg}</div>
      <h3>Когда замечать</h3>
      ${tg('bt', 'bt', 'Bluetooth «LADA»')}${tg('motion', 'car', 'Едем больше 20 км/ч')}${tg('focus', 'moon', 'Фокус «Вождение»')}${tg('nfc', 'nfc', 'Метка на держателе')}${tg('charge', 'bulb', 'Зарядка в машине')}
      <button class="gr-li" data-act="sound">${ic('speaker')}<span><b>Голос и скорость</b><small>${this.soundOn ? { dmitri: 'Дмитрий', denis: 'Денис', system: 'голос браузера' }[voice.getVoice()] : 'без голоса'} · ${voice.getRate().toFixed(1).replace('.', ',')}×</small></span>${ic('chev')}</button>
      <p class="gr-sh-p">Выход: стоим 3 минуты или «приехали» → сводка и чат поездки.</p>`)
  }

  private subs = true
  private pick: VoicePick = 'dmitri'
  private vol = 1

  /** p08: voices as cards, a preview with a progress line, «Применить»; p16 sliders under it */
  private sheetVoice() {
    const cur: VoicePick = this.soundOn ? voice.getVoice() : 'none'
    this.pick = cur
    const cards: [VoicePick, string, Parameters<typeof CHAR>[0], string][] = [
      ['dmitri', 'Дмитрий', 'neutral', '#141416'],
      ['denis', 'Денис', 'curious', '#d5d6db'],
      ['system', 'Браузер', 'happy', '#cbb9a4'],
      ['none', 'Без голоса', 'sleepy', '#f2f2f4'],
    ]
    const r = voice.getRate()
    this.sheet(
      `<div class="gr-vs-h"><b>Голос</b><button class="gr-x" data-act="close" aria-label="Закрыть">${ic('x')}</button></div>
      <h3>Голоса</h3>
      <div class="gr-vcards">${cards.map(([id, n, ch, bg]) => `<button class="gr-vcard${id === cur ? ' is-on' : ''}" data-act="vpick" data-v="${id}" style="--bg:${bg}"><img src="${CHAR(ch)}" alt=""><span>${n}</span></button>`).join('')}</div>
      <h3>Послушать</h3>
      <div class="gr-vplay"><button class="gr-vplay-b" data-act="vplay" aria-label="Послушать">${ic('play')}</button><div class="gr-vtrack"><i></i><b></b></div></div>
      <div class="gr-sls">
        ${SL('rate', 'Скорость', 'speaker', r, 0.8, 1.3, `${r.toFixed(1).replace('.', ',')}×`)}
        ${SL('vol', 'Громкость', 'speaker', Math.round(this.vol * 100), 0, 100, String(Math.round(this.vol * 100)))}
      </div>
      <button class="gr-apply" data-act="vapply">Применить</button>`,
      'is-black',
    )
  }

  private async previewVoice() {
    if (this.pick === 'none') return this.toast('Без голоса: ответ — только на экране')
    const was = voice.getVoice()
    voice.setOn(true)
    voice.setVoice(this.pick)
    const track = this.root.querySelector<HTMLElement>('.gr-vtrack')
    const set = (p: number) => track?.style.setProperty('--p', p.toFixed(3))
    await voice.speak(LINE.rateShort.id, LINE.rateShort.say, { onProgress: set })
    set(1)
    voice.setVoice(was)
  }

  private applyVoice() {
    this.soundOn = this.pick !== 'none'
    voice.setOn(this.soundOn)
    if (this.pick !== 'none') voice.setVoice(this.pick)
    store.set('gr-voice', this.pick)
    this.toast(this.soundOn ? 'Голос сохранён' : 'Без голоса — ответы только на экране')
    this.closeAll()
  }

  /** drag or arrow keys on a p16 slider */
  private slide(el: HTMLElement, x: number | null, step = 0) {
    const min = Number(el.dataset.min), max = Number(el.dataset.max)
    let v = Number(el.dataset.v)
    if (x !== null) {
      const r = el.getBoundingClientRect()
      const p = Math.max(0, Math.min(1, (x - r.left - 48) / Math.max(1, r.width - 214)))
      v = min + p * (max - min)
    } else v = Math.max(min, Math.min(max, v + step * (max - min) / 20))
    const k = el.dataset.sl
    if (k === 'rate') v = Math.round(v * 20) / 20
    else v = Math.round(v)
    el.dataset.v = String(v)
    el.setAttribute('aria-valuenow', String(v))
    const fill = el.querySelector<HTMLElement>('.gr-sl-fill')!
    fill.style.setProperty('--p', String((v - min) / (max - min)))
    fill.querySelector('b')!.textContent = k === 'rate' ? `${v.toFixed(2).replace(/0$/, '').replace('.', ',')}×` : String(v)
    if (k === 'rate') {
      voice.setRate(v)
      store.set('gr-rate', String(v))
    } else {
      this.vol = v / 100
      voice.setVolume(this.vol)
      store.set('gr-vol', String(this.vol))
    }
  }

  private toggleSignal(k: string) {
    if (k === 'gps') {
      if (this.geoWatch) {
        navigator.geolocation.clearWatch(this.geoWatch)
        this.geoWatch = 0
        this.toast('GPS выключен')
      } else this.watchGps()
      return this.closeAll()
    }
    this.signals[k] = !this.signals[k]
    store.set('gr-signals', JSON.stringify(this.signals))
    this.sheetSettings()
  }

  /** real speed from GPS: > 20 km/h for 20 s → moving; ~0 for 3 min → a stop */
  private watchGps() {
    if (!navigator.geolocation) return this.toast('Нет геолокации')
    this.geoWatch = navigator.geolocation.watchPosition(
      (p) => {
        const v = (p.coords.speed ?? 0) * 3.6
        const now = Date.now()
        if (v > 20) {
          this.stillSince = 0
          this.fastSince ||= now
          if (now - this.fastSince > 20000 && this.view === 'chat') {
            this.fastSince = now + 600000 // once per ten minutes
            this.signal('motion')
          }
        } else if (v < 2) {
          this.fastSince = 0
          this.stillSince ||= now
          if (now - this.stillSince > 180000 && this.view === 'drive' && this.flavor === 'drive') {
            this.stillSince = now + 600000
            this.arrive()
          }
        }
      },
      () => this.toast('Нет доступа к геолокации'),
      { enableHighAccuracy: true, maximumAge: 2000 },
    )
    this.toast('GPS включён: заметит, когда поедете')
  }

  /** a car signal. Simplifying the screen is safe to do alone; the microphone waits for consent */
  private signal(s: string) {
    this.closeAll()
    const key = s === 'focus' ? 'focus' : s
    if (key !== 'motion' && this.signals[key] === false) return this.toast('Этот сигнал выключен в настройках «В дороге»')
    if (this.auto === 'never') return this.toast('В настройках: не включаться самому')
    if (this.view !== 'chat') return this.toast('Режим уже включён')
    if (s === 'nfc' || this.auto === 'always') return this.enterDrive('drive')
    if (s === 'bt') {
      if (this.declined) return this.toast('В этой поездке больше не спрашиваю')
      return this.sheet(`
        <div class="gr-sh-ic">${ic('bt')}</div>
        <h2 class="gr-sh-h">Вы в машине?</h2>
        <p class="gr-sh-p">Телефон подключился к «LADA». В режиме «В дороге» GRIF говорит коротко, а длинное откладывает на потом.</p>
        <button class="gr-wide is-primary" data-act="bt-yes">Включить</button>
        <button class="gr-wide" data-act="bt-no">Не сейчас</button>
        <p class="gr-sh-note">Включаться без вопроса — в настройках.</p>`)
    }
    this.banner()
  }

  private banner() {
    const b = this.q('.gr-banner')
    b.innerHTML = `${ic('car')}<span><b>Вы едете — включаю «В дороге»</b><small>Чат сохранится</small></span><i class="gr-count">3</i><button data-act="banner-cancel">Отмена</button>`
    b.hidden = false
    let n = 3
    clearInterval(this.bannerTimer)
    this.bannerTimer = window.setInterval(() => {
      n--
      const c = b.querySelector('.gr-count')
      if (c) c.textContent = String(n)
      if (n <= 0) {
        clearInterval(this.bannerTimer)
        b.hidden = true
        this.enterDrive('drive')
      }
    }, 1000)
  }

  private cancelBanner() {
    clearInterval(this.bannerTimer)
    this.q('.gr-banner').hidden = true
    this.declined = true
    this.toast('Остаёмся в чате. В этой поездке больше не спрашиваю')
  }

  private sheetRoad() {
    const v = this.flavor === 'voice'
    this.sheet(`
      <h2 class="gr-sh-h">${v ? 'Голосовой разговор' : 'Что может случиться в дороге'}</h2>
      <p class="gr-sh-p">Демо: так ведёт себя GRIF, когда что-то идёт не по плану.</p>
      ${v ? `<button class="gr-li" data-act="road-ev" data-ev="end">${ic('x')}<span><b>Завершить разговор</b><small>вернуться в чат</small></span></button>` : `<button class="gr-li is-accent" data-act="road-ev" data-ev="arrive">${ic('car')}<span><b>Приехали</b><small>или «GRIF, приехали», или стоим 3 минуты</small></span></button>`}
      <button class="gr-li" data-act="road-ev" data-ev="net">${ic('wifioff')}<span><b>${this.offline ? 'Связь вернулась' : 'Пропала связь'}</b><small>трасса, тоннель</small></span></button>
      <button class="gr-li" data-act="road-ev" data-ev="call">${ic('phone')}<span><b>Входящий звонок</b><small>GRIF замолкает сразу</small></span></button>
      <button class="gr-li" data-act="road-ev" data-ev="quiet">${ic('moon')}<span><b>«Помолчи»</b><small>на дороге сложно — тишина до «ась»</small></span></button>
      <button class="gr-li" data-act="road-ev" data-ev="mic">${ic('micoff')}<span><b>${this.denied ? 'Микрофон снова доступен' : 'Нет доступа к микрофону'}</b><small>разрешение отозвано</small></span></button>`)
  }

  // ───────────────────────── views

  private setView(v: View) {
    this.view = v
    this.root.querySelector<HTMLElement>('.gr')!.dataset.view = v
    this.changedAt = performance.now()
    if (v !== 'drive') {
      this.stopAudio()
      stopWake()
      this.hz?.set('off')
    }
  }

  private enterDrive(flavor: 'drive' | 'voice') {
    this.closeAll()
    clearInterval(this.bannerTimer)
    this.q('.gr-banner').hidden = true
    this.flavor = flavor
    if (flavor === 'drive') {
      if (!this.trip || this.tripEnded) {
        this.trip = { id: Date.now(), title: `Поездка · ${dayShort()}`, when: hhmm(), trip: true, voice: true, msgs: [] }
        this.chats.unshift(this.trip)
        this.saved.clear()
        this.topic = null
        this.idx = 0
        this.last = null
        this.pending = null
        this.tripStart = Date.now()
        this.tripEnded = false
      }
      this.conv = this.trip
    } else {
      if (!this.open) {
        this.open = { id: Date.now(), title: 'Голосовой разговор', when: hhmm(), voice: true, msgs: [] }
        this.chats.unshift(this.open)
      }
      this.conv = this.open
    }
    this.q('.gr-drive').classList.toggle('is-voice', flavor === 'voice')
    this.q('.gr-chip-t').textContent = flavor === 'voice' ? 'В машине? «В дороге»' : 'В дороге'
    this.setView('drive')
    this.tick()
    clearInterval(this.clock)
    this.clock = window.setInterval(() => this.tick(), 15000)
    if (flavor === 'drive' && !this.firstDone) return this.showFirst()
    this.toReady()
  }
  private tripEnded = false

  private toDriveFlavor() {
    if (this.conv) {
      this.conv.trip = true
      this.trip = this.conv
      this.tripStart = Date.now()
      this.tripEnded = false
    }
    this.flavor = 'drive'
    this.q('.gr-drive').classList.remove('is-voice')
    this.q('.gr-chip-t').textContent = 'В дороге'
    this.tick()
    this.toast('Режим «В дороге»: разговор тот же')
  }

  private tick() {
    const el = this.q('.gr-clock')
    if (this.flavor === 'voice') return void (el.textContent = '')
    const min = Math.max(0, Math.round((Date.now() - this.tripStart) / 60000))
    el.textContent = min < 60 ? `${min} мин в пути` : `${Math.floor(min / 60)} ч ${min % 60} мин`
  }

  private showFirst() {
    const f = this.q('.gr-first')
    const net = navigator.onLine
    this.q('.gr-checks').innerHTML = [
      [ears.canHear, ears.canHear ? 'Микрофон' : 'Микрофон: только касание'],
      [net, net ? 'Сеть' : 'Нет сети'],
      [true, 'Звук: динамик'],
    ]
      .map(([ok, t]) => `<span class="${ok ? 'is-ok' : 'is-no'}">${ic(ok ? 'check' : 'x')}${t}</span>`)
      .join('')
    f.hidden = false
    this.hz?.set('ready')
  }

  private async firstGo() {
    this.firstDone = true
    store.set('gr-first', '1')
    this.q('.gr-first').hidden = true
    this.toReady()
    if (this.soundOn) this.play(LINE.hello, { keep: false, quietUi: true })
    // ask for the microphone right away, but do not hold the screen while the prompt is open
    if (ears.canHear) {
      this.askedMic = true
      this.micOK = await ears.openMeter()
      ears.closeMeter()
      if (this.micOK && this.md === 'ready') this.toReady()
    }
  }

  // ───────────────────────── drive: screen states

  private mode(m: Mode, o: { label?: string; c?: Chunk; phrase?: string; ask?: string; char?: Parameters<typeof CHAR>[0] | null; hint?: string; btn?: [string, string, boolean?]; glow?: Glow } = {}) {
    this.md = m
    this.changedAt = performance.now()
    const d = this.q('.gr-drive')
    d.dataset.mode = m
    const c = o.c
    const label = o.label ?? { ready: 'ГОТОВ', listen: 'СЛУШАЮ', think: 'ИЩУ', speak: 'ГОВОРЮ', pause: 'ПАУЗА', quiet: 'ТИХО', offline: 'НЕТ СВЯЗИ', denied: 'НЕ СЛЫШУ', call: 'ПАУЗА · ЗВОНОК' }[m]
    this.q('.gr-label').textContent = label
    const tag = this.q('.gr-tag')
    tag.hidden = !c?.tag
    if (c?.tag) {
      tag.textContent = c.tag.text
      tag.className = `gr-tag ${TAG_CLS[c.tag.kind]}`
    }
    const big = this.q('.gr-big')
    big.hidden = !c?.big
    if (c?.big) {
      big.textContent = c.big
      big.classList.toggle('is-long', c.big.length > 5)
    }
    const cap = this.q('.gr-cap')
    cap.hidden = !c?.cap
    if (c?.cap) cap.textContent = c.cap
    const ph = this.q('.gr-phrase')
    const text = o.phrase ?? c?.text ?? ''
    ph.innerHTML = c ? text.split(/(\s+)/).map((w) => (w.trim() ? `<span>${esc(w)}</span>` : w)).join('') : esc(text)
    ph.classList.toggle('is-k', !!c)
    ph.classList.toggle('is-dim', !c && m !== 'listen')
    const ask = this.q('.gr-ask')
    ask.hidden = !o.ask
    if (o.ask) ask.textContent = o.ask
    const ch = this.q<HTMLImageElement>('.gr-char')
    const charName = o.char === undefined ? ({ ready: 'neutral', pause: 'sleepy', quiet: 'sleepy', offline: 'neutral', denied: 'neutral', call: 'sleepy' } as Record<string, Parameters<typeof CHAR>[0]>)[m] : o.char
    ch.hidden = !charName
    if (charName) ch.src = CHAR(charName)
    this.q('.gr-hint').textContent = o.hint ?? ''
    const [bt, bi, primary] = o.btn ?? (({
      ready: ['Спросить', 'mic', true],
      listen: ['Стоп', 'stop'],
      think: ['Стоп', 'stop'],
      speak: ['Пауза', 'pause'],
      pause: ['Продолжить', 'play', true],
      quiet: ['Спросить', 'mic'],
      offline: ['Повторить ответ', 'repeat'],
      denied: ['Открыть настройки', 'gear'],
      call: ['Продолжить', 'play'],
    } as Record<Mode, [string, string, boolean?]>)[m])
    const b = this.q('.gr-btn[data-act="main"]')
    b.classList.toggle('is-primary', !!primary)
    b.querySelector('.gr-btn-i')!.innerHTML = ic(bi)
    b.querySelector('.gr-btn-t')!.textContent = bt
    const st = this.q('.gr-status')
    st.hidden = !this.offline && !this.denied
    st.className = `gr-status ${this.denied ? 'is-red' : 'is-amber'}`
    st.innerHTML = this.denied ? `${ic('micoff')}Микрофон` : `${ic('wifioff')}Нет сети`
    this.hz?.set(o.glow ?? ({ ready: 'ready', listen: 'listen', think: 'think', speak: 'speak', pause: 'pause', quiet: 'quiet', offline: 'offline', denied: 'denied', call: 'pause' } as Record<Mode, Glow>)[m])
  }

  private toReady(hint?: string) {
    this.stopMeter()
    if (this.denied) return this.mode('denied', { phrase: LINE.mic.text, hint: 'Касание задаёт следующий вопрос из демо' })
    if (this.offline) return this.mode('offline', { phrase: LINE.offline.text, hint: 'Без сети: «повтори», «сохрани», «пауза»' })
    const tapOnly = !this.micOK || !ears.canHear
    const fork = this.pending === 'next' || this.pending === 'save' || this.pending === 'resume'
    this.mode('ready', {
      phrase: fork ? 'Скажите «да» или задайте новый вопрос' : 'Скажите «ась» или коснитесь экрана',
      hint: hint ?? (tapOnly ? 'Без микрофона: касание — следующая реплика демо' : 'Весь экран — одна большая кнопка'),
    })
    this.armWake()
    if (this.queuedAsk) {
      const t = this.queuedAsk
      this.queuedAsk = null
      this.handle(t === 'rate' ? 'Какая ключевая ставка?' : 'Что с Half-Life 3?', false)
    }
  }

  private armWake() {
    stopWake()
    if (!this.micOK || !canWake || this.view !== 'drive' || this.denied) return
    startWake(
      (rest) => {
        if (this.view !== 'drive') return
        earcon.listen()
        if (rest) this.handle(rest)
        else this.listen()
      },
      () => {
        this.micOK = false
      },
    )
  }

  // ───────────────────────── drive: touch

  private onDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, .gr-first, .gr-call-card')) return
    if (this.down && this.down.id !== e.pointerId) return void (this.down = null) // a second finger cancels
    this.down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }
  }
  private onUp = (e: PointerEvent) => {
    const d = this.down
    this.down = null
    if (!d || d.id !== e.pointerId) return
    const dt = performance.now() - d.t
    const dy = e.clientY - d.y
    if (dy > 70 && Math.abs(e.clientX - d.x) < 60) return this.stop() // swipe down = stop
    if (dt < 60 || dt > 700 || Math.hypot(e.clientX - d.x, dy) > 12) return
    if (performance.now() - this.changedAt < 300) return // a tap right after a change is a stray
    this.firstGesture()
    this.tap()
  }

  /** the whole screen is one button */
  private tap() {
    vib(10)
    switch (this.md) {
      case 'speak':
      case 'think':
        return this.pause()
      case 'pause':
        return this.resume()
      case 'listen':
        return this.stop()
      case 'call':
        return
      default:
        return this.listen()
    }
  }

  private mainButton() {
    if (this.md === 'denied') return this.toast('В браузере: значок замка у адреса → Микрофон → Разрешить')
    if (this.md === 'offline') return this.repeat()
    if (this.md === 'call') return this.endCall()
    this.tap()
  }

  // ───────────────────────── drive: dialogue

  private async listen(follow = false) {
    let tk = ++this.tok
    stopWake()
    this.stopAudio(false)
    // the microphone is asked for on the first tap, never on its own
    if (!this.micOK && ears.canHear && !this.denied && !this.askedMic && !follow) {
      this.askedMic = true
      this.mode('listen', { phrase: 'Разрешите микрофон — и спрашивайте голосом', char: 'attentive' })
      this.micOK = await ears.openMeter()
      ears.closeMeter()
      if (tk !== this.tok) return
      tk = ++this.tok
    }
    const tapOnly = !this.micOK || !ears.canHear || this.denied
    if (follow && tapOnly) return this.toReady()
    this.mode('listen', {
      phrase: follow ? 'Слушаю ответ…' : 'Слушаю…',
      ask: this.pending === 'clarify' ? 'Скажите «ставку» или «вклады»' : undefined,
      char: 'attentive',
      hint: follow ? 'Молчите 5 с — вернусь к готовности' : 'Договорите — пойму по паузе',
    })
    earcon.listen()
    vib(12)
    if (tapOnly) return this.fake(DEMO[this.demo++ % DEMO.length], tk)
    let heard = ''
    const end = window.setTimeout(() => tk === this.tok && (ears.stopListening(), this.heardNothing(heard, follow)), follow ? 5000 : 8000)
    ears.listen({
      onPartial: (t) => {
        if (tk !== this.tok) return
        heard = t
        this.showHeard(t)
      },
      onFinal: (t) => {
        clearTimeout(end)
        if (tk === this.tok) this.handle(t)
      },
      onSilence: () => {
        clearTimeout(end)
        if (tk === this.tok) this.heardNothing(heard, follow)
      },
      onError: (k) => {
        clearTimeout(end)
        if (tk !== this.tok) return
        if (k === 'denied') {
          this.micOK = false
          this.denied = true
          return this.play(LINE.mic, { keep: false, mode: 'denied' })
        }
        this.heardNothing(heard, follow)
      },
    })
    if (await ears.openMeter()) this.runMeter(tk)
  }

  private runMeter(tk: number) {
    cancelAnimationFrame(this.meterRaf)
    const loop = () => {
      if (tk !== this.tok || this.md !== 'listen') return ears.closeMeter()
      const lv = ears.level()
      this.hz?.level(lv)
      this.q('.gr-ring').style.setProperty('--lv', lv.toFixed(3))
      this.meterRaf = requestAnimationFrame(loop)
    }
    loop()
  }
  private stopMeter() {
    cancelAnimationFrame(this.meterRaf)
    ears.closeMeter()
    this.hz?.level(0)
  }

  private showHeard(t: string) {
    const ph = this.q('.gr-phrase')
    ph.classList.remove('is-dim', 'is-k')
    ph.textContent = `«${t}»`
  }

  private heardNothing(heard: string, follow: boolean) {
    if (heard) return this.handle(heard)
    if (this.pending === 'clarify') {
      this.pending = null
      return this.topicStart('rate', 'Расскажу про ставку ЦБ')
    }
    if (follow) {
      this.pending = null
      return this.toReady()
    }
    this.toReady('Не расслышал. Коснитесь и спросите ещё раз')
  }

  /** tap-only mode: the next demo line «is said» word by word */
  private async fake(text: string, tk: number) {
    const words = text.split(' ')
    for (let i = 1; i <= words.length; i++) {
      await wait(110 + Math.random() * 60)
      if (tk !== this.tok) return
      this.showHeard(words.slice(0, i).join(' '))
      this.hz?.level(0.4 + Math.random() * 0.5)
    }
    this.hz?.level(0)
    await wait(350)
    if (tk === this.tok) this.handle(text)
  }

  private logMe(text: string) {
    this.conv?.msgs.push({ who: 'me', text, voice: true, time: hhmm() })
  }
  private logAi(m: Omit<Msg, 'who' | 'time'>) {
    this.conv?.msgs.push({ who: 'ai', time: hhmm(), ...m })
  }

  private handle(text: string, log = true) {
    this.stopMeter()
    const it: Intent = understand(text)
    const asked = ['rate', 'hl3', 'ambiguous', 'deposits', 'digits', 'compare', 'sources', 'unknown'].includes(it)
    if (asked && log) this.logMe(text.replace(/^./, (c) => c.toUpperCase()))
    // offline: local commands still work, questions wait in a queue
    if (this.offline && ['rate', 'hl3', 'ambiguous', 'deposits', 'digits', 'compare', 'sources', 'why', 'more', 'yes'].includes(it)) {
      this.queued = text
      return this.play(LINE.offline, { keep: false, mode: 'offline' })
    }
    const p = this.pending
    if (p === 'clarify') {
      this.pending = null
      if (it === 'deposits') return this.line(LINE.deposits, 'deposits')
      if (it === 'rate' || it === 'ambiguous' || it === 'yes') return this.topicStart('rate')
    }
    if (p === 'resume') {
      this.pending = null
      if (it === 'yes' || it === 'resume' || it === 'more') return this.resume()
      if (it === 'no') return this.toReady()
    }
    // the chunk ended with «рассказать почему / откуда?» — any of these means «да»
    if (p === 'next' && this.topic && ['yes', 'more', 'why', 'sources'].includes(it)) return this.next()
    switch (it) {
      case 'rate': return this.topicStart('rate')
      case 'hl3': return this.topicStart('hl3')
      case 'ambiguous':
        this.pending = 'clarify'
        return this.play(LINE.clarify, { keep: false, label: 'УТОЧНЯЮ', follow: true, char: 'curious', ask: 'Скажите «ставку» или «вклады»' })
      case 'deposits': return this.line(LINE.deposits, 'deposits')
      case 'yes':
      case 'more':
      case 'why':
        if (p === 'save' && it === 'yes') return this.save()
        if (!this.topic) return this.line(LINE.unknown, 'unknown')
        if (this.idx < CHAIN[this.topic].length - 1) return this.next()
        return this.line(this.topic === 'rate' ? LINE.rateSrc : LINE.hlSrc)
      case 'no':
        this.pending = null
        return this.toReady()
      case 'short':
        this.pending = null
        if (!this.topic) return this.line(LINE.unknown, 'unknown')
        return this.line(this.topic === 'rate' ? LINE.rateShort : LINE.hlShort)
      case 'repeat': return this.repeat()
      case 'digits':
        if (this.topic === 'hl3') return this.line(LINE.hlSrc)
        this.topic = 'rate'
        return this.line(LINE.rateDigits, 'digits')
      case 'compare':
        if (this.topic === 'hl3') return this.line(LINE.hlShort)
        this.topic = 'rate'
        return this.line(LINE.rateCompare, 'compare')
      case 'sources':
        if (!this.topic) return this.line(LINE.unknown, 'unknown')
        return this.line(this.topic === 'rate' ? LINE.rateSrc : LINE.hlSrc, 'sources')
      case 'pause': return this.pause()
      case 'resume': return this.resume()
      case 'stop': return this.stop()
      case 'quiet': return this.quiet()
      case 'save': return this.save()
      case 'arrived': return this.arrive()
      case 'thanks': return this.line(LINE.thanks)
      default: return this.line(LINE.unknown, 'unknown')
    }
  }

  private topicStart(t: Topic, note?: string) {
    this.topic = t
    this.idx = 0
    this.pending = null
    if (!this.conv?.msgs.some((m) => m.topic === t)) this.logAi({ topic: t })
    else {
      // asked again: move the full answer down to the latest question
      const i = this.conv.msgs.findIndex((m) => m.topic === t)
      const [m] = this.conv.msgs.splice(i, 1)
      this.conv.msgs.push(m)
    }
    const think = note ?? (t === 'rate' ? 'Смотрю решение Банка России от 23 октября и свежие прогнозы' : 'Смотрю новости игровых сайтов за неделю')
    this.play(CHAIN[t][0], { think })
  }

  private next() {
    if (!this.topic) return
    this.idx++
    this.play(CHAIN[this.topic][this.idx])
  }

  /** a one-off reply; logged in the trip chat when it is an answer, not a control */
  private line(l: Chunk, log?: string) {
    this.pending = null
    if (log && log !== 'sources') this.logAi({ text: l.text, tag: l.tag })
    this.play(l, { keep: !['g-unknown', 'g-thanks'].includes(l.id) })
  }

  private async play(c: Chunk, o: { think?: string; keep?: boolean; label?: string; follow?: boolean; char?: Parameters<typeof CHAR>[0]; ask?: string; mode?: Mode; quietUi?: boolean } = {}) {
    const tk = ++this.tok
    stopWake()
    ears.stopListening()
    this.stopMeter()
    if (o.keep !== false) this.last = c
    if (o.think) {
      this.mode('think', { phrase: o.think, char: null, hint: 'Дольше 3 секунд — скажу, что ищу' })
      await wait(1000 + Math.random() * 500)
      if (tk !== this.tok) return
    }
    const chain = this.topic ? CHAIN[this.topic] : []
    const pos = chain.indexOf(c)
    const label = o.label ?? (pos >= 0 ? `ГОВОРЮ · ${pos + 1} ИЗ ${chain.length}` : undefined)
    if (!o.quietUi) {
      this.mode(o.mode ?? 'speak', {
        c: c.text ? c : undefined,
        label,
        char: o.char ?? (o.mode ? undefined : null),
        ask: o.ask,
        hint: o.mode === 'offline' ? 'Без сети: «повтори», «сохрани», «пауза»' : '«короче» · «повтори» · «сохрани»',
      })
      if (o.mode && o.mode !== 'speak') this.hz?.set(o.mode === 'denied' ? 'denied' : o.mode === 'offline' ? 'offline' : 'speak')
      else this.hz?.set('speak')
    }
    const spans = [...this.q('.gr-phrase').querySelectorAll('span')]
    const karaoke = (p: number) => {
      const n = Math.round(p * spans.length)
      spans.forEach((s, i) => s.classList.toggle('on', i < n))
    }
    if (this.soundOn && voice.isOn()) {
      await voice.speak(c.id, c.say, { onLevel: (v) => this.hz?.level(v), onWord: () => this.hz?.pulse(), onProgress: karaoke })
    } else await this.silentRead(c.say.length * 58, karaoke, tk)
    if (tk !== this.tok) return
    karaoke(1)
    this.hz?.level(0)
    if (o.quietUi) return this.toReady()
    if (o.mode === 'offline') return this.toReady()
    if (o.mode === 'denied') return this.toReady()
    if (c.fork) {
      this.pending = c.fork
      return this.listen(true)
    }
    if (o.follow) return this.listen(true)
    this.toReady()
  }

  /** without sound the sentence still runs on screen, at speaking pace */
  private silentRead(ms: number, karaoke: (p: number) => void, tk: number) {
    return new Promise<void>((resolve) => {
      const t0 = performance.now()
      let lastPulse = 0
      const step = () => {
        if (tk !== this.tok) return resolve()
        const p = (performance.now() - t0) / ms
        karaoke(Math.min(1, p))
        this.hz?.level(0.35 + 0.25 * Math.sin(performance.now() / 90))
        if (performance.now() - lastPulse > 230) {
          lastPulse = performance.now()
          this.hz?.pulse()
        }
        if (p >= 1) return resolve()
        requestAnimationFrame(step)
      }
      step()
    })
  }

  private stopAudio(withTok = true) {
    if (withTok) this.tok++
    voice.stop()
    ears.stopListening()
    this.stopMeter()
  }

  private pause() {
    const spoken = [...this.q('.gr-phrase').querySelectorAll('span.on')].map((s) => s.textContent).slice(-5).join(' ')
    this.stopAudio()
    this.mode('pause', { phrase: spoken ? `Остановился на «…${spoken}»` : 'Пауза', hint: 'Скажите «продолжай» или коснитесь' })
    this.armWake()
  }

  private resume() {
    if (!this.last) return this.toReady()
    this.play(this.last)
  }

  private repeat() {
    if (!this.last) return this.line(LINE.unknown)
    this.play(this.last)
  }

  private stop() {
    this.stopAudio()
    this.pending = null
    earcon.stop()
    this.toReady()
  }

  private quiet() {
    this.stopAudio()
    this.pending = null
    this.mode('quiet', { phrase: 'Молчу, пока не скажете «ась»', hint: '«помолчи», «стоп» или касание — тишина сразу' })
    this.armWake()
  }

  private save() {
    this.pending = null
    if (!this.topic) return this.play({ id: 'g-nothing', text: 'Пока нечего сохранять — спросите что-нибудь.', say: 'Пока нечего сохранять.' }, { keep: false })
    const m = [...(this.conv?.msgs ?? [])].reverse().find((x) => x.topic === this.topic)
    if (m && !m.saved) m.saved = hhmm()
    this.saved.add(this.topic)
    if (this.conv) this.conv.pinned = true
    earcon.ready()
    vib([10, 40, 10])
    this.play({ ...LINE.saved, tag: { text: '✓ СОХРАНЕНО · ЧАТ ПОЕЗДКИ', kind: 'fact' } }, { keep: false, label: 'СОХРАНЕНО', char: 'proud' })
  }

  // ───────────────────────── drive: road events

  private onNet = () => {
    const off = !navigator.onLine
    if (off === this.offline) return
    this.road('net')
  }

  private road(ev: string) {
    if (ev === 'arrive') return this.arrive()
    if (ev === 'end') return this.openChat(this.conv)
    if (ev === 'quiet') return this.quiet()
    if (ev === 'call') return this.call()
    if (ev === 'mic') {
      this.denied = !this.denied
      if (this.denied) {
        stopWake()
        return this.play(LINE.mic, { keep: false, mode: 'denied' })
      }
      this.toast('Микрофон снова доступен')
      return this.toReady()
    }
    if (ev === 'net') {
      this.offline = !this.offline
      if (this.offline) return this.play(LINE.offline, { keep: false, mode: 'offline' })
      this.toast('Связь вернулась')
      earcon.ready()
      const q = this.queued
      this.queued = null
      if (q) return this.handle(q, false)
      return this.toReady()
    }
  }

  private callTimer = 0
  private call() {
    this.stopAudio()
    stopWake()
    this.q('.gr-call').hidden = false
    this.q('.gr-call-st').textContent = 'мобильный'
    this.q('.gr-drive').classList.remove('is-talking')
    this.mode('call', {
      phrase: this.topic ? `После звонка спрошу: продолжить про ${this.topic === 'rate' ? 'ставку' : 'Half-Life'}?` : 'После звонка вернусь к готовности',
      hint: 'Уведомления поверх GRIF не озвучивает',
    })
  }
  private takeCall() {
    this.q('.gr-drive').classList.add('is-talking')
    let s = 0
    const st = this.q('.gr-call-st')
    clearInterval(this.callTimer)
    this.callTimer = window.setInterval(() => {
      s++
      st.textContent = `разговор 0:0${s}`
      if (s >= 4) this.endCall()
    }, 1000)
  }
  private endCall() {
    clearInterval(this.callTimer)
    this.q('.gr-call').hidden = true
    this.q('.gr-drive').classList.remove('is-talking')
    if (this.md !== 'call') return
    if (this.topic && this.last) {
      this.pending = 'resume'
      return this.play(this.topic === 'rate' ? LINE.backRate : LINE.backHl, { keep: false, follow: true, label: 'ПОСЛЕ ЗВОНКА' })
    }
    this.toReady()
  }

  // ───────────────────────── stop and after

  private arrive() {
    this.stopAudio()
    stopWake()
    this.pending = null
    clearInterval(this.clock)
    this.tripEnded = true
    if (this.trip) {
      this.trip.pinned = true
      this.trip.when = `${this.q('.gr-clock').textContent || '0 мин'}`
    }
    const min = Math.max(0, Math.round((Date.now() - this.tripStart) / 60000))
    const t = this.saved.size
    this.q('.gr-sum').innerHTML = `
      <header class="gr-top"><span class="gr-chip is-still">${ic('car')}Остановка</span><span class="gr-clock">${min < 60 ? `${min} мин` : `${Math.floor(min / 60)} ч ${min % 60} мин`}</span></header>
      <img class="gr-char" src="${CHAR('happy')}" alt="">
      <div class="gr-label">ОСТАНОВКА · СОХРАНЕНО ${t}</div>
      <h2 class="gr-sum-h">${t ? 'Теперь можно<br>почитать' : 'Остановка'}</h2>
      ${t ? [...this.saved].map((s) => `<button class="gr-card" data-act="sum-topic"><b>${TOPIC_TITLE[s]}</b><small>${s === 'rate' ? 'факт · прогноз ЦБ · 3 источника' : 'слух · 3 источника'}</small>${ic('chev')}</button>`).join('') : '<p class="gr-sum-p">Ничего не сохраняли. Весь разговор — в чате поездки.</p>'}
      <div class="gr-sum-foot">
        <button class="gr-wide is-primary" data-act="trip-chat">Открыть чат поездки</button>
        <button class="gr-wide" data-act="continue">Продолжить поездку</button>
        <p class="gr-sh-note">Оценивать разговор не нужно</p>
      </div>`
    this.setView('summary')
    if (this.soundOn && voice.isOn())
      voice.speak(LINE.arrived.id, t ? `Остановка. Сохранил ${t === 1 ? 'один ответ' : 'два ответа'} — они в чате поездки.` : LINE.arrived.say)
  }

  private openTripChat() {
    this.openChat(this.trip)
  }

  private toast(t: string) {
    const el = this.q('.gr-toast')
    el.textContent = t
    el.classList.add('is-on')
    clearTimeout((el as any)._t)
    ;(el as any)._t = setTimeout(() => el.classList.remove('is-on'), 2400)
  }

  destroy() {
    this.stopAudio()
    stopWake()
    clearInterval(this.clock)
    clearInterval(this.bannerTimer)
    clearInterval(this.callTimer)
    if (this.geoWatch) navigator.geolocation.clearWatch(this.geoWatch)
    removeEventListener('online', this.onNet)
    removeEventListener('offline', this.onNet)
    this.hz?.destroy()
  }
}
