import type { PlaylistExtractionResult } from '../../types/playlistAnalysis'

export type PlaylistExtractorId = 'browser-ocr' | 'openai-vision'

export type ExtractionProgress = {
  phase: 'loading-engine' | 'recognizing' | 'parsing'
  value: number | null
}

export type ExtractPlaylistOptions = {
  signal?: AbortSignal
  onProgress?: (progress: ExtractionProgress) => void
}

export interface PlaylistExtractor {
  readonly id: PlaylistExtractorId
  extract(
    file: File,
    options?: ExtractPlaylistOptions,
  ): Promise<PlaylistExtractionResult>
}

export type OcrWord = {
  text: string
  confidence: number
  box: {
    x0: number
    y0: number
    x1: number
    y1: number
  }
}

export type OcrDocument = {
  width: number
  height: number
  words: OcrWord[]
  fullText: string
}

export interface BrowserOcrEngine {
  recognize(
    image: File,
    options?: ExtractPlaylistOptions,
  ): Promise<OcrDocument>
}
