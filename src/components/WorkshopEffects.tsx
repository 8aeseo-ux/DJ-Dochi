import type { CSSProperties } from 'react'
import Equalizer from './Equalizer'

type WorkshopEffectsProps = {
  active: boolean
  message: string | null
  energy?: number
  intensity?: number
  nearCompletion?: boolean
  recording?: boolean
}

export default function WorkshopEffects({
  active,
  message,
  energy = 0,
  intensity = 0,
  nearCompletion = false,
  recording = false,
}: WorkshopEffectsProps) {
  const style = {
    '--workshop-energy': energy,
    '--workshop-intensity': intensity,
  } as CSSProperties

  return (
    <div
      className={`workshop-effects ${active ? 'workshop-effects--active' : 'workshop-effects--idle'} ${nearCompletion ? 'workshop-effects--near-complete' : ''} ${recording ? 'workshop-effects--recording' : ''}`.trim()}
      data-testid="workshop-effects"
      style={style}
      aria-live="polite"
    >
      <div className="workshop-effects__light" aria-hidden="true" />
      <span
        className={`workshop-effects__rec ${recording ? 'workshop-effects__rec--on' : ''}`.trim()}
        data-testid="rec-lamp"
        aria-hidden="true"
      >REC</span>
      <div className="workshop-effects__equalizer" role="img" aria-label="작업실 이퀄라이저"><Equalizer compact /></div>
      {active && (
        <div
          className={`workshop-effects__cassette ${recording ? 'workshop-effects__cassette--recording' : ''}`.trim()}
          data-testid="cassette-reels"
          role="img"
          aria-label="카세트 릴"
        >
          <i />
          <i />
        </div>
      )}
      <span className="workshop-effects__message">{message ?? 'DOCHI\'S WORKSHOP / READY'}</span>
    </div>
  )
}
