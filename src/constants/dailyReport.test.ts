import { describe, expect, it } from 'vitest'
import {
  DAILY_REPORT_AUTO_TAB,
  DAILY_REPORT_HASH,
  DAILY_REPORT_TABS,
  DAILY_REPORT_USERS,
  dailyReportAutoTab,
  dailyReportRouteUrl,
  dailyReportTabRequestFromUrl,
  dailyReportTitle,
  dailyReportUrl,
  dailyReportUserConfig,
  dailyReportUserConfigForHaUserId,
  dailyReportUserKeyFromUrl,
} from './dailyReport'

describe('dailyReport constants', () => {
  it('resolves users by key, alias, and display name', () => {
    expect(dailyReportUserConfig('stephen')?.key).toBe('stephen')
    expect(dailyReportUserConfig('Stephen')?.key).toBe('stephen')
    expect(dailyReportUserConfig(' sfenton ')?.key).toBe('stephen')
    expect(dailyReportUserConfig('steph')?.key).toBe('steph')
    expect(dailyReportUserConfig('Stephanie')?.key).toBe('steph')
    expect(dailyReportUserConfig('nobody')).toBeUndefined()
    expect(dailyReportUserConfig(undefined)).toBeUndefined()
  })

  it('resolves the signed-in Home Assistant user', () => {
    expect(dailyReportUserConfigForHaUserId('64089b5683944c39b4f944c8f76830b0')?.key).toBe('stephen')
    expect(dailyReportUserConfigForHaUserId('43cb71bbd1cb4860b2a7de4c829020f0')?.key).toBe('steph')
    expect(dailyReportUserConfigForHaUserId('unknown-user')).toBeUndefined()
  })

  it('titles the summary per user', () => {
    expect(dailyReportTitle(dailyReportUserConfig('stephen'))).toBe("Stephen's Summary")
    expect(dailyReportTitle(dailyReportUserConfig('steph'))).toBe("Steph's Summary")
    expect(dailyReportTitle(undefined)).toBe('Summary')
  })

  it('maps every user to per-user chore list entities', () => {
    for (const user of DAILY_REPORT_USERS) {
      expect(user.todoEntityIds.overdue).toMatch(/^todo\..+_past_due_with_unassigned$/)
      expect(user.todoEntityIds.upcoming).toMatch(/^todo\..+_due_today_with_unassigned$/)
      expect(user.todoEntityIds.noDueDate).toMatch(/^todo\..+_no_due_date_with_unassigned$/)
    }
  })

  // Donetick exposes both assigned-only and "_with_unassigned" views; the summary must always use
  // the unassigned-inclusive views so shared chores nobody claimed still show up.
  it('always reads the unassigned-inclusive Donetick lists', () => {
    for (const user of DAILY_REPORT_USERS) {
      for (const entityId of Object.values(user.todoEntityIds)) {
        expect(entityId.endsWith('_with_unassigned')).toBe(true)
      }
    }
  })

  it('reads the summary user from a deep link', () => {
    expect(dailyReportUserKeyFromUrl('/sfenton-react-dash/home?path=overview&user=stephen#daily-report')).toBe('stephen')
    expect(dailyReportUserKeyFromUrl('/sfenton-react-dash/home?path=overview&user=stephanie#daily-report')).toBe('steph')
    expect(dailyReportUserKeyFromUrl('/sfenton-react-dash/home?path=overview')).toBeUndefined()
    expect(dailyReportUserKeyFromUrl(undefined)).toBeUndefined()
  })

  it('builds deep link URLs that open the summary modal on the home route', () => {
    expect(dailyReportUrl('stephen')).toBe(`/sfenton-react-dash/home?path=overview&user=stephen${DAILY_REPORT_HASH}`)
    expect(dailyReportUrl('steph', '/local/ha-sfenton-react-dash/index.html')).toBe(`/local/ha-sfenton-react-dash/index.html?path=overview&user=steph${DAILY_REPORT_HASH}`)
  })

  it('builds location-aware summary URLs for in-app navigation', () => {
    expect(dailyReportRouteUrl('stephen', '/sfenton-react-dash/home?path=security')).toBe(`/sfenton-react-dash/home?path=overview&user=stephen${DAILY_REPORT_HASH}`)
    expect(dailyReportRouteUrl('steph', '/sfenton-react-dash/home?path=overview&user=stephen')).toBe(`/sfenton-react-dash/home?path=overview&user=steph${DAILY_REPORT_HASH}`)
    expect(dailyReportRouteUrl('stephen')).toBe(`/at-a-glance/overview?user=stephen${DAILY_REPORT_HASH}`)
  })

  it('reads the requested tab from a notification link', () => {
    expect(dailyReportTabRequestFromUrl('/x?user=stephen&tab=auto#daily-report')).toBe(DAILY_REPORT_AUTO_TAB)
    expect(dailyReportTabRequestFromUrl('/x?user=stephen&tab=expired-food#daily-report')).toBe('expired-food')
    expect(dailyReportTabRequestFromUrl('/x?user=stephen&tab=OVERDUE#daily-report')).toBe('overdue')
    expect(dailyReportTabRequestFromUrl('/x?user=stephen&tab=nonsense#daily-report')).toBeUndefined()
    expect(dailyReportTabRequestFromUrl('/x?user=stephen#daily-report')).toBeUndefined()
    expect(dailyReportTabRequestFromUrl(undefined)).toBeUndefined()
  })

  it('auto-selects overdue, then expired food, then upcoming', () => {
    expect(dailyReportAutoTab({ expiredFood: 5, overdue: 2, upcoming: 9 })).toBe('overdue')
    expect(dailyReportAutoTab({ expiredFood: 5, overdue: 0, upcoming: 9 })).toBe('expired-food')
    expect(dailyReportAutoTab({ expiredFood: 0, overdue: 0, upcoming: 9 })).toBe('upcoming')
    // Overdue wins even when it is the smallest pile.
    expect(dailyReportAutoTab({ expiredFood: 40, overdue: 1, upcoming: 40 })).toBe('overdue')
    // Nothing outstanding falls back to the first tab.
    expect(dailyReportAutoTab({ expiredFood: 0, overdue: 0, upcoming: 0 })).toBe('overdue')
  })

  it('builds notification links that request auto tab selection', () => {
    expect(dailyReportUrl('stephen', '/sfenton-react-dash/home', DAILY_REPORT_AUTO_TAB))
      .toBe(`/sfenton-react-dash/home?path=overview&user=stephen&tab=auto${DAILY_REPORT_HASH}`)
    expect(dailyReportUrl('stephen')).toBe(`/sfenton-react-dash/home?path=overview&user=stephen${DAILY_REPORT_HASH}`)
  })

  it('lists the summary tabs without an upcoming expirations tab', () => {
    expect(DAILY_REPORT_TABS.map((tab) => tab.tab)).toEqual(['overdue', 'upcoming', 'expired-food'])
  })
})
