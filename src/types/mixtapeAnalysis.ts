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
  | 'ANALYSIS_FAILED'

export type MixtapeAnalysisIssue = {
  code: MixtapeAnalysisErrorCode
  message: string
  retryable: boolean
}

export class MixtapeAnalysisError extends Error implements MixtapeAnalysisIssue {
  readonly code: MixtapeAnalysisErrorCode
  readonly retryable: boolean
  readonly cause?: unknown

  constructor(issue: MixtapeAnalysisIssue, options?: { cause?: unknown }) {
    super(issue.message)
    this.name = 'MixtapeAnalysisError'
    this.code = issue.code
    this.retryable = issue.retryable
    this.cause = options?.cause
  }
}
