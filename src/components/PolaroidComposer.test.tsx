import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PolaroidComposer from './PolaroidComposer'

const composerMock = vi.hoisted(() => ({
  composePolaroid: vi.fn().mockResolvedValue('data:image/png;base64,polaroid'),
}))

vi.mock('../lib/polaroidComposer', () => composerMock)
vi.mock('../lib/dochiAssets', () => ({
  getDochiAsset: vi.fn(() => 'dochi-result.webp'),
}))

describe('PolaroidComposer', () => {
  it('composes once and exposes the generated polaroid preview', async () => {
    const onComplete = vi.fn()
    render(<PolaroidComposer userPhotoUrl="data:image/png;base64,user" onComplete={onComplete} />)

    expect(screen.getByText('기념사진 만드는 중...')).toBeInTheDocument()

    await waitFor(() => {
      expect(composerMock.composePolaroid).toHaveBeenCalledWith({
        userPhotoUrl: 'data:image/png;base64,user',
        dochiUrl: 'dochi-result.webp',
      })
      expect(onComplete).toHaveBeenCalledWith('data:image/png;base64,polaroid')
    })

    expect(screen.getByRole('img', { name: 'DJ DOCHI & YOU 폴라로이드' })).toHaveAttribute('src', 'data:image/png;base64,polaroid')
  })

  it('also composes the default sticker version without a user photo', async () => {
    const onComplete = vi.fn()
    render(<PolaroidComposer userPhotoUrl={null} onComplete={onComplete} />)

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    expect(composerMock.composePolaroid).toHaveBeenCalledWith({ userPhotoUrl: null, dochiUrl: 'dochi-result.webp' })
  })
})
