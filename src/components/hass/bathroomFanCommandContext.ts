import { createContext, useContext } from 'react'
import type { BathroomFanConfig } from '../../constants/bathroomFans'
import type { useBathroomFanCommand } from './useBathroomFanCommand'

export type BathroomFanCommandController = ReturnType<typeof useBathroomFanCommand>

export interface BathroomFanCommandContextValue {
  controller: BathroomFanCommandController
  id: BathroomFanConfig['id']
}

export const BathroomFanCommandContext = createContext<BathroomFanCommandContextValue | null>(null)

export function useSharedBathroomFanCommand(config: BathroomFanConfig) {
  const context = useContext(BathroomFanCommandContext)
  return context?.id === config.id ? context.controller : null
}
