# DJ DOCHI Browser OCR Extraction Adapters Design

## Goal

Make playlist screenshot extraction deterministic and local by default. The browser reads visible text with OCR, a rule-based parser converts positioned OCR words into track title and artist rows, and the existing review UI lets the user correct the result before the LP interaction.

The existing OpenAI Vision implementation remains available as an explicit auxiliary adapter. It is not called during the default upload flow.

## Scope

This phase covers:

- a common playlist-extractor contract;
- browser OCR with Korean and English recognition;
- deterministic, position-aware track parsing;
- browser OCR as the default extractor;
- the existing OpenAI Vision endpoint wrapped as an optional remote extractor;
- user-visible retry with either the current extractor or the auxiliary Vision extractor;
- regression tests for the current review and LP handoff.

This phase does not generate a taste profile, recommendations, or a new mixtape. The final result may continue to use the existing dummy mix after the confirmed extraction list enters the LP flow.

## Current Baseline

`useDjDochiFlow.beginExtraction()` calls `extractPlaylistFromImage(file)`. That service always posts the image to `/api/extract-playlist`, and the Vercel function always calls `extractPlaylistWithOpenAI()`. The existing review component, extraction result schemas, image validation, editable rows, and object-URL cleanup are independent of OpenAI and can be reused.

Reusable pieces:

- `PlaylistExtractionResult` and `ExtractedTrack` runtime schemas;
- PNG/JPEG/WEBP and 4 MiB validation;
- controlled `PlaylistExtractionReview`;
- extraction loading, error, retry, and confirmation states;
- server-side Vision response normalization and duplicate removal;
- the current privacy rule that images are not persisted or logged.

Provider-specific pieces:

- the browser service's hard-coded `/api/extract-playlist` call;
- the server route's direct `extractPlaylistWithOpenAI()` call;
- OpenAI request construction, credentials, model selection, and structured-output schema.

## Extraction Boundary

All extraction implementations use one browser-facing contract:

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
  extract(
    file: File,
    options?: ExtractPlaylistOptions,
  ): Promise<PlaylistExtractionResult>
}
```

`extractPlaylistFromImage(file, options)` remains the stable application facade used by `useDjDochiFlow`. It resolves an extractor through `createPlaylistExtractor()` and delegates to it. UI and flow code know only extractor IDs and common results; they never import Tesseract.js, OpenAI, or an API URL.

The default extractor ID is the literal `browser-ocr`. The default is kept in source configuration so a Vercel environment variable cannot silently turn every upload into a paid AI request. The auxiliary provider is selected only by an explicit user action.

## Browser OCR Engine

Tesseract.js 7 runs in a Web Worker and WebAssembly inside the browser. The worker is loaded lazily on the first image extraction with `kor` and `eng` language data. One worker is reused, and recognition requests are serialized so repeated retries do not create competing high-memory workers.

The OCR engine exposes a small internal interface:

```ts
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

export interface BrowserOcrEngine {
  recognize(
    image: File,
    options?: Pick<ExtractPlaylistOptions, 'signal' | 'onProgress'>,
  ): Promise<OcrDocument>
}
```

Tesseract block output is explicitly enabled because non-text layout output is disabled by default in current Tesseract.js versions. Nested blocks, paragraphs, lines, and words are flattened into `OcrWord[]`. Empty words and zero-area boxes are discarded.

Cancellation is best effort: the adapter checks the `AbortSignal` before engine loading, before recognition, and before parsing. A cancelled consumer does not terminate the shared worker while another queued extraction may still need it.

No OCR worker or language data is loaded on the initial DJ room screen. This keeps the first page load and idle interaction unchanged.

## Rule-Based Parsing

Parsing uses text plus geometry and never invents a missing title or artist.

### Normalization

- Unicode text is normalized to NFC.
- Repeated whitespace is collapsed.
- OCR words with blank text or confidence below the noise floor are ignored.
- Obvious duration values such as `3:21`, menu ellipses, and header labels are excluded.
- Rows are grouped by overlapping vertical centers using a tolerance derived from median word height.
- Words inside a row are ordered left to right.

### Source Detection

Header words and recurring controls determine a best-effort `sourceApp`.

- Apple Music indicators include `노래`, `아티스트`, `앨범`, `시간`, and Apple Music-style four-column headers.
- Spotify indicators include `제목`, `앨범`, `추가한 날짜`, and duration-column patterns.
- If the evidence is insufficient, `sourceApp` is `null` and the generic parser is used.

### Apple Music Parser

The parser normalizes each word's horizontal position by image width, ignores the artwork and controls at both edges, then reads:

- title region: approximately 8%–45%;
- artist region: approximately 45%–67%;
- album region: approximately 67%–90%.

The regions are tolerant rather than pixel-specific. Within one grouped row, title and artist words are joined separately. A row is emitted only when both fields are non-empty.

### Generic Parser

The generic parser finds the largest meaningful horizontal gaps within a row. The first text group is treated as the title and the second as the artist only when both groups contain plausible text and their separation exceeds the row-height-based gap threshold. Album and time-like trailing groups are ignored.

If confidence or layout is ambiguous, the parser returns fewer rows and adds warnings. It does not guess an artist from adjacent rows.

### Output Normalization

Both parsers pass through one normalizer that:

- trims text;
- clamps confidence to `0..1`;
- removes case-insensitive duplicate `title + artist` rows;
- assigns deterministic IDs `track-001`, `track-002`, and so on;
- keeps album blank when the parser cannot identify it;
- returns an empty array plus an actionable warning when no complete rows are found.

## OpenAI Vision Auxiliary Adapter

The existing Vercel endpoint remains server-only and keeps:

- `OPENAI_API_KEY` on the server;
- OpenAI request construction;
- strict structured output;
- `store: false`;
- image type and size validation;
- no image persistence or raw-image logging.

The browser-side `openaiVisionExtractor` implements the common contract and delegates to `/api/extract-playlist`. Existing network, timeout, malformed-response, and API errors stay inside this adapter.

The normal path is:

```text
upload -> browser-ocr -> extractionReview
```

When local OCR fails or returns unusable rows, the user may choose:

```text
AI Vision으로 다시 읽기 -> openai-vision -> extractionReview
```

The choice is explicit because it sends the image to the server and may incur API cost. If no server API key or quota is available, the existing typed error is shown and the user can return to browser OCR, choose another image, or paste text.

## Flow Integration

No new full-screen state is required. Existing `extracting`, `extractionReview`, and `extractionError` states remain in the fixed `DochiRoom`.

The flow stores:

- the active extractor ID;
- optional OCR progress;
- the common extraction result;
- the common typed error.

Retry without a provider argument reuses the active extractor. `retryExtraction('openai-vision')` is the explicit auxiliary path. Restart and unmount continue to cancel active work and release preview object URLs.

The review panel displays which method produced the rows:

- `기기에서 읽음` for browser OCR;
- `AI Vision으로 읽음` for the auxiliary adapter.

## Errors

The shared error union adds:

- `OCR_ENGINE_FAILED`: worker or language data could not load;
- `OCR_RECOGNITION_FAILED`: the browser could not read the image;
- `NO_TRACKS_FOUND`: OCR completed but no complete title/artist rows were parsed;
- `PROVIDER_UNAVAILABLE`: an unknown or disabled adapter was requested.

Existing image, timeout, network, malformed response, missing API key, and analysis failures remain valid. Extraction failure never advances to dummy results.

## Privacy and Performance

- Browser OCR keeps image pixels on the user's device.
- OpenAI Vision is used only after explicit selection and retains the existing no-persistence contract.
- Images, Base64 payloads, and OCR full text are not logged.
- OCR language data and worker code load only on first use.
- One worker is reused to limit memory.
- The selected `File` and preview URL retain the existing cleanup lifecycle.
- OCR progress is descriptive; no fake percentage is shown when the engine does not report one.

## Future LLM Boundary

Taste analysis starts only after the user confirms edited tracks. It will use a separate server-only provider contract:

```text
extractionReview
  -> confirmed ExtractedTrack[]
  -> /api/generate-mixtape
  -> LLM provider
  -> validated MixtapeGenerationResult
  -> LP interaction
```

Future server files will be isolated under `api/_lib/llm/`, with `LLM_PROVIDER`, `OPENAI_API_KEY`, and `OPENAI_MODEL` read only on the server. `prompts/dochi-mixtape-guide.md` will own analysis criteria and Dochi's tone. UI and `useDjDochiFlow` will depend on a provider-neutral `MixtapeGenerationResult`, not an OpenAI SDK type.

That LLM layer is deliberately not implemented in this phase.

## Test Strategy

- Contract tests verify every extractor returns the shared result type and maps cancellation/errors consistently.
- Parser tests use positioned synthetic Korean and English OCR words for Apple Music, generic layouts, duplicates, headers, durations, low-confidence noise, and no-track results.
- Browser OCR adapter tests use an injected fake OCR engine, avoiding WebAssembly and network downloads in unit tests.
- Vision adapter tests preserve current multipart, timeout, malformed-response, and API-error coverage.
- Flow tests verify browser OCR is the default and Vision runs only after explicit selection.
- Existing review editing, LP handoff, final mixtape, and room tests remain green.
- Browser verification uses two different playlist screenshots and confirms different editable track lists without an OpenAI key.
- Production verification checks TypeScript, Vitest, and Vite output.

## Migration Sequence

1. Introduce common extractor types, factory, and shared normalization without changing the active provider.
2. Add deterministic parser tests and implementation.
3. Add the lazy Tesseract.js engine and browser OCR adapter behind injected interfaces.
4. Wrap the existing HTTP service as the OpenAI Vision adapter.
5. Change the facade default to browser OCR and expose explicit Vision retry.
6. Verify two real screenshots, then run the full regression and production build.

## Primary References

- [Tesseract.js repository and browser usage](https://github.com/naptha/tesseract.js/)
- [Tesseract.js API](https://github.com/naptha/tesseract.js/blob/master/docs/api.md)
- [Tesseract.js performance guidance](https://github.com/naptha/tesseract.js/blob/master/docs/performance.md)
- [Korean fast language data](https://github.com/tesseract-ocr/tessdata_fast/blob/main/kor.traineddata)
