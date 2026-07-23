export const TASTE_TERM_ALIASES: Readonly<Record<string, readonly string[]>> = {
  '몽환적': ['dreamy', 'ethereal'],
  '몽환적인': ['dreamy', 'ethereal'],
  '인디 알앤비': ['indie r&b', 'alternative r&b'],
  '늦은 밤': ['late night', 'nocturnal'],
  '잔잔함': ['mellow', 'soft'],
  '잔잔한': ['mellow', 'soft'],
}

export const VAGUE_SEARCH_TERMS = new Set([
  '좋은',
  '감성적',
  '감성적인',
  '힙한',
])

export function normalizeCatalogTerm(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLocaleLowerCase()
}

export function normalizeTasteTerms(
  values: readonly string[],
): string[] {
  const normalized: string[] = []
  const seen = new Set<string>()

  for (const value of values) {
    const term = normalizeCatalogTerm(value)
    if (!term || VAGUE_SEARCH_TERMS.has(term)) continue

    const mapped = TASTE_TERM_ALIASES[term] ?? [term]
    for (const item of mapped) {
      const canonical = normalizeCatalogTerm(item)
      if (!canonical || seen.has(canonical)) continue
      seen.add(canonical)
      normalized.push(canonical)
    }
  }

  return normalized
}
