import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { MixtapeResult } from '../types/mixtape'
import FinalMixtape from './FinalMixtape'

const RESULT: MixtapeResult = {
  tasteProfile: {
    summary: '잔잔한 보컬과 몽환적인 신스를 좋아해요.',
    genres: ['dream pop'],
    moods: ['late night'],
    traits: ['soft vocals'],
  },
  mixtape: {
    title: 'CUSTOM NIGHT RECEIPT',
    subtitle: 'soft lights, slow streets',
    dochiComment: '너만의 밤을 만들었어.',
    design: {
      atmosphere: '조용한 네온빛',
      palette: ['midnight blue', 'coral'],
      texture: 'matte plastic',
      motifs: ['window light'],
    },
    tracks: [{
      id: 'recommendation-001',
      title: 'Custom Recommendation',
      artist: 'Dochi Select',
      album: '',
      reason: '네가 고른 몽환적인 결과 잘 이어져요.',
      catalogStatus: 'verified',
      platforms: {
        spotify: { id: null, url: null },
        appleMusic: { id: null, url: null },
        youtubeMusic: { id: null, url: null },
      },
    }],
  },
}

describe('FinalMixtape', () => {
  it('shows the polaroid label and opens the full mix details', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    const onClose = vi.fn()

    const { rerender } = render(
      <FinalMixtape
        result={RESULT}
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
        result={RESULT}
        open
        polaroidUrl="data:image/png;base64,polaroid"
        onOpen={onOpen}
        onClose={onClose}
      />,
    )
    expect(screen.getByText('CUSTOM NIGHT RECEIPT')).toBeInTheDocument()
    expect(screen.getByText('Custom Recommendation')).toBeInTheDocument()
    expect(screen.getByText('네가 고른 몽환적인 결과 잘 이어져요.')).toBeInTheDocument()
    expect(screen.getByText('VERIFIED')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '믹스테이프 닫기' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows the default Dochi sticker when no user photo was captured', () => {
    render(<FinalMixtape result={RESULT} open={false} polaroidUrl={null} onOpen={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByRole('img', { name: '도치 기본 스티커' })).toBeInTheDocument()
  })
})
