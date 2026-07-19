import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VINYL_PHYSICS } from '../lib/vinylPhysics'
import VinylInteraction from './VinylInteraction'

type PointerSample = {
  x: number
  y: number
  time: number
  pointerType?: 'mouse' | 'touch'
}

function installAnimationFrame() {
  let time = 0
  let nextId = 1
  const callbacks = new Map<number, FrameRequestCallback>()
  const request = vi.fn((callback: FrameRequestCallback) => {
    const id = nextId
    nextId += 1
    callbacks.set(id, callback)
    return id
  })
  const cancel = vi.fn((id: number) => callbacks.delete(id))

  vi.stubGlobal('requestAnimationFrame', request)
  vi.stubGlobal('cancelAnimationFrame', cancel)

  return {
    cancel,
    step(frameCount = 1, deltaMs = VINYL_PHYSICS.FRAME_MS) {
      act(() => {
        for (let frame = 0; frame < frameCount; frame += 1) {
          time += deltaMs
          const pending = [...callbacks.values()]
          callbacks.clear()
          pending.forEach((callback) => callback(time))
        }
      })
    },
  }
}

function setVinylGeometry(element: HTMLElement) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 200,
    bottom: 200,
    width: 200,
    height: 200,
    toJSON: () => ({}),
  })
}

function dispatchPointer(element: HTMLElement, type: string, sample: PointerSample) {
  const event = new MouseEvent(type, {
    bubbles: true,
    clientX: sample.x,
    clientY: sample.y,
  })

  Object.defineProperties(event, {
    pointerId: { value: 7 },
    pointerType: { value: sample.pointerType ?? 'mouse' },
    timeStamp: { value: sample.time },
  })

  fireEvent(element, event)
}

function getRotation(element: HTMLElement) {
  return Number.parseFloat(element.style.rotate || '0')
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('VinylInteraction', () => {
  it('does not charge or complete from a weak, slow movement', () => {
    const raf = installAnimationFrame()
    const onComplete = vi.fn()
    const onSpinMetrics = vi.fn()
    render(
      <VinylInteraction
        phase="spin"
        onComplete={onComplete}
        onSpinEnergy={vi.fn()}
        onSpinMetrics={onSpinMetrics}
      />,
    )

    const vinyl = screen.getByRole('slider', { name: 'LP를 돌려 믹스를 시작하세요' })
    setVinylGeometry(vinyl)
    dispatchPointer(vinyl, 'pointerdown', { x: 200, y: 100, time: 100 })
    dispatchPointer(vinyl, 'pointermove', { x: 199, y: 117, time: 400 })
    dispatchPointer(vinyl, 'pointerup', { x: 199, y: 117, time: 410 })
    raf.step(6 * 60)

    expect(vinyl).toHaveAttribute('aria-valuemax', '100')
    expect(vinyl).toHaveAttribute('aria-valuenow', '0')
    expect(onComplete).not.toHaveBeenCalled()
  })

  it.each(['mouse', 'touch'] as const)('keeps spinning with inertia after a strong %s throw', (pointerType) => {
    const raf = installAnimationFrame()
    const onSpinMetrics = vi.fn()
    render(
      <VinylInteraction
        phase="spin"
        onComplete={vi.fn()}
        onSpinEnergy={vi.fn()}
        onSpinMetrics={onSpinMetrics}
      />,
    )

    const vinyl = screen.getByRole('slider', { name: 'LP를 돌려 믹스를 시작하세요' })
    setVinylGeometry(vinyl)
    dispatchPointer(vinyl, 'pointerdown', { x: 200, y: 100, time: 100, pointerType })
    dispatchPointer(vinyl, 'pointermove', { x: 100, y: 200, time: 145, pointerType })
    dispatchPointer(vinyl, 'pointerup', { x: 100, y: 200, time: 150, pointerType })

    const releasedAt = getRotation(vinyl)
    raf.step(12)

    expect(getRotation(vinyl)).toBeGreaterThan(releasedAt)
    expect(onSpinMetrics).toHaveBeenCalledWith(expect.objectContaining({
      energy: expect.any(Number),
      intensity: expect.any(Number),
      feedback: expect.stringMatching(/fast|overdrive/),
    }))
  })

  it('continues coasting before completing after the energy threshold', () => {
    const raf = installAnimationFrame()
    const onComplete = vi.fn()
    render(
      <VinylInteraction
        phase="spin"
        onComplete={onComplete}
        onSpinEnergy={vi.fn()}
        onSpinMetrics={vi.fn()}
      />,
    )

    const vinyl = screen.getByRole('slider', { name: 'LP를 돌려 믹스를 시작하세요' })
    setVinylGeometry(vinyl)
    dispatchPointer(vinyl, 'pointerdown', { x: 200, y: 100, time: 100 })
    dispatchPointer(vinyl, 'pointermove', { x: 100, y: 200, time: 140 })
    dispatchPointer(vinyl, 'pointerup', { x: 100, y: 200, time: 145 })

    for (let frame = 0; frame < 180 && vinyl.getAttribute('aria-valuenow') !== '100'; frame += 1) {
      raf.step()
    }

    expect(vinyl).toHaveAttribute('aria-valuenow', '100')
    expect(onComplete).not.toHaveBeenCalled()
    const angleAtCompletion = getRotation(vinyl)

    raf.step(Math.ceil(VINYL_PHYSICS.COMPLETION_COAST_MS / VINYL_PHYSICS.FRAME_MS) - 1)
    expect(getRotation(vinyl)).toBeGreaterThan(angleAtCompletion)
    expect(onComplete).not.toHaveBeenCalled()

    raf.step(2)
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('separates needle lowering from the REC recording phase', () => {
    installAnimationFrame()
    const { rerender } = render(
      <VinylInteraction
        phase="needle"
        onComplete={vi.fn()}
        onSpinEnergy={vi.fn()}
        onSpinMetrics={vi.fn()}
      />,
    )

    expect(screen.getByTestId('vinyl-needle')).toHaveClass('vinyl-needle--down')
    expect(screen.queryByText('Recording...')).not.toBeInTheDocument()

    rerender(
      <VinylInteraction
        phase="recording"
        onComplete={vi.fn()}
        onSpinEnergy={vi.fn()}
        onSpinMetrics={vi.fn()}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Recording...')
  })

  it('cancels the animation frame when unmounted', () => {
    const raf = installAnimationFrame()
    const { unmount } = render(
      <VinylInteraction
        phase="spin"
        onComplete={vi.fn()}
        onSpinEnergy={vi.fn()}
        onSpinMetrics={vi.fn()}
      />,
    )

    unmount()
    expect(raf.cancel).toHaveBeenCalled()
  })
})
