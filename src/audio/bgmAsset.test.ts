import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const LOOP_PATH = resolve(
  process.cwd(),
  'src/assets/audio/dochi-workroom-loop.wav',
)

describe('DJ Dochi workroom BGM asset', () => {
  it('ships an audible, loop-safe 78 BPM eight-bar PCM wave', () => {
    expect(existsSync(LOOP_PATH)).toBe(true)
    if (!existsSync(LOOP_PATH)) return

    const wav = readFileSync(LOOP_PATH)
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF')
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE')

    const channels = wav.readUInt16LE(22)
    const sampleRate = wav.readUInt32LE(24)
    const bitsPerSample = wav.readUInt16LE(34)
    const dataBytes = wav.readUInt32LE(40)
    const bytesPerFrame = channels * bitsPerSample / 8
    const durationSeconds = dataBytes / bytesPerFrame / sampleRate
    let peak = 0

    for (let offset = 44; offset < wav.length; offset += 2) {
      peak = Math.max(peak, Math.abs(wav.readInt16LE(offset)))
    }

    const firstLeft = wav.readInt16LE(44)
    const finalLeft = wav.readInt16LE(wav.length - bytesPerFrame)

    expect(channels).toBe(2)
    expect(sampleRate).toBe(44_100)
    expect(bitsPerSample).toBe(16)
    expect(durationSeconds).toBeCloseTo(32 * 60 / 78, 2)
    expect(peak).toBeGreaterThan(1_000)
    expect(peak).toBeLessThanOrEqual(26_870)
    expect(Math.abs(firstLeft - finalLeft)).toBeLessThan(700)
  })
})
