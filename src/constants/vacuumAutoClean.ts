type VacuumAutoCleanControlKind = 'automation' | 'main-floor-pause'

export interface VacuumAutoCleanControlConfig {
  entityId: string
  icon: string
  kind: VacuumAutoCleanControlKind
  title: string
}

export const MAIN_FLOOR_VACUUM_PAUSE_ENTITY_ID = 'switch.main_floor_vacuum_coordinator_pause'

export const VACUUM_AUTO_CLEAN_CONTROLS: VacuumAutoCleanControlConfig[] = [
  { title: 'Main Floor', entityId: MAIN_FLOOR_VACUUM_PAUSE_ENTITY_ID, icon: 'mdi:robot-vacuum', kind: 'main-floor-pause' },
  { title: 'Music Room', entityId: 'automation.automatically_vacuum_or_mop_music_room', icon: 'mdi:robot-vacuum', kind: 'automation' },
  { title: 'Theater Room', entityId: 'automation.automatically_vacuum_theater_room_on_schedule', icon: 'mdi:robot-vacuum', kind: 'automation' },
]
