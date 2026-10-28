// «ась?» — one working scenario: the driver asks about the key rate.
// Composition after the «Expiratory Volume» reference: a black field of dots,
// a halftone sphere (ась), the answer under it and a glowing panel at the bottom
// with a hint, a track and two controls. The whole screen is one tap target;
// only the controls, the keyboard and the menu are not.
//
// An answer shows three layers (see script.ts): a title on top, one big «head»
// and a short line under it. The full sentence is spoken and runs as captions
// while it plays — the screen never has to be read, only glanced at.

import { EASE_OUT, reduced, spring } from '../motion'
import * as voice from '../voice'
import * as ears from './ears'
import { DropFace } from './face'
import { Field } from './field'
import { understand, type Intent } from './intents'
import { AUDIO_IDS, DATA_AS_OF, DEMO_QUESTIONS, REPLY, ROAD, type Reply, type Road } from './script'
import { canWake, startWake, stopWake } from './wake'

type State = 'idle' | 'listening' | 'thinking' | 'speaking' | 'paused'
type Input = 'voice' | 'tap' | 'demo'
type Look = 'dots' | 'drop'
export type Theme = 'night' | 'light'

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

// the little pyramid of dots above the hint (reference: «Empty your lungs»)
const TRI = `<svg class="p-tri" viewBox="0 0 28 22" aria-hidden="true">${[[14, 3], [10.5, 8.5], [17.5, 8.5], [7, 14], [14, 14], [21, 14], [3.5, 19.5], [10.5, 19.5], [17.5, 19.5], [24.5, 19.5]]
  .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="1.9" style="--i:${i}"/>`)
  .join('')}</svg>`

const CHIP_ICON: Record<string, string> = { more: 'arrow', save: 'bookmark', repeat: 'repeat', listen: 'mic', rate: 'percent', advice: 'wallet' }
const CHIP_TEXT: Record<string, string> = { more: 'Подробнее', save: 'Сохранить', repeat: 'Повторить', listen: 'Ещё вопрос', rate: 'Ставку ЦБ', advice: 'Вклады' }

const WELCOME = { title: 'ась?', head: 'Спросите про ставку', sub: 'коснитесь экрана где угодно' }
const isNumber = (s: string) => /^[\d\s.,%−-]+$/.test(s)

export class AskApp {
  readonly root = document.createElement('div')
  private field: Field
  private face: DropFace | null = null
  private state: State = 'idle'
  private input: Input = ears.canHear ? 'voice' : 'tap'
  private lookMode: Look = 'dots'
  private wakeOn = false
  private theme: Theme = 'night'
  private manualTheme = false
  private composing = false
  private last: Reply | null = null
  private lastIntent: Intent | null = null
  private road: Road | null = null
  private token = 0
  private raf = 0
  private wake: any = null
  private demoStep = 0
  private progress = 0
  private progressTarget = 0
  private caps: { words: string[]; starts: number[]; total: number } | null = null
  private capShown = -1
  private aura = 0
  private lastFrame = performance.now()
  private hold = { x: 0, y: 0, t: 0, down: false, id: -1 }
  private changedAt = 0 // taps right after a state change are ignored (bumps, double taps)

  constructor() {
    this.root.className = 'app'
    this.root.innerHTML = `
      <canvas class="f-canvas" aria-hidden="true"></canvas>
      <header class="a-top">
        <button class="a-keys press" aria-label="написать вопрос">${icon('keys', 22)}</button>
        <h1 class="a-title">ась?</h1>
        <button class="a-menu press" aria-label="настройки и ситуации в дороге">${icon('menu', 22)}</button>
      </header>
      <section class="a-stage">
        <div class="f-sphere"><span class="a-face" aria-hidden="true" hidden></span></div>
        <div class="f-digits"><p class="a-head" aria-live="polite"></p></div>
        <p class="a-label"></p>
      </section>
      <section class="a-panel">
        <span class="p-aura" aria-hidden="true"></span>
        <span class="p-glow" aria-hidden="true"></span>
        <div class="p-hint">${TRI}<span class="p-hint-t"></span></div>
        <div class="p-track" aria-hidden="true"><i class="p-line"></i><i class="p-dash"></i><span class="p-ring"></span><i class="p-lime"></i><i class="p-dot"></i><span class="p-moon"></span></div>
        <div class="p-ctl">
          <button class="p-round press"></button>
          <button class="p-pill press"><span class="p-pill-t"></span><i class="p-pill-i"></i></button>
          <form class="p-compose" hidden>
            <input class="p-input" type="text" enterkeyhint="send" autocomplete="off" placeholder="Спросите ась…" aria-label="вопрос" />
            <button class="p-send press" type="submit" aria-label="отправить">${icon('up', 22)}</button>
          </form>
        </div>
      </section>
      <span class="a-touch" aria-hidden="true"><i></i></span>
      <div class="a-sheet" hidden></div>`
    this.field = new Field($(this.root, '.f-canvas'), {
      sphere: $(this.root, '.f-sphere'),
      digits: $(this.root, '.f-digits'),
      trail: [$(this.root, '.a-label'), $(this.root, '.a-panel')],
    })
    voice.prepare(AUDIO_IDS)
    this.bind()
    this.applyTheme()
    this.answer(WELCOME, false)
    this.set('idle')
    this.loop()
    this.keepAwake()
    this.watchLight()
    this.fitKeyboard()
    this.deepLink()
  }

  /** where the browser exposes a light sensor (Chrome on Android), switch to the light theme by itself;
   * slow hysteresis so a passing shadow doesn't make the screen blink */
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
    const p = at ?? this.field.sphereCentre
    this.field.wave(p.x, p.y, strength)
    // the panel feels it too: a quick squeeze, like the phone in the holder
    if (!reduced() && strength >= 0.8) {
      const s = spring(600, 18)
      $(this.root, '.a-panel').animate([{ transform: 'scale(0.985)' }, { transform: 'none' }], { duration: s.duration, easing: s.easing })
    }
  }

  // ---------------------------------------------------------------- state
  private set(s: State) {
    if (s !== this.state) this.changedAt = performance.now()
    this.state = s
    this.root.dataset.state = s
    this.field.setState(s)
    this.face?.setState(s)
    const waits = this.wakeOn && this.input === 'voice'
    const hint: Record<State, string> = {
      idle: waits ? 'Скажите «ась» или коснитесь' : this.input === 'voice' ? 'Коснитесь и спросите' : 'Коснитесь — спрошу за вас',
      listening: 'Слушаю',
      thinking: 'Думаю',
      speaking: 'Коснитесь — перебить',
      paused: this.road ? ROAD[this.road].title : 'Пауза',
    }
    this.hint(this.composing ? 'За рулём — лучше голосом' : hint[s])
    this.controls()
    if (s === 'listening') this.progressTarget = 0.04
    if (s === 'idle') this.progressTarget = this.last ? 1 : 0
  }

  private hint(t: string) {
    const el = $(this.root, '.p-hint-t')
    if (el.textContent === t) return
    el.textContent = t
    if (!reduced()) el.animate([{ opacity: 0, filter: 'blur(3px)', transform: 'translateY(4px)' }, { opacity: 1, filter: 'blur(0)', transform: 'none' }], { duration: 220, easing: EASE_OUT })
  }

  /** the two controls: a round one and a pill with a white circle, as in the reference */
  private controls() {
    const round = $(this.root, '.p-round')
    const pill = $(this.root, '.p-pill')
    const busy = this.state === 'listening' || this.state === 'thinking' || this.state === 'speaking'
    const chips = this.last?.chips ?? []
    let pillText = 'Спросить', pillIcon = 'mic', pillAct = 'ask'
    let roundIcon = 'repeat', roundAct = this.last ? 'repeat' : '', roundLabel = 'повторить'
    if (this.composing) ((roundIcon = 'x'), (roundAct = 'compose-close'), (roundLabel = 'закрыть клавиатуру'))
    else if (busy) {
      pillText = this.state === 'listening' ? 'Готово' : 'Стоп'
      pillIcon = this.state === 'listening' ? 'arrow' : 'x'
      pillAct = this.state === 'listening' ? 'done' : 'stop'
    } else if (this.state === 'paused') {
      ;[pillText, pillIcon, pillAct] = ['Продолжить', 'play', 'resume']
    } else if (chips.length) {
      ;[pillText, pillIcon, pillAct] = [CHIP_TEXT[chips[0].intent] ?? chips[0].label, CHIP_ICON[chips[0].intent] ?? 'arrow', chips[0].intent]
      if (chips[1]) ((roundIcon = CHIP_ICON[chips[1].intent] ?? 'repeat'), (roundAct = chips[1].intent), (roundLabel = CHIP_TEXT[chips[1].intent] ?? chips[1].label))
    }
    if (pill.dataset.act !== pillAct || $(this.root, '.p-pill-t').textContent !== pillText) {
      pill.dataset.act = pillAct
      pill.setAttribute('aria-label', pillText)
      $(this.root, '.p-pill-t').textContent = pillText
      $(this.root, '.p-pill-i').innerHTML = icon(pillIcon, 22)
      if (!reduced()) $(this.root, '.p-pill-t').animate([{ opacity: 0, filter: 'blur(3px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 200, easing: EASE_OUT })
    }
    round.dataset.act = roundAct
    round.toggleAttribute('disabled', !roundAct)
    round.setAttribute('aria-label', roundLabel)
    round.innerHTML = icon(roundIcon, 26)
  }

  // ---------------------------------------------------------------- the answer: title, head, line
  private answer(a: { title: string; head: string; sub: string }, event: boolean) {
    this.title(a.title)
    const head = $(this.root, '.a-head')
    const num = isNumber(a.head)
    if (head.textContent !== a.head || event) {
      head.textContent = a.head
      head.classList.toggle('num', num)
      this.fitHead()
      if (!reduced()) {
        if (num && event) {
          // the dots land into the figure, then the solid type takes over (video 2: preparing → all set)
          this.field.setText(a.head)
          head.animate([{ opacity: 0, filter: 'blur(12px)', transform: 'scale(0.96)' }, { opacity: 1, filter: 'blur(0)', transform: 'none' }], { duration: 520, delay: 520, easing: EASE_OUT, fill: 'backwards' })
        } else {
          this.field.setText('', true)
          head.animate([{ opacity: 0, filter: 'blur(8px)', transform: 'translateY(8px)' }, { opacity: 1, filter: 'blur(0)', transform: 'none' }], { duration: 380, delay: event ? 80 : 0, easing: EASE_OUT, fill: 'backwards' })
        }
      }
    }
    this.label(a.sub)
  }

  /** numbers fill the box; phrases sit on up to two lines */
  private fitHead() {
    const head = $(this.root, '.a-head')
    const box = $(this.root, '.f-digits')
    head.style.fontSize = ''
    if (!head.classList.contains('num')) return
    const h = box.clientHeight
    let fs = h * 1.18
    head.style.fontSize = `${fs}px`
    const w = head.scrollWidth
    if (w > box.clientWidth) head.style.fontSize = `${(fs *= box.clientWidth / w)}px`
  }

  private title(t: string) {
    const el = $(this.root, '.a-title')
    if (el.textContent === t) return
    el.textContent = t
    if (!reduced()) el.animate([{ opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 320, easing: EASE_OUT })
  }

  private label(t: string, cls = '') {
    const lab = $(this.root, '.a-label')
    this.caps = null
    this.capShown = -1
    if (lab.textContent === t && lab.className === `a-label ${cls}`.trim()) return
    lab.className = `a-label ${cls}`.trim()
    lab.textContent = t
    if (!reduced()) lab.animate([{ opacity: 0, filter: 'blur(4px)', transform: 'translateY(6px)' }, { opacity: 1, filter: 'blur(0)', transform: 'none' }], { duration: 300, easing: EASE_OUT })
  }

  /** live subtitles of the driver: the newest words bright, the start of the phrase fades */
  private caption(t: string) {
    if (!t) return
    const w = t.split(/\s+/).filter(Boolean)
    const cut = Math.max(0, w.length - 3)
    const lab = $(this.root, '.a-label')
    lab.className = 'a-label you'
    lab.innerHTML = `<span class="old">${w.slice(0, cut).join(' ')}</span> ${w.slice(cut).join(' ')}`
    this.caps = null
  }

  /** ась's own subtitles: the sentence being spoken, word by word with the audio */
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
    // show the sentence the voice is in, up to ~9 words at a time
    let i = starts.findIndex((s, k) => s <= pos && (starts[k + 1] ?? Infinity) > pos)
    if (i < 0) i = words.length - 1
    const from = Math.floor(i / 9) * 9
    const lab = $(this.root, '.a-label')
    if (from !== this.capShown) {
      this.capShown = from
      lab.className = 'a-label caps'
      lab.innerHTML = words.slice(from, from + 9).map((w) => `<span>${w}</span>`).join(' ')
      if (!reduced()) lab.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: EASE_OUT })
    }
    lab.querySelectorAll('span').forEach((s, k) => s.classList.toggle('on', from + k <= i))
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
    this.title('Слушаю')
    for (let i = 1; i <= q.length; i++) {
      if (tk !== this.token) return
      this.caption(q.slice(0, i))
      this.field.level(0.35 + 0.4 * Math.abs(Math.sin(i * 0.9)))
      this.progressTarget = (i / q.length) * 0.92
      await wait(38)
    }
    await wait(350)
    if (tk === this.token) this.handle(q)
  }

  private async listen() {
    const tk = ++this.token
    voice.stop()
    stopWake()
    this.set('listening')
    this.title('Слушаю')
    this.buzz(8, undefined, 0.6)
    await ears.openMeter()
    if (tk !== this.token) return
    ears.listen({
      onPartial: (t) => tk === this.token && this.caption(t),
      onFinal: (t) => {
        if (tk !== this.token) return
        this.caption(t)
        setTimeout(() => tk === this.token && this.handle(t), 250)
      },
      onSilence: () => {
        if (tk !== this.token || this.state !== 'listening') return
        this.toast('не услышал — коснитесь и говорите')
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
      this.title(r.title)
      this.fadeHead()
      // the steps of the work, each with a light running through the words
      for (const step of r.thinking ?? ['думаю']) {
        this.label(step, 'think')
        await wait(700)
        if (tk !== this.token) return
      }
    }
    this.last = r
    this.set('speaking')
    this.face?.setState(r.pose === 'unsure' ? 'unsure' : 'speaking')
    this.answer(r, true)
    this.buzz([12, 60, 12])
    this.controls()
    this.progress = this.progressTarget = 0
    const t0 = performance.now()
    const est = Math.min(9000, 900 + r.say.length * 58)
    if (voice.isOn()) {
      this.speakCaptions(r.say)
      // the recording drives everything: loudness lights the dots, position fills the line and the captions
      let timed = false
      const tick = setInterval(() => !timed && (this.progressTarget = Math.min(1, (performance.now() - t0) / est)), 120)
      await voice.speak(r.audio, r.say, {
        onLevel: (lv) => this.field.level(lv * 0.8),
        onWord: () => this.field.pulse(),
        onProgress: (p) => ((timed = true), (this.progressTarget = p)),
      })
      clearInterval(tick)
    } else {
      // no sound: the captions and the sphere still «speak» for as long as the line would take
      this.speakCaptions(r.say)
      while (performance.now() - t0 < est && tk === this.token) {
        this.progressTarget = Math.min(1, (performance.now() - t0) / est)
        this.field.pulse()
        await wait(260)
      }
    }
    if (tk !== this.token) return
    this.toIdle()
    if (this.input === 'demo' && this.demoStep < DEMO_QUESTIONS.length) setTimeout(() => this.state === 'idle' && this.ask(), 1600)
  }

  private fadeHead() {
    const head = $(this.root, '.a-head')
    if (!head.textContent) return
    if (reduced()) return void (head.textContent = '')
    head.animate([{ opacity: 1 }, { opacity: 0, filter: 'blur(8px)', transform: 'scale(0.98)' }], { duration: 160, easing: EASE_OUT, fill: 'forwards' }).onfinish = (e) => {
      head.textContent = ''
      ;(e.target as Animation).cancel()
    }
  }

  private toIdle() {
    this.token++
    ears.stopListening()
    voice.stop()
    this.road = null
    this.set('idle')
    // the captions fold back into the short line
    const a = this.last ?? WELCOME
    this.answer(a, false)
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
          // «ась, какая ставка?» in one breath — answer straight away
          if (rest && understand(rest) !== 'unknown') {
            this.set('listening')
            this.caption(rest)
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
    this.answer(r, false)
    this.buzz(20, { x: this.root.clientWidth / 2, y: 0 }, 0.9)
    if (r.say && voice.isOn()) voice.speak(k, r.say, { onWord: () => this.field.pulse() })
    if (k === 'navigator' || k === 'toll' || k === 'call') {
      // resume by itself, from the start of the phrase
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
    const form = $<HTMLFormElement>(this.root, '.p-compose')
    const pill = $(this.root, '.p-pill')
    form.hidden = !open
    pill.hidden = open
    this.root.toggleAttribute('data-compose', open)
    if (open) {
      if (this.state !== 'idle') this.toIdle()
      const inp = $<HTMLInputElement>(this.root, '.p-input')
      inp.value = ''
      inp.focus()
      if (!reduced()) form.animate([{ opacity: 0, transform: 'translateY(8px) scale(0.98)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: EASE_OUT })
    } else $<HTMLInputElement>(this.root, '.p-input').blur()
    this.set(this.state)
  }

  private submit() {
    const inp = $<HTMLInputElement>(this.root, '.p-input')
    const q = inp.value.trim()
    if (!q) return
    if (!voice.isOn()) voice.setOn(true)
    this.compose(false)
    this.buzz(8, undefined, 0.6)
    this.caption(q)
    this.title('Вы спросили')
    setTimeout(() => this.handle(q), 300)
  }

  // ---------------------------------------------------------------- look: dots or the drop
  private setLook(l: Look) {
    this.lookMode = l
    const host = $(this.root, '.a-face')
    host.hidden = l !== 'drop'
    this.field.sphereOn = l === 'dots'
    if (l === 'drop' && !this.face) {
      this.face = new DropFace(host)
      this.face.setTheme(this.theme)
      this.face.setState(this.state)
    } else if (l === 'dots') {
      this.face?.destroy()
      this.face = null
    }
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
      const r = app.getBoundingClientRect()
      this.field.wave(e.clientX - r.left, e.clientY - r.top, 0.9)
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
      // a real tap: 60–700 ms, barely moved, not right after the screen changed
      if (dt < 60 || dt > 700 || Math.hypot(dx, dy) > 12) return
      if (performance.now() - this.changedAt < 300) return
      if (this.composing) return this.compose(false)
      if (!voice.isOn()) voice.setOn(true) // the first gesture unlocks speech, in every mode
      const r = app.getBoundingClientRect()
      this.buzz(6, { x: e.clientX - r.left, y: e.clientY - r.top }, 0.9)
      this.onTap()
    })
    app.addEventListener('keydown', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !isControl(e.target)) {
        e.preventDefault()
        this.onTap()
      }
      if (e.key === 'Escape' && this.composing) this.compose(false)
    })
    $(this.root, '.p-compose').addEventListener('submit', (e) => {
      e.preventDefault()
      this.submit()
    })
    app.addEventListener('click', (e) => {
      const t = e.target as HTMLElement
      if (t.closest('.a-menu')) return this.sheet(true)
      if (t.closest('.a-keys')) return this.compose(!this.composing)
      const ctl = t.closest<HTMLElement>('.p-pill, .p-round')
      if (ctl?.dataset.act) {
        if (!voice.isOn()) voice.setOn(true)
        return this.control(ctl.dataset.act, ctl)
      }
      const act = t.closest<HTMLElement>('[data-act]')
      if (act) this.act(act.dataset.act!, act.dataset.v)
    })
  }

  /** the white dot with a halo under the finger (reference: «Activate Your Potential») */
  private touchMark(x: number, y: number, on: boolean) {
    const m = $(this.root, '.a-touch')
    if (on) {
      const r = this.root.getBoundingClientRect()
      m.style.left = `${x - r.left}px`
      m.style.top = `${y - r.top}px`
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

  private control(a: string, from: HTMLElement) {
    const r = from.getBoundingClientRect(), h = this.root.getBoundingClientRect()
    this.buzz(a === 'save' ? [8, 30, 8] : 6, { x: r.left - h.left + r.width / 2, y: r.top - h.top + r.height / 2 }, 0.8)
    if (a === 'compose-close') return this.compose(false)
    if (a === 'ask' || a === 'listen') return void this.ask()
    if (a === 'stop') return this.toIdle()
    if (a === 'done') return ears.stopListening()
    if (a === 'resume') return this.onTap()
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
    if (a === 'look') {
      this.setLook(v as Look)
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
      `<div class="s-seg">${opts.map(([v, l]) => `<button class="press" data-act="${act}" data-v="${v}" ${v === cur ? 'aria-current="true"' : ''}>${l}</button>`).join('')}</div>`
    const row = (act: string, ic: string, label: string, value = '') =>
      `<button class="s-row press" data-act="${act}"><span class="ic">${icon(ic, 20)}</span><span class="t">${label}</span>${value ? `<b>${value}</b>` : icon('arrow', 18)}</button>`
    $(this.root, '.a-sheet').innerHTML = `
      <div class="s-scrim" data-act="close"></div>
      <div class="s-body" role="dialog" aria-label="настройки">
        <div class="s-grab"></div>
        <h3>как спрашивать</h3>
        ${seg('input', this.input, [['voice', 'голосом'], ['tap', 'касанием'], ['demo', 'демо']])}
        <p>${this.input === 'voice' ? (ears.canHear ? 'Коснитесь экрана где угодно и спросите про ставку ЦБ. Понимаю «подробнее», «сохрани», «повтори», «стоп». Написать текстом — кнопка клавиатуры слева вверху.' : 'Этот браузер не распознаёт речь — включите «касанием» или пишите текстом.') : this.input === 'tap' ? 'Без микрофона: касание задаёт вопрос за вас.' : 'Сценарий проигрывается сам: вопрос, ответ, подробности, сохранение.'}</p>
        ${canWake ? row('wake', 'ear', 'слушать слово «ась»', this.wakeOn ? 'вкл' : 'выкл') : ''}
        ${row('sound', 'mic', 'голос ответа', voice.isOn() ? 'вкл' : 'выкл')}
        <h3>как выглядит ась</h3>
        ${seg('look', this.lookMode, [['dots', 'сфера из точек'], ['drop', 'капля с глазами']])}
        <h3>тема</h3>
        ${seg('theme', this.theme, [['night', 'тёмная'], ['light', 'светлая']])}
        <p>Светлая — для яркого дня: под прямым солнцем тёмный экран превращается в зеркало.</p>
        <h3>ситуации в дороге</h3>
        <div class="s-grid">
          <button class="press" data-act="road" data-v="navigator">навигатор говорит</button>
          <button class="press" data-act="road" data-v="toll">шлагбаум</button>
          <button class="press" data-act="road" data-v="offline">пропала сеть</button>
          <button class="press" data-act="road" data-v="call">звонок</button>
        </div>
        <h3>не открывая приложение</h3>
        <a class="s-row press" href="#/widget"><span class="ic">${icon('percent', 20)}</span><span class="t">виджет и Dynamic Island</span>${icon('arrow', 18)}</a>
        <p>На Android: «Добавить на главный экран», потом долгое нажатие на иконку — «Ставка ЦБ». На iPhone: «Команды» → «Открыть URL» с адресом <code>${location.origin}${location.pathname}?ask=rate</code> и фразой «ась» — дальше «Привет, Siri, ась».</p>
        <p class="s-note">Данные на ${DATA_AS_OF}. Экран не гаснет, пока приложение открыто.</p>
        <nav class="s-links"><a href="#/screens">все экраны концепта</a><a href="#/flow">user flow</a><a href="#/guide">гайд</a></nav>
      </div>`
  }

  private applyTheme() {
    this.root.dataset.theme = this.theme
    document.documentElement.dataset.mode = this.theme === 'night' ? 'night' : 'day'
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', this.theme === 'night' ? '#000000' : '#f3f3f8')
    this.field.setTheme(this.theme)
    this.face?.setTheme(this.theme)
  }

  private toast(t: string) {
    const el = document.createElement('div')
    el.className = 'a-toast'
    el.textContent = t
    this.root.append(el)
    el.animate([{ opacity: 0, transform: 'translate(-50%, 8px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }], { duration: 220, easing: EASE_OUT, fill: 'both' })
    setTimeout(() => (el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' }).onfinish = () => el.remove()), 2600)
  }

  // ---------------------------------------------------------------- frame loop: voice → dots, panel glow, track, captions
  private loop = () => {
    const now = performance.now()
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000)
    this.lastFrame = now
    let lv = 0
    if (this.state === 'listening' && this.input === 'voice') {
      lv = ears.level()
      this.field.level(lv)
      // the track fills as you talk, like the exhale in the reference
      this.progressTarget = Math.min(0.92, this.progressTarget + lv * 0.006)
    }
    this.face?.level(lv)
    // «думаю»: the lime line scans back and forth — work in progress, not a fake percentage
    if (this.state === 'thinking' && !reduced()) this.progressTarget = 0.5 - 0.46 * Math.cos(now / 480)
    // the panel's rim light drifts round, faster while ась works
    const speed = { idle: 0.25, listening: 0.6, thinking: 2.2, speaking: 0.9, paused: 0 }[this.state]
    if (!reduced()) this.aura = (this.aura + speed * dt * 60) % 360
    const aura = $(this.root, '.p-aura')
    aura.style.transform = `rotate(${this.aura.toFixed(1)}deg)`
    aura.style.opacity = String(this.state === 'paused' ? 0.15 : this.state === 'thinking' ? 1 : this.state === 'listening' ? 0.6 + lv * 0.4 : 0.55)
    const p = this.state === 'thinking' ? this.progressTarget : this.progress + (this.progressTarget - this.progress) * 0.12
    if (Math.abs(p - this.progress) > 0.0005) {
      this.progress = p
      $(this.root, '.p-track').style.setProperty('--p', p.toFixed(4))
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
    this.face?.destroy()
    this.wake?.release?.()
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
