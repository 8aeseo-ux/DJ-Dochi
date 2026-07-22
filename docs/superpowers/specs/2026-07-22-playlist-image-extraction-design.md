# DJ DOCHI Playlist Image Extraction Design

## Goal

Add a secure playlist screenshot extraction flow that reads visible track titles and artists, lets the user correct the extracted list, and then hands the confirmed list to the existing LP interaction. Recommendation generation and music-platform catalog matching remain out of scope.

## Scope

The feature starts when an image has been selected in the existing playlist input panel and the user presses `도치에게 건네기`. It ends when the user confirms the editable extraction result. The existing LP, recording, camera, polaroid, and dummy final-mixtape flow remains unchanged after confirmation.

Text input continues through the existing handoff path. Image extraction failures never fall through to `DUMMY_TRACKS` or `DUMMY_MIX`.

## Architecture

The browser sends the selected `File` as multipart `FormData` to `/api/extract-playlist`. A Vercel Node Function validates the request in memory, converts the image to a data URL, and sends it to a vision-capable OpenAI Responses API model. The API key is read only from `process.env.OPENAI_API_KEY`.

Runtime response validation is shared between the server boundary and browser service. The flow hook owns asynchronous state, retries, editing actions, and transition to the existing handoff. Layout components receive only data and callbacks.

## Data Contract

```ts
type ExtractedTrack = {
  id: string
  title: string
  artist: string
  album: string
  confidence: number
}

type PlaylistExtractionResult = {
  sourceApp: string | null
  tracks: ExtractedTrack[]
  warnings: string[]
}
```

The model returns visible track fields but does not choose IDs. The server trims fields, clamps confidence to `0..1`, removes case-insensitive duplicate `title + artist` pairs, and assigns deterministic `track-001` IDs. Missing or unreadable tracks produce warnings instead of invented values.

## State Flow

```text
choosingInput(image)
  -> extracting
  -> extractionReview
  -> receivingInput
  -> working
```

Failures use `extractionError`. Retry returns to `extracting` with the same in-memory `File`. Choosing another image or text returns to the existing input choices. Confirming requires at least one row with a non-empty title and artist.

During `extracting`, the room remains mounted and shows `어디 보자.` followed by `곡 이름부터 읽어볼게.` During review it shows `내가 이렇게 읽었어.` and `틀린 게 있으면 고쳐줘.`

## Review UI

`PlaylistExtractionReview` is a controlled room overlay. Each row exposes title and artist inputs plus a delete action. The panel supports adding a blank row, re-running the current image, confirming the edited list, and returning to image/text input when no tracks were found.

The component contains no network calls and no flow transitions beyond invoking callbacks.

## Validation and Error Handling

- Supported MIME types: `image/png`, `image/jpeg`, `image/webp`.
- Maximum file size: 4 MiB, below Vercel Functions' 4.5 MB request/response payload limit.
- Browser request timeout: 45 seconds via `AbortController`.
- Client and server both validate type and size.
- Error codes distinguish unsupported type, oversized file, timeout, network failure, malformed JSON, missing API key, and upstream analysis failure.
- A successful response may contain zero tracks; the review panel then displays warnings and alternate input actions.

## Privacy

The image is held only in browser memory and the server function's request memory. It is not written to a database or file. Raw bytes and full Base64 content are never logged. The existing object URL cleanup remains active and the preview URL is released when the panel closes.

The UI states: `업로드한 이미지는 분석에만 사용되며 DJ DOCHI 서버에 저장되지 않습니다.`

## OpenAI Integration

Use the Responses API with an image input and strict JSON-schema text output. The server uses a cost-conscious current vision-capable model and `store: false`. The prompt explicitly requires visible information only, no guessing, separate title/artist fields, warnings for ambiguity, and an empty track array when no playlist rows are readable.

## Testing

- Service tests verify multipart `FormData`, response validation, timeout, and network errors.
- Hook tests verify successful storage, error state, retry, editing, deletion, addition, and confirmation.
- Component tests verify editable rows and empty-state alternate input actions.
- Input tests verify unsupported formats and oversized files are rejected before upload.
- API tests mock the OpenAI client and verify request validation, normalization, and JSON-only responses.
- Final verification runs the complete Vitest suite, TypeScript build, and Vite production build.

## Out of Scope

- Taste-profile or recommendation generation
- Apple Music, Spotify, or YouTube Music catalog verification
- Replacing the final dummy mixtape
- Image persistence, user accounts, analytics, saving, or sharing
