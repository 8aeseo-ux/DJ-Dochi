import { describe, expect, it } from 'vitest'
import { DUMMY_TRACKS } from '../data/playlist'
import type { Track } from '../types'
import { buildPlatformSearchUrl, resolvePlatformTrackLink } from './musicPlatforms'

describe('music platform metadata', () => {
  it('keeps an extensible provider reference on every recommended track', () => {
    expect(DUMMY_TRACKS[0].platforms).toEqual({
      spotify: { id: null, url: null },
      appleMusic: { id: null, url: null },
      youtubeMusic: { id: null, url: null },
    })
  })

  it('falls back to a provider search when a catalog ID has not been resolved yet', () => {
    expect(buildPlatformSearchUrl('spotify', DUMMY_TRACKS[0])).toBe(
      'https://open.spotify.com/search/M83%20Midnight%20City',
    )
    expect(buildPlatformSearchUrl('appleMusic', DUMMY_TRACKS[0])).toBe(
      'https://music.apple.com/kr/search?term=M83%20Midnight%20City',
    )
    expect(buildPlatformSearchUrl('youtubeMusic', DUMMY_TRACKS[0])).toBe(
      'https://music.youtube.com/search?q=M83%20Midnight%20City',
    )

    expect(resolvePlatformTrackLink('spotify', DUMMY_TRACKS[0])).toEqual({
      href: 'https://open.spotify.com/search/M83%20Midnight%20City',
      isDirect: false,
    })
  })

  it('prefers exact catalog links once provider IDs or URLs are available', () => {
    const resolvedTrack: Track = {
      ...DUMMY_TRACKS[0],
      platforms: {
        spotify: { id: 'spotify-track-id', url: null },
        appleMusic: {
          id: 'apple-song-id',
          url: 'https://music.apple.com/kr/song/midnight-city/123456789',
        },
        youtubeMusic: { id: 'youtube-video-id', url: null },
      },
    }

    expect(resolvePlatformTrackLink('spotify', resolvedTrack)).toEqual({
      href: 'https://open.spotify.com/track/spotify-track-id',
      isDirect: true,
    })
    expect(resolvePlatformTrackLink('appleMusic', resolvedTrack)).toEqual({
      href: 'https://music.apple.com/kr/song/midnight-city/123456789',
      isDirect: true,
    })
    expect(resolvePlatformTrackLink('youtubeMusic', resolvedTrack)).toEqual({
      href: 'https://music.youtube.com/watch?v=youtube-video-id',
      isDirect: true,
    })
  })
})
