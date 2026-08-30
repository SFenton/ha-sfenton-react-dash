import { createContext, useContext } from 'react'
import type { OptimisticResetIntent, OptimisticStateIntent } from '../../constants/actionIntents'
import type { OptimisticCommitOptions } from '../../hooks/useOptimisticState'

export interface OptimisticEntityState {
  commit: (next: string, options?: OptimisticCommitOptions) => number
  displayedState: string
  liveState: string
  reset: (generation?: number) => void
}

export type OptimisticActionStateMap = Readonly<Record<string, OptimisticEntityState | undefined>>

export const OptimisticActionStateContext = createContext<OptimisticActionStateMap>({})

export function useOptimisticActionStates() {
  return useContext(OptimisticActionStateContext)
}

export function optimisticStateValue(entityId: string, liveState: string | undefined, states: OptimisticActionStateMap) {
  return states[entityId]?.displayedState ?? liveState
}

function stateControllers(intents: readonly OptimisticStateIntent[] | undefined, states: OptimisticActionStateMap) {
  if (!intents?.length) return []
  return intents.flatMap((intent) => {
    const controller = states[intent.entityId]
    return controller ? [{ controller, intent }] : []
  })
}

function resetControllers(intents: readonly OptimisticResetIntent[] | undefined, states: OptimisticActionStateMap) {
  if (!intents?.length) return []
  return intents.flatMap((intent) => {
    const controller = states[intent.entityId]
    if (!controller || !intent.values.includes(controller.displayedState)) return []
    return [controller]
  })
}

export function runOptimisticServiceCommand(
  callService: (params: Record<string, unknown>) => unknown,
  params: Record<string, unknown>,
  intents: readonly OptimisticStateIntent[] | undefined,
  resetIntents: readonly OptimisticResetIntent[] | undefined,
  states: OptimisticActionStateMap,
) {
  const controllers = stateControllers(intents, states)
  const controllersToReset = resetControllers(resetIntents, states)
  controllersToReset.forEach((controller) => controller.reset())
  const committed = controllers.map(({ controller, intent }) => ({
    controller,
    generation: controller.commit(intent.value, { revertMs: intent.revertMs }),
  }))
  const serviceParams = controllers.length || controllersToReset.length
    ? { ...params, returnResponse: true }
    : params

  try {
    const result = callService(serviceParams)
    if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
      void Promise.resolve(result).catch(() => {
        committed.forEach(({ controller, generation }) => controller.reset(generation))
      })
    }
    return result
  } catch (error) {
    committed.forEach(({ controller, generation }) => controller.reset(generation))
    throw error
  }
}
