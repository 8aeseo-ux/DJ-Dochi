import type { ConfirmedTrack } from '../../src/types/mixtape.js'
import type { TasteDiscoveryProfile } from '../../src/services/llm/types.js'
import { MIXTAPE_PIPELINE } from '../mixtapePipelineConfig.js'
import {
  artistIdentityKey,
  hasUnsupportedVersion,
  normalizedCatalogText,
  trackIdentityKey,
} from './trackIdentity.js'
import type {
  CatalogCandidateCollection,
  CatalogDiscoveredTrack,
  CatalogDiscoveryProvider,
  CatalogPoolTrack,
  CatalogSearchPlan,
  CatalogSearchSeed,
  SimilarArtistSeedResolver,
} from './types.js'

export type CatalogDiscoveryHit = {
  seed: CatalogSearchSeed
  track: CatalogDiscoveredTrack
}

type NormalizeCatalogCandidatesOptions = {
  confirmedTracks: readonly ConfirmedTrack[]
  tasteProfile: TasteDiscoveryProfile
  maximumTracks: number
}

type CollectCatalogCandidatesOptions = {
  plan: CatalogSearchPlan
  tasteProfile: TasteDiscoveryProfile
  confirmedTracks: readonly ConfirmedTrack[]
  itunes: CatalogDiscoveryProvider
  musicBrainz: CatalogDiscoveryProvider & SimilarArtistSeedResolver
  signal?: AbortSignal
  deadlineAt: number
  now?: () => number
}

const VERSION_TERMS = [
  'live',
  'remix',
  'remaster',
  'acoustic',
  'instrumental',
  'edit',
  'version',
  'mix',
] as const

function allowedVersionTerms(profile: TasteDiscoveryProfile): Set<string> {
  const profileText = [
    ...profile.genres,
    ...profile.moods,
    ...profile.traits,
    ...profile.searchKeywords,
  ].join(' ').normalize('NFKC').toLocaleLowerCase()

  return new Set(
    VERSION_TERMS.filter((term) => profileText.includes(term)),
  )
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)]
}

function candidateQuality(candidate: CatalogPoolTrack): number {
  return (
    candidate.providerScore * candidate.sourceWeight
    + (candidate.provider === 'itunes' && candidate.url ? 0.2 : 0)
  )
}

function mergeCandidate(
  current: CatalogPoolTrack,
  incoming: CatalogPoolTrack,
): CatalogPoolTrack {
  const preferred = (
    incoming.provider === 'itunes' && current.provider !== 'itunes'
  ) || (
    incoming.provider === current.provider
    && candidateQuality(incoming) > candidateQuality(current)
  )
    ? incoming
    : current

  return {
    ...preferred,
    sourceBucketIds: unique([
      ...current.sourceBucketIds,
      ...incoming.sourceBucketIds,
    ]),
    sourceKinds: unique([
      ...current.sourceKinds,
      ...incoming.sourceKinds,
    ]),
    sourceWeight: Math.max(current.sourceWeight, incoming.sourceWeight),
    providerScore: Math.max(current.providerScore, incoming.providerScore),
  }
}

function asPoolTrack(hit: CatalogDiscoveryHit): CatalogPoolTrack {
  return {
    ...hit.track,
    id: `${hit.track.provider}:${hit.track.catalogId}`,
    sourceBucketIds: [hit.seed.id],
    sourceKinds: [hit.seed.kind],
    sourceWeight: hit.seed.weight,
    relevanceScore: 0,
    catalogStatus: 'verified',
  }
}

export function normalizeCatalogCandidates(
  hits: readonly CatalogDiscoveryHit[],
  options: NormalizeCatalogCandidatesOptions,
): CatalogPoolTrack[] {
  const confirmedKeys = new Set(
    options.confirmedTracks.map((track) => trackIdentityKey(track)),
  )
  const permittedVersions = allowedVersionTerms(options.tasteProfile)
  const byRecording = new Map<string, CatalogPoolTrack>()

  for (const hit of hits) {
    if (
      !hit.track.title.trim()
      || !hit.track.artist.trim()
      || confirmedKeys.has(trackIdentityKey(hit.track))
      || hasUnsupportedVersion(hit.track.title, permittedVersions)
    ) {
      continue
    }

    const key = trackIdentityKey(hit.track)
    const incoming = asPoolTrack(hit)
    const current = byRecording.get(key)
    byRecording.set(
      key,
      current ? mergeCandidate(current, incoming) : incoming,
    )
  }

  const selected: CatalogPoolTrack[] = []
  const artistPositions = new Map<string, number>()
  const albumKeys = new Set<string>()

  for (const candidate of byRecording.values()) {
    const artistKey = artistIdentityKey(candidate.artist)
    const existingPosition = artistPositions.get(artistKey)
    if (existingPosition !== undefined) {
      if (
        candidateQuality(candidate)
        > candidateQuality(selected[existingPosition])
      ) {
        selected[existingPosition] = candidate
      }
      continue
    }

    const albumKey = normalizedCatalogText(candidate.album)
    if (albumKey && albumKeys.has(albumKey)) continue

    artistPositions.set(artistKey, selected.length)
    if (albumKey) albumKeys.add(albumKey)
    selected.push(candidate)
    if (selected.length === options.maximumTracks) break
  }

  return selected
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  worker: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let nextIndex = 0

  async function runWorker() {
    while (nextIndex < values.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await worker(values[index])
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, values.length) },
      () => runWorker(),
    ),
  )
  return results
}

export async function collectCatalogCandidates({
  plan,
  tasteProfile,
  confirmedTracks,
  itunes,
  musicBrainz,
  signal,
  deadlineAt,
  now = Date.now,
}: CollectCatalogCandidatesOptions): Promise<CatalogCandidateCollection> {
  let musicBrainzCalls = 0
  let unavailableCalls = 0
  const stopAt = deadlineAt - MIXTAPE_PIPELINE.stopBufferMs
  const canStart = () => !signal?.aborted && now() < stopAt

  if (!canStart()) {
    return {
      tracks: [],
      attemptedSeeds: 0,
      itunesCalls: 0,
      musicBrainzCalls: 0,
      unavailableCalls: 0,
    }
  }

  let seeds = [...plan.seeds]
  const firstInputArtist = seeds.find(
    (seed) => seed.kind === 'input_artist',
  )?.sourceArtist

  if (firstInputArtist && canStart()) {
    // The resolver performs at most two MusicBrainz network requests.
    musicBrainzCalls += 2
    const similarSeed = await musicBrainz.findSimilarArtistSeed(
      firstInputArtist,
      signal,
    )
    if (similarSeed) {
      seeds = [...seeds, similarSeed]
        .sort((left, right) => right.weight - left.weight)
        .slice(0, MIXTAPE_PIPELINE.maximumItunesSearches)
    }
  }

  const itunesResults = await mapWithConcurrency(
    seeds.slice(0, MIXTAPE_PIPELINE.maximumItunesSearches),
    MIXTAPE_PIPELINE.itunesConcurrency,
    async (seed) => {
      if (!canStart()) return { seed, result: null }
      const result = await itunes.search(seed, signal)
      if (result.status === 'unavailable') unavailableCalls += 1
      return { seed, result }
    },
  )
  const hits: CatalogDiscoveryHit[] = itunesResults.flatMap((entry) => (
    entry.result?.status === 'ok'
      ? entry.result.tracks.map((track) => ({ seed: entry.seed, track }))
      : []
  ))

  let normalized = normalizeCatalogCandidates(hits, {
    confirmedTracks,
    tasteProfile,
    maximumTracks: MIXTAPE_PIPELINE.maximumRawCandidates,
  })
  const fallbackSeeds = [...seeds]
    .sort((left, right) => right.weight - left.weight)

  for (const seed of fallbackSeeds) {
    if (
      normalized.length >= MIXTAPE_PIPELINE.minimumRawCandidates
      || musicBrainzCalls >= MIXTAPE_PIPELINE.maximumMusicBrainzRequests
      || !canStart()
    ) {
      break
    }

    musicBrainzCalls += 1
    const result = await musicBrainz.search(seed, signal)
    if (result.status === 'unavailable') {
      unavailableCalls += 1
      continue
    }
    hits.push(...result.tracks.map((track) => ({ seed, track })))
    normalized = normalizeCatalogCandidates(hits, {
      confirmedTracks,
      tasteProfile,
      maximumTracks: MIXTAPE_PIPELINE.maximumRawCandidates,
    })
  }

  return {
    tracks: normalized,
    attemptedSeeds: itunesResults.length
      + Math.max(0, musicBrainzCalls - (firstInputArtist ? 2 : 0)),
    itunesCalls: itunesResults.filter(({ result }) => result !== null).length,
    musicBrainzCalls,
    unavailableCalls,
  }
}
