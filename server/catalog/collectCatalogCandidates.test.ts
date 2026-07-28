// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import type { ConfirmedTrack } from '../../src/types/mixtape'
import type { TasteDiscoveryProfile } from '../../src/services/llm/types'
import type {
  CatalogDiscoveredTrack,
  CatalogDiscoveryProvider,
  CatalogSearchPlan,
  CatalogSearchSeed,
  SimilarArtistSeedResolver,
} from './types'
import {
  collectCatalogCandidates,
  normalizeCatalogCandidates,
} from './collectCatalogCandidates'

const PROFILE: TasteDiscoveryProfile = {
  summary: '몽환적인 밤의 결을 좋아해.',
  genres: ['dream pop'],
  moods: ['late night'],
  traits: ['soft vocals'],
  searchKeywords: ['dreamy', 'ethereal'],
}

const CONFIRMED_TRACKS: ConfirmedTrack[] = [{
  id: 'track-001',
  title: 'Input Song',
  artist: 'Input Artist',
  album: 'Input Album',
}]

const SEEDS: CatalogSearchSeed[] = [
  { id: 'genre-1', kind: 'genre', term: 'dream pop', weight: 1 },
  { id: 'genre-2', kind: 'genre', term: 'indie pop', weight: 0.95 },
  { id: 'genre-mood-1', kind: 'genre_mood', term: 'dream pop late night', weight: 0.9 },
  {
    id: 'input-artist-1',
    kind: 'input_artist',
    term: 'Input Artist',
    weight: 0.82,
    sourceArtist: 'Input Artist',
  },
  {
    id: 'input-artist-2',
    kind: 'input_artist',
    term: 'Second Artist',
    weight: 0.78,
    sourceArtist: 'Second Artist',
  },
]

const PLAN: CatalogSearchPlan = { seeds: SEEDS }

function discovered(
  index: number,
  overrides: Partial<CatalogDiscoveredTrack> = {},
): CatalogDiscoveredTrack {
  return {
    provider: 'itunes',
    catalogId: String(index),
    title: `Song ${index}`,
    artist: `Artist ${index}`,
    album: `Album ${index}`,
    url: `https://music.apple.com/song/${index}`,
    durationMs: 180_000 + index,
    primaryGenre: 'Dream Pop',
    providerScore: 1 / index,
    ...overrides,
  }
}

function fakeItunes(
  search: CatalogDiscoveryProvider['search'],
): CatalogDiscoveryProvider {
  return { search }
}

function fakeMusicBrainz(options: {
  search?: CatalogDiscoveryProvider['search']
  findSimilarArtistSeed?: SimilarArtistSeedResolver['findSimilarArtistSeed']
} = {}): CatalogDiscoveryProvider & SimilarArtistSeedResolver {
  return {
    search: options.search ?? vi.fn().mockResolvedValue({
      status: 'ok',
      tracks: [],
    }),
    findSimilarArtistSeed: options.findSimilarArtistSeed
      ?? vi.fn().mockResolvedValue(null),
  }
}

describe('normalizeCatalogCandidates', () => {
  it('excludes input tracks and alternate versions, merges providers, and keeps one song per artist', () => {
    const seed = SEEDS[0]
    const tracks = normalizeCatalogCandidates([
      { seed, track: discovered(1, { title: 'Input Song', artist: 'Input Artist' }) },
      { seed, track: discovered(2, { title: 'Other Song (Live)' }) },
      {
        seed,
        track: discovered(3, {
          title: 'Shared Song',
          artist: 'Shared Artist',
          provider: 'musicbrainz',
          catalogId: 'mb-shared',
          url: 'https://musicbrainz.org/recording/mb-shared',
        }),
      },
      {
        seed: SEEDS[1],
        track: discovered(4, {
          title: 'Shared Song',
          artist: 'Shared Artist',
          catalogId: 'itunes-shared',
        }),
      },
      { seed, track: discovered(5, { artist: 'One Artist', title: 'Lower', providerScore: 0.2 }) },
      { seed, track: discovered(6, { artist: 'One Artist', title: 'Higher', providerScore: 0.9 }) },
      { seed, track: discovered(7) },
    ], {
      confirmedTracks: CONFIRMED_TRACKS,
      tasteProfile: PROFILE,
      maximumTracks: 30,
    })

    expect(tracks.map(({ title }) => title)).toEqual([
      'Shared Song',
      'Higher',
      'Song 7',
    ])
    expect(tracks[0]).toMatchObject({
      id: 'itunes:itunes-shared',
      provider: 'itunes',
      sourceBucketIds: ['genre-1', 'genre-2'],
      catalogStatus: 'verified',
    })
  })

  it('allows an explicitly requested alternate version and caps the pool at thirty artists', () => {
    const rows = Array.from({ length: 35 }, (_, index) => ({
      seed: SEEDS[index % SEEDS.length],
      track: discovered(index + 1, {
        title: index === 0 ? 'Opening Live' : `Song ${index + 1}`,
      }),
    }))

    const tracks = normalizeCatalogCandidates(rows, {
      confirmedTracks: [],
      tasteProfile: {
        ...PROFILE,
        searchKeywords: ['live'],
      },
      maximumTracks: 30,
    })

    expect(tracks).toHaveLength(30)
    expect(tracks.some(({ title }) => title === 'Opening Live')).toBe(true)
    expect(new Set(tracks.map(({ artist }) => artist)).size).toBe(30)
  })
})

describe('collectCatalogCandidates', () => {
  it('limits iTunes concurrency to three and forwards the shared signal', async () => {
    let active = 0
    let maximumActive = 0
    const controller = new AbortController()
    const search = vi.fn<CatalogDiscoveryProvider['search']>()
      .mockImplementation(async (seed, signal) => {
        expect(signal).toBe(controller.signal)
        active += 1
        maximumActive = Math.max(maximumActive, active)
        await new Promise((resolve) => setTimeout(resolve, 5))
        active -= 1
        const base = SEEDS.indexOf(seed) * 10
        return {
          status: 'ok',
          tracks: Array.from({ length: 6 }, (_, index) => (
            discovered(base + index + 1)
          )),
        }
      })

    const result = await collectCatalogCandidates({
      plan: PLAN,
      tasteProfile: PROFILE,
      confirmedTracks: CONFIRMED_TRACKS,
      itunes: fakeItunes(search),
      musicBrainz: fakeMusicBrainz(),
      signal: controller.signal,
      deadlineAt: Date.now() + 10_000,
    })

    expect(maximumActive).toBe(3)
    expect(search).toHaveBeenCalledTimes(5)
    expect(result.tracks.length).toBeLessThanOrEqual(30)
  })

  it('adds one catalog-backed similar seed and keeps all provider calls bounded', async () => {
    const similarSeed: CatalogSearchSeed = {
      id: 'similar-artist-related',
      kind: 'similar_artist',
      term: 'Related Artist',
      weight: 0.76,
      sourceArtist: 'Input Artist',
      catalogEvidence: {
        provider: 'musicbrainz',
        entityId: 'related',
        tag: 'dream pop',
      },
    }
    const itunesSearch = vi.fn<CatalogDiscoveryProvider['search']>()
      .mockImplementation(async (seed) => ({
        status: 'ok',
        tracks: Array.from({ length: 3 }, (_, index) => discovered(
          SEEDS.includes(seed) ? SEEDS.indexOf(seed) * 3 + index + 1 : 50 + index,
          seed.kind === 'similar_artist'
            ? { artist: `Related Artist ${index + 1}` }
            : {},
        )),
      }))
    const musicBrainzSearch = vi.fn<CatalogDiscoveryProvider['search']>()
      .mockResolvedValue({
        status: 'ok',
        tracks: Array.from({ length: 8 }, (_, index) => discovered(80 + index, {
          provider: 'musicbrainz',
          catalogId: `mb-${index}`,
          url: `https://musicbrainz.org/recording/mb-${index}`,
        })),
      })
    const resolveSimilar = vi.fn<SimilarArtistSeedResolver['findSimilarArtistSeed']>()
      .mockResolvedValue(similarSeed)

    const result = await collectCatalogCandidates({
      plan: PLAN,
      tasteProfile: PROFILE,
      confirmedTracks: CONFIRMED_TRACKS,
      itunes: fakeItunes(itunesSearch),
      musicBrainz: fakeMusicBrainz({
        search: musicBrainzSearch,
        findSimilarArtistSeed: resolveSimilar,
      }),
      deadlineAt: Date.now() + 10_000,
    })

    expect(resolveSimilar).toHaveBeenCalledOnce()
    expect(itunesSearch.mock.calls.some(([seed]) => seed === similarSeed)).toBe(true)
    expect(itunesSearch.mock.calls.length).toBeLessThanOrEqual(6)
    expect(musicBrainzSearch.mock.calls.length).toBeLessThanOrEqual(1)
    expect(result.musicBrainzCalls).toBeLessThanOrEqual(3)
  })

  it('starts no catalog work inside the deadline stop buffer', async () => {
    const itunesSearch = vi.fn<CatalogDiscoveryProvider['search']>()
    const musicBrainz = fakeMusicBrainz()

    const result = await collectCatalogCandidates({
      plan: PLAN,
      tasteProfile: PROFILE,
      confirmedTracks: CONFIRMED_TRACKS,
      itunes: fakeItunes(itunesSearch),
      musicBrainz,
      deadlineAt: 1_000,
      now: () => 1_000,
    })

    expect(itunesSearch).not.toHaveBeenCalled()
    expect(musicBrainz.findSimilarArtistSeed).not.toHaveBeenCalled()
    expect(result.tracks).toEqual([])
  })
})
