// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { MixtapeResultSchema, type ConfirmedTrack } from '../../src/types/mixtape'
import type {
  LlmMixtapeSelection,
  TasteDiscoveryProfile,
} from '../../src/services/llm/types'
import type { CatalogPoolTrack } from './types'
import { assembleVerifiedMixtape } from './assembleVerifiedMixtape'

const PROFILE: TasteDiscoveryProfile = {
  summary: '몽환적인 밤의 결을 좋아해.',
  genres: ['dream pop'],
  moods: ['late night'],
  traits: ['soft vocals'],
  searchKeywords: ['dreamy', 'ethereal'],
}

function candidate(
  index: number,
  overrides: Partial<CatalogPoolTrack> = {},
): CatalogPoolTrack {
  const musicBrainz = index === 5
  return {
    provider: musicBrainz ? 'musicbrainz' : 'itunes',
    catalogId: musicBrainz ? `mb-${index}` : String(index),
    id: musicBrainz ? `musicbrainz:mb-${index}` : `itunes:${index}`,
    title: `Canonical Song ${index}`,
    artist: `Canonical Artist ${index}`,
    album: `Canonical Album ${index}`,
    url: musicBrainz
      ? `https://musicbrainz.org/recording/mb-${index}`
      : `https://music.apple.com/song/${index}`,
    durationMs: 180_000,
    primaryGenre: 'Dream Pop',
    providerScore: 0.9,
    sourceBucketIds: [`genre-${index}`],
    sourceKinds: ['genre'],
    sourceWeight: 0.9,
    relevanceScore: 0.9,
    catalogStatus: 'verified',
    ...overrides,
  }
}

const SHORTLIST = Array.from({ length: 12 }, (_, index) => candidate(index + 1))

function selection(
  candidateIds = SHORTLIST.slice(0, 5).map(({ id }) => id),
): LlmMixtapeSelection {
  return {
    title: '새벽의 주파수',
    subtitle: 'soft lights, slow streets',
    dochiComment: '좋아. 이 순서로 들어봐.',
    design: {
      atmosphere: 'midnight',
      palette: ['navy', 'amber'],
      texture: 'paper',
      motifs: ['stars'],
    },
    tracks: candidateIds.map((candidateId, index) => ({
      candidateId,
      reason: `${index + 1}번째 곡의 연결 이유`,
    })),
  }
}

function assemble(options: {
  selected?: LlmMixtapeSelection
  shortlist?: CatalogPoolTrack[]
  confirmedTracks?: ConfirmedTrack[]
} = {}) {
  return assembleVerifiedMixtape({
    tasteProfile: PROFILE,
    selection: options.selected ?? selection(),
    shortlist: options.shortlist ?? SHORTLIST,
    confirmedTracks: options.confirmedTracks ?? [],
  })
}

describe('assembleVerifiedMixtape', () => {
  it('hydrates exactly five verified tracks from canonical candidate metadata', () => {
    const result = assemble()

    expect(result.mixtape.tracks).toHaveLength(5)
    expect(result.mixtape.tracks[0]).toEqual({
      id: 'itunes:1',
      title: 'Canonical Song 1',
      artist: 'Canonical Artist 1',
      album: 'Canonical Album 1',
      reason: '1번째 곡의 연결 이유',
      catalogStatus: 'verified',
      platforms: {
        spotify: { id: null, url: null },
        appleMusic: {
          id: '1',
          url: 'https://music.apple.com/song/1',
        },
        youtubeMusic: { id: null, url: null },
      },
    })
    expect(result.mixtape.tracks[4].platforms.appleMusic).toEqual({
      id: null,
      url: null,
    })
    expect(result.tasteProfile).not.toHaveProperty('searchKeywords')
    expect(MixtapeResultSchema.safeParse(result).success).toBe(true)
  })

  it.each([
    {
      name: 'fewer than five ids',
      selected: selection(SHORTLIST.slice(0, 4).map(({ id }) => id)),
    },
    {
      name: 'duplicate ids',
      selected: selection([
        SHORTLIST[0].id,
        SHORTLIST[0].id,
        SHORTLIST[2].id,
        SHORTLIST[3].id,
        SHORTLIST[4].id,
      ]),
    },
    {
      name: 'an id outside the shortlist',
      selected: selection([
        SHORTLIST[0].id,
        SHORTLIST[1].id,
        SHORTLIST[2].id,
        SHORTLIST[3].id,
        'itunes:missing',
      ]),
    },
  ])('rejects $name', ({ selected }) => {
    expect(() => assemble({ selected })).toThrowError(expect.objectContaining({
      code: 'CURATION_INVALID_RESPONSE',
    }))
  })

  it('rejects two selected tracks by the same artist', () => {
    const shortlist = [...SHORTLIST]
    shortlist[1] = {
      ...shortlist[1],
      artist: shortlist[0].artist,
    }

    expect(() => assemble({ shortlist })).toThrowError(expect.objectContaining({
      code: 'CURATION_INVALID_RESPONSE',
    }))
  })

  it('rejects a confirmed input title and artist pair', () => {
    expect(() => assemble({
      confirmedTracks: [{
        id: 'track-001',
        title: SHORTLIST[0].title,
        artist: SHORTLIST[0].artist,
        album: '',
      }],
    })).toThrowError(expect.objectContaining({
      code: 'CURATION_INVALID_RESPONSE',
    }))
  })

  it('rejects an empty editorial reason', () => {
    const selected = selection()
    selected.tracks[0].reason = ' '

    expect(() => assemble({ selected })).toThrowError(expect.objectContaining({
      code: 'CURATION_INVALID_RESPONSE',
    }))
  })
})
