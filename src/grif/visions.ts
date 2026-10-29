// #/visions — visual directions for «Ась», all from the «AI assist» board.
// Every direction shows the same moments — chat, «слушаю», answer «14%» — plus a live screen
// that plays the whole scenario: tap → the words type in → «ищу» → the answer counts up and is read out.

const ic = (d: string, cls = '') => `<svg class="v-i ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`
const I = {
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  wave: 'M6 10v4M10 7v10M14 4v16M18 9v6',
  menu: 'M4 8h16M4 16h11',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5 9-10',
  pause: 'M8 5v14M16 5v14',
  car: 'M5 17v-5l2.2-5h9.6l2.2 5v5M3 12h18v5H3zM6.5 17v2.5M17.5 17v2.5',
  chart: 'M4 19h16M7 16V10M12 16V5M17 16v-4',
  plus: 'M12 5v14M5 12h14',
  pen: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  bookmark: 'M6 4h12v17l-6-4-6 4z',
  turn: 'M5 21v-6a7 7 0 0 1 7-7h7M15 4l4 4-4 4',
  doc: 'M6 3h8l4 4v14H6zM14 3v4h4',
  kb: 'M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M8 14h8',
}
const STATUS = `<div class="v-status"><b>9:41</b><span><i></i><i></i><i></i><i></i></span></div>`
const Q = 'Как изменится ключевая ставка в ближайший месяц?'
const A = 'До 18 декабря заседаний нет — в ближайший месяц ставка, скорее всего, не изменится.'
const words = (s: string) => s.split(' ').map((w) => `<span>${w}</span>`).join(' ')

let seed = 7
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647

// p15 · raindrops on the windscreen
function rain(n: number) {
  seed = 11
  let out = ''
  for (let i = 0; i < n; i++) {
    const x = rnd() * 390
    const y = rnd() * 844
    const r = 1.2 + rnd() * rnd() * 5
    out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="rgba(255,255,255,.07)" stroke="rgba(0,0,0,.18)" stroke-width=".6"/><circle cx="${(x - r * 0.3).toFixed(1)}" cy="${(y - r * 0.35).toFixed(1)}" r="${(r * 0.32).toFixed(1)}" fill="rgba(255,255,255,.55)"/>`
  }
  return `<svg class="v2-rain" viewBox="0 0 390 844" aria-hidden="true">${out}</svg>`
}

// p03 · the road: lines run to a vanishing point, a glossy triangle on the centre line
const ROAD = `<svg class="v3-road" viewBox="0 0 390 420" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs>
    <linearGradient id="vrC" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fffbe8"/><stop offset=".45" stop-color="#ffcf66"/><stop offset="1" stop-color="#ff9500" stop-opacity="0"/></linearGradient>
    <linearGradient id="vrS" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffe08a"/><stop offset=".55" stop-color="#ffa62a" stop-opacity=".8"/><stop offset="1" stop-color="#ff8a00" stop-opacity="0"/></linearGradient>
    <linearGradient id="vrT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffdd94"/><stop offset="1" stop-color="#ff9d17"/></linearGradient>
    <filter id="vrB" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.6"/></filter>
    <filter id="vrG" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="9"/></filter>
  </defs>
  <g class="v3-lines" filter="url(#vrB)">
    <path d="M176 420 L214 420 L199 120 L191 120Z" fill="url(#vrC)"/>
    <path d="M96 420 L120 420 L189 130 L186 130Z" fill="url(#vrS)"/>
    <path d="M270 420 L294 420 L204 130 L201 130Z" fill="url(#vrS)"/>
    <path d="M0 330 L0 358 L180 132 L176 132Z" fill="url(#vrS)" opacity=".85"/>
    <path d="M390 330 L390 358 L210 132 L214 132Z" fill="url(#vrS)" opacity=".85"/>
  </g>
  <path class="v3-dash" d="M195 420 L195 130" stroke="#fff6d8" stroke-width="3" stroke-dasharray="18 26" opacity=".55"/>
  <g class="v3-tri">
    <ellipse cx="195" cy="262" rx="60" ry="48" fill="#000" opacity=".5" filter="url(#vrG)"/>
    <path d="M195 226 Q200 226 203 232 L229 286 Q233 296 223 296 L167 296 Q157 296 161 286 L187 232 Q190 226 195 226Z" fill="#ff9a10" opacity=".7" filter="url(#vrG)"/>
    <path d="M161 291 L229 291 Q227 301 221 301 L169 301 Q163 301 161 291Z" fill="#b65c00"/>
    <path d="M195 226 Q200 226 203 232 L229 286 Q233 296 223 296 L167 296 Q157 296 161 286 L187 232 Q190 226 195 226Z" fill="url(#vrT)"/>
    <path d="M176 262 L187 232 Q190 226 195 226 Q200 226 203 232 L214 262Z" fill="#fff" opacity=".2"/>
  </g>
</svg>`

const dotsWave = (cls = '') =>
  `<svg class="v1-line ${cls}" viewBox="0 0 340 90" aria-hidden="true"><path d="M0 45 C 50 10 90 10 130 45 S 210 80 250 45 S 320 20 340 30" fill="none" stroke="#fff" stroke-width="3.4" stroke-dasharray="0 9" stroke-linecap="round"/></svg>`
const bars = (n: number, cls: string) =>
  `<span class="${cls}">${Array.from({ length: n }, (_, i) => `<i style="--h:${5 + Math.round(30 * Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.23)))}px;--d:${(i % 7) * -0.13}s"></i>`).join('')}</span>`

type Screens = { chat: string; listen: string; answer: string; bg?: Record<'chat' | 'listen' | 'answer', string> }

// ───────── 1 · «Закат на трассе» (p22): one colour field; you are warm, Ась is blue
const SUNSET: Screens = {
  bg: { chat: 'is-dusk', listen: 'is-warm', answer: 'is-blue' },
  chat: `<p class="v1-hi">Добрый вечер, Никита</p>
    <h3 class="v1-h">Я хочу узнать…</h3>
    <div class="v1-tiles"><span>Ставку ЦБ<br>на месяц<small><i></i><i></i><i></i>факт и прогноз</small></span><span>Слухи<br>о Half-Life 3<small><i></i><i></i><i></i>что правда</small></span></div>
    <div class="v1-mark"><i></i><i></i><i></i><i></i><b>АСЬ</b></div>
    <div class="v1-btn v-tap">Спросить</div>`,
  listen: `<p class="v1-hi"><span class="v-l">Слушаю</span><span class="v-t">Ищу ответ…</span></p>
    <h3 class="v1-say" data-type="${Q}">${Q}</h3>
    ${dotsWave('is-run')}
    <p class="v1-note"><span class="v-l">Договорите — пойму по паузе</span><span class="v-t">Банк России, 23 октября</span></p>
    <div class="v1-btn">Стоп</div>`,
  answer: `<p class="v1-hi">Ась · ставка ЦБ</p>
    <h3 class="v1-big"><span data-count="14">14</span>%</h3>
    <p class="v1-sub" data-k>${words(A)}</p>
    ${dotsWave()}
    <p class="v1-spec">Факт · решение ЦБ 23.10 · 1 из 3</p>
    <div class="v1-btn">Пауза</div>`,
}

// ───────── 2 · «Матовое стекло» (p15, p16, p23): an evening road through a wet windscreen
const ROADBG = `<div class="v2-bg" aria-hidden="true">
  <i class="sky"></i><i class="glow"></i><i class="city"></i><i class="road"></i>
  <i class="tl l1"></i><i class="tl l2"></i><i class="tl l3"></i><i class="tl l4"></i>
  <i class="hl h1"></i><i class="hl h2"></i><i class="lamp p1"></i><i class="lamp p2"></i><i class="lamp p3"></i>
</div>${rain(70)}`
const FROST: Screens = {
  chat: `<div class="v2-top"><span class="v2-r">${ic(I.menu)}</span><span class="v2-name">Ась</span><span class="v2-r">${ic(I.plus)}</span></div>
    <div class="v2-slab v2-hello"><b>Добрый вечер</b><span>О чём поговорим?</span></div>
    <div class="v2-two"><div class="v2-slab"><b>Ставка</b><span>ЦБ на месяц</span></div><div class="v2-slab"><b>Слухи</b><span>Half-Life 3</span></div></div>
    <div class="v2-btns"><span class="v2-white v-tap">${ic(I.mic)}<b>Спросить</b></span><span class="v2-dark">${ic(I.car)}<b>В дорогу</b></span></div>`,
  listen: `<div class="v2-slab v2-say"><small><span class="v-l">Ась слушает</span><span class="v-t">Ищу ответ…</span></small><b data-type="${Q}">${Q}</b><span class="v2-hint">Договорите — пойму по паузе</span></div>
    <div class="v2-rec"><span class="v2-round">${ic(I.x)}</span>${bars(40, 'v2-wave')}<span class="v2-round is-dark">${ic(I.check)}</span></div>`,
  answer: `<div class="v2-slab v2-ans"><small>ключевая ставка · факт</small><b><span data-count="14">14</span>%</b><span>решение ЦБ 23 октября</span><i></i><p data-k>${words(A)}</p></div>
    <div class="v2-sl"><span>${ic(I.chart)}<b>1 из 3</b><i></i></span><em>дальше — почему</em></div>
    <div class="v2-btns"><span class="v2-white">${ic(I.pause)}<b>Пауза</b></span><span class="v2-dark">${ic(I.bookmark)}<b>Сохранить</b></span></div>`,
}

// ───────── 3 · «Дорога» (p03): black, amber light and road lines rising from below; text and two pills on top
const ROADS: Screens = {
  chat: `<p class="v3-hi">Добрый вечер, Никита</p>
    <div class="v3-grid">
      <span class="v3-sq is-hot">${ic(I.turn)}<b>14%</b><small>ставка ЦБ</small></span>
      <span class="v3-sq">${ic(I.chart)}<b>Слухи</b><small>Half-Life 3</small></span>
      <span class="v3-sq">${ic(I.car)}<b>В путь</b><small>голосом</small></span>
      <span class="v3-sq">${ic(I.pen)}<b>Текстом</b><small>написать</small></span>
    </div>
    <div class="v3-ask v-tap">${ic(I.mic)}Спросить Ась</div>`,
  listen: `<div class="v3-head">${ic(I.mic, 'v3-arrow')}<div><p class="v3-say" data-type="${Q}">${Q}</p><small><span class="v-l">слушаю</span><span class="v-t">ищу ответ…</span></small></div><span class="v3-pills"><i>●</i><i class="is-w">${ic(I.x)}</i></span></div>`,
  answer: `<div class="v3-head">${ic(I.turn, 'v3-arrow')}<div><b class="v3-big"><span data-count="14">14</span>%</b><small>ставка ЦБ · факт</small></div><span class="v3-pills"><i>1/3</i><i class="is-w">${ic(I.pause)}</i></span></div>
    <p class="v3-sub" data-k>${words(A)}</p>`,
}

// ───────── 4 · «День» (p20, p09, p21): light, a soft brushstroke of colour, a lavender answer card
const BRUSH = `<div class="v4-brush" aria-hidden="true"><i></i><i></i><i></i></div>`
const DAY: Screens = {
  chat: `<div class="v4-top"><span class="v4-logo">${ic(I.wave)}Ась</span></div>
    ${BRUSH}
    <p class="v4-kick">Ваш попутчик в дороге</p>
    <h3 class="v4-h">Что у вас<br><b>на уме?</b></h3>
    <div class="v4-chips"><span>Ставка ЦБ</span><span>Half-Life 3</span><span>В дорогу</span></div>
    <div class="v4-bar"><span>${ic(I.doc)}</span><span>${ic(I.kb)}</span></div>
    <div class="v4-in v-tap"><span>Спросите Ась</span><i>${ic(I.wave)}</i></div>`,
  listen: `<span class="v4-close">Слушаю ${ic(I.x)}</span>
    ${BRUSH}
    <p class="v4-q"><span class="v-l">Вопрос</span><span class="v-t">Ищу ответ</span></p>
    <h3 class="v4-say" data-type="${Q}">${Q}</h3>
    <p class="v4-small">Договорите — пойму по паузе. <b>Можно перебить</b> в любой момент.</p>
    <div class="v4-in is-on"><span>Слушаю…</span><i>${bars(9, 'v4-eq')}</i></div>`,
  answer: `<div class="v4-card"><span class="v4-pill">${ic(I.chart)}Ставка ЦБ</span><i></i><b><span data-count="14">14</span>%</b><p data-k>${words(A)}</p></div>
    <p class="v4-src">Факт · Банк России, 23 октября · 1 из 3</p>
    <div class="v4-in"><span>Дальше — почему?</span><i>${ic(I.pause)}</i></div>`,
}

const phone = (cls: string, label: string, inner: string, extra = '') => `<figure class="v-ph"><div class="v-scr ${cls}" ${extra}>${STATUS}${inner}<i class="v-home"></i></div><figcaption>${label}</figcaption></figure>`

function rowPhones(base: string, s: Screens, bgInner = '') {
  const bg = (k: 'chat' | 'listen' | 'answer') => s.bg?.[k] ?? ''
  const live = `<figure class="v-ph is-livefig"><div class="v-scr ${base} is-live" data-step="chat">
      ${s.bg ? Object.entries(s.bg).map(([k, c]) => `<i class="v-bgl ${c}" data-for="${k}"></i>`).join('') : ''}${bgInner}${STATUS}
      <div class="v-layer" data-k="chat">${s.chat}</div><div class="v-layer" data-k="listen">${s.listen}</div><div class="v-layer" data-k="answer">${s.answer}</div>
      <i class="v-finger" aria-hidden="true"></i><i class="v-home"></i></div><figcaption>▶ Живой сценарий</figcaption></figure>`
  return (
    live +
    phone(`${base} ${bg('chat')}`, 'Чат', bgInner + s.chat) +
    phone(`${base} ${bg('listen')}`, 'Слушаю', bgInner + s.listen) +
    phone(`${base} ${bg('answer')}`, 'Ответ', bgInner + s.answer)
  )
}

/** plays chat → tap → listen (words type in) → think → answer (count up, read out) in a loop */
function play(scr: HTMLElement) {
  let alive = true
  let visible = false
  let timer = 0
  const wait = (ms: number) => new Promise<void>((r) => (timer = window.setTimeout(r, ms)))
  const until = async () => {
    while (alive && (!visible || document.hidden)) await wait(300)
  }
  const type = async (el: HTMLElement | null, text: string, ms: number) => {
    if (!el) return
    const w = text.split(' ')
    for (let i = 1; i <= w.length; i++) {
      el.textContent = w.slice(0, i).join(' ')
      await wait(ms / w.length)
    }
  }
  const run = async () => {
    while (alive) {
      await until()
      const L = (k: string) => scr.querySelector<HTMLElement>(`.v-layer[data-k="${k}"]`)!
      scr.dataset.step = 'chat'
      L('listen').querySelectorAll<HTMLElement>('[data-type]').forEach((e) => (e.textContent = ''))
      L('answer').querySelectorAll('[data-k] span').forEach((s) => s.classList.remove('on'))
      L('answer').querySelectorAll<HTMLElement>('[data-count]').forEach((e) => (e.textContent = '0'))
      await wait(2000)
      scr.dataset.step = 'tap'
      await wait(650)
      scr.dataset.step = 'listen'
      const t = L('listen').querySelector<HTMLElement>('[data-type]')
      await type(t, t?.dataset.type ?? '', 2000)
      await wait(500)
      scr.dataset.step = 'think'
      await wait(1300)
      scr.dataset.step = 'answer'
      const c = L('answer').querySelector<HTMLElement>('[data-count]')
      for (let i = 0; i <= 14; i++) {
        if (c) c.textContent = String(i)
        await wait(38)
      }
      const spans = [...L('answer').querySelectorAll('[data-k] span')]
      for (const s of spans) {
        s.classList.add('on')
        await wait(230)
      }
      await wait(1800)
    }
  }
  const io = new IntersectionObserver((e) => (visible = e[0].isIntersecting), { threshold: 0.2 })
  io.observe(scr)
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    scr.dataset.step = 'answer'
    scr.querySelectorAll('[data-k] span').forEach((s) => s.classList.add('on'))
  } else run()
  return () => {
    alive = false
    clearTimeout(timer)
    io.disconnect()
  }
}

export class VisionsPage {
  readonly root = document.createElement('main')
  private stops: (() => void)[] = []
  constructor() {
    this.root.className = 'v-page'
    const row = (n: string, title: string, idea: string, why: string, pins: string, phones: string) => `
      <section class="v-row">
        <header><span>${n}</span><h2>${title}</h2><p>${idea}</p><p class="v-fix">${why}</p><small>${pins}</small></header>
        <div class="v-phones">${phones}</div>
      </section>`
    this.root.innerHTML = `
      <div class="v-head"><a href="#/">← Ась</a><h1>Направления визуала</h1><p>Одни и те же моменты — чат, «слушаю», ответ — в четырёх языках с доски «AI assist». Первый экран в каждом ряду живой: сам проигрывает вопрос и ответ.</p></div>
      ${row('1', 'Закат на трассе', 'Экран — одно цветовое поле. Говорите вы — тёплый закат, отвечает Ась — глубокий синий: кто говорит, видно краем глаза. Крупный шрифт, одна огромная чёрная кнопка.', '<b>За:</b> состояние считывается без чтения, самый «не ИИ-шный». <b>Против:</b> яркое поле ночью слепит — нужна приглушённая ночная версия.', 'пины p22 · p17', rowPhones('v1', SUNSET))}
      ${row('2', 'Матовое стекло', 'За интерфейсом — вечерняя дорога через мокрое лобовое стекло. Поверх — матовые плиты с крупным белым текстом и кнопки, как в умном доме: значок над подписью.', '<b>За:</b> спокойно и дорого, ответ — одна крупная плита. <b>Против:</b> размытие стоит ресурсов, на слабом телефоне нужно упрощать.', 'пины p15 · p16 · p23 · p06', rowPhones('v2', FROST, ROADBG))}
      ${row('3', 'Дорога', 'Чёрный экран и янтарный свет снизу вдоль линий дороги, как в виджете навигации. Вверху — ответ и две кнопки-кружка. Говорит Ась — линии бегут вперёд, слушает — пульсируют.', '<b>За:</b> сразу «про машину», ночью не слепит, свет — индикатор состояния. <b>Против:</b> похоже на навигатор, нужно не путать с подсказками маршрута.', 'пин p03', rowPhones('v3', ROADS, ROAD))}
      ${row('4', 'День', 'Светлый, как бумага: мазок цвета вместо шара, ответ — в лавандовой карточке, крупный текст с акцентом жирным. Дневная пара к любому тёмному варианту — на солнце тёмный экран превращается в зеркало.', '<b>За:</b> читается на солнце, мягко и по-человечески. <b>Против:</b> ночью нужен тёмный вариант.', 'пины p20 · p09 · p21 · p10', rowPhones('v4', DAY))}`
    this.root.querySelectorAll<HTMLElement>('.is-live').forEach((s) => this.stops.push(play(s)))
  }
  destroy() {
    this.stops.forEach((s) => s())
  }
}
