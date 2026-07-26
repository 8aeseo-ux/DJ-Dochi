# DJ DOCHI Sketchbook Work Note Theme V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn DJ DOCHI into a spacious, unruled music sketchbook page whose scene is formed by direct black-ink drawings, handwritten notes, and restrained color accents without changing any product flow.

**Architecture:** Keep `src/styles/dj-dochi.css` as the layout and behavior layer and replace presentation through the last-loaded `src/styles/sketch-theme.css`. Bundle `Gaegu` locally for short handwritten copy, draw one reusable workshop line-art scene in `src/assets/sketch/workshop-doodles.svg`, and apply it as a non-interactive CSS background so React state and component structure remain unchanged.

**Tech Stack:** React 19, Vite 8, TypeScript 5.9, CSS, SVG, Vitest 4, `@fontsource/gaegu`, pnpm

## Global Constraints

- Preserve OCR, LLM, catalog verification, LP physics, camera, and final mixtape behavior.
- Preserve existing React component structure, state classes, asset positions, and responsive breakpoints.
- Work in the current non-main feature branch because the existing theme files are uncommitted there.
- Use one nearly solid warm-white sketchbook page with no ruled-line or margin-line pattern.
- Do not use paper cutouts, masking tape, white sticker outlines, or floating-card shadows.
- Keep Dochi and the DJ controller in restrained natural color; all surrounding scene marks use black ink.
- Use whitespace, headings, short underlines, and open composition before adding a box.
- Use frames only for inputs, camera/review dialogs, and clickable controls that require visible boundaries.
- Use one large workshop line-art composition plus 2–4 contextual handwritten notes per state.
- Set every decorative SVG or pseudo-element to `pointer-events: none`.
- Preserve focus visibility and `prefers-reduced-motion`.

---

## File Structure

- Modify `package.json` and `pnpm-lock.yaml`: add locally bundled `@fontsource/gaegu`.
- Modify `src/index.css`: import the font and keep `sketch-theme.css` last.
- Create `src/assets/sketch/workshop-doodles.svg`: persistent black-ink cables, waveforms, arrows, notes, and vibration marks.
- Rewrite `src/styles/sketch-theme.css`: unruled page, selective ink frames, asset integration, all workflow surfaces.
- Rewrite `src/styles/sketch-theme.test.ts`: contract tests for the final reference direction.
- Do not modify React components unless visual verification proves the background asset cannot be positioned through existing classes.

---

### Task 1: Establish the final reference contract and local handwriting font

**Files:**
- Modify: `src/styles/sketch-theme.test.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: existing CSS import order.
- Produces: a red/green source contract and local `Gaegu` font faces for later tasks.

- [ ] **Step 1: Write the failing final-direction tests**

Replace `src/styles/sketch-theme.test.ts` with:

```ts
// @vitest-environment node

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const indexCss = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
const themeCss = readFileSync(new URL('./sketch-theme.css', import.meta.url), 'utf8')

describe('music sketchbook work note theme', () => {
  it('loads local handwriting fonts before the final theme layer', () => {
    expect(indexCss).toContain("@import '@fontsource/gaegu/400.css'")
    expect(indexCss).toContain("@import '@fontsource/gaegu/700.css'")
    expect(indexCss.indexOf("@fontsource/gaegu/700.css"))
      .toBeLessThan(indexCss.indexOf("./styles/dj-dochi.css"))
    expect(indexCss.indexOf("./styles/sketch-theme.css"))
      .toBeGreaterThan(indexCss.indexOf("./styles/dj-dochi.css"))
  })

  it('defines an unruled ink sketchbook palette', () => {
    for (const token of [
      '--sketch-paper',
      '--sketch-ink',
      '--sketch-pencil',
      '--sketch-red',
      '--sketch-blue',
      '--sketch-yellow',
      '--font-note',
    ]) {
      expect(themeCss).toContain(token)
    }

    expect(themeCss).not.toContain('--paper-shadow')
    expect(themeCss).not.toContain('--notebook-line-blue')
    expect(themeCss).not.toContain('--notebook-margin-red')
  })

  it('keeps the structural and workflow surface contracts', () => {
    for (const selector of [
      '.app-shell',
      '.room-stage',
      '.room-character',
      '.room-controller-layer',
      '.dialogue-box',
      '.choice-menu',
      '.playlist-input-panel',
      '.playlist-extraction-review',
      '.vinyl-interaction',
      '.camera-capture__panel',
      '.final-mixtape__card',
      '.platform-listen__button',
    ]) {
      expect(themeCss).toContain(selector)
    }
  })

  it('includes interaction and accessibility safeguards', () => {
    expect(themeCss).toContain('pointer-events: none')
    expect(themeCss).toContain(':focus-visible')
    expect(themeCss).toContain('@media (max-width: 760px)')
    expect(themeCss).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
```

- [ ] **Step 2: Verify RED**

Run:

```bash
pnpm exec vitest run src/styles/sketch-theme.test.ts
```

Expected: FAIL on missing font imports and `--sketch-*` tokens, proving the old collage theme cannot satisfy the final reference.

- [ ] **Step 3: Install and import the font**

Run:

```bash
pnpm add @fontsource/gaegu
```

Set `src/index.css` to:

```css
@import '@fontsource/gaegu/400.css';
@import '@fontsource/gaegu/700.css';
@import 'tailwindcss';
@import './styles/tokens.css';
@import './styles/dj-dochi.css';
@import './styles/sketch-theme.css';
```

- [ ] **Step 4: Verify the font contract turns green while theme tokens remain red**

Run:

```bash
pnpm exec vitest run src/styles/sketch-theme.test.ts
```

Expected: font and import-order assertions PASS; palette assertions remain FAIL.

---

### Task 2: Build the unruled page and persistent workshop line art

**Files:**
- Create: `src/assets/sketch/workshop-doodles.svg`
- Modify: `src/styles/sketch-theme.css`
- Test: `src/styles/sketch-theme.test.ts`

**Interfaces:**
- Consumes: `.app-shell`, `.room-stage`, `.room-character`, `.room-controller-layer`.
- Produces: a single unruled page and one CSS-positioned decorative SVG scene.

- [ ] **Step 1: Add failing line-art asset assertions**

Extend the test file:

```ts
const workshopDoodles = readFileSync(
  new URL('../assets/sketch/workshop-doodles.svg', import.meta.url),
  'utf8',
)

it('uses one hand-drawn workshop SVG without interactive behavior', () => {
  expect(workshopDoodles).toContain('<svg')
  expect(workshopDoodles).toContain('stroke="currentColor"')
  expect(workshopDoodles).toContain('fill="none"')
  expect(themeCss).toContain("url('../assets/sketch/workshop-doodles.svg')")
  expect(themeCss).toContain('pointer-events: none')
})
```

- [ ] **Step 2: Verify RED**

Run:

```bash
pnpm exec vitest run src/styles/sketch-theme.test.ts
```

Expected: FAIL because the SVG file and CSS reference do not exist.

- [ ] **Step 3: Draw the workshop SVG**

Create an SVG with `viewBox="0 0 1200 720"`, `fill="none"`, `stroke="currentColor"`, `stroke-linecap="round"`, `stroke-linejoin="round"`, and varied `stroke-width` values from `2` to `5`.

The paths must include:

- one loose cable sweeping from the left speaker beneath the controller;
- three short sound-wave groups around each speaker;
- one curved arrow pointing toward the controller;
- four irregular music-note marks in open upper space;
- one hand-drawn equalizer cluster;
- two crossed-out trial marks near the right edge;
- no rectangles that resemble UI cards.

Use only `<path>`, `<circle>`, and `<g>` elements so the drawing stays monochrome and scales cleanly.

- [ ] **Step 4: Replace the theme foundation**

Begin `src/styles/sketch-theme.css` with:

```css
:root {
  --sketch-paper: #f8f7f2;
  --sketch-paper-warm: #f1efe7;
  --sketch-ink: #23221f;
  --sketch-pencil: #716e67;
  --sketch-faint: rgba(35, 34, 31, 0.16);
  --sketch-red: #da7069;
  --sketch-blue: #5574a6;
  --sketch-yellow: #d8b94f;
  --sketch-green: #4f7b67;
  --font-note: "Gaegu", "Apple SD Gothic Neo", sans-serif;

  --ink: var(--sketch-paper);
  --ink-soft: var(--sketch-paper-warm);
  --panel: transparent;
  --panel-raised: transparent;
  --panel-light: rgba(255, 255, 255, 0.14);
  --panel-quiet: transparent;
  --cream: var(--sketch-ink);
  --muted: var(--sketch-pencil);
  --dim: #817d74;
  --coral: var(--sketch-red);
  --amber: var(--sketch-yellow);
  --violet: var(--sketch-blue);
  --mint: var(--sketch-green);
  --line: var(--sketch-faint);
  --line-bright: var(--sketch-ink);
}

html,
body,
.app-shell {
  color: var(--sketch-ink);
  background: var(--sketch-paper);
}

.app-shell {
  overflow-x: clip;
}

.app-shell::before {
  opacity: 0.08;
  background-image: radial-gradient(
    rgba(35, 34, 31, 0.28) 0.45px,
    transparent 0.7px
  );
  background-size: 19px 23px;
  mask-image: none;
}

.room-stage {
  color: var(--sketch-ink);
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.room-stage::after {
  content: "";
  position: absolute;
  inset: 4.5rem 1.5rem 1.2rem;
  z-index: 1;
  color: var(--sketch-ink);
  background: url('../assets/sketch/workshop-doodles.svg') center / contain no-repeat;
  border: 0;
  opacity: 0.48;
  pointer-events: none;
}
```

- [ ] **Step 5: Integrate the natural-color assets without stickers**

Add:

```css
.room-character,
.room-controller-layer {
  filter: none;
}

.room-character::before,
.room-controller-layer::after {
  content: none;
}

.dochi-character,
.room-controller {
  mix-blend-mode: multiply;
  filter: saturate(0.72) contrast(1.03);
}

.room-controller-layer {
  opacity: 0.94;
}
```

- [ ] **Step 6: Verify GREEN**

Run:

```bash
pnpm exec vitest run src/styles/sketch-theme.test.ts
```

Expected: palette, SVG, asset integration, and import tests PASS.

---

### Task 3: Open the UI composition and redraw only necessary controls

**Files:**
- Modify: `src/styles/sketch-theme.css`
- Test: `src/styles/sketch-theme.test.ts`

**Interfaces:**
- Consumes: existing panel, button, dialogue, choice, upload, OCR, and error classes.
- Produces: whitespace-first content groups and thin hand-drawn controls.

- [ ] **Step 1: Add failing open-composition assertions**

Add:

```ts
it('uses open composition and thin control boundaries', () => {
  expect(themeCss).toContain('--control-stroke: 1.4px')
  expect(themeCss).toContain('.dialogue-box')
  expect(themeCss).toContain('border-width: 0 0 1.5px')
  expect(themeCss).toContain('.retro-button')
  expect(themeCss).toContain('border: var(--control-stroke) solid')
  expect(themeCss).not.toContain('--paper-shadow-small')
})
```

- [ ] **Step 2: Verify RED**

Run:

```bash
pnpm exec vitest run src/styles/sketch-theme.test.ts
```

Expected: FAIL because the current theme uses filled cards, all-around panel frames, and paper shadows.

- [ ] **Step 3: Define open panels and handwritten labels**

Add `--control-stroke: 1.4px` to `:root` and use:

```css
:is(
  .ui-panel,
  .dialogue-box,
  .choice-menu,
  .playlist-input-panel,
  .playlist-extraction-review,
  .playlist-extraction-status,
  .playlist-extraction-error,
  .taste-analysis-status,
  .taste-analysis-error
) {
  color: var(--sketch-ink);
  background: transparent;
  border: 0;
  border-bottom: 1.5px solid var(--sketch-ink);
  border-radius: 0;
  box-shadow: none;
}

:is(
  .brand-lockup__name,
  .screen-eyebrow,
  .dialogue-box__speaker,
  .dialogue-box__copy,
  .panel-heading,
  .playlist-extraction-review__heading,
  .playlist-extraction-status__heading,
  .taste-analysis-status__heading,
  .taste-analysis-error__heading
) {
  color: var(--sketch-ink);
  font-family: var(--font-note);
  text-shadow: none;
}
```

- [ ] **Step 4: Draw thin capsule actions and bounded inputs**

Use:

```css
.retro-button,
.platform-listen__button,
.final-mixtape__platform-button {
  color: var(--sketch-ink);
  background: transparent;
  border: var(--control-stroke) solid var(--sketch-ink);
  border-radius: 999px 940px 980px 920px / 820px 980px 860px 940px;
  box-shadow: none;
  font-family: var(--font-note);
  font-weight: 700;
  letter-spacing: 0;
  text-transform: none;
  transform: rotate(-0.16deg);
}

.retro-button:hover:not(:disabled),
.platform-listen__button:hover {
  color: var(--sketch-ink);
  background: linear-gradient(
    transparent 64%,
    rgba(216, 185, 79, 0.4) 64% 88%,
    transparent 88%
  );
  transform: translate(-1px, 1px) rotate(0.25deg);
}

.retro-button:active:not(:disabled),
.platform-listen__button:active {
  transform: translateY(1px) rotate(-0.1deg);
}

:is(
  .playlist-input-panel textarea,
  .playlist-extraction-review input,
  .playlist-extraction-review textarea
) {
  color: var(--sketch-ink);
  background: rgba(255, 255, 255, 0.08);
  border: var(--control-stroke) solid var(--sketch-ink);
  border-radius: 8px 4px 7px 5px / 5px 8px 4px 7px;
  box-shadow: none;
}
```

- [ ] **Step 5: Remove all collage pseudo-elements**

Use:

```css
.playlist-input-panel::before,
.playlist-extraction-review::before,
.playlist-extraction-status::before,
.taste-analysis-status::before,
.dialogue-box::before,
.polaroid-composer__preview::before,
.final-mixtape__polaroid::before,
.mixtape-overlay__card::before,
.final-mixtape__card::before {
  content: none;
}
```

- [ ] **Step 6: Verify focused workflow tests**

Run:

```bash
pnpm exec vitest run \
  src/styles/sketch-theme.test.ts \
  src/components/DialogueBox.test.tsx \
  src/components/ChoiceMenu.test.tsx \
  src/components/PlaylistInputPanel.test.tsx \
  src/components/PlaylistExtractionReview.test.tsx \
  src/components/TasteAnalysisErrorPanel.test.tsx
```

Expected: all selected tests PASS.

---

### Task 4: Unify LP, camera, and final tape as work-note tools

**Files:**
- Modify: `src/styles/sketch-theme.css`
- Test: `src/styles/sketch-theme.test.ts`

**Interfaces:**
- Consumes: existing vinyl, camera, photo, polaroid, final tape, and platform classes.
- Produces: late-flow surfaces that remain visually part of the same page.

- [ ] **Step 1: Add failing late-flow assertions**

Add:

```ts
it('keeps late-flow tools on the same sketchbook page', () => {
  expect(themeCss).toContain('.vinyl-interaction__record')
  expect(themeCss).toContain('#25231f')
  expect(themeCss).toContain('.camera-capture__panel')
  expect(themeCss).toContain('.final-mixtape__card')
  expect(themeCss).not.toContain('box-shadow: 8px 10px')
})
```

- [ ] **Step 2: Verify RED**

Run:

```bash
pnpm exec vitest run src/styles/sketch-theme.test.ts
```

Expected: FAIL because late-flow cards still float above the page.

- [ ] **Step 3: Keep LP as the only dense black surface**

Use:

```css
.vinyl-interaction {
  color: var(--sketch-ink);
  background: transparent;
}

.vinyl-interaction__record {
  color: var(--sketch-paper);
  background:
    repeating-radial-gradient(
      circle,
      transparent 0 7px,
      rgba(255, 255, 255, 0.08) 7px 8px
    ),
    #25231f;
  border: 2px solid var(--sketch-ink);
  box-shadow: 2px 3px 0 rgba(35, 34, 31, 0.14);
}

.vinyl-energy {
  color: var(--sketch-ink);
  background: transparent;
  border: 0;
  box-shadow: none;
  font-family: var(--font-note);
}
```

- [ ] **Step 4: Keep functional dialogs bounded but flat**

Use:

```css
:is(
  .camera-capture__panel,
  .photo-review__panel,
  .polaroid-composer__loading,
  .polaroid-composer__error
) {
  color: var(--sketch-ink);
  background: var(--sketch-paper);
  border: var(--control-stroke) solid var(--sketch-ink);
  border-radius: 11px 6px 13px 7px / 7px 12px 6px 11px;
  box-shadow: none;
}

:is(.mixtape-overlay__card, .final-mixtape__card) {
  color: var(--sketch-ink);
  background: var(--sketch-paper);
  border: 0;
  border-top: 2px solid var(--sketch-ink);
  border-bottom: 2px solid var(--sketch-ink);
  border-radius: 0;
  box-shadow: none;
}

.final-mixtape__track {
  color: var(--sketch-ink);
  background: transparent;
  border-bottom: 1.2px solid var(--sketch-faint);
}
```

- [ ] **Step 5: Verify late-flow tests**

Run:

```bash
pnpm exec vitest run \
  src/styles/sketch-theme.test.ts \
  src/components/VinylInteraction.test.tsx \
  src/components/CameraCapture.test.tsx \
  src/components/PhotoReview.test.tsx \
  src/components/PolaroidComposer.test.tsx \
  src/components/FinalMixtape.test.tsx \
  src/components/PlatformListenButtons.test.tsx
```

Expected: all selected tests PASS.

---

### Task 5: Responsive, reduced-motion, and full regression verification

**Files:**
- Modify: `src/styles/sketch-theme.css`
- Test: `src/styles/sketch-theme.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: final desktop/mobile theme and complete verification evidence.

- [ ] **Step 1: Complete mobile and reduced-motion overrides**

Use:

```css
@media (max-width: 760px) {
  .app-shell {
    background: var(--sketch-paper);
  }

  .room-stage {
    min-height: clamp(39rem, 138vw, 49rem);
  }

  .room-stage::after {
    inset: 4rem 0.25rem 1rem;
    opacity: 0.34;
    background-size: cover;
  }
}

@media (prefers-reduced-motion: reduce) {
  .retro-button,
  .tape-trigger,
  .room-character,
  .dochi-character,
  .vinyl-interaction__speed-lines {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
  }

  .retro-button:hover:not(:disabled),
  .retro-button:active:not(:disabled),
  .platform-listen__button:hover,
  .platform-listen__button:active {
    transform: none;
  }
}
```

- [ ] **Step 2: Run complete automated verification**

Run once:

```bash
pnpm test
pnpm exec tsc -b
pnpm build
```

Expected: all Vitest suites PASS, TypeScript exits 0, and Vite produces `dist/`.

- [ ] **Step 3: Run visual checks**

Start:

```bash
pnpm dev --host 127.0.0.1
```

Verify at 1440×900 and 390×844:

1. Idle/dialogue: warm-white unruled page, no tape/sticker treatment, natural-color Dochi/controller.
2. Scene: one coherent black-ink workshop SVG, no UI-card rectangles, no control overlap.
3. Upload/OCR: inputs retain clear boundaries; surrounding groups remain open.
4. Analysis/errors: message meaning and retry actions remain visible.
5. LP: drag, inertia, energy, needle, and REC still work.
6. Camera/review: controls are reachable and modal boundary remains clear.
7. Final tape: verified tracks and platform actions remain visible.

- [ ] **Step 4: Check implementation scope**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors and no React logic or API files modified.

- [ ] **Step 5: Commit the implementation**

```bash
git add \
  package.json \
  pnpm-lock.yaml \
  src/index.css \
  src/assets/sketch/workshop-doodles.svg \
  src/styles/sketch-theme.css \
  src/styles/sketch-theme.test.ts
git commit -m "style: redraw DJ DOCHI as a music sketchbook"
```
