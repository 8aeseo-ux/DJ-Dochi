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
45 test files passed
205 tests passed

pnpm build
TypeScript passed
Vite production build passed
```

The production output contains a separate `tesseractOcrEngine-*.js` chunk, confirming that the OCR engine is lazy-loaded instead of entering the initial DJ room bundle.

## LLM taste analysis handoff

- The browser OCR result remains in `extractionReview` until the user edits or confirms the list.
- Only the confirmed `id`, `title`, `artist`, and `album` fields are sent to `/api/generate-mixtape`.
- The endpoint selects the provider from `LLM_PROVIDER`, uses `OPENAI_MODEL`, and reads `OPENAI_API_KEY` only on the server.
- OpenAI output is treated as recommendation candidates, not catalog truth. Input-track duplicates and repeated candidates are removed before verification.
- Each candidate is searched in the credential-free iTunes Search API first. MusicBrainz is called only when iTunes cannot verify the candidate.
- Catalog outcomes are separated into `verified`, `not_found`, `ambiguous`, and `unavailable`. Live, remix, remaster, and similarly versioned results are handled conservatively.
- Only `catalogStatus: verified` tracks reach `FinalMixtape`. Failed slots are requested from the LLM again, with a maximum of two replacement rounds.
- If no recommendation verifies, the endpoint returns a retryable catalog error and the client stays in `tasteAnalysisError`; the LP interaction does not start.
- iTunes and MusicBrainz calls each have a four-second timeout. MusicBrainz calls are serialized with at least 1.1 seconds between request starts.
- Normalized title+artist combinations use a request cache and a bounded six-hour warm-instance cache. Temporary `unavailable` outcomes are not retained in the long-lived cache.
- Catalog logs include only provider, outcome, reason code, round, candidate index, requested count, and verified count. Track titles, artists, playlist contents, images, queries, and raw provider responses are not logged.
- API/provider failure stays in `tasteAnalysisError` with retry and new-input actions; it does not silently show `DUMMY_MIX` in production.
- `DUMMY_MIXTAPE_RESULT` is available only as a development-mode fallback so the fixed-room prototype remains testable without an API key.

The catalog providers require no Spotify Client ID, Spotify Client Secret, Apple Developer Token, or Music User Token.

To manually verify a live response, run the server-enabled Vercel dev command with `LLM_PROVIDER`, `OPENAI_MODEL`, and `OPENAI_API_KEY` set in the server environment. Confirm that the final rows are all `VERIFIED`, fabricated title+artist combinations are replaced or rejected, and different reviewed track lists produce different response titles or recommendation rows. Do not place the OpenAI key in a `VITE_` variable or print image/base64 data in logs.
