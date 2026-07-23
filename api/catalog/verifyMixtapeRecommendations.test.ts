// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import type { LlmMixtapeDraft, LlmProvider } from '../../src/services/llm/types'
import type { ConfirmedTrack } from '../../src/types/mixtape'
import type { CatalogProviderPhases } from './catalogProviderChain'
import type {
  CatalogCandidate,
  CatalogVerificationResult,
} from './types'
import {
  MAX_REPLACEMENT_ROUNDS,
  verifyMixtapeRecommendations,
} from './verifyMixtapeRecommendations'

const CONFIRMED_TRACKS: ConfirmedTrack[] = [{
  id: 'track-001',
  title: 'Ditto',
  artist: 'NewJeans',
  album: 'OMG',
}]

const RECOMMENDATIONS: LlmMixtapeDraft['mixtape']['tracks'] = [
  {
    title: 'Myth',
    artist: 'Beach House',
    album: 'Bloom',
    reason: '몽환적인 질감이 이어져.',
  },
  {
    title: 'Space Song',
    artist: 'Beach House',
    album: 'Depression Cherry',
    reason: '밤의 분위기가 자연스럽게 연결돼.',
  },
  {
    title: 'Show Me How',
    artist: 'Men I Trust',
    album: 'Oncle Jazz',
    reason: '부드러운 리듬이 잘 어울려.',
  },
  {
    title: 'Fake Song One',
    artist: 'Fake Artist',
    album: '',
    reason: '검증에서 제외될 가상 곡.',
  },
  {
    title: 'Fake Song Two',
    artist: 'Fake Artist',
    album: '',
    reason: '검증에서 제외될 또 다른 곡.',
  },
]

const DRAFT: LlmMixtapeDraft = {
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
    tracks: RECOMMENDATIONS,
  },
}

const NOT_FOUND: CatalogVerificationResult = { status: 'not_found' }

function verified(
  title: string,
  artist: string,
  provider: 'itunes' | 'musicbrainz' = 'itunes',
): CatalogVerificationResult {
  return {
    status: 'verified',
    match: {
      provider,
      catalogId: `${provider}-${artist}-${title}`,
      title,
      artist,
      album: 'Canonical Album',
      url: provider === 'itunes'
        ? `https://music.apple.com/kr/song/${encodeURIComponent(title)}`
        : `https://musicbrainz.org/recording/${encodeURIComponent(title)}`,
    },
  }
}

function llm(replacements: LlmMixtapeDraft['mixtape']['tracks'][] = []): LlmProvider {
  return {
    id: 'fake',
    generateMixtape: vi.fn().mockResolvedValue(DRAFT),
    generateReplacementTracks: vi.fn().mockImplementation(async () => (
      replacements.shift() ?? []
    )),
  }
}

function catalog(options: {
  primary?: CatalogVerificationResult[]
  fallback?: CatalogVerificationResult[]
  verifyPrimary?: CatalogProviderPhases['verifyPrimary']
  verifyFallback?: CatalogProviderPhases['verifyFallback']
} = {}): CatalogProviderPhases {
  const primaryResults = [...(options.primary ?? [])]
  const fallbackResults = [...(options.fallback ?? [])]
  const verifyPrimary = vi.fn(options.verifyPrimary ?? (async () => (
    primaryResults.shift() ?? NOT_FOUND
  )))
  const verifyFallback = vi.fn(options.verifyFallback ?? (async () => (
    fallbackResults.shift() ?? NOT_FOUND
  )))

  return {
    verifyPrimary,
    verifyFallback,
    verify: vi.fn(async (candidate, requestCache, signal) => {
      const primary = await verifyPrimary(candidate, requestCache, signal)
      if (primary.status === 'verified') return primary
      return verifyFallback(candidate, requestCache, signal)
    }),
  }
}

function replacement(title: string): LlmMixtapeDraft['mixtape']['tracks'][number] {
  return {
    title,
    artist: 'Replacement Artist',
    album: '',
    reason: '검증 실패 슬롯을 교체해.',
  }
}

describe('verifyMixtapeRecommendations', () => {
  it('treats three verified tracks as success without requesting replacements', async () => {
    const provider = llm()
    const catalogProvider = catalog({
      primary: [
        verified('Myth', 'Beach House'),
        verified('Space Song', 'Beach House'),
        verified('Show Me How', 'Men I Trust'),
        NOT_FOUND,
        NOT_FOUND,
      ],
    })

    const result = await verifyMixtapeRecommendations({
      draft: DRAFT,
      confirmedTracks: CONFIRMED_TRACKS,
      llmProvider: provider,
      catalog: catalogProvider,
    })

    expect(result.mixtape.tracks).toHaveLength(3)
    expect(result.mixtape.tracks.every((track) => track.catalogStatus === 'verified')).toBe(true)
    expect(provider.generateReplacementTracks).not.toHaveBeenCalled()
    expect(catalogProvider.verifyFallback).not.toHaveBeenCalled()
  })

  it('uses at most one replacement round to reach the three-track threshold', async () => {
    const provider = llm([[
      replacement('Replacement One'),
      replacement('Replacement Two'),
    ]])
    const catalogProvider = catalog({
      primary: [
        verified('Myth', 'Beach House'),
        verified('Space Song', 'Beach House'),
        NOT_FOUND,
        NOT_FOUND,
        NOT_FOUND,
        verified('Replacement One', 'Replacement Artist'),
      ],
      fallback: [NOT_FOUND, NOT_FOUND, NOT_FOUND],
    })

    const result = await verifyMixtapeRecommendations({
      draft: DRAFT,
      confirmedTracks: CONFIRMED_TRACKS,
      llmProvider: provider,
      catalog: catalogProvider,
    })

    expect(MAX_REPLACEMENT_ROUNDS).toBe(1)
    expect(provider.generateReplacementTracks).toHaveBeenCalledOnce()
    expect(result.mixtape.tracks).toHaveLength(3)
  })

  it('rejects when one replacement round still leaves fewer than three verified tracks', async () => {
    const provider = llm([[
      replacement('Replacement One'),
      replacement('Replacement Two'),
    ]])
    const catalogProvider = catalog({
      primary: [
        verified('Myth', 'Beach House'),
        NOT_FOUND,
        NOT_FOUND,
        NOT_FOUND,
        NOT_FOUND,
        verified('Replacement One', 'Replacement Artist'),
        NOT_FOUND,
      ],
      fallback: [NOT_FOUND, NOT_FOUND, NOT_FOUND],
    })

    await expect(verifyMixtapeRecommendations({
      draft: DRAFT,
      confirmedTracks: CONFIRMED_TRACKS,
      llmProvider: provider,
      catalog: catalogProvider,
    })).rejects.toEqual(expect.objectContaining({
      code: 'CATALOG_VERIFICATION_FAILED',
      retryable: true,
    }))

    expect(provider.generateReplacementTracks).toHaveBeenCalledOnce()
  })

  it('runs iTunes verification with a maximum concurrency of three', async () => {
    let active = 0
    let maxActive = 0
    const verifyPrimary = vi.fn(async () => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise<void>((resolve) => setTimeout(resolve, 5))
      active -= 1
      return NOT_FOUND
    })

    await expect(verifyMixtapeRecommendations({
      draft: DRAFT,
      confirmedTracks: CONFIRMED_TRACKS,
      llmProvider: llm([[]]),
      catalog: catalog({
        verifyPrimary,
        fallback: [NOT_FOUND, NOT_FOUND, NOT_FOUND],
      }),
    })).rejects.toEqual(expect.objectContaining({
      code: 'CATALOG_VERIFICATION_FAILED',
    }))

    expect(maxActive).toBe(3)
  })

  it('sends only iTunes failures to MusicBrainz and caps fallback checks at three', async () => {
    const catalogProvider = catalog({
      primary: [
        verified('Myth', 'Beach House'),
        NOT_FOUND,
        { status: 'ambiguous', reason: 'low_similarity' },
        { status: 'unavailable', reason: 'timeout' },
        NOT_FOUND,
      ],
      fallback: [NOT_FOUND, NOT_FOUND, NOT_FOUND],
    })

    await expect(verifyMixtapeRecommendations({
      draft: DRAFT,
      confirmedTracks: CONFIRMED_TRACKS,
      llmProvider: llm([[]]),
      catalog: catalogProvider,
    })).rejects.toEqual(expect.objectContaining({
      code: 'CATALOG_VERIFICATION_FAILED',
    }))

    expect(catalogProvider.verifyFallback).toHaveBeenCalledTimes(3)
    const fallbackTitles = vi.mocked(catalogProvider.verifyFallback).mock.calls
      .map(([candidate]) => candidate.title)
    expect(fallbackTitles).not.toContain('Myth')
    expect(fallbackTitles.every((title) => (
      title === 'Space Song'
      || title === 'Show Me How'
      || title === 'Fake Song One'
      || title === 'Fake Song Two'
    ))).toBe(true)
  })

  it('returns three accumulated matches when the deadline expires', async () => {
    let clock = 0
    let completed = 0
    const catalogProvider = catalog({
      verifyPrimary: vi.fn(async (candidate: CatalogCandidate) => {
        await Promise.resolve()
        completed += 1
        if (completed === 3) clock = 2_600
        return verified(candidate.title, candidate.artist)
      }),
    })

    const result = await verifyMixtapeRecommendations({
      draft: DRAFT,
      confirmedTracks: CONFIRMED_TRACKS,
      llmProvider: llm(),
      catalog: catalogProvider,
      deadlineAt: 2_500,
      now: () => clock,
    })

    expect(clock).toBeGreaterThanOrEqual(100)
    expect(result.mixtape.tracks).toHaveLength(3)
  })

  it('rejects a deadline partial result with fewer than three matches', async () => {
    let clock = 0
    let completed = 0
    const catalogProvider = catalog({
      verifyPrimary: vi.fn(async (candidate: CatalogCandidate) => {
        await Promise.resolve()
        completed += 1
        if (completed === 3) clock = 2_600
        return candidate.title === 'Myth'
          ? verified(candidate.title, candidate.artist)
          : NOT_FOUND
      }),
    })

    await expect(verifyMixtapeRecommendations({
      draft: DRAFT,
      confirmedTracks: CONFIRMED_TRACKS,
      llmProvider: llm(),
      catalog: catalogProvider,
      deadlineAt: 2_500,
      now: () => clock,
    })).rejects.toEqual(expect.objectContaining({
      code: 'REQUEST_TIMEOUT',
      retryable: true,
    }))
  })

  it('forwards the caller signal to primary, fallback, and replacement requests', async () => {
    const signal = new AbortController().signal
    const provider = llm([[replacement('Replacement One')]])
    const catalogProvider = catalog({
      primary: [
        verified('Myth', 'Beach House'),
        NOT_FOUND,
        NOT_FOUND,
        NOT_FOUND,
        NOT_FOUND,
        verified('Replacement One', 'Replacement Artist'),
      ],
      fallback: [NOT_FOUND, NOT_FOUND, NOT_FOUND],
    })

    await expect(verifyMixtapeRecommendations({
      draft: DRAFT,
      confirmedTracks: CONFIRMED_TRACKS,
      llmProvider: provider,
      catalog: catalogProvider,
      signal,
    })).rejects.toEqual(expect.objectContaining({
      code: 'CATALOG_VERIFICATION_FAILED',
    }))

    expect(catalogProvider.verifyPrimary).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Map),
      signal,
    )
    expect(catalogProvider.verifyFallback).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Map),
      signal,
    )
    expect(provider.generateReplacementTracks).toHaveBeenCalledWith(
      expect.anything(),
      { signal },
    )
  })

  it('logs safe per-round timing and call-count metrics', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    }

    await verifyMixtapeRecommendations({
      draft: DRAFT,
      confirmedTracks: CONFIRMED_TRACKS,
      llmProvider: llm(),
      catalog: catalog({
        primary: [
          verified('Myth', 'Beach House'),
          verified('Space Song', 'Beach House'),
          verified('Show Me How', 'Men I Trust'),
        ],
      }),
      logger,
    })

    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({
      event: 'catalog_round',
      round: 0,
      durationMs: expect.any(Number),
      itunesChecks: expect.any(Number),
      musicBrainzChecks: expect.any(Number),
      verifiedCount: 3,
    }))

    const serializedLogs = JSON.stringify([
      ...logger.info.mock.calls,
      ...logger.warn.mock.calls,
    ])
    expect(serializedLogs).not.toContain('Myth')
    expect(serializedLogs).not.toContain('Beach House')
    expect(serializedLogs).not.toContain('Ditto')
    expect(serializedLogs).not.toContain('NewJeans')
  })
})
