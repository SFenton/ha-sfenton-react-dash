import { type VacuumConfig } from '../../constants/portedDashboard'
import { VACUUM_MODAL_TABS } from '../../constants/surfaceSemantics'
import {
  VACUUM_COMMAND_NORMAL,
  type VacuumCommandPolicyMode,
} from './vacuumStatus'

export type VacuumRuntimeMode = 'full' | 'minimal'

export interface VacuumRuntimeSnapshot {
  commandPolicyMode: VacuumCommandPolicyMode
  displayState: string
  liveError: string | undefined
  liveStatusFlag: string | undefined
}

function isResumable(statusFlag: string | undefined) {
  return statusFlag === 'resumable'
}

function canStartVacuumCleaning(
  state: string,
  statusFlag: string | undefined,
  error: string | undefined,
) {
  const resumable = isResumable(statusFlag)
  const lowBattery = error === 'Low battery'
  return !resumable && (
    state === 'docked'
    || state === 'idle'
    || (state === 'error' && !lowBattery)
  )
}

export function vacuumRuntimeMode(snapshot: VacuumRuntimeSnapshot): VacuumRuntimeMode {
  return snapshot.commandPolicyMode === VACUUM_COMMAND_NORMAL
    && canStartVacuumCleaning(
      snapshot.displayState,
      snapshot.liveStatusFlag,
      snapshot.liveError,
    )
    ? 'full'
    : 'minimal'
}

function configuredAutoCleanRooms(vacuum: VacuumConfig) {
  return Boolean(vacuum.autoCleanDisabledRooms?.length)
}

function configuredConsumables(vacuum: VacuumConfig) {
  return vacuum.consumables.length > 0
}

function activeDockRuntimeAction(dockStatus: string | undefined) {
  if (dockStatus === 'cleaning') return 'cleaning'
  if (dockStatus === 'drying') return 'drying'
  return null
}

function vacuumActionsTabVisible(
  vacuum: VacuumConfig,
  runtimeMode: VacuumRuntimeMode,
  dockStatus: string | undefined,
) {
  if (runtimeMode === 'full') return true
  // Any future Actions-tab command must be classified full-only vs active-runtime-visible here and covered by tab-policy tests.
  return Boolean(vacuum.dockControls && activeDockRuntimeAction(dockStatus))
}

export function vacuumModalTabsForMode(
  vacuum: VacuumConfig,
  runtimeMode: VacuumRuntimeMode,
  dockStatus: string | undefined = undefined,
) {
  return VACUUM_MODAL_TABS.filter((tab) => {
    if (runtimeMode === 'minimal') {
      if (tab.tab === 'controls') return true
      if (tab.tab === 'autoClean') return configuredAutoCleanRooms(vacuum)
      if (tab.tab === 'more') return vacuumActionsTabVisible(vacuum, runtimeMode, dockStatus)
      if (tab.tab === 'info') return configuredConsumables(vacuum)
      return false
    }

    if (tab.tab === 'zones') return vacuum.zones.length > 0
    if (tab.tab === 'autoClean') return configuredAutoCleanRooms(vacuum)
    if (tab.tab === 'more') return vacuumActionsTabVisible(vacuum, runtimeMode, dockStatus)
    if (tab.tab === 'info') return configuredConsumables(vacuum)
    return true
  })
}
