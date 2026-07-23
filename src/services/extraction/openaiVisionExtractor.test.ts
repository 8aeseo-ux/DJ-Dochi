import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOpenAiVisionExtractor } from './openaiVisionExtractor'

const VALID_RESULT = {
  sourceApp: 'Spotify',
  tracks: [
    {
      id: 'track-001',
      title: 'Space Song',
      artist: 'Beach House',
      album: 'Depression Cherry',
      confidence: 0.98,
    },
  ],
  warnings: [],
}

afterEach(() => {
  vi.useRealTimers()
})

describe('createOpenAiVisionExtractor', () => {
  it('sends the image to the existing Vision endpoint as multipart data', async () => {
    const file = new File(['playlist'], 'playlist.png', { type: 'image/png' })
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.method).toBe('POST')
      expect(init?.body).toBeInstanceOf(FormData)
      expect((init?.body as FormData).get('image')).toBe(file)
      expect(init?.headers).toBeUndefined()
      return new Response(JSON.stringify(VALID_RESULT), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    const extractor = createOpenAiVisionExtractor({ fetchImpl })

    const result = await extractor.extract(file)

    expect(extractor.id).toBe('openai-vision')
    expect(fetchImpl).toHaveBeenCalledWith('/api/extract-playlist', expect.any(Object))
    expect(result.tracks[0].title).toBe('Space Song')
  })

  it('maps a structured API failure to PlaylistAnalysisError', async () => {
    const extractor = createOpenAiVisionExtractor({
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({
        error: {
          code: 'ANALYSIS_FAILED',
          message: '지금은 이미지를 읽을 수 없어요.',
          retryable: true,
        },
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })),
    })

    await expect(extractor.extract(
      new File(['playlist'], 'playlist.webp', { type: 'image/webp' }),
    )).rejects.toMatchObject({
      code: 'ANALYSIS_FAILED',
      message: '지금은 이미지를 읽을 수 없어요.',
      retryable: true,
    })
  })

  it('maps a JSON origin rejection without falling through to a parse error', async () => {
    const extractor = createOpenAiVisionExtractor({
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({
        error: {
          code: 'ORIGIN_NOT_ALLOWED',
          message: '허용되지 않은 요청 출처입니다.',
          retryable: false,
        },
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })),
    })

    await expect(extractor.extract(
      new File(['playlist'], 'playlist.png', { type: 'image/png' }),
    )).rejects.toMatchObject({
      code: 'ORIGIN_NOT_ALLOWED',
      message: '허용되지 않은 요청 출처입니다.',
      retryable: false,
    })
  })

  it('does not parse a non-JSON error response as JSON', async () => {
    const extractor = createOpenAiVisionExtractor({
      fetchImpl: vi.fn(async () => new Response('<html>Service unavailable</html>', {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })),
    })

    await expect(extractor.extract(
      new File(['playlist'], 'playlist.png', { type: 'image/png' }),
    )).rejects.toMatchObject({
      code: 'ANALYSIS_FAILED',
      retryable: true,
    })
  })

  it('reports malformed success JSON as an invalid response', async () => {
    const extractor = createOpenAiVisionExtractor({
      fetchImpl: vi.fn(async () => new Response(
        JSON.stringify({ tracks: 'broken' }),
        { status: 200 },
      )),
    })

    await expect(extractor.extract(
      new File(['playlist'], 'playlist.jpg', { type: 'image/jpeg' }),
    )).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('reports network failures without exposing the original payload', async () => {
    const extractor = createOpenAiVisionExtractor({
      fetchImpl: vi.fn(async () => {
        throw new TypeError('offline')
      }),
    })

    await expect(extractor.extract(
      new File(['playlist'], 'playlist.png', { type: 'image/png' }),
    )).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      retryable: true,
    })
  })

  it('aborts a request after the configured timeout', async () => {
    vi.useFakeTimers()
    const extractor = createOpenAiVisionExtractor({
      timeoutMs: 10,
      fetchImpl: vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>(
        (_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        },
      )),
    })

    const request = extractor.extract(
      new File(['playlist'], 'playlist.png', { type: 'image/png' }),
    )
    const rejection = expect(request).rejects.toMatchObject({
      code: 'REQUEST_TIMEOUT',
      retryable: true,
    })
    await vi.advanceTimersByTimeAsync(11)

    await rejection
  })
})
