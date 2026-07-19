# DJ DOCHI UX Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React + Vite + TypeScript + TailwindCSS prototype for DJ DOCHI with Idle → Greeting → Upload review → Loading → Result flow, local image preview, editable pasted text, and replaceable character assets.

**Architecture:** Use one top-level `App` state machine and focused screen/components beneath it. Keep `Upload` as the required screen state and use `UploadMode` to distinguish source selection from image/text review. Store image files only as browser-local `File` and object URL values, and load future PNG assets through an optional Vite glob with a CSS low-poly fallback.

**Tech Stack:** React, Vite, TypeScript, TailwindCSS v4 via `@tailwindcss/vite`, Vitest, React Testing Library, `user-event`, and CSS keyframe animation.

## Global Constraints

- Do not connect GPT API, OCR, analytics, server storage, or network upload.
- Use `Screen = 'idle' | 'greeting' | 'upload' | 'loading' | 'result'` exactly for the main flow.
- Keep `UploadMode = 'choose' | 'image-review' | 'text-review'` inside the Upload state.
- Show `도치에게 건네기` as disabled unless an image URL exists or `pastedText.trim()` is non-empty.
- Selecting a new image clears pasted text; opening text entry clears the previous image and revokes its object URL.
- Revoke every image object URL when replacing, deleting, restarting, or unmounting.
- Use the future asset paths `src/assets/dochi/dochi-idle.png`, `dochi-surprised.png`, `dochi-thinking.png`, and `dochi-result.png` without requiring code changes when files are added.
- Do not include the supplied reference images in the site.
- Use real semantic buttons, labels, form controls, alt text, and responsive layouts.
- Preserve the exact user-facing copy in the approved design, including `엇? 손님이네. 요즘 듣는 플레이리스트 좀 보여줄래?`, `잠깐만.`, `도치가 음악을 분석하는 중...`, and `봤어. 취향 좋네.`.

---

## File Map

Create the following focused files:

- `package.json`, `index.html`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`: Vite, TypeScript, Tailwind, and test configuration.
- `src/main.tsx`, `src/test/setup.ts`: React entrypoint and test setup.
- `src/types.ts`: Screen, upload-mode, input, pose, and track types.
- `src/data/playlist.ts`: static dummy result tracks and result metadata.
- `src/lib/dochiAssets.ts`: optional `import.meta.glob` asset lookup.
- `src/components/DochiCharacter.tsx`: image-first character renderer with placeholder fallback.
- `src/components/StageShell.tsx`: shared stage background, brand, progress indicator, and decorative layout.
- `src/components/RetroButton.tsx`, `src/components/SpeechBubble.tsx`, `src/components/Turntable.tsx`, `src/components/Equalizer.tsx`: reusable visual primitives.
- `src/screens/IdleScreen.tsx`, `GreetingScreen.tsx`, `UploadScreen.tsx`, `LoadingScreen.tsx`, `ResultScreen.tsx`: one responsibility per screen.
- `src/App.tsx`: top-level state transitions and input lifecycle.
- `src/App.test.tsx`: user-flow and input validation tests.
- `src/index.css`: Tailwind import, design tokens, low-poly placeholder shapes, stage layout, and motion/reduced-motion rules.
- `src/assets/dochi/.gitkeep`: keeps the future replacement asset directory present while PNG files are absent.

---

### Task 1: Scaffold the Vite, TailwindCSS, and test harness

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `src/main.tsx`
- Create: `src/test/setup.ts`
- Create: `src/index.css`

**Interfaces:**
- Produces a Vite React TypeScript app whose `npm run dev`, `npm run build`, and `npm run test` scripts work before product code is added.

- [ ] **Step 1: Create the package manifest and install dependencies**

Run these commands from the project root:

```bash
npm init -y
npm install react react-dom
npm install --save-dev @vitejs/plugin-react @tailwindcss/vite @testing-library/jest-dom @testing-library/react @testing-library/user-event @types/react @types/react-dom jsdom tailwindcss typescript vite vitest
```

Update `package.json` scripts to exactly:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Add Vite, TypeScript, and Vitest configuration**

Create `vite.config.ts` with React, Tailwind, and jsdom test support:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
```

Create `tsconfig.json` with strict browser TypeScript settings:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

Create `tsconfig.node.json` for Vite configuration and a root `index.html` with `<div id="root"></div>` and `<script type="module" src="/src/main.tsx"></script>`.

- [ ] **Step 3: Add the React entrypoint and test setup**

Create `src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

Add only the Tailwind import to the initial `src/index.css`; product tokens and component styles are added in Task 5:

```css
@import 'tailwindcss';
```

- [ ] **Step 4: Run the scaffold smoke checks**

Run:

```bash
npm run build
npm run test
```

Expected: the build succeeds and Vitest reports no test files without failing. If Vitest exits with a “no test files found” error, add an empty `src/App.test.tsx` with `describe('DJ DOCHI', () => {})` before rerunning; the real failing tests are added in Task 3.

- [ ] **Step 5: Commit the scaffold**

```bash
git add package.json package-lock.json index.html tsconfig.json tsconfig.node.json vite.config.ts src/main.tsx src/test/setup.ts src/index.css
git commit -m "chore: scaffold dj dochi vite app"
```

---

### Task 2: Define state/data contracts and replaceable character asset lookup

**Files:**
- Create: `src/types.ts`
- Create: `src/data/playlist.ts`
- Create: `src/lib/dochiAssets.ts`
- Create: `src/assets/dochi/.gitkeep`

**Interfaces:**
- Produces `Screen`, `UploadMode`, `DochiPose`, `PlaylistInput`, `Track`, `DOCHI_ASSET_FILENAMES`, `getDochiAsset()`, and `DUMMY_TRACKS` for later components.

- [ ] **Step 1: Write the type contracts**

Create `src/types.ts`:

```ts
export type Screen = 'idle' | 'greeting' | 'upload' | 'loading' | 'result'

export type UploadMode = 'choose' | 'image-review' | 'text-review'

export type DochiPose = 'idle' | 'surprised' | 'thinking' | 'result'

export type PlaylistInput = {
  imageFile: File | null
  imageUrl: string | null
  pastedText: string
}

export type Track = {
  title: string
  artist: string
  mood: string
  stat: string
  color: 'coral' | 'amber' | 'violet' | 'mint'
}
```

- [ ] **Step 2: Add static result data**

Create `src/data/playlist.ts` with four concrete dummy tracks:

```ts
import type { Track } from '../types'

export const DUMMY_TRACKS: Track[] = [
  { title: 'Midnight City', artist: 'M83', mood: 'NEON / NIGHT', stat: '112 BPM', color: 'coral' },
  { title: 'Plastic Love', artist: 'Mariya Takeuchi', mood: 'CITY POP', stat: '104 BPM', color: 'amber' },
  { title: 'Space Song', artist: 'Beach House', mood: 'DREAMY / SOFT', stat: '91 BPM', color: 'violet' },
  { title: 'Get Lucky', artist: 'Daft Punk', mood: 'GROOVE / SUNSET', stat: '116 BPM', color: 'mint' },
]

export const DUMMY_MIX = {
  title: 'DOCHI\'S NIGHT DRIVE',
  subtitle: 'a little neon, a little nostalgia',
  score: 'A+ / 94%',
}
```

- [ ] **Step 3: Implement optional PNG lookup without importing missing files**

Create `src/lib/dochiAssets.ts`:

```ts
import type { DochiPose } from '../types'

const dochiFiles = import.meta.glob('../assets/dochi/*.png', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>

export const DOCHI_ASSET_FILENAMES: Record<DochiPose, string> = {
  idle: 'dochi-idle.png',
  surprised: 'dochi-surprised.png',
  thinking: 'dochi-thinking.png',
  result: 'dochi-result.png',
}

export function getDochiAsset(pose: DochiPose): string | undefined {
  const filename = DOCHI_ASSET_FILENAMES[pose]
  const matchingPath = Object.keys(dochiFiles).find((path) => path.endsWith(filename))
  return matchingPath ? dochiFiles[matchingPath] : undefined
}
```

Keep `src/assets/dochi/.gitkeep` empty. The glob returns an empty map until actual PNGs are added, so the project builds in the current asset-free state.

- [ ] **Step 4: Run the type check**

Run `npm run build`.

Expected: the build succeeds even though none of the four PNG files exists.

- [ ] **Step 5: Commit the contracts**

```bash
git add src/types.ts src/data/playlist.ts src/lib/dochiAssets.ts src/assets/dochi/.gitkeep
git commit -m "feat: add dj dochi state and asset contracts"
```

---

### Task 3: Add failing user-flow tests and implement the App state machine

**Files:**
- Create: `src/App.test.tsx`
- Create: `src/App.tsx`

**Interfaces:**
- Consumes: `Screen`, `UploadMode`, `PlaylistInput` from `src/types.ts`.
- Produces: `<App />`, which handles Idle → Greeting → Upload → Loading → Result and passes screen callbacks to child screens.

- [ ] **Step 1: Write the failing flow tests**

Create `src/App.test.tsx` with tests that exercise the requested behavior rather than implementation details:

```tsx
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('DJ DOCHI playlist handoff flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:playlist-preview'),
      revokeObjectURL: vi.fn(),
    })
  })

  it('keeps the handoff disabled until pasted text has content', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'START SESSION' }))
    await user.click(screen.getByRole('button', { name: '음악 목록 붙여넣기' }))

    const handoff = screen.getByRole('button', { name: '도치에게 건네기' })
    expect(handoff).toBeDisabled()

    await user.type(screen.getByLabelText('음악 목록'), 'M83 - Midnight City')
    expect(handoff).toBeEnabled()

    await user.click(handoff)
    expect(screen.getByText('도치가 음악을 분석하는 중...')).toBeInTheDocument()
  })

  it('previews, replaces, and deletes an uploaded image before handoff', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'START SESSION' }))
    await user.click(screen.getByRole('button', { name: '플레이리스트 캡처 업로드' }))

    const firstFile = new File(['first'], 'first.png', { type: 'image/png' })
    const fileInput = screen.getByLabelText('플레이리스트 캡처 파일')
    await user.upload(fileInput, firstFile)
    expect(screen.getByAltText('선택한 플레이리스트 캡처')).toHaveAttribute('src', 'blob:playlist-preview')
    expect(screen.getByRole('button', { name: '도치에게 건네기' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: '삭제' }))
    expect(screen.getByRole('button', { name: '플레이리스트 캡처 업로드' })).toBeInTheDocument()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:playlist-preview')
  })

  it('moves from handoff to result after the loading delay', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'START SESSION' }))
    await user.click(screen.getByRole('button', { name: '음악 목록 붙여넣기' }))
    await user.type(screen.getByLabelText('음악 목록'), 'Beach House - Space Song')
    await user.click(screen.getByRole('button', { name: '도치에게 건네기' }))

    expect(screen.getByText('잠깐만.')).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(1800)
    })
    expect(screen.getByText('봤어. 취향 좋네.')).toBeInTheDocument()
    vi.useRealTimers()
  })
})
```

Run `npm run test -- src/App.test.tsx`. Expected: FAIL because `src/App.tsx` and its screens do not exist yet.

- [ ] **Step 2: Implement the minimal state and object-URL lifecycle**

In `src/App.tsx`, define these initial values and handlers before adding visual screen components:

```tsx
const INITIAL_INPUT: PlaylistInput = { imageFile: null, imageUrl: null, pastedText: '' }
const LOADING_DELAY_MS = 1800

const [screen, setScreen] = useState<Screen>('idle')
const [uploadMode, setUploadMode] = useState<UploadMode>('choose')
const [input, setInput] = useState<PlaylistInput>(INITIAL_INPUT)

const clearImageUrl = useCallback(() => {
  if (input.imageUrl) URL.revokeObjectURL(input.imageUrl)
}, [input.imageUrl])

const resetInput = useCallback(() => {
  clearImageUrl()
  setInput(INITIAL_INPUT)
  setUploadMode('choose')
}, [clearImageUrl])

const handleImageSelect = (file: File) => {
  if (!file.type.startsWith('image/')) return
  clearImageUrl()
  setInput({ imageFile: file, imageUrl: URL.createObjectURL(file), pastedText: '' })
  setUploadMode('image-review')
}

const handleTextOpen = () => {
  clearImageUrl()
  setInput({ imageFile: null, imageUrl: null, pastedText: '' })
  setUploadMode('text-review')
}

const hasInput = Boolean(input.imageUrl || input.pastedText.trim())
```

Use a `useEffect` keyed by `screen` to move from Loading to Result after `LOADING_DELAY_MS`; return `clearTimeout` from the effect. Add a separate unmount effect that revokes `input.imageUrl` when the component is removed.

- [ ] **Step 3: Wire the screen transitions with placeholder markup**

Render based on `screen` and keep these transition rules exact:

```tsx
switch (screen) {
  case 'idle': return <IdleScreen onStart={() => setScreen('greeting')} />
  case 'greeting': return <GreetingScreen onChooseImage={() => { setUploadMode('choose'); setScreen('upload') }} onChooseText={() => { handleTextOpen(); setScreen('upload') }} />
  case 'upload': return <UploadScreen mode={uploadMode} input={input} hasInput={hasInput} onImageSelect={handleImageSelect} onTextOpen={handleTextOpen} onTextChange={(pastedText) => setInput((current) => ({ ...current, pastedText }))} onHandoff={() => hasInput && setScreen('loading')} onDelete={resetInput} onBack={() => { resetInput(); setScreen('greeting') }} />
  case 'loading': return <LoadingScreen />
  case 'result': return <ResultScreen onRestart={() => { resetInput(); setScreen('idle') }} />
}
```

The initial test should now pass for disabled/enabled text handoff, image preview lifecycle once the corresponding screen props are connected, and Loading/Result transition.

- [ ] **Step 4: Run the focused tests**

Run `npm run test -- src/App.test.tsx`.

Expected: all three user-flow tests pass. If a test fails, fix the state transition or accessible name at the source; do not loosen the test assertion.

- [ ] **Step 5: Commit the state machine**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: add dj dochi upload handoff state flow"
```

---

### Task 4: Build the screen and visual component boundaries

**Files:**
- Create: `src/components/DochiCharacter.tsx`
- Create: `src/components/StageShell.tsx`
- Create: `src/components/RetroButton.tsx`
- Create: `src/components/SpeechBubble.tsx`
- Create: `src/components/Turntable.tsx`
- Create: `src/components/Equalizer.tsx`
- Create: `src/screens/IdleScreen.tsx`
- Create: `src/screens/GreetingScreen.tsx`
- Create: `src/screens/UploadScreen.tsx`
- Create: `src/screens/LoadingScreen.tsx`
- Create: `src/screens/ResultScreen.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: state and handler props from `App`, `getDochiAsset`, `DUMMY_TRACKS`, and `DUMMY_MIX`.
- Produces: accessible, responsive screens with stable labels used by `src/App.test.tsx`.

The `UploadScreen` prop contract is:

```ts
type UploadScreenProps = {
  mode: UploadMode
  input: PlaylistInput
  hasInput: boolean
  onImageSelect: (file: File) => void
  onTextOpen: () => void
  onTextChange: (value: string) => void
  onHandoff: () => void
  onDelete: () => void
  onBack: () => void
}
```

- [ ] **Step 1: Implement the shared visual primitives**

Use typed props, semantic elements, and no inline SVG. `RetroButton` accepts `children`, `onClick`, optional `disabled`, `variant`, `type`, and `className`; `SpeechBubble` accepts `children` and optional `tone`; `StageShell` accepts `screen`, `children`, and optional `className`.

`StageShell` must render a brand lockup with `DJ DOCHI`, a `PROTOTYPE // 01` badge, a stage body, and a five-step progress row. Mark the active step with `aria-current="step"` and use labels `IDLE`, `HELLO`, `INPUT`, `SCAN`, and `MIX`.

- [ ] **Step 2: Implement image-first DochiCharacter with exact fallback size**

`DochiCharacter` accepts `{ pose: DochiPose; size?: 'hero' | 'compact'; className?: string }`, calls `getDochiAsset(pose)`, and renders an `<img>` with state-specific alt when an asset exists. If the `<img>` fires `onError`, replace it with a `DochiPlaceholder` div using the same outer `.dochi-character` dimensions. The placeholder must contain CSS elements for body, face, triangular spines, ears, closed eyes, headphones, and optional result glasses/paper.

- [ ] **Step 3: Implement the five screens**

Use these content and interaction requirements:

- `IdleScreen`: render `DochiCharacter pose="idle"`, rotating turntable, equalizer, `DJ DOCHI`, and `START SESSION`; clicking the character wrapper or CTA calls `onStart`.
- `GreetingScreen`: render `DochiCharacter pose="surprised"`, `SpeechBubble` with `엇? 손님이네. 요즘 듣는 플레이리스트 좀 보여줄래?`, plus buttons named exactly `플레이리스트 캡처 업로드` and `음악 목록 붙여넣기`.
- `UploadScreen` choose mode: render two source cards. The image card has a visible `<label htmlFor="playlist-file">` with the text `플레이리스트 캡처 업로드` and a hidden file input with `id="playlist-file"`, `aria-label="플레이리스트 캡처 파일"`, `accept="image/*"`, and `onChange` that passes the first selected file. The text card calls `onTextOpen`/the parent’s text mode handler and then shows text-review mode.
- `UploadScreen` image-review mode: render `<img src={input.imageUrl!} alt="선택한 플레이리스트 캡처" />`, filename, `다시 선택`, `삭제`, and `도치에게 건네기`. Keep a second hidden image input for `다시 선택` or reuse the same input with a ref.
- `UploadScreen` text-review mode: render `<textarea aria-label="음악 목록" value={input.pastedText} onChange={...} />`, line count, `삭제`, and `도치에게 건네기`. The textarea remains editable on the review screen.
- Both review modes use `disabled={!hasInput}` on `도치에게 건네기` and show a small hint explaining that the prototype does not analyze the input yet.
- `LoadingScreen`: render `DochiCharacter pose="thinking"`, `잠깐만.`, and `도치가 음악을 분석하는 중...` with animated turntable/equalizer decorations.
- `ResultScreen`: render `DochiCharacter pose="result"`, a speech bubble with `봤어. 취향 좋네.`, `DUMMY_MIX` metadata, every `DUMMY_TRACKS` row, and `다시 믹스하기`.

- [ ] **Step 4: Connect the components in App**

Replace placeholder screen returns in `App.tsx` with the real screen components. Pass `input`, `mode`, `hasInput`, and handlers explicitly. Keep all object URL creation/revocation in `App`; child screens only emit events.

- [ ] **Step 5: Rerun user-flow tests**

Run `npm run test -- src/App.test.tsx`.

Expected: all flow tests pass with the real screens and accessible labels.

- [ ] **Step 6: Commit the screen components**

```bash
git add src/App.tsx src/components src/screens
git commit -m "feat: add dj dochi screens and character fallback"
```

---

### Task 5: Apply the retro low-poly DJ booth visual system and responsive behavior

**Files:**
- Modify: `src/index.css`
- Modify: `index.html`

**Interfaces:**
- Consumes the class names emitted by `StageShell`, screens, primitives, and `DochiPlaceholder`.
- Produces the final dark DJ booth aesthetic without external image dependencies.

- [ ] **Step 1: Add document metadata**

Set `index.html` title to `DJ DOCHI — AI Hedgehog DJ` and description to `A playful playlist handoff prototype with DJ DOCHI.`. Set the viewport meta tag to `width=device-width, initial-scale=1.0`.

- [ ] **Step 2: Define visual tokens and base layout**

In `src/index.css`, keep `@import 'tailwindcss';` first, then define CSS variables for `--ink: #09080b`, `--panel: #15131a`, `--panel-raised: #201c27`, `--cream: #f7e9c9`, `--muted: #a69caf`, `--coral: #ff6b55`, `--amber: #f5b94c`, `--violet: #8b68ff`, and `--mint: #74e0ba`. Add `box-sizing`, body background, focus-visible outlines, `.app-shell`, `.stage`, `.stage-grid`, `.stage-card`, `.screen-header`, and mobile breakpoints at 720px.

- [ ] **Step 3: Add low-poly placeholder styling**

Use CSS `clip-path: polygon(...)` for large triangular spine blocks, ears, shoes, and the paper card. Use gradients only for plastic-like face/headphone highlights; do not draw realistic fur. The placeholder outer size must be stable:

```css
.dochi-character--hero { width: min(30rem, 68vw); aspect-ratio: 0.82; }
.dochi-character--compact { width: 11rem; aspect-ratio: 0.82; }
```

The face uses closed eyes in idle/thinking, a surprised mouth in Greeting, and CSS glasses/paper in Result. The large headphone earcups must be visually dominant on every fallback pose.

- [ ] **Step 4: Add motion and reduced-motion rules**

Animate `.dochi-character--idle` with a 2.6s ease-in-out bob, `.turntable-record` with a 7s linear infinite rotation, `.equalizer-bar` with staggered 0.8–1.2s pulse, and `.loading-ring` with a 1.4s linear infinite rotation. Add:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 5: Add mobile layout rules**

At max-width 720px, make `.stage` use `min-height: 100svh`, reduce horizontal padding to `1rem`, stack result/upload panels, reduce the hero character to `min(19rem, 72vw)`, make buttons full width, and keep the filename/metadata from overflowing with `overflow-wrap: anywhere`.

- [ ] **Step 6: Run tests and build**

Run:

```bash
npm run test
npm run build
```

Expected: all tests pass and Vite emits a production build with no missing-asset errors.

- [ ] **Step 7: Commit the visual system**

```bash
git add index.html src/index.css
git commit -m "style: add retro low poly dj booth theme"
```

---

### Task 6: Final verification and handoff

**Files:**
- Verify: all files under `src/`, `index.html`, and `package.json`

- [ ] **Step 1: Run the complete automated checks**

Run `npm run test` and `npm run build` from the project root.

Expected: Vitest passes every test and the TypeScript/Vite production build succeeds.

- [ ] **Step 2: Verify the asset replacement contract**

Temporarily add one local PNG to `src/assets/dochi/dochi-idle.png` only if an image is available during verification, start the dev server, and confirm the image replaces only the idle placeholder. Remove only that temporary file afterward if it was created; never add the supplied reference images. The final code must still build when the folder contains only `.gitkeep`.

- [ ] **Step 3: Verify the required behavior checklist**

Confirm the following using the test suite and a local dev session:

1. Idle character or `START SESSION` reaches Greeting.
2. Both Greeting buttons reach Upload.
3. Image selection shows a local preview before handoff.
4. Text input remains visible and editable before handoff.
5. Empty review state disables `도치에게 건네기`.
6. Delete and reselect return to the correct review/choose state and revoke object URLs.
7. Handoff is the only action that reaches Loading.
8. Loading reaches dummy Result without API/OCR.
9. Result shows glasses/paper styling and the dummy playlist.
10. `다시 믹스하기` cleans input and returns to Idle.

- [ ] **Step 4: Report files, checks, and any unavoidable environment limitation**

Include the app entrypoint, the design/plan documents, test command, build command, and whether the read-only `.git` boundary prevented commits. Do not claim browser QA unless it was actually performed.
