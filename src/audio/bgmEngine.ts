import { BGM_CONFIG } from './bgmConfig'

type AudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext
}

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null
  const audioWindow = window as AudioWindow
  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext ?? null
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return BGM_CONFIG.defaultVolume
  return Math.min(1, Math.max(0, value))
}

export class BgmEngine {
  private context: AudioContext | null = null
  private source: AudioBufferSourceNode | null = null
  private volumeGain: GainNode | null = null
  private duckGain: GainNode | null = null
  private visibilityGain: GainNode | null = null
  private startPromise: Promise<boolean> | null = null
  private enabled: boolean = BGM_CONFIG.defaultEnabled
  private volume: number = BGM_CONFIG.defaultVolume
  private hidden: boolean = false
  private ducked: boolean = false

  async unlockAndStart(url: string): Promise<boolean> {
    if (this.startPromise) return this.startPromise
    this.startPromise = this.prepareAndStart(url)

    try {
      return await this.startPromise
    } finally {
      this.startPromise = null
    }
  }

  private async prepareAndStart(url: string): Promise<boolean> {
    const AudioContextConstructor = getAudioContextConstructor()
    if (!AudioContextConstructor) return false

    if (!this.context || this.context.state === 'closed') {
      this.context = new AudioContextConstructor()
      this.source = null
      this.createGainGraph()
    }

    if (this.context.state === 'suspended') {
      try {
        await this.context.resume()
      } catch {
        return false
      }
    }

    if (this.source) return this.context.state === 'running'
    return this.loadAndStart(url)
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    this.rampGain(
      this.volumeGain,
      enabled ? this.volume : 0,
      BGM_CONFIG.volumeRampSeconds,
    )
  }

  setVolume(volume: number) {
    this.volume = clampVolume(volume)
    if (this.enabled) {
      this.rampGain(
        this.volumeGain,
        this.volume,
        BGM_CONFIG.volumeRampSeconds,
      )
    }
  }

  duck() {
    if (this.ducked) return
    this.ducked = true
    this.rampGain(
      this.duckGain,
      BGM_CONFIG.duckGain,
      BGM_CONFIG.duckAttackSeconds,
    )
  }

  releaseDuck() {
    if (!this.ducked) return
    this.ducked = false
    this.rampGain(
      this.duckGain,
      1,
      BGM_CONFIG.duckReleaseSeconds,
    )
  }

  setHidden(hidden: boolean) {
    if (this.hidden === hidden) return
    this.hidden = hidden
    this.rampGain(
      this.visibilityGain,
      hidden ? BGM_CONFIG.hiddenGain : 1,
      BGM_CONFIG.visibilityRampSeconds,
    )
  }

  dispose() {
    const source = this.source
    const context = this.context

    this.source = null
    this.context = null
    this.volumeGain = null
    this.duckGain = null
    this.visibilityGain = null
    this.startPromise = null

    if (source) {
      try {
        source.stop()
      } catch {
        // A stopped source cannot be stopped twice.
      }
      source.disconnect()
    }

    if (context && context.state !== 'closed') void context.close()
  }

  private createGainGraph() {
    const context = this.context
    if (!context) return

    this.volumeGain = context.createGain()
    this.duckGain = context.createGain()
    this.visibilityGain = context.createGain()

    this.volumeGain.gain.setValueAtTime(
      this.enabled ? this.volume : 0,
      context.currentTime,
    )
    this.duckGain.gain.setValueAtTime(
      this.ducked ? BGM_CONFIG.duckGain : 1,
      context.currentTime,
    )
    this.visibilityGain.gain.setValueAtTime(
      this.hidden ? BGM_CONFIG.hiddenGain : 1,
      context.currentTime,
    )

    this.volumeGain.connect(this.duckGain)
    this.duckGain.connect(this.visibilityGain)
    this.visibilityGain.connect(context.destination)
  }

  private async loadAndStart(url: string): Promise<boolean> {
    const context = this.context
    const volumeGain = this.volumeGain
    if (!context || !volumeGain || context.state !== 'running') return false

    try {
      const response = await fetch(url)
      if (!response.ok) return false

      const encodedAudio = await response.arrayBuffer()
      const audioBuffer = await context.decodeAudioData(encodedAudio)

      if (this.context !== context || context.state !== 'running') return false

      const source = context.createBufferSource()
      source.buffer = audioBuffer
      source.loop = true
      source.loopStart = 0
      source.loopEnd = audioBuffer.duration
      source.connect(volumeGain)
      source.onended = () => {
        if (this.source === source) this.source = null
        source.disconnect()
      }
      source.start(context.currentTime)
      this.source = source
      return true
    } catch {
      return false
    }
  }

  private rampGain(
    node: GainNode | null,
    target: number,
    durationSeconds: number,
  ) {
    const context = this.context
    if (!context || !node) return

    const now = context.currentTime
    node.gain.cancelScheduledValues(now)
    node.gain.setValueAtTime(node.gain.value, now)
    node.gain.linearRampToValueAtTime(target, now + durationSeconds)
  }
}
