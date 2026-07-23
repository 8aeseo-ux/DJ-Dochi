const ALLOWED_DOTHOME_ORIGINS = new Set([
  'http://qotjdus1016.dothome.co.kr',
  'https://qotjdus1016.dothome.co.kr',
])

const ALLOWED_VERCEL_PRODUCTION_ORIGINS = new Set([
  'https://react-vite-typescript-tailwindcss-d.vercel.app',
])

const VERCEL_HOST_ENV_NAMES = [
  'VERCEL_URL',
  'VERCEL_BRANCH_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
] as const

function getCurrentProjectVercelOrigins() {
  return new Set(VERCEL_HOST_ENV_NAMES.flatMap((name) => {
    const value = process.env[name]?.trim()
    if (!value) return []

    try {
      const url = new URL(value.includes('://') ? value : `https://${value}`)
      if (url.protocol !== 'https:' || !url.hostname.endsWith('.vercel.app')) return []
      return [url.origin]
    } catch {
      return []
    }
  }))
}

export function isAllowedBrowserOrigin(request: Request) {
  const origin = request.headers.get('Origin')
  if (origin === null) return true

  return ALLOWED_DOTHOME_ORIGINS.has(origin)
    || ALLOWED_VERCEL_PRODUCTION_ORIGINS.has(origin)
    || getCurrentProjectVercelOrigins().has(origin)
}
