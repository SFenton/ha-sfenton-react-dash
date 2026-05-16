import { useCallback, useEffect, useState } from 'react'
import { routePathFromUrl } from '../constants/routes'

export function useDashboardRoute() {
  const [path, setPath] = useState(() => routePathFromUrl(window.location.pathname))

  useEffect(() => {
    const handleNavigation = () => setPath(routePathFromUrl(window.location.pathname))
    window.addEventListener('popstate', handleNavigation)
    window.addEventListener('dashboard-route-change', handleNavigation)
    return () => {
      window.removeEventListener('popstate', handleNavigation)
      window.removeEventListener('dashboard-route-change', handleNavigation)
    }
  }, [])

  const navigate = useCallback((url: string) => {
    window.history.pushState({}, '', url)
    window.dispatchEvent(new Event('dashboard-route-change'))
  }, [])

  return { navigate, path }
}