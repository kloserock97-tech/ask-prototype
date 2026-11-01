import * as voice from '../voice'
import { GlowScene } from './scene'

// «Свечение»: Ась's home screen. Idle — a neon blob on black with a huge
// title and one round button; an answer floods the screen with the topic's
// colour and prints the one figure huge, like a title.

type Mode = 'idle' | 'listen' | 'think' | 'answer'
type V3 = [number, number, number]
type Topic = {
  key: string
  ask: string // what the driver says
  heard: string // what Ась understood (think)
  big: string // the answer figure
  cap: string // two words under it
  pill: string
  ai: string
  voiceId: string
  say: string
  top: V3
  bottom: V3
  glyph: string
  mixTitle: string
  mixSub: string
}

const TOPICS: Topic[] = [
  {
    key: 'rate', ask: 'Какая сейчас ставка?', heard: 'Ставка ЦБ', big: '14%', cap: 'ставка ЦБ', pill: 'Ставка ЦБ · до 18 декабря',
    ai: 'Следующее заседание — 18 декабря', voiceId: 'g-rate-short', say: 'До декабря — 14%, дальше ЦБ обещает снижать медленно.',
    top: [0.66, 0.03, 0.44], bottom: [0.18, 0.0, 0.14], glyph: '%', mixTitle: 'Ставка ЦБ', mixSub: 'что дальше',
  },
  {
    key: 'hl', ask: 'Что слышно про Half-Life 3?', heard: 'Half-Life 3', big: 'Half-Life 3', cap: 'пока не точно', pill: 'Это слух · Valve молчит',
    ai: 'Официального анонса нет — только слова инсайдеров', voiceId: 'g-hl-short', say: 'Valve молчит. Есть оговорка про «HLX» и слова инсайдеров.',
    top: [0.86, 0.28, 0.02], bottom: [0.26, 0.05, 0.0], glyph: 'λ', mixTitle: 'Half-Life 3', mixSub: 'что слышно',
  },
  {
    key: 'road', ask: 'Как там дорога?', heard: 'Дорога', big: '1 ч 12', cap: 'до Твери', pill: 'М-11 · пробок нет',
    ai: 'На платном участке свободно, камера через 4 км', voiceId: '', say: 'До Твери час двенадцать, на платном участке свободно.',
    top: [0.16, 0.18, 0.86], bottom: [0.03, 0.03, 0.2], glyph: '↗', mixTitle: 'Дорога', mixSub: 'сколько ехать',
  },
]

const ICON = {
  mic: '<svg viewBox="0 0 24 24"><path d="M12 3.5a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0v-5a3 3 0 0 0-3-3zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3"/></svg>',
  wave: '<svg viewBox="0 0 24 24"><path d="M4 10v4M8 6.5v11M12 4v16M16 8v8M20 10.5v3"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2.5" class="fill"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M9 6.5v11M15 6.5v11"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8.5 6.2v11.6L18 12z" class="fill"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M12 16v4.5M8.5 3.5h7l-1 5.5 3 3.5H6.5l3-3.5z"/></svg>',
  search: '<svg viewBox="0 0 24 24"><path d="M10.5 4.5a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM19.5 19.5l-4.7-4.7"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><path d="M4 8.5h16M4 15.5h11"/></svg>',
  chats: '<svg viewBox="0 0 24 24"><path d="M5 6.5h14v9H10l-4 3v-3H5z"/></svg>',
  car: '<svg viewBox="0 0 24 24"><path d="M4.5 15.5v-3.5l2-5h11l2 5v3.5zM4.5 15.5v2.5M19.5 15.5v2.5M4.5 12h15"/></svg>',
  me: '<svg viewBox="0 0 24 24"><path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20c1-3.5 3.8-5 7-5s6 1.5 7 5"/></svg>',
  spark: '<svg viewBox="0 0 24 24"><path d="M12 3c.6 4.6 3.4 7.4 8 8-4.6.6-7.4 3.4-8 8-.6-4.6-3.4-7.4-8-8 4.6-.6 7.4-3.4 8-8z" class="fill"/></svg>',
}

const OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'

export class GlowPage {
  readonly root = document.createElement('div')
  private scene = new GlowScene()
  private mode: Mode = 'idle'
  private topic: Topic = TOPICS[0]
  private timers: number[] = []
  private levelRaf = 0
  private ro: ResizeObserver
  private q = <T extends HTMLElement>(s: string) => this.root.querySelector(s) as T

  constructor() {
    this.root.className = 'gl-root'
    this.root.dataset.mode = 'idle'
    this.root.innerHTML = `
      <div class="gl-intro" aria-hidden="true"><span class="gl-mark">${ICON.wave}</span></div>
      <header class="gl-top">
        <button class="gl-icon" aria-label="Меню">${ICON.menu}</button>
        <span class="gl-brand"><i>${ICON.wave}</i>Ась</span>
        <button class="gl-icon" aria-label="Поиск">${ICON.search}</button>
      </header>
      <main class="gl-hero">
        <h1 class="gl-title"><span>Ась на связи</span></h1>
        <div class="gl-cover" aria-hidden="true"><b></b></div>
        <div class="gl-ctrl">
          <button class="gl-side gl-pause" aria-label="Пауза">${ICON.pause}</button>
          <button class="gl-go" aria-label="Спросить">${ICON.mic}</button>
          <div class="gl-pill"><span class="gl-pill-text">Ставка ЦБ — 14% · вчера</span></div>
          <button class="gl-side gl-pin" aria-label="Сохранить">${ICON.pin}</button>
        </div>
        <p class="gl-ai"><i>${ICON.spark}<sup>AI</sup></i><span>Спросите про ставку, дорогу или Half-Life 3</span></p>
      </main>
      <section class="gl-mixes" aria-label="Быстрые вопросы">
        ${TOPICS.map((t, i) => `<button class="gl-mix" data-i="${i}" style="--d:${i}"><span class="gl-mix-blob"></span><span class="gl-mix-ico">${t.glyph}</span><small>${t.mixSub}</small><b>${t.mixTitle}</b></button>`).join('')}
      </section>
      <nav class="gl-tabs">
        <button class="is-on" aria-label="Ась">${ICON.wave}</button>
        <button aria-label="Чаты">${ICON.chats}<em></em></button>
        <button aria-label="Поездки">${ICON.car}</button>
        <button aria-label="Профиль">${ICON.me}</button>
      </nav>`
    this.root.prepend(this.scene.canvas)
    voice.prepare(TOPICS.map((t) => t.voiceId).filter(Boolean))

    this.q('.gl-go').addEventListener('click', () => this.onGo())
    this.q('.gl-pause').addEventListener('click', () => this.onPause())
    this.q('.gl-pin').addEventListener('click', (e) => this.onPin(e.currentTarget as HTMLElement))
    this.root.querySelectorAll<HTMLElement>('.gl-mix').forEach((b) => b.addEventListener('click', () => this.ask(TOPICS[Number(b.dataset.i)])))
    this.root.querySelectorAll<HTMLElement>('.gl-tabs button').forEach((b) =>
      b.addEventListener('click', () => {
        this.root.querySelectorAll('.gl-tabs button').forEach((x) => x.classList.toggle('is-on', x === b))
      }),
    )
    // a press anywhere on the dark nudges the blob
    this.root.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('button')) return
      this.scene.bump()
    })
    this.ro = new ResizeObserver(() => this.layout())
    this.ro.observe(this.root)
    requestAnimationFrame(() => this.layout())
    // widths are only right once Onest has loaded
    document.fonts?.ready.then(() => this.layout())
    this.timers.push(window.setTimeout(() => this.root.classList.add('is-ready'), 950))
  }

  /** the blob sits behind the title, centred on it */
  private layout() {
    const r = this.root.getBoundingClientRect()
    const t = this.q('.gl-title').getBoundingClientRect()
    this.scene.center = { x: r.width / 2, y: t.top - r.top + t.height * 0.05 }
    this.scene.radius = Math.min(r.width * 0.44, 196)
    this.fitTitle()
  }

  /** the title fills the column: one line for words, figure as big as fits */
  private fitTitle() {
    const h = this.q('.gl-title')
    const span = h.lastElementChild as HTMLElement
    const max = this.mode === 'answer' ? 132 : 64
    const w = this.q(".gl-hero").clientWidth - 32 // the column, not the title box: a wide span stretches its grid
    // measure at the largest size once, then scale down in one step
    h.style.fontSize = `${max}px`
    const natural = span.getBoundingClientRect().width
    const size = Math.max(28, Math.min(max, Math.floor((max * w) / Math.max(1, natural))))
    h.style.fontSize = `${size}px`
  }

  private setTitle(text: string) {
    const h = this.q('.gl-title')
    const old = h.firstElementChild as HTMLElement
    const next = document.createElement('span')
    next.textContent = text
    h.append(next)
    this.fitTitle()
    const fade = old.animate([{ opacity: 1, filter: 'blur(0)', transform: 'none' }, { opacity: 0, filter: 'blur(6px)', transform: 'translateY(-10px) scale(0.98)' }], { duration: 180, easing: OUT, fill: 'forwards' })
    fade.onfinish = () => old.remove()
    next.animate([{ opacity: 0, filter: 'blur(6px)', transform: 'translateY(14px) scale(0.98)' }, { opacity: 1, filter: 'blur(0)', transform: 'none' }], { duration: 320, easing: OUT, delay: 60, fill: 'backwards' })
  }

  private setText(sel: string, text: string) {
    const el = this.q(sel)
    if (el.textContent === text) return
    el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-6px)' }], { duration: 120, easing: 'ease-in', fill: 'forwards' }).onfinish = () => {
      el.textContent = text
      el.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: OUT, fill: 'forwards' })
    }
  }

  private setMode(m: Mode) {
    this.mode = m
    this.root.dataset.mode = m
    const g = this.scene.target
    g.field = m === 'answer' ? 1 : 0
    g.spin = m === 'think' ? 1 : 0
    g.shrink = m === 'listen' ? 1 : 0
    if (m !== 'listen' && m !== 'answer') g.level = 0
    const go = this.q('.gl-go')
    go.innerHTML = m === 'listen' ? ICON.stop : m === 'think' ? '<span class="gl-spin"></span>' : ICON.mic
    go.setAttribute('aria-label', m === 'listen' ? 'Стоп' : 'Спросить')
  }

  private clear() {
    this.timers.forEach(clearTimeout)
    this.timers = []
    cancelAnimationFrame(this.levelRaf)
    voice.stop()
  }

  private onGo() {
    if (this.mode === 'listen') return this.think()
    if (this.mode === 'think') return
    this.ask(this.mode === 'answer' ? TOPICS[(TOPICS.indexOf(this.topic) + 1) % TOPICS.length] : this.topic)
  }

  /** listen → think → answer, with a simulated voice for the demo */
  private ask(t: Topic) {
    this.clear()
    this.topic = t
    this.scene.setColors([0.62, 0.04, 0.42], [0.16, 0.0, 0.12])
    this.setMode('listen')
    this.setTitle('Слушаю')
    this.setText('.gl-pill-text', `«${t.ask}»`)
    this.setText('.gl-ai span', 'Говорите — я перебью, только если спросите')
    // a breathing level stands in for the microphone
    const t0 = performance.now()
    const tick = () => {
      this.levelRaf = requestAnimationFrame(tick)
      const s = (performance.now() - t0) / 1000
      this.scene.target.level = Math.max(0, Math.sin(s * 9) * 0.5 + Math.sin(s * 3.3) * 0.4) * Math.min(1, s * 2)
    }
    tick()
    this.timers.push(window.setTimeout(() => this.think(), 2200))
  }

  private think() {
    this.clear()
    this.setMode('think')
    this.setTitle(this.topic.heard)
    this.setText('.gl-ai span', 'Смотрю свежие источники')
    this.timers.push(window.setTimeout(() => this.answer(), 1400))
  }

  private answer() {
    const t = this.topic
    this.clear()
    this.scene.setColors(t.top, t.bottom)
    this.setMode('answer')
    this.root.style.setProperty('--tone', `rgb(${t.top.map((c) => Math.round(c * 255)).join(' ')})`)
    this.setTitle(t.big)
    this.q('.gl-cover b').textContent = t.glyph
    this.setText('.gl-pill-text', t.pill)
    this.setText('.gl-ai span', t.ai)
    this.q('.gl-pause').innerHTML = ICON.pause
    if (t.voiceId)
      voice.speak(t.voiceId, t.say, { onLevel: (lv) => (this.scene.target.level = lv) }).then(() => {
        this.scene.target.level = 0
        this.q('.gl-pause').innerHTML = ICON.play
      })
    else this.q('.gl-pause').innerHTML = ICON.play
  }

  private onPause() {
    if (this.mode !== 'answer') return
    voice.stop()
    this.scene.target.level = 0
    this.q('.gl-pause').innerHTML = ICON.play
  }

  private onPin(b: HTMLElement) {
    b.classList.toggle('is-on')
    b.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.86)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 420, easing: OUT })
    if (b.classList.contains('is-on')) {
      navigator.vibrate?.(8)
      this.setText('.gl-ai span', 'Сохранил в чат поездки')
    }
  }

  destroy() {
    this.clear()
    this.ro.disconnect()
    this.scene.destroy()
  }
}
