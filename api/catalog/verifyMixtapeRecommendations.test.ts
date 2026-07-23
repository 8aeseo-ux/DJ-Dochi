// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import type { LlmMixtapeDraft, LlmProvider } from '../../src/services/llm/types'
import type { ConfirmedTrack } from '../../src/types/mixtape'
import { MixtapeAnalysisError } from '../../src/types/mixtapeAnalysis'
import type { CatalogProviderChain } from './catalogProviderChain'
import type { CatalogVerificationResult } from './types'
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
    tracks: [
      {
        title: 'Myth',
        artist: 'Beach House',
        album: 'Bloom',
        reason: '몽환적인 질감이 이어져.',
      },
      {
        title: 'Fake Song',
        artist: 'Fake Artist',
        album: '',
        reason: '교체되어야 하는 가상 곡.',
      },
    ],
  },
}

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

function catalog(results: CatalogVerificationResult[]): CatalogProviderChain {
  return {
    verify: vi.fn().mockImplementation(async () => (
      results.shift() ?? { status: 'not_found' }
    )),
  }
}

describe('verifyMixtapeRecommendations', () => {
  it('returns canonical verified tracks without requesting replacements when every candidate exists', async () => {
    const provider = llm()
    const result = await verifyMixtapeRecommendations({
      draft: DRAFT,
      confirmedTracks: CONFIRMED_TRACKS,
      llmProvider: provider,
      catalog: catalog([
        verified('Myth', 'Beach House'),
        verified('Real Song', 'Real Artist', 'musicbrainz'),
      ]),
    })

    expect(result.mixtape.tracks).toHaveLength(2)
    expect(result.mixtape.tracks.every((track) => track.catalogStatus === 'verified')).toBe(true)
    expect(result.mixtape.tracks[0]).toMatchObject({
      title: 'Myth',
      artist: 'Beach House',
      album: 'Canonical Album',
      platforms: {
        appleMusic: {
          id: 'itunes-Beach House-Myth',
          url: 'https://music.apple.com/kr/song/Myth',
        },
      },
    })
    expect(provider.generateReplacementTracks).not.toHaveBeenCalled()
  })

  it('requests only failed slots and excludes every confirmed or attempted identity', async () => {
    const provider = llm([[
      {
        title: 'Space Song',
        artist: 'Beach House',
        album: 'Depression Cherry',
        reason: '새로운 교체 추천.',
      },
    ]])
    const result = await verifyMixtapeRecommendations({
      draft: DRAFT,
      confirmedTracks: CONFIRMED_TRACKS,
      llmProvider: provider,
      catalog: catalog([
        verified('Myth', 'Beach House'),
        { status: 'not_found' },
        verified('Space Song', 'Beach House'),
      ]),
    })

    expect(provider.generateReplacementTracks).toHaveBeenCalledOnce()
    expect(provider.generateReplacementTracks).toHaveBeenCalledWith({
      confirmedTracks: [{
        title: 'Ditto',
        artist: 'NewJeans',
        album: 'OMG',
      }],
      excludedTracks: expect.arrayContaining([
        { title: 'Ditto', artist: 'NewJeans' },
        { title: 'Myth', artist: 'Beach House' },
        { title: 'Fake Song', artist: 'Fake Artist' },
      ]),
      count: 1,
    })
    expect(result.mixtape.tracks.map((track) => track.title)).toEqual([
      'Myth',
      'Space Song',
    ])
  })

  it('limits replacement rounds and returns only the verified partial result', async () => {
    const provider = llm([
      [{
        title: 'Fake Replacement 1',
        artist: 'Fake Artist',
        album: '',
        reason: '첫 번째 교체.',
      }],
      [{
        title: 'Fake Replacement 2',
        artist: 'Fake Artist',
        album: '',
        reason: '두 번째 교체.',
      }],
      [{
        title: 'Must Not Be Requested',
        artist: 'Fake Artist',
        album: '',
        reason: '세 번째 교체.',
      }],
    ])
    const result = await verifyMixtapeRecommendations({
      draft: DRAFT,
      confirmedTracks: CONFIRMED_TRACKS,
      llmProvider: provider,
      catalog: catalog([
        verified('Myth', 'Beach House'),
        { status: 'not_found' },
        { status: 'not_found' },
        { status: 'ambiguous', reason: 'low_similarity' },
      ]),
    })

    expect(MAX_REPLACEMENT_ROUNDS).toBe(2)
    expect(provider.generateReplacementTracks).toHaveBeenCalledTimes(2)
    expect(result.mixtape.tracks).toHaveLength(1)
    expect(result.mixtape.tracks[0].catalogStatus).toBe('verified')
  })

  it('throws a retryable unavailable error when no candidate could reach a catalog', async () => {
    const provider = llm([[], []])

    await expect(verifyMixtapeRecommendations({
      draft: DRAFT,
      confirmedTracks: CONFIRMED_TRACKS,
      llmProvider: provider,
      catalog: catalog([
        { status: 'unavailable', reason: 'timeout' },
        { status: 'unavailable', reason: 'network' },
      ]),
    })).rejects.toEqual(expect.objectContaining({
      code: 'CATALOG_UNAVAILABLE',
      retryable: true,
    }))
  })

  it('throws a retryable verification error when catalogs reject every candidate', async () => {
    await expect(verifyMixtapeRecommendations({
      draft: DRAFT,
      confirmedTracks: CONFIRMED_TRACKS,
      llmProvider: llm([[], []]),
      catalog: catalog([
        { status: 'not_found' },
        { status: 'ambiguous', reason: 'version_mismatch' },
      ]),
    })).rejects.toBeInstanceOf(MixtapeAnalysisError)

    await expect(verifyMixtapeRecommendations({
      draft: DRAFT,
      confirmedTracks: CONFIRMED_TRACKS,
      llmProvider: llm([[], []]),
      catalog: catalog([
        { status: 'not_found' },
        { status: 'not_found' },
      ]),
    })).rejects.toEqual(expect.objectContaining({
      code: 'CATALOG_VERIFICATION_FAILED',
      retryable: true,
    }))
  })

  it('logs reasons and retry counts without logging track or playlist contents', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    }

    await verifyMixtapeRecommendations({
      draft: DRAFT,
      confirmedTracks: CONFIRMED_TRACKS,
      llmProvider: llm([[
        {
          title: 'Space Song',
          artist: 'Beach House',
          album: '',
          reason: '교체 추천.',
        },
      ]]),
      catalog: catalog([
        verified('Myth', 'Beach House'),
        { status: 'ambiguous', reason: 'version_mismatch' },
        verified('Space Song', 'Beach House'),
      ]),
      logger,
    })

    const serializedLogs = JSON.stringify([
      ...logger.info.mock.calls,
      ...logger.warn.mock.calls,
    ])
    expect(serializedLogs).toContain('version_mismatch')
    expect(serializedLogs).toContain('replacement_request')
    expect(serializedLogs).not.toContain('Fake Song')
    expect(serializedLogs).not.toContain('Fake Artist')
    expect(serializedLogs).not.toContain('Ditto')
    expect(serializedLogs).not.toContain('NewJeans')
  })
})
