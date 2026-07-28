# LLM Mixtape Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 extractionReview에서 최종 확인한 곡 목록만 서버의 LLM provider에 전달해 취향 분석과 믹스테이프 추천을 생성하고, 그 결과를 기존 LP와 FinalMixtape 흐름에 연결한다.

**Architecture:** 브라우저는 `src/services/mixtapeAnalysis.ts`를 통해 확인된 트랙 JSON만 `/api/generate-mixtape`에 전송한다. 서버는 provider factory를 통해 OpenAI 구현을 선택하고, 구조화된 응답을 검증·정규화한 뒤 `MixtapeResult`를 반환한다. OCR과 OpenAI Vision 추출 어댑터는 이 작업에서 변경하지 않으며, UI와 상태는 provider 이름이나 OpenAI SDK를 직접 참조하지 않는다.

**Tech Stack:** React 19, Vite, TypeScript, Vitest, Zod, Vercel Serverless Function, OpenAI Responses API structured output

## Global Constraints

- 플레이리스트 이미지에서 곡명·아티스트를 추출하는 기존 브라우저 OCR 기본 흐름을 유지한다.
- 기존 OpenAI Vision 추출기는 `openai-vision` 선택 어댑터로 유지하고 취향 분석에는 사용하지 않는다.
- 사용자가 extractionReview에서 확인한 곡 목록만 취향 분석 API 요청에 포함한다.
- `OPENAI_API_KEY`와 `OPENAI_MODEL`은 서버 환경변수로만 사용하며 `VITE_` 접두어를 사용하지 않는다.
- LLM 실패 시 `working` 또는 LP 상태로 진입하지 않고 `tasteAnalysisError`에서 재시도한다.
- 추천곡은 입력곡과 중복되지 않도록 서버에서 다시 검사하고, 카탈로그 검증 전에는 `catalogStatus: 'unverified'`로 고정한다.
- `FinalMixtape`는 더미 데이터를 직접 import하지 않고 `MixtapeResult`를 prop으로 받는다.
- `DUMMY_MIX`와 `DUMMY_TRACKS`는 삭제하지 않으며 개발 모드 fallback과 기존 테스트 fixture로만 남긴다.
- 이미지 원본, base64, API 키는 취향 분석 요청에 포함하거나 로그로 남기지 않는다.

## Current Code Findings

- `src/services/playlistAnalysis.ts`는 `createPlaylistExtractor()`를 통해 `browser-ocr`를 기본 선택하고 `openai-vision`을 선택적으로 호출한다.
- `api/extract-playlist.ts`와 `api/openaiPlaylistExtractor.ts`는 이미지 추출 전용이다. 이 API를 취향 분석에 재사용하지 않는다.
- `src/hooks/useDjDochiFlow.ts`의 `confirmExtraction()`은 현재 검수 완료 후 `receivingInput`으로 이동하고, handoff 대화가 끝나면 `working`으로 이동한다. 이 함수가 `analyzingTaste` 진입점이 된다.
- `src/components/DochiRoom.tsx`는 hook의 상태에 따라 패널을 렌더링하지만 현재 취향 분석 상태와 결과 prop은 없다.
- `src/components/FinalMixtape.tsx`는 `DUMMY_MIX`와 `DUMMY_TRACKS`를 직접 import한다. 실제 결과를 연결하려면 이 의존성을 제거해야 한다.
- `src/data/playlist.ts`에는 더미 결과와 기존 플랫폼 링크용 fixture가 함께 있다.
- `openai` 패키지는 이미 설치되어 있고 기존 Vision adapter가 `responses.parse`와 `zodTextFormat`을 사용한다.

## Target Flow

```text
image/text input
  -> browser OCR or deterministic text parser
  -> extractionReview
  -> user confirms and fields are trimmed
  -> analyzingTaste
  -> POST /api/generate-mixtape { tracks: confirmedTracks[] }
       -> LLM provider factory
       -> OpenAI provider (initial implementation)
       -> Zod response validation + duplicate removal + unverified catalog status
  -> success: receivingInput -> LP interaction -> recording -> finalTape
  -> failure: tasteAnalysisError -> retryTasteAnalysis
```

텍스트 붙여넣기 경로도 검수되지 않은 원문을 LLM에 바로 보내지 않기 위해, 줄 단위의 결정적 파서를 거쳐 동일한 `extractionReview`로 진입시킨다. OCR 구현과 기존 Vision fallback은 변경하지 않는다.

## Shared Contracts

`src/types/mixtape.ts`에 다음 계약을 정의하고 Zod schema와 TypeScript 타입을 함께 제공한다.

```ts
export const ConfirmedTrackSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  artist: z.string().trim().min(1),
  album: z.string().trim(),
}).strict()

export const GenerateMixtapeRequestSchema = z.object({
  tracks: z.array(ConfirmedTrackSchema).min(1).max(50),
}).strict()

export const MixtapeTrackSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  artist: z.string().min(1),
  album: z.string(),
  reason: z.string().min(1),
  catalogStatus: z.literal('unverified'),
  platforms: PlatformTrackReferencesSchema,
}).strict()

export const MixtapeResultSchema = z.object({
  tasteProfile: z.object({
    summary: z.string().min(1),
    genres: z.array(z.string()).min(1),
    moods: z.array(z.string()).min(1),
    traits: z.array(z.string()).min(1),
  }).strict(),
  mixtape: z.object({
    title: z.string().min(1),
    subtitle: z.string().min(1),
    dochiComment: z.string().min(1),
    tracks: z.array(MixtapeTrackSchema).min(1).max(8),
  }).strict(),
}).strict()
```

`PlatformTrackReferencesSchema`는 기존 플랫폼 타입과 같은 모양을 공유하되, LLM 단계에서는 세 플랫폼 모두 `{ id: null, url: null }`로 생성한다. 이후 카탈로그 검증 단계가 해당 필드만 채울 수 있다.

`src/services/llm/types.ts`에는 provider가 받아야 하는 입력과 반환할 초안만 둔다. OpenAI SDK 타입은 포함하지 않는다.

```ts
export type LlmTrackInput = Pick<ConfirmedTrack, 'title' | 'artist' | 'album'>

export type LlmMixtapeDraft = {
  tasteProfile: TasteProfileDraft
  mixtape: {
    title: string
    subtitle: string
    dochiComment: string
    tracks: Array<{
      title: string
      artist: string
      album: string
      reason: string
    }>
  }
}

export interface LlmProvider {
  readonly id: string
  generateMixtape(input: { tracks: readonly LlmTrackInput[] }): Promise<LlmMixtapeDraft>
}
```

## Task 1: Shared result contract and deterministic request boundary

**Files:**
- Create: `src/types/mixtape.ts`
- Create: `src/types/mixtapeAnalysis.ts`
- Create: `src/services/llm/types.ts`
- Create: `src/services/extraction/parsePastedPlaylist.ts`
- Test: `src/types/mixtape.test.ts`
- Test: `src/services/extraction/parsePastedPlaylist.test.ts`

**Interfaces:**
- Produces `ConfirmedTrack`, `GenerateMixtapeRequest`, `MixtapeResult`, `MixtapeAnalysisIssue`, `LlmProvider`, and `LlmMixtapeDraft`.
- Produces `parsePastedPlaylist(value: string): PlaylistExtractionResult` so text input also reaches the existing review UI.

- [ ] Write schema tests for valid results, missing fields, non-`unverified` catalog status, and empty confirmed tracks.
- [ ] Write parser tests for `title - artist`, tab-separated rows, blank lines, duplicate rows, and ambiguous rows that must become warnings rather than guessed tracks.
- [ ] Run `pnpm exec vitest run src/types/mixtape.test.ts src/services/extraction/parsePastedPlaylist.test.ts` and confirm new tests fail before implementation.
- [ ] Implement the schemas and parser without importing OpenAI or performing network calls.
- [ ] Run the focused tests again and confirm they pass.
- [ ] Keep `src/types/playlistAnalysis.ts` and all existing OCR adapter contracts compatible; only reuse their `ExtractedTrack` shape when converting to `ConfirmedTrack`.

## Task 2: Provider abstraction, prompt, and OpenAI server adapter

**Files:**
- Create: `prompts/dochi-mixtape-guide.md`
- Create: `api/llm/provider.ts`
- Create: `api/llm/openaiProvider.ts`
- Create: `api/llm/normalizeMixtape.ts`
- Modify: `.env.example`
- Create or modify: `vercel.json`
- Test: `api/llm/provider.test.ts`
- Test: `api/llm/normalizeMixtape.test.ts`

**Interfaces:**
- `createLlmProvider(env: { provider?: string; apiKey?: string; model?: string }): LlmProvider` selects `openai` by default and rejects unknown providers or missing server configuration.
- `createOpenAiProvider({ apiKey, model, guidePrompt }): LlmProvider` is the only file allowed to import the OpenAI SDK.
- `normalizeMixtapeDraft(draft, confirmedTracks): MixtapeResult` trims values, removes input-song duplicates case-insensitively, creates stable IDs, and fills every platform reference with null IDs/URLs and `catalogStatus: 'unverified'`.

- [ ] Write provider factory tests for default `openai`, unknown `LLM_PROVIDER`, missing `OPENAI_API_KEY`, and missing `OPENAI_MODEL`.
- [ ] Write normalizer tests proving an input track cannot appear in recommendations and every surviving recommendation is `unverified`.
- [ ] Create `prompts/dochi-mixtape-guide.md` with explicit rules: analyze only supplied confirmed tracks, preserve Dochi's Korean game-DJ voice, never invent catalog IDs, do not repeat input tracks, return only the schema fields, and keep reasons short and concrete.
- [ ] Load the Markdown guide in the server function with a server-only loader. Add `prompts/dochi-mixtape-guide.md` to Vercel function `includeFiles` so deployment does not omit it.
- [ ] Configure `LLM_PROVIDER=openai`, `OPENAI_API_KEY=`, and `OPENAI_MODEL=` in `.env.example`; never add a `VITE_` equivalent.
- [ ] Implement the OpenAI provider with `responses.parse`, `store: false`, a bounded timeout, and `zodTextFormat` for the provider draft schema. Do not log track payloads, image data, or model output containing personal data.
- [ ] Run provider and normalizer tests and confirm the OpenAI SDK is not imported by browser-facing service files.

## Task 3: Generate-mixtape server endpoint and browser service

**Files:**
- Create: `api/generate-mixtape.ts`
- Create: `src/services/mixtapeAnalysis.ts`
- Test: `api/generate-mixtape.test.ts`
- Test: `src/services/mixtapeAnalysis.test.ts`

**Interfaces:**
- `POST /api/generate-mixtape` accepts only JSON matching `GenerateMixtapeRequestSchema`.
- `generateMixtapeFromTracks(tracks: readonly ConfirmedTrack[], options?: { signal?: AbortSignal }): Promise<MixtapeResult>` is the only browser-facing function.

- [ ] Write endpoint tests for non-POST, malformed JSON, empty tracks, missing provider configuration, successful structured output, and retryable provider failure.
- [ ] Assert in the endpoint test that the provider receives exactly the confirmed title/artist/album fields and never an image, object URL, or confidence value.
- [ ] Write client service tests for successful schema parsing, HTTP error conversion, timeout/abort conversion, and invalid JSON conversion.
- [ ] Implement `api/generate-mixtape.ts` with `Cache-Control: no-store`, status `400` for invalid input, `503` for missing configuration, and `502` for provider failure.
- [ ] Implement `src/services/mixtapeAnalysis.ts` with `fetch('/api/generate-mixtape')`, an `AbortController` timeout, and `MixtapeAnalysisError` conversion. Do not import `openai` or any server provider.
- [ ] Run focused API and service tests.

## Task 4: Hook state transition and extraction-review handoff

**Files:**
- Modify: `src/types.ts`
- Modify: `src/hooks/useDjDochiFlow.ts`
- Modify: `src/hooks/useDjDochiFlow.test.ts`
- Modify: `src/components/DochiRoom.tsx`
- Create: `src/components/TasteAnalysisErrorPanel.tsx`
- Test: `src/components/TasteAnalysisErrorPanel.test.tsx`

**Interfaces:**
- Add `analyzingTaste` and `tasteAnalysisError` to `DochiFlowState`.
- Add `mixtapeResult: MixtapeResult | null` and `tasteAnalysisError: MixtapeAnalysisIssue | null` to `DjDochiFlow`.
- Add `retryTasteAnalysis: () => void` and `confirmExtraction: () => void` behavior that starts analysis only after trimmed, non-empty confirmed tracks exist.

- [ ] Update hook tests so `confirmExtraction()` first enters `analyzingTaste`, exposes the Dochi analysis dialogue, and does not enter `working` synchronously.
- [ ] Add a success test asserting `mixtapeResult` is stored and the hook moves to `receivingInput`, then to `working` only after the handoff dialogue is advanced.
- [ ] Add a failure test asserting `tasteAnalysisError` is shown, the state is `tasteAnalysisError`, LP callbacks are not enabled, and `retryTasteAnalysis()` reuses the stored confirmed tracks.
- [ ] Add a test proving edits and deletions made immediately before confirmation are the exact request payload.
- [ ] Route pasted text through `parsePastedPlaylist()` and `extractionReview` so raw pasted text is never sent directly to the LLM.
- [ ] Implement `beginTasteAnalysis(confirmedTracks)` with an abort controller, `setState('analyzingTaste')`, and explicit error mapping. On failure, preserve `extractionResult` for retry and do not fall back to `DUMMY_MIX`.
- [ ] Add the in-room analysis panel with “좋아. 이제 네 취향을 좀 볼게.” and a retry action. Keep the fixed DJ room and LP state unchanged.
- [ ] Clear `mixtapeResult` on restart or when a new input session begins. Keep image object URL cleanup unchanged.
- [ ] Run hook and panel tests.

## Task 5: Real result rendering and development fallback

**Files:**
- Modify: `src/components/FinalMixtape.tsx`
- Modify: `src/components/DochiRoom.tsx`
- Modify: `src/components/PlatformListenButtons.tsx`
- Modify: `src/data/playlist.ts`
- Modify: `src/components/FinalMixtape.test.tsx`
- Modify: `src/components/PlatformListenButtons.test.tsx`

**Interfaces:**
- `FinalMixtape` receives `result: MixtapeResult` as a required prop and never imports `DUMMY_MIX` or `DUMMY_TRACKS`.
- `PlatformListenButtons` accepts a structural type containing `title`, `artist`, and future-ready `platforms`, so real recommendations and existing dummy fixtures both work.

- [ ] Update FinalMixtape tests to pass a fixture `MixtapeResult` with a unique title and recommendation, then assert those values render instead of the dummy title/tracks.
- [ ] Add assertions for `tasteProfile.summary`, recommendation `reason`, and `UNVERIFIED` catalog status.
- [ ] Keep polaroid/sticker rendering and platform search links working with null platform IDs.
- [ ] Add `DUMMY_MIXTAPE_RESULT` as a development-only adapter in `src/data/playlist.ts`; leave existing dummy exports intact for legacy tests.
- [ ] In `DochiRoom`, pass `flow.mixtapeResult` to FinalMixtape. Use the dummy adapter only when `import.meta.env.DEV` and no real result exists; production must not silently display dummy recommendations after a failed analysis.
- [ ] Render the real title, subtitle, comment, taste summary, and recommendation reasons without changing the fixed-room layout.
- [ ] Run component tests and confirm no `FinalMixtape.tsx` import references `src/data/playlist.ts`.

## Task 6: Full verification and manual acceptance

**Files:**
- Modify: `docs/playlist-extraction-verification.md`
- Modify: `docs/superpowers/plans/2026-07-23-llm-mixtape-generation.md` only if implementation decisions change during execution

- [ ] Run `pnpm test` and confirm all existing OCR, extraction review, vinyl, camera, and platform tests still pass.
- [ ] Run `pnpm build` and confirm TypeScript and Vite production build pass.
- [ ] Run the server-enabled local app with `pnpm dev:vercel` and server-only environment variables:

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=...
```

- [ ] Use two different playlist screenshots, verify OCR results differ at extractionReview, edit one row, confirm, and inspect the request in a test environment without logging the image or API key.
- [ ] Verify the analysis success path: `extractionReview → analyzingTaste → receivingInput → working → recording → finalTape`.
- [ ] Verify the failure path: temporarily use an invalid key/model, confirm `tasteAnalysisError` with retry, and confirm no LP interaction or dummy result appears.
- [ ] Verify recommendation output does not repeat any confirmed input track and all catalog statuses are `unverified`.
- [ ] Verify the final mix opens with the generated title and tracks, and platform buttons fall back to search links until catalog IDs are populated.

## Implementation Handoff

이 문서는 현재 사전 설계 단계에서 저장한다. 다음 단계에서는 Task 1부터 시작해 각 Task마다 focused test → implementation → focused test → 전체 검증 순서로 진행한다. OpenAI provider와 API endpoint는 서버에서만 실행하고, 브라우저 상태/컴포넌트는 `generateMixtapeFromTracks()`와 `MixtapeResult`만 사용한다.
