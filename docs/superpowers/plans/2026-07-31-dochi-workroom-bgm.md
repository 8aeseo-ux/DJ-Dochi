# DJ DOCHI Workroom BGM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an original 78 BPM seamless workroom loop with independent BGM controls, persistent volume, dialogue ducking, and mobile-safe user-gesture playback.

**Architecture:** Render an original 8-bar WAV from a deterministic Node script and load it once through a dedicated Web Audio engine. A React hook owns persistence, page-visibility attenuation, and duck timing. `DochiRoom` only coordinates the existing first click and character reveal callbacks, leaving the dialogue and voice engines unchanged.

**Tech Stack:** React 19, TypeScript, Web Audio API, Node.js PCM WAV renderer, Vitest, Testing Library

## Global Constraints

- Preserve dialogue, OCR, taste analysis, recommendations, LP, camera, and character voice behavior.
- Keep SFX and BGM state, controls, storage keys, and audio engines independent.
- Start BGM only after a user gesture.
- Use only project-authored synthesis and composition; do not download or include third-party audio.
- Render 78 BPM, 4/4, 8 bars, approximately 24.6 seconds.
- Use 44.1kHz, 16-bit stereo PCM WAV.
- Default BGM enabled state is true and default volume is 35%.
- Duck by 6dB with a 90ms attack and 420ms release.
- Lower BGM to 15% of its current level while the document is hidden.
- Do not commit, push, or deploy.

---

### Task 1: Original loop renderer and WAV asset

**Files:**
- Create: `src/audio/bgmAsset.test.ts`
- Create: `scripts/generate-dochi-bgm.mjs`
- Create: `src/assets/audio/dochi-workroom-loop.wav`
- Create: `src/assets/audio/README.md`

**Interfaces:**
- Produces: a stereo PCM WAV with RIFF/WAVE headers, 44,100Hz, 16-bit samples, and duration `32 * 60 / 78` seconds

- [ ] **Step 1: Write a failing WAV contract test**

Read the asset header and assert format, channel count, sample rate, bit depth, duration, non-silence, and a low start/end boundary delta.

```ts
expect(header.channels).toBe(2)
expect(header.sampleRate).toBe(44_100)
expect(header.bitsPerSample).toBe(16)
expect(header.durationSeconds).toBeCloseTo(32 * 60 / 78, 2)
expect(peak).toBeGreaterThan(1_000)
expect(boundaryDelta).toBeLessThan(700)
```

- [ ] **Step 2: Run the asset test and verify RED**

Run: `rtk pnpm exec vitest run src/audio/bgmAsset.test.ts`

Expected: FAIL because the WAV asset does not exist.

- [ ] **Step 3: Add the deterministic renderer**

Create a Node script that schedules:

- four two-bar chord regions using a warm major/pentatonic progression
- a sparse 3–4 note toy-mallet motif
- a rounded sine-based bass on beats 0 and 2
- quiet wood clicks and soft brushed noise without strong kick or snare
- a short final rest so both loop boundaries approach zero

The script writes little-endian PCM with a peak below 0.82 and no external samples.

- [ ] **Step 4: Render the WAV and add provenance**

Run: `rtk env PATH="<bundled-node-path>:$PATH" node scripts/generate-dochi-bgm.mjs`

Document that the melody, harmony, rhythm, synthesis, and renderer are created for DJ DOCHI and use no third-party audio.

- [ ] **Step 5: Run the asset test and verify GREEN**

Run: `rtk pnpm exec vitest run src/audio/bgmAsset.test.ts`

Expected: PASS.

### Task 2: BGM Web Audio engine

**Files:**
- Create: `src/audio/bgmConfig.ts`
- Create: `src/audio/bgmEngine.ts`
- Create: `src/audio/bgmEngine.test.ts`

**Interfaces:**
- Produces: `BgmEngine`
- Methods: `unlockAndStart(url)`, `setEnabled(enabled)`, `setVolume(volume)`, `duck()`, `releaseDuck()`, `setHidden(hidden)`, `dispose()`

- [ ] **Step 1: Write failing engine tests**

Use a fake AudioContext and fetch implementation to assert:

- no source before `unlockAndStart`
- one source for concurrent and repeated starts
- `source.loop === true`
- independent user, duck, and visibility gain ramps
- disabled volume reaches zero without stopping the source
- decode/load failure resolves safely and can retry on the next explicit start

- [ ] **Step 2: Run the engine tests and verify RED**

Run: `rtk pnpm exec vitest run src/audio/bgmEngine.test.ts`

Expected: FAIL because the engine does not exist.

- [ ] **Step 3: Implement the minimal audio graph**

```text
source(loop)
  → user gain
  → duck gain
  → visibility gain
  → destination
```

Use exponential or linear gain ramps with values from `bgmConfig.ts`, guard creation with a shared start Promise, and support `webkitAudioContext`.

- [ ] **Step 4: Run the engine tests and verify GREEN**

Run: `rtk pnpm exec vitest run src/audio/bgmEngine.test.ts`

Expected: PASS.

### Task 3: Persistent background-music hook

**Files:**
- Create: `src/hooks/useBackgroundMusic.ts`
- Create: `src/hooks/useBackgroundMusic.test.tsx`

**Interfaces:**
- Produces: `{ enabled, volume, unlockAndStart, toggle, setVolume, pulseDuck, releaseDuck }`
- Storage: `dj-dochi:bgm-enabled`, `dj-dochi:bgm-volume`

- [ ] **Step 1: Write failing hook tests**

Assert default enabled/35%, persistence, independent SFX storage, one start call, duck hold refresh, release after the configured delay, and hidden/visible forwarding.

- [ ] **Step 2: Run the hook tests and verify RED**

Run: `rtk pnpm exec vitest run src/hooks/useBackgroundMusic.test.tsx`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement the hook**

Create one engine per mount, clamp stored volume to 0–1, attach one `visibilitychange` listener, refresh the duck release timer on each character pulse, and dispose engine and timers on unmount.

- [ ] **Step 4: Run the hook tests and verify GREEN**

Run: `rtk pnpm exec vitest run src/hooks/useBackgroundMusic.test.tsx`

Expected: PASS.

### Task 4: Independent BGM control and room integration

**Files:**
- Create: `src/components/BgmControl.tsx`
- Create: `src/components/BgmControl.test.tsx`
- Modify: `src/components/DochiRoom.tsx`
- Modify: `src/styles/sketch-theme.css`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: background-music hook state and actions
- Produces: separate note-icon toggle and anchored volume popover without moving the room or dialogue layout

- [ ] **Step 1: Write failing component and integration tests**

Assert:

- note icon has `배경음악 끄기/켜기` labels distinct from SFX
- volume slider is labeled `배경음악 볼륨`
- first Dochi click unlocks voice and starts BGM
- character reveal triggers both voice playback and a BGM duck pulse
- BGM toggle does not change `dj-dochi:sfx-enabled`

- [ ] **Step 2: Run focused UI tests and verify RED**

Run: `rtk pnpm exec vitest run src/components/BgmControl.test.tsx src/App.test.tsx`

Expected: FAIL because the control and integration do not exist.

- [ ] **Step 3: Implement the compact control**

Add a music-note button beside the speaker button and an absolute, focusable slider popover. Reuse existing sketch theme colors and line treatment. Do not alter stage dimensions.

- [ ] **Step 4: Integrate playback and ducking**

In `DochiRoom`, call both `voice.unlock()` and `bgm.unlockAndStart()` from the existing first character click. Wrap `onCharacterReveal` to call the existing voice callback and `bgm.pulseDuck()`. Wrap typing stop to stop voice and release the duck.

- [ ] **Step 5: Run focused UI tests and verify GREEN**

Run: `rtk pnpm exec vitest run src/components/BgmControl.test.tsx src/App.test.tsx`

Expected: PASS.

### Task 5: Regression verification and local listening

**Files:**
- No additional product changes expected

- [ ] **Step 1: Run the complete test suite**

Run: `rtk pnpm test`

Expected: all tests pass.

- [ ] **Step 2: Run TypeScript**

Run: `rtk pnpm exec tsc --noEmit`

Expected: exit code 0.

- [ ] **Step 3: Run production build**

Run: `rtk pnpm build`

Expected: exit code 0 and the WAV is included in `dist/assets`.

- [ ] **Step 4: Reuse the local listening server**

Use `http://127.0.0.1:5178/`, reload after HMR/build changes, and verify:

- no BGM before a user gesture
- first Dochi click starts the loop
- SFX and BGM toggles are independent
- volume slider changes and persists
- dialogue visibly continues while BGM ducks
- no console errors

- [ ] **Step 5: Report platform limits honestly**

Confirm desktop browser behavior directly. Report that real mobile Safari audio output and background-tab behavior require a physical-device listening pass even though the user-gesture and visibility logic are covered by automated tests.
