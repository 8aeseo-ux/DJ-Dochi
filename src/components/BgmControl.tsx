import { useEffect, useState } from 'react'

type BgmControlProps = {
  enabled: boolean
  volume: number
  onToggle: () => void
  onVolumeChange: (volume: number) => void
}

export default function BgmControl({
  enabled,
  volume,
  onToggle,
  onVolumeChange,
}: BgmControlProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open])

  const settingsLabel = open ? '배경음악 설정 닫기' : '배경음악 설정 열기'

  return (
    <div className="bgm-control">
      <button
        className={`bgm-control__trigger ${enabled ? 'bgm-control__trigger--enabled' : 'bgm-control__trigger--muted'}`}
        type="button"
        aria-label={settingsLabel}
        aria-expanded={open}
        title={settingsLabel}
        onClick={() => setOpen((current) => !current)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9.2 17.2V6.6l9-1.8v10.5" />
          <path d="M9.2 8.8l9-1.8" />
          <ellipse cx="6.7" cy="17.3" rx="2.6" ry="2" />
          <ellipse cx="15.7" cy="15.4" rx="2.6" ry="2" />
          {!enabled && <path className="bgm-control__mute-mark" d="m4.2 4.2 15.6 15.6" />}
        </svg>
      </button>

      {open && (
        <div
          className="bgm-control__panel"
          role="group"
          aria-label="배경음악 설정"
        >
          <div className="bgm-control__heading">
            <span>WORKROOM BGM</span>
            <button
              type="button"
              className="bgm-control__power"
              aria-label={enabled ? '배경음악 끄기' : '배경음악 켜기'}
              aria-pressed={enabled}
              onClick={onToggle}
            >
              {enabled ? 'ON' : 'OFF'}
            </button>
          </div>
          <label className="bgm-control__volume">
            <span>VOL</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              aria-label="배경음악 볼륨"
              onChange={(event) => onVolumeChange(Number(event.target.value))}
            />
          </label>
        </div>
      )}
    </div>
  )
}
