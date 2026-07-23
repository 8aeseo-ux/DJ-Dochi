import { trackIdentityKey } from './trackIdentity'
import { TtlCache } from './ttlCache'
import type {
  CatalogCandidate,
  CatalogVerificationProvider,
  CatalogVerificationResult,
} from './types'

const CATALOG_CACHE_TTL_MS = 6 * 60 * 60 * 1_000
const CATALOG_CACHE_MAX_ENTRIES = 500

const defaultCatalogCache = new TtlCache<string, CatalogVerificationResult>({
  ttlMs: CATALOG_CACHE_TTL_MS,
  maxEntries: CATALOG_CACHE_MAX_ENTRIES,
})

export type CatalogProviderChain = {
  verify(
    candidate: CatalogCandidate,
    requestCache?: Map<string, CatalogVerificationResult>,
    signal?: AbortSignal,
  ): Promise<CatalogVerificationResult>
}

function combineUnverifiedResults(
  primary: CatalogVerificationResult,
  fallback: CatalogVerificationResult,
): CatalogVerificationResult {
  if (primary.status === 'ambiguous') return primary
  if (fallback.status === 'ambiguous') return fallback
  if (fallback.status === 'unavailable') return fallback
  if (primary.status === 'unavailable') return primary
  return { status: 'not_found' }
}

export function createCatalogProviderChain(options: {
  primary: CatalogVerificationProvider
  fallback: CatalogVerificationProvider
  cache?: TtlCache<string, CatalogVerificationResult>
}): CatalogProviderChain {
  const cache = options.cache ?? defaultCatalogCache

  return {
    async verify(candidate, requestCache, signal) {
      const key = trackIdentityKey(candidate)
      const requestCached = requestCache?.get(key)
      if (requestCached) return requestCached

      const sharedCached = cache.get(key)
      if (sharedCached) {
        requestCache?.set(key, sharedCached)
        return sharedCached
      }

      const primaryResult = await options.primary.verify(candidate, signal)
      const result = primaryResult.status === 'verified'
        ? primaryResult
        : await options.fallback.verify(candidate, signal).then((fallbackResult) => (
            fallbackResult.status === 'verified'
              ? fallbackResult
              : combineUnverifiedResults(primaryResult, fallbackResult)
          ))

      requestCache?.set(key, result)
      if (result.status !== 'unavailable') cache.set(key, result)
      return result
    },
  }
}
