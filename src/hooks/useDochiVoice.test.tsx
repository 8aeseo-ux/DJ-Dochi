import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DochiFlowState } from '../types'
import { useDochiVoice } from './useDochiVoice'

class FakeAudioParam {
  value = 1

  setValueAtTime(value: number) {
    this.value = value
  }

  exponentialRampToValueAtTime(value: number) {
    this.value = value
  }

  cancelScheduledValues() {}
}

class FakeAudioNode {
  connect() {
    return this
  }

  disconnect() {}
}

class FakeBufferSource extends FakeAudioNode {
  buffer: AudioBuffer | null = null
  playbackRate = new FakeAudioParam()
  detune = new FakeAudioParam()
  onended: (() => void) | null = null
  start = vi.fn()
  stop = vi.fn()
}

class FakeBiquadFilter extends FakeAudioNode {
  type: BiquadFilterType = 'lowpass'
  frequency = new FakeAudioParam()
  Q = new FakeAudioParam()
}

class FakeDynamicsCompressor extends FakeAudioNode {
  threshold = new FakeAudioParam()
  knee = new FakeAudioParam()
  ratio = new FakeAudioParam()
  attack = new FakeAudioParam()
  release = new FakeAudioParam()
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = []

  state: AudioContextState = 'running'
  sampleRate = 48_000
  currentTime = 0
  destination = new FakeAudioNode()
  sources: FakeBufferSource[] = []
  filters: FakeBiquadFilter[] = []
  compressors: FakeDynamicsCompressor[] = []

  constructor() {
    FakeAudioContext.instances.push(this)
  }

  createBuffer(_channels: number, length: number) {
    const samples = new Float32Array(length)
    return {
      getChannelData: () => samples,
    } as unknown as AudioBuffer
  }

  createBufferSource() {
    const source = new FakeBufferSource()
    this.sources.push(source)
    return source as unknown as AudioBufferSourceNode
  }

  createBiquadFilter() {
    const filter = new FakeBiquadFilter()
    this.filters.push(filter)
    return filter as unknown as BiquadFilterNode
  }

  createDynamicsCompressor() {
    const compressor = new FakeDynamicsCompressor()
    this.compressors.push(compressor)
    return compressor as unknown as DynamicsCompressorNode
  }

  createGain() {
    return Object.assign(new FakeAudioNode(), {
      gain: new FakeAudioParam(),
    }) as unknown as GainNode
  }

  resume = vi.fn(async () => {})
  close = vi.fn(async () => {
    this.state = 'closed'
  })
}

function VoiceHarness({
  state = 'talking',
  dialogueKey = 'intro-0',
}: {
  state?: DochiFlowState
  dialogueKey?: string
}) {
  const voice = useDochiVoice({ state, dialogueKey })

  return (
    <>
      <span data-testid="enabled">{String(voice.enabled)}</span>
      <button type="button" onClick={voice.unlock}>unlock</button>
      <button
        type="button"
        onClick={() => voice.onCharacterReveal('도', 0, { isTerminal: false })}
      >
        char-0
      </button>
      <button
        type="button"
        onClick={() => voice.onCharacterReveal('?', 1, { isTerminal: false })}
      >
        punctuation
      </button>
      <button
        type="button"
        onClick={() => voice.onCharacterReveal('치', 2, { isTerminal: true })}
      >
        char-1
      </button>
      <button type="button" onClick={voice.toggle}>toggle</button>
      <button type="button" onClick={voice.stop}>stop</button>
    </>
  )
}

describe('useDochiVoice', () => {
  beforeEach(() => {
    FakeAudioContext.instances = []
    localStorage.clear()
    vi.stubGlobal('AudioContext', FakeAudioContext)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('starts enabled and plays only after the natural character cadence is reached', () => {
    render(<VoiceHarness />)

    expect(screen.getByTestId('enabled')).toHaveTextContent('true')
    fireEvent.click(screen.getByText('unlock'))
    fireEvent.click(screen.getByText('char-0'))
    fireEvent.click(screen.getByText('punctuation'))
    expect(FakeAudioContext.instances[0].sources).toHaveLength(0)

    fireEvent.click(screen.getByText('char-1'))
    expect(FakeAudioContext.instances[0].sources).toHaveLength(1)
    expect(FakeAudioContext.instances[0].sources[0].start).toHaveBeenCalledOnce()
    expect(
      FakeAudioContext.instances[0].filters.filter(({ type }) => type === 'bandpass'),
    ).toHaveLength(3)
    expect(FakeAudioContext.instances[0].compressors).toHaveLength(1)
    expect(
      FakeAudioContext.instances[0].sources[0].stop.mock.calls[0][0],
    ).toBeGreaterThan(0.13)
  })

  it('persists mute and prevents character voice playback while disabled', () => {
    render(<VoiceHarness />)

    fireEvent.click(screen.getByText('unlock'))
    fireEvent.click(screen.getByText('toggle'))

    expect(screen.getByTestId('enabled')).toHaveTextContent('false')
    expect(localStorage.getItem('dj-dochi:sfx-enabled')).toBe('false')

    fireEvent.click(screen.getByText('char-0'))
    fireEvent.click(screen.getByText('char-1'))
    expect(FakeAudioContext.instances[0].sources).toHaveLength(0)
  })
})
