import { describe, expect, it, vi } from 'vitest'
import type { BrowserOcrEngine } from './types'
import { createPlaylistExtractor } from './createPlaylistExtractor'

const fakeEngine: BrowserOcrEngine = {
  recognize: vi.fn(async () => ({
    width: 1,
    height: 1,
    words: [],
    fullText: '',
  })),
}

describe('createPlaylistExtractor', () => {
  it('uses AI Vision as the default while preserving browser OCR as an option', () => {
    expect(createPlaylistExtractor(undefined, { ocrEngine: fakeEngine }).id).toBe('openai-vision')
    expect(createPlaylistExtractor('browser-ocr', { ocrEngine: fakeEngine }).id).toBe('browser-ocr')
  })

  it('creates the OpenAI Vision adapter when selected', () => {
    expect(createPlaylistExtractor('openai-vision', {
      vision: { fetchImpl: vi.fn() },
    }).id).toBe('openai-vision')
  })

  it('rejects an unsupported provider id with a typed error', () => {
    expect(() => createPlaylistExtractor('unknown' as never)).toThrow(
      expect.objectContaining({
        code: 'PROVIDER_UNAVAILABLE',
        retryable: false,
      }),
    )
  })
})
