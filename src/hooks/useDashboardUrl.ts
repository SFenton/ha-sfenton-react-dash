import { useEffect, useState } from 'react'
import { DASHBOARD_ROUTE_CHANGE_EVENT, dashboardEventTargets, dashboardHref } from './dashboardLocation'

export function useDashboardUrl() {
  const [url, setUrl] = useState(() => dashboardHref())

  useEffect(() => {
    const handleNavigation = () => setUrl(dashboardHref())
    const targets = dashboardEventTargets()

    targets.forEach((target) => {
      target.addEventListener('popstate', handleNavigation)
      target.addEventListener(DASHBOARD_ROUTE_CHANGE_EVENT, handleNavigation)
    })

    handleNavigation()

    return () => {
      targets.forEach((target) => {
        target.removeEventListener('popstate', handleNavigation)
        target.removeEventListener(DASHBOARD_ROUTE_CHANGE_EVENT, handleNavigation)
      })
    }
  }, [])

  return url
}
