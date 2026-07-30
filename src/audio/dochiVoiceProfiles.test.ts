import { describe, expect, it } from 'vitest'
import { getDochiVoiceEmotion, getDochiVoicePlayback } from './dochiVoiceProfiles'

describe('Dochi voice profiles', () => {
  it('keeps emotional changes subtle around one shared voice', () => {
    const neutral = getDochiVoicePlayback('neutral', 'intro-0', 3)
    const surprised = getDochiVoicePlayback('surprised', 'intro-0', 3)
    const thinking = getDochiVoicePlayback('thinking', 'intro-0', 3)
    const proud = getDochiVoicePlayback('proud', 'intro-0', 3)
    const error = getDochiVoicePlayback('error', 'intro-0', 3)

    expect(surprised.playbackRate).toBeGreaterThan(neutral.playbackRate)
    expect(thinking.playbackRate).toBeLessThan(neutral.playbackRate)
    expect(proud.playbackRate).toBeGreaterThan(neutral.playbackRate)
    expect(error.playbackRate).toBeLessThan(neutral.playbackRate)

    for (const profile of [neutral, surprised, thinking, proud, error]) {
      expect(profile.playbackRate).toBeGreaterThanOrEqual(0.94)
      expect(profile.playbackRate).toBeLessThanOrEqual(1.06)
      expect(Math.abs(profile.detuneCents)).toBeLessThanOrEqual(70)
    }
  })

  it('uses stable micro-variation for the same dialogue character', () => {
    expect(getDochiVoicePlayback('neutral', 'intro-2', 5)).toEqual(
      getDochiVoicePlayback('neutral', 'intro-2', 5),
    )
    expect(getDochiVoicePlayback('neutral', 'intro-2', 5)).not.toEqual(
      getDochiVoicePlayback('neutral', 'intro-2', 8),
    )
  })

  it('keeps normal grains short and gives the terminal syllable a longer finish', () => {
    const normal = getDochiVoicePlayback('neutral', 'intro-0', 3, false)
    const terminal = getDochiVoicePlayback('neutral', 'intro-0', 3, true)

    expect(normal.durationSeconds).toBeGreaterThanOrEqual(0.1)
    expect(normal.durationSeconds).toBeLessThanOrEqual(0.12)
    expect(terminal.durationSeconds).toBeGreaterThanOrEqual(0.13)
    expect(terminal.durationSeconds).toBeLessThanOrEqual(0.15)
    expect(terminal.durationSeconds).toBeGreaterThan(normal.durationSeconds)
    expect(normal.formantScale).toBeGreaterThanOrEqual(0.97)
    expect(normal.formantScale).toBeLessThanOrEqual(1.03)
  })

  it('maps the current room state to the intended emotional shading', () => {
    expect(getDochiVoiceEmotion('noticed')).toBe('surprised')
    expect(getDochiVoiceEmotion('talking')).toBe('neutral')
    expect(getDochiVoiceEmotion('extracting')).toBe('thinking')
    expect(getDochiVoiceEmotion('analyzingTaste')).toBe('thinking')
    expect(getDochiVoiceEmotion('receivingInput')).toBe('proud')
    expect(getDochiVoiceEmotion('finalTape')).toBe('proud')
    expect(getDochiVoiceEmotion('tasteAnalysisError')).toBe('error')
  })
})
