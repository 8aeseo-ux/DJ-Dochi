import { describe, expect, it } from 'vitest'
import { createDochiVoiceSamples } from './dochiVoiceEngine'

describe('DJ Dochi voice synthesis', () => {
  it('creates a short, softly enveloped, deterministic voice grain', () => {
    const sampleRate = 48_000
    const first = createDochiVoiceSamples(sampleRate)
    const second = createDochiVoiceSamples(sampleRate)
    const peak = Math.max(...first.map(Math.abs))
    const largestStep = first.reduce((largest, sample, index) => {
      if (index === 0) return largest
      return Math.max(largest, Math.abs(sample - first[index - 1]))
    }, 0)

    expect(first.length).toBe(Math.round(sampleRate * 0.16))
    expect(first[0]).toBeCloseTo(0, 4)
    expect(first[first.length - 1]).toBeCloseTo(0, 3)
    expect(peak).toBeGreaterThan(0.1)
    expect(peak).toBeLessThan(0.8)
    expect(largestStep).toBeLessThan(0.08)
    expect([...first.slice(0, 64)]).toEqual([...second.slice(0, 64)])
  })
})
