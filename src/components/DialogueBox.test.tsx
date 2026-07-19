import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DialogueBox from './DialogueBox'

afterEach(cleanup)

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
})
