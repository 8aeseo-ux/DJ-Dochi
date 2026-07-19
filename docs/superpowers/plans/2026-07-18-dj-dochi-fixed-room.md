# DJ DOCHI Fixed Room Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace page-level screen transitions with one persistent DJ workshop scene whose dialogue, character motion, input panel, work effects, and mixtape overlay change in place.

**Architecture:** Replace the old `Screen` router with a typed `DochiFlowState` hook contract. `App` renders one `DochiRoom`; child components remain presentational and receive state data/actions only. The existing asset lookup, playlist dummy data, object URL lifecycle, and editable upload UX stay behind the hook/component boundaries.

**Tech Stack:** React 19, TypeScript, Vite, TailwindCSS v4, Vitest, React Testing Library, CSS custom properties, existing PNG fallback assets.

## Global Constraints

- Keep one mounted DJ room scene for every state; do not render a page-level Loading or Result screen.
- Remove the `IDLE / HELLO / INPUT / SCAN / MIX` rail and page-level large titles from runtime markup.
- Keep GPT, OCR, music API, network upload, and server storage disconnected.
- Keep image preview/reselect/delete, editable text input, disabled blank handoff, and object URL cleanup.
- Use the exact intro and return dialogue from the approved design spec.
- Use a 4.5 second working period with the four approved Korean work messages.
- Keep `src/assets/dochi/*.png` lookup and placeholder fallback behavior.
- Do not introduce a state-machine dependency.
- Run the full test suite and production build before handoff.

---

### Task 1: Replace the flow contract with persistent-room state

**Files:**
- Modify: `src/types.ts`
- Modify: `src/hooks/useDjDochiFlow.ts`
- Modify: `src/hooks/useDjDochiFlow.test.ts`

**Interfaces:**
- Produces `DochiFlowState`, `DjDochiFlow`, and `DjDochiFlowActions` used by `DochiRoom`.
- Retains `PlaylistInput` and image URL cleanup semantics.

- [x] **Step 1: Write failing hook tests for the new state contract**

Replace the old screen-based assertions with tests that exercise the approved flow:

```ts
it('starts idle and notices the user when the character is activated', () => {
  const { result } = renderHook(() => useDjDochiFlow())

  expect(result.current.state).toBe('idle')
  expect(result.current.dialogue).toBe(null)

  act(() => result.current.actions.notice())

  expect(result.current.state).toBe('noticed')
  expect(result.current.dialogue?.text).toBe('엇?')
})

it('advances the five-line intro and exposes choices without changing the room', () => {
  const { result } = renderHook(() => useDjDochiFlow())

  act(() => result.current.actions.notice())
  for (let index = 0; index < 4; index += 1) {
    act(() => result.current.actions.advanceDialogue())
  }

  expect(result.current.state).toBe('choosingInput')
  expect(result.current.dialogue?.text).toBe('네 취향이랑 비슷한 곡들로 테이프 하나 만들어볼게.')
  expect(result.current.dialogue?.index).toBe(4)
})

it('opens input choices in place and blocks handoff until content exists', () => {
  const { result } = renderHook(() => useDjDochiFlow())

  act(() => {
    result.current.actions.notice()
    for (let index = 0; index < 5; index += 1) result.current.actions.advanceDialogue()
    result.current.actions.chooseText()
  })

  expect(result.current.state).toBe('choosingInput')
  expect(result.current.inputMode).toBe('text')
  expect(result.current.hasInput).toBe(false)

  act(() => result.current.actions.handoff())
  expect(result.current.state).toBe('choosingInput')

  act(() => result.current.actions.updateText('M83 - Midnight City'))
  expect(result.current.hasInput).toBe(true)
})

it('moves through receiving, leaving, working, and returning on timers', () => {
  vi.useFakeTimers()
  const { result } = renderHook(() => useDjDochiFlow())

  act(() => {
    result.current.actions.notice()
    for (let index = 0; index < 5; index += 1) result.current.actions.advanceDialogue()
    result.current.actions.chooseText()
    result.current.actions.updateText('Beach House - Space Song')
    result.current.actions.handoff()
  })
  expect(result.current.state).toBe('receivingInput')
  expect(result.current.dialogue?.text).toBe('흠... 잠깐만.')

  act(() => vi.advanceTimersByTime(900))
  expect(result.current.state).toBe('leaving')
  act(() => vi.advanceTimersByTime(700))
  expect(result.current.state).toBe('working')
  expect(result.current.workMessage).toBe('목록을 살펴보는 중...')

  act(() => vi.advanceTimersByTime(4_500))
  expect(result.current.state).toBe('returning')
  act(() => vi.advanceTimersByTime(900))
  expect(result.current.state).toBe('givingTape')
  expect(result.current.dialogue?.text).toBe('기다렸어?')
})

it('opens the tape overlay after the return dialogue and restarts cleanly', () => {
  const { result } = renderHook(() => useDjDochiFlow())
  // Use the public actions and fake timers to reach the final return line.
  // Then assert `openTape` changes only the overlay state and `restart` returns to idle.
})
```

The final test must use fake timers and assert `state === 'viewingTape'` after `openTape`, then `state === 'idle'` after `restart`. Keep the existing URL cleanup test and update it to call `selectImage`/`restart` through the new action names.

- [x] **Step 2: Run the focused hook test and confirm the expected RED failure**

Run:

```bash
env PATH=/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:/usr/bin:/bin /Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm test -- src/hooks/useDjDochiFlow.test.ts
```

Expected: the test fails because `state`, `inputMode`, and the new action contract do not exist yet. Do not change production code before observing this failure.

- [x] **Step 3: Define the new types**

In `src/types.ts`, replace `Screen` with:

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

export type InputMode = 'image' | 'text' | null
```

Keep `UploadMode` only if an existing presentational component still needs it; the new panel should use `InputMode`.

- [x] **Step 4: Implement the minimal hook state machine**

Use constants in the hook:

```ts
const HANDOFF_DELAY_MS = 900
const LEAVE_DURATION_MS = 700
const WORK_DURATION_MS = 4_500
const RETURN_DURATION_MS = 900
const WORK_MESSAGES = [
  '목록을 살펴보는 중...',
  '비슷한 음악을 찾는 중...',
  '테이프에 담는 중...',
  '라벨을 쓰는 중...',
] as const
```

Store `state`, `inputMode`, `input`, `dialogueTrack`, `dialogueIndex`, and `workMessageIndex`. Implement `notice`, `advanceDialogue`, `chooseImage`, `chooseText`, `selectImage`, `updateText`, `deleteInput`, `closeInput`, `handoff`, `openTape`, `closeTape`, and `restart`. `handoff` must reject blank input, close the panel, set the handoff dialogue, and enter `receivingInput`. Effects advance the timed states and rotate work messages. Keep the existing `input.imageUrl` cleanup effect.

- [x] **Step 5: Run hook tests GREEN and preserve existing test coverage**

Run the focused hook test, then the full suite. Fix only hook/contract mismatches; do not weaken assertions.

---

### Task 2: Add fixed-room presentational components

**Files:**
- Create: `src/components/DochiRoom.tsx`
- Create: `src/components/DialogueBox.tsx`
- Create: `src/components/ChoiceMenu.tsx`
- Create: `src/components/PlaylistInputPanel.tsx`
- Create: `src/components/WorkshopEffects.tsx`
- Create: `src/components/MixtapeOverlay.tsx`
- Modify: `src/components/DochiCharacter.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- `App` renders only `<DochiRoom flow={useDjDochiFlow()} />`.
- `DochiRoom` receives `DjDochiFlow` and maps flow state to presentational props.
- Child components never import `useDjDochiFlow` and never set business state.

Use these presentational prop shapes:

```ts
type ChoiceItem = { label: string; onSelect: () => void; variant?: 'primary' | 'secondary' }
type ChoiceMenuProps = { items: ChoiceItem[] }
type PlaylistInputPanelProps = {
  mode: 'image' | 'text'
  input: PlaylistInput
  hasInput: boolean
  onImageSelect: (file: File) => void
  onTextChange: (value: string) => void
  onHandoff: () => void
  onDelete: () => void
  onClose: () => void
}
type WorkshopEffectsProps = { active: boolean; message: string | null }
type MixtapeOverlayProps = { open: boolean; onOpen: () => void; onClose: () => void }
```

- [x] **Step 1: Add failing component tests**

Create tests before components:

```tsx
describe('DialogueBox', () => {
  it('reveals the current line on the first click and advances on the second', async () => {
    const onAdvance = vi.fn()
    const user = userEvent.setup()
    render(<DialogueBox line="언제부터 거기 있었어?" dialogueKey="intro-1" onAdvance={onAdvance} />)

    const box = screen.getByRole('button', { name: /언제부터/ })
    await user.click(box)
    expect(box).toHaveTextContent('언제부터 거기 있었어?')
    expect(onAdvance).not.toHaveBeenCalled()
    await user.click(box)
    expect(onAdvance).toHaveBeenCalledOnce()
  })
})
```

Create a `PlaylistInputPanel` test covering disabled handoff, textarea enabling, image preview, replacement, and delete callbacks. Create a `DochiRoom` integration assertion that `app-shell` and `DJ DOCHI` remain present while the input panel is open.

- [x] **Step 2: Run the component tests and confirm RED**

Run:

```bash
env PATH=/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:/usr/bin:/bin /Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm test -- src/components/DialogueBox.test.tsx src/components/PlaylistInputPanel.test.tsx
```

Expected: module resolution failures because the new components do not exist.

- [x] **Step 3: Implement presentational components**

`DialogueBox` uses local typewriter state keyed by `dialogueKey`; `ChoiceMenu` renders button labels; `PlaylistInputPanel` owns only the native file input ref and preview markup; `WorkshopEffects` renders status text, equalizer, reel, and light classes when active; `MixtapeOverlay` renders the dummy track list inside a modal when open.

`DochiCharacter` gains only visual props:

```ts
type DochiCharacterProps = {
  pose: DochiPose
  size?: 'hero' | 'compact'
  motion?: 'groove' | 'still' | 'walk-out' | 'walk-in' | 'away'
  interactive?: boolean
  className?: string
  onClick?: () => void
}
```

The current asset lookup and placeholder DOM remain unchanged.

- [x] **Step 4: Compose `DochiRoom` without screen replacement**

Render fixed room markup once:

```tsx
<div className="app-shell dochi-room">
  <div className="ambient ambient--coral" aria-hidden="true" />
  <div className="ambient ambient--violet" aria-hidden="true" />
  <div className="stage-frame">
    <header className="topbar"><span className="brand-lockup__name">DJ DOCHI</span></header>
    <main className="room-stage">
      <div className="room-workbench"><Turntable /><div className="room-speaker" /></div>
      <WorkshopEffects active={flow.state === 'working'} message={flow.workMessage} />
      <DochiCharacter pose="idle" motion="groove" onClick={flow.actions.notice} />
      {flow.dialogue && <DialogueBox line={flow.dialogue.text} dialogueKey={flow.dialogueKey} onAdvance={flow.actions.advanceDialogue} />}
      {flow.state === 'choosingInput' && !flow.inputMode && (
        <ChoiceMenu items={[
          { label: '플레이리스트 캡처 보여주기', onSelect: flow.actions.chooseImage },
          { label: '음악 목록 적어주기', onSelect: flow.actions.chooseText, variant: 'secondary' },
        ]} />
      )}
      {flow.inputMode && (
        <PlaylistInputPanel
          mode={flow.inputMode}
          input={flow.input}
          hasInput={flow.hasInput}
          onImageSelect={flow.actions.selectImage}
          onTextChange={flow.actions.updateText}
          onHandoff={flow.actions.handoff}
          onDelete={flow.actions.deleteInput}
          onClose={flow.actions.closeInput}
        />
      )}
      <MixtapeOverlay open={flow.state === 'viewingTape'} onOpen={flow.actions.openTape} onClose={flow.actions.closeTape} />
    </main>
  </div>
</div>
```

Do not render the old screen components or `StageShell`. Idle shows only the small `도치를 눌러보세요` hint. The choices and panel use absolute/in-room positioning. Use `DochiCharacter` pose mapping: idle → `idle`, noticed/talking/choosing/receiving → `surprised` or `thinking`, returning/giving/viewing → `result`, with `walk-out`/`walk-in` motion props.

- [x] **Step 5: Replace App and run component/integration tests**

Replace `src/App.tsx` with the hook + room composition, then run all current and new tests. Update old assertions to the new visible Korean dialogue and fixed-room controls rather than reintroducing screen-specific copy.

---

### Task 3: Replace screen styles with fixed-room layout and motion

**Files:**
- Modify: `src/styles/dj-dochi.css`
- Modify: `src/styles/tokens.css` only if a new semantic token is needed
- Delete after imports are removed: `src/components/DjDochiView.tsx`, `src/components/StageShell.tsx`, `src/screens/IdleScreen.tsx`, `src/screens/GreetingScreen.tsx`, `src/screens/UploadScreen.tsx`, `src/screens/LoadingScreen.tsx`, `src/screens/ResultScreen.tsx`

**Interfaces:**
- Existing token aliases and reusable component skins remain available.
- New selectors are scoped under `.dochi-room`, `.room-stage`, `.dialogue-box`, `.choice-menu`, `.playlist-input-panel`, `.workshop-effects`, and `.mixtape-overlay`.

- [x] **Step 1: Add fixed-room layout styles**

Keep the background, topbar, ambient glow, and turntable visuals. Add a full-height room stage with stable grid areas for props, character, dialogue, and overlays. Remove runtime reliance on `.progress-rail`, `.screen-layout`, `.screen-heading-row`, and screen-specific layout selectors.

- [x] **Step 2: Add state motion classes**

Implement horizontal character transitions and in-room surfaces:

```css
.dochi-character--groove { animation: dochi-groove 1.8s ease-in-out infinite; }
.dochi-character--walk-out { transform: translateX(115%) rotate(4deg); opacity: 0; }
.dochi-character--walk-in { animation: dochi-walk-in 900ms cubic-bezier(.2,.8,.2,1) both; }
.playlist-input-panel,
.mixtape-overlay,
.dialogue-box { transition: opacity var(--motion-fast) ease, transform var(--motion-fast) ease; }
```

Work effects animate the reel, equalizer, light, and status message without unmounting the room.

- [x] **Step 3: Add responsive and reduced-motion rules**

On narrow screens, keep the character and workbench visible while moving the input panel and tape overlay to a centered bottom sheet. Add `@media (prefers-reduced-motion: reduce)` to disable continuous groove, walking, reel, equalizer, and typewriter animation delays while preserving visibility and controls.

- [x] **Step 4: Remove obsolete screen/progress styles only after tests pass**

Delete selectors that only served the removed screens when they are no longer referenced. Keep shared asset/component styles used by `DochiCharacter`, `RetroButton`, `Turntable`, `Equalizer`, and `Panel`.

---

### Task 4: Fixed-room integration tests and verification

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/hooks/useDjDochiFlow.test.ts`
- Create/modify: component tests from Task 2

- [x] **Step 1: Test the public fixed-room flow**

Cover these interactions through visible controls:

1. Initial render has a single `DJ DOCHI` room, no progress rail, no `START SESSION`, and the small idle hint.
2. Clicking `DJ 도치 idle` shows `엇?`, then the five intro lines in order.
3. Input choices open a panel while `DJ DOCHI` and room props remain in the DOM.
4. Text handoff closes the panel, shows `흠... 잠깐만.`, then work messages while the room remains mounted.
5. After fake timers, result Dochi appears with `기다렸어?`; final dialogue opens the mixtape overlay.
6. Closing the overlay returns to the same room; `다시 부탁하기` resets to idle.

- [x] **Step 2: Run the complete test suite**

```bash
env PATH=/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:/usr/bin:/bin /Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm test
```

Expected: all hook, component, character, and App tests pass.

- [x] **Step 3: Run the production build**

```bash
env PATH=/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:/usr/bin:/bin /Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm build
```

Expected: `tsc -b` and `vite build` exit successfully.

- [x] **Step 4: Run structural and browser checks**

Confirm the old progress labels and large title copy are absent from runtime source, `App.tsx` contains no state/timers, and the browser flow keeps `.dochi-room` mounted while opening the panel, working, and viewing the tape. Use the existing localhost Vite server or start it with `pnpm dev` if it is not running.
