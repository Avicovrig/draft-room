// Sound effect utility for draft events
// Uses Web Audio API for generating simple sounds without external files

type SoundName = 'pickMade' | 'timerWarning' | 'yourTurn' | 'draftComplete'

let audioContext: AudioContext | null = null
let soundEnabled = true

// Initialize audio context on first user interaction
function getAudioContext(): AudioContext | null {
  if (!audioContext) {
    try {
      audioContext = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )()
    } catch {
      console.warn('Web Audio API not supported')
      return null
    }
  }
  return audioContext
}

// Check and update sound preference from localStorage
export function isSoundEnabled(): boolean {
  const stored = localStorage.getItem('soundEnabled')
  if (stored !== null) {
    soundEnabled = stored !== 'false'
  }
  return soundEnabled
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled
  localStorage.setItem('soundEnabled', String(enabled))
}

// Play a simple tone
function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.3
): void {
  const ctx = getAudioContext()
  if (!ctx || !isSoundEnabled()) return

  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)

  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime)

  // Envelope for smooth sound
  gainNode.gain.setValueAtTime(0, ctx.currentTime)
  gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01)
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

  oscillator.start(ctx.currentTime)
  oscillator.stop(ctx.currentTime + duration)
}

// Play a sequence of tones for more complex sounds
function playChord(frequencies: number[], duration: number, volume = 0.15): void {
  frequencies.forEach((freq) => playTone(freq, duration, 'sine', volume))
}

export function playSound(name: SoundName): void {
  if (!isSoundEnabled()) return

  switch (name) {
    case 'pickMade':
      // Quick ascending two-tone
      playTone(523.25, 0.1, 'sine', 0.2) // C5
      setTimeout(() => playTone(659.25, 0.15, 'sine', 0.2), 50) // E5
      break

    case 'timerWarning':
      // Soft tick sound - gentle sine wave
      playTone(880, 0.08, 'sine', 0.06) // A5, soft and short
      break

    case 'yourTurn':
      // Attention-grabbing three-note ascending
      playTone(523.25, 0.12, 'sine', 0.25) // C5
      setTimeout(() => playTone(659.25, 0.12, 'sine', 0.25), 100) // E5
      setTimeout(() => playTone(783.99, 0.2, 'sine', 0.25), 200) // G5
      break

    case 'draftComplete':
      // Celebratory fanfare chord progression
      playChord([261.63, 329.63, 392.0], 0.3) // C major
      setTimeout(() => playChord([293.66, 369.99, 440.0], 0.3), 250) // D major
      setTimeout(() => playChord([329.63, 415.3, 493.88], 0.3), 500) // E major
      setTimeout(() => playChord([349.23, 440.0, 523.25], 0.5), 750) // F major
      setTimeout(() => playChord([392.0, 493.88, 587.33], 0.8), 1000) // G major (sustained)
      break
  }
}

// Resume audio context after user interaction (required by browsers)
export function resumeAudioContext(): void {
  const ctx = getAudioContext()
  if (ctx && ctx.state === 'suspended') {
    ctx.resume()
  }
}
