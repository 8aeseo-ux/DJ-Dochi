# DJ DOCHI Sketchbook Readability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the single-page music sketchbook aesthetic while separating the DJ scene from readable interaction UI and moving all functional text to a clean Gothic typeface.

**Architecture:** Add two layout-only boundaries inside `DochiRoom`: `room-visual` owns every decorative and animated scene object, while `room-interface` owns every dialogue, input, review, status, and error surface. Keep state, props, callbacks, overlays, and data flow unchanged; implement presentation through the final `sketch-theme.css` layer with desktop columns and stacked tablet/mobile layouts.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, CSS, Pretendard 1.3.9, Gaegu

## Global Constraints

- Preserve OCR, AI Vision, LLM, catalog, LP physics, camera, polaroid, and mixtape state behavior.
- Keep `DochiRoom`, existing component props, and `useDjDochiFlow` public interfaces unchanged.
- Use Pretendard for every meaningful UI string and Gaegu only for decorative notes.
- Keep the upload box interior free of patterns, doodles, gradients, and transparent scene bleed.
- Keep doodles inside `room-visual` at opacity `0.10` to `0.16`.
- Guarantee primary button height of at least `44px`.
- Use a 58/42 layout at 1100px+, 54/46 at 901px–1099px, and a stacked layout at 900px and below.
- Validate 1440px, 1024px, 768px, and 390px widths.
- Preserve `prefers-reduced-motion`.
- Do not stage or commit the user-owned `pnpm-workspace.yaml`.

---

### Task 1: Separate the room scene from the interaction interface

**Files:**
- Modify: `src/components/DochiRoom.tsx:90-345`
- Modify: `src/App.test.tsx:1-220`

**Interfaces:**
- Consumes: existing `state`, `dialogue`, `inputMode`, extraction state, taste state, and final dialogue booleans inside `DochiRoom`
- Produces: stable `.room-visual`, `.room-interface`, `.room-interface--empty`, and `.room-stage--with-interface` DOM contracts used by all later CSS tasks

- [ ] **Step 1: Write the failing layout-boundary test**

Add `within` to the Testing Library import and add this test inside `DJ DOCHI fixed-room flow`:

```tsx
it('keeps scene objects and readable UI in separate room layers', async () => {
  const user = userEvent.setup()
  const { container } = render(<App />)

  const visual = container.querySelector('.room-visual')
  const roomInterface = container.querySelector('.room-interface')

  expect(visual).toBeInTheDocument()
  expect(roomInterface).toBeInTheDocument()
  expect(roomInterface).toHaveClass('room-interface--empty')
  expect(container.querySelector('.room-stage')).not.toHaveClass('room-stage--with-interface')
  expect(visual?.querySelector('.room-character')).toBeInTheDocument()
  expect(visual?.querySelector('.room-controller-layer')).toBeInTheDocument()
  expect(roomInterface?.querySelector('.room-character')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'DJ 도치 idle' }))

  expect(roomInterface).not.toHaveClass('room-interface--empty')
  expect(container.querySelector('.room-stage')).toHaveClass('room-stage--with-interface')
  expect(
    within(roomInterface as HTMLElement).getByRole('button', { name: '도치의 대화' }),
  ).toBeInTheDocument()
})
```

In the existing end-to-end room-flow test, immediately after the LP slider appears, assert that the LP record stays in `.room-visual` while its readable status is in `.room-interface`:

```tsx
const visual = document.querySelector('.room-visual')
const roomInterface = document.querySelector('.room-interface')
const vinylStatus = document.querySelector('.room-vinyl-status')

expect(visual).toContainElement(screen.getByRole('slider', { name: 'LP를 돌려 믹스를 시작하세요' }))
expect(roomInterface).toContainElement(vinylStatus)
expect(visual).not.toContainElement(vinylStatus)
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
rtk run 'PATH=/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override:$PATH pnpm exec vitest run src/App.test.tsx'
```

Expected: FAIL because `.room-visual` and `.room-interface` do not exist.

- [ ] **Step 3: Add the minimal stable layout boundaries**

In `DochiRoom.tsx`, derive whether readable interface content exists:

```tsx
const hasRoomInterface =
  Boolean(dialogue) ||
  isMixing ||
  (state === 'choosingInput' && !inputMode) ||
  Boolean(inputMode) ||
  state === 'extracting' ||
  isAnalyzingTaste ||
  (state === 'extractionReview' && Boolean(extractionResult)) ||
  (state === 'extractionError' && Boolean(extractionError)) ||
  (state === 'tasteAnalysisError' && Boolean(tasteAnalysisError)) ||
  isPhotoPromptChoice ||
  isFinalTapeChoice
```

Add `room-stage--with-interface` from that boolean instead of relying on `:has()`:

```tsx
<main
  className={`room-stage room-stage--${state} ${hasRoomInterface ? 'room-stage--with-interface' : ''} ${isOverdrive ? 'room-stage--overdrive' : ''}`.trim()}
  style={roomStyle}
>
```

Inside `room-stage`, wrap scene-only elements:

```tsx
<section className="room-visual" aria-label="DJ 도치 작업실 장면">
  {/* room-wall-mark through idle-hint */}
</section>
```

Wrap dialogue, choices, input, extraction, taste, and error surfaces:

```tsx
<section
  className={`room-interface ${hasRoomInterface ? '' : 'room-interface--empty'}`.trim()}
  aria-hidden={!hasRoomInterface}
>
  {/* DialogueBox through TasteAnalysisErrorPanel and final prompt choices */}
</section>
```

Keep the interactive LP inside `room-visual`, but add a presentation-only `.room-vinyl-status` inside `room-interface` while `isMixing` is true. It shows the current instruction, `spinEnergy` gauge, or recording state without changing `VinylInteraction` physics or callbacks:

```tsx
{isMixing && (
  <div
    className={`room-vinyl-status room-vinyl-status--${vinylPhase}`}
    role="status"
    aria-label="LP 작업 안내"
  >
    <span className="screen-eyebrow">DOCHI MIX / LIVE</span>
    <strong>
      {state === 'working'
        ? 'LP를 힘껏 밀고 놓아봐.'
        : state === 'recording'
          ? 'REC · Recording...'
          : '좋아. 이제 녹음할게.'}
    </strong>
    {state === 'working' && (
      <span className="room-vinyl-status__track" aria-hidden="true">
        <i style={{ width: `${Math.round(spinEnergy * 100)}%` }} />
      </span>
    )}
  </div>
)}
```

Keep `CameraCapture`, `PhotoReview`, `PolaroidComposer`, `FinalMixtape`, and `room-footer` outside both wrappers so their existing full-stage overlays remain unchanged.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the same Vitest command.

Expected: `src/App.test.tsx` passes with the new wrapper contract and existing flow tests remain green.

- [ ] **Step 5: Commit the structural boundary**

```bash
rtk git add src/components/DochiRoom.tsx src/App.test.tsx
rtk git commit -m "refactor: separate room scene from interface"
```

---

### Task 2: Split functional Gothic typography from decorative handwriting

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/index.css:1-7`
- Modify: `src/styles/sketch-theme.css:1-130`
- Modify: `src/styles/sketch-theme.test.ts:1-70`

**Interfaces:**
- Consumes: `.room-visual` and `.room-interface` contracts from Task 1
- Produces: `--font-ui` for meaningful text and `--font-note` for decorative text

- [ ] **Step 1: Write failing font-role tests**

Extend the first two theme tests:

```ts
it('loads local Gothic UI text before decorative handwriting and theme overrides', () => {
  expect(indexCss).toContain("@import 'pretendard/dist/web/static/pretendard.css'")
  expect(indexCss).toContain("@import '@fontsource/gaegu/400.css'")
  expect(indexCss.indexOf("pretendard/dist/web/static/pretendard.css"))
    .toBeLessThan(indexCss.indexOf("@fontsource/gaegu/400.css"))
  expect(indexCss.indexOf("./styles/sketch-theme.css"))
    .toBeGreaterThan(indexCss.indexOf("./styles/dj-dochi.css"))
})

it('separates readable UI typography from decorative notes', () => {
  expect(themeCss).toContain('--font-ui:')
  expect(themeCss).toContain('--font-note:')
  expect(themeCss).toContain('font-family: var(--font-ui)')
  expect(themeCss).toContain('.room-visual::before')
  expect(themeCss).toContain('font-family: var(--font-note)')
})
```

- [ ] **Step 2: Run the theme test and verify RED**

```bash
rtk run 'PATH=/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override:$PATH pnpm exec vitest run src/styles/sketch-theme.test.ts'
```

Expected: FAIL because Pretendard and `--font-ui` are missing.

- [ ] **Step 3: Install and load Pretendard**

Run:

```bash
rtk run 'PATH=/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override:$PATH pnpm add pretendard@^1.3.9'
```

At the top of `src/index.css`, load Pretendard before Gaegu:

```css
@import 'pretendard/dist/web/static/pretendard.css';
@import '@fontsource/gaegu/400.css';
@import '@fontsource/gaegu/700.css';
```

- [ ] **Step 4: Implement explicit font roles**

Add the token:

```css
--font-ui: "Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI",
  "Apple SD Gothic Neo", sans-serif;
```

Set `body`, form controls, buttons, and meaningful UI selectors to `var(--font-ui)`. Restrict `var(--font-note)` to:

```css
.room-visual::before,
.room-wall-mark,
.vinyl-interaction__label,
.mixtape-card__sticker,
.final-mixtape__signature {
  font-family: var(--font-note);
}
```

Move dialogue, choice, panel headings, buttons, inputs, workshop status, vinyl instructions, camera text, track rows, and platform controls to `var(--font-ui)`.

- [ ] **Step 5: Run the theme test and verify GREEN**

Run the same focused theme command.

Expected: the font-load order and role-separation tests pass.

- [ ] **Step 6: Commit the typography foundation**

```bash
rtk git add package.json pnpm-lock.yaml src/index.css src/styles/sketch-theme.css src/styles/sketch-theme.test.ts
rtk git commit -m "style: separate UI and decorative typography"
```

---

### Task 3: Build the desktop visual/interface layout and readable surfaces

**Files:**
- Modify: `src/styles/sketch-theme.css:127-470`
- Modify: `src/styles/sketch-theme.test.ts:30-115`

**Interfaces:**
- Consumes: `.room-visual`, `.room-interface`, `.room-interface--empty`, `--font-ui`
- Produces: non-overlapping 58/42 and 54/46 desktop layouts plus opaque interaction surfaces

- [ ] **Step 1: Write failing desktop readability contract tests**

Add a small selector helper near the test setup so assertions inspect one rule rather than matching unrelated CSS:

```ts
function ruleFor(selector: string) {
  const start = themeCss.indexOf(`${selector} {`)
  if (start < 0) return ''
  const end = themeCss.indexOf('}', start)
  return themeCss.slice(start, end + 1)
}
```

Then add:

```ts
it('keeps scene decoration inside the visual layer and the UI on opaque paper', () => {
  expect(ruleFor('.room-visual::after')).toContain('opacity: 0.14')
  expect(ruleFor('.room-interface')).toContain('background: var(--sketch-paper-bright)')
  expect(ruleFor('.room-interface--empty')).toContain('display: none')
})

it('keeps upload and action surfaces clean and readable', () => {
  expect(ruleFor('.file-dropzone')).toContain('background: var(--sketch-paper-bright)')
  expect(ruleFor('.file-dropzone')).not.toContain('gradient')
  expect(ruleFor('.retro-button')).toContain('min-height: 44px')
})
```

- [ ] **Step 2: Run the theme test and verify RED**

Run the focused theme command from Task 2.

Expected: FAIL because the current doodle selector, opacity, interface background, and clean upload rules are absent.

- [ ] **Step 3: Implement the desktop layout**

Use the outer stage as the layout grid:

```css
.room-stage {
  display: grid;
  grid-template-columns: minmax(0, 58fr) minmax(22rem, 42fr);
  min-height: 44rem;
  overflow: hidden;
}

.room-stage:not(.room-stage--with-interface) {
  grid-template-columns: minmax(0, 1fr);
}

.room-visual {
  position: relative;
  min-width: 0;
  min-height: 44rem;
  overflow: hidden;
  isolation: isolate;
}

.room-interface {
  position: relative;
  z-index: 20;
  min-width: 0;
  max-height: 44rem;
  padding: clamp(1.25rem, 2.4vw, 2.2rem);
  overflow: auto;
  background: var(--sketch-paper-bright);
  border-left: 1.5px solid var(--sketch-ink);
}

.room-interface--empty {
  display: none;
}

.room-vinyl-status {
  position: relative;
  width: 100%;
  padding: 1.25rem;
  background: var(--sketch-paper-bright);
  color: var(--sketch-ink);
}
```

At 1099px and below, change the columns to `54fr 46fr`.

Make former absolute UI children participate in normal flow:

```css
.room-interface > .dialogue-box,
.room-interface > .choice-menu,
.room-interface > .playlist-input-panel,
.room-interface > .playlist-extraction-review,
.room-interface > .playlist-extraction-status,
.room-interface > .playlist-extraction-error,
.room-interface > .taste-analysis-status,
.room-interface > .taste-analysis-error {
  position: relative;
  inset: auto;
  width: 100%;
  max-height: none;
}

.room-visual .vinyl-interaction__hint,
.room-visual .vinyl-energy,
.room-visual .vinyl-interaction__recording-label {
  display: none;
}
```

The new `.room-vinyl-status` replaces those duplicated visual-layer labels and keeps the LP record itself interactive and accessible.

- [ ] **Step 4: Constrain scene objects to the visual layer**

Move doodle pseudo-elements from `.room-stage` to `.room-visual`, use opacity `0.14`, and set all visual children relative to `.room-visual`.

Update scene sizing:

```css
.room-character {
  bottom: 20%;
  left: 6%;
  width: min(88%, 34rem);
}

.room-controller-layer {
  right: 3%;
  bottom: 3%;
  left: 3%;
}

.room-controller {
  width: min(100%, 44rem);
}
```

Keep `z-index` values below `.room-interface` and preserve pointer behavior.

- [ ] **Step 5: Make dialogue, buttons, and upload surfaces readable**

Use these minimums:

```css
.dialogue-box__line {
  font-size: clamp(1.25rem, 1.7vw, 1.5rem);
  font-weight: 650;
  line-height: 1.55;
}

.retro-button,
.platform-listen__button,
.final-mixtape__platform-button {
  min-height: 44px;
  color: var(--sketch-ink);
  background: var(--sketch-paper-bright);
  font-size: 0.95rem;
  font-weight: 700;
}

.file-dropzone,
.upload-card,
.paste-area,
.playlist-input-panel textarea,
.playlist-extraction-review input,
.playlist-extraction-review textarea {
  background: var(--sketch-paper-bright);
}
```

Darken `--sketch-pencil` to `#514e48`, increase divider contrast, remove interactive-control rotations above `0.1deg`, and remove upload-area decorative backgrounds.

- [ ] **Step 6: Run focused tests and verify GREEN**

```bash
rtk run 'PATH=/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override:$PATH pnpm exec vitest run src/App.test.tsx src/styles/sketch-theme.test.ts'
```

Expected: both files pass.

- [ ] **Step 7: Commit the desktop readability layer**

```bash
rtk git add src/styles/sketch-theme.css src/styles/sketch-theme.test.ts
rtk git commit -m "style: prioritize readable room interface"
```

---

### Task 4: Add explicit tablet and mobile non-overlap behavior

**Files:**
- Modify: `src/styles/sketch-theme.css:900-end`
- Modify: `src/styles/sketch-theme.test.ts:70-130`

**Interfaces:**
- Consumes: desktop grid and normal-flow interface surfaces from Task 3
- Produces: deterministic 1024px, 768px, and 390px layout contracts

- [ ] **Step 1: Write failing breakpoint tests**

Add:

```ts
it('defines desktop, tablet, and mobile readability breakpoints', () => {
  expect(themeCss).toContain('@media (max-width: 1099px)')
  expect(themeCss).toContain('grid-template-columns: minmax(0, 54fr) minmax(22rem, 46fr)')
  expect(themeCss).toContain('@media (max-width: 900px)')
  expect(themeCss).toContain('grid-template-columns: minmax(0, 1fr)')
  expect(themeCss).toContain('@media (max-width: 520px)')
  expect(themeCss).toContain('min-height: 44px')
})
```

- [ ] **Step 2: Run the theme test and verify RED**

Run the focused theme command.

Expected: FAIL because the new breakpoints are not present.

- [ ] **Step 3: Implement the 1024px layout**

```css
@media (max-width: 1099px) and (min-width: 901px) {
  .room-stage {
    grid-template-columns: minmax(0, 54fr) minmax(22rem, 46fr);
  }

  .room-character {
    left: 4%;
    width: min(92%, 29rem);
  }
}
```

Keep body and button font sizes unchanged.

- [ ] **Step 4: Implement the 768px stacked layout**

```css
@media (max-width: 900px) {
  .room-stage {
    grid-template-columns: minmax(0, 1fr);
    min-height: 0;
    overflow: visible;
  }

  .room-visual {
    min-height: clamp(28rem, 62vw, 34rem);
  }

  .room-interface {
    max-height: none;
    overflow: visible;
    border-top: 1.5px solid var(--sketch-ink);
    border-left: 0;
  }
}
```

- [ ] **Step 5: Implement the 390px layout**

```css
@media (max-width: 520px) {
  .room-visual {
    min-height: 25rem;
  }

  .room-interface {
    padding: 1.1rem 0.9rem 1.4rem;
  }

  .room-interface .choice-menu,
  .playlist-input-panel__actions,
  .playlist-extraction-review__actions {
    grid-template-columns: 1fr;
  }

  .room-interface .retro-button {
    width: 100%;
    min-height: 44px;
  }
}
```

Add overflow wrapping for filenames, track titles, artists, and error messages.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run the Task 3 focused test command.

Expected: layout and theme contract tests pass.

- [ ] **Step 7: Commit responsive behavior**

```bash
rtk git add src/styles/sketch-theme.css src/styles/sketch-theme.test.ts
rtk git commit -m "style: prevent responsive room overlap"
```

---

### Task 5: Unify late-flow readability and run visual QA

**Files:**
- Modify: `src/styles/sketch-theme.css:590-920`
- Modify: `src/styles/sketch-theme.test.ts:90-end`
- Modify only if visual QA exposes a scoped layout issue: `src/components/DochiRoom.tsx`

**Interfaces:**
- Consumes: font and layout contracts from Tasks 1–4
- Produces: readable LP, camera, review, and final mixtape UI plus viewport evidence

- [ ] **Step 1: Write failing late-flow readability tests**

Add:

```ts
it('uses the Gothic UI role for late-flow controls and result content', () => {
  for (const selector of [
    '.room-vinyl-status',
    '.camera-capture__panel',
    '.photo-review__panel',
    '.mixtape-overlay__card',
    '.final-mixtape__card',
    '.platform-listen__button',
  ]) {
    expect(ruleFor(selector)).toContain('font-family: var(--font-ui)')
  }

  expect(ruleFor('.camera-capture__panel')).toContain('background: var(--sketch-paper-bright)')
  expect(ruleFor('.final-mixtape__card')).toContain('background: var(--sketch-paper-bright)')
})
```

- [ ] **Step 2: Run the theme test and verify RED**

Run the focused theme command.

Expected: FAIL until late-flow UI selectors use the Gothic role and opaque surfaces.

- [ ] **Step 3: Apply readable late-flow styles**

Set `.room-vinyl-status`, camera headings, camera descriptions, photo review actions, result title, taste profile, track list, and platform controls to `var(--font-ui)`.

Keep only the LP center label, decorative mixtape sticker, and Dochi signature on `var(--font-note)`.

Set camera and mixtape panels to:

```css
background: var(--sketch-paper-bright);
color: var(--sketch-ink);
```

Maintain existing overlay positioning and camera behavior.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Task 3 focused command.

Expected: all focused layout and theme tests pass.

- [ ] **Step 5: Perform browser QA at the required widths**

Use the in-app browser with the running Vite server. Check:

- 1440×900: Idle, dialogue, upload/review, LP, final result
- 1024×900: dialogue and input panel remain in 54/46 columns
- 768×1024: visual area stacks above UI, no overlap
- 390×844: buttons stack, no horizontal scroll, body text is at least 15px

For each viewport, evaluate:

```js
({
  overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  visual: document.querySelector('.room-visual')?.getBoundingClientRect(),
  roomInterface: document.querySelector('.room-interface:not(.room-interface--empty)')?.getBoundingClientRect(),
})
```

Confirm rectangles do not overlap in two-column mode and are vertically ordered in stacked mode. Confirm browser warning/error logs are empty.

- [ ] **Step 6: Run the complete verification suite**

```bash
rtk run 'PATH=/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override:$PATH pnpm test'
rtk run 'PATH=/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override:$PATH pnpm exec tsc -b'
rtk run 'PATH=/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override:$PATH pnpm build'
rtk git diff --check
```

Expected:

- all Vitest files and tests pass
- TypeScript exits 0
- Vite production build exits 0
- `git diff --check` has no output

- [ ] **Step 7: Commit the final late-flow and QA adjustments**

```bash
rtk git add src/styles/sketch-theme.css src/styles/sketch-theme.test.ts src/components/DochiRoom.tsx
rtk git commit -m "style: complete accessible sketchbook UI"
```

Before staging, omit `src/components/DochiRoom.tsx` if visual QA did not require a Task 5 adjustment. Never stage `pnpm-workspace.yaml`.
