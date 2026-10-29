// #/visions — three visual directions for GRIF, all from the «AI assist» board.
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
  speaker: 'M4 10v4h4l5 4V6L8 10zM16 9a4 4 0 0 1 0 6',
  car: 'M5 17v-5l2.2-5h9.6l2.2 5v5M3 12h18v5H3zM6.5 17v2.5M17.5 17v2.5',
  chart: 'M4 19h16M7 16V10M12 16V5M17 16v-4',
  sun: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  plus: 'M12 5v14M5 12h14',
}
const STATUS = `<div class="v-status"><b>9:41</b><span><i></i><i></i><i></i><i></i></span></div>`

// p12 · numbers as a dot matrix, 5×7, with the unlit grid faintly visible
const GLYPH: Record<string, string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
}
function dots(text: string, cell: number, color: string) {
  let x = 0
  let out = ''
  for (const ch of text) {
    const g = GLYPH[ch]
    if (!g) continue
    g.forEach((row, ry) =>
      [...row].forEach((b, rx) => {
        const cx = (x + rx + 0.5) * cell
        const cy = (ry + 0.5) * cell
        out += b === '1' ? `<circle cx="${cx}" cy="${cy}" r="${cell * 0.44}" fill="${color}"/>` : `<circle cx="${cx}" cy="${cy}" r="${cell * 0.1}" fill="${color}" opacity=".06"/>`
      }),
    )
    x += g[0].length + 1
  }
  return `<svg class="v-dm" viewBox="0 0 ${(x - 1) * cell} ${7 * cell}" width="${(x - 1) * cell}" height="${7 * cell}" aria-label="${text}">${out}</svg>`
}

// p12 · a sphere of dots, lit from the top left
function sphere(size: number, color: string) {
  const R = size / 2
  const step = size / 26
  let out = ''
  for (let y = step / 2; y < size; y += step)
    for (let x = step / 2; x < size; x += step) {
      const dx = (x - R) / R
      const dy = (y - R) / R
      const d = dx * dx + dy * dy
      if (d > 1) continue
      const z = Math.sqrt(1 - d)
      const light = Math.max(0, -0.45 * dx - 0.55 * dy + 0.7 * z)
      const r = step * (0.08 + 0.34 * light)
      out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="${color}"/>`
    }
  return `<svg class="v-sphere" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">${out}</svg>`
}

const phone = (cls: string, label: string, inner: string) => `<figure class="v-ph"><div class="v-scr ${cls}">${STATUS}${inner}<i class="v-home"></i></div><figcaption>${label}</figcaption></figure>`

// ───────── 1 · «Закат на трассе» (p22, p17, p03): the screen is one colour field; you are warm, GRIF is blue
const SUNSET = [
  phone(
    'v1 is-dusk',
    'Чат',
    `<p class="v1-hi">Добрый вечер, Никита</p>
     <h3 class="v1-h">Я хочу<br>узнать…</h3>
     <div class="v1-tiles"><span>Ставку ЦБ<br>на месяц<small>${ic(I.chart)}факт и прогноз</small></span><span>Слухи<br>о Half-Life 3<small>${ic(I.wave)}голосом</small></span></div>
     <div class="v1-mark"><i></i><i></i><i></i><b>GRIF</b></div>
     <div class="v1-btn">Спросить</div>`,
  ),
  phone(
    'v1 is-warm',
    'Слушаю — тёплый: говорите вы',
    `<p class="v1-hi">Слушаю</p>
     <h3 class="v1-say">Как изменится ключевая ставка в ближайший месяц?</h3>
     <svg class="v1-line" viewBox="0 0 300 60" aria-hidden="true"><path d="M0 30 Q 25 6 50 30 T 100 30 T 150 30 T 200 30 T 250 30 T 300 30" fill="none" stroke="#fff" stroke-width="2.6" stroke-dasharray="0 9" stroke-linecap="round"/></svg>
     <div class="v1-btn">Стоп</div>`,
  ),
  phone(
    'v1 is-blue',
    'Ответ — синий: говорит GRIF',
    `<p class="v1-hi">GRIF · ставка ЦБ</p>
     <h3 class="v1-big">14%</h3>
     <p class="v1-sub">До 18 декабря заседаний нет — в ближайший месяц ставка, скорее всего, не изменится.</p>
     <svg class="v1-line" viewBox="0 0 300 60" aria-hidden="true"><path d="M0 40 Q 40 10 80 34 T 160 26 T 240 34 T 300 20" fill="none" stroke="#fff" stroke-width="2.6" stroke-dasharray="0 9" stroke-linecap="round" opacity=".85"/></svg>
     <p class="v1-spec">Факт · решение ЦБ 23.10 · 1 из 3</p>
     <div class="v1-btn">Пауза</div>`,
  ),
]

// ───────── 2 · «Матовое стекло» (p15, p16, p23, p06): a blurred road behind frosted slabs
const BLOBS = `<div class="v2-bg" aria-hidden="true"><i class="b1"></i><i class="b2"></i><i class="b3"></i><i class="b4"></i><i class="b5"></i></div>`
const FROST = [
  phone(
    'v2',
    'Чат',
    `${BLOBS}
     <div class="v2-top"><span class="v2-r">${ic(I.menu)}</span><span class="v2-r">${ic(I.plus)}</span></div>
     <div class="v2-slab v2-hello"><b>Добрый вечер</b><span>Никита</span></div>
     <div class="v2-two"><div class="v2-slab"><b>Ставка</b><span>ЦБ на месяц</span></div><div class="v2-slab"><b>Слухи</b><span>Half-Life 3</span></div></div>
     <div class="v2-pills"><span class="v2-white">${ic(I.mic)}Спросить</span><span class="v2-dark">${ic(I.car)}В дорогу</span></div>`,
  ),
  phone(
    'v2',
    'Слушаю',
    `${BLOBS}
     <div class="v2-slab v2-say"><small>слушаю</small><b>Как изменится ключевая ставка в ближайший месяц?</b></div>
     <div class="v2-sl"><span>${ic(I.speaker)}<b>73</b><i></i></span><em>Громкость</em></div>
     <div class="v2-rec"><span class="v2-round">${ic(I.x)}</span><span class="v2-wave">${Array.from({ length: 34 }, (_, i) => `<i style="height:${6 + Math.round(26 * Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.23)))}px"></i>`).join('')}</span><span class="v2-round is-dark">${ic(I.check)}</span></div>`,
  ),
  phone(
    'v2',
    'Ответ',
    `${BLOBS}
     <div class="v2-slab v2-ans"><small>ключевая ставка</small><b>14%</b><span>решение ЦБ 23 октября</span></div>
     <div class="v2-two"><div class="v2-slab is-s"><b>Факт</b><span>Банк России</span></div><div class="v2-slab is-s"><b>18 дек</b><span>следующее заседание</span></div></div>
     <p class="v2-cap">В ближайший месяц ставка, скорее всего, не изменится.</p>
     <div class="v2-pills"><span class="v2-white">${ic(I.pause)}Пауза</span><span class="v2-dark">Сохранить</span></div>`,
  ),
]

// ───────── 3 · «Ночной эфир» (p04, p12, p09, p19): GRIF speaks in serif, numbers in dots, you in sans
const NIGHT = [
  phone(
    'v3',
    'Чат',
    `<div class="v3-top"><span class="v3-logo">G</span><span class="v3-menu">${ic(I.menu)}</span></div>
     <p class="v3-hi">Добрый вечер, Никита</p>
     <p class="v3-q">О чём поговорим?</p>
     <div class="v3-chips"><span>Ставка ЦБ<br>на месяц</span><span>Слухи<br>о Half-Life 3</span><span>В дорогу<br>голосом</span></div>
     <div class="v3-orb">${sphere(150, '#c9d2ff')}</div>
     <p class="v3-mood">Спросите голосом или напишите</p>
     <div class="v3-comp"><span>Поговорить с GRIF…</span>${ic(I.wave)}</div>`,
  ),
  phone(
    'v3',
    'Слушаю — ваши слова гротеском',
    `<p class="v3-tr">Как изменится ключевая ставка в ближайший месяц? И стоит ли ждать снижения до конца года…</p>
     <div class="v3-orb is-listen">${sphere(170, '#c9d2ff')}</div>
     <p class="v3-lbl">GRIF слушает</p>`,
  ),
  phone(
    'v3',
    'Ответ — GRIF говорит антиквой',
    `<p class="v3-lbl is-top">ключевая ставка</p>
     <div class="v3-num">${dots('14%', 15, '#dfe4ff')}</div>
     <div class="v3-card"><span class="v3-pill">${ic(I.chart)}Факт · ЦБ 23.10</span><i></i><p>До восемнадцатого декабря заседаний нет, так что ставка, скорее всего, останется прежней.</p></div>
     <div class="v3-stop">${ic(I.pause)}Пауза</div>`,
  ),
]

export class VisionsPage {
  readonly root = document.createElement('main')
  constructor() {
    this.root.className = 'v-page'
    const row = (n: string, title: string, idea: string, pins: string, phones: string[]) => `
      <section class="v-row">
        <header><span>${n}</span><h2>${title}</h2><p>${idea}</p><small>${pins}</small></header>
        <div class="v-phones">${phones.join('')}</div>
      </section>`
    this.root.innerHTML = `
      <div class="v-head"><a href="#/">← GRIF</a><h1>Три направления визуала</h1><p>Одни и те же три экрана — чат, «слушаю», ответ — в трёх языках с доски «AI assist». Выберите одно, и оно уйдёт в рабочее приложение.</p></div>
      ${row('1', 'Закат на трассе', 'Экран — одно цветовое поле. Говорите вы — тёплый закат, отвечает GRIF — глубокий синий: кто говорит, видно краем глаза. Крупный тонкий шрифт, одна огромная чёрная кнопка.', 'пины p22 · p17 · p03', SUNSET)}
      ${row('2', 'Матовое стекло', 'За интерфейсом — размытая вечерняя дорога, как через лобовое стекло в дождь. Поверх — матовые плиты с крупным белым текстом, белая пилюля — главное действие.', 'пины p15 · p16 · p23 · p06', FROST)}
      ${row('3', 'Ночной эфир', 'Тёмно-синий эфир с сеткой. Вы говорите гротеском, GRIF отвечает антиквой — как голос в радиоэфире. Цифры — точечной матрицей, как на табло, GRIF — сфера из точек.', 'пины p04 · p12 · p09 · p19', NIGHT)}`
  }
  destroy() {}
}
