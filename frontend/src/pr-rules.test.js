import { describe, it, expect } from 'vitest'
import {
  latestReviewsByUser,
  getApprovalReviews,
  countApprovals,
  hasChangesRequested,
  getPRReadiness,
} from './pr-rules.js'

function review(login, state, submittedAt) {
  return { user: { login }, state, submitted_at: submittedAt }
}

describe('latestReviewsByUser', () => {
  it('keeps only the most recent review per user', () => {
    const reviews = [
      review('alice', 'CHANGES_REQUESTED', '2026-07-01T10:00:00Z'),
      review('alice', 'APPROVED', '2026-07-02T10:00:00Z'),
      review('bob', 'APPROVED', '2026-07-01T10:00:00Z'),
    ]
    const latest = latestReviewsByUser(reviews)
    expect(latest.get('alice').state).toBe('APPROVED')
    expect(latest.get('bob').state).toBe('APPROVED')
  })

  it('ignores reviews without a login or submitted_at', () => {
    const reviews = [{ state: 'COMMENTED' }, review('alice', 'APPROVED', '2026-07-01T10:00:00Z')]
    const latest = latestReviewsByUser(reviews)
    expect(latest.size).toBe(1)
  })
})

describe('countApprovals / getApprovalReviews', () => {
  it('counts distinct approving users, not raw review rows', () => {
    const reviews = [
      review('alice', 'APPROVED', '2026-07-01T10:00:00Z'),
      review('alice', 'APPROVED', '2026-07-02T10:00:00Z'), // re-approved, still one person
      review('bob', 'APPROVED', '2026-07-03T10:00:00Z'),
    ]
    expect(countApprovals(reviews)).toBe(2)
  })

  it('does not count a user whose latest review is CHANGES_REQUESTED', () => {
    const reviews = [
      review('alice', 'APPROVED', '2026-07-01T10:00:00Z'),
      review('alice', 'CHANGES_REQUESTED', '2026-07-02T10:00:00Z'),
    ]
    expect(countApprovals(reviews)).toBe(0)
  })

  it('sorts approvals chronologically', () => {
    const reviews = [
      review('bob', 'APPROVED', '2026-07-03T10:00:00Z'),
      review('alice', 'APPROVED', '2026-07-01T10:00:00Z'),
    ]
    const approvals = getApprovalReviews(reviews)
    expect(approvals.map((r) => r.user.login)).toEqual(['alice', 'bob'])
  })
})

describe('hasChangesRequested', () => {
  it('is true when a reviewer\'s latest state is CHANGES_REQUESTED', () => {
    const reviews = [review('alice', 'CHANGES_REQUESTED', '2026-07-01T10:00:00Z')]
    expect(hasChangesRequested(reviews)).toBe(true)
  })

  it('is false once the reviewer approves after requesting changes', () => {
    const reviews = [
      review('alice', 'CHANGES_REQUESTED', '2026-07-01T10:00:00Z'),
      review('alice', 'APPROVED', '2026-07-02T10:00:00Z'),
    ]
    expect(hasChangesRequested(reviews)).toBe(false)
  })
})

describe('getPRReadiness', () => {
  it('flags changes_requested even with 2 approvals from other reviewers', () => {
    const reviews = [
      review('alice', 'APPROVED', '2026-07-01T10:00:00Z'),
      review('bob', 'APPROVED', '2026-07-01T10:00:00Z'),
      review('carol', 'CHANGES_REQUESTED', '2026-07-02T10:00:00Z'),
    ]
    expect(getPRReadiness({ reviews })).toBe('changes_requested')
  })

  it('flags unresolved_comments when approved but threads remain open', () => {
    const reviews = [
      review('alice', 'APPROVED', '2026-07-01T10:00:00Z'),
      review('bob', 'APPROVED', '2026-07-01T10:00:00Z'),
    ]
    expect(getPRReadiness({ reviews, unresolvedThreads: 2 })).toBe('unresolved_comments')
  })

  it('is ready with 2 approvals, no unresolved threads, no conflicts', () => {
    const reviews = [
      review('alice', 'APPROVED', '2026-07-01T10:00:00Z'),
      review('bob', 'APPROVED', '2026-07-01T10:00:00Z'),
    ]
    expect(getPRReadiness({ reviews, unresolvedThreads: 0 })).toBe('ready')
  })

  it('flags conflicts over a bare approval count', () => {
    const reviews = [
      review('alice', 'APPROVED', '2026-07-01T10:00:00Z'),
      review('bob', 'APPROVED', '2026-07-01T10:00:00Z'),
    ]
    expect(getPRReadiness({ reviews, mergeState: 'dirty' })).toBe('conflicts')
  })

  it('is partially_approved with only one approval', () => {
    const reviews = [review('alice', 'APPROVED', '2026-07-01T10:00:00Z')]
    expect(getPRReadiness({ reviews })).toBe('partially_approved')
  })

  it('is waiting_approval with no reviews', () => {
    expect(getPRReadiness({ reviews: [] })).toBe('waiting_approval')
  })
})
