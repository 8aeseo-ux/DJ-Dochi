import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MixtapeOverlay from './MixtapeOverlay'

afterEach(cleanup)

describe('MixtapeOverlay', () => {
  it('opens from the room tape trigger and closes back to the room', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    const onClose = vi.fn()

    const { rerender } = render(<MixtapeOverlay open={false} onOpen={onOpen} onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: '믹스테이프 보기' }))
    expect(onOpen).toHaveBeenCalledOnce()

    rerender(<MixtapeOverlay open onOpen={onOpen} onClose={onClose} />)
    expect(screen.getByRole('dialog', { name: '도치 믹스테이프' })).toBeInTheDocument()
    expect(screen.getByText('DOCHI\'S NIGHT DRIVE')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '믹스테이프 닫기' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
