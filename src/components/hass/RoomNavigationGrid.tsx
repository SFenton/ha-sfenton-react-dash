import { useMemo } from 'react'
import { useHass } from '@hakit/core'
import { RoomCard } from '../cards/RoomCard'
import {
  AREA_ITEMS,
  ROOM_ACCESS_INCREMENT_SCRIPT_ENTITY_ID,
  type RoomNavigationConfig,
} from '../../constants/atAGlance'
import type { ModalSquareGridStyle } from '../core/modalSquareGrid'
import { rankRoomsByAccess } from './roomAccessRanking'
import styles from './RoomNavigationGrid.module.css'

interface RoomNavigationGridProps {
  ariaLabel: string
  gridRef?: (node: HTMLElement | null) => void
  gridStyle?: ModalSquareGridStyle
  onNavigate: (path: string) => void
}

export function RoomNavigationGrid({ ariaLabel, gridRef, gridStyle, onNavigate }: RoomNavigationGridProps) {
  const callService = useHass((state) => state.helpers.callService)
  const entities = useHass((state) => state.entities)
  const rankedAreas = useMemo(() => rankRoomsByAccess(AREA_ITEMS, entities), [entities])

  const handleNavigate = (area: RoomNavigationConfig, path: string) => {
    onNavigate(path)
    try {
      void Promise.resolve(callService({
        domain: 'script',
        service: 'turn_on',
        target: ROOM_ACCESS_INCREMENT_SCRIPT_ENTITY_ID,
        serviceData: { variables: { room: area.accessKey } },
      })).catch((error: unknown) => {
        console.error(`Failed to increment room access for ${area.accessKey}.`, error)
      })
    } catch (error) {
      console.error(`Failed to increment room access for ${area.accessKey}.`, error)
    }
  }

  return (
    <section aria-label={ariaLabel} className={styles.grid} ref={gridRef} style={gridStyle}>
      {rankedAreas.map((area, index) => (
        <div className={styles.cell} data-modal-detail-autofocus={index === 0 ? 'true' : undefined} key={area.title}>
          <RoomCard area={area} onNavigate={(path) => handleNavigate(area, path)} />
        </div>
      ))}
    </section>
  )
}
