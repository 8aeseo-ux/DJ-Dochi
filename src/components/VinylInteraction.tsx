import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import {
  VINYL_PHYSICS,
  calculateDragVelocity,
  classifySpinFeedback,
  stepInertia,
  stepMixEnergy,
} from '../lib/vinylPhysics'
import type { SpinFeedbackBand, SpinMetrics } from '../lib/vinylPhysics'

export type VinylInteractionPhase = 'spin' | 'needle' | 'recording'

type VinylInteractionProps = {
  phase: VinylInteractionPhase
  onComplete: () => void
  onSpinEnergy: (energy: number) => void
  onSpinMetrics: (metrics: SpinMetrics) => void
}

type PointerSession = {
  pointerId: number
  angle: number
  timestamp: number
}

function getPointerAngle(event: PointerEvent<HTMLDivElement>, element: HTMLDivElement) {
  const rect = element.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  return Math.atan2(event.clientY - centerY, event.clientX - centerX)
}

function getShortestAngleDelta(currentAngle: number, previousAngle: number) {
  let delta = currentAngle - previousAngle
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  return delta * (180 / Math.PI)
}

function getEnergyLabel(energy: number) {
  if (energy >= 0.8) return '거의 다 됐어'
  if (energy >= 0.34) return '감 잡았어'
  return '힘이 더 필요해'
}

export default function VinylInteraction({
  phase,
  onComplete,
  onSpinEnergy,
  onSpinMetrics,
}: VinylInteractionProps) {
  const pointerSession = useRef<PointerSession | null>(null)
  const currentAngle = useRef(0)
  const angularVelocity = useRef(0)
  const mixEnergy = useRef(0)
  const isDraggingRef = useRef(false)
  const completionStartedAt = useRef<number | null>(null)
  const completionDelivered = useRef(false)
  const frameId = useRef<number | null>(null)
  const lastFrameAt = useRef<number | null>(null)
  const lastMetricsAt = useRef(-Infinity)
  const phaseRef = useRef(phase)
  const onCompleteRef = useRef(onComplete)
  const onSpinEnergyRef = useRef(onSpinEnergy)
  const onSpinMetricsRef = useRef(onSpinMetrics)
  const [rotationDegrees, setRotationDegrees] = useState(0)
  const [energy, setEnergy] = useState(0)
  const [intensity, setIntensity] = useState(0)
  const [feedback, setFeedback] = useState<SpinFeedbackBand>('idle')
  const [isDragging, setIsDragging] = useState(false)
  const [isCompletionPending, setIsCompletionPending] = useState(false)

  phaseRef.current = phase
  onCompleteRef.current = onComplete
  onSpinEnergyRef.current = onSpinEnergy
  onSpinMetricsRef.current = onSpinMetrics

  const publishMetrics = (timestamp: number, force = false) => {
    if (!force && timestamp - lastMetricsAt.current < VINYL_PHYSICS.METRICS_INTERVAL_MS) return

    lastMetricsAt.current = timestamp
    const nextIntensity = Math.min(1, Math.abs(angularVelocity.current) / VINYL_PHYSICS.MAX_ENERGY_SPEED)
    const nextFeedback = classifySpinFeedback(angularVelocity.current)
    const nextEnergy = mixEnergy.current
    const metrics: SpinMetrics = {
      energy: nextEnergy,
      intensity: nextIntensity,
      feedback: nextFeedback,
      overdrive: nextFeedback === 'overdrive',
      isDragging: isDraggingRef.current,
    }

    setEnergy(nextEnergy)
    setIntensity(nextIntensity)
    setFeedback(nextFeedback)
    onSpinEnergyRef.current(nextEnergy)
    onSpinMetricsRef.current(metrics)
  }

  useEffect(() => {
    const animate = (timestamp: number) => {
      const previousTimestamp = lastFrameAt.current ?? timestamp
      const deltaMs = Math.min(64, Math.max(0, timestamp - previousTimestamp))
      lastFrameAt.current = timestamp

      if (!isDraggingRef.current) {
        const inertia = stepInertia(currentAngle.current, angularVelocity.current, deltaMs)
        currentAngle.current = inertia.currentAngle
        angularVelocity.current = inertia.angularVelocity
      }

      if (phaseRef.current === 'spin' && completionStartedAt.current === null) {
        const energyStep = stepMixEnergy(mixEnergy.current, angularVelocity.current, deltaMs)
        mixEnergy.current = energyStep.energy

        if (
          !isDraggingRef.current
          && mixEnergy.current >= VINYL_PHYSICS.COMPLETION_ENERGY
        ) {
          completionStartedAt.current = timestamp
          setIsCompletionPending(true)
        }
      }

      if (
        completionStartedAt.current !== null
        && !completionDelivered.current
        && timestamp - completionStartedAt.current >= VINYL_PHYSICS.COMPLETION_COAST_MS
      ) {
        completionDelivered.current = true
        onCompleteRef.current()
      }

      setRotationDegrees(currentAngle.current)
      publishMetrics(timestamp, completionStartedAt.current === timestamp)
      frameId.current = window.requestAnimationFrame(animate)
    }

    frameId.current = window.requestAnimationFrame(animate)

    return () => {
      if (frameId.current !== null) window.cancelAnimationFrame(frameId.current)
    }
  }, [])

  useEffect(() => {
    if (phase === 'spin') return

    pointerSession.current = null
    isDraggingRef.current = false
    setIsDragging(false)
  }, [phase])

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (phase !== 'spin' || completionStartedAt.current !== null) return

    const element = event.currentTarget
    pointerSession.current = {
      pointerId: event.pointerId,
      angle: getPointerAngle(event, element),
      timestamp: event.timeStamp,
    }
    isDraggingRef.current = true
    element.setPointerCapture?.(event.pointerId)
    setIsDragging(true)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const session = pointerSession.current
    if (phase !== 'spin' || !session || session.pointerId !== event.pointerId) return

    const nextAngle = getPointerAngle(event, event.currentTarget)
    const deltaDegrees = getShortestAngleDelta(nextAngle, session.angle)
    const elapsedMs = Math.max(1, event.timeStamp - session.timestamp)

    session.angle = nextAngle
    session.timestamp = event.timeStamp
    currentAngle.current += deltaDegrees
    angularVelocity.current = calculateDragVelocity(deltaDegrees, elapsedMs, angularVelocity.current)
    setRotationDegrees(currentAngle.current)
    publishMetrics(event.timeStamp, true)
  }

  const finishPointerSession = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointerSession.current || pointerSession.current.pointerId !== event.pointerId) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    pointerSession.current = null
    isDraggingRef.current = false
    setIsDragging(false)
    publishMetrics(event.timeStamp, true)
  }

  const interactionStyle = {
    '--vinyl-energy': energy,
    '--vinyl-intensity': intensity,
  } as CSSProperties
  const recordStyle = { rotate: `${rotationDegrees}deg` } as CSSProperties
  const progressValue = Math.round(energy * 100)
  const needleIsDown = phase === 'needle' || phase === 'recording'

  return (
    <div
      className={`vinyl-interaction vinyl-interaction--${phase} vinyl-interaction--${feedback} ${isCompletionPending ? 'vinyl-interaction--complete' : ''}`.trim()}
      data-feedback={feedback}
      style={interactionStyle}
    >
      <div className="vinyl-interaction__speed-lines" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => <i key={index} />)}
      </div>
      <div
        className={`vinyl-interaction__record ${isDragging ? 'vinyl-interaction__record--dragging' : ''}`.trim()}
        data-testid="vinyl-record"
        role="slider"
        aria-label="LP를 돌려 믹스를 시작하세요"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressValue}
        aria-valuetext={getEnergyLabel(energy)}
        aria-disabled={phase !== 'spin' || isCompletionPending}
        tabIndex={0}
        style={recordStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerSession}
        onPointerCancel={finishPointerSession}
      >
        <span className="vinyl-interaction__label">DOCHI FM</span>
        <span className="vinyl-interaction__groove" aria-hidden="true" />
      </div>

      <div
        className={`vinyl-needle ${needleIsDown ? 'vinyl-needle--down' : ''}`.trim()}
        data-testid="vinyl-needle"
        aria-hidden="true"
      >
        <span className="vinyl-needle__arm" />
        <span className="vinyl-needle__head" />
      </div>

      {phase === 'spin' && (
        <div className="vinyl-energy" role="status" aria-label="믹스 에너지">
          <span className="vinyl-energy__track"><i /></span>
          <strong>{isCompletionPending ? '충분해!' : getEnergyLabel(energy)}</strong>
        </div>
      )}
      {phase === 'spin' && !isCompletionPending && (
        <span className="vinyl-interaction__hint">힘껏 밀고 놓아봐</span>
      )}
      {phase === 'recording' && (
        <span className="vinyl-interaction__recording-label" role="status">REC · Recording...</span>
      )}
    </div>
  )
}
