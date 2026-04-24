// Web Audio API sound cues — no audio files needed.
// All sounds are enabled by default; toggle persisted in localStorage.

const STORAGE_KEY = 'bm_audio_enabled'

export const isAudioEnabled = () => localStorage.getItem(STORAGE_KEY) !== 'false'
export const setAudioEnabled = (v) => localStorage.setItem(STORAGE_KEY, String(v))

const ctx = () => {
  if (typeof window === 'undefined') return null
  if (!window._bmAudioCtx) window._bmAudioCtx = new (window.AudioContext || window.webkitAudioContext)()
  return window._bmAudioCtx
}

const tone = (ac, freq, startTime, duration, gainVal = 0.18, type = 'sine') => {
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.connect(gain); gain.connect(ac.destination)
  osc.type = type
  osc.frequency.setValueAtTime(freq, startTime)
  gain.gain.setValueAtTime(gainVal, startTime)
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
  osc.start(startTime)
  osc.stop(startTime + duration)
}

const play = (fn) => {
  if (!isAudioEnabled()) return
  try {
    const ac = ctx()
    if (!ac) return
    if (ac.state === 'suspended') ac.resume()
    fn(ac)
  } catch { /* unsupported — silently no-op */ }
}

export const audio = {
  // Short tick — set logged
  setLogged: () => play(ac => {
    tone(ac, 880, ac.currentTime, 0.06, 0.1, 'square')
  }),

  // Descending tones — rest timer done
  restDone: () => play(ac => {
    const t = ac.currentTime
    tone(ac, 523, t,        0.18) // C5
    tone(ac, 440, t + 0.18, 0.18) // A4
    tone(ac, 349, t + 0.36, 0.28) // F4
  }),

  // Ascending fanfare — new PR
  pr: () => play(ac => {
    const t = ac.currentTime
    tone(ac, 523, t,        0.12) // C5
    tone(ac, 659, t + 0.12, 0.12) // E5
    tone(ac, 784, t + 0.24, 0.12) // G5
    tone(ac, 1047,t + 0.36, 0.3,  0.2) // C6
  }),

  // Rising double-hit — milestone celebration
  milestone: () => play(ac => {
    const t = ac.currentTime
    tone(ac, 523, t,        0.1)
    tone(ac, 784, t + 0.12, 0.1)
    tone(ac, 1047,t + 0.24, 0.1)
    tone(ac, 1319,t + 0.36, 0.4, 0.22)
  }),
}
