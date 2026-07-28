type CacheEntry<V> = {
  value: V
  expiresAt: number
}

export class TtlCache<K, V> {
  private readonly entries = new Map<K, CacheEntry<V>>()
  private readonly ttlMs: number
  private readonly maxEntries: number
  private readonly now: () => number

  constructor(options: {
    ttlMs: number
    maxEntries: number
    now?: () => number
  }) {
    this.ttlMs = options.ttlMs
    this.maxEntries = options.maxEntries
    this.now = options.now ?? Date.now
  }

  get(key: K): V | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined

    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key)
      return undefined
    }

    return entry.value
  }

  set(key: K, value: V): void {
    this.entries.delete(key)
    this.entries.set(key, {
      value,
      expiresAt: this.now() + this.ttlMs,
    })

    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value
      if (oldestKey === undefined) break
      this.entries.delete(oldestKey)
    }
  }

  delete(key: K): void {
    this.entries.delete(key)
  }

  clear(): void {
    this.entries.clear()
  }
}
