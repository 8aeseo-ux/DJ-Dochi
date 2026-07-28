import { describe, expect, it, vi } from 'vitest'
import type { BrowserOcrEngine, OcrDocument } from './types'
import { createBrowserOcrExtractor } from './browserOcrExtractor'

const APPLE_MUSIC_DOCUMENT: OcrDocument = {
  width: 1600,
  height: 1200,
  fullText: '노래 아티스트 앨범 시간 Ditto NewJeans',
  words: [
    { text: '노래', confidence: 95, box: { x0: 70, y0: 60, x1: 120, y1: 90 } },
    { text: '아티스트', confidence: 95, box: { x0: 710, y0: 60, x1: 800, y1: 90 } },
    { text: '앨범', confidence: 95, box: { x0: 1010, y0: 60, x1: 1060, y1: 90 } },
    { text: '시간', confidence: 95, box: { x0: 1280, y0: 60, x1: 1330, y1: 90 } },
    { text: 'Ditto', confidence: 96, box: { x0: 168, y0: 150, x1: 260, y1: 180 } },
    { text: 'NewJeans', confidence: 94, box: { x0: 710, y0: 150, x1: 850, y1: 180 } },
  ],
}

function validFile() {
  return new File(['playlist'], 'playlist.png', { type: 'image/png' })
}

describe('createBrowserOcrExtractor', () => {
  it('validates, recognizes, and parses an image locally', async () => {
    const recognize = vi.fn(async () => APPLE_MUSIC_DOCUMENT)
    const engine: BrowserOcrEngine = { recognize }
    const extractor = createBrowserOcrExtractor(engine)
    const file = validFile()

    const result = await extractor.extract(file)

    expect(extractor.id).toBe('browser-ocr')
    expect(recognize).toHaveBeenCalledWith(file, expect.any(Object))
    expect(result).toMatchObject({
      sourceApp: 'Apple Music',
      tracks: [{ title: 'Ditto', artist: 'NewJeans' }],
    })
  })

  it('rejects unsupported image types before invoking OCR', async () => {
    const recognize = vi.fn(async () => APPLE_MUSIC_DOCUMENT)
    const extractor = createBrowserOcrExtractor({ recognize })
    const file = new File(['playlist'], 'playlist.gif', { type: 'image/gif' })

    await expect(extractor.extract(file)).rejects.toMatchObject({
      code: 'UNSUPPORTED_IMAGE_TYPE',
    })
    expect(recognize).not.toHaveBeenCalled()
  })

  it('stops before OCR when the caller already aborted', async () => {
    const recognize = vi.fn(async () => APPLE_MUSIC_DOCUMENT)
    const extractor = createBrowserOcrExtractor({ recognize })
    const controller = new AbortController()
    controller.abort()

    await expect(extractor.extract(validFile(), {
      signal: controller.signal,
    })).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(recognize).not.toHaveBeenCalled()
  })

  it('maps OCR failures to a typed recognition error', async () => {
    const extractor = createBrowserOcrExtractor({
      recognize: vi.fn(async () => {
        throw new Error('worker crashed')
      }),
    })

    await expect(extractor.extract(validFile())).rejects.toMatchObject({
      code: 'OCR_RECOGNITION_FAILED',
      retryable: true,
    })
  })

  it('forwards OCR progress and emits parsing progress', async () => {
    const engine: BrowserOcrEngine = {
      recognize: vi.fn(async (_file, options) => {
        options?.onProgress?.({ phase: 'loading-engine', value: null })
        options?.onProgress?.({ phase: 'recognizing', value: 0.5 })
        return APPLE_MUSIC_DOCUMENT
      }),
    }
    const onProgress = vi.fn()

    await createBrowserOcrExtractor(engine).extract(validFile(), { onProgress })

    expect(onProgress.mock.calls.map(([progress]) => progress)).toEqual([
      { phase: 'loading-engine', value: null },
      { phase: 'recognizing', value: 0.5 },
      { phase: 'parsing', value: null },
    ])
  })
})
