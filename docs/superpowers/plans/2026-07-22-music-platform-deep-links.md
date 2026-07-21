# DJ DOCHI Music Platform Deep Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every current DJ DOCHI recommendation open the exact song page on Spotify, Apple Music, and YouTube Music when a curated catalog reference exists, while preserving a search-result fallback for future unresolved recommendations.

**Architecture:** Keep platform metadata on each `Track`, resolve links through the existing pure `musicPlatforms.ts` adapter, and let `PlatformListenButtons` render only the resolved `href` and direct/search label. The current dialogue, LP, camera, polaroid, and mixtape state flow stays untouched. The installed Apple Music plugin remains a development-time catalog verification tool and is not imported into the browser bundle.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Vitest 4, Testing Library, CSS

## Global Constraints

- Preserve all current uncommitted platform-listening work; do not reset or overwrite it.
- Do not add Spotify, Apple Music, or YouTube credentials to the client.
- Do not add automatic playback, user OAuth, or playlist-library mutation in this phase.
- Store Apple Music's storefront URL exactly; derive Spotify and YouTube Music URLs from their catalog IDs.
- Keep unresolved recommendations usable through provider search URLs.
- Follow strict RED → GREEN → REFACTOR order and run the focused tests before the full suite.

---

### Task 1: Implement direct-link fixtures through RED-GREEN TDD

**Files:**
- Modify: `src/lib/musicPlatforms.test.ts`
- Modify: `src/components/PlatformListenButtons.test.tsx`

- [ ] **Step 1: Replace the null-fixture assertion with exact-link expectations**

In `src/lib/musicPlatforms.test.ts`, retain the current search-builder and synthetic resolved-track tests, then replace the test named `keeps an extensible provider reference on every recommended track` with:

```ts
it('resolves the curated mixtape fixtures to exact song pages', () => {
  expect(resolvePlatformTrackLink('spotify', DUMMY_TRACKS[0])).toEqual({
    href: 'https://open.spotify.com/track/1eyzqe2QqGZUmfcPZtrIyt',
    isDirect: true,
  })
  expect(resolvePlatformTrackLink('appleMusic', DUMMY_TRACKS[1])).toEqual({
    href: 'https://music.apple.com/kr/album/plastic-love/1541673202?i=1541673399',
    isDirect: true,
  })
  expect(resolvePlatformTrackLink('youtubeMusic', DUMMY_TRACKS[2])).toEqual({
    href: 'https://music.youtube.com/watch?v=RBtlPT23PTM',
    isDirect: true,
  })
})
```

- [ ] **Step 2: Make the fallback test independent of curated fixtures**

The existing fallback test currently uses `DUMMY_TRACKS[0]`, which will become a resolved fixture. Add this helper near the imports:

```ts
function makeUnresolvedTrack(): Track {
  return {
    ...DUMMY_TRACKS[0],
    title: 'Future Song',
    artist: 'Future Artist',
    platforms: {
      spotify: { id: null, url: null },
      appleMusic: { id: null, url: null },
      youtubeMusic: { id: null, url: null },
    },
  }
}
```

Update the search fallback test to use `const unresolvedTrack = makeUnresolvedTrack()` and assert:

```ts
expect(buildPlatformSearchUrl('spotify', unresolvedTrack)).toBe(
  'https://open.spotify.com/search/Future%20Artist%20Future%20Song',
)
expect(buildPlatformSearchUrl('appleMusic', unresolvedTrack)).toBe(
  'https://music.apple.com/kr/search?term=Future%20Artist%20Future%20Song',
)
expect(buildPlatformSearchUrl('youtubeMusic', unresolvedTrack)).toBe(
  'https://music.youtube.com/search?q=Future%20Artist%20Future%20Song',
)
expect(resolvePlatformTrackLink('spotify', unresolvedTrack)).toEqual({
  href: 'https://open.spotify.com/search/Future%20Artist%20Future%20Song',
  isDirect: false,
})
```

- [ ] **Step 3: Update the component contract for direct fixture links and unresolved future tracks**

In `src/components/PlatformListenButtons.test.tsx`, change the first test's Spotify assertions to:

```ts
const midnightCityLink = screen.getByRole('link', {
  name: 'Spotify에서 Midnight City 듣기',
})
expect(midnightCityLink).toHaveAttribute(
  'href',
  'https://open.spotify.com/track/1eyzqe2QqGZUmfcPZtrIyt',
)
expect(midnightCityLink).toHaveAttribute('target', '_blank')
expect(midnightCityLink).toHaveAttribute('rel', 'noreferrer')
```

After selecting Apple Music, assert the curated Apple Music link:

```ts
expect(screen.getByRole('link', {
  name: 'Apple Music에서 Midnight City 듣기',
})).toHaveAttribute(
  'href',
  'https://music.apple.com/kr/album/midnight-city/1674216738?i=1674217008',
)
```

Add a second test that renders one unresolved track and verifies the UI still says `찾기` and opens the search URL:

```ts
it('keeps future unresolved recommendations usable through search', async () => {
  const user = userEvent.setup()
  const unresolvedTrack = {
    ...DUMMY_TRACKS[0],
    title: 'Future Song',
    artist: 'Future Artist',
    platforms: {
      spotify: { id: null, url: null },
      appleMusic: { id: null, url: null },
      youtubeMusic: { id: null, url: null },
    },
  }

  render(<PlatformListenButtons tracks={[unresolvedTrack]} />)
  await user.click(screen.getByRole('button', { name: 'Spotify에서 듣기' }))

  expect(screen.getByRole('link', {
    name: 'Spotify에서 Future Song 찾기',
  })).toHaveAttribute(
    'href',
    'https://open.spotify.com/search/Future%20Artist%20Future%20Song',
  )
})
```

- [ ] **Step 4: Run the focused tests and confirm the intended RED state**

Run:

```bash
rtk /Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run src/lib/musicPlatforms.test.ts src/components/PlatformListenButtons.test.tsx
```

Expected: the direct fixture assertions fail because `src/data/playlist.ts` still stores `null` platform references and resolves to provider search URLs. The unresolved fallback assertions should continue to pass.

---

#### GREEN: Add curated platform references to the current mixtape data

**Files:**
- Modify: `src/data/playlist.ts`

- [ ] **Step 1: Populate exact references for `Midnight City`**

Replace its `platforms` value with:

```ts
platforms: {
  spotify: { id: '1eyzqe2QqGZUmfcPZtrIyt', url: null },
  appleMusic: {
    id: '1674217008',
    url: 'https://music.apple.com/kr/album/midnight-city/1674216738?i=1674217008',
  },
  youtubeMusic: { id: 'dX3k_QDnzHE', url: null },
},
```

- [ ] **Step 2: Populate exact references for `Plastic Love`**

Replace its `platforms` value with:

```ts
platforms: {
  spotify: { id: '7rU6Iebxzlvqy5t857bKFq', url: null },
  appleMusic: {
    id: '1541673399',
    url: 'https://music.apple.com/kr/album/plastic-love/1541673202?i=1541673399',
  },
  youtubeMusic: { id: 'T_lC2O1oIew', url: null },
},
```

- [ ] **Step 3: Populate exact references for `Space Song`**

Replace its `platforms` value with:

```ts
platforms: {
  spotify: { id: '705r2EzlkUkDoabGfJdzUe', url: null },
  appleMusic: {
    id: '1247704673',
    url: 'https://music.apple.com/kr/album/space-song/1247704667?i=1247704673',
  },
  youtubeMusic: { id: 'RBtlPT23PTM', url: null },
},
```

- [ ] **Step 4: Populate exact references for `Get Lucky`**

Replace its `platforms` value with:

```ts
platforms: {
  spotify: { id: '69kOkLUCkxIZYexIgSG8rq', url: null },
  appleMusic: {
    id: '617154366',
    url: 'https://music.apple.com/kr/album/get-lucky/617154241?i=617154366',
  },
  youtubeMusic: { id: '5NV6Rdv1a3I', url: null },
},
```

- [ ] **Step 5: Run the focused tests and confirm GREEN**

Run:

```bash
rtk /Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run src/lib/musicPlatforms.test.ts src/components/PlatformListenButtons.test.tsx
```

Expected: both test files pass. The current fixtures render `듣기`; the synthetic unresolved fixture renders `찾기`.

- [ ] **Step 6: Review the diff and keep the resolver/UI unchanged unless the tests reveal a defect**

Run:

```bash
rtk git diff -- src/data/playlist.ts src/lib/musicPlatforms.ts src/lib/musicPlatforms.test.ts src/components/PlatformListenButtons.tsx src/components/PlatformListenButtons.test.tsx
```

Expected: production behavior changes through the curated data only. Do not add provider-specific branching to `PlatformListenButtons`.

---

### Task 2: Verify the complete feature and current experience

**Files:**
- Verify: `src/components/FinalMixtape.tsx`
- Verify: `src/components/PlatformListenButtons.tsx`
- Verify: `src/lib/musicPlatforms.ts`
- Verify: `src/data/playlist.ts`
- Verify: `src/types.ts`
- Verify: `src/styles/dj-dochi.css`

- [ ] **Step 1: Run the entire Vitest suite**

Run:

```bash
rtk /Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run
```

Expected: all test files and tests pass.

- [ ] **Step 2: Run TypeScript and the production build**

Run:

```bash
rtk /Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/typescript/bin/tsc --noEmit
rtk /Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vite/bin/vite.js build
```

Expected: both commands exit with code 0. Confirm no Apple Music plugin package, developer token, or provider secret appears in `dist`.

- [ ] **Step 3: Run desktop browser QA against the local app**

Start or reuse the Vite server, open the fixed DJ room, complete the existing interaction through the mixtape overlay, and verify:

- the dialogue, LP, recording, camera-skip, polaroid, and result flow still completes;
- each platform button expands only its own four-track list;
- all current links use `듣기`, open in a new tab, and point to the intended song page;
- closing the overlay returns to the same fixed DJ room;
- the browser console has no new errors.

- [ ] **Step 4: Run a mobile viewport QA pass**

At a phone-sized viewport, verify the three platform buttons stack, each track link remains tappable, the mixtape overlay scrolls without clipping, and opening a provider link does not reset the DJ DOCHI state.

- [ ] **Step 5: Inspect the final feature diff**

Run:

```bash
rtk git status --short
rtk git diff --check
rtk git diff -- src/components/FinalMixtape.tsx src/components/PlatformListenButtons.tsx src/components/PlatformListenButtons.test.tsx src/lib/musicPlatforms.ts src/lib/musicPlatforms.test.ts src/data/playlist.ts src/types.ts src/styles/dj-dochi.css
```

Expected: no whitespace errors, no credentials, no unrelated workflow changes, and only the approved platform-listening feature is included.

- [ ] **Step 6: Commit the complete platform-listening feature**

Stage only these feature files:

```bash
rtk git add src/components/FinalMixtape.tsx src/components/PlatformListenButtons.tsx src/components/PlatformListenButtons.test.tsx src/lib/musicPlatforms.ts src/lib/musicPlatforms.test.ts src/data/playlist.ts src/types.ts src/styles/dj-dochi.css
rtk git commit -m "Add music platform song links"
```

Expected: one focused commit containing the current platform button UI, extensible metadata model, direct-link resolver, curated fixtures, styling, and tests.

## Completion Criteria

- All four current recommendations resolve to direct Spotify, Apple Music, and YouTube Music song links.
- A future recommendation with no platform metadata still resolves to search links and remains actionable.
- Direct links show `듣기`; search fallbacks show `찾기`.
- The existing DJ DOCHI interactive flow remains unchanged.
- No plugin runtime, OAuth token, API secret, or server dependency is added.
- Focused tests, full tests, TypeScript, production build, desktop QA, and mobile viewport QA all pass.
