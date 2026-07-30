import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BGM_CONFIG } from './bgmConfig'
import { BgmEngine } from './bgmEngine'

class FakeAudioParam {
  value = 1
  ramps: number[] = []

  setValueAtTime(value: number) {
    this.value = value
  }

  linearRampToValueAtTime(value: number) {
    this.value = value
    this.ramps.push(value)
  }

  cancelScheduledValues() {}
}

class FakeGainNode {
  gain = new FakeAudioParam()
  connections: unknown[] = []

  connect(node: unknown) {
    this.connections.push(node)
    return node
  }

  disconnect() {}
}

class FakeBufferSource {
  buffer: AudioBuffer | null = null
  loop = false
  starts = 0
  stops = 0
  onended: (() => void) | null = null

  connect(node: unknown) {
    return node
  }

  disconnect() {}

  start() {
    this.starts += 1
  }

  stop() {
    this.stops += 1
  }
}

class FakeAudioContext {
  static latest: FakeAudioContext | null = null

  currentTime = 2
  destination = {}
  state: AudioContextState = 'suspended'
  gains: FakeGainNode[] = []
  sources: FakeBufferSource[] = []

  constructor() {
    FakeAudioContext.latest = this
  }

  async resume() {
    this.state = 'running'
  }

  async close() {
    this.state = 'closed'
  }

  createGain() {
    const gain = new FakeGainNode()
    this.gains.push(gain)
    return gain
  }

  createBufferSource() {
    const source = new FakeBufferSource()
    this.sources.push(source)
    return source
  }

  async decodeAudioData() {
    return {} as AudioBuffer
  }
}

function successfulAudioResponse() {
  return {
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(16),
  } as Response
}

describe('BgmEngine', () => {
  beforeEach(() => {
    FakeAudioContext.latest = null
    vi.stubGlobal('AudioContext', FakeAudioContext)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(successfulAudioResponse()))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('unlocks on demand and starts one seamless looping source', async () => {
    const engine = new BgmEngine()

    const [first, second] = await Promise.all([
      engine.unlockAndStart('/dochi-loop.wav'),
      engine.unlockAndStart('/dochi-loop.wav'),
    ])
    const context = FakeAudioContext.latest

    expect(first).toBe(true)
    expect(second).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(context?.sources).toHaveLength(1)
    expect(context?.sources[0].loop).toBe(true)
    expect(context?.sources[0].starts).toBe(1)
  })

  it('keeps volume, ducking, visibility, and mute on independent gain stages', async () => {
    const engine = new BgmEngine()
    await engine.unlockAndStart('/dochi-loop.wav')

    const context = FakeAudioContext.latest
    const [volumeGain, duckGain, visibilityGain] = context?.gains ?? []

    engine.setVolume(0.62)
    expect(volumeGain.gain.ramps[volumeGain.gain.ramps.length - 1]).toBeCloseTo(0.62)

    engine.duck()
    expect(duckGain.gain.ramps[duckGain.gain.ramps.length - 1]).toBeCloseTo(BGM_CONFIG.duckGain)

    engine.releaseDuck()
    expect(duckGain.gain.ramps[duckGain.gain.ramps.length - 1]).toBe(1)

    engine.setHidden(true)
    expect(
      visibilityGain.gain.ramps[visibilityGain.gain.ramps.length - 1],
    ).toBeCloseTo(
      BGM_CONFIG.hiddenGain,
    )

    engine.setEnabled(false)
    expect(volumeGain.gain.ramps[volumeGain.gain.ramps.length - 1]).toBe(0)
  })

  it('allows an explicit retry after an audio loading failure', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(successfulAudioResponse())
    const engine = new BgmEngine()

    await expect(engine.unlockAndStart('/dochi-loop.wav')).resolves.toBe(false)
    await expect(engine.unlockAndStart('/dochi-loop.wav')).resolves.toBe(true)
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
