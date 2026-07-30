import { useCallback, useEffect, useRef, useState } from 'react'
import { DochiVoiceCadence } from '../audio/dochiVoiceCadence'
import { DochiVoiceEngine } from '../audio/dochiVoiceEngine'
import {
  getDochiVoiceEmotion,
  getDochiVoicePlayback,
} from '../audio/dochiVoiceProfiles'
import type { DochiFlowState } from '../types'

const SFX_STORAGE_KEY = 'dj-dochi:sfx-enabled'

function getInitialEnabledState(): boolean {
  if (typeof window === 'undefined') return true

  try {
    return window.localStorage.getItem(SFX_STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
}

type UseDochiVoiceOptions = {
  state: DochiFlowState
  dialogueKey: string
}

type VoiceCharacterMetadata = {
  isTerminal: boolean
}

export function useDochiVoice({ state, dialogueKey }: UseDochiVoiceOptions) {
  const [enabled, setEnabled] = useState(getInitialEnabledState)
  const engineRef = useRef<DochiVoiceEngine | null>(null)
  const cadenceRef = useRef<DochiVoiceCadence | null>(null)

  if (!engineRef.current) engineRef.current = new DochiVoiceEngine()
  if (!cadenceRef.current) cadenceRef.current = new DochiVoiceCadence()

  useEffect(() => {
    cadenceRef.current?.reset(dialogueKey)
    engineRef.current?.stop()
  }, [dialogueKey])

  useEffect(() => {
    try {
      window.localStorage.setItem(SFX_STORAGE_KEY, String(enabled))
    } catch {
      // A private browsing policy may block storage; sound still works for this session.
    }

    if (!enabled) engineRef.current?.stop()
  }, [enabled])

  useEffect(() => () => engineRef.current?.dispose(), [])

  const unlock = useCallback(() => {
    if (enabled) void engineRef.current?.unlock()
  }, [enabled])

  const toggle = useCallback(() => {
    if (enabled) {
      engineRef.current?.stop()
      setEnabled(false)
      return
    }

    void engineRef.current?.unlock()
    setEnabled(true)
  }, [enabled])

  const stop = useCallback(() => {
    engineRef.current?.stop()
  }, [])

  const onCharacterReveal = useCallback((
    character: string,
    characterIndex: number,
    metadata: VoiceCharacterMetadata = { isTerminal: false },
  ) => {
    if (!enabled) return
    if (!cadenceRef.current?.shouldPlay(
      dialogueKey,
      character,
      characterIndex,
      metadata,
    )) return

    const emotion = getDochiVoiceEmotion(state)
    const playback = getDochiVoicePlayback(
      emotion,
      dialogueKey,
      characterIndex,
      metadata.isTerminal,
    )
    engineRef.current?.play(playback)
  }, [dialogueKey, enabled, state])

  return {
    enabled,
    unlock,
    toggle,
    stop,
    onCharacterReveal,
  }
}
