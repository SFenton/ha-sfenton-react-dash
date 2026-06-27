import { useCallback, useEffect, useState } from 'react'
import { DASHBOARD_ROUTE_CHANGE_EVENT, dashboardEventTargets, dashboardHash, dashboardPathWithSearch, pushDashboardUrl } from './dashboardLocation'

interface UseHashModalOptions {
  disabled?: boolean
}

function currentHash() {
  return dashboardHash()
}

export function useHashModal({ disabled = false }: UseHashModalOptions = {}) {
  const [hash, setHash] = useState(() => disabled ? '' : currentHash())

  useEffect(() => {
    if (disabled) return undefined

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
  }, [disabled])

  const openHash = useCallback((nextHash: string) => {
    if (disabled) return
    if (currentHash() === nextHash) return
    pushDashboardUrl(nextHash)
    setHash(nextHash)
  }, [disabled])

  const closeHash = useCallback(() => {
    if (disabled) return
    const nextUrl = dashboardPathWithSearch()
    pushDashboardUrl(nextUrl)
    setHash('')
  }, [disabled])

  return { hash: disabled ? '' : hash, openHash, closeHash }
}