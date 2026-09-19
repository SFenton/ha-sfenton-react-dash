export const LEGACY_REACT_DASHBOARD_HOST = 'sfenton-react-dash'
export const PANEL_REACT_DASHBOARD_HOST = 'sfenton-react-panel'
export const IOS_TEST_REACT_DASHBOARD_HOST = 'sfenton-react-ios-test'
export const SOURCE_DASHBOARD_HOST = 'at-a-glance'

export const DASHBOARD_ROUTE_HOSTS = [
  LEGACY_REACT_DASHBOARD_HOST,
  PANEL_REACT_DASHBOARD_HOST,
  IOS_TEST_REACT_DASHBOARD_HOST,
  SOURCE_DASHBOARD_HOST,
] as const

export function dashboardRouteHostIndex(parts: string[]) {
  return DASHBOARD_ROUTE_HOSTS.reduce(
    (latestIndex, host) => Math.max(latestIndex, parts.lastIndexOf(host)),
    -1,
  )
}

export function isDashboardRouteHostPath(pathname: string) {
  const parts = pathname.split('/').filter(Boolean)
  return DASHBOARD_ROUTE_HOSTS.some((host) => parts.includes(host))
}
