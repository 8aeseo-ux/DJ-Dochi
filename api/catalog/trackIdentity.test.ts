// @vitest-environment node

import { describe, expect, it } from 'vitest'
import type { CatalogCandidate, CatalogMatch } from './types'
import { selectCatalogMatch, trackIdentityKey } from './trackIdentity'

function candidate(title: string, artist: string): CatalogCandidate {
  return {
    title,
    artist,
    album: '',
    reason: '테스트 추천 이유',
  }
}

function match(
  title: string,
  artist: string,
  catalogId = `${artist}-${title}`,
): CatalogMatch {
  return {
    provider: 'itunes',
    catalogId,
    title,
    artist,
    album: 'Test Album',
    url: `https://music.apple.com/kr/song/${encodeURIComponent(catalogId)}`,
  }
}

describe('trackIdentityKey', () => {
  it('normalizes Unicode, spacing, case, and punctuation', () => {
    expect(trackIdentityKey(candidate('  Ditto! ', 'NEW JEANS'))).toBe(
      trackIdentityKey(candidate('ditto', 'new-jeans')),
    )
  })
})

describe('selectCatalogMatch', () => {
  it('verifies exact Korean and English title-artist matches', () => {
    expect(selectCatalogMatch(candidate('Ditto', 'NewJeans'), [
      match('Ditto', 'NewJeans'),
    ])).toMatchObject({
      status: 'verified',
      match: { title: 'Ditto', artist: 'NewJeans' },
    })

    expect(selectCatalogMatch(candidate('사랑으로', 'wave to earth'), [
      match('사랑으로', 'wave to earth'),
    ])).toMatchObject({ status: 'verified' })
  })

  it('accepts harmless punctuation and spacing differences', () => {
    expect(selectCatalogMatch(candidate('Your Dog Loves You', 'Colde'), [
      match('Your Dog Loves You!', 'COLDE'),
    ])).toMatchObject({ status: 'verified' })
  })

  it('does not verify a matching title with a different artist', () => {
    expect(selectCatalogMatch(candidate('Home', 'Artist A'), [
      match('Home', 'Artist B'),
    ])).toEqual({ status: 'ambiguous', reason: 'low_similarity' })
  })

  it('classifies live, remix, and remaster variants conservatively', () => {
    expect(selectCatalogMatch(candidate('Blue Monday', 'New Order'), [
      match('Blue Monday (Live)', 'New Order'),
    ])).toEqual({ status: 'ambiguous', reason: 'version_mismatch' })

    expect(selectCatalogMatch(candidate('Blue Monday - Remix', 'New Order'), [
      match('Blue Monday', 'New Order'),
    ])).toEqual({ status: 'ambiguous', reason: 'version_mismatch' })

    expect(selectCatalogMatch(candidate('Blue Monday', 'New Order'), [
      match('Blue Monday (2016 Remaster)', 'New Order'),
    ])).toEqual({ status: 'ambiguous', reason: 'version_mismatch' })
  })

  it('does not choose between multiple equally strong catalog results', () => {
    expect(selectCatalogMatch(candidate('Home', 'Artist A'), [
      match('Home', 'Artist A', 'id-1'),
      match('Home', 'Artist A', 'id-2'),
    ])).toEqual({ status: 'ambiguous', reason: 'multiple_matches' })
  })

  it('returns not_found when the catalog returned no songs', () => {
    expect(selectCatalogMatch(candidate('Imaginary Song', 'Imaginary Artist'), []))
      .toEqual({ status: 'not_found' })
  })
})
