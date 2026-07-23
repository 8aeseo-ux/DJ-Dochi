import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ExtractedTrack, PlaylistExtractionResult } from '../types/playlistAnalysis'
import PlaylistExtractionReview from './PlaylistExtractionReview'

const TRACKS: ExtractedTrack[] = [
  { id: 'track-001', title: 'Ditto', artist: 'NewJeans', album: '', confidence: 0.95 },
  { id: 'track-002', title: 'Super Shy', artist: 'NewJeans', album: 'Get Up', confidence: 0.91 },
]

function EditableReview({
  onRetry = vi.fn(),
  onConfirm = vi.fn(),
  onRetryWithVision = vi.fn(),
  extractorId = 'browser-ocr',
}: {
  onRetry?: () => void
  onConfirm?: () => void
  onRetryWithVision?: () => void
  extractorId?: 'browser-ocr' | 'openai-vision'
}) {
  const [result, setResult] = useState<PlaylistExtractionResult>({
    sourceApp: 'Apple Music',
    tracks: TRACKS,
    warnings: ['앨범명 일부는 화면에 보이지 않았어요.'],
  })

  return (
    <PlaylistExtractionReview
      result={result}
      extractorId={extractorId}
      onTrackChange={(id, field, value) => setResult((current) => ({
        ...current,
        tracks: current.tracks.map((track) => track.id === id ? { ...track, [field]: value } : track),
      }))}
      onDeleteTrack={(id) => setResult((current) => ({
        ...current,
        tracks: current.tracks.filter((track) => track.id !== id),
      }))}
      onAddTrack={() => setResult((current) => ({
        ...current,
        tracks: [...current.tracks, {
          id: 'manual-track',
          title: '',
          artist: '',
          album: '',
          confidence: 1,
        }],
      }))}
      onRetry={onRetry}
      onRetryWithVision={onRetryWithVision}
      onConfirm={onConfirm}
      onChooseImage={vi.fn()}
      onChooseText={vi.fn()}
    />
  )
}

describe('PlaylistExtractionReview', () => {
  it('lets the user edit, delete, and add extracted tracks', async () => {
    const user = userEvent.setup()
    render(<EditableReview />)

    const title = screen.getByRole('textbox', { name: '1번 곡명' })
    await user.clear(title)
    await user.type(title, 'Ditto (edited)')
    expect(title).toHaveValue('Ditto (edited)')

    await user.click(screen.getByRole('button', { name: '2번 곡 삭제' }))
    expect(screen.queryByDisplayValue('Super Shy')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '곡 직접 추가' }))
    expect(screen.getByRole('textbox', { name: '2번 곡명' })).toHaveValue('')
    expect(screen.getByRole('button', { name: '이 목록이 맞아' })).toBeDisabled()
  })

  it('offers retry and confirms a complete list', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    const onConfirm = vi.fn()
    render(<EditableReview onRetry={onRetry} onConfirm={onConfirm} />)

    await user.click(screen.getByRole('button', { name: '이미지 다시 분석' }))
    await user.click(screen.getByRole('button', { name: '이 목록이 맞아' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('labels the active extractor and offers Vision only from browser OCR', async () => {
    const user = userEvent.setup()
    const onRetryWithVision = vi.fn()
    const { rerender } = render(
      <EditableReview onRetryWithVision={onRetryWithVision} />,
    )

    expect(screen.getByText('기기에서 읽음')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'AI Vision으로 다시 읽기' }))
    expect(onRetryWithVision).toHaveBeenCalledTimes(1)

    rerender(<EditableReview extractorId="openai-vision" />)
    expect(screen.getByText('AI Vision으로 읽음')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'AI Vision으로 다시 읽기' })).not.toBeInTheDocument()
  })

  it('offers alternate input choices when no tracks were extracted', async () => {
    const user = userEvent.setup()
    const onChooseImage = vi.fn()
    const onChooseText = vi.fn()

    render(
      <PlaylistExtractionReview
        result={{ sourceApp: null, tracks: [], warnings: ['읽을 수 있는 곡을 찾지 못했어요.'] }}
        extractorId="browser-ocr"
        onTrackChange={vi.fn()}
        onDeleteTrack={vi.fn()}
        onAddTrack={vi.fn()}
        onRetry={vi.fn()}
        onRetryWithVision={vi.fn()}
        onConfirm={vi.fn()}
        onChooseImage={onChooseImage}
        onChooseText={onChooseText}
      />,
    )

    expect(screen.getByText('읽을 수 있는 곡을 찾지 못했어요.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '다른 이미지 올리기' }))
    await user.click(screen.getByRole('button', { name: '음악 목록 붙여넣기' }))

    expect(onChooseImage).toHaveBeenCalledTimes(1)
    expect(onChooseText).toHaveBeenCalledTimes(1)
  })
})
