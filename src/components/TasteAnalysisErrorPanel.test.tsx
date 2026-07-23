import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import TasteAnalysisErrorPanel from './TasteAnalysisErrorPanel'

describe('TasteAnalysisErrorPanel', () => {
  it('shows the error and exposes retry and alternate input actions', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    const onChooseImage = vi.fn()
    const onChooseText = vi.fn()

    render(
      <TasteAnalysisErrorPanel
        message="취향 분석에 실패했어요."
        onRetry={onRetry}
        onChooseImage={onChooseImage}
        onChooseText={onChooseText}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('취향 분석에 실패했어요.')

    await user.click(screen.getByRole('button', { name: '다시 분석하기' }))
    await user.click(screen.getByRole('button', { name: '다른 이미지 선택' }))
    await user.click(screen.getByRole('button', { name: '음악 목록 붙여넣기' }))

    expect(onRetry).toHaveBeenCalledOnce()
    expect(onChooseImage).toHaveBeenCalledOnce()
    expect(onChooseText).toHaveBeenCalledOnce()
  })
})
