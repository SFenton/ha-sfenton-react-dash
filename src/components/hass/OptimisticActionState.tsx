import { useCallback, useContext, useMemo, useRef, type ReactNode } from 'react'
import { useEntity } from '@hakit/core'
import { useOptimisticState } from '../../hooks/useOptimisticState'
import { asEntityName } from './entityState'
import { OptimisticActionStateContext } from './optimisticActionState'

function OptimisticEntityStateProvider({ children, entityId }: { children: ReactNode; entityId: string }) {
  const parent = useContext(OptimisticActionStateContext)
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true })
  const liveState = entity?.state ?? 'unavailable'
  const [displayedState, commit, reset] = useOptimisticState(liveState, {
    clearOn: 'confirmation',
  })
  const generationRef = useRef(0)
  const commitGeneration = useCallback((next: string, options?: Parameters<typeof commit>[1]) => {
    const generation = generationRef.current + 1
    generationRef.current = generation
    if (next === liveState) reset()
    else commit(next, options)
    return generation
  }, [commit, liveState, reset])
  const resetGeneration = useCallback((generation?: number) => {
    if (generation !== undefined && generation !== generationRef.current) return
    generationRef.current += 1
    reset()
  }, [reset])
  const value = useMemo(
    () => ({
      ...parent,
      [entityId]: { commit: commitGeneration, displayedState, liveState, reset: resetGeneration },
    }),
    [commitGeneration, displayedState, entityId, liveState, parent, resetGeneration],
  )

  return <OptimisticActionStateContext.Provider value={value}>{children}</OptimisticActionStateContext.Provider>
}

function OptimisticActionStateLayer({ children, entityIds, index }: { children: ReactNode; entityIds: readonly string[]; index: number }) {
  const states = useContext(OptimisticActionStateContext)
  const entityId = entityIds[index]
  if (!entityId) return children

  const next = <OptimisticActionStateLayer entityIds={entityIds} index={index + 1}>{children}</OptimisticActionStateLayer>
  if (states[entityId]) return next
  return <OptimisticEntityStateProvider entityId={entityId}>{next}</OptimisticEntityStateProvider>
}

export function OptimisticActionStateBoundary({ children, entityIds }: { children: ReactNode; entityIds: readonly string[] }) {
  const uniqueEntityIds = [...new Set(entityIds)]
  return <OptimisticActionStateLayer entityIds={uniqueEntityIds} index={0}>{children}</OptimisticActionStateLayer>
}
