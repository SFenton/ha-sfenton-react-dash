import type { EntityBasicAction, EntityStateAction } from '../../constants/portedDashboard'

interface EntityLike {
  state: string
}

export type EntityActionStateMap = Record<string, EntityLike | null | undefined>

export function resolveEntityAction<TAction extends EntityBasicAction>(
  entityId: string,
  action: TAction | EntityStateAction<TAction> | undefined,
  entities: EntityActionStateMap,
  stateForEntity: (targetEntityId: string) => string | undefined = (targetEntityId) => entities[targetEntityId]?.state,
) {
  if (!action) return undefined
  if (action.type !== 'state') return action

  const stateEntityId = action.entityId ?? entityId
  const state = stateForEntity(stateEntityId)
  const matchedCase = action.cases.find((candidate) => state !== undefined && candidate.states.includes(state))
  return matchedCase?.action ?? action.defaultAction
}