import { copy, VACUUM_COPY_KEYS, VACUUM_COPY_NAMESPACE } from '../../i18n'
import { titleCaseState } from './entityState'
import { VACUUM_AVAILABILITY_UNAVAILABLE } from './vacuumStatus'
import { isUnavailableVacuumState, vacuumStateVisual, type VacuumVisualState } from './vacuumVisualState'

export interface VacuumTilePresentation extends VacuumVisualState {
  muted: boolean
  subtitle: string
}

function normalizedState(state: string | undefined) {
  return state?.trim().toLowerCase() ?? ''
}

function readableBatteryPercent(state: string | undefined) {
  const normalized = state?.trim() ?? ''
  if (!normalized) return undefined
  const value = Number(normalized)
  return Number.isFinite(value) ? value : undefined
}

export function vacuumTilePresentation(state: string | undefined, batteryState: string | undefined): VacuumTilePresentation {
  const normalized = normalizedState(state)
  const muted = isUnavailableVacuumState(normalized)
  const stateLabel = titleCaseState(normalized || VACUUM_AVAILABILITY_UNAVAILABLE)
  const batteryPercent = muted ? undefined : readableBatteryPercent(batteryState)

  return {
    ...vacuumStateVisual(normalized || undefined),
    muted,
    subtitle: batteryPercent === undefined
      ? stateLabel
      : copy(VACUUM_COPY_NAMESPACE, VACUUM_COPY_KEYS.tile.subtitleWithBattery, { battery: batteryPercent, state: stateLabel }),
  }
}
