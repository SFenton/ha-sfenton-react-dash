import { useCallback, useEffect, useRef, useState } from 'react'
import { routePathFromUrl, routeUrl } from '../constants/routes'
import { DASHBOARD_ROUTE_CHANGE_EVENT, dashboardEventTargets, dashboardHref, pushDashboardUrl, replaceDashboardUrl, setDashboardDocumentTitle } from './dashboardLocation'

export function useDashboardRoute() {
  const [path, setPath] = useState(() => routePathFromUrl(dashboardHref()))
  const currentPathRef = useRef(path)
  const routeHistoryRef = useRef<string[]>([])

  useEffect(() => {
    const handleNavigation = () => {
      const nextPath = routePathFromUrl(dashboardHref())
      currentPathRef.current = nextPath
      setPath(nextPath)
    }

    const targets = dashboardEventTargets()

    targets.forEach((target) => {
      target.addEventListener('popstate', handleNavigation)
      target.addEventListener(DASHBOARD_ROUTE_CHANGE_EVENT, handleNavigation)
    })

    return () => {
      targets.forEach((target) => {
        target.removeEventListener('popstate', handleNavigation)
        target.removeEventListener(DASHBOARD_ROUTE_CHANGE_EVENT, handleNavigation)
      })
    }
  }, [])

  useEffect(() => {
    setDashboardDocumentTitle()
  }, [path])

  const navigate = useCallback((url: string) => {
    const nextPath = routePathFromUrl(url)
    const currentPath = currentPathRef.current
    if (nextPath !== currentPath) {
      const routeHistory = routeHistoryRef.current
      if (routeHistory.at(-1) !== currentPath) routeHistory.push(currentPath)
      currentPathRef.current = nextPath
      setPath(nextPath)
    }
    pushDashboardUrl(url, {})
  }, [])

  const navigateBack = useCallback((fallbackPath?: string) => {
    const currentPath = currentPathRef.current
    const routeHistory = routeHistoryRef.current
    let targetPath = routeHistory.pop()
    while (targetPath === currentPath) {
      targetPath = routeHistory.pop()
    }

    targetPath ??= fallbackPath
    if (!targetPath || targetPath === currentPath) return

    currentPathRef.current = targetPath
    setPath(targetPath)
    replaceDashboardUrl(routeUrl(targetPath, dashboardHref()), {})
  }, [])

  return { navigate, navigateBack, path }
}