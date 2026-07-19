# DJ DOCHI 레이아웃·로직 분리 리팩터링 설계

## 1. 목표와 범위

Figma에서 화면 디자인을 바꾼 뒤 React 코드에 다시 반영할 수 있도록, 현재 DJ DOCHI 프로토타입의 기능 로직과 시각 레이아웃을 분리한다. 이번 리팩터링은 화면의 문구, 상태 흐름, 업로드 확인 UX, 더미 결과, 캐릭터 placeholder 동작을 변경하지 않는다.

범위는 다음과 같다.

- `App.tsx`에서 상태·타이머·파일 object URL lifecycle을 분리
- `useDjDochiFlow` hook으로 화면 전환과 입력 처리 API를 고정
- 화면 컴포넌트는 hook을 직접 호출하지 않고 명시적인 props만 사용
- 현재 `screens/*`, `components/*` 구조를 유지하되 Figma 수정 대상인 시각 계층과 기능 계층을 구분
- 도치 캐릭터, 버튼, 패널, 말풍선을 독립 UI 컴포넌트로 유지해 교체 가능하게 구성
- 컬러, 폰트, 간격, 모션 값을 디자인 토큰 stylesheet로 분리
- 상태 hook과 기존 사용자 흐름 테스트를 함께 유지
- 새 API, 서버 저장, GPT, OCR, 라우터 도입은 하지 않음

## 2. 검토한 접근 방식

### 접근 A: 상태 hook + presentational screens (추천)

`useDjDochiFlow`가 단일 상태 머신과 입력 lifecycle을 소유하고 `App`은 hook 결과를 화면에 전달한다. `screens/*`와 `components/*`는 props를 렌더링하고 이벤트를 상위로 전달한다.

- 장점: 현재 구조와 가장 잘 맞고, Figma 수정 시 screen/component와 CSS만 변경하면 된다.
- 장점: 상태와 object URL 정리 동작을 hook 단위로 독립 테스트할 수 있다.
- 단점: 화면 수가 크게 늘어나면 hook의 반환 타입을 관리해야 한다.

### 접근 B: Context Provider + view tree

`DjDochiProvider`가 flow context를 제공하고 모든 화면이 `useDjDochi()`를 호출한다.

- 장점: 깊은 컴포넌트에 props를 전달하지 않아도 된다.
- 단점: UI 컴포넌트가 context에 암묵적으로 결합되어 Figma용 standalone preview와 단위 테스트가 어려워진다.
- 단점: 현재 화면 수와 depth에는 과한 구조다.

### 접근 C: XState 등 외부 state machine 도입

화면 상태와 이벤트를 외부 state machine으로 명시한다.

- 장점: 복잡한 상태·병렬 상태·히스토리 전환을 엄격하게 모델링할 수 있다.
- 단점: 현재 프로토타입의 단순한 흐름에 새 의존성과 개념을 추가한다.
- 단점: Figma 반영과 직접 관련이 없으며, 기능 요구가 늘어날 때 재검토해도 늦지 않다.

현재 범위에는 접근 A를 적용한다.

## 3. 목표 구조

```text
src/
  App.tsx                         # flow hook을 호출하고 screen view를 선택하는 얇은 조정 계층
  hooks/
    useDjDochiFlow.ts             # 상태, transition, input lifecycle, loading timer
    useDjDochiFlow.test.ts        # 기능 계약 테스트
  screens/                        # Figma에 맞춰 자주 바뀌는 화면 레이아웃
    IdleScreen.tsx
    GreetingScreen.tsx
    UploadScreen.tsx
    LoadingScreen.tsx
    ResultScreen.tsx
  components/                     # 재사용 가능한 시각 컴포넌트
    StageShell.tsx
    DochiCharacter.tsx
    RetroButton.tsx
    Panel.tsx
    SpeechBubble.tsx
    ...
  styles/
    tokens.css                     # 컬러, 폰트, spacing, motion tokens
    dj-dochi.css                   # layout, component skin, responsive rules
  types.ts                         # hook/view가 공유하는 데이터 계약
```

`main.tsx`는 앱 진입점과 stylesheet import만 담당한다. Figma 반영 시 일반적으로 수정할 파일은 `screens/*`, `components/*`, `styles/tokens.css`, `styles/dj-dochi.css`이며, 기능 변경이 필요한 경우에만 `hooks/useDjDochiFlow.ts`를 건드린다.

## 4. 기능 계층: `useDjDochiFlow`

### 상태

hook 내부 상태는 기존과 동일하게 유지한다.

```ts
type FlowState = {
  screen: Screen
  uploadMode: UploadMode
  input: PlaylistInput
}
```

`hasInput`은 이미지 object URL 또는 trim 후 비어 있지 않은 텍스트로 계산한다. `File` 자체는 view가 아니라 hook이 보관한다.

### 반환 계약

```ts
type DjDochiFlow = {
  screen: Screen
  uploadMode: UploadMode
  input: PlaylistInput
  hasInput: boolean
  actions: {
    startSession: () => void
    chooseImage: () => void
    chooseText: () => void
    openTextReview: () => void
    selectImage: (file: File) => void
    updateText: (value: string) => void
    handoff: () => void
    deleteInput: () => void
    backToGreeting: () => void
    restart: () => void
  }
}
```

화면은 `actions`만 호출한다. 화면은 `URL.createObjectURL`, `URL.revokeObjectURL`, `setTimeout`, `setScreen`, `setInput`을 직접 호출하지 않는다.

### Lifecycle 규칙

- `selectImage(file)`는 이미지 MIME 타입이 아니면 무시한다.
- 새 이미지 선택 시 새 object URL을 만들고 텍스트를 비운다.
- 기존 이미지 URL은 input URL이 변경되거나 hook이 unmount될 때 revoke한다.
- `chooseText`/`openTextReview`는 기존 이미지 URL을 정리 대상으로 만들고 텍스트 review mode로 전환한다.
- `deleteInput`, `backToGreeting`, `restart`는 입력을 초기화한다.
- `handoff`는 `hasInput`일 때만 Loading으로 전환한다.
- Loading 진입 시 1.8초 후 Result로 이동하고, 화면이 먼저 바뀌거나 unmount되면 timer를 clear한다.

## 5. 레이아웃 계층

`App.tsx`는 다음처럼 flow와 view를 연결하는 역할만 한다.

```tsx
function App() {
  const flow = useDjDochiFlow()

  return (
    <DjDochiView
      screen={flow.screen}
      uploadMode={flow.uploadMode}
      input={flow.input}
      hasInput={flow.hasInput}
      actions={flow.actions}
    />
  )
}
```

`DjDochiView`는 `screen`에 따라 `IdleScreen`, `GreetingScreen`, `UploadScreen`, `LoadingScreen`, `ResultScreen`을 선택한다. 화면에 전달되는 props는 명시적인 타입으로 정의하고, hook을 import하지 않는다.

예를 들어 `UploadScreen`은 파일 input ref와 파일 선택 DOM 이벤트를 관리할 수 있지만, 선택한 파일을 직접 저장하지 않고 `actions.selectImage(file)`만 호출한다. textarea의 값도 `input.pastedText`를 표시하고 `actions.updateText(value)`를 호출한다. 이는 DOM interaction과 business state를 분리하는 경계다.

### UI 컴포넌트 계약

- `DochiCharacter`: `pose`, `size`, `className`만 받아 asset/fallback을 렌더링한다. 상태 변경이나 화면 전환을 소유하지 않는다.
- `RetroButton`: `variant`, native button props, `children`을 받아 버튼 skin만 렌더링한다. 비활성 조건은 부모가 전달한다.
- `Panel`: `tone`, `className`, `children`을 받아 패널 surface만 렌더링한다. 내부 데이터나 이벤트를 알지 않는다.
- `SpeechBubble`: `tone`, `eyebrow`, `children`을 받아 말풍선 surface만 렌더링한다. 문구와 전환은 화면이 전달한다.
- `StageShell`: `screen`과 `children`을 받아 공통 frame/progress/footer만 렌더링한다. 현재 상태를 바꾸지 않는다.

각 컴포넌트는 Figma에서 새 variant가 생겨도 props 계약을 확장하는 방식으로 변경하고, hook이나 `PlaylistInput` 같은 기능 모델을 import하지 않는다.

## 7. 스타일 계층

현재 `src/index.css`의 DJ DOCHI 전용 스타일을 `src/styles/dj-dochi.css`로 이동하고, `src/styles/tokens.css`를 추가한다. `index.css`에는 Tailwind import, tokens import, app stylesheet import와 global reset처럼 앱 전역에 필요한 최소 규칙만 남긴다.

`tokens.css`는 다음처럼 시각 의사결정만 소유한다.

```css
:root {
  --color-ink: #09080b;
  --color-cream: #f7e9c9;
  --color-coral: #ff6b55;
  --color-amber: #f5b94c;
  --color-violet: #8b68ff;
  --font-display: Inter, ui-sans-serif, system-ui, sans-serif;
  --font-mono: "SFMono-Regular", Consolas, monospace;
}
```

컴포넌트와 화면은 토큰 이름 또는 의미 기반 class만 사용한다. Figma에서 palette/font가 바뀌면 `tokens.css`를 우선 수정하고, 레이아웃 변경만 `dj-dochi.css`에서 처리한다.

Figma 반영 시 다음 규칙을 따른다.

- 색상, typography, spacing, breakpoint, animation은 stylesheet의 token/rule을 수정한다.
- 레이아웃 변경은 `screens/*`와 `components/*`에서 처리한다.
- 입력 상태, 버튼 disabled 조건, 화면 전환, object URL cleanup은 hook에 남긴다.
- 화면 컴포넌트에 API 호출이나 분석 로직을 추가하지 않는다.
- 캐릭터 PNG/WebM 교체는 `DochiCharacter`의 asset lookup 계약을 유지한다.

## 8. 테스트 전략

기존 `App.test.tsx`는 최종 사용자 흐름을 검증하는 integration test로 유지한다.

추가할 `useDjDochiFlow.test.ts`는 다음 기능 계약을 검증한다.

1. 초기 상태는 `idle / choose / no input`이다.
2. `startSession`, `chooseImage`, `chooseText`가 올바른 screen/mode를 만든다.
3. `selectImage`는 이미지 파일을 저장하고 text를 비우며 `image-review`로 전환한다.
4. 비이미지 파일은 상태를 변경하지 않는다.
5. 공백 텍스트에서는 `hasInput`이 false이고 `handoff`가 Loading으로 가지 않는다.
6. 내용이 있는 텍스트에서 `handoff`가 Loading으로 전환한다.
7. 삭제·뒤로가기·재시작이 입력을 초기화한다.

기존 `DochiCharacter.test.tsx`는 PNG가 없을 때 placeholder가 유지되는 계약을 계속 검증한다. 모든 리팩터링 후 `pnpm test`와 `pnpm build`를 실행한다.

## 9. 완료 기준

- 현재 사용자 흐름과 화면 문구가 변경되지 않는다.
- `App.tsx`에는 `useState`, `useEffect`, `URL.createObjectURL`, `URL.revokeObjectURL`, `setTimeout`이 남지 않는다.
- `screens/*`는 flow hook을 import하지 않는다.
- UI 컴포넌트는 기능 모델이나 flow hook을 import하지 않는다.
- 컬러·폰트 변경은 `styles/tokens.css` 수정으로 처리할 수 있다.
- Figma용 레이아웃 변경이 `hooks/useDjDochiFlow.ts` 수정 없이 가능하다.
- 이미지/텍스트 확인, 수정, 삭제, disabled handoff, Loading → Result 전환이 기존 테스트와 hook 테스트로 보장된다.
- TypeScript build와 전체 테스트가 통과한다.
