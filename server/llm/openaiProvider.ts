import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod'
import {
  TapeDesignMetadataSchema,
  TasteProfileSchema,
} from '../../src/types/mixtape.js'
import { MixtapeAnalysisError } from '../../src/types/mixtapeAnalysis.js'
import type {
  CurationCandidate,
  LlmMixtapeSelection,
  LlmProvider,
  TasteDiscoveryProfile,
} from '../../src/services/llm/types.js'

const TasteDiscoveryProfileSchema = TasteProfileSchema.extend({
  searchKeywords: z.array(z.string().min(1)).min(1).max(10),
}).strict()

type OpenAiProviderOptions = {
  apiKey: string
  model: string
  guidePrompt: string
  tasteGuidePrompt?: string
  curationGuidePrompt?: string
}

function isTimeoutError(error: unknown) {
  return error instanceof Error && /timeout|timed out/i.test(error.message)
}

export function createOpenAiProvider({
  apiKey,
  model,
  guidePrompt,
  tasteGuidePrompt = '',
  curationGuidePrompt = '',
}: OpenAiProviderOptions): LlmProvider {
  const client = new OpenAI({
    apiKey,
    timeout: 45_000,
    maxRetries: 1,
  })

  return {
    id: 'openai',
    async analyzeTaste({ tracks }, options): Promise<TasteDiscoveryProfile> {
      try {
        const response = await client.responses.parse({
          model,
          store: false,
          input: [
            {
              role: 'system',
              content: [{
                type: 'input_text',
                text: `${guidePrompt}\n\n${tasteGuidePrompt}`.trim(),
              }],
            },
            {
              role: 'user',
              content: [{
                type: 'input_text',
                text: JSON.stringify({
                  confirmedTracks: tracks.map(({ title, artist, album }) => ({
                    title,
                    artist,
                    album,
                  })),
                }),
              }],
            },
          ],
          text: {
            format: zodTextFormat(
              TasteDiscoveryProfileSchema,
              'dochi_taste_discovery_profile',
            ),
          },
        }, { signal: options?.signal })

        if (!response.output_parsed) {
          throw new MixtapeAnalysisError({
            code: 'TASTE_ANALYSIS_FAILED',
            stage: 'taste',
            message: '취향 분석 결과 형식을 확인할 수 없어요.',
            retryable: true,
          })
        }

        return response.output_parsed
      } catch (error) {
        if (error instanceof MixtapeAnalysisError) throw error

        const timedOut = options?.signal?.aborted === true || isTimeoutError(error)
        throw new MixtapeAnalysisError({
          code: timedOut ? 'REQUEST_TIMEOUT' : 'TASTE_ANALYSIS_FAILED',
          stage: 'taste',
          message: timedOut
            ? '취향 분석 시간이 너무 오래 걸렸어요. 다시 시도해주세요.'
            : '취향 분석 서비스에 연결하지 못했어요. 잠시 후 다시 시도해주세요.',
          retryable: true,
        }, { cause: error })
      }
    },
    async curateMixtape({
      tasteProfile,
      candidates,
    }, options): Promise<LlmMixtapeSelection> {
      const candidateIds = [...new Set(
        candidates.map(({ candidateId }) => candidateId),
      )]

      if (candidateIds.length < 5) {
        throw new MixtapeAnalysisError({
          code: 'CURATION_INVALID_RESPONSE',
          stage: 'curation',
          message: '고를 수 있는 곡 후보가 충분하지 않아요.',
          retryable: true,
        })
      }

      const CandidateIdSchema = z.enum(
        candidateIds as [string, ...string[]],
      )
      const CurationSchema = z.object({
        title: z.string().min(1),
        subtitle: z.string().min(1),
        dochiComment: z.string().min(1),
        design: TapeDesignMetadataSchema,
        tracks: z.array(z.object({
          candidateId: CandidateIdSchema,
          reason: z.string().min(1),
        }).strict()).length(5),
      }).strict()

      try {
        const response = await client.responses.parse({
          model,
          store: false,
          input: [
            {
              role: 'system',
              content: [{
                type: 'input_text',
                text: `${guidePrompt}\n\n${curationGuidePrompt}`.trim(),
              }],
            },
            {
              role: 'user',
              content: [{
                type: 'input_text',
                text: JSON.stringify({
                  tasteProfile,
                  candidates: candidates.map(({
                    candidateId,
                    title,
                    artist,
                  }: CurationCandidate) => ({
                    candidateId,
                    title,
                    artist,
                  })),
                }),
              }],
            },
          ],
          text: {
            format: zodTextFormat(
              CurationSchema,
              'dochi_mixtape_selection',
            ),
          },
        }, { signal: options?.signal })

        if (!response.output_parsed) {
          throw new MixtapeAnalysisError({
            code: 'CURATION_INVALID_RESPONSE',
            stage: 'curation',
            message: '믹스테이프 선곡 결과를 확인할 수 없어요.',
            retryable: true,
          })
        }

        return response.output_parsed
      } catch (error) {
        if (error instanceof MixtapeAnalysisError) throw error

        const timedOut = options?.signal?.aborted === true || isTimeoutError(error)
        throw new MixtapeAnalysisError({
          code: timedOut ? 'REQUEST_TIMEOUT' : 'CURATION_FAILED',
          stage: 'curation',
          message: timedOut
            ? '믹스테이프 선곡 시간이 너무 오래 걸렸어요. 다시 시도해주세요.'
            : '믹스테이프 선곡 서비스에 연결하지 못했어요. 다시 시도해주세요.',
          retryable: true,
        }, { cause: error })
      }
    },
  }
}
