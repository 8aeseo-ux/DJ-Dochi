import { MixtapeAnalysisError } from '../../src/types/mixtapeAnalysis'
import type {
  CatalogSeededLlmProvider,
  LlmProvider,
} from '../../src/services/llm/types'
import { createOpenAiProvider } from './openaiProvider'

export type LlmProviderEnvironment = {
  provider?: string
  apiKey?: string
  model?: string
  guidePrompt?: string
  tasteGuidePrompt?: string
  curationGuidePrompt?: string
}

export function createLlmProvider(
  environment: LlmProviderEnvironment,
): LlmProvider & CatalogSeededLlmProvider {
  const provider = environment.provider?.trim().toLowerCase() || 'openai'

  if (provider !== 'openai') {
    throw new MixtapeAnalysisError({
      code: 'PROVIDER_UNAVAILABLE',
      message: '현재 사용할 수 있는 취향 분석 provider가 아니에요.',
      retryable: false,
    })
  }

  if (!environment.apiKey?.trim()) {
    throw new MixtapeAnalysisError({
      code: 'MISSING_API_KEY',
      message: '취향 분석 API 키가 아직 설정되지 않았어요.',
      retryable: false,
    })
  }

  if (!environment.model?.trim()) {
    throw new MixtapeAnalysisError({
      code: 'MISSING_MODEL',
      message: '취향 분석 모델명이 아직 설정되지 않았어요.',
      retryable: false,
    })
  }

  return createOpenAiProvider({
    apiKey: environment.apiKey,
    model: environment.model,
    guidePrompt: environment.guidePrompt ?? '',
    tasteGuidePrompt: environment.tasteGuidePrompt ?? '',
    curationGuidePrompt: environment.curationGuidePrompt ?? '',
  })
}
