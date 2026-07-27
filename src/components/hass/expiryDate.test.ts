import { afterEach, describe, expect, it, vi } from 'vitest'
import { countLocallyExpired, daysUntilExpiryDate, isExpiredOnLocalCalendar } from './expiryDate'

function freezeLocalDate(iso: string) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(iso))
}

describe('expiryDate', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('treats an item dated today as not yet expired, even late in the local evening', () => {
    // 18:20 Pacific is already the next day in UTC, which is why EverShelf reports -1 here.
    freezeLocalDate('2026-07-26T18:20:00-07:00')

    expect(daysUntilExpiryDate('2026-07-26')).toBe(0)
    expect(isExpiredOnLocalCalendar('2026-07-26')).toBe(false)
    expect(isExpiredOnLocalCalendar('2026-07-25')).toBe(true)
    expect(isExpiredOnLocalCalendar('2026-07-27')).toBe(false)
  })

  it('ignores EverShelf days_remaining and re-counts the list on the local calendar', () => {
    freezeLocalDate('2026-07-26T18:20:00-07:00')

    // Exactly the payload the sensor produced: expires today, but flagged -1 by the UTC rollover.
    const expiredList = [
      { name: 'Corn Tortilla Chips', expiry_date: '2026-07-26', days_remaining: -1 },
      { name: 'Old Milk', expiry_date: '2026-07-20', days_remaining: -7 },
    ]

    expect(countLocallyExpired(expiredList)).toBe(1)
  })

  it('handles missing, malformed, and non-array input', () => {
    freezeLocalDate('2026-07-26T09:00:00-07:00')

    expect(countLocallyExpired(undefined)).toBe(0)
    expect(countLocallyExpired(null)).toBe(0)
    expect(countLocallyExpired('nope')).toBe(0)
    expect(countLocallyExpired([{ name: 'No date' }, { expiry_date: 'garbage' }, null])).toBe(0)
    expect(daysUntilExpiryDate(undefined)).toBeNull()
    expect(daysUntilExpiryDate('garbage')).toBeNull()
  })
})
