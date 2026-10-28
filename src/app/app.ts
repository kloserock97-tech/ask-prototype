// «ась?» — one working scenario: the driver asks about the key rate.
//
// «Light from below» (research/13): ась is a light rising from the bottom edge
// through a grid of dots. Everything the driver deals with sits low, near the
// thumb, as a stack growing up from the bottom (video 4): the question card, the
// answer card above it — outline first, then the content, its figure built from
// sparks out of the light — and two action cards. A previous answer folds up into
// a strip at the top (video 1). The dock at the very bottom is a status capsule and
// ась's own round button. The whole screen is one tap target except the controls.
//
// An answer shows three layers: a title, one big «head» and a short line. The full
// sentence is spoken and runs as captions while it plays. Like Alice, an answer that
// ends with a question keeps listening for a few seconds — «да» needs no tap.

import { EASE_OUT, reduced, spring } from '../motion'
import * as voice from '../voice'
import { Cloud } from './cloud'
import * as earcon from './earcon'
import * as ears from './ears'
import { Field } from './field'
import { understand, type Intent } from './intents'
import { AUDIO_IDS, DATA_AS_OF, DEMO_QUESTIONS, REPLY, ROAD, type Reply, type Road } from './script'
import { canWake, startWake, stopWake } from './wake'

type State = 'idle' | 'listening' | 'thinking' | 'speaking' | 'paused'
type Input = 'voice' | 'tap' | 'demo'
export type Theme = 'night' | 'light'
type Shown = { title: string; head: string; sub: string }

const $ = <T extends Element = HTMLElement>(root: ParentNode, s: string) => root.querySelector(s) as T

// one stroke family for every icon: 24 grid, 2 px, round caps
const ICON: Record<string, string> = {
  x: '<path d="M7 7l10 10M17 7 7 17"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  bookmark: '<path d="M6 4.5h12v16l-6-4-6 4z"/>',
  repeat: '<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  percent: '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
  wallet: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M16 13.5h2M6 7l9-3.5L16.5 7"/>',
  ear: '<path d="M7 9a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-5.5 1.6"/><path d="M10 9.5a2 2 0 0 1 4 0"/>',
  menu: '<path d="M5 9h14M5 15h14"/>',
  keys: '<rect x="2.5" y="6" width="19" height="12" rx="3"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M8 14h8"/>',
}
export const icon = (k: string, size = 24) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`

// the follow-up cards: what each one says, small print and icon (Alice's «suggests»)
const ACT: Record<string, { t: string; s: string; i: string }> = {
  more: { t: 'Подробнее', s: 'что ждут в декабре', i: 'arrow' },
  save: { t: 'Сохранить', s: 'покажу на стоянке', i: 'bookmark' },
  repeat: { t: 'Повторить', s: 'ещё раз голосом', i: 'repeat' },
  listen: { t: 'Ещё вопрос', s: 'коснитесь и спросите', i: 'mic' },
  rate: { t: 'Про ставку', s: 'ключевая ставка ЦБ', i: 'percent' },
  advice: { t: 'Про вклады', s: 'без советов', i: 'wallet' },
}

const isNumber = (s: string) => /^[\d\s.,%−-]+$/.test(s)
const hhmm = () => new Date().toTimeString().slice(0, 5)

export class AskApp {
  readonly root = document.createElement('div')
  private field: Field
  private sparks: Cloud
  private state: State = 'idle'
  private input: Input = ears.canHear ? 'voice' : 'tap'
  private wakeOn = false
  private theme: Theme = 'night'
  private manualTheme = false
  private composing = false
  private last: Reply | null = null
  private lastShown: Shown | null = null
  private lastIntent: Intent | null = null
  private road: Road | null = null
  private token = 0
  private raf = 0
  private wake: any = null
  private demoStep = 0
  private progress = 0
  private progressTarget = 0
  private speakLv = 0
  private caps: { words: string[]; starts: number[]; total: number } | null = null
  private capShown = -1
  private hold = { x: 0, y: 0, t: 0, down: false, id: -1 }
  private changedAt = 0 // taps right after a state change are ignored (bumps, double taps)

  constructor() {
    this.root.className = 'app'
    this.root.innerHTML = `
      <canvas class="f-canvas" aria-hidden="true"></canvas>
      <canvas class="c-canvas" aria-hidden="true"></canvas>
      <header class="a-top">
        <button class="a-keys press" aria-label="написать вопрос">${icon('keys', 22)}</button>
        <p class="a-status"><b>ась</b><span class="a-clock"></span></p>
        <button class="a-menu press" aria-label="настройки и ситуации в дороге">${icon('menu', 22)}</button>
      </header>
      <section class="k-feed">
        <div class="k-hello"><p class="k-hi"></p><p class="k-big">Спросите про&nbsp;ставку ЦБ</p></div>
        <button class="k-past press" hidden></button>
        <article class="k-answer" aria-live="polite" hidden>
          <svg class="k-outline" aria-hidden="true"><rect x="1" y="1" rx="30" ry="30" pathLength="100"/></svg>
          <p class="k-title"></p>
          <p class="k-head"></p>
          <p class="k-sub"></p>
        </article>
        <div class="k-acts"></div>
        <div class="k-ask"><p class="k-q"></p><p class="k-meta"><span class="k-time"></span><span class="k-dots"><i></i><i></i><i></i><i></i><i></i></span></p></div>
      </section>
      <nav class="k-dock">
        <div class="k-cap"><span class="k-wave"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="k-cap-t"></span></div>
        <button class="k-orb press" aria-label="спросить">${icon('mic', 26)}</button>
        <form class="k-compose" hidden>
          <input class="k-input" type="text" enterkeyhint="send" autocomplete="off" placeholder="Спросите ась…" aria-label="вопрос" />
          <button class="k-send press" type="submit" aria-label="отправить">${icon('up', 22)}</button>
        </form>
      </nav>
      <span class="a-touch" aria-hidden="true"><i></i></span>
      <div class="a-sheet" hidden></div>`
    this.field = new Field($(this.root, '.f-canvas'))
    this.sparks = new Cloud($(this.root, '.c-canvas'))
    voice.prepare(AUDIO_IDS)
    this.bind()
    this.applyTheme()
    this.showWelcome()
    this.set('idle')
    this.loop()
    this.keepAwake()
    this.watchLight()
    this.fitKeyboard()
    this.deepLink()
  }

  /** where the browser exposes a light sensor (Chrome on Android), switch to the light theme by itself */
  private watchLight() {
    const S = (window as any).AmbientLightSensor
    if (!S) return
    try {
      const s = new S({ frequency: 1 })
      let bright = 0, dim = 0
      s.addEventListener('reading', () => {
        if (this.manualTheme) return
        const lx = s.illuminance as number
        bright = lx > 20000 ? bright + 1 : 0
        dim = lx < 8000 ? dim + 1 : 0
        if (bright >= 3 && this.theme !== 'light') ((this.theme = 'light'), this.applyTheme())
        if (dim >= 5 && this.theme === 'light') ((this.theme = 'night'), this.applyTheme())
      })
      s.start()
    } catch {
      /* no permission — manual switch stays */
    }
  }

  /** the on-screen keyboard eats the bottom of the screen: shrink the app to what's visible */
  private fitKeyboard() {
    const vv = window.visualViewport
    if (!vv) return
    const fit = () => {
      const kb = innerHeight - vv.height > 120
      this.root.style.height = kb ? `${vv.height}px` : ''
      this.root.style.top = kb ? `${vv.offsetTop}px` : ''
      this.root.toggleAttribute('data-kb', kb)
    }
    vv.addEventListener('resize', fit)
    vv.addEventListener('scroll', fit)
  }

  /** ?ask=rate | ?ask=listen — the home-screen shortcut and the Siri command land here */
  private deepLink() {
    const q = new URLSearchParams(location.search).get('ask')
    if (!q) return
    history.replaceState(null, '', location.pathname + location.hash)
    setTimeout(() => {
      if (q === 'listen' && this.input === 'voice') this.listen()
      else this.fakeSpeech('какая ставка ЦБ на месяц?')
      if (!voice.isOn()) this.toast('ответ без звука — коснитесь экрана, чтобы ась заговорил')
    }, 600)
  }

  // ---------------------------------------------------------------- haptics you can see
  /** a short vibration where the device supports it, and always a ring of dots from (x, y) */
  private buzz(pattern: number | number[], at?: { x: number; y: number }, strength = 1) {
    if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(pattern)
    const p = at ?? this.field.source
    this.field.wave(p.x, p.y, strength)
    this.sparks.kick(strength * 0.6)
  }

  // ---------------------------------------------------------------- state
  private set(s: State) {
    if (s !== this.state) this.changedAt = performance.now()
    this.state = s
    this.root.dataset.state = s
    this.field.setState(s)
    this.sparks.setState(s)
    const waits = this.wakeOn && this.input === 'voice'
    // the capsule is a status; the verb lives on ась's round button
    const cap: Record<State, string> = {
      idle: this.composing ? 'за рулём — лучше голосом' : waits ? 'жду слово «ась»' : this.last ? 'на связи' : 'коснитесь где угодно',
      listening: 'слушаю',
      thinking: 'думаю',
      speaking: 'отвечаю',
      paused: this.road ? ROAD[this.road].title : 'пауза',
    }
    this.capsule(cap[s])
    const orb = $(this.root, '.k-orb')
    const busy = s !== 'idle'
    orb.innerHTML = icon(s === 'paused' ? 'play' : busy ? 'x' : 'mic', 26)
    orb.setAttribute('aria-label', s === 'paused' ? 'продолжить' : busy ? 'стоп' : 'спросить')
    // before the first question the top greets (video 3); after it, the answers own the screen
    this.root.toggleAttribute('data-hello', !this.last && s === 'idle')
    $(this.root, '.k-hi').textContent = greeting()
    // the follow-ups hide while a new turn is under way (Alice's «hide» buttons)
    this.root.toggleAttribute('data-acts', s === 'idle' && !!this.last?.chips?.length)
  }

  /** the dock's capsule: text swaps with a blur, the pill's width springs */
  private capsule(t: string) {
    const el = $(this.root, '.k-cap-t')
    if (el.textContent === t) return
    const cap = $(this.root, '.k-cap')
    const before = cap.getBoundingClientRect().width
    el.textContent = t
    const after = cap.getBoundingClientRect().width
    if (reduced() || !before || !after) return
    const s = spring(420, 28)
    cap.animate([{ transform: `scaleX(${before / after})` }, { transform: 'none' }], { duration: s.duration, easing: s.easing })
    el.animate([{ opacity: 0, filter: 'blur(3px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 220, easing: EASE_OUT })
  }

  // ---------------------------------------------------------------- the stack: question, answer, actions
  private question(t: string, live = false) {
    const q = $(this.root, '.k-q')
    const ask = $(this.root, '.k-ask')
    ask.toggleAttribute('data-empty', !t)
    if (!t) return void (q.textContent = 'например: «какая ставка на месяц?»')
    // your words: the newest in lime, the start of the phrase fades back
    const w = t.split(/\s+/).filter(Boolean)
    const cut = live ? Math.max(0, w.length - 3) : 0
    q.innerHTML = `<span class="old">${w.slice(0, cut).join(' ')}</span> ${w.slice(cut).join(' ')}`
    $(this.root, '.k-time').textContent = hhmm()
  }

  /** the answer card: `draft` = outline only (ась is still looking) */
  private answer(a: Shown, mode: 'draft' | 'event' | 'quiet') {
    const card = $(this.root, '.k-answer')
    const head = $(this.root, '.k-head')
    const prev = this.lastShown
    // a new answer over an old one: the old folds into a strip at the top (video 1)
    if (mode === 'draft' && prev && prev.title !== a.title) this.foldPast(prev)
    card.toggleAttribute('data-draft', mode === 'draft')
    card.hidden = false
    $(this.root, '.k-title').textContent = a.title
    if (mode === 'draft') {
      head.textContent = ''
      this.sub(a.sub, 'think')
      if (!reduced()) {
        // the outline draws itself, then the card fills (video 4)
        const r = card.querySelector('rect')!
        r.animate([{ strokeDashoffset: 100 }, { strokeDashoffset: 0 }], { duration: 700, easing: EASE_OUT, fill: 'both' })
        card.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: EASE_OUT })
      }
      return
    }
    const num = isNumber(a.head)
    head.classList.toggle('num', num)
    if (head.textContent !== a.head || mode === 'event') {
      head.textContent = a.head
      if (mode === 'event' && !reduced()) {
        // the figure comes out of the light: sparks fly up into it, then the type turns solid
        if (num) this.sparks.buildText(a.head, head)
        head.animate([{ opacity: 0, filter: 'blur(12px)', transform: 'translateY(10px)' }, { opacity: 1, filter: 'blur(0)', transform: 'none' }], { duration: 420, delay: num ? 380 : 60, easing: EASE_OUT, fill: 'backwards' })
      }
    }
    this.sub(a.sub)
    this.lastShown = a
  }

  private foldPast(prev: Shown) {
    const past = $(this.root, '.k-past')
    past.hidden = false
    past.innerHTML = `<b>${prev.head}</b><span>${prev.title}</span>${icon('arrow', 16)}`
    past.setAttribute('aria-label', `${prev.title}: ${prev.head}. Показать`)
    if (!reduced()) {
      const s = spring(340, 30)
      past.animate([{ opacity: 0, transform: 'translateY(40px) scale(0.96)' }, { opacity: 1, transform: 'none' }], { duration: s.duration, easing: s.easing })
    }
  }

  private sub(t: string, cls = '') {
    const el = $(this.root, '.k-sub')
    this.caps = null
    this.capShown = -1
    el.className = `k-sub ${cls}`.trim()
    el.textContent = t
  }

  /** ась's subtitles: the words light up as the voice reaches them */
  private speakCaptions(text: string) {
    const words = text.split(/\s+/).filter(Boolean)
    const starts: number[] = []
    let n = 0
    for (const w of words) ((starts.push(n)), (n += w.length + 1))
    this.caps = { words, starts, total: n }
    this.capShown = -1
  }

  private renderCaptions() {
    if (!this.caps) return
    const { words, starts, total } = this.caps
    const pos = this.progress * total
    let i = starts.findIndex((s, k) => s <= pos && (starts[k + 1] ?? Infinity) > pos)
    if (i < 0) i = words.length - 1
    const from = Math.floor(i / 9) * 9
    const el = $(this.root, '.k-sub')
    if (from !== this.capShown) {
      this.capShown = from
      el.className = 'k-sub caps'
      el.innerHTML = words.slice(from, from + 9).map((w) => `<span>${w}</span>`).join(' ')
    }
    el.querySelectorAll('span').forEach((s, k) => s.classList.toggle('on', from + k <= i))
  }

  /** two follow-up cards over the question (video 4) */
  private acts(chips: { intent: string }[]) {
    const box = $(this.root, '.k-acts')
    box.innerHTML = chips
      .slice(0, 2)
      .map((c, k) => {
        const a = ACT[c.intent] ?? { t: c.intent, s: '', i: 'arrow' }
        return `<button class="k-act press${k === 0 ? ' first' : ''}" data-act="${c.intent}"><span class="ic">${icon(a.i, 22)}</span><b>${a.t}</b><span class="s">${a.s}</span></button>`
      })
      .join('')
    if (!reduced()) [...box.children].forEach((c, k) => c.animate([{ opacity: 0, transform: 'translateY(16px) scale(0.97)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: 120 + k * 70, easing: EASE_OUT, fill: 'backwards' }))
  }

  private showWelcome() {
    $(this.root, '.k-answer').hidden = true
    this.question('')
  }

  // ---------------------------------------------------------------- the conversation
  private async ask() {
    if (this.input === 'voice') return this.listen()
    // tap mode: ась asks the obvious question for you, typed like a live caption
    const q = this.input === 'demo' ? DEMO_QUESTIONS[this.demoStep++ % DEMO_QUESTIONS.length] : this.lastIntent === 'rate' ? 'а что в декабре?' : 'какая ставка ЦБ на месяц?'
    await this.fakeSpeech(q)
  }

  private async fakeSpeech(q: string) {
    const tk = ++this.token
    stopWake()
    this.set('listening')
    if (voice.isOn()) earcon.listen()
    for (let i = 1; i <= q.length; i++) {
      if (tk !== this.token) return
      this.question(q.slice(0, i), true)
      this.speakLv = 0.35 + 0.4 * Math.abs(Math.sin(i * 0.9))
      this.field.level(this.speakLv)
      this.sparks.level(this.speakLv)
      await wait(38)
    }
    this.question(q)
    await wait(300)
    if (tk === this.token) this.handle(q)
  }

  /** `follow` = the answer ended with a question: listen a little, quietly, without a tap */
  private async listen(follow = false) {
    const tk = ++this.token
    voice.stop()
    stopWake()
    this.set('listening')
    if (!follow) this.buzz(8, undefined, 0.6)
    if (voice.isOn()) earcon.listen()
    if (!follow) this.question('говорите — я слушаю')
    let heard = false
    // no words in 7 s (a hidden permission prompt, a silent recognizer) — say so instead of hanging;
    // a follow-up window closes quietly after 5 s
    setTimeout(() => {
      if (tk !== this.token || heard || this.state !== 'listening') return
      if (!follow) this.toast('не слышу — коснитесь и скажите ещё раз')
      if (voice.isOn()) earcon.stop()
      this.toIdle()
    }, follow ? 5000 : 7000)
    await ears.openMeter()
    if (tk !== this.token) return
    ears.listen({
      onPartial: (t) => tk === this.token && ((heard = true), this.question(t, true)),
      onFinal: (t) => {
        if (tk !== this.token) return
        heard = true
        this.question(t)
        setTimeout(() => tk === this.token && this.handle(t), 250)
      },
      onSilence: () => {
        if (tk !== this.token || this.state !== 'listening') return
        if (!follow) this.toast('не услышал — коснитесь и говорите')
        this.toIdle()
      },
      onError: (k) => {
        if (tk !== this.token) return
        if (k === 'denied') {
          this.input = 'tap'
          this.wakeOn = false
          this.toast('нет доступа к микрофону — включил режим касания')
          this.toIdle()
        } else if (k === 'network') this.roadEvent('offline')
        else if (k !== 'no-speech') {
          this.toast('микрофон занят — попробуйте ещё раз')
          this.toIdle()
        }
      },
    })
  }

  private handle(text: string) {
    const intent = understand(text)
    if (intent === 'stop') return this.toIdle()
    if (intent === 'repeat') return this.last ? this.reply(this.last, false) : this.reply(REPLY.clarify)
    const key = intent === 'unknown' ? 'clarify' : intent === 'more' && !this.lastIntent ? 'rate' : intent
    this.lastIntent = key === 'clarify' ? this.lastIntent : (key as Intent)
    this.reply(REPLY[key], key === 'rate' || key === 'more')
  }

  private async reply(r: Reply, think = true) {
    const tk = ++this.token
    ears.stopListening()
    stopWake()
    if (think) {
      this.set('thinking')
      // the outline of the answer-to-be, with the steps of the work running through it
      this.answer({ title: r.title, head: '', sub: r.thinking?.[0] ?? 'думаю' }, 'draft')
      for (const step of r.thinking ?? ['думаю']) {
        this.sub(step, 'think')
        await wait(650)
        if (tk !== this.token) return
      }
    } else if (this.lastShown && this.lastShown.title !== r.title) this.foldPast(this.lastShown)
    this.last = r
    this.set('speaking')
    this.answer(r, 'event')
    this.acts(r.chips ?? [])
    this.buzz([12, 60, 12])
    if (voice.isOn()) earcon.ready()
    this.progress = this.progressTarget = 0
    const t0 = performance.now()
    const est = Math.min(9000, 900 + r.say.length * 58)
    this.speakCaptions(r.say)
    if (voice.isOn()) {
      let timed = false
      const tick = setInterval(() => !timed && (this.progressTarget = Math.min(1, (performance.now() - t0) / est)), 120)
      await voice.speak(r.audio, r.say, {
        onLevel: (lv) => ((this.speakLv = lv), this.field.level(lv * 0.8), this.sparks.level(lv * 0.8)),
        onWord: () => this.field.pulse(),
        onProgress: (p) => ((timed = true), (this.progressTarget = p)),
      })
      clearInterval(tick)
    } else {
      while (performance.now() - t0 < est && tk === this.token) {
        this.progressTarget = Math.min(1, (performance.now() - t0) / est)
        this.field.pulse()
        await wait(260)
      }
    }
    if (tk !== this.token) return
    this.toIdle()
    // Alice-style: an answer that asks something keeps the mic open for a moment
    if (this.input === 'voice' && voice.isOn() && /\?\s*$/.test(r.say)) setTimeout(() => this.state === 'idle' && this.listen(true), 350)
    if (this.input === 'demo' && this.demoStep < DEMO_QUESTIONS.length) setTimeout(() => this.state === 'idle' && this.ask(), 1600)
  }

  private toIdle() {
    this.token++
    ears.stopListening()
    voice.stop()
    this.road = null
    this.set('idle')
    if (this.last) this.answer(this.last, 'quiet')
    else this.showWelcome()
    this.armWake()
  }

  /** wait for «ась» while idle */
  private armWake() {
    if (!this.wakeOn || this.input !== 'voice') return stopWake()
    const tk = this.token
    setTimeout(() => {
      if (tk !== this.token || this.state !== 'idle') return
      startWake(
        (rest) => {
          if (this.state !== 'idle') return
          this.buzz(10)
          if (rest && understand(rest) !== 'unknown') {
            this.set('listening')
            this.question(rest)
            setTimeout(() => this.handle(rest), 350)
          } else this.listen()
        },
        () => {
          this.wakeOn = false
          this.toast('нет доступа к микрофону — слово «ась» выключено')
          this.set(this.state)
        },
      )
    }, 450)
  }

  // ---------------------------------------------------------------- road events: ась behaves like a good passenger
  private roadEvent(k: Road) {
    const tk = ++this.token
    ears.stopListening()
    stopWake()
    voice.stop()
    const wasSpeaking = this.last
    this.road = k
    this.set('paused')
    const r = ROAD[k]
    this.answer(r, 'quiet')
    this.buzz(20, { x: this.root.clientWidth / 2, y: 0 }, 0.9)
    if (r.say && voice.isOn()) voice.speak(k, r.say, { onWord: () => this.field.pulse() })
    if (k === 'navigator' || k === 'toll' || k === 'call') {
      setTimeout(() => {
        if (tk !== this.token) return
        this.road = null
        if (wasSpeaking) this.reply(wasSpeaking, false)
        else this.toIdle()
      }, k === 'call' ? 4500 : 3200)
    }
  }

  // ---------------------------------------------------------------- keyboard: for a passenger or a stop
  private compose(open: boolean) {
    this.composing = open
    const form = $<HTMLFormElement>(this.root, '.k-compose')
    form.hidden = !open
    this.root.toggleAttribute('data-compose', open)
    if (open) {
      if (this.state !== 'idle') this.toIdle()
      const inp = $<HTMLInputElement>(this.root, '.k-input')
      inp.value = ''
      inp.focus()
      if (!reduced()) form.animate([{ opacity: 0, transform: 'scaleX(0.6)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: EASE_OUT })
    } else $<HTMLInputElement>(this.root, '.k-input').blur()
    this.set(this.state)
  }

  private submit() {
    const inp = $<HTMLInputElement>(this.root, '.k-input')
    const q = inp.value.trim()
    if (!q) return
    if (!voice.isOn()) voice.setOn(true)
    earcon.unlock()
    this.compose(false)
    this.buzz(8, undefined, 0.6)
    this.question(q)
    setTimeout(() => this.handle(q), 250)
  }

  // ---------------------------------------------------------------- input
  private bind() {
    const app = this.root
    const isControl = (t: EventTarget | null) => !!(t as HTMLElement)?.closest?.('button, a, input, form, .a-sheet')
    const local = (e: PointerEvent) => {
      const r = app.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    // the whole screen is the tap target, except the controls
    app.addEventListener('pointerdown', (e) => {
      if (isControl(e.target)) return
      if (this.hold.down) return void (this.hold.down = false) // a second finger cancels: palm or bump
      this.hold = { x: e.clientX, y: e.clientY, t: performance.now(), down: true, id: e.pointerId }
      const p = local(e)
      this.touchMark(p.x, p.y, true)
      this.field.touch(p.x, p.y, true)
      this.field.wave(p.x, p.y, 0.9)
    })
    const release = () => (this.field.touch(0, 0, false), this.touchMark(0, 0, false))
    app.addEventListener('pointercancel', () => ((this.hold.down = false), release()))
    app.addEventListener('pointerup', (e) => {
      if (!this.hold.down || e.pointerId !== this.hold.id) return
      this.hold.down = false
      release()
      const dy = e.clientY - this.hold.y
      const dx = e.clientX - this.hold.x
      const dt = performance.now() - this.hold.t
      if (dy > 70 && Math.abs(dx) < dy) return this.toIdle() // swipe down = stop
      if (dt < 60 || dt > 700 || Math.hypot(dx, dy) > 12) return
      if (performance.now() - this.changedAt < 300) return
      // a finger that misses a control by a few px on a bumpy road still means that control
      const near = this.nearControl(e.clientX, e.clientY)
      if (near) return near.click()
      if (this.composing) return this.compose(false)
      if (!voice.isOn()) voice.setOn(true) // the first gesture unlocks speech, in every mode
      earcon.unlock()
      this.buzz(6, local(e), 0.9)
      this.onTap()
    })
    app.addEventListener('keydown', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !isControl(e.target)) {
        e.preventDefault()
        this.onTap()
      }
      if (e.key === 'Escape' && this.composing) this.compose(false)
    })
    $(this.root, '.k-compose').addEventListener('submit', (e) => {
      e.preventDefault()
      this.submit()
    })
    app.addEventListener('click', (e) => {
      const t = e.target as HTMLElement
      if (t.closest('.a-menu')) return this.sheet(true)
      if (t.closest('.a-keys')) return this.compose(!this.composing)
      const s = t.closest<HTMLElement>('[data-sheet]')
      if (s) return this.act(s.dataset.sheet!, s.dataset.v)
      if (!voice.isOn()) voice.setOn(true)
      earcon.unlock()
      const at = (el: Element) => {
        const r = el.getBoundingClientRect(), h = app.getBoundingClientRect()
        return { x: r.left - h.left + r.width / 2, y: r.top - h.top + r.height / 2 }
      }
      const orb = t.closest('.k-orb')
      if (orb) return (this.buzz(6, at(orb), 0.8), this.onOrb())
      if (t.closest('.k-past')) return this.unfoldPast()
      const act = t.closest<HTMLElement>('.k-act')
      if (act) {
        this.buzz(act.dataset.act === 'save' ? [8, 30, 8] : 6, at(act), 0.8)
        return this.control(act.dataset.act!)
      }
    })
  }

  /** controls grown by 16 px all round: the nearest one under a near-miss */
  private nearControl(x: number, y: number): HTMLElement | null {
    const cands = [...this.root.querySelectorAll<HTMLElement>('.k-act, .k-orb')].filter((el) => el.offsetParent)
    let best: HTMLElement | null = null, bd = Infinity
    for (const el of cands) {
      const r = el.getBoundingClientRect()
      const dx = Math.max(r.left - x, 0, x - r.right), dy = Math.max(r.top - y, 0, y - r.bottom)
      const d = Math.hypot(dx, dy)
      if (d <= 16 && d < bd) ((bd = d), (best = el))
    }
    return best
  }

  private touchMark(x: number, y: number, on: boolean) {
    const m = $(this.root, '.a-touch')
    if (on) {
      m.style.left = `${x}px`
      m.style.top = `${y}px`
      m.getAnimations().forEach((a) => a.cancel())
      if (!reduced()) {
        const s = spring(420, 24)
        m.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(0.6)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }], { duration: s.duration, easing: s.easing, fill: 'forwards' })
      } else m.style.opacity = '1'
    } else {
      m.getAnimations().forEach((a) => a.cancel())
      m.animate([{ opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.25)' }], { duration: 220, easing: EASE_OUT, fill: 'forwards' })
    }
  }

  private onTap() {
    switch (this.state) {
      case 'idle': return void this.ask()
      case 'listening':
        ears.stopListening()
        return void (this.input === 'voice' ? this.toIdle() : null)
      case 'thinking': return this.toIdle()
      case 'speaking': return void this.ask()
      case 'paused':
        this.road = null
        return this.last ? void this.reply(this.last, false) : this.toIdle()
    }
  }

  /** ась's own button: ask when quiet, stop when busy, go on after a pause */
  private onOrb() {
    if (this.state === 'idle') return void this.ask()
    if (this.state === 'paused') return this.onTap()
    if (this.state === 'listening' && this.input === 'voice') return ears.stopListening()
    if (voice.isOn()) earcon.stop()
    this.toIdle()
  }

  /** the folded strip: bring that answer back, fold the current one */
  private unfoldPast() {
    const prev = this.lastShown
    const shown = $(this.root, '.k-past').querySelector('b')?.textContent
    const back = Object.values(REPLY).find((r) => r.head === shown)
    if (!back || !prev) return
    this.foldPast(prev)
    this.last = back
    this.answer(back, 'event')
    this.acts(back.chips ?? [])
    this.set('idle')
  }

  private control(a: string) {
    if (a === 'listen') return void this.ask()
    if (a === 'repeat') return this.last ? void this.reply(this.last, false) : undefined
    this.handle(({ rate: 'ставка цб', more: 'подробнее', save: 'сохрани', advice: 'вклад' } as any)[a] ?? a)
  }

  // ---------------------------------------------------------------- settings sheet
  private act(a: string, v?: string) {
    if (a === 'close') return this.sheet(false)
    if (a === 'input') {
      this.input = v as Input
      this.demoStep = 0
      this.sheet(false)
      this.toIdle()
      if (this.input === 'demo') {
        voice.setOn(true)
        setTimeout(() => this.ask(), 500)
      }
    }
    if (a === 'theme') {
      this.manualTheme = true
      this.theme = v as Theme
      this.applyTheme()
      this.renderSheet()
    }
    if (a === 'sound') {
      voice.setOn(!voice.isOn())
      this.renderSheet()
    }
    if (a === 'wake') {
      this.wakeOn = !this.wakeOn
      if (this.wakeOn) {
        this.input = 'voice'
        voice.setOn(true)
      }
      this.renderSheet()
      this.set(this.state)
      if (this.state === 'idle') this.armWake()
      else if (!this.wakeOn) stopWake()
    }
    if (a === 'road') {
      this.sheet(false)
      this.roadEvent(v as Road)
    }
  }

  private sheet(open: boolean) {
    const s = $(this.root, '.a-sheet')
    if (open) {
      this.renderSheet()
      s.hidden = false
    } else if (!s.hidden) {
      s.classList.add('closing')
      setTimeout(() => {
        s.hidden = true
        s.classList.remove('closing')
      }, 200)
    }
  }

  private renderSheet() {
    const seg = (act: string, cur: string, opts: [string, string][]) =>
      `<div class="s-seg">${opts.map(([v, l]) => `<button class="press" data-sheet="${act}" data-v="${v}" ${v === cur ? 'aria-current="true"' : ''}>${l}</button>`).join('')}</div>`
    const row = (act: string, ic: string, label: string, value = '') =>
      `<button class="s-row press" data-sheet="${act}"><span class="ic">${icon(ic, 20)}</span><span class="t">${label}</span>${value ? `<b>${value}</b>` : icon('arrow', 18)}</button>`
    $(this.root, '.a-sheet').innerHTML = `
      <div class="s-scrim" data-sheet="close"></div>
      <div class="s-body" role="dialog" aria-label="настройки">
        <div class="s-grab"></div>
        <h3>как спрашивать</h3>
        ${seg('input', this.input, [['voice', 'голосом'], ['tap', 'касанием'], ['demo', 'демо']])}
        <p>${this.input === 'voice' ? (ears.canHear ? 'Коснитесь экрана где угодно и спросите про ставку ЦБ. Понимаю «подробнее», «сохрани», «повтори», «стоп». Если ась спросил что-то в ответ — просто ответьте, касаться не нужно.' : 'Этот браузер не распознаёт речь — включите «касанием» или пишите текстом.') : this.input === 'tap' ? 'Без микрофона: касание задаёт вопрос за вас.' : 'Сценарий проигрывается сам: вопрос, ответ, подробности, сохранение.'}</p>
        ${canWake ? row('wake', 'ear', 'слушать слово «ась»', this.wakeOn ? 'вкл' : 'выкл') : ''}
        ${row('sound', 'mic', 'голос ответа', voice.isOn() ? 'вкл' : 'выкл')}
        <h3>тема</h3>
        ${seg('theme', this.theme, [['night', 'тёмная'], ['light', 'светлая']])}
        <h3>ситуации в дороге</h3>
        <div class="s-grid">
          <button class="press" data-sheet="road" data-v="navigator">навигатор говорит</button>
          <button class="press" data-sheet="road" data-v="toll">шлагбаум</button>
          <button class="press" data-sheet="road" data-v="offline">пропала сеть</button>
          <button class="press" data-sheet="road" data-v="call">звонок</button>
        </div>
        <h3>не открывая приложение</h3>
        <a class="s-row press" href="#/widget"><span class="ic">${icon('percent', 20)}</span><span class="t">виджет и Dynamic Island</span>${icon('arrow', 18)}</a>
        <p>На Android: «Добавить на главный экран», потом долгое нажатие на иконку — «Ставка ЦБ». На iPhone: «Команды» → «Открыть URL» с адресом <code>${location.origin}${location.pathname}?ask=rate</code> и фразой «ась».</p>
        <p class="s-note">Данные на ${DATA_AS_OF}. Экран не гаснет, пока приложение открыто.</p>
        <nav class="s-links"><a href="#/screens">все экраны концепта</a><a href="#/flow">user flow</a><a href="#/guide">гайд</a></nav>
      </div>`
  }

  private applyTheme() {
    this.root.dataset.theme = this.theme
    document.documentElement.dataset.mode = this.theme === 'night' ? 'night' : 'day'
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', this.theme === 'night' ? '#000000' : '#f3f3f8')
    this.field.setTheme(this.theme)
    this.sparks.setTheme(this.theme)
  }

  private toast(t: string) {
    const el = document.createElement('div')
    el.className = 'a-toast'
    el.textContent = t
    this.root.append(el)
    el.animate([{ opacity: 0, transform: 'translate(-50%, 8px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }], { duration: 220, easing: EASE_OUT, fill: 'both' })
    setTimeout(() => (el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' }).onfinish = () => el.remove()), 2600)
  }

  // ---------------------------------------------------------------- frame loop
  private waveAt = 0
  private loop = () => {
    const now = performance.now()
    let lv = 0
    if (this.state === 'listening') {
      lv = this.input === 'voice' ? ears.level() : this.speakLv
      this.field.level(lv)
      this.sparks.level(lv)
    }
    if (this.state !== 'speaking') this.progressTarget = this.state === 'idle' && this.last ? 1 : 0
    this.progress += (this.progressTarget - this.progress) * 0.15
    // the capsule's little equaliser: lime for you, lavender for ась
    if (now - this.waveAt > 60) {
      this.waveAt = now
      const v = this.state === 'listening' ? lv : this.state === 'speaking' ? this.speakLv : 0
      this.root.querySelectorAll<HTMLElement>('.k-wave i').forEach((b, k) => {
        const s = reduced() ? 0.3 : 0.25 + Math.min(1, v * (0.6 + 0.6 * Math.abs(Math.sin(now / 140 + k * 1.3)))) * 0.75
        b.style.transform = `scaleY(${s.toFixed(3)})`
      })
      if (this.state !== 'speaking') this.speakLv *= 0.6
      $(this.root, '.a-clock').textContent = hhmm()
    }
    if (this.state === 'speaking') this.renderCaptions()
    this.raf = requestAnimationFrame(this.loop)
  }

  private async keepAwake() {
    try {
      this.wake = await (navigator as any).wakeLock?.request('screen')
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') this.wake = await (navigator as any).wakeLock?.request('screen')
      })
    } catch {
      /* not supported — fine */
    }
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.token++
    ears.stopListening()
    ears.closeMeter()
    stopWake()
    voice.stop()
    this.field.destroy()
    this.sparks.destroy()
    this.wake?.release?.()
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** the dock's resting status before the first question: a greeting by the time of day */
function greeting() {
  const h = new Date().getHours()
  return h >= 5 && h < 12 ? 'Доброе утро' : h >= 12 && h < 17 ? 'Добрый день' : h >= 17 && h < 23 ? 'Добрый вечер' : 'Доброй ночи'
}
