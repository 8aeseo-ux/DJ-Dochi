import { describe, expect, it } from 'vitest'
import type { OcrDocument, OcrWord } from './types'
import { parseOcrDocument } from './parseOcrDocument'

function word(
  text: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  confidence = 90,
): OcrWord {
  return {
    text,
    confidence,
    box: { x0, y0, x1, y1 },
  }
}

function document(words: OcrWord[], width = 1600, height = 1200): OcrDocument {
  return {
    width,
    height,
    words,
    fullText: words.map((item) => item.text).join(' '),
  }
}

describe('parseOcrDocument', () => {
  it('parses Apple Music title and artist columns without headers or durations', () => {
    const result = parseOcrDocument(document([
      word('노래', 70, 60, 120, 90),
      word('아티스트', 710, 60, 800, 90),
      word('앨범', 1010, 60, 1060, 90),
      word('시간', 1280, 60, 1330, 90),
      word('Your Dog Loves You', 168, 150, 420, 180),
      word('(feat. Crush)', 430, 150, 590, 180),
      word('Colde', 710, 150, 780, 180),
      word('Your Dog Love...', 1010, 150, 1180, 180),
      word('4:33', 1280, 150, 1335, 180),
      word('Car Crash', 168, 260, 300, 290),
      word('eaJ', 710, 260, 755, 290),
      word('Car Crash - Single', 1010, 260, 1190, 290),
      word('3:06', 1280, 260, 1335, 290),
    ]))

    expect(result.sourceApp).toBe('Apple Music')
    expect(result.tracks).toEqual([
      expect.objectContaining({
        id: 'track-001',
        title: 'Your Dog Loves You (feat. Crush)',
        artist: 'Colde',
        album: 'Your Dog Love...',
      }),
      expect.objectContaining({
        id: 'track-002',
        title: 'Car Crash',
        artist: 'eaJ',
        album: 'Car Crash - Single',
      }),
    ])
    expect(result.tracks.some((track) => track.title === '노래')).toBe(false)
    expect(result.tracks.some((track) => track.artist === '4:33')).toBe(false)
  })

  it('keeps Korean and English rows paired in a generic two-column layout', () => {
    const result = parseOcrDocument(document([
      word('Space Song', 180, 180, 360, 215),
      word('Beach House', 720, 180, 900, 215),
      word('사랑으로', 180, 300, 300, 335),
      word('wave to earth', 720, 300, 920, 335),
    ]))

    expect(result.sourceApp).toBe(null)
    expect(result.tracks.map(({ title, artist }) => ({ title, artist }))).toEqual([
      { title: 'Space Song', artist: 'Beach House' },
      { title: '사랑으로', artist: 'wave to earth' },
    ])
  })

  it('ignores controls, low-confidence noise, durations, and duplicate rows', () => {
    const result = parseOcrDocument(document([
      word('Ditto', 180, 180, 280, 215),
      word('NewJeans', 720, 180, 860, 215),
      word('3:05', 1280, 180, 1335, 215),
      word('•••', 1400, 180, 1450, 215, 95),
      word('Ditto', 180, 290, 280, 325),
      word('NewJeans', 720, 290, 860, 325),
      word('unreliable', 180, 400, 320, 435, 10),
      word('noise', 720, 400, 810, 435, 10),
    ]))

    expect(result.tracks).toHaveLength(1)
    expect(result.tracks[0]).toMatchObject({
      title: 'Ditto',
      artist: 'NewJeans',
    })
  })

  it('does not pair a title with an artist from an adjacent row', () => {
    const result = parseOcrDocument(document([
      word('Title without artist', 180, 180, 430, 215),
      word('Artist without title', 720, 300, 960, 335),
    ]))

    expect(result.tracks).toEqual([])
    expect(result.warnings).toContain(
      '곡명과 아티스트가 함께 보이는 항목을 찾지 못했어요.',
    )
  })

  it('returns an empty result for unreadable OCR output', () => {
    const result = parseOcrDocument(document([
      word('...', 100, 100, 150, 130),
      word('3:21', 1280, 200, 1335, 230),
    ]))

    expect(result).toEqual({
      sourceApp: null,
      tracks: [],
      warnings: ['곡명과 아티스트가 함께 보이는 항목을 찾지 못했어요.'],
    })
  })

  it('does not turn non-playlist UI labels into generic track rows', () => {
    const result = parseOcrDocument(document([
      word('개기', 180, 180, 250, 215),
      word('70', 720, 180, 770, 215),
      word('—', 180, 290, 220, 325),
      word('DOCHI VISION / ERROR', 720, 290, 1040, 325),
      word('다시 분석하기', 180, 400, 360, 435),
      word('a', 720, 400, 745, 435),
      word('음악 목록 붙여넣기', 180, 510, 440, 545),
      word('A', 720, 510, 745, 545),
    ]))

    expect(result.tracks).toEqual([])
    expect(result.warnings).toContain(
      '곡명과 아티스트가 함께 보이는 항목을 찾지 못했어요.',
    )
  })
})
