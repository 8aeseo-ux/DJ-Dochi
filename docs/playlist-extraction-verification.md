# Browser Playlist Extraction Verification

## Environment

- Date: 2026-07-23
- App: local Vite development server
- Browser: Codex in-app Chromium
- Desktop: default browser viewport
- Mobile: 390 × 844
- Extraction provider: `browser-ocr`
- OpenAI API key: not required for local OCR verification

## Image A: Apple Music playlist

Filename: `스크린샷 2026-07-23 오후 3.48.34.png`

Detected source: `Apple Music`

Extracted rows: 10

Representative rows:

| Title | Artist |
| --- | --- |
| Your Dog Loves You (feat. Crush) | Colde |
| 기 Car Crash | eal |
| annie. ® | wave to earth |
| § DIE 4 YOU | DEAN |
| 송가 | 하 현 상 |
| 항복 | 윤 마치 |
| 휴먼 매커니즘 | 윤 마치 |
| 써 사 랑 으로 | wave to earth |
| 사심 | Dvwn |
| Valentine | 워 슈 타 이 |

Result:

- The result used the `기기에서 읽음` badge.
- The current Vite server has no `/api` function, but local OCR still completed.
- Editing `Car Crash` and `eaJ`, deleting a row, adding a manual row, and confirming all worked.
- Confirmation continued to the existing `좋아.` handoff and LP interaction.
- OCR is intentionally review-first. Some Korean spacing, symbols, and short English names still need user correction.

## Image B: non-playlist DJ DOCHI error screen

Filename: `스크린샷 2026-07-23 오후 3.49.18.png`

Detected source: none

Initial finding:

- The first generic-parser run incorrectly formed four rows from UI labels.
- The false rows used numeric, punctuation-only, or one-character title/artist fields.

Regression fix:

- Added an automated non-playlist UI test.
- Generic rows now require at least two meaningful letter/number characters in both fields.
- Numeric-only fields are rejected.

Result after fix:

- Extracted rows: 0
- Warning: `곡명과 아티스트가 함께 보이는 항목을 찾지 못했어요.`
- The UI offered another image, text input, local retry, and explicit AI Vision retry.
- It did not continue to the LP interaction.

## Provider separation

- Normal upload used browser OCR and displayed `DOCHI OCR / READING`.
- The `AI Vision으로 다시 읽기` action was visible only while local OCR was active.
- Selecting it explicitly attempted the preserved server adapter.
- Because the local Vite server does not host Vercel functions, it showed a typed server-response error and did not substitute dummy tracks or continue.

## Mobile layout

At 390 × 844:

- viewport width: 390 px
- page scroll width: 390 px
- review panel client width: 331 px
- review panel scroll width: 331 px
- review panel vertical scrolling: available
- no horizontal overflow was observed

## Automated verification

```text
pnpm test
31 test files passed
134 tests passed

pnpm build
TypeScript passed
Vite production build passed
```

The production output contains a separate `tesseractOcrEngine-*.js` chunk, confirming that the OCR engine is lazy-loaded instead of entering the initial DJ room bundle.
