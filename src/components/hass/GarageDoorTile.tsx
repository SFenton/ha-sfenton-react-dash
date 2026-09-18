import { useEntity } from '@hakit/core'
import { GlassTile, type GlassTileProps, type TileTone } from '../core/GlassTile'
import { COMMON_COPY_NAMESPACE, GARAGE_DOOR_COPY_KEYS, useCopy } from '../../i18n'
import { asEntityName, formatCompactEntityState } from './entityState'
import { GarageDoorCommandPhase, useGarageDoorCommand } from './useGarageDoorCommand'

interface GarageDoorTileProps {
  backgroundColorForState?: (state: string) => string | undefined
  entityId: string
  errorBackgroundColor?: string
  icon: GlassTileProps['icon']
  title: string
  toneForState?: (state: string, unavailable: boolean) => TileTone
}

export function GarageDoorTile({
  backgroundColorForState,
  entityId,
  errorBackgroundColor,
  icon,
  title,
  toneForState,
}: GarageDoorTileProps) {
  const copy = useCopy(COMMON_COPY_NAMESPACE)
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true })
  const liveState = entity?.state ?? 'unavailable'
  const command = useGarageDoorCommand(entityId, liveState)
  const unavailable = !command.available
  const sendingOpen = copy(GARAGE_DOOR_COPY_KEYS.sendingOpen)
  const sendingClose = copy(GARAGE_DOOR_COPY_KEYS.sendingClose)
  const subtitle = command.phase === GarageDoorCommandPhase.Sending
    ? command.opens ? sendingOpen : sendingClose
    : command.phase === GarageDoorCommandPhase.Error
      ? copy('states.error')
      : formatCompactEntityState(entity, copy('states.unavailable'), command.displayState)
  const announcement = command.phase === GarageDoorCommandPhase.Idle ? '' : subtitle
  const backgroundColor = command.phase === GarageDoorCommandPhase.Error
    ? errorBackgroundColor
    : backgroundColorForState?.(command.displayState)

  return (
    <GlassTile
      announcement={announcement}
      ariaDisabled={command.interactionLocked}
      backgroundColor={unavailable ? undefined : backgroundColor}
      dynamicGridMeasurementLabels={[sendingOpen, sendingClose]}
      icon={icon}
      isOff={unavailable}
      onClick={unavailable ? undefined : command.sendCommand}
      semantics={{ kind: 'command' }}
      subtitle={subtitle}
      title={title}
      tone={command.phase === GarageDoorCommandPhase.Error ? 'danger' : toneForState?.(command.displayState, unavailable) ?? 'neutral'}
    />
  )
}
