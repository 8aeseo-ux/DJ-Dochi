import { describe, expect, it } from 'vitest'
import { resolveApiUrl } from './api'

describe('resolveApiUrl', () => {
  it('keeps same-origin API paths for local and Vercel deployments', () => {
    expect(resolveApiUrl('/api/generate-mixtape', '')).toBe('/api/generate-mixtape')
  })

  it('joins a configured API origin without duplicate slashes', () => {
    expect(resolveApiUrl(
      '/api/generate-mixtape',
      'https://dj-dochi-api.vercel.app/',
    )).toBe('https://dj-dochi-api.vercel.app/api/generate-mixtape')
  })
})
