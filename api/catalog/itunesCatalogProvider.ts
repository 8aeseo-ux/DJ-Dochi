import { selectCatalogMatch } from './trackIdentity'
import type {
  CatalogMatch,
  CatalogVerificationProvider,
  CatalogVerificationResult,
} from './types'

export const ITUNES_TIMEOUT_MS = 4_000

type ItunesCatalogProviderOptions = {
  fetch?: typeof fetch
  timeoutMs?: number
  country?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseItunesSongs(value: unknown): CatalogMatch[] | null {
  if (!isRecord(value) || !Array.isArray(value.results)) return null

  const matches = value.results.flatMap((item): CatalogMatch[] => {
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
    }]
  })

  return value.results.length > 0 && matches.length === 0 ? null : matches
}

function unavailable(
  reason: Extract<CatalogVerificationResult, { status: 'unavailable' }>['reason'],
): CatalogVerificationResult {
  return { status: 'unavailable', reason }
}

export function createItunesCatalogProvider(
  options: ItunesCatalogProviderOptions = {},
): CatalogVerificationProvider {
  const request = options.fetch ?? fetch
  const timeoutMs = options.timeoutMs ?? ITUNES_TIMEOUT_MS
  const country = options.country ?? 'KR'

  return {
    id: 'itunes',
    async verify(candidate, externalSignal) {
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
        term: `${candidate.title} ${candidate.artist}`,
        country,
        media: 'music',
        entity: 'song',
        limit: '10',
      }).toString()

      try {
        const response = await request(url, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        })

        if (response.status === 429) return unavailable('rate_limited')
        if (!response.ok) return unavailable('network')

        let payload: unknown
        try {
          payload = await response.json()
        } catch {
          return unavailable('invalid_response')
        }

        const songs = parseItunesSongs(payload)
        if (!songs) return unavailable('invalid_response')
        return selectCatalogMatch(candidate, songs)
      } catch {
        return unavailable(timedOut ? 'timeout' : 'network')
      } finally {
        clearTimeout(timeout)
        externalSignal?.removeEventListener('abort', abortFromCaller)
      }
    },
  }
}
