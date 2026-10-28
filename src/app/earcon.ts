// Short interface sounds, synthesised — no files. A driver who isn't looking at the
// screen still knows ась started listening, has an answer, or stopped.

let ctx: AudioContext | null = null

/** must run inside a tap once (browsers unlock audio on a gesture) */
export function unlock() {
  try {
    ctx ??= new AudioContext()
    ctx.resume()
  } catch {
    /* no audio — the screen and haptics still work */
  }
}

function tone(freq: number, at: number, dur: number, gain = 0.07, to = freq) {
  if (!ctx) return
  const t = ctx.currentTime + at
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(freq, t)
  o.frequency.exponentialRampToValueAtTime(to, t + dur)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(ctx.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

/** «слушаю»: a short rising tick */
export const listen = () => tone(620, 0, 0.11, 0.06, 930)
/** «ответ готов»: a soft two-note chime */
export const ready = () => (tone(784, 0, 0.32, 0.05), tone(1175, 0.09, 0.42, 0.04))
/** «стоп»: a short falling tick */
export const stop = () => tone(700, 0, 0.12, 0.05, 420)
