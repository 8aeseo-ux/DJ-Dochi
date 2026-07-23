# Budgeted Mixtape Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Return at least three catalog-verified recommendations within a 35-second server budget and before the browser's 45-second timeout.

**Architecture:** A shared pipeline config defines quality and latency limits. The API creates a combined browser/budget signal, the LLM provider accepts it, and the verifier runs bounded iTunes concurrency followed by capped MusicBrainz fallback before deciding partial success.

**Tech Stack:** TypeScript, Vercel Functions, OpenAI Responses API, Vitest, iTunes Search API, MusicBrainz API.

## Global Constraints

- Initial recommendation target: 5; accepted maximum: 6.
- Replacement rounds: 1.
- Server budget: 35,000 ms with a 1,000 ms no-new-work buffer.
- Minimum successful verified tracks: 3.
- iTunes concurrency: 3.
- MusicBrainz checks: at most 3 per request and only after iTunes failure.
- All external requests receive browser/budget cancellation.
- Logs contain timing and count metadata only.

---

### Task 1: Pipeline limits and LLM cancellation

**Files:**
- Create: `api/mixtapePipelineConfig.ts`
- Modify: `src/services/llm/types.ts`
- Modify: `api/llm/openaiProvider.ts`
- Modify: `api/llm/openaiProvider.test.ts`
- Modify: `prompts/dochi-mixtape-guide.md`

**Interfaces:**
- Produces: `MIXTAPE_PIPELINE` constants.
- Produces: optional `{ signal?: AbortSignal }` request options for both `LlmProvider` methods.

- [ ] **Step 1: Write failing tests for initial recommendation bounds and signal forwarding**

```ts
expect(request.text.format.schema.properties.mixtape.properties.tracks)
  .toMatchObject({ minItems: 5, maxItems: 6 })
expect(parseMock.mock.calls[0][1]).toEqual({ signal })
expect(guide).toContain('정확히 5곡')
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `./node_modules/.bin/vitest run api/llm/openaiProvider.test.ts`

Expected: failures for missing bounds, prompt rule, and request options.

- [ ] **Step 3: Add constants, LLM options, schema limits, prompt rule, and signal forwarding**

```ts
export const MIXTAPE_PIPELINE = {
  initialRecommendationCount: 5,
  maximumInitialRecommendations: 6,
  minimumVerifiedTracks: 3,
  maximumReplacementRounds: 1,
  serverBudgetMs: 35_000,
  stopBufferMs: 1_000,
  itunesConcurrency: 3,
  maximumMusicBrainzChecks: 3,
} as const
```

Pass `{ signal: options?.signal }` as the second argument to `client.responses.parse()`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `./node_modules/.bin/vitest run api/llm/openaiProvider.test.ts`

Expected: all provider tests pass.

### Task 2: Split catalog phases without breaking the provider abstraction

**Files:**
- Modify: `api/catalog/catalogProviderChain.ts`
- Modify: `api/catalog/catalogProviderChain.test.ts`

**Interfaces:**
- Produces: `verifyPrimary(candidate, requestCache, signal)`.
- Produces: `verifyFallback(candidate, requestCache, signal)`.
- Preserves: combined `verify(candidate, requestCache, signal)`.

- [ ] **Step 1: Write failing tests for separate primary/fallback calls and provider-specific caching**

```ts
await chain.verifyPrimary(CANDIDATE, requestCache, signal)
await chain.verifyFallback(CANDIDATE, requestCache, signal)
expect(primary.verify).toHaveBeenCalledWith(CANDIDATE, signal)
expect(fallback.verify).toHaveBeenCalledWith(CANDIDATE, signal)
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `./node_modules/.bin/vitest run api/catalog/catalogProviderChain.test.ts`

Expected: `verifyPrimary` and `verifyFallback` are missing.

- [ ] **Step 3: Implement provider-specific cache keys and preserve combined verification**

Use `itunes:<identity>` and `musicbrainz:<identity>` cache keys so a primary miss cannot be mistaken for a fallback result.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `./node_modules/.bin/vitest run api/catalog/catalogProviderChain.test.ts`

Expected: all chain tests pass.

### Task 3: Bounded catalog orchestration and partial success

**Files:**
- Modify: `api/catalog/verifyMixtapeRecommendations.ts`
- Modify: `api/catalog/verifyMixtapeRecommendations.test.ts`

**Interfaces:**
- Consumes: split catalog methods, pipeline constants, optional `signal`, `deadlineAt`, and `now`.
- Produces: a result only when at least three tracks are verified.

- [ ] **Step 1: Write failing tests for the three-track threshold and one replacement round**

```ts
expect(result.mixtape.tracks).toHaveLength(3)
expect(provider.generateReplacementTracks).not.toHaveBeenCalled()
expect(MAX_REPLACEMENT_ROUNDS).toBe(1)
```

- [ ] **Step 2: Write failing tests for iTunes concurrency and MusicBrainz cap**

Track active primary promises and assert `maxActive === 3`. Assert fallback calls include only primary failures and are at most three.

- [ ] **Step 3: Write failing tests for budget partial return and abort propagation**

Use an injected `now()` and deadline. Verify three accumulated matches return after expiration, fewer than three reject, and each provider receives the supplied signal.

- [ ] **Step 4: Run the focused tests and verify RED**

Run: `./node_modules/.bin/vitest run api/catalog/verifyMixtapeRecommendations.test.ts`

Expected: failures for old two-round behavior, sequential verification, no threshold, and missing timing options.

- [ ] **Step 5: Implement bounded concurrency, fallback cap, threshold, deadline checks, and safe round metrics**

The worker pool size is three. Stop fallback or replacement work when the signal is aborted, one second or less remains, or the verified count reaches three.

- [ ] **Step 6: Run catalog tests and verify GREEN**

Run: `./node_modules/.bin/vitest run api/catalog/verifyMixtapeRecommendations.test.ts api/catalog/catalogProviderChain.test.ts`

Expected: all catalog tests pass.

### Task 4: API-level budget, cancellation, and timing logs

**Files:**
- Modify: `api/generate-mixtape.ts`
- Modify: `api/generate-mixtape.test.ts`

**Interfaces:**
- Creates: 35-second budget signal combined with `request.signal`.
- Passes: `signal` to LLM and verifier; `deadlineAt` to verifier.
- Logs: initial LLM and complete stages.

- [ ] **Step 1: Write failing API tests for signal and deadline forwarding**

```ts
expect(provider.generateMixtape).toHaveBeenCalledWith(
  expect.anything(),
  expect.objectContaining({ signal: expect.any(AbortSignal) }),
)
expect(verifyRecommendationsMock).toHaveBeenCalledWith(
  expect.objectContaining({ deadlineAt: expect.any(Number), signal: expect.any(AbortSignal) }),
)
```

- [ ] **Step 2: Write a failing test for safe pipeline timing logs**

Spy on `console.info`, assert stage and count fields exist, and assert serialized logs exclude sample titles and artists.

- [ ] **Step 3: Run API tests and verify RED**

Run: `./node_modules/.bin/vitest run api/generate-mixtape.test.ts`

Expected: missing signal/deadline and timing logs.

- [ ] **Step 4: Implement the combined signal, deadline, cleanup, and safe logs**

Start the timer after request validation, clear it in `finally`, and never place request payload data in logs.

- [ ] **Step 5: Run API tests and verify GREEN**

Run: `./node_modules/.bin/vitest run api/generate-mixtape.test.ts`

Expected: all endpoint tests pass.

### Task 5: Regression and live latency verification

**Files:**
- Modify: `docs/playlist-extraction-verification.md`

**Interfaces:**
- Documents: new success threshold, limits, latency evidence, and environment requirements.

- [ ] **Step 1: Run all automated checks**

Run: `./node_modules/.bin/vitest run`

Expected: all tests pass.

Run: `./node_modules/.bin/tsc -b`

Expected: exit code 0.

Run: `./node_modules/.bin/vite build`

Expected: production build succeeds.

- [ ] **Step 2: Run a live local API request**

Send the reviewed nine-track fixture to `http://127.0.0.1:5175/api/generate-mixtape`.

Expected: HTTP 200 in less than 45 seconds with at least three and at most six verified tracks.

- [ ] **Step 3: Inspect logs**

Expected: stage duration, iTunes checks, MusicBrainz checks, replacement rounds, total duration, and verified count are present; track and artist strings are absent.

- [ ] **Step 4: Update verification documentation and commit**

Record the exact test count, build result, live latency, and verified count without including API keys or user playlist contents.
