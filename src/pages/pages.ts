import { SCENARIOS, SCREENS } from '../data/screens'
import { Glass } from '../gl/glass'
import { EASE_OUT, enter, reduced, spring, springIn } from '../motion'
import { el } from '../player/render'
import { icon } from '../ui/icons'
import { pixelFace } from './pixel'

const POSE: Record<string, string> = { idle: 'ask-idle', listen: 'ask-listen', think: 'ask-glow', speak: 'ask-speak', unsure: 'ask-unsure', pause: 'ask-pause' }
const img = (n: string, alt = '', cls = '') => `<img src="./img/${n}.webp" alt="${alt}" class="${cls}" decoding="async" />`

// stagger is decoration: cap it so nothing waits more than ~400 ms
function stagger(root: HTMLElement, sel: string, base = 60) {
  root.querySelectorAll(sel).forEach((e, i) => enter(e, base + Math.min(i, 8) * 40))
}

// ---------------------------------------------------------------- home
export function home(): HTMLElement {
  document.documentElement.dataset.mode = 'day'
  const p = el('main', 'page home')
  p.innerHTML = `
    <section class="hero">
      <h1 class="word">ась?</h1>
      ${img('ask-speak', 'ась — 3D-персонаж в форме реплики', 'hero-mascot breath')}
      <p class="lead">ИИ‑ассистент, который отвечает как человек: коротко, по делу и вовремя. Даже за рулём.</p>
      <p class="sub">Голосовой режим для поездки по М‑11. Говорит сам, на экране — одна главная цифра, замолкает, когда вам не до него.</p>
    </section>
    <section class="list">
      <h4 class="vlabel">сценарии</h4>
      <div>
        ${SCENARIOS.map((s) => `<a class="row press" href="#/p/${s.screens[0]}">${img(POSE[SCREENS[s.screens[0]].pose ?? 'pause'] ?? 'ask-idle', '', 'row-pose')}<span><b>${s.title}</b><i>${s.sub} · ${s.screens.length} экранов</i></span>${icon.arrow}</a>`).join('')}
      </div>
    </section>
    <section class="list">
      <h4 class="vlabel">как устроено</h4>
      <div>
        <a class="row press" href="#/flow">${img('prop-doc', '', 'row-pose')}<span><b>user flow</b><i>все состояния и переходы</i></span>${icon.arrow}</a>
        <a class="row press" href="#/island"><span class="row-pix">${pixelFace('speak', 4)}</span><span><b>вне приложения</b><i>Dynamic Island поверх навигатора</i></span>${icon.arrow}</a>
        <a class="row press" href="#/guide">${img('prop-bookmark', '', 'row-pose')}<span><b>гайд</b><i>цвет, шрифт, 3D, шейдер, движение</i></span>${icon.arrow}</a>
      </div>
    </section>
    <p class="tip">Включите звук: в меню прототипа ась читает свои реплики вслух. Листайте экраны свайпом.</p>
    <footer class="foot">Прототип. Дизайн, 3D и код — Никита Горбачев, 2026.</footer>`
  queueMicrotask(() => {
    enter(p.querySelector('.word')!, 0, 20)
    springIn(p.querySelector('.hero-mascot')!, 'translateY(30px) scale(0.92)', 120, spring(220, 18))
    stagger(p, '.lead, .sub, .row, .tip', 200)
  })
  return p
}

// ---------------------------------------------------------------- flow
const MAIN: [string, string][] = [
  ['A1', 'Bluetooth машины + скорость'], ['A2', 'голосом · 3 с'], ['A3', '«ась» или касание'], ['A4', 'пауза в речи'],
  ['A5', 'ответ готов'], ['A6', '«подробнее»'], ['A7', '«сохранить»'], ['C9', 'скорость 0 дольше минуты'],
]
const BRANCH: [string, string][] = [
  ['C5', 'распознал неуверенно'], ['C3', 'пропала сеть'], ['C4', 'белый список'], ['C1', 'подсказка навигатора'], ['C2', 'пункт оплаты, развязка, торможение'], ['C6', 'входящий звонок'],
]
const node = (id: string) => {
  const s = SCREENS[id]
  const pose = s.pose ? img(POSE[s.pose], '', 'node-pose') : `<span class="node-sos">SOS</span>`
  return `<a class="node press" href="#/p/${id}">${pose}<span><i>${id}</i><b>${s.title}</b></span></a>`
}
export function flow(): HTMLElement {
  document.documentElement.dataset.mode = 'day'
  const p = el('main', 'page flow')
  p.innerHTML = `
    <a class="back press" href="#/screens">${icon.prev} концепт</a>
    <h1 class="h1">user flow</h1>
    <p class="sub">Ядро — цикл «жду → слушаю → думаю → говорю». Всё, что приходит снаружи — навигатор, шлагбаум, звонок, сеть, усталость, — врезается в цикл и возвращает в него, не теряя разговор. Нажмите на узел — откроется экран.</p>
    <h4 class="sec">основной путь</h4>
    <ol class="rail">
      <li><span class="node node-chat"><span><i>старт</i><b>обычный чат</b></span></span></li>
      ${MAIN.map(([id, why]) => `<li><span class="edge">${why}</span>${node(id)}</li>`).join('')}
    </ol>
    <div class="returns">
      <p><b>возвраты</b>«стоп» или тишина 8 с → жду · «готово» → жду · пассажир → обычный чат · «спросить ещё» → чат</p>
    </div>
    <h4 class="sec">прерывания и ошибки</h4>
    <p class="sub small">Из любого состояния голоса — и обратно в то же место разговора, с начала фразы.</p>
    <div class="branches">${BRANCH.map(([id, why]) => `<div><span class="edge">${why}</span>${node(id)}</div>`).join('')}</div>
    <h4 class="sec hot">безопасность</h4>
    <div class="branches">
      <div><span class="edge">2,5 ч в пути или ночь</span>${node('C7')}</div>
      <div><span class="edge">«мне плохо» — из любого состояния, даже без сети</span>${node('C8')}</div>
    </div>
    <h4 class="sec">что видит ась</h4>
    <dl class="signals">
      ${[
        ['Bluetooth машины + скорость GPS', 'включает режим «за рулём»'], ['подсказка навигатора', 'пауза, продолжение с начала фразы'],
        ['геозоны пунктов оплаты М‑11', 'пауза за 300 м'], ['акселерометр', 'резкое торможение — тишина'], ['входящий звонок', 'пауза, потом «продолжить?»'],
        ['качество сети', 'очередь вопросов, честная дата данных'], ['время в пути и ночь', 'предложение отдохнуть'], ['скорость 0 дольше минуты', 'стоянка и сводка поездки'],
      ].map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}
    </dl>`
  queueMicrotask(() => stagger(p, '.h1, .sub, .rail li, .branches > div, .signals dt', 40))
  return p
}

// ---------------------------------------------------------------- island
type IslandState = 'listen' | 'answer' | 'pause' | 'sos'
export function island(): HTMLElement {
  document.documentElement.dataset.mode = 'day'
  const p = el('main', 'page island-page')
  p.innerHTML = `
    <a class="back press" href="#/screens">${icon.prev} концепт</a>
    <h1 class="h1">вне приложения</h1>
    <p class="sub">Телефон на торпедо чаще показывает навигатор, а не ась. Поэтому ась живёт в Dynamic Island: пиксельная мордочка показывает состояние, не закрывая карту. Приём — из Live Activity Дринкита, где этапы заказа нарисованы пиксельными символами их шрифта.</p>
    <div class="pix-row">${['idle', 'listen', 'think', 'speak', 'unsure', 'pause', 'sos'].map((s) => `<figure>${pixelFace(s, 6)}<figcaption>${{ idle: 'жду', listen: 'слушаю', think: 'думаю', speak: 'говорю', unsure: 'не уверен', pause: 'пауза', sos: 'SOS' }[s]}</figcaption></figure>`).join('')}</div>
    <div class="mapphone">
      <svg class="map" viewBox="0 0 402 874" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="402" height="874" fill="#1b1e26"/>
        <path d="M-20 700 C 120 640, 180 520, 230 380 S 300 140, 330 -20" stroke="#2c313e" stroke-width="34" fill="none"/>
        <path d="M-20 260 L 430 330" stroke="#262a35" stroke-width="18"/><path d="M60 900 L 140 -20" stroke="#262a35" stroke-width="12"/><path d="M-20 520 L 430 560" stroke="#262a35" stroke-width="10"/>
        <path d="M201 900 C 205 760, 215 620, 230 380 S 300 140, 330 -20" stroke="#5aa9ff" stroke-width="12" stroke-linecap="round" fill="none"/>
        <circle cx="203" cy="722" r="20" fill="#fff"/><path d="M203 709 L212 731 L203 726 L194 731 Z" fill="#5aa9ff"/>
      </svg>
      <div class="maneuver"><svg width="34" height="34" viewBox="0 0 40 40" fill="none"><path d="M12 34 V18 a6 6 0 0 1 6 -6 H30 M24 6 L30 12 L24 18" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg><span><b>400 м</b><i>съезд на Тверь</i></span></div>
      <div class="isl" data-state="listen">
        <div class="isl-compact"><span class="isl-face"></span><span class="isl-word"></span></div>
        <div class="isl-big"><span class="isl-face-big">${pixelFace('speak', 5)}</span><span class="isl-txt"><b>14%</b><i>до 18 декабря</i><em>ЦБ · 23 окт</em></span><span class="isl-stop"><span></span></span></div>
      </div>
    </div>
    <div class="isl-ctrl">${(['listen', 'answer', 'pause', 'sos'] as IslandState[]).map((s) => `<button class="tab press" data-isl="${s}">${{ listen: 'слушаю', answer: 'ответ', pause: 'пауза на манёвре', sos: 'SOS' }[s]}</button>`).join('')}</div>
    <p class="sub small">Ответ разворачивает остров на 3 секунды — цифра, срок и источник, — потом он сворачивается сам: навигатор важнее. Остров перетекает пружиной, как настоящий Dynamic Island.</p>`

  const isl = p.querySelector<HTMLElement>('.isl')!
  const face = p.querySelector<HTMLElement>('.isl-face')!
  const word = p.querySelector<HTMLElement>('.isl-word')!
  const tabs = [...p.querySelectorAll<HTMLButtonElement>('[data-isl]')]
  let timer = 0
  let current: IslandState = 'listen'
  const shapes = { compact: 'inset(0% 21.5% 78% 21.5% round 19px)', big: 'inset(0% 0% 0% 0% round 44px)' }
  const setState = (s: IslandState, auto = false) => {
    clearTimeout(timer)
    const wasBig = isl.dataset.state === 'answer'
    current = s
    isl.dataset.state = s
    tabs.forEach((t) => t.toggleAttribute('aria-current', t.dataset.isl === s))
    const big = s === 'answer'
    face.innerHTML = pixelFace(s === 'answer' ? 'speak' : s, 2.6)
    word.textContent = { listen: 'слушаю', answer: 'говорю', pause: 'пауза', sos: 'SOS 5 с' }[s]
    if (big !== wasBig) {
      const sp = spring(big ? 380 : 420, big ? 24 : 30)
      isl.animate([{ clipPath: big ? shapes.compact : shapes.big }, { clipPath: big ? shapes.big : shapes.compact }], { duration: reduced() ? 150 : sp.duration, easing: reduced() ? EASE_OUT : sp.easing, fill: 'forwards' })
    }
    if (big) timer = window.setTimeout(() => setState('listen', true), 3000)
    if (!auto && navigator.userActivation?.hasBeenActive) navigator.vibrate?.(6)
  }
  isl.style.clipPath = shapes.compact
  p.querySelector('.isl-ctrl')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-isl]')
    if (b) setState(b.dataset.isl as IslandState)
  })
  setState(current, true)
  queueMicrotask(() => stagger(p, '.h1, .sub, .pix-row figure, .mapphone, .isl-ctrl', 40))
  return p
}

// ---------------------------------------------------------------- guide
let guideGlass: Glass | null = null
export function leaveGuide() {
  guideGlass?.destroy()
  guideGlass = null
}

export function guide(): HTMLElement {
  document.documentElement.dataset.mode = 'day'
  const p = el('main', 'page guide')
  const rules: [string, string][] = [
    ['дорога первая', 'Говорю, только когда на дороге спокойно. Перестроение, шлагбаум, подсказка навигатора — пауза.'],
    ['голос главный, экран для взгляда', 'Статус, одна цифра, две кнопки. Взгляд — до 2 с, на экране — до 30 знаков.'],
    ['сначала вывод', 'Первый ответ — на один вдох, около 10 секунд. Подробности — после «да».'],
    ['длинное — на стоянку', 'Ссылки, графики и источники ждут в сводке поездки.'],
    ['честно о неуверенности', 'Факт, прогноз и слух выглядят и звучат по‑разному.'],
  ]
  p.innerHTML = `
    <a class="back press" href="#/screens">${icon.prev} концепт</a>
    <h1 class="h1">гайд</h1>
    <p class="sub">Визуальный язык — по мотивам Додо и Дринкита: тихий светлый интерфейс, один громкий кобальт, вся эмоция — в тактильном 3D. Паттерны — из ИИ‑ассистентов. Правила — из исследований вождения.</p>

    <h4 class="sec">пять правил</h4>
    <div class="rules">${rules.map(([h, t]) => `<div><b>${h}</b><p>${t}</p></div>`).join('')}</div>

    <h4 class="sec">цвет</h4>
    <div class="swatches">
      ${[['#F2F2F6', 'фон, день'], ['#FFFFFF', 'поверхность'], ['#0D0F1F', 'текст'], ['#2F3BFF', 'кобальт — единственный громкий цвет'], ['#0B0C1A', 'фон, ночь'], ['#8C95FF', 'акцент ночью'], ['#FF5A1F', 'только стоп и SOS']].map(([c, n]) => `<div><i style="background:${c}"></i><b>${c}</b><span>${n}</span></div>`).join('')}
    </div>

    <h4 class="sec">шрифт за рулём</h4>
    <div class="type">
      <div><span class="t-fig">14%</span><i>цифра · 112 pt</i></div>
      <div><span class="t-st">говорю</span><i>статус · 40 pt</i></div>
      <div><span class="t-ln">до 18 декабря</span><i>строка · 36 pt</i></div>
      <div><span class="t-nt">ЦБ · 23 окт</span><i>метка · 30 pt</i></div>
    </div>
    <p class="sub small">Onest. С 70 см норма для текста в машине — от 20′ угловой высоты (ISO 15008), мельче 28 pt за рулём не набираем.</p>

    <h4 class="sec">шесть поз</h4>
    <div class="poses">${[['idle', 'жду'], ['listen', 'слушаю'], ['think', 'думаю'], ['speak', 'говорю'], ['unsure', 'не уверен'], ['pause', 'пауза']].map(([k, n]) => `<figure>${img(POSE[k], 'ась: ' + n)}<figcaption>${n}</figcaption></figure>`).join('')}</div>

    <h4 class="sec">алфавит предметов</h4>
    <div class="poses props">${[['doc', 'источник'], ['rumor', 'слух'], ['bookmark', 'сохранено'], ['mug', 'отдых'], ['antenna', 'сеть'], ['barrier', 'пункт оплаты']].map(([k, n]) => `<figure>${img('prop-' + k, n)}<figcaption>${n}</figcaption></figure>`).join('')}</div>

    <h4 class="sec">материал: голос за стеклом</h4>
    <div class="material">
      <canvas aria-label="шейдер: кобальтовое свечение за рифлёным стеклом"></canvas>
      <div class="mat-tabs">${[['idle', 'жду'], ['listen', 'слушаю'], ['speak', 'говорю'], ['pause', 'пауза'], ['night', 'ночь'], ['danger', 'SOS']].map(([k, n], i) => `<button class="tab press" data-mat="${k}" ${i === 2 ? 'aria-current="true"' : ''}>${n}</button>`).join('')}</div>
    </div>
    <p class="sub small">Свой шейдер: за рифлёным стеклом дышит кобальтовое свечение. Громкость голоса — размер и яркость, состояние — цвет и скорость. Свет живёт в верхней трети, текст всегда на спокойном фоне.</p>

    <h4 class="sec">движение</h4>
    <div class="motion">
      <div class="demo">
        <div class="rays demo-rays"></div>
        ${img('ask-speak', '', 'demo-mascot')}
        <div class="demo-card">${img('fig-14', '14%', 'demo-fig')}<span>до 18 декабря</span></div>
      </div>
      <button class="tab press play">${icon.play} проиграть ответ</button>
      <ul class="specs">
        <li><b>только по событию</b> — в покое ничего не прыгает, свечение дышит медленно</li>
        <li><b>вспышка</b> 0–150 мс, ease‑out</li>
        <li><b>карточка</b> — пружина: жёсткость 300, затухание 22</li>
        <li><b>цифра</b> — перелёт 1,08 → 1</li>
        <li><b>нажатие</b> — scale 0,97 за 160 мс</li>
        <li><b>уменьшить движение</b> — без лучей и пружины, кроссфейд 150 мс</li>
      </ul>
    </div>

    <h4 class="sec">не делаем</h4>
    <ul class="dont">
      <li>светящийся шар‑орб вместо персонажа</li><li>фиолетовые градиенты и «искорки» как символ ИИ</li><li>текст мельче 28 pt за рулём</li>
      <li>больше двух кнопок на экране вождения</li><li>шутки на паузах, ошибках и в SOS</li><li>выдуманные даты и цифры: «не знаю» лучше</li>
    </ul>`

  const canvas = p.querySelector('canvas')!
  guideGlass?.destroy()
  guideGlass = new Glass(canvas)
  guideGlass.set('day', 'speak')
  p.querySelector('.mat-tabs')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-mat]')
    if (!b) return
    p.querySelectorAll('[data-mat]').forEach((x) => x.toggleAttribute('aria-current', x === b))
    const k = b.dataset.mat!
    guideGlass!.set(k === 'night' || k === 'danger' ? 'night' : 'day', k === 'night' ? 'speak' : k)
  })
  const play = () => {
    const rays = p.querySelector('.demo-rays')!, card = p.querySelector('.demo-card')!, fig = p.querySelector('.demo-fig')!
    if (reduced()) {
      card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, fill: 'both' })
      return
    }
    rays.animate([{ opacity: 0, transform: 'scale(.7)' }, { opacity: 0.95, transform: 'scale(1)', offset: 0.3 }, { opacity: 0, transform: 'scale(1.25)' }], { duration: 520, easing: EASE_OUT, fill: 'both' })
    springIn(card, 'translateY(40px)', 150, spring(300, 22))
    const f = spring(420, 18)
    fig.animate([{ transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: f.duration, delay: 200, easing: f.easing, fill: 'both' })
  }
  p.querySelector('.play')!.addEventListener('click', play)
  queueMicrotask(() => stagger(p, '.h1, .sub, .rules > div, .swatches > div, .poses figure', 30))
  return p
}
