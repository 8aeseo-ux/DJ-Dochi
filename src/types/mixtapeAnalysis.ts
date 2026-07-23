export type MixtapeAnalysisErrorCode =
  | 'INVALID_REQUEST'
  | 'PROVIDER_UNAVAILABLE'
  | 'REQUEST_TIMEOUT'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE'
  | 'MISSING_API_KEY'
  | 'MISSING_MODEL'
  | 'CATALOG_UNAVAILABLE'
  | 'CATALOG_VERIFICATION_FAILED'
  | 'CATALOG_CANDIDATES_INSUFFICIENT'
  | 'TASTE_ANALYSIS_FAILED'
  | 'CURATION_INVALID_RESPONSE'
  | 'CURATION_FAILED'
  | 'ANALYSIS_FAILED'

export type MixtapeAnalysisStage = 'taste' | 'catalog' | 'curation'

export type MixtapeAnalysisIssue = {
  code: MixtapeAnalysisErrorCode
  stage: MixtapeAnalysisStage
  message: string
  retryable: boolean
}

export class MixtapeAnalysisError extends Error implements MixtapeAnalysisIssue {
  readonly code: MixtapeAnalysisErrorCode
  readonly stage: MixtapeAnalysisStage
  readonly retryable: boolean
  readonly cause?: unknown

  constructor(issue: MixtapeAnalysisIssue, options?: { cause?: unknown }) {
    super(issue.message)
    this.name = 'MixtapeAnalysisError'
    this.code = issue.code
    this.stage = issue.stage
    this.retryable = issue.retryable
    this.cause = options?.cause
  }
}
