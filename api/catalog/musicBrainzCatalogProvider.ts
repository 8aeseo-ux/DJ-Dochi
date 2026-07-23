import { selectCatalogMatch } from './trackIdentity'
import type {
  CatalogMatch,
  CatalogVerificationProvider,
  CatalogVerificationResult,
} from './types'

export const MUSICBRAINZ_TIMEOUT_MS = 4_000
export const MUSICBRAINZ_MIN_INTERVAL_MS = 1_100

const DEFAULT_USER_AGENT = 'DJ-DOCHI/1.0 (https://github.com/8aeseo-ux/DJ-Dochi)'

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

    return [{
      provider: 'musicbrainz',
      catalogId: recording.id,
      title: recording.title,
      artist,
      album: firstReleaseTitle(recording.releases),
      url: `https://musicbrainz.org/recording/${encodeURIComponent(recording.id)}`,
    }]
  })

  return value.recordings.length > 0 && matches.length === 0 ? null : matches
}

function unavailable(
  reason: Extract<CatalogVerificationResult, { status: 'unavailable' }>['reason'],
): CatalogVerificationResult {
  return { status: 'unavailable', reason }
}

export function createMusicBrainzCatalogProvider(
  options: MusicBrainzCatalogProviderOptions = {},
): CatalogVerificationProvider {
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

  return {
    id: 'musicbrainz',
    verify(candidate, externalSignal) {
      return rateGate.schedule(async () => {
        const controller = new AbortController()
        let timedOut = false
        const abortFromCaller = () => controller.abort(externalSignal?.reason)
        externalSignal?.addEventListener('abort', abortFromCaller, { once: true })
        const timeout = setTimeout(() => {
          timedOut = true
          controller.abort(new DOMException('Catalog request timed out', 'TimeoutError'))
        }, timeoutMs)

        const url = new URL('https://musicbrainz.org/ws/2/recording')
        url.search = new URLSearchParams({
          query: `recording:"${candidate.title}" AND artist:"${candidate.artist}"`,
          fmt: 'json',
          limit: '10',
        }).toString()

        try {
          const response = await request(url, {
            headers: {
              Accept: 'application/json',
              'User-Agent': userAgent,
            },
            signal: controller.signal,
          })

          if (response.status === 429) return unavailable('rate_limited')
          if (!response.ok) return unavailable('network')

          let payload: unknown
          try {
            payload = await response.json()
          } catch {
            return unavailable('invalid_response')
          }

          const recordings = parseRecordings(payload)
          if (!recordings) return unavailable('invalid_response')
          return selectCatalogMatch(candidate, recordings)
        } catch {
          return unavailable(timedOut ? 'timeout' : 'network')
        } finally {
          clearTimeout(timeout)
          externalSignal?.removeEventListener('abort', abortFromCaller)
        }
      })
    },
  }
}
