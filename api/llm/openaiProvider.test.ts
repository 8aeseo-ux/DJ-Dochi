// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

const { parseMock } = vi.hoisted(() => ({
  parseMock: vi.fn(),
}))

vi.mock('openai', () => ({
  default: class OpenAI {
    responses = {
      parse: parseMock,
    }
  },
}))

import { createOpenAiProvider } from './openaiProvider'

describe('createOpenAiProvider', () => {
  beforeEach(() => {
    parseMock.mockReset()
    parseMock.mockResolvedValue({
      output_parsed: {
        tasteProfile: {
          summary: '몽환적인 밤의 질감을 좋아해.',
          genres: ['dream pop'],
          moods: ['late night'],
          traits: ['soft vocals'],
        },
        mixtape: {
          title: '새벽의 주파수',
          subtitle: 'soft lights, slow streets',
          dochiComment: '밤 공기랑 잘 맞는 곡들이네.',
          design: {
            atmosphere: 'midnight',
            palette: ['navy', 'amber'],
            texture: 'worn plastic',
            motifs: ['streetlight'],
          },
          tracks: [{
            title: 'Myth',
            artist: 'Beach House',
            album: 'Bloom',
            reason: '몽환적인 질감이 자연스럽게 이어져.',
          }],
        },
      },
    })
  })

  it('does not send unsupported reasoning options to standard GPT models', async () => {
    const provider = createOpenAiProvider({
      apiKey: 'test-key',
      model: 'gpt-4.1-mini',
      guidePrompt: 'Dochi guide',
    })

    await provider.generateMixtape({
      tracks: [{
        title: 'Space Song',
        artist: 'Beach House',
        album: 'Depression Cherry',
      }],
    })

    expect(parseMock).toHaveBeenCalledOnce()
    expect(parseMock.mock.calls[0][0]).not.toHaveProperty('reasoning')
  })

  it('bounds the initial mixtape recommendations to five or six tracks', async () => {
    const provider = createOpenAiProvider({
      apiKey: 'test-key',
      model: 'gpt-4.1-mini',
      guidePrompt: 'Dochi guide',
    })

    await provider.generateMixtape({
      tracks: [{
        title: 'Space Song',
        artist: 'Beach House',
        album: 'Depression Cherry',
      }],
    })

    const request = parseMock.mock.calls[0][0]
    expect(request.text.format.schema.properties.mixtape.properties.tracks)
      .toMatchObject({ minItems: 5, maxItems: 6 })
  })

  it('forwards the caller cancellation signal to initial mixtape requests', async () => {
    const provider = createOpenAiProvider({
      apiKey: 'test-key',
      model: 'gpt-4.1-mini',
      guidePrompt: 'Dochi guide',
    })
    const signal = new AbortController().signal

    await provider.generateMixtape({
      tracks: [{
        title: 'Space Song',
        artist: 'Beach House',
        album: 'Depression Cherry',
      }],
    }, { signal })

    expect(parseMock.mock.calls[0][1]).toEqual({ signal })
  })

  it('requests only the missing replacement tracks with confirmed and excluded identities', async () => {
    parseMock.mockResolvedValueOnce({
      output_parsed: {
        tracks: [{
          title: 'Myth',
          artist: 'Beach House',
          album: 'Bloom',
          reason: '몽환적인 질감이 자연스럽게 이어져.',
        }],
      },
    })
    const provider = createOpenAiProvider({
      apiKey: 'test-key',
      model: 'gpt-4.1-mini',
      guidePrompt: 'Dochi guide',
    })

    await expect(provider.generateReplacementTracks({
      confirmedTracks: [{
        title: 'Ditto',
        artist: 'NewJeans',
        album: 'OMG',
      }],
      excludedTracks: [{
        title: 'Imaginary Song',
        artist: 'Imaginary Artist',
      }],
      count: 1,
    })).resolves.toEqual([{
      title: 'Myth',
      artist: 'Beach House',
      album: 'Bloom',
      reason: '몽환적인 질감이 자연스럽게 이어져.',
    }])

    const request = parseMock.mock.calls[0][0]
    const userPayload = JSON.parse(request.input[1].content[0].text)
    expect(userPayload).toEqual({
      confirmedTracks: [{
        title: 'Ditto',
        artist: 'NewJeans',
        album: 'OMG',
      }],
      excludedTracks: [{
        title: 'Imaginary Song',
        artist: 'Imaginary Artist',
      }],
      requiredCount: 1,
    })
  })

  it('forwards the caller cancellation signal to replacement requests', async () => {
    parseMock.mockResolvedValueOnce({
      output_parsed: {
        tracks: [{
          title: 'Myth',
          artist: 'Beach House',
          album: 'Bloom',
          reason: '몽환적인 질감이 자연스럽게 이어져.',
        }],
      },
    })
    const provider = createOpenAiProvider({
      apiKey: 'test-key',
      model: 'gpt-4.1-mini',
      guidePrompt: 'Dochi guide',
    })
    const signal = new AbortController().signal

    await provider.generateReplacementTracks({
      confirmedTracks: [{
        title: 'Ditto',
        artist: 'NewJeans',
        album: 'OMG',
      }],
      excludedTracks: [],
      count: 1,
    }, { signal })

    expect(parseMock.mock.calls[0][1]).toEqual({ signal })
  })

  it('keeps real-release and exclusion rules in the Dochi guide', () => {
    const guide = readFileSync(
      new URL('../../prompts/dochi-mixtape-guide.md', import.meta.url),
      'utf8',
    )

    expect(guide).toContain('실제로 발매')
    expect(guide).toContain('제외 목록')
    expect(guide).toContain('확신하지 못하는')
    expect(guide).toContain('정확히 5곡')
  })
})
