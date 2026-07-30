# DJ DOCHI 작업실 BGM 설계

## 목표

DJ DOCHI의 고정 작업실 장면에서 첫 사용자 클릭 이후 재생되는 독창적인 배경음악을 추가한다. 음악은 작고 귀여운 게임 속 방처럼 포근하고 편안해야 하며, 캐릭터 대사와 보이스를 방해하지 않아야 한다.

기존 대화, OCR, 취향 분석, 추천, LP, 카메라, 캐릭터 보이스 구조는 변경하지 않는다. SFX와 BGM 설정은 완전히 분리한다.

## 선택한 음악 콘셉트

### 포근한 낮의 작업실

- BPM: 78
- 박자: 4/4
- 길이: 8마디, 약 24.6초
- 조성: 밝고 부드러운 장조·펜타토닉 중심
- 구조: 3~4음의 짧은 모티프, 네 마디 단위의 질문과 응답
- 악기:
  - 짧고 둥근 토이 말렛
  - 고음이 억제된 따뜻한 코드 패드
  - 정현파 성분이 중심인 둥근 베이스
  - 강한 킥과 스네어 대신 작은 우드 퍼커션과 부드러운 브러시 노이즈
- 보조 성격:
  - 가끔 한 음 늦게 대답하는 엉뚱한 응답음
  - 아주 약한 테이프 흔들림
  - 클럽 음악처럼 강하지 않은 낮은 비트감

모든 멜로디, 화성, 리듬과 음색은 이 프로젝트를 위해 새로 제작하며 기존 게임이나 음악을 참조·복제하지 않는다.

## 음원 제작과 권리

음원은 프로젝트 내부의 결정적 렌더링 스크립트로 직접 제작한다.

1. 78 BPM의 8마디 MIDI형 이벤트를 코드로 정의한다.
2. 토이 말렛, 베이스, 패드, 우드 퍼커션을 자체 합성한다.
3. 44.1kHz, 16-bit stereo PCM WAV로 렌더링한다.
4. 시작과 끝을 0에 가까운 파형으로 만들고 마지막 마디의 잔향을 충분히 감쇠해 클릭 없는 반복을 만든다.
5. 렌더링 스크립트와 제작·권리 문서를 함께 보관한다.

외부 샘플, 무료 음원, 생성형 음악 서비스 출력은 사용하지 않는다. 따라서 음원 사용 권한은 DJ DOCHI 프로젝트에 명확히 귀속된다.

## 파일

- 배포 음원: `src/assets/audio/dochi-workroom-loop.wav`
- 렌더링 스크립트: `scripts/generate-dochi-bgm.mjs`
- 권리·제작 정보: `src/assets/audio/README.md`

WAV는 44.1kHz, 16-bit stereo, 약 24.6초로 제작한다. 예상 크기는 약 4.3MB다. 압축 코덱의 인코더 지연 없이 Web Audio에서 정확한 루프 지점을 사용할 수 있고 모바일 Safari에서도 안정적으로 디코딩할 수 있다.

## 오디오 엔진

`BgmEngine`은 캐릭터 보이스 엔진과 별도의 `AudioContext`와 gain graph를 사용한다.

```text
WAV fetch/decode
  → AudioBufferSource(loop=true)
  → music gain
  → visibility gain
  → destination
```

- 첫 사용자 클릭에서 `AudioContext`를 해제하고 음원을 로드·재생한다.
- `AudioBufferSourceNode.loop`, `loopStart=0`, `loopEnd=buffer.duration`을 사용한다.
- 화면 상태가 바뀌어도 `DochiRoom`이 유지되므로 source를 다시 만들지 않는다.
- source가 중복 생성되지 않도록 시작 상태와 진행 중 Promise를 저장한다.
- 음소거는 source를 제거하지 않고 gain을 부드럽게 0으로 내린다.
- 재활성화 시 현재 재생 위치를 유지한 채 gain만 복원한다.

## 볼륨과 Ducking

- BGM 마스터링 목표: 약 -26~-24 LUFS
- 기본 UI 볼륨: 35%
- 허용 UI 범위: 0~100%
- 캐릭터 보이스의 체감 크기: BGM보다 약 6~9dB 앞
- 대사 타이핑 중 ducking: -6dB
- duck attack: 90ms
- duck release: 420ms
- 탭 비활성 상태: 현재 BGM 볼륨의 15%
- visibility gain 전환: 약 250ms

`DochiRoom`은 기존 `onCharacterReveal` 콜백을 감싸서 캐릭터 보이스를 재생한 뒤 BGM duck hold를 갱신한다. 각 글자에서 짧은 hold timer를 갱신하므로 타이핑 중에는 duck 상태가 유지되고 마지막 글자 이후 자동으로 부드럽게 복귀한다. `DialogueBox`와 캐릭터 보이스 내부 구현은 변경하지 않는다.

## 사용자 설정

SFX와 BGM은 서로 다른 키를 사용한다.

- `dj-dochi:sfx-enabled`
- `dj-dochi:bgm-enabled`
- `dj-dochi:bgm-volume`

BGM 기본값은 켜짐, 기본 볼륨은 35%다. 저장소 접근이 차단된 환경에서는 현재 세션 값만 사용한다.

## 탭 비활성 처리

`document.visibilitychange`에서 visibility gain을 조절한다.

- visible: 저장된 사용자 볼륨으로 복귀
- hidden: 현재 사용자 볼륨의 15%로 감소

AudioContext를 강제로 suspend하지 않아 모바일 Safari에서 복귀 시 다시 사용자 제스처를 요구하는 문제를 피한다.

## UI

기존 스피커 아이콘은 캐릭터 보이스·SFX 전용으로 유지한다.

새 `BgmControl`은 다음을 제공한다.

- 음표 아이콘으로 SFX와 시각적으로 구분
- 켜짐/꺼짐 상태와 접근 가능한 레이블
- 아이콘에 연결된 작은 절대 위치 팝오버 볼륨 슬라이더
- 상단 컨트롤 영역 안에 배치하되 작업실·대화창의 크기와 위치를 밀지 않음
- 기존 스케치북 스타일과 같은 선, 색상, hover 반응

## 컴포넌트와 파일 구조

### 새 파일

- `scripts/generate-dochi-bgm.mjs`
- `src/assets/audio/dochi-workroom-loop.wav`
- `src/assets/audio/README.md`
- `src/audio/bgmConfig.ts`
- `src/audio/bgmEngine.ts`
- `src/audio/bgmEngine.test.ts`
- `src/hooks/useBackgroundMusic.ts`
- `src/hooks/useBackgroundMusic.test.tsx`
- `src/components/BgmControl.tsx`
- `src/components/BgmControl.test.tsx`

### 최소 수정 파일

- `src/components/DochiRoom.tsx`
  - BGM 훅 연결
  - 첫 도치 클릭에서 보이스와 BGM 해제
  - 기존 문자 출력 이벤트에서 duck hold 호출
  - 독립 BGM 컨트롤 배치
- `src/styles/sketch-theme.css`
  - 작은 BGM 버튼·볼륨 팝오버 스타일
- `src/App.test.tsx`
  - SFX와 BGM 설정 독립성 및 첫 클릭 재생 회귀 테스트

## 오류 처리

- WAV 로딩 또는 디코딩이 실패해도 UI와 전체 흐름은 계속 동작한다.
- 엔진은 실패 상태를 기억하되 다음 명시적 BGM 활성화 동작에서 재시도할 수 있다.
- 자동 재생이 거절되면 다음 사용자 클릭에서 다시 `resume()`한다.
- 오류는 개발 환경에서만 간단한 코드로 기록하고 사용자에게 방해되는 전체 화면 오류를 표시하지 않는다.

## 테스트

- 첫 사용자 클릭 이전에는 재생되지 않음
- 첫 도치 클릭 또는 BGM 버튼 클릭 이후 한 번만 source 생성
- 화면 상태 전환 중 source 유지
- SFX와 BGM 음소거 상태 독립
- BGM ON/OFF와 볼륨 localStorage 저장
- ducking attack·release gain 예약
- 탭 hidden/visible gain 변화
- 중복 시작 방지
- 로딩·디코딩 실패가 앱 흐름을 중단하지 않음
- 전체 테스트, TypeScript, 프로덕션 빌드
- 데스크톱 브라우저 청음
- 모바일 Safari의 사용자 제스처 이후 재생과 탭 복귀 확인

## 완료 기준

- 78 BPM·약 24.6초의 포근하고 독창적인 작업실 루프가 끊김 없이 반복된다.
- 대사 타이핑 중 BGM이 자연스럽게 약해지고 종료 후 복귀한다.
- 캐릭터 보이스가 음악보다 명확하게 앞에 들린다.
- SFX와 BGM을 각각 끄고 켜며 BGM 볼륨을 저장할 수 있다.
- 기존 기능과 대화 흐름에 회귀가 없다.
- 커밋·푸시·Production 배포 없이 로컬에서 청음할 수 있다.
