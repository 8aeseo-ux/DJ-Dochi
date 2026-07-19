# DJ DOCHI Layout and Logic Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Refactor DJ DOCHI so state, timers, file lifecycle, and transitions live in a testable `useDjDochiFlow` hook while Figma-facing screens, UI components, and style tokens can change independently.

**Architecture:** Keep the existing screen components and user flow, introduce a hook that exposes a typed `DjDochiFlow` contract, and add a presentational `DjDochiView` router that maps flow state to screens. Move visual decisions into reusable UI components and `tokens.css`/`dj-dochi.css`; screens receive data and callbacks but never import the flow hook.

**Tech Stack:** React 19, TypeScript, Vite, TailwindCSS v4, Vitest, React Testing Library, CSS custom properties, and existing PNG asset lookup.

## Global Constraints

- Preserve the existing `Screen = 'idle' | 'greeting' | 'upload' | 'loading' | 'result'` flow and `UploadMode = 'choose' | 'image-review' | 'text-review'` behavior.
- Do not change the existing Korean copy, dummy playlist, upload review UX, Loading delay, or PNG fallback behavior.
- `App.tsx` must not own `useState`, `useEffect`, `URL.createObjectURL`, `URL.revokeObjectURL`, or `setTimeout` after the refactor.
- `screens/*` and reusable UI components must not import `useDjDochiFlow` or mutate business state directly.
- Dochi character, button, panel, speech bubble, color, font, spacing, and motion styles must have replaceable boundaries.
- Figma-driven visual changes must be possible by editing `screens/*`, `components/*`, and `src/styles/*` without editing `src/hooks/useDjDochiFlow.ts`.
- Do not add GPT, OCR, network upload, server storage, routing, or a new state-machine dependency.
- Run the full test suite and production build after the refactor.

---

## File Map

- Create: `src/hooks/useDjDochiFlow.ts` — state machine, actions, object URL cleanup, Loading timer.
- Create: `src/hooks/useDjDochiFlow.test.ts` — flow hook behavior and lifecycle contract tests.
- Create: `src/components/DjDochiView.tsx` — presentational screen selector and prop wiring.
- Create: `src/components/Panel.tsx` — replaceable panel surface component.
- Create: `src/styles/tokens.css` — color, font, spacing, motion design tokens.
- Create: `src/styles/dj-dochi.css` — existing DJ DOCHI layout/component styles moved out of `index.css`.
- Modify: `src/App.tsx` — reduce to hook invocation plus `DjDochiView` rendering.
- Modify: `src/screens/UploadScreen.tsx` — keep DOM file picker behavior but use `Panel` and action callbacks only.
- Modify: `src/screens/ResultScreen.tsx` — use `Panel` for the result surface.
- Modify: `src/index.css` — keep Tailwind import and stylesheet imports only.
- Modify: `src/App.test.tsx` — keep integration coverage and assert behavior through the unchanged public UI.
- Keep unchanged: `src/components/DochiCharacter.tsx`, `RetroButton.tsx`, `SpeechBubble.tsx`, `StageShell.tsx` APIs; only update class/token references if the style move requires it.

---

### Task 1: Add failing hook contract tests

**Files:**
- Create: `src/hooks/useDjDochiFlow.test.ts`
- Create: `src/hooks/.gitkeep` only if the directory is otherwise empty before the test file is created.

**Interfaces:**
- The test defines the exact public contract that `useDjDochiFlow` must produce.
- It uses `renderHook` and `act` from `@testing-library/react` and does not render any layout component.

- [x] **Step 1: Write the failing hook tests**

Create `src/hooks/useDjDochiFlow.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDjDochiFlow } from './useDjDochiFlow'

describe('useDjDochiFlow', () => {
  beforeEach(() => {
    const createObjectURL = vi.fn(() => 'blob:dochi-preview')
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts in the idle choose state without input', () => {
    const { result } = renderHook(() => useDjDochiFlow())

    expect(result.current.screen).toBe('idle')
    expect(result.current.uploadMode).toBe('choose')
    expect(result.current.hasInput).toBe(false)
    expect(result.current.input.pastedText).toBe('')
  })

  it('moves to image review and clears text when an image is selected', () => {
    const { result } = renderHook(() => useDjDochiFlow())
    const file = new File(['cover'], 'cover.png', { type: 'image/png' })

    act(() => {
      result.current.actions.chooseImage()
      result.current.actions.updateText('old text')
      result.current.actions.selectImage(file)
    })

    expect(result.current.screen).toBe('upload')
    expect(result.current.uploadMode).toBe('image-review')
    expect(result.current.input.imageFile).toBe(file)
    expect(result.current.input.imageUrl).toBe('blob:dochi-preview')
    expect(result.current.input.pastedText).toBe('')
    expect(result.current.hasInput).toBe(true)
  })

  it('ignores non-image files and keeps handoff blocked for blank text', () => {
    const { result } = renderHook(() => useDjDochiFlow())
    const file = new File(['notes'], 'notes.txt', { type: 'text/plain' })

    act(() => {
      result.current.actions.chooseImage()
      result.current.actions.selectImage(file)
      result.current.actions.chooseText()
      result.current.actions.updateText('   \n  ')
      result.current.actions.handoff()
    })

    expect(result.current.input.imageFile).toBe(null)
    expect(result.current.input.pastedText).toBe('   \n  ')
    expect(result.current.hasInput).toBe(false)
    expect(result.current.screen).toBe('upload')
  })

  it('hands off populated text, clears input on restart, and revokes image URLs', () => {
    const { result, unmount } = renderHook(() => useDjDochiFlow())
    const file = new File(['cover'], 'cover.png', { type: 'image/png' })

    act(() => {
      result.current.actions.selectImage(file)
    })
    expect(result.current.hasInput).toBe(true)

    act(() => {
      result.current.actions.restart()
    })
    expect(result.current.screen).toBe('idle')
    expect(result.current.uploadMode).toBe('choose')
    expect(result.current.input.imageUrl).toBe(null)
    expect(result.current.hasInput).toBe(false)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:dochi-preview')

    act(() => {
      result.current.actions.chooseText()
      result.current.actions.updateText('M83 - Midnight City')
      result.current.actions.handoff()
    })
    expect(result.current.screen).toBe('loading')

    unmount()
  })
})
```

- [x] **Step 2: Run the focused test and confirm the expected RED failure**

Run:

```bash
env PATH=/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:/usr/bin:/bin /Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm test -- src/hooks/useDjDochiFlow.test.ts
```

Expected: FAIL because `src/hooks/useDjDochiFlow.ts` does not exist yet. Do not change the test to make the missing module pass.

---

### Task 2: Implement the flow hook and make its contract GREEN

**Files:**
- Create: `src/hooks/useDjDochiFlow.ts`
- Test: `src/hooks/useDjDochiFlow.test.ts`

**Interfaces:**
- Produces the following exported types and hook:

```ts
export type DjDochiFlowActions = {
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

export type DjDochiFlow = {
  screen: Screen
  uploadMode: UploadMode
  input: PlaylistInput
  hasInput: boolean
  actions: DjDochiFlowActions
}

export function useDjDochiFlow(): DjDochiFlow
```

- [x] **Step 1: Define stable initial state and action types**

Use a factory so each hook instance receives fresh input state:

```ts
const LOADING_DELAY_MS = 1800

function createInitialInput(): PlaylistInput {
  return { imageFile: null, imageUrl: null, pastedText: '' }
}
```

The hook imports only React hooks and `Screen`, `UploadMode`, and `PlaylistInput` from `src/types.ts`. It must not import any screen or UI component.

- [x] **Step 2: Implement input lifecycle and transitions**

Implement these exact behaviors:

```ts
const hasInput = Boolean(input.imageUrl || input.pastedText.trim())

const selectImage = (file: File) => {
  if (!file.type.startsWith('image/')) return
  setInput({ imageFile: file, imageUrl: URL.createObjectURL(file), pastedText: '' })
  setUploadMode('image-review')
  setScreen('upload')
}

const chooseText = () => {
  setInput(createInitialInput())
  setUploadMode('text-review')
  setScreen('upload')
}

const handoff = () => {
  if (hasInput) setScreen('loading')
}
```

`chooseImage` sets `uploadMode` to `choose` and `screen` to `upload`; `openTextReview` sets the mode to `text-review` without changing the current screen; `updateText` updates only `pastedText`; `deleteInput` resets input and mode to `choose`; `backToGreeting` also sets screen to `greeting`; `restart` resets input/mode and sets screen to `idle`; `startSession` sets screen to `greeting`.

- [x] **Step 3: Add URL and Loading cleanup effects**

Use input URL as the cleanup boundary:

```ts
useEffect(() => {
  const imageUrl = input.imageUrl
  return () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl)
  }
}, [input.imageUrl])

useEffect(() => {
  if (screen !== 'loading') return
  const timer = window.setTimeout(() => setScreen('result'), LOADING_DELAY_MS)
  return () => window.clearTimeout(timer)
}, [screen])
```

Return `actions` and the read-only state values from the hook. The hook may use `useCallback` for stable actions, but no UI component or CSS class may be imported.

- [x] **Step 4: Run the focused test to confirm GREEN**

Run the same `pnpm test -- src/hooks/useDjDochiFlow.test.ts` command.

Expected: 4 hook tests pass. Then run `pnpm test -- src/App.test.tsx`; it may still pass against the existing App before wiring, and any failure after wiring must be fixed in the view adapter, not by weakening the hook contract.

---

### Task 3: Add the presentational view router and make App logic-free

**Files:**
- Create: `src/components/DjDochiView.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx` only if accessible behavior assertions need no-copy-change updates.

**Interfaces:**
- `DjDochiView` consumes `DjDochiFlow` and returns only the appropriate screen component.
- `App` consumes `useDjDochiFlow` and renders `<DjDochiView flow={flow} />`.

- [x] **Step 1: Create the view prop contract**

Create `src/components/DjDochiView.tsx`:

```tsx
import type { DjDochiFlow } from '../hooks/useDjDochiFlow'

type DjDochiViewProps = {
  flow: DjDochiFlow
}

export default function DjDochiView({ flow }: DjDochiViewProps) {
  const { screen, uploadMode, input, hasInput, actions } = flow

  if (screen === 'idle') return <IdleScreen onStart={actions.startSession} />
  if (screen === 'greeting') return <GreetingScreen onChooseImage={actions.chooseImage} onChooseText={actions.chooseText} />
  if (screen === 'upload') {
    return (
      <UploadScreen
        mode={uploadMode}
        input={input}
        hasInput={hasInput}
        onImageSelect={actions.selectImage}
        onTextOpen={actions.openTextReview}
        onTextChange={actions.updateText}
        onHandoff={actions.handoff}
        onDelete={actions.deleteInput}
        onBack={actions.backToGreeting}
      />
    )
  }
  if (screen === 'loading') return <LoadingScreen />
  return <ResultScreen onRestart={actions.restart} />
}
```

Import the existing screen components at the top. The view router is allowed to know which screen renders which layout, but it must not call `useState`, `useEffect`, `URL`, or timers.

- [x] **Step 2: Replace App state with the hook and view**

Replace `src/App.tsx` with:

```tsx
import DjDochiView from './components/DjDochiView'
import { useDjDochiFlow } from './hooks/useDjDochiFlow'

function App() {
  const flow = useDjDochiFlow()
  return <DjDochiView flow={flow} />
}

export default App
```

- [x] **Step 3: Run integration tests and verify behavior is unchanged**

Run:

```bash
env PATH=/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:/usr/bin:/bin /Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm test -- src/App.test.tsx
```

Expected: the existing 3 UI flow tests pass, including image reselect/delete, disabled handoff, and Loading → Result. Search `src/App.tsx` to confirm it contains no `useState`, `useEffect`, `URL.`, or `setTimeout`.

---

### Task 4: Extract replaceable Panel UI and token stylesheet

**Files:**
- Create: `src/components/Panel.tsx`
- Create: `src/styles/tokens.css`
- Modify: `src/screens/UploadScreen.tsx`
- Modify: `src/screens/ResultScreen.tsx`
- Modify: `src/index.css`
- Create/Modify: `src/styles/dj-dochi.css`

**Interfaces:**
- `Panel` accepts native div attributes plus `tone?: 'default' | 'raised' | 'quiet'` and renders its `children` without data or flow dependencies.

- [x] **Step 1: Add the Panel component test first**

Add `src/components/Panel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Panel from './Panel'

describe('Panel', () => {
  it('renders content through a replaceable surface component', () => {
    render(<Panel tone="raised">Playlist preview</Panel>)

    const panel = screen.getByText('Playlist preview')
    expect(panel).toBeInTheDocument()
    expect(panel.parentElement).toHaveClass('ui-panel', 'ui-panel--raised')
  })
})
```

Run `pnpm test -- src/components/Panel.test.tsx`. Expected: FAIL because `Panel.tsx` does not exist.

- [x] **Step 2: Implement Panel with no flow dependency**

Create `src/components/Panel.tsx`:

```tsx
import type { HTMLAttributes, ReactNode } from 'react'

type PanelProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  tone?: 'default' | 'raised' | 'quiet'
}

export default function Panel({ children, className = '', tone = 'default', ...props }: PanelProps) {
  return <div className={`ui-panel ui-panel--${tone} ${className}`.trim()} {...props}>{children}</div>
}
```

Run the focused Panel test and expect PASS.

- [x] **Step 3: Replace screen surface divs with Panel**

In `UploadScreen.tsx`, import `Panel` and replace the outer `upload-panel`, both `source-card` surfaces, and both `review-panel` surfaces with `<Panel>` while preserving existing class names. In `ResultScreen.tsx`, replace the `mixtape-card` surface with `<Panel className="mixtape-card">`. Do not move the business callbacks or input values into Panel.

- [x] **Step 4: Add design tokens**

Create `src/styles/tokens.css` with the current values and semantic aliases:

```css
:root {
  --color-ink: #09080b;
  --color-ink-soft: #111016;
  --color-panel: #15131a;
  --color-panel-raised: #201c27;
  --color-cream: #f7e9c9;
  --color-muted: #a69caf;
  --color-dim: #6e6578;
  --color-coral: #ff6b55;
  --color-coral-deep: #b84142;
  --color-amber: #f5b94c;
  --color-violet: #8b68ff;
  --color-mint: #74e0ba;
  --font-display: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  --space-unit: 0.25rem;
  --motion-fast: 180ms;
  --motion-loading: 1.4s;
  --ink: var(--color-ink);
  --ink-soft: var(--color-ink-soft);
  --panel: var(--color-panel);
  --panel-raised: var(--color-panel-raised);
  --cream: var(--color-cream);
  --muted: var(--color-muted);
  --dim: var(--color-dim);
  --coral: var(--color-coral);
  --coral-deep: var(--color-coral-deep);
  --amber: var(--color-amber);
  --violet: var(--color-violet);
  --mint: var(--color-mint);
}
```

- [x] **Step 5: Move DJ DOCHI CSS behind a stylesheet boundary**

Move the current DJ DOCHI rules from `src/index.css` into `src/styles/dj-dochi.css`. Remove the Tailwind import and the old `:root` value block from the moved file, preserve all class selectors and responsive/keyframe rules, and replace repeated literal display/mono font declarations with `var(--font-display)` and `var(--font-mono)` where they occur. Set `src/index.css` to:

```css
@import 'tailwindcss';
@import './styles/tokens.css';
@import './styles/dj-dochi.css';
```

Add Panel skins without changing existing screen-specific layout classes:

```css
.ui-panel { background: var(--panel); border: 1px solid var(--line); }
.ui-panel--raised { background: var(--panel-raised); }
.ui-panel--quiet { background: rgba(21, 19, 26, 0.65); }
```

Now a palette/font replacement starts in `tokens.css`, while Figma layout adjustments stay in `dj-dochi.css` and screen markup.

- [x] **Step 6: Run component and integration tests**

Run `pnpm test`. Expected: the hook tests, Panel test, DochiCharacter fallback test, and existing App flow tests all pass.

---

### Task 5: Final type/build verification and separation audit

**Files:**
- Verify: `src/App.tsx`, `src/components/DjDochiView.tsx`, `src/hooks/useDjDochiFlow.ts`, `src/screens/*`, `src/components/*`, `src/styles/*`

- [x] **Step 1: Run the full test suite**

Run:

```bash
env PATH=/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:/usr/bin:/bin /Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm test
```

Expected: all test files pass with 0 failures.

- [x] **Step 2: Run the TypeScript/Vite build**

Run the same environment-prefixed `pnpm build` command.

Expected: `tsc -b` succeeds and Vite emits the production `dist` bundle.

- [x] **Step 3: Run the structural separation audit**

Run:

```bash
rtk proxy rg -n "useState|useEffect|createObjectURL|revokeObjectURL|setTimeout" src/App.tsx
rtk proxy rg -n "useDjDochiFlow" src/screens src/components
```

Expected: the first command returns no matches; the second command returns only the hook import in `DjDochiView` if the view type is intentionally imported, and no screen/component imports the hook.

- [x] **Step 4: Confirm the Figma handoff boundary**

Review that:

1. `src/hooks/useDjDochiFlow.ts` contains no JSX or CSS class names.
2. `src/components/DjDochiView.tsx` contains no `useState`, `useEffect`, URL calls, or timers.
3. `src/components/Panel.tsx`, `RetroButton.tsx`, `SpeechBubble.tsx`, and `DochiCharacter.tsx` expose UI props only.
4. Colors and fonts are defined in `src/styles/tokens.css` and consumed by `src/styles/dj-dochi.css`.
5. Existing screen copy and interactions remain unchanged.

- [x] **Step 5: Report the refactor boundary**

Hand off the exact files a designer can change (`src/screens`, `src/components`, `src/styles`) and the exact file that should remain stable for behavior (`src/hooks/useDjDochiFlow.ts`).

