import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import TasteAnalysisErrorPanel from './TasteAnalysisErrorPanel'

describe('TasteAnalysisErrorPanel', () => {
  it.each([
    ['taste', '취향을 읽지 못했어.', '취향 분석에 실패했어요.'],
    ['catalog', '취향은 읽었는데, 확인되는 곡을 충분히 찾지 못했어.', '확인되는 추천곡 후보가 부족해요.'],
    ['curation', '취향은 읽었는데, 확인되는 곡을 충분히 찾지 못했어.', '곡을 고르는 중에 문제가 생겼어. 다시 골라볼게.'],
  ] as const)('shows stage-specific copy for %s failures', (stage, heading, message) => {
    render(
      <TasteAnalysisErrorPanel
        issue={{
          code: stage === 'taste'
            ? 'TASTE_ANALYSIS_FAILED'
            : stage === 'catalog'
              ? 'CATALOG_CANDIDATES_INSUFFICIENT'
              : 'CURATION_FAILED',
          stage,
          message,
          retryable: true,
        }}
        onRetry={vi.fn()}
        onChooseImage={vi.fn()}
        onChooseText={vi.fn()}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(heading)
    expect(screen.getByRole('alert')).toHaveTextContent(message)
  })

  it('exposes retry and alternate input actions', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    const onChooseImage = vi.fn()
    const onChooseText = vi.fn()

    render(
      <TasteAnalysisErrorPanel
        issue={{
          code: 'TASTE_ANALYSIS_FAILED',
          stage: 'taste',
          message: '취향 분석에 실패했어요.',
          retryable: true,
        }}
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
