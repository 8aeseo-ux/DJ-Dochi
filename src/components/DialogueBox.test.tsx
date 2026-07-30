import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentType } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DialogueBox from './DialogueBox'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('DialogueBox', () => {
  it('reveals the current line on the first click and advances on the second', () => {
    const onAdvance = vi.fn()
    render(<DialogueBox line="언제부터 거기 있었어?" dialogueKey="intro-1" onAdvance={onAdvance} />)

    const box = screen.getByRole('button', { name: '도치의 대화' })
    expect(box).not.toHaveTextContent('언제부터 거기 있었어?')

    fireEvent.click(box)
    expect(box).toHaveTextContent('언제부터 거기 있었어?')
    expect(onAdvance).not.toHaveBeenCalled()

    fireEvent.click(box)
    expect(onAdvance).toHaveBeenCalledOnce()
  })

  it('resets its typewriter when the dialogue key changes', () => {
    const { rerender } = render(<DialogueBox line="엇?" dialogueKey="intro-0" onAdvance={vi.fn()} />)
    const box = screen.getByRole('button', { name: '도치의 대화' })

    fireEvent.click(box)
    expect(box).toHaveTextContent('엇?')

    rerender(<DialogueBox line="잘 왔어." dialogueKey="intro-1" onAdvance={vi.fn()} />)
    expect(box).not.toHaveTextContent('잘 왔어.')
  })

  it('reports only characters that are revealed by the typewriter', () => {
    vi.useFakeTimers()
    const onCharacterReveal = vi.fn()
    const VoiceDialogueBox = DialogueBox as ComponentType<{
      line: string
      dialogueKey: string
      onAdvance: () => void
      onCharacterReveal: (
        character: string,
        index: number,
        metadata: { isTerminal: boolean },
      ) => void
    }>

    render(
      <VoiceDialogueBox
        line="엇? 안녕"
        dialogueKey="intro-0"
        onAdvance={vi.fn()}
        onCharacterReveal={onCharacterReveal}
      />,
    )

    act(() => vi.advanceTimersByTime(32 * 3))

    expect(onCharacterReveal.mock.calls).toEqual([
      ['엇', 0, { isTerminal: false }],
      ['?', 1, { isTerminal: false }],
      [' ', 2, { isTerminal: false }],
    ])
  })

  it('marks the last readable character before punctuation as terminal', () => {
    vi.useFakeTimers()
    const onCharacterReveal = vi.fn()

    render(
      <DialogueBox
        line="엇?"
        dialogueKey="intro-terminal"
        onAdvance={vi.fn()}
        onCharacterReveal={onCharacterReveal}
      />,
    )

    act(() => vi.advanceTimersByTime(32 * 2))

    expect(onCharacterReveal.mock.calls).toEqual([
      ['엇', 0, { isTerminal: true }],
      ['?', 1, { isTerminal: false }],
    ])
  })

  it('stops the character voice immediately when the line is skipped', () => {
    vi.useFakeTimers()
    const onTypingStop = vi.fn()
    const onCharacterReveal = vi.fn()

    render(
      <DialogueBox
        line="도치가 말하는 중"
        dialogueKey="intro-0"
        onAdvance={vi.fn()}
        onCharacterReveal={onCharacterReveal}
        onTypingStop={onTypingStop}
      />,
    )

    act(() => vi.advanceTimersByTime(32))
    fireEvent.click(screen.getByRole('button', { name: '도치의 대화' }))
    act(() => vi.advanceTimersByTime(32 * 20))

    expect(onTypingStop).toHaveBeenCalledOnce()
    expect(onCharacterReveal).toHaveBeenCalledOnce()
  })
})
