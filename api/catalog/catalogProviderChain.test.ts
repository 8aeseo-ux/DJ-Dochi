// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import { TtlCache } from './ttlCache'
import type {
  CatalogCandidate,
  CatalogVerificationProvider,
  CatalogVerificationResult,
} from './types'
import { createCatalogProviderChain } from './catalogProviderChain'

const CANDIDATE: CatalogCandidate = {
  title: 'Ditto',
  artist: 'NewJeans',
  album: '',
  reason: '몽환적인 결이 이어져.',
}

const VERIFIED: CatalogVerificationResult = {
  status: 'verified',
  match: {
    provider: 'itunes',
    catalogId: '1659513441',
    title: 'Ditto',
    artist: 'NewJeans',
    album: 'OMG',
    url: 'https://music.apple.com/kr/album/ditto/1659513440?i=1659513441',
  },
}

function provider(
  id: CatalogVerificationProvider['id'],
  results: CatalogVerificationResult[],
): CatalogVerificationProvider & { verify: ReturnType<typeof vi.fn> } {
  return {
    id,
    verify: vi.fn().mockImplementation(async () => (
      results.shift() ?? { status: 'not_found' }
    )),
  }
}

function cache() {
  return new TtlCache<string, CatalogVerificationResult>({
    ttlMs: 6 * 60 * 60 * 1_000,
    maxEntries: 20,
  })
}

describe('createCatalogProviderChain', () => {
  it('stops after iTunes verifies a recommendation', async () => {
    const primary = provider('itunes', [VERIFIED])
    const fallback = provider('musicbrainz', [{ status: 'not_found' }])
    const chain = createCatalogProviderChain({ primary, fallback, cache: cache() })

    await expect(chain.verify(CANDIDATE)).resolves.toEqual(VERIFIED)
    expect(primary.verify).toHaveBeenCalledOnce()
    expect(fallback.verify).not.toHaveBeenCalled()
  })

  it.each([
    { status: 'not_found' } as const,
    { status: 'ambiguous', reason: 'low_similarity' } as const,
    { status: 'unavailable', reason: 'timeout' } as const,
  ])('calls MusicBrainz after the iTunes result $status', async (primaryResult) => {
    const primary = provider('itunes', [primaryResult])
    const fallbackVerified = {
      ...VERIFIED,
      match: { ...VERIFIED.match, provider: 'musicbrainz' as const },
    }
    const fallback = provider('musicbrainz', [fallbackVerified])
    const chain = createCatalogProviderChain({ primary, fallback, cache: cache() })

    await expect(chain.verify(CANDIDATE)).resolves.toEqual(fallbackVerified)
    expect(fallback.verify).toHaveBeenCalledOnce()
  })

  it('keeps ambiguity when the fallback only reports not_found', async () => {
    const chain = createCatalogProviderChain({
      primary: provider('itunes', [{ status: 'ambiguous', reason: 'version_mismatch' }]),
      fallback: provider('musicbrainz', [{ status: 'not_found' }]),
      cache: cache(),
    })

    await expect(chain.verify(CANDIDATE)).resolves.toEqual({
      status: 'ambiguous',
      reason: 'version_mismatch',
    })
  })

  it('reports unavailable when catalog coverage was interrupted', async () => {
    const chain = createCatalogProviderChain({
      primary: provider('itunes', [{ status: 'unavailable', reason: 'network' }]),
      fallback: provider('musicbrainz', [{ status: 'unavailable', reason: 'timeout' }]),
      cache: cache(),
    })

    await expect(chain.verify(CANDIDATE)).resolves.toEqual({
      status: 'unavailable',
      reason: 'timeout',
    })
  })

  it('reuses normalized title and artist combinations from the request cache', async () => {
    const primary = provider('itunes', [VERIFIED])
    const fallback = provider('musicbrainz', [])
    const chain = createCatalogProviderChain({ primary, fallback, cache: cache() })
    const requestCache = new Map<string, CatalogVerificationResult>()

    await chain.verify(CANDIDATE, requestCache)
    await expect(chain.verify({
      ...CANDIDATE,
      title: ' ditto! ',
      artist: 'NEW JEANS',
    }, requestCache)).resolves.toEqual(VERIFIED)

    expect(primary.verify).toHaveBeenCalledOnce()
  })

  it('reuses stable outcomes from the warm-instance TTL cache', async () => {
    const primary = provider('itunes', [VERIFIED])
    const fallback = provider('musicbrainz', [])
    const chain = createCatalogProviderChain({ primary, fallback, cache: cache() })

    await chain.verify(CANDIDATE)
    await chain.verify(CANDIDATE)

    expect(primary.verify).toHaveBeenCalledOnce()
  })

  it('does not keep unavailable outcomes in the long-lived TTL cache', async () => {
    const primary = provider('itunes', [
      { status: 'unavailable', reason: 'network' },
      { status: 'unavailable', reason: 'network' },
    ])
    const fallback = provider('musicbrainz', [
      { status: 'unavailable', reason: 'timeout' },
      { status: 'unavailable', reason: 'timeout' },
    ])
    const chain = createCatalogProviderChain({ primary, fallback, cache: cache() })

    await chain.verify(CANDIDATE)
    await chain.verify(CANDIDATE)

    expect(primary.verify).toHaveBeenCalledTimes(2)
    expect(fallback.verify).toHaveBeenCalledTimes(2)
  })
})
