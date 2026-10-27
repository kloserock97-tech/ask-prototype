// Speech for the prototype. Only the quoted part of a voice line is spoken
// («…»); stage directions around it stay silent. Every word boundary fires
// onWord so the glow can pulse with the speech.

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

export function isOn() {
  return enabled && supported
}

/** must be called from a user gesture at least once (iOS unlocks audio this way) */
export function setOn(on: boolean) {
  enabled = on
  if (!supported) return
  if (on) {
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    speechSynthesis.speak(u)
  } else speechSynthesis.cancel()
}

/** text spoken aloud: the «quoted» parts, nested quotes flattened */
export function spokenPart(line: string): string {
  const m = line.match(/«(.+)»/s)
  if (!m) return ''
  return m[1].replace(/[«»]/g, '').replace(/\s*→\s*/g, '. ')
}

export function stop() {
  if (supported) speechSynthesis.cancel()
}

export function say(line: string, onWord: () => void): Promise<void> {
  const text = spokenPart(line)
  if (!isOn() || !text) return Promise.resolve()
  speechSynthesis.cancel()
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ru-RU'
    if (voiceRu) u.voice = voiceRu
    u.rate = 1.04
    u.pitch = 1.05
    u.onboundary = (e) => {
      if (e.name === 'word' || e.charIndex >= 0) onWord()
    }
    u.onend = () => resolve()
    u.onerror = () => resolve()
    speechSynthesis.speak(u)
  })
}
