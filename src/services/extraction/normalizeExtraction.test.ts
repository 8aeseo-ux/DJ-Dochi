import { describe, expect, it } from 'vitest'
import { normalizeExtraction } from './normalizeExtraction'

describe('normalizeExtraction', () => {
  it('normalizes fields, removes duplicates, and assigns deterministic ids', () => {
    const result = normalizeExtraction({
      sourceApp: ' Apple Music ',
      tracks: [
        {
          title: '  Your   Dog Loves You (feat. Crush) ',
          artist: ' Colde ',
          album: ' Your Dog Loves You ',
          confidence: 1.2,
        },
        {
          title: 'your dog loves you (feat. crush)',
          artist: 'colde',
          album: 'duplicate',
          confidence: 0.4,
        },
        {
          title: ' Car Crash ',
          artist: ' eaJ ',
          album: '',
          confidence: 0.76,
        },
        {
          title: 'Incomplete',
          artist: ' ',
          album: '',
          confidence: -1,
        },
      ],
      warnings: ['  일부 앨범명은 읽지 못했어요.  '],
    })

    expect(result).toEqual({
      sourceApp: 'Apple Music',
      tracks: [
        {
          id: 'track-001',
          title: 'Your Dog Loves You (feat. Crush)',
          artist: 'Colde',
          album: 'Your Dog Loves You',
          confidence: 1,
        },
        {
          id: 'track-002',
          title: 'Car Crash',
          artist: 'eaJ',
          album: '',
          confidence: 0.76,
        },
      ],
      warnings: ['일부 앨범명은 읽지 못했어요.'],
    })
  })

  it('returns one actionable warning when no complete track rows remain', () => {
    const result = normalizeExtraction({
      sourceApp: ' ',
      tracks: [
        {
          title: 'Only a title',
          artist: '',
          album: '',
          confidence: 0.8,
        },
      ],
      warnings: [],
    })

    expect(result).toEqual({
      sourceApp: null,
      tracks: [],
      warnings: ['곡명과 아티스트가 함께 보이는 항목을 찾지 못했어요.'],
    })
  })

  it('does not duplicate the empty-result warning', () => {
    const result = normalizeExtraction({
      sourceApp: null,
      tracks: [],
      warnings: ['곡명과 아티스트가 함께 보이는 항목을 찾지 못했어요.'],
    })

    expect(result.warnings).toEqual([
      '곡명과 아티스트가 함께 보이는 항목을 찾지 못했어요.',
    ])
  })
})
