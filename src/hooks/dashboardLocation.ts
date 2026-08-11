import { copy } from '../i18n'

export const DASHBOARD_ROUTE_CHANGE_EVENT = 'dashboard-route-change'
export const DASHBOARD_DOCUMENT_TITLE = copy('common', 'app.title')

function canReadWindow(candidate: Window) {
  try {
    return Boolean(candidate.location.href && candidate.history)
  } catch {
    return false
  }
}

function isDashboardShellPath(pathname: string) {
  const parts = pathname.split('/').filter(Boolean)
  return parts.includes('sfenton-react-dash') || parts.includes('at-a-glance')
}

export function dashboardWindow() {
  if (typeof window === 'undefined') return undefined

  const topWindow = window.top
  if (topWindow && topWindow !== window && canReadWindow(topWindow) && isDashboardShellPath(topWindow.location.pathname)) {
    return topWindow
  }

  return window
}

export function dashboardHref() {
  return dashboardWindow()?.location.href ?? ''
}

export function dashboardHash() {
  return dashboardWindow()?.location.hash ?? ''
}

export function dashboardPathWithSearch() {
  const location = dashboardWindow()?.location
  return location ? `${location.pathname}${location.search}` : ''
}

export function dashboardEventTargets() {
  const targetWindow = dashboardWindow()
  if (!targetWindow || targetWindow === window) return [window]
  return [window, targetWindow]
}

export function setDashboardDocumentTitle(title = DASHBOARD_DOCUMENT_TITLE) {
  if (typeof document === 'undefined') return

  document.title = title

  const targetWindow = dashboardWindow()
  if (targetWindow && targetWindow !== window) {
    targetWindow.document.title = title
  }
}

export function dispatchDashboardRouteChange(targetWindow = dashboardWindow()) {
  if (!targetWindow) return
  targetWindow.dispatchEvent(new Event(DASHBOARD_ROUTE_CHANGE_EVENT))
  if (targetWindow !== window) window.dispatchEvent(new Event(DASHBOARD_ROUTE_CHANGE_EVENT))
}

export function pushDashboardUrl(url: string, state: unknown = null) {
  const targetWindow = dashboardWindow()
  if (!targetWindow) return
  targetWindow.history.pushState(state, '', url)
  dispatchDashboardRouteChange(targetWindow)
}

export function replaceDashboardUrl(url: string, state: unknown = null) {
  const targetWindow = dashboardWindow()
  if (!targetWindow) return
  targetWindow.history.replaceState(state, '', url)
  dispatchDashboardRouteChange(targetWindow)
}