import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockFetch, mockFetchError } from './vitest.setup.js'
import { searchIssues, getIssue, fetchActivePRs } from './github.js'

describe('searchIssues', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('constructs correct URL with query and repo filters', async () => {
    const fetchMock = mockFetch({ items: [] })
    const cfg = { githubToken: 'test-token', githubRepos: 'owner/repo', githubIssuesToken: '' }

    await searchIssues(cfg, 'bug')

    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toContain('https://api.github.com/search/issues')
    expect(url).toContain(encodeURIComponent('bug'))
    expect(url).toContain(encodeURIComponent('repo:owner/repo'))
    expect(url).toContain('sort=updated')
    expect(url).toContain('per_page=30')
    expect(opts.headers.Authorization).toBe('Bearer test-token')
  })

  it('uses githubIssuesToken when available', async () => {
    const fetchMock = mockFetch({ items: [] })
    const cfg = {
      githubToken: 'main-token',
      githubRepos: 'owner/repo',
      githubIssuesToken: 'issues-token',
    }

    await searchIssues(cfg, 'story')

    const opts = fetchMock.mock.calls[0][1]
    expect(opts.headers.Authorization).toBe('Bearer issues-token')
  })

  it('falls back to githubToken when githubIssuesToken is empty', async () => {
    const fetchMock = mockFetch({ items: [] })
    const cfg = { githubToken: 'main-token', githubRepos: 'owner/repo', githubIssuesToken: '' }

    await searchIssues(cfg, 'bug')

    const opts = fetchMock.mock.calls[0][1]
    expect(opts.headers.Authorization).toBe('Bearer main-token')
  })

  it('returns error when no token is set', async () => {
    const cfg = { githubToken: '', githubRepos: 'owner/repo', githubIssuesToken: '' }

    const result = await searchIssues(cfg, 'bug')

    expect(result).toHaveProperty('error')
    expect(result.error).toContain('GitHub')
    expect(result.error).toContain('token')
  })

  it('handles rate limit response (403 + zero remaining)', async () => {
    const future = Math.floor(Date.now() / 1000) + 3600
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Map([
          ['x-ratelimit-remaining', '0'],
          ['x-ratelimit-reset', String(future)],
        ]),
        json: () => Promise.resolve({}),
        text: () => Promise.resolve('rate limited'),
      })
    )

    const cfg = { githubToken: 'test-token', githubRepos: 'owner/repo', githubIssuesToken: '' }
    const result = await searchIssues(cfg, 'bug')

    expect(result.rateLimited).toBe(true)
    expect(result.error).toContain('rate limit')
  })

  it('handles 403 without rate limit exhaustion as generic error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Map([
          ['x-ratelimit-remaining', '42'],
          ['x-ratelimit-reset', '0'],
        ]),
        json: () => Promise.resolve({}),
        text: () => Promise.resolve('forbidden'),
      })
    )

    const cfg = { githubToken: 'test-token', githubRepos: 'owner/repo', githubIssuesToken: '' }
    const result = await searchIssues(cfg, 'bug')

    expect(result.rateLimited).toBeUndefined()
    expect(result.error).toContain('403')
  })

  it('handles network error gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')))

    const cfg = { githubToken: 'test-token', githubRepos: 'owner/repo', githubIssuesToken: '' }
    const result = await searchIssues(cfg, 'bug')

    expect(result.error).toContain('Fallo de red')
  })

  it('builds repo query from multiple repos', async () => {
    const fetchMock = mockFetch({ items: [] })
    const cfg = {
      githubToken: 'test-token',
      githubRepos: 'owner/repo, another/project',
      githubIssuesToken: '',
    }

    await searchIssues(cfg, 'bug')

    const url = fetchMock.mock.calls[0][0]
    expect(url).toContain(encodeURIComponent('repo:owner/repo'))
    expect(url).toContain(encodeURIComponent('repo:another/project'))
  })
})

describe('getIssue', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('constructs correct URL with owner, repo, and issue number', async () => {
    const fetchMock = mockFetch({ id: 42, title: 'Test Issue' })
    const cfg = { githubToken: 'test-token', githubRepos: 'owner/repo' }

    await getIssue(cfg, 'my-owner', 'my-repo', 123)

    const url = fetchMock.mock.calls[0][0]
    expect(url).toBe('https://api.github.com/repos/my-owner/my-repo/issues/123')
  })

  it('returns null when fetch fails (non-ok status)', async () => {
    mockFetchError(404)
    const cfg = { githubToken: 'test-token', githubRepos: 'owner/repo' }

    const result = await getIssue(cfg, 'owner', 'repo', 999)
    expect(result).toBeNull()
  })

  it('returns null when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')))

    const cfg = { githubToken: 'test-token', githubRepos: 'owner/repo' }
    const result = await getIssue(cfg, 'owner', 'repo', 1)
    expect(result).toBeNull()
  })

  it('returns null when no token is set', async () => {
    const cfg = { githubToken: '', githubRepos: 'owner/repo' }

    const result = await getIssue(cfg, 'owner', 'repo', 1)
    expect(result).toBeNull()
  })

  it('uses githubIssuesToken when set', async () => {
    const fetchMock = mockFetch({ id: 1 })
    const cfg = {
      githubToken: 'main-token',
      githubRepos: 'owner/repo',
      githubIssuesToken: 'issues-token',
    }

    await getIssue(cfg, 'owner', 'repo', 1)

    const opts = fetchMock.mock.calls[0][1]
    expect(opts.headers.Authorization).toBe('Bearer issues-token')
  })
})

describe('fetchActivePRs', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('constructs correct API call with token, repos, email, and user', async () => {
    const fetchMock = mockFetch({ items: [] })
    const cfg = {
      githubToken: 'test-token',
      githubRepos: 'owner/repo',
      githubEmail: 'user@test.com',
      githubUser: 'testuser',
    }

    await fetchActivePRs(cfg)

    const url = fetchMock.mock.calls[0][0]
    expect(url).toContain('https://api.github.com/search/issues')
    expect(url).toContain(encodeURIComponent('repo:owner/repo'))
    expect(url).toContain(encodeURIComponent('author-email:user@test.com'))
    expect(url).toContain(encodeURIComponent('review-requested:testuser'))
    expect(url).toContain('sort=updated')
    expect(url).toContain('per_page=20')
  })

  it('returns error when no token is set', async () => {
    const result = await fetchActivePRs({ githubToken: '', githubRepos: 'owner/repo' })
    expect(result).toHaveProperty('error')
  })

  it('returns error when no repos configured', async () => {
    const result = await fetchActivePRs({ githubToken: 'token', githubRepos: '' })
    expect(result).toHaveProperty('error')
  })

  it('handles rate limit response', async () => {
    const future = Math.floor(Date.now() / 1000) + 3600
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Map([
          ['x-ratelimit-remaining', '0'],
          ['x-ratelimit-reset', String(future)],
        ]),
        json: () => Promise.resolve({}),
        text: () => Promise.resolve('rate limited'),
      })
    )

    const cfg = {
      githubToken: 'test-token',
      githubRepos: 'owner/repo',
      githubEmail: 'user@test.com',
      githubUser: 'testuser',
    }
    const result = await fetchActivePRs(cfg)

    expect(result.rateLimited).toBe(true)
    expect(result.error).toContain('rate limit')
  })

  it('uses Bearer token in Authorization header', async () => {
    const fetchMock = mockFetch({ items: [] })
    const cfg = { githubToken: 'ghp_secret', githubRepos: 'owner/repo' }

    await fetchActivePRs(cfg)

    const opts = fetchMock.mock.calls[0][1]
    expect(opts.headers.Authorization).toBe('Bearer ghp_secret')
  })
})
