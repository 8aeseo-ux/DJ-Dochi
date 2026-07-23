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

export type CatalogSearchBucketKind =
  | 'genre'
  | 'genre_mood'
  | 'input_artist'
  | 'similar_artist'

export type CatalogSearchSeed = {
  id: string
  kind: CatalogSearchBucketKind
  term: string
  weight: number
  sourceArtist?: string
  catalogEvidence?: {
    provider: 'musicbrainz'
    entityId: string
    tag: string
  }
}

export type CatalogSearchPlan = {
  seeds: CatalogSearchSeed[]
}

export type CatalogDiscoveredTrack = {
  provider: 'itunes' | 'musicbrainz'
  catalogId: string
  title: string
  artist: string
  album: string
  url: string | null
  durationMs: number | null
  primaryGenre: string
  providerScore: number
}

export type CatalogUnavailableReason =
  | 'timeout'
  | 'rate_limited'
  | 'network'
  | 'invalid_response'

export type CatalogDiscoveryResult =
  | { status: 'ok'; tracks: readonly CatalogDiscoveredTrack[] }
  | { status: 'unavailable'; reason: CatalogUnavailableReason }

export interface CatalogDiscoveryProvider {
  search(
    seed: CatalogSearchSeed,
    signal?: AbortSignal,
  ): Promise<CatalogDiscoveryResult>
}

export interface SimilarArtistSeedResolver {
  findSimilarArtistSeed(
    inputArtist: string,
    signal?: AbortSignal,
  ): Promise<CatalogSearchSeed | null>
}

export type CatalogPoolTrack = CatalogDiscoveredTrack & {
  id: string
  sourceBucketIds: string[]
  sourceKinds: CatalogSearchBucketKind[]
  sourceWeight: number
  relevanceScore: number
  catalogStatus: 'verified'
}

export type CatalogCandidateCollection = {
  tracks: CatalogPoolTrack[]
  attemptedSeeds: number
  itunesCalls: number
  musicBrainzCalls: number
  unavailableCalls: number
}
