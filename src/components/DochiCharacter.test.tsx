import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DochiCharacter from './DochiCharacter'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('DochiCharacter', () => {
  it('keeps a labeled character area for the supplied replacement asset', () => {
    render(<DochiCharacter pose="idle" />)

    expect(screen.getByRole('img', { name: 'DJ 도치 idle' })).toBeInTheDocument()
  })

  it('exposes visual motion and an interactive activation target', () => {
    const onClick = vi.fn()
    render(<DochiCharacter pose="idle" motion="groove" interactive onClick={onClick} />)

    const character = screen.getByRole('button', { name: 'DJ 도치 idle' })
    expect(character).toHaveClass('dochi-character--groove')
    expect(character).toHaveClass('dochi-character--staccato')
    fireEvent.click(character)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('alternates idle image frames every 550ms', () => {
    vi.useFakeTimers()
    render(<DochiCharacter pose="idle" motion="groove" />)

    expect(screen.getByRole('img', { name: 'DJ 도치 idle' })).toHaveAttribute(
      'src',
      expect.stringContaining('dochi-idle-01.webp'),
    )

    act(() => {
      vi.advanceTimersByTime(550)
    })
    expect(screen.getByRole('img', { name: 'DJ 도치 idle' })).toHaveAttribute(
      'src',
      expect.stringContaining('dochi-idle-02.webp'),
    )

    act(() => {
      vi.advanceTimersByTime(550)
    })
    expect(screen.getByRole('img', { name: 'DJ 도치 idle' })).toHaveAttribute(
      'src',
      expect.stringContaining('dochi-idle-01.webp'),
    )
  })

  it('stops the idle frame timer when the character leaves idle', () => {
    vi.useFakeTimers()
    const { rerender } = render(<DochiCharacter pose="idle" motion="groove" />)

    act(() => {
      vi.advanceTimersByTime(550)
    })
    rerender(<DochiCharacter pose="surprised" motion="still" />)

    expect(screen.getByRole('img', { name: 'DJ 도치 surprised' })).toHaveAttribute(
      'src',
      expect.stringContaining('dochi-noticed.webp'),
    )

    act(() => {
      vi.advanceTimersByTime(1100)
    })
    expect(screen.getByRole('img', { name: 'DJ 도치 surprised' })).toHaveAttribute(
      'src',
      expect.stringContaining('dochi-noticed.webp'),
    )
  })
})
