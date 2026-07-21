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
  const curatedLinkMatrix = [
    {
      track: DUMMY_TRACKS[0],
      links: {
        spotify: 'https://open.spotify.com/track/1eyzqe2QqGZUmfcPZtrIyt',
        appleMusic: 'https://music.apple.com/kr/album/midnight-city/1674216738?i=1674217008',
        youtubeMusic: 'https://music.youtube.com/watch?v=dX3k_QDnzHE',
      },
    },
    {
      track: DUMMY_TRACKS[1],
      links: {
        spotify: 'https://open.spotify.com/track/7rU6Iebxzlvqy5t857bKFq',
        appleMusic: 'https://music.apple.com/kr/album/plastic-love/1541673202?i=1541673399',
        youtubeMusic: 'https://music.youtube.com/watch?v=T_lC2O1oIew',
      },
    },
    {
      track: DUMMY_TRACKS[2],
      links: {
        spotify: 'https://open.spotify.com/track/705r2EzlkUkDoabGfJdzUe',
        appleMusic: 'https://music.apple.com/kr/album/space-song/1247704667?i=1247704673',
        youtubeMusic: 'https://music.youtube.com/watch?v=RBtlPT23PTM',
      },
    },
    {
      track: DUMMY_TRACKS[3],
      links: {
        spotify: 'https://open.spotify.com/track/69kOkLUCkxIZYexIgSG8rq',
        appleMusic: 'https://music.apple.com/kr/album/get-lucky/617154241?i=617154366',
        youtubeMusic: 'https://music.youtube.com/watch?v=5NV6Rdv1a3I',
      },
    },
  ] as const

  it.each(curatedLinkMatrix.flatMap(({ track, links }) =>
    (Object.entries(links) as [keyof typeof links, string][]).map(([platform, href]) => [track, platform, href] as const),
  ))('resolves %s on %s to its curated exact song page', (track, platform, href) => {
    expect(resolvePlatformTrackLink(platform, track)).toEqual({ href, isDirect: true })
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

  it('trims valid provider IDs and Apple Music storefront URLs before returning direct links', () => {
    const resolvedTrack: Track = {
      ...DUMMY_TRACKS[0],
      platforms: {
        spotify: { id: '  1eyzqe2QqGZUmfcPZtrIyt  ', url: null },
        appleMusic: {
          id: '123456789',
          url: '  https://music.apple.com/kr/song/midnight-city/123456789  ',
        },
        youtubeMusic: { id: '  dX3k_QDnzHE  ', url: null },
      },
    }

    expect(resolvePlatformTrackLink('spotify', resolvedTrack)).toEqual({
      href: 'https://open.spotify.com/track/1eyzqe2QqGZUmfcPZtrIyt',
      isDirect: true,
    })
    expect(resolvePlatformTrackLink('appleMusic', resolvedTrack)).toEqual({
      href: 'https://music.apple.com/kr/song/midnight-city/123456789',
      isDirect: true,
    })
    expect(resolvePlatformTrackLink('youtubeMusic', resolvedTrack)).toEqual({
      href: 'https://music.youtube.com/watch?v=dX3k_QDnzHE',
      isDirect: true,
    })
  })

  it.each([
    ['spotify', { id: '', url: null }],
    ['spotify', { id: '   ', url: null }],
    ['spotify', { id: 'not-a-spotify-id', url: null }],
    ['spotify', { id: null, url: 'http://open.spotify.com/track/1eyzqe2QqGZUmfcPZtrIyt' }],
    ['spotify', { id: null, url: 'https://spotify.com/track/1eyzqe2QqGZUmfcPZtrIyt' }],
    ['appleMusic', { id: null, url: '   ' }],
    ['appleMusic', { id: null, url: 'not-a-url' }],
    ['appleMusic', { id: null, url: 'https://open.spotify.com/track/1eyzqe2QqGZUmfcPZtrIyt' }],
    ['youtubeMusic', { id: '   ', url: null }],
    ['youtubeMusic', { id: 'dX3k_QDnzHE0', url: null }],
    ['youtubeMusic', { id: null, url: '' }],
    ['youtubeMusic', { id: null, url: 'ftp://music.youtube.com/watch?v=dX3k_QDnzHE' }],
    ['youtubeMusic', { id: null, url: 'https://youtube.com/watch?v=dX3k_QDnzHE' }],
  ] as const)(
    'falls back to %s search for invalid metadata',
    (platform, reference) => {
      const track: Track = {
        ...makeUnresolvedTrack(),
        platforms: {
          ...makeUnresolvedTrack().platforms,
          [platform]: reference,
        },
      }

      expect(resolvePlatformTrackLink(platform, track)).toEqual({
        href: buildPlatformSearchUrl(platform, track),
        isDirect: false,
      })
    },
  )
})
