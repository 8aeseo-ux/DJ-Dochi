const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined

export function resolveApiUrl(
  path: string,
  baseUrl = configuredApiBaseUrl,
): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const normalizedBase = baseUrl?.trim().replace(/\/+$/, '') ?? ''

  return normalizedBase ? `${normalizedBase}${normalizedPath}` : normalizedPath
}
