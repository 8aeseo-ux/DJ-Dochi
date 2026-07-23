import { normalizeExtraction } from './normalizeExtraction'
import type { UnnormalizedTrack } from './normalizeExtraction'
import type { OcrDocument, OcrWord } from './types'

const MIN_WORD_CONFIDENCE = 20
const APPLE_HEADER_LABELS = new Set([
  '노래',
  '아티스트',
  '앨범',
  '시간',
  'song',
  'artist',
  'album',
  'time',
])
const TITLE_RANGE = [0.08, 0.45] as const
const ARTIST_RANGE = [0.45, 0.67] as const
const ALBUM_RANGE = [0.67, 0.90] as const

type OcrRow = {
  words: OcrWord[]
  centerY: number
  medianHeight: number
}

function normalizeText(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ')
}

function isDuration(value: string): boolean {
  return /^\d{1,2}:\d{2}$/.test(value)
}

function isControl(value: string): boolean {
  return /^(?:[.…·•⋯]{2,}|[|｜])$/.test(value)
}

function isHeaderLabel(value: string): boolean {
  return APPLE_HEADER_LABELS.has(value.toLocaleLowerCase())
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

function wordHeight(word: OcrWord): number {
  return Math.max(1, word.box.y1 - word.box.y0)
}

function wordCenterY(word: OcrWord): number {
  return (word.box.y0 + word.box.y1) / 2
}

function sanitizeWords(document: OcrDocument): OcrWord[] {
  return document.words.flatMap((word) => {
    const text = normalizeText(word.text)
    const hasArea = word.box.x1 > word.box.x0 && word.box.y1 > word.box.y0

    if (
      !text
      || !hasArea
      || word.confidence < MIN_WORD_CONFIDENCE
      || isDuration(text)
      || isControl(text)
    ) {
      return []
    }

    return [{ ...word, text }]
  })
}

function groupRows(words: OcrWord[]): OcrRow[] {
  if (words.length === 0) return []
  const globalMedianHeight = median(words.map(wordHeight))
  const tolerance = Math.max(8, globalMedianHeight * 0.65)
  const rows: OcrRow[] = []

  for (const word of [...words].sort((a, b) => wordCenterY(a) - wordCenterY(b))) {
    const centerY = wordCenterY(word)
    const row = rows.find((candidate) => Math.abs(candidate.centerY - centerY) <= tolerance)

    if (!row) {
      rows.push({
        words: [word],
        centerY,
        medianHeight: wordHeight(word),
      })
      continue
    }

    row.words.push(word)
    row.centerY = row.words.reduce((sum, item) => sum + wordCenterY(item), 0) / row.words.length
    row.medianHeight = median(row.words.map(wordHeight))
  }

  return rows
    .map((row) => ({
      ...row,
      words: row.words.sort((a, b) => a.box.x0 - b.box.x0),
    }))
    .sort((a, b) => a.centerY - b.centerY)
}

function detectAppleMusic(document: OcrDocument, rows: OcrRow[]): boolean {
  const topBoundary = document.height * 0.2
  const labels = new Set(
    rows
      .filter((row) => row.centerY <= topBoundary)
      .flatMap((row) => row.words)
      .map((word) => word.text.toLocaleLowerCase())
      .filter((text) => APPLE_HEADER_LABELS.has(text)),
  )

  return labels.size >= 3
}

function joinWords(words: OcrWord[]): string {
  return normalizeText(words.map((word) => word.text).join(' '))
}

function rowConfidence(words: OcrWord[]): number {
  if (words.length === 0) return 0
  const raw = words.reduce((sum, word) => sum + word.confidence, 0) / words.length
  return raw > 1 ? raw / 100 : raw
}

function wordsInRange(
  words: OcrWord[],
  width: number,
  [minimum, maximum]: readonly [number, number],
): OcrWord[] {
  return words.filter((word) => {
    const centerX = (word.box.x0 + word.box.x1) / 2 / width
    return centerX >= minimum && centerX < maximum
  })
}

function parseAppleMusicRows(document: OcrDocument, rows: OcrRow[]): UnnormalizedTrack[] {
  return rows.flatMap((row) => {
    if (row.words.some((word) => isHeaderLabel(word.text))) return []

    const titleWords = wordsInRange(row.words, document.width, TITLE_RANGE)
    const artistWords = wordsInRange(row.words, document.width, ARTIST_RANGE)
    const albumWords = wordsInRange(row.words, document.width, ALBUM_RANGE)
    const title = joinWords(titleWords)
    const artist = joinWords(artistWords)
    if (!title || !artist) return []

    return [{
      title,
      artist,
      album: joinWords(albumWords),
      confidence: rowConfidence([...titleWords, ...artistWords]),
    }]
  })
}

function groupByHorizontalGaps(row: OcrRow): OcrWord[][] {
  if (row.words.length === 0) return []
  const minimumGap = Math.max(36, row.medianHeight * 2.2)
  const groups: OcrWord[][] = [[row.words[0]]]

  for (let index = 1; index < row.words.length; index += 1) {
    const previous = row.words[index - 1]
    const current = row.words[index]
    const gap = current.box.x0 - previous.box.x1

    if (gap >= minimumGap) groups.push([current])
    else groups[groups.length - 1].push(current)
  }

  return groups
}

function parseGenericRows(document: OcrDocument, rows: OcrRow[]): UnnormalizedTrack[] {
  return rows.flatMap((row) => {
    if (row.words.some((word) => isHeaderLabel(word.text))) return []

    const visibleWords = row.words.filter((word) => {
      const centerX = (word.box.x0 + word.box.x1) / 2 / document.width
      return centerX >= 0.07 && centerX < 0.9
    })
    const groups = groupByHorizontalGaps({ ...row, words: visibleWords })
      .map((group) => group.filter((word) => !isDuration(word.text) && !isControl(word.text)))
      .filter((group) => group.length > 0)

    if (groups.length < 2) return []
    const title = joinWords(groups[0])
    const artist = joinWords(groups[1])
    if (!title || !artist || isHeaderLabel(title) || isHeaderLabel(artist)) return []

    return [{
      title,
      artist,
      album: '',
      confidence: rowConfidence([...groups[0], ...groups[1]]),
    }]
  })
}

export function parseOcrDocument(document: OcrDocument) {
  const words = sanitizeWords(document)
  const rows = groupRows(words)
  const isAppleMusic = detectAppleMusic(document, rows)
  const tracks = isAppleMusic
    ? parseAppleMusicRows(document, rows)
    : parseGenericRows(document, rows)

  return normalizeExtraction({
    sourceApp: isAppleMusic ? 'Apple Music' : null,
    tracks,
    warnings: [],
  })
}
