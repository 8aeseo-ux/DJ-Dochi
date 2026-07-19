# DJ DOCHI 카메라 폴라로이드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 믹스테이프 제작이 끝난 뒤 사용자가 브라우저 카메라로 사진을 촬영하고, 도치 이미지와 Canvas 폴라로이드로 합성해 최종 믹스테이프 라벨에 붙이는 로컬 UX 프로토타입을 구현한다.

**Architecture:** `useDjDochiFlow`는 사진 단계의 상태·data URL·전환만 관리하고, `useCamera`는 MediaStream 생명주기만 담당한다. `DochiRoom`은 고정된 작업실 안에서 `CameraCapture`, `PhotoReview`, `PolaroidComposer`, `FinalMixtape`를 상태에 따라 겹쳐 표시한다. Canvas 합성은 `polaroidComposer.ts`의 독립 함수로 분리해 UI와 이미지 처리 로직을 분리한다.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Canvas 2D API, `navigator.mediaDevices.getUserMedia`.

## Global Constraints

- 기존 LP 물리값, Pointer Events, 관성 회전, 녹음 연출은 변경하지 않는다.
- 전체 경험은 하나의 고정된 DJ 작업실 장면 안에서 진행한다.
- 카메라 권한은 사용자가 `카메라 켜기`를 누른 뒤에만 요청한다.
- 요청 옵션은 `video: { facingMode: { ideal: 'user' } }, audio: false`로 한다.
- 사진·Canvas 결과는 서버로 전송하지 않고 React 상태와 브라우저 메모리에만 둔다.
- 카메라 미지원·권한 거절·스트림 오류는 `사진 없이 계속하기` fallback으로 이어진다.
- 촬영 완료·취소·재촬영·컴포넌트 해제 시 모든 MediaStream 트랙을 종료한다.
- 기존 dummy playlist와 DOCHI result asset을 유지한다.
- `prefers-reduced-motion` 환경에서는 새 플래시·폴라로이드 이동 애니메이션을 줄인다.

## File Map

- Create: `src/hooks/useCamera.ts` — 카메라 권한, video ref, 캡처, stream 정리
- Create: `src/hooks/useCamera.test.ts` — `getUserMedia`와 stream cleanup 검증
- Create: `src/lib/polaroidComposer.ts` — Canvas 기반 폴라로이드 합성 함수
- Create: `src/lib/polaroidComposer.test.ts` — 사진 있음/없음 합성 검증
- Create: `src/components/CameraCapture.tsx` — 권한 설명, live preview, 촬영/취소/fallback UI
- Create: `src/components/CameraCapture.test.tsx` — 카메라 UI와 권한 오류 fallback
- Create: `src/components/PhotoReview.tsx` — 촬영 사진 확인·재촬영·사용 UI
- Create: `src/components/PhotoReview.test.tsx` — 버튼 전환 검증
- Create: `src/components/PolaroidComposer.tsx` — 합성 상태 표시 및 결과 전달
- Create: `src/components/PolaroidComposer.test.tsx` — 합성 완료 결과 표시
- Create: `src/components/FinalMixtape.tsx` — 폴라로이드가 붙은 최종 테이프와 확대 결과
- Create: `src/components/FinalMixtape.test.tsx` — 라벨/사진/곡 목록·오버레이 검증
- Modify: `src/types.ts` — 새 flow state와 photo data 타입
- Modify: `src/hooks/useDjDochiFlow.ts` — 사진 단계 대화, 상태, actions, cleanup
- Modify: `src/hooks/useDjDochiFlow.test.ts` — 상태 전환 및 fallback 테스트
- Modify: `src/components/DochiRoom.tsx` — 새 오버레이 컴포넌트 연결
- Modify: `src/components/MixtapeOverlay.tsx` — `FinalMixtape` 호환 re-export
- Modify: `src/components/App.test.tsx` — 전체 플로우 회귀 및 사진 단계 흐름
- Modify: `src/styles/dj-dochi.css` — 카메라 패널·플래시·폴라로이드·최종 라벨 스타일

---

### Task 1: Flow 타입과 사진 상태의 실패 테스트

**Files:**
- Modify: `src/types.ts`
- Modify: `src/hooks/useDjDochiFlow.test.ts`

**Interfaces:**
- Add `DochiFlowState` values: `photoPrompt | cameraPreview | photoReview | polaroidMaking | finalTape`.
- Add `PhotoData = string | null` for in-memory data URLs.
- Expose flow fields `capturedPhotoUrl` and `polaroidUrl`.
- Expose actions `acceptPhoto`, `capturePhoto(url)`, `retakePhoto`, `usePhoto`, `skipPhoto`, `completePolaroid(url)`.

- [x] **Step 1: Write the failing state-flow tests**

Add a test that advances a hook from `recording` through `returning` and expects `photoPrompt` with these exact lines:

```ts
expect(result.current.state).toBe('photoPrompt')
expect(result.current.dialogue?.text).toBe('됐다.')
act(() => result.current.actions.advanceDialogue())
expect(result.current.dialogue?.text).toBe('근데 아직 하나 부족해.')
act(() => result.current.actions.advanceDialogue())
expect(result.current.dialogue?.text).toBe('우리 기념사진 하나 찍을래?')
```

Add separate assertions for:

```ts
act(() => result.current.actions.acceptPhoto())
expect(result.current.state).toBe('cameraPreview')
act(() => result.current.actions.capturePhoto('data:image/png;base64,user'))
expect(result.current.state).toBe('photoReview')
act(() => result.current.actions.usePhoto())
expect(result.current.state).toBe('polaroidMaking')
act(() => result.current.actions.completePolaroid('data:image/png;base64,polaroid'))
expect(result.current.state).toBe('finalTape')
```

Add a fallback assertion that `skipPhoto()` reaches `finalTape` with `polaroidUrl === null`, and a restart assertion that both photo URLs are cleared.

- [x] **Step 2: Run the focused test and verify RED**

Run:

```bash
rtk proxy '/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' node_modules/vitest/vitest.mjs run src/hooks/useDjDochiFlow.test.ts
```

Expected: FAIL because the new state values, dialogue track, fields, and actions do not exist yet.

- [x] **Step 3: Add only the type declarations**

Extend the state union and add the photo URL fields/actions as TypeScript contracts. Do not implement transitions in this step.

- [x] **Step 4: Run TypeScript and confirm the expected transition failures remain**

Run the focused test again. It should still fail on the missing transition behavior, proving the test is exercising the flow rather than only the type declarations.

---

### Task 2: Camera hook with explicit permission and cleanup

**Files:**
- Create: `src/hooks/useCamera.ts`
- Create: `src/hooks/useCamera.test.ts`

**Interfaces:**

```ts
export type CameraStatus = 'idle' | 'requesting' | 'ready' | 'error'

export type UseCameraResult = {
  videoRef: RefObject<HTMLVideoElement | null>
  status: CameraStatus
  error: string | null
  startCamera: () => Promise<boolean>
  captureFrame: () => string | null
  stopCamera: () => void
}
```

- [x] **Step 1: Write failing tests for permission options and cleanup**

Stub `navigator.mediaDevices.getUserMedia` with a stream containing a `stop` spy. Assert that `startCamera()` calls it with:

```ts
{ video: { facingMode: { ideal: 'user' } }, audio: false }
```

Assert `videoRef.current.srcObject` receives the stream, `captureFrame()` returns a data URL when the video has dimensions, and `unmount()` calls every track’s `stop()`.

Add a rejected permission test expecting `status === 'error'`, a non-empty Korean fallback message, and no thrown error.

- [x] **Step 2: Run `useCamera.test.ts` and verify RED**

Expected: FAIL because `useCamera.ts` does not exist.

- [x] **Step 3: Implement the minimal hook**

Use a `streamRef` and a `videoRef`. `startCamera` must first reject unsupported environments without throwing, then set `video.srcObject`, call `video.play()` when available, and return `true`. `captureFrame` must create a temporary Canvas, use `drawImage(video, 0, 0, video.videoWidth, video.videoHeight)`, and return `canvas.toDataURL('image/png')`. `stopCamera` must stop all tracks, clear `srcObject`, and reset status to `idle`.

- [x] **Step 4: Run the focused hook tests and confirm GREEN**

Run the same Vitest command for `src/hooks/useCamera.test.ts`. Expected: all permission, capture, error, and cleanup tests pass.

---

### Task 3: Canvas polaroid composition utility

**Files:**
- Create: `src/lib/polaroidComposer.ts`
- Create: `src/lib/polaroidComposer.test.ts`

**Interfaces:**

```ts
export type ComposePolaroidOptions = {
  userPhotoUrl: string | null
  dochiUrl: string
}

export function composePolaroid(options: ComposePolaroidOptions): Promise<string>
```

- [x] **Step 1: Write failing tests for photo and fallback compositions**

Mock image loading and Canvas context methods. Assert that `composePolaroid({ userPhotoUrl: 'user', dochiUrl: 'dochi' })` returns a `data:image/png` URL and draws both image sources, text `DJ DOCHI & YOU`, a frame, and tape decoration. Assert that `userPhotoUrl: null` still returns a data URL and draws the Dochi image plus a fallback photo-area treatment.

- [x] **Step 2: Run the focused test and verify RED**

Expected: FAIL because `polaroidComposer.ts` does not exist.

- [x] **Step 3: Implement Canvas composition**

Create a fixed internal canvas size such as `900 × 1080`, draw a warm paper background, rounded photo frame, cover-cropped user image when present, `dochi-result.webp` in the lower-right, hand-drawn border lines, masking tape polygons, and bottom text. Load images with a Promise and reject only if the Dochi asset cannot load; the caller will use the default sticker fallback if composition cannot complete.

- [x] **Step 4: Run the focused test and confirm GREEN**

Expected: both photo and no-photo composition tests pass without browser APIs or server requests.

---

### Task 4: Camera capture and photo review components

**Files:**
- Create: `src/components/CameraCapture.tsx`
- Create: `src/components/CameraCapture.test.tsx`
- Create: `src/components/PhotoReview.tsx`
- Create: `src/components/PhotoReview.test.tsx`

**Interfaces:**

```ts
type CameraCaptureProps = {
  onCapture: (photoUrl: string) => void
  onCancel: () => void
  onSkip: () => void
}

type PhotoReviewProps = {
  photoUrl: string
  onRetake: () => void
  onUse: () => void
}
```

- [x] **Step 1: Write failing component tests**

Assert the camera panel initially shows a short explanation and `카메라 켜기`, without calling `getUserMedia`. After clicking it, assert that the live preview and `찰칵!` appear. Clicking `찰칵!` must call `onCapture` only after the hook returns a data URL and must show a flash class for the short effect. When `getUserMedia` rejects, assert `사진 없이 계속하기` is visible and `onSkip` works.

For `PhotoReview`, assert the captured image, `다시 찍기`, and `사용하기` buttons and their callbacks.

- [x] **Step 2: Run focused component tests and verify RED**

Expected: FAIL because the components do not exist.

- [x] **Step 3: Implement the components**

Keep the camera explanation visible until the user explicitly clicks `카메라 켜기`. Render the `<video>` with `autoPlay`, `playsInline`, and `muted`. Call `stopCamera()` before `onCapture`, `onCancel`, and unmount. Use a local `isFlashing` state with a short CSS class for `찰칵!`.

- [x] **Step 4: Run focused component tests and confirm GREEN**

Expected: all camera permission, capture, flash, fallback, review, retake, and use tests pass.

---

### Task 5: Flow transitions and Canvas composer component

**Files:**
- Modify: `src/hooks/useDjDochiFlow.ts`
- Modify: `src/hooks/useDjDochiFlow.test.ts`
- Create: `src/components/PolaroidComposer.tsx`
- Create: `src/components/PolaroidComposer.test.tsx`

**Interfaces:**

```ts
type PolaroidComposerProps = {
  userPhotoUrl: string | null
  onComplete: (polaroidUrl: string) => void
}
```

- [x] **Step 1: Add the remaining failing flow tests**

Assert that the existing `recording → returning` timer now enters `photoPrompt` and exposes the three new lines. Assert that `advanceDialogue` on the final prompt line exposes the choice menu without changing the room. Assert that `completePolaroid` stores the data URL and starts the final dialogue `좋아.` followed by `이제 진짜 우리 테이프다.`.

- [x] **Step 2: Run `useDjDochiFlow.test.ts` and verify RED**

Expected: the tests fail because the current `returning` effect still enters the old result state and no photo actions exist.

- [x] **Step 3: Implement the flow transitions**

Change the post-recording timer to enter `photoPrompt` with `PHOTO_PROMPT_LINES`. Add the photo actions and data URL state. `acceptPhoto` enters `cameraPreview`; `capturePhoto` enters `photoReview`; `retakePhoto` clears the capture and returns to `cameraPreview`; `usePhoto` enters `polaroidMaking`; `skipPhoto` clears photo data and goes directly to `finalTape` with the default Dochi sticker; `completePolaroid` stores the result and enters `finalTape` with final dialogue. `restart` clears both URLs. Preserve the existing LP actions and timers.

- [x] **Step 4: Implement `PolaroidComposer`**

On mount, resolve `getDochiAsset('result')`, call `composePolaroid`, and invoke `onComplete` once. Render a small `기념사진 만드는 중...` status while composing and an accessible preview image after completion. If user photo is null, still compose the default sticker version.

- [x] **Step 5: Run focused hook and component tests and confirm GREEN**

Expected: new state transitions and both composition paths pass.

---

### Task 6: Final mixtape UI and fixed-room integration

**Files:**
- Create: `src/components/FinalMixtape.tsx`
- Create: `src/components/FinalMixtape.test.tsx`
- Modify: `src/components/MixtapeOverlay.tsx`
- Modify: `src/components/DochiRoom.tsx`
- Modify: `src/components/App.test.tsx`

**Interfaces:**

```ts
type FinalMixtapeProps = {
  open: boolean
  polaroidUrl: string | null
  onOpen: () => void
  onClose: () => void
}
```

- [x] **Step 1: Write failing final UI tests**

Assert the closed final tape shows the mix title, `DOCHI MIX / CASSETTE 01`, signature, and a polaroid image when a URL is provided. Assert that opening the tape exposes the dummy track list, polaroid, and `닫기`. Assert no-photo fallback still renders a Dochi sticker image.

- [x] **Step 2: Run focused tests and verify RED**

Expected: FAIL because `FinalMixtape` does not exist and `DochiRoom` does not yet render the photo stages.

- [x] **Step 3: Implement `FinalMixtape` and compatibility export**

Move the existing overlay presentation into `FinalMixtape`, add polaroid label markup and the short `final-mixtape--sticking` animation, and make `MixtapeOverlay.tsx` re-export the new component so existing imports remain valid.

- [x] **Step 4: Integrate all overlays in `DochiRoom`**

Render `CameraCapture` for `cameraPreview`, `PhotoReview` for `photoReview`, `PolaroidComposer` for `polaroidMaking`, and `FinalMixtape` for `finalTape/viewingTape`. Show the photo choice menu only after the last `photoPrompt` line. Keep the room background, Dochi, controller, and footer mounted throughout.

- [x] **Step 5: Extend the end-to-end component test**

Drive the existing playlist → LP → recording path to `photoPrompt`, select `기념사진 찍기`, verify the camera explanation, then use the test callback to simulate capture/review/composition and assert `finalTape` and final dialogue. Add a separate click path for `그냥 받을게` and assert the no-photo tape.

- [x] **Step 6: Run focused integration tests and confirm GREEN**

Expected: old playlist/LP/result behavior plus both photo branches pass.

---

### Task 7: Style, accessibility, and reduced-motion behavior

**Files:**
- Modify: `src/styles/dj-dochi.css`
- Modify: component tests where accessibility assertions are needed

- [x] **Step 1: Add failing style-contract assertions**

Assert stable class/test-id hooks for the camera panel, video preview, flash, polaroid, final tape, and fallback controls. Assert the camera preview uses a non-scrolling overlay and the capture control is keyboard reachable.

- [x] **Step 2: Implement room-compatible styles**

Add styles for:

- camera permission explanation and live preview panel
- `찰칵!` white flash overlay
- photo review buttons
- off-white tilted polaroid with hand-drawn border and masking tape
- polaroid drop/attach animation on the tape label
- responsive mobile sizing without replacing the room scene
- `@media (prefers-reduced-motion: reduce)` rules that remove flash/drop transforms while preserving state changes

- [x] **Step 3: Run focused tests and confirm GREEN**

Expected: style hooks and accessibility queries pass.

---

### Task 8: Full verification and browser QA

**Files:**
- Modify: `docs/superpowers/plans/2026-07-20-camera-polaroid.md` to check completed steps after verification

- [x] **Step 1: Run the complete Vitest suite**

Run:

```bash
rtk proxy '/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' node_modules/vitest/vitest.mjs run
```

Expected: all existing and new tests pass with zero failures.

- [x] **Step 2: Run TypeScript and Vite production build**

Run:

```bash
rtk proxy '/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' node_modules/typescript/bin/tsc -b
rtk proxy '/Users/baeseoyeon/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' node_modules/vite/bin/vite.js build
```

Expected: both commands exit successfully.

- [x] **Step 3: Run browser QA on the local app**

Verify on desktop and a mobile viewport:

1. Existing playlist handoff and LP inertia still work.
2. After recording, the three photo prompt lines and two choices appear in the fixed room.
3. Camera explanation appears before any permission request.
4. Camera preview/capture/review works when `getUserMedia` is available.
5. Permission denial or missing `mediaDevices` exposes the fallback and reaches the final tape.
6. The final tape shows the polaroid, title, number, signature, and tracks.
7. Console has no new errors and the camera stream is stopped after leaving the camera stage.

- [x] **Step 4: Leave the app at the initial idle state**

Reload the local URL, reset any temporary viewport override, and keep the user-facing tab open at `http://127.0.0.1:5173/`.
