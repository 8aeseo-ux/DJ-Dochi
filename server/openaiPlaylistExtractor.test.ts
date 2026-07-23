// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { normalizeExtractionResult } from './openaiPlaylistExtractor'

describe('normalizeExtractionResult', () => {
  it('trims fields, removes duplicates, and assigns stable IDs', () => {
    const result = normalizeExtractionResult({
      sourceApp: ' Spotify ',
      tracks: [
        { title: ' Space Song ', artist: ' Beach House ', album: ' Depression Cherry ', confidence: 0.98 },
        { title: 'space song', artist: 'beach house', album: '', confidence: 0.9 },
        { title: 'Ditto', artist: 'NewJeans', album: '', confidence: 1.2 },
      ],
      warnings: [],
    })

    expect(result.sourceApp).toBe('Spotify')
    expect(result.tracks).toEqual([
      {
        id: 'track-001',
        title: 'Space Song',
        artist: 'Beach House',
        album: 'Depression Cherry',
        confidence: 0.98,
      },
      {
        id: 'track-002',
        title: 'Ditto',
        artist: 'NewJeans',
        album: '',
        confidence: 1,
      },
    ])
  })

  it('drops incomplete rows and adds a warning instead of guessing', () => {
    const result = normalizeExtractionResult({
      sourceApp: null,
      tracks: [
        { title: 'Visible title', artist: '', album: '', confidence: 0.4 },
      ],
      warnings: [],
    })

    expect(result.tracks).toEqual([])
    expect(result.warnings).toContain('곡명과 아티스트를 모두 확인할 수 없는 항목은 제외했어요.')
  })
})
