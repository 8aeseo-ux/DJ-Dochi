import type { DochiFlowState } from '../types'
import { DOCHI_VOICE_CONFIG } from './dochiVoiceConfig'

export type DochiVoiceEmotion = 'neutral' | 'surprised' | 'thinking' | 'proud' | 'error'

export type DochiVoicePlayback = {
  playbackRate: number
  detuneCents: number
  durationSeconds: number
  formantScale: number
}

type DochiVoiceEmotionPlayback = Pick<
  DochiVoicePlayback,
  'playbackRate' | 'detuneCents'
>

const EMOTION_PLAYBACK: Record<DochiVoiceEmotion, DochiVoiceEmotionPlayback> = {
  neutral: { playbackRate: 1, detuneCents: 0 },
  surprised: { playbackRate: 1.035, detuneCents: 42 },
  thinking: { playbackRate: 0.97, detuneCents: -32 },
  proud: { playbackRate: 1.025, detuneCents: 26 },
  error: { playbackRate: 0.96, detuneCents: -42 },
}

function hashUnit(value: string): number {
  let hash = 0

  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index)
    hash |= 0
  }

  return ((hash >>> 0) % 10_001) / 10_000
}

export function getDochiVoicePlayback(
  emotion: DochiVoiceEmotion,
  dialogueKey: string,
  characterIndex: number,
  isTerminal = false,
): DochiVoicePlayback {
  const profile = EMOTION_PLAYBACK[emotion]
  const rateUnit = hashUnit(`${dialogueKey}:${characterIndex}:rate`) * 2 - 1
  const detuneUnit = hashUnit(`${dialogueKey}:${characterIndex}:pitch`) * 2 - 1
  const durationUnit = hashUnit(`${dialogueKey}:${characterIndex}:duration`) * 2 - 1
  const formantUnit = hashUnit(`${dialogueKey}:${characterIndex}:formant`) * 2 - 1
  const baseDuration = isTerminal
    ? DOCHI_VOICE_CONFIG.synthesis.terminalDurationSeconds
    : DOCHI_VOICE_CONFIG.synthesis.baseDurationSeconds

  return {
    playbackRate: profile.playbackRate + rateUnit * DOCHI_VOICE_CONFIG.variation.playbackRate,
    detuneCents: profile.detuneCents + detuneUnit * DOCHI_VOICE_CONFIG.variation.detuneCents,
    durationSeconds: baseDuration * (
      1 + durationUnit * DOCHI_VOICE_CONFIG.variation.durationRatio
    ),
    formantScale: 1 + formantUnit * DOCHI_VOICE_CONFIG.variation.formantRatio,
  }
}

export function getDochiVoiceEmotion(state: DochiFlowState): DochiVoiceEmotion {
  if (state === 'noticed') return 'surprised'
  if (state === 'extracting' || state === 'extractionReview' || state === 'analyzingTaste') {
    return 'thinking'
  }
  if (state === 'receivingInput' || state === 'photoPrompt' || state === 'finalTape') {
    return 'proud'
  }
  if (state === 'extractionError' || state === 'tasteAnalysisError') return 'error'
  return 'neutral'
}
