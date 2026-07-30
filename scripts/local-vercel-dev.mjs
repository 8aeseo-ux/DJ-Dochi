import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import http from 'node:http'

const host = '127.0.0.1'
const vercelPort = 3000
const browserPort = 3001

if (existsSync('.env.local')) {
  process.loadEnvFile('.env.local')
}

function proxyHeaders(request) {
  const headers = {
    ...request.headers,
    host: `${host}:${vercelPort}`,
  }

  if (request.url?.startsWith('/api/')) {
    delete headers.origin
  }

  return headers
}

const proxy = http.createServer((request, response) => {
  const upstream = http.request({
    hostname: host,
    port: vercelPort,
    path: request.url,
    method: request.method,
    headers: proxyHeaders(request),
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers)
    upstreamResponse.pipe(response)
  })

  upstream.on('error', () => {
    if (!response.headersSent) {
      response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
    }
    response.end('Local Vercel server is not ready yet.')
  })

  request.pipe(upstream)
})

proxy.on('upgrade', (request, socket, head) => {
  const upstream = http.request({
    hostname: host,
    port: vercelPort,
    path: request.url,
    method: request.method,
    headers: proxyHeaders(request),
  })

  upstream.on('upgrade', (upstreamResponse, upstreamSocket, upstreamHead) => {
    const headers = Object.entries(upstreamResponse.headers)
      .flatMap(([name, value]) => {
        if (Array.isArray(value)) return value.map((item) => `${name}: ${item}`)
        return value === undefined ? [] : [`${name}: ${value}`]
      })
      .join('\r\n')

    socket.write(`HTTP/1.1 101 Switching Protocols\r\n${headers}\r\n\r\n`)
    if (head.length > 0) upstreamSocket.write(head)
    if (upstreamHead.length > 0) socket.write(upstreamHead)
    upstreamSocket.pipe(socket)
    socket.pipe(upstreamSocket)
  })

  upstream.on('error', () => socket.destroy())
  upstream.end()
})

const vercel = spawn(
  process.platform === 'win32' ? 'vercel.cmd' : 'vercel',
  ['dev', '--listen', `${host}:${vercelPort}`],
  { env: process.env, stdio: 'inherit' },
)

let shuttingDown = false

function shutdown(exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true
  proxy.close()
  if (!vercel.killed) vercel.kill('SIGTERM')
  setTimeout(() => process.exit(exitCode), 100).unref()
}

vercel.on('exit', (code) => shutdown(code ?? 1))
vercel.on('error', () => shutdown(1))
process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

proxy.listen(browserPort, host, () => {
  console.log(`DJ DOCHI browser: http://${host}:${browserPort}`)
  console.log(`Vercel Functions: http://${host}:${vercelPort}`)
})
