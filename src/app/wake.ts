// The wake word: while ась is idle it waits for «ась» (or «эй, ась»), like
// «Алиса» or «Hey Siri». Built on the browser's own recognizer — it's cloud-based
// there, so this is a prototype of the gesture; a product needs an on-device
// keyword spotter. Only one recognizer may run at a time: the app stops this
// one before asking ears.listen() for the question.

const Ctor: any = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition

export const canWake = !!Ctor

// «ась», how the recognizer tends to spell it, optionally after «эй»
const WORD = /(?:^|[\s,.!?«"])(?:эй[\s,]+)?(ась|азь|ась-ка|асъ)(?=$|[\s,.!?»"])/i

let rec: any = null
let on = false
let restart = 0

/** start waiting; `onWake(rest)` gets whatever followed the word (may be empty) */
export function startWake(onWake: (rest: string) => void, onDenied: () => void) {
  if (!Ctor) return
  on = true
  clearTimeout(restart)
  try {
    rec?.abort()
  } catch {
    /* fine */
  }
  rec = new Ctor()
  rec.lang = 'ru-RU'
  rec.continuous = true
  rec.interimResults = true
  let fired = false
  let lastRest = ''
  let settle = 0
  rec.onresult = (e: any) => {
    if (fired) return
    let text = ''
    let final = false
    for (let i = e.resultIndex; i < e.results.length; i++) {
      text += e.results[i][0].transcript
      if (e.results[i].isFinal) final = true
    }
    const m = text.toLowerCase().replace(/ё/g, 'е').match(WORD)
    if (!m) return
    const rest = text.slice((m.index ?? 0) + m[0].length).replace(/^[\s,.!?]+/, '').trim()
    // wait a moment after the word: «ась, какая ставка?» comes in one breath
    lastRest = rest
    clearTimeout(settle)
    const fire = () => {
      if (fired || !on) return
      fired = true
      stopWake()
      onWake(lastRest)
    }
    if (final) fire()
    else settle = window.setTimeout(fire, rest ? 900 : 700)
  }
  rec.onerror = (e: any) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      on = false
      onDenied()
    }
  }
  // browsers end continuous recognition after a silence — start again while on
  rec.onend = () => {
    if (on && !fired) restart = window.setTimeout(() => on && startWake(onWake, onDenied), 250)
  }
  try {
    rec.start()
  } catch {
    /* a start right after an abort can throw — onend will retry */
  }
}

export function stopWake() {
  on = false
  clearTimeout(restart)
  try {
    rec?.abort()
  } catch {
    /* already stopped */
  }
  rec = null
}
