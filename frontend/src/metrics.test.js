import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computeMetrics } from './metrics.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Create sequential mock fetch responses.
 * Each call to fetch returns the next response in the array.
 * Falls back to { items: [] } when exhausted.
 */
function mockSequential(responses) {
  let idx = 0
  const mock = vi.fn().mockImplementation(() => {
    const resp = responses[idx] ?? { json: { items: [] } }
    idx++
    return Promise.resolve({
      ok: resp.ok !== false,
      status: resp.status ?? 200,
      headers: new Map(Object.entries(resp.headers ?? {})),
      json: () => Promise.resolve(resp.json ?? {}),
      text: () => Promise.resolve(resp.text ?? ''),
    })
  })
  vi.stubGlobal('fetch', mock)
  return { mock, getIndex: () => idx }
}

/** Set the config in localStorage so getConfig() returns it. */
function setConfig(partial) {
  const stored = JSON.parse(localStorage.getItem('devdash_config_v1') || '{}')
  Object.assign(stored, partial)
  localStorage.setItem('devdash_config_v1', JSON.stringify(stored))
}

/**
 * Build a fake merged-PR-like item.
 * `repository_url` must parse as …/repos/{owner}/{repo}.
 */
function mergedPR(number, { owner = 'owner', repo = 'repo', createdAt, closedAt } = {}) {
  return {
    number,
    title: `PR #${number}`,
    created_at: createdAt ?? '2026-07-01T10:00:00Z',
    closed_at: closedAt ?? '2026-07-10T10:00:00Z',
    updated_at: '2026-07-09T10:00:00Z',
    repository_url: `https://api.github.com/repos/${owner}/${repo}`,
    state: 'closed',
    pull_request: {},
  }
}

/** Build a fake open-PR-like item. */
function openPR(number, { owner = 'owner', repo = 'repo', updatedAt } = {}) {
  return {
    number,
    title: `Open PR #${number}`,
    created_at: '2026-07-01T10:00:00Z',
    updated_at: updatedAt ?? '2026-07-14T10:00:00Z',
    repository_url: `https://api.github.com/repos/${owner}/${repo}`,
    state: 'open',
    pull_request: {},
  }
}

/** Build a fake review. */
function review(state, submittedAt) {
  return { state, submitted_at: submittedAt, user: { login: 'reviewer' } }
}

/**
 * Compute expected call layout for a given scenario.
 *
 * Order of fetch calls inside computeGitHubMetrics:
 *   1. fetchMergedPRs       — search/issues? is:merged
 *   2..N+1. reviews per merged PR   — /repos/…/pulls/{n}/reviews
 *   N+2. fetchClosedPRs    — search/issues? is:closed
 *   N+3. fetchOpenPRs      — search/issues? is:open
 *   N+4..N+3+O reviews per open PR — /repos/…/pulls/{n}/reviews
 *
 * That means we need to provide responses in EXACT call order.
 */

// ── Tests ────────────────────────────────────────────────────────────────────

describe('computeMetrics', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    localStorage.clear()
    setConfig({
      githubToken: 'test-token',
      githubRepos: 'owner/repo',
    })
  })

  it('handles empty PR list — returns zero counts and null rates', async () => {
    // All fetches return empty items
    mockSequential([])

    const result = await computeMetrics(30)

    expect(result.github).not.toBeNull()
    expect(result.github.staleCount).toBe(0)
    expect(result.github.mergeRate).toBeNull()
    expect(result.github.mergeTimes).toBeNull()
    expect(result.github.timeToFirstApproval).toBeNull()
    expect(result.github.reviewRounds).toBeNull()
  })

  it('calculates merge rate from merged vs total closed PRs', async () => {
    // 3 merged out of 5 closed = 60%
    // Fetch order: mergedPRs(3) → reviews(3×1) → closedPRs(5) → openPRs(0)
    mockSequential([
      // 1. merged PRs
      { json: { items: [
        mergedPR(1, { createdAt: '2026-07-01T10:00:00Z', closedAt: '2026-07-05T10:00:00Z' }),
        mergedPR(2, { createdAt: '2026-07-02T10:00:00Z', closedAt: '2026-07-06T10:00:00Z' }),
        mergedPR(3, { createdAt: '2026-07-03T10:00:00Z', closedAt: '2026-07-07T10:00:00Z' }),
      ]}},
      // 2. reviews for PR#1
      { json: [] },
      // 3. reviews for PR#2
      { json: [] },
      // 4. reviews for PR#3
      { json: [] },
      // 5. closed PRs (5 items)
      { json: { items: [{ number: 1 }, { number: 2 }, { number: 3 }, { number: 4 }, { number: 5 }] }},
      // 6. open PRs (empty)
      { json: { items: [] } },
    ])

    const result = await computeMetrics(30)

    expect(result.github.mergeRate).toBe(60)
  })

  it('computes time-to-first-approval median from merged PRs', async () => {
    // PR #10: created 2026-07-01T10:00, approved 2026-07-02T10:00 → 24h
    // PR #11: created 2026-07-01T10:00, approved 2026-07-03T10:00 → 48h
    // median of [24, 48] = 36
    mockSequential([
      // 1. merged PRs
      { json: { items: [
        mergedPR(10, { createdAt: '2026-07-01T10:00:00Z', closedAt: '2026-07-04T10:00:00Z' }),
        mergedPR(11, { createdAt: '2026-07-01T10:00:00Z', closedAt: '2026-07-05T10:00:00Z' }),
      ]}},
      // 2. reviews for PR#10
      { json: [review('APPROVED', '2026-07-02T10:00:00Z')] },
      // 3. reviews for PR#11
      { json: [review('APPROVED', '2026-07-03T10:00:00Z')] },
      // 4. closed PRs
      { json: { items: [1, 2] }},
      // 5. open PRs (empty)
      { json: { items: [] } },
    ])

    const result = await computeMetrics(30)

    // 24h + 48h / 2 = 36
    expect(result.github.timeToFirstApproval).toBe(36)
  })

  it('calculates stale PRs correctly', async () => {
    // One PR updated 33 days ago → stale for 30-day window
    // One PR updated 2 days ago → not stale
    mockSequential([
      // 1. merged PRs (empty)
      { json: { items: [] }},
      // 2. closed PRs (empty)
      { json: { items: [] }},
      // 3. open PRs (2 items — one stale, one fresh)
      { json: { items: [
        openPR(1, { updatedAt: '2026-06-11T10:00:00Z' }), // 33 days ago → stale
        openPR(2, { updatedAt: '2026-07-12T10:00:00Z' }), // 2 days ago → fresh
      ]}},
      // 4. reviews for open PR#1
      { json: [] },
      // 5. reviews for open PR#2
      { json: [] },
    ])

    const result = await computeMetrics(30)

    expect(result.github.staleCount).toBe(1)
  })

  it('handles PRs with no reviews', async () => {
    // Merged PR with no reviews → timeToFirstApproval stays null
    mockSequential([
      // 1. merged PRs
      { json: { items: [
        mergedPR(1, { createdAt: '2026-07-01T10:00:00Z', closedAt: '2026-07-04T10:00:00Z' }),
      ]}},
      // 2. reviews for PR#1 (empty)
      { json: [] },
      // 3. closed PRs (same count as merged)
      { json: { items: [{ number: 1 }] }},
      // 4. open PRs (empty)
      { json: { items: [] } },
    ])

    const result = await computeMetrics(30)

    expect(result.github.timeToFirstApproval).toBeNull()
    expect(result.github.reviewRounds).toBeNull()
    expect(result.github.mergeRate).toBe(100) // 1 merged / 1 closed
  })

  it('reports rateLimited when GitHub API rate limits', async () => {
    const future = Math.floor(Date.now() / 1000) + 3600
    // First call (merged PRs) returns rate-limited
    mockSequential([
      {
        ok: false,
        status: 403,
        headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(future) },
        json: {},
        text: 'rate limited',
      },
    ])

    const result = await computeMetrics(30)

    expect(result.rateLimited).toBeDefined()
    expect(result.rateLimited).toContain('rate limit')
  })

  it('computes mergeTime median from merged PR duration', async () => {
    // PR #1: created Jul 1 → closed Jul 5 = 4 days = 96h
    // PR #2: created Jul 5 → closed Jul 7 = 2 days = 48h
    // median of [48, 96] = 72
    mockSequential([
      // 1. merged PRs
      { json: { items: [
        mergedPR(1, { createdAt: '2026-07-01T10:00:00Z', closedAt: '2026-07-05T10:00:00Z' }),
        mergedPR(2, { createdAt: '2026-07-05T10:00:00Z', closedAt: '2026-07-07T10:00:00Z' }),
      ]}},
      // 2. reviews for PR#1
      { json: [] },
      // 3. reviews for PR#2
      { json: [] },
      // 4. closed PRs
      { json: { items: [1, 2] }},
      // 5. open PRs (empty)
      { json: { items: [] } },
    ])

    const result = await computeMetrics(30)

    expect(result.github.mergeTimes).toBe(72)
  })
})
