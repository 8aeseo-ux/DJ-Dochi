import { parseMixtapeResult, type ConfirmedTrack, type MixtapeResult } from '../types/mixtape'
import { MixtapeAnalysisError } from '../types/mixtapeAnalysis'
import type { MixtapeAnalysisIssue, MixtapeAnalysisStage } from '../types/mixtapeAnalysis'

const DEFAULT_TIMEOUT_MS = 45_000

export type GenerateMixtapeOptions = {
  signal?: AbortSignal
  timeoutMs?: number
}

function parseServerIssue(value: unknown): MixtapeAnalysisIssue | null {
  if (!value || typeof value !== 'object' || !('error' in value)) return null
  const error = value.error
  if (!error || typeof error !== 'object') return null
  if (!('code' in error) || !('message' in error) || !('retryable' in error)) return null
  if (typeof error.code !== 'string' || typeof error.message !== 'string' || typeof error.retryable !== 'boolean') return null
  const stage = 'stage' in error && isMixtapeAnalysisStage(error.stage)
    ? error.stage
    : 'taste'

  return {
    code: error.code as MixtapeAnalysisIssue['code'],
    stage,
    message: error.message,
    retryable: error.retryable,
  }
}

function isMixtapeAnalysisStage(value: unknown): value is MixtapeAnalysisStage {
  return value === 'taste' || value === 'catalog' || value === 'curation'
}

export async function generateMixtapeFromTracks(
  tracks: readonly ConfirmedTrack[],
  options: GenerateMixtapeOptions = {},
): Promise<MixtapeResult> {
  const controller = new AbortController()
  let timedOut = false
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const timeout = globalThis.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const abortExternal = () => controller.abort()

  if (options.signal) {
    if (options.signal.aborted) controller.abort()
    else options.signal.addEventListener('abort', abortExternal, { once: true })
  }

  try {
    const response = await fetch('/api/generate-mixtape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tracks }),
      signal: controller.signal,
    })

    let payload: unknown
    try {
      payload = await response.json()
    } catch (error) {
      throw new MixtapeAnalysisError({
        code: 'INVALID_RESPONSE',
        stage: 'curation',
        message: '서버 응답을 읽을 수 없어요. 다시 시도해주세요.',
        retryable: true,
      }, { cause: error })
    }

    if (!response.ok) {
      const issue = parseServerIssue(payload)
      throw new MixtapeAnalysisError(issue ?? {
        code: 'ANALYSIS_FAILED',
        stage: 'taste',
        message: '취향 분석에 실패했어요. 다시 시도해주세요.',
        retryable: true,
      })
    }

    return parseMixtapeResult(payload)
  } catch (error) {
    if (error instanceof MixtapeAnalysisError) throw error

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new MixtapeAnalysisError({
        code: timedOut ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR',
        stage: 'taste',
        message: timedOut
          ? '취향 분석 시간이 너무 오래 걸렸어요. 다시 시도해주세요.'
          : '취향 분석 요청이 중단되었어요. 다시 시도해주세요.',
        retryable: true,
      }, { cause: error })
    }

    throw new MixtapeAnalysisError({
      code: 'NETWORK_ERROR',
      stage: 'taste',
      message: '취향 분석 서버에 연결하지 못했어요. 다시 시도해주세요.',
      retryable: true,
    }, { cause: error })
  } finally {
    globalThis.clearTimeout(timeout)
    options.signal?.removeEventListener('abort', abortExternal)
  }
}
