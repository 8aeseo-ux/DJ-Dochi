import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BGM_CONFIG,
  BGM_STORAGE_KEYS,
} from '../audio/bgmConfig'
import { BgmEngine } from '../audio/bgmEngine'

type UseBackgroundMusicOptions = {
  audioUrl: string
}

function getInitialEnabled(): boolean {
  if (typeof window === 'undefined') return BGM_CONFIG.defaultEnabled

  try {
    return window.localStorage.getItem(BGM_STORAGE_KEYS.enabled) !== 'false'
  } catch {
    return BGM_CONFIG.defaultEnabled
  }
}

function getInitialVolume(): number {
  if (typeof window === 'undefined') return BGM_CONFIG.defaultVolume

  try {
    const stored = window.localStorage.getItem(BGM_STORAGE_KEYS.volume)
    if (stored === null) return BGM_CONFIG.defaultVolume
    const parsed = Number(stored)
    if (!Number.isFinite(parsed)) return BGM_CONFIG.defaultVolume
    return Math.min(1, Math.max(0, parsed))
  } catch {
    return BGM_CONFIG.defaultVolume
  }
}

export function useBackgroundMusic({
  audioUrl,
}: UseBackgroundMusicOptions) {
  const [enabled, setEnabled] = useState(getInitialEnabled)
  const [volume, setVolumeState] = useState(getInitialVolume)
  const engineRef = useRef<BgmEngine | null>(null)
  const duckTimerRef = useRef<number | null>(null)

  if (!engineRef.current) engineRef.current = new BgmEngine()

  useEffect(() => {
    engineRef.current?.setEnabled(enabled)
    try {
      window.localStorage.setItem(BGM_STORAGE_KEYS.enabled, String(enabled))
    } catch {
      // Storage can be blocked in private browsing; keep the in-memory setting.
    }
  }, [enabled])

  useEffect(() => {
    engineRef.current?.setVolume(volume)
    try {
      window.localStorage.setItem(BGM_STORAGE_KEYS.volume, String(volume))
    } catch {
      // Storage can be blocked in private browsing; keep the in-memory setting.
    }
  }, [volume])

  useEffect(() => {
    const handleVisibility = () => {
      engineRef.current?.setHidden(document.visibilityState === 'hidden')
    }

    handleVisibility()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  useEffect(() => () => {
    if (duckTimerRef.current !== null) {
      window.clearTimeout(duckTimerRef.current)
      duckTimerRef.current = null
    }
    engineRef.current?.dispose()
  }, [])

  const unlockAndStart = useCallback(async () => {
    if (!enabled) return false
    return engineRef.current?.unlockAndStart(audioUrl) ?? false
  }, [audioUrl, enabled])

  const toggle = useCallback(() => {
    setEnabled((current) => {
      const next = !current
      if (next) void engineRef.current?.unlockAndStart(audioUrl)
      return next
    })
  }, [audioUrl])

  const setVolume = useCallback((nextVolume: number) => {
    setVolumeState(Math.min(1, Math.max(0, nextVolume)))
  }, [])

  const releaseDuck = useCallback(() => {
    if (duckTimerRef.current !== null) {
      window.clearTimeout(duckTimerRef.current)
      duckTimerRef.current = null
    }
    engineRef.current?.releaseDuck()
  }, [])

  const pulseDuck = useCallback(() => {
    if (!enabled) return

    engineRef.current?.duck()
    if (duckTimerRef.current !== null) {
      window.clearTimeout(duckTimerRef.current)
    }
    duckTimerRef.current = window.setTimeout(() => {
      duckTimerRef.current = null
      engineRef.current?.releaseDuck()
    }, BGM_CONFIG.duckHoldMs)
  }, [enabled])

  return {
    enabled,
    volume,
    unlockAndStart,
    toggle,
    setVolume,
    pulseDuck,
    releaseDuck,
  }
}
