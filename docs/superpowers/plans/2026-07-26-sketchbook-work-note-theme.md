# DJ DOCHI Sketchbook Work Note Theme Implementation Plan

> **Superseded:** The final visual references removed ruled notebook lines and repeated small doodles from the approved direction. Execute `docs/superpowers/plans/2026-07-26-sketchbook-work-note-theme-v2.md` instead.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing paper-collage theme with one continuous hand-drawn music work-note page while preserving every DJ DOCHI state, interaction, API flow, and responsive layout.

**Architecture:** Keep `src/styles/dj-dochi.css` as the structural layout and animation layer, then override only presentation through the last-loaded `src/styles/sketch-theme.css`. Bundle the Korean `Gaegu` handwriting font locally, use CSS pseudo-elements for non-interactive doodles, and avoid React changes unless a verified visual requirement cannot be expressed by existing class contracts.

**Tech Stack:** React 19, Vite 8, TypeScript 5.9, CSS, Vitest 4, `@fontsource/gaegu`, pnpm

## Global Constraints

- Preserve the existing OCR, LLM, catalog verification, LP physics, camera, and final mixtape flows.
- Preserve the existing React component structure and DOM class contracts.
- Keep `src/styles/sketch-theme.css` loaded after `src/styles/dj-dochi.css`.
- Use one continuous cream notebook page; do not use paper cutouts, masking tape, sticker outlines, or heavy floating-card shadows.
- Keep the existing natural-color Dochi and DJ controller assets, positions, sizes, and state transitions.
- Limit prominent doodles to 3–6 per visible screen and set decorative pseudo-elements to `pointer-events: none`.
- Use the bundled `Gaegu` font only for headings, Dochi dialogue, labels, and short notes; preserve the readable body font for long text, inputs, track data, and error copy.
- Preserve keyboard focus visibility and `prefers-reduced-motion` behavior.
- Verify desktop and mobile layouts without changing functional breakpoints.

---

## File Structure

- Modify `package.json`: add the locally bundled Korean handwriting font.
- Modify `pnpm-lock.yaml`: record the resolved font package.
- Modify `src/index.css`: load the font before the structural and theme styles.
- Rewrite `src/styles/sketch-theme.css`: provide notebook tokens and all visual overrides.
- Modify `src/styles/sketch-theme.test.ts`: define the source-level theme contract and prevent collage regressions.
- Do not modify React components unless browser verification proves an existing class cannot host a required non-interactive doodle.

---

### Task 1: Lock the notebook theme contract and bundle the handwriting font

**Files:**
- Modify: `src/styles/sketch-theme.test.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: the existing CSS import order in `src/index.css`.
- Produces: bundled `Gaegu` font faces and failing/passing source-level assertions used by all later theme tasks.

- [ ] **Step 1: Replace the collage-oriented test names and add failing notebook assertions**

Update `src/styles/sketch-theme.test.ts` so the suite begins with:

```ts
describe('sketchbook work note theme', () => {
  it('loads bundled handwriting fonts before the final theme layer', () => {
    expect(indexCss).toContain("@import '@fontsource/gaegu/400.css'")
    expect(indexCss).toContain("@import '@fontsource/gaegu/700.css'")
    expect(indexCss.indexOf("@fontsource/gaegu/700.css"))
      .toBeLessThan(indexCss.indexOf("./styles/dj-dochi.css"))
    expect(indexCss.indexOf("./styles/sketch-theme.css"))
      .toBeGreaterThan(indexCss.indexOf("./styles/dj-dochi.css"))
  })

  it('defines the continuous notebook design primitives', () => {
    for (const token of [
      '--notebook-paper',
      '--notebook-ink',
      '--notebook-pencil',
      '--notebook-line-blue',
      '--notebook-margin-red',
      '--font-note',
    ]) {
      expect(themeCss).toContain(token)
    }

    expect(themeCss).not.toContain('--paper-shadow')
    expect(themeCss).not.toContain('drop-shadow(3px 0 0 var(--paper-white))')
  })
})
```

Keep the existing workflow-surface selector coverage, rename it to notebook language, and add these assertions:

```ts
expect(themeCss).toContain('mix-blend-mode: multiply')
expect(themeCss).toContain('pointer-events: none')
expect(themeCss).toContain('@media (prefers-reduced-motion: reduce)')
```

- [ ] **Step 2: Run the focused test and verify the new contract fails**

Run:

```bash
pnpm exec vitest run src/styles/sketch-theme.test.ts
```

Expected: FAIL because the `Gaegu` imports and `--notebook-*` variables do not exist and the collage shadow token still exists.

- [ ] **Step 3: Install the font package**

Run:

```bash
pnpm add @fontsource/gaegu
```

Expected: `package.json` and `pnpm-lock.yaml` include `@fontsource/gaegu`.

- [ ] **Step 4: Load the font before the structural styles**

Change `src/index.css` to:

```css
@import '@fontsource/gaegu/400.css';
@import '@fontsource/gaegu/700.css';
@import 'tailwindcss';
@import './styles/tokens.css';
@import './styles/dj-dochi.css';
@import './styles/sketch-theme.css';
```

- [ ] **Step 5: Run the focused test and confirm only the not-yet-implemented theme assertions remain red**

Run:

```bash
pnpm exec vitest run src/styles/sketch-theme.test.ts
```

Expected: font import assertions PASS; notebook token and removed-collage assertions remain FAIL.

- [ ] **Step 6: Commit the font and contract setup**

```bash
git add package.json pnpm-lock.yaml src/index.css src/styles/sketch-theme.test.ts
git commit -m "test: define sketchbook theme contract"
```

---

### Task 2: Replace collage foundations with one continuous notebook room

**Files:**
- Modify: `src/styles/sketch-theme.css`
- Test: `src/styles/sketch-theme.test.ts`

**Interfaces:**
- Consumes: existing `.app-shell`, `.topbar`, `.room-stage`, `.room-character`, `.room-controller-layer`, and equipment class names.
- Produces: notebook color tokens, a continuous page background, direct-ink asset treatment, and shared hand-drawn frame primitives.

- [ ] **Step 1: Add failing assertions for room continuity and removed sticker treatments**

Add to `src/styles/sketch-theme.test.ts`:

```ts
it('treats the room and assets as one continuous notebook page', () => {
  expect(themeCss).toContain('.room-stage')
  expect(themeCss).toContain('var(--notebook-line-blue)')
  expect(themeCss).toContain('var(--notebook-margin-red)')
  expect(themeCss).toContain('.room-character::before')
  expect(themeCss).toContain('.room-controller-layer::after')
  expect(themeCss).toContain('content: none')
  expect(themeCss).not.toContain('var(--paper-shadow)')
  expect(themeCss).not.toContain('drop-shadow(5px 7px')
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm exec vitest run src/styles/sketch-theme.test.ts
```

Expected: FAIL because the collage theme still uses tape pseudo-elements and sticker shadows.

- [ ] **Step 3: Replace the theme tokens and page foundation**

Replace the `:root`, page, ambient, topbar, and room foundation sections in `src/styles/sketch-theme.css` with:

```css
:root {
  --notebook-paper: #fbf8ee;
  --notebook-paper-deep: #f3eddd;
  --notebook-ink: #292722;
  --notebook-pencil: #706b62;
  --notebook-faint: rgba(41, 39, 34, 0.18);
  --notebook-line-blue: rgba(89, 132, 153, 0.11);
  --notebook-margin-red: rgba(201, 84, 76, 0.2);
  --notebook-red: #df8177;
  --notebook-green: #a9c8ad;
  --notebook-blue: #aac4d2;
  --notebook-yellow: #e2c978;
  --font-note: "Gaegu", "Apple SD Gothic Neo", sans-serif;

  --ink: var(--notebook-paper);
  --ink-soft: var(--notebook-paper-deep);
  --panel: transparent;
  --panel-raised: transparent;
  --panel-light: rgba(255, 255, 255, 0.18);
  --panel-quiet: transparent;
  --cream: var(--notebook-ink);
  --muted: var(--notebook-pencil);
  --dim: #827c71;
  --coral: var(--notebook-red);
  --amber: var(--notebook-yellow);
  --violet: var(--notebook-blue);
  --mint: var(--notebook-green);
  --line: var(--notebook-faint);
  --line-bright: var(--notebook-ink);
}

.app-shell {
  overflow-x: clip;
  color: var(--notebook-ink);
  background:
    linear-gradient(
      90deg,
      transparent 0 7.4vw,
      var(--notebook-margin-red) 7.4vw calc(7.4vw + 2px),
      transparent calc(7.4vw + 2px)
    ),
    repeating-linear-gradient(
      0deg,
      transparent 0 31px,
      var(--notebook-line-blue) 31px 32px
    ),
    var(--notebook-paper);
}

.app-shell::before {
  opacity: 0.12;
  background-image: radial-gradient(rgba(41, 39, 34, 0.35) 0.5px, transparent 0.75px);
  background-size: 17px 19px;
  mask-image: none;
}

.ambient {
  opacity: 0.06;
  border: 2px solid var(--notebook-pencil);
  background: transparent;
  filter: none;
}

.topbar {
  color: var(--notebook-ink);
  background: transparent;
  border: 0;
  border-bottom: 2px solid var(--notebook-ink);
  box-shadow: none;
  transform: rotate(-0.12deg);
}

.room-stage {
  color: var(--notebook-ink);
  background: transparent;
  border: 1.8px solid var(--notebook-ink);
  border-radius: 11px 6px 13px 8px / 7px 12px 6px 11px;
  box-shadow: none;
}
```

- [ ] **Step 4: Remove sticker and tape treatments from room assets**

Add direct-image treatment and explicitly neutralize the old decorative pseudo-elements:

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
  filter: saturate(0.76) contrast(1.03);
}

.room-controller-layer {
  opacity: 0.94;
}

.room-workbench,
.room-console,
.room-speaker {
  color: var(--notebook-ink);
  background: rgba(251, 248, 238, 0.28);
  border: 1.8px solid var(--notebook-ink);
  box-shadow: none;
}
```

Use `.room-stage::before` as a single handwritten note rather than tape:

```css
.room-stage::before {
  content: "mix note #07  ♪";
  position: absolute;
  top: 4.8rem;
  left: 5.5rem;
  z-index: 1;
  width: auto;
  height: auto;
  color: var(--notebook-pencil);
  background: transparent;
  border: 0;
  font: 700 1rem/1 var(--font-note);
  transform: rotate(-4deg);
  pointer-events: none;
}
```

- [ ] **Step 5: Run the focused test**

Run:

```bash
pnpm exec vitest run src/styles/sketch-theme.test.ts
```

Expected: room continuity and removed sticker treatment assertions PASS.

- [ ] **Step 6: Commit the notebook room foundation**

```bash
git add src/styles/sketch-theme.css src/styles/sketch-theme.test.ts
git commit -m "style: turn the workshop into one notebook page"
```

---

### Task 3: Convert controls, dialogue, upload, and review surfaces to direct ink

**Files:**
- Modify: `src/styles/sketch-theme.css`
- Test: `src/styles/sketch-theme.test.ts`

**Interfaces:**
- Consumes: existing panel, button, dialogue, input, OCR review, analysis status, and error class names.
- Produces: one shared transparent hand-drawn frame language and checklist-style workflow surfaces.

- [ ] **Step 1: Add failing component-language assertions**

Add:

```ts
it('uses transparent ink frames for workflow controls', () => {
  for (const selector of [
    '.ui-panel',
    '.retro-button',
    '.dialogue-box',
    '.choice-menu',
    '.playlist-input-panel',
    '.playlist-extraction-review',
    '.playlist-extraction-status',
    '.taste-analysis-status',
  ]) {
    expect(themeCss).toContain(selector)
  }

  expect(themeCss).toContain('background: transparent')
  expect(themeCss).toContain('font-family: var(--font-note)')
  expect(themeCss).not.toContain('--paper-shadow-small')
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm exec vitest run src/styles/sketch-theme.test.ts
```

Expected: FAIL because the current controls use filled card backgrounds and paper shadows.

- [ ] **Step 3: Introduce the shared direct-ink panel and handwritten label rules**

Use:

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
  color: var(--notebook-ink);
  background: rgba(251, 248, 238, 0.18);
  border: 1.8px solid var(--notebook-ink);
  border-radius: 12px 7px 14px 8px / 8px 13px 7px 12px;
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
  color: var(--notebook-ink);
  font-family: var(--font-note);
  text-shadow: none;
}
```

- [ ] **Step 4: Replace filled web buttons with hand-circled note actions**

Use:

```css
.retro-button {
  color: var(--notebook-ink);
  background: transparent;
  border: 1.8px solid var(--notebook-ink);
  border-radius: 13px 7px 12px 8px / 8px 13px 7px 12px;
  box-shadow: none;
  font-family: var(--font-note);
  font-size: 1.05em;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: none;
  transform: rotate(-0.18deg);
  transition:
    transform 110ms steps(2, end),
    background-color 110ms ease;
}

.retro-button:hover:not(:disabled) {
  color: var(--notebook-ink);
  background: linear-gradient(
    transparent 62%,
    rgba(226, 201, 120, 0.5) 62% 88%,
    transparent 88%
  );
  transform: translate(-1px, 1px) rotate(0.3deg);
}

.retro-button:active:not(:disabled) {
  transform: translateY(1px) rotate(-0.12deg);
}
```

Keep primary/secondary distinctions as faint underline washes, not filled blocks.

```css
.retro-button--primary {
  background: linear-gradient(
    transparent 58%,
    rgba(223, 129, 119, 0.42) 58% 90%,
    transparent 90%
  );
}

.retro-button--secondary {
  background: linear-gradient(
    transparent 58%,
    rgba(226, 201, 120, 0.42) 58% 90%,
    transparent 90%
  );
}

.retro-button--ghost {
  background: transparent;
}
```

- [ ] **Step 5: Convert upload and OCR review surfaces into notebook fields and checklists**

Use transparent ruled fields:

```css
:is(
  .file-dropzone,
  .upload-card,
  .paste-area,
  .playlist-extraction-review__row,
  .playlist-extraction-review__empty
) {
  color: var(--notebook-ink);
  background:
    repeating-linear-gradient(
      0deg,
      transparent 0 28px,
      var(--notebook-line-blue) 28px 29px
    );
  border: 1.5px dashed var(--notebook-pencil);
  border-radius: 8px 4px 9px 5px / 5px 9px 4px 8px;
  box-shadow: none;
}

.playlist-extraction-review__row {
  border-width: 0 0 1.5px;
  border-style: solid;
  border-radius: 0;
}

.playlist-extraction-review__delete {
  color: var(--notebook-ink);
  background: transparent;
  border: 1.5px solid var(--notebook-ink);
  border-radius: 50%;
  box-shadow: none;
}
```

Remove all upload/review masking-tape `::before` backgrounds and use `content: none` where those pseudo-elements are only collage decoration.

```css
.playlist-input-panel::before,
.playlist-extraction-review::before,
.playlist-extraction-status::before,
.taste-analysis-status::before {
  content: none;
}
```

- [ ] **Step 6: Preserve status and error meaning with pencil annotations**

Use yellow underline for warnings, red double underline for errors, and retain all visible copy:

```css
.playlist-extraction-review__warning {
  color: var(--notebook-ink);
  background: linear-gradient(
    transparent 58%,
    rgba(226, 201, 120, 0.42) 58% 91%,
    transparent 91%
  );
  border: 0;
}

:is(.playlist-extraction-error, .taste-analysis-error) {
  border-color: var(--notebook-red);
  outline: 1px solid rgba(201, 84, 76, 0.35);
  outline-offset: 3px;
}
```

- [ ] **Step 7: Run workflow component tests and the theme test**

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

- [ ] **Step 8: Commit the direct-ink workflow surfaces**

```bash
git add src/styles/sketch-theme.css src/styles/sketch-theme.test.ts
git commit -m "style: redraw workflow controls as notebook ink"
```

---

### Task 4: Unify LP, camera, polaroid, and final mixtape surfaces

**Files:**
- Modify: `src/styles/sketch-theme.css`
- Test: `src/styles/sketch-theme.test.ts`

**Interfaces:**
- Consumes: existing vinyl, workshop effects, camera, photo review, polaroid, tape trigger, final mixtape, and platform button class names.
- Produces: a consistent notebook treatment for all late-flow states without changing their behavior.

- [ ] **Step 1: Add failing late-flow assertions**

Add:

```ts
it('covers late-flow notebook surfaces without collage tape decoration', () => {
  for (const selector of [
    '.vinyl-interaction',
    '.vinyl-energy',
    '.workshop-effects',
    '.camera-capture__panel',
    '.photo-review__panel',
    '.polaroid-composer',
    '.final-mixtape__card',
    '.platform-listen__button',
  ]) {
    expect(themeCss).toContain(selector)
  }

  expect(themeCss).toContain('.final-mixtape__polaroid::before')
  expect(themeCss).toContain('content: none')
  expect(themeCss).not.toContain('box-shadow: 8px 10px')
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm exec vitest run src/styles/sketch-theme.test.ts
```

Expected: FAIL because the current polaroid and final tape retain masking tape and layered-card shadows.

- [ ] **Step 3: Preserve the LP as the single dense black object and redraw its feedback**

Use:

```css
.vinyl-interaction {
  color: var(--notebook-ink);
  background: transparent;
}

.vinyl-interaction__record {
  color: var(--notebook-paper);
  background:
    repeating-radial-gradient(
      circle,
      transparent 0 7px,
      rgba(255, 255, 255, 0.08) 7px 8px
    ),
    #282622;
  border: 2px solid var(--notebook-ink);
  box-shadow: 3px 4px 0 rgba(41, 39, 34, 0.16);
}

.vinyl-interaction__speed-lines {
  opacity: calc(0.12 + (var(--speed-intensity, 0) * 0.7));
  background: repeating-conic-gradient(
    from 2deg,
    transparent 0deg 10deg,
    rgba(41, 39, 34, 0.5) 10deg 11deg,
    transparent 11deg 24deg
  );
  filter: none;
}

.vinyl-energy {
  color: var(--notebook-ink);
  background: transparent;
  border: 0;
  box-shadow: none;
  font-family: var(--font-note);
}
```

- [ ] **Step 4: Remove collage treatment from camera, photo, and result panels**

Use:

```css
:is(
  .camera-capture__panel,
  .photo-review__panel,
  .polaroid-composer__loading,
  .polaroid-composer__error,
  .mixtape-overlay__card,
  .final-mixtape__card
) {
  color: var(--notebook-ink);
  background: var(--notebook-paper);
  border: 1.8px solid var(--notebook-ink);
  border-radius: 12px 7px 14px 8px / 8px 13px 7px 12px;
  box-shadow: none;
}

.polaroid-composer__preview,
.final-mixtape__polaroid {
  background: var(--notebook-paper);
  border: 1.5px solid var(--notebook-ink);
  box-shadow: none;
}

.polaroid-composer__preview::before,
.final-mixtape__polaroid::before,
.mixtape-overlay__card::before,
.final-mixtape__card::before {
  content: none;
}
```

- [ ] **Step 5: Turn the final track list and platform actions into handwritten record entries**

Use:

```css
.final-mixtape__track {
  color: var(--notebook-ink);
  background: transparent;
  border-bottom: 1.4px solid var(--notebook-faint);
}

.final-mixtape__track-number,
.mixtape-overlay__track-number {
  color: var(--notebook-ink);
  background: transparent;
  border: 1.4px solid var(--notebook-ink);
  border-radius: 50%;
  box-shadow: none;
  font-family: var(--font-note);
}

.platform-listen__button,
.final-mixtape__platform-button {
  color: var(--notebook-ink);
  background: transparent;
  border: 1.5px solid var(--notebook-ink);
  border-radius: 12px 6px 11px 7px / 7px 12px 6px 11px;
  box-shadow: none;
  font-family: var(--font-note);
}
```

- [ ] **Step 6: Run late-flow tests and the theme test**

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

- [ ] **Step 7: Commit the late-flow notebook surfaces**

```bash
git add src/styles/sketch-theme.css src/styles/sketch-theme.test.ts
git commit -m "style: unify mixing and mixtape notebook surfaces"
```

---

### Task 5: Finish responsive, accessibility, and visual regression verification

**Files:**
- Modify: `src/styles/sketch-theme.css`
- Test: `src/styles/sketch-theme.test.ts`

**Interfaces:**
- Consumes: all notebook overrides from Tasks 1–4.
- Produces: stable desktop/mobile rendering, reduced-motion safeguards, and final regression evidence.

- [ ] **Step 1: Add final responsive and accessibility assertions**

Ensure `src/styles/sketch-theme.test.ts` contains:

```ts
it('contains mobile, focus, and reduced-motion safeguards', () => {
  expect(themeCss).toContain('@media (max-width: 760px)')
  expect(themeCss).toContain('@media (prefers-reduced-motion: reduce)')
  expect(themeCss).toContain(':focus-visible')
  expect(themeCss).toContain('outline-offset')
  expect(themeCss).toContain('overflow-x: clip')
})
```

- [ ] **Step 2: Run the focused test**

Run:

```bash
pnpm exec vitest run src/styles/sketch-theme.test.ts
```

Expected: PASS. If any assertion fails, add only the missing explicit safeguard.

- [ ] **Step 3: Complete mobile and reduced-motion overrides**

The final theme must include:

```css
@media (max-width: 760px) {
  .app-shell {
    background:
      linear-gradient(
        90deg,
        transparent 0 2rem,
        var(--notebook-margin-red) 2rem calc(2rem + 1px),
        transparent calc(2rem + 1px)
      ),
      repeating-linear-gradient(
        0deg,
        transparent 0 27px,
        var(--notebook-line-blue) 27px 28px
      ),
      var(--notebook-paper);
  }

  .room-stage {
    min-height: clamp(39rem, 138vw, 49rem);
    box-shadow: none;
  }

  .room-stage::before {
    top: 4.2rem;
    left: 2.7rem;
    font-size: 0.82rem;
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

- [ ] **Step 4: Run the complete automated verification once**

Run:

```bash
pnpm test
pnpm exec tsc -b
pnpm build
```

Expected: every Vitest suite passes, TypeScript exits with code 0, and Vite produces `dist/`.

- [ ] **Step 5: Start the local app for visual checks**

Run:

```bash
pnpm dev --host 127.0.0.1
```

Open the reported local URL and verify at 1440×900 and 390×844:

1. Idle and dialogue: Dochi remains aligned with the controller and no sticker outline or tape appears.
2. Upload and OCR review: fields read as writing areas and track rows as a checklist.
3. Analysis and errors: existing copy and retry actions remain visible.
4. LP interaction: dragging, inertia, energy feedback, needle, and REC sequence still work.
5. Camera and review: modal controls remain reachable and the photo stream cleanup behavior is unchanged.
6. Final mixtape: all verified tracks and platform actions remain visible and usable.
7. At every state, prominent doodles remain within the 3–6 element density target and do not overlap controls.

- [ ] **Step 6: Check the final diff for accidental logic changes**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; implementation changes are limited to package metadata, `src/index.css`, `src/styles/sketch-theme.css`, and `src/styles/sketch-theme.test.ts`.

- [ ] **Step 7: Commit final responsive adjustments**

```bash
git add package.json pnpm-lock.yaml src/index.css src/styles/sketch-theme.css src/styles/sketch-theme.test.ts
git commit -m "style: finish responsive sketchbook work note theme"
```
