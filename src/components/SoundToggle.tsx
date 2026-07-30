type SoundToggleProps = {
  enabled: boolean
  onToggle: () => void
}

export default function SoundToggle({ enabled, onToggle }: SoundToggleProps) {
  const label = enabled ? '대화 효과음 끄기' : '대화 효과음 켜기'

  return (
    <button
      className={`sfx-toggle ${enabled ? 'sfx-toggle--enabled' : 'sfx-toggle--muted'}`}
      type="button"
      aria-label={label}
      aria-pressed={enabled}
      title={label}
      onClick={onToggle}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.3 9.4h3.2l4-3.5v12.2l-4-3.5H4.3z" />
        {enabled ? (
          <>
            <path d="M15 9.1c.9.7 1.3 1.7 1.3 2.9s-.4 2.2-1.3 2.9" />
            <path d="M17.7 6.8c1.5 1.3 2.3 3 2.3 5.2s-.8 3.9-2.3 5.2" />
          </>
        ) : (
          <>
            <path d="m15.2 9 4.2 5.8" />
            <path d="m19.4 9-4.2 5.8" />
          </>
        )}
      </svg>
    </button>
  )
}

