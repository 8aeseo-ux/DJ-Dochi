// @vitest-environment node

import { describe, expect, it } from 'vitest'
import type { CatalogCandidate, CatalogMatch } from './types'
import {
  artistIdentityKey,
  hasUnsupportedVersion,
  normalizedCatalogText,
  selectCatalogMatch,
  trackIdentityKey,
} from './trackIdentity'

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
  durationMs?: number,
): CatalogMatch {
  return {
    provider: 'itunes',
    catalogId,
    title,
    artist,
    album: 'Test Album',
    url: `https://music.apple.com/kr/song/${encodeURIComponent(catalogId)}`,
    durationMs,
  }
}

describe('trackIdentityKey', () => {
  it('normalizes Unicode, spacing, case, and punctuation', () => {
    expect(trackIdentityKey(candidate('  Ditto! ', 'NEW JEANS'))).toBe(
      trackIdentityKey(candidate('ditto', 'new-jeans')),
    )
  })

  it('exposes stable text and artist normalization for candidate collection', () => {
    expect(normalizedCatalogText('  New-Jeans! ')).toBe('newjeans')
    expect(artistIdentityKey('NEW JEANS')).toBe(
      artistIdentityKey('new-jeans'),
    )
  })
})

describe('hasUnsupportedVersion', () => {
  it('rejects alternate versions unless the taste explicitly allows that form', () => {
    expect(hasUnsupportedVersion('Blue Monday (Live)', new Set())).toBe(true)
    expect(hasUnsupportedVersion('Blue Monday Remix', new Set(['remix']))).toBe(false)
    expect(hasUnsupportedVersion('Blue Monday', new Set())).toBe(false)
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

  it('treats duplicate releases with the same duration as one recording', () => {
    expect(selectCatalogMatch(candidate('Ditto', '뉴진스'), [
      match('Ditto', '뉴진스', 'single-release', 185_507),
      match('Ditto', '뉴진스', 'album-release', 185_507),
    ])).toMatchObject({
      status: 'verified',
      match: { catalogId: 'single-release' },
    })
  })

  it('does not collapse a separately tagged mix into the original recording', () => {
    expect(selectCatalogMatch(candidate('Ditto', 'NewJeans'), [{
      ...match('Ditto', 'NewJeans', 'atmos-release', 185_507),
      version: 'Dolby Atmos mix',
    }])).toEqual({
      status: 'ambiguous',
      reason: 'version_mismatch',
    })
  })

  it('returns not_found when the catalog returned no songs', () => {
    expect(selectCatalogMatch(candidate('Imaginary Song', 'Imaginary Artist'), []))
      .toEqual({ status: 'not_found' })
  })
})
