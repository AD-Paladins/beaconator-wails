// Single source of truth for "is this PR actually ready?" rules used across the app
// (PR list cards, badges, the "hide approved" filter). Keep docs/pr-readiness-rules.md
// in sync whenever a rule here changes — the diagram documents this same decision tree.

export const PR_READY_REQUIRED_APPROVALS = 2;

// A reviewer's most recent review supersedes their earlier ones (e.g. an APPROVED
// after a CHANGES_REQUESTED clears the block). Collapse to one review per login.
export function latestReviewsByUser(reviews) {
  const latest = new Map();
  for (const r of reviews || []) {
    if (!r.user?.login || !r.submitted_at) continue;
    const prev = latest.get(r.user.login);
    if (!prev || new Date(r.submitted_at) > new Date(prev.submitted_at)) {
      latest.set(r.user.login, r);
    }
  }
  return latest;
}

export function getApprovalReviews(reviews) {
  return [...latestReviewsByUser(reviews).values()]
    .filter((r) => r.state === 'APPROVED')
    .sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
}

export function countApprovals(reviews) {
  return getApprovalReviews(reviews).length;
}

export function hasChangesRequested(reviews) {
  return [...latestReviewsByUser(reviews).values()].some((r) => r.state === 'CHANGES_REQUESTED');
}

// Returns one of: 'draft' | 'changes_requested' | 'conflicts' | 'unresolved_comments' | 'ready' | 'partially_approved' | 'waiting_approval'
// Order matters: a blocking condition must never be masked by a more "positive" one further down.
export function getPRReadiness({ reviews, unresolvedThreads = 0, mergeState, draft = false } = {}) {
  if (draft) return 'draft';
  if (hasChangesRequested(reviews)) return 'changes_requested';
  if (mergeState === 'dirty') return 'conflicts';
  const approvals = countApprovals(reviews);
  if (approvals >= PR_READY_REQUIRED_APPROVALS && unresolvedThreads > 0) return 'unresolved_comments';
  if (approvals >= PR_READY_REQUIRED_APPROVALS) return 'ready';
  if (approvals >= 1) return 'partially_approved';
  return 'waiting_approval';
}
