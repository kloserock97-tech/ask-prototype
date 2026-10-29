// #/visions — three visual directions for «Ась», all from the «AI assist» board.
// Each direction shows the same three moments: the chat, «слушаю», and the answer «14%».
// Static screens to choose a direction; the chosen one goes into the working app.

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
  game: 'M6 9h12a4 4 0 0 1 4 4v1a3 3 0 0 1-5.4 1.8L15 14H9l-1.6 1.8A3 3 0 0 1 2 14v-1a4 4 0 0 1 4-4z',
  plus: 'M12 5v14M5 12h14',
  pen: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  bookmark: 'M6 4h12v17l-6-4-6 4z',
}
const STATUS = `<div class="v-status"><b>9:41</b><span><i></i><i></i><i></i><i></i></span></div>`

// a fixed pseudo-random sequence, so the screens look the same on every visit
let seed = 7
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647

// p12 · numbers as round dots, 5×7
const GLYPH: Record<string, string[]> = {
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '%': ['11000', '11001', '00010', '00100', '01000', '10011', '00011'],
}
function dots(text: string, cell: number, color: string) {
  let x = 0
  let out = ''
  for (const ch of text) {
    const g = GLYPH[ch]
    if (!g) continue
    g.forEach((row, ry) =>
      [...row].forEach((b, rx) => {
        if (b === '1') out += `<circle cx="${(x + rx + 0.5) * cell}" cy="${(ry + 0.5) * cell}" r="${cell * 0.43}" fill="${color}"/>`
      }),
    )
    x += g[0].length + 1
  }
  return `<svg class="v-dm" viewBox="0 0 ${(x - 1) * cell} ${7 * cell}" width="${(x - 1) * cell}" height="${7 * cell}" role="img" aria-label="${text}">${out}</svg>`
}

// p12 / p04 · a globe of dots: points on a sphere, turned and tilted; the near side bigger and brighter
function globe(size: number, color: string) {
  const R = size * 0.46
  const c = size / 2
  const ry = 0.5
  const rx = -0.35
  let out = ''
  for (let lat = -84; lat <= 84; lat += 7) {
    const la = (lat * Math.PI) / 180
    const n = Math.max(6, Math.round(52 * Math.cos(la)))
    for (let i = 0; i < n; i++) {
      const lo = (i / n) * Math.PI * 2
      let x = Math.cos(la) * Math.cos(lo)
      let y = Math.sin(la)
      let z = Math.cos(la) * Math.sin(lo)
      ;[x, z] = [x * Math.cos(ry) - z * Math.sin(ry), x * Math.sin(ry) + z * Math.cos(ry)]
      ;[y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)]
      const depth = (z + 1) / 2
      const light = Math.max(0, -0.4 * x - 0.5 * y + 0.75 * z)
      const r = size * 0.0062 * (0.45 + 0.9 * depth) * (0.7 + 0.5 * light)
      out += `<circle cx="${(c + x * R).toFixed(1)}" cy="${(c + y * R).toFixed(1)}" r="${r.toFixed(2)}" fill="${color}" opacity="${(0.12 + 0.88 * depth * depth).toFixed(2)}"/>`
    }
  }
  return `<svg class="v-globe" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">${out}</svg>`
}

// p15 · raindrops on the windscreen: tiny lenses with a highlight
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

const phone = (cls: string, label: string, inner: string) => `<figure class="v-ph"><div class="v-scr ${cls}">${STATUS}${inner}<i class="v-home"></i></div><figcaption>${label}</figcaption></figure>`
const dotsWave = (amp: number) =>
  `<svg class="v1-line" viewBox="0 0 340 120" aria-hidden="true"><path d="M0 60 C 40 ${60 - amp} 70 ${60 - amp} 100 60 S 160 ${60 + amp} 190 60 S 250 ${60 - amp * 0.6} 280 60 S 330 ${60 + amp * 0.4} 340 60" fill="none" stroke="#fff" stroke-width="5" stroke-dasharray="0 13" stroke-linecap="round"/></svg>`

// ───────── 1 · «Закат на трассе» (p22, p17, p03): the screen is one colour field; you are warm, Ась is blue
const SUNSET = [
  phone(
    'v1 is-dusk',
    'Чат',
    `<p class="v1-hi">Добрый вечер, Никита</p>
     <h3 class="v1-h">Я хочу<br>узнать…</h3>
     <div class="v1-tiles"><span>Ставку ЦБ<br>на месяц<small>${ic(I.chart)}факт и прогноз</small></span><span>Слухи<br>о Half-Life 3<small>${ic(I.game)}что правда</small></span></div>
     <div class="v1-mark"><i></i><i></i><i></i><b>АСЬ</b></div>
     <p class="v1-write">${ic(I.pen)}или написать текстом</p>
     <div class="v1-btn">Спросить</div>`,
  ),
  phone(
    'v1 is-warm',
    'Слушаю — тёплый: говорите вы',
    `<p class="v1-hi">Слушаю</p>
     <h3 class="v1-say">Как изменится ключевая ставка в ближайший месяц?</h3>
     ${dotsWave(46)}
     <p class="v1-note">Договорите — пойму по паузе</p>
     <div class="v1-btn">Стоп</div>`,
  ),
  phone(
    'v1 is-blue',
    'Ответ — синий: говорит Ась',
    `<p class="v1-hi">Ась · ставка ЦБ</p>
     <span class="v1-chip">Факт · решение ЦБ 23.10</span>
     <h3 class="v1-big">14%</h3>
     <p class="v1-sub">До 18 декабря заседаний нет — в ближайший месяц ставка, скорее всего, не изменится.</p>
     <div class="v1-prog"><i class="on"></i><i></i><i></i><span>1 из 3 · дальше — почему</span></div>
     <div class="v1-btn">Пауза</div>`,
  ),
]

// ───────── 2 · «Матовое стекло» (p15, p16, p23, p06): an evening road seen through a wet windscreen
const ROADBG = `<div class="v2-bg" aria-hidden="true">
  <i class="sky"></i><i class="glow"></i><i class="city"></i><i class="road"></i>
  <i class="tl l1"></i><i class="tl l2"></i><i class="tl l3"></i><i class="tl l4"></i>
  <i class="hl h1"></i><i class="hl h2"></i><i class="lamp p1"></i><i class="lamp p2"></i><i class="lamp p3"></i>
</div>${rain(70)}`
const FROST = [
  phone(
    'v2',
    'Чат',
    `${ROADBG}
     <div class="v2-top"><span class="v2-r">${ic(I.menu)}</span><span class="v2-name">Ась</span><span class="v2-r">${ic(I.plus)}</span></div>
     <div class="v2-slab v2-hello"><small>Добрый вечер, Никита</small><b>О чём поговорим?</b></div>
     <div class="v2-two"><div class="v2-slab"><b>Ставка</b><span>ЦБ на месяц</span></div><div class="v2-slab"><b>Слухи</b><span>Half-Life 3</span></div></div>
     <div class="v2-last">${ic(I.bookmark)}<span>Последний ответ<b>14% · ставка ЦБ</b></span></div>
     <div class="v2-pills"><span class="v2-white">${ic(I.mic)}Спросить</span><span class="v2-dark">${ic(I.car)}В дорогу</span></div>`,
  ),
  phone(
    'v2',
    'Слушаю',
    `${ROADBG}
     <div class="v2-slab v2-say"><small>Ась слушает</small><b>Как изменится ключевая ставка в ближайший месяц?</b><span>Договорите — пойму по паузе</span></div>
     <div class="v2-rec"><span class="v2-round">${ic(I.x)}</span><span class="v2-wave">${Array.from({ length: 40 }, (_, i) => `<i style="height:${5 + Math.round(30 * Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.23)))}px"></i>`).join('')}</span><span class="v2-round is-dark">${ic(I.check)}</span></div>`,
  ),
  phone(
    'v2',
    'Ответ',
    `${ROADBG}
     <div class="v2-slab v2-ans"><small>ключевая ставка · факт</small><b>14%</b><span>решение ЦБ 23 октября</span><i></i><p>В ближайший месяц, скорее всего, не изменится: до 18 декабря заседаний нет.</p></div>
     <div class="v2-two"><div class="v2-slab is-s"><b>1 из 3</b><span>дальше — почему</span></div><div class="v2-slab is-s"><b>18 дек</b><span>следующее заседание</span></div></div>
     <div class="v2-pills"><span class="v2-white">${ic(I.pause)}Пауза</span><span class="v2-dark">${ic(I.bookmark)}Сохранить</span></div>`,
  ),
]

// ───────── 3 · «Ночной эфир» (p04, p12, p09, p19): Ась speaks in serif, numbers in dots, you in sans
const NIGHT = [
  phone(
    'v3',
    'Чат',
    `<div class="v3-top"><span class="v3-logo">А</span><span class="v3-menu">${ic(I.menu)}</span></div>
     <p class="v3-hi">Добрый вечер, Никита</p>
     <p class="v3-q">О чём поговорим?</p>
     <div class="v3-chips"><span>Ставка ЦБ<br>на месяц</span><span>Слухи<br>о Half-Life 3</span><span>В дорогу<br>голосом</span></div>
     <div class="v3-orb">${globe(220, '#cdd5ff')}</div>
     <div class="v3-comp"><span>Спросите Ась…</span><i>${ic(I.wave)}</i></div>`,
  ),
  phone(
    'v3',
    'Слушаю — ваши слова гротеском',
    `<p class="v3-tr">Как изменится ключевая ставка в ближайший месяц? И стоит ли ждать снижения до конца года…</p>
     <div class="v3-orb is-listen">${globe(230, '#cdd5ff')}</div>
     <p class="v3-lbl">Ась слушает</p>`,
  ),
  phone(
    'v3',
    'Ответ — Ась говорит антиквой',
    `<p class="v3-lbl is-top">ключевая ставка</p>
     <div class="v3-num">${dots('14%', 15, '#e6eaff')}</div>
     <div class="v3-card"><span class="v3-pill">${ic(I.chart)}Факт · ЦБ 23.10</span><i></i><p>До восемнадцатого декабря заседаний нет, так что ставка, скорее всего, останется прежней.</p></div>
     <p class="v3-src">Банк России · данные на 28 октября · 1 из 3</p>
     <div class="v3-stop">${ic(I.pause)}Пауза</div>`,
  ),
]

export class VisionsPage {
  readonly root = document.createElement('main')
  constructor() {
    this.root.className = 'v-page'
    const row = (n: string, title: string, idea: string, fix: string, pins: string, phones: string[]) => `
      <section class="v-row">
        <header><span>${n}</span><h2>${title}</h2><p>${idea}</p><p class="v-fix"><b>Доработано:</b> ${fix}</p><small>${pins}</small></header>
        <div class="v-phones">${phones.join('')}</div>
      </section>`
    this.root.innerHTML = `
      <div class="v-head"><a href="#/">← Ась</a><h1>Три направления визуала</h1><p>Одни и те же три экрана — чат, «слушаю», ответ — в трёх языках с доски «AI assist». Выберите одно, и оно уйдёт в рабочее приложение.</p></div>
      ${row('1', 'Закат на трассе', 'Экран — одно цветовое поле. Говорите вы — тёплый закат, отвечает Ась — глубокий синий: кто говорит, видно краем глаза. Крупный тонкий шрифт, одна огромная чёрная кнопка.', 'насыщенные поля как в p22, фраза ответа 24 px вместо 18, метка «факт» — стеклянной пилюлей, видно «1 из 3», волна из точек — голос во всю ширину, в чате — «или написать текстом».', 'пины p22 · p17 · p03', SUNSET)}
      ${row('2', 'Матовое стекло', 'За интерфейсом — вечерняя дорога через мокрое лобовое стекло: небо, фонари, стоп-сигналы, капли. Поверх — матовые плиты с крупным белым текстом, белая пилюля — главное действие.', 'фон стал дорогой, а не пятнами; капли на стекле как в p15; плиты темнее — текст читается на любом фоне; ответ целиком внутри плиты; убран лишний ползунок громкости.', 'пины p15 · p16 · p23 · p06', FROST)}
      ${row('3', 'Ночной эфир', 'Тёмно-синий эфир с сеткой. Вы говорите гротеском, Ась отвечает антиквой — как голос в радиоэфире. Цифры — точками, как на табло; Ась — шар из точек.', 'шар стал объёмным — точки на сфере, ближние крупнее; «14%» читается — без лишней сетки; подсказки и приветствие крупнее; у ответа есть источник и дата.', 'пины p04 · p12 · p09 · p19', NIGHT)}`
  }
  destroy() {}
}
