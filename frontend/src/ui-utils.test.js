import { describe, it, expect, beforeEach } from 'vitest'
import { showLoading, showError, showEmpty, formatRateLimit } from './ui-utils.js'
import { timeAgo, normalizeWatchItem } from './ui.js'
import { setLanguage } from './i18n.js'

describe('ui-utils', () => {
  let container

  beforeEach(() => {
    container = document.createElement('div')
  })

  describe('escapeHtml (via showError / showEmpty)', () => {
    it('showError escapes < and > characters', () => {
      showError(container, '<script>alert("xss")</script>')
      expect(container.innerHTML).toContain('&lt;script&gt;')
      expect(container.innerHTML).not.toContain('<script>')
    })

    it('showError escapes & character', () => {
      showError(container, 'a & b')
      expect(container.innerHTML).toContain('a &amp; b')
    })

    it('showError does not need to escape double quotes (safe in text content)', () => {
      showError(container, 'say "hello"')
      expect(container.innerHTML).toContain('"hello"')
    })

    it('showEmpty escapes HTML characters', () => {
      showEmpty(container, '<b>bold</b>')
      expect(container.innerHTML).toContain('&lt;b&gt;')
      expect(container.innerHTML).not.toContain('<b>')
    })
  })

  describe('showLoading', () => {
    it('renders a spinner element inside the container', () => {
      showLoading(container)
      expect(container.innerHTML).toContain('spinner')
      expect(container.querySelector('.loading-state')).not.toBeNull()
      expect(container.querySelector('.spinner')).not.toBeNull()
    })

    it('overwrites previous container content', () => {
      container.innerHTML = '<p>existing</p>'
      showLoading(container)
      expect(container.innerHTML).not.toContain('existing')
      expect(container.innerHTML).toContain('spinner')
    })
  })

  describe('showError', () => {
    it('renders error message inside the container', () => {
      showError(container, 'Something went wrong')
      expect(container.textContent).toContain('Something went wrong')
      expect(container.querySelector('.error-state')).not.toBeNull()
    })

    it('renders a retry button when onRetry callback is provided', () => {
      const onRetry = () => {}
      showError(container, 'Error', onRetry)
      const btn = container.querySelector('.retry-btn')
      expect(btn).not.toBeNull()
      expect(btn.textContent).toBe('retry')
    })

    it('does not render a retry button when no callback is provided', () => {
      showError(container, 'Error')
      expect(container.querySelector('.retry-btn')).toBeNull()
    })
  })

  describe('showEmpty', () => {
    it('renders empty state message', () => {
      showEmpty(container, 'Nothing here.')
      expect(container.textContent).toContain('Nothing here.')
      expect(container.querySelector('.empty-state')).not.toBeNull()
    })
  })
})

describe('ui-utils — timeAgo (from ui.js)', () => {
  beforeEach(() => {
    setLanguage('en')
  })

  it('returns "just now" (<1h ago) for a recent timestamp', () => {
    // Note: timeAgo calls t('time.justNow') which returns "<1h ago" in English
    const result = timeAgo(new Date().toISOString())
    expect(result).toBe('<1h ago')
  })

  it('returns "{n}h ago" for timestamps between 1-23 hours ago', () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 3600000).toISOString()
    expect(timeAgo(fiveHoursAgo)).toBe('5h ago')
  })

  it('returns "{n}d ago" for timestamps 24+ hours ago', () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 3600000).toISOString()
    expect(timeAgo(twoDaysAgo)).toBe('2d ago')
  })

  it('returns "{n}d ago" for timestamps many days ago', () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600000).toISOString()
    expect(timeAgo(thirtyDaysAgo)).toBe('30d ago')
  })
})

describe('ui-utils — normalizeWatchItem (from ui.js)', () => {
  it('converts a Jira key string to { type: "jira", key }', () => {
    expect(normalizeWatchItem('PROJ-123')).toEqual({
      type: 'jira',
      key: 'PROJ-123',
    })
  })

  it('passes through a PR item object unchanged', () => {
    const prItem = {
      type: 'pr',
      owner: 'owner',
      repo: 'repo',
      number: 42,
    }
    expect(normalizeWatchItem(prItem)).toBe(prItem)
  })

  it('passes through a Jira item object unchanged', () => {
    const jiraItem = {
      type: 'jira',
      key: 'PROJ-456',
    }
    expect(normalizeWatchItem(jiraItem)).toBe(jiraItem)
  })

  it('handles empty string', () => {
    expect(normalizeWatchItem('')).toEqual({ type: 'jira', key: '' })
  })
})
