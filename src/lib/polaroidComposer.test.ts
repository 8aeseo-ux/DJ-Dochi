import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { composePolaroid } from './polaroidComposer'

class MockImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  width = 640
  height = 480
  private source = ''

  set src(value: string) {
    this.source = value
    queueMicrotask(() => this.onload?.())
  }

  get src() {
    return this.source
  }
}

describe('composePolaroid', () => {
  const context = {
    beginPath: vi.fn(),
    closePath: vi.fn(),
    drawImage: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    restore: vi.fn(),
    rotate: vi.fn(),
    save: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    translate: vi.fn(),
  } as unknown as CanvasRenderingContext2D

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('Image', MockImage)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,polaroid')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('composes the user photo and Dochi into one labeled Canvas image', async () => {
    const result = await composePolaroid({ userPhotoUrl: 'user-photo', dochiUrl: 'dochi-result' })

    expect(result).toBe('data:image/png;base64,polaroid')
    expect(context.drawImage).toHaveBeenCalledTimes(2)
    expect(context.fillText).toHaveBeenCalledWith('DJ DOCHI & YOU', expect.any(Number), expect.any(Number))
    expect(context.strokeRect).toHaveBeenCalled()
  })

  it('creates a Dochi sticker polaroid when no user photo is available', async () => {
    const result = await composePolaroid({ userPhotoUrl: null, dochiUrl: 'dochi-result' })

    expect(result).toBe('data:image/png;base64,polaroid')
    expect(context.drawImage).toHaveBeenCalledTimes(1)
    expect(context.fillText).toHaveBeenCalledWith('NO CAMERA PHOTO', expect.any(Number), expect.any(Number))
  })
})
