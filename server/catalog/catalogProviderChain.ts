import { trackIdentityKey } from './trackIdentity.js'
import { TtlCache } from './ttlCache.js'
import type {
  CatalogCandidate,
  CatalogVerificationProvider,
  CatalogVerificationResult,
} from './types.js'

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

export type CatalogProviderPhases = CatalogProviderChain & {
  verifyPrimary(
    candidate: CatalogCandidate,
    requestCache?: Map<string, CatalogVerificationResult>,
    signal?: AbortSignal,
  ): Promise<CatalogVerificationResult>
  verifyFallback(
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

function providerCacheKey(
  provider: CatalogVerificationProvider,
  candidate: CatalogCandidate,
): string {
  return `${provider.id}:${trackIdentityKey(candidate)}`
}

function getCachedResult(
  key: string,
  requestCache: Map<string, CatalogVerificationResult> | undefined,
  cache: TtlCache<string, CatalogVerificationResult>,
): CatalogVerificationResult | undefined {
  const requestCached = requestCache?.get(key)
  if (requestCached) return requestCached

  const sharedCached = cache.get(key)
  if (sharedCached) requestCache?.set(key, sharedCached)
  return sharedCached
}

async function verifyWithProvider(
  provider: CatalogVerificationProvider,
  candidate: CatalogCandidate,
  requestCache: Map<string, CatalogVerificationResult> | undefined,
  cache: TtlCache<string, CatalogVerificationResult>,
  signal: AbortSignal | undefined,
): Promise<CatalogVerificationResult> {
  const key = providerCacheKey(provider, candidate)
  const cached = getCachedResult(key, requestCache, cache)
  if (cached) return cached

  const result = await provider.verify(candidate, signal)
  requestCache?.set(key, result)
  if (result.status !== 'unavailable') cache.set(key, result)
  return result
}

export function createCatalogProviderChain(options: {
  primary: CatalogVerificationProvider
  fallback: CatalogVerificationProvider
  cache?: TtlCache<string, CatalogVerificationResult>
  }): CatalogProviderPhases {
  const cache = options.cache ?? defaultCatalogCache
  const verifyPrimary = (
    candidate: CatalogCandidate,
    requestCache?: Map<string, CatalogVerificationResult>,
    signal?: AbortSignal,
  ) => verifyWithProvider(options.primary, candidate, requestCache, cache, signal)
  const verifyFallback = (
    candidate: CatalogCandidate,
    requestCache?: Map<string, CatalogVerificationResult>,
    signal?: AbortSignal,
  ) => verifyWithProvider(options.fallback, candidate, requestCache, cache, signal)

  return {
    verifyPrimary,
    verifyFallback,

    async verify(candidate, requestCache, signal) {
      const key = trackIdentityKey(candidate)
      const cached = getCachedResult(key, requestCache, cache)
      if (cached) return cached

      const primaryResult = await verifyPrimary(candidate, requestCache, signal)
      const result = primaryResult.status === 'verified'
        ? primaryResult
        : await verifyFallback(candidate, requestCache, signal).then((fallbackResult) => (
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
