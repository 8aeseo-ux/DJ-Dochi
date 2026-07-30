# Home Layout Polish

## Goal

Improve the spacing, alignment, and visual hierarchy of the existing Home
experience without changing its sketchbook concept, assets, typography, motion,
or behavior.

## Scope

- Include only `idle`, `noticed`, `talking`, and `choosingInput`.
- Keep upload, OCR, taste analysis, LP, camera, and mixtape screens unchanged.
- Keep JSX and state logic unchanged.
- Apply the refinement in the final `sketch-theme.css` override layer.

## Spacing System

Use an 8px base rhythm:

- `0.5rem` (8px): gap between adjacent controls.
- `1rem` (16px): compact outer spacing and control padding.
- `1.5rem` (24px): desktop dialogue and choice inset.
- `6.5rem` (104px): matched dialogue and choice-group height.

## Desktop Composition

- Keep the character, controller, speakers, equalizer, and doodles in their
  current composition.
- Keep dialogue and choices aligned to the same baseline.
- Set the dialogue to 56% of the room width and the choice group to 32%, leaving
  a stable gap at 1024px and 768px.
- Give choice buttons consistent horizontal padding and a shared 8px gap.

## Mobile Composition

- Keep the existing vertical stack.
- Use 16px side and bottom insets.
- Place the choice group 8px above the dialogue box.
- Match the choice-group and dialogue minimum heights so the stack reads as one
  deliberate control area without overlap.

## Verification

- Verify `idle`, `noticed`/`talking`, and `choosingInput`.
- Check 1440px, 1024px, 768px, and 390px viewports.
- Confirm no horizontal overflow, visual overlap, or changes to later states.
- Run the focused theme tests, full tests, TypeScript, and production build.
