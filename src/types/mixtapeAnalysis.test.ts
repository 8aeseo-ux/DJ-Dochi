import { describe, expect, it } from 'vitest'
import { MixtapeAnalysisError } from './mixtapeAnalysis'

describe('MixtapeAnalysisError', () => {
  it('preserves the pipeline stage for callers and UI copy', () => {
    const error = new MixtapeAnalysisError({
      code: 'CATALOG_CANDIDATES_INSUFFICIENT',
      stage: 'catalog',
      message: '확인되는 곡을 충분히 찾지 못했어요.',
      retryable: true,
    })

    expect(error).toMatchObject({
      code: 'CATALOG_CANDIDATES_INSUFFICIENT',
      stage: 'catalog',
      retryable: true,
    })
  })
})
