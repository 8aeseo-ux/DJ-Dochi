// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CatalogCandidate, CatalogSearchSeed } from './types'
import { createItunesCatalogProvider } from './itunesCatalogProvider'

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

function itunesResponse(results: unknown[], status = 200): Response {
  return new Response(JSON.stringify({
    resultCount: results.length,
    results,
  }), { status })
}

function song(overrides: Record<string, unknown> = {}) {
  return {
    wrapperType: 'track',
    kind: 'song',
    trackId: 1659513441,
    trackName: 'Ditto',
    artistName: 'NewJeans',
    trackTimeMillis: 185507,
    collectionName: 'NewJeans 1st Single OMG',
    trackViewUrl: 'https://music.apple.com/kr/album/ditto/1659513440?i=1659513441',
    primaryGenreName: 'K-Pop',
    ...overrides,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('createItunesCatalogProvider', () => {
  it('discovers canonical songs for a bounded catalog search seed', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(itunesResponse([
      song(),
      song({
        trackId: 2,
        trackName: 'Hype Boy',
        collectionName: 'NewJeans 1st EP New Jeans',
      }),
    ]))
    const provider = createItunesCatalogProvider({ fetch: fetchMock })

    await expect(provider.search(GENRE_SEED)).resolves.toEqual({
      status: 'ok',
      tracks: [
        {
          provider: 'itunes',
          catalogId: '1659513441',
          title: 'Ditto',
          artist: 'NewJeans',
          album: 'NewJeans 1st Single OMG',
          url: 'https://music.apple.com/kr/album/ditto/1659513440?i=1659513441',
          durationMs: 185507,
          primaryGenre: 'K-Pop',
          providerScore: 1,
        },
        expect.objectContaining({
          catalogId: '2',
          title: 'Hype Boy',
          providerScore: 0.5,
        }),
      ],
    })

    const requestedUrl = new URL(String(fetchMock.mock.calls[0][0]))
    expect(requestedUrl.searchParams.get('term')).toBe('dream pop')
    expect(requestedUrl.searchParams.get('limit')).toBe('25')
  })

  it('reuses successful discovery results for the same normalized term', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(itunesResponse([song()]))
    const provider = createItunesCatalogProvider({ fetch: fetchMock })

    const first = provider.search(GENRE_SEED)
    const second = provider.search({ ...GENRE_SEED, term: ' Dream   Pop ' })

    await expect(Promise.all([first, second])).resolves.toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('searches the Korean song catalog and returns canonical metadata', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(itunesResponse([song()]))
    const provider = createItunesCatalogProvider({ fetch: fetchMock })

    await expect(provider.verify(CANDIDATE)).resolves.toEqual({
      status: 'verified',
      match: {
        provider: 'itunes',
        catalogId: '1659513441',
        title: 'Ditto',
        artist: 'NewJeans',
        album: 'NewJeans 1st Single OMG',
        url: 'https://music.apple.com/kr/album/ditto/1659513440?i=1659513441',
        durationMs: 185507,
      },
    })

    const requestedUrl = new URL(String(fetchMock.mock.calls[0][0]))
    expect(requestedUrl.origin + requestedUrl.pathname).toBe('https://itunes.apple.com/search')
    expect(requestedUrl.searchParams.get('term')).toBe('Ditto NewJeans')
    expect(requestedUrl.searchParams.get('country')).toBe('KR')
    expect(requestedUrl.searchParams.get('media')).toBe('music')
    expect(requestedUrl.searchParams.get('entity')).toBe('song')
    expect(requestedUrl.searchParams.get('limit')).toBe('10')
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal)
  })

  it('returns not_found when iTunes has no results', async () => {
    const provider = createItunesCatalogProvider({
      fetch: vi.fn<typeof fetch>().mockResolvedValue(itunesResponse([])),
    })

    await expect(provider.verify(CANDIDATE)).resolves.toEqual({ status: 'not_found' })
  })

  it('returns ambiguous when title and artist are not sufficiently similar', async () => {
    const provider = createItunesCatalogProvider({
      fetch: vi.fn<typeof fetch>().mockResolvedValue(itunesResponse([
        song({ trackName: 'Different Song', artistName: 'Different Artist' }),
      ])),
    })

    await expect(provider.verify(CANDIDATE)).resolves.toEqual({
      status: 'ambiguous',
      reason: 'low_similarity',
    })
  })

  it('classifies rate limits and HTTP failures without throwing', async () => {
    const rateLimited = createItunesCatalogProvider({
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 429 })),
    })
    const failed = createItunesCatalogProvider({
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 503 })),
    })

    await expect(rateLimited.verify(CANDIDATE)).resolves.toEqual({
      status: 'unavailable',
      reason: 'rate_limited',
    })
    await expect(failed.verify(CANDIDATE)).resolves.toEqual({
      status: 'unavailable',
      reason: 'network',
    })
  })

  it('classifies invalid JSON responses', async () => {
    const provider = createItunesCatalogProvider({
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response('{', { status: 200 })),
    })

    await expect(provider.verify(CANDIDATE)).resolves.toEqual({
      status: 'unavailable',
      reason: 'invalid_response',
    })
  })

  it('aborts a slow iTunes request at the configured timeout', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((_input, init) => (
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Timed out', 'AbortError'))
        })
      })
    ))
    const provider = createItunesCatalogProvider({
      fetch: fetchMock,
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
