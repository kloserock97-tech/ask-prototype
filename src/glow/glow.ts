import * as voice from '../voice'
import * as ears from '../app/ears'
import * as wake from '../app/wake'
import * as earcon from '../app/earcon'
import { GlowScene } from './scene'

// «Свечение» — the full-screen «В дороге» voice mode, by the Figma flow:
// 4А «Поехали» → 5Б ready → 6Б listening → 7Б thinking → 8Б/8В answer,
// 7В offline. «Ась» or the button opens a conversation; follow-ups need no
// «Ась»; 30 s of silence closes it. On screen: the glow and one big line.

type Mode = 'start' | 'idle' | 'listen' | 'think' | 'answer' | 'offline'
type V3 = [number, number, number]
type Topic = { big: string; cap: string; heard: string; voiceId: string; say: string; top: V3; bottom: V3 }

const TOPICS: Record<string, Topic> = {
  rate: { heard: 'Ставка ЦБ', big: '14%', cap: 'ставка ЦБ', voiceId: 'g-rate-short', say: 'До декабря — 14%, дальше ЦБ обещает снижать медленно.', top: [0.42, 0.02, 0.3], bottom: [0.05, 0.0, 0.04] },
  hl: { heard: 'Half-Life 3', big: 'Half-Life 3', cap: 'пока не точно', voiceId: 'g-hl-short', say: 'Это слух. Valve молчит, есть только слова инсайдеров.', top: [0.5, 0.16, 0.01], bottom: [0.07, 0.02, 0.0] },
  unknown: { heard: 'Не понял', big: 'Не понял', cap: 'спросите про ставку или Half-Life 3', voiceId: 'g-unknown', say: 'В этом демо я знаю про ставку ЦБ и Half-Life 3.', top: [0.14, 0.14, 0.2], bottom: [0.02, 0.02, 0.04] },
}
const DEMO = ['rate', 'hl'] // without speech recognition, a tap plays these in turn
const SESSION_MS = 30000 // silence that closes a conversation
const NOT_DRIVING_MS = 10000

const ICON = {
  mic: '<svg viewBox="0 0 24 24"><path d="M12 3.5a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0v-5a3 3 0 0 0-3-3zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3"/></svg>',
  micOff: '<svg viewBox="0 0 24 24"><path d="M15 9.5v-3a3 3 0 0 0-5.6-1.5M9 9v2.5a3 3 0 0 0 5 2.2M5.5 11a6.5 6.5 0 0 0 10.6 5M18.5 11c0 .8-.1 1.5-.4 2.2M12 17.5v3M4 4l16 16"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
  car: '<svg viewBox="0 0 24 24"><path d="M4.5 15.5v-3.5l2-5h11l2 5v3.5zM4.5 15.5v2.5M19.5 15.5v2.5M4.5 12h15"/></svg>',
}

function intentOf(raw: string): string {
  const t = raw.toLowerCase().replace(/ё/g, 'е')
  if (/(стоп|хватит|помолчи|замолчи|приехали)/.test(t)) return 'stop'
  if (/(сохрани|запомни)/.test(t)) return 'save'
  if (/(half|халф|valve|вэлв|вальв|хл ?3)/.test(t)) return 'hl'
  if (/(ставк|цб|центробанк|ключев|процент)/.test(t)) return 'rate'
  return 'unknown'
}

export class GlowPage {
  readonly root = document.createElement('div')
  private scene = new GlowScene()
  private mode: Mode = 'start'
  private muted = false
  private paused = false
  private demo = 0
  private current: Topic = TOPICS.rate
  private pending: Topic | null = null
  private timers: Record<string, number> = {}
  private raf = 0
  private alive = true
  private ro: ResizeObserver
  private q = <T extends HTMLElement>(s: string) => this.root.querySelector(s) as T

  constructor() {
    this.root.className = 'gl-root'
    this.root.innerHTML = `
      <header class="gl-top">
        <button class="gl-chip" aria-label="Выйти из режима «В дороге»">${ICON.car}<span>В дороге</span>${ICON.close}</button>
      </header>
      <main class="gl-hero" aria-live="polite">
        <h1 class="gl-title"><span></span></h1>
        <p class="gl-cap"></p>
      </main>
      <button class="gl-notdriving">Я не за рулём</button>
      <footer class="gl-dock">
        <button class="gl-btn gl-ask">${ICON.mic}<span>Спросить</span></button>
        <button class="gl-btn gl-mute">${ICON.mic}<span>Без звука</span></button>
        <button class="gl-btn gl-end">${ICON.close}<span>Завершить</span></button>
      </footer>`
    this.root.prepend(this.scene.canvas)
    voice.prepare(Object.values(TOPICS).map((t) => t.voiceId))

    this.q('.gl-chip').addEventListener('click', () => this.leave())
    this.q('.gl-notdriving').addEventListener('click', () => this.leave())
    this.q('.gl-ask').addEventListener('click', () => this.open())
    this.q('.gl-end').addEventListener('click', () => this.close(true))
    this.q('.gl-mute').addEventListener('click', () => this.setMuted(!this.muted))
    // a tap anywhere else: pause / resume the answer — never a question
    this.root.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('button')) return
      earcon.unlock()
      this.scene.bump()
      if (this.mode === 'answer') this.togglePause()
    })
    addEventListener('online', this.onOnline)
    this.ro = new ResizeObserver(() => this.layout())
    this.ro.observe(this.root)
    document.fonts?.ready.then(() => this.layout())

    // 4А: the car moved while Ась was open — the conversation goes on in drive view
    this.setMode('start')
    this.setLine('Поехали', 'я на связи — говорите')
    this.after('notdriving', NOT_DRIVING_MS, () => this.root.classList.add('no-escape'))
    this.after('session', SESSION_MS, () => this.close(false))
  }

  // ---------------------------------------------------------------- layout
  private layout() {
    const r = this.root.getBoundingClientRect()
    const t = this.q('.gl-title').getBoundingClientRect()
    this.scene.center = { x: r.width / 2, y: t.top - r.top + t.height * 0.4 }
    this.scene.radius = Math.min(r.width * 0.44, 196)
    this.fitTitle()
  }

  /** the line fills the column: words up to 64 px, an answer figure up to 132 */
  private fitTitle() {
    const h = this.q('.gl-title')
    const span = h.lastElementChild as HTMLElement
    const max = this.mode === 'answer' && !span.textContent?.includes(' ') ? 132 : 64
    const w = this.q('.gl-hero').clientWidth - 32
    h.style.fontSize = `${max}px`
    const natural = span.getBoundingClientRect().width
    h.style.fontSize = `${Math.max(28, Math.min(max, Math.floor((max * w) / Math.max(1, natural))))}px`
  }

  private setLine(title: string, cap = '') {
    const h = this.q('.gl-title')
    const old = h.lastElementChild as HTMLElement
    if (old.textContent !== title) {
      const next = document.createElement('span')
      next.textContent = title
      h.append(next)
      this.fitTitle()
      if (old.textContent) {
        old.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: 160, easing: 'ease-in', fill: 'forwards' }).onfinish = () => old.remove()
        next.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', delay: 40, fill: 'backwards' })
      } else old.remove()
    }
    this.q('.gl-cap').textContent = cap
  }

  private setMode(m: Mode) {
    this.mode = m
    this.root.dataset.mode = m
    const g = this.scene.target
    const talking = m === 'start' || m === 'listen' || m === 'think' || m === 'answer'
    g.field = m === 'answer' ? 1 : 0
    g.spin = m === 'think' ? 1 : 0
    g.shrink = m === 'listen' ? 1 : 0
    g.dim = !talking || this.muted ? 0.4 : 1
    if (m !== 'answer') this.scene.setColors([0.42, 0.02, 0.3], [0.05, 0.0, 0.04])
    this.root.classList.toggle('in-session', talking)
  }

  // ---------------------------------------------------------------- timers
  private after(key: string, ms: number, fn: () => void) {
    clearTimeout(this.timers[key])
    this.timers[key] = window.setTimeout(() => this.alive && fn(), ms)
  }
  private cancel(key: string) {
    clearTimeout(this.timers[key])
  }

  // ---------------------------------------------------------------- flow
  /** 5Б → 6Б: «Ась» or the button opens a conversation */
  private open() {
    earcon.unlock()
    if (!navigator.onLine) return this.offline()
    wake.stopWake()
    this.root.classList.remove('is-followup')
    if (this.muted) this.setMuted(false)
    this.setMode('listen')
    this.setLine('Слушаю')
    earcon.listen()
    this.after('session', SESSION_MS, () => this.close(false))
    this.meter()
    ears.openMeter() // the glow follows the real voice; never waits for the permission prompt
    if (!ears.canHear) return this.after('demo', 2400, () => this.heard(DEMO[this.demo++ % DEMO.length]))
    ears.listen({
      onPartial: () => this.after('session', SESSION_MS, () => this.close(false)), // speaking keeps it open; no transcript on screen
      onFinal: (text) => this.heard(intentOf(text)),
      onSilence: () => this.mode === 'listen' && !this.muted && this.reopen(),
      onError: (k) => {
        // no mic or no recognizer service: the demo answers in turn
        if (k === 'denied' || (k === 'network' && navigator.onLine)) return this.after('demo', 2400, () => this.heard(DEMO[this.demo++ % DEMO.length]))
        if (k === 'network') return this.offline()
        if (this.mode === 'listen' && !this.muted) this.reopen()
      },
    })
  }

  /** the recognizer ends a phrase on its own; keep listening until the session times out */
  private reopen() {
    this.after('reopen', 300, () => this.mode === 'listen' && !this.muted && this.listenAgain())
  }

  private listenAgain() {
    if (!ears.canHear) return this.after('demo', 2400, () => this.heard(DEMO[this.demo++ % DEMO.length]))
    ears.listen({
      onPartial: () => this.after('session', SESSION_MS, () => this.close(false)),
      onFinal: (text) => this.heard(intentOf(text)),
      onSilence: () => this.mode === 'listen' && !this.muted && this.reopen(),
      onError: (k) => (k === 'network' && !navigator.onLine ? this.offline() : k === 'other' && this.mode === 'listen' && !this.muted && this.reopen()),
    })
  }

  /** 6Б → 7Б: show what was understood, then answer */
  private heard(intent: string) {
    ears.stopListening()
    this.cancel('demo')
    if (intent === 'stop') return this.close(true)
    if (intent === 'save') {
      this.setLine('Сохранил', 'в чат поездки')
      earcon.ready()
      return this.after('back', 1600, () => this.open())
    }
    const t = TOPICS[intent] ?? TOPICS.unknown
    this.setMode('think')
    this.setLine(t.heard)
    this.after('think', 1100, () => this.answer(t))
  }

  /** 8Б / 8В: one figure, the rest in the voice */
  private answer(t: Topic) {
    if (!navigator.onLine) {
      this.pending = t
      return this.offline()
    }
    this.current = t
    this.paused = false
    this.root.classList.remove('is-followup')
    this.setMode('answer')
    this.scene.setColors(t.top, t.bottom)
    this.setLine(t.big, t.cap)
    this.after('session', SESSION_MS, () => this.close(false))
    voice.speak(t.voiceId, t.say, { onLevel: (lv) => (this.scene.target.level = lv) }).then(() => {
      if (this.mode !== 'answer' || this.paused || !this.alive) return
      this.scene.target.level = 0
      // the follow-up needs no «Ась»: the figure stays, the mic opens
      this.root.classList.add('is-followup')
      this.after('followup', 600, () => this.mode === 'answer' && this.followUp())
    })
  }

  private followUp() {
    this.after('session', SESSION_MS, () => this.close(false))
    this.meter()
    if (!ears.canHear) return
    ears.listen({
      onPartial: () => {
        this.root.classList.remove('is-followup')
        this.setMode('listen')
        this.setLine('Слушаю')
      },
      onFinal: (text) => this.heard(intentOf(text)),
      onSilence: () => this.mode === 'answer' && this.after('followup', 300, () => this.followUp()),
      onError: () => {},
    })
  }

  private togglePause() {
    this.paused = !this.paused
    if (this.paused) {
      voice.stop()
      ears.stopListening()
      this.scene.target.level = 0
      this.root.classList.remove('is-followup')
      this.q('.gl-cap').textContent = 'пауза'
      this.after('session', SESSION_MS, () => this.close(false)) // a pause of 30 s is a stop
    } else this.answer(this.current)
  }

  private setMuted(on: boolean) {
    this.muted = on
    const b = this.q('.gl-mute')
    b.innerHTML = `${on ? ICON.micOff : ICON.mic}<span>${on ? 'Включить' : 'Без звука'}</span>`
    b.classList.toggle('is-on', on)
    this.scene.target.dim = on || this.mode === 'idle' || this.mode === 'offline' ? 0.4 : 1
    if (on) {
      ears.stopListening()
      this.cancel('demo')
      this.scene.target.level = 0
      if (this.mode === 'listen' || this.mode === 'start') this.setLine('Без звука', 'микрофон выключен')
    } else if (this.mode === 'listen' || this.mode === 'start') {
      this.setMode('listen')
      this.setLine('Слушаю')
      this.listenAgain()
    }
  }

  /** 6Б/8Б → 5Б: «Завершить» or 30 s of silence */
  private close(byUser: boolean) {
    for (const k of Object.keys(this.timers)) if (k !== 'notdriving') this.cancel(k)
    ears.stopListening()
    voice.stop()
    if (byUser) earcon.stop()
    this.root.classList.remove('is-followup')
    this.muted = false
    this.q('.gl-mute').classList.remove('is-on')
    this.setMode('idle')
    this.setLine('Скажите «Ась»', 'или нажмите кнопку')
    this.scene.target.level = 0
    if (wake.canWake)
      wake.startWake(
        (rest) => {
          this.open()
          if (rest) this.heard(intentOf(rest))
        },
        () => {},
      )
  }

  /** 7В: no network — the question waits, then is answered by voice */
  private offline() {
    ears.stopListening()
    this.setMode('offline')
    this.setLine('Нет связи', 'вопрос задам позже')
  }

  private onOnline = () => {
    if (this.mode !== 'offline') return
    const t = this.pending
    this.pending = null
    if (t) this.answer(t)
    else this.close(false)
  }

  /** the glow follows the driver's voice while the mic is open */
  private meter() {
    cancelAnimationFrame(this.raf)
    const tick = () => {
      this.raf = requestAnimationFrame(tick)
      if (this.mode === 'listen' || this.root.classList.contains('is-followup')) this.scene.target.level = this.muted ? 0 : ears.level()
    }
    tick()
  }

  private leave() {
    location.hash = '#/'
  }

  destroy() {
    this.alive = false
    for (const k of Object.keys(this.timers)) this.cancel(k)
    cancelAnimationFrame(this.raf)
    removeEventListener('online', this.onOnline)
    ears.stopListening()
    ears.closeMeter()
    wake.stopWake()
    voice.stop()
    this.ro.disconnect()
    this.scene.destroy()
  }
}
