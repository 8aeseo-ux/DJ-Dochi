import { DUMMY_MIX, DUMMY_TRACKS } from '../data/playlist'
import { getDochiAsset } from '../lib/dochiAssets'
import Panel from './Panel'
import PlatformListenButtons from './PlatformListenButtons'
import RetroButton from './RetroButton'

type FinalMixtapeProps = {
  open: boolean
  polaroidUrl?: string | null
  onOpen: () => void
  onClose: () => void
}

function MemoryLabel({ polaroidUrl }: { polaroidUrl?: string | null }) {
  const stickerUrl = getDochiAsset('result')

  return (
    <div className="final-mixtape__memory-label">
      <span className="screen-eyebrow">DOCHI MIX / CASSETTE 01</span>
      {polaroidUrl ? (
        <img className="final-mixtape__polaroid" src={polaroidUrl} alt="DJ DOCHI & YOU 기념사진" />
      ) : stickerUrl ? (
        <img className="final-mixtape__polaroid final-mixtape__polaroid--sticker" src={stickerUrl} alt="도치 기본 스티커" />
      ) : (
        <div className="final-mixtape__polaroid final-mixtape__polaroid--empty" role="img" aria-label="도치 기본 스티커" />
      )}
      <span className="final-mixtape__signature">DOCHI SIGNED</span>
    </div>
  )
}

export default function FinalMixtape({ open, polaroidUrl = null, onOpen, onClose }: FinalMixtapeProps) {
  if (!open) {
    return (
      <button className="tape-trigger final-mixtape__trigger" type="button" aria-label="믹스테이프 보기" onClick={onOpen}>
        <span className="tape-trigger__label">MIX TAPE</span>
        <span className="tape-trigger__reel tape-trigger__reel--left" aria-hidden="true" />
        <span className="tape-trigger__reel tape-trigger__reel--right" aria-hidden="true" />
        <MemoryLabel polaroidUrl={polaroidUrl} />
        <span className="tape-trigger__hint">CLICK TO OPEN</span>
      </button>
    )
  }

  return (
    <div className="mixtape-overlay final-mixtape" role="dialog" aria-modal="true" aria-label="도치 믹스테이프">
      <button className="mixtape-overlay__backdrop" type="button" aria-label="믹스테이프 배경 닫기" onClick={onClose} />
      <Panel className="mixtape-card mixtape-overlay__card final-mixtape__card" tone="raised">
        <div className="mixtape-overlay__topline">
          <span>DOCHI FM / CASSETTE 01</span>
          <button className="icon-button" type="button" aria-label="믹스테이프 닫기" onClick={onClose}>×</button>
        </div>
        <MemoryLabel polaroidUrl={polaroidUrl} />
        <div className="mixtape-card__title">
          <span className="mixtape-card__sticker">FOR<br />YOU</span>
          <div><span className="screen-eyebrow">YOUR PERSONAL RECEIPT</span><h2>{DUMMY_MIX.title}</h2><p>{DUMMY_MIX.subtitle}</p></div>
        </div>
        <div className="track-list">
          {DUMMY_TRACKS.map((track, index) => (
            <div className="track-row" key={`${track.artist}-${track.title}`}>
              <span className={`track-row__index track-row__index--${track.color}`}>{String(index + 1).padStart(2, '0')}</span>
              <div className="track-row__name"><strong>{track.title}</strong><span>{track.artist}</span></div>
              <span className="track-row__mood">{track.mood}</span>
              <span className="track-row__stat">{track.stat}</span>
            </div>
          ))}
        </div>
        <PlatformListenButtons tracks={DUMMY_TRACKS} />
        <div className="mixtape-overlay__footer">
          <span>MADE WITH A LITTLE TASTE</span>
          <RetroButton variant="ghost" onClick={onClose}>닫기</RetroButton>
        </div>
      </Panel>
    </div>
  )
}
