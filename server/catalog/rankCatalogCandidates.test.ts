// @vitest-environment node

import { describe, expect, it } from 'vitest'
import type { TasteDiscoveryProfile } from '../../src/services/llm/types'
import type {
  CatalogPoolTrack,
  CatalogSearchBucketKind,
} from './types'
import {
  RELEVANCE_WEIGHTS,
  scoreCatalogCandidate,
  shortlistCatalogCandidates,
} from './rankCatalogCandidates'

const PROFILE: TasteDiscoveryProfile = {
  summary: '몽환적인 밤의 결을 좋아해.',
  genres: ['dream pop'],
  moods: ['late night'],
  traits: ['soft vocals'],
  searchKeywords: ['dreamy', 'ethereal'],
}

function candidate(
  index: number,
  kind: CatalogSearchBucketKind,
  overrides: Partial<CatalogPoolTrack> = {},
): CatalogPoolTrack {
  return {
    provider: 'itunes',
    catalogId: String(index),
    id: `itunes:${index}`,
    title: `Song ${index}`,
    artist: `Artist ${index}`,
    album: `Album ${index}`,
    url: `https://music.apple.com/song/${index}`,
    durationMs: 180_000,
    primaryGenre: 'Dream Pop',
    providerScore: 0.8,
    sourceBucketIds: [`${kind}-${index}`],
    sourceKinds: [kind],
    sourceWeight: 0.8,
    relevanceScore: 0,
    catalogStatus: 'verified',
    ...overrides,
  }
}

describe('scoreCatalogCandidate', () => {
  it('combines the five configured relevance factors', () => {
    const track = candidate(1, 'genre', {
      providerScore: 1,
      sourceWeight: 1,
      sourceBucketIds: ['genre-1', 'genre-mood-1', 'similar-1'],
      sourceKinds: ['genre', 'genre_mood', 'similar_artist'],
    })

    expect(RELEVANCE_WEIGHTS).toEqual({
      sourceQuery: 0.35,
      tasteOverlap: 0.25,
      repeatedDiscovery: 0.20,
      providerConfidence: 0.10,
      noveltyAndVersion: 0.10,
    })
    expect(scoreCatalogCandidate(track, {
      tasteProfile: PROFILE,
      inputArtists: new Set(),
    })).toBe(1)
  })

  it('penalizes an input artist slightly without excluding another song', () => {
    const track = candidate(2, 'input_artist', {
      artist: 'Beach House',
      providerScore: 1,
      sourceWeight: 1,
      sourceBucketIds: ['genre-1', 'genre-mood-1', 'input-artist-1'],
      sourceKinds: ['genre', 'genre_mood', 'input_artist'],
    })

    expect(scoreCatalogCandidate(track, {
      tasteProfile: PROFILE,
      inputArtists: new Set(['Beach House']),
    })).toBeCloseTo(0.96, 5)
  })

  it('does not invent genre overlap when catalog metadata is unrelated', () => {
    const matching = candidate(3, 'genre', { primaryGenre: 'Dream Pop' })
    const unrelated = candidate(4, 'genre', { primaryGenre: 'Metal' })
    const context = {
      tasteProfile: PROFILE,
      inputArtists: new Set<string>(),
    }

    expect(scoreCatalogCandidate(matching, context))
      .toBeGreaterThan(scoreCatalogCandidate(unrelated, context))
  })
})

describe('shortlistCatalogCandidates', () => {
  it('returns fifteen unique artists while reserving diverse bucket slots', () => {
    const tracks = [
      ...Array.from({ length: 6 }, (_, index) => candidate(index + 1, 'genre')),
      ...Array.from({ length: 5 }, (_, index) => candidate(index + 20, 'genre_mood')),
      ...Array.from({ length: 3 }, (_, index) => candidate(index + 40, 'similar_artist')),
      ...Array.from({ length: 4 }, (_, index) => candidate(index + 60, 'input_artist', {
        providerScore: 1,
        sourceWeight: 1,
      })),
      ...Array.from({ length: 3 }, (_, index) => candidate(index + 80, 'genre')),
    ]

    const shortlist = shortlistCatalogCandidates(tracks, {
      tasteProfile: PROFILE,
      inputArtists: new Set(['Artist 60', 'Artist 61', 'Artist 62', 'Artist 63']),
    })

    const count = (kind: CatalogSearchBucketKind) => shortlist.filter(
      ({ sourceKinds }) => sourceKinds.includes(kind),
    ).length
    expect(shortlist).toHaveLength(15)
    expect(new Set(shortlist.map(({ artist }) => artist)).size).toBe(15)
    expect(count('genre')).toBeGreaterThanOrEqual(4)
    expect(count('genre_mood')).toBeGreaterThanOrEqual(3)
    expect(count('similar_artist')).toBeGreaterThanOrEqual(2)
    expect(count('input_artist')).toBeLessThanOrEqual(2)
  })

  it('reserves one similar-artist slot when that is the bucket capacity and redistributes the rest', () => {
    const tracks = [
      candidate(1, 'similar_artist'),
      ...Array.from({ length: 10 }, (_, index) => candidate(index + 20, 'genre')),
      ...Array.from({ length: 6 }, (_, index) => candidate(index + 50, 'genre_mood')),
    ]

    const shortlist = shortlistCatalogCandidates(tracks, {
      tasteProfile: PROFILE,
      inputArtists: new Set(),
    })

    expect(shortlist).toHaveLength(15)
    expect(shortlist.some(({ id }) => id === 'itunes:1')).toBe(true)
  })

  it('rejects a shortlist smaller than twelve real artists', () => {
    const tracks = Array.from({ length: 11 }, (_, index) => (
      candidate(index + 1, index < 6 ? 'genre' : 'genre_mood')
    ))

    expect(() => shortlistCatalogCandidates(tracks, {
      tasteProfile: PROFILE,
      inputArtists: new Set(),
    })).toThrowError(expect.objectContaining({
      code: 'CATALOG_CANDIDATES_INSUFFICIENT',
    }))
  })
})
