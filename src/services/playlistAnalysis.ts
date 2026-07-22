import { z } from 'zod'
import {
  PLAYLIST_EXTRACTION_TIMEOUT_MS,
  validatePlaylistImage,
} from '../config/playlistAnalysis'
import {
  PlaylistAnalysisError,
  parsePlaylistExtractionResult,
} from '../types/playlistAnalysis'
import type { PlaylistExtractionResult } from '../types/playlistAnalysis'

const ApiErrorSchema = z.object({
  error: z.object({
    code: z.enum([
      'UNSUPPORTED_IMAGE_TYPE',
      'IMAGE_TOO_LARGE',
      'REQUEST_TIMEOUT',
      'NETWORK_ERROR',
      'INVALID_RESPONSE',
      'MISSING_IMAGE',
      'MISSING_API_KEY',
      'ANALYSIS_FAILED',
    ]),
    message: z.string(),
    retryable: z.boolean(),
  }).strict(),
}).strict()

type ExtractPlaylistOptions = {
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export async function extractPlaylistFromImage(
  file: File,
  options: ExtractPlaylistOptions = {},
): Promise<PlaylistExtractionResult> {
  const validationIssue = validatePlaylistImage(file)
  if (validationIssue) throw new PlaylistAnalysisError(validationIssue)

  const controller = new AbortController()
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? PLAYLIST_EXTRACTION_TIMEOUT_MS
  let didTimeout = false

  const abortFromCaller = () => controller.abort(options.signal?.reason)
  if (options.signal?.aborted) abortFromCaller()
  else options.signal?.addEventListener('abort', abortFromCaller, { once: true })

  const timeout = window.setTimeout(() => {
    didTimeout = true
    controller.abort()
  }, timeoutMs)

  try {
    const body = new FormData()
    body.append('image', file)

    const response = await fetchImpl('/api/extract-playlist', {
      method: 'POST',
      body,
      signal: controller.signal,
    })

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

    if (!response.ok) {
      const parsedError = ApiErrorSchema.safeParse(payload)
      if (parsedError.success) throw new PlaylistAnalysisError(parsedError.data.error)

      throw new PlaylistAnalysisError({
        code: 'ANALYSIS_FAILED',
        message: '이미지를 분석하지 못했어요. 잠시 후 다시 시도해주세요.',
        retryable: true,
      })
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
    window.clearTimeout(timeout)
    options.signal?.removeEventListener('abort', abortFromCaller)
  }
}
