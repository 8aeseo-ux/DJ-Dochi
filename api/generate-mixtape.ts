import { readFileSync } from 'node:fs'
import { GenerateMixtapeRequestSchema } from '../src/types/mixtape'
import { MixtapeAnalysisError } from '../src/types/mixtapeAnalysis'
import type {
  MixtapeAnalysisIssue,
  MixtapeAnalysisStage,
} from '../src/types/mixtapeAnalysis'
import { assembleVerifiedMixtape } from './catalog/assembleVerifiedMixtape'
import { buildCatalogSearchPlan } from './catalog/buildCatalogSearchPlan'
import { collectCatalogCandidates } from './catalog/collectCatalogCandidates'
import { createItunesCatalogProvider } from './catalog/itunesCatalogProvider'
import { createMusicBrainzCatalogProvider } from './catalog/musicBrainzCatalogProvider'
import { shortlistCatalogCandidates } from './catalog/rankCatalogCandidates'
import { createLlmProvider } from './llm/provider'
import { MIXTAPE_PIPELINE } from './mixtapePipelineConfig'

const JSON_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
}

const BASE_GUIDE_PROMPT = readFileSync(
  new URL('../prompts/dochi-mixtape-guide.md', import.meta.url),
  'utf8',
)
const TASTE_GUIDE_PROMPT = readFileSync(
  new URL('../prompts/dochi-taste-guide.md', import.meta.url),
  'utf8',
)
const CURATION_GUIDE_PROMPT = readFileSync(
  new URL('../prompts/dochi-curation-guide.md', import.meta.url),
  'utf8',
)

type PipelineStage =
  | 'taste_analysis'
  | 'catalog_discovery'
  | 'candidate_ranking'
  | 'mixtape_curation'
  | 'result_assembly'

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
  if (
    code === 'MISSING_API_KEY'
    || code === 'MISSING_MODEL'
    || code === 'PROVIDER_UNAVAILABLE'
  ) return 503
  if (code === 'REQUEST_TIMEOUT') return 504
  return 502
}

function issueFromUnknown(
  error: unknown,
  fallbackStage: MixtapeAnalysisStage,
): MixtapeAnalysisIssue {
  if (error instanceof MixtapeAnalysisError) {
    return {
      code: error.code,
      stage: error.stage,
      message: error.message,
      retryable: error.retryable,
    }
  }

  return {
    code: 'ANALYSIS_FAILED',
    stage: fallbackStage,
    message: fallbackStage === 'catalog'
      ? '취향은 읽었지만 확인되는 추천곡 후보를 모으지 못했어요.'
      : fallbackStage === 'curation'
        ? '곡을 고르는 중에 문제가 생겼어요. 다시 시도해주세요.'
        : '취향 분석에 실패했어요. 잠시 후 다시 시도해주세요.',
    retryable: true,
  }
}

function insufficientCatalogCandidates(): never {
  throw new MixtapeAnalysisError({
    code: 'CATALOG_CANDIDATES_INSUFFICIENT',
    stage: 'catalog',
    message: '확인되는 추천곡 후보를 충분히 모으지 못했어요.',
    retryable: true,
  })
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
  stage: PipelineStage,
  stageStartedAt: number,
  pipelineStartedAt: number,
  deadlineAt: number,
  metrics: Record<string, number> = {},
) {
  const endedAt = Date.now()
  console.info({
    event: 'pipeline_stage',
    stage,
    durationMs: endedAt - stageStartedAt,
    elapsedMs: endedAt - pipelineStartedAt,
    remainingMs: Math.max(0, deadlineAt - endedAt),
    ...metrics,
  })
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return json({
        error: {
          code: 'INVALID_REQUEST',
          stage: 'taste',
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
        stage: 'taste',
        message: '요청 형식을 확인할 수 없어요.',
        retryable: false,
      }, 400)
    }

    const parsedRequest = GenerateMixtapeRequestSchema.safeParse(payload)
    if (!parsedRequest.success) {
      return errorResponse({
        code: 'INVALID_REQUEST',
        stage: 'taste',
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
        guidePrompt: BASE_GUIDE_PROMPT,
        tasteGuidePrompt: TASTE_GUIDE_PROMPT,
        curationGuidePrompt: CURATION_GUIDE_PROMPT,
      })
    } catch (error) {
      const issue = issueFromUnknown(error, 'taste')
      return errorResponse(issue, statusForIssue(issue.code))
    }

    const startedAt = Date.now()
    const deadlineAt = startedAt + MIXTAPE_PIPELINE.serverBudgetMs
    const abortContext = createPipelineAbortContext(
      request.signal,
      MIXTAPE_PIPELINE.serverBudgetMs,
    )
    let activeStage: MixtapeAnalysisStage = 'taste'

    try {
      const confirmedTracks = parsedRequest.data.tracks
      const tasteStartedAt = Date.now()
      const tasteProfile = await provider.analyzeTaste({
        tracks: confirmedTracks.map(({ title, artist, album }) => ({
          title,
          artist,
          album,
        })),
      }, { signal: abortContext.signal })
      logStage('taste_analysis', tasteStartedAt, startedAt, deadlineAt)

      const plan = buildCatalogSearchPlan(tasteProfile, confirmedTracks)
      activeStage = 'catalog'
      const itunes = createItunesCatalogProvider()
      const musicBrainz = createMusicBrainzCatalogProvider()
      const discoveryStartedAt = Date.now()
      const collection = await collectCatalogCandidates({
        plan,
        tasteProfile,
        confirmedTracks,
        itunes,
        musicBrainz,
        signal: abortContext.signal,
        deadlineAt,
      })
      logStage(
        'catalog_discovery',
        discoveryStartedAt,
        startedAt,
        deadlineAt,
        {
          rawCandidateCount: collection.tracks.length,
          attemptedSeeds: collection.attemptedSeeds,
          itunesCalls: collection.itunesCalls,
          musicBrainzCalls: collection.musicBrainzCalls,
          unavailableCalls: collection.unavailableCalls,
        },
      )
      if (
        collection.tracks.length
        < MIXTAPE_PIPELINE.minimumRawCandidates
      ) {
        insufficientCatalogCandidates()
      }

      const rankingStartedAt = Date.now()
      const shortlist = shortlistCatalogCandidates(collection.tracks, {
        tasteProfile,
        inputArtists: new Set(
          confirmedTracks.map(({ artist }) => artist),
        ),
      })
      if (
        shortlist.length
        < MIXTAPE_PIPELINE.minimumShortlistCandidates
      ) {
        insufficientCatalogCandidates()
      }
      logStage(
        'candidate_ranking',
        rankingStartedAt,
        startedAt,
        deadlineAt,
        { shortlistCount: shortlist.length },
      )

      const candidates = shortlist.map(({ id, title, artist }) => ({
        candidateId: id,
        title,
        artist,
      }))
      activeStage = 'curation'
      let lastCurationError: unknown

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const curationStartedAt = Date.now()
          const selection = await provider.curateMixtape({
            tasteProfile,
            candidates,
          }, { signal: abortContext.signal })
          logStage(
            'mixtape_curation',
            curationStartedAt,
            startedAt,
            deadlineAt,
            { curationAttempt: attempt + 1 },
          )

          const assemblyStartedAt = Date.now()
          const result = assembleVerifiedMixtape({
            tasteProfile,
            selection,
            shortlist,
            confirmedTracks,
          })
          logStage(
            'result_assembly',
            assemblyStartedAt,
            startedAt,
            deadlineAt,
            { selectedCount: result.mixtape.tracks.length },
          )
          console.info({
            event: 'pipeline_complete',
            status: 'success',
            durationMs: Date.now() - startedAt,
            selectedCount: result.mixtape.tracks.length,
          })
          return json(result)
        } catch (error) {
          lastCurationError = error
          const retryableSelectionError = (
            error instanceof MixtapeAnalysisError
            && error.code === 'CURATION_INVALID_RESPONSE'
          )
          const hasTimeForRetry = (
            Date.now()
            < deadlineAt - MIXTAPE_PIPELINE.stopBufferMs
          )
          if (
            attempt === 0
            && retryableSelectionError
            && hasTimeForRetry
          ) {
            continue
          }
          throw error
        }
      }

      throw lastCurationError
    } catch (error) {
      const issue = issueFromUnknown(error, activeStage)
      console.warn({
        event: 'pipeline_complete',
        status: 'error',
        durationMs: Date.now() - startedAt,
        code: issue.code,
        stage: issue.stage,
      })
      return errorResponse(issue, statusForIssue(issue.code))
    } finally {
      abortContext.dispose()
    }
  },
}
