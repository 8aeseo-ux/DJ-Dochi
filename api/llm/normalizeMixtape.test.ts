// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { normalizeMixtapeDraftCandidates } from './normalizeMixtape'
import type { LlmMixtapeDraft } from '../../src/services/llm/types'

const DRAFT: LlmMixtapeDraft = {
  tasteProfile: {
    summary: '몽환적인 밤의 질감을 좋아해요.',
    genres: ['dream pop'],
    moods: ['late night'],
    traits: ['soft vocals'],
  },
  mixtape: {
    title: '새벽 두 시의 창문',
    subtitle: 'soft lights, slow streets',
    dochiComment: '밤에 음악 많이 듣지?',
    design: {
      atmosphere: '조용한 네온빛',
      palette: ['midnight blue', 'coral'],
      texture: 'matte plastic',
      motifs: ['window light'],
    },
    tracks: [
      {
        title: 'Ditto',
        artist: 'NewJeans',
        album: '',
        reason: '입력 목록에 이미 있는 곡이라 제거되어야 해요.',
      },
      {
        title: 'Space Song',
        artist: 'Beach House',
        album: '',
        reason: '입력곡의 몽환적인 결을 자연스럽게 이어가요.',
      },
    ],
  },
}

describe('normalizeMixtapeDraft', () => {
  it('removes input-song duplicates before catalog verification', () => {
    const result = normalizeMixtapeDraftCandidates(DRAFT, [
      { id: 'track-001', title: 'ditto', artist: 'newjeans', album: '' },
    ])

    expect(result.candidates).toEqual([{
      title: 'Space Song',
      artist: 'Beach House',
      album: '',
      reason: '입력곡의 몽환적인 결을 자연스럽게 이어가요.',
    }])
    expect(result.metadata).toMatchObject({
      title: '새벽 두 시의 창문',
      subtitle: 'soft lights, slow streets',
    })
  })

  it('fails when the model returns no usable recommendation after duplicate removal', () => {
    expect(() => normalizeMixtapeDraftCandidates({
      ...DRAFT,
      mixtape: { ...DRAFT.mixtape, tracks: [DRAFT.mixtape.tracks[0]] },
    }, [{ id: 'track-001', title: 'Ditto', artist: 'NewJeans', album: '' }])).toThrowError(
      expect.objectContaining({ code: 'INVALID_RESPONSE', retryable: true }),
    )
  })
})
