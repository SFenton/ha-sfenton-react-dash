import type { ReactNode } from 'react'
import type { BathroomFanConfig } from '../../constants/bathroomFans'
import { BathroomFanCommandContext } from './bathroomFanCommandContext'
import { useBathroomFanCommand } from './useBathroomFanCommand'

export function BathroomFanCommandProvider({ children, config }: { children: ReactNode; config: BathroomFanConfig }) {
  const controller = useBathroomFanCommand(config)
  return (
    <BathroomFanCommandContext.Provider value={{ controller, id: config.id }}>
      {children}
    </BathroomFanCommandContext.Provider>
  )
}
