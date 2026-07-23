// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MixtapeAnalysisError } from '../src/types/mixtapeAnalysis'
import type { LlmProvider } from '../src/services/llm/types'
import { createLlmProvider } from './llm/provider'
import { verifyMixtapeRecommendations } from './catalog/verifyMixtapeRecommendations'
import handler from './generate-mixtape'

vi.mock('./llm/provider', () => ({
  createLlmProvider: vi.fn(),
}))

vi.mock('./catalog/verifyMixtapeRecommendations', () => ({
  verifyMixtapeRecommendations: vi.fn(),
}))

const createProviderMock = vi.mocked(createLlmProvider)
const verifyRecommendationsMock = vi.mocked(verifyMixtapeRecommendations)

const DRAFT = {
  tasteProfile: {
    summary: '몽환적인 밤의 질감을 좋아해요.',
    genres: ['dream pop'],
    moods: ['late night'],
    traits: ['soft vocals'],
  },
  mixtape: {
    title: '새벽 두 시의 창문',
    subtitle: 'soft lights, slow streets',
    dochiComment: '밤에 음악 많이 듣지?',
    design: {
      atmosphere: '조용한 네온빛',
      palette: ['midnight blue', 'coral'],
      texture: 'matte plastic',
      motifs: ['window light'],
    },
    tracks: [
      {
        title: 'Space Song',
        artist: 'Beach House',
        album: '',
        reason: '입력곡의 몽환적인 결을 자연스럽게 이어가요.',
      },
    ],
  },
}

const VERIFIED_RESULT = {
  tasteProfile: DRAFT.tasteProfile,
  mixtape: {
    title: DRAFT.mixtape.title,
    subtitle: DRAFT.mixtape.subtitle,
    dochiComment: DRAFT.mixtape.dochiComment,
    design: DRAFT.mixtape.design,
    tracks: [{
      id: 'recommendation-001',
      title: 'Space Song',
      artist: 'Beach House',
      album: 'Depression Cherry',
      reason: DRAFT.mixtape.tracks[0].reason,
      catalogStatus: 'verified' as const,
      platforms: {
        spotify: { id: null, url: null },
        appleMusic: {
          id: '1247704673',
          url: 'https://music.apple.com/kr/album/space-song/1247704667?i=1247704673',
        },
        youtubeMusic: { id: null, url: null },
      },
    }],
  },
}

function createRequest(body: unknown, method = 'POST', signal?: AbortSignal) {
  return new Request('http://localhost/api/generate-mixtape', {
    method,
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  })
}

describe('POST /api/generate-mixtape', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.LLM_PROVIDER = 'openai'
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.OPENAI_MODEL = 'test-model'
    verifyRecommendationsMock.mockResolvedValue(VERIFIED_RESULT)
  })

  afterEach(() => {
    delete process.env.LLM_PROVIDER
    delete process.env.OPENAI_API_KEY
    delete process.env.OPENAI_MODEL
  })

  it('rejects non-POST requests', async () => {
    const response = await handler.fetch(createRequest({}, 'GET'))

    expect(response.status).toBe(405)
  })

  it('rejects empty or extraction-shaped requests before calling a provider', async () => {
    const response = await handler.fetch(createRequest({
      tracks: [{ id: 'track-001', title: 'Ditto', artist: 'NewJeans', album: '', confidence: 0.9 }],
    }))

    expect(response.status).toBe(400)
    expect(createProviderMock).not.toHaveBeenCalled()
  })

  it('passes only confirmed track fields to the provider and returns normalized output', async () => {
    const provider: LlmProvider = {
      id: 'fake',
      generateMixtape: vi.fn().mockResolvedValue(DRAFT),
      generateReplacementTracks: vi.fn().mockResolvedValue([]),
    }
    createProviderMock.mockReturnValue(provider)
    const response = await handler.fetch(createRequest({
      tracks: [{ id: 'track-001', title: 'Ditto', artist: 'NewJeans', album: '' }],
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      mixtape: {
        title: '새벽 두 시의 창문',
        tracks: [{ title: 'Space Song', catalogStatus: 'verified' }],
      },
    })
    expect(provider.generateMixtape).toHaveBeenCalledWith(
      {
        tracks: [{ title: 'Ditto', artist: 'NewJeans', album: '' }],
      },
      {
        signal: expect.any(AbortSignal),
      },
    )
    expect(verifyRecommendationsMock).toHaveBeenCalledWith(expect.objectContaining({
      draft: DRAFT,
      confirmedTracks: [{
        id: 'track-001',
        title: 'Ditto',
        artist: 'NewJeans',
        album: '',
      }],
      llmProvider: provider,
      signal: expect.any(AbortSignal),
      deadlineAt: expect.any(Number),
    }))
  })

  it('shares one request signal and a 35 second deadline across the pipeline', async () => {
    const provider: LlmProvider = {
      id: 'fake',
      generateMixtape: vi.fn().mockResolvedValue(DRAFT),
      generateReplacementTracks: vi.fn().mockResolvedValue([]),
    }
    createProviderMock.mockReturnValue(provider)
    const startedAt = Date.now()

    const response = await handler.fetch(createRequest({
      tracks: [{ id: 'track-001', title: 'Ditto', artist: 'NewJeans', album: '' }],
    }))

    const llmSignal = vi.mocked(provider.generateMixtape).mock.calls[0]?.[1]?.signal
    const verificationOptions = verifyRecommendationsMock.mock.calls[0]?.[0]

    expect(response.status).toBe(200)
    expect(llmSignal).toBeInstanceOf(AbortSignal)
    expect(verificationOptions?.signal).toBe(llmSignal)
    expect(verificationOptions?.deadlineAt).toBeGreaterThanOrEqual(startedAt + 34_900)
    expect(verificationOptions?.deadlineAt).toBeLessThanOrEqual(Date.now() + 35_000)
  })

  it('propagates a browser abort into the LLM request signal', async () => {
    const requestController = new AbortController()
    const provider: LlmProvider = {
      id: 'fake',
      generateMixtape: vi.fn().mockImplementation(async (_input, options) => {
        requestController.abort()
        expect(options?.signal?.aborted).toBe(true)

        throw new MixtapeAnalysisError({
          code: 'REQUEST_TIMEOUT',
          message: '취향 분석 요청 시간이 초과됐어요. 다시 시도해주세요.',
          retryable: true,
        })
      }),
      generateReplacementTracks: vi.fn().mockResolvedValue([]),
    }
    createProviderMock.mockReturnValue(provider)

    const response = await handler.fetch(createRequest(
      {
        tracks: [{ id: 'track-001', title: 'Ditto', artist: 'NewJeans', album: '' }],
      },
      'POST',
      requestController.signal,
    ))

    expect(response.status).toBe(504)
    expect(verifyRecommendationsMock).not.toHaveBeenCalled()
  })

  it('logs timings without logging submitted track data', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const provider: LlmProvider = {
      id: 'fake',
      generateMixtape: vi.fn().mockResolvedValue(DRAFT),
      generateReplacementTracks: vi.fn().mockResolvedValue([]),
    }
    createProviderMock.mockReturnValue(provider)

    const response = await handler.fetch(createRequest({
      tracks: [{
        id: 'private-track-id',
        title: 'Private Song',
        artist: 'Private Artist',
        album: 'Private Album',
      }],
    }))
    const logs = JSON.stringify(infoSpy.mock.calls)

    expect(response.status).toBe(200)
    expect(logs).toContain('pipeline_stage')
    expect(logs).toContain('pipeline_complete')
    expect(logs).toContain('durationMs')
    expect(logs).not.toContain('Private Song')
    expect(logs).not.toContain('Private Artist')
    expect(logs).not.toContain('Private Album')
  })

  it('returns a configuration error without falling back to dummy data', async () => {
    createProviderMock.mockImplementation(() => {
      throw new MixtapeAnalysisError({
        code: 'MISSING_API_KEY',
        message: '키가 없어요.',
        retryable: false,
      })
    })

    const response = await handler.fetch(createRequest({
      tracks: [{ id: 'track-001', title: 'Ditto', artist: 'NewJeans', album: '' }],
    }))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: { code: 'MISSING_API_KEY', message: '키가 없어요.', retryable: false },
    })
  })

  it('returns a retryable provider error', async () => {
    createProviderMock.mockImplementation(() => ({
      id: 'fake',
      generateMixtape: vi.fn().mockRejectedValue(new MixtapeAnalysisError({
        code: 'ANALYSIS_FAILED',
        message: '분석 실패',
        retryable: true,
      })),
      generateReplacementTracks: vi.fn().mockResolvedValue([]),
    }))

    const response = await handler.fetch(createRequest({
      tracks: [{ id: 'track-001', title: 'Ditto', artist: 'NewJeans', album: '' }],
    }))

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      error: { code: 'ANALYSIS_FAILED', message: '분석 실패', retryable: true },
    })
  })

  it('returns a retryable error when no recommendation can be catalog-verified', async () => {
    const provider: LlmProvider = {
      id: 'fake',
      generateMixtape: vi.fn().mockResolvedValue(DRAFT),
      generateReplacementTracks: vi.fn().mockResolvedValue([]),
    }
    createProviderMock.mockReturnValue(provider)
    verifyRecommendationsMock.mockRejectedValueOnce(new MixtapeAnalysisError({
      code: 'CATALOG_VERIFICATION_FAILED',
      message: '실재하는 추천곡을 확인하지 못했어요.',
      retryable: true,
    }))

    const response = await handler.fetch(createRequest({
      tracks: [{ id: 'track-001', title: 'Ditto', artist: 'NewJeans', album: '' }],
    }))

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'CATALOG_VERIFICATION_FAILED',
        message: '실재하는 추천곡을 확인하지 못했어요.',
        retryable: true,
      },
    })
  })
})
