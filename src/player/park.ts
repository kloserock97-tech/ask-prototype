// C9 — the parked trip summary: the only place where reading is allowed.
import { el } from './render'

// key-rate decisions in 2026 (Bank of Russia): month index from Jan, value
const RATE: [number, number][] = [[0, 16], [1.4, 15.5], [2.6, 15], [3.8, 14.5], [5.4, 14.25], [6.7, 14], [9.8, 14]]

function chart(): string {
  const W = 300, H = 96
  const X = (m: number) => (m / 9.8) * (W - 8) + 4
  const Y = (v: number) => ((16.2 - v) / 2.4) * 76 + 8
  let d = `M ${X(0)} ${Y(16)}`
  for (let i = 1; i < RATE.length; i++) d += ` H ${X(RATE[i][0])} V ${Y(RATE[i][1])}`
  const len = 900
  return `<svg class="rate" viewBox="0 0 ${W} ${H + 20}" role="img" aria-label="Ключевая ставка в 2026 году: с 16% в январе до 14% с июля">
    <path d="${d}" fill="none" stroke="var(--cobalt)" stroke-width="3" stroke-linejoin="round" stroke-dasharray="${len}" stroke-dashoffset="${len}"><animate attributeName="stroke-dashoffset" from="${len}" to="0" dur="0.9s" begin="0.25s" fill="freeze" calcMode="spline" keySplines="0.23 1 0.32 1"/></path>
    <circle cx="${X(9.8)}" cy="${Y(14)}" r="6" fill="var(--cobalt)"/>
    <text x="4" y="${Y(16) + 18}">16%</text><text x="${W - 34}" y="${Y(14) - 12}" class="hi">14%</text>
    <text x="4" y="${H + 16}">фев</text><text x="${W - 26}" y="${H + 16}">окт</text>
  </svg>`
}

const row = (title: string, body: string, pills: [string, boolean?][], prop: string, extra = '') => `
  <article class="p-row">
    <img class="p-prop" src="./img/${prop}.webp" alt="" />
    <h3>${title}</h3>
    <p>${body}</p>${extra}
    ${pills.length ? `<div class="p-pills">${pills.map(([t, q]) => `<span${q ? ' data-quiet' : ''}>${t}</span>`).join('')}</div>` : ''}
  </article>`

export function buildPark(): HTMLElement {
  const root = el('div', 'scr park')
  root.innerHTML = `
  <div class="p-scroll">
    <header class="p-head">
      <div><h2>поездка</h2><p>27 окт · Москва → Петербург<br/>2 темы · сохранено 3 ответа</p></div>
      <img src="./img/ask-speak.webp" alt="ась доволен" />
    </header>
    <section class="p-sec"><h4>ставка</h4><div>
      ${row('14% до 18 декабря', 'ЦБ сохранил ставку 23 октября, второй раз подряд. С февраля она снизилась с 16 до 14%.', [], 'prop-doc', chart())}
      ${row('декабрь: 14% или 13,75%', 'ВТБ — 60 на 40 за снижение, часть аналитиков ждёт паузы. Сводка, не совет.', [['ЦБ'], ['ВТБ'], ['Ренессанс']], 'prop-doc')}
    </div></section>
    <section class="p-sec"><h4>half‑life</h4><div>
      ${row('Half‑Life 3 — пока слух', 'Композитор Valve вслух назвал проект HLX на GameSoundCon. Анонса и даты нет.', [['слух', true], ['Valve · 21 окт']], 'prop-rumor')}
    </div></section>
    <section class="p-sec"><h4>отложено</h4><div>
      ${row('«а вклад открывать?»', 'Вопрос сохранён. Советовать не возьмусь — могу показать, как ставки по вкладам меняются после решений ЦБ.', [['спросить']], 'prop-bookmark')}
    </div></section>
  </div>
  <div class="p-bar">
    <button class="p-btn press" data-kind="primary" data-go="home">переслать сводку</button>
    <button class="p-btn press" data-go="A2">спросить ещё</button>
  </div>`
  return root
}
