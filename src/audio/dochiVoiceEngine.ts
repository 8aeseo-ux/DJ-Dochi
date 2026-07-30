import { DOCHI_VOICE_CONFIG } from './dochiVoiceConfig'
import type { DochiVoicePlayback } from './dochiVoiceProfiles'

type ActiveVoice = {
  source: AudioBufferSourceNode
  gain: GainNode
  nodes: AudioNode[]
}

type AudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext
}

function smoothstep(value: number): number {
  const clamped = Math.min(1, Math.max(0, value))
  return clamped * clamped * (3 - 2 * clamped)
}

export function createDochiVoiceSamples(sampleRate: number): Float32Array {
  const { baseFrequencyHz, maxBufferDurationSeconds } = DOCHI_VOICE_CONFIG.synthesis
  const frameCount = Math.round(sampleRate * maxBufferDurationSeconds)
  const samples = new Float32Array(frameCount)
  let phase = 0
  let noiseSeed = 0x0d0c_4101
  let softenedNoise = 0

  for (let index = 0; index < frameCount; index += 1) {
    const time = index / sampleRate
    const progress = index / Math.max(1, frameCount - 1)
    const attack = smoothstep(progress / 0.07)
    const release = smoothstep((1 - progress) / 0.2)
    const envelope = attack * release
    const roundedGlide = 1 + 0.028 * Math.sin(Math.PI * progress)
    const gentleWobble = 1 + 0.014 * Math.sin(2 * Math.PI * 9.2 * time)
    const frequency = baseFrequencyHz * roundedGlide * gentleWobble

    phase += (2 * Math.PI * frequency) / sampleRate

    const cycle = (phase / (2 * Math.PI)) % 1
    let glottalPulse = 0
    if (cycle < 0.58) {
      glottalPulse = 0.5 - 0.5 * Math.cos(Math.PI * cycle / 0.58)
    } else if (cycle < 0.82) {
      glottalPulse = 0.5 + 0.5 * Math.cos(Math.PI * (cycle - 0.58) / 0.24)
    }

    const voicedPulse = (glottalPulse - 0.34) * 1.18
    const chestTone = Math.sin(phase) * 0.12
    const syllablePulse = 0.9 + 0.1 * Math.sin(2 * Math.PI * 15 * time)

    noiseSeed = (Math.imul(noiseSeed, 1_664_525) + 1_013_904_223) >>> 0
    const noise = noiseSeed / 0xffff_ffff * 2 - 1
    softenedNoise += (noise - softenedNoise) * 0.075

    const excitation = voicedPulse * 0.73 + chestTone + softenedNoise * 0.15
    samples[index] = Math.tanh(excitation * 1.25) * envelope * syllablePulse * 0.68
  }

  return samples
}

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null
  const audioWindow = window as AudioWindow
  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext ?? null
}

export class DochiVoiceEngine {
  private context: AudioContext | null = null
  private voiceBuffer: AudioBuffer | null = null
  private activeVoice: ActiveVoice | null = null

  async unlock(): Promise<boolean> {
    const AudioContextConstructor = getAudioContextConstructor()
    if (!AudioContextConstructor) return false

    if (!this.context || this.context.state === 'closed') {
      this.context = new AudioContextConstructor()
      this.voiceBuffer = null
    }

    if (this.context.state === 'suspended') {
      try {
        await this.context.resume()
      } catch {
        return false
      }
    }

    return this.context.state === 'running'
  }

  play(playback: DochiVoicePlayback): boolean {
    const context = this.context
    if (!context || context.state !== 'running') return false

    if (!this.voiceBuffer) {
      const samples = createDochiVoiceSamples(context.sampleRate)
      this.voiceBuffer = context.createBuffer(1, samples.length, context.sampleRate)
      this.voiceBuffer.getChannelData(0).set(samples)
    }

    this.stop()

    const now = context.currentTime
    const source = context.createBufferSource()
    const formantMix = context.createGain()
    const lowpass = context.createBiquadFilter()
    const compressor = context.createDynamicsCompressor()
    const gain = context.createGain()
    const formantNodes: AudioNode[] = []
    const duration = playback.durationSeconds
    const releaseAt = now + Math.max(0.03, duration - 0.026)
    const stopAt = now + duration

    source.buffer = this.voiceBuffer
    source.playbackRate.setValueAtTime(playback.playbackRate, now)
    source.detune.setValueAtTime(playback.detuneCents, now)

    for (const formant of DOCHI_VOICE_CONFIG.synthesis.formants) {
      const filter = context.createBiquadFilter()
      const branchGain = context.createGain()

      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(
        formant.frequencyHz * playback.formantScale,
        now,
      )
      filter.Q.setValueAtTime(formant.q, now)
      branchGain.gain.setValueAtTime(formant.gain, now)

      source.connect(filter)
      filter.connect(branchGain)
      branchGain.connect(formantMix)
      formantNodes.push(filter, branchGain)
    }

    lowpass.type = 'lowpass'
    lowpass.frequency.setValueAtTime(DOCHI_VOICE_CONFIG.synthesis.lowpassFrequencyHz, now)
    lowpass.Q.setValueAtTime(0.64, now)

    const compressorConfig = DOCHI_VOICE_CONFIG.synthesis.compressor
    compressor.threshold.setValueAtTime(compressorConfig.threshold, now)
    compressor.knee.setValueAtTime(compressorConfig.knee, now)
    compressor.ratio.setValueAtTime(compressorConfig.ratio, now)
    compressor.attack.setValueAtTime(compressorConfig.attack, now)
    compressor.release.setValueAtTime(compressorConfig.release, now)

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(DOCHI_VOICE_CONFIG.synthesis.masterGain, now + 0.009)
    gain.gain.setValueAtTime(DOCHI_VOICE_CONFIG.synthesis.masterGain, releaseAt)
    gain.gain.exponentialRampToValueAtTime(0.0001, stopAt)

    formantMix.connect(lowpass)
    lowpass.connect(compressor)
    compressor.connect(gain)
    gain.connect(context.destination)

    const nodes = [formantMix, ...formantNodes, lowpass, compressor, gain]
    const activeVoice = { source, gain, nodes }
    this.activeVoice = activeVoice
    source.onended = () => {
      if (this.activeVoice === activeVoice) this.activeVoice = null
      source.disconnect()
      for (const node of nodes) node.disconnect()
    }

    source.start(now)
    source.stop(stopAt + 0.006)
    return true
  }

  stop() {
    const context = this.context
    const activeVoice = this.activeVoice
    if (!context || !activeVoice) return

    this.activeVoice = null
    const now = context.currentTime

    try {
      activeVoice.gain.gain.cancelScheduledValues(now)
      activeVoice.gain.gain.setValueAtTime(
        Math.max(0.0001, activeVoice.gain.gain.value),
        now,
      )
      activeVoice.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.008)
      activeVoice.source.stop(now + 0.01)
    } catch {
      // The short grain may already have ended between the state check and stop.
    }
  }

  dispose() {
    this.stop()
    const context = this.context
    this.context = null
    this.voiceBuffer = null

    if (context && context.state !== 'closed') void context.close()
  }
}
