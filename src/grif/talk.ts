// What GRIF says on the road. Facts as of 28 October 2026:
//   Bank of Russia kept the key rate at 14% on 23 Oct (second hold in a row);
//   its own outlook for 2027 is 12.5–13.5%; next meeting 18 Dec (one source — check cbr.ru).
//   Half-Life 3: on 23 Oct a Valve developer said «HLX» at GameSoundCon; Valve announced nothing.
//
// An answer is a chain of chunks, 10–15 s each, every chunk ends with one yes-question.
// The screen shows one anchor (a number or a label) and the sentence that is playing.

export type Tag = { text: string; kind: 'fact' | 'forecast' | 'rumor' | 'info' }

export type Chunk = {
  id: string // public/voice/<id>.mp3
  tag?: Tag
  big?: string // the anchor: a number, ≤ 10 characters
  cap?: string // one line under the anchor
  text: string // on screen, ≤ 3 lines
  say: string // spoken; written for the ear
  fork?: 'next' | 'save' // what «да» means after this chunk
}

export type Topic = 'rate' | 'hl3'

export const TOPIC_TITLE: Record<Topic, string> = { rate: 'Ставка ЦБ — что дальше', hl3: 'Half-Life 3: слух про HLX' }

export const CHAIN: Record<Topic, Chunk[]> = {
  rate: [
    {
      id: 'g-rate-1',
      tag: { text: 'ФАКТ · РЕШЕНИЕ ЦБ 23.10', kind: 'fact' },
      big: '14%',
      cap: 'ключевая ставка · решение ЦБ 23 октября',
      text: 'До 18 декабря заседаний нет — в ближайший месяц ставка, скорее всего, не изменится.',
      say: 'Двадцать третьего октября Цэ Бэ оставил ставку — четырнадцать процентов. Следующее заседание — восемнадцатого декабря, так что в ближайший месяц она, скорее всего, не изменится. Рассказать, от чего это зависит?',
      fork: 'next',
    },
    {
      id: 'g-rate-2',
      tag: { text: 'ФАКТ · ПРЕСС-РЕЛИЗ ЦБ', kind: 'fact' },
      text: 'Цены всё ещё растут быстрее цели в 4%, а люди ждут дальнейшего роста. Поэтому ЦБ не спешит снижать.',
      say: 'Потому что цены всё ещё растут быстрее цели в четыре процента, а люди ждут, что они продолжат расти. Поэтому Цэ Бэ не спешит снижать. Рассказать, что сам Цэ Бэ обещает дальше?',
      fork: 'next',
    },
    {
      id: 'g-rate-3',
      tag: { text: 'ПРОГНОЗ ЦБ · НЕ РЕШЕНИЕ', kind: 'forecast' },
      big: '12,5–13,5%',
      cap: 'средняя ставка в 2027 году — прогноз ЦБ',
      text: 'Снижать будут медленно. Это прогноз регулятора, а не решение.',
      say: 'Сам Цэ Бэ обещает снижать медленно: в двадцать седьмом году в среднем от двенадцати с половиной до тринадцати с половиной процентов. Это его прогноз, а не решение. Сохранить, чтобы почитать на остановке?',
      fork: 'save',
    },
  ],
  hl3: [
    {
      id: 'g-hl-1',
      tag: { text: 'СЛУХ · VALVE НЕ ПОДТВЕРЖДАЛА', kind: 'rumor' },
      text: '23 октября разработчик Valve на конференции обронил «HLX» — так инсайдеры зовут новый Half-Life.',
      say: 'О, Халф-Лайф три опять в новостях. Двадцать третьего октября разработчик Вэлв на конференции обронил «эйч-эл-икс» — так инсайдеры называют новый Халф-Лайф. Сама Вэлв ничего не объявляла, так что это слух. Рассказать, откуда он?',
      fork: 'next',
    },
    {
      id: 'g-hl-2',
      tag: { text: 'СЛУХ · СЛОВА ИНСАЙДЕРА', kind: 'rumor' },
      text: 'Оговорка настоящая, но это не анонс. Про перенос сроков говорит инсайдер — Valve молчит.',
      say: 'Оговорку слышали все в зале — это настоящее событие, но не анонс. А инсайдер Тайлер Маквикер говорит, что Вэлв опять сдвинула сроки, — это только его слова. Про анонс на Гейм Эвордс — пока надежды фанатов. Сохранить ссылки?',
      fork: 'save',
    },
  ],
}

/** one-off replies that are not part of a chain */
export const LINE = {
  rateShort: { id: 'g-rate-short', big: '14%', cap: 'до 18 декабря', text: 'До декабря — 14%, дальше ЦБ обещает снижать медленно.', say: 'Коротко: до декабря — четырнадцать, дальше Цэ Бэ обещает снижать медленно.' },
  rateDigits: {
    id: 'g-rate-digits',
    tag: { text: 'ФАКТ + ПРОГНОЗ ЦБ', kind: 'forecast' },
    big: '14%',
    cap: 'решение 23.10 · следующее 18.12 · 2027: 12,5–13,5%',
    text: 'Сейчас 14%. На 2027 год ЦБ ждёт в среднем 12,5–13,5% — это прогноз.',
    say: 'Сейчас четырнадцать. Решение — двадцать третьего октября, следующее — восемнадцатого декабря. На двадцать седьмой год сам Цэ Бэ ждёт в среднем от двенадцати с половиной до тринадцати с половиной. Это прогноз, не решение.',
  },
  rateCompare: {
    id: 'g-rate-compare',
    tag: { text: 'СЦЕНАРИИ НА 18 ДЕКАБРЯ', kind: 'forecast' },
    text: 'Оставят 14% · снизят медленно · поднимут на 0,25 п. п.',
    say: 'Три варианта на восемнадцатое декабря. Оставят четырнадцать — так в октябре думало большинство аналитиков. Снизят — Цэ Бэ это допускает, но говорит, что медленно. Поднимут на четверть пункта — такое перед октябрём допускала часть аналитиков. Кто прав, станет ясно восемнадцатого.',
  },
  rateSrc: { id: 'g-rate-src', tag: { text: 'ИСТОЧНИКИ', kind: 'info' }, text: 'Банк России, 23 октября · обзоры аналитиков перед заседанием', say: 'Решение — с сайта Банка России, двадцать третьего октября. Ожидания аналитиков — из обзоров перед заседанием. Ссылки положу в чат поездки.' },
  deposits: { id: 'g-deposits', tag: { text: 'НЕ СОВЕТ', kind: 'info' }, text: 'Вклады идут за ставкой с задержкой: пока ставка стоит, проценты скорее держатся.', say: 'Вклады обычно идут за ставкой с задержкой: пока ставка стоит, проценты по ним скорее держатся. Советовать не возьмусь — на остановке покажу подробнее.' },
  hlShort: { id: 'g-hl-short', tag: { text: 'СЛУХ', kind: 'rumor' }, text: 'Valve молчит. Есть оговорка про «HLX» и слова инсайдеров.', say: 'Коротко: Вэлв молчит, есть оговорка про эйч-эл-икс и слова инсайдеров.' },
  hlSrc: { id: 'g-hl-src', tag: { text: 'ИСТОЧНИКИ', kind: 'info' }, text: 'TweakTown, VideoCardz · 23–28 октября', say: 'Пишут игровые сайты — ТвикТаун и ВидеоКардз, с двадцать третьего по двадцать восьмое октября. Ссылки положу в чат поездки.' },
  clarify: { id: 'g-clarify', text: 'Ставку ЦБ или проценты по вкладам?', say: 'Ставку Цэ Бэ или проценты по вкладам?' },
  unknown: { id: 'g-unknown', tag: { text: 'ДЕМО', kind: 'info' }, text: 'В этом демо я знаю про ставку ЦБ и Half-Life 3.', say: 'В этом демо я знаю про ставку Цэ Бэ и Халф-Лайф три. Спросите про них.' },
  saved: { id: 'g-save', text: 'Отметил в чате поездки. Цифры и источники — на остановке.', say: 'Сохранил, покажу на остановке.' },
  offline: { id: 'g-offline', text: 'Связь пропала. Последний ответ повторю, новый вопрос задам, когда сеть вернётся.', say: 'Пропала связь. Как появится — отвечу.' },
  backRate: { id: 'g-back-rate', text: 'Продолжить про ставку?', say: 'Продолжить про ставку?' },
  backHl: { id: 'g-back-hl', text: 'Продолжить про Half-Life?', say: 'Продолжить про Халф-Лайф?' },
  mic: { id: 'g-mic', text: 'Нет доступа к микрофону. Разрешите его на остановке.', say: 'Не слышу вас — включим микрофон на остановке.' },
  hello: { id: 'g-hello', text: '', say: 'Три слова: «ась» — спросить, «стоп» — замолчать, «сохрани» — на потом. Поехали.' },
  wait: { id: 'g-wait', text: '', say: 'Секунду, смотрю свежие данные.' },
  thanks: { id: 'g-thanks', text: 'Пожалуйста. Скажите «ась», если что.', say: 'Пожалуйста. Позовите, если что.' },
  arrived: { id: 'g-arrived', text: '', say: 'Остановка. Всё, что сохранили, — в чате поездки.' },
} satisfies Record<string, Omit<Chunk, 'fork'>>

export type Line = (typeof LINE)[keyof typeof LINE]

export type Intent =
  | 'rate' | 'hl3' | 'ambiguous' | 'deposits'
  | 'yes' | 'no' | 'why' | 'more' | 'short' | 'repeat' | 'digits' | 'compare' | 'sources'
  | 'pause' | 'resume' | 'stop' | 'quiet' | 'save' | 'arrived' | 'thanks' | 'unknown'

const has = (t: string, ...w: string[]) => w.some((x) => t.includes(x))
const word = (t: string, ...w: string[]) => new RegExp(`(^|[\\s,.!?])(${w.join('|')})([\\s,.!?]|$)`).test(t)

/** keyword rules are enough for two topics and work offline */
export function understand(raw: string): Intent {
  const t = raw.toLowerCase().replace(/ё/g, 'е')
  if (has(t, 'помолчи', 'замолчи', 'не сейчас')) return 'quiet'
  if (has(t, 'стоп', 'хватит', 'тихо', 'отмена')) return 'stop'
  if (has(t, 'пауз', 'подожди')) return 'pause'
  if (has(t, 'продолжа', 'дальше давай')) return 'resume'
  if (has(t, 'приехали', 'приехал', 'конец поездки')) return 'arrived'
  if (has(t, 'короче', 'покороче', 'в двух словах', 'коротко')) return 'short'
  if (has(t, 'повтор', 'что-что', 'еще раз', 'не расслыш')) return 'repeat'
  if (has(t, 'сохрани', 'запомни', 'на потом', 'отложи')) return 'save'
  if (has(t, 'сравни', 'сценари', 'варианты')) return 'compare'
  if (has(t, 'откуда', 'источник', 'кто пишет', 'можно верить', 'правда ли')) return 'sources'
  if (has(t, 'цифр', 'конкретн', 'процент и дат', 'проценты и даты', 'какие даты')) return 'digits'
  if (has(t, 'half', 'халф', 'хальф', 'valve', 'вэлв', 'валв', 'гейб', 'hlx')) return 'hl3'
  if (has(t, 'вклад', 'депозит', 'кредит', 'ипотек')) return 'deposits'
  if (has(t, 'ключев', 'цб', 'центробанк', 'центральн', 'банк росси', 'цэ бэ')) return 'rate'
  if (has(t, 'ставк')) return 'ambiguous'
  if (has(t, 'почему', 'зачем', 'от чего')) return 'why'
  if (has(t, 'подробн', 'расскажи', 'дальше', 'а потом')) return 'more'
  if (word(t, 'да', 'давай', 'ага', 'конечно', 'угу', 'расскажи')) return 'yes'
  if (word(t, 'нет', 'не надо', 'не нужно', 'неа')) return 'no'
  if (has(t, 'спасибо', 'понял', 'ясно')) return 'thanks'
  return 'unknown'
}

/** what the driver says in tap-only mode, one per tap: the whole scenario */
export const DEMO = [
  'Как изменится ключевая ставка в ближайший месяц?',
  'Почему?',
  'Да',
  'Сохрани',
  'А что там с Half-Life 3?',
  'Откуда слух?',
  'Сохрани',
  'Приехали',
]

/** every recording the app may play */
export const VOICE_IDS = [...Object.values(CHAIN).flat().map((c) => c.id), ...Object.values(LINE).map((l) => l.id)]

/** the whole answer in the trip chat: labelled parts, as read after the trip */
export const FULL: Record<Topic, { label: string; kind: Tag['kind']; text: string }[]> = {
  rate: [
    { label: 'Факт.', kind: 'fact', text: '23 октября Банк России сохранил ключевую ставку 14% — второй раз подряд. Следующее заседание по графику — 18 декабря (дату сверить с календарём на cbr.ru).' },
    { label: 'Почему.', kind: 'fact', text: 'Регулятор пишет, что ценовое давление остаётся повышенным, а инфляционные ожидания — высокими.' },
    { label: 'Прогноз ЦБ.', kind: 'forecast', text: 'Снижение медленное: в 2027 году в среднем 12,5–13,5%. Это прогноз, а не решение.' },
    { label: 'Аналитики.', kind: 'info', text: 'Перед решением большинство ждали сохранения, часть допускала повышение примерно на 0,25 п. п. Это ожидания, а не факт.' },
  ],
  hl3: [
    { label: 'Факт.', kind: 'fact', text: 'Valve не анонсировала Half-Life 3.' },
    { label: 'Событие.', kind: 'fact', text: '23 октября на панели GameSoundCon разработчик Valve произнёс «HLX» — так называют предполагаемый новый Half-Life.' },
    { label: 'Слух.', kind: 'rumor', text: 'Инсайдер Тайлер Маквикер говорит, что Valve снова сдвинула сроки. Инсайдер Gabe Follower — что проект не отменён. Valve это не комментирует.' },
    { label: 'Спекуляция.', kind: 'rumor', text: 'Анонс на The Game Awards — надежды фанатов, источника нет.' },
  ],
}

export const SOURCES: Record<Topic, { name: string; url: string }[]> = {
  rate: [
    { name: 'cbr.ru', url: 'https://www.cbr.ru/hd_base/keyrate/' },
    { name: 'РИА Новости', url: 'https://ria.ru/20261023/stavka-2126523033.html' },
    { name: 'Mail.ru Финансы', url: 'https://finance.mail.ru/article/bank-rossii-ostavil-klyuchevuyu-stavku-na-otmetke-14-69233890/' },
  ],
  hl3: [
    { name: 'TweakTown', url: 'https://www.tweaktown.com/news/114245/valve-mentions-half-life-3-in-public-as-mysterious-hlx-project-gets-called-out/index.html' },
    { name: 'VideoCardz', url: 'https://videocardz.com/newz/valves-rumored-half-life-3-project-hlx-finally-gets-a-public-mention' },
    { name: 'TheGamer', url: 'https://www.thegamer.com/half-life-3-isnt-cancelled/' },
  ],
}

export const DATA_AS_OF = '28 октября 2026'
