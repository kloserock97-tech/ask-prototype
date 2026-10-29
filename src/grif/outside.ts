// Ась outside the app (#/outside).
//   home    — a home-screen widget: ask without opening the app; the answer folds into the island
//   android — over a navigator: a bubble at the edge, the answer takes the place of the ETA panel,
//             the light at the screen edge carries the state; route, manoeuvre, speed and signs stay open
//   iphone  — iOS draws nothing over other apps: voice + Dynamic Island only
// The map is drawn here (no navigator's branding); Yandex Maps / Google Maps look roughly like this.

import * as voice from '../voice'
import * as ears from '../app/ears'
import * as earcon from '../app/earcon'
import { Horizon } from './horizon'
import { CHAIN, LINE, understand, type Chunk, type Tag, type Topic } from './talk'

type Scene = 'home' | 'android' | 'iphone'
type St = 'idle' | 'listen' | 'think' | 'speak' | 'hold'

const P: Record<string, string> = {
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  pause: 'M8 5v14M16 5v14',
  play: 'M7 5l12 7-12 7z',
  car: 'M5 17v-5l2.2-5h9.6l2.2 5v5M3 12h18v5H3zM6.5 17v2.5M17.5 17v2.5M7 14.5h.01M17 14.5h.01',
  back: 'M15 6l-6 6 6 6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  locate: 'M12 2v3M12 19v3M2 12h3M19 12h3M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10z',
  sound: 'M4 10v4h4l5 4V6L8 10zM16 9a4 4 0 0 1 0 6',
  x: 'M6 6l12 12M18 6L6 18',
  right: 'M6 20v-7a4 4 0 0 1 4-4h9M15 5l4 4-4 4',
  up: 'M12 20V5M7 10l5-5 5 5',
  cam: 'M4 8h4l2-3h4l2 3h4v11H4zM12 10a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7z',
  bookmark: 'M6 4h12v17l-6-4-6 4z',
}
const ic = (n: string, cls = '') => `<svg class="o-i ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[n]}"/></svg>`
const CH = (n: string) => `./grif/${n}.webp`
const TAG_CLS: Record<Tag['kind'], string> = { fact: 'is-fact', forecast: 'is-forecast', rumor: 'is-rumor', info: 'is-info' }
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const DEMO = ['Как изменится ключевая ставка в ближайший месяц?', 'Почему?', 'Сохрани', 'Что там с Half-Life 3?', 'Сохрани']

// the map: own drawing, tilted with CSS perspective; the route runs up the M-11
const MAP = `<svg class="o-map" viewBox="0 0 900 1100" aria-hidden="true">
  <rect width="900" height="1100" fill="#E8EBEF"/>
  <g fill="#F5F6F8">${Array.from({ length: 48 }, (_, i) => `<rect x="${(i % 8) * 116 + 6}" y="${Math.floor(i / 8) * 190 + 8}" width="${92 + ((i * 37) % 14)}" height="${150 + ((i * 53) % 20)}" rx="6"/>`).join('')}</g>
  <path d="M0 260 C160 230 230 330 360 300 S560 160 720 200 900 150 900 150 V0 H0Z" fill="#D5EACB"/>
  <path d="M640 1100 C600 900 760 820 900 760 V1100Z" fill="#D5EACB"/>
  <path d="M0 640 C120 610 220 700 300 760 S420 900 380 1100 H0Z" fill="#CFE2F3"/>
  <g stroke="#D7DBE1" stroke-width="18" fill="none"><path d="M0 470 H900M0 860 H900M110 0 V1100M800 0 V1100"/></g>
  <g stroke="#FFFFFF" stroke-width="12" fill="none"><path d="M0 470 H900M0 860 H900M110 0 V1100M800 0 V1100"/></g>
  <path d="M470 1100 C470 900 460 760 480 640 S600 380 660 240 720 40 740 0" stroke="#E9C46A" stroke-width="46" fill="none"/>
  <path d="M470 1100 C470 900 460 760 480 640 S600 380 660 240 720 40 740 0" stroke="#FFFFFF" stroke-width="40" fill="none"/>
  <path d="M470 1100 C470 900 460 760 480 640 S600 380 660 240 720 40 740 0" stroke="#3E6BF2" stroke-width="26" fill="none" stroke-linecap="round"/>
  <path d="M480 640 S600 380 660 240" stroke="#2FB36B" stroke-width="26" fill="none"/>
  <g transform="translate(548 470)"><circle r="26" fill="#fff" stroke="#E5484D" stroke-width="6"/><path d="M-12 -4h7l3-5h6l3 5h7v14h-26z" fill="none" stroke="#1F2937" stroke-width="3"/></g>
  <text x="250" y="560" font-size="30" fill="#8A94A3" font-family="Manrope, sans-serif" font-weight="600" transform="rotate(-8 250 560)">Химки</text>
</svg>`

// p03 (board «AI assist»): a black squircle, amber light rising from the bottom along road lines
// that run to a vanishing point, a glossy triangle on the centre line
const ROAD = `<svg class="o-road-svg" viewBox="0 0 170 170" aria-hidden="true">
  <defs>
    <linearGradient id="rdC" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fffbe8"/><stop offset=".42" stop-color="#ffd16a"/><stop offset="1" stop-color="#ff9500" stop-opacity="0"/></linearGradient>
    <linearGradient id="rdS" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffe08a"/><stop offset=".5" stop-color="#ffaa2a" stop-opacity=".85"/><stop offset="1" stop-color="#ff8a00" stop-opacity="0"/></linearGradient>
    <linearGradient id="rdT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffdb8f"/><stop offset="1" stop-color="#ff9d17"/></linearGradient>
    <filter id="rdB" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation=".7"/></filter>
    <filter id="rdG" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="5"/></filter>
  </defs>
  <g filter="url(#rdB)">
    <path d="M75 170 L95 170 L87.4 112 L82.6 112Z" fill="url(#rdC)"/>
    <path d="M40 170 L52 170 L79.4 86 L77.8 86Z" fill="url(#rdS)"/>
    <path d="M118 170 L130 170 L92.2 86 L90.6 86Z" fill="url(#rdS)"/>
    <path d="M0 120 L0 132 L70.6 86 L68.8 86Z" fill="url(#rdS)" opacity=".9"/>
    <path d="M170 120 L170 132 L99.4 86 L101.2 86Z" fill="url(#rdS)" opacity=".9"/>
  </g>
  <g transform="translate(0 -12)">
    <ellipse cx="85" cy="112" rx="26" ry="22" fill="#000" opacity=".55" filter="url(#rdG)"/>
    <path d="M85 93 Q87.3 93 88.7 95.9 L100.3 122.4 Q102.1 127 97.9 127 L72.1 127 Q67.9 127 69.7 122.4 L81.3 95.9 Q82.7 93 85 93Z" fill="#ff9a10" opacity=".75" filter="url(#rdG)"/>
    <path d="M69.6 125 L100.4 125 Q99.8 129 97.4 129 L72.6 129 Q70.2 129 69.6 125Z" fill="#b65c00"/>
    <path d="M85 93 Q87.3 93 88.7 95.9 L100.3 122.4 Q102.1 127 97.9 127 L72.1 127 Q67.9 127 69.7 122.4 L81.3 95.9 Q82.7 93 85 93Z" fill="url(#rdT)"/>
    <path d="M75.6 109 L81.3 95.9 Q82.7 93 85 93 Q87.3 93 88.7 95.9 L94.4 109Z" fill="#fff" opacity=".18"/>
  </g>
</svg>`

export class OutsidePage {
  readonly root = document.createElement('main')
  private scene: Scene = 'android'
  private st: St = 'idle'
  private tok = 0
  private demo = 0
  private topic: Topic | null = null
  private idx = 0
  private micOK = false
  private asked = false
  private hz: Horizon | null = null
  private collapse = 0
  private eta = 167
  private etaTimer = 0
  private q = <T extends HTMLElement = HTMLElement>(s: string) => this.root.querySelector(s) as T

  constructor(scene?: string) {
    this.root.className = 'o-page'
    this.root.innerHTML = this.shell()
    this.root.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-o]')
      if (!el) return
      earcon.unlock()
      voice.setOn(true)
      this.act(el.dataset.o!, el)
    })
    this.fit()
    addEventListener('resize', this.fit)
    this.setScene(scene === 'home' || scene === 'iphone' ? scene : 'android')
    this.etaTimer = window.setInterval(() => {
      this.eta = Math.max(1, this.eta - 1)
      const e = this.q('.o-eta-t')
      if (e) e.textContent = `${Math.floor(this.eta / 60)} ч ${this.eta % 60} мин`
    }, 60000)
  }

  private shell() {
    return `
<header class="o-bar">
  <a class="o-backlink" href="#/">${ic('back')}Ась</a>
  <div class="o-seg" role="tablist">
    <button data-o="scene" data-s="home" role="tab">Главный экран</button>
    <button data-o="scene" data-s="android" role="tab">Навигатор · Android</button>
    <button data-o="scene" data-s="iphone" role="tab">Навигатор · iPhone</button>
  </div>
</header>
<div class="o-stage">
  <div class="o-phone">
    <div class="o-screen">
      <!-- home screen -->
      <div class="o-home">
        <div class="o-status"><b>9:41</b><span>М-11 · 2 ч 47 мин</span></div>
        <div class="o-wrow">
          <div class="o-road" role="group" aria-label="Виджет Ась «В дороге»">
            <a class="o-road-go" href="./?drive=1#/" aria-label="Включить «В дороге»"></a>
            ${ROAD}
            <svg class="o-road-ar" viewBox="0 0 28 28" aria-hidden="true"><defs><linearGradient id="rdA" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#8d8d92"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><path d="M5 22v-5a7 7 0 0 1 7-7h10M17 5l5 5-5 5" fill="none" stroke="url(#rdA)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <b class="o-road-big">14%</b>
            <small class="o-road-sub">ставка ЦБ</small>
            <span class="o-road-pills"><i>2</i><button data-o="ask" aria-label="Спросить Ась">${ic('mic')}</button></span>
          </div>
          <div class="o-apps4">${['карты', 'музыка', 'погода', 'камера'].map((n) => `<span><i></i>${n}</span>`).join('')}</div>
        </div>
        <div class="o-apps">${['заметки', 'часы', 'фото', 'почта'].map((n) => `<span><i></i>${n}</span>`).join('')}</div>
        <div class="o-dock"><i></i><i></i><i></i><i></i></div>
        <div class="o-sheet">
          <canvas class="o-hz" aria-hidden="true"></canvas>
          <div class="o-sh-in">
            <div class="o-label"></div>
            <div class="o-tag" hidden></div>
            <div class="o-big" hidden></div>
            <p class="o-phrase"></p>
          </div>
        </div>
      </div>

      <!-- navigator (own drawing) -->
      <div class="o-nav">
        <div class="o-tilt">${MAP}</div>
        <div class="o-fog"></div>
        <div class="o-status is-dark"><b>9:41</b></div>
        <div class="o-man">
          <span class="o-man-ar">${ic('right')}</span>
          <span class="o-man-t"><b class="o-man-d">1,2 км</b><small>съезд на М-11 «Нева»</small></span>
          <span class="o-lanes">${ic('up')}${ic('up')}${ic('right')}</span>
        </div>
        <div class="o-camwarn"><span class="o-lim is-s">90</span>${ic('cam')}Камера · 400 м</div>
        <div class="o-tools">${['plus', 'minus', 'locate', 'sound'].map((n) => `<span>${ic(n)}</span>`).join('')}</div>
        <div class="o-car"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="19" fill="#fff"/><path d="M20 7l9 24-9-5-9 5z" fill="#3E6BF2"/></svg></div>
        <div class="o-speed"><span class="o-lim">90</span><span class="o-cur"><b>87</b>км/ч</span></div>
        <div class="o-eta"><span><b class="o-eta-t">2 ч 47 мин</b><small>312 км · прибытие 14:32</small></span><i>${ic('x')}</i></div>

        <!-- Ась over the navigator -->
        <div class="o-edge" aria-hidden="true"></div>
        <button class="o-bubble" data-o="bubble" aria-label="Спросить Ась"><img src="${CH('neutral')}" alt=""><i class="o-badge"></i></button>
        <div class="o-card" aria-live="polite">
          <img class="o-card-ch" src="${CH('happy')}" alt="">
          <div class="o-card-mid">
            <div class="o-card-top"><span class="o-label"></span><span class="o-tag" hidden></span></div>
            <div class="o-card-row"><b class="o-big" hidden></b><p class="o-phrase"></p></div>
          </div>
          <button class="o-card-b" data-o="pause" aria-label="Пауза">${ic('pause')}</button>
        </div>
      </div>
      <button class="o-island" data-o="island" aria-label="Ась в Dynamic Island"><img src="${CH('happy')}" alt=""><span class="o-isl-t"></span><span class="o-isl-bars"><i></i><i></i><i></i><i></i></span>
        <span class="o-isl-x"><span class="o-label"></span><span class="o-phrase"></span></span></button>
    </div>
  </div>
  <aside class="o-notes">
    <div class="o-demo"></div>
    <div class="o-text"></div>
  </aside>
</div>`
  }

  private fit = () => {
    // the phone is drawn at 390×844 and scaled to fit the window
    const bar = 56
    const side = innerWidth >= 900 ? 420 : 0 // notes beside the phone on wide screens
    const s = Math.min(1, (innerHeight - bar - 16) / 844, (innerWidth - 16 - side) / 390)
    this.root.style.setProperty('--s', String(Math.max(0.5, s)))
  }

  private setScene(s: Scene) {
    this.stopAll()
    this.scene = s
    this.root.dataset.scene = s
    this.root.querySelectorAll<HTMLElement>('[data-o="scene"]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.s === s)))
    this.setState('idle')
    if (s === 'home') {
      this.hz ??= new Horizon(this.q<HTMLCanvasElement>('.o-hz'))
      this.hz.set('off')
    }
    const demo = this.q('.o-demo')
    demo.innerHTML =
      s === 'home'
        ? `<button data-o="ask">${ic('mic')}Спросить из виджета</button>`
        : `<button data-o="bubble">${ic('mic')}${s === 'iphone' ? '«Ась» / касание острова' : 'Спросить Ась'}</button>
           <button data-o="navspeak">${ic('sound')}Навигатор говорит</button>
           <button data-o="turn">${ic('right')}Скоро манёвр</button>`
    this.q('.o-text').innerHTML = {
      home: `<h2>Виджет на главном экране</h2>
        <p>Спросить, не открывая приложение: касание «Спросить» — Ась слушает и отвечает поверх главного экрана, потом ответ сворачивается в Dynamic Island. «В дорогу» открывает режим для машины.</p>
        <p>В виджете — последний ответ: цифра и до какой даты она верна.</p>`,
      android: `<h2>Поверх навигатора · Android</h2>
        <p>Карты остаются главными. Ась не трогает то, что нужно за рулём: <b>манёвр сверху, линию маршрута, знаки и камеры, скорость и ограничение слева внизу</b>.</p>
        <ul>
          <li><b>Пузырь у правого края</b> ниже кнопок карты. Касание или «ась» — спросить. Пузырь можно перетащить.</li>
          <li><b>Ответ занимает место панели времени прибытия</b> — она меняется медленнее всего — и сам сворачивается через 4 секунды. Знак ограничения скорости над ней остаётся видно.</li>
          <li><b>Свет по нижнему краю экрана</b> — состояние: слушает, ищет, говорит. Видно боковым зрением, не закрывает карту.</li>
          <li><b>Навигатор главнее.</b> Когда он говорит, Android забирает у Ась звук, и Ась замолкает до конца подсказки. Перед манёвром Ась ждёт: расстояние до поворота читается из уведомления навигатора.</li>
        </ul>
        <p class="o-small">Нужны разрешения «Поверх других приложений» и «Доступ к уведомлениям» — спрашиваем один раз на стоянке.</p>`,
      iphone: `<h2>Поверх навигатора · iPhone</h2>
        <p>iOS не даёт рисовать поверх чужих приложений. Поэтому на iPhone Ась — <b>голос и Dynamic Island</b>: в компактном острове персонаж и опорная цифра, карта не закрыта ничем.</p>
        <ul>
          <li>Спросить — «Привет, Сири, Ась» или кнопка действия; в прототипе — касание острова.</li>
          <li>Развёрнутый остров закрывает манёвр, поэтому сам не раскрывается — только по долгому нажатию.</li>
          <li>Подсказки навигатора приглушают Ась средствами iOS.</li>
        </ul>`,
    }[s]
  }

  private act(a: string, el: HTMLElement) {
    if (a === 'scene') return this.setScene(el.dataset.s as Scene)
    if (a === 'ask' || a === 'bubble') return this.st === 'speak' || this.st === 'think' ? this.pause() : this.listen()
    if (a === 'island') return this.st === 'idle' || this.st === 'hold' ? this.listen() : this.toggleIsland()
    if (a === 'pause') return this.st === 'hold' ? this.resume() : this.pause()
    if (a === 'navspeak') return this.yield('navspeak')
    if (a === 'turn') return this.yield('turn')
  }

  // ───────────────────────── state on screen

  private setState(s: St, c?: Chunk, o: { label?: string; phrase?: string; char?: string } = {}) {
    this.st = s
    this.root.dataset.st = s
    const label = o.label ?? { idle: '', listen: 'СЛУШАЮ', think: 'ИЩУ', speak: 'ГОВОРЮ', hold: 'ПАУЗА' }[s]
    this.root.querySelectorAll('.o-label').forEach((e) => (e.textContent = label))
    this.root.querySelectorAll<HTMLElement>('.o-tag').forEach((t) => {
      t.hidden = !c?.tag
      if (c?.tag) {
        t.textContent = c.tag.text
        t.className = `o-tag ${TAG_CLS[c.tag.kind]}`
      }
    })
    this.root.querySelectorAll<HTMLElement>('.o-big').forEach((b) => {
      b.hidden = !c?.big
      if (c?.big) b.textContent = c.big
    })
    const text = o.phrase ?? c?.text ?? ''
    this.root.querySelectorAll<HTMLElement>('.o-phrase').forEach((p) => {
      p.innerHTML = c ? text.split(/(\s+)/).map((w) => (w.trim() ? `<span>${w}</span>` : w)).join('') : text
      p.classList.toggle('is-k', !!c)
    })
    const ch = o.char ?? ({ idle: 'neutral', listen: 'attentive', think: 'curious', speak: 'happy', hold: 'sleepy' } as Record<St, string>)[s]
    this.root.querySelectorAll<HTMLImageElement>('.o-card-ch, .o-island img').forEach((i) => (i.src = CH(ch)))
    this.q<HTMLImageElement>('.o-bubble img').src = CH(ch)
    this.q('.o-isl-t').textContent = c?.big && c.big.length <= 5 ? c.big : ''
    this.q('.o-card-b').innerHTML = ic(s === 'hold' ? 'play' : 'pause')
    this.hz?.set(this.scene === 'home' ? ({ idle: 'off', listen: 'listen', think: 'think', speak: 'speak', hold: 'pause' } as const)[s] : 'off')
    clearTimeout(this.collapse)
    this.root.classList.remove('is-open-isl')
    if (s !== 'idle') this.root.classList.remove('is-folded')
  }

  private toggleIsland() {
    this.root.classList.toggle('is-open-isl')
  }

  // ───────────────────────── dialogue (the same lines as in the app)

  private async listen() {
    const tk = ++this.tok
    voice.stop()
    if (!this.asked && ears.canHear) {
      this.asked = true
      this.setState('listen', undefined, { phrase: 'Разрешите микрофон' })
      this.micOK = await ears.openMeter()
      ears.closeMeter()
      if (tk !== this.tok) return
    }
    this.setState('listen', undefined, { phrase: 'Слушаю…' })
    earcon.listen()
    if (this.micOK && ears.canHear) {
      let heard = ''
      ears.listen({
        onPartial: (t) => tk === this.tok && ((heard = t), this.heard(t)),
        onFinal: (t) => tk === this.tok && this.handle(t),
        onSilence: () => tk === this.tok && (heard ? this.handle(heard) : this.setState('idle')),
        onError: () => tk === this.tok && (heard ? this.handle(heard) : this.fake(tk)),
      })
      return
    }
    this.fake(tk)
  }

  private async fake(tk: number) {
    // the widget is a quick ask: always the rate; over the navigator the demo goes on
    const text = this.scene === 'home' ? DEMO[0] : DEMO[this.demo++ % DEMO.length]
    const w = text.split(' ')
    for (let i = 1; i <= w.length; i++) {
      await wait(130)
      if (tk !== this.tok) return
      this.heard(w.slice(0, i).join(' '))
    }
    await wait(300)
    if (tk === this.tok) this.handle(text)
  }

  private heard(t: string) {
    this.root.querySelectorAll<HTMLElement>('.o-phrase').forEach((p) => {
      p.classList.remove('is-k')
      p.textContent = `«${t}»`
    })
  }

  private handle(text: string) {
    const it = understand(text)
    if (it === 'rate' || it === 'hl3') {
      this.topic = it
      this.idx = 0
      return this.play(CHAIN[it][0], true)
    }
    if ((it === 'why' || it === 'yes' || it === 'more' || it === 'sources') && this.topic && this.idx < CHAIN[this.topic].length - 1) {
      this.idx++
      return this.play(CHAIN[this.topic][this.idx])
    }
    if (it === 'save') return this.play({ ...LINE.saved, tag: { text: '✓ СОХРАНЕНО · ЧАТ ПОЕЗДКИ', kind: 'fact' } }, false, 'СОХРАНЕНО')
    if (it === 'short' && this.topic) return this.play(this.topic === 'rate' ? LINE.rateShort : LINE.hlShort)
    if (it === 'stop' || it === 'quiet') return this.stopAll()
    this.play(LINE.unknown)
  }

  private last: Chunk | null = null
  private async play(c: Chunk, think = false, label?: string) {
    const tk = ++this.tok
    this.last = c
    if (think) {
      this.setState('think', undefined, { phrase: this.topic === 'hl3' ? 'Смотрю новости игровых сайтов' : 'Смотрю решение Банка России' })
      await wait(1100)
      if (tk !== this.tok) return
    }
    const chain = this.topic ? CHAIN[this.topic] : []
    const pos = chain.indexOf(c)
    this.setState('speak', c, { label: label ?? (pos >= 0 ? `ГОВОРЮ · ${pos + 1} ИЗ ${chain.length}` : 'ГОВОРЮ') })
    const spans = [...this.root.querySelectorAll('.o-phrase')].map((p) => [...p.querySelectorAll('span')])
    const k = (p: number) => spans.forEach((list) => list.forEach((s, i) => s.classList.toggle('on', i < Math.round(p * list.length))))
    if (voice.isOn()) await voice.speak(c.id, c.say, { onProgress: k, onLevel: (v) => this.hz?.level(v), onWord: () => this.hz?.pulse() })
    else {
      const t0 = performance.now()
      const ms = c.say.length * 58
      while (performance.now() - t0 < ms) {
        if (tk !== this.tok) return
        k((performance.now() - t0) / ms)
        await wait(120)
      }
    }
    if (tk !== this.tok) return
    k(1)
    this.root.dataset.st = 'done'
    this.st = 'idle'
    // the answer gives the panel back to the navigator a few seconds later
    this.collapse = window.setTimeout(() => {
      if (tk !== this.tok) return
      this.setState('idle')
      // on the home screen the answer folds into the island and stays there
      if (this.scene === 'home' && c.big) {
        this.root.classList.add('is-folded')
        this.q('.o-isl-t').textContent = c.big
      }
    }, this.scene === 'home' ? 2200 : 4000)
  }

  private pause() {
    this.tok++
    voice.stop()
    this.setState('hold', undefined, { phrase: 'Пауза. Касание — продолжить' })
  }

  private resume() {
    if (this.last) this.play(this.last)
    else this.setState('idle')
  }

  /** the navigator comes first: its voice prompt or a near manoeuvre puts Ась on hold */
  private async yield(why: 'navspeak' | 'turn') {
    const wasTalking = this.st === 'speak' || this.st === 'think'
    this.tok++
    voice.stop()
    const man = this.q('.o-man')
    man.classList.add('is-hot')
    this.q('.o-man-d').textContent = why === 'turn' ? '300 м' : '400 м'
    this.setState('hold', undefined, {
      label: why === 'turn' ? 'ЖДУ МАНЁВР' : 'НАВИГАТОР ГОВОРИТ',
      phrase: why === 'turn' ? 'Поворот через 300 м — продолжу после' : '«Через 400 метров съезд направо»',
    })
    await wait(why === 'turn' ? 3200 : 2600)
    man.classList.remove('is-hot')
    this.q('.o-man-d').textContent = why === 'turn' ? '8,4 км' : '1,2 км'
    if (wasTalking && this.last) this.play(this.last)
    else this.setState('idle')
  }

  private stopAll() {
    this.tok++
    voice.stop()
    ears.stopListening()
    clearTimeout(this.collapse)
  }

  destroy() {
    this.stopAll()
    clearInterval(this.etaTimer)
    removeEventListener('resize', this.fit)
    this.hz?.destroy()
  }
}
