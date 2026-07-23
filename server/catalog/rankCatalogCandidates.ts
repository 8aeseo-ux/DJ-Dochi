import type { TasteDiscoveryProfile } from '../../src/services/llm/types'
import { MixtapeAnalysisError } from '../../src/types/mixtapeAnalysis'
import { MIXTAPE_PIPELINE } from '../mixtapePipelineConfig'
import { normalizeTasteTerms } from './catalogSearchVocabulary'
import { artistIdentityKey } from './trackIdentity'
import type {
  CatalogPoolTrack,
  CatalogSearchBucketKind,
} from './types'

export const RELEVANCE_WEIGHTS = {
  sourceQuery: 0.35,
  tasteOverlap: 0.25,
  repeatedDiscovery: 0.20,
  providerConfidence: 0.10,
  noveltyAndVersion: 0.10,
} as const

type RankingContext = {
  tasteProfile: TasteDiscoveryProfile
  inputArtists: ReadonlySet<string>
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function tasteOverlap(
  track: CatalogPoolTrack,
  profile: TasteDiscoveryProfile,
): number {
  const tasteTerms = normalizeTasteTerms([
    ...profile.genres,
    ...profile.moods,
    ...profile.traits,
    ...profile.searchKeywords,
  ])
  const genre = track.primaryGenre
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/\s+/gu, ' ')
    .trim()
  if (!genre) return 0

  if (tasteTerms.some((term) => genre === term)) return 1
  if (tasteTerms.some((term) => genre.includes(term) || term.includes(genre))) {
    return 0.7
  }
  return 0
}

function isInputArtist(
  artist: string,
  inputArtists: ReadonlySet<string>,
): boolean {
  const normalizedInputs = new Set(
    [...inputArtists].map(artistIdentityKey),
  )
  return normalizedInputs.has(artistIdentityKey(artist))
}

export function scoreCatalogCandidate(
  track: CatalogPoolTrack,
  context: RankingContext,
): number {
  const sourceQuery = clamp(track.sourceWeight)
  const overlap = tasteOverlap(track, context.tasteProfile)
  const repeatedDiscovery = clamp(
    (new Set(track.sourceKinds).size - 1) / 2,
  )
  const providerConfidence = clamp(track.providerScore)
  const noveltyAndVersion = isInputArtist(
    track.artist,
    context.inputArtists,
  ) ? 0.6 : 1

  return (
    sourceQuery * RELEVANCE_WEIGHTS.sourceQuery
    + overlap * RELEVANCE_WEIGHTS.tasteOverlap
    + repeatedDiscovery * RELEVANCE_WEIGHTS.repeatedDiscovery
    + providerConfidence * RELEVANCE_WEIGHTS.providerConfidence
    + noveltyAndVersion * RELEVANCE_WEIGHTS.noveltyAndVersion
  )
}

function insufficientCandidates(): never {
  throw new MixtapeAnalysisError({
    code: 'CATALOG_CANDIDATES_INSUFFICIENT',
    stage: 'catalog',
    message: '확인되는 추천곡 후보를 충분히 모으지 못했어요.',
    retryable: true,
  })
}

export function shortlistCatalogCandidates(
  tracks: readonly CatalogPoolTrack[],
  context: RankingContext,
): CatalogPoolTrack[] {
  const distinctArtists = new Set(
    tracks.map(({ artist }) => artistIdentityKey(artist)),
  )
  if (
    distinctArtists.size
    < MIXTAPE_PIPELINE.minimumShortlistCandidates
  ) {
    return insufficientCandidates()
  }

  const ranked = tracks.map((track) => ({
    ...track,
    relevanceScore: scoreCatalogCandidate(track, context),
  })).sort((left, right) => (
    right.relevanceScore - left.relevanceScore
    || left.id.localeCompare(right.id)
  ))
  const selected: CatalogPoolTrack[] = []
  const selectedIds = new Set<string>()
  const selectedArtists = new Set<string>()

  const countKind = (kind: CatalogSearchBucketKind) => selected.filter(
    ({ sourceKinds }) => sourceKinds.includes(kind),
  ).length
  const inputArtistCount = () => countKind('input_artist')
  const canSelect = (track: CatalogPoolTrack) => (
    !selectedIds.has(track.id)
    && !selectedArtists.has(artistIdentityKey(track.artist))
    && (
      !track.sourceKinds.includes('input_artist')
      || inputArtistCount() < 2
    )
  )
  const select = (track: CatalogPoolTrack) => {
    selected.push(track)
    selectedIds.add(track.id)
    selectedArtists.add(artistIdentityKey(track.artist))
  }
  const reserve = (
    kind: CatalogSearchBucketKind,
    requested: number,
  ) => {
    const availableArtists = new Set(
      ranked
        .filter(({ sourceKinds }) => sourceKinds.includes(kind))
        .map(({ artist }) => artistIdentityKey(artist)),
    ).size
    const target = Math.min(requested, availableArtists)

    for (const track of ranked) {
      if (countKind(kind) >= target) break
      if (!track.sourceKinds.includes(kind) || !canSelect(track)) continue
      select(track)
    }
  }

  reserve('genre', 4)
  reserve('genre_mood', 3)
  reserve('similar_artist', 2)

  for (const track of ranked) {
    if (selected.length >= MIXTAPE_PIPELINE.shortlistTarget) break
    if (canSelect(track)) select(track)
  }

  if (
    selected.length
    < MIXTAPE_PIPELINE.minimumShortlistCandidates
  ) {
    return insufficientCandidates()
  }

  return selected.slice(
    0,
    MIXTAPE_PIPELINE.maximumShortlistCandidates,
  )
}
