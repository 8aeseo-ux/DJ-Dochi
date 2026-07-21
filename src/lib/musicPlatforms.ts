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

const MUSIC_PLATFORM_HOSTS: Record<MusicPlatform, string> = {
  spotify: 'open.spotify.com',
  appleMusic: 'music.apple.com',
  youtubeMusic: 'music.youtube.com',
}

const TRACK_ID_PATTERNS: Partial<Record<MusicPlatform, RegExp>> = {
  spotify: /^[A-Za-z0-9]{22}$/,
  youtubeMusic: /^[A-Za-z0-9_-]{11}$/,
}

function getTrimmedValue(value: string | null): string | null {
  const trimmedValue = value?.trim()
  return trimmedValue || null
}

function isValidTrackId(platform: MusicPlatform, trackId: string): boolean {
  return TRACK_ID_PATTERNS[platform]?.test(trackId) ?? false
}

function isValidPlatformUrl(platform: MusicPlatform, url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    return parsedUrl.protocol === 'https:' && parsedUrl.hostname === MUSIC_PLATFORM_HOSTS[platform]
  } catch {
    return false
  }
}

export function buildPlatformTrackUrl(platform: MusicPlatform, trackId: string | null): string | null {
  const trimmedTrackId = getTrimmedValue(trackId)
  if (!trimmedTrackId || !isValidTrackId(platform, trimmedTrackId)) return null

  const definition = MUSIC_PLATFORM_DEFINITIONS.find((item) => item.id === platform)
  return definition?.buildTrackUrl?.(trimmedTrackId) ?? null
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
  const storedUrl = getTrimmedValue(reference.url)

  if (storedUrl && isValidPlatformUrl(platform, storedUrl)) {
    return { href: storedUrl, isDirect: true }
  }

  const trackUrl = buildPlatformTrackUrl(platform, reference.id)
  if (trackUrl) {
    return { href: trackUrl, isDirect: true }
  }

  return { href: buildPlatformSearchUrl(platform, track), isDirect: false }
}
