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

function createRequest(body: unknown, method = 'POST') {
  return new Request('http://localhost/api/generate-mixtape', {
    method,
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
    expect(provider.generateMixtape).toHaveBeenCalledWith({
      tracks: [{ title: 'Ditto', artist: 'NewJeans', album: '' }],
    })
    expect(verifyRecommendationsMock).toHaveBeenCalledWith(expect.objectContaining({
      draft: DRAFT,
      confirmedTracks: [{
        id: 'track-001',
        title: 'Ditto',
        artist: 'NewJeans',
        album: '',
      }],
      llmProvider: provider,
    }))
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
