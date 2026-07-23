import { MixtapeAnalysisError } from '../../src/types/mixtapeAnalysis'
import {
  MixtapeResultSchema,
  type ConfirmedTrack,
  type MixtapeResult,
  type TasteProfile,
} from '../../src/types/mixtape'
import type { LlmMixtapeDraft } from '../../src/services/llm/types'
import type { CatalogCandidate } from '../catalog/types'
import { trackIdentityKey } from '../catalog/trackIdentity'

function normalize(value: string) {
  return value.trim()
}

function emptyPlatformReferences() {
  return {
    spotify: { id: null, url: null },
    appleMusic: { id: null, url: null },
    youtubeMusic: { id: null, url: null },
  }
}

export type NormalizedMixtapeDraftCandidates = {
  tasteProfile: TasteProfile
  metadata: Omit<LlmMixtapeDraft['mixtape'], 'tracks'>
  candidates: CatalogCandidate[]
}

export function normalizeMixtapeDraftCandidates(
  draft: LlmMixtapeDraft,
  confirmedTracks: readonly ConfirmedTrack[],
): NormalizedMixtapeDraftCandidates {
  const inputKeys = new Set(confirmedTracks.map(trackIdentityKey))
  const seenRecommendations = new Set<string>()
  const candidates = draft.mixtape.tracks.flatMap((track): CatalogCandidate[] => {
    const title = normalize(track.title)
    const artist = normalize(track.artist)
    const album = normalize(track.album)
    const reason = normalize(track.reason)
    const key = trackIdentityKey({ title, artist })

    if (!title || !artist || !reason || inputKeys.has(key) || seenRecommendations.has(key)) return []
    seenRecommendations.add(key)

    return [{
      title,
      artist,
      album,
      reason,
    }]
  })

  if (candidates.length === 0) {
    throw new MixtapeAnalysisError({
      code: 'INVALID_RESPONSE',
      message: '새로운 추천곡을 만들지 못했어요. 다시 분석해주세요.',
      retryable: true,
    })
  }

  return {
    tasteProfile: {
      summary: normalize(draft.tasteProfile.summary),
      genres: draft.tasteProfile.genres.map(normalize).filter(Boolean),
      moods: draft.tasteProfile.moods.map(normalize).filter(Boolean),
      traits: draft.tasteProfile.traits.map(normalize).filter(Boolean),
    },
    metadata: {
      title: normalize(draft.mixtape.title),
      subtitle: normalize(draft.mixtape.subtitle),
      dochiComment: normalize(draft.mixtape.dochiComment),
      design: {
        atmosphere: normalize(draft.mixtape.design.atmosphere),
        palette: draft.mixtape.design.palette.map(normalize).filter(Boolean),
        texture: normalize(draft.mixtape.design.texture),
        motifs: draft.mixtape.design.motifs.map(normalize).filter(Boolean),
      },
    },
    candidates,
  }
}

export function normalizeMixtapeDraft(
  draft: LlmMixtapeDraft,
  confirmedTracks: readonly ConfirmedTrack[],
): MixtapeResult {
  const normalized = normalizeMixtapeDraftCandidates(draft, confirmedTracks)
  const result = {
    tasteProfile: normalized.tasteProfile,
    mixtape: {
      ...normalized.metadata,
      tracks: normalized.candidates.map((track, index) => ({
        ...track,
        id: `recommendation-${String(index + 1).padStart(3, '0')}`,
        catalogStatus: 'unverified' as const,
        platforms: emptyPlatformReferences(),
      })),
    },
  }

  const parsed = MixtapeResultSchema.safeParse(result)
  if (!parsed.success) {
    throw new MixtapeAnalysisError({
      code: 'INVALID_RESPONSE',
      message: '취향 분석 결과 형식을 확인할 수 없어요. 다시 시도해주세요.',
      retryable: true,
    }, { cause: parsed.error })
  }

  return parsed.data
}
