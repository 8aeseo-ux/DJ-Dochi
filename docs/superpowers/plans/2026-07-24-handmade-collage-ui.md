# DJ DOCHI Handmade Collage UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace DJ DOCHI's dark polished interface with a cohesive handmade paper-collage theme without changing the existing UX flow, React component structure, or feature behavior.

**Architecture:** Keep `dj-dochi.css` as the structural and responsive foundation. Add one `sketch-theme.css` visual override layer imported last, then verify its contract with a filesystem-based Vitest test and validate representative workflow states in the local browser.

**Tech Stack:** React 19, TypeScript, Vite 8, Vitest, CSS custom properties, CSS pseudo-elements, existing WebP character assets.

## Global Constraints

- Do not change the existing UX flow or state transitions.
- Do not replace, merge, or reorganize existing React components.
- Do not change upload, OCR, taste analysis, vinyl physics, camera, catalog, or platform-link behavior.
- Keep the existing Dochi and DJ controller image assets recognizable.
- Apply the redesign through `src/styles/sketch-theme.css`, imported after `src/styles/dj-dochi.css`.
- Add no remote font, runtime dependency, or external image request.
- Preserve focus visibility, contrast, responsive behavior, and `prefers-reduced-motion`.
- Use CSS for decorative paper, tape, borders, shadows, and doodles; no JSX decoration is required.

---

### Task 1: Establish the isolated sketch theme contract

**Files:**
- Create: `src/styles/sketch-theme.test.ts`
- Create: `src/styles/sketch-theme.css`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: existing class names emitted by all components and the token aliases from `src/styles/tokens.css`.
- Produces: a last-loaded visual theme layer that leaves component props, markup, state, and event handlers unchanged.

- [ ] **Step 1: Write the failing theme contract test**

```ts
// @vitest-environment node

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const indexCss = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
const themeCss = readFileSync(new URL('./sketch-theme.css', import.meta.url), 'utf8')

describe('handmade collage theme', () => {
  it('loads after the structural DJ DOCHI stylesheet', () => {
    expect(indexCss.indexOf("./styles/sketch-theme.css"))
      .toBeGreaterThan(indexCss.indexOf("./styles/dj-dochi.css"))
  })

  it('defines the shared paper design primitives', () => {
    for (const selector of [
      ':root',
      '.app-shell',
      '.ui-panel',
      '.retro-button',
      '.speech-bubble',
      '.dochi-character',
      '.room-controller',
      '.vinyl-interaction',
      '.mixtape-overlay',
    ]) {
      expect(themeCss).toContain(selector)
    }
    expect(themeCss).toContain('--paper')
    expect(themeCss).toContain('--graphite')
    expect(themeCss).toContain('prefers-reduced-motion')
  })
})
```

- [ ] **Step 2: Run the contract test and verify RED**

Run:

```bash
rtk /Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run src/styles/sketch-theme.test.ts
```

Expected: FAIL because `src/styles/sketch-theme.css` does not exist.

- [ ] **Step 3: Import the theme last and add the base paper system**

Append this import to `src/index.css`:

```css
@import './styles/sketch-theme.css';
```

Create `src/styles/sketch-theme.css` with the shared foundation:

```css
:root {
  --paper: #f4f0e6;
  --paper-warm: #ebe2cf;
  --paper-white: #fffdf7;
  --graphite: #1d1c1a;
  --pencil: #66625b;
  --pencil-light: #aaa396;
  --washed-red: #e7897d;
  --washed-red-deep: #b9564c;
  --washed-green: #9bc9aa;
  --washed-blue: #9ebfd3;
  --washed-yellow: #e6c96f;
  --sketch-line: rgba(29, 28, 26, 0.78);
  --sketch-line-soft: rgba(29, 28, 26, 0.28);
  --paper-shadow: 4px 5px 0 rgba(29, 28, 26, 0.16);
  --font-hand: "Chalkboard SE", "Bradley Hand", "Marker Felt", "Comic Sans MS", cursive;

  --ink: var(--paper);
  --ink-soft: var(--paper-warm);
  --panel: var(--paper-white);
  --panel-raised: #f8f1df;
  --panel-light: #eee4d1;
  --panel-quiet: rgba(255, 253, 247, 0.88);
  --cream: var(--graphite);
  --muted: var(--pencil);
  --dim: #7f796f;
  --coral: var(--washed-red);
  --coral-deep: var(--washed-red-deep);
  --amber: var(--washed-yellow);
  --violet: var(--washed-blue);
  --mint: var(--washed-green);
  --line: var(--sketch-line-soft);
  --line-bright: var(--sketch-line);
}

html,
body {
  color: var(--graphite);
  background: var(--paper);
}

.app-shell {
  color: var(--graphite);
  background:
    repeating-linear-gradient(0deg, transparent 0 31px, rgba(83, 117, 137, 0.07) 31px 32px),
    radial-gradient(circle at 18% 16%, rgba(231, 137, 125, 0.12), transparent 22rem),
    var(--paper);
}

.app-shell::before {
  opacity: 0.32;
  background-image:
    radial-gradient(rgba(29, 28, 26, 0.16) 0.55px, transparent 0.7px),
    radial-gradient(rgba(29, 28, 26, 0.08) 0.5px, transparent 0.7px);
  background-position: 0 0, 6px 8px;
  background-size: 11px 13px, 17px 19px;
  mask-image: none;
}

.ui-panel {
  color: var(--graphite);
  background: var(--paper-white);
  border: 2px solid var(--sketch-line);
  border-radius: 17px 8px 14px 10px / 9px 15px 8px 16px;
  box-shadow: var(--paper-shadow);
}

button:focus-visible,
textarea:focus-visible,
input:focus-visible,
a:focus-visible {
  outline: 3px solid var(--washed-blue);
  outline-offset: 4px;
}
```

- [ ] **Step 4: Run the contract test and verify GREEN**

Run the Task 1 test command again.

Expected: 1 file and 2 tests pass.

- [ ] **Step 5: Commit Task 1**

```bash
rtk git add src/index.css src/styles/sketch-theme.css src/styles/sketch-theme.test.ts
rtk git commit -m "feat: establish handmade collage theme"
```

---

### Task 2: Restyle the room, shared controls, dialogue, and input workflow

**Files:**
- Modify: `src/styles/sketch-theme.css`
- Test: `src/styles/sketch-theme.test.ts`

**Interfaces:**
- Consumes: `.stage-frame`, `.topbar`, `.room-stage`, `.room-character`, `.room-controller-layer`, `.retro-button`, `.dialogue-box`, `.choice-menu`, `.playlist-input-panel`, `.playlist-extraction-*`, and shared input selectors already rendered by existing components.
- Produces: the scrapbook room, sticker character treatment, paper controls, and unified upload/OCR/review surfaces.

- [ ] **Step 1: Extend the failing contract test for workflow surfaces**

Add this test:

```ts
it('covers the fixed room and playlist workflow surfaces', () => {
  for (const selector of [
    '.stage-frame',
    '.topbar',
    '.room-stage',
    '.room-character',
    '.room-controller-layer',
    '.dialogue-box',
    '.choice-menu',
    '.playlist-input-panel',
    '.playlist-extraction-review',
    '.playlist-extraction-status',
    '.taste-analysis-status',
  ]) {
    expect(themeCss).toContain(selector)
  }
})
```

- [ ] **Step 2: Run the contract test and verify RED**

Run the Task 1 test command.

Expected: FAIL listing selectors not yet present in `sketch-theme.css`.

- [ ] **Step 3: Implement room and shared-control overrides**

Add sections to `sketch-theme.css` using these exact shared rules as the base:

```css
.ambient {
  filter: none;
  opacity: 0.14;
  border-radius: 38% 62% 47% 53%;
}

.stage-frame {
  padding-top: 1rem;
}

.topbar {
  margin: 0.35rem 0 0.8rem;
  padding: 0.65rem 0.8rem 0.8rem;
  border: 0;
  border-bottom: 2px solid var(--graphite);
  transform: rotate(-0.15deg);
}

.brand-lockup__name,
.screen-eyebrow,
.dialogue-box__speaker {
  color: var(--graphite);
  font-family: var(--font-hand);
  font-weight: 700;
  letter-spacing: 0.08em;
}

.topbar__status,
.screen-eyebrow {
  padding: 0.28rem 0.55rem;
  color: var(--graphite);
  background: var(--washed-green);
  border: 1.5px solid var(--graphite);
  border-radius: 44% 56% 47% 53%;
  transform: rotate(1.2deg);
}

.status-dot {
  background: var(--graphite);
  box-shadow: none;
}

.room-stage {
  background:
    linear-gradient(rgba(29, 28, 26, 0.055) 1px, transparent 1px),
    linear-gradient(90deg, rgba(29, 28, 26, 0.04) 1px, transparent 1px),
    rgba(255, 253, 247, 0.55);
  background-size: 38px 38px;
  border: 2px solid var(--graphite);
  border-radius: 19px 9px 16px 11px / 11px 18px 9px 17px;
  box-shadow: 6px 7px 0 rgba(29, 28, 26, 0.12);
}

.room-stage::before {
  position: absolute;
  top: -0.7rem;
  left: 12%;
  width: 6.5rem;
  height: 1.45rem;
  content: "";
  background: rgba(230, 201, 111, 0.68);
  border: 1px solid rgba(29, 28, 26, 0.16);
  transform: rotate(-3deg);
}

.room-character {
  filter:
    drop-shadow(2px 0 0 var(--paper-white))
    drop-shadow(-2px 0 0 var(--paper-white))
    drop-shadow(0 2px 0 var(--paper-white))
    drop-shadow(0 -2px 0 var(--paper-white))
    drop-shadow(5px 6px 0 rgba(29, 28, 26, 0.2));
}

.room-controller-layer {
  filter:
    saturate(0.72)
    contrast(0.96)
    drop-shadow(3px 0 0 var(--paper-white))
    drop-shadow(-3px 0 0 var(--paper-white))
    drop-shadow(5px 7px 0 rgba(29, 28, 26, 0.2));
}

.retro-button {
  color: var(--graphite);
  border: 2px solid var(--graphite);
  border-radius: 18px 12px 17px 10px / 11px 18px 10px 16px;
  box-shadow: 3px 4px 0 var(--graphite);
  font-family: var(--font-hand);
  text-transform: none;
}

.retro-button--primary { background: var(--washed-red); }
.retro-button--secondary { background: var(--washed-yellow); }
.retro-button--ghost { color: var(--graphite); background: var(--paper-white); }

.retro-button:hover:not(:disabled) {
  color: var(--graphite);
  background-image: linear-gradient(rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.18));
  transform: translate(-1px, -2px) rotate(-0.4deg);
}

.retro-button:active:not(:disabled) {
  box-shadow: 1px 1px 0 var(--graphite);
  transform: translate(2px, 3px) rotate(0.6deg);
  animation: sketch-stamp 150ms steps(2, end);
}

.dialogue-box,
.choice-menu,
.playlist-input-panel,
.playlist-extraction-review,
.playlist-extraction-status,
.taste-analysis-status,
.playlist-extraction-error,
.taste-analysis-error {
  color: var(--graphite);
  background: var(--paper-white);
  border: 2px solid var(--graphite);
  border-radius: 18px 8px 15px 11px / 9px 17px 8px 16px;
  box-shadow: var(--paper-shadow);
}

textarea,
input {
  color: var(--graphite);
  caret-color: var(--washed-red-deep);
  background:
    repeating-linear-gradient(transparent 0 30px, rgba(83, 117, 137, 0.15) 30px 31px),
    var(--paper-white);
  border: 0;
  border-bottom: 2px solid var(--graphite);
  border-radius: 5px 10px 4px 8px;
}

@keyframes sketch-stamp {
  0% { transform: translate(2px, 3px) rotate(0.6deg); }
  50% { transform: translate(0, 1px) rotate(-0.8deg); }
  100% { transform: translate(2px, 3px) rotate(0.2deg); }
}

.room-workbench,
.room-console,
.room-speaker {
  color: var(--graphite);
  background: rgba(235, 226, 207, 0.9);
  border: 2px solid var(--graphite);
  box-shadow: 3px 4px 0 rgba(29, 28, 26, 0.16);
}

.room-speaker i {
  background: var(--paper);
  border: 2px solid var(--graphite);
  box-shadow: inset 0 0 0 2px var(--pencil-light);
}

.equalizer__bar,
.workshop-effects__equalizer i,
.playlist-extraction-status__scan i {
  background: var(--washed-red);
  border: 1px solid var(--graphite);
  box-shadow: none;
}

.room-image-preview,
.file-dropzone {
  color: var(--graphite);
  background: var(--paper-warm);
  border: 2px dashed var(--graphite);
  border-radius: 15px 8px 13px 10px;
}

.room-image-preview img {
  background: var(--paper-white);
  border: 0.4rem solid var(--paper-white);
  outline: 1.5px solid var(--graphite);
}

.file-dropzone__icon,
.panel-intro__number,
.extraction-track-row__index {
  color: var(--graphite);
  background: var(--washed-yellow);
  border: 1.5px solid var(--graphite);
  border-radius: 48% 52% 44% 56%;
}

.extraction-track-list {
  background:
    repeating-linear-gradient(transparent 0 44px, rgba(83, 117, 137, 0.13) 44px 45px),
    var(--paper-white);
  border: 1.5px solid var(--graphite);
}

.extraction-track-row {
  border-bottom: 1.5px dashed var(--pencil-light);
}

.extraction-track-row__delete,
.icon-button {
  color: var(--graphite);
  background: var(--paper-white);
  border: 1.5px solid var(--graphite);
  border-radius: 52% 48% 43% 57%;
  box-shadow: 2px 2px 0 rgba(29, 28, 26, 0.18);
}

.extraction-warnings,
.playlist-input-panel__error,
.playlist-extraction-error__vision-note {
  color: var(--graphite);
  background: rgba(231, 137, 125, 0.22);
  border-left: 4px solid var(--washed-red-deep);
}

.playlist-input-panel__privacy,
.playlist-extraction-review__vision-note,
.textarea-meta {
  color: var(--pencil);
  font-family: var(--font-hand);
}
```

- [ ] **Step 4: Run the contract test and existing component tests**

Run:

```bash
rtk /Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run src/styles/sketch-theme.test.ts src/components/DialogueBox.test.tsx src/components/ChoiceMenu.test.tsx src/components/PlaylistInputPanel.test.tsx src/components/PlaylistExtractionReview.test.tsx
```

Expected: all selected tests pass.

- [ ] **Step 5: Commit Task 2**

```bash
rtk git add src/styles/sketch-theme.css src/styles/sketch-theme.test.ts
rtk git commit -m "feat: restyle Dochi room and playlist workflow"
```

---

### Task 3: Restyle vinyl, camera, polaroid, and final mixtape states

**Files:**
- Modify: `src/styles/sketch-theme.css`
- Test: `src/styles/sketch-theme.test.ts`

**Interfaces:**
- Consumes: existing state classes for vinyl physics, workshop effects, camera capture, photo review, polaroid composition, final cassette, overlay, and music-platform controls.
- Produces: a single paper-collage visual language across all post-analysis states without altering drag, camera, canvas, close, or deep-link behavior.

- [ ] **Step 1: Add the failing post-analysis coverage test**

```ts
it('covers vinyl, photo, and final mixtape surfaces', () => {
  for (const selector of [
    '.vinyl-interaction',
    '.vinyl-interaction__record',
    '.vinyl-energy',
    '.camera-capture',
    '.photo-review',
    '.polaroid-composer',
    '.final-mixtape',
    '.mixtape-overlay',
    '.mixtape-card',
    '.platform-listen__button',
  ]) {
    expect(themeCss).toContain(selector)
  }
})
```

- [ ] **Step 2: Run the contract test and verify RED**

Run the Task 1 test command.

Expected: FAIL for post-analysis selectors missing from the theme.

- [ ] **Step 3: Implement the post-analysis collage treatment**

Add these foundations and selector-specific companions:

```css
.vinyl-interaction,
.camera-capture__panel,
.photo-review__panel,
.polaroid-composer,
.mixtape-overlay__card {
  color: var(--graphite);
  background: var(--paper-white);
  border: 2px solid var(--graphite);
  border-radius: 21px 9px 17px 13px / 12px 19px 10px 16px;
  box-shadow: 5px 6px 0 rgba(29, 28, 26, 0.18);
}

.vinyl-interaction__record {
  background:
    radial-gradient(circle, var(--washed-red) 0 12%, var(--paper-warm) 12% 17%, transparent 17%),
    repeating-radial-gradient(circle, var(--graphite) 0 2px, #393733 3px 5px);
  border: 3px solid var(--graphite);
  box-shadow: 3px 5px 0 rgba(29, 28, 26, 0.2);
}

.vinyl-energy {
  background: var(--paper-warm);
  border: 2px solid var(--graphite);
  border-radius: 50% 45% 48% 52%;
}

.vinyl-energy__track i {
  background: repeating-linear-gradient(
    -45deg,
    var(--washed-red) 0 8px,
    var(--washed-yellow) 8px 15px
  );
}

.camera-capture video,
.photo-review img,
.polaroid-composer__preview {
  border: 0.55rem solid var(--paper-white);
  outline: 2px solid var(--graphite);
  box-shadow: 5px 7px 0 rgba(29, 28, 26, 0.2);
  transform: rotate(-1deg);
}

.mixtape-overlay {
  background: rgba(80, 75, 68, 0.34);
  backdrop-filter: blur(2px);
}

.mixtape-card {
  color: var(--graphite);
  background:
    linear-gradient(165deg, rgba(231, 137, 125, 0.14), transparent 42%),
    var(--paper-white);
  border: 2px solid var(--graphite);
  border-radius: 16px 7px 14px 10px / 9px 15px 8px 13px;
  box-shadow: 6px 7px 0 rgba(29, 28, 26, 0.2);
}

.track-row {
  border-top: 1.5px dashed var(--pencil);
}

.track-row__index,
.mixtape-card__sticker,
.platform-listen__mark {
  color: var(--graphite);
  border: 1.5px solid var(--graphite);
  box-shadow: 2px 2px 0 rgba(29, 28, 26, 0.18);
}

.platform-listen__button,
.platform-listen__track-list,
.platform-listen__track-link {
  color: var(--graphite);
  background: var(--paper-white);
  border: 1.5px solid var(--graphite);
  border-radius: 12px 7px 11px 8px;
}

.vinyl-needle__arm,
.vinyl-needle__head {
  background: var(--graphite);
  border-color: var(--graphite);
  box-shadow: none;
}

.vinyl-interaction__speed-lines i {
  background: var(--graphite);
  border-radius: 50%;
  opacity: calc(0.18 + var(--mix-intensity) * 0.62);
}

.vinyl-interaction__recording-label {
  color: var(--graphite);
  background: var(--washed-red);
  border: 2px solid var(--graphite);
  border-radius: 48% 52% 45% 55%;
  box-shadow: 2px 2px 0 rgba(29, 28, 26, 0.18);
}

.camera-capture__intro,
.camera-capture__fallback,
.photo-review__caption {
  color: var(--graphite);
  background: var(--paper-warm);
  border: 1.5px dashed var(--graphite);
}

.camera-capture__flash {
  background: var(--paper-white);
}

.final-mixtape__polaroid {
  background: var(--paper-white);
  border: 2px solid var(--graphite);
  box-shadow: 4px 5px 0 rgba(29, 28, 26, 0.18);
  transform: rotate(3deg);
}

.final-mixtape__polaroid::before {
  position: absolute;
  top: -0.8rem;
  left: 30%;
  width: 42%;
  height: 1.3rem;
  content: "";
  background: rgba(158, 191, 211, 0.72);
  border: 1px solid rgba(29, 28, 26, 0.14);
  transform: rotate(-4deg);
}

.mixtape-card__title h2,
.mixtape-card__taste,
.final-mixtape__signature {
  color: var(--graphite);
  font-family: var(--font-hand);
}

.mixtape-card__taste {
  background: rgba(230, 201, 111, 0.16);
  border: 1.5px dashed var(--graphite);
}

.tape-trigger {
  background: var(--paper-warm);
  border: 2px solid var(--graphite);
  box-shadow: 4px 5px 0 rgba(29, 28, 26, 0.18);
}

.tape-trigger__reel {
  background: var(--paper-white);
  border: 2px solid var(--graphite);
  box-shadow: none;
}

.mixtape-overlay .icon-button {
  color: var(--graphite);
  background: var(--washed-red);
}
```

- [ ] **Step 4: Run focused interaction tests**

Run:

```bash
rtk /Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run src/styles/sketch-theme.test.ts src/components/VinylInteraction.test.tsx src/components/CameraCapture.test.tsx src/components/PhotoReview.test.tsx src/components/PolaroidComposer.test.tsx src/components/FinalMixtape.test.tsx src/components/MixtapeOverlay.test.tsx src/components/PlatformListenButtons.test.tsx
```

Expected: all selected tests pass.

- [ ] **Step 5: Commit Task 3**

```bash
rtk git add src/styles/sketch-theme.css src/styles/sketch-theme.test.ts
rtk git commit -m "feat: finish scrapbook interaction states"
```

---

### Task 4: Complete responsive, reduced-motion, and browser verification

**Files:**
- Modify: `src/styles/sketch-theme.css`
- Test: `src/styles/sketch-theme.test.ts`

**Interfaces:**
- Consumes: the complete theme from Tasks 1–3 and current responsive breakpoints.
- Produces: desktop/mobile-safe decorative density, reduced motion, and verified visual consistency.

- [ ] **Step 1: Add the failing responsive contract test**

```ts
it('contains mobile and reduced-motion safeguards', () => {
  expect(themeCss).toContain('@media (max-width: 760px)')
  expect(themeCss).toContain('@media (prefers-reduced-motion: reduce)')
  expect(themeCss).toContain('overflow-x: clip')
})
```

- [ ] **Step 2: Run the contract test and verify RED**

Run the Task 1 test command.

Expected: FAIL until the mobile safeguard is added.

- [ ] **Step 3: Add responsive and motion safeguards**

```css
.app-shell {
  overflow-x: clip;
}

@media (max-width: 760px) {
  .stage-frame {
    padding-inline: 0.75rem;
  }

  .room-stage,
  .ui-panel,
  .dialogue-box,
  .choice-menu,
  .playlist-input-panel,
  .mixtape-overlay__sheet {
    transform: none;
  }

  .room-stage::before {
    width: 4.4rem;
    left: 8%;
  }

  .brand-lockup__tag,
  .room-wall-mark,
  .room-grid-glow {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .retro-button,
  .ui-panel,
  .room-character,
  .room-controller-layer,
  .polaroid-card {
    animation: none !important;
    transition-duration: 1ms !important;
  }

  .retro-button:hover,
  .retro-button:active {
    transform: none !important;
  }
}
```

- [ ] **Step 4: Run automated verification once**

Run:

```bash
rtk /Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run
rtk /Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/typescript/bin/tsc -b --pretty false
rtk /Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vite/bin/vite.js build
```

Expected: all tests pass, TypeScript exits with code 0, and Vite creates the production bundle.

- [ ] **Step 5: Verify representative browser states**

Use the running local app in the in-app browser. Verify the idle room, dialogue, input panel, extraction review, vinyl interaction, camera/photo surfaces, and final mixtape at desktop width. Repeat idle/input/final surfaces at a mobile viewport. Confirm:

- paper background and graphite lines are dominant;
- Dochi and controller retain their original expressions and content;
- no dark neon panel remains dominant;
- buttons show press feedback without moving adjacent layout;
- overlays scroll and close normally;
- text remains legible and no horizontal overflow appears.

Capture one desktop and one mobile screenshot for final comparison.

- [ ] **Step 6: Commit Task 4**

```bash
rtk git add src/styles/sketch-theme.css src/styles/sketch-theme.test.ts
rtk git commit -m "fix: polish responsive handmade collage theme"
```
