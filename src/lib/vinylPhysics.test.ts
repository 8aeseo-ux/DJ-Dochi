import { describe, expect, it } from 'vitest'
import {
  VINYL_PHYSICS,
  calculateDragVelocity,
  classifySpinFeedback,
  stepInertia,
  stepMixEnergy,
} from './vinylPhysics'

const simulateThrow = (initialVelocity: number) => {
  let angularVelocity = initialVelocity
  let energy = 0

  while (angularVelocity !== 0) {
    energy = stepMixEnergy(energy, angularVelocity, VINYL_PHYSICS.FRAME_MS).energy
    angularVelocity = stepInertia(
      0,
      angularVelocity,
      VINYL_PHYSICS.FRAME_MS,
    ).angularVelocity
  }

  return energy
}

describe('vinylPhysics', () => {
  it('applies nearly identical friction across different frame sizes', () => {
    let smallStepVelocity = 1_000

    for (let frame = 0; frame < 60; frame += 1) {
      smallStepVelocity = stepInertia(0, smallStepVelocity, 1_000 / 60).angularVelocity
    }

    const largeStepVelocity = stepInertia(0, 1_000, 1_000).angularVelocity
    expect(smallStepVelocity).toBeCloseTo(largeStepVelocity, 4)
  })

  it('lets a strong throw coast for roughly three to five seconds', () => {
    let angularVelocity = 1_200

    for (let frame = 0; frame < 4 * 60; frame += 1) {
      angularVelocity = stepInertia(0, angularVelocity, 1_000 / 60).angularVelocity
    }

    expect(Math.abs(angularVelocity)).toBeGreaterThan(VINYL_PHYSICS.STOP_SPEED)

    for (let frame = 0; frame < 2 * 60; frame += 1) {
      angularVelocity = stepInertia(0, angularVelocity, 1_000 / 60).angularVelocity
    }

    expect(angularVelocity).toBe(0)
  })

  it('charges only above the minimum speed and rewards stronger throws', () => {
    const weak = stepMixEnergy(0, VINYL_PHYSICS.MIN_ENERGY_SPEED - 1, 1_000)
    const medium = stepMixEnergy(0, 600, 1_000)
    const strong = stepMixEnergy(0, VINYL_PHYSICS.MAX_ENERGY_SPEED, 1_000)

    expect(weak.energy).toBe(0)
    expect(medium.energy).toBeGreaterThan(0.25)
    expect(medium.energy).toBeLessThan(strong.energy)
    expect(strong.energy).toBeGreaterThanOrEqual(0.85)
  })

  it('keeps the intended weak, medium, and strong attempt difficulty', () => {
    const weakAttempt = simulateThrow(300)
    const mediumAttempt = simulateThrow(550)
    const strongAttempt = simulateThrow(900)
    const excellentAttempt = simulateThrow(1_200)

    expect(weakAttempt).toBeLessThan(0.2)
    expect(mediumAttempt).toBeGreaterThan(1 / 3)
    expect(mediumAttempt).toBeLessThan(0.5)
    expect(strongAttempt).toBeGreaterThan(0.8)
    expect(strongAttempt).toBeLessThan(1)
    expect(excellentAttempt).toBeGreaterThan(0.95)
  })

  it('decays stored energy very slowly only when the LP is nearly stopped', () => {
    const nearRest = stepMixEnergy(0.5, VINYL_PHYSICS.IDLE_DECAY_SPEED - 1, 1_000)
    const coasting = stepMixEnergy(0.5, VINYL_PHYSICS.IDLE_DECAY_SPEED + 1, 1_000)

    expect(nearRest.energy).toBeLessThan(0.5)
    expect(nearRest.energy).toBeGreaterThan(0.45)
    expect(coasting.energy).toBe(0.5)
  })

  it('calculates and clamps angular velocity from pointer angle samples', () => {
    const velocity = calculateDragVelocity(90, 50, 0)
    const clamped = calculateDragVelocity(180, 1, velocity)

    expect(velocity).toBeGreaterThan(1_000)
    expect(Math.abs(clamped)).toBe(VINYL_PHYSICS.MAX_ANGULAR_VELOCITY)
  })

  it('classifies slow, medium, fast, and overdrive feedback bands', () => {
    expect(classifySpinFeedback(40)).toBe('slow')
    expect(classifySpinFeedback(VINYL_PHYSICS.MEDIUM_SPEED)).toBe('medium')
    expect(classifySpinFeedback(VINYL_PHYSICS.FAST_SPEED)).toBe('fast')
    expect(classifySpinFeedback(VINYL_PHYSICS.OVERDRIVE_SPEED)).toBe('overdrive')
  })
})
