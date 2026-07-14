import { describe, it, expect } from 'vitest'
import { TASK_PROVIDERS, getTaskProvider } from './task-providers.js'

describe('getTaskProvider', () => {
  it('returns the jira provider by name', () => {
    const provider = getTaskProvider('jira')
    expect(provider).toBeDefined()
    expect(provider.id).toBe('jira')
  })

  it('returns the github provider by name', () => {
    const provider = getTaskProvider('github')
    expect(provider).toBeDefined()
    expect(provider.id).toBe('github')
  })

  it('returns jira provider for unknown provider name (fallback)', () => {
    const provider = getTaskProvider('unknown')
    expect(provider.id).toBe('jira')
  })

  it('returns jira provider for empty string', () => {
    const provider = getTaskProvider('')
    expect(provider.id).toBe('jira')
  })
})

describe('TASK_PROVIDERS', () => {
  it('has jira and github providers', () => {
    expect(TASK_PROVIDERS.jira).toBeDefined()
    expect(TASK_PROVIDERS.github).toBeDefined()
  })

  it('has exactly 2 providers', () => {
    expect(Object.keys(TASK_PROVIDERS)).toHaveLength(2)
  })

  describe('jira provider shape', () => {
    const provider = TASK_PROVIDERS.jira

    it('has id, name, configFields', () => {
      expect(provider.id).toBe('jira')
      expect(provider.name).toBe('Jira')
      expect(Array.isArray(provider.configFields)).toBe(true)
    })

    it('has fetchTasks and fetchByKey async functions', () => {
      expect(typeof provider.fetchTasks).toBe('function')
      expect(typeof provider.fetchByKey).toBe('function')
      // async functions return a promise when called
      expect(provider.fetchTasks({})).toBeInstanceOf(Promise)
    })

    it('configFields contains jira domain, email, token, jql, storyField', () => {
      expect(provider.configFields).toContain('jiraDomain')
      expect(provider.configFields).toContain('jiraEmail')
      expect(provider.configFields).toContain('jiraToken')
      expect(provider.configFields).toContain('jiraJql')
      expect(provider.configFields).toContain('jiraStoryField')
    })
  })

  describe('github provider shape', () => {
    const provider = TASK_PROVIDERS.github

    it('has id, name, configFields', () => {
      expect(provider.id).toBe('github')
      expect(provider.name).toBe('GitHub Issues')
      expect(Array.isArray(provider.configFields)).toBe(true)
    })

    it('has fetchTasks and fetchByKey async functions', () => {
      expect(typeof provider.fetchTasks).toBe('function')
      expect(typeof provider.fetchByKey).toBe('function')
      // async functions return a promise when called
      expect(provider.fetchTasks({})).toBeInstanceOf(Promise)
    })

    it('configFields contains github token, repos, and issues query', () => {
      expect(provider.configFields).toContain('githubToken')
      expect(provider.configFields).toContain('githubRepos')
      expect(provider.configFields).toContain('githubIssuesQuery')
    })
  })
})

describe('provider fetchTasks — TaskItem shape (via mock)', () => {
  it('jira provider fetchTasks returns items with correct TaskItem shape', async () => {
    // Use the JiraSearch mock (already setup in vitest.setup.js)
    const mockIssue = {
      key: 'PROJ-123',
      fields: {
        summary: 'Test issue',
        status: { name: 'In Progress' },
        priority: { name: 'High', iconUrl: 'https://example.com/high.png' },
        created: '2026-01-15T10:00:00Z',
        updated: '2026-07-14T12:00:00Z',
      },
    }

    // Set up the mock via the global setup helper
    window.go.main.App.JiraSearch = vi.fn().mockResolvedValue({
      items: [mockIssue],
    })

    const cfg = {
      jiraDomain: 'test.atlassian.net',
      jiraEmail: 'test@test.com',
      jiraToken: 'token',
    }
    const provider = getTaskProvider('jira')
    const result = await provider.fetchTasks(cfg, 'assignee = currentUser()')

    expect(result.error).toBeUndefined()
    expect(result.items).toHaveLength(1)

    const item = result.items[0]
    expect(item).toHaveProperty('id', 'PROJ-123')
    expect(item).toHaveProperty('title', 'Test issue')
    expect(item).toHaveProperty('url', 'https://test.atlassian.net/browse/PROJ-123')
    expect(item).toHaveProperty('status', 'In Progress')
    expect(item).toHaveProperty('statusColor')
    expect(item).toHaveProperty('priority', 'High')
    expect(item).toHaveProperty('createdAt', '2026-01-15T10:00:00Z')
    expect(item).toHaveProperty('updatedAt', '2026-07-14T12:00:00Z')
    expect(item).toHaveProperty('extra')
    expect(item.extra).toHaveProperty('storyPoints')
    expect(item.extra).toHaveProperty('priorityIcon', 'https://example.com/high.png')
  })

  it('jira provider returns error shape when credentials are missing', async () => {
    const provider = getTaskProvider('jira')
    const result = await provider.fetchTasks({}, 'some jql')
    expect(result).toHaveProperty('error')
    expect(result.items).toEqual([])
  })
})
