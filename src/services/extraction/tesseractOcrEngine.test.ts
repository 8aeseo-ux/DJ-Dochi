import { describe, expect, it, vi } from 'vitest'
import { createTesseractOcrEngine } from './tesseractOcrEngine'

function createRecognitionResult() {
  return {
    data: {
      text: 'Ditto NewJeans',
      blocks: [
        {
          paragraphs: [
            {
              lines: [
                {
                  words: [
                    {
                      text: 'Ditto',
                      confidence: 96,
                      bbox: { x0: 120, y0: 140, x1: 220, y1: 180 },
                    },
                    {
                      text: 'NewJeans',
                      confidence: 94,
                      bbox: { x0: 700, y0: 140, x1: 850, y1: 180 },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  }
}

describe('createTesseractOcrEngine', () => {
  it('loads Korean and English lazily, then reuses one worker', async () => {
    const recognize = vi.fn(async () => createRecognitionResult())
    const createWorker = vi.fn(async () => ({ recognize }))
    const engine = createTesseractOcrEngine({ createWorker })
    const firstFile = new File(['first'], 'first.png', { type: 'image/png' })
    const secondFile = new File(['second'], 'second.png', { type: 'image/png' })

    expect(createWorker).not.toHaveBeenCalled()

    await engine.recognize(firstFile)
    await engine.recognize(secondFile)

    expect(createWorker).toHaveBeenCalledTimes(1)
    expect(createWorker).toHaveBeenCalledWith(
      ['kor', 'eng'],
      undefined,
      expect.objectContaining({ logger: expect.any(Function) }),
    )
    expect(recognize).toHaveBeenNthCalledWith(
      1,
      firstFile,
      {},
      { blocks: true, text: true },
    )
    expect(recognize).toHaveBeenNthCalledWith(
      2,
      secondFile,
      {},
      { blocks: true, text: true },
    )
  })

  it('flattens nested OCR words and derives image bounds', async () => {
    const createWorker = vi.fn(async () => ({
      recognize: vi.fn(async () => createRecognitionResult()),
    }))
    const engine = createTesseractOcrEngine({ createWorker })

    const result = await engine.recognize(
      new File(['image'], 'playlist.png', { type: 'image/png' }),
    )

    expect(result).toEqual({
      width: 850,
      height: 180,
      fullText: 'Ditto NewJeans',
      words: [
        {
          text: 'Ditto',
          confidence: 96,
          box: { x0: 120, y0: 140, x1: 220, y1: 180 },
        },
        {
          text: 'NewJeans',
          confidence: 94,
          box: { x0: 700, y0: 140, x1: 850, y1: 180 },
        },
      ],
    })
  })

  it('maps Tesseract logger updates to extraction progress', async () => {
    let logger: ((message: { status: string; progress: number }) => void) | undefined
    const createWorker = vi.fn(async (
      _languages,
      _oem,
      options,
    ) => {
      logger = options?.logger
      return {
        recognize: vi.fn(async () => {
          logger?.({ status: 'recognizing text', progress: 0.62 })
          return createRecognitionResult()
        }),
      }
    })
    const engine = createTesseractOcrEngine({ createWorker })
    const onProgress = vi.fn()

    const request = engine.recognize(
      new File(['image'], 'playlist.png', { type: 'image/png' }),
      { onProgress },
    )
    await Promise.resolve()
    logger?.({ status: 'loading tesseract core', progress: 0.3 })
    await request

    expect(onProgress).toHaveBeenCalledWith({
      phase: 'loading-engine',
      value: 0.3,
    })
    expect(onProgress).toHaveBeenCalledWith({
      phase: 'recognizing',
      value: 0.62,
    })
  })

  it('continues the serialized queue after a failed recognition', async () => {
    const recognize = vi.fn()
      .mockRejectedValueOnce(new Error('bad image'))
      .mockResolvedValueOnce(createRecognitionResult())
    const engine = createTesseractOcrEngine({
      createWorker: vi.fn(async () => ({ recognize })),
    })

    await expect(engine.recognize(
      new File(['bad'], 'bad.png', { type: 'image/png' }),
    )).rejects.toThrow('bad image')

    await expect(engine.recognize(
      new File(['good'], 'good.png', { type: 'image/png' }),
    )).resolves.toMatchObject({ fullText: 'Ditto NewJeans' })
  })
})
