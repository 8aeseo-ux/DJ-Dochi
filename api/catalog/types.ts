export type CatalogCandidate = {
  title: string
  artist: string
  album: string
  reason: string
}

export type CatalogMatch = {
  provider: 'itunes' | 'musicbrainz'
  catalogId: string
  title: string
  artist: string
  album: string
  url: string | null
  durationMs?: number | null
  version?: string
}

export type CatalogVerificationResult =
  | { status: 'verified'; match: CatalogMatch }
  | { status: 'not_found' }
  | {
    status: 'ambiguous'
    reason: 'multiple_matches' | 'version_mismatch' | 'low_similarity'
  }
  | {
    status: 'unavailable'
    reason: 'timeout' | 'rate_limited' | 'network' | 'invalid_response'
  }

export interface CatalogVerificationProvider {
  readonly id: 'itunes' | 'musicbrainz'
  verify(
    candidate: CatalogCandidate,
    signal?: AbortSignal,
  ): Promise<CatalogVerificationResult>
}
