// Understands what the driver said — only for this one scenario, so plain
// keyword rules are enough and work offline.

export type Intent =
  | 'rate' // какая ставка, прогноз на месяц
  | 'more' // подробнее, а в декабре
  | 'save' // сохрани, запомни
  | 'repeat' // повтори, что-что
  | 'stop' // стоп, хватит, помолчи
  | 'advice' // вклад, кредит, что делать с деньгами
  | 'thanks'
  | 'unknown'

const has = (t: string, ...words: string[]) => words.some((w) => t.includes(w))

export function understand(raw: string): Intent {
  const t = raw.toLowerCase().replace(/ё/g, 'е')
  if (has(t, 'стоп', 'хватит', 'помолчи', 'замолчи', 'тихо', 'отмена')) return 'stop'
  if (has(t, 'повтор', 'что-что', 'не расслыш', 'еще раз', 'ещё раз')) return 'repeat'
  if (has(t, 'сохрани', 'запомни', 'отложи', 'на потом', 'на стоянк')) return 'save'
  if (has(t, 'вклад', 'кредит', 'ипотек', 'вложит', 'купить', 'что делать с деньг')) return 'advice'
  if (has(t, 'подробн', 'декабр', 'дальше', 'расскажи', 'а потом', 'прогноз аналитик', 'что думают')) return 'more'
  if (has(t, 'ставк', 'цб', 'центробанк', 'центральн', 'банк росси', 'ключев')) return 'rate'
  // short words match whole words only: «да» must not fire on «когда»
  if (/(^|[\s,.!?])(да|давай|ага|конечно|угу)([\s,.!?]|$)/.test(t)) return 'more'
  if (has(t, 'спасибо', 'понял', 'ясно')) return 'thanks'
  return 'unknown'
}
