import { createContext, useContext } from 'react'

export const DuoControlLaneContext = createContext<HTMLElement | null>(null)

export function useDuoControlLane() {
  return useContext(DuoControlLaneContext)
}
