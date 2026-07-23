import type {
  LlmMixtapeSelection,
  TasteDiscoveryProfile,
} from '../../src/services/llm/types'
import {
  parseMixtapeResult,
  type ConfirmedTrack,
  type MixtapeResult,
  type PlatformTrackReferences,
} from '../../src/types/mixtape'
import { MixtapeAnalysisError } from '../../src/types/mixtapeAnalysis'
import {
  artistIdentityKey,
  trackIdentityKey,
} from './trackIdentity'
import type { CatalogPoolTrack } from './types'

type AssembleVerifiedMixtapeOptions = {
  tasteProfile: TasteDiscoveryProfile
  selection: LlmMixtapeSelection
  shortlist: readonly CatalogPoolTrack[]
  confirmedTracks: readonly ConfirmedTrack[]
}

function invalidSelection(message: string): never {
  throw new MixtapeAnalysisError({
    code: 'CURATION_INVALID_RESPONSE',
    message,
    retryable: true,
  })
}

function platformReferences(
  candidate: CatalogPoolTrack,
): PlatformTrackReferences {
  return {
    spotify: { id: null, url: null },
    appleMusic: candidate.provider === 'itunes'
      ? { id: candidate.catalogId, url: candidate.url }
      : { id: null, url: null },
    youtubeMusic: { id: null, url: null },
  }
}

export function assembleVerifiedMixtape({
  tasteProfile,
  selection,
  shortlist,
  confirmedTracks,
}: AssembleVerifiedMixtapeOptions): MixtapeResult {
  if (selection.tracks.length !== 5) {
    return invalidSelection('믹스테이프는 서로 다른 후보 5곡이 필요해요.')
  }

  const candidatesById = new Map(
    shortlist.map((candidate) => [candidate.id, candidate]),
  )
  const selectedIds = new Set<string>()
  const selectedArtists = new Set<string>()
  const confirmedKeys = new Set(confirmedTracks.map(trackIdentityKey))

  const tracks = selection.tracks.map(({ candidateId, reason }) => {
    if (selectedIds.has(candidateId)) {
      return invalidSelection('같은 후보곡이 두 번 선택됐어요.')
    }
    selectedIds.add(candidateId)

    const candidate = candidatesById.get(candidateId)
    if (!candidate) {
      return invalidSelection('카탈로그 후보 목록에 없는 곡이 선택됐어요.')
    }
    if (!reason.trim()) {
      return invalidSelection('추천 이유가 비어 있어요.')
    }

    const artistKey = artistIdentityKey(candidate.artist)
    if (selectedArtists.has(artistKey)) {
      return invalidSelection('한 아티스트의 곡은 하나만 선택할 수 있어요.')
    }
    selectedArtists.add(artistKey)

    if (confirmedKeys.has(trackIdentityKey(candidate))) {
      return invalidSelection('입력 목록과 같은 곡은 다시 추천할 수 없어요.')
    }

    return {
      id: candidate.id,
      title: candidate.title,
      artist: candidate.artist,
      album: candidate.album,
      reason: reason.trim(),
      catalogStatus: 'verified' as const,
      platforms: platformReferences(candidate),
    }
  })
  const {
    searchKeywords: _searchKeywords,
    ...publicTasteProfile
  } = tasteProfile

  return parseMixtapeResult({
    tasteProfile: publicTasteProfile,
    mixtape: {
      title: selection.title,
      subtitle: selection.subtitle,
      dochiComment: selection.dochiComment,
      design: selection.design,
      tracks,
    },
  })
}
