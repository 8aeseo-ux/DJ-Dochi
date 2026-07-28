import { normalizeCatalogTerm } from './catalogSearchVocabulary.js'
import { selectCatalogMatch } from './trackIdentity.js'
import { TtlCache } from './ttlCache.js'
import type {
  CatalogDiscoveredTrack,
  CatalogDiscoveryProvider,
  CatalogDiscoveryResult,
  CatalogMatch,
  CatalogSearchSeed,
  CatalogUnavailableReason,
  CatalogVerificationProvider,
  CatalogVerificationResult,
  SimilarArtistSeedResolver,
} from './types.js'

export const MUSICBRAINZ_TIMEOUT_MS = 4_000
export const MUSICBRAINZ_MIN_INTERVAL_MS = 1_100

const DEFAULT_USER_AGENT = 'DJ-DOCHI/1.0 (https://github.com/8aeseo-ux/DJ-Dochi)'
const DISCOVERY_CACHE_TTL_MS = 6 * 60 * 60 * 1_000
const DISCOVERY_CACHE_MAX_ENTRIES = 100
const EXACT_ARTIST_SCORE = 95
const RELATED_ARTIST_SCORE = 90

type MusicBrainzCatalogProviderOptions = {
  fetch?: typeof fetch
  timeoutMs?: number
  minIntervalMs?: number
  now?: () => number
  wait?: (durationMs: number) => Promise<void>
  userAgent?: string
}

type RateGate = {
  schedule<T>(operation: () => Promise<T>): Promise<T>
}

type JsonRequestResult =
  | { status: 'ok'; payload: unknown }
  | { status: 'unavailable'; reason: CatalogUnavailableReason }

type ParsedArtist = {
  id: string
  name: string
  score: number
  aliases: string[]
  tags: Array<{ name: string; count: number }>
}

export type MusicBrainzCatalogProvider =
  & CatalogVerificationProvider
  & CatalogDiscoveryProvider
  & SimilarArtistSeedResolver

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs))
}

function createRateGate(options: {
  minIntervalMs: number
  now: () => number
  wait: (durationMs: number) => Promise<void>
}): RateGate {
  let queue = Promise.resolve()
  let lastStartedAt: number | null = null

  return {
    schedule<T>(operation: () => Promise<T>): Promise<T> {
      const run = queue.then(async () => {
        if (lastStartedAt !== null) {
          const remaining = lastStartedAt + options.minIntervalMs - options.now()
          if (remaining > 0) await options.wait(remaining)
        }

        lastStartedAt = options.now()
        return operation()
      })

      queue = run.then(() => undefined, () => undefined)
      return run
    },
  }
}

const defaultRateGate = createRateGate({
  minIntervalMs: MUSICBRAINZ_MIN_INTERVAL_MS,
  now: Date.now,
  wait: delay,
})

function artistCreditName(value: unknown): string {
  if (!Array.isArray(value)) return ''

  return value.map((credit) => {
    if (!isRecord(credit)) return ''
    const nestedArtist = isRecord(credit.artist) ? credit.artist.name : undefined
    const name = typeof credit.name === 'string'
      ? credit.name
      : typeof nestedArtist === 'string' ? nestedArtist : ''
    const joinPhrase = typeof credit.joinphrase === 'string' ? credit.joinphrase : ''
    return `${name}${joinPhrase}`
  }).join('').trim()
}

function firstReleaseTitle(value: unknown): string {
  if (!Array.isArray(value)) return ''
  const release = value.find((item) => isRecord(item) && typeof item.title === 'string')
  return isRecord(release) && typeof release.title === 'string' ? release.title : ''
}

function parseTags(value: unknown): Array<{ name: string; count: number }> {
  if (!Array.isArray(value)) return []

  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.name !== 'string') return []
    return [{
      name: item.name.trim(),
      count: typeof item.count === 'number' ? item.count : 0,
    }]
  }).filter(({ name }) => name.length > 0)
}

function parseRecordings(value: unknown): CatalogMatch[] | null {
  if (!isRecord(value) || !Array.isArray(value.recordings)) return null

  const matches = value.recordings.flatMap((recording): CatalogMatch[] => {
    if (
      !isRecord(recording)
      || typeof recording.id !== 'string'
      || typeof recording.title !== 'string'
    ) {
      return []
    }

    const artist = artistCreditName(recording['artist-credit'])
    if (!artist) return []
    const version = typeof recording.disambiguation === 'string'
      ? recording.disambiguation.trim()
      : ''

    return [{
      provider: 'musicbrainz',
      catalogId: recording.id,
      title: recording.title,
      artist,
      album: firstReleaseTitle(recording.releases),
      url: `https://musicbrainz.org/recording/${encodeURIComponent(recording.id)}`,
      durationMs: typeof recording.length === 'number' ? recording.length : null,
      ...(version ? { version } : {}),
    }]
  })

  return value.recordings.length > 0 && matches.length === 0 ? null : matches
}

function parseDiscoveredRecordings(
  value: unknown,
): CatalogDiscoveredTrack[] | null {
  if (!isRecord(value) || !Array.isArray(value.recordings)) return null

  const tracks = value.recordings.flatMap((recording): CatalogDiscoveredTrack[] => {
    if (
      !isRecord(recording)
      || typeof recording.id !== 'string'
      || typeof recording.title !== 'string'
    ) {
      return []
    }

    const artist = artistCreditName(recording['artist-credit'])
    if (!artist) return []
    const tags = parseTags(recording.tags)
    const rawScore = typeof recording.score === 'number' ? recording.score : 0

    return [{
      provider: 'musicbrainz',
      catalogId: recording.id,
      title: recording.title,
      artist,
      album: firstReleaseTitle(recording.releases),
      url: `https://musicbrainz.org/recording/${encodeURIComponent(recording.id)}`,
      durationMs: typeof recording.length === 'number' ? recording.length : null,
      primaryGenre: tags[0]?.name ?? '',
      providerScore: Math.max(0, Math.min(1, rawScore / 100)),
    }]
  })

  return value.recordings.length > 0 && tracks.length === 0 ? null : tracks
}

function parseArtists(value: unknown): ParsedArtist[] | null {
  if (!isRecord(value) || !Array.isArray(value.artists)) return null

  const artists = value.artists.flatMap((artist): ParsedArtist[] => {
    if (
      !isRecord(artist)
      || typeof artist.id !== 'string'
      || typeof artist.name !== 'string'
    ) {
      return []
    }

    const aliases = Array.isArray(artist.aliases)
      ? artist.aliases.flatMap((alias) => (
          isRecord(alias) && typeof alias.name === 'string' ? [alias.name] : []
        ))
      : []

    return [{
      id: artist.id,
      name: artist.name,
      score: typeof artist.score === 'number' ? artist.score : 0,
      aliases,
      tags: parseTags(artist.tags),
    }]
  })

  return value.artists.length > 0 && artists.length === 0 ? null : artists
}

function unavailable(
  reason: CatalogUnavailableReason,
): CatalogDiscoveryResult {
  return { status: 'unavailable', reason }
}

function verificationUnavailable(
  reason: CatalogUnavailableReason,
): CatalogVerificationResult {
  return { status: 'unavailable', reason }
}

function recordingQuery(seed: CatalogSearchSeed): string {
  if (seed.kind === 'input_artist' || seed.kind === 'similar_artist') {
    return `artist:"${seed.term}" AND status:official`
  }
  return `tag:"${seed.term}" AND status:official`
}

export function createMusicBrainzCatalogProvider(
  options: MusicBrainzCatalogProviderOptions = {},
): MusicBrainzCatalogProvider {
  const request = options.fetch ?? fetch
  const timeoutMs = options.timeoutMs ?? MUSICBRAINZ_TIMEOUT_MS
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT
  const usesCustomRateGate = (
    options.minIntervalMs !== undefined
    || options.now !== undefined
    || options.wait !== undefined
  )
  const rateGate = usesCustomRateGate
    ? createRateGate({
        minIntervalMs: options.minIntervalMs ?? MUSICBRAINZ_MIN_INTERVAL_MS,
        now: options.now ?? Date.now,
        wait: options.wait ?? delay,
      })
    : defaultRateGate
  const discoveryCache = new TtlCache<string, Promise<CatalogDiscoveryResult>>({
    ttlMs: DISCOVERY_CACHE_TTL_MS,
    maxEntries: DISCOVERY_CACHE_MAX_ENTRIES,
  })

  async function requestJson(
    pathname: string,
    params: URLSearchParams,
    externalSignal?: AbortSignal,
  ): Promise<JsonRequestResult> {
    const controller = new AbortController()
    let timedOut = false
    const abortFromCaller = () => controller.abort(externalSignal?.reason)
    externalSignal?.addEventListener('abort', abortFromCaller, { once: true })
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort(new DOMException('Catalog request timed out', 'TimeoutError'))
    }, timeoutMs)

    const url = new URL(pathname, 'https://musicbrainz.org')
    url.search = params.toString()

    try {
      const response = await request(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': userAgent,
        },
        signal: controller.signal,
      })

      if (response.status === 429) return { status: 'unavailable', reason: 'rate_limited' }
      if (!response.ok) return { status: 'unavailable', reason: 'network' }

      try {
        return { status: 'ok', payload: await response.json() }
      } catch {
        return { status: 'unavailable', reason: 'invalid_response' }
      }
    } catch {
      return { status: 'unavailable', reason: timedOut ? 'timeout' : 'network' }
    } finally {
      clearTimeout(timeout)
      externalSignal?.removeEventListener('abort', abortFromCaller)
    }
  }

  function search(seed: CatalogSearchSeed, signal?: AbortSignal) {
    const cacheKey = `${seed.kind}:${normalizeCatalogTerm(seed.term)}`
    const cached = discoveryCache.get(cacheKey)
    if (cached) return cached

    const result = rateGate.schedule(async (): Promise<CatalogDiscoveryResult> => {
      const response = await requestJson(
        '/ws/2/recording',
        new URLSearchParams({
          query: recordingQuery(seed),
          fmt: 'json',
          limit: '25',
        }),
        signal,
      )
      if (response.status === 'unavailable') return unavailable(response.reason)

      const tracks = parseDiscoveredRecordings(response.payload)
      return tracks
        ? { status: 'ok', tracks }
        : unavailable('invalid_response')
    })

    discoveryCache.set(cacheKey, result)
    void result.then((value) => {
      if (value.status === 'unavailable') discoveryCache.delete(cacheKey)
    })
    return result
  }

  return {
    id: 'musicbrainz',
    search,
    async findSimilarArtistSeed(inputArtist, signal) {
      const resolvedResponse = await rateGate.schedule(() => requestJson(
        '/ws/2/artist',
        new URLSearchParams({
          query: `artist:"${inputArtist}"`,
          fmt: 'json',
          limit: '10',
        }),
        signal,
      ))
      if (resolvedResponse.status === 'unavailable') return null

      const artists = parseArtists(resolvedResponse.payload)
      if (!artists) return null
      const inputKey = normalizeCatalogTerm(inputArtist)
      const resolved = artists.find((artist) => (
        artist.score >= EXACT_ARTIST_SCORE
        && [artist.name, ...artist.aliases]
          .some((name) => normalizeCatalogTerm(name) === inputKey)
      ))
      const strongestTag = resolved?.tags
        .filter(({ count }) => count > 0)
        .sort((left, right) => right.count - left.count)[0]
      if (!resolved || !strongestTag) return null

      const relatedResponse = await rateGate.schedule(() => requestJson(
        '/ws/2/artist',
        new URLSearchParams({
          query: `tag:"${strongestTag.name}"`,
          fmt: 'json',
          limit: '10',
        }),
        signal,
      ))
      if (relatedResponse.status === 'unavailable') return null

      const relatedArtists = parseArtists(relatedResponse.payload)
      const tagKey = normalizeCatalogTerm(strongestTag.name)
      const related = relatedArtists?.find((artist) => (
        artist.id !== resolved.id
        && artist.score >= RELATED_ARTIST_SCORE
        && artist.tags.some((tag) => normalizeCatalogTerm(tag.name) === tagKey)
      ))
      if (!related) return null

      return {
        id: `similar-artist-${related.id}`,
        kind: 'similar_artist',
        term: related.name,
        weight: 0.76,
        sourceArtist: resolved.name,
        catalogEvidence: {
          provider: 'musicbrainz',
          entityId: related.id,
          tag: strongestTag.name,
        },
      }
    },
    verify(candidate, signal) {
      return rateGate.schedule(async () => {
        const response = await requestJson(
          '/ws/2/recording',
          new URLSearchParams({
            query: `recording:"${candidate.title}" AND artist:"${candidate.artist}"`,
            fmt: 'json',
            limit: '10',
          }),
          signal,
        )
        if (response.status === 'unavailable') {
          return verificationUnavailable(response.reason)
        }

        const recordings = parseRecordings(response.payload)
        if (!recordings) return verificationUnavailable('invalid_response')
        return selectCatalogMatch(candidate, recordings)
      })
    },
  }
}
