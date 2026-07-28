import { describe, expect, it } from 'vitest'
import { parsePastedPlaylist } from './parsePastedPlaylist'

describe('parsePastedPlaylist', () => {
  it('parses title and artist separated by a hyphen', () => {
    const result = parsePastedPlaylist('Ditto - NewJeans')

    expect(result.tracks).toEqual([
      {
        id: 'track-001',
        title: 'Ditto',
        artist: 'NewJeans',
        album: '',
        confidence: 1,
      },
    ])
    expect(result.warnings).toEqual([])
  })

  it('parses tab-separated rows and ignores blank lines', () => {
    const result = parsePastedPlaylist('\nDitto\tNewJeans\n\nSuper Shy\tNewJeans\n')

    expect(result.tracks.map(({ title, artist }) => ({ title, artist }))).toEqual([
      { title: 'Ditto', artist: 'NewJeans' },
      { title: 'Super Shy', artist: 'NewJeans' },
    ])
  })

  it('removes duplicate title and artist pairs case-insensitively', () => {
    const result = parsePastedPlaylist('Ditto - NewJeans\nditto - newjeans')

    expect(result.tracks).toHaveLength(1)
  })

  it('warns instead of guessing when a row has no separator', () => {
    const result = parsePastedPlaylist('이 줄은 곡과 아티스트를 구분할 수 없음')

    expect(result.tracks).toEqual([])
    expect(result.warnings).toHaveLength(1)
  })

  it('returns a warning for an empty list', () => {
    const result = parsePastedPlaylist('  \n\n')

    expect(result.tracks).toEqual([])
    expect(result.warnings).toEqual(['붙여넣은 음악 목록에서 읽을 수 있는 곡을 찾지 못했어요.'])
  })
})
