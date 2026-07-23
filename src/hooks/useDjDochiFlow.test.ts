import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlaylistAnalysisError } from '../types/playlistAnalysis'
import { MixtapeAnalysisError } from '../types/mixtapeAnalysis'
import { extractPlaylistFromImage } from '../services/playlistAnalysis'
import { generateMixtapeFromTracks } from '../services/mixtapeAnalysis'
import { useDjDochiFlow } from './useDjDochiFlow'

vi.mock('../services/playlistAnalysis', () => ({
  extractPlaylistFromImage: vi.fn(),
}))

vi.mock('../services/mixtapeAnalysis', () => ({
  generateMixtapeFromTracks: vi.fn(),
}))

const extractPlaylistMock = vi.mocked(extractPlaylistFromImage)
const generateMixtapeMock = vi.mocked(generateMixtapeFromTracks)

const EXTRACTION_RESULT = {
  sourceApp: 'Apple Music',
  tracks: [
    { id: 'track-001', title: 'Ditto', artist: 'NewJeans', album: '', confidence: 0.96 },
    { id: 'track-002', title: 'Super Shy', artist: 'NewJeans', album: '', confidence: 0.91 },
  ],
  warnings: [],
}

const MIXTAPE_RESULT = {
  tasteProfile: {
    summary: '몽환적인 밤의 질감을 좋아해요.',
    genres: ['dream pop'],
    moods: ['late night'],
    traits: ['soft vocals'],
  },
  mixtape: {
    title: '새벽 두 시의 창문',
    subtitle: 'soft lights, slow streets',
    dochiComment: '밤에 음악 많이 듣지?',
    design: {
      atmosphere: '조용한 네온빛',
      palette: ['midnight blue'],
      texture: 'matte plastic',
      motifs: ['window light'],
    },
    tracks: [{
      id: 'recommendation-001',
      title: 'Space Song',
      artist: 'Beach House',
      album: '',
      reason: '입력곡의 몽환적인 결을 자연스럽게 이어가요.',
      catalogStatus: 'verified' as const,
      platforms: {
        spotify: { id: null, url: null },
        appleMusic: { id: null, url: null },
        youtubeMusic: { id: null, url: null },
      },
    }],
  },
}

function advanceToInputChoices(result: { current: ReturnType<typeof useDjDochiFlow> }) {
  act(() => result.current.actions.notice())
  for (let index = 0; index < 5; index += 1) {
    act(() => result.current.actions.advanceDialogue())
  }
}

async function advanceToPhotoPrompt(result: { current: ReturnType<typeof useDjDochiFlow> }) {
  advanceToInputChoices(result)

  act(() => {
    result.current.actions.chooseText()
    result.current.actions.updateText('Beach House - Space Song')
    result.current.actions.handoff()
  })
  act(() => result.current.actions.confirmExtraction())
  await act(async () => { await Promise.resolve() })
  act(() => result.current.actions.advanceDialogue())
  act(() => result.current.actions.advanceDialogue())
  act(() => result.current.actions.completeSpin())
  act(() => vi.advanceTimersByTime(1_000))
  act(() => vi.advanceTimersByTime(800))
  act(() => vi.advanceTimersByTime(2_200))
  act(() => vi.advanceTimersByTime(900))
}

describe('useDjDochiFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    generateMixtapeMock.mockResolvedValue(MIXTAPE_RESULT)
    const createObjectURL = vi.fn(() => 'blob:dochi-preview')
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('starts idle and notices the user when the character is activated', () => {
    const { result } = renderHook(() => useDjDochiFlow())

    expect(result.current.state).toBe('idle')
    expect(result.current.dialogue).toBe(null)

    act(() => result.current.actions.notice())

    expect(result.current.state).toBe('noticed')
    expect(result.current.dialogue?.text).toBe('엇?')
  })

  it('advances the five-line intro and exposes choices without changing the room', () => {
    const { result } = renderHook(() => useDjDochiFlow())

    advanceToInputChoices(result)

    expect(result.current.state).toBe('choosingInput')
    expect(result.current.dialogue?.text).toBe('네 취향이랑 비슷한 곡들로 테이프 하나 만들어볼게.')
    expect(result.current.dialogue?.index).toBe(4)
  })

  it('opens input choices in place and blocks handoff until content exists', () => {
    const { result } = renderHook(() => useDjDochiFlow())

    advanceToInputChoices(result)
    act(() => result.current.actions.chooseText())

    expect(result.current.state).toBe('choosingInput')
    expect(result.current.inputMode).toBe('text')
    expect(result.current.hasInput).toBe(false)

    act(() => result.current.actions.handoff())
    expect(result.current.state).toBe('choosingInput')

    act(() => result.current.actions.updateText('M83 - Midnight City'))
    expect(result.current.hasInput).toBe(true)
  })

  it('reacts to spin strength and stages celebration, needle, and recording automatically', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useDjDochiFlow())

    advanceToInputChoices(result)
    act(() => {
      result.current.actions.chooseText()
      result.current.actions.updateText('Beach House - Space Song')
      result.current.actions.handoff()
    })

    expect(result.current.state).toBe('extractionReview')
    act(() => result.current.actions.confirmExtraction())
    await act(async () => { await Promise.resolve() })
    expect(result.current.state).toBe('receivingInput')
    expect(result.current.dialogue?.text).toBe('좋아.')

    act(() => result.current.actions.advanceDialogue())
    expect(result.current.dialogue?.text).toBe('이제 같이 믹스를 시작해보자.')
    act(() => result.current.actions.advanceDialogue())
    expect(result.current.state).toBe('working')
    expect(result.current.dialogue).toBe(null)

    act(() => vi.advanceTimersByTime(5_000))
    expect(result.current.state).toBe('working')

    act(() => result.current.actions.updateSpinMetrics({
      energy: 0.38,
      intensity: 0.55,
      feedback: 'medium',
      overdrive: false,
      isDragging: false,
    }))
    expect(result.current.spinEnergy).toBe(0.38)
    expect(result.current.spinIntensity).toBe(0.55)
    expect(['좋아, 감 잡았어.', '조금만 더!']).toContain(result.current.spinReaction)

    act(() => result.current.actions.updateSpinMetrics({
      energy: 0.82,
      intensity: 1,
      feedback: 'overdrive',
      overdrive: true,
      isDragging: false,
    }))
    expect(result.current.spinReaction).toBe('어어어, 너무 잘 돌리는데?!')
    expect(result.current.isOverdrive).toBe(true)

    act(() => result.current.actions.completeSpin())
    expect(result.current.state).toBe('recordingIntro')
    expect(result.current.dialogue).toBe(null)

    act(() => vi.advanceTimersByTime(999))
    expect(result.current.state).toBe('recordingIntro')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.state).toBe('needleDropping')
    expect(result.current.dialogue).toBe(null)

    act(() => vi.advanceTimersByTime(799))
    expect(result.current.state).toBe('needleDropping')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.state).toBe('recording')

    act(() => vi.advanceTimersByTime(2_200))
    expect(result.current.state).toBe('returning')
    act(() => vi.advanceTimersByTime(900))
    expect(result.current.state).toBe('photoPrompt')
    expect(result.current.dialogue?.text).toBe('됐다.')
  })

  it('opens the tape overlay after the return dialogue and restarts cleanly', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useDjDochiFlow())

    await advanceToPhotoPrompt(result)
    expect(result.current.state).toBe('photoPrompt')

    act(() => result.current.actions.advanceDialogue())
    act(() => result.current.actions.advanceDialogue())
    act(() => result.current.actions.skipPhoto())
    expect(result.current.state).toBe('finalTape')
    expect(result.current.polaroidUrl).toBe(null)

    act(() => result.current.actions.openTape())
    expect(result.current.state).toBe('viewingTape')

    act(() => result.current.actions.closeTape())
    expect(result.current.state).toBe('finalTape')

    act(() => result.current.actions.restart())
    expect(result.current.state).toBe('idle')
    expect(result.current.inputMode).toBe(null)
    expect(result.current.dialogue).toBe(null)
  })

  it('offers a memory photo after recording and builds the final tape path', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useDjDochiFlow())

    await advanceToPhotoPrompt(result)

    expect(result.current.state).toBe('photoPrompt')
    expect(result.current.dialogue?.text).toBe('됐다.')

    act(() => result.current.actions.advanceDialogue())
    expect(result.current.dialogue?.text).toBe('근데 아직 하나 부족해.')
    act(() => result.current.actions.advanceDialogue())
    expect(result.current.dialogue?.text).toBe('우리 기념사진 하나 찍을래?')

    act(() => result.current.actions.acceptPhoto())
    expect(result.current.state).toBe('cameraPreview')

    act(() => result.current.actions.capturePhoto('data:image/png;base64,user'))
    expect(result.current.state).toBe('photoReview')
    expect(result.current.capturedPhotoUrl).toBe('data:image/png;base64,user')

    act(() => result.current.actions.usePhoto())
    expect(result.current.state).toBe('polaroidMaking')

    act(() => result.current.actions.completePolaroid('data:image/png;base64,polaroid'))
    expect(result.current.state).toBe('finalTape')
    expect(result.current.polaroidUrl).toBe('data:image/png;base64,polaroid')
    expect(result.current.dialogue?.text).toBe('좋아.')
  })

  it('can skip the camera and create a default Dochi sticker tape', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useDjDochiFlow())

    await advanceToPhotoPrompt(result)
    act(() => result.current.actions.skipPhoto())

    expect(result.current.state).toBe('finalTape')
    expect(result.current.capturedPhotoUrl).toBe(null)
    expect(result.current.polaroidUrl).toBe(null)
  })

  it('clears image input and revokes its object URL on restart', () => {
    const { result } = renderHook(() => useDjDochiFlow())
    const file = new File(['cover'], 'cover.png', { type: 'image/png' })

    act(() => result.current.actions.selectImage(file))

    expect(result.current.input.imageFile).toBe(file)
    expect(result.current.input.imageUrl).toBe('blob:dochi-preview')

    act(() => result.current.actions.restart())

    expect(result.current.input.imageUrl).toBe(null)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:dochi-preview')
  })

  it('extracts an image before entering the existing handoff flow', async () => {
    extractPlaylistMock.mockImplementation(async (_file, options) => {
      options?.onProgress?.({ phase: 'recognizing', value: 0.4 })
      return EXTRACTION_RESULT
    })
    const { result } = renderHook(() => useDjDochiFlow())
    const file = new File(['playlist'], 'playlist.png', { type: 'image/png' })

    advanceToInputChoices(result)
    act(() => result.current.actions.chooseImage())
    act(() => result.current.actions.selectImage(file))
    act(() => result.current.actions.handoff())

    expect(result.current.state).toBe('extracting')
    expect(result.current.dialogue?.text).toBe('어디 보자.')
    expect(extractPlaylistMock).toHaveBeenCalledWith(file, expect.objectContaining({
      extractorId: 'browser-ocr',
      signal: expect.any(AbortSignal),
      onProgress: expect.any(Function),
    }))
    expect(result.current.activeExtractorId).toBe('browser-ocr')
    expect(result.current.extractionProgress).toEqual({
      phase: 'recognizing',
      value: 0.4,
    })

    await act(async () => { await Promise.resolve() })

    expect(result.current.state).toBe('extractionReview')
    expect(result.current.extractionResult).toEqual(EXTRACTION_RESULT)
    expect(result.current.input.imageUrl).toBe(null)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:dochi-preview')

    act(() => result.current.actions.confirmExtraction())
    expect(result.current.state).toBe('analyzingTaste')
    expect(result.current.dialogue?.text).toBe('좋아. 이제 네 취향을 좀 볼게.')

    await act(async () => { await Promise.resolve() })
    expect(result.current.state).toBe('receivingInput')
    expect(result.current.dialogue?.text).toBe('좋아.')
    expect(result.current.mixtapeResult).toEqual(MIXTAPE_RESULT)
  })

  it('moves to extractionError and can explicitly retry with Vision', async () => {
    extractPlaylistMock
      .mockRejectedValueOnce(new PlaylistAnalysisError({
        code: 'ANALYSIS_FAILED',
        message: '이미지를 읽지 못했어요.',
        retryable: true,
      }))
      .mockResolvedValueOnce(EXTRACTION_RESULT)

    const { result } = renderHook(() => useDjDochiFlow())
    const file = new File(['playlist'], 'playlist.webp', { type: 'image/webp' })

    advanceToInputChoices(result)
    act(() => result.current.actions.chooseImage())
    act(() => result.current.actions.selectImage(file))
    act(() => result.current.actions.handoff())
    await act(async () => { await Promise.resolve() })

    expect(result.current.state).toBe('extractionError')
    expect(result.current.extractionError).toMatchObject({ code: 'ANALYSIS_FAILED' })
    expect(result.current.activeExtractorId).toBe('browser-ocr')

    act(() => result.current.actions.retryExtraction('openai-vision'))
    expect(result.current.state).toBe('extracting')
    await act(async () => { await Promise.resolve() })
    expect(result.current.state).toBe('extractionReview')
    expect(extractPlaylistMock).toHaveBeenCalledTimes(2)
    expect(extractPlaylistMock).toHaveBeenLastCalledWith(file, expect.objectContaining({
      extractorId: 'openai-vision',
    }))
    expect(result.current.activeExtractorId).toBe('openai-vision')
  })

  it('stops before LP analysis on LLM failure and retries with the confirmed edits', async () => {
    extractPlaylistMock.mockResolvedValue(EXTRACTION_RESULT)
    generateMixtapeMock
      .mockRejectedValueOnce(new MixtapeAnalysisError({
        code: 'CATALOG_CANDIDATES_INSUFFICIENT',
        stage: 'catalog',
        message: '확인되는 추천곡 후보가 부족해요.',
        retryable: true,
      }))
      .mockResolvedValueOnce(MIXTAPE_RESULT)

    const { result } = renderHook(() => useDjDochiFlow())
    const file = new File(['playlist'], 'playlist.png', { type: 'image/png' })

    advanceToInputChoices(result)
    act(() => result.current.actions.chooseImage())
    act(() => result.current.actions.selectImage(file))
    act(() => result.current.actions.handoff())
    await act(async () => { await Promise.resolve() })

    act(() => result.current.actions.updateExtractedTrack('track-001', 'title', 'Ditto (edited)'))
    act(() => result.current.actions.deleteExtractedTrack('track-002'))
    act(() => result.current.actions.confirmExtraction())

    expect(result.current.state).toBe('analyzingTaste')
    await act(async () => { await Promise.resolve() })

    expect(result.current.state).toBe('tasteAnalysisError')
    expect(result.current.tasteAnalysisError).toMatchObject({
      code: 'CATALOG_CANDIDATES_INSUFFICIENT',
      stage: 'catalog',
    })
    expect(result.current.mixtapeResult).toBe(null)

    act(() => result.current.actions.retryTasteAnalysis())
    expect(result.current.state).toBe('analyzingTaste')
    await act(async () => { await Promise.resolve() })

    expect(result.current.state).toBe('receivingInput')
    expect(generateMixtapeMock).toHaveBeenCalledTimes(2)
    expect(generateMixtapeMock).toHaveBeenLastCalledWith([
      { id: 'track-001', title: 'Ditto (edited)', artist: 'NewJeans', album: '' },
    ], expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('edits, deletes, and manually adds extracted tracks', async () => {
    extractPlaylistMock.mockResolvedValue(EXTRACTION_RESULT)
    const { result } = renderHook(() => useDjDochiFlow())
    const file = new File(['playlist'], 'playlist.jpg', { type: 'image/jpeg' })

    advanceToInputChoices(result)
    act(() => result.current.actions.chooseImage())
    act(() => result.current.actions.selectImage(file))
    act(() => result.current.actions.handoff())
    await act(async () => { await Promise.resolve() })

    act(() => result.current.actions.updateExtractedTrack('track-001', 'title', 'Ditto (edited)'))
    expect(result.current.extractionResult?.tracks[0].title).toBe('Ditto (edited)')

    act(() => result.current.actions.deleteExtractedTrack('track-002'))
    expect(result.current.extractionResult?.tracks).toHaveLength(1)

    act(() => result.current.actions.addExtractedTrack())
    expect(result.current.extractionResult?.tracks).toHaveLength(2)
    expect(result.current.extractionResult?.tracks[1]).toMatchObject({ title: '', artist: '' })
  })

  it('blocks unsupported image types before extraction', () => {
    const { result } = renderHook(() => useDjDochiFlow())
    const file = new File(['playlist'], 'playlist.gif', { type: 'image/gif' })

    advanceToInputChoices(result)
    act(() => result.current.actions.chooseImage())
    act(() => result.current.actions.selectImage(file))

    expect(result.current.input.imageFile).toBe(null)
    expect(result.current.inputError).toMatchObject({ code: 'UNSUPPORTED_IMAGE_TYPE' })
    expect(extractPlaylistMock).not.toHaveBeenCalled()
  })
})
