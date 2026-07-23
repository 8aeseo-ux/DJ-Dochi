import { z } from 'zod'
import { MixtapeAnalysisError } from './mixtapeAnalysis'

const nullableString = z.string().nullable()

export const PlatformTrackReferenceSchema = z.object({
  id: nullableString,
  url: nullableString,
}).strict()

export const PlatformTrackReferencesSchema = z.object({
  spotify: PlatformTrackReferenceSchema,
  appleMusic: PlatformTrackReferenceSchema,
  youtubeMusic: PlatformTrackReferenceSchema,
}).strict()

export const ConfirmedTrackSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  artist: z.string().trim().min(1),
  album: z.string().trim(),
}).strict()

export const GenerateMixtapeRequestSchema = z.object({
  tracks: z.array(ConfirmedTrackSchema).min(1).max(50),
}).strict()

export const TapeDesignMetadataSchema = z.object({
  atmosphere: z.string().min(1),
  palette: z.array(z.string().min(1)).min(1).max(6),
  texture: z.string().min(1),
  motifs: z.array(z.string().min(1)).min(1).max(6),
}).strict()

export const TasteProfileSchema = z.object({
  summary: z.string().min(1),
  genres: z.array(z.string().min(1)).min(1).max(8),
  moods: z.array(z.string().min(1)).min(1).max(8),
  traits: z.array(z.string().min(1)).min(1).max(8),
}).strict()

export const MixtapeTrackSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  artist: z.string().min(1),
  album: z.string(),
  reason: z.string().min(1),
  catalogStatus: z.literal('verified'),
  platforms: PlatformTrackReferencesSchema,
}).strict()

export const MixtapeResultSchema = z.object({
  tasteProfile: TasteProfileSchema,
  mixtape: z.object({
    title: z.string().min(1),
    subtitle: z.string().min(1),
    dochiComment: z.string().min(1),
    design: TapeDesignMetadataSchema,
    tracks: z.array(MixtapeTrackSchema).min(1).max(8),
  }).strict(),
}).strict()

export type PlatformTrackReference = z.infer<typeof PlatformTrackReferenceSchema>
export type PlatformTrackReferences = z.infer<typeof PlatformTrackReferencesSchema>
export type ConfirmedTrack = z.infer<typeof ConfirmedTrackSchema>
export type GenerateMixtapeRequest = z.infer<typeof GenerateMixtapeRequestSchema>
export type TapeDesignMetadata = z.infer<typeof TapeDesignMetadataSchema>
export type TasteProfile = z.infer<typeof TasteProfileSchema>
export type MixtapeTrack = z.infer<typeof MixtapeTrackSchema>
export type MixtapeResult = z.infer<typeof MixtapeResultSchema>
export type GenerateMixtapeResponse = MixtapeResult

export function parseMixtapeResult(value: unknown): MixtapeResult {
  const parsed = MixtapeResultSchema.safeParse(value)

  if (!parsed.success) {
    throw new MixtapeAnalysisError({
      code: 'INVALID_RESPONSE',
      stage: 'curation',
      message: '취향 분석 결과 형식을 확인할 수 없어요. 다시 시도해주세요.',
      retryable: true,
    }, { cause: parsed.error })
  }

  return parsed.data
}
