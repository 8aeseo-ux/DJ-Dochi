# Dialogue and Choice Typography Refinement

## Goal

Reduce the visual weight of the most prominent text without changing the
single-room composition, opaque paper surfaces, or any interaction flow.

## Scope

- Reduce only the main Dochi dialogue line and choice-button labels.
- Keep eyebrow labels such as `DOCHI`, the `NEXT` hint, panel copy, OCR copy,
  result copy, and decorative handwriting unchanged.
- Preserve Pretendard as the functional UI typeface.

## Typography

- Dialogue line:
  - `font-size: clamp(1.05rem, 1.85vw, 1.5rem)`
  - `font-weight: 500`
  - Keep the existing line height.
- Choice buttons:
  - `font-size: 0.9rem`
  - `font-weight: 500`
  - Keep enough line height and button height for touch accessibility.

## Responsive Behavior

- The dialogue clamp keeps the text readable on mobile while reducing its
  desktop prominence.
- Choice-button text remains the same size across breakpoints so labels do not
  become too small on narrow screens.
- Existing layout, spacing, button hit areas, and opaque backgrounds remain
  unchanged.

## Verification

- Add a theme regression test for the dialogue and choice typography values.
- Verify the dialogue and choice state at desktop and 390px mobile widths.
- Run the full test suite, TypeScript check, and production build.
