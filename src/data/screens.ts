// Every screen of the voice mode, described as data. The player renders these,
// the flow map and the guide read the same list — one source of truth.

export type Pose = 'idle' | 'listen' | 'think' | 'speak' | 'unsure' | 'pause'
export type Glow = 'idle' | 'listen' | 'think' | 'speak' | 'unsure' | 'pause' | 'off' | 'danger'
export type Prop = 'doc' | 'rumor' | 'bookmark' | 'mug' | 'antenna' | 'barrier'
export type Dot = 'sig' | 'muted' | 'danger'

export type Block =
  | { t: 'label'; text: string }
  | { t: 'status'; text: string }
  | { t: 'line'; text: string }
  | { t: 'figure'; text: string; img?: string; size?: 'xl' | 'l' | 'm'; accent?: boolean }
  | { t: 'note'; text: string }
  | { t: 'src'; text: string; quiet?: boolean }
  | { t: 'scale'; active: number }
  | { t: 'dots'; active: number; total: number }
  | { t: 'split' }
  | { t: 'gap'; h: number }

export type Control = {
  kind: 'primary' | 'glass' | 'stop' | 'close' | 'mic' | 'danger'
  label?: string
  go?: string // screen id, or 'next' | 'prev' | 'home'
  grow?: boolean
}

export type Screen = {
  id: string
  title: string
  mode: 'day' | 'night'
  pose: Pose | null
  glow: Glow
  chip: { label: string; dot: Dot }
  content: Block[]
  controls: Control[]
  vertical?: boolean
  voice: string
  note: string
  prop?: Prop
  event?: boolean // answer arrives as an event: ray burst + spring
  hero?: 'sos'
  kind?: 'voice' | 'park'
}

export type Scenario = { id: string; title: string; sub: string; screens: string[] }

const S: Screen[] = [
  // ---------------- scenario 1 · key rate, day
  {
    id: 'A1', title: 'вход в режим', mode: 'day', pose: 'idle', glow: 'idle',
    chip: { label: 'за рулём', dot: 'sig' },
    content: [{ t: 'line', text: 'вижу Bluetooth машины' }, { t: 'status', text: 'перехожу на голос' }],
    controls: [{ kind: 'primary', label: 'голосом', go: 'next', grow: true }, { kind: 'glass', label: 'пассажир', go: 'home' }],
    voice: '«Вы за рулём — перехожу на голос. Позовите «ась», когда понадоблюсь».',
    note: 'Режим включается сам: Bluetooth машины + скорость по GPS. Кнопка «голосом» срабатывает сама через 3 с. Пассажир выходит в обычный чат одним касанием.',
  },
  {
    id: 'A2', title: 'жду', mode: 'day', pose: 'idle', glow: 'idle',
    chip: { label: 'жду', dot: 'sig' },
    content: [{ t: 'line', text: 'позовите' }, { t: 'figure', text: '«ась?»', accent: true, size: 'l' }],
    controls: [{ kind: 'mic', label: 'говорить', go: 'next', grow: true }, { kind: 'close', go: 'home' }],
    voice: 'Тишина. Ась ждёт имени или касания в любом месте экрана.',
    note: 'Свечение за стеклом почти погашено: экран не тянет взгляд, пока им не пользуются.',
  },
  {
    id: 'A3', title: 'слушаю', mode: 'day', pose: 'listen', glow: 'listen',
    chip: { label: 'слушаю', dot: 'sig' },
    content: [{ t: 'status', text: 'какая ставка ЦБ на месяц?' }, { t: 'note', text: 'говорите — жду паузу' }],
    controls: [{ kind: 'glass', label: 'отмена', go: 'A2', grow: true }, { kind: 'stop', go: 'next' }],
    voice: 'Короткий щелчок, когда фраза закончилась. Пауза водителя до 2 с не обрывает вопрос.',
    note: 'Живые субтитры: если ась расслышал не то, это видно сразу. Свечение растёт вместе с громкостью голоса.',
  },
  {
    id: 'A4', title: 'думаю', mode: 'day', pose: 'think', glow: 'think',
    chip: { label: 'думаю', dot: 'sig' },
    content: [{ t: 'line', text: 'листаю пресс‑релизы ЦБ' }, { t: 'status', text: 'ставка ЦБ' }],
    controls: [{ kind: 'glass', label: 'отмена', go: 'A2', grow: true }, { kind: 'stop', go: 'next' }],
    voice: '«Секунду, листаю пресс‑релизы ЦБ».',
    note: 'Шутка живёт только в «думаю» и только рядом с фактом. На паузах, ошибках и в SOS юмора нет. Персонаж светится изнутри — ась занят делом.',
  },
  {
    id: 'A5', title: 'вывод', mode: 'day', pose: 'speak', glow: 'speak', event: true,
    chip: { label: 'говорю', dot: 'sig' },
    content: [
      { t: 'line', text: 'ставка ЦБ' },
      { t: 'figure', text: '14%', img: 'fig-14', size: 'xl' },
      { t: 'line', text: 'до 18 декабря' },
      { t: 'gap', h: 14 },
      { t: 'src', text: 'ЦБ · 23 окт' },
    ],
    controls: [{ kind: 'primary', label: 'подробнее', go: 'next', grow: true }, { kind: 'stop', go: 'A2' }],
    voice: '«Ставка — 14 процентов, ЦБ оставил её 23 октября. Следующее решение — 18 декабря, до него не изменится. Рассказать про декабрь?»',
    note: 'Сначала вывод на один вдох, около 10 с. На экране 30 знаков. Источник — пилюлей, как ценник в Дринките.',
  },
  {
    id: 'A6', title: 'подробнее', mode: 'day', pose: 'unsure', glow: 'unsure',
    chip: { label: 'прогноз', dot: 'sig' },
    content: [{ t: 'line', text: '18 декабря' }, { t: 'split' }, { t: 'gap', h: 12 }, { t: 'src', text: '3 банка · 24 окт' }],
    controls: [{ kind: 'primary', label: 'сохранить', go: 'next', grow: true }, { kind: 'stop', go: 'A2' }],
    voice: '«Про декабрь мнения расходятся: ВТБ ставит 60 на 40 за снижение до 13,75, часть аналитиков ждёт паузы. Это сводка, не совет. Сохранить в поездку?»',
    note: 'Прогноз — вилкой, а не одной цифрой. Персонаж в позе «не уверен»: эмоция говорит то же, что голос.',
  },
  {
    id: 'A7', title: 'сохранил', mode: 'day', pose: 'speak', glow: 'idle', prop: 'bookmark',
    chip: { label: 'сохранил', dot: 'sig' },
    content: [{ t: 'line', text: 'покажу на стоянке' }, { t: 'figure', text: 'в поездку', size: 'm' }, { t: 'gap', h: 14 }, { t: 'src', text: 'ставка · 2 источника' }],
    controls: [{ kind: 'mic', label: 'ещё вопрос', go: 'A3', grow: true }, { kind: 'close', go: 'C9' }],
    voice: '«Сохранил. Покажу, когда остановитесь».',
    note: 'Ссылки, графики и источники ждут в сводке поездки. Голосом за рулём их не зачитываем.',
  },

  // ---------------- scenario 2 · Half-Life 3, night
  {
    id: 'B1', title: 'слушаю', mode: 'night', pose: 'listen', glow: 'listen',
    chip: { label: 'слушаю', dot: 'sig' },
    content: [{ t: 'status', text: 'что слышно про третью Half‑Life?' }, { t: 'note', text: 'говорите — жду паузу' }],
    controls: [{ kind: 'glass', label: 'отмена', go: 'home', grow: true }, { kind: 'stop', go: 'next' }],
    voice: 'Щелчок «услышал».',
    note: 'Разговорное «третья халфа» распознаётся как Half‑Life 3: субтитры показывают нормализованное название.',
  },
  {
    id: 'B2', title: 'думаю', mode: 'night', pose: 'think', glow: 'think',
    chip: { label: 'думаю', dot: 'sig' },
    content: [{ t: 'line', text: 'трясу инсайдеров Valve' }, { t: 'status', text: 'Half‑Life 3' }],
    controls: [{ kind: 'glass', label: 'отмена', go: 'B1', grow: true }, { kind: 'stop', go: 'next' }],
    voice: '«Секунду, трясу инсайдеров».',
    note: 'Ночью свечение глубже и темнее: экран не слепит и не отражается в стекле машины.',
  },
  {
    id: 'B3', title: 'вывод: слух', mode: 'night', pose: 'unsure', glow: 'speak', event: true,
    chip: { label: 'слух', dot: 'sig' },
    content: [
      { t: 'line', text: 'Half‑Life 3' },
      { t: 'figure', text: 'слух', img: 'fig-sluh', size: 'xl' },
      { t: 'line', text: 'HLX назвали со сцены' },
      { t: 'gap', h: 14 }, { t: 'scale', active: 2 }, { t: 'gap', h: 14 },
      { t: 'src', text: 'Valve · 21 окт' },
    ],
    controls: [{ kind: 'primary', label: 'подробнее', go: 'next', grow: true }, { kind: 'stop', go: 'B1' }],
    voice: '«Официально — ничего: Valve игру не анонсировала. Но на прошлой неделе композитор Valve вслух назвал проект HLX — так фанаты зовут третью часть. Пока это слух. Рассказать, что ещё утекало?»',
    note: 'Главная цифра здесь — степень правды. Шкала: факт · вероятно · слух. Персонаж с разными глазами — «не уверен».',
  },
  {
    id: 'B4', title: 'подробнее, 2 из 3', mode: 'night', pose: 'speak', glow: 'speak',
    chip: { label: '2 из 3', dot: 'sig' },
    content: [{ t: 'line', text: 'ещё утечки' }, { t: 'status', text: 'Steam Machine вышла без новой Half‑Life' }, { t: 'gap', h: 18 }, { t: 'dots', active: 1, total: 3 }],
    controls: [{ kind: 'primary', label: 'дальше', go: 'next', grow: true }, { kind: 'stop', go: 'B1' }],
    voice: '«Второе: летом вышла Steam Machine, и многие ждали анонса вместе с ней. Не случилось. Дальше?»',
    note: 'Список голосом — по одному пункту: «дальше / назад / повтори». На экране — только текущий пункт и где мы в списке.',
  },
  {
    id: 'B5', title: '«а когда выйдет?»', mode: 'night', pose: 'unsure', glow: 'unsure',
    chip: { label: 'не знаю', dot: 'sig' },
    content: [{ t: 'line', text: 'дата выхода' }, { t: 'status', text: 'никто не знает' }, { t: 'gap', h: 14 }, { t: 'scale', active: 2 }, { t: 'gap', h: 14 }, { t: 'src', text: 'Valve молчит' }],
    controls: [{ kind: 'primary', label: 'сохранить', go: 'C9', grow: true }, { kind: 'stop', go: 'B1' }],
    voice: '«Даты нет ни у кого: ни у Valve, ни у инсайдеров. Всё, что гуляет в сети, — догадки. Сохранить подборку на стоянку?»',
    note: 'Честное «не знаю» вместо выдуманной даты. Галлюцинация за рулём хуже молчания: её не перепроверишь.',
  },

  // ---------------- corner cases
  {
    id: 'C1', title: 'навигатор говорит', mode: 'day', pose: 'pause', glow: 'pause',
    chip: { label: 'пауза', dot: 'muted' },
    content: [{ t: 'line', text: 'навигатор говорит' }, { t: 'status', text: 'продолжу с «…до 18 декабря»' }],
    controls: [{ kind: 'glass', label: 'продолжить', go: 'A5', grow: true }, { kind: 'stop', go: 'A2' }],
    voice: 'Ась замолкает на полуслове. После подсказки — «…итак, до 18 декабря ставка не изменится».',
    note: 'Навигатор главнее. Продолжаем с начала фразы, а не с оборванного слова.',
  },
  {
    id: 'C2', title: 'шлагбаум и манёвры', mode: 'day', pose: 'pause', glow: 'pause', prop: 'barrier',
    chip: { label: 'пауза', dot: 'muted' },
    content: [{ t: 'line', text: 'пункт оплаты · 681 км' }, { t: 'status', text: 'договорю после шлагбаума' }],
    controls: [{ kind: 'glass', label: 'продолжить', go: 'A5', grow: true }, { kind: 'stop', go: 'A2' }],
    voice: 'Тишина за 300 м до пункта оплаты, на развязках и при резком торможении. Потом: «Так, продолжаю про ставку».',
    note: 'Ась видит дорогу: геозоны пунктов оплаты на М‑11, акселерометр и подсказки навигатора. Как пассажир, который замолкает на обгоне.',
  },
  {
    id: 'C3', title: 'нет сети', mode: 'night', pose: 'pause', glow: 'off', prop: 'antenna',
    chip: { label: 'нет сети', dot: 'danger' },
    content: [{ t: 'line', text: 'вопрос в очереди' }, { t: 'status', text: 'доскажу, когда появится связь' }, { t: 'gap', h: 14 }, { t: 'src', text: '1 вопрос ждёт', quiet: true }],
    controls: [{ kind: 'glass', label: 'отменить', go: 'A2', grow: true }, { kind: 'close', go: 'home' }],
    voice: '«Связь пропала. Доскажу, когда появится». Начатый ответ досказывается из того, что уже загружено.',
    note: 'На стыке Тверской и Новгородской областей LTE проваливается. Свечение гаснет: экран честно показывает, что ась сейчас без интернета.',
  },
  {
    id: 'C4', title: 'интернет ограничен', mode: 'night', pose: 'unsure', glow: 'off',
    chip: { label: 'белый список', dot: 'danger' },
    content: [{ t: 'line', text: 'свежих новостей не найду' }, { t: 'status', text: 'ответить по памяти до 20 окт?' }],
    controls: [{ kind: 'primary', label: 'по памяти', go: 'B3', grow: true }, { kind: 'glass', label: 'подождать', go: 'C3', grow: true }],
    voice: '«В регионе ограничен мобильный интернет. Могу ответить по тому, что знаю до 20 октября, или подождать связи».',
    note: 'В 2026 году отключения шли в 40+ регионах. Старые данные — только с честной датой, никогда не как свежие.',
  },
  {
    id: 'C5', title: 'не расслышал', mode: 'day', pose: 'unsure', glow: 'unsure',
    chip: { label: 'не расслышал', dot: 'muted' },
    content: [{ t: 'line', text: 'шумно. вы про…' }, { t: 'status', text: '«ставка…»' }],
    controls: [{ kind: 'primary', label: 'ставку ЦБ', go: 'A4' }, { kind: 'glass', label: 'ставки по вкладам', go: 'A4' }],
    vertical: true,
    voice: '«Шумно — вы про ставку ЦБ или про вклады?» Не больше одного переспроса, дальше — выбор из двух.',
    note: 'Ошибка распознавания поднимает нагрузку на водителя (AAA: 2,83 → 3,67). Поэтому — две большие кнопки вместо «повторите ещё раз».',
  },
  {
    id: 'C6', title: 'после звонка', mode: 'day', pose: 'listen', glow: 'idle',
    chip: { label: 'звонок закончен', dot: 'muted' },
    content: [{ t: 'line', text: 'мы говорили про ставку' }, { t: 'figure', text: 'продолжить?', size: 'm' }],
    controls: [{ kind: 'primary', label: 'продолжить', go: 'A5', grow: true }, { kind: 'close', go: 'A2' }],
    voice: 'Во время звонка ась молчит. После: «Продолжить про ставку?» — один раз, без настойчивости.',
    note: 'Звонок и навигатор всегда важнее ассистента. Контекст разговора не теряется.',
  },
  {
    id: 'C7', title: 'пора отдохнуть', mode: 'night', pose: 'idle', glow: 'idle', prop: 'mug',
    chip: { label: '2 ч 30 мин в пути', dot: 'sig' },
    content: [{ t: 'line', text: 'площадка отдыха через' }, { t: 'figure', text: '6 км', img: 'fig-6km', size: 'xl' }],
    controls: [{ kind: 'primary', label: 'заедем', go: 'A2', grow: true }, { kind: 'glass', label: 'позже', go: 'A2', grow: true }],
    voice: '«Вы в пути два с половиной часа. Через 6 км площадка — заедем?» Ночью ась не развлекает, а предлагает остановку.',
    note: 'Сонливость есть почти в каждой десятой аварии (AAA, 2018). Площадки на М‑11 примерно каждые 20 км.',
  },
  {
    id: 'C8', title: 'SOS', mode: 'night', pose: null, glow: 'danger', hero: 'sos',
    chip: { label: 'экстренный вызов', dot: 'danger' },
    content: [{ t: 'line', text: 'звоню, если не отмените' }, { t: 'figure', text: '112', size: 'xl' }, { t: 'note', text: 'кнопка SOS — на потолке' }],
    controls: [{ kind: 'glass', label: 'отмена', go: 'A2' }],
    vertical: true,
    voice: '«Мне плохо» → «Звоню в 112 через пять секунд. Скажите «отмена», если не нужно». Работает без интернета.',
    note: 'Персонажа нет: в экстренной ситуации милота неуместна. Горячий оранжевый появляется только здесь и на «стоп».',
  },
  {
    id: 'C9', title: 'стоянка: сводка поездки', mode: 'day', pose: 'speak', glow: 'idle', kind: 'park',
    chip: { label: 'стоянка', dot: 'sig' },
    content: [], controls: [],
    voice: '«Вы остановились. Сводка поездки на экране — тут всё, что я обещал показать».',
    note: 'Режим «за рулём» выключается сам, когда скорость ноль дольше минуты. Здесь можно читать: обычные кегли, ссылки, график. Подача — как меню Дринкита.',
  },
]

export const SCREENS: Record<string, Screen> = Object.fromEntries(S.map((s) => [s.id, s]))

export const SCENARIOS: Scenario[] = [
  { id: 'rate', title: 'ставка ЦБ', sub: 'день · прогноз на месяц', screens: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'] },
  { id: 'hl3', title: 'Half‑Life 3', sub: 'ночь · слухи', screens: ['B1', 'B2', 'B3', 'B4', 'B5'] },
  { id: 'edge', title: 'корнер‑кейсы', sub: 'пауза · сеть · SOS · стоянка', screens: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9'] },
]

export function scenarioOf(id: string): Scenario {
  return SCENARIOS.find((s) => s.screens.includes(id)) ?? SCENARIOS[0]
}
