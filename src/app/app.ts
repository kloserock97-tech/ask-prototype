// «ась?» — one working scenario: the driver asks about the key rate.
//
// research/14: no AI-look. No purple glow, no glass, no gradient borders, no
// particles. The identity comes from the car: a dot-matrix strip in the warm amber
// of instrument lights at the bottom (a stereo spectrum of whoever is speaking; a
// K.I.T.T. scanner while ась thinks), and plain, confident type above it.
//
// The start screen says only «Ась?» — what you hear when you call someone — with one
// line of invitation and two questions to tap. A conversation shows your question,
// the steps of the work, then the answer in three layers: the one big thing, what it
// is, one line of context. The full sentence is spoken and runs as captions. Like
// Alice, an answer that ends with a question keeps listening for a few seconds.

import { EASE_OUT, reduced } from '../motion'
import * as voice from '../voice'
import { Band } from './band'
import * as earcon from './earcon'
import * as ears from './ears'
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
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  menu: '<path d="M5 9h14M5 15h14"/>',
  keys: '<rect x="2.5" y="6" width="19" height="12" rx="3"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M8 14h8"/>',
  ear: '<path d="M7 9a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-5.5 1.6"/><path d="M10 9.5a2 2 0 0 1 4 0"/>',
  percent: '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
}
export const icon = (k: string, size = 24) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`

// follow-ups under an answer (Alice's «suggests»): plain words, no icon tiles
const ACT: Record<string, string> = { more: 'Подробнее', save: 'Сохранить', repeat: 'Повторить', listen: 'Ещё вопрос', rate: 'Про ставку', advice: 'Про вклады' }

const isNumber = (s: string) => /^[\d\s.,%−-]+$/.test(s)
const hhmm = () => new Date().toTimeString().slice(0, 5)

export class AskApp {
  readonly root = document.createElement('div')
  private band: Band
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
  private fakeLv = 0
  private faking = false // a typed or tapped question is «spoken» by the app itself
  private caps: { words: string[]; starts: number[]; total: number } | null = null
  private capShown = -1
  private hold = { x: 0, y: 0, t: 0, down: false, id: -1 }
  private changedAt = 0 // taps right after a state change are ignored (bumps, double taps)

  constructor() {
    this.root.className = 'app'
    this.root.innerHTML = `
      <header class="v-top">
        <button class="v-keys press" aria-label="написать вопрос">${icon('keys', 22)}</button>
        <p class="v-clock"></p>
        <button class="v-menu press" aria-label="настройки и ситуации в дороге">${icon('menu', 22)}</button>
      </header>
      <main class="v-main">
        <section class="v-start">
          <h1 class="v-hi">Ась?</h1>
          <p class="v-lead">Спросите про ключевую ставку. Коснитесь экрана и говорите.</p>
          <div class="v-sugg">
            <button class="v-s press" data-say="какая ставка ЦБ на месяц?">Какая ставка ЦБ на месяц ${icon('arrow', 18)}</button>
            <button class="v-s press" data-say="а вклад открывать?">Стоит ли открывать вклад ${icon('arrow', 18)}</button>
          </div>
        </section>
        <section class="v-talk" hidden>
          <button class="v-past press" hidden></button>
          <p class="v-q"></p>
          <div class="v-a" aria-live="polite">
            <ol class="v-steps"></ol>
            <p class="v-head"></p>
            <p class="v-title"></p>
            <p class="v-sub"></p>
          </div>
          <div class="v-acts"></div>
        </section>
      </main>
      <footer class="v-foot">
        <canvas class="v-band" aria-hidden="true"></canvas>
        <div class="v-dock">
          <p class="v-state"></p>
          <button class="v-mic press" aria-label="спросить">${icon('mic', 28)}</button>
          <form class="v-compose" hidden>
            <input class="v-input" type="text" enterkeyhint="send" autocomplete="off" placeholder="Спросите ась" aria-label="вопрос" />
            <button class="v-send press" type="submit" aria-label="отправить">${icon('up', 22)}</button>
          </form>
        </div>
      </footer>
      <span class="a-touch" aria-hidden="true"></span>
      <div class="a-sheet" hidden></div>`
    this.band = new Band($(this.root, '.v-band'))
    voice.prepare(AUDIO_IDS)
    this.bind()
    this.applyTheme()
    this.set('idle')
    this.revealStart()
    this.loop()
    this.keepAwake()
    this.watchLight()
    this.fitKeyboard()
    this.deepLink()
  }

  /** the start screen comes in piece by piece, never all at once */
  private revealStart() {
    if (reduced()) return
    const parts = [$(this.root, '.v-hi'), $(this.root, '.v-lead'), ...this.root.querySelectorAll('.v-s')]
    parts.forEach((el, i) => el.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 120 + i * 110, easing: EASE_OUT, fill: 'backwards' }))
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
      if (!voice.isOn()) this.toast('Ответ без звука. Коснитесь экрана, чтобы ась заговорил.')
    }, 600)
  }

  // ---------------------------------------------------------------- haptics you can see
  /** a short vibration where supported, and always a bump running along the display from x */
  private buzz(pattern: number | number[], xPx?: number, strength = 1) {
    if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(pattern)
    const w = this.root.clientWidth || 1
    this.band.bump(xPx == null ? 0.5 : xPx / w, strength)
  }

  // ---------------------------------------------------------------- state
  private set(s: State) {
    if (s !== this.state) this.changedAt = performance.now()
    this.state = s
    this.root.dataset.state = s
    this.band.setState(s)
    const waits = this.wakeOn && this.input === 'voice'
    const line: Record<State, string> = {
      idle: this.composing ? 'За рулём лучше голосом' : waits ? 'Жду слово «ась»' : this.last ? 'На связи' : '',
      listening: 'Слушаю',
      thinking: 'Ищу',
      speaking: 'Отвечаю',
      paused: this.road ? ROAD[this.road].title : 'Пауза',
    }
    const st = $(this.root, '.v-state')
    if (st.textContent !== line[s]) {
      st.textContent = line[s]
      if (!reduced() && line[s]) st.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: EASE_OUT })
    }
    const mic = $(this.root, '.v-mic')
    mic.innerHTML = icon(s === 'paused' ? 'play' : s === 'idle' ? 'mic' : 'x', 28)
    mic.setAttribute('aria-label', s === 'paused' ? 'продолжить' : s === 'idle' ? 'спросить' : 'стоп')
    this.root.toggleAttribute('data-acts', s === 'idle' && !!this.last?.chips?.length)
  }

  // ---------------------------------------------------------------- the conversation view
  private talk() {
    const start = $(this.root, '.v-start'), talk = $(this.root, '.v-talk')
    if (!talk.hidden) return
    if (!reduced()) {
      start.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: 160, easing: EASE_OUT, fill: 'forwards' }).onfinish = () => (start.hidden = true)
      talk.hidden = false
      talk.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, delay: 120, easing: EASE_OUT, fill: 'backwards' })
    } else ((start.hidden = true), (talk.hidden = false))
  }

  /** your question, right-aligned: the newest words bright, the start of the phrase quieter */
  private question(t: string, live = false) {
    this.talk()
    const q = $(this.root, '.v-q')
    const w = t.split(/\s+/).filter(Boolean)
    const cut = live ? Math.max(0, w.length - 3) : 0
    q.innerHTML = `<span class="old">${w.slice(0, cut).join(' ')}</span> ${w.slice(cut).join(' ')}`
    q.hidden = !t
  }

  /** the steps of the work, checked off one by one — real progress, not decoration */
  private steps(list: string[], done: number) {
    const ol = $(this.root, '.v-steps')
    if (!list.length) return void (ol.innerHTML = '')
    if (ol.children.length !== list.length) ol.innerHTML = list.map((s) => `<li>${s}</li>`).join('')
    ;[...ol.children].forEach((li, i) => {
      const was = li.className
      li.className = i < done ? 'done' : i === done ? 'now' : ''
      if (li.className && li.className !== was && !reduced()) li.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 200, easing: EASE_OUT })
    })
  }

  private answer(a: Shown, event: boolean) {
    const head = $(this.root, '.v-head')
    const num = isNumber(a.head)
    head.classList.toggle('num', num)
    $(this.root, '.v-title').textContent = a.title
    if (head.textContent !== a.head || event) {
      head.textContent = a.head
      this.fitHead()
      if (event && !reduced()) {
        head.animate([{ opacity: 0, transform: 'translateY(12px)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 320, easing: EASE_OUT })
        $(this.root, '.v-title').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: 90, easing: EASE_OUT, fill: 'backwards' })
      }
    }
    this.sub(a.sub)
    this.lastShown = a
  }

  /** a long figure («13,75%») shrinks to fit the width instead of running off the edge */
  private fitHead() {
    const head = $(this.root, '.v-head')
    head.style.fontSize = ''
    if (!head.classList.contains('num')) return
    // the column, not the block itself: an unbreakable figure would stretch its own box
    const main = $(this.root, '.v-main')
    const cs = getComputedStyle(main)
    const room = main.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
    const rg = document.createRange()
    rg.selectNodeContents(head)
    const w = rg.getBoundingClientRect().width
    if (w > room) head.style.fontSize = `${(parseFloat(getComputedStyle(head).fontSize) * room) / w}px`
  }

  /** a previous answer folds into one quiet line at the top (video 1) */
  private foldPast(prev: Shown) {
    const past = $(this.root, '.v-past')
    past.hidden = false
    past.innerHTML = `<b>${prev.head}</b><span>${prev.title}</span>`
    past.setAttribute('aria-label', `${prev.title}: ${prev.head}. Показать снова`)
    if (!reduced()) past.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: EASE_OUT })
  }

  private sub(t: string) {
    const el = $(this.root, '.v-sub')
    this.caps = null
    this.capShown = -1
    el.className = 'v-sub'
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
    const el = $(this.root, '.v-sub')
    if (from !== this.capShown) {
      this.capShown = from
      el.className = 'v-sub caps'
      el.innerHTML = words.slice(from, from + 9).map((w) => `<span>${w}</span>`).join(' ')
    }
    el.querySelectorAll('span').forEach((s, k) => s.classList.toggle('on', from + k <= i))
  }

  private acts(chips: { intent: string }[]) {
    const box = $(this.root, '.v-acts')
    box.innerHTML = chips
      .slice(0, 2)
      .map((c, k) => `<button class="v-act press${k === 0 ? ' first' : ''}" data-act="${c.intent}">${ACT[c.intent] ?? c.intent}</button>`)
      .join('')
    if (!reduced()) [...box.children].forEach((c, k) => c.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 260, delay: 160 + k * 60, easing: EASE_OUT, fill: 'backwards' }))
  }

  // ---------------------------------------------------------------- the conversation
  private async ask() {
    if (this.input === 'voice') return this.listen()
    const q = this.input === 'demo' ? DEMO_QUESTIONS[this.demoStep++ % DEMO_QUESTIONS.length] : this.lastIntent === 'rate' ? 'а что в декабре?' : 'какая ставка ЦБ на месяц?'
    await this.fakeSpeech(q)
  }

  /** tap mode and the suggestions: the question types itself like a live caption */
  private async fakeSpeech(q: string) {
    const tk = ++this.token
    stopWake()
    this.faking = true
    this.set('listening')
    if (voice.isOn()) earcon.listen()
    for (let i = 1; i <= q.length; i++) {
      if (tk !== this.token) return
      this.question(q.slice(0, i), true)
      this.fakeLv = 0.3 + 0.5 * Math.abs(Math.sin(i * 0.9))
      await wait(36)
    }
    this.question(q)
    this.faking = false
    await wait(260)
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
    if (!follow) this.question('говорите, я слушаю')
    let heard = false
    setTimeout(() => {
      if (tk !== this.token || heard || this.state !== 'listening') return
      if (!follow) this.toast('Не слышу. Коснитесь и скажите ещё раз.')
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
        if (!follow) this.toast('Не услышал. Коснитесь и говорите.')
        this.toIdle()
      },
      onError: (k) => {
        if (tk !== this.token) return
        if (k === 'denied') {
          this.input = 'tap'
          this.wakeOn = false
          this.toast('Нет доступа к микрофону. Включил режим касания.')
          this.toIdle()
        } else if (k === 'network') this.roadEvent('offline')
        else if (k !== 'no-speech') {
          this.toast('Микрофон занят. Попробуйте ещё раз.')
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
    this.talk()
    if (this.lastShown && this.lastShown.title !== r.title) this.foldPast(this.lastShown)
    // the old answer clears; the steps of the new one tick off
    $(this.root, '.v-head').textContent = ''
    $(this.root, '.v-title').textContent = ''
    this.sub('')
    if (think && r.thinking) {
      this.set('thinking')
      for (let i = 0; i < r.thinking.length; i++) {
        this.steps(r.thinking, i)
        await wait(620)
        if (tk !== this.token) return
      }
      this.steps(r.thinking, r.thinking.length)
      await wait(180)
      if (tk !== this.token) return
    }
    this.steps([], 0)
    this.last = r
    this.set('speaking')
    this.answer(r, true)
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
        onLevel: (lv) => (this.fakeLv = lv),
        onProgress: (p) => ((timed = true), (this.progressTarget = p)),
      })
      clearInterval(tick)
    } else {
      while (performance.now() - t0 < est && tk === this.token) {
        this.progressTarget = Math.min(1, (performance.now() - t0) / est)
        this.fakeLv = 0.3 + 0.4 * Math.random()
        await wait(140)
      }
    }
    if (tk !== this.token) return
    this.toIdle()
    if (this.input === 'voice' && voice.isOn() && /\?\s*$/.test(r.say)) setTimeout(() => this.state === 'idle' && this.listen(true), 350)
    if (this.input === 'demo' && this.demoStep < DEMO_QUESTIONS.length) setTimeout(() => this.state === 'idle' && this.ask(), 1600)
  }

  private toIdle() {
    this.token++
    ears.stopListening()
    voice.stop()
    this.road = null
    this.steps([], 0)
    this.set('idle')
    if (this.last) this.answer(this.last, false)
    else if (!$(this.root, '.v-talk').hidden) this.question('')
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
          this.toast('Нет доступа к микрофону. Слово «ась» выключено.')
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
    this.talk()
    this.set('paused')
    this.answer(ROAD[k], true)
    this.buzz(20, undefined, 0.9)
    const r = ROAD[k]
    if (r.say && voice.isOn()) voice.speak(k, r.say)
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
    const form = $<HTMLFormElement>(this.root, '.v-compose')
    form.hidden = !open
    this.root.toggleAttribute('data-compose', open)
    if (open) {
      if (this.state !== 'idle') this.toIdle()
      const inp = $<HTMLInputElement>(this.root, '.v-input')
      inp.value = ''
      inp.focus()
      if (!reduced()) form.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: EASE_OUT })
    } else $<HTMLInputElement>(this.root, '.v-input').blur()
    this.set(this.state)
  }

  private submit() {
    const inp = $<HTMLInputElement>(this.root, '.v-input')
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
    // the whole screen is the tap target, except the controls
    app.addEventListener('pointerdown', (e) => {
      if (isControl(e.target)) return
      if (this.hold.down) return void (this.hold.down = false) // a second finger cancels: palm or bump
      this.hold = { x: e.clientX, y: e.clientY, t: performance.now(), down: true, id: e.pointerId }
      this.touchMark(e.clientX, e.clientY, true)
    })
    app.addEventListener('pointercancel', () => ((this.hold.down = false), this.touchMark(0, 0, false)))
    app.addEventListener('pointerup', (e) => {
      if (!this.hold.down || e.pointerId !== this.hold.id) return
      this.hold.down = false
      this.touchMark(0, 0, false)
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
      this.buzz(6, e.clientX - app.getBoundingClientRect().left, 0.9)
      this.onTap()
    })
    app.addEventListener('keydown', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !isControl(e.target)) {
        e.preventDefault()
        this.onTap()
      }
      if (e.key === 'Escape' && this.composing) this.compose(false)
    })
    $(this.root, '.v-compose').addEventListener('submit', (e) => {
      e.preventDefault()
      this.submit()
    })
    app.addEventListener('click', (e) => {
      const t = e.target as HTMLElement
      if (t.closest('.v-menu')) return this.sheet(true)
      if (t.closest('.v-keys')) return this.compose(!this.composing)
      const s = t.closest<HTMLElement>('[data-sheet]')
      if (s) return this.act(s.dataset.sheet!, s.dataset.v)
      if (!voice.isOn()) voice.setOn(true)
      earcon.unlock()
      const xOf = (el: Element) => {
        const r = el.getBoundingClientRect()
        return r.left - app.getBoundingClientRect().left + r.width / 2
      }
      const mic = t.closest('.v-mic')
      if (mic) return (this.buzz(6, xOf(mic), 0.8), this.onMic())
      const sugg = t.closest<HTMLElement>('.v-s')
      if (sugg) return (this.buzz(6, xOf(sugg), 0.8), this.fakeSpeech(sugg.dataset.say!))
      if (t.closest('.v-past')) return this.unfoldPast()
      const act = t.closest<HTMLElement>('.v-act')
      if (act) return (this.buzz(act.dataset.act === 'save' ? [8, 30, 8] : 6, xOf(act), 0.8), this.control(act.dataset.act!))
    })
  }

  /** controls grown by 16 px all round: the nearest one under a near-miss */
  private nearControl(x: number, y: number): HTMLElement | null {
    const cands = [...this.root.querySelectorAll<HTMLElement>('.v-act, .v-mic, .v-s')].filter((el) => el.offsetParent)
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
    const r = this.root.getBoundingClientRect()
    m.getAnimations().forEach((a) => a.cancel())
    if (on) {
      m.style.left = `${x - r.left}px`
      m.style.top = `${y - r.top}px`
      if (!reduced()) m.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(0.7)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }], { duration: 160, easing: EASE_OUT, fill: 'forwards' })
      else m.style.opacity = '1'
    } else m.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: EASE_OUT, fill: 'forwards' })
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

  /** ась's button: ask when quiet, stop when busy, go on after a pause */
  private onMic() {
    if (this.state === 'idle') return void this.ask()
    if (this.state === 'paused') return this.onTap()
    if (this.state === 'listening' && this.input === 'voice') return ears.stopListening()
    if (voice.isOn()) earcon.stop()
    this.toIdle()
  }

  /** the folded line: bring that answer back, fold the current one */
  private unfoldPast() {
    const prev = this.lastShown
    const shown = $(this.root, '.v-past').querySelector('b')?.textContent
    const back = Object.values(REPLY).find((r) => r.head === shown)
    if (!back || !prev) return
    this.foldPast(prev)
    this.last = back
    this.answer(back, true)
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
    const row = (act: string, label: string, value = '') =>
      `<button class="s-row press" data-sheet="${act}"><span class="t">${label}</span>${value ? `<b>${value}</b>` : icon('arrow', 18)}</button>`
    $(this.root, '.a-sheet').innerHTML = `
      <div class="s-scrim" data-sheet="close"></div>
      <div class="s-body" role="dialog" aria-label="настройки">
        <div class="s-grab"></div>
        <h3>Как спрашивать</h3>
        ${seg('input', this.input, [['voice', 'Голосом'], ['tap', 'Касанием'], ['demo', 'Демо']])}
        <p>${this.input === 'voice' ? (ears.canHear ? 'Коснитесь экрана где угодно и спросите про ставку ЦБ. Понимаю «подробнее», «сохрани», «повтори», «стоп». Если ась спросил что-то в ответ, просто ответьте.' : 'Этот браузер не распознаёт речь. Включите «касанием» или пишите текстом.') : this.input === 'tap' ? 'Без микрофона: касание задаёт вопрос за вас.' : 'Сценарий проигрывается сам.'}</p>
        ${canWake ? row('wake', 'Слушать слово «ась»', this.wakeOn ? 'вкл' : 'выкл') : ''}
        ${row('sound', 'Голос ответа', voice.isOn() ? 'вкл' : 'выкл')}
        <h3>Тема</h3>
        ${seg('theme', this.theme, [['night', 'Тёмная'], ['light', 'Светлая']])}
        <h3>Ситуации в дороге</h3>
        <div class="s-grid">
          <button class="press" data-sheet="road" data-v="navigator">Навигатор говорит</button>
          <button class="press" data-sheet="road" data-v="toll">Шлагбаум</button>
          <button class="press" data-sheet="road" data-v="offline">Пропала сеть</button>
          <button class="press" data-sheet="road" data-v="call">Звонок</button>
        </div>
        <h3>Не открывая приложение</h3>
        <a class="s-row press" href="#/widget"><span class="t">Виджет и Dynamic Island</span>${icon('arrow', 18)}</a>
        <p>Android: «Добавить на главный экран», долгое нажатие на иконку, «Ставка ЦБ». iPhone: «Команды», «Открыть URL» с адресом <code>${location.origin}${location.pathname}?ask=rate</code> и фразой «ась».</p>
        <p class="s-note">Данные на ${DATA_AS_OF}. Экран не гаснет, пока приложение открыто.</p>
        <nav class="s-links"><a href="#/screens">Все экраны концепта</a><a href="#/flow">User flow</a><a href="#/guide">Гайд</a></nav>
      </div>`
  }

  private applyTheme() {
    this.root.dataset.theme = this.theme
    document.documentElement.dataset.mode = this.theme === 'night' ? 'night' : 'day'
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', this.theme === 'night' ? '#0b0b0c' : '#f4f3f0')
    this.band.setTheme(this.theme)
  }

  private toast(t: string) {
    const el = document.createElement('div')
    el.className = 'a-toast'
    el.textContent = t
    this.root.append(el)
    el.animate([{ opacity: 0, transform: 'translate(-50%, 6px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }], { duration: 200, easing: EASE_OUT, fill: 'both' })
    setTimeout(() => (el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' }).onfinish = () => el.remove()), 2600)
  }

  // ---------------------------------------------------------------- frame loop: the display gets a spectrum
  private tick = 0
  private loop = () => {
    const now = performance.now()
    if (this.state === 'listening') {
      if (this.input === 'voice' && !this.faking) this.band.feed(ears.spectrum(24))
      else this.band.feed(fakeSpectrum(this.fakeLv, now))
    } else if (this.state === 'speaking') {
      const sp = voice.spectrum(24)
      this.band.feed(sp.some((v) => v > 0) ? sp : fakeSpectrum(this.fakeLv, now))
    }
    if (this.state !== 'speaking') this.progressTarget = 0
    this.progress += (this.progressTarget - this.progress) * 0.18
    if (this.state === 'speaking') this.renderCaptions()
    if (now - this.tick > 1000) ((this.tick = now), ($(this.root, '.v-clock').textContent = hhmm()))
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
    this.band.destroy()
    this.wake?.release?.()
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** a believable voice-shaped spectrum from a single level (tap mode, browser voice) */
function fakeSpectrum(lv: number, now: number) {
  const out = new Float32Array(24)
  for (let i = 0; i < 24; i++) {
    const shape = Math.exp(-Math.pow((i - 5) / 6, 2)) * 0.9 + 0.15
    out[i] = Math.max(0, lv * shape * (0.6 + 0.4 * Math.sin(now / 90 + i * 1.7)))
  }
  return out
}
