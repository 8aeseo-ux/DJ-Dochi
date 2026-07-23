import { validatePlaylistImage } from '../../config/playlistAnalysis'
import { PlaylistAnalysisError } from '../../types/playlistAnalysis'
import { parseOcrDocument } from './parseOcrDocument'
import type {
  BrowserOcrEngine,
  ExtractPlaylistOptions,
  PlaylistExtractor,
} from './types'

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return
  throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError')
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function createBrowserOcrExtractor(
  engine: BrowserOcrEngine,
): PlaylistExtractor {
  return {
    id: 'browser-ocr',
    async extract(file: File, options: ExtractPlaylistOptions = {}) {
      const validationIssue = validatePlaylistImage(file)
      if (validationIssue) throw new PlaylistAnalysisError(validationIssue)
      throwIfAborted(options.signal)

      try {
        const document = await engine.recognize(file, options)
        throwIfAborted(options.signal)
        options.onProgress?.({ phase: 'parsing', value: null })
        return parseOcrDocument(document)
      } catch (error) {
        if (error instanceof PlaylistAnalysisError || isAbortError(error)) throw error

        throw new PlaylistAnalysisError({
          code: 'OCR_RECOGNITION_FAILED',
          message: '이 기기에서 이미지를 읽지 못했어요. 다시 시도해주세요.',
          retryable: true,
        }, { cause: error })
      }
    },
  }
}
