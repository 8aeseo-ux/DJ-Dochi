# Home Layout Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish spacing, alignment, and hierarchy in the Home states without changing design language or behavior.

**Architecture:** Add state-scoped CSS overrides to the final sketch theme layer. Preserve all JSX and state logic, and verify the rendered composition at the four agreed breakpoints.

**Tech Stack:** React, TypeScript, Vitest, CSS

## Global Constraints

- Modify only `idle`, `noticed`, `talking`, and `choosingInput` presentation.
- Use an 8px spacing rhythm.
- Do not change colors, fonts, assets, graphics, animations, functions, or state flow.
- Keep later upload, OCR, analysis, LP, camera, and result states unchanged.

---

### Task 1: Refine Home spacing and alignment

**Files:**
- Modify: `src/styles/sketch-theme.css`

**Interfaces:**
- Consumes: Existing `.room-stage--*`, `.dialogue-box`, `.choice-menu`, and `.retro-button` classes.
- Produces: A balanced desktop row and non-overlapping mobile stack.

- [ ] **Step 1:** Add Home-state spacing variables using `0.5rem`, `1rem`, `1.5rem`, and `6.5rem`.
- [ ] **Step 2:** Align desktop dialogue and choice controls with 56%/32% widths and a shared bottom inset.
- [ ] **Step 3:** Normalize choice-button padding and internal gap.
- [ ] **Step 4:** At 720px and below, stack choices 8px above the dialogue with 16px outer insets.
- [ ] **Step 5:** Run the existing focused theme test and confirm no established theme contract regresses.

### Task 2: Verify the complete Home composition

**Files:**
- No product file changes expected.

**Interfaces:**
- Consumes: The updated Home theme rules.
- Produces: Visual and build evidence.

- [ ] **Step 1:** Capture `idle`, dialogue, and choosing-input screenshots at 1440px, 1024px, 768px, and 390px.
- [ ] **Step 2:** Confirm dialogue and choices do not overlap and decorative objects do not obstruct controls.
- [ ] **Step 3:** Run the full test suite once.
- [ ] **Step 4:** Run TypeScript once.
- [ ] **Step 5:** Run the production build once.
