# DJ DOCHI Vinyl Inertia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an inertia-driven LP interaction that charges mix energy from meaningful rotational speed and performs a staged recording reveal.

**Architecture:** Pure physics and tuning live in `src/lib/vinylPhysics.ts`; `VinylInteraction` adapts pointer events and animation frames; `useDjDochiFlow` owns narrative state transitions. Room components consume qualitative metrics without owning physics.

**Tech Stack:** React 19, TypeScript, CSS, Pointer Events, requestAnimationFrame, Vitest, Testing Library

## Global Constraints

- Preserve upload, input confirmation, dummy playlist result, and fixed-room architecture.
- Use one Pointer Events path for mouse, trackpad-equivalent pointers, and touch.
- Apply `touch-action: none` only to the LP interaction surface.
- Keep all difficulty values in `src/lib/vinylPhysics.ts`.
- Overdrive is feedback, never failure.
- Near-rest energy decay must be slow and must not erase a valid attempt immediately.
- Repository has no Git metadata; verification checkpoints replace commit steps.

---

### Task 1: Pure Vinyl Physics

**Files:**
- Create: `src/lib/vinylPhysics.ts`
- Create: `src/lib/vinylPhysics.test.ts`

**Interfaces:**
- Produces: `VINYL_PHYSICS`, `stepInertia()`, `stepMixEnergy()`, `calculateDragVelocity()`, `classifySpinFeedback()`.

- [ ] Write failing tests proving time-based friction, speed-gated energy gain, near-rest decay, velocity clamping, and feedback thresholds.
- [ ] Run `rtk vitest run src/lib/vinylPhysics.test.ts` and confirm failures are caused by the missing module.
- [ ] Implement the pure constants and functions with values tuned for a 3–5 second strong coast.
- [ ] Re-run the focused physics tests and confirm all pass.

### Task 2: Pointer and Inertia Component

**Files:**
- Modify: `src/components/VinylInteraction.tsx`
- Modify: `src/components/VinylInteraction.test.tsx`

**Interfaces:**
- Consumes: pure physics functions from Task 1.
- Produces: `onSpinMetrics({ energy, intensity, feedback, overdrive })` and delayed `onComplete()`.

- [ ] Replace the two-turn test with failing tests for slow rejection, strong release inertia, pointer-type parity, and delayed completion.
- [ ] Add `requestAnimationFrame` scheduling and cancellation test coverage.
- [ ] Run the focused component test and confirm the new expectations fail against the angle-total implementation.
- [ ] Implement angle-based velocity sampling, smoothed release velocity, RAF inertia, throttled metrics, and completion coast.
- [ ] Keep the needle and REC rendering separated into `spin`, `needle`, and `recording` phases.
- [ ] Re-run the focused component tests and confirm all pass.

### Task 3: Narrative State Sequence

**Files:**
- Modify: `src/types.ts`
- Modify: `src/hooks/useDjDochiFlow.ts`
- Modify: `src/hooks/useDjDochiFlow.test.ts`

**Interfaces:**
- Consumes: `SpinMetrics` from Task 2.
- Produces: `spinEnergy`, `spinIntensity`, `spinReaction`, `isOverdrive`, and states `recordingIntro`, `needleDropping`, `recording`.

- [ ] Write failing flow tests for `됐다!`, automatic needle transition, REC transition, and unchanged result return.
- [ ] Implement metric updates and stable qualitative reaction selection.
- [ ] Change completion from immediate recording to coast callback → celebration → needle → recording.
- [ ] Re-run hook tests and confirm all pass.

### Task 4: Room Feedback and Styling

**Files:**
- Modify: `src/components/DochiRoom.tsx`
- Modify: `src/components/WorkshopEffects.tsx`
- Modify: `src/components/WorkshopEffects.test.tsx`
- Modify: `src/styles/dj-dochi.css`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: flow metrics and VinylInteraction phase.
- Produces: qualitative energy gauge, reaction bubble, speed lines, dynamic groove/equalizer/speaker response, reel preview, REC blink, and overdrive shake.

- [ ] Write failing integration expectations for qualitative feedback and staged completion.
- [ ] Connect room CSS variables for intensity and energy.
- [ ] Add non-numeric gauge states and Dochi reaction bubble.
- [ ] Add near-target REC blink, energy-driven reel movement, speed lines, and reduced-motion fallbacks.
- [ ] Re-run focused integration tests and confirm all pass.

### Task 5: Full and Device Verification

**Files:**
- Verify all changed files.

- [ ] Run `rtk vitest run` and confirm zero failures.
- [ ] Run `rtk npm run build` and confirm TypeScript and Vite succeed.
- [ ] Verify mouse circular drag and inertia in the desktop browser.
- [ ] Verify trackpad-equivalent pointer movement using the desktop pointer path.
- [ ] Verify touch-style pointer input and responsive layout in a mobile viewport.
- [ ] Check console warnings/errors and leave the app at the idle state.
