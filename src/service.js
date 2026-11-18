// Your team's service module (runs in the browser for now).
// The interface (app.js) asks this module for data. This module fetches it,
// checks it, and always answers in one of two shapes:
//   { ok: true, data }
//   { ok: false, error: { code, message } }

// Builds the error shape, so every error looks the same
function fail(code, message) {
  return { ok: false, error: { code, message } }
}

// ---------------------------------------------------------------
// WORKED EXAMPLE: read the sample items from data/sample-items.json
// fetchFn is fetch in the browser. The tests pass in a pretend fetch instead.
// ---------------------------------------------------------------
export async function getItems(fetchFn = fetch) {
  let response
  try {
    response = await fetchFn('./data/sample-items.json')
  } catch {
    return fail('BAD_RESPONSE', 'Could not load the items. Check your connection and try again.')
  }

  if (!response.ok) {
    return fail('BAD_RESPONSE', `The items file answered with status ${response.status}.`)
  }

  let body
  try {
    body = await response.json()
  } catch {
    return fail('BAD_RESPONSE', 'The items file is not valid JSON.')
  }

  if (!body || !Array.isArray(body.items)) {
    return fail('BAD_RESPONSE', 'The items file has no list called "items".')
  }

  return { ok: true, data: body.items }
}

// ---------------------------------------------------------------
// DAY 4: add your team's own functions below this line.
// Follow the pattern of getItems (and getForecast in the practice card):
//   1. Check the input with a rule. If it breaks the rule,
//      return fail('YOUR_ERROR_CODE', 'A message in plain words').
//   2. Ask for the data with fetchFn.
//   3. Check the answer. If it is wrong, return fail('BAD_RESPONSE', '...').
//   4. Return { ok: true, data }.
// Write a test for each rule in test/service.test.js.
//
// Example name: export async function getTimetable(day, fetchFn = fetch) { ... }
// ---------------------------------------------------------------

// Loads the sports dashboard data. fetchFn can be replaced in tests.
export async function getSportsUpdates(fetchFn = fetch, { force = false } = {}) {
  try {
    const liveResponse = await fetchFn(`./api/sports-updates.json${force ? '?refresh=1' : ''}`)
    if (liveResponse.ok) {
      const liveBody = await liveResponse.json()
      if (liveBody && Array.isArray(liveBody.items) && liveBody.items.length > 0) {
        const liveValid = liveBody.items.every((item) =>
          item &&
          typeof item.title === 'string' &&
          typeof item.detail === 'string' &&
          typeof item.sport === 'string'
        )
        if (liveValid) return { ok: true, data: liveBody.items }
      }
    }
  } catch {
    // The static file below keeps the dashboard usable on GitHub Pages.
  }

  let response
  try {
    response = await fetchFn('./data/sports-updates.json')
  } catch {
    return fail('BAD_RESPONSE', 'Could not load sports updates. Check your connection and try again.')
  }
  if (!response.ok) {
    return fail('BAD_RESPONSE', `The sports updates file answered with status ${response.status}.`)
  }
  let body
  try {
    body = await response.json()
  } catch {
    return fail('BAD_RESPONSE', 'The sports updates file is not valid JSON.')
  }
  if (!body || !Array.isArray(body.items)) {
    return fail('BAD_RESPONSE', 'The sports updates file has no list called "items".')
  }
  const valid = body.items.every((item) => item && typeof item.title === 'string' && typeof item.detail === 'string' && typeof item.sport === 'string')
  if (!valid) {
    return fail('BAD_RESPONSE', 'One or more sports updates are missing a title, detail or sport.')
  }
  return { ok: true, data: body.items }
}
