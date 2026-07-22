import type { ExtractedTrack, PlaylistExtractionResult } from '../types/playlistAnalysis'
import Panel from './Panel'
import RetroButton from './RetroButton'

type EditableTrackField = 'title' | 'artist'

type PlaylistExtractionReviewProps = {
  result: PlaylistExtractionResult
  onTrackChange: (id: string, field: EditableTrackField, value: string) => void
  onDeleteTrack: (id: string) => void
  onAddTrack: () => void
  onRetry: () => void
  onConfirm: () => void
  onChooseImage: () => void
  onChooseText: () => void
}

function TrackEditor({
  track,
  index,
  onTrackChange,
  onDeleteTrack,
}: {
  track: ExtractedTrack
  index: number
  onTrackChange: PlaylistExtractionReviewProps['onTrackChange']
  onDeleteTrack: PlaylistExtractionReviewProps['onDeleteTrack']
}) {
  const trackNumber = index + 1

  return (
    <div className="extraction-track-row">
      <span className="extraction-track-row__index">{String(trackNumber).padStart(2, '0')}</span>
      <label className="extraction-track-row__field">
        <span>곡명</span>
        <input
          aria-label={`${trackNumber}번 곡명`}
          value={track.title}
          onChange={(event) => onTrackChange(track.id, 'title', event.target.value)}
        />
      </label>
      <label className="extraction-track-row__field">
        <span>아티스트</span>
        <input
          aria-label={`${trackNumber}번 아티스트명`}
          value={track.artist}
          onChange={(event) => onTrackChange(track.id, 'artist', event.target.value)}
        />
      </label>
      <button
        className="icon-button extraction-track-row__delete"
        type="button"
        aria-label={`${trackNumber}번 곡 삭제`}
        onClick={() => onDeleteTrack(track.id)}
      >
        ×
      </button>
    </div>
  )
}

export default function PlaylistExtractionReview({
  result,
  onTrackChange,
  onDeleteTrack,
  onAddTrack,
  onRetry,
  onConfirm,
  onChooseImage,
  onChooseText,
}: PlaylistExtractionReviewProps) {
  const canConfirm = result.tracks.length > 0
    && result.tracks.every((track) => track.title.trim() && track.artist.trim())

  return (
    <Panel className="playlist-extraction-review" role="dialog" aria-label="추출한 음악 목록 확인">
      <div className="playlist-extraction-review__topline">
        <span className="screen-eyebrow">DOCHI&apos;S DESK / OCR CHECK</span>
        <span>{result.sourceApp ?? 'UNKNOWN SOURCE'}</span>
      </div>

      <div className="playlist-extraction-review__heading">
        <span className="panel-intro__number">✓</span>
        <div>
          <h2>내가 이렇게 읽었어.</h2>
          <p>틀린 게 있으면 곡명과 아티스트를 바로 고쳐줘.</p>
        </div>
      </div>

      {result.warnings.length > 0 && (
        <ul className="extraction-warnings" aria-label="이미지 분석 안내">
          {result.warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      )}

      {result.tracks.length > 0 ? (
        <>
          <div className="extraction-track-list">
            {result.tracks.map((track, index) => (
              <TrackEditor
                key={track.id}
                track={track}
                index={index}
                onTrackChange={onTrackChange}
                onDeleteTrack={onDeleteTrack}
              />
            ))}
          </div>
          <div className="playlist-extraction-review__secondary-actions">
            <RetroButton variant="ghost" onClick={onAddTrack}>곡 직접 추가</RetroButton>
            <RetroButton variant="ghost" onClick={onRetry}>이미지 다시 분석</RetroButton>
          </div>
          <div className="playlist-extraction-review__actions">
            <span>확인한 목록은 다음 믹스 단계에만 사용돼요.</span>
            <RetroButton onClick={onConfirm} disabled={!canConfirm}>이 목록이 맞아</RetroButton>
          </div>
        </>
      ) : (
        <div className="extraction-empty-state">
          <strong>읽을 수 있는 곡이 없어요.</strong>
          <p>글자가 더 크게 보이는 캡처를 선택하거나 목록을 직접 붙여넣어 주세요.</p>
          <div className="extraction-empty-state__actions">
            <RetroButton onClick={onChooseImage}>다른 이미지 올리기</RetroButton>
            <RetroButton variant="secondary" onClick={onChooseText}>음악 목록 붙여넣기</RetroButton>
            <RetroButton variant="ghost" onClick={onRetry}>같은 이미지 다시 분석</RetroButton>
          </div>
        </div>
      )}
    </Panel>
  )
}
