// «ась?» — one working scenario: the driver asks about the key rate.
// Composition after the «Expiratory Volume» reference: a black field of dots,
// a halftone sphere (ась), a dotted figure with a small label under it, and a
// glowing panel at the bottom with two readings, a hint, a track and two controls.
// The whole screen is one tap target; only the two controls and the menu are not.

import { EASE_OUT, reduced, spring } from '../motion'
import * as voice from '../voice'
import * as ears from './ears'
import { DropFace } from './face'
import { Field } from './field'
import { understand, type Intent } from './intents'
import { DATA_AS_OF, DEMO_QUESTIONS, REPLY, ROAD, type Card, type Reply, type Road } from './script'
import { canWake, startWake, stopWake } from './wake'

type State = 'idle' | 'listening' | 'thinking' | 'speaking' | 'paused'
type Input = 'voice' | 'tap' | 'demo'
type Look = 'dots' | 'drop'
export type Theme = 'night' | 'sun'

const $ = <T extends Element = HTMLElement>(root: ParentNode, s: string) => root.querySelector(s) as T

// one stroke family for every icon: 24 grid, 2 px, round caps
const ICON: Record<string, string> = {
  x: '<path d="M7 7l10 10M17 7 7 17"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  bookmark: '<path d="M6 4.5h12v16l-6-4-6 4z"/>',
  repeat: '<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  percent: '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
  wallet: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M16 13.5h2M6 7l9-3.5L16.5 7"/>',
  ear: '<path d="M7 9a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-5.5 1.6"/><path d="M10 9.5a2 2 0 0 1 4 0"/>',
  menu: '<path d="M5 9h14M5 15h14"/>',
}
export const icon = (k: string, size = 24) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`

// the little pyramid of dots above the hint (reference: «Empty your lungs»)
const TRI = `<svg class="p-tri" viewBox="0 0 28 22" aria-hidden="true">${[[14, 3], [10.5, 8.5], [17.5, 8.5], [7, 14], [14, 14], [21, 14], [3.5, 19.5], [10.5, 19.5], [17.5, 19.5], [24.5, 19.5]]
  .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="1.9" style="--i:${i}"/>`)
  .join('')}</svg>`

const CHIP_ICON: Record<string, string> = { more: 'arrow', save: 'bookmark', repeat: 'repeat', listen: 'mic', rate: 'percent', advice: 'wallet' }
const CHIP_TEXT: Record<string, string> = { more: 'Подробнее', save: 'Сохранить', repeat: 'Повторить', listen: 'Ещё вопрос', rate: 'Ставку ЦБ', advice: 'Вклады' }

/** what the field shows for each answer: a dotted figure and a short label under it */
function look(c: Card): { fig: string; label: string; stats?: [string, string, string, string] } {
  switch (c.kind) {
    case 'rate':
      return { fig: '14%', label: 'до 18 декабря' }
    case 'forecast':
      return { fig: '13,75%', label: '18 декабря · 60% банков за снижение', stats: ['14%', 'сейчас', '60/40', 'за снижение'] }
    case 'saved':
      return { fig: 'ок', label: 'сохранил — покажу на стоянке' }
    case 'advice':
      return { fig: '—', label: 'советовать не возьмусь' }
    case 'clarify':
      return { fig: '?', label: 'вы про ставку ЦБ или про вклады?' }
    case 'text':
      return { fig: c.label, label: c.title }
  }
}

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
  private last: Reply | null = null
  private lastIntent: Intent | null = null
  private road: Road | null = null
  private token = 0
  private raf = 0
  private wake: any = null
  private demoStep = 0
  private progress = 0
  private progressTarget = 0
  private hold = { x: 0, y: 0, t: 0, down: false, id: -1 }
  private changedAt = 0 // taps right after a state change are ignored (bumps, double taps)

  constructor() {
    this.root.className = 'app'
    this.root.innerHTML = `
      <canvas class="f-canvas" aria-hidden="true"></canvas>
      <header class="a-top">
        <h1 class="a-title">Ключевая ставка</h1>
        <button class="a-menu press" aria-label="настройки и ситуации в дороге">${icon('menu', 22)}</button>
      </header>
      <section class="a-stage">
        <div class="f-sphere"><span class="a-face" aria-hidden="true" hidden></span></div>
        <div class="f-digits" role="img" aria-label=""></div>
        <p class="a-label" aria-live="polite"></p>
      </section>
      <section class="a-panel">
        <span class="p-glow" aria-hidden="true"></span>
        <div class="p-stat l"><b>23.10</b><span>решение</span></div>
        <div class="p-hint">${TRI}<span class="p-hint-t"></span></div>
        <div class="p-stat r"><b>18.12</b><span>заседание</span></div>
        <div class="p-track" aria-hidden="true"><i class="p-line"></i><i class="p-dash"></i><span class="p-ring"></span><i class="p-lime"></i><i class="p-dot"></i><span class="p-moon"></span></div>
        <div class="p-ctl">
          <button class="p-round press"></button>
          <button class="p-pill press"><span class="p-pill-t"></span><i class="p-pill-i"></i></button>
        </div>
      </section>
      <span class="a-touch" aria-hidden="true"><i></i></span>
      <div class="a-sheet" hidden></div>`
    this.field = new Field($(this.root, '.f-canvas'), {
      sphere: $(this.root, '.f-sphere'),
      digits: $(this.root, '.f-digits'),
      trail: [$(this.root, '.a-label'), $(this.root, '.a-panel')],
    })
    this.bind()
    this.applyTheme()
    this.showWelcome()
    this.set('idle')
    this.loop()
    this.keepAwake()
    this.watchLight()
    this.deepLink()
  }

  /** where the browser exposes a light sensor (Chrome on Android), switch to «солнце» by itself;
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
        if (bright >= 3 && this.theme !== 'sun') ((this.theme = 'sun'), this.applyTheme())
        if (dim >= 5 && this.theme === 'sun') ((this.theme = 'night'), this.applyTheme())
      })
      s.start()
    } catch {
      /* no permission — manual switch stays */
    }
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

  // ---------------------------------------------------------------- state
  private set(s: State) {
    if (s !== this.state) this.changedAt = performance.now()
    this.state = s
    this.root.dataset.state = s
    this.field.setState(s)
    this.face?.setState(s)
    const waits = this.wakeOn && this.input === 'voice'
    const hint: Record<State, string> = {
      idle: waits ? 'Скажите «ась» или коснитесь' : this.input === 'voice' ? 'Коснитесь где угодно' : 'Коснитесь — спрошу за вас',
      listening: 'Слушаю',
      thinking: 'Думаю',
      speaking: 'Коснитесь — перебить',
      paused: this.road ? ROAD[this.road].label : 'Пауза',
    }
    this.hint(hint[s])
    this.controls()
    if (s === 'listening') this.progressTarget = 0.04
    if (s === 'idle') this.progressTarget = this.last ? 1 : 0
    if (s !== 'listening') this.caption('')
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
    if (busy) {
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

  /** live subtitles under the figure: the newest words bright, the start of the phrase fades */
  private caption(t: string) {
    if (!t) return
    const w = t.split(/\s+/).filter(Boolean)
    const cut = Math.max(0, w.length - 3)
    $(this.root, '.a-label').innerHTML = `<span class="old">${w.slice(0, cut).join(' ')}</span> ${w.slice(cut).join(' ')}`
  }

  private show(fig: string, label: string, event = false, stats?: [string, string, string, string]) {
    this.field.setText(fig)
    $(this.root, '.f-digits').setAttribute('aria-label', fig)
    const lab = $(this.root, '.a-label')
    lab.textContent = label
    if (!reduced()) lab.animate([{ opacity: 0, transform: 'translateY(6px)', filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 320, delay: event ? 180 : 60, easing: EASE_OUT, fill: 'backwards' })
    const st = stats ?? ['23.10', 'решение', '18.12', 'заседание']
    const [l, r] = [$(this.root, '.p-stat.l'), $(this.root, '.p-stat.r')]
    if ($(l, 'b').textContent !== st[0]) {
      $(l, 'b').textContent = st[0]
      $(l, 'span').textContent = st[1]
      $(r, 'b').textContent = st[2]
      $(r, 'span').textContent = st[3]
      if (!reduced()) [l, r].forEach((x) => x.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: EASE_OUT }))
    }
    if (event && navigator.userActivation?.hasBeenActive) navigator.vibrate?.(10)
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
      this.field.setText('···')
      $(this.root, '.a-label').textContent = r.thinking ?? ''
      await wait(1400)
      if (tk !== this.token) return
    }
    this.last = r
    this.set('speaking')
    this.face?.setState(r.pose === 'unsure' ? 'unsure' : 'speaking')
    const l = look(r.card)
    this.show(l.fig, l.label, true, l.stats)
    this.controls()
    const t0 = performance.now()
    const est = Math.min(9000, 900 + r.say.length * 58)
    if (voice.isOn()) {
      // the recording drives everything: its loudness lights the dots, its position fills the line
      let timed = false
      const tick = setInterval(() => !timed && (this.progressTarget = Math.min(1, (performance.now() - t0) / est)), 120)
      await voice.speak(r.audio, r.say, {
        onLevel: (lv) => this.field.level(lv * 0.8),
        onWord: () => this.field.pulse(),
        onProgress: (p) => ((timed = true), (this.progressTarget = p)),
      })
      clearInterval(tick)
    } else {
      // no sound: the sphere still «speaks» for as long as the line would take
      while (performance.now() - t0 < Math.min(7000, est * 0.8) && tk === this.token) {
        this.progressTarget = Math.min(1, (performance.now() - t0) / (est * 0.8))
        this.field.pulse()
        await wait(280)
      }
    }
    if (tk !== this.token) return
    this.toIdle()
    if (this.input === 'demo' && this.demoStep < DEMO_QUESTIONS.length) setTimeout(() => this.state === 'idle' && this.ask(), 1600)
  }

  private toIdle() {
    this.token++
    ears.stopListening()
    voice.stop()
    this.road = null
    this.set('idle')
    if (!this.last) this.showWelcome()
    else if (this.last) {
      const l = look(this.last.card)
      this.field.setText(l.fig)
      if ($(this.root, '.a-label').textContent !== l.label) this.show(l.fig, l.label, false, l.stats)
    }
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
          if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(8)
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
    this.show(k === 'offline' ? '—' : 'пауза', r.title)
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

  private showWelcome() {
    this.show('?', this.input === 'voice' ? 'спросите про ставку ЦБ' : 'коснитесь — спрошу про ставку ЦБ')
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
    const isControl = (t: EventTarget | null) => !!(t as HTMLElement)?.closest?.('button, a, .a-sheet')
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
      // a real tap: 60–700 ms, barely moved, not right after the screen changed
      if (dt < 60 || dt > 700 || Math.hypot(dx, dy) > 12) return
      if (performance.now() - this.changedAt < 300) return
      if (!voice.isOn() && this.input !== 'tap') voice.setOn(true) // first gesture unlocks speech
      this.onTap()
    })
    app.addEventListener('keydown', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !isControl(e.target)) {
        e.preventDefault()
        this.onTap()
      }
    })
    app.addEventListener('click', (e) => {
      const t = e.target as HTMLElement
      if (t.closest('.a-menu')) return this.sheet(true)
      const ctl = t.closest<HTMLElement>('.p-pill, .p-round')
      if (ctl?.dataset.act) {
        if (!voice.isOn()) voice.setOn(true)
        return this.control(ctl.dataset.act)
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
    if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(6)
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

  private control(a: string) {
    if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(6)
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
      if (!this.last) this.showWelcome()
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
        <p>${this.input === 'voice' ? (ears.canHear ? 'Коснитесь экрана где угодно и спросите про ставку ЦБ. Понимаю «подробнее», «сохрани», «повтори», «стоп».' : 'Этот браузер не распознаёт речь — включите «касанием».') : this.input === 'tap' ? 'Без микрофона: касание задаёт вопрос за вас.' : 'Сценарий проигрывается сам: вопрос, ответ, подробности, сохранение.'}</p>
        ${canWake ? row('wake', 'ear', 'слушать слово «ась»', this.wakeOn ? 'вкл' : 'выкл') : ''}
        ${row('sound', 'mic', 'голос ответа', voice.isOn() ? 'вкл' : 'выкл')}
        <h3>как выглядит ась</h3>
        ${seg('look', this.lookMode, [['dots', 'сфера из точек'], ['drop', 'капля с глазами']])}
        <h3>под свет</h3>
        ${seg('theme', this.theme, [['night', 'тёмная'], ['sun', 'солнце']])}
        <p>«Солнце» — чёрные точки на белом и сплошная панель: под прямым солнцем тёмный экран превращается в зеркало.</p>
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
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', this.theme === 'night' ? '#000000' : '#ffffff')
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

  // ---------------------------------------------------------------- frame loop: voice → dots, panel glow, track
  private loop = () => {
    let lv = 0
    if (this.state === 'listening' && this.input === 'voice') {
      lv = ears.level()
      this.field.level(lv)
      // the track fills as you talk, like the exhale in the reference
      this.progressTarget = Math.min(0.92, this.progressTarget + lv * 0.006)
    }
    this.face?.level(lv)
    const glow = $(this.root, '.p-glow')
    const g = this.state === 'listening' ? 0.85 + lv * 0.15 : this.state === 'speaking' ? 0.95 : this.state === 'paused' ? 0.4 : 0.8
    glow.style.opacity = String(g)
    // the lime line eases toward its target
    const p = this.progress + (this.progressTarget - this.progress) * 0.12
    if (Math.abs(p - this.progress) > 0.0005) {
      this.progress = p
      $(this.root, '.p-track').style.setProperty('--p', p.toFixed(4))
    }
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
