# DJ DOCHI Browser OCR Extraction Adapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make local browser OCR the default playlist screenshot extractor while preserving the existing OpenAI Vision function as an explicit auxiliary adapter.

**Architecture:** `useDjDochiFlow` continues to call one provider-neutral facade. A factory resolves either a lazy Tesseract.js browser adapter or the existing HTTP-based Vision adapter; both return the existing validated `PlaylistExtractionResult`. Positioned OCR words are converted to rows by deterministic Apple Music and generic parsers before the current editable review panel and LP flow continue.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Vitest 4, Tesseract.js 7, Zod 4, Vercel Functions, OpenAI Node SDK

## Global Constraints

- Browser OCR is the hard-coded default and must not require `OPENAI_API_KEY`.
- OpenAI Vision runs only after the user explicitly selects the auxiliary retry.
- Accept PNG, JPG/JPEG, and WEBP only, up to 4 MiB.
- Do not persist images or log image bytes, Base64, or full OCR text.
- Preserve `PlaylistExtractionResult`, the editable review behavior, LP interaction, camera flow, and dummy final mix.
- Keep all OpenAI SDK imports under `api/`; none may enter the Vite browser dependency graph.
- Use one lazy Korean/English Tesseract worker and serialize recognition requests.
- Use TDD for each behavior change and commit each independently reviewable task.

## File Map

### New files

- `src/services/extraction/types.ts`: provider IDs, progress, extractor contract, OCR document types.
- `src/services/extraction/normalizeExtraction.ts`: shared trimming, confidence clamping, deduplication, ID assignment, and empty warnings.
- `src/services/extraction/parseOcrDocument.ts`: source detection, row grouping, Apple Music parsing, and generic fallback.
- `src/services/extraction/tesseractOcrEngine.ts`: lazy Tesseract worker lifecycle and output flattening.
- `src/services/extraction/browserOcrExtractor.ts`: local file validation, OCR, parsing, cancellation, and error mapping.
- `src/services/extraction/openaiVisionExtractor.ts`: existing multipart API client wrapped in the common contract.
- `src/services/extraction/createPlaylistExtractor.ts`: provider registry and constructor.
- Focused `.test.ts` files beside each new behavior.

### Modified files

- `src/types/playlistAnalysis.ts`: add OCR/provider error codes.
- `src/services/playlistAnalysis.ts`: become the stable provider-neutral facade.
- `src/services/playlistAnalysis.test.ts`: assert browser OCR default and provider selection.
- `src/hooks/useDjDochiFlow.ts`: store active extractor/progress and expose explicit Vision retry.
- `src/hooks/useDjDochiFlow.test.ts`: verify default and explicit auxiliary paths.
- `src/components/PlaylistExtractionReview.tsx`: identify extraction method and offer optional Vision retry.
- `src/components/PlaylistExtractionReview.test.tsx`: verify labels and callbacks.
- `src/components/DochiRoom.tsx`: pass provider metadata/actions and show progress copy.
- `src/styles/dj-dochi.css`: compact provider badge and auxiliary action styling.
- `package.json`, `pnpm-lock.yaml`: add `tesseract.js`.
- `docs/playlist-extraction-verification.md`: record local two-image verification without image payloads.

---

### Task 1: Common extractor contract and result normalization

**Files:**

- Create: `src/services/extraction/types.ts`
- Create: `src/services/extraction/normalizeExtraction.ts`
- Create: `src/services/extraction/normalizeExtraction.test.ts`
- Modify: `src/types/playlistAnalysis.ts`

**Interfaces:**

- Produces: `PlaylistExtractorId`, `ExtractionProgress`, `ExtractPlaylistOptions`, `PlaylistExtractor`, `OcrWord`, `OcrDocument`, `BrowserOcrEngine`.
- Produces: `normalizeExtraction(input: UnnormalizedExtraction): PlaylistExtractionResult`.
- Extends: `PlaylistAnalysisErrorCode` with `OCR_ENGINE_FAILED`, `OCR_RECOGNITION_FAILED`, `NO_TRACKS_FOUND`, and `PROVIDER_UNAVAILABLE`.

- [ ] **Step 1: Write normalization tests**

Create table-driven tests that pass whitespace-heavy, duplicated, and out-of-range rows:

```ts
const result = normalizeExtraction({
  sourceApp: ' Apple Music ',
  tracks: [
    { title: ' Ditto ', artist: ' NewJeans ', album: '', confidence: 1.2 },
    { title: 'ditto', artist: 'newjeans', album: 'duplicate', confidence: 0.4 },
    { title: 'OMG', artist: '', album: '', confidence: -1 },
  ],
  warnings: [],
})

expect(result).toEqual({
  sourceApp: 'Apple Music',
  tracks: [{
    id: 'track-001',
    title: 'Ditto',
    artist: 'NewJeans',
    album: '',
    confidence: 1,
  }],
  warnings: [],
})
```

Also assert that no complete rows produces `tracks: []` and exactly one actionable Korean warning.

- [ ] **Step 2: Run the focused test and verify red**

Run:

```bash
pnpm vitest run src/services/extraction/normalizeExtraction.test.ts
```

Expected: failure because `normalizeExtraction` and extraction contract modules do not exist.

- [ ] **Step 3: Add the common types**

Define:

```ts
export type PlaylistExtractorId = 'browser-ocr' | 'openai-vision'

export type ExtractionProgress = {
  phase: 'loading-engine' | 'recognizing' | 'parsing'
  value: number | null
}

export type ExtractPlaylistOptions = {
  signal?: AbortSignal
  onProgress?: (progress: ExtractionProgress) => void
}

export interface PlaylistExtractor {
  readonly id: PlaylistExtractorId
  extract(file: File, options?: ExtractPlaylistOptions): Promise<PlaylistExtractionResult>
}

export type OcrWord = {
  text: string
  confidence: number
  box: { x0: number; y0: number; x1: number; y1: number }
}

export type OcrDocument = {
  width: number
  height: number
  words: OcrWord[]
  fullText: string
}
```

Add `BrowserOcrEngine.recognize(file, options)` using the same `signal` and `onProgress` option fields.

- [ ] **Step 4: Implement shared normalization**

Implement `UnnormalizedExtraction` without IDs, normalize NFC/whitespace, require both title and artist, clamp confidence, remove case-insensitive duplicate pairs, assign `track-${String(index + 1).padStart(3, '0')}`, and add:

```ts
'곡명과 아티스트가 함께 보이는 항목을 찾지 못했어요.'
```

only when no complete rows and no equivalent warning already exists.

- [ ] **Step 5: Run the focused test and type check**

Run:

```bash
pnpm vitest run src/services/extraction/normalizeExtraction.test.ts
pnpm exec tsc -b --pretty false
```

Expected: normalization tests pass and TypeScript reports zero errors.

- [ ] **Step 6: Commit the contract**

```bash
git add src/services/extraction/types.ts src/services/extraction/normalizeExtraction.ts src/services/extraction/normalizeExtraction.test.ts src/types/playlistAnalysis.ts
git commit -m "refactor: add playlist extraction adapter contract"
```

### Task 2: Position-aware deterministic OCR parser

**Files:**

- Create: `src/services/extraction/parseOcrDocument.ts`
- Create: `src/services/extraction/parseOcrDocument.test.ts`

**Interfaces:**

- Consumes: `OcrDocument`, `normalizeExtraction`.
- Produces: `parseOcrDocument(document: OcrDocument): PlaylistExtractionResult`.

- [ ] **Step 1: Write Apple Music parser tests**

Build a `1600 × 1200` synthetic OCR document with header and row words at representative coordinates:

```ts
const words = [
  word('노래', 70, 60, 120, 90),
  word('아티스트', 710, 60, 800, 90),
  word('앨범', 1010, 60, 1060, 90),
  word('시간', 1280, 60, 1330, 90),
  word('Your Dog Loves You (feat. Crush)', 168, 150, 610, 180),
  word('Colde', 710, 150, 780, 180),
  word('4:33', 1280, 150, 1335, 180),
  word('Car Crash', 168, 260, 300, 290),
  word('eaJ', 710, 260, 755, 290),
  word('3:06', 1280, 260, 1335, 290),
]
```

Assert `sourceApp === 'Apple Music'`, two distinct rows, correct title/artist pairing, blank albums, and no header/duration tracks.

- [ ] **Step 2: Write generic and defensive parser tests**

Cover:

- English title/artist rows separated by a large horizontal gap;
- Korean title/artist rows;
- album and duration trailing columns;
- low-confidence ellipses and icon noise;
- duplicated rows;
- adjacent rows that must never be cross-paired;
- a no-track document returning an empty result and warning.

- [ ] **Step 3: Run parser tests and verify red**

Run:

```bash
pnpm vitest run src/services/extraction/parseOcrDocument.test.ts
```

Expected: failure because `parseOcrDocument` does not exist.

- [ ] **Step 4: Implement row grouping**

Normalize words, discard confidence below `20`, blank values, `•••`, `...`, and duration-only values. Calculate median word height, then group words whose vertical centers differ by no more than:

```ts
Math.max(8, medianHeight * 0.65)
```

Sort rows top-to-bottom and words left-to-right. Preserve each row's minimum/maximum bounds and median confidence.

- [ ] **Step 5: Implement source detection and parsers**

Detect Apple Music when at least three normalized header labels from `노래`, `아티스트`, `앨범`, `시간`, `song`, `artist`, `album`, `time` appear near the top 20% of the image.

For Apple Music rows, join words in normalized x ranges:

```ts
const TITLE_RANGE = [0.08, 0.45]
const ARTIST_RANGE = [0.45, 0.67]
const ALBUM_RANGE = [0.67, 0.90]
```

For generic rows, split at the largest gap that is at least `Math.max(36, medianHeight * 2.2)`, require text on both sides, and reject header or duration groups. Pass candidates to `normalizeExtraction`.

- [ ] **Step 6: Run parser tests and inspect output**

Run:

```bash
pnpm vitest run src/services/extraction/parseOcrDocument.test.ts
```

Expected: every synthetic layout passes and no row contains a header or duration as title/artist.

- [ ] **Step 7: Commit deterministic parsing**

```bash
git add src/services/extraction/parseOcrDocument.ts src/services/extraction/parseOcrDocument.test.ts
git commit -m "feat: parse positioned playlist OCR text"
```

### Task 3: Lazy browser OCR engine and browser adapter

**Files:**

- Create: `src/services/extraction/tesseractOcrEngine.ts`
- Create: `src/services/extraction/tesseractOcrEngine.test.ts`
- Create: `src/services/extraction/browserOcrExtractor.ts`
- Create: `src/services/extraction/browserOcrExtractor.test.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: `createWorker(['kor', 'eng'])`, image validator, `parseOcrDocument`.
- Produces: `createTesseractOcrEngine(): BrowserOcrEngine`.
- Produces: `createBrowserOcrExtractor(engine?: BrowserOcrEngine): PlaylistExtractor`.

- [ ] **Step 1: Add Tesseract.js**

Run:

```bash
pnpm add tesseract.js@^7.0.0
```

Expected: `package.json` and `pnpm-lock.yaml` contain Tesseract.js 7-compatible entries.

- [ ] **Step 2: Write browser adapter tests with a fake engine**

Use an injected engine:

```ts
const engine: BrowserOcrEngine = {
  recognize: vi.fn().mockResolvedValue(APPLE_MUSIC_DOCUMENT),
}
const extractor = createBrowserOcrExtractor(engine)
const result = await extractor.extract(validPng, { onProgress })
```

Assert:

- `extractor.id === 'browser-ocr'`;
- invalid MIME types fail before `recognize`;
- OCR output is parsed into tracks;
- an already-aborted signal throws an abort-like error without invoking OCR;
- engine failure maps to `OCR_RECOGNITION_FAILED`;
- progress emits `loading-engine`/`recognizing` from the engine and `parsing` from the adapter.

- [ ] **Step 3: Run browser adapter tests and verify red**

Run:

```bash
pnpm vitest run src/services/extraction/browserOcrExtractor.test.ts
```

Expected: failure because the browser adapter does not exist.

- [ ] **Step 4: Implement the browser adapter**

Validate the image, emit `{ phase: 'parsing', value: null }` before parsing, preserve `PlaylistAnalysisError`, map other failures to:

```ts
new PlaylistAnalysisError({
  code: 'OCR_RECOGNITION_FAILED',
  message: '이 기기에서 이미지를 읽지 못했어요. 다시 시도해주세요.',
  retryable: true,
})
```

Return the parsed common result even when it has zero rows so the existing empty review UI can offer alternate input.

- [ ] **Step 5: Write Tesseract output-flattening tests**

Mock `createWorker` with a worker whose `recognize()` returns nested blocks, paragraphs, lines, and words. Assert:

- worker creation occurs only on first recognition;
- language input contains `kor` and `eng`;
- sequential calls reuse one worker;
- nested word boxes and confidence become `OcrWord[]`;
- progress status `loading tesseract core` maps to `loading-engine`;
- progress status `recognizing text` maps to `recognizing`;
- blocks output is requested explicitly.

- [ ] **Step 6: Implement the lazy serialized worker**

Use module-local worker and promise references. Load with `createWorker(['kor', 'eng'], undefined, { logger })`, call:

```ts
worker.recognize(file, {}, { blocks: true, text: true })
```

Chain recognition on one queue promise and recover the queue after rejection so a failed image does not block later retries. Flatten nested words and derive document width/height from the OCR page/block dimensions or maximum word bounds.

- [ ] **Step 7: Run focused OCR tests**

Run:

```bash
pnpm vitest run src/services/extraction/browserOcrExtractor.test.ts src/services/extraction/tesseractOcrEngine.test.ts
```

Expected: both files pass without downloading language data because the worker is mocked.

- [ ] **Step 8: Commit browser OCR**

```bash
git add package.json pnpm-lock.yaml src/services/extraction/tesseractOcrEngine.ts src/services/extraction/tesseractOcrEngine.test.ts src/services/extraction/browserOcrExtractor.ts src/services/extraction/browserOcrExtractor.test.ts
git commit -m "feat: extract playlists with browser OCR"
```

### Task 4: Preserve Vision behind the common adapter and switch the default

**Files:**

- Create: `src/services/extraction/openaiVisionExtractor.ts`
- Create: `src/services/extraction/openaiVisionExtractor.test.ts`
- Create: `src/services/extraction/createPlaylistExtractor.ts`
- Create: `src/services/extraction/createPlaylistExtractor.test.ts`
- Modify: `src/services/playlistAnalysis.ts`
- Modify: `src/services/playlistAnalysis.test.ts`

**Interfaces:**

- Produces: `createOpenAiVisionExtractor(deps?): PlaylistExtractor`.
- Produces: `createPlaylistExtractor(id, deps?): PlaylistExtractor`.
- Preserves: `extractPlaylistFromImage(file, options?): Promise<PlaylistExtractionResult>`.
- Adds: `extractPlaylistFromImage(file, { extractorId, signal, onProgress }): Promise<PlaylistExtractionResult>`.

- [ ] **Step 1: Move existing HTTP behavior tests to the Vision adapter**

Keep assertions for multipart `image`, `/api/extract-playlist`, timeout, network failure, malformed JSON, and structured API errors. Add `expect(extractor.id).toBe('openai-vision')`.

- [ ] **Step 2: Write factory and facade tests**

Assert:

```ts
expect(createPlaylistExtractor().id).toBe('browser-ocr')
expect(createPlaylistExtractor('browser-ocr').id).toBe('browser-ocr')
expect(createPlaylistExtractor('openai-vision').id).toBe('openai-vision')
```

Assert an unsupported ID throws `PROVIDER_UNAVAILABLE`. Inject fake factories into facade tests and prove an omitted `extractorId` invokes browser OCR while explicit `openai-vision` invokes only the remote adapter.

- [ ] **Step 3: Run focused tests and verify red**

Run:

```bash
pnpm vitest run src/services/extraction/openaiVisionExtractor.test.ts src/services/extraction/createPlaylistExtractor.test.ts src/services/playlistAnalysis.test.ts
```

Expected: failures because the adapter and factory are not implemented and the facade still always posts to the API.

- [ ] **Step 4: Extract the existing HTTP client**

Move the current browser HTTP implementation unchanged into `createOpenAiVisionExtractor()`. Replace direct `window.setTimeout` with `globalThis.setTimeout`/`clearTimeout` so the adapter remains testable. Keep all existing response validation.

- [ ] **Step 5: Implement the provider factory**

Use a strict switch:

```ts
export function createPlaylistExtractor(
  id: PlaylistExtractorId = 'browser-ocr',
  dependencies: PlaylistExtractorDependencies = {},
): PlaylistExtractor {
  if (id === 'browser-ocr') return createBrowserOcrExtractor(dependencies.ocrEngine)
  if (id === 'openai-vision') return createOpenAiVisionExtractor(dependencies.vision)
  throw providerUnavailable(id)
}
```

No environment variable may change the default.

- [ ] **Step 6: Convert the existing service to a facade**

Extend options with `extractorId?: PlaylistExtractorId` and optional test-only factory injection. Validate the file once, resolve the extractor, and delegate while preserving signal/progress.

- [ ] **Step 7: Prove OpenAI stays out of the browser graph**

Run:

```bash
pnpm vitest run src/services/extraction/openaiVisionExtractor.test.ts src/services/extraction/createPlaylistExtractor.test.ts src/services/playlistAnalysis.test.ts
rtk rg "from ['\\\"]openai['\\\"]" src
```

Expected: all tests pass and `rg` returns no matches under `src`.

- [ ] **Step 8: Commit provider selection**

```bash
git add src/services/extraction/openaiVisionExtractor.ts src/services/extraction/openaiVisionExtractor.test.ts src/services/extraction/createPlaylistExtractor.ts src/services/extraction/createPlaylistExtractor.test.ts src/services/playlistAnalysis.ts src/services/playlistAnalysis.test.ts
git commit -m "refactor: preserve vision as optional extractor"
```

### Task 5: Flow and room controls for explicit auxiliary retry

**Files:**

- Modify: `src/hooks/useDjDochiFlow.ts`
- Modify: `src/hooks/useDjDochiFlow.test.ts`
- Modify: `src/components/PlaylistExtractionReview.tsx`
- Modify: `src/components/PlaylistExtractionReview.test.tsx`
- Modify: `src/components/DochiRoom.tsx`
- Modify: `src/styles/dj-dochi.css`

**Interfaces:**

- Adds flow fields: `activeExtractorId`, `extractionProgress`.
- Changes action: `retryExtraction(extractorId?: PlaylistExtractorId): void`.
- Adds review props: `extractorId`, `onRetryWithVision`.

- [ ] **Step 1: Write flow tests first**

Assert initial image handoff calls:

```ts
extractPlaylistFromImage(file, expect.objectContaining({
  extractorId: 'browser-ocr',
  signal: expect.any(AbortSignal),
  onProgress: expect.any(Function),
}))
```

Then force OCR failure, call `retryExtraction('openai-vision')`, and assert the second call uses the Vision ID. Also assert a plain retry reuses the current ID and restart clears the ID/progress.

- [ ] **Step 2: Write review UI tests first**

Assert browser results display `기기에서 읽음`, Vision results display `AI Vision으로 읽음`, and the optional button `AI Vision으로 다시 읽기` invokes only `onRetryWithVision`. Keep `이미지 다시 분석` bound to the current provider.

- [ ] **Step 3: Run hook and component tests and verify red**

Run:

```bash
pnpm vitest run src/hooks/useDjDochiFlow.test.ts src/components/PlaylistExtractionReview.test.tsx
```

Expected: failures for the missing provider/progress fields and Vision retry callback.

- [ ] **Step 4: Store provider and progress in the hook**

`beginExtraction(file, extractorId = 'browser-ocr')` sets the active ID, resets progress, and forwards:

```ts
onProgress: (progress) => {
  if (extractionControllerRef.current === controller) {
    setExtractionProgress(progress)
  }
}
```

Clear progress on success, error, restart, and input-mode changes. Preserve abort-controller and object-URL behavior.

- [ ] **Step 5: Add explicit auxiliary UI**

Add a compact method badge to the review header. Show `AI Vision으로 다시 읽기` only when the active extractor is `browser-ocr`. In the error panel, expose the same explicit auxiliary action next to local retry and alternate input actions. Include copy that this option sends the image for server analysis.

- [ ] **Step 6: Render meaningful progress**

Map:

```ts
'loading-engine' -> '글자를 읽을 준비 중...'
'recognizing' -> '곡 이름을 읽는 중...'
'parsing' -> '곡명과 아티스트를 정리하는 중...'
```

in the fixed room status area. Keep the room and Dochi mounted.

- [ ] **Step 7: Run focused and room tests**

Run:

```bash
pnpm vitest run src/hooks/useDjDochiFlow.test.ts src/components/PlaylistExtractionReview.test.tsx src/App.test.tsx
```

Expected: provider selection, existing editing, and room rendering tests all pass.

- [ ] **Step 8: Commit the explicit fallback UX**

```bash
git add src/hooks/useDjDochiFlow.ts src/hooks/useDjDochiFlow.test.ts src/components/PlaylistExtractionReview.tsx src/components/PlaylistExtractionReview.test.tsx src/components/DochiRoom.tsx src/styles/dj-dochi.css
git commit -m "feat: add explicit vision extraction fallback"
```

### Task 6: Real-image verification and full regression

**Files:**

- Create: `docs/playlist-extraction-verification.md`
- Modify only implementation files needed to correct failures found by the listed checks.

**Interfaces:**

- Produces: evidence that two different screenshots generate two different editable lists through browser OCR without an API key.

- [ ] **Step 1: Run all automated tests**

Run:

```bash
pnpm test
```

Expected: zero failing Vitest tests.

- [ ] **Step 2: Run TypeScript and production builds**

Run:

```bash
pnpm exec tsc -b --pretty false
pnpm build
```

Expected: zero TypeScript errors and a successful Vite production build.

- [ ] **Step 3: Start the full local app**

Run:

```bash
pnpm dev:vercel
```

Open the reported local URL. Do not provide `OPENAI_API_KEY` for the first verification pass.

- [ ] **Step 4: Verify desktop mouse flow with two images**

For each screenshot:

1. click Dochi and advance the dialogue;
2. choose playlist screenshot upload;
3. select the image and hand it to Dochi;
4. confirm the method badge says `기기에서 읽음`;
5. record extracted title/artist rows and warnings;
6. edit one row, delete one row, add a row, then confirm;
7. verify the LP interaction appears.

Expected: the two images produce different initial row lists and neither request calls `/api/extract-playlist`.

- [ ] **Step 5: Verify mobile pointer layout**

Use a mobile viewport in the browser. Repeat one upload and confirm the OCR progress, review rows, edit controls, and confirmation button remain reachable without horizontal overflow. Confirm the later LP pointer interaction still responds.

- [ ] **Step 6: Verify optional Vision behavior separately**

With no server key, select `AI Vision으로 다시 읽기` and confirm a typed missing-key/upstream error is shown without losing the image or entering the LP flow. If a funded server key is available, verify the same explicit action can return a review result; do not treat Vision availability as a prerequisite for browser OCR success.

- [ ] **Step 7: Record verification evidence**

Create `docs/playlist-extraction-verification.md` with:

- browser and viewport;
- image filenames only;
- source-app detection;
- extracted title/artist rows;
- warnings;
- whether results differed;
- whether `/api/extract-playlist` was called;
- automated commands and exit status.

Do not include image bytes, Base64, API keys, or full OCR debug text.

- [ ] **Step 8: Inspect repository safety**

Run:

```bash
rtk git diff --check
rtk git status --short
rtk rg "OPENAI_API_KEY|data:image/.+base64" src api docs
```

Expected: no whitespace errors, no untracked secrets or generated build output, and no API key value or captured image payload.

- [ ] **Step 9: Commit verification notes**

```bash
git add docs/playlist-extraction-verification.md
git commit -m "test: verify browser playlist extraction"
```
