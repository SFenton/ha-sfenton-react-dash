import { useEntity } from '@hakit/core'
import type { VacuumConfig } from '../../constants/portedDashboard'
import { GlassTile } from '../core/GlassTile'
import { asEntityName } from './entityState'
import { vacuumTilePresentation } from './vacuumTilePresentation'

interface VacuumTileBaseProps {
  title?: string
  vacuum: VacuumConfig
}

type VacuumTileProps = VacuumTileBaseProps & {
  interaction:
    | { kind: 'modal'; onOpen: () => void }
    | { kind: 'preload' }
}

function VacuumTileView({
  batteryState,
  onOpen,
  state,
  title,
  vacuum,
}: VacuumTileBaseProps & {
  batteryState?: string
  onOpen?: () => void
  state?: string
}) {
  const presentation = vacuumTilePresentation(state, batteryState)

  return (
    <GlassTile
      backgroundColor={presentation.backgroundColor}
      icon={presentation.icon}
      iconColor={presentation.iconColor}
      isOff={presentation.muted}
      onClick={onOpen}
      semantics={onOpen ? { kind: 'modal' } : undefined}
      subtitle={presentation.subtitle}
      tone={presentation.tileTone}
      title={title ?? vacuum.title}
    />
  )
}

function LiveVacuumTile({
  interaction,
  title,
  vacuum,
}: VacuumTileBaseProps & {
  interaction: Extract<VacuumTileProps['interaction'], { kind: 'modal' }>
}) {
  const entity = useEntity(asEntityName(vacuum.entityId), { returnNullIfNotFound: true })
  const battery = useEntity(asEntityName(vacuum.batteryEntityId), { returnNullIfNotFound: true })

  return (
    <VacuumTileView
      batteryState={battery?.state}
      onOpen={interaction.onOpen}
      state={entity?.state}
      title={title}
      vacuum={vacuum}
    />
  )
}

export function VacuumTile(props: VacuumTileProps) {
  if (props.interaction.kind === 'preload') {
    return <VacuumTileView title={props.title} vacuum={props.vacuum} />
  }

  return <LiveVacuumTile {...props} interaction={props.interaction} />
}
