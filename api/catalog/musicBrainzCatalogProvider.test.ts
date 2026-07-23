// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CatalogCandidate, CatalogSearchSeed } from './types'
import { createMusicBrainzCatalogProvider } from './musicBrainzCatalogProvider'

const CANDIDATE: CatalogCandidate = {
  title: 'Ditto',
  artist: 'NewJeans',
  album: '',
  reason: '몽환적인 결이 이어져.',
}

const GENRE_SEED: CatalogSearchSeed = {
  id: 'genre-1',
  kind: 'genre',
  term: 'dream pop',
  weight: 1,
}

const ARTIST_SEED: CatalogSearchSeed = {
  id: 'input-artist-1',
  kind: 'input_artist',
  term: 'Beach House',
  weight: 0.8,
  sourceArtist: 'Beach House',
}

function musicBrainzResponse(recordings: unknown[], status = 200): Response {
  return new Response(JSON.stringify({
    count: recordings.length,
    recordings,
  }), { status })
}

function recording(overrides: Record<string, unknown> = {}) {
  return {
    id: 'f4a0d0d2-b6be-4ffe-8a86-8d6168839056',
    title: 'Ditto',
    length: 185507,
    'artist-credit': [{ name: 'NewJeans' }],
    releases: [{ title: 'NewJeans 1st Single OMG' }],
    score: 96,
    tags: [{ name: 'dream pop', count: 8 }],
    ...overrides,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('createMusicBrainzCatalogProvider', () => {
  it('discovers official recordings by tag with normalized provider scores', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      musicBrainzResponse([recording()]),
    )
    const provider = createMusicBrainzCatalogProvider({
      fetch: fetchMock,
      minIntervalMs: 0,
    })

    await expect(provider.search(GENRE_SEED)).resolves.toEqual({
      status: 'ok',
      tracks: [{
        provider: 'musicbrainz',
        catalogId: 'f4a0d0d2-b6be-4ffe-8a86-8d6168839056',
        title: 'Ditto',
        artist: 'NewJeans',
        album: 'NewJeans 1st Single OMG',
        url: 'https://musicbrainz.org/recording/f4a0d0d2-b6be-4ffe-8a86-8d6168839056',
        durationMs: 185507,
        primaryGenre: 'dream pop',
        providerScore: 0.96,
      }],
    })

    const requestedUrl = new URL(String(fetchMock.mock.calls[0][0]))
    expect(requestedUrl.searchParams.get('query')).toBe(
      'tag:"dream pop" AND status:official',
    )
    expect(requestedUrl.searchParams.get('limit')).toBe('25')
  })

  it('uses an exact artist recording query for confirmed-artist seeds', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      musicBrainzResponse([recording()]),
    )
    const provider = createMusicBrainzCatalogProvider({
      fetch: fetchMock,
      minIntervalMs: 0,
    })

    await provider.search(ARTIST_SEED)

    const requestedUrl = new URL(String(fetchMock.mock.calls[0][0]))
    expect(requestedUrl.searchParams.get('query')).toBe(
      'artist:"Beach House" AND status:official',
    )
  })

  it('creates a similar-artist seed only from exact names and overlapping catalog tags', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        artists: [{
          id: 'artist-beach-house',
          name: 'Beach House',
          score: 100,
          aliases: [{ name: 'Beach House' }],
          tags: [{ name: 'dream pop', count: 10 }],
        }],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        artists: [{
          id: 'artist-cocteau-twins',
          name: 'Cocteau Twins',
          score: 98,
          tags: [{ name: 'dream pop', count: 8 }],
        }],
      })))
    const provider = createMusicBrainzCatalogProvider({
      fetch: fetchMock,
      minIntervalMs: 0,
    })

    await expect(provider.findSimilarArtistSeed('Beach House')).resolves.toEqual({
      id: 'similar-artist-artist-cocteau-twins',
      kind: 'similar_artist',
      term: 'Cocteau Twins',
      weight: 0.76,
      sourceArtist: 'Beach House',
      catalogEvidence: {
        provider: 'musicbrainz',
        entityId: 'artist-cocteau-twins',
        tag: 'dream pop',
      },
    })

    const firstUrl = new URL(String(fetchMock.mock.calls[0][0]))
    const secondUrl = new URL(String(fetchMock.mock.calls[1][0]))
    expect(firstUrl.pathname).toBe('/ws/2/artist')
    expect(firstUrl.searchParams.get('query')).toBe('artist:"Beach House"')
    expect(secondUrl.searchParams.get('query')).toBe('tag:"dream pop"')
  })

  it('skips similar-artist expansion when the exact artist has no catalog tags', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      artists: [{
        id: 'artist-beach-house',
        name: 'Beach House',
        score: 100,
        tags: [],
      }],
    })))
    const provider = createMusicBrainzCatalogProvider({
      fetch: fetchMock,
      minIntervalMs: 0,
    })

    await expect(provider.findSimilarArtistSeed('Beach House')).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('searches recordings with a meaningful user agent and maps canonical metadata', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      musicBrainzResponse([recording()]),
    )
    const provider = createMusicBrainzCatalogProvider({
      fetch: fetchMock,
      minIntervalMs: 0,
    })

    await expect(provider.verify(CANDIDATE)).resolves.toEqual({
      status: 'verified',
      match: {
        provider: 'musicbrainz',
        catalogId: 'f4a0d0d2-b6be-4ffe-8a86-8d6168839056',
        title: 'Ditto',
        artist: 'NewJeans',
        album: 'NewJeans 1st Single OMG',
        url: 'https://musicbrainz.org/recording/f4a0d0d2-b6be-4ffe-8a86-8d6168839056',
        durationMs: 185507,
      },
    })

    const requestedUrl = new URL(String(fetchMock.mock.calls[0][0]))
    expect(requestedUrl.origin + requestedUrl.pathname).toBe(
      'https://musicbrainz.org/ws/2/recording',
    )
    expect(requestedUrl.searchParams.get('query')).toBe(
      'recording:"Ditto" AND artist:"NewJeans"',
    )
    expect(requestedUrl.searchParams.get('fmt')).toBe('json')
    expect(requestedUrl.searchParams.get('limit')).toBe('10')
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('User-Agent'))
      .toContain('DJ-DOCHI')
  })

  it('joins artist credits and delegates ambiguous matches conservatively', async () => {
    const provider = createMusicBrainzCatalogProvider({
      minIntervalMs: 0,
      fetch: vi.fn<typeof fetch>().mockResolvedValue(musicBrainzResponse([
        recording({
          title: 'Ditto (Live)',
          'artist-credit': [
            { name: 'NewJeans', joinphrase: ' feat. ' },
            { name: 'Guest' },
          ],
        }),
      ])),
    })

    await expect(provider.verify({
      ...CANDIDATE,
      artist: 'NewJeans feat. Guest',
    })).resolves.toEqual({
      status: 'ambiguous',
      reason: 'version_mismatch',
    })
  })

  it('uses MusicBrainz disambiguation text to reject alternate mixes', async () => {
    const provider = createMusicBrainzCatalogProvider({
      minIntervalMs: 0,
      fetch: vi.fn<typeof fetch>().mockResolvedValue(musicBrainzResponse([
        recording({ disambiguation: 'Dolby Atmos mix' }),
      ])),
    })

    await expect(provider.verify(CANDIDATE)).resolves.toEqual({
      status: 'ambiguous',
      reason: 'version_mismatch',
    })
  })

  it('returns not_found for an empty recording result', async () => {
    const provider = createMusicBrainzCatalogProvider({
      minIntervalMs: 0,
      fetch: vi.fn<typeof fetch>().mockResolvedValue(musicBrainzResponse([])),
    })

    await expect(provider.verify(CANDIDATE)).resolves.toEqual({ status: 'not_found' })
  })

  it('keeps consecutive MusicBrainz request starts at least the configured interval apart', async () => {
    let now = 1_000
    const starts: number[] = []
    const waits: number[] = []
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => {
      starts.push(now)
      return musicBrainzResponse([])
    })
    const provider = createMusicBrainzCatalogProvider({
      fetch: fetchMock,
      minIntervalMs: 1_100,
      now: () => now,
      wait: async (duration) => {
        waits.push(duration)
        now += duration
      },
    })

    await provider.verify(CANDIDATE)
    await provider.verify({ ...CANDIDATE, title: 'Hype Boy' })

    expect(starts).toEqual([1_000, 2_100])
    expect(waits).toEqual([1_100])
  })

  it('classifies rate limits, HTTP failures, and invalid JSON', async () => {
    const rateLimited = createMusicBrainzCatalogProvider({
      minIntervalMs: 0,
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 429 })),
    })
    const failed = createMusicBrainzCatalogProvider({
      minIntervalMs: 0,
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 503 })),
    })
    const invalid = createMusicBrainzCatalogProvider({
      minIntervalMs: 0,
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response('{', { status: 200 })),
    })

    await expect(rateLimited.verify(CANDIDATE)).resolves.toEqual({
      status: 'unavailable',
      reason: 'rate_limited',
    })
    await expect(failed.verify(CANDIDATE)).resolves.toEqual({
      status: 'unavailable',
      reason: 'network',
    })
    await expect(invalid.verify(CANDIDATE)).resolves.toEqual({
      status: 'unavailable',
      reason: 'invalid_response',
    })
  })

  it('aborts a slow MusicBrainz request at the configured timeout', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((_input, init) => (
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Timed out', 'AbortError'))
        })
      })
    ))
    const provider = createMusicBrainzCatalogProvider({
      fetch: fetchMock,
      minIntervalMs: 0,
      timeoutMs: 25,
    })

    const result = provider.verify(CANDIDATE)
    await vi.advanceTimersByTimeAsync(26)

    await expect(result).resolves.toEqual({
      status: 'unavailable',
      reason: 'timeout',
    })
  })
})
