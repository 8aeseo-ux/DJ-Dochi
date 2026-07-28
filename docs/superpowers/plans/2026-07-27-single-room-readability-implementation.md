# DJ DOCHI Single-Room Readability Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore DJ DOCHI’s original single-room presentation while making the dialogue surface opaque and every functional UI text element use Pretendard.

**Architecture:** Remove only the layout wrappers and CSS overrides introduced for the split character/UI composition. Keep the current React state machine and child component contracts intact, then restore the earlier single-scene theme rules with a strict `--font-ui` versus `--font-note` role split.

**Tech Stack:** React 19, Vite 8, TypeScript 5.9, Vitest 4, Testing Library, CSS, Pretendard, Gaegu

## Global Constraints

- Keep OCR, taste analysis, LP interaction, camera capture, and FinalMixtape state flow unchanged.
- Do not add routes, screens, API changes, assets, or product features.
- Remove the desktop two-column and mobile stacked interface layouts.
- Keep one fixed DJ workshop scene at 1440px, 1024px, 768px, and 390px.
- Make only the dialogue box explicitly opaque in this restoration.
- Use Pretendard for all functional UI text.
- Use Gaegu only for decorative doodles, short background notes, decorative labels, and the DOCHI signature.
- Preserve the existing Pretendard dependency and import.
- Do not stage or commit the user-owned `pnpm-workspace.yaml`.

---

## File Map

- `src/components/DochiRoom.tsx`: Owns the single persistent workshop composition and state-driven component visibility.
- `src/App.test.tsx`: Guards the end-to-end fixed-room flow and DOM layer contract.
- `src/styles/sketch-theme.css`: Provides the final sketchbook theme, single-scene responsive rules, dialogue opacity, and typography roles.
- `src/styles/sketch-theme.test.ts`: Guards CSS tokens, single-scene layout, opaque dialogue, typography roles, responsive breakpoint, and accessibility rules.

---

### Task 1: Restore the Single-Room DOM Contract

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/components/DochiRoom.tsx`

**Interfaces:**
- Consumes: `DjDochiFlow`, its existing `state`, `dialogue`, `inputMode`, extraction state, mixing state, photo state, result state, and `actions`.
- Produces: One `.room-stage` containing scene objects and all state-driven UI without `.room-visual`, `.room-interface`, or `.room-stage--with-interface`.

- [ ] **Step 1: Replace the split-layer regression test with a failing single-room test**

Remove `within` from the Testing Library import because the split interface container will no longer exist.

Replace the test named `keeps scene objects and readable UI in separate room layers` with:

```tsx
it('keeps scene objects and dialogue in one persistent room stage', async () => {
  const user = userEvent.setup()
  const { container } = render(<App />)

  const stage = container.querySelector('.room-stage')

  expect(stage).toBeInTheDocument()
  expect(container.querySelector('.room-visual')).not.toBeInTheDocument()
  expect(container.querySelector('.room-interface')).not.toBeInTheDocument()
  expect(stage).not.toHaveClass('room-stage--with-interface')
  expect(stage?.querySelector('.room-character')).toBeInTheDocument()
  expect(stage?.querySelector('.room-controller-layer')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'DJ 도치 idle' }))

  expect(stage).toContainElement(
    screen.getByRole('button', { name: '도치의 대화' }),
  )
})
```

In the LP flow test, replace the split-layer assertions with:

```tsx
const stage = document.querySelector('.room-stage')
const vinylStatus = document.querySelector('.room-vinyl-status')

expect(stage).toContainElement(vinyl)
expect(vinylStatus).not.toBeInTheDocument()
```

- [ ] **Step 2: Run the focused test and verify that the new contract fails**

Run:

```bash
rtk pnpm test -- src/App.test.tsx
```

Expected: FAIL because `.room-visual`, `.room-interface`, and `.room-stage--with-interface` still exist, and `.room-vinyl-status` is still rendered.

- [ ] **Step 3: Restore the single-room structure in `DochiRoom`**

Delete the `hasRoomInterface` calculation.

Use the room stage class without the split-layout modifier:

```tsx
<main
  className={`room-stage room-stage--${state} ${isOverdrive ? 'room-stage--overdrive' : ''}`.trim()}
  style={roomStyle}
>
```

Remove the `.room-visual` and `.room-interface` wrapper sections. Keep their children in the same order directly under `.room-stage`:

1. `.room-wall-mark`
2. `.room-grid-glow`
3. `.room-workbench`
4. `WorkshopEffects`
5. `.room-character`
6. `.room-controller-layer`
7. spin reaction
8. `VinylInteraction`
9. idle hint
10. `DialogueBox`
11. `ChoiceMenu`
12. `PlaylistInputPanel`
13. extraction, review, and error panels
14. taste analysis and error panels
15. camera, photo review, and polaroid composer
16. final tape choices and `FinalMixtape`
17. `.room-footer`

Delete the `.room-vinyl-status` block. The existing `VinylInteraction` hint, energy display, and recording label resume responsibility for LP guidance.

Do not change any render condition, child prop, callback, dialogue data, error message, or result value.

- [ ] **Step 4: Run the focused room-flow test**

Run:

```bash
rtk pnpm test -- src/App.test.tsx
```

Expected: all `src/App.test.tsx` tests PASS, including OCR handoff, LP spin, recording, photo skip, and FinalMixtape opening.

- [ ] **Step 5: Commit the DOM restoration**

```bash
rtk git add src/App.test.tsx src/components/DochiRoom.tsx
rtk git commit -m "refactor: restore single-room dochi layout"
```

---

### Task 2: Restore the Sketchbook Theme and Separate Typography Roles

**Files:**
- Modify: `src/styles/sketch-theme.test.ts`
- Modify: `src/styles/sketch-theme.css`

**Interfaces:**
- Consumes: Existing component class names from `DochiRoom` and all child components; `--font-ui` and `--font-note` theme tokens.
- Produces: A single-scene responsive theme, opaque `.dialogue-box`, Pretendard functional text, and Gaegu decorative text.

- [ ] **Step 1: Rewrite theme assertions for the approved presentation**

Replace the test named `keeps scene decoration inside the visual layer and the UI on opaque paper` with:

```ts
it('keeps decoration on the room and gives only dialogue an opaque paper surface', () => {
  expect(ruleFor('.room-stage::after')).toContain('opacity: 0.48')
  expect(ruleFor('.dialogue-box')).toContain(
    'background: var(--sketch-paper-bright)',
  )
  expect(ruleFor('.dialogue-box')).toContain(
    'border: var(--control-stroke) solid var(--sketch-ink)',
  )
  expect(themeCss).not.toContain('.room-interface')
})
```

Replace the desktop/tablet/mobile split-layout test with:

```ts
it('keeps one responsive room composition without split-layout breakpoints', () => {
  expect(ruleFor('.room-stage')).toContain('min-height: 39rem')
  expect(ruleFor('.room-stage')).not.toContain('grid-template-columns')
  expect(themeCss).toContain('@media (max-width: 760px)')
  expect(themeCss).not.toContain('@media (max-width: 1099px)')
  expect(themeCss).not.toContain('@media (max-width: 900px)')
  expect(themeCss).not.toContain('.room-stage--with-interface')
})
```

Update the typography test to assert both role lists:

```ts
it('uses Gothic for functional text and handwriting only for decoration', () => {
  expect(themeCss).toContain('--font-ui:')
  expect(themeCss).toContain('--font-note:')
  expect(ruleFor('body')).toContain('font-family: var(--font-ui)')

  for (const selector of [
    '.dialogue-box__line',
    '.retro-button',
    '.playlist-input-panel',
    '.playlist-extraction-review',
    '.camera-capture__panel',
    '.final-mixtape__card',
  ]) {
    expect(themeCss).toContain(selector)
  }

  expect(themeCss).toContain('.room-stage::before')
  expect(themeCss).toContain('.room-wall-mark')
  expect(themeCss).toContain('.final-mixtape__signature')
  expect(themeCss).toContain('font-family: var(--font-note)')
})
```

Remove assertions for `.room-vinyl-status`, `.room-visual`, `.room-interface`, and the 1099px/900px/520px layout breakpoints.

- [ ] **Step 2: Run the theme test and verify that it fails**

Run:

```bash
rtk pnpm test -- src/styles/sketch-theme.test.ts
```

Expected: FAIL because split-layout selectors remain and the first `.dialogue-box` rule is still transparent.

- [ ] **Step 3: Restore the pre-split single-scene CSS**

Use the `875aab4` version of `src/styles/sketch-theme.css` as the presentation baseline, then retain these current typography additions:

```css
:root {
  --font-ui: "Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI",
    "Apple SD Gothic Neo", sans-serif;
  --font-note: "Gaegu", "Apple SD Gothic Neo", sans-serif;
}

body {
  font-family: var(--font-ui);
}
```

Delete all rules that target:

```css
.room-visual
.room-interface
.room-interface--empty
.room-stage--with-interface
.room-vinyl-status
```

Restore the room decoration selectors to:

```css
.room-stage::before
.room-stage::after
```

Restore the single mobile breakpoint:

```css
@media (max-width: 760px) {
  .app-shell {
    background: var(--sketch-paper);
  }

  .stage-frame {
    padding: 0.35rem 0.5rem 1rem;
  }

  .room-stage {
    min-height: clamp(39rem, 138vw, 49rem);
  }

  .room-stage::before {
    top: 3.7rem;
    left: 1.2rem;
    font-size: 0.8rem;
  }

  .room-stage::after {
    inset: 3.9rem 0.2rem 1.4rem;
    opacity: 0.37;
  }
}
```

- [ ] **Step 4: Make the dialogue surface opaque**

Replace the transparent dialogue treatment with:

```css
.dialogue-box {
  padding: clamp(0.9rem, 2vw, 1.25rem);
  color: var(--sketch-ink);
  background: var(--sketch-paper-bright);
  border: var(--control-stroke) solid var(--sketch-ink);
  border-radius: 10px 7px 12px 8px / 8px 12px 7px 11px;
  box-shadow: 3px 4px 0 rgba(35, 34, 31, 0.08);
  transform: rotate(-0.08deg);
}
```

Keep `.dialogue-box::before { content: none; }` so collage tape decorations do not return.

- [ ] **Step 5: Apply Pretendard to every functional text surface**

Add one explicit functional typography list:

```css
button,
input,
textarea,
select,
.brand-lockup__name,
.brand-lockup__tag,
.topbar__status,
.screen-eyebrow,
.dialogue-box,
.dialogue-box__eyebrow,
.dialogue-box__line,
.dialogue-box__next,
.choice-menu,
.retro-button,
.retro-button__arrow,
.icon-button,
.panel-heading,
.playlist-input-panel,
.playlist-extraction-review,
.playlist-extraction-status,
.playlist-extraction-error,
.taste-analysis-status,
.taste-analysis-error,
.workshop-effects__message,
.vinyl-interaction__hint,
.vinyl-interaction__recording-label,
.vinyl-energy,
.camera-capture__panel,
.photo-review__panel,
.polaroid-composer__loading,
.polaroid-composer__error,
.tape-trigger,
.tape-trigger__label,
.tape-trigger__hint,
.mixtape-overlay__card,
.mixtape-card,
.final-mixtape__card,
.platform-listen__button,
.final-mixtape__platform-button,
.platform-listen__track-link {
  font-family: var(--font-ui);
}
```

Limit handwritten typography to decorative elements:

```css
.room-stage::before,
.room-wall-mark,
.vinyl-interaction__label,
.mixtape-card__sticker,
.final-mixtape__signature {
  font-family: var(--font-note);
}
```

Remove conflicting `font-family: var(--font-note)` declarations from functional selectors such as `.retro-button`, `.dialogue-box__line`, `.screen-eyebrow`, `.camera-capture__topline`, `.photo-review__caption`, `.tape-trigger__label`, `.track-row__index`, and `.platform-listen__note`.

- [ ] **Step 6: Run the focused theme and component tests**

Run:

```bash
rtk pnpm test -- src/styles/sketch-theme.test.ts src/components/DialogueBox.test.tsx src/components/PlaylistInputPanel.test.tsx src/components/PlaylistExtractionReview.test.tsx src/components/CameraCapture.test.tsx src/components/FinalMixtape.test.tsx
```

Expected: all selected tests PASS.

- [ ] **Step 7: Commit the visual and typography restoration**

```bash
rtk git add src/styles/sketch-theme.test.ts src/styles/sketch-theme.css
rtk git commit -m "style: restore readable single-room sketchbook theme"
```

---

### Task 3: Verify the Full Experience and Responsive Composition

**Files:**
- Verify only: `src/components/DochiRoom.tsx`
- Verify only: `src/styles/sketch-theme.css`
- Verify only: all existing tests and build inputs

**Interfaces:**
- Consumes: The restored single-room DOM and theme from Tasks 1–2.
- Produces: Evidence that the full feature flow and supported viewport sizes remain operational.

- [ ] **Step 1: Run the complete test suite once**

Run:

```bash
rtk pnpm test
```

Expected: all tests PASS with no changed functional behavior.

- [ ] **Step 2: Run TypeScript validation once**

Run:

```bash
rtk pnpm exec tsc -b --pretty false
```

Expected: exit code 0 with no TypeScript diagnostics.

- [ ] **Step 3: Run the production build once**

Run:

```bash
rtk pnpm build
```

Expected: Vite production build completes successfully.

- [ ] **Step 4: Start the local app for visual verification**

Run:

```bash
rtk pnpm dev -- --host 127.0.0.1
```

Expected: Vite reports a local URL without runtime compilation errors.

- [ ] **Step 5: Verify desktop and mobile viewports**

Inspect the running app at:

- 1440 × 1000
- 1024 × 900
- 768 × 900
- 390 × 844

At every viewport confirm:

- One workshop scene remains visible; no left/right split or stacked UI section appears.
- The dialogue box is fully opaque and its text uses Pretendard.
- Buttons, descriptions, OCR content, camera controls, and result content use Pretendard.
- Only background notes, decorative labels, and the signature retain Gaegu.
- No horizontal scrolling or viewport clipping occurs.
- The character, controller, dialogue, and state panels match the earlier single-room spatial composition.

- [ ] **Step 6: Smoke-test the complete interaction flow**

Exercise:

```text
idle
→ greeting
→ text input
→ extraction review
→ taste analysis
→ LP interaction
→ recording
→ photo skip
→ FinalMixtape
```

Confirm that the room remains mounted and all controls are operable.

- [ ] **Step 7: Review the final diff and repository status**

Run:

```bash
rtk git diff HEAD~2..HEAD
rtk git status --short
```

Expected: only the planned test, component, and theme files are committed; `pnpm-workspace.yaml` remains untracked and excluded.
