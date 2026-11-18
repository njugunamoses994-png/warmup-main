// Shows your repository in the codespace preview on port 3000, the same files GitHub Pages shows on Day 8.
// It never shows hidden files or folders (such as .git) or node_modules. `npm start` runs it.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import httpServer from 'http-server'

const PORT = 3000
const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const F1_FEED = 'https://www.formula1.com/en/latest/all.xml'
let feedCache = null
let feedCacheTime = 0

function decodeXml(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .trim()
}

function itemValue(xml, name) {
  const match = xml.match(new RegExp(`<${name}(?:[^>]*)>([\\s\\S]*?)<\\/${name}>`, 'i'))
  return match ? decodeXml(match[1]) : ''
}

async function getFormula1Updates() {
  const now = Date.now()
  if (feedCache && now - feedCacheTime < 5 * 60 * 1000) return feedCache

  const response = await fetch(F1_FEED, {
    headers: { 'user-agent': 'SportsCentral/1.0' },
  })
  if (!response.ok) throw new Error(`Formula 1 feed answered with status ${response.status}`)

  const xml = await response.text()
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    .slice(0, 6)
    .map((match, index) => ({
      id: `f1-live-${index + 1}`,
      title: itemValue(match[1], 'title'),
      detail: itemValue(match[1], 'description'),
      sport: 'Formula 1',
      icon: '🏎️',
      time: 'Official Formula 1',
      source: 'Formula 1',
      sourceUrl: itemValue(match[1], 'link'),
    }))
    .filter((item) => item.title && item.detail && item.sourceUrl)

  if (items.length === 0) throw new Error('Formula 1 feed contained no updates')
  feedCache = items
  feedCacheTime = now
  return items
}

// True only for addresses inside the repository that are not hidden
export function isAllowed(requestTarget) {
  // Exactly one slash at the start, and no backslashes anywhere
  if (!/^\/(?!\/)/.test(requestTarget) || requestTarget.includes('\\')) {
    return false
  }

  // Drop anything after ? or #, then decode each part of the path
  const rawPath = requestTarget.split(/[?#]/)[0]
  let decoded
  try {
    decoded = rawPath
      .split('/')
      .map((part) => decodeURIComponent(part))
      .join('/')
  } catch {
    return false
  }
  if (decoded.includes('\\') || decoded.includes('\0')) {
    return false
  }

  // Work out the real file path and check it stays inside the repository
  const resolved = path.resolve(ROOT, '.' + path.normalize(decoded))
  const relative = path.relative(ROOT, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return false
  }

  // No hidden parts (starting with ".") and no node_modules
  return relative
    .split(path.sep)
    .every((part) => !part.startsWith('.') && part !== 'node_modules')
}

export function createPreviewServer() {
  return httpServer.createServer({
    root: ROOT,
    cache: -1,
    showDir: 'false',
    showDotfiles: false,
    before: [
      (req, res) => {
        if (!isAllowed(req.url)) {
          res.statusCode = 404
          res.end('Not found')
          return
        }
        if (req.url === '/api/sports-updates.json') {
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.setHeader('cache-control', 'no-cache')
          getFormula1Updates()
            .then((items) => res.end(JSON.stringify({ items })))
            .catch((error) => {
              res.statusCode = 502
              res.end(JSON.stringify({
                error: {
                  code: 'LIVE_FEED_UNAVAILABLE',
                  message: error.message,
                },
              }))
            })
          return
        }
        res.emit('next')
      },
    ],
  })
}

// Start the server only when this file is run with node (not when a test imports it)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createPreviewServer().listen(PORT, () => {
    console.log(`Preview running on port ${PORT}. Press Ctrl+C to stop it.`)
  })
}
