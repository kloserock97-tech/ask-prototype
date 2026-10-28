// What ась says and shows. Facts as of 27 October 2026 (Bank of Russia
// decision of 23 Oct; next meeting 18 Dec).

export type Card =
  | { kind: 'rate' }
  | { kind: 'forecast' }
  | { kind: 'saved' }
  | { kind: 'advice' }
  | { kind: 'clarify' }
  | { kind: 'text'; label: string; title: string }

export type Reply = {
  say: string // spoken (the recording's script, and the fallback text)
  audio: string // public/voice/<audio>.mp3
  card: Card
  pose: 'speak' | 'unsure' | 'idle' | 'pause' | 'listen'
  thinking?: string // the joke line while «думаю», only next to a fact
  chips?: { label: string; intent: string }[]
}

export const DATA_AS_OF = '27 октября 2026'

export const REPLY: Record<string, Reply> = {
  rate: {
    audio: 'rate',
    thinking: 'листаю пресс‑релизы ЦБ',
    say: 'Ставка — четырнадцать процентов, ЦБ оставил её двадцать третьего октября. Следующее решение — восемнадцатого декабря, до него не изменится. Рассказать про декабрь?',
    card: { kind: 'rate' },
    pose: 'speak',
    chips: [{ label: 'подробнее', intent: 'more' }, { label: 'сохранить', intent: 'save' }],
  },
  more: {
    audio: 'more',
    thinking: 'сверяю прогнозы банков',
    say: 'Про декабрь мнения расходятся: ВТБ ставит шестьдесят на сорок за снижение до тринадцати и семидесяти пяти, часть аналитиков ждёт паузы. Это сводка, не совет. Сохранить в поездку?',
    card: { kind: 'forecast' },
    pose: 'unsure',
    chips: [{ label: 'сохранить', intent: 'save' }, { label: 'повторить', intent: 'repeat' }],
  },
  save: {
    audio: 'save',
    say: 'Сохранил. Покажу, когда остановитесь.',
    card: { kind: 'saved' },
    pose: 'speak',
    chips: [{ label: 'ещё вопрос', intent: 'listen' }],
  },
  advice: {
    audio: 'advice',
    say: 'Советовать не возьмусь. Сохраню вопрос и на стоянке покажу, как ставки по вкладам обычно меняются после решений ЦБ.',
    card: { kind: 'advice' },
    pose: 'unsure',
    chips: [{ label: 'про ставку', intent: 'rate' }],
  },
  clarify: {
    audio: 'clarify',
    say: 'Не расслышал. Вы про ставку ЦБ или про вклады?',
    card: { kind: 'clarify' },
    pose: 'unsure',
    chips: [{ label: 'ставку ЦБ', intent: 'rate' }, { label: 'вклады', intent: 'advice' }],
  },
  thanks: {
    audio: 'thanks',
    say: 'Пожалуйста. Позовите, если что.',
    card: { kind: 'text', label: 'на связи', title: 'коснитесь, чтобы спросить' },
    pose: 'idle',
  },
}

/** road situations the driver can't control — ась has to behave */
export const ROAD = {
  navigator: { chip: 'пауза', label: 'навигатор говорит', title: 'продолжу с начала фразы', say: '' },
  toll: { chip: 'пауза', label: 'пункт оплаты · 681 км', title: 'договорю после шлагбаума', say: '' },
  offline: { chip: 'нет сети', label: 'вопрос в очереди', title: 'доскажу, когда появится связь', say: 'Связь пропала. Доскажу, когда появится.' },
  call: { chip: 'звонок', label: 'входящий вызов', title: 'молчу, пока вы говорите', say: '' },
} as const
export type Road = keyof typeof ROAD

export const DEMO_QUESTIONS = ['какая ставка ЦБ на месяц?', 'а что в декабре?', 'сохрани']
