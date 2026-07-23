import { describe, expect, it, vi } from 'vitest'
import type { PlaylistExtractor, PlaylistExtractorId } from './extraction/types'
import { createPlaylistAnalysisService } from './playlistAnalysis'

const RESULT = {
  sourceApp: 'Apple Music',
  tracks: [{
    id: 'track-001',
    title: 'Car Crash',
    artist: 'eaJ',
    album: '',
    confidence: 0.92,
  }],
  warnings: [],
}

describe('createPlaylistAnalysisService', () => {
  it('delegates to AI Vision when no provider is specified', async () => {
    const extract = vi.fn(async () => RESULT)
    const factory = vi.fn((_id?: PlaylistExtractorId): PlaylistExtractor => ({
      id: 'openai-vision',
      extract,
    }))
    const service = createPlaylistAnalysisService(factory)
    const file = new File(['playlist'], 'playlist.png', { type: 'image/png' })

    const result = await service(file)

    expect(factory).toHaveBeenCalledWith('openai-vision')
    expect(extract).toHaveBeenCalledWith(file, {
      signal: undefined,
      onProgress: undefined,
    })
    expect(result).toEqual(RESULT)
  })

  it('delegates to Vision only when its provider id is explicit', async () => {
    const extract = vi.fn(async () => RESULT)
    const factory = vi.fn((_id?: PlaylistExtractorId): PlaylistExtractor => ({
      id: 'openai-vision',
      extract,
    }))
    const service = createPlaylistAnalysisService(factory)
    const file = new File(['playlist'], 'playlist.webp', { type: 'image/webp' })

    await service(file, { extractorId: 'openai-vision' })

    expect(factory).toHaveBeenCalledWith('openai-vision')
    expect(extract).toHaveBeenCalledTimes(1)
  })

  it('forwards cancellation and progress to the selected adapter', async () => {
    const extract = vi.fn(async () => RESULT)
    const service = createPlaylistAnalysisService(() => ({
      id: 'browser-ocr',
      extract,
    }))
    const controller = new AbortController()
    const onProgress = vi.fn()
    const file = new File(['playlist'], 'playlist.jpg', { type: 'image/jpeg' })

    await service(file, {
      signal: controller.signal,
      onProgress,
    })

    expect(extract).toHaveBeenCalledWith(file, {
      signal: controller.signal,
      onProgress,
    })
  })
})
