import { useCallback, useEffect, useState } from 'react'

function currentHash() {
  return window.location.hash
}

export function useHashModal() {
  const [hash, setHash] = useState(currentHash)

  useEffect(() => {
    const syncHash = () => setHash(currentHash())
    window.addEventListener('hashchange', syncHash)
    window.addEventListener('popstate', syncHash)
    return () => {
      window.removeEventListener('hashchange', syncHash)
      window.removeEventListener('popstate', syncHash)
    }
  }, [])

  const openHash = useCallback((nextHash: string) => {
    if (currentHash() === nextHash) return
    window.history.pushState(null, '', nextHash)
    setHash(nextHash)
  }, [])

  const closeHash = useCallback(() => {
    const nextUrl = `${window.location.pathname}${window.location.search}`
    window.history.pushState(null, '', nextUrl)
    setHash('')
  }, [])

  return { hash, openHash, closeHash }
}