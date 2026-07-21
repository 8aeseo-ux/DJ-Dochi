# DJ DOCHI Music Platform Deep-Link Design

Date: 2026-07-22
Status: Approved direction, pending implementation plan

## 1. Goal

DJ DOCHI의 결과 믹스테이프에서 추천곡마다 Spotify, Apple Music, YouTube Music으로 이동할 수 있게 한다. 가능한 경우 정확한 개별 곡 페이지를 열고, 정확한 플랫폼 ID를 확보하지 못한 경우에도 사용 흐름이 막히지 않도록 해당 플랫폼의 검색 결과로 연결한다.

이번 범위는 플랫폼 안에서 플레이리스트를 생성하거나 DJ DOCHI 웹사이트 안에서 전체 곡을 재생하는 기능이 아니다. 링크를 연 뒤 로그인, 구독 확인, 실제 재생은 각 음악 서비스가 담당한다.

## 2. Confirmed Constraints

- 현재 프로젝트는 React + Vite 정적 프런트엔드이며 별도 애플리케이션 서버가 없다.
- Spotify Client ID/Secret, YouTube Data API Key, Apple Music Developer Token은 아직 없다.
- 설치된 Apple Music 플러그인은 Codex 실행 환경에서 카탈로그 검색과 최대 25곡 일괄 매칭만 제공한다.
- Apple Music 플러그인은 보관함 플레이리스트 생성, 곡 추가, 배포 웹사이트 사용자 인증 기능을 제공하지 않는다.
- 플러그인은 개발 및 검증 도구로만 사용하고 배포 런타임 의존성으로 사용하지 않는다.
- 브라우저 및 플랫폼 정책 때문에 외부 곡 페이지를 연 직후의 자동 재생은 보장하지 않는다.

## 3. Delivery Strategy

### Phase A: No-Credential Deep Links

현재 더미 결과곡에는 공식 플랫폼에서 확인한 정확한 곡 ID와 URL을 저장한다. 정확한 링크를 확인할 수 없는 플랫폼이나 향후 새로 생성된 추천곡에는 제목과 아티스트를 포함한 플랫폼 검색 URL을 사용한다.

이 단계에서 제공하는 보장은 다음과 같다.

- 정확한 URL이 있으면 개별 곡 페이지를 연다.
- 정확한 URL이 없으면 플랫폼 검색 결과를 연다.
- 어느 한 플랫폼의 링크가 없어도 다른 플랫폼 버튼과 결과 화면은 정상 동작한다.
- 링크는 사용자 클릭으로 새 탭 또는 설치된 앱에서 열린다.

### Phase B: Official Runtime Resolution

API 자격증명이 준비되면 서버 측 `music resolver`를 추가한다. 추천 결과가 생성된 직후 서버가 제목과 아티스트를 플랫폼별 카탈로그 ID로 해석하고, 프런트엔드에는 비밀키가 아닌 최종 ID와 URL만 반환한다.

- Spotify: 서버의 Client Credentials 흐름으로 카탈로그 조회
- Apple Music: 서버에서 Developer Token을 생성하여 카탈로그 조회
- YouTube Music: YouTube Data API Key로 공개 음악 영상 검색
- 플랫폼별 실패는 전체 요청 실패로 승격하지 않고 해당 플랫폼의 검색 URL로 폴백

사용자 보관함에 플레이리스트를 생성하는 기능은 별도 범위로 유지한다. 해당 기능을 추가할 때만 MusicKit JS와 Music User Token을 도입한다.

## 4. Data Model

곡의 음악적 정보와 플랫폼 연결 정보를 분리한다.

```ts
type MusicPlatform = 'spotify' | 'appleMusic' | 'youtubeMusic'

type PlatformTrackReference = {
  id: string | null
  url: string | null
}

type Track = {
  title: string
  artist: string
  mood: string
  stat: string
  color: TrackColor
  platforms: Record<MusicPlatform, PlatformTrackReference>
}
```

`id`는 향후 플랫폼 API 응답과 캐시를 위한 식별자다. `url`은 국가별 스토어프런트와 플랫폼 URL 변경을 보존하기 위해 별도로 저장한다. 특히 Apple Music은 API가 반환한 전체 URL을 우선 사용한다.

## 5. Resolution Rules

플랫폼 링크는 다음 우선순위로 결정한다.

1. 저장된 공식 `url`
2. 저장된 플랫폼 `id`로 생성한 공식 딥링크
3. `artist + title`로 생성한 플랫폼 검색 URL

Apple Music은 스토어프런트가 URL에 포함되므로 저장된 공식 URL을 가장 먼저 사용한다. Spotify와 YouTube Music은 플랫폼 ID가 있으면 정해진 URL 형식으로 딥링크를 만들 수 있다.

링크 해석 로직은 UI 컴포넌트 밖의 순수 함수로 유지한다. UI는 `href`, `isDirect` 같은 해석 결과만 받아 렌더링한다. 향후 서버 API를 연결해도 결과 UI를 다시 작성하지 않는다.

## 6. UI Behavior

- 기존 믹스테이프 오버레이와 곡 목록을 유지한다.
- Spotify, Apple Music, YouTube Music 버튼을 누르면 해당 플랫폼의 곡 링크 목록을 펼친다.
- 정확한 곡 링크는 `듣기`, 검색 폴백은 `찾기`로 구분한다.
- 외부 링크는 사용자 클릭으로 열며 `target="_blank"`와 `rel="noreferrer"`를 사용한다.
- 정확한 링크가 없는 곡도 비활성화하지 않는다. 검색 결과로 이동할 수 있어야 한다.
- 플랫폼 선택, 외부 페이지 열기, 실패 안내는 DJ DOCHI의 기존 상태 흐름을 변경하지 않는다.

## 7. Apple Music Plugin Usage

Apple Music 플러그인은 다음 개발 작업에만 사용한다.

- 더미 및 테스트 추천곡의 한국 스토어프런트 카탈로그 ID 확인
- 공식 곡명, 아티스트, ISRC, 앨범, 미리듣기 URL, Apple Music URL 검증
- 최대 25곡 단위의 fixture 데이터 생성과 수동 검수
- 유사 제목, 리믹스, 재발매 버전이 있을 때 매칭 후보 비교

플러그인 호출을 React 코드나 배포 번들에 포함하지 않는다. 배포 사용자의 Apple 계정 인증이나 보관함 쓰기를 플러그인으로 대체하지 않는다.

## 8. Error Handling

- 잘못되거나 비어 있는 플랫폼 ID는 URL로 변환하지 않는다.
- 정확한 URL을 얻지 못하면 검색 URL로 폴백한다.
- 서버 도입 후에는 플랫폼별 타임아웃과 오류를 독립적으로 처리한다.
- 플랫폼 API 오류 메시지나 자격증명 상태를 최종 사용자에게 노출하지 않는다.
- 검색 폴백임을 결과 UI에서 짧게 안내한다.
- 국가별 제공 제한으로 링크가 열리지 않는 경우 사용자가 플랫폼 안에서 다시 검색할 수 있는 경로를 유지한다.

## 9. Security and Privacy

- API 비밀키와 Apple `.p8` 키는 프런트엔드 환경변수에 저장하지 않는다.
- 향후 자격증명은 서버 환경변수 또는 배포 플랫폼의 secret storage에만 저장한다.
- DJ DOCHI 서버는 사용자 음악 서비스 비밀번호를 받지 않는다.
- 현재 링크 전용 범위에서는 사용자 OAuth 토큰을 저장하지 않는다.
- 외부 플랫폼으로 전달하는 정보는 사용자가 클릭한 곡의 URL과 일반적인 브라우저 요청 정보뿐이다.

## 10. Testing

### Unit Tests

- 저장된 URL이 검색 URL보다 우선되는지 검증
- Spotify와 YouTube Music ID가 올바른 딥링크로 변환되는지 검증
- ID와 URL이 없을 때 플랫폼별 검색 URL이 생성되는지 검증
- Apple Music은 저장된 스토어프런트 URL을 그대로 사용하는지 검증

### Component Tests

- 세 플랫폼 버튼이 표시되는지 검증
- 선택한 플랫폼의 링크 목록만 표시되는지 검증
- 직접 링크와 검색 폴백의 레이블이 구분되는지 검증
- 외부 링크 보안 속성을 검증

### Manual Verification

- 데스크톱 브라우저에서 각 플랫폼 링크가 올바른 곡 또는 검색 결과를 여는지 확인
- 모바일에서 설치된 앱 또는 웹 플레이어로 정상 전환되는지 확인
- 한국 스토어프런트에서 Apple Music 링크의 제공 여부 확인

외부 카탈로그 자체는 단위 테스트에서 호출하지 않는다. API 자격증명이 생기면 별도의 opt-in 통합 테스트를 추가한다.

## 11. Acceptance Criteria

- 현재 결과 화면의 모든 곡에 세 플랫폼 링크가 제공된다.
- 검증된 정확한 링크가 있는 곡은 개별 곡 페이지를 연다.
- 검증되지 않은 동적 곡은 플랫폼 검색 결과를 연다.
- 한 플랫폼의 데이터 누락이 결과 화면 전체를 중단시키지 않는다.
- Apple Music 플러그인이나 비밀키가 프로덕션 번들에 포함되지 않는다.
- 기존 대화, LP, 카메라, 폴라로이드, 믹스테이프 흐름이 유지된다.

