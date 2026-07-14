import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  requestPermission,
  getPermission,
  notifyReviewNeeded,
  getPendingCount,
  markAllSeen,
  clearSeen,
} from './notifications.js'

describe('requestPermission', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves "granted" when permission is already granted', async () => {
    Notification.permission = 'granted'
    const result = await requestPermission()
    expect(result).toBe('granted')
  })

  it('resolves "denied" when permission is already denied', async () => {
    Notification.permission = 'denied'
    const result = await requestPermission()
    expect(result).toBe('denied')
  })

  it('resolves "unsupported" when Notification is not available', async () => {
    const orig = globalThis.Notification
    delete globalThis.Notification
    const result = await requestPermission()
    expect(result).toBe('unsupported')
    globalThis.Notification = orig
  })

  it('calls Notification.requestPermission when in default state', async () => {
    Notification.permission = 'default'
    Notification.requestPermission = vi.fn().mockResolvedValue('granted')
    const result = await requestPermission()
    expect(result).toBe('granted')
    expect(Notification.requestPermission).toHaveBeenCalled()
  })
})

describe('getPermission', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns "granted" when permission is granted', () => {
    Notification.permission = 'granted'
    expect(getPermission()).toBe('granted')
  })

  it('returns "denied" when permission is denied', () => {
    Notification.permission = 'denied'
    expect(getPermission()).toBe('denied')
  })

  it('returns "unsupported" when Notification is not available', () => {
    const orig = globalThis.Notification
    delete globalThis.Notification
    expect(getPermission()).toBe('unsupported')
    globalThis.Notification = orig
  })
})

describe('notifyReviewNeeded', () => {
  let NotificationSpy

  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    // Spy on Notification constructor, preserve static properties
    NotificationSpy = vi.fn()
    const origPermission = Notification.permission
    // Replace Notification — use a class that captures calls
    class SpyNotification {
      constructor(title, opts) {
        NotificationSpy(title, opts)
        this.title = title
        this.opts = opts
      }
      static permission = 'granted'
      static requestPermission = vi.fn()
    }
    vi.stubGlobal('Notification', SpyNotification)
  })

  it('creates a Notification with correct title and body for a single new PR', () => {
    const prs = [{ number: 42, title: 'Fix critical bug' }]
    notifyReviewNeeded(prs)

    expect(NotificationSpy).toHaveBeenCalledTimes(1)
    expect(NotificationSpy).toHaveBeenCalledWith(
      'Review needed: #42',
      expect.objectContaining({
        body: 'Fix critical bug',
        icon: './icon.svg',
        tag: 'review-needed',
      })
    )
  })

  it('creates a Notification with summary title for multiple new PRs', () => {
    const prs = [
      { number: 1, title: 'PR one' },
      { number: 2, title: 'PR two' },
      { number: 3, title: 'PR three' },
    ]
    notifyReviewNeeded(prs)

    expect(NotificationSpy).toHaveBeenCalledTimes(1)
    const [title, opts] = NotificationSpy.mock.calls[0]
    expect(title).toBe('3 PRs need your review')
    expect(opts.body).toContain('#1 PR one')
    expect(opts.body).toContain('#2 PR two')
    expect(opts.body).toContain('#3 PR three')
  })

  it('shows at most 3 PRs in the notification body when there are more', () => {
    const prs = Array.from({ length: 5 }, (_, i) => ({
      number: i + 1,
      title: `PR #${i + 1}`,
    }))
    notifyReviewNeeded(prs)

    expect(NotificationSpy).toHaveBeenCalledTimes(1)
    const body = NotificationSpy.mock.calls[0][1].body
    const lines = body.split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('#1')
    expect(lines[2]).toContain('#3')
  })

  it('does nothing when PRs array is empty', () => {
    notifyReviewNeeded([])
    expect(NotificationSpy).not.toHaveBeenCalled()
  })

  it('does not notify for already-seen PRs', () => {
    // Mark PR #42 as seen first
    notifyReviewNeeded([{ number: 42, title: 'First notify' }])
    expect(NotificationSpy).toHaveBeenCalledTimes(1)

    // Same PR again — should not notify
    notifyReviewNeeded([{ number: 42, title: 'Already seen' }])
    expect(NotificationSpy).toHaveBeenCalledTimes(1) // still 1
  })

  it('does nothing when permission is not granted', () => {
    Notification.permission = 'denied'
    notifyReviewNeeded([{ number: 1, title: 'Test' }])
    expect(NotificationSpy).not.toHaveBeenCalled()
  })

  it('tracks seen PRs across multiple notify calls', () => {
    notifyReviewNeeded([{ number: 10, title: 'PR 10' }])
    notifyReviewNeeded([{ number: 20, title: 'PR 20' }])
    expect(NotificationSpy).toHaveBeenCalledTimes(2)

    // Both already seen — no third notification
    notifyReviewNeeded([{ number: 10, title: 'PR 10 again' }, { number: 20, title: 'PR 20 again' }])
    expect(NotificationSpy).toHaveBeenCalledTimes(2)
  })

  it('caps seen list at 100 entries', () => {
    // Create 110 unique PRs
    for (let i = 0; i < 110; i++) {
      notifyReviewNeeded([{ number: i, title: `PR ${i}` }])
    }
    // The seen list should be capped at 100
    expect(NotificationSpy).toHaveBeenCalledTimes(110)

    // A brand new PR should still get notified
    notifyReviewNeeded([{ number: 200, title: 'Fresh PR' }])
    expect(NotificationSpy).toHaveBeenCalledTimes(111)

    // But an old one near the start should be forgotten (capped)
    notifyReviewNeeded([{ number: 0, title: 'Forgotten?' }])
    // If 0 was evicted from the capped list, it would notify again
    // Notification count would be 112 if forgotten
    // Since we can't directly check, verify at least recent ones are known
    notifyReviewNeeded([{ number: 109, title: 'Recent' }])
    expect(NotificationSpy).toHaveBeenCalledTimes(112) // 200 is new
  })
})

describe('getPendingCount', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('returns total count when no PRs are seen', () => {
    const count = getPendingCount([{ number: 1 }, { number: 2 }, { number: 3 }])
    expect(count).toBe(3)
  })

  it('returns 0 when all PRs are seen', () => {
    notifyReviewNeeded([{ number: 1, title: 'x' }, { number: 2, title: 'y' }])
    // After notification, PRs 1 and 2 are in the seen list
    const count = getPendingCount([{ number: 1 }, { number: 2 }])
    expect(count).toBe(0)
  })

  it('counts only unseen PRs', () => {
    notifyReviewNeeded([{ number: 1, title: 'seen' }])
    const count = getPendingCount([{ number: 1 }, { number: 2 }, { number: 3 }])
    expect(count).toBe(2)
  })
})

describe('markAllSeen', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('marks all given PRs as seen', () => {
    markAllSeen([{ number: 1 }, { number: 2 }])
    expect(getPendingCount([{ number: 1 }, { number: 2 }, { number: 3 }])).toBe(1)
  })

  it('merges with existing seen list', () => {
    notifyReviewNeeded([{ number: 1, title: 'first' }])
    markAllSeen([{ number: 2 }, { number: 3 }])
    expect(getPendingCount([{ number: 1 }, { number: 2 }, { number: 3 }, { number: 4 }])).toBe(1)
  })

  it('caps combined list at 100 entries', () => {
    const manyPRs = Array.from({ length: 110 }, (_, i) => ({ number: i }))
    markAllSeen(manyPRs)

    // PR #0 should have been evicted
    // The cap is 100, so 10 oldest entries were removed
    expect(getPendingCount([{ number: 0 }])).toBe(1) // forgotten
    expect(getPendingCount([{ number: 109 }])).toBe(0) // kept
  })
})

describe('clearSeen', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('removes all seen PR tracking', () => {
    notifyReviewNeeded([{ number: 1, title: 'x' }])
    expect(getPendingCount([{ number: 1 }])).toBe(0)

    clearSeen()
    expect(getPendingCount([{ number: 1 }])).toBe(1)
  })
})
