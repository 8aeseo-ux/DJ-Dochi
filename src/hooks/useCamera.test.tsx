import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCamera, type UseCameraResult } from './useCamera'

let cameraApi: UseCameraResult

function CameraHarness() {
  cameraApi = useCamera()
  return <video ref={cameraApi.videoRef} />
}

describe('useCamera', () => {
  const track = { stop: vi.fn() }
  const stream = { getTracks: () => [track] } as unknown as MediaStream

  beforeEach(() => {
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(stream),
      },
    })
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,captured')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('requests the user-facing camera only after start and captures a frame', async () => {
    const getUserMedia = navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>
    const view = render(<CameraHarness />)

    expect(getUserMedia).not.toHaveBeenCalled()

    await act(async () => {
      await cameraApi.startCamera()
    })

    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: { ideal: 'user' } },
      audio: false,
    })
    expect(cameraApi.status).toBe('ready')
    expect(cameraApi.videoRef.current?.srcObject).toBe(stream)

    Object.defineProperty(cameraApi.videoRef.current, 'videoWidth', { configurable: true, value: 640 })
    Object.defineProperty(cameraApi.videoRef.current, 'videoHeight', { configurable: true, value: 480 })

    expect(cameraApi.captureFrame()).toBe('data:image/png;base64,captured')

    view.unmount()
    expect(track.stop).toHaveBeenCalledTimes(1)
  })

  it('converts camera permission errors into a recoverable error state', async () => {
    const getUserMedia = navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>
    getUserMedia.mockRejectedValueOnce(new Error('Permission denied'))
    render(<CameraHarness />)

    await act(async () => {
      await expect(cameraApi.startCamera()).resolves.toBe(false)
    })

    expect(cameraApi.status).toBe('error')
    expect(cameraApi.error).toContain('카메라')
  })
})
