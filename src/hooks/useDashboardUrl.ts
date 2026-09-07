import { useEffect, useState } from 'react'
import { dashboardHref, subscribeDashboardLocation } from './dashboardLocation'

export function useDashboardUrl() {
  const [url, setUrl] = useState(() => dashboardHref())

  useEffect(() => {
    const handleNavigation = () => setUrl(dashboardHref())
    const unsubscribe = subscribeDashboardLocation(handleNavigation)
    handleNavigation()
    return unsubscribe
  }, [])

  return url
}
