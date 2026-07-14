import { vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// localStorage — jsdom 26 blocks localStorage for opaque origins; provide
// our own polyfill to keep tests independent of origin configuration.
// ---------------------------------------------------------------------------
const lsStore = {}
const mockLocalStorage = {
  getItem: vi.fn((key) => lsStore[key] ?? null),
  setItem: vi.fn((key, value) => { lsStore[key] = String(value) }),
  removeItem: vi.fn((key) => { delete lsStore[key] }),
  clear: vi.fn(() => { Object.keys(lsStore).forEach((k) => delete lsStore[k]) }),
  get length() { return Object.keys(lsStore).length },
  key: vi.fn((i) => Object.keys(lsStore)[i] ?? null),
}
vi.stubGlobal('localStorage', mockLocalStorage)

beforeEach(() => {
  localStorage.clear()
})

// ---------------------------------------------------------------------------
// Notification API — for notifications.js
// ---------------------------------------------------------------------------
class MockNotification {
  constructor(title, opts) {
    this.title = title
    this.opts = opts
  }
  static permission = 'granted'
  static requestPermission = vi.fn(() => Promise.resolve('granted'))
}

vi.stubGlobal('Notification', MockNotification)

// ---------------------------------------------------------------------------
// Wails Go bindings — window.go.main.App
// ---------------------------------------------------------------------------
if (!window.go) {
  window.go = {}
}
if (!window.go.main) {
  window.go.main = {}
}
window.go.main.App = {
  JiraSearch: vi.fn().mockResolvedValue({ items: [] }),
  OpenLink: vi.fn(),
}

// ---------------------------------------------------------------------------
// window.__HF_ANIME — anime.js integration (safety mock, not currently used)
// ---------------------------------------------------------------------------
window.__HF_ANIME = {
  add: vi.fn(),
  remove: vi.fn(),
}

// ---------------------------------------------------------------------------
// Helper exports for tests
// ---------------------------------------------------------------------------

/**
 * Mock the global `fetch` function to return a successful response.
 * @param {any} data - The JSON body to return
 * @param {number} status - HTTP status code (default 200)
 * @returns {import('vitest').Mock} The mock function for assertions
 */
export function mockFetch(data, status = 200) {
  const mock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(typeof data === 'string' ? data : JSON.stringify(data)),
    headers: new Map(),
  })
  vi.stubGlobal('fetch', mock)
  return mock
}

/**
 * Mock the global `fetch` to return an error response.
 * @param {number} status - HTTP status code (default 500)
 * @param {string} msg - Error message body (default 'Server Error')
 * @returns {import('vitest').Mock} The mock function for assertions
 */
export function mockFetchError(status = 500, msg = 'Server Error') {
  return mockFetch({ message: msg }, status)
}

/**
 * Mock the Wails Go JiraSearch binding to return a specific response.
 * @param {object} data - The response data (default { items: [] })
 * @returns {import('vitest').Mock} The mock function for assertions
 */
export function mockJiraResponse(data = { items: [] }) {
  window.go.main.App.JiraSearch = vi.fn().mockResolvedValue(data)
  return window.go.main.App.JiraSearch
}
