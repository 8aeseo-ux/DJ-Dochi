import type { PlaylistExtractionResult } from '../../types/playlistAnalysis'

export type UnnormalizedTrack = {
  title: string
  artist: string
  album?: string
  confidence: number
}

export type UnnormalizedExtraction = {
  sourceApp: string | null
  tracks: UnnormalizedTrack[]
  warnings: string[]
}

const EMPTY_RESULT_WARNING = '곡명과 아티스트가 함께 보이는 항목을 찾지 못했어요.'

function normalizeText(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ')
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export function normalizeExtraction(
  input: UnnormalizedExtraction,
): PlaylistExtractionResult {
  const seenTracks = new Set<string>()
  const tracks = input.tracks.flatMap((track) => {
    const title = normalizeText(track.title)
    const artist = normalizeText(track.artist)
    if (!title || !artist) return []

    const duplicateKey = `${title.toLocaleLowerCase()}::${artist.toLocaleLowerCase()}`
    if (seenTracks.has(duplicateKey)) return []
    seenTracks.add(duplicateKey)

    return [{
      id: '',
      title,
      artist,
      album: normalizeText(track.album ?? ''),
      confidence: clampConfidence(track.confidence),
    }]
  }).map((track, index) => ({
    ...track,
    id: `track-${String(index + 1).padStart(3, '0')}`,
  }))

  const warnings = input.warnings
    .map(normalizeText)
    .filter((warning, index, all) => warning && all.indexOf(warning) === index)

  if (tracks.length === 0 && !warnings.includes(EMPTY_RESULT_WARNING)) {
    warnings.push(EMPTY_RESULT_WARNING)
  }

  const sourceApp = input.sourceApp ? normalizeText(input.sourceApp) : ''

  return {
    sourceApp: sourceApp || null,
    tracks,
    warnings,
  }
}
