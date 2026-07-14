import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockJiraResponse } from './vitest.setup.js'
import { fetchJira } from './jira.js'

describe('fetchJira (Go backend proxy)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const defaultCfg = {
    jiraDomain: 'test.atlassian.net',
    jiraEmail: 'user@test.com',
    jiraToken: 'jira-token',
  }

  it('calls JiraSearch with domain, jql, email, token, maxResults, fields', async () => {
    const jql = 'assignee = currentUser()'
    await fetchJira(defaultCfg, jql)

    expect(window.go.main.App.JiraSearch).toHaveBeenCalledTimes(1)
    expect(window.go.main.App.JiraSearch).toHaveBeenCalledWith(
      'test.atlassian.net',
      jql,
      'user@test.com',
      'jira-token',
      20,
      'summary,status,priority,updated,created'
    )
  })

  it('passes domain, jql, email, token from config faithfully', async () => {
    const cfg = {
      jiraDomain: 'my-domain.atlassian.net',
      jiraEmail: 'admin@myco.com',
      jiraToken: 'mytoken123',
    }
    await fetchJira(cfg, 'project = PROJ')

    expect(window.go.main.App.JiraSearch).toHaveBeenCalledWith(
      'my-domain.atlassian.net',
      'project = PROJ',
      'admin@myco.com',
      'mytoken123',
      20,
      'summary,status,priority,updated,created'
    )
  })

  it('passes maxResults and fields from options', async () => {
    await fetchJira(defaultCfg, 'status = Done', {
      maxResults: 50,
      fields: 'created,status',
    })

    expect(window.go.main.App.JiraSearch).toHaveBeenCalledWith(
      'test.atlassian.net',
      'status = Done',
      'user@test.com',
      'jira-token',
      50,
      'created,status'
    )
  })

  it('returns parsed items from JiraSearch', async () => {
    const mockIssue = {
      key: 'PROJ-123',
      fields: { summary: 'Test issue', status: { name: 'In Progress' } },
    }
    mockJiraResponse({ items: [mockIssue] })

    const result = await fetchJira(defaultCfg, 'assignee = currentUser()')

    expect(result.items).toHaveLength(1)
    expect(result.items[0].key).toBe('PROJ-123')
    expect(result.items[0].fields.summary).toBe('Test issue')
  })

  it('returns items with created date, story points, and priority when present', async () => {
    const mockIssue = {
      key: 'PROJ-456',
      fields: {
        summary: 'Story with details',
        created: '2026-06-01T12:00:00Z',
        priority: { name: 'High' },
        customfield_10016: 5,
      },
    }
    mockJiraResponse({ items: [mockIssue] })

    const result = await fetchJira(defaultCfg, 'issuetype = Story')

    const item = result.items[0]
    expect(item.fields.created).toBe('2026-06-01T12:00:00Z')
    expect(item.fields.priority.name).toBe('High')
    // story points field comes back raw — normalization happens in task-providers
    expect(item.fields.customfield_10016).toBe(5)
  })

  it('handles empty response', async () => {
    mockJiraResponse({ items: [] })

    const result = await fetchJira(defaultCfg, 'status = Done')

    expect(result.items).toEqual([])
  })

  it('handles null items in response', async () => {
    mockJiraResponse({ items: null })

    const result = await fetchJira(defaultCfg, 'some jql')

    // fetchJira returns the raw response — items is null
    expect(result.items).toBeNull()
  })

  it('handles error from Go backend (rejected promise)', async () => {
    window.go.main.App.JiraSearch = vi.fn().mockRejectedValue(new Error('Connection refused'))

    const result = await fetchJira(defaultCfg, 'some jql')

    expect(result).toHaveProperty('error')
    expect(result.error).toContain('Error de conexión')
  })

  it('strips https:// scheme from domain', async () => {
    const cfg = {
      jiraDomain: 'https://my-domain.atlassian.net',
      jiraEmail: 'a@b.com',
      jiraToken: 't',
    }
    await fetchJira(cfg, 'project = TEST')

    expect(window.go.main.App.JiraSearch).toHaveBeenCalledWith(
      'my-domain.atlassian.net',
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(Number),
      expect.any(String)
    )
  })

  it('strips trailing slash from domain', async () => {
    const cfg = {
      jiraDomain: 'my-domain.atlassian.net/',
      jiraEmail: 'a@b.com',
      jiraToken: 't',
    }
    await fetchJira(cfg, 'project = TEST')

    expect(window.go.main.App.JiraSearch).toHaveBeenCalledWith(
      'my-domain.atlassian.net',
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(Number),
      expect.any(String)
    )
  })

  it('strips both scheme and trailing slash', async () => {
    const cfg = {
      jiraDomain: 'https://my-domain.atlassian.net/',
      jiraEmail: 'a@b.com',
      jiraToken: 't',
    }
    await fetchJira(cfg, 'project = TEST')

    expect(window.go.main.App.JiraSearch).toHaveBeenCalledWith(
      'my-domain.atlassian.net',
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(Number),
      expect.any(String)
    )
  })

  it('returns error when credentials are missing', async () => {
    const result = await fetchJira({}, 'some jql')

    expect(result).toHaveProperty('error')
    expect(result.error).toContain('Configura')
  })

  it('returns error when domain is missing', async () => {
    const result = await fetchJira(
      { jiraEmail: 'a@b.com', jiraToken: 't' },
      'some jql'
    )

    expect(result).toHaveProperty('error')
  })
})
