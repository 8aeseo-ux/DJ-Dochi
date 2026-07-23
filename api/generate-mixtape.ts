import { readFileSync } from 'node:fs'
import { GenerateMixtapeRequestSchema } from '../src/types/mixtape'
import { MixtapeAnalysisError } from '../src/types/mixtapeAnalysis'
import type { MixtapeAnalysisIssue } from '../src/types/mixtapeAnalysis'
import { createLlmProvider } from './llm/provider'
import { createCatalogProviderChain } from './catalog/catalogProviderChain'
import { createItunesCatalogProvider } from './catalog/itunesCatalogProvider'
import { createMusicBrainzCatalogProvider } from './catalog/musicBrainzCatalogProvider'
import { verifyMixtapeRecommendations } from './catalog/verifyMixtapeRecommendations'

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

    try {
      const confirmedTracks = parsedRequest.data.tracks
      const draft = await provider.generateMixtape({
        tracks: confirmedTracks.map(({ title, artist, album }) => ({ title, artist, album })),
      })
      const catalog = createCatalogProviderChain({
        primary: createItunesCatalogProvider(),
        fallback: createMusicBrainzCatalogProvider(),
      })
      const result = await verifyMixtapeRecommendations({
        draft,
        confirmedTracks,
        llmProvider: provider,
        catalog,
      })
      return json(result)
    } catch (error) {
      const issue = issueFromUnknown(error)
      return errorResponse(issue, statusForIssue(issue.code))
    }
  },
}
