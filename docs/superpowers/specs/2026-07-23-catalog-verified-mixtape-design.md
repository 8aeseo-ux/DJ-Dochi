# DJ DOCHI Catalog-Verified Mixtape Design

## Goal

DJ DOCHI가 LLM으로 만든 추천 후보를 그대로 노출하지 않고, 무료 공개 음악 카탈로그에서 곡명과 아티스트의 실재 여부를 확인한 뒤 검증된 곡만 최종 믹스테이프에 포함한다.

검증 순서는 다음과 같다.

1. iTunes Search API
2. iTunes에서 일치 항목이 없을 때만 MusicBrainz API
3. 두 카탈로그 모두에서 찾지 못한 추천 수만큼 LLM에 교체 후보 요청
4. 교체 후보를 같은 순서로 다시 검증
5. 최종 응답에는 `catalogStatus: "verified"`인 곡만 포함

Spotify나 Apple Developer 인증정보는 이번 범위에서 사용하지 않는다. 향후 공식 플랫폼 API를 추가할 때 UI, React 상태 흐름, LLM Provider를 수정하지 않도록 카탈로그 검증을 별도 Provider 계층으로 격리한다.

## Current Problem

현재 `generate-mixtape` API는 다음 작업만 수행한다.

- LLM 구조화 응답 검사
- 빈 필드 제거
- 입력곡과 동일한 추천 제거
- 추천곡 사이의 중복 제거
- 모든 추천곡을 `catalogStatus: "unverified"`로 표시

곡의 실재 여부를 확인하는 외부 카탈로그 조회가 없으므로, 형식상 올바른 가상 곡도 결과 화면에 표시된다. 프롬프트 규칙만으로는 LLM 환각을 완전히 차단할 수 없으므로 서버의 결정론적 검증이 최종 진실이어야 한다.

## Scope

### Included

- 카탈로그 검증 공통 타입과 Provider 인터페이스
- iTunes Search API Provider
- MusicBrainz API Provider
- 순차 fallback Provider 체인
- 검증 실패 추천곡만 LLM에 다시 요청
- 최대 재추천 횟수와 네트워크 시간 제한
- 검증된 곡만 포함하는 API 결과
- 검증된 플랫폼 ID/URL 저장
- 도치 프롬프트의 실존 곡 규칙 강화
- 단위, 통합, 실제 공개 API 확인

### Excluded

- Spotify Client Credentials
- Apple Music Developer Token
- Music User Token 또는 사용자 OAuth
- 사용자의 라이브러리나 플레이리스트 생성
- 카탈로그 데이터베이스 영구 저장
- 추천곡 자동 재생

## Architecture

### Catalog Provider

서버 전용 계층을 다음과 같이 추가한다.

```text
api/catalog/
  types.ts
  normalizeTrackIdentity.ts
  itunesCatalogProvider.ts
  musicBrainzCatalogProvider.ts
  catalogProviderChain.ts
  verifyMixtapeRecommendations.ts
```

공통 인터페이스:

```ts
type CatalogCandidate = {
  title: string
  artist: string
  album: string
  reason: string
}

type CatalogMatch = {
  provider: 'itunes' | 'musicbrainz'
  catalogId: string
  title: string
  artist: string
  album: string
  url: string | null
}

type CatalogVerificationResult =
  | { status: 'verified'; match: CatalogMatch }
  | { status: 'not_found' }
  | { status: 'ambiguous'; reason: 'multiple_matches' | 'version_mismatch' | 'low_similarity' }
  | { status: 'unavailable'; reason: 'timeout' | 'rate_limited' | 'network' | 'invalid_response' }

interface CatalogVerificationProvider {
  id: string
  verify(candidate: CatalogCandidate, signal?: AbortSignal): Promise<CatalogVerificationResult>
}
```

`catalogProviderChain`은 iTunes Provider를 먼저 호출한다. 정확한 일치 항목이 없을 때만 MusicBrainz Provider를 호출한다. Provider의 네트워크 오류와 “검색했지만 일치 항목이 없음”은 구분한다.

새로운 Spotify 또는 Apple Music Catalog Provider는 같은 인터페이스를 구현하고 체인의 우선순위에 추가할 수 있다.

### iTunes Provider

서버에서 다음 형태로 검색한다.

```text
GET https://itunes.apple.com/search
  ?term={title artist}
  &country=KR
  &media=music
  &entity=song
  &limit=10
```

응답의 `trackName`과 `artistName`이 후보의 제목·아티스트와 모두 충분히 일치할 때만 검증 성공으로 처리한다. 성공 시 iTunes의 정규화된 제목, 아티스트, 앨범, track ID, track URL을 사용한다.

### MusicBrainz Provider

iTunes에서 일치하지 않은 후보만 다음 형태로 검색한다.

```text
GET https://musicbrainz.org/ws/2/recording
  ?query=recording:"{title}" AND artist:"{artist}"
  &fmt=json
  &limit=10
```

MusicBrainz 요구사항에 맞는 식별 가능한 `User-Agent`를 보낸다. 공개 서비스 정책을 지키기 위해 요청을 직렬화하고 요청 간 최소 간격을 둔다. 응답의 recording title과 artist-credit이 후보와 모두 일치할 때만 성공으로 처리한다.

MusicBrainz MBID는 내부 `catalogId`로 저장하되 Spotify나 Apple Music ID로 오인하지 않는다.

## Matching Rules

검증은 거짓 양성보다 거짓 음성을 선호한다. 유사해 보인다는 이유만으로 다른 곡을 승인하지 않는다.

비교 전 다음 정규화를 적용한다.

- Unicode NFKC 정규화
- 앞뒤 공백 제거
- 소문자 변환
- 연속 공백 축약
- 구두점과 기호의 표현 차이 제거

제목과 아티스트의 유사도는 별도 함수와 상수로 관리한다. 기본 임계값은 제목 `0.92`, 아티스트 `0.90`으로 두며 두 값이 모두 임계값 이상이어야 한다. 정규화 후 완전 일치는 즉시 통과한다. 앨범은 일치 판정의 필수 조건이 아니지만 성공 시 카탈로그의 정식 앨범명으로 교체한다.

`live`, `remix`, `remaster`, `acoustic`, `instrumental`, `edit`, `version`과 이에 대응하는 한국어 버전 표기를 별도 version token으로 추출한다. 후보와 검색 결과의 version token 집합이 다르면 유사도 점수가 높아도 `ambiguous: version_mismatch`로 처리한다.

임계값을 넘는 결과가 두 개 이상이고 한 결과가 명확하게 우세하지 않으면 `ambiguous: multiple_matches`로 처리한다. 동명이곡, 라이브, 리믹스, 리마스터 버전은 자동 선택하지 않는다. 이로 인해 정상 곡이 탈락할 수 있지만 존재하지 않는 곡이나 다른 버전을 통과시키는 것보다 안전하다.

### Cache and Rate Control

정규화한 `title + artist` 조합을 캐시 키로 사용한다. 같은 서버 요청 안에서는 request-level `Map`을 사용하여 동일 후보를 한 번만 검색한다. Vercel의 warm instance에서는 6시간 TTL을 가진 bounded in-memory cache를 추가로 사용하되, 영구 저장이나 사용자별 데이터 저장은 하지 않는다.

캐시에는 `verified`, `not_found`, `ambiguous`를 저장한다. 일시적인 `unavailable` 결과는 장기간 캐시하지 않고 짧은 cooldown만 적용한다.

MusicBrainz 요청은 단일 모듈 큐에서 직렬화하고 요청 시작 간격을 최소 `1,100ms`로 유지한다. iTunes와 MusicBrainz 각각의 요청은 `4,000ms` 후 중단하며, 카탈로그 검증과 재추천을 포함한 전체 파이프라인에도 유한한 시간 예산을 적용한다.

## LLM Replacement Flow

기존 `LlmProvider`에 Provider 중립적인 교체 추천 메서드를 추가한다.

```ts
generateReplacementTracks({
  confirmedTracks,
  excludedTracks,
  count,
}): Promise<LlmTrackDraft[]>
```

- `confirmedTracks`: 사용자가 확인한 원본 곡
- `excludedTracks`: 입력곡, 이미 검증된 추천곡, 검증 실패한 모든 후보
- `count`: 현재 부족한 추천곡 수

OpenAI Provider는 교체 요청에서 취향 분석, 믹스테이프 제목, 디자인을 다시 생성하지 않고 필요한 곡 후보만 반환한다. 서버는 최초 응답의 취향 분석과 믹스테이프 메타데이터를 유지한다.

재추천은 최대 2회로 제한한다. 한 번에 부족한 수만 요청하고, 각 라운드에서 새 후보를 즉시 카탈로그 검증한다. 이미 시도한 제목·아티스트 조합은 다시 요청하거나 검증하지 않는다.

## Final Result Policy

- 초기 목표 곡 수는 최초 LLM 응답의 유효하고 중복되지 않은 추천곡 수이며 최대 8곡이다.
- 최대 2회의 교체 라운드 후에는 검증된 곡만 반환한다.
- 목표 수보다 적더라도 검증된 곡이 한 곡 이상이면 검증된 부분 결과를 반환한다.
- 검증된 곡이 한 곡도 없으면 retryable 오류를 반환하고 LP 단계로 진행하지 않는다.
- 네트워크 장애로 두 공개 카탈로그를 모두 사용할 수 없는 경우에도 unverified 곡으로 우회하지 않는다.

최종 추천곡은 다음을 만족한다.

```ts
catalogStatus: 'verified'
```

iTunes로 검증된 곡은 Apple Music/iTunes 직접 URL과 ID를 가능한 범위에서 `platforms.appleMusic`에 저장한다. MusicBrainz로만 검증된 곡은 플랫폼 ID와 URL을 비워두고 현재의 플랫폼 검색 링크 fallback을 사용한다.

## Error Handling

Provider 결과는 네 종류로 구분한다.

- `verified`: 충분히 일치하는 단일 곡을 찾음
- `not_found`: 검색은 성공했지만 정확한 일치 항목 없음
- `ambiguous`: 유사 후보는 있지만 동명이곡, 버전 불일치, 복수 후보 때문에 안전하게 확정할 수 없음
- `unavailable`: 타임아웃, rate limit, 응답 형식 오류, 외부 서비스 장애

iTunes가 `not_found`, `ambiguous`, `unavailable`이면 MusicBrainz를 시도한다. MusicBrainz도 성공하지 못하면 해당 후보는 미검증으로 분류하고 교체 대상으로 보낸다.

두 Provider가 지속적으로 unavailable이고 검증곡이 없다면 `CATALOG_UNAVAILABLE` 오류를 반환한다. 후보는 조회됐지만 모두 불일치하고 교체도 소진된 경우 `CATALOG_VERIFICATION_FAILED` 오류를 반환한다. 두 오류 모두 사용자가 취향 분석을 다시 시도할 수 있게 한다.

서버는 다음처럼 구조화된 최소 로그만 남긴다.

```ts
{
  event: 'catalog_verification',
  provider: 'itunes',
  status: 'ambiguous',
  reason: 'version_mismatch',
  round: 1,
  candidateIndex: 2
}
```

재추천 요청에는 `event`, `round`, `requestedCount`, `verifiedCount`만 기록한다. 곡명, 아티스트, 원본 검색어, 전체 외부 응답, 사용자 플레이리스트 전체, 이미지 또는 개인정보는 로그에 남기지 않는다.

## Prompt Changes

`prompts/dochi-mixtape-guide.md`에 다음 규칙을 추가한다.

- 실제 발매되어 공개 음악 카탈로그에서 검색 가능한 곡만 추천
- 확신하지 못하는 제목·아티스트 조합은 생성하지 않음
- 입력곡, 이전 추천곡, 서버가 전달한 제외 목록을 반복하지 않음
- 존재 여부를 증명할 수 없는 플랫폼 ID나 URL은 생성하지 않음

이 규칙은 후보 품질을 높이기 위한 1차 방어선이며, 카탈로그 검증을 대체하지 않는다.

## Data Flow

```text
reviewed tracks
  -> OpenAI full mixtape draft
  -> normalize and remove duplicates
  -> iTunes verification
       -> exact match: verified
       -> no match/error: MusicBrainz verification
  -> collect failed candidates
  -> request only missing replacement count from LLM
  -> verify replacements through the same chain
  -> repeat up to 2 replacement rounds
  -> return verified tracks only
  -> existing LP interaction
  -> FinalMixtape
```

React의 상태 흐름과 LP·카메라·결과 UI는 바꾸지 않는다. 검증과 재추천은 기존 `analyzingTaste` 서버 요청 안에서 완료된다.

## Testing

### Unit tests

- 제목·아티스트 정규화
- 제목·아티스트 유사도 임계값
- 라이브·리믹스·리마스터 version mismatch
- 복수 동점 후보의 ambiguous 처리
- iTunes 정확 일치 성공
- iTunes 제목 또는 아티스트 불일치 거절
- iTunes 응답 형식 및 네트워크 오류 처리
- MusicBrainz 정확 일치 성공
- MusicBrainz 불일치 거절
- Provider 체인이 iTunes 성공 시 MusicBrainz를 호출하지 않음
- iTunes 실패 시에만 MusicBrainz 호출
- 같은 제목·아티스트의 request-level 및 TTL 캐시 재사용
- MusicBrainz 요청 간격 1,100ms 준수
- Provider별 4,000ms 타임아웃

### Orchestration tests

- 검증 성공곡은 `verified`로 변환
- 실패한 추천 수만 LLM 교체 메서드에 전달
- 검증된 곡은 재추천하지 않음
- 이전 실패 후보를 제외 목록에 포함
- 최종 응답에 unverified 곡이 없음
- 재추천 2회 제한
- 부분 성공 시 검증된 곡만 반환
- 검증 성공이 전혀 없으면 오류

### API and UI regression tests

- `generate-mixtape` API가 검증된 결과만 반환
- 검증 실패 원인과 재추천 횟수 로그에 곡명·아티스트가 포함되지 않음
- `FinalMixtape`가 `VERIFIED` 상태와 정식 카탈로그 메타데이터를 렌더링
- 기존 OCR, 검수, LP, 카메라 흐름 유지

### Live verification

- 존재하는 한국어/영어 곡 각각 iTunes 검색 성공 확인
- iTunes에서 찾지 못하는 실제 MusicBrainz 곡의 fallback 확인
- 명백한 가상 제목·아티스트 조합이 최종 결과에서 제외되는지 확인
- 전체 Vitest, TypeScript, Vite production build 실행

## Operational Constraints

- 새로운 비밀 환경변수는 필요하지 않다.
- iTunes와 MusicBrainz 요청은 Vercel Serverless Function에서만 수행한다.
- 각 외부 요청에 AbortSignal 기반 타임아웃을 적용한다.
- MusicBrainz의 공개 API 정책과 1 request/second 제한을 준수한다.
- 외부 서비스 지연을 고려해 전체 재추천 라운드는 유한하게 유지한다.

## Future Extension

향후 공식 API를 추가할 때 다음 Provider만 구현한다.

```text
SpotifyCatalogProvider
AppleMusicCatalogProvider
```

Provider 체인의 우선순위를 설정으로 바꾸면 기존 LLM, React 상태, 결과 UI를 수정하지 않고 공식 플랫폼 검증과 직접 링크를 사용할 수 있다.
