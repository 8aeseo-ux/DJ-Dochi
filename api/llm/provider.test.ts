// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { createLlmProvider } from './provider'
import { MixtapeAnalysisError } from '../../src/types/mixtapeAnalysis'

describe('createLlmProvider', () => {
  it('uses OpenAI as the default provider when server configuration exists', () => {
    const provider = createLlmProvider({
      apiKey: 'test-key',
      model: 'test-model',
      guidePrompt: 'Dochi guide',
      tasteGuidePrompt: 'Taste guide',
      curationGuidePrompt: 'Curation guide',
    })

    expect(provider.id).toBe('openai')
    expect(provider.analyzeTaste).toEqual(expect.any(Function))
    expect(provider.curateMixtape).toEqual(expect.any(Function))
  })

  it('rejects an unknown provider', () => {
    expect(() => createLlmProvider({
      provider: 'unknown',
      apiKey: 'test-key',
      model: 'test-model',
      guidePrompt: 'Dochi guide',
    })).toThrowError(MixtapeAnalysisError)

    try {
      createLlmProvider({ provider: 'unknown', apiKey: 'test-key', model: 'test-model', guidePrompt: 'guide' })
    } catch (error) {
      expect(error).toMatchObject({ code: 'PROVIDER_UNAVAILABLE', retryable: false })
    }
  })

  it('requires the server-only OpenAI API key', () => {
    expect(() => createLlmProvider({ model: 'test-model', guidePrompt: 'guide' })).toThrowError(
      expect.objectContaining({ code: 'MISSING_API_KEY', retryable: false }),
    )
  })

  it('requires an explicit model name', () => {
    expect(() => createLlmProvider({ apiKey: 'test-key', guidePrompt: 'guide' })).toThrowError(
      expect.objectContaining({ code: 'MISSING_MODEL', retryable: false }),
    )
  })
})
