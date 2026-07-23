import type { PlaylistExtractionResult } from '../../types/playlistAnalysis'

const EMPTY_LIST_WARNING = '붙여넣은 음악 목록에서 읽을 수 있는 곡을 찾지 못했어요.'

function splitTrackRow(row: string): [string, string] | null {
  const separators = [
    /\t+/,
    /\s*\|\s*/,
    /\s+[—–]\s+/,
    /\s+-\s+/,
  ]

  for (const separator of separators) {
    const parts = row.split(separator).map((part) => part.trim()).filter(Boolean)
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return [parts[0], parts[1]]
    }
  }

  return null
}

export function parsePastedPlaylist(value: string): PlaylistExtractionResult {
  const warnings: string[] = []
  const seen = new Set<string>()
  const tracks = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const parsed = splitTrackRow(line)

      if (!parsed) {
        warnings.push('곡명과 아티스트를 구분할 수 없는 줄은 제외했어요.')
        return []
      }

      const [title, artist] = parsed
      const duplicateKey = `${title.toLocaleLowerCase()}\u0000${artist.toLocaleLowerCase()}`
      if (seen.has(duplicateKey)) return []
      seen.add(duplicateKey)

      return [{
        title,
        artist,
        album: '',
        confidence: 1,
      }]
    })
    .map((track, index) => ({
      id: `track-${String(index + 1).padStart(3, '0')}`,
      ...track,
    }))

  if (tracks.length === 0 && warnings.length === 0) {
    warnings.push(EMPTY_LIST_WARNING)
  }

  return {
    sourceApp: null,
    tracks,
    warnings: [...new Set(warnings)],
  }
}

