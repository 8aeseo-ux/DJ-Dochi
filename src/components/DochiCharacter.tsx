import { useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { DochiPose } from '../types'
import { getDochiAsset, getDochiIdleAsset } from '../lib/dochiAssets'

type DochiCharacterProps = {
  pose: DochiPose
  size?: 'hero' | 'compact'
  motion?: 'groove' | 'still' | 'walk-out' | 'walk-in' | 'away'
  visible?: boolean
  interactive?: boolean
  className?: string
  onClick?: () => void
}

const POSE_LABELS: Record<DochiPose, string> = {
  idle: 'idle',
  surprised: 'surprised',
  thinking: 'thinking',
  result: 'result',
}

const IDLE_FRAME_INTERVAL_MS = 550

export default function DochiCharacter({
  pose,
  size = 'hero',
  motion = 'still',
  visible = true,
  interactive = false,
  className = '',
  onClick,
}: DochiCharacterProps) {
  const [idleFrame, setIdleFrame] = useState(0)
  const [imageFailed, setImageFailed] = useState(false)
  const label = `DJ 도치 ${POSE_LABELS[pose]}`

  useEffect(() => {
    if (pose !== 'idle') {
      setIdleFrame(0)
      return
    }

    const timer = window.setInterval(() => {
      setIdleFrame((currentFrame) => (currentFrame + 1) % 2)
    }, IDLE_FRAME_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [pose])

  const assetUrl = pose === 'idle'
    ? getDochiIdleAsset(idleFrame) ?? getDochiAsset(pose)
    : getDochiAsset(pose)

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive || !onClick || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    onClick()
  }

  useEffect(() => {
    setImageFailed(false)
  }, [assetUrl, pose])

  return (
    <div
      className={`dochi-character dochi-character--${size} dochi-character--${pose} dochi-character--${motion} ${motion === 'groove' ? 'dochi-character--staccato' : ''} ${!visible ? 'dochi-character--hidden' : ''} ${className}`.trim()}
      role={interactive ? 'button' : undefined}
      aria-label={interactive ? label : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
    >
      {assetUrl && !imageFailed ? (
        <img
          key={pose === 'idle' ? undefined : assetUrl}
          className="dochi-character__asset"
          src={assetUrl}
          alt={label}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="dochi-character__missing" role="img" aria-label={label} />
      )}
    </div>
  )
}
