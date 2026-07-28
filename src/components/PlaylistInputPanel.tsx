import { useRef } from 'react'
import type { ChangeEvent } from 'react'
import type { InputMode, PlaylistInput } from '../types'
import Panel from './Panel'
import RetroButton from './RetroButton'

type PlaylistInputPanelProps = {
  mode: Exclude<InputMode, null>
  input: PlaylistInput
  hasInput: boolean
  inputError?: string | null
  onImageSelect: (file: File) => void
  onTextChange: (value: string) => void
  onHandoff: () => void
  onDelete: () => void
  onClose: () => void
}

export default function PlaylistInputPanel({
  mode,
  input,
  hasInput,
  inputError = null,
  onImageSelect,
  onTextChange,
  onHandoff,
  onDelete,
  onClose,
}: PlaylistInputPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lineCount = input.pastedText ? input.pastedText.split(/\r?\n/).length : 0

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) onImageSelect(file)
    event.target.value = ''
  }

  const openFilePicker = () => fileInputRef.current?.click()

  return (
    <Panel className={`playlist-input-panel playlist-input-panel--${mode}`} role="dialog" aria-label="플레이리스트 입력">
      <div className="playlist-input-panel__topline">
        <span className="screen-eyebrow">DOCHI&apos;S DESK / INPUT</span>
        <button className="icon-button" type="button" aria-label="입력 패널 닫기" onClick={onClose}>×</button>
      </div>

      {mode === 'image' ? (
        <div className="playlist-input-panel__content">
          <div className="playlist-input-panel__heading">
            <span className="panel-intro__number">A</span>
            <div><h2>캡처를 보여줘.</h2><p>먼저 사진을 확인한 뒤 도치에게 건네주세요.</p></div>
          </div>
          {input.imageUrl ? (
            <figure className="room-image-preview">
              <img src={input.imageUrl} alt="선택한 플레이리스트 캡처" />
              <figcaption><span>{input.imageFile?.name}</span><span>LOCAL PREVIEW</span></figcaption>
            </figure>
          ) : (
            <button className="file-dropzone" type="button" onClick={openFilePicker}>
              <span className="file-dropzone__icon" aria-hidden="true">▧</span>
              <strong>플레이리스트 캡처 선택</strong>
              <span>이미지 파일을 고르면 이 자리에서 미리볼 수 있어요.</span>
            </button>
          )}
          <div className="playlist-input-panel__actions">
            <RetroButton variant="ghost" onClick={openFilePicker}>{input.imageUrl ? '다시 선택' : '파일 선택'}</RetroButton>
            {input.imageUrl && <RetroButton variant="ghost" onClick={onDelete}>삭제</RetroButton>}
            <RetroButton onClick={onHandoff} disabled={!hasInput}>도치에게 건네기</RetroButton>
          </div>
          {inputError && <p className="playlist-input-panel__error" role="alert">{inputError}</p>}
          <p className="playlist-input-panel__privacy">업로드한 이미지는 분석에만 사용되며 DJ DOCHI 서버에 저장되지 않습니다.</p>
        </div>
      ) : (
        <div className="playlist-input-panel__content">
          <div className="playlist-input-panel__heading">
            <span className="panel-intro__number">B</span>
            <div><h2>목록을 적어줘.</h2><p>듣던 곡을 그대로 붙여넣거나 자유롭게 수정해도 좋아.</p></div>
          </div>
          <label className="textarea-label" htmlFor="playlist-text">음악 목록 <span>PASTE / EDIT</span></label>
          <textarea
            id="playlist-text"
            aria-label="음악 목록"
            value={input.pastedText}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder={'M83 — Midnight City\nBeach House — Space Song\n...'}
            spellCheck="false"
          />
          <div className="textarea-meta"><span>{lineCount} TRACK{lineCount === 1 ? '' : 'S'}</span><span>YOU CAN STILL EDIT</span></div>
          <div className="playlist-input-panel__actions">
            <RetroButton variant="ghost" onClick={onDelete}>삭제</RetroButton>
            <RetroButton onClick={onHandoff} disabled={!hasInput}>도치에게 건네기</RetroButton>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        id="playlist-file"
        className="visually-hidden"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="플레이리스트 캡처 파일"
        onChange={handleFileChange}
      />
    </Panel>
  )
}
