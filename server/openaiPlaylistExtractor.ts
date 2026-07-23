import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod'
import { PlaylistAnalysisError } from '../src/types/playlistAnalysis.js'
import type { PlaylistExtractionResult } from '../src/types/playlistAnalysis.js'

const OPENAI_PLAYLIST_MODEL = 'gpt-5.6-luna'
const INCOMPLETE_TRACK_WARNING = '곡명과 아티스트를 모두 확인할 수 없는 항목은 제외했어요.'

const RawTrackSchema = z.object({
  title: z.string(),
  artist: z.string(),
  album: z.string(),
  confidence: z.number(),
}).strict()

const RawExtractionSchema = z.object({
  sourceApp: z.string().nullable(),
  tracks: z.array(RawTrackSchema),
  warnings: z.array(z.string()),
}).strict()

type RawExtraction = z.infer<typeof RawExtractionSchema>

const EXTRACTION_PROMPT = `
Analyze this playlist or music-library screenshot.

Return only information visibly present in the image:
- Detect the music app only when its identity is visible; otherwise use null.
- Extract each visible track title, artist, and album when shown.
- Never invent, complete, or guess a song, artist, album, or app name.
- If title and artist cannot be separated confidently, omit that row and add a concise Korean warning.
- Use an empty string for an album that is not visible.
- confidence must be between 0 and 1 and reflect legibility.
- Remove obvious duplicate rows when possible.
- If no readable tracks exist, return an empty tracks array and explain why in Korean warnings.
`.trim()

export function normalizeExtractionResult(raw: RawExtraction): PlaylistExtractionResult {
  const warnings = raw.warnings.map((warning) => warning.trim()).filter(Boolean)
  const seen = new Set<string>()
  let removedIncompleteTrack = false

  const tracks = raw.tracks.flatMap((track) => {
    const title = track.title.trim()
    const artist = track.artist.trim()

    if (!title || !artist) {
      removedIncompleteTrack = true
      return []
    }

    const duplicateKey = `${title.toLocaleLowerCase()}\u0000${artist.toLocaleLowerCase()}`
    if (seen.has(duplicateKey)) return []
    seen.add(duplicateKey)

    return [{
      id: '',
      title,
      artist,
      album: track.album.trim(),
      confidence: Math.min(1, Math.max(0, track.confidence)),
    }]
  }).map((track, index) => ({ ...track, id: `track-${String(index + 1).padStart(3, '0')}` }))

  if (removedIncompleteTrack && !warnings.includes(INCOMPLETE_TRACK_WARNING)) {
    warnings.push(INCOMPLETE_TRACK_WARNING)
  }

  if (tracks.length === 0 && warnings.length === 0) {
    warnings.push('읽을 수 있는 곡을 찾지 못했어요. 글자가 더 크게 보이는 이미지를 사용해주세요.')
  }

  return {
    sourceApp: raw.sourceApp?.trim() || null,
    tracks,
    warnings,
  }
}

export async function extractPlaylistWithOpenAI(file: File, apiKey: string): Promise<PlaylistExtractionResult> {
  const imageBytes = Buffer.from(await file.arrayBuffer())
  const imageUrl = `data:${file.type};base64,${imageBytes.toString('base64')}`
  const client = new OpenAI({ apiKey, timeout: 40_000, maxRetries: 1 })

  try {
    const response = await client.responses.parse({
      model: OPENAI_PLAYLIST_MODEL,
      store: false,
      reasoning: { effort: 'low' },
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: EXTRACTION_PROMPT },
            { type: 'input_image', image_url: imageUrl, detail: 'original' },
          ],
        },
      ],
      text: {
        format: zodTextFormat(RawExtractionSchema, 'playlist_extraction'),
      },
    })

    if (!response.output_parsed) {
      throw new PlaylistAnalysisError({
        code: 'INVALID_RESPONSE',
        message: '곡 목록 응답 형식을 확인할 수 없어요. 다시 시도해주세요.',
        retryable: true,
      })
    }

    return normalizeExtractionResult(response.output_parsed)
  } catch (error) {
    if (error instanceof PlaylistAnalysisError) throw error

    throw new PlaylistAnalysisError({
      code: 'ANALYSIS_FAILED',
      message: '이미지 분석 서비스에 연결하지 못했어요. 잠시 후 다시 시도해주세요.',
      retryable: true,
    }, { cause: error })
  }
}
