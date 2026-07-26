import { useCallback, useEffect, useState } from 'react'
import { DAILY_REPORT_HASH } from '../constants/routes'
import { DASHBOARD_ROUTE_CHANGE_EVENT, dashboardEventTargets, dashboardHash, dashboardPathWithSearch, pushDashboardUrl, replaceDashboardUrl } from './dashboardLocation'

interface UseHashModalOptions {
  /** App chrome hosts the modal for every route instead of a single page. */
  appLevel?: boolean
  disabled?: boolean
}

/** Hashes owned by app-level chrome. Page hash-modal hosts must ignore them so both sheets never open at once. */
const APP_LEVEL_HASHES = new Set<string>([DAILY_REPORT_HASH])

function currentHash() {
  return dashboardHash()
}

function hashInScope(hash: string, appLevel: boolean) {
  if (!hash) return false
  return APP_LEVEL_HASHES.has(hash) === appLevel
}

function scopedHash(hash: string, appLevel: boolean) {
  return hashInScope(hash, appLevel) ? hash : ''
}

export function useHashModal({ appLevel = false, disabled = false }: UseHashModalOptions = {}) {
  const [hash, setHash] = useState(() => disabled ? '' : scopedHash(currentHash(), appLevel))

  useEffect(() => {
    if (disabled) return undefined

    const syncHash = () => setHash(scopedHash(currentHash(), appLevel))
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
  }, [appLevel, disabled])

  const openHash = useCallback((nextHash: string) => {
    if (disabled) return
    if (currentHash() === nextHash) return
    pushDashboardUrl(nextHash)
    setHash(scopedHash(nextHash, appLevel))
  }, [appLevel, disabled])

  const closeHash = useCallback(() => {
    if (disabled) return
    const nextUrl = dashboardPathWithSearch()
    replaceDashboardUrl(nextUrl)
    setHash('')
  }, [disabled])

  return { hash: disabled ? '' : hash, openHash, closeHash }
}
