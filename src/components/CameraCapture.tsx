import { useEffect, useRef, useState } from 'react'
import { useCamera } from '../hooks/useCamera'
import Panel from './Panel'
import RetroButton from './RetroButton'

type CameraCaptureProps = {
  onCapture: (photoUrl: string) => void
  onCancel: () => void
  onSkip: () => void
}

export default function CameraCapture({ onCapture, onCancel, onSkip }: CameraCaptureProps) {
  const { videoRef, status, error, startCamera, captureFrame, stopCamera } = useCamera()
  const [hasStarted, setHasStarted] = useState(false)
  const [startFailed, setStartFailed] = useState(false)
  const [isFlashing, setIsFlashing] = useState(false)
  const flashTimerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (flashTimerRef.current !== null) window.clearTimeout(flashTimerRef.current)
    stopCamera()
  }, [stopCamera])

  const handleStart = async () => {
    setHasStarted(true)
    const started = await startCamera()
    setStartFailed(!started)
  }

  const handleCapture = () => {
    const photoUrl = captureFrame()
    if (!photoUrl) {
      stopCamera()
      setStartFailed(true)
      return
    }

    setIsFlashing(true)
    flashTimerRef.current = window.setTimeout(() => setIsFlashing(false), 180)
    stopCamera()
    onCapture(photoUrl)
  }

  const handleCancel = () => {
    stopCamera()
    onCancel()
  }

  const handleSkip = () => {
    stopCamera()
    onSkip()
  }

  const hasError = startFailed || status === 'error'
  const isReady = hasStarted && status === 'ready' && !hasError

  return (
    <div className="camera-capture" data-testid="camera-capture" role="dialog" aria-modal="true" aria-label="기념사진 촬영">
      {isFlashing && <div className="camera-capture__flash" data-testid="camera-flash" aria-hidden="true" />}
      <Panel className="camera-capture__panel" tone="raised">
        <div className="camera-capture__topline">
          <span>ROOM 01 / MEMORY CAM</span>
          <button className="icon-button" type="button" aria-label="카메라 촬영 취소" onClick={handleCancel}>×</button>
        </div>

        {!hasStarted && (
          <div className="camera-capture__intro">
            <span className="screen-eyebrow">ONE LAST THING</span>
            <h2>도치와 사진을 남겨보세요.</h2>
            <p>카메라는 이 화면에서만 사용하고, 사진은 서버로 보내지 않아요.</p>
            <RetroButton onClick={handleStart}>카메라 켜기</RetroButton>
          </div>
        )}

        {hasStarted && !hasError && (
          <div className="camera-capture__live">
            {isReady ? (
              <video ref={videoRef} className="camera-capture__video" autoPlay playsInline muted aria-label="카메라 실시간 미리보기" />
            ) : (
              <div className="camera-capture__waiting" role="status">카메라를 연결하는 중...</div>
            )}
            <div className="camera-capture__controls">
              <RetroButton onClick={handleCapture} disabled={!isReady}>찰칵!</RetroButton>
              <RetroButton variant="ghost" onClick={handleCancel}>취소</RetroButton>
            </div>
          </div>
        )}

        {hasStarted && hasError && (
          <div className="camera-capture__fallback">
            <span className="screen-eyebrow">CAMERA OFFLINE</span>
            <h2>사진 없이도 괜찮아.</h2>
            <p>{error || '카메라를 사용할 수 없어요. 사진 없이 계속할 수 있어요.'}</p>
            <RetroButton onClick={handleSkip}>사진 없이 계속하기</RetroButton>
            <RetroButton variant="ghost" onClick={handleCancel}>취소</RetroButton>
          </div>
        )}
      </Panel>
    </div>
  )
}
