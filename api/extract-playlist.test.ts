// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_PLAYLIST_IMAGE_BYTES } from '../src/config/playlistAnalysis'
import { PlaylistAnalysisError } from '../src/types/playlistAnalysis'
import { extractPlaylistWithOpenAI } from '../server/openaiPlaylistExtractor'
import handler from './extract-playlist'

vi.mock('../server/openaiPlaylistExtractor', () => ({
  extractPlaylistWithOpenAI: vi.fn(),
}))

const extractWithOpenAIMock = vi.mocked(extractPlaylistWithOpenAI)

const RESULT = {
  sourceApp: 'Spotify',
  tracks: [
    { id: 'track-001', title: 'Space Song', artist: 'Beach House', album: '', confidence: 0.98 },
  ],
  warnings: [],
}

function createRequest(file?: File, method = 'POST') {
  if (!file) return new Request('http://localhost/api/extract-playlist', { method })
  const formData = new FormData()
  formData.append('image', file)
  return new Request('http://localhost/api/extract-playlist', { method, body: formData })
}

describe('POST /api/extract-playlist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OPENAI_API_KEY = 'test-api-key'
    extractWithOpenAIMock.mockResolvedValue(RESULT)
  })

  afterEach(() => {
    delete process.env.OPENAI_API_KEY
  })

  it('accepts CORS preflight requests without calling OpenAI', async () => {
    const response = await handler.fetch(createRequest(undefined, 'OPTIONS'))

    expect(response.status).toBe(204)
    expect(extractWithOpenAIMock).not.toHaveBeenCalled()
  })

  it('rejects non-POST requests', async () => {
    const response = await handler.fetch(createRequest(undefined, 'GET'))

    expect(response.status).toBe(405)
  })

  it('rejects a missing image', async () => {
    const response = await handler.fetch(createRequest())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'MISSING_IMAGE' } })
  })

  it('rejects unsupported image formats', async () => {
    const response = await handler.fetch(createRequest(new File(['gif'], 'playlist.gif', { type: 'image/gif' })))

    expect(response.status).toBe(415)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'UNSUPPORTED_IMAGE_TYPE' } })
    expect(extractWithOpenAIMock).not.toHaveBeenCalled()
  })

  it('rejects images over the shared size limit', async () => {
    const largeFile = new File([new Uint8Array(MAX_PLAYLIST_IMAGE_BYTES + 1)], 'large.png', { type: 'image/png' })
    const response = await handler.fetch(createRequest(largeFile))

    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'IMAGE_TOO_LARGE' } })
  })

  it('requires the server-only OpenAI API key', async () => {
    delete process.env.OPENAI_API_KEY
    const response = await handler.fetch(createRequest(new File(['png'], 'playlist.png', { type: 'image/png' })))

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'MISSING_API_KEY' } })
  })

  it('returns the structured extraction result', async () => {
    const file = new File(['png'], 'playlist.png', { type: 'image/png' })
    const response = await handler.fetch(createRequest(file))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(RESULT)
    const [receivedFile, receivedApiKey] = extractWithOpenAIMock.mock.calls[0]
    expect(receivedFile).toMatchObject({ name: file.name, type: file.type, size: file.size })
    expect(receivedApiKey).toBe('test-api-key')
  })

  it('returns a structured retryable error when analysis fails', async () => {
    extractWithOpenAIMock.mockRejectedValue(new PlaylistAnalysisError({
      code: 'ANALYSIS_FAILED',
      message: 'OpenAI 요청에 실패했어요.',
      retryable: true,
    }))
    const response = await handler.fetch(createRequest(new File(['png'], 'playlist.png', { type: 'image/png' })))

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      error: { code: 'ANALYSIS_FAILED', message: 'OpenAI 요청에 실패했어요.', retryable: true },
    })
  })
})
