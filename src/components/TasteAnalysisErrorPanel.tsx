import Panel from './Panel'
import RetroButton from './RetroButton'
import type { MixtapeAnalysisIssue } from '../types/mixtapeAnalysis'

type TasteAnalysisErrorPanelProps = {
  issue: MixtapeAnalysisIssue
  onRetry: () => void
  onChooseImage: () => void
  onChooseText: () => void
}

export default function TasteAnalysisErrorPanel({
  issue,
  onRetry,
  onChooseImage,
  onChooseText,
}: TasteAnalysisErrorPanelProps) {
  const heading = issue.stage === 'taste'
    ? '취향을 읽지 못했어.'
    : '취향은 읽었는데, 확인되는 곡을 충분히 찾지 못했어.'
  const message = issue.stage === 'curation'
    ? '곡을 고르는 중에 문제가 생겼어. 다시 골라볼게.'
    : issue.message

  return (
    <Panel className="taste-analysis-error" role="alert" aria-label="취향 분석 오류">
      <span className="screen-eyebrow">DOCHI TASTE / ERROR</span>
      <h2>{heading}</h2>
      <p>{message}</p>
      <div className="taste-analysis-error__actions">
        <RetroButton onClick={onRetry}>다시 분석하기</RetroButton>
        <RetroButton variant="secondary" onClick={onChooseImage}>다른 이미지 선택</RetroButton>
        <RetroButton variant="ghost" onClick={onChooseText}>음악 목록 붙여넣기</RetroButton>
      </div>
    </Panel>
  )
}
