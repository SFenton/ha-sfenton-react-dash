import { useEntity, useHass } from '@hakit/core'
import { GlassTile } from '../core/GlassTile'
import { VACUUM_COLOR } from '../../constants/portedDashboard'
import type { VacuumAutoCleanControlConfig } from '../../constants/vacuumAutoClean'
import { useOptimisticState } from '../../hooks/useOptimisticState'
import { asEntityName } from './entityState'

type CallService = (params: Record<string, unknown>) => void

const CONTROL_REVERT_MS = 8000

function isUnavailableState(state: string | undefined) {
  return !state || state === 'unavailable' || state === 'unknown'
}

function cardBackgroundColor() {
  return `rgba(${VACUUM_COLOR.r}, ${VACUUM_COLOR.g}, ${VACUUM_COLOR.b}, 0.6)`
}

function serviceDomainFor(control: VacuumAutoCleanControlConfig) {
  return control.kind === 'automation' ? 'automation' : 'switch'
}

function isAutoCleanEnabled(control: VacuumAutoCleanControlConfig, state: string) {
  if (control.kind === 'main-floor-pause') return state === 'off'
  return state === 'on'
}

function nextStateFor(state: string) {
  return state === 'on' ? 'off' : 'on'
}

export function VacuumAutoCleanControlCard({ control }: { control: VacuumAutoCleanControlConfig }) {
  const entity = useEntity(asEntityName(control.entityId), { returnNullIfNotFound: true })
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const liveState = entity?.state ?? 'unavailable'
  const [displayState, commitDisplayState] = useOptimisticState(liveState, { clearOn: 'confirmation', revertMs: CONTROL_REVERT_MS })
  const disabled = !entity || isUnavailableState(displayState)
  const enabled = !disabled && isAutoCleanEnabled(control, displayState)
  const subtitle = disabled ? 'Unavailable' : enabled ? 'Enabled' : 'Paused'

  return (
    <GlassTile
      backgroundColor={enabled ? cardBackgroundColor() : undefined}
      icon={control.icon}
      isOff={disabled || !enabled}
      onClick={disabled ? undefined : () => {
        const nextState = nextStateFor(displayState)
        commitDisplayState(nextState)
        callService({
          domain: serviceDomainFor(control),
          service: nextState === 'on' ? 'turn_on' : 'turn_off',
          target: control.entityId,
        })
      }}
      pressed={enabled}
      subtitle={subtitle}
      title={control.title}
      tone="vacuum"
    />
  )
}
