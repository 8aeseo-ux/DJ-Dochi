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
import { MIXTAPE_PIPELINE } from '../mixtapePipelineConfig'
import type { CatalogProviderPhases } from './catalogProviderChain'
import { trackIdentityKey } from './trackIdentity'
import type {
  CatalogCandidate,
  CatalogMatch,
  CatalogVerificationResult,
} from './types'

export const MAX_REPLACEMENT_ROUNDS = MIXTAPE_PIPELINE.maximumReplacementRounds

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
  phase: 'itunes' | 'musicbrainz',
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
    phase,
  }

  if (result.status === 'verified') logger.info(entry)
  else logger.warn(entry)
}

export async function verifyMixtapeRecommendations(options: {
  draft: LlmMixtapeDraft
  confirmedTracks: readonly ConfirmedTrack[]
  llmProvider: LlmProvider
  catalog: CatalogProviderPhases
  logger?: SafeLogger
  signal?: AbortSignal
  deadlineAt?: number
  now?: () => number
}): Promise<MixtapeResult> {
  const logger = options.logger ?? defaultLogger
  const now = options.now ?? Date.now
  const normalized = normalizeMixtapeDraftCandidates(
    options.draft,
    options.confirmedTracks,
  )
  const targetCount = Math.min(
    normalized.candidates.length,
    MIXTAPE_PIPELINE.targetVerifiedTracks,
  )
  const requestCache = new Map<string, CatalogVerificationResult>()
  const excluded = new Map<string, { title: string; artist: string }>()
  const verified = new Map<string, VerifiedCandidate>()
  let sawUnavailable = false
  let sawCatalogDecision = false
  let musicBrainzChecks = 0

  const shouldStopNewWork = () => (
    options.signal?.aborted === true
    || verified.size >= MIXTAPE_PIPELINE.targetVerifiedTracks
    || (
      options.deadlineAt !== undefined
      && options.deadlineAt - now() <= MIXTAPE_PIPELINE.stopBufferMs
    )
  )

  const timedOut = () => (
    options.signal?.aborted === true
    || (
      options.deadlineAt !== undefined
      && options.deadlineAt - now() <= MIXTAPE_PIPELINE.stopBufferMs
    )
  )

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
    const startedAt = now()
    const primaryFailures: Array<{
      candidate: CatalogCandidate
      candidateIndex: number
    }> = []
    let itunesChecks = 0
    let roundMusicBrainzChecks = 0
    let nextCandidateIndex = 0

    function recordResult(
      candidate: CatalogCandidate,
      result: CatalogVerificationResult,
    ) {
      if (result.status === 'unavailable') sawUnavailable = true
      else sawCatalogDecision = true

      if (result.status !== 'verified') return

      const canonicalKey = trackIdentityKey(result.match)
      if (!verified.has(canonicalKey)) {
        verified.set(canonicalKey, { candidate, match: result.match })
        excluded.set(canonicalKey, {
          title: result.match.title,
          artist: result.match.artist,
        })
      }
    }

    async function primaryWorker() {
      while (
        nextCandidateIndex < candidates.length
        && !shouldStopNewWork()
      ) {
        const candidateIndex = nextCandidateIndex
        nextCandidateIndex += 1
        const candidate = candidates[candidateIndex]
        itunesChecks += 1
        const result = await options.catalog.verifyPrimary(
          candidate,
          requestCache,
          options.signal,
        )
        logVerification(logger, result, round, candidateIndex, 'itunes')
        recordResult(candidate, result)

        if (result.status !== 'verified') {
          primaryFailures.push({ candidate, candidateIndex })
        }
      }
    }

    const workerCount = Math.min(
      MIXTAPE_PIPELINE.itunesConcurrency,
      candidates.length,
    )
    await Promise.all(Array.from(
      { length: workerCount },
      () => primaryWorker(),
    ))

    for (const { candidate, candidateIndex } of primaryFailures) {
      if (
        shouldStopNewWork()
        || musicBrainzChecks >= MIXTAPE_PIPELINE.maximumMusicBrainzChecks
      ) {
        break
      }

      musicBrainzChecks += 1
      roundMusicBrainzChecks += 1
      const result = await options.catalog.verifyFallback(
        candidate,
        requestCache,
        options.signal,
      )
      logVerification(logger, result, round, candidateIndex, 'musicbrainz')
      recordResult(candidate, result)
    }

    logger.info({
      event: 'catalog_round',
      round,
      durationMs: Math.max(0, now() - startedAt),
      itunesChecks,
      musicBrainzChecks: roundMusicBrainzChecks,
      verifiedCount: verified.size,
    })
  }

  await verifyRound(normalized.candidates, 0)

  for (
    let round = 1;
    round <= MAX_REPLACEMENT_ROUNDS && !shouldStopNewWork();
    round += 1
  ) {
    const count = MIXTAPE_PIPELINE.targetVerifiedTracks - verified.size
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
    }, { signal: options.signal })
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

  if (verified.size < MIXTAPE_PIPELINE.minimumVerifiedTracks) {
    if (timedOut()) {
      throw new MixtapeAnalysisError({
        code: 'REQUEST_TIMEOUT',
        stage: 'catalog',
        message: '검증 시간이 너무 오래 걸렸어요. 다시 시도해주세요.',
        retryable: true,
      })
    }

    if (sawUnavailable && !sawCatalogDecision) {
      throw new MixtapeAnalysisError({
        code: 'CATALOG_UNAVAILABLE',
        stage: 'catalog',
        message: '음악 카탈로그에 연결하지 못했어요. 잠시 후 다시 시도해주세요.',
        retryable: true,
      })
    }

    throw new MixtapeAnalysisError({
      code: 'CATALOG_VERIFICATION_FAILED',
      stage: 'catalog',
      message: '실재하는 추천곡을 확인하지 못했어요. 다시 분석해주세요.',
      retryable: true,
    })
  }

  return toResult(normalized, [...verified.values()].slice(0, targetCount))
}
