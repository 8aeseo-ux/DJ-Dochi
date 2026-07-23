import Panel from './Panel'
import RetroButton from './RetroButton'

type TasteAnalysisErrorPanelProps = {
  message: string
  onRetry: () => void
  onChooseImage: () => void
  onChooseText: () => void
}

export default function TasteAnalysisErrorPanel({
  message,
  onRetry,
  onChooseImage,
  onChooseText,
}: TasteAnalysisErrorPanelProps) {
  return (
    <Panel className="taste-analysis-error" role="alert" aria-label="취향 분석 오류">
      <span className="screen-eyebrow">DOCHI TASTE / ERROR</span>
      <h2>취향을 읽지 못했어.</h2>
      <p>{message}</p>
      <div className="taste-analysis-error__actions">
        <RetroButton onClick={onRetry}>다시 분석하기</RetroButton>
        <RetroButton variant="secondary" onClick={onChooseImage}>다른 이미지 선택</RetroButton>
        <RetroButton variant="ghost" onClick={onChooseText}>음악 목록 붙여넣기</RetroButton>
      </div>
    </Panel>
  )
}
