export const MIXTAPE_PIPELINE = {
  initialRecommendationCount: 5,
  maximumInitialRecommendations: 6,
  minimumVerifiedTracks: 3,
  maximumReplacementRounds: 1,
  serverBudgetMs: 35_000,
  stopBufferMs: 1_000,
  itunesConcurrency: 3,
  maximumMusicBrainzChecks: 3,
} as const
