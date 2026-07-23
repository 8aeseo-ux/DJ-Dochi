# DJ DOCHI Handmade Collage UI Design

## Goal

Redesign DJ DOCHI as a handmade scrapbook interface while preserving the complete interaction flow, React state machine, component boundaries, data handling, and accessibility behavior. The finished room should feel like Dochi assembled it from paper scraps, pencil marks, tape, stickers, and handwritten notes.

## Fixed constraints

- Do not change the existing UX flow or state transitions.
- Do not replace, merge, or reorganize existing React components.
- Do not change upload, OCR, taste analysis, vinyl physics, camera, catalog, or platform-link behavior.
- Keep the existing Dochi and DJ controller image assets recognizable.
- Apply the redesign through a separate theme stylesheet imported after the existing styles.
- Prefer CSS for texture, borders, paper layering, doodles, and feedback.
- Add SVG only when CSS cannot provide a stable decorative line or icon.
- Preserve keyboard focus visibility, readable contrast, responsive layouts, and reduced-motion behavior.

## Recommended architecture

Add `src/styles/sketch-theme.css` and import it after `dj-dochi.css` in `src/index.css`. The existing 3,986-line stylesheet remains the structural and responsive foundation. The new stylesheet owns visual tokens and targeted overrides only.

The theme layer will:

- replace the dark neon palette with paper, graphite, faded red, faded green, and faded blue;
- neutralize ambient glows, heavy shadows, and digital grid styling;
- give shared controls and surfaces one consistent rough-paper treatment;
- reuse existing class names so component markup and feature logic remain untouched;
- keep responsive behavior from the current stylesheet unless a visual override requires a narrow correction.

This separation allows the theme to be removed or replaced without touching functional components and keeps future Figma-to-code work isolated from application logic.

## Visual system

### Canvas

The room uses a warm off-white paper background with subtle fibers, sparse notebook guide lines, and low-contrast pencil speckles. The stage remains a single fixed room, but it reads as a sketchbook spread rather than a dark DJ booth.

The top bar becomes a handwritten notebook heading. Room status appears as a small stamped label instead of an illuminated digital indicator. Decorative glows become lightly colored pencil swatches.

### Ink and color

- Main ink: soft graphite black.
- Paper: warm white and light cream.
- Primary accent: faded coral-red.
- Secondary accents: muted green and washed blue.
- Disabled and secondary text: pencil gray.

Color is reserved for active choices, progress, recording feedback, track indices, and small stickers. Large surfaces remain monochrome or cream.

### Typography

Titles and short labels use a local handwritten-style font stack with Korean system fallbacks. Long body copy and editable fields retain a readable system font. Slight rotation, uneven letter spacing, underlines, and marker-like highlights create the handmade impression without reducing legibility.

No remote font dependency is introduced.

### Lines and surfaces

Panels, cards, speech bubbles, inputs, and overlays use:

- uneven rounded corners;
- graphite borders with a second offset line or dashed pencil echo;
- flat paper fills;
- minimal offset paper shadows;
- slight per-surface rotation, capped so text and controls remain comfortable to use.

Pseudo-elements provide torn-paper edges, tape strips, corner folds, doodle stars, arrows, and scribbled underlines. Decoration remains non-interactive and hidden from assistive technology through existing pseudo-element behavior.

## Character and controller treatment

Dochi and the DJ controller remain the supplied rendered images. They are treated as physical scrapbook cutouts rather than redrawn illustrations:

- a narrow warm-white sticker edge;
- a graphite drop line and small offset paper shadow;
- masking-tape pieces attached near corners;
- occasional pencil motion marks around Dochi;
- no filter that materially changes expressions, facial detail, or controller readability.

Their existing positions, sizes, z-index ordering, frame animation, and interaction targets remain unchanged.

## Component coverage

The theme must cover every existing state and shared component:

- `DochiRoom`: paper workspace, notebook header, hand-drawn workbench and speakers.
- `DochiCharacter` and `DjController`: paper sticker collage treatment.
- `DialogueBox`: notebook speech card with rough tail and handwritten next marker.
- `ChoiceMenu` and `RetroButton`: cut-paper buttons with stamped active feedback.
- `Panel`: shared paper card base for loading, errors, camera, and prompts.
- `PlaylistInputPanel`: taped upload sheet, ruled textarea, paper image preview.
- `PlaylistExtractionReview`: ledger-like track rows, pencil edit fields, crossed-out delete controls.
- `WorkshopEffects`: pencil equalizer bars, hand-marked status notes, restrained accent color.
- `VinylInteraction`: drawn turntable mat, imperfect circular rings, hand-sketched energy meter.
- `CameraCapture`, `PhotoReview`, and `PolaroidComposer`: taped contact-sheet and scrapbook-photo treatment.
- `FinalMixtape` and `MixtapeOverlay`: assembled cassette label, handwritten track list, sticker-like platform controls.

## Interaction and motion

Buttons move down by approximately two pixels on press and may rotate by less than one degree. A short two-to-three-pixel shake provides stamp feedback on active interactions. Hover states use pencil fill, underline, or a small paper lift rather than glow.

Existing character, vinyl, recording, and workflow animations remain functionally unchanged. Decorative animation is brief and uses stepped or slightly irregular timing. Under `prefers-reduced-motion`, decorative shake, rotation, and tape-entry motion are disabled or reduced to simple state changes.

## Responsive behavior

Current desktop and mobile layout rules remain authoritative. The theme avoids fixed decorative elements that could cover controls. On small screens:

- decorative doodles are reduced;
- surface rotation is lowered;
- borders and tape remain visible without increasing horizontal overflow;
- overlays keep existing scrolling and focus behavior;
- tap targets retain their current dimensions.

## Accessibility

- Graphite text on paper must maintain readable contrast.
- Focus rings become a thick blue-pencil outline and remain visible on all surfaces.
- Decoration never conveys required state by itself.
- Disabled controls retain text contrast and a distinct crossed-pencil treatment.
- Existing labels, roles, live regions, and keyboard behavior are preserved.
- Motion respects the existing reduced-motion media query.

## Verification

Automated checks will verify that the new theme is imported last and that key shared selectors for the room, panels, buttons, dialogue, inputs, vinyl, and mixtape are present. Existing unit tests must remain unchanged and pass.

Visual verification will cover:

1. Idle room.
2. Dialogue and input choice.
3. Image/text input panels.
4. OCR loading, extraction review, and error panels.
5. Taste analysis loading and error.
6. Vinyl interaction, needle drop, and recording.
7. Camera prompt, preview, review, and polaroid.
8. Final mixtape overlay and platform controls.
9. Desktop and mobile viewport behavior.
10. Reduced-motion presentation.

The redesign is complete when all states share the same paper-collage language, no dark neon surface remains dominant, no functional flow changes, and no critical overflow or contrast issue appears in browser verification.
