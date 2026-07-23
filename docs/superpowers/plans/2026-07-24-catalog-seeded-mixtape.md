# Catalog-Seeded Mixtape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace free-form LLM track generation with a catalog-first pipeline that returns exactly five verified tracks selected by candidate ID.

**Architecture:** OpenAI first produces only a taste profile. The server converts that profile and confirmed input artists into bounded search seeds, collects real iTunes and MusicBrainz candidates, normalizes and ranks them, and sends only the top 12–15 candidate IDs to the LLM for editorial selection. Canonical track metadata is hydrated from a server-side candidate map, never from LLM output.

**Tech Stack:** React 19, TypeScript, Vercel Functions, OpenAI Responses API with Zod structured outputs, iTunes Search API, MusicBrainz API, Vitest.

## Global Constraints

- Preserve the existing OCR, extraction review, LP, recording, camera, polaroid, and final-tape state flow.
- Do not modify the current sketch-theme work in `src/index.css`, `src/styles/sketch-theme.css`, or `src/styles/sketch-theme.test.ts`.
- LLM responsibilities are limited to taste analysis and candidate curation.
- Catalog providers are the only source of final title, artist, album, catalog ID, and URL.
- The LLM curation output contains `candidateId` and `reason`; it contains no title or artist fields.
- Collect 20–30 usable catalog candidates and shortlist 12–15 before curation.
- Return exactly five tracks, all with `catalogStatus: "verified"`.
- Exclude confirmed input title·artist pairs from recommendations.
- Allow another song by an input artist, but enforce at most one final song per artist.
- Bound iTunes concurrency to three.
- Share the existing MusicBrainz 1,100 ms rate gate and cap normal-path MusicBrainz network requests at three.
- Preserve the 35-second server budget and propagate browser cancellation to both LLM calls and every catalog request.
- Never log submitted track titles, artist names, prompts, raw catalog payloads, images, or API credentials.
- Distinguish `taste`, `catalog`, and `curation` failures in both API responses and UI copy.
- Do not fall back to unverified LLM-generated tracks.

Reference design: `docs/superpowers/specs/2026-07-24-catalog-seeded-mixtape-design.md`

---

### Task 1: Add the two-pass LLM contracts and task-specific prompts

**Files:**

- Modify: `src/services/llm/types.ts`
- Modify: `api/llm/openaiProvider.ts`
- Modify: `api/llm/openaiProvider.test.ts`
- Modify: `api/llm/provider.ts`
- Modify: `api/llm/provider.test.ts`
- Modify: `src/types/mixtapeAnalysis.ts`
- Modify: `prompts/dochi-mixtape-guide.md`
- Create: `prompts/dochi-taste-guide.md`
- Create: `prompts/dochi-curation-guide.md`
- Modify: `vercel.json`

**Interfaces:**

- Adds `TasteDiscoveryProfile`.
- Adds `CurationCandidate`.
- Adds `LlmMixtapeSelection`.
- Adds `CatalogSeededLlmProvider.analyzeTaste()` and `curateMixtape()`.
- Keeps the existing legacy methods temporarily so the API remains runnable until Task 7.

- [ ] **Step 1: Write failing OpenAI provider tests for taste-only analysis**

Add a test response and assertions equivalent to:

```ts
parseMock.mockResolvedValueOnce({
  output_parsed: {
    summary: '몽환적인 밤의 결을 좋아해.',
    genres: ['dream pop'],
    moods: ['late night'],
    traits: ['soft vocals'],
    searchKeywords: ['dreamy', 'ethereal', 'nocturnal'],
  },
})

const profile = await provider.analyzeTaste({
  tracks: [{ title: 'Space Song', artist: 'Beach House', album: '' }],
})

expect(profile.searchKeywords).toEqual(['dreamy', 'ethereal', 'nocturnal'])
expect(parseMock.mock.calls[0][0].text.format.schema.properties)
  .not.toHaveProperty('mixtape')
```

- [ ] **Step 2: Write failing curation tests for dynamic candidate IDs**

Use 12 fixed candidates in the test and assert:

```ts
const request = parseMock.mock.calls[0][0]
const candidateIdSchema = request.text.format.schema
  .properties.tracks.items.properties.candidateId

expect(candidateIdSchema.enum).toEqual(
  candidates.map(({ candidateId }) => candidateId),
)
expect(request.text.format.schema.properties.tracks)
  .toMatchObject({ minItems: 5, maxItems: 5 })

const userPayload = JSON.parse(request.input[1].content[0].text)
expect(userPayload.candidates[0]).toEqual({
  candidateId: 'itunes:1',
  title: 'Track 1',
  artist: 'Artist 1',
})
```

Also verify an unknown ID cannot be parsed and the curation schema exposes no LLM-authored `title` or `artist` output fields.

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```bash
rtk npm test -- api/llm/openaiProvider.test.ts api/llm/provider.test.ts
```

Expected: failures because `analyzeTaste`, `curateMixtape`, and the split prompt options do not exist.

- [ ] **Step 4: Add the provider-neutral two-pass types**

Add these contracts while retaining the current `LlmProvider` as a temporary compatibility interface:

```ts
export type TasteDiscoveryProfile = TasteProfile & {
  searchKeywords: string[]
}

export type CurationCandidate = {
  candidateId: string
  title: string
  artist: string
}

export type LlmMixtapeSelection = {
  title: string
  subtitle: string
  dochiComment: string
  design: TapeDesignMetadata
  tracks: Array<{
    candidateId: string
    reason: string
  }>
}

export interface CatalogSeededLlmProvider {
  readonly id: string
  analyzeTaste(
    input: { tracks: readonly LlmTrackInput[] },
    options?: LlmRequestOptions,
  ): Promise<TasteDiscoveryProfile>
  curateMixtape(
    input: {
      tasteProfile: TasteDiscoveryProfile
      candidates: readonly CurationCandidate[]
    },
    options?: LlmRequestOptions,
  ): Promise<LlmMixtapeSelection>
}
```

The concrete OpenAI provider may temporarily return
`LlmProvider & CatalogSeededLlmProvider`. Task 9 removes the legacy half.

- [ ] **Step 5: Add the new pipeline error codes without changing the issue shape yet**

Add the codes required by the two new provider methods:

```ts
| 'TASTE_ANALYSIS_FAILED'
| 'CURATION_INVALID_RESPONSE'
| 'CURATION_FAILED'
```

The `stage` field is added end to end in Task 8, after the API has switched to
the new orchestration. Until then, existing clients continue to parse the
current `{ code, message, retryable }` shape.

- [ ] **Step 6: Implement the two OpenAI structured-output methods**

Taste output must contain only:

```ts
const TasteDiscoveryProfileSchema = z.object({
  summary: z.string().min(1),
  genres: z.array(z.string().min(1)).min(1).max(8),
  moods: z.array(z.string().min(1)).min(1).max(8),
  traits: z.array(z.string().min(1)).min(1).max(8),
  searchKeywords: z.array(z.string().min(1)).min(1).max(10),
}).strict()
```

Build the curation schema for each request from the supplied IDs:

```ts
const candidateIds = [...new Set(
  candidates.map(({ candidateId }) => candidateId),
)]

if (candidateIds.length < 5) {
  throw new MixtapeAnalysisError({
    code: 'CURATION_INVALID_RESPONSE',
    message: '고를 수 있는 곡 후보가 충분하지 않아요.',
    retryable: true,
  })
}

const CandidateIdSchema = z.enum(
  candidateIds as [string, ...string[]],
)

const CurationSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().min(1),
  dochiComment: z.string().min(1),
  design: TapeDesignMetadataSchema,
  tracks: z.array(z.object({
    candidateId: CandidateIdSchema,
    reason: z.string().min(1),
  }).strict()).length(5),
}).strict()
```

Forward `options.signal` to both OpenAI calls. The user payload for curation contains only the taste profile and `{ candidateId, title, artist }`.

- [ ] **Step 7: Split the prompts and preserve the Dochi voice rules**

Keep `prompts/dochi-mixtape-guide.md` as the shared persona, `Forbidden`, and `Preferred` guide. Remove instructions that ask it to freely invent recommendation metadata.

`prompts/dochi-taste-guide.md` must say:

```md
- Analyze only confirmedTracks.
- Return no track recommendations and no new artist names.
- searchKeywords must be generic genre, mood, instrumentation, or listening-context terms.
```

`prompts/dochi-curation-guide.md` must say:

```md
- Select exactly five unique candidateId values from candidates.
- Never output a candidateId outside candidates.
- Use at most one track per artist.
- Do not rewrite title or artist metadata.
- Create only order, reasons, mixtape title, Dochi comment, and design metadata.
```

Change `vercel.json` to include all prompt files:

```json
{
  "functions": {
    "api/generate-mixtape.ts": {
      "includeFiles": "prompts/*.md"
    }
  }
}
```

- [ ] **Step 8: Run focused tests and verify GREEN**

Run:

```bash
rtk npm test -- api/llm/openaiProvider.test.ts api/llm/provider.test.ts
```

Expected: both suites pass, including signal forwarding and candidate-ID schema tests.

- [ ] **Step 9: Commit the isolated LLM contract change**

```bash
rtk git add src/services/llm/types.ts src/types/mixtapeAnalysis.ts api/llm/openaiProvider.ts api/llm/openaiProvider.test.ts api/llm/provider.ts api/llm/provider.test.ts prompts/dochi-mixtape-guide.md prompts/dochi-taste-guide.md prompts/dochi-curation-guide.md vercel.json
rtk git commit -m "feat: split taste analysis from mixtape curation"
```

---

### Task 2: Build a deterministic, bounded catalog search plan

**Files:**

- Create: `api/catalog/catalogSearchVocabulary.ts`
- Create: `api/catalog/buildCatalogSearchPlan.ts`
- Create: `api/catalog/buildCatalogSearchPlan.test.ts`
- Modify: `api/catalog/types.ts`
- Modify: `api/mixtapePipelineConfig.ts`

**Interfaces:**

```ts
export type CatalogSearchBucketKind =
  | 'genre'
  | 'genre_mood'
  | 'input_artist'
  | 'similar_artist'

export type CatalogSearchSeed = {
  id: string
  kind: CatalogSearchBucketKind
  term: string
  weight: number
  sourceArtist?: string
  catalogEvidence?: {
    provider: 'musicbrainz'
    entityId: string
    tag: string
  }
}
```

- [ ] **Step 1: Write failing vocabulary and search-plan tests**

Cover:

```ts
expect(normalizeTasteTerms(['몽환적', '늦은 밤']))
  .toEqual(expect.arrayContaining(['dreamy', 'ethereal', 'late night', 'nocturnal']))

expect(buildCatalogSearchPlan(profile, confirmedTracks).seeds)
  .toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'genre' }),
    expect.objectContaining({ kind: 'genre_mood' }),
    expect.objectContaining({ kind: 'input_artist', term: 'Beach House' }),
  ]))
```

Also assert:

- vague terms such as `좋은`, `감성적`, `힙한` are not standalone seeds;
- normalized duplicate terms are removed;
- input artist seeds come only from confirmed tracks;
- at most two input artists are used;
- the base plan is bounded so that later similar-artist insertion can still keep total iTunes searches at six.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
rtk npm test -- api/catalog/buildCatalogSearchPlan.test.ts
```

Expected: module-not-found failures.

- [ ] **Step 3: Implement the canonical vocabulary**

Use a versioned map rather than an LLM:

```ts
export const TASTE_TERM_ALIASES: Readonly<Record<string, readonly string[]>> = {
  '몽환적': ['dreamy', 'ethereal'],
  '몽환적인': ['dreamy', 'ethereal'],
  '인디 알앤비': ['indie r&b', 'alternative r&b'],
  '늦은 밤': ['late night', 'nocturnal'],
  '잔잔함': ['mellow', 'soft'],
  '잔잔한': ['mellow', 'soft'],
}

export const VAGUE_SEARCH_TERMS = new Set([
  '좋은',
  '감성적',
  '감성적인',
  '힙한',
])
```

Normalize NFKC, lowercase Latin terms, trim whitespace, and preserve meaningful Korean catalog terms that are not vague.

- [ ] **Step 4: Implement bounded seed generation**

Default order:

1. top two genre seeds;
2. up to two genre/mood combinations;
3. up to two confirmed input artists;
4. deduplicate by normalized term;
5. keep the highest weighted five base seeds so one catalog-resolved similar seed can be inserted without exceeding six iTunes searches.

Add final constants:

```ts
rawCandidateTarget: 25,
minimumRawCandidates: 20,
maximumRawCandidates: 30,
shortlistTarget: 15,
minimumShortlistCandidates: 12,
maximumShortlistCandidates: 15,
maximumItunesSearches: 6,
maximumMusicBrainzRequests: 3,
```

- [ ] **Step 5: Run focused tests and verify GREEN**

```bash
rtk npm test -- api/catalog/buildCatalogSearchPlan.test.ts
```

Expected: all vocabulary, deduplication, and query-bound tests pass.

- [ ] **Step 6: Commit**

```bash
rtk git add api/catalog/catalogSearchVocabulary.ts api/catalog/buildCatalogSearchPlan.ts api/catalog/buildCatalogSearchPlan.test.ts api/catalog/types.ts api/mixtapePipelineConfig.ts
rtk git commit -m "feat: build bounded catalog search plans"
```

---

### Task 3: Extend iTunes and MusicBrainz from exact verification to discovery

**Files:**

- Modify: `api/catalog/types.ts`
- Modify: `api/catalog/itunesCatalogProvider.ts`
- Modify: `api/catalog/itunesCatalogProvider.test.ts`
- Modify: `api/catalog/musicBrainzCatalogProvider.ts`
- Modify: `api/catalog/musicBrainzCatalogProvider.test.ts`
- Modify: `api/catalog/ttlCache.ts`
- Modify: `api/catalog/ttlCache.test.ts`

**Interfaces:**

```ts
export type CatalogDiscoveredTrack = {
  provider: 'itunes' | 'musicbrainz'
  catalogId: string
  title: string
  artist: string
  album: string
  url: string | null
  durationMs: number | null
  primaryGenre: string
  providerScore: number
}

export type CatalogDiscoveryResult =
  | { status: 'ok'; tracks: readonly CatalogDiscoveredTrack[] }
  | {
      status: 'unavailable'
      reason: 'timeout' | 'rate_limited' | 'network' | 'invalid_response'
    }

export interface CatalogDiscoveryProvider {
  search(
    seed: CatalogSearchSeed,
    signal?: AbortSignal,
  ): Promise<CatalogDiscoveryResult>
}
```

MusicBrainz additionally provides a conservative similar-artist seed resolver:

```ts
export interface SimilarArtistSeedResolver {
  findSimilarArtistSeed(
    inputArtist: string,
    signal?: AbortSignal,
  ): Promise<CatalogSearchSeed | null>
}
```

- [ ] **Step 1: Write failing iTunes discovery tests**

Assert the discovery request uses:

```ts
expect(url.searchParams.get('term')).toBe(seed.term)
expect(url.searchParams.get('limit')).toBe('25')
```

Assert mapped tracks include `primaryGenreName`, reciprocal-rank `providerScore`, canonical Apple Music URL, and `itunes:{trackId}` can be formed later without another lookup.

Also cover timeout, caller abort, invalid JSON, empty results, and term-level TTL caching.

- [ ] **Step 2: Write failing MusicBrainz discovery and safe similar-seed tests**

Cover:

- genre/mood recording search uses `tag:"..." AND status:official`;
- input-artist recording search uses `artist:"..." AND status:official`;
- provider search score is normalized to `0..1`;
- one shared rate gate applies to verify, discovery, artist resolution, and tag expansion;
- exact input artist resolution accepts exact names or aliases only;
- a similar seed is returned only from catalog-provided overlapping tags and high-confidence artist entities;
- missing tags, low search score, caller abort, or ambiguous names return `null`;
- the LLM is never called and no model-produced artist name enters this path.

- [ ] **Step 3: Run focused tests and verify RED**

```bash
rtk npm test -- api/catalog/itunesCatalogProvider.test.ts api/catalog/musicBrainzCatalogProvider.test.ts api/catalog/ttlCache.test.ts
```

Expected: discovery methods and cache helper are missing.

- [ ] **Step 4: Refactor each provider around one request/parser path**

iTunes should reuse one internal request:

```ts
async function requestSongs(
  term: string,
  limit: number,
  externalSignal?: AbortSignal,
): Promise<CatalogDiscoveryResult>
```

Exact `verify()` keeps its conservative `selectCatalogMatch()` behavior. New `search()` returns canonical catalog rows without pretending they match an LLM suggestion.

MusicBrainz should keep one shared `RateGate`. Add request helpers for:

- recording search;
- exact artist/alias resolution;
- high-confidence tag-based related-artist discovery.

The similar expansion returns one `similar_artist` search seed backed by MusicBrainz evidence. If the seed is tag-based, it may yield multiple real artists; if evidence is insufficient, return `null` and rely on input-artist seeds.

- [ ] **Step 5: Add reusable promise caching**

Extend the existing TTL utility or add a provider-local `TtlCache<string, Promise<CatalogDiscoveryResult>>` so identical normalized terms do not cause repeated requests. Do not cache `unavailable` results.

- [ ] **Step 6: Run focused tests and verify GREEN**

```bash
rtk npm test -- api/catalog/itunesCatalogProvider.test.ts api/catalog/musicBrainzCatalogProvider.test.ts api/catalog/ttlCache.test.ts
```

Expected: all exact-verification and discovery tests pass.

- [ ] **Step 7: Commit**

```bash
rtk git add api/catalog/types.ts api/catalog/itunesCatalogProvider.ts api/catalog/itunesCatalogProvider.test.ts api/catalog/musicBrainzCatalogProvider.ts api/catalog/musicBrainzCatalogProvider.test.ts api/catalog/ttlCache.ts api/catalog/ttlCache.test.ts
rtk git commit -m "feat: add catalog candidate discovery"
```

---

### Task 4: Collect, normalize, deduplicate, and bound verified candidates

**Files:**

- Create: `api/catalog/collectCatalogCandidates.ts`
- Create: `api/catalog/collectCatalogCandidates.test.ts`
- Modify: `api/catalog/trackIdentity.ts`
- Modify: `api/catalog/trackIdentity.test.ts`
- Modify: `api/catalog/types.ts`

**Interfaces:**

```ts
export type CatalogPoolTrack = CatalogDiscoveredTrack & {
  id: string
  sourceBucketIds: string[]
  sourceKinds: CatalogSearchBucketKind[]
  providerScore: number
  relevanceScore: number
  catalogStatus: 'verified'
}

export type CatalogCandidateCollection = {
  tracks: CatalogPoolTrack[]
  attemptedSeeds: number
  itunesCalls: number
  musicBrainzCalls: number
  unavailableCalls: number
}
```

- [ ] **Step 1: Write failing collector tests**

Use fake discovery providers and assert:

- iTunes searches never exceed concurrency three;
- total iTunes searches never exceed six;
- MusicBrainz network usage never exceeds three;
- caller `AbortSignal` reaches every provider call;
- a safe similar seed is inserted before the final search list is capped;
- an uncertain similar expansion produces no `similar_artist` search;
- MusicBrainz recording discovery runs only when the iTunes pool is below 20 or a required bucket lacks coverage;
- collection stops before `deadlineAt - stopBufferMs`.

- [ ] **Step 2: Write failing normalization tests**

Assert:

```ts
expect(result.tracks).toHaveLength(30)
expect(new Set(
  result.tracks.map((track) => artistIdentityKey(track.artist)),
).size)
  .toBe(result.tracks.length)
expect(result.tracks).not.toContainEqual(
  expect.objectContaining({ title: 'Space Song', artist: 'Beach House' }),
)
```

Cover:

- NFKC title·artist identity;
- input title·artist exclusion;
- iTunes/MusicBrainz duplicate merge;
- iTunes metadata preference when a store URL exists;
- unsupported live/remix/remaster/acoustic/instrumental/edit/version tracks are excluded unless the taste profile explicitly asks for that form;
- at most one raw candidate per artist;
- at most one candidate per album when enough alternatives exist;
- every retained row has catalog provenance and `catalogStatus: "verified"`;
- output is capped at 30.

- [ ] **Step 3: Run focused tests and verify RED**

```bash
rtk npm test -- api/catalog/collectCatalogCandidates.test.ts api/catalog/trackIdentity.test.ts
```

Expected: collector module and exported normalization helpers are missing.

- [ ] **Step 4: Export reusable identity/version helpers**

Keep existing exact verification behavior unchanged and expose only the helpers required by discovery:

```ts
export function normalizedCatalogText(value: string): string
export function trackIdentityKey(
  track: Pick<CatalogCandidate, 'title' | 'artist'>,
): string
export function artistIdentityKey(artist: string): string
export function hasUnsupportedVersion(
  title: string,
  allowedVersionTerms: ReadonlySet<string>,
): boolean
```

- [ ] **Step 5: Implement bounded parallel collection**

Use a local helper:

```ts
async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  worker: (value: T) => Promise<R>,
): Promise<R[]>
```

Collection order:

1. build the five base seeds;
2. use MusicBrainz evidence to attempt one safe similar expansion while time remains;
3. insert the safe seed and cap the iTunes plan at six by dropping the lowest-weight unstarted seed;
4. run iTunes searches with concurrency three;
5. normalize, merge, and assess bucket coverage;
6. use remaining MusicBrainz request capacity only for an under-covered high-priority seed;
7. stop at 30 usable tracks or the deadline buffer.

The request counter, not call-site convention, enforces the three-request MusicBrainz cap.

- [ ] **Step 6: Run focused tests and verify GREEN**

```bash
rtk npm test -- api/catalog/collectCatalogCandidates.test.ts api/catalog/trackIdentity.test.ts
```

Expected: all collector, deduplication, version, limit, and abort tests pass.

- [ ] **Step 7: Commit**

```bash
rtk git add api/catalog/collectCatalogCandidates.ts api/catalog/collectCatalogCandidates.test.ts api/catalog/trackIdentity.ts api/catalog/trackIdentity.test.ts api/catalog/types.ts
rtk git commit -m "feat: collect verified catalog candidate pools"
```

---

### Task 5: Rank candidates and produce a bucket-aware 12–15 track shortlist

**Files:**

- Create: `api/catalog/rankCatalogCandidates.ts`
- Create: `api/catalog/rankCatalogCandidates.test.ts`
- Modify: `api/mixtapePipelineConfig.ts`

**Interfaces:**

```ts
export function scoreCatalogCandidate(
  track: CatalogPoolTrack,
  context: {
    tasteProfile: TasteDiscoveryProfile
    inputArtists: ReadonlySet<string>
  },
): number

export function shortlistCatalogCandidates(
  tracks: readonly CatalogPoolTrack[],
  context: {
    tasteProfile: TasteDiscoveryProfile
    inputArtists: ReadonlySet<string>
  },
): CatalogPoolTrack[]
```

- [ ] **Step 1: Write failing relevance-score tests**

Construct candidates where each factor changes independently and assert the configured weighted sum:

```ts
const RELEVANCE_WEIGHTS = {
  sourceQuery: 0.35,
  tasteOverlap: 0.25,
  repeatedDiscovery: 0.20,
  providerConfidence: 0.10,
  noveltyAndVersion: 0.10,
} as const
```

Required rules:

- source seed weight contributes 35%;
- normalized genre/tag/keyword overlap contributes 25%;
- discovery from independent buckets contributes 20%;
- MusicBrainz score or iTunes reciprocal rank contributes 10%;
- clean canonical version and non-input artist novelty contributes 10%;
- input artists receive only a small novelty penalty, not exclusion;
- missing album data does not invalidate a candidate.

- [ ] **Step 2: Write failing shortlist diversity tests**

Assert:

- target length is 15 when enough candidates exist;
- accepted minimum is 12;
- artists are unique;
- genre buckets reserve at least four total slots;
- genre/mood buckets reserve at least three total slots;
- input-artist buckets use at most two total slots;
- similar-artist bucket reserves two slots when two distinct catalog-backed artists are available;
- if a safe similar bucket has capacity for only one distinct artist, reserve one and redistribute the unused slot;
- unused quota is filled by global score;
- at least two source kinds remain when available.

- [ ] **Step 3: Run the focused test and verify RED**

```bash
rtk npm test -- api/catalog/rankCatalogCandidates.test.ts
```

Expected: ranker module is missing.

- [ ] **Step 4: Implement deterministic scoring and quota-first selection**

Selection algorithm:

1. compute and store `relevanceScore`;
2. group by source kind;
3. reserve quota picks in descending score while maintaining unique artists;
4. reserve similar-artist slots only up to that bucket’s distinct-artist capacity;
5. redistribute unused quotas;
6. fill remaining slots by global score while alternating source kinds when scores are close;
7. stop at `shortlistTarget`;
8. reject a shortlist smaller than `minimumShortlistCandidates`.

No random shuffle is allowed; equal scores use stable `id` ordering.

- [ ] **Step 5: Run focused tests and verify GREEN**

```bash
rtk npm test -- api/catalog/rankCatalogCandidates.test.ts
```

Expected: all score, quota, redistribution, and uniqueness tests pass.

- [ ] **Step 6: Commit**

```bash
rtk git add api/catalog/rankCatalogCandidates.ts api/catalog/rankCatalogCandidates.test.ts api/mixtapePipelineConfig.ts
rtk git commit -m "feat: rank diverse mixtape candidates"
```

---

### Task 6: Validate candidate-ID curation and hydrate the verified final result

**Files:**

- Create: `api/catalog/assembleVerifiedMixtape.ts`
- Create: `api/catalog/assembleVerifiedMixtape.test.ts`
- Modify: `src/types/mixtape.ts`
- Modify: `src/types/mixtape.test.ts`

**Interfaces:**

```ts
export function assembleVerifiedMixtape(options: {
  tasteProfile: TasteDiscoveryProfile
  selection: LlmMixtapeSelection
  shortlist: readonly CatalogPoolTrack[]
  confirmedTracks: readonly ConfirmedTrack[]
}): MixtapeResult
```

- [ ] **Step 1: Write failing candidate-guard tests**

Reject:

- fewer or more than five selected IDs;
- duplicate selected IDs;
- an ID outside the shortlist;
- two selected tracks by the same normalized artist;
- a selected title·artist pair present in confirmed input;
- empty recommendation reasons.

Every rejection must be a `CURATION_INVALID_RESPONSE` error, never a catalog-verification error.

- [ ] **Step 2: Write failing hydration tests**

Assert:

```ts
expect(result.mixtape.tracks).toEqual([
  expect.objectContaining({
    id: 'itunes:123',
    title: shortlist[0].title,
    artist: shortlist[0].artist,
    album: shortlist[0].album,
    catalogStatus: 'verified',
  }),
  // four more
])
```

Also assert:

- an iTunes row populates `platforms.appleMusic.id` and `.url`;
- a MusicBrainz-only row does not pretend to have an Apple Music ID;
- LLM text cannot overwrite title, artist, album, URL, or catalog ID;
- taste `searchKeywords` are not required by the public `MixtapeResult` schema;
- final result parses through `MixtapeResultSchema`.

- [ ] **Step 3: Run the focused tests and verify RED**

```bash
rtk npm test -- api/catalog/assembleVerifiedMixtape.test.ts src/types/mixtape.test.ts
```

Expected: assembler module is missing.

- [ ] **Step 4: Implement candidate-map assembly**

Build the map before reading the selection:

```ts
const candidatesById = new Map(
  shortlist.map((candidate) => [candidate.id, candidate]),
)
```

Use canonical candidate fields for metadata and only selection fields for:

- final order;
- `reason`;
- title, subtitle, Dochi comment, and tape design.

Strip `searchKeywords` when assigning the public `tasteProfile`.

- [ ] **Step 5: Run focused tests and verify GREEN**

```bash
rtk npm test -- api/catalog/assembleVerifiedMixtape.test.ts src/types/mixtape.test.ts
```

Expected: exactly five verified tracks hydrate from the candidate map.

- [ ] **Step 6: Commit**

```bash
rtk git add api/catalog/assembleVerifiedMixtape.ts api/catalog/assembleVerifiedMixtape.test.ts src/types/mixtape.ts src/types/mixtape.test.ts
rtk git commit -m "feat: hydrate verified candidate selections"
```

---

### Task 7: Switch `/api/generate-mixtape` to the catalog-seeded pipeline

**Files:**

- Modify: `api/generate-mixtape.ts`
- Modify: `api/generate-mixtape.test.ts`
- Modify: `api/llm/provider.ts`
- Modify: `api/llm/provider.test.ts`
- Modify: `api/mixtapePipelineConfig.ts`

**Pipeline order:**

```text
analyzeTaste
  -> buildCatalogSearchPlan
  -> collectCatalogCandidates
  -> shortlistCatalogCandidates
  -> curateMixtape
  -> assembleVerifiedMixtape
```

- [ ] **Step 1: Replace old API mocks with stage-specific module mocks**

Mock:

- `provider.analyzeTaste`;
- `buildCatalogSearchPlan`;
- `collectCatalogCandidates`;
- `shortlistCatalogCandidates`;
- `provider.curateMixtape`;
- `assembleVerifiedMixtape`.

Delete expectations for `generateReplacementTracks` and `verifyMixtapeRecommendations`.

- [ ] **Step 2: Write failing orchestration-order and payload-boundary tests**

Assert:

```ts
expect(provider.analyzeTaste).toHaveBeenCalledBefore(itunes.search)
expect(provider.curateMixtape).toHaveBeenCalledWith({
  tasteProfile,
  candidates: shortlist.map(({ id, title, artist }) => ({
    candidateId: id,
    title,
    artist,
  })),
}, { signal: expect.any(AbortSignal) })
```

Verify the curation payload contains no album URL, provider score, raw query, user image, or platform credential.

- [ ] **Step 3: Write failing catalog and curation boundary tests**

Cover:

- fewer than 20 raw usable candidates returns `CATALOG_CANDIDATES_INSUFFICIENT`;
- fewer than 12 shortlist candidates returns `CATALOG_CANDIDATES_INSUFFICIENT`;
- invalid or unknown curation IDs trigger at most one curation retry while time remains;
- no retry begins inside the final stop buffer;
- two invalid curation attempts return `CURATION_INVALID_RESPONSE`;
- browser abort reaches both LLM stages and all discovery calls;
- a valid selection returns exactly five verified tracks.

- [ ] **Step 4: Write failing safe-metrics tests**

Expected stages:

```text
taste_analysis
catalog_discovery
candidate_ranking
mixtape_curation
result_assembly
```

Logs may include:

- stage duration;
- elapsed and remaining time;
- iTunes and MusicBrainz call counts;
- raw candidate count;
- shortlist count;
- selected count;
- error code. Task 8 adds the explicit error stage to these same safe logs.

Assert serialized logs do not contain submitted track titles, artists, candidate titles, prompt text, or API response bodies.

- [ ] **Step 5: Run the focused API test and verify RED**

```bash
rtk npm test -- api/generate-mixtape.test.ts api/llm/provider.test.ts
```

Expected: old free-generation and verification orchestration does not satisfy the new call-order tests.

- [ ] **Step 6: Implement the new orchestration**

Read and combine prompts at module startup:

```ts
const BASE_GUIDE = readFileSync(
  new URL('../prompts/dochi-mixtape-guide.md', import.meta.url),
  'utf8',
)
const TASTE_GUIDE = readFileSync(
  new URL('../prompts/dochi-taste-guide.md', import.meta.url),
  'utf8',
)
const CURATION_GUIDE = readFileSync(
  new URL('../prompts/dochi-curation-guide.md', import.meta.url),
  'utf8',
)
```

Create the provider with separate guide options. Then execute the six pipeline stages using the existing combined browser/deadline signal.

If curation validation throws `CURATION_INVALID_RESPONSE`, retry once only when:

```ts
Date.now() < deadlineAt - MIXTAPE_PIPELINE.stopBufferMs
```

Do not retry taste analysis or rerun catalog discovery within the same request.

- [ ] **Step 7: Run focused tests and verify GREEN**

```bash
rtk npm test -- api/generate-mixtape.test.ts api/llm/provider.test.ts
```

Expected: call order, payload boundaries, deadline, cancellation, retry cap, safe logs, and five-track success all pass.

- [ ] **Step 8: Commit**

```bash
rtk git add api/generate-mixtape.ts api/generate-mixtape.test.ts api/llm/provider.ts api/llm/provider.test.ts api/mixtapePipelineConfig.ts
rtk git commit -m "feat: run catalog-seeded mixtape pipeline"
```

---

### Task 8: Separate taste, catalog, and curation errors end to end

**Files:**

- Modify: `src/types/mixtapeAnalysis.ts`
- Create: `src/types/mixtapeAnalysis.test.ts`
- Modify: `src/types/mixtape.ts`
- Modify: `src/services/mixtapeAnalysis.ts`
- Modify: `src/services/mixtapeAnalysis.test.ts`
- Modify: `src/hooks/useDjDochiFlow.ts`
- Modify: `src/hooks/useDjDochiFlow.test.ts`
- Modify: `src/components/TasteAnalysisErrorPanel.tsx`
- Modify: `src/components/TasteAnalysisErrorPanel.test.tsx`
- Modify: `src/components/DochiRoom.tsx`
- Modify: `api/generate-mixtape.ts`
- Modify: `api/generate-mixtape.test.ts`
- Modify: `api/llm/openaiProvider.ts`
- Modify: `api/llm/provider.ts`
- Modify: `api/catalog/assembleVerifiedMixtape.ts`

**Final error contract:**

```ts
export type MixtapeAnalysisStage = 'taste' | 'catalog' | 'curation'

export type MixtapeAnalysisIssue = {
  code: MixtapeAnalysisErrorCode
  stage: MixtapeAnalysisStage
  message: string
  retryable: boolean
}
```

- [ ] **Step 1: Write failing parsing and error-class tests**

Assert `stage` survives:

- server JSON parsing;
- `MixtapeAnalysisError`;
- hook state;
- retry behavior.

Malformed or legacy server issues without a stage should map conservatively to `taste`, not crash the UI.

- [ ] **Step 2: Write failing UI-copy tests**

Render all stages:

```ts
expect(headingFor('taste')).toBe('취향을 읽지 못했어.')
expect(headingFor('catalog')).toBe(
  '취향은 읽었는데, 확인되는 곡을 충분히 찾지 못했어.',
)
expect(headingFor('curation')).toBe(
  '취향은 읽었는데, 확인되는 곡을 충분히 찾지 못했어.',
)
```

For curation, the body must contain:

```text
곡을 고르는 중에 문제가 생겼어. 다시 골라볼게.
```

- [ ] **Step 3: Run focused tests and verify RED**

```bash
rtk npm test -- src/types/mixtapeAnalysis.test.ts src/services/mixtapeAnalysis.test.ts src/hooks/useDjDochiFlow.test.ts src/components/TasteAnalysisErrorPanel.test.tsx api/generate-mixtape.test.ts
```

Expected: stage is absent and the heading is hardcoded.

- [ ] **Step 4: Add final stage-specific codes**

Retain compatibility codes where needed, and add:

```ts
| 'TASTE_ANALYSIS_FAILED'
| 'CATALOG_CANDIDATES_INSUFFICIENT'
| 'CURATION_INVALID_RESPONSE'
| 'CURATION_FAILED'
```

Stage assignment:

- provider configuration, OpenAI taste response, and taste timeout: `taste`;
- catalog unavailable, insufficient pool, insufficient shortlist: `catalog`;
- candidate-ID schema, duplicate artist, unknown ID, curation timeout: `curation`.

The outer 35-second timeout uses the stage that was active when it expired.

- [ ] **Step 5: Pass the complete issue object to the UI**

Change the component API to:

```ts
type TasteAnalysisErrorPanelProps = {
  issue: MixtapeAnalysisIssue
  onRetry: () => void
  onChooseImage: () => void
  onChooseText: () => void
}
```

`DochiRoom` passes `tasteAnalysisError` directly. The React state name remains unchanged to avoid widening the game state machine.

- [ ] **Step 6: Run focused tests and verify GREEN**

```bash
rtk npm test -- src/types/mixtapeAnalysis.test.ts src/services/mixtapeAnalysis.test.ts src/hooks/useDjDochiFlow.test.ts src/components/TasteAnalysisErrorPanel.test.tsx api/generate-mixtape.test.ts
```

Expected: each stage uses accurate API data and UI copy; reviewed tracks remain available for retry.

- [ ] **Step 7: Commit**

```bash
rtk git add src/types/mixtapeAnalysis.ts src/types/mixtapeAnalysis.test.ts src/types/mixtape.ts src/services/mixtapeAnalysis.ts src/services/mixtapeAnalysis.test.ts src/hooks/useDjDochiFlow.ts src/hooks/useDjDochiFlow.test.ts src/components/TasteAnalysisErrorPanel.tsx src/components/TasteAnalysisErrorPanel.test.tsx src/components/DochiRoom.tsx api/generate-mixtape.ts api/generate-mixtape.test.ts api/llm/openaiProvider.ts api/llm/provider.ts api/catalog/assembleVerifiedMixtape.ts
rtk git commit -m "fix: report mixtape failures by pipeline stage"
```

---

### Task 9: Retire the free-generation path and run the complete verification gate

**Files:**

- Modify: `src/services/llm/types.ts`
- Modify: `api/llm/openaiProvider.ts`
- Modify: `api/llm/openaiProvider.test.ts`
- Delete: `api/llm/normalizeMixtape.ts`
- Delete: `api/llm/normalizeMixtape.test.ts`
- Delete: `api/catalog/verifyMixtapeRecommendations.ts`
- Delete: `api/catalog/verifyMixtapeRecommendations.test.ts`
- Verify only: all OCR, room, LP, camera, polaroid, and final-tape files

- [ ] **Step 1: Prove the old path is unused**

Run:

```bash
rtk rg -n "generateMixtape|generateReplacementTracks|verifyMixtapeRecommendations|normalizeMixtape" api src
```

Expected before cleanup: references exist only in legacy provider definitions/tests and retired files, not in `api/generate-mixtape.ts`.

- [ ] **Step 2: Remove legacy provider methods and retired pipeline files**

Rename the catalog-seeded interface to the final `LlmProvider`:

```ts
export interface LlmProvider {
  readonly id: string
  analyzeTaste(...): Promise<TasteDiscoveryProfile>
  curateMixtape(...): Promise<LlmMixtapeSelection>
}
```

Remove:

- free-form recommendation schemas;
- `generateMixtape`;
- `generateReplacementTracks`;
- replacement prompt mode;
- old normalization and post-generation verification orchestration.

Keep exact catalog `verify()` methods and `CatalogProviderChain` only if another tested path still imports them; otherwise leave them as isolated reusable utilities without reconnecting them to the new API.

- [ ] **Step 3: Run all focused pipeline tests**

```bash
rtk npm test -- api/llm api/catalog api/generate-mixtape.test.ts src/services/mixtapeAnalysis.test.ts src/hooks/useDjDochiFlow.test.ts src/components/TasteAnalysisErrorPanel.test.tsx
```

Expected: all catalog-seeded pipeline tests pass.

- [ ] **Step 4: Run the full test suite once**

```bash
rtk npm test
```

Expected: every Vitest suite passes, including existing OCR, LP, camera, polaroid, platform-button, and FinalMixtape tests.

- [ ] **Step 5: Run TypeScript once**

```bash
rtk npx tsc -b
```

Expected: exit code 0 with no type errors.

- [ ] **Step 6: Run the production build once**

```bash
rtk npm run build
```

Expected: TypeScript and Vite production build complete successfully.

- [ ] **Step 7: Perform one local safe-metrics check**

Start the serverless development runtime:

```bash
rtk npx vercel dev
```

Submit one reviewed-track request through the UI or `/api/generate-mixtape`. Confirm:

- response contains exactly five tracks;
- every track has `catalogStatus: "verified"`;
- every selected ID was in the server shortlist;
- no artist appears twice;
- request completes inside 35 seconds;
- logs show stage timings and counts only.

Do not paste API keys, user images, or full playlist content into captured logs.

- [ ] **Step 8: Inspect the final diff without touching unrelated theme files**

```bash
rtk git status --short
rtk git diff --stat
rtk git diff --check
```

Expected: no whitespace errors. Existing sketch-theme changes remain unstaged and unchanged unless separately requested.

- [ ] **Step 9: Commit the cleanup**

```bash
rtk git add src/services/llm/types.ts api/llm/openaiProvider.ts api/llm/openaiProvider.test.ts api/llm/normalizeMixtape.ts api/llm/normalizeMixtape.test.ts api/catalog/verifyMixtapeRecommendations.ts api/catalog/verifyMixtapeRecommendations.test.ts
rtk git commit -m "refactor: remove unverified recommendation generation"
```

## Final Acceptance Checklist

- [ ] The LLM taste response contains no track recommendation fields.
- [ ] Similar-artist discovery uses catalog evidence only and safely falls back to confirmed input artists.
- [ ] Raw catalog pool contains 20–30 real candidate rows.
- [ ] Server relevance scoring reduces the pool to 12–15 distinct artists.
- [ ] Search-bucket quotas preserve genre, mood, input-artist, and safe similar-artist coverage.
- [ ] The LLM receives only candidate ID, title, and artist.
- [ ] The LLM returns exactly five unique allowed candidate IDs.
- [ ] Final title, artist, album, catalog ID, and URL all come from the candidate map.
- [ ] Final result contains exactly five verified tracks and at most one per artist.
- [ ] No free-form LLM recommendation or replacement loop remains active.
- [ ] Taste, catalog, and curation failures show accurate Korean copy.
- [ ] Browser cancellation and the 35-second budget reach all external requests.
- [ ] Logs contain metrics but no private playlist content.
- [ ] Focused tests, full tests, TypeScript, and production build pass.
