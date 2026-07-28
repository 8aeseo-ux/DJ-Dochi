import { PlaylistAnalysisError } from '../../types/playlistAnalysis'
import { createBrowserOcrExtractor } from './browserOcrExtractor'
import {
  createOpenAiVisionExtractor,
} from './openaiVisionExtractor'
import type { OpenAiVisionDependencies } from './openaiVisionExtractor'
import type {
  BrowserOcrEngine,
  PlaylistExtractor,
  PlaylistExtractorId,
} from './types'

export type PlaylistExtractorDependencies = {
  ocrEngine?: BrowserOcrEngine
  vision?: OpenAiVisionDependencies
}

let sharedTesseractEngine: BrowserOcrEngine | null = null

const lazyTesseractEngine: BrowserOcrEngine = {
  async recognize(file, options) {
    if (!sharedTesseractEngine) {
      const { createTesseractOcrEngine } = await import('./tesseractOcrEngine')
      sharedTesseractEngine = createTesseractOcrEngine()
    }
    return sharedTesseractEngine.recognize(file, options)
  },
}

function providerUnavailable(id: string): PlaylistAnalysisError {
  return new PlaylistAnalysisError({
    code: 'PROVIDER_UNAVAILABLE',
    message: `사용할 수 없는 이미지 분석 방식이에요: ${id}`,
    retryable: false,
  })
}

export function createPlaylistExtractor(
  id: PlaylistExtractorId = 'openai-vision',
  dependencies: PlaylistExtractorDependencies = {},
): PlaylistExtractor {
  if (id === 'browser-ocr') {
    return createBrowserOcrExtractor(dependencies.ocrEngine ?? lazyTesseractEngine)
  }

  if (id === 'openai-vision') {
    return createOpenAiVisionExtractor(dependencies.vision)
  }

  throw providerUnavailable(id)
}
