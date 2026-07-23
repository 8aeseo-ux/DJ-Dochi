import type { ConfirmedTrack } from '../../src/types/mixtape'
import type { TasteDiscoveryProfile } from '../../src/services/llm/types'
import { normalizeCatalogTerm, normalizeTasteTerms } from './catalogSearchVocabulary'
import type {
  CatalogSearchPlan,
  CatalogSearchSeed,
} from './types'

const MAXIMUM_BASE_SEEDS = 5

function uniqueConfirmedArtists(
  tracks: readonly ConfirmedTrack[],
): string[] {
  const artists: string[] = []
  const seen = new Set<string>()

  for (const track of tracks) {
    const normalized = normalizeCatalogTerm(track.artist)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    artists.push(track.artist.trim())
    if (artists.length === 2) break
  }

  return artists
}

function deduplicateSeeds(
  seeds: readonly CatalogSearchSeed[],
): CatalogSearchSeed[] {
  const seen = new Set<string>()

  return seeds.filter((seed) => {
    const key = normalizeCatalogTerm(seed.term)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function buildCatalogSearchPlan(
  profile: TasteDiscoveryProfile,
  confirmedTracks: readonly ConfirmedTrack[],
): CatalogSearchPlan {
  const genres = normalizeTasteTerms(profile.genres)
  const moods = normalizeTasteTerms(profile.moods)
  const keywords = normalizeTasteTerms(profile.searchKeywords)
  const genreTerms = [...genres]
  for (const keyword of keywords) {
    if (!genreTerms.includes(keyword)) genreTerms.push(keyword)
  }

  const genreSeeds = genreTerms.slice(0, 2).map<CatalogSearchSeed>((term, index) => ({
    id: `genre-${index + 1}`,
    kind: 'genre',
    term,
    weight: 1 - index * 0.05,
  }))
  const combinationSeeds = genreTerms.slice(0, 2).flatMap<CatalogSearchSeed>((genre, index) => {
    const mood = moods[index] ?? moods[0]
    return mood
      ? [{
          id: `genre-mood-${index + 1}`,
          kind: 'genre_mood',
          term: `${genre} ${mood}`,
          weight: 0.9 - index * 0.05,
        }]
      : []
  })
  const artistSeeds = uniqueConfirmedArtists(confirmedTracks)
    .map<CatalogSearchSeed>((artist, index) => ({
      id: `input-artist-${index + 1}`,
      kind: 'input_artist',
      term: artist,
      weight: 0.82 - index * 0.04,
      sourceArtist: artist,
    }))

  const balanced = [
    ...genreSeeds,
    ...combinationSeeds.slice(0, artistSeeds.length > 0 ? 1 : 2),
    ...artistSeeds,
  ]
  const fallback = [
    ...combinationSeeds,
    ...genreTerms.slice(2).map<CatalogSearchSeed>((term, index) => ({
      id: `keyword-${index + 1}`,
      kind: 'genre',
      term,
      weight: 0.7 - index * 0.03,
    })),
  ]

  return {
    seeds: deduplicateSeeds([...balanced, ...fallback])
      .slice(0, MAXIMUM_BASE_SEEDS),
  }
}
