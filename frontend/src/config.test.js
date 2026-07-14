import { describe, it, expect, beforeEach } from 'vitest'
import { getConfig, setConfig, getWatchlist, setWatchlist } from './config.js'

describe('config', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const EXPECTED_KEYS = [
    'githubToken',
    'githubRepos',
    'githubEmail',
    'githubUser',
    'jiraDomain',
    'jiraEmail',
    'jiraToken',
    'jiraJql',
    'jiraProxyUrl',
    'jiraStoryField',
    'taskProvider',
    'githubIssuesToken',
    'githubIssuesQuery',
    'aiProvider',
    'aiApiKey',
    'aiApiKeys',
    'aiModel',
    'aiCustomUrl',
  ]

  it('getConfig() with empty localStorage returns DEFAULTS with all expected keys', () => {
    const config = getConfig()
    for (const key of EXPECTED_KEYS) {
      expect(config).toHaveProperty(key)
    }
  })

  it('getConfig() returns DEFAULTS.aiModel as gemini-3.5-flash', () => {
    const config = getConfig()
    expect(config.aiModel).toBe('gemini-3.5-flash')
  })

  it('getConfig() merges stored values with DEFAULTS', () => {
    setConfig({ githubToken: 'ghp_test123', jiraDomain: 'test.atlassian.net' })
    const config = getConfig()
    expect(config.githubToken).toBe('ghp_test123')
    expect(config.jiraDomain).toBe('test.atlassian.net')
    // default values still present
    expect(config.githubRepos).toBe('')
    expect(config.aiModel).toBe('gemini-3.5-flash')
  })

  it('getConfig() overwrites DEFAULTS with stored values', () => {
    setConfig({ taskProvider: 'github' })
    const config = getConfig()
    expect(config.taskProvider).toBe('github')
  })

  it('setConfig() stores to localStorage', () => {
    setConfig({ githubToken: 'saved-token' })
    const raw = localStorage.getItem('devdash_config_v1')
    expect(raw).toBe(JSON.stringify({ githubToken: 'saved-token' }))
  })

  describe('stale AI model migration', () => {
    it('migrates gemini-2.5-flash to gemini-3.5-flash and persists', () => {
      localStorage.setItem(
        'devdash_config_v1',
        JSON.stringify({ aiModel: 'gemini-2.5-flash' })
      )
      const config = getConfig()
      expect(config.aiModel).toBe('gemini-3.5-flash')

      // migration is persisted
      const raw = JSON.parse(localStorage.getItem('devdash_config_v1'))
      expect(raw.aiModel).toBe('gemini-3.5-flash')
    })

    it('migrates gemini-2.5-pro to gemini-3.5-flash', () => {
      localStorage.setItem(
        'devdash_config_v1',
        JSON.stringify({ aiModel: 'gemini-2.5-pro' })
      )
      const config = getConfig()
      expect(config.aiModel).toBe('gemini-3.5-flash')
    })

    it('does not migrate current model', () => {
      localStorage.setItem(
        'devdash_config_v1',
        JSON.stringify({ aiModel: 'gemini-3.5-flash' })
      )
      const config = getConfig()
      expect(config.aiModel).toBe('gemini-3.5-flash')
    })
  })

  describe('githubIssuesToken fallback', () => {
    it('is present in DEFAULTS', () => {
      const config = getConfig()
      expect(config).toHaveProperty('githubIssuesToken')
      expect(config.githubIssuesToken).toBe('')
    })

    it('can be set independently of githubToken', () => {
      setConfig({ githubToken: 'ghp_main', githubIssuesToken: 'ghp_issues' })
      const config = getConfig()
      expect(config.githubToken).toBe('ghp_main')
      expect(config.githubIssuesToken).toBe('ghp_issues')
    })
  })

  describe('watchlist', () => {
    it('getWatchlist() returns empty array when not stored', () => {
      expect(getWatchlist()).toEqual([])
    })

    it('setWatchlist() stores and getWatchlist() retrieves', () => {
      setWatchlist(['PROJ-123', 'PROJ-456'])
      expect(getWatchlist()).toEqual(['PROJ-123', 'PROJ-456'])
    })

    it('getWatchlist() after setWatchlist() reflects latest data', () => {
      setWatchlist(['PROJ-123'])
      setWatchlist(['OTHER-1'])
      expect(getWatchlist()).toEqual(['OTHER-1'])
    })
  })
})
