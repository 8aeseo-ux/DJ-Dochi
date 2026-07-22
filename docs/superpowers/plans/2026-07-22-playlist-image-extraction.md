# DJ DOCHI Playlist Image Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract visible track titles and artists from an uploaded playlist screenshot, let the user correct the list, and continue into the existing LP interaction.

**Architecture:** A browser service sends multipart `FormData` to a Vercel Node Function. `useDjDochiFlow` owns extraction state and editable tracks, while a controlled review component owns only presentation. The server validates the in-memory image, calls OpenAI Responses with image input and strict JSON schema, then normalizes the result.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Vercel Functions, OpenAI Node SDK, Zod

## Global Constraints

- Never expose `OPENAI_API_KEY` through a `VITE_` variable or browser bundle.
- Accept PNG, JPG/JPEG, and WEBP only, up to 4 MiB.
- Do not persist image bytes or log raw image/Base64 content.
- Keep `DUMMY_TRACKS` and `DUMMY_MIX`; do not use them as extraction failure fallback.
- Preserve the existing room, LP, recording, camera, polaroid, and final tape behavior.
- Use TDD for behavior changes and run each focused test red then green.

---

### Task 1: Shared extraction contract and validation

**Files:**
- Create: `src/types/playlistAnalysis.ts`
- Create: `src/config/playlistAnalysis.ts`
- Create: `src/types/playlistAnalysis.test.ts`

**Interfaces:**
- Produces: `ExtractedTrack`, `PlaylistExtractionResult`, `PlaylistExtractionError`, `parsePlaylistExtractionResult(value)`, `validatePlaylistImage(file)`.

- [ ] Write failing tests for accepted MIME types, 4 MiB size limit, normalized success JSON, and invalid JSON rejection.
- [ ] Run `pnpm vitest run src/types/playlistAnalysis.test.ts` and confirm failures are caused by missing modules.
- [ ] Implement the types, constants, runtime parser, and file validator.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Browser extraction service

**Files:**
- Create: `src/services/playlistAnalysis.ts`
- Create: `src/services/playlistAnalysis.test.ts`

**Interfaces:**
- Consumes: `parsePlaylistExtractionResult`, `PLAYLIST_EXTRACTION_TIMEOUT_MS`.
- Produces: `extractPlaylistFromImage(file: File, options?: { signal?: AbortSignal; fetchImpl?: typeof fetch }): Promise<PlaylistExtractionResult>`.

- [ ] Write failing tests proving the service sends a field named `image` in `FormData`, parses a successful response, maps API errors, and aborts after the configured timeout.
- [ ] Run `pnpm vitest run src/services/playlistAnalysis.test.ts` and confirm expected failures.
- [ ] Implement the service with `AbortController`, merged cancellation, and typed errors.
- [ ] Re-run the focused service tests and confirm they pass.

### Task 3: Editable extraction review panel

**Files:**
- Create: `src/components/PlaylistExtractionReview.tsx`
- Create: `src/components/PlaylistExtractionReview.test.tsx`
- Modify: `src/styles/dj-dochi.css`

**Interfaces:**
- Consumes: `result`, `onTrackChange`, `onDeleteTrack`, `onAddTrack`, `onRetry`, `onConfirm`, `onChooseImage`, `onChooseText`.
- Produces: a controlled room overlay with no API calls.

- [ ] Write failing interaction tests for editing title/artist, deleting, adding, retrying, confirming, and zero-track alternate actions.
- [ ] Run `pnpm vitest run src/components/PlaylistExtractionReview.test.tsx` and confirm the component is missing.
- [ ] Implement the controlled component using existing `Panel` and `RetroButton` primitives.
- [ ] Add responsive room-overlay styles and reduced-motion-safe loading treatment.
- [ ] Re-run the focused component test and confirm it passes.

### Task 4: Flow-state integration

**Files:**
- Modify: `src/types.ts`
- Modify: `src/hooks/useDjDochiFlow.ts`
- Modify: `src/hooks/useDjDochiFlow.test.ts`
- Modify: `src/components/DochiRoom.tsx`
- Modify: `src/components/PlaylistInputPanel.tsx`
- Modify: `src/components/PlaylistInputPanel.test.tsx`

**Interfaces:**
- Adds states: `extracting`, `extractionReview`, `extractionError`.
- Adds flow data: `extractionResult`, `extractionError`.
- Adds actions: `retryExtraction`, `updateExtractedTrack`, `deleteExtractedTrack`, `addExtractedTrack`, `confirmExtraction`, `chooseAnotherImage`, `chooseTextAfterExtraction`.

- [ ] Extend hook tests first for image handoff to `extracting`, successful storage, failure state, retry, row mutation, and confirmation to existing handoff.
- [ ] Run the focused hook test and verify the new assertions fail.
- [ ] Implement asynchronous image extraction with request cancellation on retry, restart, and unmount.
- [ ] Keep text handoff on the existing path and release the preview object URL when the input panel closes.
- [ ] Render extraction loading, error, and review UI inside `DochiRoom` without replacing the room.
- [ ] Add the privacy notice and client validation message to `PlaylistInputPanel`.
- [ ] Run hook and panel tests until green.

### Task 5: Vercel extraction function and OpenAI vision

**Files:**
- Create: `api/extract-playlist.ts`
- Create: `api/extract-playlist.test.ts`
- Create: `api/openaiPlaylistExtractor.ts`
- Create: `.env.example`
- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Endpoint: `POST /api/extract-playlist`, multipart field `image`.
- Environment: server-only `OPENAI_API_KEY`.
- Success: `PlaylistExtractionResult` JSON.
- Failure: `{ error: { code: string; message: string; retryable: boolean } }` JSON.

- [ ] Add dependencies for the OpenAI SDK and runtime JSON validation.
- [ ] Write API tests first for method validation, missing image, unsupported type, oversized image, missing key, successful normalization, and upstream failure.
- [ ] Run the focused API test and verify failures before implementation.
- [ ] Implement the Vercel Web API handler using `request.formData()` so the file remains in memory.
- [ ] Implement the OpenAI Responses image request with `store: false`, strict JSON schema, visible-information-only prompt, deduplication, and server-assigned IDs.
- [ ] Ensure logs contain only safe error codes/request IDs, never image bytes or Base64.
- [ ] Re-run API and service tests until green.

### Task 6: Integration verification with different images

**Files:**
- Create: `src/test/fixtures/playlist-a.png`
- Create: `src/test/fixtures/playlist-b.png`
- Create: `docs/playlist-extraction-verification.md`

**Interfaces:**
- Consumes: local `OPENAI_API_KEY` and the deployed-compatible `/api/extract-playlist` route.
- Produces: a verification note containing only extracted text, status, and warnings; never image bytes.

- [ ] Create two small controlled playlist screenshot fixtures with different visible track lists.
- [ ] Run the app through `vercel dev` and submit both fixtures.
- [ ] Record source app, extracted rows, warnings, and whether the two results differ.
- [ ] If no API key is available, run the same flow with mocked API responses and mark live verification as pending rather than claiming it passed.

### Task 7: Full regression and production build

**Files:**
- Modify only files required by failures introduced by this feature.

**Interfaces:**
- Produces: a test- and build-verified feature branch.

- [ ] Run `pnpm test` and confirm zero failing tests.
- [ ] Run `pnpm exec tsc -b` and confirm zero TypeScript errors.
- [ ] Run `pnpm build` and confirm Vite production output succeeds.
- [ ] Inspect `rtk git diff` for accidental secrets, Base64 data, generated output, and unrelated changes.
- [ ] Report changed files, environment setup, live-verification status, and exact commands run.
