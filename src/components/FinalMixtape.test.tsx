import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import FinalMixtape from './FinalMixtape'

describe('FinalMixtape', () => {
  it('shows the polaroid label and opens the full mix details', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    const onClose = vi.fn()

    const { rerender } = render(
      <FinalMixtape
        open={false}
        polaroidUrl="data:image/png;base64,polaroid"
        onOpen={onOpen}
        onClose={onClose}
      />,
    )

    expect(screen.getByText('DOCHI MIX / CASSETTE 01')).toBeInTheDocument()
    expect(screen.getByText('DOCHI SIGNED')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'DJ DOCHI & YOU 기념사진' })).toHaveAttribute('src', 'data:image/png;base64,polaroid')

    await user.click(screen.getByRole('button', { name: '믹스테이프 보기' }))
    expect(onOpen).toHaveBeenCalledOnce()
    rerender(
      <FinalMixtape
        open
        polaroidUrl="data:image/png;base64,polaroid"
        onOpen={onOpen}
        onClose={onClose}
      />,
    )
    expect(screen.getByText('DOCHI\'S NIGHT DRIVE')).toBeInTheDocument()
    expect(screen.getByText('Midnight City')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '믹스테이프 닫기' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows the default Dochi sticker when no user photo was captured', () => {
    render(<FinalMixtape open={false} polaroidUrl={null} onOpen={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByRole('img', { name: '도치 기본 스티커' })).toBeInTheDocument()
  })
})
