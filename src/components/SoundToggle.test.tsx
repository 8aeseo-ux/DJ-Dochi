import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SoundToggle from './SoundToggle'

describe('SoundToggle', () => {
  it('offers an unobtrusive icon control with an accessible sound state', () => {
    const onToggle = vi.fn()
    const { rerender } = render(<SoundToggle enabled onToggle={onToggle} />)
    const enabledButton = screen.getByRole('button', { name: '대화 효과음 끄기' })

    expect(enabledButton).toHaveAttribute('aria-pressed', 'true')
    expect(enabledButton).not.toHaveTextContent('SFX')
    fireEvent.click(enabledButton)
    expect(onToggle).toHaveBeenCalledOnce()

    rerender(<SoundToggle enabled={false} onToggle={onToggle} />)
    expect(screen.getByRole('button', { name: '대화 효과음 켜기' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})
