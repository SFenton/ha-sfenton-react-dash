import type { CardColor } from '../components/core/Card'
import type { StatusRailChip } from '../components/hass/StatusRail'
import { SECURITY_ENTITY } from './atAGlance'
import { GARAGE_DOOR_ENTITY_IDS } from './garageDoors'
import { SECURITY_COLOR } from './portedDashboard'

export type SecurityTileTone = 'alarm' | 'cover' | 'lock' | 'vehicle'

export type SecurityTileAction = { type: 'garage-door' } | { type: 'hash'; hash: string } | { type: 'toggle' }

export interface SecurityTileConfig {
  action?: SecurityTileAction
  color?: CardColor
  entityId: string
  icon: string
  title: string
  tone: SecurityTileTone
}

export const SECURITY_STATUS_CHIPS: StatusRailChip[] = [
  {
    title: 'Security',
    icon: 'mdi:shield-outline',
    entityId: SECURITY_ENTITY,
    hash: '#security-system',
    tone: 'security',
    width: 158,
  },
  {
    title: 'Contact Sensors',
    icon: 'mdi:door',
    entityId: 'binary_sensor.contact_sensors',
    hash: '#contact-sensors-overview',
    stateKind: 'contact',
    tone: 'contact',
    width: 190,
  },
]

export const SECURITY_CONTROL_TILES: SecurityTileConfig[] = [
  {
    title: 'Security System',
    entityId: SECURITY_ENTITY,
    icon: 'mdi:shield-outline',
    tone: 'alarm',
    action: { type: 'hash', hash: '#security-system' },
  },
  {
    title: 'Front Door',
    entityId: 'lock.aqara_smart_lock_u400',
    icon: 'mdi:lock',
    tone: 'lock',
    action: { type: 'toggle' },
  },
  {
    title: 'Left Door',
    entityId: GARAGE_DOOR_ENTITY_IDS.left,
    icon: 'mdi:garage',
    tone: 'cover',
    action: { type: 'garage-door' },
  },
  {
    title: 'Right Door',
    entityId: GARAGE_DOOR_ENTITY_IDS.right,
    icon: 'mdi:garage',
    tone: 'cover',
    action: { type: 'garage-door' },
  },
]

export const SECURITY_MACHE_TILES: SecurityTileConfig[] = [
  {
    title: 'Doors',
    entityId: 'lock.fordpass_3fmtk3su5mma09266_doorlock',
    icon: 'mdi:car-door-lock',
    tone: 'vehicle',
    color: SECURITY_COLOR,
    action: { type: 'toggle' },
  },
]
