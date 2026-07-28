import { createWorker as createTesseractWorker } from 'tesseract.js'
import type {
  BrowserOcrEngine,
  ExtractPlaylistOptions,
  OcrDocument,
  OcrWord,
} from './types'

type TesseractLoggerMessage = {
  status: string
  progress: number
}

type TesseractWord = {
  text?: unknown
  confidence?: unknown
  bbox?: {
    x0?: unknown
    y0?: unknown
    x1?: unknown
    y1?: unknown
  }
}

type TesseractRecognition = {
  data?: {
    text?: unknown
    blocks?: Array<{
      paragraphs?: Array<{
        lines?: Array<{
          words?: TesseractWord[]
        }>
      }>
    }> | null
  }
}

type TesseractWorkerLike = {
  recognize(
    image: File,
    options: Record<string, never>,
    output: { blocks: true; text: true },
  ): Promise<TesseractRecognition>
}

type CreateWorkerLike = (
  languages: string[],
  oem: undefined,
  options: {
    logger: (message: TesseractLoggerMessage) => void
  },
) => Promise<TesseractWorkerLike>

type TesseractOcrDependencies = {
  createWorker?: CreateWorkerLike
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function flattenWords(result: TesseractRecognition): OcrWord[] {
  const blocks = result.data?.blocks ?? []

  return blocks.flatMap((block) => block.paragraphs ?? [])
    .flatMap((paragraph) => paragraph.lines ?? [])
    .flatMap((line) => line.words ?? [])
    .flatMap((word) => {
      const text = typeof word.text === 'string' ? word.text : ''
      const confidence = asFiniteNumber(word.confidence)
      const x0 = asFiniteNumber(word.bbox?.x0)
      const y0 = asFiniteNumber(word.bbox?.y0)
      const x1 = asFiniteNumber(word.bbox?.x1)
      const y1 = asFiniteNumber(word.bbox?.y1)

      if (!text || confidence === null || x0 === null || y0 === null || x1 === null || y1 === null) {
        return []
      }

      return [{
        text,
        confidence,
        box: { x0, y0, x1, y1 },
      }]
    })
}

function toOcrDocument(result: TesseractRecognition): OcrDocument {
  const words = flattenWords(result)

  return {
    width: Math.max(1, ...words.map((word) => word.box.x1)),
    height: Math.max(1, ...words.map((word) => word.box.y1)),
    words,
    fullText: typeof result.data?.text === 'string' ? result.data.text.trim() : '',
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return
  throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError')
}

export function createTesseractOcrEngine(
  dependencies: TesseractOcrDependencies = {},
): BrowserOcrEngine {
  const createWorker = dependencies.createWorker
    ?? createTesseractWorker as unknown as CreateWorkerLike
  let workerPromise: Promise<TesseractWorkerLike> | null = null
  let queue: Promise<void> = Promise.resolve()
  let activeOptions: ExtractPlaylistOptions | undefined

  const logger = (message: TesseractLoggerMessage) => {
    if (message.status === 'recognizing text') {
      activeOptions?.onProgress?.({
        phase: 'recognizing',
        value: asFiniteNumber(message.progress),
      })
      return
    }

    if (message.status.toLocaleLowerCase().includes('loading')) {
      activeOptions?.onProgress?.({
        phase: 'loading-engine',
        value: asFiniteNumber(message.progress),
      })
    }
  }

  const getWorker = () => {
    if (!workerPromise) {
      workerPromise = createWorker(['kor', 'eng'], undefined, { logger })
    }
    return workerPromise
  }

  return {
    recognize(image, options = {}) {
      const task = queue.then(async () => {
        throwIfAborted(options.signal)
        activeOptions = options

        try {
          options.onProgress?.({ phase: 'loading-engine', value: null })
          const worker = await getWorker()
          throwIfAborted(options.signal)
          const result = await worker.recognize(
            image,
            {},
            { blocks: true, text: true },
          )
          throwIfAborted(options.signal)
          return toOcrDocument(result)
        } finally {
          activeOptions = undefined
        }
      })

      queue = task.then(() => undefined, () => undefined)
      return task
    },
  }
}
