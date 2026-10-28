// «ась?» — one working scenario: the driver asks about the key rate.
// The top of the screen shows the answer; the bottom half is one big tap zone
// with a live glow that follows the driver's voice and ась's state.

import { EASE_OUT, enter, reduced, spring, springIn } from '../motion'
import * as voice from '../voice'
import { Aurora } from './aurora'
import * as ears from './ears'
import { understand, type Intent } from './intents'
import { DATA_AS_OF, DEMO_QUESTIONS, REPLY, ROAD, type Card, type Reply, type Road } from './script'

type State = 'idle' | 'listening' | 'thinking' | 'speaking' | 'paused'
type Input = 'voice' | 'tap' | 'demo'
export type Theme = 'sun' | 'day' | 'night'

const POSE: Record<string, string> = { idle: 'ask-idle', listen: 'ask-listen', think: 'ask-glow', speak: 'ask-speak', unsure: 'ask-unsure', pause: 'ask-pause' }
const $ = <T extends Element = HTMLElement>(root: ParentNode, s: string) => root.querySelector(s) as T

const STATUS: Record<State, string> = { idle: 'жду', listening: 'слушаю', thinking: 'думаю', speaking: 'говорю', paused: 'пауза' }

export class AskApp {
  readonly root = document.createElement('div')
  private aurora: Aurora
  private state: State = 'idle'
  private input: Input = ears.canHear ? 'voice' : 'tap'
  private theme: Theme
  private last: Reply | null = null
  private lastIntent: Intent | null = null
  private road: Road | null = null
  private token = 0
  private raf = 0
  private wake: any = null
  private demoStep = 0
  private hold = { x: 0, y: 0, t: 0, down: false, id: -1 }
  private changedAt = 0 // taps right after a state change are ignored (bumps, double taps)

  constructor() {
    this.theme = autoTheme()
    this.root.className = 'app'
    this.root.innerHTML = `
      <header class="a-top">
        <div class="a-chip"><i></i><span>жду</span></div>
        <button class="a-menu press" aria-label="настройки и ситуации в дороге"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 8h16M4 16h16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></button>
      </header>
      <section class="a-answer" aria-live="polite"></section>
      <div class="a-chips"></div>
      <button class="a-zone" aria-label="коснитесь, чтобы спросить">
        <canvas class="a-glow" aria-hidden="true"></canvas>
        <span class="a-ripple" aria-hidden="true"></span>
        <img class="a-mascot" src="./img/ask-idle.webp" alt="" />
        <span class="a-caption"></span>
        <span class="a-hint"></span>
      </button>
      <div class="a-sheet" hidden></div>`
    this.aurora = new Aurora($(this.root, '.a-glow'))
    this.bind()
    this.applyTheme()
    this.showWelcome()
    this.set('idle')
    this.loop()
    this.keepAwake()
    this.watchLight()
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

  // ---------------------------------------------------------------- state
  private set(s: State) {
    if (s !== this.state) this.changedAt = performance.now()
    this.state = s
    this.root.dataset.state = s
    $(this.root, '.a-chip span').textContent = this.road ? ROAD[this.road].chip : STATUS[s]
    this.aurora.setState(s === 'paused' ? 'paused' : s)
    const hint: Record<State, string> = {
      idle: this.input === 'voice' ? 'коснитесь и спросите' : 'коснитесь — спрошу за вас',
      listening: 'говорите — коснитесь, когда закончите',
      thinking: 'коснитесь, чтобы отменить',
      speaking: 'коснитесь — перебить',
      paused: 'коснитесь — продолжить',
    }
    $(this.root, '.a-hint').textContent = hint[s]
    $(this.root, '.a-zone').setAttribute('aria-label', hint[s])
    if (s !== 'listening') this.caption('')
  }

  private pose(p: string) {
    const img = $<HTMLImageElement>(this.root, '.a-mascot')
    const src = `./img/${POSE[p]}.webp`
    if (img.getAttribute('src') === src) return
    if (reduced()) return void img.setAttribute('src', src)
    // a little blur hides the swap of two poses
    img.animate([{ filter: 'blur(0px)', opacity: 1 }, { filter: 'blur(6px)', opacity: 0.4 }], { duration: 110, easing: 'ease-in' }).onfinish = () => {
      img.setAttribute('src', src)
      img.animate([{ filter: 'blur(6px)', opacity: 0.4 }, { filter: 'blur(0px)', opacity: 1 }], { duration: 180, easing: EASE_OUT })
    }
  }

  private caption(t: string) {
    const c = $(this.root, '.a-caption')
    c.textContent = t
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
    this.set('listening')
    this.pose('listen')
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
    this.set('listening')
    this.pose('listen')
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
    if (think) {
      this.set('thinking')
      this.pose('think')
      if (r.thinking) this.answer({ kind: 'text', label: r.thinking, title: r.card.kind === 'forecast' ? 'прогноз на декабрь' : 'ставка ЦБ' }, false)
      await wait(1300)
      if (tk !== this.token) return
    }
    this.last = r
    this.set('speaking')
    this.pose(r.pose)
    this.answer(r.card, true)
    this.chips(r.chips ?? [])
    const t0 = performance.now()
    if (voice.isOn()) await voice.say(`«${r.say}»`, () => this.aurora.pulse())
    else {
      // no sound: the glow still «speaks» for as long as the line would take
      const ms = Math.min(7000, 900 + r.say.length * 45)
      while (performance.now() - t0 < ms && tk === this.token) {
        this.aurora.pulse(0.25)
        await wait(260)
      }
    }
    if (tk !== this.token) return
    this.toIdle(r.pose === 'unsure' ? 'unsure' : 'idle')
    if (this.input === 'demo' && this.demoStep < DEMO_QUESTIONS.length) setTimeout(() => this.state === 'idle' && this.ask(), 1600)
  }

  private toIdle(p = 'idle') {
    this.token++
    ears.stopListening()
    voice.stop()
    this.road = null
    this.set('idle')
    this.pose(p)
  }

  // ---------------------------------------------------------------- road events: ась behaves like a good passenger
  private roadEvent(k: Road) {
    const tk = ++this.token
    ears.stopListening()
    voice.stop()
    const wasSpeaking = this.last
    this.road = k
    this.set('paused')
    this.pose('pause')
    const r = ROAD[k]
    this.answer({ kind: 'text', label: r.label, title: r.title }, false)
    this.chips([])
    if (r.say && voice.isOn()) voice.say(`«${r.say}»`, () => this.aurora.pulse())
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
  private answer(c: Card, event: boolean) {
    const box = $(this.root, '.a-answer')
    const old = [...box.children]
    old.forEach((o) => {
      const a = o.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-8px)', filter: 'blur(4px)' }], { duration: 110, easing: EASE_OUT, fill: 'forwards' })
      a.onfinish = () => o.remove()
    })
    const el = document.createElement('div')
    el.className = 'a-card'
    el.innerHTML = cardHTML(c)
    box.append(el)
    const items = [...el.children]
    if (event && !reduced()) {
      const s = spring(300, 22)
      items.forEach((it, i) => springIn(it, 'translateY(28px)', 130 + i * 35, s))
      const fig = el.querySelector('.c-fig img, .c-fig b')
      if (fig) {
        const f = spring(420, 18)
        fig.animate([{ transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: f.duration, delay: 160, easing: f.easing, fill: 'both' })
      }
      this.aurora.flash()
      if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(10)
    } else items.forEach((it, i) => enter(it, 120 + i * 35, 8))
  }

  private chips(list: { label: string; intent: string }[]) {
    const row = $(this.root, '.a-chips')
    row.innerHTML = list.map((c) => `<button class="a-pill press" data-intent="${c.intent}">${c.label}</button>`).join('')
    ;[...row.children].forEach((c, i) => enter(c, 260 + i * 50, 10))
  }

  private showWelcome() {
    this.answer({ kind: 'text', label: 'ась на связи', title: this.input === 'voice' ? 'спросите про ставку ЦБ' : 'коснитесь — спрошу про ставку ЦБ' }, false)
  }

  // ---------------------------------------------------------------- input
  private bind() {
    const zone = $(this.root, '.a-zone')
    zone.addEventListener('pointerdown', (e) => {
      if (this.hold.down) return void (this.hold.down = false) // a second finger cancels: palm or bump
      this.hold = { x: e.clientX, y: e.clientY, t: performance.now(), down: true, id: e.pointerId }
      const r = zone.getBoundingClientRect()
      const rip = $(this.root, '.a-ripple')
      rip.style.left = `${e.clientX - r.left}px`
      rip.style.top = `${e.clientY - r.top}px`
      rip.getAnimations().forEach((a) => a.cancel())
      if (!reduced()) rip.animate([{ transform: 'translate(-50%,-50%) scale(0.2)', opacity: 0.5 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }], { duration: 650, easing: EASE_OUT })
      this.aurora.touch((e.clientX - r.left) / r.width)
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
    if (a === 'sound') {
      voice.setOn(!voice.isOn())
      this.renderSheet()
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
    $(this.root, '.a-sheet').innerHTML = `
      <div class="s-scrim" data-act="close"></div>
      <div class="s-body" role="dialog" aria-label="настройки">
        <div class="s-grab"></div>
        <h3>как спрашивать</h3>
        ${seg('input', this.input, [['voice', 'голосом'], ['tap', 'касанием'], ['demo', 'демо']])}
        <p>${this.input === 'voice' ? (ears.canHear ? 'Коснитесь нижней половины и спросите про ставку ЦБ. Понимаю «подробнее», «сохрани», «повтори», «стоп».' : 'Этот браузер не распознаёт речь — включите «касанием».') : this.input === 'tap' ? 'Без микрофона: касание задаёт вопрос за вас.' : 'Сценарий проигрывается сам: вопрос, ответ, подробности, сохранение.'}</p>
        <h3>цвет под свет</h3>
        ${seg('theme', this.theme, [['sun', 'солнце'], ['day', 'день'], ['night', 'ночь']])}
        <button class="s-row press" data-act="sound">${voice.isOn() ? 'голос включён' : 'голос выключен'}<b>${voice.isOn() ? 'выключить' : 'включить'}</b></button>
        <h3>ситуации в дороге</h3>
        <div class="s-grid">
          <button class="press" data-act="road" data-v="navigator">навигатор говорит</button>
          <button class="press" data-act="road" data-v="toll">шлагбаум</button>
          <button class="press" data-act="road" data-v="offline">пропала сеть</button>
          <button class="press" data-act="road" data-v="call">звонок</button>
        </div>
        <p class="s-note">Данные на ${DATA_AS_OF}. Экран не гаснет, пока приложение открыто.</p>
        <nav class="s-links"><a href="#/screens">все экраны концепта</a><a href="#/flow">user flow</a><a href="#/guide">гайд</a></nav>
      </div>`
  }

  private applyTheme() {
    this.root.dataset.theme = this.theme
    document.documentElement.dataset.mode = this.theme === 'night' ? 'night' : 'day'
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', getComputedStyle(this.root).getPropertyValue('--bg').trim() || '#f2f2f6')
    this.aurora.setTheme(this.theme)
  }

  private toast(t: string) {
    const el = document.createElement('div')
    el.className = 'a-toast'
    el.textContent = t
    this.root.append(el)
    el.animate([{ opacity: 0, transform: 'translate(-50%, 8px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }], { duration: 220, easing: EASE_OUT, fill: 'both' })
    setTimeout(() => (el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' }).onfinish = () => el.remove()), 2600)
  }

  // ---------------------------------------------------------------- frame loop: mic level → glow and mascot
  private loop = () => {
    if (this.state === 'listening' && this.input === 'voice') this.aurora.voice(ears.level())
    const m = $<HTMLElement>(this.root, '.a-mascot')
    const lv = this.aurora.currentLevel()
    if (!reduced()) m.style.transform = `translateY(${-lv * 8}px) scale(${1 + lv * 0.05})`
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
    voice.stop()
    this.aurora.destroy()
    this.wake?.release?.()
  }
}

// ---------------------------------------------------------------- helpers
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function autoTheme(): Theme {
  const h = new Date().getHours()
  return h >= 7 && h < 19 ? 'day' : 'night'
}

function cardHTML(c: Card): string {
  switch (c.kind) {
    case 'rate':
      return `<p class="c-label">ставка ЦБ</p><div class="c-fig"><img src="./img/fig-14.webp" alt="14%" /></div><p class="c-line">до&nbsp;18&nbsp;декабря</p><p class="c-src">ЦБ · 23 окт</p>`
    case 'forecast':
      return `<p class="c-label">18 декабря</p><div class="c-split"><b class="dim">14%</b><b>13,75%</b><span>пауза</span><span class="acc">снижение</span><div class="c-bar" role="img" aria-label="мнения банков: 40 на 60"><i></i><i></i></div></div><p class="c-src">3 банка · 24 окт</p>`
    case 'saved':
      return `<p class="c-label">покажу на стоянке</p><div class="c-fig"><b class="c-word">в поездку</b></div><p class="c-src">ставка · 2 источника</p>`
    case 'advice':
      return `<p class="c-label">а вклад открывать?</p><p class="c-title">советовать не&nbsp;возьмусь</p><p class="c-src quiet">вопрос сохранён</p>`
    case 'clarify':
      return `<p class="c-label">шумно. вы про…</p><p class="c-title">«ставка…»</p>`
    case 'text':
      return `<p class="c-label">${c.label}</p><p class="c-title">${c.title}</p>`
  }
}
