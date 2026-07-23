import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod'
import { MixtapeAnalysisError } from '../../src/types/mixtapeAnalysis'
import type {
  LlmMixtapeDraft,
  LlmProvider,
  LlmRecommendationDraft,
} from '../../src/services/llm/types'

const LlmRecommendationTrackSchema = z.object({
  title: z.string(),
  artist: z.string(),
  album: z.string(),
  reason: z.string(),
}).strict()

const LlmMixtapeDraftSchema = z.object({
  tasteProfile: z.object({
    summary: z.string(),
    genres: z.array(z.string()),
    moods: z.array(z.string()),
    traits: z.array(z.string()),
  }).strict(),
  mixtape: z.object({
    title: z.string(),
    subtitle: z.string(),
    dochiComment: z.string(),
    design: z.object({
      atmosphere: z.string(),
      palette: z.array(z.string()),
      texture: z.string(),
      motifs: z.array(z.string()),
    }).strict(),
    tracks: z.array(LlmRecommendationTrackSchema),
  }).strict(),
}).strict()

const ReplacementTracksSchema = z.object({
  tracks: z.array(LlmRecommendationTrackSchema).min(1).max(8),
}).strict()

type OpenAiProviderOptions = {
  apiKey: string
  model: string
  guidePrompt: string
}

function isTimeoutError(error: unknown) {
  return error instanceof Error && /timeout|timed out/i.test(error.message)
}

export function createOpenAiProvider({
  apiKey,
  model,
  guidePrompt,
}: OpenAiProviderOptions): LlmProvider {
  const client = new OpenAI({
    apiKey,
    timeout: 45_000,
    maxRetries: 1,
  })

  return {
    id: 'openai',
    async generateMixtape({ tracks }): Promise<LlmMixtapeDraft> {
      try {
        const response = await client.responses.parse({
          model,
          store: false,
          input: [
            {
              role: 'system',
              content: [{ type: 'input_text', text: guidePrompt }],
            },
            {
              role: 'user',
              content: [{
                type: 'input_text',
                text: JSON.stringify({
                  confirmedTracks: tracks.map(({ title, artist, album }) => ({ title, artist, album })),
                }),
              }],
            },
          ],
          text: {
            format: zodTextFormat(LlmMixtapeDraftSchema, 'dochi_mixtape_draft'),
          },
        })

        if (!response.output_parsed) {
          throw new MixtapeAnalysisError({
            code: 'INVALID_RESPONSE',
            message: '취향 분석 결과 형식을 확인할 수 없어요.',
            retryable: true,
          })
        }

        return response.output_parsed
      } catch (error) {
        if (error instanceof MixtapeAnalysisError) throw error

        throw new MixtapeAnalysisError({
          code: isTimeoutError(error) ? 'REQUEST_TIMEOUT' : 'ANALYSIS_FAILED',
          message: isTimeoutError(error)
            ? '취향 분석 시간이 너무 오래 걸렸어요. 다시 시도해주세요.'
            : '취향 분석 서비스에 연결하지 못했어요. 잠시 후 다시 시도해주세요.',
          retryable: true,
        }, { cause: error })
      }
    },
    async generateReplacementTracks({
      confirmedTracks,
      excludedTracks,
      count,
    }): Promise<LlmRecommendationDraft[]> {
      try {
        const response = await client.responses.parse({
          model,
          store: false,
          input: [
            {
              role: 'system',
              content: [{
                type: 'input_text',
                text: `${guidePrompt}

Replacement mode:
- Return only the requested replacement track candidates.
- Do not repeat confirmedTracks or excludedTracks.
- Every title and artist combination must be a real public release.`,
              }],
            },
            {
              role: 'user',
              content: [{
                type: 'input_text',
                text: JSON.stringify({
                  confirmedTracks: confirmedTracks.map(({ title, artist, album }) => ({
                    title,
                    artist,
                    album,
                  })),
                  excludedTracks: excludedTracks.map(({ title, artist }) => ({
                    title,
                    artist,
                  })),
                  requiredCount: count,
                }),
              }],
            },
          ],
          text: {
            format: zodTextFormat(ReplacementTracksSchema, 'dochi_replacement_tracks'),
          },
        })

        if (!response.output_parsed) {
          throw new MixtapeAnalysisError({
            code: 'INVALID_RESPONSE',
            message: '교체 추천곡 결과 형식을 확인할 수 없어요.',
            retryable: true,
          })
        }

        return response.output_parsed.tracks.slice(0, count)
      } catch (error) {
        if (error instanceof MixtapeAnalysisError) throw error

        throw new MixtapeAnalysisError({
          code: isTimeoutError(error) ? 'REQUEST_TIMEOUT' : 'ANALYSIS_FAILED',
          message: isTimeoutError(error)
            ? '교체 추천 시간이 너무 오래 걸렸어요. 다시 시도해주세요.'
            : '새 추천곡을 가져오지 못했어요. 잠시 후 다시 시도해주세요.',
          retryable: true,
        }, { cause: error })
      }
    },
  }
}
