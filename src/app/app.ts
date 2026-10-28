// «ась?» — one working scenario: the driver asks about the key rate.
//
// research/15. The look people liked — a sphere of dots over a black screen, a violet
// light and a glowing rim at the bottom — rebuilt around the components of the
// references and the newest patterns:
//   · ась is the sphere; while it thinks its outline flows through soft shapes
//     (Material 3 Expressive's loading indicator); the answer's figure gathers from
//     its dots and turns solid;
//   · the bottom panel is liquid glass (refraction, colour split at the edges, a
//     lavender rim), drawn in the same shader as everything else;
//   · at the top an island (the iOS 27 Siri pill, video 5): the status, then the
//     previous answer and «сохранено» fly into it;
//   · inside the glass the flow changes: topics as rows with round icons (video 3),
//     your words, the steps of the work (video 4), captions, two action cards
//     (video 4), saving «Сохраняю → Готово» (video 2);
//   · under it a round button and a pill with a white circle («Expiratory Volume»).
// Like Alice, an answer that ends with a question keeps listening for a few seconds.

import { EASE_OUT, reduced, spring } from '../motion'
import * as voice from '../voice'
import * as earcon from './earcon'
import * as ears from './ears'
import { understand, type Intent } from './intents'
import { Scene } from './scene'
import { AUDIO_IDS, DATA_AS_OF, DEMO_QUESTIONS, REPLY, ROAD, type Reply, type Road } from './script'
import { canWake, startWake, stopWake } from './wake'

type State = 'idle' | 'listening' | 'thinking' | 'speaking' | 'paused'
type Input = 'voice' | 'tap' | 'demo'
type Mode = 'topics' | 'heard' | 'steps' | 'caps' | 'acts' | 'save'
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
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  wallet: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M16 13.5h2M6 7l9-3.5L16.5 7"/>',
  bookmark: '<path d="M6 4.5h12v16l-6-4-6 4z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
}
export const icon = (k: string, size = 24) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`

// the topics on the start screen (video 3's action rows)
const TOPICS = [
  { say: 'какая ставка ЦБ на месяц?', t: 'Ключевая ставка', s: 'сколько сейчас и до какого числа', i: 'percent', c: 'c1' },
  { say: 'а что в декабре?', t: 'Что будет в декабре', s: 'прогнозы банков', i: 'cal', c: 'c2' },
  { say: 'а вклад открывать?', t: 'Вклады', s: 'что ась скажет и чего не скажет', i: 'wallet', c: 'c3' },
]
// follow-ups under an answer (video 4's small cards; Alice's «suggests»)
const ACT: Record<string, { t: string; s: string; i: string }> = {
  more: { t: 'Подробнее', s: 'что ждут в декабре', i: 'arrow' },
  save: { t: 'Сохранить', s: 'покажу на стоянке', i: 'bookmark' },
  repeat: { t: 'Повторить', s: 'ещё раз голосом', i: 'arrow' },
  listen: { t: 'Ещё вопрос', s: 'коснитесь и говорите', i: 'mic' },
  rate: { t: 'Про ставку', s: 'ключевая ставка ЦБ', i: 'percent' },
  advice: { t: 'Про вклады', s: 'без советов', i: 'wallet' },
}

const isNumber = (s: string) => /^[\d\s.,%−-]+$/.test(s)

export class AskApp {
  readonly root = document.createElement('div')
  private scene: Scene
  private state: State = 'idle'
  private input: Input = ears.canHear ? 'voice' : 'tap'
  private wakeOn = false
  private theme: Theme = 'night'
  private manualTheme = false
  private composing = false
  private last: Reply | null = null
  private lastShown: Shown | null = null
  private folded: Shown | null = null
  private lastIntent: Intent | null = null
  private road: Road | null = null
  private token = 0
  private raf = 0
  private wake: any = null
  private demoStep = 0
  private progress = 0
  private progressTarget = 0
  private fakeLv = 0
  private caps: { words: string[]; starts: number[]; total: number } | null = null
  private capShown = -1
  private hold = { x: 0, y: 0, t: 0, down: false, id: -1 }
  private changedAt = 0

  constructor() {
    this.root.className = 'app'
    this.root.innerHTML = `
      <canvas class="g-canvas" aria-hidden="true"></canvas>
      <header class="g-top">
        <span></span>
        <button class="g-island press" aria-live="polite"><span class="g-isl-bg"></span><span class="g-isl-in"><i class="g-dot"></i><span class="g-isl-t">ась</span></span></button>
        <button class="g-menu press" aria-label="настройки и ситуации в дороге">${icon('menu', 22)}</button>
      </header>
      <section class="g-stage">
        <div class="g-sphere"></div>
        <div class="g-figure"><p class="g-head"></p></div>
        <p class="g-title"></p>
        <p class="g-sub"></p>
      </section>
      <section class="g-panel" data-mode="topics">
        <div class="g-body">
          <div class="g-topics">${TOPICS.map((x) => `<button class="g-topic press" data-say="${x.say}"><span class="ic ${x.c}">${icon(x.i, 20)}</span><b>${x.t}</b><span class="s">${x.s}</span>${icon('arrow', 18)}</button>`).join('')}</div>
          <p class="g-heard"></p>
          <ol class="g-steps"></ol>
          <p class="g-caps"></p>
          <div class="g-acts"></div>
          <div class="g-save"><svg class="g-dash" aria-hidden="true"><rect x="1" y="1" rx="18" ry="18"/></svg><b class="g-save-t">Сохраняю в поездку</b><span class="g-save-s">покажу, когда остановитесь</span><span class="g-cards"><i></i><i></i><i></i></span></div>
        </div>
        <div class="g-dock">
          <button class="g-round press" aria-label="написать вопрос">${icon('keys', 24)}</button>
          <button class="g-pill press"><span class="g-pill-t"></span><i class="g-pill-i"></i></button>
          <form class="g-compose" hidden>
            <input class="g-input" type="text" enterkeyhint="send" autocomplete="off" placeholder="Спросите ась" aria-label="вопрос" />
            <button class="g-send press" type="submit" aria-label="отправить">${icon('up', 22)}</button>
          </form>
        </div>
      </section>
      <span class="a-touch" aria-hidden="true"><i></i></span>
      <div class="a-sheet" hidden></div>`
    this.scene = new Scene($(this.root, '.g-canvas'), { sphere: $(this.root, '.g-sphere'), figure: $(this.root, '.g-figure'), panel: $(this.root, '.g-panel') })
    voice.prepare(AUDIO_IDS)
    this.bind()
    this.applyTheme()
    this.welcome()
    this.set('idle')
    this.loop()
    this.keepAwake()
    this.watchLight()
    this.fitKeyboard()
    this.deepLink()
  }

  /** the start: «Ась?», one line, the topics in the glass — coming in one after another */
  private welcome() {
    this.show({ title: '', head: 'Ась?', sub: 'Спросите про ставку ЦБ или выберите тему' }, false)
    this.mode('topics')
    if (reduced()) return
    const parts = [$(this.root, '.g-head'), $(this.root, '.g-sub'), ...this.root.querySelectorAll('.g-topic')]
    parts.forEach((el, i) => el.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 460, delay: 200 + i * 110, easing: EASE_OUT, fill: 'backwards' }))
  }

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
  private buzz(pattern: number | number[], at?: { x: number; y: number }, strength = 1) {
    if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(pattern)
    const p = at ?? this.scene.centre
    this.scene.wave(p.x, p.y, strength)
  }
  private at(el: Element) {
    const r = el.getBoundingClientRect(), h = this.root.getBoundingClientRect()
    return { x: r.left - h.left + r.width / 2, y: r.top - h.top + r.height / 2 }
  }

  // ---------------------------------------------------------------- state
  private set(s: State) {
    if (s !== this.state) this.changedAt = performance.now()
    this.state = s
    this.root.dataset.state = s
    this.scene.setState(s)
    const busy = s === 'listening' || s === 'thinking' || s === 'speaking'
    let pt = this.last ? 'Ещё вопрос' : 'Спросить', pi = 'mic'
    if (busy) ((pt = s === 'listening' ? 'Готово' : 'Стоп'), (pi = s === 'listening' ? 'arrow' : 'x'))
    else if (s === 'paused') ((pt = 'Продолжить'), (pi = 'play'))
    const pill = $(this.root, '.g-pill')
    if ($(this.root, '.g-pill-t').textContent !== pt) {
      $(this.root, '.g-pill-t').textContent = pt
      $(this.root, '.g-pill-i').innerHTML = icon(pi, 22)
      pill.setAttribute('aria-label', pt)
      if (!reduced()) $(this.root, '.g-pill-t').animate([{ opacity: 0, filter: 'blur(3px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 200, easing: EASE_OUT })
    }
    const waits = this.wakeOn && this.input === 'voice'
    const isl: Record<State, string> = { idle: waits ? 'жду «ась»' : 'ась', listening: 'слушаю', thinking: 'думаю', speaking: 'отвечаю', paused: this.road ? ROAD[this.road].title : 'пауза' }
    if (!this.root.querySelector('.g-island[data-live]')) this.island(isl[s])
  }

  /** the island at the top: text swaps, the pill springs to its new width */
  private island(html: string, live = false) {
    const el = $(this.root, '.g-island')
    const t = $(this.root, '.g-isl-t')
    el.toggleAttribute('data-live', live)
    if (t.innerHTML === html) return
    const before = el.getBoundingClientRect().width
    t.innerHTML = html
    const after = el.getBoundingClientRect().width
    if (reduced() || !before || !after) return
    const s = spring(380, 26)
    $(this.root, '.g-isl-bg').animate([{ transform: `scaleX(${before / after})` }, { transform: 'none' }], { duration: s.duration, easing: s.easing })
    $(this.root, '.g-isl-in').animate([{ opacity: 0, filter: 'blur(3px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 240, easing: EASE_OUT })
  }

  /** an answer flies up into the island and stays there (video 5, the iOS 27 pill) */
  private flyToIsland(text: string, html: string) {
    const isl = $(this.root, '.g-island')
    const from = $(this.root, '.g-figure').getBoundingClientRect()
    const h = this.root.getBoundingClientRect()
    if (!reduced() && from.width) {
      const ghost = document.createElement('div')
      ghost.className = 'g-ghost'
      ghost.textContent = text
      Object.assign(ghost.style, { left: `${from.left - h.left}px`, top: `${from.top - h.top}px` })
      this.root.append(ghost)
      const to = isl.getBoundingClientRect()
      const g = ghost.getBoundingClientRect()
      ghost.animate(
        [
          { transform: 'none', opacity: 1 },
          { transform: `translate(${to.left + to.width / 2 - (g.left + g.width / 2)}px, ${to.top + to.height / 2 - (g.top + g.height / 2)}px) scale(${Math.min(1, to.height / g.height)})`, opacity: 0 },
        ],
        { duration: 520, easing: 'cubic-bezier(0.32, 0.72, 0, 1)', fill: 'forwards' },
      ).onfinish = () => ghost.remove()
    }
    setTimeout(() => this.island(html, true), reduced() ? 0 : 380)
  }

  // ---------------------------------------------------------------- the panel's content
  private mode(m: Mode) {
    const p = $(this.root, '.g-panel')
    if (p.dataset.mode === m) return
    p.dataset.mode = m
    const shown = $(this.root, `.g-${m === 'topics' ? 'topics' : m}`)
    if (!reduced() && shown) shown.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: EASE_OUT })
  }

  private heard(t: string, live = false) {
    this.mode('heard')
    const w = t.split(/\s+/).filter(Boolean)
    const cut = live ? Math.max(0, w.length - 3) : 0
    $(this.root, '.g-heard').innerHTML = `<span class="old">${w.slice(0, cut).join(' ')}</span> ${w.slice(cut).join(' ')}`
  }

  private steps(list: string[], done: number) {
    this.mode('steps')
    const ol = $(this.root, '.g-steps')
    if (ol.children.length !== list.length || ol.dataset.k !== list.join('|')) {
      ol.dataset.k = list.join('|')
      ol.innerHTML = list.map((s) => `<li><i>${icon('check', 14)}</i><span>${s}</span></li>`).join('')
    }
    ;[...ol.children].forEach((li, i) => {
      const c = i < done ? 'done' : i === done ? 'now' : ''
      if (li.className !== c) {
        li.className = c
        if (c && !reduced()) li.animate([{ opacity: 0.4, transform: 'translateX(-4px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: EASE_OUT })
      }
    })
  }

  private acts(chips: { intent: string }[]) {
    const box = $(this.root, '.g-acts')
    box.innerHTML = chips
      .slice(0, 2)
      .map((c, k) => {
        const a = ACT[c.intent] ?? { t: c.intent, s: '', i: 'arrow' }
        return `<button class="g-act press${k === 0 ? ' first' : ''}" data-act="${c.intent}"><span class="ic">${icon(a.i, 20)}</span><b>${a.t}</b><span class="s">${a.s}</span></button>`
      })
      .join('')
  }

  // ---------------------------------------------------------------- the stage: the answer
  private show(a: Shown, event: boolean) {
    const head = $(this.root, '.g-head')
    const num = isNumber(a.head)
    head.classList.toggle('num', num)
    $(this.root, '.g-title').textContent = a.title
    if (head.textContent !== a.head || event) {
      head.textContent = a.head
      this.fitHead()
      if (event && !reduced()) {
        // the figure gathers from the sphere's dots, then turns solid (video 2: preparing → all set)
        if (num) this.scene.setText(a.head)
        head.animate([{ opacity: 0, filter: 'blur(10px)', transform: 'translateY(10px)' }, { opacity: 1, filter: 'blur(0)', transform: 'none' }], { duration: 420, delay: num ? 520 : 60, easing: EASE_OUT, fill: 'backwards' })
        $(this.root, '.g-title').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 140, easing: EASE_OUT, fill: 'backwards' })
      }
    }
    $(this.root, '.g-sub').textContent = a.sub
    if (a.title) this.lastShown = a
  }

  /** a long figure shrinks to fit the column instead of running off the edge */
  private fitHead() {
    const head = $(this.root, '.g-head')
    head.style.fontSize = ''
    if (!head.classList.contains('num')) return
    const stage = $(this.root, '.g-stage')
    const cs = getComputedStyle(stage)
    const room = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
    const rg = document.createRange()
    rg.selectNodeContents(head)
    const w = rg.getBoundingClientRect().width
    if (w > room) head.style.fontSize = `${(parseFloat(getComputedStyle(head).fontSize) * room) / w}px`
  }

  private clearStage(title = '') {
    $(this.root, '.g-head').textContent = ''
    $(this.root, '.g-title').textContent = title
    $(this.root, '.g-sub').textContent = ''
  }

  /** ась's subtitles in the glass: words light up as the voice reaches them */
  private speakCaptions(text: string) {
    this.mode('caps')
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
    const from = Math.floor(i / 10) * 10
    const el = $(this.root, '.g-caps')
    if (from !== this.capShown) {
      this.capShown = from
      el.innerHTML = words.slice(from, from + 10).map((w) => `<span>${w}</span>`).join(' ')
    }
    el.querySelectorAll('span').forEach((s, k) => s.classList.toggle('on', from + k <= i))
  }

  // ---------------------------------------------------------------- the conversation
  private async ask() {
    if (this.input === 'voice') return this.listen()
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
      this.heard(q.slice(0, i), true)
      this.fakeLv = 0.35 + 0.4 * Math.abs(Math.sin(i * 0.9))
      await wait(36)
    }
    this.heard(q)
    await wait(260)
    if (tk === this.token) this.handle(q)
  }

  private async listen(follow = false) {
    const tk = ++this.token
    voice.stop()
    stopWake()
    this.set('listening')
    if (!follow) this.buzz(8, undefined, 0.6)
    if (voice.isOn()) earcon.listen()
    this.heard(follow ? 'жду ответа' : 'говорите, я слушаю')
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
      onPartial: (t) => tk === this.token && ((heard = true), this.heard(t, true)),
      onFinal: (t) => {
        if (tk !== this.token) return
        heard = true
        this.heard(t)
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
    if (intent === 'save') return this.save()
    const key = intent === 'unknown' ? 'clarify' : intent === 'more' && !this.lastIntent ? 'rate' : intent
    this.lastIntent = key === 'clarify' ? this.lastIntent : (key as Intent)
    this.reply(REPLY[key], key === 'rate' || key === 'more')
  }

  private async reply(r: Reply, think = true) {
    const tk = ++this.token
    ears.stopListening()
    stopWake()
    // a new answer over an old one: the old flies up into the island (video 5)
    if (this.lastShown && this.lastShown.title !== r.title && isNumber(this.lastShown.head)) {
      this.folded = this.lastShown
      this.flyToIsland(this.lastShown.head, `<b>${this.lastShown.head}</b> ${this.lastShown.title.toLowerCase()}`)
    }
    this.clearStage(r.title)
    if (think && r.thinking) {
      this.set('thinking')
      for (let i = 0; i < r.thinking.length; i++) {
        this.steps(r.thinking, i)
        await wait(640)
        if (tk !== this.token) return
      }
      this.steps(r.thinking, r.thinking.length)
      await wait(200)
      if (tk !== this.token) return
    }
    this.last = r
    this.set('speaking')
    this.show(r, true)
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
        onLevel: (lv) => this.scene.level(lv * 0.8),
        onWord: () => this.scene.pulse(),
        onProgress: (p) => ((timed = true), (this.progressTarget = p)),
      })
      clearInterval(tick)
    } else {
      while (performance.now() - t0 < est && tk === this.token) {
        this.progressTarget = Math.min(1, (performance.now() - t0) / est)
        this.scene.pulse()
        await wait(260)
      }
    }
    if (tk !== this.token) return
    this.toIdle()
    if (this.input === 'voice' && voice.isOn() && /\?\s*$/.test(r.say)) setTimeout(() => this.state === 'idle' && this.listen(true), 350)
    if (this.input === 'demo' && this.demoStep < DEMO_QUESTIONS.length) setTimeout(() => this.state === 'idle' && this.ask(), 1600)
  }

  /** «сохрани» (video 2): a dashed card draws itself «Сохраняю…», becomes «Готово», flies into the island */
  private async save() {
    const tk = ++this.token
    ears.stopListening()
    stopWake()
    this.set('speaking')
    this.mode('save')
    const box = $(this.root, '.g-save')
    box.removeAttribute('data-done')
    $(this.root, '.g-save-t').textContent = 'Сохраняю в поездку'
    if (!reduced()) $(this.root, '.g-dash rect').animate([{ strokeDashoffset: 300 }, { strokeDashoffset: 0 }], { duration: 700, easing: EASE_OUT, fill: 'both' })
    const t0 = performance.now()
    const speaking = voice.isOn() ? voice.speak(REPLY.save.audio, REPLY.save.say, { onLevel: (lv) => this.scene.level(lv * 0.8), onWord: () => this.scene.pulse() }) : wait(1600)
    await wait(900)
    if (tk !== this.token) return
    box.setAttribute('data-done', '')
    $(this.root, '.g-save-t').textContent = 'Готово'
    this.buzz([8, 30, 8])
    if (voice.isOn()) earcon.ready()
    await speaking
    await wait(Math.max(0, 1800 - (performance.now() - t0)))
    if (tk !== this.token) return
    const head = this.lastShown?.head ?? ''
    this.flyToIsland(head, `${icon('bookmark', 14)} сохранено${head ? ` · <b>${head}</b>` : ''}`)
    this.last = { ...REPLY.save, chips: [{ label: 'ещё вопрос', intent: 'listen' }, ...(this.lastShown ? [{ label: 'повторить', intent: 'repeat' }] : [])] } as Reply
    this.toIdle()
  }

  private toIdle() {
    this.token++
    ears.stopListening()
    voice.stop()
    this.road = null
    this.set('idle')
    if (this.last) {
      this.acts(this.last.chips ?? [])
      this.mode('acts')
      if (this.lastShown) this.show(this.lastShown, false)
    } else this.welcome()
    this.armWake()
  }

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
            this.heard(rest)
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
    this.set('paused')
    const r = ROAD[k]
    this.show(r, true)
    this.heard(r.sub)
    this.buzz(20, { x: this.root.clientWidth / 2, y: 0 }, 0.9)
    if (r.say && voice.isOn()) voice.speak(k, r.say, { onWord: () => this.scene.pulse() })
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
    const form = $<HTMLFormElement>(this.root, '.g-compose')
    form.hidden = !open
    this.root.toggleAttribute('data-compose', open)
    if (open) {
      if (this.state !== 'idle') this.toIdle()
      const inp = $<HTMLInputElement>(this.root, '.g-input')
      inp.value = ''
      inp.focus()
      if (!reduced()) form.animate([{ opacity: 0, transform: 'scaleX(0.7)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: EASE_OUT })
    } else $<HTMLInputElement>(this.root, '.g-input').blur()
    this.set(this.state)
  }

  private submit() {
    const inp = $<HTMLInputElement>(this.root, '.g-input')
    const q = inp.value.trim()
    if (!q) return
    if (!voice.isOn()) voice.setOn(true)
    earcon.unlock()
    this.compose(false)
    this.buzz(8, undefined, 0.6)
    this.heard(q)
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
    app.addEventListener('pointerdown', (e) => {
      if (isControl(e.target)) return
      if (this.hold.down) return void (this.hold.down = false)
      this.hold = { x: e.clientX, y: e.clientY, t: performance.now(), down: true, id: e.pointerId }
      const p = local(e)
      this.touchMark(p.x, p.y, true)
      this.scene.wave(p.x, p.y, 0.8)
    })
    app.addEventListener('pointercancel', () => ((this.hold.down = false), this.touchMark(0, 0, false)))
    app.addEventListener('pointerup', (e) => {
      if (!this.hold.down || e.pointerId !== this.hold.id) return
      this.hold.down = false
      this.touchMark(0, 0, false)
      const dy = e.clientY - this.hold.y
      const dx = e.clientX - this.hold.x
      const dt = performance.now() - this.hold.t
      if (dy > 70 && Math.abs(dx) < dy) return this.toIdle()
      if (dt < 60 || dt > 700 || Math.hypot(dx, dy) > 12) return
      if (performance.now() - this.changedAt < 300) return
      const near = this.nearControl(e.clientX, e.clientY)
      if (near) return near.click()
      if (this.composing) return this.compose(false)
      if (!voice.isOn()) voice.setOn(true)
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
    $(this.root, '.g-compose').addEventListener('submit', (e) => {
      e.preventDefault()
      this.submit()
    })
    app.addEventListener('click', (e) => {
      const t = e.target as HTMLElement
      if (t.closest('.g-menu')) return this.sheet(true)
      const s = t.closest<HTMLElement>('[data-sheet]')
      if (s) return this.act(s.dataset.sheet!, s.dataset.v)
      if (!voice.isOn()) voice.setOn(true)
      earcon.unlock()
      if (t.closest('.g-round')) return this.compose(!this.composing)
      const pill = t.closest('.g-pill')
      if (pill) return (this.buzz(6, this.at(pill), 0.8), this.onPill())
      const topic = t.closest<HTMLElement>('.g-topic')
      if (topic) return (this.buzz(6, this.at(topic), 0.8), this.fakeSpeech(topic.dataset.say!))
      const act = t.closest<HTMLElement>('.g-act')
      if (act) return (this.buzz(6, this.at(act), 0.8), this.control(act.dataset.act!))
      if (t.closest('.g-island[data-live]') && this.folded) return this.unfold()
    })
  }

  private nearControl(x: number, y: number): HTMLElement | null {
    const cands = [...this.root.querySelectorAll<HTMLElement>('.g-act, .g-pill, .g-round, .g-topic')].filter((el) => el.offsetParent)
    let best: HTMLElement | null = null, bd = Infinity
    for (const el of cands) {
      const r = el.getBoundingClientRect()
      const dx = Math.max(r.left - x, 0, x - r.right), dy = Math.max(r.top - y, 0, y - r.bottom)
      const d = Math.hypot(dx, dy)
      if (d <= 16 && d < bd) ((bd = d), (best = el))
    }
    return best
  }

  /** the white dot with a halo under the finger (reference: «Activate Your Potential») */
  private touchMark(x: number, y: number, on: boolean) {
    const m = $(this.root, '.a-touch')
    m.getAnimations().forEach((a) => a.cancel())
    if (on) {
      m.style.left = `${x}px`
      m.style.top = `${y}px`
      if (!reduced()) m.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(0.6)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }], { duration: 220, easing: EASE_OUT, fill: 'forwards' })
      else m.style.opacity = '1'
    } else m.animate([{ opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.25)' }], { duration: 220, easing: EASE_OUT, fill: 'forwards' })
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

  private onPill() {
    if (this.state === 'idle') return void this.ask()
    if (this.state === 'paused') return this.onTap()
    if (this.state === 'listening' && this.input === 'voice') return ears.stopListening()
    if (voice.isOn()) earcon.stop()
    this.toIdle()
  }

  /** the island holds the previous answer: a tap brings it back */
  private unfold() {
    const back = Object.values(REPLY).find((r) => r.head === this.folded?.head)
    if (!back) return
    const cur = this.lastShown
    this.folded = cur && isNumber(cur.head) && cur.head !== back.head ? cur : null
    this.island(this.folded ? `<b>${this.folded.head}</b> ${this.folded.title.toLowerCase()}` : 'ась', !!this.folded)
    this.last = back
    this.show(back, true)
    this.acts(back.chips ?? [])
    this.mode('acts')
    this.set('idle')
  }

  private control(a: string) {
    if (a === 'listen') return void this.ask()
    if (a === 'repeat') return this.last ? void this.reply(this.lastShown ? (Object.values(REPLY).find((r) => r.head === this.lastShown!.head) ?? this.last) : this.last, false) : undefined
    if (a === 'save') return void this.save()
    this.handle(({ rate: 'ставка цб', more: 'подробнее', advice: 'вклад' } as any)[a] ?? a)
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
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', this.theme === 'night' ? '#000000' : '#f3f3f8')
    this.scene.setTheme(this.theme)
  }

  private toast(t: string) {
    const el = document.createElement('div')
    el.className = 'a-toast'
    el.textContent = t
    this.root.append(el)
    el.animate([{ opacity: 0, transform: 'translate(-50%, 6px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }], { duration: 200, easing: EASE_OUT, fill: 'both' })
    setTimeout(() => (el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' }).onfinish = () => el.remove()), 2600)
  }

  // ---------------------------------------------------------------- frame loop
  private loop = () => {
    if (this.state === 'listening') this.scene.level(this.input === 'voice' ? ears.level() : this.fakeLv)
    if (this.state !== 'speaking') this.progressTarget = 0
    this.progress += (this.progressTarget - this.progress) * 0.18
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
    this.scene.destroy()
    this.wake?.release?.()
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
