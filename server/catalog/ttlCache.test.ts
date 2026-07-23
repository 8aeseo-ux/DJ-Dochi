// @vitest-environment node

import { describe, expect, it } from 'vitest'
import { TtlCache } from './ttlCache'

describe('TtlCache', () => {
  it('reuses values before TTL and expires them afterwards', () => {
    let now = 0
    const cache = new TtlCache<string, number>({
      ttlMs: 100,
      maxEntries: 2,
      now: () => now,
    })

    cache.set('a', 1)
    expect(cache.get('a')).toBe(1)

    now = 101
    expect(cache.get('a')).toBeUndefined()
  })

  it('evicts the oldest entry when capacity is exceeded', () => {
    const cache = new TtlCache<string, number>({
      ttlMs: 1_000,
      maxEntries: 2,
    })

    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)

    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe(2)
    expect(cache.get('c')).toBe(3)
  })

  it('clears all cached values', () => {
    const cache = new TtlCache<string, number>({
      ttlMs: 1_000,
      maxEntries: 2,
    })

    cache.set('a', 1)
    cache.clear()

    expect(cache.get('a')).toBeUndefined()
  })

  it('deletes one cached value without clearing the rest', () => {
    const cache = new TtlCache<string, number>({
      ttlMs: 1_000,
      maxEntries: 2,
    })

    cache.set('a', 1)
    cache.set('b', 2)
    cache.delete('a')

    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe(2)
  })
})
