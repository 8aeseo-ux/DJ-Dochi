import type {
  CatalogCandidate,
  CatalogMatch,
  CatalogVerificationResult,
} from './types'

type CatalogSelectionResult = Exclude<
  CatalogVerificationResult,
  { status: 'unavailable' }
>

export const TITLE_SIMILARITY_THRESHOLD = 0.92
export const ARTIST_SIMILARITY_THRESHOLD = 0.9

const MATCH_WINNER_MARGIN = 0.02

const VERSION_PATTERNS = [
  ['live', /\b(?:live)\b|라이브/iu],
  ['remix', /\b(?:remix|rmx)\b|리믹스/iu],
  ['remaster', /\b(?:remaster|remastered)\b|리마스터/iu],
  ['acoustic', /\b(?:acoustic)\b|어쿠스틱/iu],
  ['instrumental', /\b(?:instrumental)\b|인스트루멘털/iu],
  ['edit', /\b(?:radio edit|edit)\b|에디트/iu],
  ['version', /\b(?:version)\b|버전/iu],
] as const

function normalizeText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .match(/[\p{L}\p{N}]+/gu)
    ?.join('') ?? ''
}

function versionTokens(value: string): Set<string> {
  return new Set(
    VERSION_PATTERNS
      .filter(([, pattern]) => pattern.test(value.normalize('NFKC')))
      .map(([token]) => token),
  )
}

function stripVersionSegments(value: string): string {
  const withoutVersionGroups = value.replace(/[\[(][^\])]*[\])]/gu, (segment) => (
    VERSION_PATTERNS.some(([, pattern]) => pattern.test(segment)) ? ' ' : segment
  ))

  return VERSION_PATTERNS.reduce(
    (current, [, pattern]) => current.replace(pattern, ' '),
    withoutVersionGroups,
  )
}

function setsEqual(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  return left.size === right.size && [...left].every((value) => right.has(value))
}

function diceCoefficient(left: string, right: string): number {
  if (left === right) return 1
  if (left.length < 2 || right.length < 2) return 0

  const rightPairs = new Map<string, number>()
  for (let index = 0; index < right.length - 1; index += 1) {
    const pair = right.slice(index, index + 2)
    rightPairs.set(pair, (rightPairs.get(pair) ?? 0) + 1)
  }

  let overlap = 0
  for (let index = 0; index < left.length - 1; index += 1) {
    const pair = left.slice(index, index + 2)
    const available = rightPairs.get(pair) ?? 0
    if (available > 0) {
      overlap += 1
      rightPairs.set(pair, available - 1)
    }
  }

  return (2 * overlap) / (left.length + right.length - 2)
}

export function trackIdentityKey(
  track: Pick<CatalogCandidate, 'title' | 'artist'>,
): string {
  return `${normalizeText(track.title)}\u0000${normalizeText(track.artist)}`
}

export function selectCatalogMatch(
  candidate: CatalogCandidate,
  items: readonly CatalogMatch[],
): CatalogSelectionResult {
  if (items.length === 0) return { status: 'not_found' }

  const candidateTitle = normalizeText(stripVersionSegments(candidate.title))
  const candidateArtist = normalizeText(candidate.artist)
  const candidateVersions = versionTokens(candidate.title)
  const scored = items.map((match) => {
    const titleSimilarity = diceCoefficient(
      candidateTitle,
      normalizeText(stripVersionSegments(match.title)),
    )
    const artistSimilarity = diceCoefficient(
      candidateArtist,
      normalizeText(match.artist),
    )
    const hasVersionMismatch = !setsEqual(
      candidateVersions,
      versionTokens(match.title),
    )

    return {
      match,
      titleSimilarity,
      artistSimilarity,
      hasVersionMismatch,
      score: (titleSimilarity + artistSimilarity) / 2,
    }
  }).sort((left, right) => right.score - left.score)

  const accepted = scored.filter((item) => (
    !item.hasVersionMismatch
    && item.titleSimilarity >= TITLE_SIMILARITY_THRESHOLD
    && item.artistSimilarity >= ARTIST_SIMILARITY_THRESHOLD
  ))

  if (accepted.length > 1 && accepted[0].score - accepted[1].score < MATCH_WINNER_MARGIN) {
    return { status: 'ambiguous', reason: 'multiple_matches' }
  }

  if (accepted[0]) {
    return { status: 'verified', match: accepted[0].match }
  }

  const versionMismatch = scored.some((item) => (
    item.hasVersionMismatch
    && item.titleSimilarity >= TITLE_SIMILARITY_THRESHOLD
    && item.artistSimilarity >= ARTIST_SIMILARITY_THRESHOLD
  ))

  return versionMismatch
    ? { status: 'ambiguous', reason: 'version_mismatch' }
    : { status: 'ambiguous', reason: 'low_similarity' }
}
