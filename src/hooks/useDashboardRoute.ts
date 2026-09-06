import { useCallback, useEffect, useRef, useState } from 'react'
import { routePathFromUrl, routeUrl } from '../constants/routes'
import { dashboardHref, pushDashboardUrl, replaceDashboardUrl, setDashboardDocumentTitle, subscribeDashboardLocation } from './dashboardLocation'

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

    return subscribeDashboardLocation(handleNavigation)
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