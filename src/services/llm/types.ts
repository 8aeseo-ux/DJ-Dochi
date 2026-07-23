import type {
  ConfirmedTrack,
  TapeDesignMetadata,
  TasteProfile,
} from '../../types/mixtape'

export type LlmTrackInput = Pick<ConfirmedTrack, 'title' | 'artist' | 'album'>

export type LlmMixtapeDraft = {
  tasteProfile: TasteProfile
  mixtape: {
    title: string
    subtitle: string
    dochiComment: string
    design: TapeDesignMetadata
    tracks: Array<{
      title: string
      artist: string
      album: string
      reason: string
    }>
  }
}

export type LlmRecommendationDraft = LlmMixtapeDraft['mixtape']['tracks'][number]

export type ReplacementRecommendationInput = {
  confirmedTracks: readonly LlmTrackInput[]
  excludedTracks: readonly Pick<LlmTrackInput, 'title' | 'artist'>[]
  count: number
}

export type LlmRequestOptions = {
  signal?: AbortSignal
}

export interface LlmProvider {
  readonly id: string
  generateMixtape(
    input: { tracks: readonly LlmTrackInput[] },
    options?: LlmRequestOptions,
  ): Promise<LlmMixtapeDraft>
  generateReplacementTracks(
    input: ReplacementRecommendationInput,
    options?: LlmRequestOptions,
  ): Promise<LlmRecommendationDraft[]>
}
