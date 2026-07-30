import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BGM_CONFIG, BGM_STORAGE_KEYS } from '../audio/bgmConfig'

const engineSpies = vi.hoisted(() => ({
  unlockAndStart: vi.fn().mockResolvedValue(true),
  setEnabled: vi.fn(),
  setVolume: vi.fn(),
  duck: vi.fn(),
  releaseDuck: vi.fn(),
  setHidden: vi.fn(),
  dispose: vi.fn(),
}))

vi.mock('../audio/bgmEngine', () => ({
  BgmEngine: class {
    unlockAndStart = engineSpies.unlockAndStart
    setEnabled = engineSpies.setEnabled
    setVolume = engineSpies.setVolume
    duck = engineSpies.duck
    releaseDuck = engineSpies.releaseDuck
    setHidden = engineSpies.setHidden
    dispose = engineSpies.dispose
  },
}))

import { useBackgroundMusic } from './useBackgroundMusic'

describe('useBackgroundMusic', () => {
  beforeEach(() => {
    localStorage.clear()
    Object.values(engineSpies).forEach((spy) => spy.mockClear())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('restores and persists BGM settings independently from dialogue SFX', () => {
    localStorage.setItem(BGM_STORAGE_KEYS.enabled, 'false')
    localStorage.setItem(BGM_STORAGE_KEYS.volume, '0.58')

    const { result } = renderHook(() =>
      useBackgroundMusic({ audioUrl: '/dochi-loop.wav' }),
    )

    expect(result.current.enabled).toBe(false)
    expect(result.current.volume).toBeCloseTo(0.58)

    act(() => result.current.toggle())
    expect(result.current.enabled).toBe(true)
    expect(localStorage.getItem(BGM_STORAGE_KEYS.enabled)).toBe('true')

    act(() => result.current.setVolume(0.44))
    expect(result.current.volume).toBeCloseTo(0.44)
    expect(localStorage.getItem(BGM_STORAGE_KEYS.volume)).toBe('0.44')
    expect(localStorage.getItem('dj-dochi:sfx-enabled')).toBeNull()
  })

  it('starts only from an explicit user action and releases dialogue ducking', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() =>
      useBackgroundMusic({ audioUrl: '/dochi-loop.wav' }),
    )

    expect(engineSpies.unlockAndStart).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.unlockAndStart()
    })
    expect(engineSpies.unlockAndStart).toHaveBeenCalledWith('/dochi-loop.wav')

    act(() => result.current.pulseDuck())
    expect(engineSpies.duck).toHaveBeenCalledOnce()

    act(() => vi.advanceTimersByTime(BGM_CONFIG.duckHoldMs - 1))
    expect(engineSpies.releaseDuck).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(1))
    expect(engineSpies.releaseDuck).toHaveBeenCalledOnce()
  })

  it('attenuates on hidden tabs and disposes the audio graph on unmount', () => {
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('visible')
    const { unmount } = renderHook(() =>
      useBackgroundMusic({ audioUrl: '/dochi-loop.wav' }),
    )

    visibility.mockReturnValue('hidden')
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(engineSpies.setHidden).toHaveBeenLastCalledWith(true)

    unmount()
    expect(engineSpies.dispose).toHaveBeenCalledOnce()
  })
})
