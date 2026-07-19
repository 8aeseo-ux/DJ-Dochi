import Panel from './Panel'
import RetroButton from './RetroButton'

type PhotoReviewProps = {
  photoUrl: string
  onRetake: () => void
  onUse: () => void
}

export default function PhotoReview({ photoUrl, onRetake, onUse }: PhotoReviewProps) {
  return (
    <div className="photo-review" data-testid="photo-review" role="dialog" aria-modal="true" aria-label="촬영한 사진 확인">
      <Panel className="photo-review__panel" tone="raised">
        <div className="camera-capture__topline">
          <span>CHECK THE SHOT</span>
        </div>
        <img className="photo-review__image" src={photoUrl} alt="촬영한 기념사진 미리보기" />
        <p className="photo-review__caption">이 사진으로 도치와 폴라로이드를 만들까요?</p>
        <div className="photo-review__actions">
          <RetroButton variant="ghost" onClick={onRetake}>다시 찍기</RetroButton>
          <RetroButton onClick={onUse}>이 사진 사용하기</RetroButton>
        </div>
      </Panel>
    </div>
  )
}
