import { useCallback, useEffect, useState } from 'react'
import { routePathFromUrl } from '../constants/routes'
import { DASHBOARD_ROUTE_CHANGE_EVENT, dashboardEventTargets, dashboardHref, pushDashboardUrl } from './dashboardLocation'

export function useDashboardRoute() {
  const [path, setPath] = useState(() => routePathFromUrl(dashboardHref()))

  useEffect(() => {
    const handleNavigation = () => setPath(routePathFromUrl(dashboardHref()))
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

  const navigate = useCallback((url: string) => {
    pushDashboardUrl(url, {})
  }, [])

  return { navigate, path }
}