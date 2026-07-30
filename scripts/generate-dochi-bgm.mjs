import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SAMPLE_RATE = 44_100
const BPM = 78
const TOTAL_BEATS = 32
const CHANNELS = 2
const BITS_PER_SAMPLE = 16
const SECONDS_PER_BEAT = 60 / BPM
const DURATION_SECONDS = TOTAL_BEATS * SECONDS_PER_BEAT
const FRAME_COUNT = Math.round(DURATION_SECONDS * SAMPLE_RATE)
const OUTPUT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/assets/audio/dochi-workroom-loop.wav',
)

const left = new Float64Array(FRAME_COUNT)
const right = new Float64Array(FRAME_COUNT)

let randomState = 0x0d0c41

function random() {
  randomState = (randomState * 1664525 + 1013904223) >>> 0
  return randomState / 0x1_0000_0000
}

function midiToHz(midi) {
  return 440 * 2 ** ((midi - 69) / 12)
}

function equalPowerPan(pan) {
  const normalized = (Math.max(-1, Math.min(1, pan)) + 1) * Math.PI / 4
  return [Math.cos(normalized), Math.sin(normalized)]
}

function addSignal(startBeat, durationBeats, pan, generator) {
  const startFrame = Math.max(
    0,
    Math.floor(startBeat * SECONDS_PER_BEAT * SAMPLE_RATE),
  )
  const durationFrames = Math.max(
    1,
    Math.floor(durationBeats * SECONDS_PER_BEAT * SAMPLE_RATE),
  )
  const endFrame = Math.min(FRAME_COUNT, startFrame + durationFrames)
  const [leftGain, rightGain] = equalPowerPan(pan)

  for (let frame = startFrame; frame < endFrame; frame += 1) {
    const elapsed = (frame - startFrame) / SAMPLE_RATE
    const progress = (frame - startFrame) / durationFrames
    const value = generator(elapsed, progress)
    left[frame] += value * leftGain
    right[frame] += value * rightGain
  }
}

function addMallet(startBeat, midi, gain = 0.18, pan = 0) {
  const frequency = midiToHz(midi)
  const durationBeats = 0.72
  const durationSeconds = durationBeats * SECONDS_PER_BEAT

  addSignal(startBeat, durationBeats, pan, (elapsed, progress) => {
    const attack = Math.min(1, elapsed / 0.006)
    const decay = Math.exp(-5.1 * elapsed / durationSeconds)
    const release = Math.sin(Math.PI * Math.min(1, progress)) ** 0.35
    const fundamental = Math.sin(2 * Math.PI * frequency * elapsed)
    const softOvertone =
      0.24 * Math.sin(2 * Math.PI * frequency * 2.01 * elapsed + 0.18)
    const woodenBody =
      0.08 * Math.sin(2 * Math.PI * frequency * 0.5 * elapsed + 0.4)

    return (
      gain *
      attack *
      decay *
      release *
      (fundamental + softOvertone + woodenBody)
    )
  })
}

function addBass(startBeat, midi, gain = 0.16) {
  const frequency = midiToHz(midi)
  const durationBeats = 1.35
  const durationSeconds = durationBeats * SECONDS_PER_BEAT

  addSignal(startBeat, durationBeats, -0.05, (elapsed, progress) => {
    const attack = Math.min(1, elapsed / 0.025)
    const release = Math.min(1, (1 - progress) / 0.22)
    const decay = 0.58 + 0.42 * Math.exp(-2.8 * elapsed / durationSeconds)
    const body = Math.sin(2 * Math.PI * frequency * elapsed)
    const roundness =
      0.13 * Math.sin(2 * Math.PI * frequency * 2 * elapsed + 0.2)

    return gain * attack * Math.max(0, release) * decay * (body + roundness)
  })
}

function addPad(startBeat, durationBeats, notes, gain = 0.027) {
  const frequencies = notes.map(midiToHz)
  const durationSeconds = durationBeats * SECONDS_PER_BEAT

  addSignal(startBeat, durationBeats, 0.08, (elapsed, progress) => {
    const attack = Math.min(1, elapsed / 0.45)
    const release = Math.min(1, (durationSeconds - elapsed) / 0.55)
    const envelope = Math.max(0, Math.min(attack, release))
    const shimmer =
      0.94 + 0.06 * Math.sin(2 * Math.PI * 0.17 * elapsed + startBeat)
    let signal = 0

    frequencies.forEach((frequency, index) => {
      const detune = index % 2 === 0 ? 0.997 : 1.003
      signal +=
        Math.sin(2 * Math.PI * frequency * detune * elapsed + index * 0.21) +
        0.08 *
          Math.sin(2 * Math.PI * frequency * 2 * elapsed + index * 0.13)
    })

    return gain * envelope * shimmer * signal / frequencies.length
  })
}

function addWoodClick(startBeat, pan) {
  const frequency = 236 + random() * 42

  addSignal(startBeat, 0.16, pan, (elapsed, progress) => {
    const envelope = (1 - progress) ** 5
    const body = Math.sin(2 * Math.PI * frequency * elapsed)
    const texture = (random() * 2 - 1) * 0.24
    return 0.035 * envelope * (body + texture)
  })
}

function addBrush(startBeat, pan) {
  let previous = 0

  addSignal(startBeat, 0.24, pan, (_elapsed, progress) => {
    const white = random() * 2 - 1
    previous += 0.18 * (white - previous)
    const envelope = Math.sin(Math.PI * progress) ** 1.7
    return 0.016 * envelope * previous
  })
}

const chordRegions = [
  { start: 0, root: 41, notes: [53, 57, 60, 64] }, // Fmaj7
  { start: 8, root: 38, notes: [50, 53, 57, 60] }, // Dm7
  { start: 16, root: 46, notes: [58, 62, 65, 69] }, // Bbmaj7
  { start: 24, root: 36, notes: [48, 52, 55, 57] }, // C6
]

for (const region of chordRegions) {
  addPad(region.start, 7.35, region.notes)
  addBass(region.start, region.root)
  addBass(region.start + 2, region.root + 7, 0.13)
  addBass(region.start + 4, region.root)
  addBass(region.start + 6, region.root + 7, 0.12)
}

const motif = [
  [0.5, 69],
  [1.5, 72],
  [3, 74],
  [4.5, 72],
  [6, 69],
  [8.5, 69],
  [10, 65],
  [11.5, 64],
  [13, 65],
  [14.5, 69],
  [16.5, 65],
  [18, 69],
  [19.5, 70],
  [21, 69],
  [22.5, 65],
  [24.5, 67],
  [26, 69],
  [27.5, 72],
  [29, 69],
  [30, 67],
]

motif.forEach(([beat, midi], index) => {
  const pan = index % 3 === 0 ? -0.18 : index % 3 === 1 ? 0.16 : 0
  const accent = index % 5 === 0 ? 0.2 : 0.17
  addMallet(beat, midi, accent, pan)
})

for (let beat = 0; beat < 31; beat += 1) {
  if (beat % 2 === 1) addWoodClick(beat, beat % 4 === 1 ? -0.26 : 0.28)
  if (beat % 4 === 2) addBrush(beat + 0.48, 0.18)
}

let peak = 0
for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
  const time = frame / SAMPLE_RATE
  const fadeIn = Math.min(1, time / 0.012)
  const remaining = DURATION_SECONDS - time
  const fadeOut = Math.min(1, Math.max(0, remaining / 0.16))
  const master = fadeIn * fadeOut

  left[frame] = Math.tanh(left[frame] * 1.08) * master
  right[frame] = Math.tanh(right[frame] * 1.08) * master
  peak = Math.max(peak, Math.abs(left[frame]), Math.abs(right[frame]))
}

const targetPeak = 0.72
const normalization = peak > 0 ? Math.min(1, targetPeak / peak) : 1
const bytesPerSample = BITS_PER_SAMPLE / 8
const dataSize = FRAME_COUNT * CHANNELS * bytesPerSample
const wav = Buffer.alloc(44 + dataSize)

wav.write('RIFF', 0)
wav.writeUInt32LE(36 + dataSize, 4)
wav.write('WAVE', 8)
wav.write('fmt ', 12)
wav.writeUInt32LE(16, 16)
wav.writeUInt16LE(1, 20)
wav.writeUInt16LE(CHANNELS, 22)
wav.writeUInt32LE(SAMPLE_RATE, 24)
wav.writeUInt32LE(SAMPLE_RATE * CHANNELS * bytesPerSample, 28)
wav.writeUInt16LE(CHANNELS * bytesPerSample, 32)
wav.writeUInt16LE(BITS_PER_SAMPLE, 34)
wav.write('data', 36)
wav.writeUInt32LE(dataSize, 40)

for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
  const offset = 44 + frame * CHANNELS * bytesPerSample
  const leftSample = Math.round(
    Math.max(-1, Math.min(1, left[frame] * normalization)) * 32_767,
  )
  const rightSample = Math.round(
    Math.max(-1, Math.min(1, right[frame] * normalization)) * 32_767,
  )

  wav.writeInt16LE(leftSample, offset)
  wav.writeInt16LE(rightSample, offset + bytesPerSample)
}

mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
writeFileSync(OUTPUT_PATH, wav)

console.log(
  `Generated ${OUTPUT_PATH} (${DURATION_SECONDS.toFixed(3)}s, ${(
    wav.length /
    1024 /
    1024
  ).toFixed(2)} MiB)`,
)
