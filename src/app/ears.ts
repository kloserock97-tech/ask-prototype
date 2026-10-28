// The app's ears: speech recognition for the words, Web Audio for loudness.
// Both are optional — without them the app falls back to tap mode.

type Rec = {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: any) => void) | null
  onend: (() => void) | null
  onerror: ((e: any) => void) | null
}

const Ctor: (new () => Rec) | undefined = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition

export const canHear = !!Ctor

export type HearHandlers = {
  onPartial: (text: string) => void
  onFinal: (text: string) => void
  onSilence: () => void
  onError: (kind: 'denied' | 'no-speech' | 'network' | 'other') => void
}

let rec: Rec | null = null
let gotFinal = false

/** listen for one phrase; the browser decides when the phrase has ended */
export function listen(h: HearHandlers) {
  if (!Ctor) return h.onError('other')
  stopListening()
  gotFinal = false
  rec = new Ctor()
  rec.lang = 'ru-RU'
  rec.interimResults = true
  rec.continuous = false
  rec.maxAlternatives = 1
  rec.onresult = (e: any) => {
    let text = ''
    let final = false
    for (let i = e.resultIndex; i < e.results.length; i++) {
      text += e.results[i][0].transcript
      if (e.results[i].isFinal) final = true
    }
    if (final) {
      gotFinal = true
      h.onFinal(text.trim())
    } else h.onPartial(text.trim())
  }
  rec.onerror = (e: any) => {
    const k = e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'denied' : e.error === 'no-speech' ? 'no-speech' : e.error === 'network' ? 'network' : 'other'
    h.onError(k)
  }
  rec.onend = () => {
    if (!gotFinal) h.onSilence()
    rec = null
  }
  try {
    rec.start()
  } catch {
    h.onError('other')
  }
}

export function stopListening() {
  try {
    rec?.abort()
  } catch {
    /* already stopped */
  }
  rec = null
}

// ---------------------------------------------------------------- loudness
let ctx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let stream: MediaStream | null = null
const buf = new Float32Array(1024)
let floor = 0.01 // the car's own noise, learned on the fly

/** opens the mic for a level meter; harmless if it fails */
export async function openMeter(): Promise<boolean> {
  if (analyser) return true
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } })
    ctx = new AudioContext()
    const src = ctx.createMediaStreamSource(stream)
    // keep the voice band, drop the road rumble and the hiss
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 150
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 4000
    analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    src.connect(hp).connect(lp).connect(analyser)
    return true
  } catch {
    return false
  }
}

/** 0..1 loudness of the driver's voice right now */
export function level(): number {
  if (!analyser) return 0
  analyser.getFloatTimeDomainData(buf)
  let s = 0
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]
  const rms = Math.sqrt(s / buf.length)
  // the floor drops quickly and rises slowly, so it follows the cabin, not the voice
  floor = rms < floor ? floor + (rms - floor) * 0.2 : floor + (rms - floor) * 0.002
  return Math.min(1, Math.max(0, (rms - floor * 1.6) * 10))
}

export function closeMeter() {
  stream?.getTracks().forEach((t) => t.stop())
  ctx?.close()
  ctx = null
  analyser = null
  stream = null
}
