import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PhotoReview from './PhotoReview'

describe('PhotoReview', () => {
  it('shows the captured photo and exposes retake and use actions', () => {
    const onRetake = vi.fn()
    const onUse = vi.fn()
    render(<PhotoReview photoUrl="data:image/png;base64,user" onRetake={onRetake} onUse={onUse} />)

    expect(screen.getByRole('img', { name: '촬영한 기념사진 미리보기' })).toHaveAttribute('src', 'data:image/png;base64,user')

    fireEvent.click(screen.getByRole('button', { name: '다시 찍기' }))
    fireEvent.click(screen.getByRole('button', { name: '이 사진 사용하기' }))

    expect(onRetake).toHaveBeenCalledTimes(1)
    expect(onUse).toHaveBeenCalledTimes(1)
  })
})
