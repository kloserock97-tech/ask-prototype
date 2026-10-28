// «ась?» — one working scenario: the driver asks about the key rate.
// The top of the screen shows the answer; the bottom half is one big tap zone
// with a live glow and a sphere of dots that follow the driver's voice and ась's state.

import { EASE_OUT, enter, reduced, spring } from '../motion'
import * as voice from '../voice'
import { Aurora } from './aurora'
import { assemble, dotFigure } from './dotfig'
import { DotOrb } from './dots'
import * as ears from './ears'
import { DropFace } from './face'
import { understand, type Intent } from './intents'
import { DATA_AS_OF, DEMO_QUESTIONS, REPLY, ROAD, type Card, type Reply, type Road } from './script'
import { canWake, startWake, stopWake } from './wake'

type State = 'idle' | 'listening' | 'thinking' | 'speaking' | 'paused'
type Input = 'voice' | 'tap' | 'demo'
type Look = 'dots' | 'drop'
export type Theme = 'sun' | 'day' | 'night'

const $ = <T extends Element = HTMLElement>(root: ParentNode, s: string) => root.querySelector(s) as T

const STATUS: Record<State, string> = { idle: 'жду', listening: 'слушаю', thinking: 'думаю', speaking: 'говорю', paused: 'пауза' }

// one stroke family for every icon: 24 grid, 2 px, round caps
const ICON: Record<string, string> = {
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  bookmark: '<path d="M6 4.5h12v16l-6-4-6 4z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  repeat: '<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5"/>',
  percent: '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
  wallet: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M16 13.5h2M6 7l9-3.5L16.5 7"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  ear: '<path d="M7 9a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-5.5 1.6"/><path d="M10 9.5a2 2 0 0 1 4 0"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5V4a1.5 1.5 0 0 1 3 0v6m0-4.5a1.5 1.5 0 0 1 3 0V11m0-3a1.5 1.5 0 0 1 3 0v6a7 7 0 0 1-7 7h-.5a7 7 0 0 1-5.6-2.8L4.3 15a1.6 1.6 0 0 1 2.5-2L8 14.5"/>',
}
export const icon = (k: string, size = 24) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`

const NEXT_ICON: Record<string, string> = { more: 'arrow', save: 'bookmark', repeat: 'repeat', listen: 'mic', rate: 'percent', advice: 'wallet' }

export class AskApp {
  readonly root = document.createElement('div')
  private aurora: Aurora
  private orb: DotOrb
  private face: DropFace | null = null
  private state: State = 'idle'
  private input: Input = ears.canHear ? 'voice' : 'tap'
  private look: Look = 'dots'
  private wakeOn = false
  private theme: Theme
  private last: Reply | null = null
  private lastIntent: Intent | null = null
  private road: Road | null = null
  private token = 0
  private raf = 0
  private wake: any = null
  private demoStep = 0
  private islandUntil = 0
  private hold = { x: 0, y: 0, t: 0, down: false, id: -1 }
  private changedAt = 0 // taps right after a state change are ignored (bumps, double taps)

  constructor() {
    this.theme = autoTheme()
    this.root.className = 'app'
    this.root.innerHTML = `
      <header class="a-top">
        <div class="a-island"><i></i><span>жду</span></div>
        <button class="a-menu press" aria-label="настройки и ситуации в дороге"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 8h16M4 16h16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>
      </header>
      <section class="a-answer" aria-live="polite"></section>
      <div class="a-next"></div>
      <button class="a-zone" aria-label="коснитесь, чтобы спросить">
        <canvas class="a-glow" aria-hidden="true"></canvas>
        <span class="a-grid" aria-hidden="true"></span>
        <span class="a-ripple" aria-hidden="true"></span>
        <canvas class="a-orb" aria-hidden="true"></canvas>
        <span class="a-face" aria-hidden="true" hidden></span>
        <span class="a-caption"></span>
        <span class="a-mark" aria-hidden="true"><i></i></span>
        <span class="a-cap"><span class="a-cap-bg"></span><span class="a-cap-in"></span></span>
      </button>
      <div class="a-sheet" hidden></div>`
    this.aurora = new Aurora($(this.root, '.a-glow'))
    this.orb = new DotOrb($(this.root, '.a-orb'))
    this.bind()
    this.applyTheme()
    this.showWelcome()
    this.set('idle')
    this.loop()
    this.keepAwake()
    this.watchLight()
    this.deepLink()
  }

  private manualTheme = false

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
        if (dim >= 5 && this.theme === 'sun') ((this.theme = autoTheme()), this.applyTheme())
      })
      s.start()
    } catch {
      /* no permission — manual switch stays */
    }
  }

  /** ?ask=rate | ?ask=listen — the home-screen shortcut and the Siri command land here */
  private deepLink() {
    const p = new URLSearchParams(location.search)
    const q = p.get('ask')
    if (!q) return
    history.replaceState(null, '', location.pathname + location.hash)
    setTimeout(() => {
      if (q === 'listen' && this.input === 'voice') this.listen()
      else this.fakeSpeech('какая ставка ЦБ на месяц?')
      // speech needs a tap first in every browser; say so once
      if (!voice.isOn()) this.toast('ответ без звука — коснитесь экрана, чтобы ась заговорил')
    }, 600)
  }

  // ---------------------------------------------------------------- state
  private set(s: State) {
    if (s !== this.state) this.changedAt = performance.now()
    this.state = s
    this.root.dataset.state = s
    this.island()
    this.aurora.setState(s === 'paused' ? 'paused' : s)
    this.orb.setState(s)
    this.face?.setState(s)
    const waits = this.wakeOn && this.input === 'voice'
    const cap: Record<State, string> = {
      idle: waits ? `${icon('ear', 22)}<span>«ась» или коснитесь</span>` : this.input === 'voice' ? `${icon('hand', 22)}<span>коснитесь где угодно</span>` : `${icon('hand', 22)}<span>коснитесь — спрошу</span>`,
      listening: `<span class="eq"><i></i><i></i><i></i><i></i><i></i></span><span>слушаю</span>`,
      thinking: `<span>думаю</span><span class="dots5"><i></i><i></i><i></i><i></i><i></i></span>`,
      speaking: `<span>коснитесь — перебить</span>`,
      paused: `<span>коснитесь — продолжить</span>`,
    }
    this.capsule(cap[s])
    $(this.root, '.a-zone').setAttribute('aria-label', $(this.root, '.a-cap-in').textContent || 'коснитесь')
    if (s !== 'listening') this.caption('')
  }

  /** the status capsule at the top — briefly a «live activity» after saving */
  private island(live?: string) {
    const el = $(this.root, '.a-island')
    if (live) {
      this.islandUntil = performance.now() + 4500
      el.dataset.live = ''
      $(el, 'span').innerHTML = live
      setTimeout(() => performance.now() >= this.islandUntil && this.island(), 4600)
    } else if (performance.now() >= this.islandUntil) {
      delete el.dataset.live
      $(el, 'span').textContent = this.road ? ROAD[this.road].chip : STATUS[this.state]
    } else return
    if (reduced()) return
    const s = spring(380, 24)
    el.animate([{ transform: 'scale(0.94)' }, { transform: 'scale(1)' }], { duration: s.duration, easing: s.easing })
  }

  /** bottom capsule: content swaps with a blur, the pill's width springs (scaleX on the backdrop only) */
  private capsule(html: string) {
    const cap = $(this.root, '.a-cap')
    const inner = $(this.root, '.a-cap-in')
    if (inner.innerHTML === html) return
    const before = cap.getBoundingClientRect().width
    inner.innerHTML = html
    const after = cap.getBoundingClientRect().width
    if (reduced() || !before || !after) return
    const s = spring(420, 26)
    $(this.root, '.a-cap-bg').animate([{ transform: `scaleX(${before / after})` }, { transform: 'scaleX(1)' }], { duration: s.duration, easing: s.easing })
    inner.animate([{ opacity: 0, filter: 'blur(3px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 200, easing: EASE_OUT })
  }

  /** live subtitles: the newest words bright, the rest of the phrase fades back */
  private caption(t: string) {
    const c = $(this.root, '.a-caption')
    const w = t.split(/\s+/).filter(Boolean)
    const cut = Math.max(0, w.length - 3)
    c.innerHTML = w.length ? `<span class="old">${w.slice(0, cut).join(' ')}</span> ${w.slice(cut).join(' ')}` : ''
    c.toggleAttribute('data-on', !!t)
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
      this.aurora.voice(0.35 + 0.4 * Math.abs(Math.sin(i * 0.9)))
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
        } else if (k === 'network') {
          this.roadEvent('offline')
        } else if (k !== 'no-speech') {
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
      // the shape of the answer-to-be, outlined, while ась looks it up
      if (r.thinking) this.answer({ kind: 'text', label: r.thinking, title: '' }, false, r.card.kind)
      this.next([])
      await wait(1300)
      if (tk !== this.token) return
    }
    this.last = r
    this.set('speaking')
    this.face?.setState(r.pose === 'unsure' ? 'unsure' : 'speaking')
    this.answer(r.card, true)
    this.next(r.chips ?? [])
    const t0 = performance.now()
    const word = () => (this.aurora.pulse(), this.orb.pulse())
    if (voice.isOn()) await voice.say(`«${r.say}»`, word)
    else {
      // no sound: the glow still «speaks» for as long as the line would take
      const ms = Math.min(7000, 900 + r.say.length * 45)
      while (performance.now() - t0 < ms && tk === this.token) {
        this.aurora.pulse(0.25)
        this.orb.pulse()
        await wait(260)
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
          this.aurora.touch(0.5)
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
    this.answer({ kind: 'text', label: r.label, title: r.title }, false)
    this.next([])
    if (r.say && voice.isOn()) voice.say(`«${r.say}»`, () => this.orb.pulse())
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

  // ---------------------------------------------------------------- answer zone
  /** `placeholder` = the kind of card that is coming: draw its outline instead */
  private answer(c: Card, event: boolean, placeholder?: Card['kind']) {
    const box = $(this.root, '.a-answer')
    const old = box.lastElementChild as HTMLElement | null
    const oldRect = old?.querySelector('.c-sum')?.getBoundingClientRect()
    const oldMini = old?.querySelector<HTMLElement>('.c-mini')
    const wasPlaceholder = !!old?.classList.contains('ph')
    // «сохрани»: the answer card flies up into the status capsule
    if (c.kind === 'saved' && old && !reduced()) this.flyToIsland(old)
    ;[...box.children].forEach((o) => {
      const a = o.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-8px)', filter: 'blur(4px)' }], { duration: 110, easing: EASE_OUT, fill: 'forwards' })
      a.onfinish = () => o.remove()
    })
    const el = document.createElement('div')
    el.className = 'a-card'
    if (placeholder) {
      el.classList.add('ph', `ph-${placeholder}`)
      const outline = `<div class="ph-box"><p class="ph-label">${c.kind === 'text' ? c.label : ''}</p><span class="dots5 big"><i></i><i></i><i></i><i></i><i></i></span></div>`
      // «подробнее»: the rate folds into the capsule right away, the forecast's outline waits below it
      el.innerHTML = placeholder === 'forecast' ? MINI + outline : outline
    } else el.innerHTML = cardHTML(c)
    box.append(el)
    const mini = el.querySelector<HTMLElement>('.c-mini')
    // the capsule is already in place — keep it still instead of fading one out and another in
    if (mini && oldMini) oldMini.style.visibility = 'hidden'
    const fig = el.querySelector('.c-fig')
    if (fig) fig.append(dotFigure('14%', '14 процентов', this.theme === 'sun' ? 1 : 0.84))
    if (c.kind === 'saved') this.island(`<b>14%</b> сохранено`)

    if (reduced()) return void [...el.children].forEach((it, i) => enter(it, 120 + i * 35, 0))
    const sum = el.querySelector('.c-sum')
    if (mini && oldMini) {
      ;[...el.children].slice(1).forEach((it, i) => enter(it, 120 + i * 40, 12))
    } else if (mini && oldRect) {
      // «подробнее»: the big card folds up into the capsule on top (FLIP on transform only)
      const nr = mini.getBoundingClientRect()
      const s = spring(340, 30)
      mini.animate(
        [{ transform: `translate(${oldRect.left - nr.left}px, ${oldRect.top - nr.top}px) scale(${oldRect.width / nr.width}, ${oldRect.height / nr.height})`, borderRadius: '28px' }, { transform: 'none' }],
        { duration: s.duration, easing: s.easing, fill: 'backwards' },
      )
      mini.querySelectorAll(':scope > *').forEach((x) => enter(x, 160, 0))
      ;[...el.children].slice(1).forEach((it, i) => enter(it, 180 + i * 40, 16))
    } else if (sum && event) {
      // the answer pours into the outline: from a hair smaller and soft to crisp
      const s = spring(300, 22)
      sum.animate([{ opacity: 0, transform: 'scale(0.96)', filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], {
        duration: s.duration,
        delay: wasPlaceholder ? 60 : 120,
        easing: s.easing,
        fill: 'backwards',
      })
      const svg = el.querySelector<SVGSVGElement>('.dotfig')
      if (svg && this.theme !== 'sun') assemble(svg, 140)
    } else [...el.children].forEach((it, i) => enter(it, 120 + i * 35, event ? 18 : 8))
    if (event) {
      this.aurora.flash()
      if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(10)
    }
  }

  private flyToIsland(from: HTMLElement) {
    const src = (from.querySelector('.c-sum, .c-mini') ?? from).getBoundingClientRect()
    const dst = $(this.root, '.a-island').getBoundingClientRect()
    const home = this.root.getBoundingClientRect() // the app may sit in a transformed phone frame
    if (!src.width) return
    const ghost = document.createElement('div')
    ghost.className = 'a-ghost'
    ghost.textContent = '14%'
    Object.assign(ghost.style, { left: `${src.left - home.left}px`, top: `${src.top - home.top}px`, width: `${src.width}px`, height: `${src.height}px` })
    this.root.append(ghost)
    const dx = dst.left + dst.width / 2 - (src.left + src.width / 2)
    const dy = dst.top + dst.height / 2 - (src.top + src.height / 2)
    const a = ghost.animate(
      [
        { transform: 'none', borderRadius: '28px', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) scale(${dst.width / src.width}, ${dst.height / src.height})`, borderRadius: '999px', opacity: 0.9 },
      ],
      { duration: 460, easing: 'cubic-bezier(0.32, 0.72, 0, 1)', fill: 'forwards' },
    )
    a.onfinish = () => ghost.remove()
  }

  /** two follow-ups at most: big rows with a round icon, like a concierge's action list */
  private next(list: { label: string; intent: string }[]) {
    const row = $(this.root, '.a-next')
    row.innerHTML = list
      .map((c, i) => `<button class="a-act press${i === 0 ? ' first' : ''}" data-intent="${c.intent}"><span class="ic">${icon(NEXT_ICON[c.intent] ?? 'arrow', 22)}</span>${c.label}</button>`)
      .join('')
    ;[...row.children].forEach((c, i) => enter(c, 260 + i * 50, 10))
  }

  private showWelcome() {
    const h = new Date().getHours()
    const [word, ic] = h >= 5 && h < 12 ? ['доброе утро', 'sun'] : h < 17 && h >= 12 ? ['добрый день', 'sun'] : h >= 17 && h < 23 ? ['добрый вечер', 'moon'] : ['доброй ночи', 'moon']
    this.answer({ kind: 'text', label: `${icon(ic, 26)} ${word}`, title: this.input === 'voice' ? 'спросите про ставку ЦБ' : 'коснитесь — спрошу про ставку ЦБ' }, false)
  }

  // ---------------------------------------------------------------- look: dots or the drop
  private setLook(l: Look) {
    this.look = l
    const host = $(this.root, '.a-face')
    $(this.root, '.a-orb').hidden = l !== 'dots'
    host.hidden = l !== 'drop'
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
    const zone = $(this.root, '.a-zone')
    zone.addEventListener('pointerdown', (e) => {
      if (this.hold.down) return void (this.hold.down = false) // a second finger cancels: palm or bump
      this.hold = { x: e.clientX, y: e.clientY, t: performance.now(), down: true, id: e.pointerId }
      const r = zone.getBoundingClientRect()
      const x = e.clientX - r.left, y = e.clientY - r.top
      const rip = $(this.root, '.a-ripple')
      rip.style.left = `${x}px`
      rip.style.top = `${y}px`
      rip.getAnimations().forEach((a) => a.cancel())
      if (!reduced()) rip.animate([{ transform: 'translate(-50%,-50%) scale(0.2)', opacity: 0.5 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }], { duration: 650, easing: EASE_OUT })
      // the touch mark jumps under the finger and springs back home
      const mark = $(this.root, '.a-mark')
      const home = mark.getBoundingClientRect()
      const s = spring(260, 20)
      if (!reduced())
        mark.animate(
          [{ transform: `translate(${e.clientX - (home.left + home.width / 2)}px, ${e.clientY - (home.top + 22)}px) scale(1.25)` }, { transform: 'none' }],
          { duration: s.duration + 200, easing: s.easing },
        )
      this.aurora.touch(x / r.width)
    })
    zone.addEventListener('pointercancel', () => (this.hold.down = false))
    zone.addEventListener('pointerup', (e) => {
      if (!this.hold.down || e.pointerId !== this.hold.id) return
      this.hold.down = false
      const dy = e.clientY - this.hold.y
      const dx = e.clientX - this.hold.x
      const dt = performance.now() - this.hold.t
      if (dy > 70 && Math.abs(dx) < dy) return this.toIdle() // swipe down = stop
      // a real tap: 60–700 ms, barely moved, not right after the screen changed
      if (dt < 60 || dt > 700 || Math.hypot(dx, dy) > 12) return
      if (performance.now() - this.changedAt < 300) return
      if (!voice.isOn() && this.input !== 'tap') voice.setOn(true) // first gesture unlocks speech
      this.onZone()
    })
    zone.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        this.onZone()
      }
    })
    this.root.addEventListener('click', (e) => {
      const t = e.target as HTMLElement
      const chip = t.closest<HTMLElement>('[data-intent]')
      if (chip) {
        if (!voice.isOn()) voice.setOn(true)
        const i = chip.dataset.intent!
        if (i === 'listen') return this.ask()
        if (i === 'unfold') return this.answer({ kind: 'rate' }, false)
        return this.handle(({ rate: 'ставка цб', more: 'подробнее', save: 'сохрани', repeat: 'повтори', advice: 'вклад' } as any)[i] ?? i)
      }
      if (t.closest('.a-menu')) return this.sheet(true)
      const act = t.closest<HTMLElement>('[data-act]')
      if (act) this.act(act.dataset.act!, act.dataset.v)
    })
  }

  private onZone() {
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

  // ---------------------------------------------------------------- settings sheet
  private act(a: string, v?: string) {
    if (a === 'close') return this.sheet(false)
    if (a === 'input') {
      this.input = v as Input
      this.demoStep = 0
      this.sheet(false)
      this.toIdle()
      this.showWelcome()
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
    const row = (act: string, ic: string, tone: string, label: string, value = '', v = '') =>
      `<button class="s-row press" data-act="${act}"${v ? ` data-v="${v}"` : ''}><span class="ic ${tone}">${icon(ic, 20)}</span><span class="t">${label}</span>${value ? `<b>${value}</b>` : icon('arrow', 18)}</button>`
    $(this.root, '.a-sheet').innerHTML = `
      <div class="s-scrim" data-act="close"></div>
      <div class="s-body" role="dialog" aria-label="настройки">
        <div class="s-grab"></div>
        <h3>как спрашивать</h3>
        ${seg('input', this.input, [['voice', 'голосом'], ['tap', 'касанием'], ['demo', 'демо']])}
        <p>${this.input === 'voice' ? (ears.canHear ? 'Коснитесь нижней половины и спросите про ставку ЦБ. Понимаю «подробнее», «сохрани», «повтори», «стоп».' : 'Этот браузер не распознаёт речь — включите «касанием».') : this.input === 'tap' ? 'Без микрофона: касание задаёт вопрос за вас.' : 'Сценарий проигрывается сам: вопрос, ответ, подробности, сохранение.'}</p>
        ${canWake ? row('wake', 'ear', 'cobalt', 'слушать слово «ась»', this.wakeOn ? 'вкл' : 'выкл') : ''}
        ${row('sound', 'mic', 'ink', 'голос ответа', voice.isOn() ? 'вкл' : 'выкл')}
        <h3>как выглядит ась</h3>
        ${seg('look', this.look, [['dots', 'точки'], ['drop', 'капля с глазами']])}
        <p>${this.look === 'dots' ? 'Без лица: лицо само притягивает взгляд, а за рулём каждая доля секунды на счету.' : 'Капля смотрит и моргает. Милее, но тянет взгляд — для сравнения.'}</p>
        <h3>цвет под свет</h3>
        ${seg('theme', this.theme, [['sun', 'солнце'], ['day', 'день'], ['night', 'ночь']])}
        <h3>ситуации в дороге</h3>
        <div class="s-grid">
          <button class="press" data-act="road" data-v="navigator">навигатор говорит</button>
          <button class="press" data-act="road" data-v="toll">шлагбаум</button>
          <button class="press" data-act="road" data-v="offline">пропала сеть</button>
          <button class="press" data-act="road" data-v="call">звонок</button>
        </div>
        <h3>не открывая приложение</h3>
        <a class="s-row press" href="#/widget"><span class="ic cobalt">${icon('percent', 20)}</span><span class="t">виджет и Dynamic Island</span>${icon('arrow', 18)}</a>
        <p>На Android: «Добавить на главный экран», потом долгое нажатие на иконку — «Ставка ЦБ». На iPhone: «Команды» → «Открыть URL» с адресом <code>${location.origin}${location.pathname}?ask=rate</code> и фразой «ась» — дальше «Привет, Siri, ась».</p>
        <p class="s-note">Данные на ${DATA_AS_OF}. Экран не гаснет, пока приложение открыто.</p>
        <nav class="s-links"><a href="#/screens">все экраны концепта</a><a href="#/flow">user flow</a><a href="#/guide">гайд</a></nav>
      </div>`
  }

  private applyTheme() {
    this.root.dataset.theme = this.theme
    document.documentElement.dataset.mode = this.theme === 'night' ? 'night' : 'day'
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', getComputedStyle(this.root).getPropertyValue('--bg').trim() || '#f2f2f6')
    this.aurora.setTheme(this.theme)
    this.orb.setTheme(this.theme)
    this.face?.setTheme(this.theme)
    // dot figures re-set to the theme's fill: fused in full sun, separate LEDs otherwise
    this.root.querySelectorAll<SVGSVGElement>('.dotfig').forEach((s) => s.querySelectorAll('circle').forEach((c) => c.setAttribute('r', String(this.theme === 'sun' ? 0.5 : 0.42))))
  }

  private toast(t: string) {
    const el = document.createElement('div')
    el.className = 'a-toast'
    el.textContent = t
    this.root.append(el)
    el.animate([{ opacity: 0, transform: 'translate(-50%, 8px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }], { duration: 220, easing: EASE_OUT, fill: 'both' })
    setTimeout(() => (el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' }).onfinish = () => el.remove()), 2600)
  }

  // ---------------------------------------------------------------- frame loop: mic level → glow, dots, capsule
  private loop = () => {
    if (this.state === 'listening' && this.input === 'voice') this.aurora.voice(ears.level())
    const lv = this.aurora.currentLevel()
    this.orb.level(this.state === 'listening' ? lv : lv * 0.5)
    this.face?.level(lv)
    if (this.state === 'listening') {
      const bars = this.root.querySelectorAll<HTMLElement>('.a-cap .eq i')
      const t = performance.now() / 1000
      bars.forEach((b, i) => (b.style.transform = `scaleY(${0.35 + Math.min(1, lv * (0.7 + 0.5 * Math.abs(Math.sin(t * 6 + i * 1.7)))) * 0.65})`))
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
    this.aurora.destroy()
    this.orb.destroy()
    this.face?.destroy()
    this.wake?.release?.()
  }
}

// ---------------------------------------------------------------- helpers
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function autoTheme(): Theme {
  const h = new Date().getHours()
  return h >= 7 && h < 19 ? 'day' : 'night'
}

/** the key-rate summary: one cobalt card, a sentence with icons set into it */
export function rateCard() {
  return `<div class="c-sum">
    <p class="c-top"><span>ставка ЦБ</span><span class="c-chip">ЦБ · 23 окт</span></p>
    <div class="c-fig"></div>
    <p class="c-line">до <span class="c-ichip">${icon('cal', 24)}18&nbsp;декабря</span></p>
  </div>`
}

/** the rate card folded into a capsule; a tap unfolds it again */
const MINI = `<button class="c-mini press" data-intent="unfold" aria-label="ставка сейчас: 14 процентов, развернуть"><span class="ic">${icon('percent', 18)}</span><b>14%</b><span>до 18 дек</span>${icon('down', 20)}</button>`

function cardHTML(c: Card): string {
  switch (c.kind) {
    case 'rate':
      return rateCard()
    case 'forecast':
      return `${MINI}<div class="c-fore"><p class="c-label">18 декабря</p><div class="c-split"><b class="dim">14%</b><b>13,75%</b><span>пауза</span><span class="acc">снижение</span><div class="c-bar" role="img" aria-label="мнения банков: 40 на 60"><i></i><i></i></div></div><p class="c-src">3 банка · 24 окт</p></div>`
    case 'saved':
      return `<p class="c-label">${icon('bookmark', 24)} сохранено в поездку</p><p class="c-title">покажу на стоянке</p>`
    case 'advice':
      return `<p class="c-label">а вклад открывать?</p><p class="c-title">советовать не&nbsp;возьмусь</p><p class="c-src quiet">вопрос сохранён</p>`
    case 'clarify':
      return `<p class="c-label">шумно. вы про…</p><p class="c-title">«ставка…»</p>`
    case 'text':
      return `<p class="c-label">${c.label}</p>${c.title ? `<p class="c-title">${c.title}</p>` : ''}`
  }
}
