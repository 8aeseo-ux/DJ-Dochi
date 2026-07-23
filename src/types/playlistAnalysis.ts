import { z } from 'zod'

export const ExtractedTrackSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  artist: z.string(),
  album: z.string(),
  confidence: z.number().min(0).max(1),
}).strict()

export const PlaylistExtractionResultSchema = z.object({
  sourceApp: z.string().nullable(),
  tracks: z.array(ExtractedTrackSchema),
  warnings: z.array(z.string()),
}).strict()

export type ExtractedTrack = z.infer<typeof ExtractedTrackSchema>
export type PlaylistExtractionResult = z.infer<typeof PlaylistExtractionResultSchema>

export type PlaylistAnalysisErrorCode =
  | 'UNSUPPORTED_IMAGE_TYPE'
  | 'IMAGE_TOO_LARGE'
  | 'OCR_ENGINE_FAILED'
  | 'OCR_RECOGNITION_FAILED'
  | 'NO_TRACKS_FOUND'
  | 'PROVIDER_UNAVAILABLE'
  | 'REQUEST_TIMEOUT'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE'
  | 'MISSING_IMAGE'
  | 'MISSING_API_KEY'
  | 'MISSING_MODEL'
  | 'ORIGIN_NOT_ALLOWED'
  | 'ANALYSIS_FAILED'

export type PlaylistAnalysisIssue = {
  code: PlaylistAnalysisErrorCode
  message: string
  retryable: boolean
}

export class PlaylistAnalysisError extends Error implements PlaylistAnalysisIssue {
  readonly code: PlaylistAnalysisErrorCode
  readonly retryable: boolean
  readonly cause?: unknown

  constructor(issue: PlaylistAnalysisIssue, options?: { cause?: unknown }) {
    super(issue.message)
    this.name = 'PlaylistAnalysisError'
    this.code = issue.code
    this.retryable = issue.retryable
    this.cause = options?.cause
  }
}

export function parsePlaylistExtractionResult(value: unknown): PlaylistExtractionResult {
  const parsed = PlaylistExtractionResultSchema.safeParse(value)

  if (!parsed.success) {
    throw new PlaylistAnalysisError({
      code: 'INVALID_RESPONSE',
      message: '분석 결과 형식을 확인할 수 없어요. 다시 시도해주세요.',
      retryable: true,
    }, { cause: parsed.error })
  }

  return parsed.data
}
