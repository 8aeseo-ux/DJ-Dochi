import { describe, expect, it } from 'vitest'
import { DUMMY_TRACKS } from '../data/playlist'
import type { Track } from '../types'
import { buildPlatformSearchUrl, resolvePlatformTrackLink } from './musicPlatforms'

function makeUnresolvedTrack(): Track {
  return {
    ...DUMMY_TRACKS[0],
    title: 'Future Song',
    artist: 'Future Artist',
    platforms: {
      spotify: { id: null, url: null },
      appleMusic: { id: null, url: null },
      youtubeMusic: { id: null, url: null },
    },
  }
}

describe('music platform metadata', () => {
  it('resolves the curated mixtape fixtures to exact song pages', () => {
    expect(resolvePlatformTrackLink('spotify', DUMMY_TRACKS[0])).toEqual({
      href: 'https://open.spotify.com/track/1eyzqe2QqGZUmfcPZtrIyt',
      isDirect: true,
    })
    expect(resolvePlatformTrackLink('appleMusic', DUMMY_TRACKS[1])).toEqual({
      href: 'https://music.apple.com/kr/album/plastic-love/1541673202?i=1541673399',
      isDirect: true,
    })
    expect(resolvePlatformTrackLink('youtubeMusic', DUMMY_TRACKS[2])).toEqual({
      href: 'https://music.youtube.com/watch?v=RBtlPT23PTM',
      isDirect: true,
    })
  })

  it('falls back to a provider search when a catalog ID has not been resolved yet', () => {
    const unresolvedTrack = makeUnresolvedTrack()

    expect(buildPlatformSearchUrl('spotify', unresolvedTrack)).toBe(
      'https://open.spotify.com/search/Future%20Artist%20Future%20Song',
    )
    expect(buildPlatformSearchUrl('appleMusic', unresolvedTrack)).toBe(
      'https://music.apple.com/kr/search?term=Future%20Artist%20Future%20Song',
    )
    expect(buildPlatformSearchUrl('youtubeMusic', unresolvedTrack)).toBe(
      'https://music.youtube.com/search?q=Future%20Artist%20Future%20Song',
    )

    expect(resolvePlatformTrackLink('spotify', unresolvedTrack)).toEqual({
      href: 'https://open.spotify.com/search/Future%20Artist%20Future%20Song',
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
