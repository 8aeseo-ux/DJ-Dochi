# Budgeted Mixtape Pipeline Design

## Goal

Return a useful, catalog-verified mixtape before the browser's 45-second timeout. A result with at least three verified tracks is successful; filling every recommendation slot is secondary.

## Fixed constraints

- Generate five recommendations by default and accept no more than six.
- Request replacement recommendations at most once.
- Give the complete server pipeline a 35-second budget.
- Return the verified tracks accumulated before the budget expires when at least three exist.
- Do not enter the LP flow when fewer than three tracks verify.
- Run iTunes verification with concurrency three.
- Run MusicBrainz only for candidates that iTunes did not verify.
- Attempt at most three MusicBrainz candidates per request.
- Propagate browser cancellation and server-budget cancellation to OpenAI, iTunes, and MusicBrainz.
- Log stage duration and verification call counts without titles, artists, playlist contents, or images.

## Architecture

`api/mixtapePipelineConfig.ts` owns the latency and quality constants. The OpenAI provider accepts an optional request signal, limits the initial structured response to five or six tracks, and passes the signal to the Responses API request options.

The catalog chain exposes primary and fallback verification separately while preserving the existing combined `verify()` method. This lets the recommendation orchestrator run iTunes checks with bounded concurrency, then send only failed candidates through the rate-limited MusicBrainz fallback.

`verifyMixtapeRecommendations()` owns the minimum-success rule, one replacement round, MusicBrainz cap, deadline checks, partial-success return, and safe catalog metrics. `/api/generate-mixtape` owns the 35-second deadline and combines it with `request.signal`, measures the OpenAI and total stages, and clears its timer in all outcomes.

## Data flow

1. Validate the reviewed track list.
2. Start a 35-second server budget and combine its signal with `request.signal`.
3. Generate five recommendations with OpenAI.
4. Verify all candidates with iTunes at concurrency three.
5. If three tracks verify, return immediately.
6. Otherwise, check at most three iTunes failures with MusicBrainz, sequentially.
7. If three tracks verify, return immediately.
8. If time remains, request the missing count once and repeat the bounded catalog pass.
9. Return the verified partial result when it contains at least three tracks.
10. Return a retryable catalog error when fewer than three tracks verify.

## Time-budget behavior

The hard budget is 35 seconds and the orchestrator stops starting new work when one second or less remains. If a request is already in flight when the hard budget fires, its signal is aborted. Catalog providers convert the abort into an unavailable result, after which the orchestrator returns the accumulated verified set when it meets the three-track threshold.

If the browser disconnects first, the same combined signal cancels OpenAI or catalog work. No additional replacement or MusicBrainz request starts after cancellation.

## Logging

Server logs use fixed metadata only:

- `pipeline_stage`: stage, duration, elapsed time, remaining time.
- `catalog_round`: round, duration, iTunes checks, MusicBrainz checks, verified count.
- `pipeline_complete`: total duration, verified count, replacement rounds, iTunes checks, MusicBrainz checks, partial-result flag.
- Existing per-candidate verification logs retain only provider, status, reason, round, and candidate index.

No title, artist, album, prompt, playlist, query, image, or raw provider response is logged.

## Error behavior

- At least three verified tracks: HTTP 200 and LP flow continues.
- Fewer than three verified tracks after one replacement or the budget: retryable `CATALOG_VERIFICATION_FAILED`.
- Browser cancellation or OpenAI cancellation before catalog verification: retryable `REQUEST_TIMEOUT`.
- Missing provider configuration remains a 503 configuration error.

## Expected impact

Results will normally contain three to five tracks instead of trying to fill every generated slot. MusicBrainz coverage is intentionally narrower, so some valid but hard-to-match tracks may be omitted. In exchange, the pipeline performs fewer OpenAI and catalog calls, has bounded latency, and avoids turning an otherwise useful three-track result into a total UX failure.

## Testing

- Structured OpenAI requests constrain initial recommendations and receive the combined abort signal.
- Replacement generation is called no more than once.
- Three initial iTunes matches return without replacement or MusicBrainz.
- iTunes concurrency never exceeds three.
- MusicBrainz receives only iTunes failures and never more than three candidates.
- Budget expiration returns a verified partial result when it contains at least three tracks.
- Budget expiration below three tracks returns an error.
- Browser cancellation reaches LLM and catalog provider calls.
- Logs contain durations and call counts but no track or playlist text.
- Full tests, TypeScript, production build, and a live local API request complete before the browser timeout.
