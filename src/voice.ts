// ась's voice. Replies are pre-recorded files (public/voice/<id>.mp3) — a demo
// shouldn't sound like a screen reader. While a file plays, its loudness drives
// the dots and its position drives the progress line. If a file is missing,
// the browser's own speech synthesis reads the quoted part of the line instead.

let voiceRu: SpeechSynthesisVoice | null = null
let enabled = false

function pickVoice() {
  const vs = speechSynthesis.getVoices()
  voiceRu =
    vs.find((v) => v.lang === 'ru-RU' && /Milena|Katya|Irina|Google/.test(v.name)) ??
    vs.find((v) => v.lang?.startsWith('ru')) ??
    null
}

export const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
if (supported) {
  pickVoice()
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice)
}

// one audio element and one analyser for every recorded line
const audio = typeof Audio !== 'undefined' ? new Audio() : null
let ctx: AudioContext | null = null
let analyser: AnalyserNode | null = null
const buf = new Float32Array(1024)
const missing = new Set<string>()

/** which recorded voice plays: the main one, a second Piper voice (Ась lines only), or the browser */
export type VoiceName = 'dmitri' | 'denis' | 'system'
let voiceName: VoiceName = 'dmitri'
let rate = 1
export function setVoice(v: VoiceName) {
  voiceName = v
}
export function getVoice() {
  return voiceName
}
/** speaking rate, 0.8–1.3; recordings keep their pitch */
export function setRate(r: number) {
  rate = Math.max(0.7, Math.min(1.4, r))
}
export function getRate() {
  return rate
}
let volume = 1
export function setVolume(x: number) {
  volume = Math.max(0, Math.min(1, x))
  if (audio) audio.volume = volume
}
const present = new Set<string>()

/** find out up front which recordings exist — a fallback started after a failed load
 * runs outside the tap, and iOS keeps it silent. One list, written by scripts/make-voice.sh */
export function prepare(ids: string[]) {
  fetch('./voice/index.json')
    .then((r) => (r.ok ? r.json() : []))
    .then((list: string[]) => ids.forEach((id) => (list.includes(id) ? present.add(id) : missing.add(id))))
    .catch(() => ids.forEach((id) => missing.add(id)))
}

export function isOn() {
  return enabled
}

/** must be called from a user gesture at least once (iOS unlocks audio this way) */
export function setOn(on: boolean) {
  enabled = on
  if (on) {
    if (supported) {
      const u = new SpeechSynthesisUtterance(' ')
      u.volume = 0
      speechSynthesis.speak(u)
    }
    if (audio && !ctx) {
      try {
        ctx = new AudioContext()
        const src = ctx.createMediaElementSource(audio)
        analyser = ctx.createAnalyser()
        analyser.fftSize = 2048
        src.connect(analyser).connect(ctx.destination)
      } catch {
        /* no Web Audio — the file still plays, the dots just pulse on a timer */
      }
    }
    ctx?.resume()
    // a silent play inside the gesture unlocks the element for later
    if (audio && audio.paused) {
      audio.muted = true
      audio.src = './voice/silence.mp3'
      audio.play().catch(() => {}).finally(() => (audio.muted = false))
    }
  } else stop()
}

/** text spoken aloud by the fallback: the «quoted» parts, nested quotes flattened */
export function spokenPart(line: string): string {
  const m = line.match(/«(.+)»/s)
  if (!m) return ''
  return m[1].replace(/[«»]/g, '').replace(/\s*→\s*/g, '. ')
}

export function stop() {
  if (supported) speechSynthesis.cancel()
  if (audio && !audio.paused) audio.pause()
}

/** fallback: the browser reads the line */
export function say(line: string, onWord: () => void): Promise<void> {
  const text = spokenPart(line)
  if (!enabled || !supported || !text) return Promise.resolve()
  speechSynthesis.cancel()
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ru-RU'
    if (voiceRu) u.voice = voiceRu
    u.rate = 1.04 * rate
    u.volume = volume
    u.pitch = 1.05
    u.onboundary = (e) => {
      if (e.name === 'word' || e.charIndex >= 0) onWord()
    }
    u.onend = () => resolve()
    u.onerror = () => resolve()
    speechSynthesis.speak(u)
  })
}

/** the browser's voice, with the same handlers: word boundaries give the progress */
function sayWithProgress(text: string, h: SpeakHandlers): Promise<void> {
  if (!supported) return Promise.resolve()
  const len = text.length || 1
  speechSynthesis.cancel()
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ru-RU'
    if (voiceRu) u.voice = voiceRu
    u.rate = 1.04 * rate
    u.volume = volume
    u.onboundary = (e) => {
      h.onWord?.()
      h.onLevel?.(0.55)
      h.onProgress?.(Math.min(1, e.charIndex / len))
    }
    u.onend = u.onerror = () => {
      h.onProgress?.(1)
      h.onLevel?.(0)
      resolve()
    }
    speechSynthesis.speak(u)
  })
}

export type SpeakHandlers = {
  onLevel?: (lv: number) => void // 0..1 loudness of ась's voice
  onWord?: () => void // a syllable onset (or a word, in the fallback)
  onProgress?: (p: number) => void // 0..1 through the line
}

/** play the recorded line `id`; falls back to speech synthesis of `text` */
export function speak(id: string, text: string, h: SpeakHandlers = {}): Promise<void> {
  if (!enabled) return Promise.resolve()
  if (!audio || !present.has(id) || voiceName === 'system') return sayWithProgress(text, h)
  stop()
  return new Promise((resolve) => {
    let raf = 0
    let last = 0
    let prev = 0
    const done = () => {
      cancelAnimationFrame(raf)
      audio.onended = audio.onerror = audio.onpause = null
      h.onLevel?.(0)
      resolve()
    }
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (audio.duration) h.onProgress?.(Math.min(1, audio.currentTime / audio.duration))
      let lv = 0
      if (analyser) {
        analyser.getFloatTimeDomainData(buf)
        let s = 0
        for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]
        lv = Math.min(1, Math.sqrt(s / buf.length) * 6)
      } else lv = 0.4 + 0.3 * Math.sin(performance.now() / 90)
      h.onLevel?.(lv)
      // a rising edge of loudness is a syllable: one ring, at most ~5 per second
      const now = performance.now()
      if (lv > 0.28 && prev <= 0.28 && now - last > 190) {
        last = now
        h.onWord?.()
      }
      prev = lv
    }
    audio.onended = done
    audio.onpause = done
    audio.onerror = () => {
      // no recording for this line yet — read it instead
      missing.add(id)
      cancelAnimationFrame(raf)
      audio.onended = audio.onerror = audio.onpause = null
      say(`«${text}»`, () => h.onWord?.()).then(resolve)
    }
    audio.src = `./voice/${voiceName === 'denis' && id.startsWith('g-') ? 'denis/' : ''}${id}.mp3`
    audio.playbackRate = rate
    ctx?.resume()
    audio.play().then(() => (raf = requestAnimationFrame(tick))).catch(() => audio.onerror?.(new Event('error')))
  })
}

const vbins = new Uint8Array(1024)
/** ась's voice (the recording that plays now) as `n` bands, 120 Hz – 4 kHz, 0..1 */
export function spectrum(n = 24): Float32Array {
  const out = new Float32Array(n)
  if (!analyser || !ctx || !audio || audio.paused) return out
  analyser.getByteFrequencyData(vbins)
  const hz = ctx.sampleRate / analyser.fftSize
  for (let i = 0; i < n; i++) {
    const f0 = 120 * Math.pow(4000 / 120, i / n), f1 = 120 * Math.pow(4000 / 120, (i + 1) / n)
    let s = 0, c = 0
    for (let b = Math.floor(f0 / hz); b <= Math.ceil(f1 / hz); b++) ((s += vbins[b] ?? 0), c++)
    out[i] = Math.max(0, Math.min(1, (s / Math.max(1, c) - 60) / 140))
  }
  return out
}
