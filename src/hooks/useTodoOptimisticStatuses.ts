import { useCallback, useEffect, useRef, useState } from 'react'

interface TodoOptimisticStatusItem {
  status?: string
  summary?: string
  uid?: string
}

type PendingTodoStatus = {
  requestId: number
  status: string
}

type PendingTodoStatuses = Record<string, PendingTodoStatus | undefined>

export interface TodoOptimisticStatuses {
  clearStatus: (identity: string, requestId?: number) => void
  commitStatus: (identity: string, status: string) => number
  confirmStatuses: (items: TodoOptimisticStatusItem[]) => void
  pendingStatuses: PendingTodoStatuses
}

const TODO_OPTIMISTIC_REVERT_MS = 15000

function todoIdentity(item: TodoOptimisticStatusItem) {
  return item.uid ?? item.summary ?? ''
}

export function useTodoOptimisticStatuses(): TodoOptimisticStatuses {
  const [pendingStatuses, setPendingStatuses] = useState<PendingTodoStatuses>({})
  const pendingTimersRef = useRef<Record<string, number | undefined>>({})
  const requestIdRef = useRef(0)

  const clearPendingTimer = useCallback((identity: string) => {
    const timer = pendingTimersRef.current[identity]
    if (timer !== undefined) {
      window.clearTimeout(timer)
      delete pendingTimersRef.current[identity]
    }
  }, [])

  const clearStatus = useCallback((identity: string, requestId?: number) => {
    setPendingStatuses((current) => {
      const currentStatus = current[identity]
      if (!currentStatus || (requestId !== undefined && currentStatus.requestId !== requestId)) return current
      const next = { ...current }
      delete next[identity]
      return next
    })
  }, [])

  const schedulePendingRevert = useCallback((identity: string, requestId: number) => {
    clearPendingTimer(identity)
    pendingTimersRef.current[identity] = window.setTimeout(() => {
      delete pendingTimersRef.current[identity]
      clearStatus(identity, requestId)
    }, TODO_OPTIMISTIC_REVERT_MS)
  }, [clearPendingTimer, clearStatus])

  const commitStatus = useCallback((identity: string, status: string) => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setPendingStatuses((current) => ({ ...current, [identity]: { requestId, status } }))
    schedulePendingRevert(identity, requestId)
    return requestId
  }, [schedulePendingRevert])

  const confirmStatuses = useCallback((items: TodoOptimisticStatusItem[]) => {
    setPendingStatuses((current) => {
      let next: PendingTodoStatuses | null = null

      for (const [identity, pendingStatus] of Object.entries(current)) {
        if (!pendingStatus) continue
        const liveItem = items.find((item) => todoIdentity(item) === identity)
        if (liveItem && liveItem.status !== pendingStatus.status) continue
        next ??= { ...current }
        delete next[identity]
      }

      return next ?? current
    })
  }, [])

  useEffect(() => {
    return () => {
      for (const timer of Object.values(pendingTimersRef.current)) {
        if (timer !== undefined) window.clearTimeout(timer)
      }
      pendingTimersRef.current = {}
    }
  }, [])

  return { clearStatus, commitStatus, confirmStatuses, pendingStatuses }
}
