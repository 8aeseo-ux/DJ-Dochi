export const VINYL_PHYSICS = {
  FRAME_MS: 1_000 / 60,
  MIN_ENERGY_SPEED: 140,
  MAX_ENERGY_SPEED: 900,
  ENERGY_GAIN_RATE: 0.9,
  ENERGY_CURVE: 0.72,
  FRICTION: 0.986,
  COMPLETION_ENERGY: 1,
  MAX_ANGULAR_VELOCITY: 1_440,
  STOP_SPEED: 18,
  IDLE_DECAY_SPEED: 48,
  IDLE_ENERGY_DECAY_RATE: 0.012,
  MEDIUM_SPEED: 420,
  FAST_SPEED: 820,
  OVERDRIVE_SPEED: 1_250,
  DRAG_VELOCITY_SMOOTHING: 0.25,
  COMPLETION_COAST_MS: 700,
  METRICS_INTERVAL_MS: 80,
} as const

export type SpinFeedbackBand = 'idle' | 'slow' | 'medium' | 'fast' | 'overdrive'

export type SpinMetrics = {
  energy: number
  intensity: number
  feedback: SpinFeedbackBand
  overdrive: boolean
  isDragging: boolean
}

export type InertiaStep = {
  currentAngle: number
  angularVelocity: number
}

export type MixEnergyStep = {
  energy: number
  energyDelta: number
  intensity: number
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function stepInertia(currentAngle: number, angularVelocity: number, deltaMs: number): InertiaStep {
  const safeDeltaMs = Math.max(0, deltaMs)
  const deltaSeconds = safeDeltaMs / 1_000
  const friction = Math.pow(VINYL_PHYSICS.FRICTION, safeDeltaMs / VINYL_PHYSICS.FRAME_MS)
  const slowedVelocity = angularVelocity * friction
  const nextVelocity = Math.abs(slowedVelocity) < VINYL_PHYSICS.STOP_SPEED ? 0 : slowedVelocity

  return {
    currentAngle: currentAngle + angularVelocity * deltaSeconds,
    angularVelocity: nextVelocity,
  }
}

export function stepMixEnergy(currentEnergy: number, angularVelocity: number, deltaMs: number): MixEnergyStep {
  const speed = Math.abs(angularVelocity)
  const deltaSeconds = Math.max(0, deltaMs) / 1_000
  const intensity = clamp(speed / VINYL_PHYSICS.MAX_ENERGY_SPEED, 0, 1)
  let energyDelta = 0

  if (speed >= VINYL_PHYSICS.MIN_ENERGY_SPEED) {
    const speedRange = VINYL_PHYSICS.MAX_ENERGY_SPEED - VINYL_PHYSICS.MIN_ENERGY_SPEED
    const normalizedSpeed = clamp((speed - VINYL_PHYSICS.MIN_ENERGY_SPEED) / speedRange, 0, 1)
    energyDelta = Math.pow(normalizedSpeed, VINYL_PHYSICS.ENERGY_CURVE)
      * VINYL_PHYSICS.ENERGY_GAIN_RATE
      * deltaSeconds
  } else if (speed <= VINYL_PHYSICS.IDLE_DECAY_SPEED) {
    energyDelta = -VINYL_PHYSICS.IDLE_ENERGY_DECAY_RATE * deltaSeconds
  }

  const energy = clamp(currentEnergy + energyDelta, 0, VINYL_PHYSICS.COMPLETION_ENERGY)

  return {
    energy,
    energyDelta: energy - currentEnergy,
    intensity,
  }
}

export function calculateDragVelocity(deltaDegrees: number, deltaMs: number, previousVelocity: number) {
  const safeDeltaMs = Math.max(1, deltaMs)
  const instantaneousVelocity = deltaDegrees / (safeDeltaMs / 1_000)
  const smoothing = VINYL_PHYSICS.DRAG_VELOCITY_SMOOTHING
  const smoothedVelocity = previousVelocity * smoothing + instantaneousVelocity * (1 - smoothing)

  return clamp(
    smoothedVelocity,
    -VINYL_PHYSICS.MAX_ANGULAR_VELOCITY,
    VINYL_PHYSICS.MAX_ANGULAR_VELOCITY,
  )
}

export function classifySpinFeedback(angularVelocity: number): SpinFeedbackBand {
  const speed = Math.abs(angularVelocity)

  if (speed >= VINYL_PHYSICS.OVERDRIVE_SPEED) return 'overdrive'
  if (speed >= VINYL_PHYSICS.FAST_SPEED) return 'fast'
  if (speed >= VINYL_PHYSICS.MEDIUM_SPEED) return 'medium'
  if (speed >= VINYL_PHYSICS.STOP_SPEED) return 'slow'
  return 'idle'
}
