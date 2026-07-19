import type { CSSProperties } from 'react'
import type { DochiPose } from '../types'
import type { DjDochiFlow } from '../hooks/useDjDochiFlow'
import ChoiceMenu from './ChoiceMenu'
import CameraCapture from './CameraCapture'
import DialogueBox from './DialogueBox'
import DochiCharacter from './DochiCharacter'
import DjController from './DjController'
import Equalizer from './Equalizer'
import FinalMixtape from './FinalMixtape'
import PlaylistInputPanel from './PlaylistInputPanel'
import PhotoReview from './PhotoReview'
import PolaroidComposer from './PolaroidComposer'
import VinylInteraction from './VinylInteraction'
import WorkshopEffects from './WorkshopEffects'

type DochiRoomProps = {
  flow: DjDochiFlow
}

function getPose(state: DjDochiFlow['state']): DochiPose {
  if (state === 'idle') return 'idle'
  if (
    state === 'returning'
    || state === 'photoPrompt'
    || state === 'cameraPreview'
    || state === 'photoReview'
    || state === 'polaroidMaking'
    || state === 'finalTape'
    || state === 'givingTape'
    || state === 'viewingTape'
  ) return 'result'
  if (state === 'noticed' || state === 'talking') return 'surprised'
  return 'thinking'
}

function getMotion(state: DjDochiFlow['state']): 'groove' | 'still' | 'walk-out' | 'walk-in' | 'away' {
  if (state === 'idle') return 'groove'
  if (state === 'leaving') return 'walk-out'
  if (state === 'working' || state === 'recordingIntro') return 'groove'
  if (state === 'returning') return 'walk-in'
  return 'still'
}

export default function DochiRoom({ flow }: DochiRoomProps) {
  const {
    state,
    dialogue,
    dialogueKey,
    inputMode,
    input,
    hasInput,
    workMessage,
    spinEnergy,
    spinIntensity,
    spinReaction,
    isOverdrive,
    capturedPhotoUrl,
    polaroidUrl,
    actions,
  } = flow
  const isMixing = state === 'working'
    || state === 'recordingIntro'
    || state === 'needleDropping'
    || state === 'recording'
  const isRecording = state === 'recording'
  const vinylPhase = state === 'needleDropping' ? 'needle' : isRecording ? 'recording' : 'spin'
  const isTapeAvailable = state === 'finalTape' || state === 'givingTape' || state === 'viewingTape'
  const isLastDialogueLine = dialogue !== null && dialogue.index === dialogue.total - 1
  const isPhotoPromptChoice = state === 'photoPrompt' && isLastDialogueLine
  const isFinalTapeChoice = state === 'finalTape' && isLastDialogueLine
  const roomStyle = {
    '--mix-energy': spinEnergy,
    '--mix-intensity': spinIntensity,
  } as CSSProperties

  return (
    <div className="app-shell dochi-room">
      <div className="ambient ambient--coral" aria-hidden="true" />
      <div className="ambient ambient--violet" aria-hidden="true" />

      <div className="stage-frame">
        <header className="topbar">
          <div className="brand-lockup">
            <span className="brand-lockup__mark" aria-hidden="true">✦</span>
            <span className="brand-lockup__name">DJ DOCHI</span>
            <span className="brand-lockup__tag">AI HEDGEHOG DJ</span>
          </div>
          <div className="topbar__status"><span className="status-dot" aria-hidden="true" /> ROOM 01 / ON AIR</div>
        </header>

        <main className={`room-stage room-stage--${state} ${isOverdrive ? 'room-stage--overdrive' : ''}`.trim()} style={roomStyle}>
          <div className="room-wall-mark" aria-hidden="true"><span>DOCHI</span><span>FM</span></div>
          <div className="room-grid-glow" aria-hidden="true" />

          <section className="room-workbench" aria-label="도치의 DJ 작업대">
            <div className="room-speaker room-speaker--left" aria-hidden="true"><i /><i /><i /></div>
            <div className="room-console" aria-hidden="true"><span>DD / 001</span><span>LOCAL MIX</span><i /><i /><i /></div>
            <div className="room-speaker room-speaker--right" aria-hidden="true"><i /><i /><i /></div>
            <Equalizer compact />
          </section>

          <WorkshopEffects
            active={isMixing}
            message={workMessage}
            energy={spinEnergy}
            intensity={spinIntensity}
            nearCompletion={spinEnergy >= 0.8}
            recording={isRecording}
          />

          <div className={`room-character room-character--${state}`}>
            <DochiCharacter
              pose={getPose(state)}
              size="hero"
              motion={getMotion(state)}
              visible={state !== 'leaving'}
              interactive={state === 'idle'}
              onClick={actions.notice}
            />
          </div>
          <div className="room-controller-layer">
            <DjController />
          </div>
          {state === 'working' && spinReaction && (
            <div
              className={`spin-reaction ${isOverdrive ? 'spin-reaction--overdrive' : ''}`.trim()}
              role="status"
              aria-label="도치의 회전 반응"
            >
              {spinReaction}
            </div>
          )}
          {isMixing && (
            <VinylInteraction
              phase={vinylPhase}
              onComplete={actions.completeSpin}
              onSpinEnergy={actions.updateSpinEnergy}
              onSpinMetrics={actions.updateSpinMetrics}
            />
          )}
          {state === 'idle' && <span className="idle-hint">도치를 눌러보세요</span>}

          {dialogue && (
            <DialogueBox line={dialogue.text} dialogueKey={dialogueKey} onAdvance={actions.advanceDialogue} />
          )}

          {state === 'choosingInput' && !inputMode && (
            <ChoiceMenu
              items={[
                { label: '플레이리스트 캡처 보여주기', onSelect: actions.chooseImage },
                { label: '음악 목록 적어주기', onSelect: actions.chooseText, variant: 'secondary' },
              ]}
            />
          )}

          {inputMode && (
            <PlaylistInputPanel
              mode={inputMode}
              input={input}
              hasInput={hasInput}
              onImageSelect={actions.selectImage}
              onTextChange={actions.updateText}
              onHandoff={actions.handoff}
              onDelete={actions.deleteInput}
              onClose={actions.closeInput}
            />
          )}

          {isPhotoPromptChoice && (
            <ChoiceMenu
              items={[
                { label: '기념사진 찍기', onSelect: actions.acceptPhoto },
                { label: '그냥 받을게', onSelect: actions.skipPhoto, variant: 'secondary' },
              ]}
            />
          )}

          {state === 'cameraPreview' && (
            <CameraCapture
              onCapture={actions.capturePhoto}
              onCancel={actions.skipPhoto}
              onSkip={actions.skipPhoto}
            />
          )}

          {state === 'photoReview' && capturedPhotoUrl && (
            <PhotoReview
              photoUrl={capturedPhotoUrl}
              onRetake={actions.retakePhoto}
              onUse={actions.usePhoto}
            />
          )}

          {state === 'polaroidMaking' && (
            <PolaroidComposer userPhotoUrl={capturedPhotoUrl} onComplete={actions.completePolaroid} />
          )}

          {isFinalTapeChoice && (
            <ChoiceMenu
              items={[
                { label: '믹스테이프 열기', onSelect: actions.openTape },
                { label: '다시 부탁하기', onSelect: actions.restart, variant: 'secondary' },
              ]}
            />
          )}

          {isTapeAvailable && (
            <FinalMixtape
              open={state === 'viewingTape'}
              polaroidUrl={polaroidUrl}
              onOpen={actions.openTape}
              onClose={actions.closeTape}
            />
          )}

          <div className="room-footer" aria-hidden="true"><span>PLAYLIST TASTE LAB</span><span>NO API / NO OCR / LOCAL PROTOTYPE</span></div>
        </main>
      </div>
    </div>
  )
}
