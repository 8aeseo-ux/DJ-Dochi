import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateMixtapeFromTracks } from './mixtapeAnalysis'

const RESULT = {
  tasteProfile: {
    summary: '잔잔한 보컬을 좋아해요.',
    genres: ['indie pop'],
    moods: ['late night'],
    traits: ['soft vocals'],
  },
  mixtape: {
    title: '밤의 카세트',
    subtitle: 'soft lights',
    dochiComment: '좋아. 이 흐름으로 가보자.',
    design: {
      atmosphere: '조용한 밤',
      palette: ['navy'],
      texture: 'matte',
      motifs: ['stars'],
    },
    tracks: [{
      id: 'recommendation-001',
      title: 'Space Song',
      artist: 'Beach House',
      album: '',
      reason: '분위기가 자연스럽게 이어져요.',
      catalogStatus: 'verified',
      platforms: {
        spotify: { id: null, url: null },
        appleMusic: { id: null, url: null },
        youtubeMusic: { id: null, url: null },
      },
    }],
  },
}

function response(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: vi.fn().mockResolvedValue(body),
  }
}

describe('generateMixtapeFromTracks', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('posts only confirmed tracks and parses a structured result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(RESULT))
    vi.stubGlobal('fetch', fetchMock)
    const tracks = [{ id: 'track-001', title: 'Ditto', artist: 'NewJeans', album: '' }]

    await expect(generateMixtapeFromTracks(tracks)).resolves.toEqual(RESULT)
    expect(fetchMock).toHaveBeenCalledWith('/api/generate-mixtape', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ tracks }),
    }))
  })

  it('converts a structured server error into a retryable analysis error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
      error: {
        code: 'CATALOG_CANDIDATES_INSUFFICIENT',
        stage: 'catalog',
        message: '다시 시도해주세요.',
        retryable: true,
      },
    }, { ok: false, status: 502 })))

    await expect(generateMixtapeFromTracks([
      { id: 'track-001', title: 'Ditto', artist: 'NewJeans', album: '' },
    ])).rejects.toMatchObject({
      code: 'CATALOG_CANDIDATES_INSUFFICIENT',
      stage: 'catalog',
      retryable: true,
    })
  })

  it('maps a legacy server error without a stage to taste', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
      error: { code: 'ANALYSIS_FAILED', message: '다시 시도해주세요.', retryable: true },
    }, { ok: false, status: 502 })))

    await expect(generateMixtapeFromTracks([
      { id: 'track-001', title: 'Ditto', artist: 'NewJeans', album: '' },
    ])).rejects.toMatchObject({ stage: 'taste' })
  })

  it('rejects an invalid server response instead of inventing a result', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ not: 'a mixtape' })))

    await expect(generateMixtapeFromTracks([
      { id: 'track-001', title: 'Ditto', artist: 'NewJeans', album: '' },
    ])).rejects.toMatchObject({ code: 'INVALID_RESPONSE', retryable: true })
  })

  it('aborts the request when the caller aborts', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    const promise = generateMixtapeFromTracks([
      { id: 'track-001', title: 'Ditto', artist: 'NewJeans', album: '' },
    ], { signal: controller.signal })

    controller.abort()

    await expect(promise).rejects.toMatchObject({ code: 'NETWORK_ERROR', retryable: true })
  })
})
