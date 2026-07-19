import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlaylistInput } from '../types'
import PlaylistInputPanel from './PlaylistInputPanel'

afterEach(cleanup)

const EMPTY_INPUT: PlaylistInput = { imageFile: null, imageUrl: null, pastedText: '' }

function TextInputHarness({ onHandoff }: { onHandoff: () => void }) {
  const [text, setText] = useState('')
  return (
    <PlaylistInputPanel
      mode="text"
      input={{ ...EMPTY_INPUT, pastedText: text }}
      hasInput={Boolean(text.trim())}
      onImageSelect={vi.fn()}
      onTextChange={setText}
      onHandoff={onHandoff}
      onDelete={vi.fn()}
      onClose={vi.fn()}
    />
  )
}

describe('PlaylistInputPanel', () => {
  it('keeps handoff disabled until text has content', async () => {
    const user = userEvent.setup()
    const onHandoff = vi.fn()
    render(<TextInputHarness onHandoff={onHandoff} />)

    const handoff = screen.getByRole('button', { name: '도치에게 건네기' })
    expect(handoff).toBeDisabled()

    await user.type(screen.getByLabelText('음악 목록'), 'M83 - Midnight City')
    expect(handoff).toBeEnabled()

    await user.click(handoff)
    expect(onHandoff).toHaveBeenCalledOnce()
  })

  it('shows an image preview and exposes replace/delete controls', async () => {
    const user = userEvent.setup()
    const onImageSelect = vi.fn()
    const onDelete = vi.fn()
    const file = new File(['cover'], 'cover.png', { type: 'image/png' })

    render(
      <PlaylistInputPanel
        mode="image"
        input={{ imageFile: file, imageUrl: 'blob:cover', pastedText: '' }}
        hasInput
        onImageSelect={onImageSelect}
        onTextChange={vi.fn()}
        onHandoff={vi.fn()}
        onDelete={onDelete}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByAltText('선택한 플레이리스트 캡처')).toHaveAttribute('src', 'blob:cover')
    expect(screen.getByText('cover.png')).toBeInTheDocument()

    await user.upload(screen.getByLabelText('플레이리스트 캡처 파일'), new File(['next'], 'next.png', { type: 'image/png' }))
    expect(onImageSelect).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: '삭제' }))
    expect(onDelete).toHaveBeenCalledOnce()
  })
})
