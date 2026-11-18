// Shows your repository in the codespace preview on port 3000, the same files GitHub Pages shows on Day 8.
// It never shows hidden files or folders (such as .git) or node_modules. `npm start` runs it.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import httpServer from 'http-server'

const PORT = 3000
const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const F1_FEED = 'https://www.formula1.com/en/latest/all.xml'
const WORLD_ATHLETICS_NEWS = 'https://worldathletics.org/news'
const PREMIER_LEAGUE_NEWS = 'https://www.premierleague.com/en/news'
const NBA_SCOREBOARD = 'https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json'
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
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
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

async function getOfficialSportsUpdates() {
  const sourceFile = path.join(ROOT, 'data', 'sports-updates.json')
  const source = JSON.parse(await readFile(sourceFile, 'utf8'))
  return (source.items || []).filter((item) => item.sport !== 'Formula 1')
}

async function getWorldAthleticsUpdates() {
  const response = await fetch(WORLD_ATHLETICS_NEWS, {
    headers: { 'user-agent': 'SportsCentral/1.0' },
  })
  if (!response.ok) throw new Error(`World Athletics answered with status ${response.status}`)
  const html = await response.text()
  const matches = [...html.matchAll(/<a[^>]+href="(\/[^"#]*\/news\/[^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
  const items = []

  for (const match of matches) {
    const title = decodeXml(match[2]).replace(/\s+/g, ' ').trim()
    if (
      !title ||
      title.length < 8 ||
      /^read more$/i.test(title) ||
      items.some((item) => item.title === title)
    ) continue
    items.push({
      id: `world-athletics-${items.length + 1}`,
      title,
      detail: `Read this official World Athletics news story from ${title}.`,
      sport: 'Athletics',
      icon: '🏃',
      time: 'Official World Athletics',
      source: 'World Athletics',
      sourceUrl: `https://worldathletics.org${match[1].split('?')[0]}`,
    })
    if (items.length === 3) break
  }
  return items
}

async function getPremierLeagueUpdates() {
  const response = await fetch(PREMIER_LEAGUE_NEWS, {
    headers: { 'user-agent': 'SportsCentral/1.0' },
  })
  if (!response.ok) throw new Error(`Premier League answered with status ${response.status}`)
  const html = await response.text()
  const matches = [...html.matchAll(/<a[^>]+href="(\/en\/news\/[^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
  const items = []

  for (const match of matches) {
    const title = decodeXml(match[2]).replace(/\s+/g, ' ').trim()
    if (!title || title.length < 8 || items.some((item) => item.title === title)) continue
    items.push({
      id: `premier-league-${items.length + 1}`,
      title,
      detail: 'Official Premier League news, reports and competition updates.',
      sport: 'Football',
      icon: '⚽',
      time: 'Official Premier League',
      source: 'Premier League',
      sourceUrl: `https://www.premierleague.com${match[1].split('?')[0]}`,
    })
    if (items.length === 3) break
  }
  return items
}

async function getNbaUpdates() {
  const response = await fetch(NBA_SCOREBOARD, {
    headers: { 'user-agent': 'SportsCentral/1.0' },
  })
  if (!response.ok) throw new Error(`NBA scoreboard answered with status ${response.status}`)
  const body = await response.json()
  const games = body?.scoreboard?.games || []

  return games.slice(0, 3).map((game, index) => {
    const home = game.homeTeam?.teamName || 'Home'
    const away = game.awayTeam?.teamName || 'Away'
    const homeScore = game.homeTeam?.score
    const awayScore = game.awayTeam?.score
    const score = Number.isInteger(homeScore) && Number.isInteger(awayScore)
      ? `${away} ${awayScore} - ${homeScore} ${home}`
      : `${away} at ${home}`

    return {
      id: `nba-${game.gameId || index + 1}`,
      title: score,
      detail: 'Official NBA live scoreboard update.',
      sport: 'Basketball',
      icon: '🏀',
      time: game.gameStatusText || 'Official NBA scoreboard',
      source: 'NBA',
      sourceUrl: 'https://www.nba.com/games',
    }
  })
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
          Promise.allSettled([
            getFormula1Updates(),
            getOfficialSportsUpdates(),
            getWorldAthleticsUpdates(),
            getPremierLeagueUpdates(),
            getNbaUpdates(),
          ])
            .then((results) => {
              const formula1Items = results[0].status === 'fulfilled' ? results[0].value : []
              const officialItems = results[1].status === 'fulfilled' ? results[1].value : []
              const athleticsItems = results[2].status === 'fulfilled' ? results[2].value : []
              const footballItems = results[3].status === 'fulfilled' ? results[3].value : []
              const basketballItems = results[4].status === 'fulfilled' ? results[4].value : []
              const otherOfficialItems = officialItems.filter((item) =>
                item.sport !== 'Athletics' &&
                item.sport !== 'Football' &&
                item.sport !== 'Basketball' &&
                item.source !== 'Premier League'
              )
              const fallbackItems = officialItems.filter((item) =>
                (item.sport === 'Athletics' && athleticsItems.length === 0) ||
                (item.sport === 'Football' && footballItems.length === 0) ||
                (item.sport === 'Basketball' && basketballItems.length === 0)
              )
              res.end(JSON.stringify({
                items: [
                  ...formula1Items,
                  ...footballItems,
                  ...athleticsItems,
                  ...basketballItems,
                  ...otherOfficialItems,
                  ...fallbackItems,
                ],
              }))
            })
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
