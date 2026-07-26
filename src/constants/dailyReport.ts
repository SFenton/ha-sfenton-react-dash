import { DAILY_REPORT_HASH, DAILY_REPORT_USER_QUERY_KEY, routeUrl } from './routes'

export { DAILY_REPORT_HASH, DAILY_REPORT_QUERY_KEYS, DAILY_REPORT_USER_QUERY_KEY } from './routes'

export const DAILY_REPORT_HOST_ROUTE_PATH = 'overview'

export type DailyReportTab = 'expired-food' | 'overdue' | 'upcoming'

export interface DailyReportTabConfig {
  icon: string
  label: string
  tab: DailyReportTab
}

export interface DailyReportUserConfig {
  aliases: string[]
  choresPath: string
  color: { b: number; g: number; r: number }
  haUserId?: string
  key: string
  name: string
  todoEntityIds: {
    noDueDate: string
    overdue: string
    upcoming: string
  }
}

export const DAILY_REPORT_TABS: DailyReportTabConfig[] = [
  { icon: 'mdi:alert-circle', label: 'Overdue Chores', tab: 'overdue' },
  { icon: 'mdi:clipboard-list', label: 'Upcoming Chores', tab: 'upcoming' },
  { icon: 'mdi:food-off-outline', label: 'Expired Food', tab: 'expired-food' },
]

export const DAILY_REPORT_USERS: DailyReportUserConfig[] = [
  {
    aliases: ['stephen', 'stephen-fenton', 'sfenton'],
    choresPath: 'stephens-chores',
    color: { b: 120, g: 96, r: 0 },
    haUserId: '64089b5683944c39b4f944c8f76830b0',
    key: 'stephen',
    name: 'Stephen',
    todoEntityIds: {
      noDueDate: 'todo.stephen_s_no_due_date_with_unassigned',
      overdue: 'todo.stephen_s_past_due_with_unassigned',
      upcoming: 'todo.stephen_s_due_today_with_unassigned',
    },
  },
  {
    aliases: ['steph', 'stephanie'],
    choresPath: 'stephs-chores',
    color: { b: 0, g: 108, r: 212 },
    haUserId: '43cb71bbd1cb4860b2a7de4c829020f0',
    key: 'steph',
    name: 'Steph',
    todoEntityIds: {
      noDueDate: 'todo.steph_s_no_due_date_with_unassigned',
      overdue: 'todo.steph_s_past_due_with_unassigned',
      upcoming: 'todo.steph_s_due_today_with_unassigned',
    },
  },
]

export const DAILY_REPORT_FALLBACK_TITLE = 'Summary'

export const EVERSHELF_EXPIRED_ITEMS_ENTITY_ID = 'sensor.evershelf_expired_items'

const URL_PARSE_ORIGIN = 'http://ha-sfenton-react-dash.local'

function normalizedKey(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

export function dailyReportUserConfig(userKey: string | null | undefined) {
  const normalized = normalizedKey(userKey)
  if (!normalized) return undefined
  return DAILY_REPORT_USERS.find((user) => user.key === normalized || user.aliases.includes(normalized) || normalizedKey(user.name) === normalized)
}

export function dailyReportUserConfigForHaUserId(haUserId: string | null | undefined) {
  const normalized = normalizedKey(haUserId)
  if (!normalized) return undefined
  return DAILY_REPORT_USERS.find((user) => user.haUserId === normalized)
}

export function dailyReportTitle(user: DailyReportUserConfig | undefined) {
  return user ? `${user.name}'s ${DAILY_REPORT_FALLBACK_TITLE}` : DAILY_REPORT_FALLBACK_TITLE
}

export function dailyReportTabLabel(tab: DailyReportTab) {
  return DAILY_REPORT_TABS.find((item) => item.tab === tab)?.label ?? DAILY_REPORT_TABS[0].label
}

function parseReportUrl(url: string | undefined) {
  if (!url) return undefined
  try {
    return new URL(url, URL_PARSE_ORIGIN)
  } catch {
    return undefined
  }
}

export function dailyReportUserKeyFromUrl(url: string | undefined) {
  const value = parseReportUrl(url)?.searchParams.get(DAILY_REPORT_USER_QUERY_KEY)
  return dailyReportUserConfig(value)?.key
}

export function dailyReportUrl(userKey: string, basePath = '/sfenton-react-dash/home') {
  const params = new URLSearchParams({ path: DAILY_REPORT_HOST_ROUTE_PATH, [DAILY_REPORT_USER_QUERY_KEY]: userKey })
  return `${basePath}?${params.toString()}${DAILY_REPORT_HASH}`
}

export function dailyReportRouteUrl(userKey: string, currentUrl?: string) {
  const parsedUrl = new URL(routeUrl(DAILY_REPORT_HOST_ROUTE_PATH, currentUrl, DAILY_REPORT_HASH), URL_PARSE_ORIGIN)
  parsedUrl.searchParams.set(DAILY_REPORT_USER_QUERY_KEY, userKey)
  return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`
}
