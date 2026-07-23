import type {
  LlmProvider,
  LlmRecommendationDraft,
} from '../../src/services/llm/types'
import type {
  ConfirmedTrack,
  MixtapeResult,
} from '../../src/types/mixtape'
import { MixtapeAnalysisError } from '../../src/types/mixtapeAnalysis'
import {
  normalizeMixtapeDraftCandidates,
} from '../llm/normalizeMixtape'
import type { LlmMixtapeDraft } from '../../src/services/llm/types'
import type { CatalogProviderChain } from './catalogProviderChain'
import { trackIdentityKey } from './trackIdentity'
import type {
  CatalogCandidate,
  CatalogMatch,
  CatalogVerificationResult,
} from './types'

export const MAX_REPLACEMENT_ROUNDS = 2

type SafeLogger = Pick<Console, 'info' | 'warn'>

type VerifiedCandidate = {
  candidate: CatalogCandidate
  match: CatalogMatch
}

const defaultLogger: SafeLogger = {
  info: (...values) => console.info(...values),
  warn: (...values) => console.warn(...values),
}

function normalizeReplacementCandidates(
  tracks: readonly LlmRecommendationDraft[],
  excludedKeys: ReadonlySet<string>,
): CatalogCandidate[] {
  const seen = new Set<string>()

  return tracks.flatMap((track): CatalogCandidate[] => {
    const candidate = {
      title: track.title.trim(),
      artist: track.artist.trim(),
      album: track.album.trim(),
      reason: track.reason.trim(),
    }
    const key = trackIdentityKey(candidate)
    if (
      !candidate.title
      || !candidate.artist
      || !candidate.reason
      || excludedKeys.has(key)
      || seen.has(key)
    ) {
      return []
    }

    seen.add(key)
    return [candidate]
  })
}

function platformReferences(match: CatalogMatch) {
  return {
    spotify: { id: null, url: null },
    appleMusic: match.provider === 'itunes'
      ? { id: match.catalogId, url: match.url }
      : { id: null, url: null },
    youtubeMusic: { id: null, url: null },
  }
}

function toResult(
  normalized: ReturnType<typeof normalizeMixtapeDraftCandidates>,
  verified: readonly VerifiedCandidate[],
): MixtapeResult {
  return {
    tasteProfile: normalized.tasteProfile,
    mixtape: {
      ...normalized.metadata,
      tracks: verified.map(({ candidate, match }, index) => ({
        id: `recommendation-${String(index + 1).padStart(3, '0')}`,
        title: match.title,
        artist: match.artist,
        album: match.album,
        reason: candidate.reason,
        catalogStatus: 'verified',
        platforms: platformReferences(match),
      })),
    },
  } as unknown as MixtapeResult
}

function logVerification(
  logger: SafeLogger,
  result: CatalogVerificationResult,
  round: number,
  candidateIndex: number,
) {
  const entry = {
    event: 'catalog_verification',
    provider: result.status === 'verified' ? result.match.provider : null,
    status: result.status,
    ...(
      result.status === 'ambiguous' || result.status === 'unavailable'
        ? { reason: result.reason }
        : {}
    ),
    round,
    candidateIndex,
  }

  if (result.status === 'verified') logger.info(entry)
  else logger.warn(entry)
}

export async function verifyMixtapeRecommendations(options: {
  draft: LlmMixtapeDraft
  confirmedTracks: readonly ConfirmedTrack[]
  llmProvider: LlmProvider
  catalog: CatalogProviderChain
  logger?: SafeLogger
}): Promise<MixtapeResult> {
  const logger = options.logger ?? defaultLogger
  const normalized = normalizeMixtapeDraftCandidates(
    options.draft,
    options.confirmedTracks,
  )
  const targetCount = normalized.candidates.length
  const requestCache = new Map<string, CatalogVerificationResult>()
  const excluded = new Map<string, { title: string; artist: string }>()
  const verified = new Map<string, VerifiedCandidate>()
  let sawUnavailable = false
  let sawCatalogDecision = false

  for (const track of options.confirmedTracks) {
    excluded.set(trackIdentityKey(track), {
      title: track.title,
      artist: track.artist,
    })
  }
  for (const candidate of normalized.candidates) {
    excluded.set(trackIdentityKey(candidate), {
      title: candidate.title,
      artist: candidate.artist,
    })
  }

  async function verifyRound(
    candidates: readonly CatalogCandidate[],
    round: number,
  ) {
    for (const [candidateIndex, candidate] of candidates.entries()) {
      const result = await options.catalog.verify(candidate, requestCache)
      logVerification(logger, result, round, candidateIndex)

      if (result.status === 'unavailable') sawUnavailable = true
      else sawCatalogDecision = true

      if (result.status !== 'verified') continue

      const canonicalKey = trackIdentityKey(result.match)
      if (!verified.has(canonicalKey)) {
        verified.set(canonicalKey, { candidate, match: result.match })
        excluded.set(canonicalKey, {
          title: result.match.title,
          artist: result.match.artist,
        })
      }
    }
  }

  await verifyRound(normalized.candidates, 0)

  for (
    let round = 1;
    round <= MAX_REPLACEMENT_ROUNDS && verified.size < targetCount;
    round += 1
  ) {
    const count = targetCount - verified.size
    logger.info({
      event: 'replacement_request',
      round,
      requestedCount: count,
      verifiedCount: verified.size,
    })

    const replacements = await options.llmProvider.generateReplacementTracks({
      confirmedTracks: options.confirmedTracks.map(({ title, artist, album }) => ({
        title,
        artist,
        album,
      })),
      excludedTracks: [...excluded.values()],
      count,
    })
    const replacementCandidates = normalizeReplacementCandidates(
      replacements,
      new Set(excluded.keys()),
    )

    for (const candidate of replacementCandidates) {
      excluded.set(trackIdentityKey(candidate), {
        title: candidate.title,
        artist: candidate.artist,
      })
    }

    await verifyRound(replacementCandidates, round)
  }

  if (verified.size === 0) {
    if (sawUnavailable && !sawCatalogDecision) {
      throw new MixtapeAnalysisError({
        code: 'CATALOG_UNAVAILABLE',
        message: '음악 카탈로그에 연결하지 못했어요. 잠시 후 다시 시도해주세요.',
        retryable: true,
      })
    }

    throw new MixtapeAnalysisError({
      code: 'CATALOG_VERIFICATION_FAILED',
      message: '실재하는 추천곡을 확인하지 못했어요. 다시 분석해주세요.',
      retryable: true,
    })
  }

  return toResult(normalized, [...verified.values()].slice(0, targetCount))
}
