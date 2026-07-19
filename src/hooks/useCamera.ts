import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

export type CameraStatus = 'idle' | 'requesting' | 'ready' | 'error'

export type UseCameraResult = {
  videoRef: RefObject<HTMLVideoElement | null>
  status: CameraStatus
  error: string | null
  startCamera: () => Promise<boolean>
  captureFrame: () => string | null
  stopCamera: () => void
}

const CAMERA_ERROR_MESSAGE = '카메라를 사용할 수 없어요. 사진 없이 계속할 수 있어요.'

function releaseStream(stream: MediaStream | null, video: HTMLVideoElement | null) {
  stream?.getTracks().forEach((track) => track.stop())
  if (video) video.srcObject = null
}

export function useCamera(): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const stopCamera = useCallback(() => {
    releaseStream(streamRef.current, videoRef.current)
    streamRef.current = null
    setStatus('idle')
    setError(null)
  }, [])

  const startCamera = useCallback(async () => {
    if (streamRef.current) return true

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error')
      setError(CAMERA_ERROR_MESSAGE)
      return false
    }

    setStatus('requesting')
    setError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'user' } },
        audio: false,
      })

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => undefined)
      }
      setStatus('ready')
      return true
    } catch {
      releaseStream(streamRef.current, videoRef.current)
      streamRef.current = null
      setStatus('error')
      setError(CAMERA_ERROR_MESSAGE)
      return false
    }
  }, [])

  const captureFrame = useCallback(() => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) return null

    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  }, [])

  useEffect(() => () => {
    releaseStream(streamRef.current, videoRef.current)
    streamRef.current = null
  }, [])

  return { videoRef, status, error, startCamera, captureFrame, stopCamera }
}
