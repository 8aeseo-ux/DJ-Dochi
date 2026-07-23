// @vitest-environment node

import { describe, expect, it } from 'vitest'
import type { ConfirmedTrack } from '../../src/types/mixtape'
import type { TasteDiscoveryProfile } from '../../src/services/llm/types'
import {
  normalizeTasteTerms,
} from './catalogSearchVocabulary'
import { buildCatalogSearchPlan } from './buildCatalogSearchPlan'

const PROFILE: TasteDiscoveryProfile = {
  summary: '몽환적인 인디 팝과 늦은 밤의 부드러운 질감을 좋아해.',
  genres: ['dream pop', '인디 알앤비'],
  moods: ['늦은 밤', '잔잔함'],
  traits: ['soft vocals'],
  searchKeywords: ['몽환적', 'ethereal', '좋은', 'late night'],
}

const TRACKS: ConfirmedTrack[] = [
  {
    id: 'track-001',
    title: 'Space Song',
    artist: 'Beach House',
    album: 'Depression Cherry',
  },
  {
    id: 'track-002',
    title: 'Ditto',
    artist: 'NewJeans',
    album: 'OMG',
  },
  {
    id: 'track-003',
    title: 'Myth',
    artist: 'Beach House',
    album: 'Bloom',
  },
]

describe('normalizeTasteTerms', () => {
  it('maps Korean taste aliases into bounded canonical catalog terms', () => {
    expect(normalizeTasteTerms([
      '몽환적',
      '늦은 밤',
      '잔잔함',
      'Dreamy',
    ])).toEqual([
      'dreamy',
      'ethereal',
      'late night',
      'nocturnal',
      'mellow',
      'soft',
    ])
  })

  it('removes vague, empty, and duplicate terms', () => {
    expect(normalizeTasteTerms([
      ' 좋은 ',
      '감성적',
      '힙한',
      '',
      'Dream Pop',
      'dream   pop',
    ])).toEqual(['dream pop'])
  })
})

describe('buildCatalogSearchPlan', () => {
  it('creates balanced genre, mood, and confirmed-artist search buckets', () => {
    const plan = buildCatalogSearchPlan(PROFILE, TRACKS)

    expect(plan.seeds).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'genre', term: 'dream pop' }),
      expect.objectContaining({ kind: 'genre_mood' }),
      expect.objectContaining({ kind: 'input_artist', term: 'Beach House' }),
      expect.objectContaining({ kind: 'input_artist', term: 'NewJeans' }),
    ]))
    expect(plan.seeds).toHaveLength(5)
  })

  it('uses only unique artists from confirmed input tracks', () => {
    const plan = buildCatalogSearchPlan(PROFILE, TRACKS)
    const artistSeeds = plan.seeds.filter((seed) => seed.kind === 'input_artist')

    expect(artistSeeds.map((seed) => seed.term)).toEqual([
      'Beach House',
      'NewJeans',
    ])
    expect(artistSeeds).toHaveLength(2)
  })

  it('keeps base seeds unique and leaves one of six iTunes slots for a catalog-backed similar seed', () => {
    const plan = buildCatalogSearchPlan({
      ...PROFILE,
      genres: ['Dream Pop', 'dream   pop', 'indie pop'],
      moods: ['late night', 'nocturnal'],
    }, TRACKS)
    const normalizedTerms = plan.seeds.map((seed) => (
      seed.term.normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu, ' ').trim()
    ))

    expect(plan.seeds.length).toBeLessThanOrEqual(5)
    expect(new Set(normalizedTerms).size).toBe(normalizedTerms.length)
    expect(plan.seeds.every((seed) => seed.term !== '좋은')).toBe(true)
  })

  it('does not invent input-artist seeds when confirmed tracks are absent', () => {
    const plan = buildCatalogSearchPlan(PROFILE, [])

    expect(plan.seeds.some((seed) => seed.kind === 'input_artist')).toBe(false)
    expect(plan.seeds.every((seed) => seed.kind !== 'similar_artist')).toBe(true)
  })
})
