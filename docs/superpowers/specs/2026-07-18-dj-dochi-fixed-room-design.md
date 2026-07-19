# DJ DOCHI Fixed Room Interaction Design

## Goal

DJ DOCHI의 모든 상호작용을 하나의 고정된 DJ 작업실 장면 안에서 진행한다. 상태는 페이지를 교체하는 데 사용하지 않고 도치의 표정, 대사, 위치, 작업 효과, 입력 패널, 믹스테이프 오버레이만 제어한다.

## Preserved behavior

- React + Vite + TypeScript + TailwindCSS 구조를 유지한다.
- GPT API, OCR, 음악 API, 서버 업로드는 연결하지 않는다.
- 이미지 파일은 브라우저 object URL로 미리보기만 하고 분석하지 않는다.
- 텍스트 음악 목록은 입력한 그대로 확인·수정할 수 있다.
- 이미지/텍스트가 비어 있으면 `도치에게 건네기`를 비활성화한다.
- 이미지 object URL은 교체·삭제·재시작·언마운트 시 정리한다.
- 더미 믹스테이프와 PNG 에셋 fallback을 유지한다.

## Removed runtime model

`IdleScreen`, `GreetingScreen`, `UploadScreen`, `LoadingScreen`, `ResultScreen`을 상태별 전체 화면 라우터에서 제거한다. `DjDochiView`와 `StageShell`도 런타임 조합에서 제거한다.

다음 요소는 고정 장면에서 사용하지 않는다.

- `IDLE / HELLO / INPUT / SCAN / MIX` 진행 단계 표시줄
- 화면별 대형 영문 제목
- 단계마다 교체되는 배경·카메라·상단 로고
- Loading 전용 전체 화면

기존 화면 파일은 새 구조가 안정적으로 동작하는 시점에 삭제해, 이후 개발자가 잘못된 전체 화면 패턴을 다시 사용하지 않도록 한다.

## Fixed room architecture

```text
App
└── useDjDochiFlow()
    └── DochiRoom
        ├── RoomBackdrop / fixed logo and room chrome
        ├── WorkshopProps
        │   ├── Turntable
        │   ├── Equalizer
        │   └── speakers / cassette / LP decoration
        ├── DochiCharacter
        ├── DialogueBox
        ├── ChoiceMenu
        ├── PlaylistInputPanel
        ├── WorkshopEffects
        └── MixtapeOverlay
```

`DochiRoom`은 배경과 카메라 구도를 한 번만 렌더링하고, 하위 요소의 `visible`, `phase`, `className`만 바꾼다. 작업실은 `app-shell` 안에 계속 존재한다.

## Flow state

```ts
export type DochiFlowState =
  | 'idle'
  | 'noticed'
  | 'talking'
  | 'choosingInput'
  | 'receivingInput'
  | 'leaving'
  | 'working'
  | 'returning'
  | 'givingTape'
  | 'viewingTape'
```

The hook exposes:

```ts
type DjDochiFlow = {
  state: DochiFlowState
  dialogue: { speaker: 'dochi'; text: string; index: number; total: number } | null
  dialogueKey: string
  inputMode: 'image' | 'text' | null
  input: PlaylistInput
  hasInput: boolean
  workMessage: string | null
  actions: {
    notice: () => void
    advanceDialogue: () => void
    chooseImage: () => void
    chooseText: () => void
    selectImage: (file: File) => void
    updateText: (value: string) => void
    deleteInput: () => void
    closeInput: () => void
    handoff: () => void
    openTape: () => void
    closeTape: () => void
    restart: () => void
  }
}
```

The hook owns transition timers, input object URL cleanup, dialogue order, and work-message rotation. It does not import JSX components or CSS classes.

## Dialogue sequence

After the user clicks the idle character, the dialogue advances in this exact order:

1. `엇?`
2. `언제부터 거기 있었어?`
3. `...아무튼 잘 왔어.`
4. `요즘 자주 듣는 음악 좀 보여줄래?`
5. `네 취향이랑 비슷한 곡들로 테이프 하나 만들어볼게.`

After line 5, the hook enters `choosingInput` and the two choices appear beside the dialogue box. `DialogueBox` owns the typewriter animation: clicking while a line is typing reveals the full line; clicking again invokes `advanceDialogue`.

## Input and handoff

`PlaylistInputPanel` is an in-room surface, not a route or screen. It supports:

- image file picker with preview, filename, replace, and delete;
- editable textarea for pasted music lists;
- disabled handoff button for blank text or missing image;
- close/reset action returning to the input choices without leaving the room.

When `handoff` is invoked, the panel closes immediately and the room shows `흠... 잠깐만.` while entering `receivingInput`.

## Leaving and working sequence

- `receivingInput`: Dochi remains visible and says `흠... 잠깐만.`
- after a short handoff pause, `leaving`: Dochi moves right/back with a walk animation.
- `working`: Dochi is hidden off-stage; the room remains visible. Turntable, cassette reel, equalizer, and work light animate.
- work messages rotate in the room: `목록을 살펴보는 중...`, `비슷한 음악을 찾는 중...`, `테이프에 담는 중...`, `라벨을 쓰는 중...`.
- the working timer is 4.5 seconds.
- `returning`: Dochi enters from the right with the result pose, glasses, and paper/tape prop.
- after the entrance transition, `givingTape` shows the return dialogue.

Return dialogue order:

1. `기다렸어?`
2. `네가 듣던 분위기는 남겨두고,`
3. `조금 새로운 것도 섞어봤어.`
4. `자. 네 거야.`

When the final line is complete, the paper/mix tape is clickable. `openTape` changes only the overlay state to `viewingTape`; the room and Dochi remain mounted underneath.

## Component contracts

### `DochiRoom`

Receives the hook's read-only state and action callbacks. It renders fixed room chrome, props, character, dialogue, choices, input panel, working effects, and tape overlay. It does not own business state.

### `DochiCharacter`

Keeps the existing asset/fallback lookup and adds presentational interaction props: `motion`, `visible`, and an optional click handler. Pose mapping remains `idle`, `surprised`, `thinking`, and `result` so the future four PNG files remain drop-in replacements.

### `DialogueBox`

Receives one line, a stable `dialogueKey`, and `onAdvance`. It owns only typewriter timing and renders a small game-style bottom dialogue box.

### `ChoiceMenu`

Receives labeled choices and callbacks. It has no knowledge of the flow state or input data.

### `PlaylistInputPanel`

Receives `PlaylistInput`, `hasInput`, and input actions. It may use a file input ref for the browser picker but does not own transition state.

### `WorkshopEffects`

Receives `active: boolean` and renders room-level lighting, reel, and equalizer activity plus the current small work message.

### `MixtapeOverlay`

Receives dummy playlist data and `onClose`. It renders the result popup over the unchanged room and has no data fetching.

## Motion and accessibility

- No full-page fade or replacement is used for state transitions.
- Character movement uses horizontal transform plus opacity; the room stays mounted.
- Dialogue, input panel, working effects, and overlay use short opacity/transform transitions.
- `prefers-reduced-motion: reduce` disables walking, bobbing, reel, and typewriter speed changes where possible.
- Idle Dochi is keyboard-focusable and exposes an accessible label.
- Input panel buttons and overlay close buttons are keyboard accessible.
- The dialogue box exposes the current line and can be advanced by Enter/Space.

## Testing strategy

- Replace the old page-transition integration tests with fixed-room flow tests.
- Test the hook's exact state transitions, dialogue order, 4.5-second work timer, returning pose, tape opening, restart, and object URL cleanup.
- Test `DialogueBox` typing/reveal/advance behavior independently.
- Test `PlaylistInputPanel` preview, replace, delete, and disabled/enabled handoff behavior.
- Test the App integration through visible controls: no progress rail or large page title, room remains visible during input/working/overlay, and closing the tape returns to the room.
- Run `pnpm test` and `pnpm build` before handoff.
