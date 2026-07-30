# DJ DOCHI Formant Character Voice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current electronic voice grain with a louder, rounded, formant-shaped creature mumble while preserving dialogue timing and all product flows.

**Architecture:** Keep the existing deterministic cadence and Web Audio engine boundary. Generate a glottal-style excitation buffer once, shape each playback through three parallel formant filters, then protect the louder output with low-pass filtering and compression. Pass terminal-character metadata from `DialogueBox` so the last spoken grain can be longer without changing typewriter timing.

**Tech Stack:** React 19, TypeScript, Web Audio API, Vitest, Testing Library

## Global Constraints

- Do not change OCR, taste analysis, recommendation, LP, camera, or result behavior.
- Do not change the 32ms typewriter delay.
- Keep the existing 2–3 valid-character cadence and ignore whitespace and punctuation.
- Default voice duration is about 110ms; the terminal voice is about 140ms.
- Target perceived volume is about 1.7 times the current voice with compression for peak safety.
- Keep one shared timbre and apply only subtle emotion-dependent pitch and speed changes.
- Do not add recorded or third-party audio assets.
- Do not commit, push, or deploy this work.

---

### Task 1: Playback metadata and deterministic duration

**Files:**
- Modify: `src/audio/dochiVoiceConfig.ts`
- Modify: `src/audio/dochiVoiceProfiles.ts`
- Modify: `src/audio/dochiVoiceProfiles.test.ts`

**Interfaces:**
- Consumes: `getDochiVoicePlayback(emotion, dialogueKey, characterIndex, isTerminal)`
- Produces: `DochiVoicePlayback` with `playbackRate`, `detuneCents`, `durationSeconds`, and `formantScale`

- [ ] **Step 1: Write failing profile tests**

Add assertions that normal grains stay within 100–120ms, terminal grains stay within 130–150ms, variation is deterministic, and `formantScale` stays within 0.97–1.03.

```ts
const normal = getDochiVoicePlayback('neutral', 'intro-0', 3, false)
const terminal = getDochiVoicePlayback('neutral', 'intro-0', 3, true)

expect(normal.durationSeconds).toBeGreaterThanOrEqual(0.1)
expect(normal.durationSeconds).toBeLessThanOrEqual(0.12)
expect(terminal.durationSeconds).toBeGreaterThanOrEqual(0.13)
expect(terminal.durationSeconds).toBeLessThanOrEqual(0.15)
expect(terminal.durationSeconds).toBeGreaterThan(normal.durationSeconds)
expect(normal.formantScale).toBeGreaterThanOrEqual(0.97)
expect(normal.formantScale).toBeLessThanOrEqual(1.03)
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `rtk pnpm test -- src/audio/dochiVoiceProfiles.test.ts`

Expected: FAIL because the playback result does not yet expose duration or formant values.

- [ ] **Step 3: Add configurable voice values**

Replace the current synthesis settings with explicit base/terminal durations, maximum buffer duration, louder master gain, three formants, low-pass frequency, compressor values, and separate pitch/duration/formant variation ranges.

```ts
synthesis: {
  baseDurationSeconds: 0.11,
  terminalDurationSeconds: 0.14,
  maxBufferDurationSeconds: 0.16,
  baseFrequencyHz: 154,
  masterGain: 0.072,
  formants: [
    { frequencyHz: 430, q: 4.2, gain: 1 },
    { frequencyHz: 820, q: 5.2, gain: 0.72 },
    { frequencyHz: 2_180, q: 7.5, gain: 0.18 },
  ],
  lowpassFrequencyHz: 2_900,
  compressor: {
    threshold: -24,
    knee: 16,
    ratio: 4,
    attack: 0.003,
    release: 0.06,
  },
}
```

Use deterministic hashes to apply approximately ±22 cents pitch, ±7% duration, and ±3% formant variation.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `rtk pnpm test -- src/audio/dochiVoiceProfiles.test.ts`

Expected: PASS.

### Task 2: Glottal excitation and formant audio graph

**Files:**
- Modify: `src/audio/dochiVoiceEngine.ts`
- Modify: `src/audio/dochiVoiceEngine.test.ts`
- Modify: `src/hooks/useDochiVoice.test.tsx`

**Interfaces:**
- Consumes: `DochiVoicePlayback`
- Produces: `createDochiVoiceSamples(sampleRate)` and `DochiVoiceEngine.play(playback)`

- [ ] **Step 1: Write failing synthesis and graph tests**

Update the sample test for a 160ms deterministic buffer with a smooth envelope and add fake Web Audio nodes that assert three `bandpass` filters and one compressor are created.

```ts
expect(first.length).toBe(Math.round(48_000 * 0.16))
expect(context.filters.filter((filter) => filter.type === 'bandpass')).toHaveLength(3)
expect(context.compressors).toHaveLength(1)
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `rtk pnpm test -- src/audio/dochiVoiceEngine.test.ts src/hooks/useDochiVoice.test.tsx`

Expected: FAIL because the current engine creates one low-pass filter and no compressor.

- [ ] **Step 3: Generate a rounded voiced excitation**

Generate a deterministic low-frequency glottal pulse with a softened harmonic stack, approximately 12–18% low-passed breath noise, a short attack, and mild saturation. Avoid a dominant clean sine or triangle tone.

```ts
const glottalPulse = (
  Math.sin(phase)
  + 0.42 * Math.sin(phase * 2 + 0.16)
  + 0.2 * Math.sin(phase * 3 + 0.31)
  + 0.09 * Math.sin(phase * 4 + 0.48)
) / 1.71
const excitation = glottalPulse * 0.84 + softenedNoise * 0.16
```

- [ ] **Step 4: Build the formant graph**

Connect the source to three band-pass branches, apply per-formant gains and `playback.formantScale`, merge through a low-pass filter, then connect a compressor and the master gain. Schedule gain release using `playback.durationSeconds`, stop the source after the release, and disconnect all created nodes on completion.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `rtk pnpm test -- src/audio/dochiVoiceEngine.test.ts src/hooks/useDochiVoice.test.tsx`

Expected: PASS.

### Task 3: Terminal syllable detection and integration

**Files:**
- Modify: `src/audio/dochiVoiceCadence.ts`
- Modify: `src/audio/dochiVoiceCadence.test.ts`
- Modify: `src/hooks/useDochiVoice.ts`
- Modify: `src/hooks/useDochiVoice.test.tsx`
- Modify: `src/components/DialogueBox.tsx`
- Modify: `src/components/DialogueBox.test.tsx`

**Interfaces:**
- Consumes: `onCharacterReveal(character, index, { isTerminal })`
- Produces: a forced final valid-character voice with terminal duration, without replaying an index

- [ ] **Step 1: Write failing cadence and dialogue tests**

Add coverage that the last letter before punctuation is marked terminal, a terminal letter is played even when the regular gap is not due, punctuation remains silent, and the reveal callback receives terminal metadata.

```ts
expect(onCharacterReveal.mock.calls).toEqual([
  ['엇', 0, { isTerminal: true }],
  ['?', 1, { isTerminal: false }],
])
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `rtk pnpm test -- src/audio/dochiVoiceCadence.test.ts src/components/DialogueBox.test.tsx src/hooks/useDochiVoice.test.tsx`

Expected: FAIL because terminal metadata is not yet passed or handled.

- [ ] **Step 3: Implement terminal metadata without changing timing**

Compute the last valid letter index once per `line` in `DialogueBox`, pass `{ isTerminal }` to the reveal callback, let cadence force one playback at that terminal index, and pass the flag into `getDochiVoicePlayback`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `rtk pnpm test -- src/audio/dochiVoiceCadence.test.ts src/components/DialogueBox.test.tsx src/hooks/useDochiVoice.test.tsx`

Expected: PASS.

### Task 4: Regression verification and local listening

**Files:**
- No product file changes expected

**Interfaces:**
- Consumes: completed voice implementation
- Produces: a running local frontend for manual listening

- [ ] **Step 1: Run all tests once**

Run: `rtk pnpm test`

Expected: all existing and new tests pass.

- [ ] **Step 2: Run TypeScript once**

Run: `rtk pnpm exec tsc --noEmit`

Expected: exit code 0.

- [ ] **Step 3: Run production build once**

Run: `rtk pnpm build`

Expected: exit code 0.

- [ ] **Step 4: Start or reuse the local Vite listening server**

Run: `rtk pnpm dev --host 127.0.0.1 --port 5178`

Expected: the app is available locally; this frontend-only server is for voice listening and does not provide Vercel API functions.

- [ ] **Step 5: Manual browser checks**

Verify that a user gesture unlocks audio, dialogue playback uses the new formant voice, SFX off stops playback, clicking to reveal stops the current grain, and no console errors occur. Note that real iOS Safari hardware playback requires the user to open the local network URL and tap the character before audio can start.
