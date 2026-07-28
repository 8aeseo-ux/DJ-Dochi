# Catalog-Verified Mixtape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify every LLM recommendation through iTunes Search and then MusicBrainz, replace only failed candidates up to two times, and return only verified songs.

**Architecture:** Keep the React flow unchanged and insert a server-only catalog verification pipeline between the provider-neutral LLM draft and `generate-mixtape` response. Catalog providers share one result contract, the chain owns fallback order, and an orchestration service owns caching, retries, safe logs, and conversion to the final verified result.

**Tech Stack:** TypeScript 7, Vercel Functions Web `Request`/`Response`, OpenAI Responses API, Zod 4, Vitest 4, iTunes Search API, MusicBrainz Web Service

## Global Constraints

- Preserve the dirty worktree and never reset or overwrite unrelated user changes.
- Use iTunes Search first and call MusicBrainz only when iTunes does not verify a candidate.
- Require sufficiently matching title and artist; classify results as `verified`, `not_found`, `ambiguous`, or `unavailable`.
- Treat live, remix, remaster, acoustic, instrumental, edit, and version mismatches conservatively.
- Apply a 4,000ms timeout to each catalog provider request.
- Keep MusicBrainz request starts at least 1,100ms apart and send a meaningful User-Agent.
- Cache the normalized title+artist identity within a request and in a bounded six-hour in-memory TTL cache.
- Retry only failed recommendation slots, for at most two replacement rounds.
- Never include an unverified recommendation in the API result.
- If zero tracks verify, return a retryable error so the LP flow does not start.
- Log only provider, status, reason, round, candidate index, retry count, and aggregate counts; never log titles, artists, playlist contents, images, or raw provider responses.
- Do not add Spotify or Apple Developer credentials.
- Follow RED → GREEN → REFACTOR for every behavior.
- Run commands through `rtk` as required by the repository instructions.

---

## File Map

### New server files

- `api/catalog/types.ts`: provider-neutral candidates, matches, outcomes, and provider interface.
- `api/catalog/trackIdentity.ts`: normalization, version-token detection, similarity scoring, and conservative result selection.
- `api/catalog/trackIdentity.test.ts`: identity and ambiguity unit tests.
- `api/catalog/ttlCache.ts`: bounded TTL cache.
- `api/catalog/ttlCache.test.ts`: cache expiry and capacity tests.
- `api/catalog/itunesCatalogProvider.ts`: iTunes Search adapter and 4-second timeout.
- `api/catalog/itunesCatalogProvider.test.ts`: iTunes response mapping and failures.
- `api/catalog/musicBrainzCatalogProvider.ts`: MusicBrainz adapter, rate queue, User-Agent, and timeout.
- `api/catalog/musicBrainzCatalogProvider.test.ts`: MusicBrainz mapping, throttling, and failures.
- `api/catalog/catalogProviderChain.ts`: iTunes-first fallback and request/in-memory caching.
- `api/catalog/catalogProviderChain.test.ts`: fallback, ambiguity, unavailable, and cache tests.
- `api/catalog/verifyMixtapeRecommendations.ts`: verification/replacement orchestration and safe logs.
- `api/catalog/verifyMixtapeRecommendations.test.ts`: verified-only, replacement count, retry cap, and errors.

### Modified server/shared files

- `src/services/llm/types.ts`: replacement recommendation input and LLM provider method.
- `api/llm/openaiProvider.ts`: OpenAI replacement-only structured request.
- `api/llm/openaiProvider.test.ts`: replacement prompt and exclusion tests.
- `api/llm/normalizeMixtape.ts`: normalize candidates without prematurely producing a final result.
- `api/llm/normalizeMixtape.test.ts`: preserve duplicate filtering while candidates remain unverified internally.
- `api/generate-mixtape.ts`: construct catalog chain and invoke verification orchestrator.
- `api/generate-mixtape.test.ts`: API returns verified-only results and catalog errors.
- `src/types/mixtape.ts`: final recommendation status becomes verified.
- `src/types/mixtape.test.ts`: verified-only schema contract.
- `src/types/mixtapeAnalysis.ts`: catalog-specific retryable errors.
- `prompts/dochi-mixtape-guide.md`: real-release and exclusion rules.
- `src/components/FinalMixtape.test.tsx`: expect `VERIFIED`.
- `src/data/playlist.ts`: mark curated development fallback tracks verified.
- `.env.example`: non-secret catalog tuning defaults only if runtime overrides are exposed.
- `docs/playlist-extraction-verification.md`: document credential-free catalog verification.

---

### Task 1: Catalog outcome and conservative identity matching

**Files:**
- Create: `api/catalog/types.ts`
- Create: `api/catalog/trackIdentity.ts`
- Create: `api/catalog/trackIdentity.test.ts`

**Interfaces:**
- Produces:

```ts
export type CatalogCandidate = {
  title: string
  artist: string
  album: string
  reason: string
}

export type CatalogSearchItem = {
  catalogId: string
  title: string
  artist: string
  album: string
  url: string | null
}

export type CatalogMatch = CatalogSearchItem & {
  provider: 'itunes' | 'musicbrainz'
}

export type CatalogVerificationResult =
  | { status: 'verified'; match: CatalogMatch }
  | { status: 'not_found' }
  | { status: 'ambiguous'; reason: 'multiple_matches' | 'version_mismatch' | 'low_similarity' }
  | { status: 'unavailable'; reason: 'timeout' | 'rate_limited' | 'network' | 'invalid_response' }

export interface CatalogVerificationProvider {
  readonly id: 'itunes' | 'musicbrainz'
  verify(candidate: CatalogCandidate, signal?: AbortSignal): Promise<CatalogVerificationResult>
}
```

- Produces:

```ts
export const TITLE_SIMILARITY_THRESHOLD = 0.92
export const ARTIST_SIMILARITY_THRESHOLD = 0.90
export function trackIdentityKey(track: Pick<CatalogCandidate, 'title' | 'artist'>): string
export function selectCatalogMatch(
  candidate: CatalogCandidate,
  items: readonly CatalogSearchItem[],
): Exclude<CatalogVerificationResult, { status: 'unavailable' }>
```

- [ ] **Step 1: Write failing matching tests**

Cover exact Korean/English matches, punctuation normalization, artist mismatch, version mismatch, two equally good matches, and low similarity:

```ts
expect(selectCatalogMatch(candidate('Ditto', 'NewJeans'), [
  item('Ditto', 'NewJeans'),
])).toMatchObject({ status: 'verified' })

expect(selectCatalogMatch(candidate('Blue Monday', 'New Order'), [
  item('Blue Monday - Live', 'New Order'),
])).toEqual({ status: 'ambiguous', reason: 'version_mismatch' })

expect(selectCatalogMatch(candidate('Home', 'Artist A'), [
  item('Home', 'Artist A', 'id-1'),
  item('Home', 'Artist A', 'id-2'),
])).toEqual({ status: 'ambiguous', reason: 'multiple_matches' })
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
rtk env PATH=/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin node_modules/.bin/vitest run api/catalog/trackIdentity.test.ts
```

Expected: FAIL because the catalog types and matching functions do not exist.

- [ ] **Step 3: Implement minimal matching**

Use NFKC normalization, lowercasing, collapsed whitespace, Unicode letter/number tokens, Dice coefficient similarity, explicit version-token sets, and a `0.02` winner margin. Return `not_found` for an empty result set, `ambiguous: low_similarity` when search items exist but none cross both thresholds, `ambiguous: version_mismatch` when the closest title has different version tokens, and `ambiguous: multiple_matches` when the best two accepted scores differ by less than `0.02`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Expected: all `trackIdentity` tests pass.

- [ ] **Step 5: Commit the isolated task**

```bash
git add api/catalog/types.ts api/catalog/trackIdentity.ts api/catalog/trackIdentity.test.ts
git commit -m "feat: add conservative catalog matching"
```

---

### Task 2: Bounded TTL cache

**Files:**
- Create: `api/catalog/ttlCache.ts`
- Create: `api/catalog/ttlCache.test.ts`

**Interfaces:**
- Produces:

```ts
export class TtlCache<K, V> {
  constructor(options: { ttlMs: number; maxEntries: number; now?: () => number })
  get(key: K): V | undefined
  set(key: K, value: V): void
  clear(): void
}
```

- [ ] **Step 1: Write failing cache tests**

```ts
it('reuses values before TTL and expires them afterwards', () => {
  let now = 0
  const cache = new TtlCache<string, number>({ ttlMs: 100, maxEntries: 2, now: () => now })
  cache.set('a', 1)
  expect(cache.get('a')).toBe(1)
  now = 101
  expect(cache.get('a')).toBeUndefined()
})

it('evicts the oldest entry when capacity is exceeded', () => {
  const cache = new TtlCache<string, number>({ ttlMs: 1000, maxEntries: 2 })
  cache.set('a', 1)
  cache.set('b', 2)
  cache.set('c', 3)
  expect(cache.get('a')).toBeUndefined()
})
```

- [ ] **Step 2: Run the test and verify RED**

Expected: FAIL because `TtlCache` does not exist.

- [ ] **Step 3: Implement the minimal cache**

Store `{ value, expiresAt }` in insertion order, delete expired entries on `get`, refresh insertion order on `set`, and evict the first key while size exceeds capacity.

- [ ] **Step 4: Run the cache and identity tests**

Expected: both test files pass.

- [ ] **Step 5: Commit**

```bash
git add api/catalog/ttlCache.ts api/catalog/ttlCache.test.ts
git commit -m "feat: add bounded catalog cache"
```

---

### Task 3: iTunes Search verification provider

**Files:**
- Create: `api/catalog/itunesCatalogProvider.ts`
- Create: `api/catalog/itunesCatalogProvider.test.ts`

**Interfaces:**
- Consumes: `CatalogVerificationProvider`, `selectCatalogMatch`.
- Produces:

```ts
export const ITUNES_TIMEOUT_MS = 4_000
export function createItunesCatalogProvider(options?: {
  fetch?: typeof fetch
  timeoutMs?: number
  country?: string
}): CatalogVerificationProvider
```

- [ ] **Step 1: Write failing provider tests**

Assert that the provider calls:

```text
https://itunes.apple.com/search?term=...&country=KR&media=music&entity=song&limit=10
```

Map `trackId`, `trackName`, `artistName`, `collectionName`, and `trackViewUrl`. Test verified, `not_found`, `ambiguous`, HTTP error as `unavailable: network`, 429 as `unavailable: rate_limited`, invalid JSON as `unavailable: invalid_response`, and AbortError as `unavailable: timeout`.

- [ ] **Step 2: Run and verify RED**

Expected: FAIL because `createItunesCatalogProvider` does not exist.

- [ ] **Step 3: Implement the provider**

Use `AbortSignal.any([callerSignal, AbortSignal.timeout(timeoutMs)])` when available through the current Node runtime, URLSearchParams for query encoding, Zod or explicit guards for the response shape, and `selectCatalogMatch` for the final decision. Never log the query or response.

- [ ] **Step 4: Run iTunes tests and verify GREEN**

Expected: all iTunes and identity tests pass.

- [ ] **Step 5: Commit**

```bash
git add api/catalog/itunesCatalogProvider.ts api/catalog/itunesCatalogProvider.test.ts
git commit -m "feat: verify recommendations with iTunes"
```

---

### Task 4: MusicBrainz fallback with rate control

**Files:**
- Create: `api/catalog/musicBrainzCatalogProvider.ts`
- Create: `api/catalog/musicBrainzCatalogProvider.test.ts`

**Interfaces:**
- Consumes: `CatalogVerificationProvider`, `selectCatalogMatch`.
- Produces:

```ts
export const MUSICBRAINZ_TIMEOUT_MS = 4_000
export const MUSICBRAINZ_MIN_INTERVAL_MS = 1_100
export function createMusicBrainzCatalogProvider(options?: {
  fetch?: typeof fetch
  timeoutMs?: number
  minIntervalMs?: number
  now?: () => number
  wait?: (ms: number) => Promise<void>
  userAgent?: string
}): CatalogVerificationProvider
```

- [ ] **Step 1: Write failing MusicBrainz tests**

Test correct Lucene query encoding, `fmt=json`, `limit=10`, a meaningful User-Agent, artist-credit flattening, exact verification, ambiguity, 429, timeout, invalid response, and two calls starting at least 1,100ms apart using fake `now` and `wait`.

- [ ] **Step 2: Run and verify RED**

Expected: FAIL because the provider does not exist.

- [ ] **Step 3: Implement the provider**

Use a module-scoped promise queue so calls are serialized. Before each request, wait for `max(0, lastStart + minIntervalMs - now())`, then set `lastStart`. Convert each recording to `CatalogSearchItem` using MBID, title, first release title when present, and joined artist-credit names. Use the same timeout and matching contract as iTunes.

- [ ] **Step 4: Run focused provider tests**

Expected: iTunes, MusicBrainz, cache, and matching tests pass.

- [ ] **Step 5: Commit**

```bash
git add api/catalog/musicBrainzCatalogProvider.ts api/catalog/musicBrainzCatalogProvider.test.ts
git commit -m "feat: add MusicBrainz catalog fallback"
```

---

### Task 5: Provider chain, cache, and safe outcomes

**Files:**
- Create: `api/catalog/catalogProviderChain.ts`
- Create: `api/catalog/catalogProviderChain.test.ts`

**Interfaces:**
- Produces:

```ts
export function createCatalogProviderChain(options: {
  primary: CatalogVerificationProvider
  fallback: CatalogVerificationProvider
  cache?: TtlCache<string, CatalogVerificationResult>
}): {
  verify(candidate: CatalogCandidate, requestCache?: Map<string, CatalogVerificationResult>):
    Promise<CatalogVerificationResult>
}
```

- [ ] **Step 1: Write failing chain tests**

Test that:

- iTunes `verified` stops the chain.
- iTunes `not_found`, `ambiguous`, or `unavailable` invokes MusicBrainz.
- MusicBrainz `verified` wins.
- if neither verifies, `ambiguous` outranks `not_found`, while two unavailable providers return `unavailable`.
- repeated normalized title+artist uses the request cache.
- a second chain call uses the six-hour TTL cache.
- `unavailable` is not stored in the long TTL cache.

- [ ] **Step 2: Run and verify RED**

Expected: FAIL because the chain does not exist.

- [ ] **Step 3: Implement the chain**

Set default cache to `new TtlCache({ ttlMs: 6 * 60 * 60 * 1000, maxEntries: 500 })`. Read request cache first, then TTL cache. Call fallback unless primary verifies. Store only `verified`, `not_found`, and `ambiguous`.

- [ ] **Step 4: Run catalog unit suite**

Run:

```bash
rtk env PATH=/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin node_modules/.bin/vitest run api/catalog
```

Expected: all catalog tests pass.

- [ ] **Step 5: Commit**

```bash
git add api/catalog/catalogProviderChain.ts api/catalog/catalogProviderChain.test.ts
git commit -m "feat: chain and cache catalog verification"
```

---

### Task 6: LLM replacement-only recommendations and prompt rules

**Files:**
- Modify: `src/services/llm/types.ts`
- Modify: `api/llm/openaiProvider.ts`
- Modify: `api/llm/openaiProvider.test.ts`
- Modify: `prompts/dochi-mixtape-guide.md`

**Interfaces:**
- Extend:

```ts
export type LlmRecommendationDraft = LlmMixtapeDraft['mixtape']['tracks'][number]

export type ReplacementRecommendationInput = {
  confirmedTracks: readonly LlmTrackInput[]
  excludedTracks: readonly Pick<LlmTrackInput, 'title' | 'artist'>[]
  count: number
}

export interface LlmProvider {
  readonly id: string
  generateMixtape(input: { tracks: readonly LlmTrackInput[] }): Promise<LlmMixtapeDraft>
  generateReplacementTracks(input: ReplacementRecommendationInput): Promise<LlmRecommendationDraft[]>
}
```

- [ ] **Step 1: Write failing OpenAI provider tests**

Mock `responses.parse` and assert the second call contains only `confirmedTracks`, `excludedTracks`, and `requiredCount`, uses a replacement-track array schema, and returns only the parsed track array. Assert no title/artist data is logged.

- [ ] **Step 2: Run and verify RED**

Expected: TypeScript/test failure because `generateReplacementTracks` is missing.

- [ ] **Step 3: Implement replacement structured output**

Add a strict Zod schema:

```ts
const ReplacementTracksSchema = z.object({
  tracks: z.array(LlmRecommendationTrackSchema).min(1).max(8),
}).strict()
```

Use the existing OpenAI client and timeout. The user payload must state `requiredCount`, confirmed tracks, and all excluded identities. Preserve provider-neutral error mapping.

Update the guide with explicit rules that every recommendation must be a real public release, uncertain combinations must not be invented, and excluded tracks must not be repeated.

- [ ] **Step 4: Run OpenAI/provider tests**

Expected: provider tests pass and prompt assertions find the new forbidden rule.

- [ ] **Step 5: Commit**

```bash
git add src/services/llm/types.ts api/llm/openaiProvider.ts api/llm/openaiProvider.test.ts prompts/dochi-mixtape-guide.md
git commit -m "feat: request replacement recommendations"
```

---

### Task 7: Verified-only orchestration and safe logging

**Files:**
- Create: `api/catalog/verifyMixtapeRecommendations.ts`
- Create: `api/catalog/verifyMixtapeRecommendations.test.ts`
- Modify: `api/llm/normalizeMixtape.ts`
- Modify: `api/llm/normalizeMixtape.test.ts`
- Modify: `src/types/mixtapeAnalysis.ts`

**Interfaces:**
- Produces:

```ts
export const MAX_REPLACEMENT_ROUNDS = 2

export async function verifyMixtapeRecommendations(options: {
  draft: LlmMixtapeDraft
  confirmedTracks: readonly ConfirmedTrack[]
  llmProvider: LlmProvider
  catalog: ReturnType<typeof createCatalogProviderChain>
  logger?: Pick<Console, 'info' | 'warn'>
}): Promise<MixtapeResult>
```

- [ ] **Step 1: Write failing orchestration tests**

Test:

- all initial candidates verified, so replacement is never called;
- two failures call `generateReplacementTracks` with `count: 2`;
- verified and every attempted candidate appear in `excludedTracks`;
- only failed slots are replaced;
- no more than two replacement calls;
- partial verified results contain no unverified tracks;
- zero verified results throw `CATALOG_VERIFICATION_FAILED`;
- all provider failures throw `CATALOG_UNAVAILABLE`;
- log objects contain no `title`, `artist`, `tracks`, `query`, or raw response fields.

- [ ] **Step 2: Run and verify RED**

Expected: FAIL because the orchestrator and catalog error codes do not exist.

- [ ] **Step 3: Implement candidate normalization and orchestration**

Refactor normalization into:

```ts
export function normalizeMixtapeDraftCandidates(
  draft: LlmMixtapeDraft,
  confirmedTracks: readonly ConfirmedTrack[],
): { metadata: Omit<MixtapeResult['mixtape'], 'tracks'>; tasteProfile: TasteProfile; candidates: CatalogCandidate[] }
```

The orchestrator verifies candidates sequentially, assigns stable IDs only after verification, uses canonical catalog title/artist/album, preserves the LLM reason, sets `catalogStatus: 'verified'`, and maps iTunes matches to `platforms.appleMusic`. It logs only fixed diagnostic fields.

Add `CATALOG_UNAVAILABLE` and `CATALOG_VERIFICATION_FAILED` to `MixtapeAnalysisErrorCode`.

- [ ] **Step 4: Run orchestration and normalization tests**

Expected: all focused tests pass.

- [ ] **Step 5: Commit**

```bash
git add api/catalog/verifyMixtapeRecommendations.ts api/catalog/verifyMixtapeRecommendations.test.ts api/llm/normalizeMixtape.ts api/llm/normalizeMixtape.test.ts src/types/mixtapeAnalysis.ts
git commit -m "feat: return verified recommendations only"
```

---

### Task 8: API integration and verified result contract

**Files:**
- Modify: `api/generate-mixtape.ts`
- Modify: `api/generate-mixtape.test.ts`
- Modify: `src/types/mixtape.ts`
- Modify: `src/types/mixtape.test.ts`
- Modify: `src/components/FinalMixtape.test.tsx`
- Modify: `src/data/playlist.ts`

**Interfaces:**
- `POST /api/generate-mixtape` continues accepting the same reviewed-track request.
- Its success response contains one to eight tracks with `catalogStatus: 'verified'` only.

- [ ] **Step 1: Write failing API and schema tests**

Mock the catalog chain/orchestrator boundary. Assert a verified response renders `VERIFIED`; an unverified API payload fails schema parsing; catalog failure returns a retryable 502 issue; and the provider still receives only user-confirmed track fields.

- [ ] **Step 2: Run and verify RED**

Expected: existing tests still expect `unverified`, so focused tests fail for the intended contract change.

- [ ] **Step 3: Wire the API**

Construct iTunes and MusicBrainz providers per request, create the chain, call the verification orchestrator after the full LLM draft, and return the verified result. Update `statusForIssue` for catalog error codes. Change `MixtapeTrackSchema.catalogStatus` to `z.literal('verified')`.

Mark curated development fallback tracks verified only when their fixture platform references are real and existing. Do not mark synthetic test-only songs verified unless the test is explicitly exercising UI rendering with a typed verified fixture.

- [ ] **Step 4: Run API, schema, component, hook, and service tests**

Run:

```bash
rtk env PATH=/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin node_modules/.bin/vitest run api/generate-mixtape.test.ts src/types/mixtape.test.ts src/components/FinalMixtape.test.tsx src/hooks/useDjDochiFlow.test.ts src/services/mixtapeAnalysis.test.ts
```

Expected: all focused integration tests pass and no UI state-flow test changes beyond fixture status.

- [ ] **Step 5: Commit**

```bash
git add api/generate-mixtape.ts api/generate-mixtape.test.ts src/types/mixtape.ts src/types/mixtape.test.ts src/components/FinalMixtape.test.tsx src/data/playlist.ts
git commit -m "feat: integrate verified catalog results"
```

---

### Task 9: Documentation, live public-catalog checks, and full verification

**Files:**
- Modify: `docs/playlist-extraction-verification.md`
- Modify: `.env.example` only if optional non-secret overrides are documented.

- [ ] **Step 1: Update operational documentation**

Document:

- no Spotify/Apple credentials are required;
- iTunes-first and MusicBrainz-fallback behavior;
- four result statuses;
- provider timeouts;
- MusicBrainz rate limit and cache;
- maximum two replacement rounds;
- safe log fields;
- only verified tracks reach the LP.

- [ ] **Step 2: Run full test suite**

```bash
rtk env PATH=/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin node_modules/.bin/vitest run
```

Expected: all tests pass.

- [ ] **Step 3: Run TypeScript and production build**

```bash
rtk env PATH=/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin node_modules/.bin/tsc -b
rtk env PATH=/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/bin:/bin node_modules/.bin/vite build
```

Expected: both commands exit 0.

- [ ] **Step 4: Run live credential-free checks**

Start Vercel dev with the existing server-only OpenAI variables. Verify:

- a known iTunes song returns `verified` with a canonical link;
- an iTunes miss reaches MusicBrainz;
- a fabricated title+artist is `not_found` or `ambiguous`;
- the complete endpoint returns only `verified`;
- repeated candidates hit the cache;
- logs contain reason codes and retry counts but no track names.

- [ ] **Step 5: Inspect the final diff**

```bash
git diff --check
git status --short
```

Expected: no whitespace errors, no secret files staged, and unrelated user changes preserved.

- [ ] **Step 6: Commit documentation**

```bash
git add docs/playlist-extraction-verification.md .env.example
git commit -m "docs: explain catalog-verified recommendations"
```

