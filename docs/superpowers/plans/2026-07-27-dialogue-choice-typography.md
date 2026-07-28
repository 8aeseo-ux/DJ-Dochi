# Dialogue and Choice Typography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Dochi's main dialogue and choice-button labels smaller and lighter while preserving every other UI style and interaction.

**Architecture:** Keep the change inside the final `sketch-theme.css` override layer. Extend the existing CSS contract test so the approved typography values cannot regress.

**Tech Stack:** React, TypeScript, Vitest, CSS

## Global Constraints

- Modify only the main dialogue line and choice-button label typography.
- Use Pretendard with `font-weight: 500`.
- Keep opaque surfaces, layout, spacing, hit areas, and all state logic unchanged.
- Keep all other functional and decorative text unchanged.

---

### Task 1: Refine dialogue and choice typography

**Files:**
- Modify: `src/styles/sketch-theme.test.ts`
- Modify: `src/styles/sketch-theme.css`

**Interfaces:**
- Consumes: Existing `.dialogue-box__line` and `.choice-menu .retro-button` selectors.
- Produces: Stable typography contracts for the dialogue and choice labels.

- [ ] **Step 1: Write the failing CSS contract test**

Add this test to `src/styles/sketch-theme.test.ts`:

```ts
it('uses lighter, smaller typography for dialogue and choice labels', () => {
  expect(ruleFor('.dialogue-box__line')).toContain(
    'font-size: clamp(1.05rem, 1.85vw, 1.5rem)',
  )
  expect(ruleFor('.dialogue-box__line')).toContain('font-weight: 500')
  expect(ruleFor('.choice-menu .retro-button')).toContain('font-size: 0.9rem')
  expect(ruleFor('.choice-menu .retro-button')).toContain('font-weight: 500')
})
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
pnpm test -- src/styles/sketch-theme.test.ts --run
```

Expected: FAIL because the approved size and weight declarations do not exist.

- [ ] **Step 3: Add the minimal theme overrides**

Update the existing dialogue rule in `src/styles/sketch-theme.css`:

```css
.dialogue-box__line {
  font-size: clamp(1.05rem, 1.85vw, 1.5rem);
  font-weight: 500;
  line-height: 1.35;
}
```

Extend the existing choice-button rule:

```css
.choice-menu .retro-button {
  background: var(--sketch-paper-bright);
  font-size: 0.9rem;
  font-weight: 500;
}
```

- [ ] **Step 4: Run the test and verify GREEN**

Run:

```bash
pnpm test -- src/styles/sketch-theme.test.ts --run
```

Expected: all tests pass.

- [ ] **Step 5: Verify the rendered UI**

Open the choosing-input state at desktop and 390px widths. Confirm:

- Dialogue uses the reduced responsive size and weight 500.
- Both choice labels use `0.9rem` and weight 500.
- Opaque backgrounds and button hit areas are unchanged.
- No horizontal overflow is introduced.

- [ ] **Step 6: Run final checks**

Run:

```bash
pnpm exec tsc -b --pretty false
pnpm build
```

Expected: both commands exit successfully.

- [ ] **Step 7: Commit**

```bash
git add src/styles/sketch-theme.css src/styles/sketch-theme.test.ts
git commit -m "style: lighten dialogue and choice typography"
```
