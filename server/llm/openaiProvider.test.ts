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

const CURATION_CANDIDATES = Array.from({ length: 12 }, (_, index) => ({
  candidateId: `itunes:${index + 1}`,
  title: `Track ${index + 1}`,
  artist: `Artist ${index + 1}`,
}))

describe('createOpenAiProvider', () => {
  beforeEach(() => {
    parseMock.mockReset()
    parseMock.mockResolvedValue({
      output_parsed: {
        summary: '몽환적인 밤의 질감을 좋아해.',
        genres: ['dream pop'],
        moods: ['late night'],
        traits: ['soft vocals'],
        searchKeywords: ['dreamy', 'ethereal'],
      },
    })
  })

  it('does not send unsupported reasoning options to standard GPT models', async () => {
    const provider = createOpenAiProvider({
      apiKey: 'test-key',
      model: 'gpt-4.1-mini',
      guidePrompt: 'Dochi guide',
    })

    await provider.analyzeTaste({
      tracks: [{
        title: 'Space Song',
        artist: 'Beach House',
        album: 'Depression Cherry',
      }],
    })

    expect(parseMock).toHaveBeenCalledOnce()
    expect(parseMock.mock.calls[0][0]).not.toHaveProperty('reasoning')
  })

  it('analyzes taste without requesting recommendation tracks', async () => {
    parseMock.mockResolvedValueOnce({
      output_parsed: {
        summary: '몽환적인 밤의 결을 좋아해.',
        genres: ['dream pop'],
        moods: ['late night'],
        traits: ['soft vocals'],
        searchKeywords: ['dreamy', 'ethereal', 'nocturnal'],
      },
    })
    const provider = createOpenAiProvider({
      apiKey: 'test-key',
      model: 'gpt-4.1-mini',
      guidePrompt: 'Shared guide',
      tasteGuidePrompt: 'Taste guide',
      curationGuidePrompt: 'Curation guide',
    })

    await expect(provider.analyzeTaste({
      tracks: [{
        title: 'Space Song',
        artist: 'Beach House',
        album: 'Depression Cherry',
      }],
    })).resolves.toMatchObject({
      genres: ['dream pop'],
      searchKeywords: ['dreamy', 'ethereal', 'nocturnal'],
    })

    const request = parseMock.mock.calls[0][0]
    expect(request.text.format.schema.properties).not.toHaveProperty('mixtape')
    expect(request.input[0].content[0].text).toContain('Taste guide')
  })

  it('curates exactly five tracks through a dynamic candidate-id enum', async () => {
    parseMock.mockResolvedValueOnce({
      output_parsed: {
        title: '새벽의 주파수',
        subtitle: 'soft lights, slow streets',
        dochiComment: '밤 공기랑 잘 맞는 곡들이네.',
        design: {
          atmosphere: 'midnight',
          palette: ['navy', 'amber'],
          texture: 'worn plastic',
          motifs: ['streetlight'],
        },
        tracks: CURATION_CANDIDATES.slice(0, 5).map(({ candidateId }, index) => ({
          candidateId,
          reason: `${index + 1}번 이유`,
        })),
      },
    })
    const provider = createOpenAiProvider({
      apiKey: 'test-key',
      model: 'gpt-4.1-mini',
      guidePrompt: 'Shared guide',
      tasteGuidePrompt: 'Taste guide',
      curationGuidePrompt: 'Curation guide',
    })

    await provider.curateMixtape({
      tasteProfile: {
        summary: '몽환적인 밤의 결을 좋아해.',
        genres: ['dream pop'],
        moods: ['late night'],
        traits: ['soft vocals'],
        searchKeywords: ['dreamy'],
      },
      candidates: CURATION_CANDIDATES,
    })

    const request = parseMock.mock.calls[0][0]
    const candidateIdSchema = request.text.format.schema
      .properties.tracks.items.properties.candidateId
    expect(candidateIdSchema.enum).toEqual(
      CURATION_CANDIDATES.map(({ candidateId }) => candidateId),
    )
    expect(request.text.format.schema.properties.tracks)
      .toMatchObject({ minItems: 5, maxItems: 5 })
    expect(request.text.format.schema.properties.tracks.items.properties)
      .not.toHaveProperty('title')
    expect(request.text.format.schema.properties.tracks.items.properties)
      .not.toHaveProperty('artist')

    const userPayload = JSON.parse(request.input[1].content[0].text)
    expect(userPayload.candidates[0]).toEqual({
      candidateId: 'itunes:1',
      title: 'Track 1',
      artist: 'Artist 1',
    })
  })

  it('forwards cancellation to both catalog-seeded LLM calls', async () => {
    parseMock
      .mockResolvedValueOnce({
        output_parsed: {
          summary: '몽환적인 밤의 결을 좋아해.',
          genres: ['dream pop'],
          moods: ['late night'],
          traits: ['soft vocals'],
          searchKeywords: ['dreamy'],
        },
      })
      .mockResolvedValueOnce({
        output_parsed: {
          title: '새벽의 주파수',
          subtitle: 'soft lights',
          dochiComment: '좋아.',
          design: {
            atmosphere: 'midnight',
            palette: ['navy'],
            texture: 'paper',
            motifs: ['stars'],
          },
          tracks: CURATION_CANDIDATES.slice(0, 5).map(({ candidateId }) => ({
            candidateId,
            reason: '이어지는 결이 좋아.',
          })),
        },
      })
    const provider = createOpenAiProvider({
      apiKey: 'test-key',
      model: 'gpt-4.1-mini',
      guidePrompt: 'Shared guide',
      tasteGuidePrompt: 'Taste guide',
      curationGuidePrompt: 'Curation guide',
    })
    const signal = new AbortController().signal

    const tasteProfile = await provider.analyzeTaste({
      tracks: [{ title: 'Ditto', artist: 'NewJeans', album: '' }],
    }, { signal })
    await provider.curateMixtape({
      tasteProfile,
      candidates: CURATION_CANDIDATES,
    }, { signal })

    expect(parseMock.mock.calls[0][1]).toEqual({ signal })
    expect(parseMock.mock.calls[1][1]).toEqual({ signal })
  })

  it('keeps shared voice rules and task-specific constraints in prompt files', () => {
    const guide = readFileSync(
      new URL('../../prompts/dochi-mixtape-guide.md', import.meta.url),
      'utf8',
    )
    const tasteGuide = readFileSync(
      new URL('../../prompts/dochi-taste-guide.md', import.meta.url),
      'utf8',
    )
    const curationGuide = readFileSync(
      new URL('../../prompts/dochi-curation-guide.md', import.meta.url),
      'utf8',
    )

    expect(guide).toContain('Forbidden')
    expect(guide).toContain('Preferred')
    expect(tasteGuide).toContain('추천곡')
    expect(tasteGuide).toContain('searchKeywords')
    expect(curationGuide).toContain('candidateId')
    expect(curationGuide).toContain('정확히 5곡')
  })
})
