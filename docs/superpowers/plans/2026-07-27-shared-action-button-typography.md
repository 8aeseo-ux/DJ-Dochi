# Shared Action Button Typography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 공통 텍스트 액션 버튼의 글자 크기와 굵기를 `0.9rem`과 `500`으로 통일한다.

**Architecture:** `sketch-theme.css`의 기존 공통 버튼 선택자 그룹을 단일 진실 공급원으로 사용한다. 선택 메뉴의 중복 타이포그래피 선언을 제거하고, CSS 회귀 테스트로 공통 버튼과 제외 요소의 경계를 고정한다.

**Tech Stack:** React 19, TypeScript 5.9, CSS, Vitest 4

## Global Constraints

- 모든 `RetroButton`과 음악 플랫폼 액션 버튼에 `font-size: 0.9rem`과 `font-weight: 500`을 적용한다.
- 아이콘 전용 버튼, 이미지 업로드 드롭존, LP 및 믹스테이프 오브젝트 버튼은 변경하지 않는다.
- 버튼 크기, 패딩, 테두리, 배경, 아이콘 크기, 이벤트 및 상태 흐름은 변경하지 않는다.
- JSX와 컴포넌트 구조는 수정하지 않는다.
- 사용자 소유 파일 `pnpm-workspace.yaml`은 수정하거나 커밋하지 않는다.

## File Structure

- Modify: `src/styles/sketch-theme.css` — 공통 액션 버튼 타이포그래피를 정의하고 선택지의 중복 선언을 제거한다.
- Modify: `src/styles/sketch-theme.test.ts` — 공통 스타일과 제외 범위를 회귀 테스트한다.

---

### Task 1: Unify Shared Action Button Typography

**Files:**
- Modify: `src/styles/sketch-theme.css:320-394`
- Test: `src/styles/sketch-theme.test.ts:112-125`

**Interfaces:**
- Consumes: 기존 `.retro-button`, `.platform-listen__button`, `.final-mixtape__platform-button` 공통 CSS 선택자 그룹
- Produces: 모든 공통 텍스트 액션 버튼에 적용되는 `0.9rem`/`500` 타이포그래피 규칙

- [ ] **Step 1: Write the failing regression test**

`src/styles/sketch-theme.test.ts`에서 기존 선택지 타이포그래피 테스트를 다음처럼 확장한다.

```ts
function groupedRuleFor(firstSelector: string) {
  const start = themeCss.indexOf(`${firstSelector},`)
  if (start < 0) return ''
  const end = themeCss.indexOf('}', start)
  return themeCss.slice(start, end + 1)
}

it('uses lighter, smaller typography for dialogue and shared action buttons', () => {
  expect(ruleFor('.dialogue-box__line')).toContain(
    'font-size: clamp(1.05rem, 1.85vw, 1.5rem)',
  )
  expect(ruleFor('.dialogue-box__line')).toContain('font-weight: 500')

  const actionButtons = groupedRuleFor('.retro-button')
  expect(actionButtons).toContain('.platform-listen__button')
  expect(actionButtons).toContain('.final-mixtape__platform-button')
  expect(actionButtons).toContain('font-size: 0.9rem')
  expect(actionButtons).toContain('font-weight: 500')

  expect(ruleFor('.choice-menu .retro-button')).not.toContain('font-size:')
  expect(ruleFor('.choice-menu .retro-button')).not.toContain('font-weight:')
  expect(ruleFor('.file-dropzone')).not.toContain('font-size: 0.9rem')
  expect(ruleFor('.icon-button')).not.toContain('font-size: 0.9rem')
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
rtk run 'PATH=/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH pnpm test -- src/styles/sketch-theme.test.ts'
```

Expected: FAIL because the shared action rule still contains `font-size: 1.05em` and `font-weight: 700`, while the choice rule still owns `0.9rem` and `500`.

- [ ] **Step 3: Implement the shared CSS rule**

Change the existing shared rule in `src/styles/sketch-theme.css` to:

```css
.retro-button,
.platform-listen__button,
.final-mixtape__platform-button {
  color: var(--sketch-ink);
  background: transparent;
  border: var(--control-stroke) solid var(--sketch-ink);
  border-radius: 999px 940px 980px 920px / 820px 980px 860px 940px;
  box-shadow: none;
  font-family: var(--font-ui);
  font-size: 0.9rem;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  transform: rotate(-0.16deg);
  transition:
    transform 110ms steps(2, end),
    background-color 110ms ease;
}
```

Remove only `font-size` and `font-weight` from the choice-specific rule:

```css
.choice-menu .retro-button {
  background: var(--sketch-paper-bright);
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
rtk run 'PATH=/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH pnpm test -- src/styles/sketch-theme.test.ts'
```

Expected: all tests in `src/styles/sketch-theme.test.ts` pass.

- [ ] **Step 5: Verify desktop and mobile rendering**

Open the existing local app and inspect a common `RetroButton` at 1440px and 390px widths.

Expected computed values:

```text
font-size: 14.4px
font-weight: 500
```

Confirm that OCR/taste error action labels remain within their button boundaries and that icon-only controls, the upload dropzone, and interactive LP/mixtape objects retain their current treatment.

- [ ] **Step 6: Run the final verification suite once**

Run:

```bash
rtk run 'PATH=/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH pnpm test'
rtk run 'PATH=/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH pnpm exec tsc -b --pretty false'
rtk run 'PATH=/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH pnpm build'
```

Expected: full test suite, TypeScript project build, and Vite production build all exit with code 0.

- [ ] **Step 7: Commit only the planned files**

```bash
rtk git add src/styles/sketch-theme.css src/styles/sketch-theme.test.ts
rtk git commit -m "style: unify action button typography"
```

Expected: the commit contains only the CSS and style test changes; `pnpm-workspace.yaml` remains untracked.
