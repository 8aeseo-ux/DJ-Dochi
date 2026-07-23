import { validatePlaylistImage } from '../src/config/playlistAnalysis.js'
import { PlaylistAnalysisError } from '../src/types/playlistAnalysis.js'
import type { PlaylistAnalysisIssue } from '../src/types/playlistAnalysis.js'
import { extractPlaylistWithOpenAI } from '../server/openaiPlaylistExtractor.js'

const JSON_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
}

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  })
}

function errorResponse(issue: PlaylistAnalysisIssue, status: number) {
  return json({ error: issue }, status)
}

function validationStatus(code: PlaylistAnalysisIssue['code']) {
  if (code === 'UNSUPPORTED_IMAGE_TYPE') return 415
  if (code === 'IMAGE_TOO_LARGE') return 413
  return 400
}

function isFile(value: FormDataEntryValue | null): value is File {
  return value !== null
    && typeof value !== 'string'
    && typeof value.arrayBuffer === 'function'
    && typeof value.size === 'number'
    && typeof value.type === 'string'
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { Allow: 'POST, OPTIONS' },
      })
    }

    if (request.method !== 'POST') {
      return json({
        error: {
          code: 'ANALYSIS_FAILED',
          message: 'POST 요청만 사용할 수 있어요.',
          retryable: false,
        },
      }, 405, { Allow: 'POST, OPTIONS' })
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return errorResponse({
        code: 'MISSING_IMAGE',
        message: '분석할 이미지가 전달되지 않았어요.',
        retryable: false,
      }, 400)
    }

    const image = formData.get('image')
    if (!isFile(image)) {
      return errorResponse({
        code: 'MISSING_IMAGE',
        message: '분석할 이미지가 전달되지 않았어요.',
        retryable: false,
      }, 400)
    }

    const validationIssue = validatePlaylistImage(image)
    if (validationIssue) return errorResponse(validationIssue, validationStatus(validationIssue.code))

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return errorResponse({
        code: 'MISSING_API_KEY',
        message: '이미지 분석 기능이 아직 설정되지 않았어요.',
        retryable: false,
      }, 503)
    }

    try {
      const result = await extractPlaylistWithOpenAI(image, apiKey)
      return json(result)
    } catch (error) {
      const issue: PlaylistAnalysisIssue = error instanceof PlaylistAnalysisError
        ? { code: error.code, message: error.message, retryable: error.retryable }
        : {
            code: 'ANALYSIS_FAILED',
            message: '이미지를 분석하지 못했어요. 잠시 후 다시 시도해주세요.',
            retryable: true,
          }
      return errorResponse(issue, 502)
    }
  },
}
