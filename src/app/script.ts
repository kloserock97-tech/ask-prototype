// What ась says and shows. Facts as of 27 October 2026 (Bank of Russia
// decision of 23 Oct; next meeting 18 Dec).
//
// The screen never repeats the whole spoken answer. Every reply has three layers:
//   title — what this answer is about (top of the screen),
//   head  — the one thing to catch in a glance: a number, or a phrase of ≤ ~24 characters,
//   sub   — one short line of context.
// The full sentence is spoken; while it plays it runs as captions in place of `sub`.

export type Reply = {
  title: string
  head: string
  sub: string
  say: string // spoken (the recording's script, and the fallback text)
  audio: string // public/voice/<audio>.mp3
  pose: 'speak' | 'unsure' | 'idle' | 'pause' | 'listen'
  thinking?: string[] // steps shown while «думаю», only next to a fact
  chips?: { label: string; intent: string }[]
}

export const DATA_AS_OF = '27 октября 2026'

export const REPLY: Record<string, Reply> = {
  rate: {
    title: 'Ключевая ставка ЦБ',
    head: '14%',
    sub: 'до 18 декабря — следующего решения',
    audio: 'rate',
    thinking: ['листаю пресс‑релизы ЦБ', 'сверяю с решением 23 октября', 'собираю ответ'],
    say: 'Ставка — четырнадцать процентов, ЦБ оставил её двадцать третьего октября. Следующее решение — восемнадцатого декабря, до него не изменится. Рассказать про декабрь?',
    pose: 'speak',
    chips: [{ label: 'подробнее', intent: 'more' }, { label: 'сохранить', intent: 'save' }],
  },
  more: {
    title: 'Прогноз на 18 декабря',
    head: '13,75%',
    sub: '60% банков ждут снижения',
    audio: 'more',
    thinking: ['сверяю прогнозы банков', 'считаю, кто за снижение', 'собираю ответ'],
    say: 'Про декабрь мнения расходятся: ВТБ ставит шестьдесят на сорок за снижение до тринадцати и семидесяти пяти, часть аналитиков ждёт паузы. Это сводка, не совет. Сохранить в поездку?',
    pose: 'unsure',
    chips: [{ label: 'сохранить', intent: 'save' }, { label: 'повторить', intent: 'repeat' }],
  },
  save: {
    title: 'Сохранено в поездку',
    head: 'Готово',
    sub: 'покажу, когда остановитесь',
    audio: 'save',
    say: 'Сохранил. Покажу, когда остановитесь.',
    pose: 'speak',
    chips: [{ label: 'ещё вопрос', intent: 'listen' }],
  },
  advice: {
    title: 'Вклады',
    head: 'Без советов',
    sub: 'на стоянке покажу, как меняются ставки',
    audio: 'advice',
    say: 'Советовать не возьмусь. Сохраню вопрос и на стоянке покажу, как ставки по вкладам обычно меняются после решений ЦБ.',
    pose: 'unsure',
    chips: [{ label: 'про ставку', intent: 'rate' }],
  },
  clarify: {
    title: 'Не расслышал',
    head: 'Ставка или вклады?',
    sub: 'скажите или выберите внизу',
    audio: 'clarify',
    say: 'Не расслышал. Вы про ставку ЦБ или про вклады?',
    pose: 'unsure',
    chips: [{ label: 'ставку ЦБ', intent: 'rate' }, { label: 'вклады', intent: 'advice' }],
  },
  thanks: {
    title: 'Ась на связи',
    head: 'Пожалуйста',
    sub: 'позовите, если что',
    audio: 'thanks',
    say: 'Пожалуйста. Позовите, если что.',
    pose: 'idle',
  },
}

/** road situations the driver can't control — ась has to behave */
export const ROAD = {
  navigator: { title: 'Навигатор говорит', head: 'Пауза', sub: 'продолжу с начала фразы', say: '' },
  toll: { title: 'Пункт оплаты · 681 км', head: 'Пауза', sub: 'договорю после шлагбаума', say: '' },
  offline: { title: 'Нет сети', head: 'В очереди', sub: 'доскажу, когда появится связь', say: 'Связь пропала. Доскажу, когда появится.' },
  call: { title: 'Входящий вызов', head: 'Молчу', sub: 'пока вы говорите', say: '' },
} as const
export type Road = keyof typeof ROAD

export const DEMO_QUESTIONS = ['какая ставка ЦБ на месяц?', 'а что в декабре?', 'сохрани']

/** every recording the app may play */
export const AUDIO_IDS = ['rate', 'rate-short', 'more', 'save', 'advice', 'clarify', 'thanks', 'offline']
