import { useEntity } from '@hakit/core'
import { mdiDoor, mdiDoorOpen, mdiWindowClosed, mdiWindowOpen } from '@mdi/js'
import { Card, type CardColor } from '../core/Card'
import { asEntityName, formatContactEntityState, isContactOpen } from '../hass/entityState'

type ContactSensorKind = 'door' | 'window'

interface ContactSensorCardProps {
  active?: boolean
  ariaLabel?: string
  color?: CardColor
  entityId?: string
  kind?: ContactSensorKind
  onClick?: () => void
  size?: 'standard' | 'compact' | 'bubble' | 'source-row'
  subtitle?: string
  title: string
}

const DEFAULT_CONTACT_COLOR: CardColor = { r: 220, g: 92, b: 68 }
const DOOR_CLOSED_TRANSFORM = 'translate(12 12) scale(1.2 1.03) translate(-12 -12)'

function contactKind(title: string, entityId?: string): ContactSensorKind {
  const value = `${title} ${entityId ?? ''}`.toLowerCase()
  return value.includes('window') ? 'window' : 'door'
}

function MaterialIcon({ path, pathTransform, size = 38 }: { path: string; pathTransform?: string; size?: number }) {
  return (
    <svg aria-hidden="true" fill="currentColor" focusable="false" height={size} viewBox="0 0 24 24" width={size}>
      <path d={path} transform={pathTransform} />
    </svg>
  )
}

function ContactIcon({ active, kind }: { active: boolean; kind: ContactSensorKind }) {
  const path = kind === 'window' ? (active ? mdiWindowOpen : mdiWindowClosed) : active ? mdiDoorOpen : mdiDoor
  return <MaterialIcon path={path} pathTransform={kind === 'door' && !active ? DOOR_CLOSED_TRANSFORM : undefined} />
}

export function ContactSensorCard({ active, ariaLabel, color = DEFAULT_CONTACT_COLOR, entityId, kind, onClick, size = 'standard', subtitle, title }: ContactSensorCardProps) {
  const entity = useEntity(asEntityName(entityId ?? 'binary_sensor.unavailable'), { returnNullIfNotFound: true })
  const isOpen = active ?? isContactOpen(entity)
  const stateText = subtitle ?? (entityId ? formatContactEntityState(entity) : undefined)
  const iconKind = kind ?? contactKind(title, entityId)

  return (
    <Card
      ariaLabel={ariaLabel ?? `${title}${stateText ? ` ${stateText}` : ''}`}
      color={color}
      icon={<ContactIcon active={isOpen} kind={iconKind} />}
      muted={!isOpen}
      onClick={onClick}
      pressed={onClick ? isOpen : undefined}
      size={size}
      subtitle={stateText}
      title={title}
    />
  )
}
