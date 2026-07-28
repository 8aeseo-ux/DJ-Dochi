import { useState } from 'react'
import type { MusicPlatform } from '../types'
import { MUSIC_PLATFORM_DEFINITIONS, resolvePlatformTrackLink, type PlatformListenableTrack } from '../lib/musicPlatforms'

type PlatformListenButtonsProps = {
  tracks: readonly PlatformListenableTrack[]
}

export default function PlatformListenButtons({ tracks }: PlatformListenButtonsProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<MusicPlatform | null>(null)

  const handleListen = (platform: MusicPlatform) => {
    setSelectedPlatform((current) => (current === platform ? null : platform))
  }

  const selectedDefinition = MUSIC_PLATFORM_DEFINITIONS.find(
    (definition) => definition.id === selectedPlatform,
  )

  return (
    <section className="platform-listen" aria-label="음악 플랫폼에서 듣기">
      <div className="platform-listen__heading">
        <span className="screen-eyebrow">LISTEN LATER</span>
        <span>{tracks.length} TRACKS / APP READY</span>
      </div>
      <div className="platform-listen__buttons" role="group" aria-label="음악 앱에서 듣기">
        {MUSIC_PLATFORM_DEFINITIONS.map((definition) => (
          <button
            className={`platform-listen__button platform-listen__button--${definition.id}`}
            data-platform={definition.id}
            key={definition.id}
            type="button"
            aria-label={`${definition.label}에서 듣기`}
            aria-pressed={selectedPlatform === definition.id}
            onClick={() => handleListen(definition.id)}
          >
            <span className="platform-listen__mark" aria-hidden="true">{definition.shortLabel}</span>
            <span className="platform-listen__label" aria-hidden="true">{definition.label}에서 듣기</span>
            <span className="platform-listen__arrow" aria-hidden="true">↗</span>
          </button>
        ))}
      </div>
      {selectedPlatform && selectedDefinition && (
        <div
          className="platform-listen__track-list"
          role="region"
          aria-label={`${selectedDefinition.label} 추천곡`}
        >
          <div className="platform-listen__track-header">
            <strong>{selectedDefinition.label}</strong>
            <span>곡을 누르면 새 창에서 열려요</span>
          </div>
          {tracks.map((track, index) => {
            const link = resolvePlatformTrackLink(selectedPlatform, track)
            const action = link.isDirect ? '듣기' : '찾기'

            return (
              <a
                className="platform-listen__track-link"
                href={link.href}
                key={`${selectedPlatform}-${track.artist}-${track.title}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`${selectedDefinition.label}에서 ${track.title} ${action}`}
              >
                <span className="platform-listen__track-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="platform-listen__track-copy">
                  <strong>{track.title}</strong>
                  <span>{track.artist}</span>
                </span>
                <span className="platform-listen__track-action">{action} ↗</span>
              </a>
            )
          })}
          <p className="platform-listen__note">
            정확한 플랫폼 곡 ID가 없는 추천곡은 앱의 검색 결과로 연결됩니다.
          </p>
        </div>
      )}
    </section>
  )
}
