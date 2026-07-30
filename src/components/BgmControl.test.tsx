import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import BgmControl from './BgmControl'

describe('BgmControl', () => {
  it('keeps BGM mute and volume controls behind one compact music icon', () => {
    const onToggle = vi.fn()
    const onVolumeChange = vi.fn()

    render(
      <BgmControl
        enabled
        volume={0.35}
        onToggle={onToggle}
        onVolumeChange={onVolumeChange}
      />,
    )

    const settingsButton = screen.getByRole('button', {
      name: '배경음악 설정 열기',
    })
    expect(settingsButton).not.toHaveTextContent('BGM')
    expect(screen.queryByRole('group', { name: '배경음악 설정' })).not.toBeInTheDocument()

    fireEvent.click(settingsButton)
    expect(screen.getByRole('group', { name: '배경음악 설정' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '배경음악 끄기' }))
    expect(onToggle).toHaveBeenCalledOnce()

    fireEvent.change(screen.getByRole('slider', { name: '배경음악 볼륨' }), {
      target: { value: '0.6' },
    })
    expect(onVolumeChange).toHaveBeenCalledWith(0.6)
  })
})
