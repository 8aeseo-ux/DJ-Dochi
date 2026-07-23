const ALLOWED_DOTHOME_ORIGINS = new Set([
  'http://qotjdus1016.dothome.co.kr',
  'https://qotjdus1016.dothome.co.kr',
])

export function isAllowedBrowserOrigin(request: Request) {
  const origin = request.headers.get('Origin')
  return origin === null || ALLOWED_DOTHOME_ORIGINS.has(origin)
}
