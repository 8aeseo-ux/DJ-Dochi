import { readFileSync } from 'node:fs'
import { GenerateMixtapeRequestSchema } from '../src/types/mixtape'
import { MixtapeAnalysisError } from '../src/types/mixtapeAnalysis'
import type { MixtapeAnalysisIssue } from '../src/types/mixtapeAnalysis'
import { createLlmProvider } from './llm/provider'
import { createCatalogProviderChain } from './catalog/catalogProviderChain'
import { createItunesCatalogProvider } from './catalog/itunesCatalogProvider'
import { createMusicBrainzCatalogProvider } from './catalog/musicBrainzCatalogProvider'
import { verifyMixtapeRecommendations } from './catalog/verifyMixtapeRecommendations'
import { MIXTAPE_PIPELINE } from './mixtapePipelineConfig'

const JSON_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
}

const DOCHI_GUIDE_PROMPT = readFileSync(
  new URL('../prompts/dochi-mixtape-guide.md', import.meta.url),
  'utf8',
)

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  })
}

function errorResponse(issue: MixtapeAnalysisIssue, status: number) {
  return json({ error: issue }, status)
}

function statusForIssue(code: MixtapeAnalysisIssue['code']) {
  if (code === 'MISSING_API_KEY' || code === 'MISSING_MODEL' || code === 'PROVIDER_UNAVAILABLE') return 503
  if (code === 'REQUEST_TIMEOUT') return 504
  return 502
}

function issueFromUnknown(error: unknown): MixtapeAnalysisIssue {
  if (error instanceof MixtapeAnalysisError) {
    return { code: error.code, message: error.message, retryable: error.retryable }
  }

  return {
    code: 'ANALYSIS_FAILED',
    message: '취향 분석에 실패했어요. 잠시 후 다시 시도해주세요.',
    retryable: true,
  }
}

function createPipelineAbortContext(
  requestSignal: AbortSignal,
  budgetMs: number,
) {
  const controller = new AbortController()
  const abortFromRequest = () => controller.abort(requestSignal.reason)

  if (requestSignal.aborted) abortFromRequest()
  else requestSignal.addEventListener('abort', abortFromRequest, { once: true })

  const timeout = setTimeout(() => {
    controller.abort(new DOMException(
      'Mixtape pipeline processing budget exceeded',
      'TimeoutError',
    ))
  }, budgetMs)

  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timeout)
      requestSignal.removeEventListener('abort', abortFromRequest)
    },
  }
}

function logStage(
  stage: 'llm_initial' | 'catalog_verification',
  durationMs: number,
  elapsedMs: number,
  remainingMs: number,
) {
  console.info({
    event: 'pipeline_stage',
    stage,
    durationMs,
    elapsedMs,
    remainingMs,
  })
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'POST 요청만 사용할 수 있어요.',
          retryable: false,
        },
      }, 405, { Allow: 'POST' })
    }

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return errorResponse({
        code: 'INVALID_REQUEST',
        message: '요청 형식을 확인할 수 없어요.',
        retryable: false,
      }, 400)
    }

    const parsedRequest = GenerateMixtapeRequestSchema.safeParse(payload)
    if (!parsedRequest.success) {
      return errorResponse({
        code: 'INVALID_REQUEST',
        message: '확인된 곡 목록이 필요해요.',
        retryable: false,
      }, 400)
    }

    let provider: ReturnType<typeof createLlmProvider>
    try {
      provider = createLlmProvider({
        provider: process.env.LLM_PROVIDER,
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL,
        guidePrompt: DOCHI_GUIDE_PROMPT,
      })
    } catch (error) {
      const issue = issueFromUnknown(error)
      return errorResponse(issue, statusForIssue(issue.code))
    }

    const startedAt = Date.now()
    const deadlineAt = startedAt + MIXTAPE_PIPELINE.serverBudgetMs
    const abortContext = createPipelineAbortContext(
      request.signal,
      MIXTAPE_PIPELINE.serverBudgetMs,
    )

    try {
      const confirmedTracks = parsedRequest.data.tracks
      const llmStartedAt = Date.now()
      const draft = await provider.generateMixtape({
        tracks: confirmedTracks.map(({ title, artist, album }) => ({ title, artist, album })),
      }, { signal: abortContext.signal })
      logStage(
        'llm_initial',
        Date.now() - llmStartedAt,
        Date.now() - startedAt,
        Math.max(0, deadlineAt - Date.now()),
      )

      const catalog = createCatalogProviderChain({
        primary: createItunesCatalogProvider(),
        fallback: createMusicBrainzCatalogProvider(),
      })
      const catalogStartedAt = Date.now()
      const result = await verifyMixtapeRecommendations({
        draft,
        confirmedTracks,
        llmProvider: provider,
        catalog,
        signal: abortContext.signal,
        deadlineAt,
      })
      logStage(
        'catalog_verification',
        Date.now() - catalogStartedAt,
        Date.now() - startedAt,
        Math.max(0, deadlineAt - Date.now()),
      )
      console.info({
        event: 'pipeline_complete',
        status: 'success',
        durationMs: Date.now() - startedAt,
        verifiedCount: result.mixtape.tracks.length,
        partialResult: result.mixtape.tracks.length < draft.mixtape.tracks.length,
      })
      return json(result)
    } catch (error) {
      const issue = issueFromUnknown(error)
      console.warn({
        event: 'pipeline_complete',
        status: 'error',
        durationMs: Date.now() - startedAt,
        code: issue.code,
      })
      return errorResponse(issue, statusForIssue(issue.code))
    } finally {
      abortContext.dispose()
    }
  },
}
