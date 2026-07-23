# DJ DOCHI Catalog-Seeded Mixtape Design

## Goal

DJ DOCHI의 추천 구조를 “LLM이 곡을 자유 생성한 뒤 검증”하는 방식에서 “실재 카탈로그 후보를 먼저 수집한 뒤 LLM이 후보 ID만 선택”하는 방식으로 바꾼다.

최종 파이프라인은 다음 책임 경계를 지킨다.

- LLM은 사용자가 확인한 입력곡으로 취향을 분석한다.
- iTunes Search와 MusicBrainz가 실재하는 추천 후보를 제공한다.
- 서버가 후보를 정규화하고 관련성·다양성을 계산한다.
- LLM은 서버가 제공한 후보 ID 중 정확히 5개만 선택한다.
- 최종 곡명, 아티스트, 앨범, 플랫폼 참조는 후보 Map에서 가져온다.
- 최종 추천곡은 모두 `catalogStatus: "verified"`다.

기존 OCR, 검수, LP, 카메라, 폴라로이드, FinalMixtape 흐름은 유지한다.

## Current Problem

현재 `/api/generate-mixtape`는 LLM이 제목과 아티스트를 자유롭게 생성한 뒤 iTunes와 MusicBrainz에서 실재 여부를 확인한다. 프롬프트가 실존곡만 요청해도 모델은 잘못된 제목·아티스트 조합을 만들 수 있다. 이 경우 초기 추천과 한 번의 교체 추천이 모두 카탈로그에서 탈락하고 `CATALOG_VERIFICATION_FAILED`가 발생한다.

또한 서버의 실제 실패는 추천곡 검증인데 React 화면은 모든 실패를 “취향을 읽지 못했어.”로 표시한다. 취향 분석 성공과 추천 후보 부족을 구분해야 한다.

## Scope

### Included

- 취향 분석 전용 LLM 응답
- 취향 프로필 기반 카탈로그 검색 계획
- iTunes 및 MusicBrainz 후보 수집
- 입력 아티스트 검색과 보수적인 유사 아티스트 seed 확장
- 카탈로그 후보 20~30곡 수집
- 관련성 점수와 검색 버킷 다양성을 이용한 12~15곡 shortlist
- shortlist ID만 사용하는 LLM 큐레이션
- 후보 Map 기반 최종 결과 조립
- 아티스트당 최대 1곡
- `taste`, `catalog`, `curation` 오류 단계
- 35초 서버 처리 예산과 취소 신호 전파
- 단위, 통합, API, UI 회귀 테스트

### Excluded

- Spotify 및 Apple Music 공식 개발자 인증
- 사용자 라이브러리나 플레이리스트 생성
- 영구 후보 데이터베이스
- 임베딩 또는 벡터 검색
- Last.fm 등 새로운 외부 추천 서비스
- 음악 미리듣기 재생

## Approaches Considered

### 1. Catalog pool followed by constrained LLM curation

카탈로그에서 20~30곡을 수집하고 서버가 12~15곡으로 줄인 뒤 LLM이 후보 ID 5개를 선택한다.

장점:

- 존재하지 않는 곡이 최종 결과에 들어갈 수 없다.
- 도치의 취향 해석, 순서, 추천 이유, 카세트 디자인을 유지한다.
- 현재 Provider 구조를 확장하기 쉽다.

단점:

- 검색어 계획과 후보 랭킹 품질이 추천 품질에 직접 영향을 준다.
- LLM 호출이 취향 분석과 큐레이션 두 번 필요하다.

### 2. Deterministic server selection with LLM copywriting only

서버 점수로 최종 5곡을 선택하고 LLM은 추천 이유와 믹스테이프 문구만 생성한다.

장점:

- 가장 빠르고 결정론적이다.
- 후보 밖 선택 오류가 없다.

단점:

- 장르와 무드 사이의 자연스러운 흐름을 편집하는 능력이 약하다.
- 추천 결과가 검색 점수 순위처럼 느껴질 수 있다.

### 3. MusicBrainz relationship graph discovery

입력 아티스트의 MusicBrainz 관계와 태그를 따라 유사 아티스트와 녹음을 확장한다.

장점:

- 낯선 아티스트와 긴 꼬리 음악을 발견하기 좋다.

단점:

- MusicBrainz의 초당 1회 호출 제한과 35초 서버 예산이 충돌한다.
- 관계 데이터는 음악적 유사성보다 멤버십·협업 관계가 중심일 수 있다.

### Decision

1번을 사용한다. iTunes를 빠른 1차 후보 수집기로 사용하고 MusicBrainz를 태그 기반 보충과 실재 아티스트 seed 확인에 사용한다. 유사 아티스트 확장이 불확실하면 입력 아티스트 검색까지만 사용한다.

## Architecture

```text
confirmed tracks
  -> LLM analyzeTaste()
  -> TasteDiscoveryProfile
  -> buildCatalogSearchPlan()
  -> iTunes discovery + MusicBrainz discovery
  -> normalize / deduplicate / exclude input tracks
  -> enforce artist and version rules
  -> raw verified pool: 20..30
  -> relevance scoring + bucket-aware shortlist
  -> shortlist: 12..15
  -> LLM curateMixtape(candidate IDs only)
  -> validate five unique allowed IDs
  -> hydrate selected IDs from CatalogCandidateMap
  -> verified MixtapeResult
  -> existing LP flow
```

The pipeline remains inside the existing `/api/generate-mixtape` request. React continues to wait in `analyzingTaste` and proceeds to `receivingInput` only after the server returns a verified result.

## LLM Provider Contract

The current `generateMixtape()` and `generateReplacementTracks()` responsibilities are replaced by two Provider-neutral methods.

```ts
type TasteDiscoveryProfile = {
  summary: string
  genres: string[]
  moods: string[]
  traits: string[]
  searchKeywords: string[]
}

type CurationCandidate = {
  candidateId: string
  title: string
  artist: string
}

type LlmMixtapeSelection = {
  title: string
  subtitle: string
  dochiComment: string
  design: TapeDesignMetadata
  tracks: Array<{
    candidateId: string
    reason: string
  }>
}

interface LlmProvider {
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

### Taste prompt

The taste prompt may produce genres, moods, traits, and generic search keywords. It must not return track recommendations or artist names that are not in the confirmed input.

### Curation prompt

The curation prompt receives:

- the completed taste profile;
- candidate ID;
- canonical title;
- canonical artist.

It does not receive raw catalog payloads, query URLs, user images, or platform credentials. The output does not contain title or artist fields.

The structured output schema uses the actual candidate ID list as a dynamic enum. It requires exactly five entries. Server validation also requires:

- five unique candidate IDs;
- every ID exists in the shortlist;
- every selected candidate has a different artist;
- every reason is non-empty;
- no input title·artist pair is selected.

If schema validation fails, the server may retry the curation call once while time remains. It never accepts a title or artist invented by the model.

## Catalog Search Plan

### Taste vocabulary normalization

`buildCatalogSearchPlan()` converts Korean and free-form profile terms into a bounded canonical vocabulary.

Examples:

```text
몽환적 -> dreamy, ethereal
인디 알앤비 -> indie r&b, alternative r&b
늦은 밤 -> late night, nocturnal
잔잔함 -> mellow, soft
```

The mapping lives in code and is versioned. Vague words such as “좋은”, “감성적”, and “힙한” are not used alone as catalog terms.

### Search buckets

```ts
type CatalogSearchBucketKind =
  | 'genre'
  | 'genre_mood'
  | 'input_artist'
  | 'similar_artist'

type CatalogSearchSeed = {
  id: string
  kind: CatalogSearchBucketKind
  term: string
  weight: number
  sourceArtistId?: string
}
```

The default plan contains:

- two top genre seeds;
- up to two genre and mood combinations;
- up to two exact input artist seeds;
- zero or one catalog-derived similar artist seed.

The query count remains bounded. Empty, duplicate, or overly broad seeds are removed before a network request starts.

### Input artist seeds

Input artist names come only from user-confirmed tracks. The server selects up to two unique input artists and searches their other recordings. Exact input title·artist pairs are excluded later. Input artists remain subject to the final one-track-per-artist rule.

### Similar artist seeds

The LLM never generates similar artist names.

The conservative expansion flow is:

1. Resolve an input artist by exact or high-confidence MusicBrainz name/alias match.
2. Read catalog-provided tags or genres for that artist.
3. Search MusicBrainz artist entities sharing the strongest supported tag.
4. Accept a related artist name only when the artist entity is returned by MusicBrainz with sufficient search confidence and overlapping tags.
5. Use the accepted real artist name as a recording search seed.

Only one input artist is expanded and only one similar artist seed is admitted per request. If the input artist cannot be resolved, tags are absent, search confidence is weak, or time is insufficient, no similar artist seed is created. The pipeline continues with genre, mood, and input artist searches.

## Catalog Providers

### Discovery interface

The existing exact-verification interface remains available, but discovery uses a separate interface.

```ts
interface CatalogDiscoveryProvider {
  readonly id: 'itunes' | 'musicbrainz'

  search(
    seed: CatalogSearchSeed,
    signal?: AbortSignal,
  ): Promise<readonly CatalogPoolTrack[]>
}
```

### iTunes

Default request:

```text
GET https://itunes.apple.com/search
  ?term={seed.term}
  &country=KR
  &media=music
  &entity=song
  &limit=25
```

iTunes searches run with concurrency three. A request uses a four-second timeout. Genre and mood relevance use the source seed, result order, and `primaryGenreName` when present.

The request budget is four to six searches. Identical normalized search terms use the existing TTL cache.

### MusicBrainz

Genre or mood discovery uses recording tag searches such as:

```text
tag:"dream pop" AND status:official
tag:"alternative r&b" AND status:official
```

Input artist resolution uses artist search fields and exact alias matching. Recording results keep the MBID, canonical credited artist, official title, release metadata, and search score.

All MusicBrainz operations share one rate gate:

- one request start per 1,100ms;
- meaningful DJ DOCHI User-Agent;
- four-second request timeout;
- at most three MusicBrainz network requests in the normal path;
- deadline and browser cancellation propagation.

MusicBrainz is used when:

- the iTunes pool has fewer than 20 usable candidates;
- a top genre search bucket has insufficient coverage;
- one safe similar-artist expansion can improve diversity.

## Candidate Model

```ts
type CatalogPoolTrack = {
  id: string
  title: string
  artist: string
  album: string
  provider: 'itunes' | 'musicbrainz'
  catalogId: string
  url: string | null
  durationMs: number | null
  primaryGenre: string
  sourceBucketIds: string[]
  sourceKinds: CatalogSearchBucketKind[]
  providerScore: number
  relevanceScore: number
  catalogStatus: 'verified'
}
```

Stable IDs use provider namespaces:

```text
itunes:{trackId}
musicbrainz:{recordingMbid}
```

The full 20~30 track pool stays server-side. Only the 12~15 track shortlist is sent to the LLM.

## Normalization and Deduplication

Candidate identity uses:

- Unicode NFKC normalization;
- lowercasing;
- whitespace and punctuation normalization;
- canonical `title + artist` key;
- existing version-token handling.

Processing order:

1. Remove malformed catalog results.
2. Exclude every confirmed input title·artist pair.
3. Merge duplicate iTunes and MusicBrainz recordings.
4. Prefer the iTunes representation when it provides a store URL.
5. Preserve merged provider IDs internally where available.
6. Exclude live, remix, remaster, acoustic, instrumental, edit, and alternate versions unless the taste profile explicitly calls for that form.
7. Enforce at most one candidate per artist.
8. Prefer at most one candidate per album.
9. Cap the raw pool at 30.

An input artist’s other song is allowed, but the same input artist contributes at most one raw candidate and at most one final track.

## Relevance Scoring

The score is deterministic and configured in one file.

Suggested components:

```text
35% source query relevance
25% genre or tag overlap
20% repeated discovery across independent buckets
10% provider search confidence or reciprocal result rank
10% novelty and version quality
```

Rules:

- MusicBrainz search score is normalized to 0..1.
- iTunes result position is converted to reciprocal rank.
- Discovery by multiple independent seeds adds confidence.
- Exact input artists receive a small novelty penalty, not exclusion.
- Unsupported version tokens receive a hard exclusion.
- Missing optional album metadata does not make a track invalid.

No popularity score is invented when a Provider does not expose one.

## Bucket-Aware Shortlist

The raw target is 25, bounded to 20~30. The LLM shortlist target is 15, bounded to 12~15.

The shortlist first reserves diversity slots:

```text
genre buckets: minimum 4 total
genre_mood buckets: minimum 3 total
input_artist buckets: up to 2 total
similar_artist bucket: minimum 2 when a safe bucket exists
```

Every reserved pick must still satisfy one-track-per-artist. If a bucket has too few valid artists, its unused slots are redistributed by global relevance score. After reserved slots, the remaining positions are filled by descending score while alternating source buckets where possible.

The final shortlist invariants are:

- 12~15 tracks;
- 12~15 distinct artists;
- at least two search bucket kinds when available;
- no input track duplicates;
- every item came directly from a catalog response.

If the raw pool has fewer than 20 usable candidates, the collector attempts bounded fallback searches. If it still has fewer than 20, the pipeline returns a catalog-stage error instead of asking the LLM to choose from an undersized or low-diversity pool.

## Final Result Assembly

The server constructs a `Map<candidateId, CatalogPoolTrack>` before the curation request.

For every selected ID:

- title, artist, album, provider, URL, and catalog ID come from the Map;
- `reason` comes from the LLM selection;
- `catalogStatus` is set to `verified`;
- iTunes candidates populate `platforms.appleMusic`;
- MusicBrainz-only candidates retain the existing platform search-link fallback.

The LLM cannot override canonical metadata.

## Time Budget

The complete server budget remains 35 seconds.

Suggested soft allocation:

```text
taste analysis: 10 seconds
catalog discovery and ranking: 10 seconds
LLM curation: 10 seconds
response and cancellation buffer: 5 seconds
```

Every stage receives the combined request and deadline AbortSignal. No new catalog request or retry starts inside the final stop buffer.

Unlike the previous replacement flow, no repeated “invent and verify” loop exists. One optional curation retry is allowed only when candidate-ID schema validation fails and enough time remains.

## Error Model

`MixtapeAnalysisIssue` gains a stage.

```ts
type MixtapeAnalysisStage = 'taste' | 'catalog' | 'curation'

type MixtapeAnalysisIssue = {
  code: MixtapeAnalysisErrorCode
  stage: MixtapeAnalysisStage
  message: string
  retryable: boolean
}
```

Suggested codes:

```text
TASTE_ANALYSIS_FAILED
CATALOG_UNAVAILABLE
CATALOG_CANDIDATES_INSUFFICIENT
CURATION_INVALID_RESPONSE
CURATION_FAILED
REQUEST_TIMEOUT
```

UI mapping:

- `stage: taste`
  - heading: `취향을 읽지 못했어.`
- `stage: catalog`
  - heading: `취향은 읽었는데, 확인되는 곡을 충분히 찾지 못했어.`
- `stage: curation`
  - heading: `취향은 읽었는데, 확인되는 곡을 충분히 찾지 못했어.`
  - body: `곡을 고르는 중에 문제가 생겼어. 다시 골라볼게.`

The existing React state may remain `tasteAnalysisError` to avoid widening the state machine. `TasteAnalysisErrorPanel` renders the heading from `issue.stage`. Server logs include stage, durations, query counts, candidate counts, shortlist count, and selected count, but never log user tracks, candidate titles, artist names, raw prompts, or images.

## File Impact

### New production files

```text
api/catalog/buildCatalogSearchPlan.ts
api/catalog/catalogSearchVocabulary.ts
api/catalog/collectCatalogCandidates.ts
api/catalog/rankCatalogCandidates.ts
prompts/dochi-taste-guide.md
prompts/dochi-curation-guide.md
```

### Modified production files

```text
api/generate-mixtape.ts
api/mixtapePipelineConfig.ts
api/catalog/types.ts
api/catalog/itunesCatalogProvider.ts
api/catalog/musicBrainzCatalogProvider.ts
api/llm/openaiProvider.ts
api/llm/provider.ts
src/services/llm/types.ts
src/types/mixtapeAnalysis.ts
src/hooks/useDjDochiFlow.ts
src/components/TasteAnalysisErrorPanel.tsx
prompts/dochi-mixtape-guide.md
vercel.json
```

### Retained or retired paths

`api/catalog/verifyMixtapeRecommendations.ts` is removed from the active API path. Its normalization, matching, cache, and Provider utilities are reused where appropriate. `generateReplacementTracks()` is removed after the catalog-seeded path is verified.

No upload, OCR, vinyl physics, camera, polaroid, platform-button, or final rendering component is redesigned.

## Testing

### Unit tests

- taste analysis output contains no recommendation tracks;
- Korean genre and mood aliases create bounded canonical seeds;
- vague or duplicate search terms are removed;
- input artist seeds come only from confirmed tracks;
- similar artist seeds come only from catalog-resolved entities;
- uncertain similar artist expansion produces no seed;
- iTunes query count, timeout, and concurrency limits;
- MusicBrainz query fields, User-Agent, timeout, and 1,100ms rate gate;
- malformed catalog results are removed;
- input title·artist pairs are excluded;
- cross-provider duplicates merge and prefer iTunes metadata;
- version mismatch rules remain conservative;
- every raw candidate has `verified` provenance;
- raw pool is bounded to 20~30;
- artist and album limits;
- relevance score components;
- bucket reservation and redistribution;
- shortlist is bounded to 12~15 distinct artists;
- dynamic candidate-ID enum rejects unknown IDs;
- duplicate IDs and fewer than five IDs are rejected;
- final metadata comes from the candidate Map;
- final result contains exactly five verified tracks.

### Provider and orchestration tests

- `analyzeTaste()` runs before any catalog search;
- catalog searches receive only derived seeds;
- `curateMixtape()` receives only profile plus candidate ID, title, and artist;
- free-form title and artist generation is absent from the curation schema;
- no replacement-track generation occurs;
- insufficient raw pool returns `stage: catalog`;
- curation schema failure returns `stage: curation`;
- taste provider failure returns `stage: taste`;
- combined cancellation signal reaches both LLM calls and every catalog request;
- no new work starts after the deadline stop buffer;
- safe logs exclude track, artist, prompt, and raw API content.

### API and UI tests

- `/api/generate-mixtape` returns five shortlist-backed verified tracks;
- API rejects unknown or duplicate candidate IDs;
- taste, catalog, and curation errors use the correct status and stage;
- `TasteAnalysisErrorPanel` shows the correct heading for every stage;
- retry preserves the reviewed input tracks;
- existing OCR, LP, camera, photo, and FinalMixtape tests continue to pass.

### Live checks

Live public-API checks are opt-in and do not gate CI:

- Korean and English genre searches return catalog candidates;
- one exact input artist search returns other real recordings;
- MusicBrainz tag fallback respects one request per second;
- the same input playlist yields a 20~30 raw pool and 12~15 shortlist;
- every final selected ID is present in the shortlist;
- complete request stays inside 35 seconds.

The required verification gate remains:

1. focused unit and orchestration tests;
2. full Vitest suite;
3. TypeScript build;
4. Vite production build;
5. one local end-to-end request with safe stage metrics.

## Migration Order

1. Introduce the split LLM types and prompts behind tests.
2. Add catalog discovery types and Provider search methods.
3. Add deterministic search-plan generation.
4. Add candidate collection, normalization, and deduplication.
5. Add scoring and bucket-aware shortlist selection.
6. Add candidate-ID-only LLM curation.
7. Switch `/api/generate-mixtape` to the catalog-seeded pipeline.
8. Split UI error copy by stage.
9. Remove the old active replacement flow after the new path passes all tests.

At no point may the API fall back to unverified LLM-generated tracks.
