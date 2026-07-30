import { describe, expect, it } from 'vitest'
import {
  DochiVoiceCadence,
  getLastVoiceCharacterIndex,
  isVoiceCharacter,
} from './dochiVoiceCadence'

describe('DochiVoiceCadence', () => {
  it('ignores spaces, line breaks, and punctuation', () => {
    expect([' ', '\n', '.', ',', '?', '!', '…'].map(isVoiceCharacter)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ])
    expect(['도', 'A', '7'].map(isVoiceCharacter)).toEqual([true, true, true])
  })

  it('mixes two- and three-character gaps without replaying a revealed index', () => {
    const cadence = new DochiVoiceCadence()
    const line = '도치는오늘도음악을듣고있어요'
    const playedAt: number[] = []

    for (const [index, character] of [...line].entries()) {
      if (cadence.shouldPlay('intro-0', character, index)) playedAt.push(index)
      expect(cadence.shouldPlay('intro-0', character, index)).toBe(false)
    }

    const gaps = playedAt.slice(1).map((index, gapIndex) => index - playedAt[gapIndex])

    expect(playedAt.length).toBeGreaterThan(3)
    expect(new Set(gaps)).toEqual(new Set([2, 3]))
  })

  it('starts a fresh cadence for a new dialogue key', () => {
    const cadence = new DochiVoiceCadence()

    expect(cadence.shouldPlay('intro-0', '도', 0)).toBe(false)
    expect(cadence.shouldPlay('intro-0', '치', 1)).toBe(true)
    expect(cadence.shouldPlay('intro-1', '새', 0)).toBe(false)
  })

  it('finds and always voices the final readable character before punctuation', () => {
    const cadence = new DochiVoiceCadence()

    expect(getLastVoiceCharacterIndex('좋아...!')).toBe(1)
    expect(cadence.shouldPlay('outro-0', '좋', 0)).toBe(false)
    expect(cadence.shouldPlay('outro-0', '아', 1, { isTerminal: true })).toBe(true)
    expect(cadence.shouldPlay('outro-0', '아', 1, { isTerminal: true })).toBe(false)
    expect(cadence.shouldPlay('outro-0', '!', 5, { isTerminal: false })).toBe(false)
  })
})
