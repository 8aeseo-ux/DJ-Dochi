import { describe, expect, it } from 'vitest'
import {
  GenerateMixtapeRequestSchema,
  MixtapeResultSchema,
} from './mixtape'

const PLATFORM_REFS = {
  spotify: { id: null, url: null },
  appleMusic: { id: null, url: null },
  youtubeMusic: { id: null, url: null },
}

const VALID_RESULT = {
  tasteProfile: {
    summary: '잔잔한 보컬과 몽환적인 신스를 좋아해요.',
    genres: ['dream pop'],
    moods: ['late night'],
    traits: ['soft vocals'],
  },
  mixtape: {
    title: '새벽 두 시의 창문',
    subtitle: 'soft lights, slow streets',
    dochiComment: '밤에 음악 많이 듣지?',
    design: {
      atmosphere: '새벽의 네온과 부드러운 공기',
      palette: ['midnight blue', 'warm coral'],
      texture: 'matte cassette plastic',
      motifs: ['window light', 'tiny stars'],
    },
    tracks: [
      {
        id: 'recommendation-001',
        title: 'Space Song',
        artist: 'Beach House',
        album: '',
        reason: '입력곡의 몽환적인 질감과 자연스럽게 이어져요.',
        catalogStatus: 'verified',
        platforms: PLATFORM_REFS,
      },
    ],
  },
}

describe('Mixtape schemas', () => {
  it('accepts a structured mixtape result with future platform references', () => {
    expect(MixtapeResultSchema.safeParse(VALID_RESULT).success).toBe(true)
  })

  it('rejects a recommendation that is not explicitly verified', () => {
    const invalidResult = {
      ...VALID_RESULT,
      mixtape: {
        ...VALID_RESULT.mixtape,
        tracks: [{ ...VALID_RESULT.mixtape.tracks[0], catalogStatus: 'unverified' }],
      },
    }

    expect(MixtapeResultSchema.safeParse(invalidResult).success).toBe(false)
  })

  it('rejects a result with missing taste profile fields', () => {
    const invalidResult = {
      ...VALID_RESULT,
      tasteProfile: { summary: VALID_RESULT.tasteProfile.summary },
    }

    expect(MixtapeResultSchema.safeParse(invalidResult).success).toBe(false)
  })

  it('accepts only a non-empty confirmed track list in the generation request', () => {
    const validRequest = {
      tracks: [{ id: 'track-001', title: 'Ditto', artist: 'NewJeans', album: '' }],
    }
    const emptyRequest = { tracks: [] }

    expect(GenerateMixtapeRequestSchema.safeParse(validRequest).success).toBe(true)
    expect(GenerateMixtapeRequestSchema.safeParse(emptyRequest).success).toBe(false)
  })

  it('rejects extraction-only fields from the LLM request boundary', () => {
    const requestWithConfidence = {
      tracks: [{ id: 'track-001', title: 'Ditto', artist: 'NewJeans', album: '', confidence: 0.9 }],
    }

    expect(GenerateMixtapeRequestSchema.safeParse(requestWithConfidence).success).toBe(false)
  })
})
