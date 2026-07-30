export const DOCHI_VOICE_CONFIG = {
  cadence: {
    minCharacters: 2,
    maxCharacters: 3,
  },
  synthesis: {
    baseDurationSeconds: 0.11,
    terminalDurationSeconds: 0.14,
    maxBufferDurationSeconds: 0.16,
    baseFrequencyHz: 154,
    masterGain: 0.072,
    formants: [
      { frequencyHz: 430, q: 4.2, gain: 1 },
      { frequencyHz: 820, q: 5.2, gain: 0.72 },
      { frequencyHz: 2_180, q: 7.5, gain: 0.18 },
    ],
    lowpassFrequencyHz: 2_900,
    compressor: {
      threshold: -24,
      knee: 16,
      ratio: 4,
      attack: 0.003,
      release: 0.06,
    },
  },
  variation: {
    playbackRate: 0.014,
    detuneCents: 22,
    durationRatio: 0.07,
    formantRatio: 0.03,
  },
} as const
