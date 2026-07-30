export const BGM_CONFIG = {
  bpm: 78,
  defaultEnabled: true,
  defaultVolume: 0.35,
  duckGain: 10 ** (-6 / 20),
  hiddenGain: 0.15,
  volumeRampSeconds: 0.08,
  duckAttackSeconds: 0.09,
  duckReleaseSeconds: 0.42,
  duckHoldMs: 220,
  visibilityRampSeconds: 0.2,
} as const

export const BGM_STORAGE_KEYS = {
  enabled: 'dj-dochi:bgm-enabled',
  volume: 'dj-dochi:bgm-volume',
} as const
