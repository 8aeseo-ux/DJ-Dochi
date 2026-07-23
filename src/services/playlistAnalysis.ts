import { createPlaylistExtractor } from './extraction/createPlaylistExtractor'
import type {
  ExtractionProgress,
  PlaylistExtractor,
  PlaylistExtractorId,
} from './extraction/types'
import type { PlaylistExtractionResult } from '../types/playlistAnalysis'

export type ExtractPlaylistFromImageOptions = {
  extractorId?: PlaylistExtractorId
  signal?: AbortSignal
  onProgress?: (progress: ExtractionProgress) => void
}

type ExtractorFactory = (id: PlaylistExtractorId) => PlaylistExtractor

export function createPlaylistAnalysisService(
  factory: ExtractorFactory = createPlaylistExtractor,
) {
  return async function extractPlaylist(
    file: File,
    options: ExtractPlaylistFromImageOptions = {},
  ): Promise<PlaylistExtractionResult> {
    const extractor = factory(options.extractorId ?? 'browser-ocr')

    return extractor.extract(file, {
      signal: options.signal,
      onProgress: options.onProgress,
    })
  }
}

export const extractPlaylistFromImage = createPlaylistAnalysisService()
