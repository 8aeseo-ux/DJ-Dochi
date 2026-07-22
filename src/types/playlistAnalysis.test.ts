import { describe, expect, it } from 'vitest'
import {
  MAX_PLAYLIST_IMAGE_BYTES,
  validatePlaylistImage,
} from '../config/playlistAnalysis'
import {
  PlaylistAnalysisError,
  parsePlaylistExtractionResult,
} from './playlistAnalysis'

describe('playlist image validation', () => {
  it.each(['image/png', 'image/jpeg', 'image/webp'])('accepts %s within the size limit', (type) => {
    const file = new File(['playlist'], 'playlist-image', { type })

    expect(validatePlaylistImage(file)).toBeNull()
  })

  it('rejects unsupported image types', () => {
    const file = new File(['playlist'], 'playlist.gif', { type: 'image/gif' })

    expect(validatePlaylistImage(file)).toMatchObject({
      code: 'UNSUPPORTED_IMAGE_TYPE',
      retryable: false,
    })
  })

  it('rejects files over 4 MiB', () => {
    const file = new File([new Uint8Array(MAX_PLAYLIST_IMAGE_BYTES + 1)], 'large.png', { type: 'image/png' })

    expect(validatePlaylistImage(file)).toMatchObject({
      code: 'IMAGE_TOO_LARGE',
      retryable: false,
    })
  })
})

describe('playlist extraction response parsing', () => {
  it('parses a valid extraction response', () => {
    const result = parsePlaylistExtractionResult({
      sourceApp: 'Apple Music',
      tracks: [
        {
          id: 'track-001',
          title: 'Ditto',
          artist: 'NewJeans',
          album: '',
          confidence: 0.95,
        },
      ],
      warnings: [],
    })

    expect(result.tracks[0]).toMatchObject({ title: 'Ditto', artist: 'NewJeans' })
  })

  it('throws a typed error for malformed extraction JSON', () => {
    expect(() => parsePlaylistExtractionResult({ sourceApp: null, tracks: [{ title: 'No artist' }] }))
      .toThrowError(PlaylistAnalysisError)

    try {
      parsePlaylistExtractionResult({ sourceApp: null, tracks: 'not-an-array', warnings: [] })
    } catch (error) {
      expect(error).toMatchObject({ code: 'INVALID_RESPONSE', retryable: true })
    }
  })
})
