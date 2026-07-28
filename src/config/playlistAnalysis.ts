import type { PlaylistAnalysisIssue } from '../types/playlistAnalysis'

export const SUPPORTED_PLAYLIST_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const

export const MAX_PLAYLIST_IMAGE_BYTES = 4 * 1024 * 1024
export const PLAYLIST_EXTRACTION_TIMEOUT_MS = 45_000

const supportedTypes = new Set<string>(SUPPORTED_PLAYLIST_IMAGE_TYPES)

export function validatePlaylistImage(file: Pick<File, 'size' | 'type'>): PlaylistAnalysisIssue | null {
  if (!supportedTypes.has(file.type.toLowerCase())) {
    return {
      code: 'UNSUPPORTED_IMAGE_TYPE',
      message: 'PNG, JPG, JPEG, WEBP 이미지만 사용할 수 있어요.',
      retryable: false,
    }
  }

  if (file.size > MAX_PLAYLIST_IMAGE_BYTES) {
    return {
      code: 'IMAGE_TOO_LARGE',
      message: '이미지 크기는 4MB 이하여야 해요.',
      retryable: false,
    }
  }

  return null
}
