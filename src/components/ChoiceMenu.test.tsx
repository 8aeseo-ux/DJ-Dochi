import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ChoiceMenu from './ChoiceMenu'

afterEach(cleanup)

describe('ChoiceMenu', () => {
  it('renders game choices and invokes the selected callback', async () => {
    const user = userEvent.setup()
    const onImage = vi.fn()
    const onText = vi.fn()

    render(
      <ChoiceMenu
        items={[
          { label: '플레이리스트 캡처 보여주기', onSelect: onImage },
          { label: '음악 목록 적어주기', onSelect: onText, variant: 'secondary' },
        ]}
      />,
    )

    expect(screen.getByRole('group', { name: '도치의 선택지' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '음악 목록 적어주기' }))
    expect(onText).toHaveBeenCalledOnce()
  })
})
