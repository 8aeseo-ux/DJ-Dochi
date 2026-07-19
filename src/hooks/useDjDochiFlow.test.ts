import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDjDochiFlow } from './useDjDochiFlow'

function advanceToInputChoices(result: { current: ReturnType<typeof useDjDochiFlow> }) {
  act(() => result.current.actions.notice())
  for (let index = 0; index < 5; index += 1) {
    act(() => result.current.actions.advanceDialogue())
  }
}

function advanceToPhotoPrompt(result: { current: ReturnType<typeof useDjDochiFlow> }) {
  advanceToInputChoices(result)

  act(() => {
    result.current.actions.chooseText()
    result.current.actions.updateText('Beach House - Space Song')
    result.current.actions.handoff()
  })
  act(() => result.current.actions.advanceDialogue())
  act(() => result.current.actions.advanceDialogue())
  act(() => result.current.actions.completeSpin())
  act(() => vi.advanceTimersByTime(1_000))
  act(() => vi.advanceTimersByTime(800))
  act(() => vi.advanceTimersByTime(2_200))
  act(() => vi.advanceTimersByTime(900))
}

describe('useDjDochiFlow', () => {
  beforeEach(() => {
    const createObjectURL = vi.fn(() => 'blob:dochi-preview')
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('starts idle and notices the user when the character is activated', () => {
    const { result } = renderHook(() => useDjDochiFlow())

    expect(result.current.state).toBe('idle')
    expect(result.current.dialogue).toBe(null)

    act(() => result.current.actions.notice())

    expect(result.current.state).toBe('noticed')
    expect(result.current.dialogue?.text).toBe('엇?')
  })

  it('advances the five-line intro and exposes choices without changing the room', () => {
    const { result } = renderHook(() => useDjDochiFlow())

    advanceToInputChoices(result)

    expect(result.current.state).toBe('choosingInput')
    expect(result.current.dialogue?.text).toBe('네 취향이랑 비슷한 곡들로 테이프 하나 만들어볼게.')
    expect(result.current.dialogue?.index).toBe(4)
  })

  it('opens input choices in place and blocks handoff until content exists', () => {
    const { result } = renderHook(() => useDjDochiFlow())

    advanceToInputChoices(result)
    act(() => result.current.actions.chooseText())

    expect(result.current.state).toBe('choosingInput')
    expect(result.current.inputMode).toBe('text')
    expect(result.current.hasInput).toBe(false)

    act(() => result.current.actions.handoff())
    expect(result.current.state).toBe('choosingInput')

    act(() => result.current.actions.updateText('M83 - Midnight City'))
    expect(result.current.hasInput).toBe(true)
  })

  it('reacts to spin strength and stages celebration, needle, and recording automatically', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useDjDochiFlow())

    advanceToInputChoices(result)
    act(() => {
      result.current.actions.chooseText()
      result.current.actions.updateText('Beach House - Space Song')
      result.current.actions.handoff()
    })

    expect(result.current.state).toBe('receivingInput')
    expect(result.current.dialogue?.text).toBe('좋아.')

    act(() => result.current.actions.advanceDialogue())
    expect(result.current.dialogue?.text).toBe('이제 같이 믹스를 시작해보자.')
    act(() => result.current.actions.advanceDialogue())
    expect(result.current.state).toBe('working')
    expect(result.current.dialogue).toBe(null)

    act(() => vi.advanceTimersByTime(5_000))
    expect(result.current.state).toBe('working')

    act(() => result.current.actions.updateSpinMetrics({
      energy: 0.38,
      intensity: 0.55,
      feedback: 'medium',
      overdrive: false,
      isDragging: false,
    }))
    expect(result.current.spinEnergy).toBe(0.38)
    expect(result.current.spinIntensity).toBe(0.55)
    expect(['좋아, 감 잡았어.', '조금만 더!']).toContain(result.current.spinReaction)

    act(() => result.current.actions.updateSpinMetrics({
      energy: 0.82,
      intensity: 1,
      feedback: 'overdrive',
      overdrive: true,
      isDragging: false,
    }))
    expect(result.current.spinReaction).toBe('어어어, 너무 잘 돌리는데?!')
    expect(result.current.isOverdrive).toBe(true)

    act(() => result.current.actions.completeSpin())
    expect(result.current.state).toBe('recordingIntro')
    expect(result.current.dialogue).toBe(null)

    act(() => vi.advanceTimersByTime(999))
    expect(result.current.state).toBe('recordingIntro')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.state).toBe('needleDropping')
    expect(result.current.dialogue).toBe(null)

    act(() => vi.advanceTimersByTime(799))
    expect(result.current.state).toBe('needleDropping')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.state).toBe('recording')

    act(() => vi.advanceTimersByTime(2_200))
    expect(result.current.state).toBe('returning')
    act(() => vi.advanceTimersByTime(900))
    expect(result.current.state).toBe('photoPrompt')
    expect(result.current.dialogue?.text).toBe('됐다.')
  })

  it('opens the tape overlay after the return dialogue and restarts cleanly', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useDjDochiFlow())

    advanceToPhotoPrompt(result)
    expect(result.current.state).toBe('photoPrompt')

    act(() => result.current.actions.advanceDialogue())
    act(() => result.current.actions.advanceDialogue())
    act(() => result.current.actions.skipPhoto())
    expect(result.current.state).toBe('finalTape')
    expect(result.current.polaroidUrl).toBe(null)

    act(() => result.current.actions.openTape())
    expect(result.current.state).toBe('viewingTape')

    act(() => result.current.actions.closeTape())
    expect(result.current.state).toBe('finalTape')

    act(() => result.current.actions.restart())
    expect(result.current.state).toBe('idle')
    expect(result.current.inputMode).toBe(null)
    expect(result.current.dialogue).toBe(null)
  })

  it('offers a memory photo after recording and builds the final tape path', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useDjDochiFlow())

    advanceToPhotoPrompt(result)

    expect(result.current.state).toBe('photoPrompt')
    expect(result.current.dialogue?.text).toBe('됐다.')

    act(() => result.current.actions.advanceDialogue())
    expect(result.current.dialogue?.text).toBe('근데 아직 하나 부족해.')
    act(() => result.current.actions.advanceDialogue())
    expect(result.current.dialogue?.text).toBe('우리 기념사진 하나 찍을래?')

    act(() => result.current.actions.acceptPhoto())
    expect(result.current.state).toBe('cameraPreview')

    act(() => result.current.actions.capturePhoto('data:image/png;base64,user'))
    expect(result.current.state).toBe('photoReview')
    expect(result.current.capturedPhotoUrl).toBe('data:image/png;base64,user')

    act(() => result.current.actions.usePhoto())
    expect(result.current.state).toBe('polaroidMaking')

    act(() => result.current.actions.completePolaroid('data:image/png;base64,polaroid'))
    expect(result.current.state).toBe('finalTape')
    expect(result.current.polaroidUrl).toBe('data:image/png;base64,polaroid')
    expect(result.current.dialogue?.text).toBe('좋아.')
  })

  it('can skip the camera and create a default Dochi sticker tape', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useDjDochiFlow())

    advanceToPhotoPrompt(result)
    act(() => result.current.actions.skipPhoto())

    expect(result.current.state).toBe('finalTape')
    expect(result.current.capturedPhotoUrl).toBe(null)
    expect(result.current.polaroidUrl).toBe(null)
  })

  it('clears image input and revokes its object URL on restart', () => {
    const { result } = renderHook(() => useDjDochiFlow())
    const file = new File(['cover'], 'cover.png', { type: 'image/png' })

    act(() => result.current.actions.selectImage(file))

    expect(result.current.input.imageFile).toBe(file)
    expect(result.current.input.imageUrl).toBe('blob:dochi-preview')

    act(() => result.current.actions.restart())

    expect(result.current.input.imageUrl).toBe(null)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:dochi-preview')
  })
})
