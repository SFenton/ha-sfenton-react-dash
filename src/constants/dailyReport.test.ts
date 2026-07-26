import { describe, expect, it } from 'vitest'
import {
  DAILY_REPORT_HASH,
  DAILY_REPORT_TABS,
  DAILY_REPORT_USERS,
  dailyReportRouteUrl,
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

  it('lists the summary tabs without an upcoming expirations tab', () => {
    expect(DAILY_REPORT_TABS.map((tab) => tab.tab)).toEqual(['overdue', 'upcoming', 'expired-food'])
  })
})
