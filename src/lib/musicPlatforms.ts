import type { MusicPlatform, Track } from '../types'

export type MusicPlatformDefinition = {
  id: MusicPlatform
  label: string
  shortLabel: string
  buildTrackUrl: ((trackId: string) => string) | null
  buildSearchUrl: (query: string) => string
}

export const MUSIC_PLATFORM_DEFINITIONS: readonly MusicPlatformDefinition[] = [
  {
    id: 'spotify',
    label: 'Spotify',
    shortLabel: 'S',
    buildTrackUrl: (trackId) => `https://open.spotify.com/track/${encodeURIComponent(trackId)}`,
    buildSearchUrl: (query) => `https://open.spotify.com/search/${encodeURIComponent(query)}`,
  },
  {
    id: 'appleMusic',
    label: 'Apple Music',
    shortLabel: '',
    // Apple Music catalog URLs contain a storefront and should be stored exactly as returned by its API.
    buildTrackUrl: null,
    buildSearchUrl: (query) => `https://music.apple.com/kr/search?term=${encodeURIComponent(query)}`,
  },
  {
    id: 'youtubeMusic',
    label: 'YouTube Music',
    shortLabel: '▶',
    buildTrackUrl: (trackId) => `https://music.youtube.com/watch?v=${encodeURIComponent(trackId)}`,
    buildSearchUrl: (query) => `https://music.youtube.com/search?q=${encodeURIComponent(query)}`,
  },
]

export function buildPlatformTrackUrl(platform: MusicPlatform, trackId: string | null): string | null {
  if (!trackId) return null

  const definition = MUSIC_PLATFORM_DEFINITIONS.find((item) => item.id === platform)
  return definition?.buildTrackUrl?.(trackId) ?? null
}

export function buildPlatformSearchUrl(
  platform: MusicPlatform,
  track: Pick<Track, 'artist' | 'title'>,
): string {
  const definition = MUSIC_PLATFORM_DEFINITIONS.find((item) => item.id === platform)
  const query = `${track.artist} ${track.title}`

  return definition?.buildSearchUrl(query) ?? '#'
}

export function resolvePlatformTrackLink(
  platform: MusicPlatform,
  track: Track,
): { href: string; isDirect: boolean } {
  const reference = track.platforms[platform]

  if (reference.url) {
    return { href: reference.url, isDirect: true }
  }

  const trackUrl = buildPlatformTrackUrl(platform, reference.id)
  if (trackUrl) {
    return { href: trackUrl, isDirect: true }
  }

  return { href: buildPlatformSearchUrl(platform, track), isDirect: false }
}
