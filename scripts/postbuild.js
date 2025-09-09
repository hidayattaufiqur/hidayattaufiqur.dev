// Create a tiny static file server entry to satisfy the existing systemd unit
// It writes dist/server/entry.mjs that serves the built static files.
import { promises as fs } from 'node:fs'
import path from 'node:path'

const distDir = path.resolve('dist')
const serverDir = path.join(distDir, 'server')
await fs.mkdir(serverDir, { recursive: true })

const entry = `import http from 'node:http'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const PORT = process.env.PORT ? Number(process.env.PORT) : 1977
const root = process.cwd()

const mime = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.ttf', 'font/ttf'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
])

function safeJoin(base, target) {
  let targetPath = path.posix.normalize('/' + target)
  while (targetPath.startsWith('/')) targetPath = targetPath.slice(1)
  const full = path.join(base, targetPath)
  if (!full.startsWith(base)) return null
  return full
}

async function send(res, status, body, headers = {}) {
  res.writeHead(status, headers)
  res.end(body)
}

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new url.URL(req.url || '/', 'http://localhost')
    let filePath = safeJoin(root, pathname)
    if (!filePath) return send(res, 400, 'Bad Request')

    // If it is a directory, serve index.html
    let stat
    try {
      stat = await fs.stat(filePath)
    } catch {}

    if (stat && stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html')
    }

    // Try file, otherwise SPA-style fallback to root index.html
    let data
    try {
      data = await fs.readFile(filePath)
    } catch {
      try {
        data = await fs.readFile(path.join(root, 'index.html'))
        filePath = path.join(root, 'index.html')
      } catch {
        return send(res, 404, 'Not Found')
      }
    }

    const ext = path.extname(filePath).toLowerCase()
    const type = mime.get(ext) || 'application/octet-stream'
    await send(res, 200, data, { 'content-type': type })
  } catch (e) {
    await send(res, 500, 'Internal Server Error')
  }
})

server.listen(PORT, () => {
  console.log('[static] listening on http://localhost:' + PORT)
})
`

await fs.writeFile(path.join(serverDir, 'entry.mjs'), entry, 'utf8')
console.log('Wrote dist/server/entry.mjs for static hosting')
