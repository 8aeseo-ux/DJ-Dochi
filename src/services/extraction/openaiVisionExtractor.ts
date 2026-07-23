import { z } from 'zod'
import {
  PLAYLIST_EXTRACTION_TIMEOUT_MS,
  validatePlaylistImage,
} from '../../config/playlistAnalysis'
import {
  PlaylistAnalysisError,
  parsePlaylistExtractionResult,
} from '../../types/playlistAnalysis'
import type { ExtractPlaylistOptions, PlaylistExtractor } from './types'
import { resolveApiUrl } from '../../config/api'

const ApiErrorSchema = z.object({
  error: z.object({
    code: z.enum([
      'UNSUPPORTED_IMAGE_TYPE',
      'IMAGE_TOO_LARGE',
      'OCR_ENGINE_FAILED',
      'OCR_RECOGNITION_FAILED',
      'NO_TRACKS_FOUND',
      'PROVIDER_UNAVAILABLE',
      'REQUEST_TIMEOUT',
      'NETWORK_ERROR',
      'INVALID_RESPONSE',
      'MISSING_IMAGE',
      'MISSING_API_KEY',
      'MISSING_MODEL',
      'ORIGIN_NOT_ALLOWED',
      'ANALYSIS_FAILED',
    ]),
    message: z.string(),
    retryable: z.boolean(),
  }).strict(),
}).strict()

export type OpenAiVisionDependencies = {
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export function createOpenAiVisionExtractor(
  dependencies: OpenAiVisionDependencies = {},
): PlaylistExtractor {
  return {
    id: 'openai-vision',
    async extract(file: File, options: ExtractPlaylistOptions = {}) {
      const validationIssue = validatePlaylistImage(file)
      if (validationIssue) throw new PlaylistAnalysisError(validationIssue)

      const controller = new AbortController()
      const fetchImpl = dependencies.fetchImpl ?? fetch
      const timeoutMs = dependencies.timeoutMs ?? PLAYLIST_EXTRACTION_TIMEOUT_MS
      let didTimeout = false

      const abortFromCaller = () => controller.abort(options.signal?.reason)
      if (options.signal?.aborted) abortFromCaller()
      else options.signal?.addEventListener('abort', abortFromCaller, { once: true })

      const timeout = globalThis.setTimeout(() => {
        didTimeout = true
        controller.abort()
      }, timeoutMs)

      try {
        const body = new FormData()
        body.append('image', file)

        const response = await fetchImpl(resolveApiUrl('/api/extract-playlist'), {
          method: 'POST',
          body,
          signal: controller.signal,
        })

        const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
        const isJsonResponse = contentType.includes('application/json')

        if (!response.ok) {
          if (isJsonResponse) {
            let errorPayload: unknown
            try {
              errorPayload = await response.json()
            } catch {
              errorPayload = null
            }

            const parsedError = ApiErrorSchema.safeParse(errorPayload)
            if (parsedError.success) {
              throw new PlaylistAnalysisError(parsedError.data.error)
            }
          }

          throw new PlaylistAnalysisError({
            code: 'ANALYSIS_FAILED',
            message: '이미지를 분석하지 못했어요. 잠시 후 다시 시도해주세요.',
            retryable: true,
          })
        }

        if (!isJsonResponse) {
          throw new PlaylistAnalysisError({
            code: 'INVALID_RESPONSE',
            message: '서버 응답을 확인할 수 없어요. 다시 시도해주세요.',
            retryable: true,
          })
        }

        let payload: unknown
        try {
          payload = await response.json()
        } catch (error) {
          throw new PlaylistAnalysisError({
            code: 'INVALID_RESPONSE',
            message: '서버 응답을 확인할 수 없어요. 다시 시도해주세요.',
            retryable: true,
          }, { cause: error })
        }

        return parsePlaylistExtractionResult(payload)
      } catch (error) {
        if (error instanceof PlaylistAnalysisError) throw error

        if (didTimeout) {
          throw new PlaylistAnalysisError({
            code: 'REQUEST_TIMEOUT',
            message: '이미지 분석 시간이 너무 오래 걸렸어요. 다시 시도해주세요.',
            retryable: true,
          }, { cause: error })
        }

        throw new PlaylistAnalysisError({
          code: 'NETWORK_ERROR',
          message: '네트워크 연결을 확인한 뒤 다시 시도해주세요.',
          retryable: true,
        }, { cause: error })
      } finally {
        globalThis.clearTimeout(timeout)
        options.signal?.removeEventListener('abort', abortFromCaller)
      }
    },
  }
}
