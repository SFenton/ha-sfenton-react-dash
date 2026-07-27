const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Shared local-calendar expiry rules.
 *
 * EverShelf computes `days_remaining` server side in UTC, so from ~5pm Pacific an item dated today
 * already reports -1 and lands in `expired_list`. Anything user facing must classify against the
 * local calendar day instead, and must do it in one place so the food page, the summary modal and
 * the profile badge can never disagree about what "expired" means.
 */
export function parseIsoDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  const [, year, month, day] = match
  return new Date(Number(year), Number(month) - 1, Number(day))
}

export function todayDateOnly() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export function daysUntilDate(value: Date) {
  return Math.ceil((value.getTime() - todayDateOnly().getTime()) / DAY_MS)
}

export function daysUntilExpiryDate(value: string | null | undefined) {
  if (!value) return null
  const expiryDate = parseIsoDateOnly(value)
  return expiryDate ? daysUntilDate(expiryDate) : null
}

export function isExpiredOnLocalCalendar(value: string | null | undefined) {
  const days = daysUntilExpiryDate(value)
  return days !== null && days < 0
}

interface ExpiryDatedItem {
  expiry_date?: string | null
}

/** Counts only the items that are expired by the local calendar, ignoring EverShelf's UTC rollover. */
export function countLocallyExpired(items: unknown) {
  if (!Array.isArray(items)) return 0
  return items.filter((item) => {
    if (!item || typeof item !== 'object') return false
    return isExpiredOnLocalCalendar((item as ExpiryDatedItem).expiry_date)
  }).length
}
