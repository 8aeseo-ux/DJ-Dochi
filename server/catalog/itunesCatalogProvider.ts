import { normalizeCatalogTerm } from './catalogSearchVocabulary.js'
import { selectCatalogMatch } from './trackIdentity.js'
import { TtlCache } from './ttlCache.js'
import type {
  CatalogDiscoveredTrack,
  CatalogDiscoveryProvider,
  CatalogDiscoveryResult,
  CatalogMatch,
  CatalogVerificationProvider,
  CatalogVerificationResult,
} from './types.js'

export const ITUNES_TIMEOUT_MS = 4_000

const DISCOVERY_CACHE_TTL_MS = 6 * 60 * 60 * 1_000
const DISCOVERY_CACHE_MAX_ENTRIES = 100

type ItunesCatalogProviderOptions = {
  fetch?: typeof fetch
  timeoutMs?: number
  country?: string
}

export type ItunesCatalogProvider =
  & CatalogVerificationProvider
  & CatalogDiscoveryProvider

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseItunesSongs(value: unknown): CatalogDiscoveredTrack[] | null {
  if (!isRecord(value) || !Array.isArray(value.results)) return null

  const tracks = value.results.flatMap((item, index): CatalogDiscoveredTrack[] => {
    if (
      !isRecord(item)
      || (typeof item.trackId !== 'string' && typeof item.trackId !== 'number')
      || typeof item.trackName !== 'string'
      || typeof item.artistName !== 'string'
    ) {
      return []
    }

    return [{
      provider: 'itunes',
      catalogId: String(item.trackId),
      title: item.trackName,
      artist: item.artistName,
      album: typeof item.collectionName === 'string' ? item.collectionName : '',
      url: typeof item.trackViewUrl === 'string' ? item.trackViewUrl : null,
      durationMs: typeof item.trackTimeMillis === 'number' ? item.trackTimeMillis : null,
      primaryGenre: typeof item.primaryGenreName === 'string' ? item.primaryGenreName : '',
      providerScore: 1 / (index + 1),
    }]
  })

  return value.results.length > 0 && tracks.length === 0 ? null : tracks
}

function asCatalogMatch(track: CatalogDiscoveredTrack): CatalogMatch {
  return {
    provider: track.provider,
    catalogId: track.catalogId,
    title: track.title,
    artist: track.artist,
    album: track.album,
    url: track.url,
    durationMs: track.durationMs,
  }
}

function discoveryUnavailable(
  reason: Extract<CatalogDiscoveryResult, { status: 'unavailable' }>['reason'],
): CatalogDiscoveryResult {
  return { status: 'unavailable', reason }
}

function verificationUnavailable(
  reason: Extract<CatalogVerificationResult, { status: 'unavailable' }>['reason'],
): CatalogVerificationResult {
  return { status: 'unavailable', reason }
}

export function createItunesCatalogProvider(
  options: ItunesCatalogProviderOptions = {},
): ItunesCatalogProvider {
  const request = options.fetch ?? fetch
  const timeoutMs = options.timeoutMs ?? ITUNES_TIMEOUT_MS
  const country = options.country ?? 'KR'
  const discoveryCache = new TtlCache<string, Promise<CatalogDiscoveryResult>>({
    ttlMs: DISCOVERY_CACHE_TTL_MS,
    maxEntries: DISCOVERY_CACHE_MAX_ENTRIES,
  })

  async function requestSongs(
    term: string,
    limit: number,
    externalSignal?: AbortSignal,
  ): Promise<CatalogDiscoveryResult> {
    const controller = new AbortController()
    let timedOut = false
    const abortFromCaller = () => controller.abort(externalSignal?.reason)
    externalSignal?.addEventListener('abort', abortFromCaller, { once: true })
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort(new DOMException('Catalog request timed out', 'TimeoutError'))
    }, timeoutMs)

    const url = new URL('https://itunes.apple.com/search')
    url.search = new URLSearchParams({
      term,
      country,
      media: 'music',
      entity: 'song',
      limit: String(limit),
    }).toString()

    try {
      const response = await request(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })

      if (response.status === 429) return discoveryUnavailable('rate_limited')
      if (!response.ok) return discoveryUnavailable('network')

      let payload: unknown
      try {
        payload = await response.json()
      } catch {
        return discoveryUnavailable('invalid_response')
      }

      const tracks = parseItunesSongs(payload)
      return tracks
        ? { status: 'ok', tracks }
        : discoveryUnavailable('invalid_response')
    } catch {
      return discoveryUnavailable(timedOut ? 'timeout' : 'network')
    } finally {
      clearTimeout(timeout)
      externalSignal?.removeEventListener('abort', abortFromCaller)
    }
  }

  return {
    id: 'itunes',
    search(seed, signal) {
      const key = normalizeCatalogTerm(seed.term)
      const cached = discoveryCache.get(key)
      if (cached) return cached

      const result = requestSongs(seed.term.trim(), 25, signal)
      discoveryCache.set(key, result)
      void result.then((value) => {
        if (value.status === 'unavailable') discoveryCache.delete(key)
      })
      return result
    },
    async verify(candidate, signal) {
      const result = await requestSongs(
        `${candidate.title} ${candidate.artist}`,
        10,
        signal,
      )
      if (result.status === 'unavailable') {
        return verificationUnavailable(result.reason)
      }
      return selectCatalogMatch(
        candidate,
        result.tracks.map(asCatalogMatch),
      )
    },
  }
}
