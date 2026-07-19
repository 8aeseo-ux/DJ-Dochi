# DJ DOCHI 카메라 기념사진 디자인

## 목표

LP 인터랙션과 믹스테이프 제작이 끝난 뒤 사용자가 자신의 얼굴을 촬영하고, 브라우저 메모리 안에서 도치 이미지와 함께 폴라로이드 콜라주를 만든다. 완성된 폴라로이드는 최종 믹스테이프 라벨에 붙으며, 카메라를 사용할 수 없는 환경에서도 기본 도치 스티커 결과로 흐름이 중단되지 않는다.

## 사용자 흐름

기존 `recording` 단계의 LP, 바늘, REC, 카세트 릴 연출은 그대로 유지한다. 녹음이 끝난 뒤 상태를 다음과 같이 연결한다.

```text
recording
  → returning
  → photoPrompt
  → cameraPreview ─→ photoReview ─→ polaroidMaking ─→ finalTape ─→ viewingTape
       └────────────── 사진 없이 계속하기 ────────────────┘
```

`photoPrompt`의 대화는 다음 세 줄이다.

1. `됐다.`
2. `근데 아직 하나 부족해.`
3. `우리 기념사진 하나 찍을래?`

마지막 줄이 표시된 뒤 선택지를 노출한다.

- `기념사진 찍기`: 카메라 패널을 연다.
- `그냥 받을게`: 사용자 사진 없이 기본 도치 스티커 폴라로이드를 만든다.

카메라 패널은 고정된 DJ 작업실 위에 오버레이로 열린다. 전체 페이지나 배경은 교체하지 않는다.

## 상태 및 책임

`useDjDochiFlow`는 다음 상태와 데이터만 관리한다.

- 상태: `photoPrompt`, `cameraPreview`, `photoReview`, `polaroidMaking`, `finalTape`, 기존 `viewingTape`
- `capturedPhotoUrl: string | null`: Canvas 캡처 결과의 data URL
- `polaroidUrl: string | null`: 최종 폴라로이드 data URL
- 액션: `acceptPhoto`, `capturePhoto`, `retakePhoto`, `usePhoto`, `skipPhoto`, `completePolaroid`, `openTape`, `closeTape`, `restart`

기존 LP 상태와 물리 로직은 변경하지 않는다. `recording` 종료 시 `returning`을 거쳐 `photoPrompt`로 이동하고, 사진·합성 과정이 끝나면 `finalTape`로 이동한다. `viewingTape`는 최종 테이프를 확대해 곡 목록을 보여주는 오버레이 상태로 유지한다.

## 컴포넌트 경계

### `useCamera.ts`

카메라 스트림의 생명주기만 담당한다.

- `startCamera()`: 사용자가 `카메라 켜기`를 누른 뒤 `navigator.mediaDevices.getUserMedia` 호출
- 요청 옵션: `{ video: { facingMode: { ideal: 'user' } }, audio: false }`
- `videoRef`: 실시간 미리보기 연결용
- `captureFrame()`: 현재 비디오 프레임을 Canvas에 복사해 data URL 반환
- `stopCamera()`: 모든 트랙을 종료하고 비디오 연결 해제
- 미지원, 권한 거부, 스트림 오류를 `error` 상태로 제공
- 캡처, 취소, 리뷰 전환, 컴포넌트 unmount 시 반드시 스트림 종료

### `CameraCapture`

카메라 사용 이유를 먼저 설명하고 `카메라 켜기` 버튼을 제공한다. 권한 요청은 이 버튼을 누른 뒤에만 발생한다. 권한 오류가 발생하면 오류 문구와 `사진 없이 계속하기` 액션을 함께 보여준다. 스트림이 준비되면 실시간 비디오와 `찰칵!`, `취소` 버튼을 표시한다.

### `PhotoReview`

촬영된 data URL을 보여주고 `다시 찍기`, `사용하기`를 제공한다. 다시 찍기는 `cameraPreview`로 돌아가 스트림을 다시 시작하며, 사용하기는 `polaroidMaking`으로 이동한다.

### `PolaroidComposer`

Canvas 기반 합성만 담당한다. 결과 크기는 고정된 내부 해상도를 사용하고 화면 크기에 따라 CSS로 축소한다.

Canvas에 그리는 순서는 다음과 같다.

1. 따뜻한 흰색 폴라로이드 배경
2. 사용자 사진을 좌측/중앙 프레임에 cover 방식으로 배치
3. `getDochiAsset('result')`로 가져온 도치 이미지 배치
4. 손그림 테두리, 스티커, 마스킹테이프 장식
5. 하단 `DJ DOCHI & YOU` 텍스트

사용자 사진이 없으면 사진 영역을 비워두고 도치 스티커 중심의 기본 폴라로이드를 만든다. 합성 완료 data URL은 `onComplete`로 전달한다.

### `FinalMixtape`

최종 결과 장면과 확대 오버레이를 담당한다.

- 제목: `DOCHI'S NIGHT DRIVE`
- 식별자: `DOCHI MIX / CASSETTE 01`
- 도치 사인
- 추천곡 목록 또는 뒷면 보기 버튼
- `polaroidUrl`을 믹스테이프 라벨 한쪽에 표시
- 폴라로이드가 위에서 떨어져 붙는 짧은 애니메이션

최종 대화는 `좋아.`, `이제 진짜 우리 테이프다.`로 관리한다. 기존 `MixtapeOverlay`의 닫기·열기 동작은 유지한다.

## 카메라 오류 및 개인정보

- 서버 요청, 파일 업로드, OCR, GPT API를 사용하지 않는다.
- 촬영 데이터와 합성 결과는 React 상태와 브라우저 메모리에만 둔다.
- 새로고침하면 사진과 합성 결과가 사라진다.
- `navigator.mediaDevices`가 없거나 HTTPS/localhost 조건을 만족하지 않아 카메라를 사용할 수 없으면 오류 대신 기본 도치 스티커 흐름을 제공한다.
- 카메라 스트림은 성공·실패·취소·재촬영·unmount 모든 경로에서 정리한다.

## 검증 계획

- 상태 훅 테스트: 사진 제안, 촬영 동의, 재촬영, 사용, 거절, 오류 대체 흐름, 최종 테이프 전환
- `useCamera` 테스트: `getUserMedia` 호출 옵션, frame capture, 모든 트랙 stop, 권한 오류
- Canvas 합성 테스트: 사용자 사진이 있는 경우와 없는 경우 모두 data URL 생성
- 컴포넌트 테스트: 카메라 설명, 촬영 버튼, 리뷰 버튼, 기본 스티커 fallback, 최종 폴라로이드 노출
- 브라우저 QA: localhost 카메라 권한이 허용된 환경의 실제 preview/capture 흐름과 권한 오류 fallback, 모바일·데스크톱 고정 작업실 레이아웃
