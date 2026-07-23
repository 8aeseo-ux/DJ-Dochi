// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MixtapeAnalysisError } from '../src/types/mixtapeAnalysis'
import type {
  LlmProvider,
  LlmMixtapeSelection,
  TasteDiscoveryProfile,
} from '../src/services/llm/types'
import type {
  CatalogCandidateCollection,
  CatalogPoolTrack,
  CatalogSearchPlan,
} from './catalog/types'
import { createLlmProvider } from './llm/provider'
import { buildCatalogSearchPlan } from './catalog/buildCatalogSearchPlan'
import { collectCatalogCandidates } from './catalog/collectCatalogCandidates'
import { shortlistCatalogCandidates } from './catalog/rankCatalogCandidates'
import { assembleVerifiedMixtape } from './catalog/assembleVerifiedMixtape'
import { createItunesCatalogProvider } from './catalog/itunesCatalogProvider'
import { createMusicBrainzCatalogProvider } from './catalog/musicBrainzCatalogProvider'
import handler from './generate-mixtape'

vi.mock('./llm/provider', () => ({
  createLlmProvider: vi.fn(),
}))
vi.mock('./catalog/buildCatalogSearchPlan', () => ({
  buildCatalogSearchPlan: vi.fn(),
}))
vi.mock('./catalog/collectCatalogCandidates', () => ({
  collectCatalogCandidates: vi.fn(),
}))
vi.mock('./catalog/rankCatalogCandidates', () => ({
  shortlistCatalogCandidates: vi.fn(),
}))
vi.mock('./catalog/assembleVerifiedMixtape', () => ({
  assembleVerifiedMixtape: vi.fn(),
}))
vi.mock('./catalog/itunesCatalogProvider', () => ({
  createItunesCatalogProvider: vi.fn(),
}))
vi.mock('./catalog/musicBrainzCatalogProvider', () => ({
  createMusicBrainzCatalogProvider: vi.fn(),
}))

const createProviderMock = vi.mocked(createLlmProvider)
const buildPlanMock = vi.mocked(buildCatalogSearchPlan)
const collectMock = vi.mocked(collectCatalogCandidates)
const shortlistMock = vi.mocked(shortlistCatalogCandidates)
const assembleMock = vi.mocked(assembleVerifiedMixtape)
const createItunesMock = vi.mocked(createItunesCatalogProvider)
const createMusicBrainzMock = vi.mocked(createMusicBrainzCatalogProvider)

const PROFILE: TasteDiscoveryProfile = {
  summary: '몽환적인 밤의 질감을 좋아해요.',
  genres: ['dream pop'],
  moods: ['late night'],
  traits: ['soft vocals'],
  searchKeywords: ['dreamy', 'ethereal'],
}

const PLAN: CatalogSearchPlan = {
  seeds: [{
    id: 'genre-1',
    kind: 'genre',
    term: 'dream pop',
    weight: 1,
  }],
}

function candidate(index: number): CatalogPoolTrack {
  return {
    provider: 'itunes',
    catalogId: String(index),
    id: `itunes:${index}`,
    title: `Canonical Song ${index}`,
    artist: `Canonical Artist ${index}`,
    album: `Canonical Album ${index}`,
    url: `https://music.apple.com/song/${index}`,
    durationMs: 180_000,
    primaryGenre: 'Dream Pop',
    providerScore: 0.9,
    sourceBucketIds: ['genre-1'],
    sourceKinds: ['genre'],
    sourceWeight: 1,
    relevanceScore: 0.9,
    catalogStatus: 'verified',
  }
}

const RAW_TRACKS = Array.from({ length: 20 }, (_, index) => candidate(index + 1))
const SHORTLIST = RAW_TRACKS.slice(0, 15)
const COLLECTION: CatalogCandidateCollection = {
  tracks: RAW_TRACKS,
  attemptedSeeds: 5,
  itunesCalls: 5,
  musicBrainzCalls: 2,
  unavailableCalls: 0,
}

const SELECTION: LlmMixtapeSelection = {
  title: '새벽 두 시의 창문',
  subtitle: 'soft lights, slow streets',
  dochiComment: '밤에 음악 많이 듣지?',
  design: {
    atmosphere: '조용한 네온빛',
    palette: ['midnight blue', 'coral'],
    texture: 'paper',
    motifs: ['window light'],
  },
  tracks: SHORTLIST.slice(0, 5).map(({ id }, index) => ({
    candidateId: id,
    reason: `${index + 1}번째 연결 이유`,
  })),
}

const VERIFIED_RESULT = {
  tasteProfile: {
    summary: PROFILE.summary,
    genres: PROFILE.genres,
    moods: PROFILE.moods,
    traits: PROFILE.traits,
  },
  mixtape: {
    title: SELECTION.title,
    subtitle: SELECTION.subtitle,
    dochiComment: SELECTION.dochiComment,
    design: SELECTION.design,
    tracks: SHORTLIST.slice(0, 5).map((track, index) => ({
      id: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      reason: `${index + 1}번째 연결 이유`,
      catalogStatus: 'verified' as const,
      platforms: {
        spotify: { id: null, url: null },
        appleMusic: { id: track.catalogId, url: track.url },
        youtubeMusic: { id: null, url: null },
      },
    })),
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

function provider(): LlmProvider {
  return {
    id: 'fake',
    analyzeTaste: vi.fn().mockResolvedValue(PROFILE),
    curateMixtape: vi.fn().mockResolvedValue(SELECTION),
  }
}

const REQUEST_TRACKS = [{
  id: 'track-001',
  title: 'Ditto',
  artist: 'NewJeans',
  album: '',
}]

describe('POST /api/generate-mixtape', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.LLM_PROVIDER = 'openai'
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.OPENAI_MODEL = 'test-model'

    createItunesMock.mockReturnValue({ search: vi.fn(), verify: vi.fn(), id: 'itunes' })
    createMusicBrainzMock.mockReturnValue({
      search: vi.fn(),
      verify: vi.fn(),
      findSimilarArtistSeed: vi.fn(),
      id: 'musicbrainz',
    })
    buildPlanMock.mockReturnValue(PLAN)
    collectMock.mockResolvedValue(COLLECTION)
    shortlistMock.mockReturnValue(SHORTLIST)
    assembleMock.mockReturnValue(VERIFIED_RESULT)
  })

  afterEach(() => {
    vi.useRealTimers()
    delete process.env.LLM_PROVIDER
    delete process.env.OPENAI_API_KEY
    delete process.env.OPENAI_MODEL
  })

  it('rejects non-POST and invalid generation requests', async () => {
    const getResponse = await handler.fetch(createRequest({}, 'GET'))
    const invalidResponse = await handler.fetch(createRequest({ tracks: [] }))

    expect(getResponse.status).toBe(405)
    expect(invalidResponse.status).toBe(400)
    expect(createProviderMock).not.toHaveBeenCalled()
  })

  it('runs taste, discovery, ranking, candidate-id curation, and hydration in order', async () => {
    const llm = provider()
    createProviderMock.mockReturnValue(llm)

    const response = await handler.fetch(createRequest({ tracks: REQUEST_TRACKS }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(VERIFIED_RESULT)
    expect(llm.analyzeTaste).toHaveBeenCalledWith({
      tracks: [{ title: 'Ditto', artist: 'NewJeans', album: '' }],
    }, { signal: expect.any(AbortSignal) })
    expect(buildPlanMock).toHaveBeenCalledWith(PROFILE, REQUEST_TRACKS)
    expect(collectMock).toHaveBeenCalledWith(expect.objectContaining({
      plan: PLAN,
      tasteProfile: PROFILE,
      confirmedTracks: REQUEST_TRACKS,
      signal: expect.any(AbortSignal),
      deadlineAt: expect.any(Number),
    }))
    expect(shortlistMock).toHaveBeenCalledWith(RAW_TRACKS, {
      tasteProfile: PROFILE,
      inputArtists: new Set(['NewJeans']),
    })
    expect(llm.curateMixtape).toHaveBeenCalledWith({
      tasteProfile: PROFILE,
      candidates: SHORTLIST.map(({ id, title, artist }) => ({
        candidateId: id,
        title,
        artist,
      })),
    }, { signal: expect.any(AbortSignal) })
    expect(assembleMock).toHaveBeenCalledWith({
      tasteProfile: PROFILE,
      selection: SELECTION,
      shortlist: SHORTLIST,
      confirmedTracks: REQUEST_TRACKS,
    })

    const curationPayload = vi.mocked(llm.curateMixtape).mock.calls[0][0]
    expect(curationPayload.candidates[0]).not.toHaveProperty('album')
    expect(curationPayload.candidates[0]).not.toHaveProperty('url')
  })

  it('returns a catalog error before curation when fewer than twenty candidates were collected', async () => {
    const llm = provider()
    createProviderMock.mockReturnValue(llm)
    collectMock.mockResolvedValueOnce({
      ...COLLECTION,
      tracks: RAW_TRACKS.slice(0, 19),
    })

    const response = await handler.fetch(createRequest({ tracks: REQUEST_TRACKS }))

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'CATALOG_CANDIDATES_INSUFFICIENT',
        stage: 'catalog',
        message: '확인되는 추천곡 후보를 충분히 모으지 못했어요.',
        retryable: true,
      },
    })
    expect(llm.curateMixtape).not.toHaveBeenCalled()
  })

  it('retries candidate-id curation once without rerunning taste or catalog discovery', async () => {
    const llm = provider()
    createProviderMock.mockReturnValue(llm)
    assembleMock
      .mockImplementationOnce(() => {
        throw new MixtapeAnalysisError({
          code: 'CURATION_INVALID_RESPONSE',
          stage: 'curation',
          message: '선택 오류',
          retryable: true,
        })
      })
      .mockReturnValueOnce(VERIFIED_RESULT)

    const response = await handler.fetch(createRequest({ tracks: REQUEST_TRACKS }))

    expect(response.status).toBe(200)
    expect(llm.curateMixtape).toHaveBeenCalledTimes(2)
    expect(llm.analyzeTaste).toHaveBeenCalledOnce()
    expect(collectMock).toHaveBeenCalledOnce()
  })

  it('does not start a curation retry inside the final stop buffer', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const llm = provider()
    vi.mocked(llm.curateMixtape).mockImplementation(async () => {
      vi.setSystemTime(34_500)
      return SELECTION
    })
    createProviderMock.mockReturnValue(llm)
    assembleMock.mockImplementation(() => {
      throw new MixtapeAnalysisError({
        code: 'CURATION_INVALID_RESPONSE',
        stage: 'curation',
        message: '선택 오류',
        retryable: true,
      })
    })

    const response = await handler.fetch(createRequest({ tracks: REQUEST_TRACKS }))

    expect(response.status).toBe(502)
    expect(llm.curateMixtape).toHaveBeenCalledOnce()
  })

  it('propagates browser cancellation into the shared LLM signal', async () => {
    const requestController = new AbortController()
    const llm = provider()
    vi.mocked(llm.analyzeTaste).mockImplementation(async (_input, options) => {
      requestController.abort()
      expect(options?.signal?.aborted).toBe(true)
      throw new MixtapeAnalysisError({
        code: 'REQUEST_TIMEOUT',
        stage: 'taste',
        message: '취향 분석 요청 시간이 초과됐어요.',
        retryable: true,
      })
    })
    createProviderMock.mockReturnValue(llm)

    const response = await handler.fetch(createRequest(
      { tracks: REQUEST_TRACKS },
      'POST',
      requestController.signal,
    ))

    expect(response.status).toBe(504)
    expect(collectMock).not.toHaveBeenCalled()
  })

  it('logs stage timings and counts without playlist or candidate metadata', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const llm = provider()
    createProviderMock.mockReturnValue(llm)

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
    expect(logs).toContain('taste_analysis')
    expect(logs).toContain('catalog_discovery')
    expect(logs).toContain('candidate_ranking')
    expect(logs).toContain('mixtape_curation')
    expect(logs).toContain('result_assembly')
    expect(logs).toContain('rawCandidateCount')
    expect(logs).not.toContain('Private Song')
    expect(logs).not.toContain('Private Artist')
    expect(logs).not.toContain('Canonical Song')
  })

  it('returns a configuration error without falling back to dummy data', async () => {
    createProviderMock.mockImplementation(() => {
      throw new MixtapeAnalysisError({
        code: 'MISSING_API_KEY',
        stage: 'taste',
        message: '키가 없어요.',
        retryable: false,
      })
    })

    const response = await handler.fetch(createRequest({ tracks: REQUEST_TRACKS }))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'MISSING_API_KEY',
        stage: 'taste',
        message: '키가 없어요.',
        retryable: false,
      },
    })
  })
})
