import { getSportsUpdates } from './src/service.js'

const statusLine = document.querySelector('#items-status')
const list = document.querySelector('#items-list')
const filters = document.querySelectorAll('[data-filter]')
const refreshButton = document.querySelector('#refresh-updates')
const refreshInterval = 5 * 60 * 1000
let allUpdates = []
let lastUpdated = null
let selectedSport = 'All'
let isRefreshing = false

function formatUpdatedTime() {
  if (!lastUpdated) return ''
  return `Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function showStatus(kind, message) {
  statusLine.dataset.kind = kind
  statusLine.textContent = message
}

function renderUpdates(sport = selectedSport) {
  const updates = sport === 'All' ? allUpdates : allUpdates.filter((item) => item.sport === sport)
  list.replaceChildren()

  if (updates.length === 0) {
    showStatus('empty', 'No updates in this category yet. Try another sport.')
    return
  }

  for (const item of updates) {
    const card = document.createElement('article')
    card.className = 'update-card'
    const top = document.createElement('div')
    top.className = 'card-top'
    const tag = document.createElement('span')
    tag.className = 'sport-tag'
    tag.textContent = item.sport
    const icon = document.createElement('span')
    icon.className = 'card-icon'
    icon.setAttribute('aria-hidden', 'true')
    icon.textContent = item.icon || '🏆'
    top.append(tag, icon)
    const title = document.createElement('h3')
    title.textContent = item.title
    const detail = document.createElement('p')
    detail.textContent = item.detail
    const meta = document.createElement('div')
    meta.className = 'card-meta'
    const label = item.sourceUrl
      ? document.createElement('a')
      : document.createElement('span')
    label.textContent = item.source || 'SPORTSCENTRAL'
    if (item.sourceUrl) {
      label.href = item.sourceUrl
      label.target = '_blank'
      label.rel = 'noopener noreferrer'
      label.setAttribute('aria-label', `Read at ${item.source || 'official sports website'} (opens in a new tab)`)
    }
    const time = document.createElement('span')
    time.textContent = item.time || 'Sample update'
    meta.append(label, time)
    card.append(top, title, detail, meta)
    list.append(card)
  }
  const updatedText = formatUpdatedTime()
  showStatus('ok', `Showing ${updates.length} ${updates.length === 1 ? 'update' : 'updates'}.${updatedText ? ` ${updatedText}.` : ''}`)
}

filters.forEach((button) => {
  button.addEventListener('click', () => {
    selectedSport = button.dataset.filter
    filters.forEach((filter) => {
      const selected = filter === button
      filter.classList.toggle('active', selected)
      filter.setAttribute('aria-pressed', String(selected))
    })
    renderUpdates(selectedSport)
  })
})

async function showUpdates(force = false) {
  if (isRefreshing) return
  isRefreshing = true
  refreshButton.disabled = true
  refreshButton.textContent = 'Refreshing…'
  if (allUpdates.length === 0) showStatus('loading', 'Loading sports updates…')

  try {
    const result = await getSportsUpdates(fetch, { force })
    if (!result.ok) {
      showStatus('error', allUpdates.length
        ? `Could not refresh updates. Showing the previous updates. ${result.error.message}`
        : result.error.message)
      return
    }
    allUpdates = result.data
    lastUpdated = new Date()
    renderUpdates(selectedSport)
  } catch (error) {
    showStatus('error', allUpdates.length
      ? 'Could not refresh updates. Showing the previous updates.'
      : 'Could not load sports updates. Please try again.')
    console.error('Sports updates refresh failed:', error)
  } finally {
    isRefreshing = false
    refreshButton.disabled = false
    refreshButton.textContent = 'Refresh updates'
  }
}

refreshButton.addEventListener('click', () => showUpdates(true))
showUpdates(true)

setInterval(() => showUpdates(true), refreshInterval)

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && (!lastUpdated || Date.now() - lastUpdated.getTime() >= refreshInterval)) {
    showUpdates(true)
  }
})
