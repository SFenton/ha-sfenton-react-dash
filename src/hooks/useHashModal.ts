import { useCallback, useEffect, useState } from 'react'
import { DASHBOARD_ROUTE_CHANGE_EVENT, dashboardEventTargets, dashboardHash, dashboardPathWithSearch, pushDashboardUrl } from './dashboardLocation'

function currentHash() {
  return dashboardHash()
}

export function useHashModal() {
  const [hash, setHash] = useState(currentHash)

  useEffect(() => {
    const syncHash = () => setHash(currentHash())
    const targets = dashboardEventTargets()

    targets.forEach((target) => {
      target.addEventListener('hashchange', syncHash)
      target.addEventListener('popstate', syncHash)
      target.addEventListener(DASHBOARD_ROUTE_CHANGE_EVENT, syncHash)
    })

    return () => {
      targets.forEach((target) => {
        target.removeEventListener('hashchange', syncHash)
        target.removeEventListener('popstate', syncHash)
        target.removeEventListener(DASHBOARD_ROUTE_CHANGE_EVENT, syncHash)
      })
    }
  }, [])

  const openHash = useCallback((nextHash: string) => {
    if (currentHash() === nextHash) return
    pushDashboardUrl(nextHash)
    setHash(nextHash)
  }, [])

  const closeHash = useCallback(() => {
    const nextUrl = dashboardPathWithSearch()
    pushDashboardUrl(nextUrl)
    setHash('')
  }, [])

  return { hash, openHash, closeHash }
}