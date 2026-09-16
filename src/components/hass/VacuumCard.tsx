import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useEntity, useHass } from '@hakit/core'
import { Description } from '../core/Description'
import { InlineAlert } from '../core/InlineAlert'
import { InfoBox } from '../core/InfoBox'
import { DynamicGrid } from '../core/DynamicGrid'
import { MaterialIcon } from '../core/Icon'
import { ModalActionButton, type ModalActionTone } from '../core/ModalActionFooter'
import { ModalIconTabNav } from '../core/ModalTabNav'
import { modalTabId, modalTabPanelId } from '../core/modalTabIds'
import { ModalSheet, type ModalCenteredGeometry } from '../core/ModalSheet'
import { useModalSheetPresentation } from '../core/modalSheetPresentation'
import { NativeSelectField } from '../core/NativeSelectField'
import { DashboardPageLoading } from '../shell/DashboardPageLoading'
import { StatusPill } from '../core/StatusPill'
import { type VacuumAutoCleanDisabledRoomConfig, type VacuumConfig, type VacuumConsumableConfig, type VacuumZoneConfig } from '../../constants/portedDashboard'
import { VACUUM_MODAL_TABS, type VacuumModalTab } from '../../constants/surfaceSemantics'
import { DASHBOARD_PAGE_LOAD_TIMEOUT_MS } from '../../constants/loading'
import { DASHBOARD_ROUTE_CHANGE_EVENT, dashboardEventTargets, dashboardHash, dashboardPathWithSearch, replaceDashboardUrl } from '../../hooks/dashboardLocation'
import { useModalDetailPageScroll } from '../../hooks/useModalDetailPageScroll'
import { useSmoothDisplayedModalTab } from '../../hooks/useSmoothDisplayedModalTab'
import { useOptimisticState, type OptimisticCommitOptions } from '../../hooks/useOptimisticState'
import { APP_LOCALE, COMMON_COPY_NAMESPACE, CORE_COPY_KEYS, CORE_COPY_NAMESPACE, VACUUM_COPY_KEYS, VACUUM_COPY_NAMESPACE, useCopy } from '../../i18n'
import { asEntityName, titleCaseState } from './entityState'
import { mapGridRectDimensionsCm, mapGridRectToServiceData, type MapGridRect } from './ValetudoMapGeometry'
import {
  VALETUDO_MAP_PROVENANCE_NONE,
  VALETUDO_MAP_PROVENANCE_REPORTED,
  VALETUDO_MAP_SCOPE_FULL,
  ValetudoMapCard,
  ValetudoReportedMapNotice,
  type ValetudoMapEditorMeta,
  type ValetudoMapProvenance,
} from './ValetudoMapCard'
import { VacuumOutcomeDetail, VacuumOutcomeOverview } from './VacuumOutcomes'
import { vacuumWhileAwayPresentation, type VacuumOutcomeContract, type VacuumWhileAwayPresentation } from './vacuumOutcomes'
import {
  nativeVacuumIssue,
  resolveVacuumStatusContract,
  vacuumAvailabilityStatus,
  VACUUM_AVAILABILITY_AVAILABLE,
  VACUUM_AVAILABILITY_UNKNOWN,
  VACUUM_COMMAND_NONE,
  VACUUM_COMMAND_NORMAL,
  VACUUM_COMMAND_RESTRICTED,
  VACUUM_CONDITION_DERIVED,
  VACUUM_CONTRACT_TYPED,
  VACUUM_ISSUE_CLEAR,
  VACUUM_ISSUE_PRESENT,
  VACUUM_ISSUE_UNKNOWN,
  type VacuumActiveCondition,
  type VacuumCommandPolicyMode,
  type VacuumCurrentIssue,
  type VacuumLastIssue,
} from './vacuumStatus'
import {
  vacuumModalTabsForMode,
  vacuumRuntimeMode,
  type VacuumRuntimeMode,
} from './vacuumModalRuntime'
import { isUnavailableVacuumState, vacuumConsumableVisual, vacuumStateVisual, type VacuumVisualTone } from './vacuumVisualState'
import { VacuumTile } from './VacuumTile'
import styles from './VacuumCard.module.css'

const VACUUM_CENTERED_GEOMETRY = {
  blockPolicy: 'fixed',
  blockSize: '760px',
  id: 'vacuum',
  inlineSize: '980px',
} satisfies ModalCenteredGeometry

type VacuumCleanTarget = 'rooms' | 'area'
type VacuumMapStatusLayout = 'stacked' | 'split'
type VacuumLayoutPreparationPhase = 'content' | 'exiting' | 'loading'
type VacuumViewportLayout = 'portrait' | 'short-landscape' | 'tall-landscape'

const VACUUM_LAYOUT_LOADING_MIN_MS = 120
const VACUUM_LAYOUT_LOADING_EXIT_MS = 500

function vacuumViewportLayout(mapStatusLayout: VacuumMapStatusLayout): VacuumViewportLayout {
  if (typeof window === 'undefined' || window.innerWidth <= window.innerHeight) return 'portrait'
  return mapStatusLayout === 'split' ? 'short-landscape' : 'tall-landscape'
}
const CLEANING_SETUP_DESCRIPTION = 'Choose how many passes the vacuum should make, then start cleaning with the selected rooms.'
const AUTO_CLEAN_DISABLED_DESCRIPTION = 'Check rooms that should be skipped when the coordinator starts an automatic away clean. Use this for closed doors, guests, or projects on the floor; manual selected-room cleans still use the Zones tab.'
const MODE_DESCRIPTION = 'Choose whether the robot vacuums, mops, or combines both for the next run.'
const FAN_DESCRIPTION = 'Adjust suction strength for carpets, hard floors, and quieter cleaning.'
const WATER_DESCRIPTION = 'Set mop water flow so floors get the right amount of moisture.'
const AREA_DESCRIPTION = 'Draw one rectangular cleaning area on the map. The vacuum will use the mode, suction, water, and pass settings shown below.'
const AREA_EDITOR_DESCRIPTION = 'Drag to draw an area, drag inside it to move it, and drag any round corner handle to resize it. Pinch or scroll to zoom.'
const ROOM_ORDER_DESCRIPTION = 'Rooms are cleaned in the order you select them. The numbered badges show the current cleaning sequence.'
const VACUUM_OPTIMISTIC_REVERT_MS = 8000
const VACUUM_CLEAN_START_REVERT_MS = 30000
const VACUUM_CLEAN_SETTLE_QUIET_MS = 650
const CONDITION_DOCK_PATTERN = /dock/
const CONDITION_FALLBACK_PATTERN = /fallback/
const CONDITION_RESUME_PATTERN = /resume/
const CONDITION_VACUUM_ONLY_PATTERN = /vacuum_only/
const NORMAL_COMMAND_STATES = new Set(['docked', 'idle'])
const BUSY_DOCK_STATES = new Set(['cleaning', 'drying', 'emptying', 'error', 'pause', 'paused'])
const COMMAND_POLICY_RANK: Record<VacuumCommandPolicyMode, number> = {
  [VACUUM_COMMAND_NONE]: 2,
  [VACUUM_COMMAND_NORMAL]: 0,
  [VACUUM_COMMAND_RESTRICTED]: 1,
}
const SOURCE_UNREADABLE_REASON = 'source_unreadable'

type CallService = (params: Record<string, unknown>) => unknown

interface EntityLike {
  attributes: Record<string, unknown>
  entity_id: string
  last_changed?: string
  state: string
}

interface VacuumCardProps {
  preload?: boolean
  vacuum: VacuumConfig
}

interface OptimisticVacuumState {
  commitState: (nextState: string, options?: OptimisticCommitOptions) => void
  liveState: string
  state: string
}

interface VacuumPendingIntent {
  expectedState: string
  issuedAt: number
  orderAt: number
}

interface VacuumCleanCommand {
  action: string
  serviceData?: Record<string, unknown>
}

interface VacuumCommandCoordinator {
  cleanError: string | null
  cleanQueued: boolean
  controlsDisabled: boolean
  confirmIntent: (entityId: string, liveState: string | undefined) => void
  intentRevision: number
  pendingIntentCount: number
  pendingIntentOrderAt: (entityId: string) => number | undefined
  pendingIntentState: (entityId: string) => string | undefined
  registerIntent: (entityId: string, expectedState: string) => void
  requestClean: (action: string, serviceData?: Record<string, unknown>) => void
}

interface ResolvedVacuumStatus {
  activeConditions: VacuumActiveCondition[]
  availability: ReturnType<typeof vacuumAvailabilityStatus>
  commandPolicyMode: VacuumCommandPolicyMode
  commandPolicyReason: string | null
  currentIssue: VacuumCurrentIssue
  lastIssue: VacuumLastIssue | null
  primaryAvailable: boolean
  primaryRevision?: string
}

const VACUUM_MODAL_PREVIEW_EVENT = 'react-dash:vacuum-modal-preview-mode'
let vacuumModalPreviewMode: VacuumModalPreviewMode = 'live'
let vacuumModalPreviewRegistrations = 0

interface VacuumModalRuntime {
  optimisticState: OptimisticVacuumState
  runtimeMode: VacuumRuntimeMode
  status: ResolvedVacuumStatus
  visibleTabs: readonly (typeof VACUUM_MODAL_TABS)[number][]
}

function isUnavailableState(state: string | undefined) {
  return isUnavailableVacuumState(state)
}

function isResumable(statusFlag: string | undefined) {
  return statusFlag === 'resumable'
}

function installVacuumModalPreviewApi() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return () => undefined

  vacuumModalPreviewRegistrations += 1
  window.__vacuumModalPreview ??= {
    getMode: () => vacuumModalPreviewMode,
    setMode: (mode) => {
      vacuumModalPreviewMode = mode
      window.dispatchEvent(new CustomEvent(VACUUM_MODAL_PREVIEW_EVENT, { detail: { mode } }))
    },
  }

  return () => {
    vacuumModalPreviewRegistrations = Math.max(0, vacuumModalPreviewRegistrations - 1)
    if (vacuumModalPreviewRegistrations > 0) return
    vacuumModalPreviewMode = 'live'
    delete window.__vacuumModalPreview
  }
}

function currentVacuumModalPreviewMode(): VacuumModalPreviewMode {
  if (!import.meta.env.DEV || typeof window === 'undefined') return 'live'
  return window.__vacuumModalPreview?.getMode() ?? vacuumModalPreviewMode
}

function subscribeVacuumModalPreviewMode(onStoreChange: () => void) {
  if (!import.meta.env.DEV || typeof window === 'undefined') return () => undefined
  const dispose = installVacuumModalPreviewApi()
  window.addEventListener(VACUUM_MODAL_PREVIEW_EVENT, onStoreChange)
  return () => {
    window.removeEventListener(VACUUM_MODAL_PREVIEW_EVENT, onStoreChange)
    dispose()
  }
}

function useVacuumModalPreviewMode() {
  return useSyncExternalStore<VacuumModalPreviewMode>(
    subscribeVacuumModalPreviewMode,
    currentVacuumModalPreviewMode,
    () => 'live',
  )
}

function isMeaningfulText(value: string | undefined) {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized !== '' && normalized !== 'unknown' && normalized !== 'unavailable'
}

function formatStateValue(value: string | undefined, fallback = 'Unavailable') {
  if (!value) return fallback
  if (value === 'unknown') return 'Unknown'
  if (value === 'unavailable') return 'Unavailable'
  return titleCaseState(value)
}

function conditionStatusText(copy: ReturnType<typeof useCopy>, condition: VacuumActiveCondition) {
  const code = condition.code.toLowerCase()
  if (CONDITION_RESUME_PATTERN.test(code)) return copy(VACUUM_COPY_KEYS.status.conditions.resumePending)
  if (CONDITION_VACUUM_ONLY_PATTERN.test(code) || CONDITION_FALLBACK_PATTERN.test(code)) return copy(VACUUM_COPY_KEYS.status.conditions.vacuumingOnly)
  if (CONDITION_DOCK_PATTERN.test(code)) return copy(VACUUM_COPY_KEYS.status.conditions.dockingMayBeIncomplete)
  return titleCaseState(condition.code.split('.').at(-1)?.replaceAll('_', ' ') ?? condition.code)
}

function coherentContractIssue(contractIssue: VacuumCurrentIssue, nativeIssue: VacuumCurrentIssue) {
  if (nativeIssue.status === VACUUM_ISSUE_UNKNOWN) return nativeIssue
  if (contractIssue.status === VACUUM_ISSUE_PRESENT) {
    return nativeIssue.status === VACUUM_ISSUE_PRESENT && contractIssue.raw === nativeIssue.raw
      ? contractIssue
      : nativeIssue
  }
  return contractIssue.status === nativeIssue.status ? contractIssue : nativeIssue
}

function mostRestrictiveCommandPolicy(first: VacuumCommandPolicyMode, second: VacuumCommandPolicyMode) {
  return COMMAND_POLICY_RANK[first] >= COMMAND_POLICY_RANK[second] ? first : second
}

function mergeActiveConditions(
  contractConditions: VacuumActiveCondition[],
  liveConditions: VacuumActiveCondition[],
) {
  const conditions = new Map(contractConditions.map((condition) => [condition.code, condition]))
  for (const condition of liveConditions) {
    if (!conditions.has(condition.code)) conditions.set(condition.code, condition)
  }
  return [...conditions.values()]
}

function useResolvedVacuumDetails(
  vacuum: VacuumConfig,
  liveState: string | undefined,
  primaryEntityExists: boolean,
  primaryRevision?: string,
): ResolvedVacuumStatus {
  const battery = useEntity(asEntityName(vacuum.batteryEntityId), { returnNullIfNotFound: true })
  const dockStatus = useOptionalEntity(vacuum.dockControls?.dockStatusEntityId)
  const error = useEntity(asEntityName(vacuum.errorEntityId), { returnNullIfNotFound: true })
  const statusFlag = useEntity(asEntityName(vacuum.statusFlagEntityId), { returnNullIfNotFound: true })
  const statusEntity = useEntity(asEntityName(vacuum.statusEntityId), { returnNullIfNotFound: true }) as EntityLike | null
  const availability = vacuumAvailabilityStatus(liveState, primaryEntityExists)
  const primaryAvailable = availability === VACUUM_AVAILABILITY_AVAILABLE
  const nativeIssue = nativeVacuumIssue(error?.state)
  const resolution = resolveVacuumStatusContract(statusEntity?.attributes, vacuum.entityId, liveState)
  const contract = resolution.kind === VACUUM_CONTRACT_TYPED ? resolution.contract : null
  const currentIssue = primaryAvailable && contract
    ? coherentContractIssue(contract.current_issue, nativeIssue)
    : primaryAvailable ? nativeIssue : { code: null, raw: null, reported_at: null, status: VACUUM_ISSUE_UNKNOWN }
  const fallbackConditions: VacuumActiveCondition[] = isResumable(statusFlag?.state)
    ? [{ code: 'vacuum.task_resume_pending', since: statusFlag.last_changed ?? new Date(0).toISOString(), source: VACUUM_CONDITION_DERIVED }]
    : []
  const activeConditions = mergeActiveConditions(contract?.active_conditions ?? [], fallbackConditions)
  const requiredSourcesReadable = Boolean(
    error
    && !isUnavailableState(error.state)
    && statusFlag
    && !isUnavailableState(statusFlag.state)
    && battery
    && !isUnavailableState(battery.state)
    && Number.isFinite(Number(battery.state))
    && (!vacuum.dockControls || (dockStatus && !isUnavailableState(dockStatus.state))),
  )
  let nativeCommandPolicyMode: VacuumCommandPolicyMode = VACUUM_COMMAND_NORMAL
  let nativeCommandPolicyReason: string | null = null
  if (!primaryAvailable) {
    nativeCommandPolicyMode = VACUUM_COMMAND_NONE
    nativeCommandPolicyReason = `primary_${availability}`
  } else if (!requiredSourcesReadable) {
    nativeCommandPolicyMode = VACUUM_COMMAND_RESTRICTED
    nativeCommandPolicyReason = SOURCE_UNREADABLE_REASON
  } else if (currentIssue.status !== VACUUM_ISSUE_CLEAR) {
    nativeCommandPolicyMode = VACUUM_COMMAND_RESTRICTED
    nativeCommandPolicyReason = 'current_issue'
  } else if (activeConditions.length > 0) {
    nativeCommandPolicyMode = VACUUM_COMMAND_RESTRICTED
    nativeCommandPolicyReason = activeConditions[0].code
  } else if (!NORMAL_COMMAND_STATES.has(liveState ?? '')) {
    nativeCommandPolicyMode = VACUUM_COMMAND_RESTRICTED
    nativeCommandPolicyReason = `vacuum_${liveState ?? 'unknown'}`
  } else if (BUSY_DOCK_STATES.has(dockStatus?.state ?? '')) {
    nativeCommandPolicyMode = VACUUM_COMMAND_RESTRICTED
    nativeCommandPolicyReason = `dock_${dockStatus?.state}`
  }
  const contractCommandPolicyMode = contract?.command_policy.mode ?? VACUUM_COMMAND_NORMAL
  const commandPolicyMode = mostRestrictiveCommandPolicy(nativeCommandPolicyMode, contractCommandPolicyMode)
  const commandPolicyReason = COMMAND_POLICY_RANK[nativeCommandPolicyMode] >= COMMAND_POLICY_RANK[contractCommandPolicyMode]
    ? nativeCommandPolicyReason
    : contract?.command_policy.reason ?? null

  return {
    activeConditions,
    availability,
    commandPolicyMode,
    commandPolicyReason,
    currentIssue,
    lastIssue: contract?.last_issue && !contract.last_issue.cleared_at ? contract.last_issue : null,
    primaryAvailable,
    primaryRevision,
  }
}

function useVacuumModalRuntime(vacuum: VacuumConfig): VacuumModalRuntime {
  const entity = useEntity(asEntityName(vacuum.entityId), { returnNullIfNotFound: true })
  const dockStatus = useOptionalEntity(vacuum.dockControls?.dockStatusEntityId)
  const liveState = entity?.state
  const primaryState = liveState ?? VACUUM_AVAILABILITY_UNKNOWN
  const [displayState, commitDisplayState] = useOptimisticState(primaryState, { clearOn: 'live-change', revertMs: VACUUM_OPTIMISTIC_REVERT_MS })
  const status = useResolvedVacuumDetails(vacuum, liveState, Boolean(entity), entity?.last_changed)
  const error = useEntity(asEntityName(vacuum.errorEntityId), { returnNullIfNotFound: true })
  const statusFlag = useEntity(asEntityName(vacuum.statusFlagEntityId), { returnNullIfNotFound: true })
  const previewMode = useVacuumModalPreviewMode()
  const liveRuntimeMode = vacuumRuntimeMode({
    commandPolicyMode: status.commandPolicyMode,
    displayState,
    liveError: error?.state,
    liveStatusFlag: statusFlag?.state,
  })
  const runtimeMode = previewMode === 'live' ? liveRuntimeMode : previewMode
  const optimisticState = useMemo<OptimisticVacuumState>(() => ({
    commitState: commitDisplayState,
    liveState: primaryState,
    state: displayState,
  }), [commitDisplayState, displayState, primaryState])
  const visibleTabs = useMemo(
    () => vacuumModalTabsForMode(vacuum, runtimeMode, dockStatus?.state),
    [dockStatus?.state, runtimeMode, vacuum],
  )

  return { optimisticState, runtimeMode, status, visibleTabs }
}

function useVacuumActiveTab({
  activeTab,
  areaEditorOpen,
  idPrefix,
  onActiveTabChange,
  visibleTabs,
}: {
  activeTab: VacuumModalTab
  areaEditorOpen: boolean
  idPrefix: string
  onActiveTabChange: (tab: VacuumModalTab) => void
  visibleTabs: readonly (typeof VACUUM_MODAL_TABS)[number][]
}) {
  const focusControlsRef = useRef(false)
  const effectiveActiveTab = visibleTabs.some((tab) => tab.tab === activeTab) ? activeTab : 'controls'

  useLayoutEffect(() => {
    if (activeTab === effectiveActiveTab) return
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const hiddenTab = document.getElementById(modalTabId(idPrefix, activeTab))
    const hiddenPanel = document.getElementById(modalTabPanelId(idPrefix, 'content'))
    focusControlsRef.current = Boolean(activeElement) && (
      hiddenTab === activeElement
      || Boolean(hiddenTab?.contains(activeElement))
      || Boolean(hiddenPanel?.contains(activeElement))
    )
    onActiveTabChange('controls')
  }, [activeTab, effectiveActiveTab, idPrefix, onActiveTabChange])

  useLayoutEffect(() => {
    if (!focusControlsRef.current || areaEditorOpen || effectiveActiveTab !== 'controls') return
    focusControlsRef.current = false
    const focusControls = () => {
      document.getElementById(modalTabId(idPrefix, 'controls'))?.focus({ preventScroll: true })
    }
    focusControls()
    const frame = window.requestAnimationFrame(() => {
      if (document.activeElement === document.body) focusControls()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [areaEditorOpen, effectiveActiveTab, idPrefix, visibleTabs])

  return effectiveActiveTab
}

function formatPassCount(value: string | undefined) {
  if (!value) return '1x'
  const passes = Number(value)
  return Number.isFinite(passes) ? `${passes}x` : formatStateValue(value)
}

function formatEntityValue(entity: EntityLike | null | undefined, fallback = 'Unavailable') {
  if (!entity) return fallback
  if (entity.entity_id.startsWith('sensor.') || entity.entity_id.startsWith('input_text.')) return entity.state || fallback
  return formatStateValue(entity.state, fallback)
}

function entityOptions(entity: EntityLike | null | undefined) {
  const options = entity?.attributes.options
  return Array.isArray(options) ? options.map(String) : []
}

function domainFromEntity(entityId: string) {
  return entityId.split('.', 1)[0]
}

function callServiceAction(callService: CallService, action: string, target?: string, serviceData?: Record<string, unknown>) {
  const [domain, service] = action.split('.', 2)
  if (!domain || !service) throw new Error(`Invalid Home Assistant action: ${action}`)
  const params: Record<string, unknown> = { domain, service }
  if (target) params.target = target
  if (serviceData) params.serviceData = serviceData
  return callService(params)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hassServiceAvailable(services: unknown, action: string) {
  if (!isRecord(services)) return false
  const [domain, service] = action.split('.', 2)
  if (!domain || !service) return false
  const domainServices = services[domain]
  return (isRecord(domainServices) && service in domainServices) || action in services
}

function formatAreaLength(centimetres: number) {
  const metres = centimetres / 100
  return `${Number.isInteger(metres) ? metres.toFixed(0) : metres.toFixed(2).replace(/0$/, '')} m`
}

function dockStatusVisual(state: string | undefined): { icon: string; tone: VacuumVisualTone } {
  if (state === 'cleaning') return { icon: 'mdi:water', tone: 'active' }
  if (state === 'drying') return { icon: 'mdi:weather-windy', tone: 'active' }
  if (state === 'emptying') return { icon: 'mdi:delete-restore', tone: 'warning' }
  if (state === 'pause') return { icon: 'mdi:pause', tone: 'warning' }
  if (state === 'error') return { icon: 'mdi:alert-circle', tone: 'danger' }
  if (isUnavailableState(state)) return { icon: 'mdi:home', tone: 'unavailable' }
  return { icon: 'mdi:home', tone: 'neutral' }
}

function nowMs() {
  return typeof window === 'undefined' ? Date.now() : window.performance.now()
}

function wallClockNowMs() {
  return typeof window === 'undefined' ? Date.now() : window.performance.timeOrigin + window.performance.now()
}

function useVacuumCommandCoordinator(
  liveState: string,
  commandPolicyMode: VacuumCommandPolicyMode,
  commitDisplayState: (nextState: string, options?: OptimisticCommitOptions) => void,
): VacuumCommandCoordinator {
  const copy = useCopy(VACUUM_COPY_NAMESPACE)
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const [pendingIntents, setPendingIntents] = useState<Record<string, VacuumPendingIntent>>({})
  const [lastIntentAt, setLastIntentAt] = useState(Number.NEGATIVE_INFINITY)
  const [settleTick, setSettleTick] = useState(0)
  const [queuedCleanCommand, setQueuedCleanCommand] = useState<VacuumCleanCommand | null>(null)
  const [cleanStartPending, setCleanStartPending] = useState(false)
  const [cleanStartRevision, setCleanStartRevision] = useState(0)
  const [intentRevision, setIntentRevision] = useState(0)
  const [cleanError, setCleanError] = useState<string | null>(null)
  const pendingIntentCount = Object.keys(pendingIntents).length
  const settingsSettled = pendingIntentCount === 0 && nowMs() >= lastIntentAt + VACUUM_CLEAN_SETTLE_QUIET_MS
  const controlsDisabled = cleanStartPending

  const failClean = useCallback((message: string) => {
    setCleanError(message)
    setQueuedCleanCommand(null)
    setCleanStartPending(false)
    commitDisplayState(liveState)
  }, [commitDisplayState, liveState])

  const invokeClean = useCallback((command: VacuumCleanCommand) => {
    if (commandPolicyMode !== VACUUM_COMMAND_NORMAL) {
      failClean(copy(VACUUM_COPY_KEYS.status.queuedCleaningCanceled))
      return
    }
    try {
      const result = callServiceAction(callService, command.action, undefined, command.serviceData)
      if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
        void Promise.resolve(result).catch((caughtError: unknown) => {
          failClean(caughtError instanceof Error ? caughtError.message : 'Home Assistant rejected the cleaning request.')
        })
      }
      setCleanStartRevision((revision) => revision + 1)
    } catch (caughtError) {
      failClean(caughtError instanceof Error ? caughtError.message : 'Home Assistant rejected the cleaning request.')
    }
  }, [callService, commandPolicyMode, copy, failClean])

  const registerIntent = useCallback((entityId: string, expectedState: string) => {
    const issuedAt = nowMs()
    const orderAt = wallClockNowMs()
    setLastIntentAt(issuedAt)
    setIntentRevision((revision) => revision + 1)
    setPendingIntents((current) => ({
      ...current,
      [entityId]: { expectedState, issuedAt, orderAt },
    }))
  }, [])

  const confirmIntent = useCallback((entityId: string, liveIntentState: string | undefined) => {
    setPendingIntents((current) => {
      const pending = current[entityId]
      if (!pending || liveIntentState !== pending.expectedState) return current
      const next = { ...current }
      delete next[entityId]
      return next
    })
    setSettleTick((tick) => tick + 1)
  }, [])

  const pendingIntentState = useCallback((entityId: string) => pendingIntents[entityId]?.expectedState, [pendingIntents])
  const pendingIntentOrderAt = useCallback((entityId: string) => pendingIntents[entityId]?.orderAt, [pendingIntents])

  const requestClean = useCallback(
    (action: string, serviceData?: Record<string, unknown>) => {
      if (commandPolicyMode !== VACUUM_COMMAND_NORMAL) {
        failClean(copy(VACUUM_COPY_KEYS.status.queuedCleaningCanceled))
        return
      }
      const command = { action, serviceData }
      setCleanError(null)
      commitDisplayState('cleaning', { revertMs: VACUUM_CLEAN_START_REVERT_MS })
      setCleanStartPending(true)
      if (settingsSettled) {
        invokeClean(command)
        return
      }
      setQueuedCleanCommand(command)
    },
    [commandPolicyMode, commitDisplayState, copy, failClean, invokeClean, settingsSettled],
  )

  useEffect(() => {
    if (commandPolicyMode === VACUUM_COMMAND_NORMAL || !queuedCleanCommand) return undefined
    const timeout = window.setTimeout(() => {
      failClean(copy(VACUUM_COPY_KEYS.status.queuedCleaningCanceled))
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [commandPolicyMode, copy, failClean, queuedCleanCommand])

  useEffect(() => {
    if (pendingIntentCount > 0) return undefined
    const remainingMs = lastIntentAt + VACUUM_CLEAN_SETTLE_QUIET_MS - nowMs()
    if (remainingMs <= 0) return undefined
    const timeout = window.setTimeout(() => setSettleTick((tick) => tick + 1), remainingMs)
    return () => window.clearTimeout(timeout)
  }, [lastIntentAt, pendingIntentCount, settleTick])

  useEffect(() => {
    if (pendingIntentCount === 0) return undefined
    const nextExpiryMs = Math.min(...Object.values(pendingIntents).map((intent) => intent.issuedAt + VACUUM_OPTIMISTIC_REVERT_MS))
    const timeout = window.setTimeout(() => {
      const currentTime = nowMs()
      setPendingIntents((current) => Object.fromEntries(Object.entries(current).filter(([, intent]) => currentTime < intent.issuedAt + VACUUM_OPTIMISTIC_REVERT_MS)))
      if (cleanStartPending || queuedCleanCommand) {
        failClean('The vacuum settings did not confirm before cleaning could start.')
      }
    }, Math.max(0, nextExpiryMs - nowMs()))
    return () => window.clearTimeout(timeout)
  }, [cleanStartPending, failClean, pendingIntentCount, pendingIntents, queuedCleanCommand])

  useEffect(() => {
    if (!queuedCleanCommand || !settingsSettled) return undefined
    const timeout = window.setTimeout(() => {
      invokeClean(queuedCleanCommand)
      setQueuedCleanCommand(null)
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [invokeClean, queuedCleanCommand, settingsSettled])

  useEffect(() => {
    if (!cleanStartPending) return undefined
    if (liveState === 'cleaning') {
      const timeout = window.setTimeout(() => {
        setCleanStartPending(false)
        setQueuedCleanCommand(null)
        setCleanError(null)
      }, 0)
      return () => window.clearTimeout(timeout)
    }

    const timeout = window.setTimeout(() => {
      failClean('The vacuum did not begin cleaning within 30 seconds.')
    }, VACUUM_CLEAN_START_REVERT_MS)
    return () => window.clearTimeout(timeout)
  }, [cleanStartPending, cleanStartRevision, failClean, liveState])

  return {
    cleanError,
    cleanQueued: queuedCleanCommand !== null,
    controlsDisabled,
    confirmIntent,
    intentRevision,
    pendingIntentCount,
    pendingIntentOrderAt,
    pendingIntentState,
    registerIntent,
    requestClean,
  }
}

function useOptionalEntity(entityId: string | undefined) {
  return useEntity(asEntityName(entityId ?? 'sensor.react_dash_optional_entity_not_configured'), { returnNullIfNotFound: true }) as EntityLike | null
}

interface VacuumAreaEditorSession {
  areaEditorOpen: boolean
  closeAreaEditor: () => void
  drawMode: boolean
  openAreaEditor: (drawMode: boolean) => void
}

class VacuumAreaEditorSessionStore {
  private snapshot: { areaEditorOpen: boolean; drawMode: boolean; runtimeMode: VacuumRuntimeMode }

  private readonly listeners = new Set<() => void>()

  constructor(runtimeMode: VacuumRuntimeMode) {
    this.snapshot = {
      areaEditorOpen: false,
      drawMode: false,
      runtimeMode,
    }
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = () => this.snapshot

  setRuntimeMode(runtimeMode: VacuumRuntimeMode) {
    const next =
      runtimeMode === 'full'
        ? { ...this.snapshot, runtimeMode }
        : { areaEditorOpen: false, drawMode: false, runtimeMode }

    if (
      next.runtimeMode === this.snapshot.runtimeMode
      && next.areaEditorOpen === this.snapshot.areaEditorOpen
      && next.drawMode === this.snapshot.drawMode
    ) return

    this.snapshot = next
    this.emit()
  }

  open(drawMode: boolean) {
    if (this.snapshot.runtimeMode !== 'full') return
    if (this.snapshot.areaEditorOpen && this.snapshot.drawMode === drawMode) return
    this.snapshot = {
      ...this.snapshot,
      areaEditorOpen: true,
      drawMode,
    }
    this.emit()
  }

  close() {
    if (!this.snapshot.areaEditorOpen && !this.snapshot.drawMode) return
    this.snapshot = {
      ...this.snapshot,
      areaEditorOpen: false,
      drawMode: false,
    }
    this.emit()
  }

  private emit() {
    for (const listener of this.listeners) listener()
  }
}

function useVacuumAreaEditorSession(runtimeMode: VacuumRuntimeMode): VacuumAreaEditorSession {
  const [store] = useState(() => new VacuumAreaEditorSessionStore(runtimeMode))
  useLayoutEffect(() => {
    store.setRuntimeMode(runtimeMode)
  }, [runtimeMode, store])
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)

  const openAreaEditor = useCallback((drawMode: boolean) => {
    store.open(drawMode)
  }, [store])

  const closeAreaEditor = useCallback(() => {
    store.close()
  }, [store])

  return {
    areaEditorOpen: snapshot.areaEditorOpen,
    closeAreaEditor,
    drawMode: snapshot.drawMode,
    openAreaEditor,
  }
}

function useVacuumSettingIntentConfirmations(vacuum: VacuumConfig, onLiveState: (entityId: string, liveState: string | undefined) => void) {
  const mode = useOptionalEntity(vacuum.modeEntityId)
  const fan = useOptionalEntity(vacuum.fanEntityId)
  const water = useOptionalEntity(vacuum.waterEntityId)
  const passes = useOptionalEntity(vacuum.passesEntityId)

  useEffect(() => {
    if (vacuum.modeEntityId) onLiveState(vacuum.modeEntityId, mode?.state)
    if (vacuum.fanEntityId) onLiveState(vacuum.fanEntityId, fan?.state)
    if (vacuum.waterEntityId) onLiveState(vacuum.waterEntityId, water?.state)
    onLiveState(vacuum.passesEntityId, passes?.state)
  }, [fan?.state, mode?.state, onLiveState, passes?.state, vacuum.fanEntityId, vacuum.modeEntityId, vacuum.passesEntityId, vacuum.waterEntityId, water?.state])
}

function VacuumIntentConfirmationTracker({ entityId, intentRevision, onLiveState }: { entityId: string; intentRevision: number; onLiveState: (entityId: string, liveState: string | undefined) => void }) {
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true }) as EntityLike | null
  const liveState = entity?.state

  useEffect(() => {
    onLiveState(entityId, liveState)
  }, [entityId, intentRevision, liveState, onLiveState])

  return null
}

function VacuumIntentConfirmationTrackers({ coordinator, vacuum }: { coordinator: VacuumCommandCoordinator; vacuum: VacuumConfig }) {
  return (
    <>
      {vacuum.zones.map((zone) => <VacuumIntentConfirmationTracker entityId={zone.entityId} intentRevision={coordinator.intentRevision} key={zone.entityId} onLiveState={coordinator.confirmIntent} />)}
    </>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className={styles.sectionHeader}>
      <h3>{title}</h3>
      <span />
    </div>
  )
}

function SectionText({ lines }: { lines?: string[] }) {
  if (!lines?.length) return null

  return (
    <div className={styles.sectionText}>
      {lines.map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}
    </div>
  )
}

function ControlItem({ children, description, detailTrigger }: { children: ReactNode; description?: string; detailTrigger?: string }) {
  return (
    <div className={styles.controlItem} data-has-description={description ? 'true' : 'false'} data-modal-detail-trigger={detailTrigger}>
      {description && <Description>{description}</Description>}
      {children}
    </div>
  )
}

function ActionButton({
  description,
  disabled = false,
  icon,
  label,
  onClick,
  detailTrigger,
  tone = 'neutral',
}: {
  description?: string
  detailTrigger?: string
  disabled?: boolean
  icon: string
  label: string
  onClick: () => void
  tone?: 'danger' | 'neutral' | 'primary' | 'warning'
}) {
  const actionTone: ModalActionTone = tone === 'danger' ? 'destructive' : tone

  return (
    <ControlItem description={description} detailTrigger={detailTrigger}>
      <ModalActionButton action={{ disabled, icon, label, onClick }} tone={actionTone} />
    </ControlItem>
  )
}

function VacuumCleanTargetSelector({
  areaSelected,
  disabled,
  onSelectArea,
  onSelectRooms,
  roomsSelected,
}: {
  areaSelected: boolean
  disabled: boolean
  onSelectArea: () => void
  onSelectRooms: () => void
  roomsSelected: boolean
}) {
  return (
    <div aria-label="Cleaning target" className={styles.cleanTargetSelector} role="group">
      {([
        { icon: 'mdi:floor-plan', label: 'Rooms', onSelect: onSelectRooms, selected: roomsSelected, value: 'rooms' },
        { icon: 'mdi:selection-drag', label: 'Area', onSelect: onSelectArea, selected: areaSelected, value: 'area' },
      ] as const).map((option) => (
        <button
          aria-pressed={option.selected}
          className={styles.cleanTargetButton}
          data-active={option.selected ? 'true' : 'false'}
          disabled={disabled}
          key={option.value}
          onClick={option.onSelect}
          type="button"
        >
          <MaterialIcon name={option.icon} size={20} />
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  )
}

function InfoPill({ grouped = false, icon, label, tone, value }: { grouped?: boolean; icon: string; label: string; tone?: VacuumVisualTone; value: string }) {
  return <StatusPill grouped={grouped} icon={icon} label={label} tone={tone} value={value} />
}

function LocateStatusPill({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  const copy = useCopy(VACUUM_COPY_NAMESPACE)
  const label = copy('layout.locate')

  return (
    <button aria-label={label} className={styles.statusPillCommand} disabled={disabled} onClick={onClick} type="button">
      <StatusPill icon="mdi:map-marker" label="" tone={disabled ? 'unavailable' : 'active'} value={label} />
    </button>
  )
}

function formatHours(hours: number) {
  const rounded = hours < 10 ? Math.round(hours * 10) / 10 : Math.round(hours)
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function formatConsumableDuration(entity: EntityLike) {
  const minutes = Number(entity.state)
  if (!Number.isFinite(minutes)) {
    const unit = typeof entity.attributes.unit_of_measurement === 'string' ? entity.attributes.unit_of_measurement : ''
    return `${entity.state}${unit ? ` ${unit}` : ''}`
  }
  if (minutes <= 0) return 'Due'
  if (minutes < 60) return `${Math.round(minutes)}m left`
  return `${formatHours(minutes / 60)}h left`
}

function formatConsumableValue(consumable: VacuumConsumableConfig, entity: EntityLike | null | undefined) {
  if (!entity || isUnavailableState(entity.state)) return 'Unknown'
  if (consumable.valueKind === 'duration') return formatConsumableDuration(entity)
  const value = formatStateValue(entity.state)
  return value.toLowerCase() === 'ok' ? 'OK' : value
}

function VacuumConsumablePill({ consumable }: { consumable: VacuumConsumableConfig }) {
  const entity = useOptionalEntity(consumable.entityId)
  const value = formatConsumableValue(consumable, entity)
  const visual = vacuumConsumableVisual(consumable.icon, consumable.valueKind, entity?.state)
  return <InfoPill grouped icon={visual.icon} label={consumable.title} tone={visual.tone} value={value} />
}

function ControlSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className={styles.section}>
      <SectionHeader title={title} />
      <div className={styles.controlGrid} data-layout="default">{children}</div>
    </section>
  )
}

function SelectSetting({
  description,
  disabled = false,
  entity,
  entityId,
  formatOptionLabel,
  hideLabel = false,
  icon,
  label,
  onIntent,
  onOptimisticValueChange,
  optimisticValue,
  valueLabel,
  variant = 'setting',
}: {
  description?: string
  disabled?: boolean
  entity: EntityLike | null | undefined
  entityId: string
  formatOptionLabel?: (value: string) => string
  hideLabel?: boolean
  icon: string
  label: string
  onIntent?: (entityId: string, expectedState: string) => void
  onOptimisticValueChange?: (value: string) => void
  optimisticValue?: string
  valueLabel?: string
  variant?: 'setting' | 'sub'
}) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const liveValue = entity?.state ?? ''
  const [internalValue, commitInternalValue] = useOptimisticState(liveValue, { clearOn: 'confirmation', revertMs: VACUUM_OPTIMISTIC_REVERT_MS })
  const unavailable = !entity || isUnavailableState(entity.state)
  const options = entityOptions(entity)
  const value = optimisticValue ?? internalValue
  const displayValue = value === liveValue && valueLabel ? valueLabel : value ? (formatOptionLabel ? formatOptionLabel(value) : formatStateValue(value, label)) : formatEntityValue(entity, label)
  const selectOption = (option: string) => {
    if (disabled || option === value) return
    commitInternalValue(option)
    onOptimisticValueChange?.(option)
    onIntent?.(entityId, option)
    callService({ domain: domainFromEntity(entityId), service: 'select_option', target: entityId, serviceData: { option } })
  }

  if (unavailable || options.length === 0) {
    return variant === 'sub' ? (
      <ControlItem description={description}>
        <span className={styles.subInfoPill}>
          {!hideLabel && <span>{label}</span>}
          <strong>{displayValue}</strong>
        </span>
      </ControlItem>
    ) : (
      <ControlItem description={description}>
        <InfoPill icon={icon} label={label} value={displayValue} />
      </ControlItem>
    )
  }

  const renderedOptions = options.includes(value) ? options : [value, ...options].filter(Boolean)
  const selectOptions = renderedOptions.map((option) => ({ value: option, label: formatOptionLabel ? formatOptionLabel(option) : formatStateValue(option) }))

  return (
    <ControlItem description={description}>
      <NativeSelectField
        ariaLabel={`${label} ${displayValue}`}
        blurOnChange
        className={hideLabel ? undefined : styles.powerSelectField}
        disabled={disabled}
        hideLabel={hideLabel}
        icon={hideLabel ? undefined : icon}
        label={label}
        onChange={selectOption}
        options={selectOptions}
        selectedLabel={displayValue}
        value={value}
      />
    </ControlItem>
  )
}

function ZoneButton({ active, disabled, onToggle, order, zone }: { active: boolean; disabled: boolean; onToggle: (zone: VacuumZoneConfig) => void; order?: number; zone: VacuumZoneConfig }) {
  return (
    <button
      aria-label={order ? `${zone.title}, cleaning order ${order}` : zone.title}
      aria-pressed={active}
      className={styles.zoneButton}
      data-active={active}
      disabled={disabled}
      onClick={() => onToggle(zone)}
      type="button"
    >
      <MaterialIcon name={zone.icon} size={22} />
      <span className={styles.zoneLabel}>{zone.title}</span>
      {order && <span aria-hidden="true" className={styles.zoneOrder}>{order}</span>}
    </button>
  )
}

function AutoCleanDisabledRoomCheckbox({ room }: { room: VacuumAutoCleanDisabledRoomConfig }) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const entity = useEntity(asEntityName(room.entityId), { returnNullIfNotFound: true })
  const liveDisabled = entity?.state === 'on'
  const unavailable = !entity || isUnavailableState(entity.state)
  const [disabledForAutoClean, commitDisabledForAutoClean] = useOptimisticState(liveDisabled, { clearOn: 'confirmation', revertMs: VACUUM_OPTIMISTIC_REVERT_MS })
  const nextDisabled = !disabledForAutoClean

  return (
    <button
      aria-label={`${room.title} auto-clean ${disabledForAutoClean ? 'disabled' : 'enabled'}`}
      aria-pressed={disabledForAutoClean}
      className={styles.autoCleanCheckbox}
      data-active={disabledForAutoClean}
      disabled={unavailable}
      onClick={() => {
        if (unavailable) return
        commitDisabledForAutoClean(nextDisabled)
        callService({ domain: domainFromEntity(room.entityId), service: nextDisabled ? 'turn_on' : 'turn_off', target: room.entityId })
      }}
      type="button"
    >
      <MaterialIcon name={disabledForAutoClean ? 'mdi:checkbox-marked-outline' : 'mdi:checkbox-blank-outline'} size={34} />
      <span data-dynamic-grid-label-container="true">
        <strong data-dynamic-grid-label="true">{room.title}</strong>
      </span>
    </button>
  )
}

function VacuumStatusNotice({
  children,
  role,
  title,
  tone = 'neutral',
}: {
  children: ReactNode
  role?: 'note'
  title: string
  tone?: 'neutral' | 'warning'
}) {
  return (
    <section aria-label={title} className={styles.statusNotice} data-tone={tone} role={role}>
      <h3>{title}</h3>
      <Description>{children}</Description>
    </section>
  )
}

function VacuumStatusSummary({
  displayState,
  liveState,
  locate,
  mapProvenance,
  showLocate = false,
  status,
  vacuum,
}: {
  displayState: string
  liveState: string
  locate?: () => void
  mapProvenance: ValetudoMapProvenance
  showLocate?: boolean
  status: ResolvedVacuumStatus
  vacuum: VacuumConfig
}) {
  const copy = useCopy(VACUUM_COPY_NAMESPACE)
  const common = useCopy(COMMON_COPY_NAMESPACE)
  const battery = useEntity(asEntityName(vacuum.batteryEntityId), { returnNullIfNotFound: true })
  const dockStatus = useOptionalEntity(vacuum.dockControls?.dockStatusEntityId)
  const state = status.primaryAvailable ? displayState : liveState
  const stateLabel = formatStateValue(state)
  const unknown = common('states.unknown')
  const batteryLabel = status.primaryAvailable && battery && !isUnavailableState(battery.state) ? `${battery.state}%` : unknown
  const dockStatusLabel = status.primaryAvailable ? formatStateValue(dockStatus?.state, unknown) : unknown
  const visual = vacuumStateVisual(state)
  const dockVisual = dockStatusVisual(dockStatus?.state)
  const currentIssueText = status.currentIssue.status === VACUUM_ISSUE_PRESENT ? status.currentIssue.raw : null
  const liveStatusText = !status.primaryAvailable
    ? copy(VACUUM_COPY_KEYS.status.unavailableLiveStatus, { status: stateLabel })
    : currentIssueText
      ?? (status.currentIssue.status === VACUUM_ISSUE_UNKNOWN
        ? copy(VACUUM_COPY_KEYS.status.errorSourceUnavailableHelp)
        : stateLabel)
  const previousIssueDate = status.lastIssue
    ? new Date(status.lastIssue.reported_at).toLocaleString(APP_LOCALE)
    : null

  return (
    <section className={styles.statusPanel}>
      <DynamicGrid ariaLabel={copy(VACUUM_COPY_KEYS.statusGridLabel)} className={styles.statusPills} columns={2} gap={8}>
        <InfoPill icon={visual.icon} label="Status" tone={visual.tone} value={stateLabel} />
        <InfoPill icon="mdi:battery" label="Battery" tone={status.primaryAvailable ? undefined : 'unavailable'} value={batteryLabel} />
        {vacuum.dockControls
          ? <InfoPill grouped icon={dockVisual.icon} label="Dock Status" tone={status.primaryAvailable ? dockVisual.tone : 'unavailable'} value={dockStatusLabel} />
          : null}
        {showLocate && locate ? <LocateStatusPill disabled={!status.primaryAvailable} onClick={locate} /> : null}
      </DynamicGrid>
      {!status.primaryAvailable && mapProvenance !== VALETUDO_MAP_PROVENANCE_REPORTED && (
        <div className={styles.statusNoticeWide}>
          <VacuumStatusNotice role="note" title={stateLabel}>
            {copy(VACUUM_COPY_KEYS.status.unavailableHelp)}
          </VacuumStatusNotice>
        </div>
      )}
      {status.primaryAvailable && status.currentIssue.status === VACUUM_ISSUE_UNKNOWN && (
        <div className={styles.statusNoticeWide}>
          <VacuumStatusNotice role="note" title={copy(VACUUM_COPY_KEYS.status.errorSourceUnavailable)} tone="warning">
            {copy(VACUUM_COPY_KEYS.status.errorSourceUnavailableHelp)}
          </VacuumStatusNotice>
        </div>
      )}
      {currentIssueText && (
        <div className={styles.statusNoticeWide}>
          <VacuumStatusNotice title={copy(VACUUM_COPY_KEYS.status.currentIssue)} tone="warning">
            {currentIssueText}
          </VacuumStatusNotice>
        </div>
      )}
      {status.activeConditions.map((condition) => (
        <div className={styles.statusNoticeWide} key={`${condition.source}:${condition.code}`}>
          <VacuumStatusNotice role="note" title={copy(VACUUM_COPY_KEYS.status.homeAssistantCondition)}>
            {conditionStatusText(copy, condition)}
          </VacuumStatusNotice>
        </div>
      ))}
      {(!status.primaryAvailable || status.currentIssue.status === VACUUM_ISSUE_UNKNOWN || status.commandPolicyReason === SOURCE_UNREADABLE_REASON) && status.lastIssue && previousIssueDate && (
        <div className={styles.statusNoticeWide}>
          <VacuumStatusNotice role="note" title={copy(VACUUM_COPY_KEYS.status.previousIssue)}>
            {copy(VACUUM_COPY_KEYS.status.previousIssueObserved, {
              date: previousIssueDate,
              issue: status.lastIssue.raw,
            })}
          </VacuumStatusNotice>
        </div>
      )}
      <span aria-atomic="true" aria-live="polite" className={styles.visuallyHidden} data-vacuum-live-status="true" role="status">
        <span>{liveStatusText}</span>
        {status.activeConditions.length > 0 && (
          <ul>
            {status.activeConditions.map((condition) => (
              <li key={`${condition.source}:${condition.code}`}>{conditionStatusText(copy, condition)}</li>
            ))}
          </ul>
        )}
      </span>
    </section>
  )
}

function VacuumConsumableGroup({ consumables, title }: { consumables: VacuumConsumableConfig[]; title: string }) {
  if (consumables.length === 0) return null

  return (
    <section aria-label={title} className={styles.consumablesPanel}>
      <SectionHeader title={title} />
      <div className={styles.consumablesGrid}>
        {consumables.map((consumable) => <VacuumConsumablePill consumable={consumable} key={consumable.entityId} />)}
      </div>
    </section>
  )
}

function VacuumInfoSection({ vacuum }: { vacuum: VacuumConfig }) {
  const binState = vacuum.consumables.filter((consumable) => consumable.valueKind === 'status')
  const consumables = vacuum.consumables.filter((consumable) => consumable.valueKind === 'duration')

  if (binState.length === 0 && consumables.length === 0) return null

  return (
    <>
      <VacuumConsumableGroup consumables={binState} title="Bin State" />
      <VacuumConsumableGroup consumables={consumables} title="Consumables" />
    </>
  )
}

function VacuumPowerSettings({
  coordinator,
  runtimeMode,
  vacuum,
}: {
  coordinator: VacuumCommandCoordinator
  runtimeMode: VacuumRuntimeMode
  vacuum: VacuumConfig
}) {
  const mode = useOptionalEntity(vacuum.modeEntityId)
  const modeText = useOptionalEntity(vacuum.modeTextEntityId)
  const fan = useOptionalEntity(vacuum.fanEntityId)
  const water = useOptionalEntity(vacuum.waterEntityId)
  const modeState = mode?.state
  const [displayModeState, commitDisplayModeState] = useOptimisticState(modeState ?? '', { clearOn: 'confirmation', revertMs: VACUUM_OPTIMISTIC_REVERT_MS })
  const hasMode = Boolean(vacuum.modeEntityId && mode && !isUnavailableState(mode.state))
  const optimisticModeState = hasMode ? displayModeState : modeState
  const showFan = Boolean(vacuum.fanEntityId && fan && !isUnavailableState(fan.state) && optimisticModeState !== 'mop')
  const showWater = Boolean(vacuum.waterEntityId && water && !isUnavailableState(water.state) && (!hasMode || optimisticModeState !== 'vacuum'))
  const modeLabel = optimisticModeState === modeState && isMeaningfulText(modeText?.state) ? modeText?.state : formatStateValue(optimisticModeState, 'Mode')
  const disabled = coordinator.controlsDisabled || runtimeMode !== 'full'

  if (runtimeMode !== 'full' || (!hasMode && !showFan && !showWater)) return null

  return (
    <ControlSection title="Power Settings">
      {hasMode && vacuum.modeEntityId && <SelectSetting description={MODE_DESCRIPTION} disabled={disabled} entity={mode} entityId={vacuum.modeEntityId} icon="mdi:robot-vacuum" label="Mode" onIntent={coordinator.registerIntent} onOptimisticValueChange={commitDisplayModeState} optimisticValue={displayModeState} valueLabel={modeLabel} variant="sub" />}
      {showFan && vacuum.fanEntityId && <SelectSetting description={FAN_DESCRIPTION} disabled={disabled} entity={fan} entityId={vacuum.fanEntityId} icon="mdi:fan" label="Fan" onIntent={coordinator.registerIntent} variant="sub" />}
      {showWater && vacuum.waterEntityId && <SelectSetting description={WATER_DESCRIPTION} disabled={disabled} entity={water} entityId={vacuum.waterEntityId} icon="mdi:water" label="Water" onIntent={coordinator.registerIntent} variant="sub" />}
    </ControlSection>
  )
}

function orderedSelectedVacuumZones(zones: VacuumZoneConfig[], entities: Record<string, EntityLike | undefined>, coordinator: VacuumCommandCoordinator) {
  return zones
    .map((zone, index) => {
      const pendingState = coordinator.pendingIntentState(zone.entityId)
      const entity = entities[zone.entityId]
      const state = pendingState ?? entity?.state
      if (state !== 'on') return null
      const liveChangedAt = Date.parse(entity?.last_changed ?? '')
      return {
        index,
        orderAt: pendingState ? coordinator.pendingIntentOrderAt(zone.entityId) ?? Number.MAX_SAFE_INTEGER : Number.isFinite(liveChangedAt) ? liveChangedAt : index,
        zone,
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => left.orderAt - right.orderAt || left.index - right.index)
}

function vacuumZoneSelected(zone: VacuumZoneConfig, entities: Record<string, EntityLike | undefined>, coordinator: VacuumCommandCoordinator) {
  return (coordinator.pendingIntentState(zone.entityId) ?? entities[zone.entityId]?.state) === 'on'
}

function vacuumZoneRequiresMop(zone: VacuumZoneConfig, entities: Record<string, EntityLike | undefined>) {
  if (zone.mopRequiredEntityId) {
    const mopRequired = entities[zone.mopRequiredEntityId]?.attributes.mop_required
    if (typeof mopRequired === 'boolean') return mopRequired
  }
  return zone.mopRequired ?? true
}

function VacuumSelectedRoomsSummary({ areaSelected = false, coordinator, vacuum }: { areaSelected?: boolean; coordinator: VacuumCommandCoordinator; vacuum: VacuumConfig }) {
  const copy = useCopy(VACUUM_COPY_NAMESPACE)
  const entities = useHass((state) => state.entities) as unknown as Record<string, EntityLike | undefined>
  if (vacuum.zones.length === 0) return null

  const selectedRooms = orderedSelectedVacuumZones(vacuum.zones, entities, coordinator)
  const fullClean = selectedRooms.length === 0 && !areaSelected

  return (
    <div className={styles.awaySummary}>
      <InfoBox title={copy(fullClean ? VACUUM_COPY_KEYS.fullClean : VACUUM_COPY_KEYS.selectedRooms)} tone={fullClean ? 'warning' : 'success'}>
        {selectedRooms.length > 0 ? (
          <ol>
            {selectedRooms.map(({ zone }) => <li key={zone.entityId}>{zone.title}</li>)}
          </ol>
        ) : (
          <Description className={styles.selectedRoomsEmpty}>
            {copy(VACUUM_COPY_KEYS.fullCleanHelp)}
          </Description>
        )}
      </InfoBox>
    </div>
  )
}

function VacuumStateActions({
  areaEditorMeta,
  areaSelection,
  cleanTarget,
  commandPolicyMode,
  coordinator,
  runtimeMode,
  onAreaSelectionChange,
  onOpenRoomsTab,
  onEditArea,
  optimisticState,
  vacuum,
}: {
  areaEditorMeta: ValetudoMapEditorMeta
  areaSelection: MapGridRect | null
  cleanTarget: VacuumCleanTarget
  commandPolicyMode: VacuumCommandPolicyMode
  coordinator: VacuumCommandCoordinator
  runtimeMode: VacuumRuntimeMode
  onAreaSelectionChange: (selection: MapGridRect | null) => void
  onOpenRoomsTab: () => void
  onEditArea?: () => void
  optimisticState: OptimisticVacuumState
  vacuum: VacuumConfig
}) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const services = useHass((state) => state.services)
  const entities = useHass((state) => state.entities) as unknown as Record<string, EntityLike | undefined>
  const roomsSelected = orderedSelectedVacuumZones(vacuum.zones, entities, coordinator).length > 0
  const statusFlag = useEntity(asEntityName(vacuum.statusFlagEntityId), { returnNullIfNotFound: true })
  const error = useEntity(asEntityName(vacuum.errorEntityId), { returnNullIfNotFound: true })
  const passes = useEntity(asEntityName(vacuum.passesEntityId), { returnNullIfNotFound: true }) as EntityLike | null
  const areaCleaning = vacuum.areaCleaning
  const state = optimisticState.state
  const liveState = optimisticState.liveState
  const recoveryCommandsDisabled = coordinator.controlsDisabled || commandPolicyMode === VACUUM_COMMAND_NONE
  const normalCommandsDisabled = coordinator.controlsDisabled || commandPolicyMode !== VACUUM_COMMAND_NORMAL
  const liveStatusFlag = statusFlag?.state ?? 'none'
  const [displayStatusFlag, commitDisplayStatusFlag] = useOptimisticState(liveStatusFlag, { clearOn: 'confirmation', revertMs: VACUUM_OPTIMISTIC_REVERT_MS })
  const resumable = isResumable(liveStatusFlag)
  const cancelResumePending = resumable && !isResumable(displayStatusFlag)
  const lowBattery = error?.state === 'Low battery'
  const resumeReady = resumable && (state === 'docked' || state === 'idle')
  const cancelResumeVisible = resumable && ['docked', 'error', 'idle', 'returning'].includes(state)
  const showCleaningSetup = runtimeMode === 'full'
  const sectionTitle = formatStateValue(state, 'Vacuum')
  const mapReady = areaEditorMeta.isLoaded && Boolean(areaEditorMeta.geometry) && !areaEditorMeta.error
  const servicesLoaded = isRecord(services) && Object.keys(services).length > 0
  const areaServiceReady = Boolean(areaCleaning && hassServiceAvailable(services, areaCleaning.script))
  const areaStartDisabled = !showCleaningSetup
    || !areaSelection
    || !areaEditorMeta.geometry
    || !areaEditorMeta.selectionAllowed
    || !mapReady
    || !areaServiceReady
    || normalCommandsDisabled
  const commitAndCall = (nextState: string, action: string, target?: string) => {
    if (commandPolicyMode === VACUUM_COMMAND_NONE) return
    optimisticState.commitState(nextState)
    callServiceAction(callService, action, target)
  }
  const clean = () => coordinator.requestClean(vacuum.cleanScript)
  const cleanArea = () => {
    if (!areaCleaning || !areaSelection || !areaEditorMeta.geometry || areaStartDisabled) return
    coordinator.requestClean(areaCleaning.script, mapGridRectToServiceData(areaSelection, areaEditorMeta.geometry.pixelSize))
  }
  const dock = () => commitAndCall('returning', 'vacuum.return_to_base', vacuum.entityId)
  const stop = () => commitAndCall(liveState === 'error' ? 'idle' : 'returning', liveState === 'error' ? 'vacuum.stop' : 'vacuum.return_to_base', vacuum.entityId)
  const cancelResume = () => {
    commitDisplayStatusFlag('none')
    commitAndCall(state === 'docked' ? 'docked' : 'idle', 'vacuum.stop', vacuum.entityId)
  }
  const pause = () => commitAndCall('paused', 'vacuum.pause', vacuum.entityId)
  const start = () => commitAndCall('cleaning', 'vacuum.start', vacuum.entityId)
  const roomsCleaningSetup = (
    <>
      <Description>{CLEANING_SETUP_DESCRIPTION}</Description>
      <VacuumSelectedRoomsSummary areaSelected={Boolean(areaSelection)} coordinator={coordinator} vacuum={vacuum} />
      <div className={styles.cleaningActionGrid} data-layout="cleaning">
        <SelectSetting disabled={normalCommandsDisabled} entity={passes} entityId={vacuum.passesEntityId} formatOptionLabel={formatPassCount} hideLabel icon="mdi:numeric" label="Cleaning Passes" onIntent={coordinator.registerIntent} valueLabel={formatPassCount(passes?.state)} variant="sub" />
        <ActionButton disabled={normalCommandsDisabled} icon="mdi:play" label="Clean" onClick={clean} tone="primary" />
      </div>
    </>
  )
  const areaCleaningSetup = areaCleaning ? (
    <>
      <Description>{AREA_DESCRIPTION}</Description>
      <div className={styles.areaActionGrid}>
        <ActionButton
          detailTrigger="vacuum-area-editor"
          disabled={normalCommandsDisabled || !mapReady || !onEditArea}
          icon={areaSelection ? 'mdi:pencil' : 'mdi:selection-drag'}
          label={areaSelection ? 'Edit Area' : 'Draw Area'}
          onClick={() => onEditArea?.()}
          tone="primary"
        />
        {areaSelection && <ActionButton icon="mdi:delete-outline" label="Clear Area" onClick={() => onAreaSelectionChange(null)} />}
      </div>
      {areaEditorMeta.error && <InlineAlert>{areaEditorMeta.error}</InlineAlert>}
      {servicesLoaded && !areaServiceReady && (
        <Description className={styles.areaBackendNote}>
          Local preview only: {areaCleaning.script} is not installed in Home Assistant, so starting an area clean is disabled.
        </Description>
      )}
      <Description>These settings are confirmed in Home Assistant before the area-cleaning command is sent.</Description>
      <div className={styles.cleaningActionGrid} data-layout="cleaning">
        <SelectSetting disabled={!showCleaningSetup || normalCommandsDisabled} entity={passes} entityId={vacuum.passesEntityId} formatOptionLabel={formatPassCount} hideLabel icon="mdi:numeric" label="Cleaning Passes" onIntent={coordinator.registerIntent} valueLabel={formatPassCount(passes?.state)} variant="sub" />
        <ActionButton disabled={areaStartDisabled} icon="mdi:play" label="Start Area Clean" onClick={cleanArea} tone="primary" />
      </div>
    </>
  ) : roomsCleaningSetup
  const cleaningSetupControls = areaCleaning ? (
    <>
      <VacuumCleanTargetSelector
        areaSelected={Boolean(areaSelection)}
        disabled={normalCommandsDisabled}
        onSelectArea={() => onEditArea?.()}
        onSelectRooms={onOpenRoomsTab}
        roomsSelected={roomsSelected}
      />
      {cleanTarget === 'area' ? areaCleaningSetup : showCleaningSetup ? roomsCleaningSetup : null}
    </>
  ) : showCleaningSetup ? roomsCleaningSetup : null
  const visibleCleaningSetupControls = runtimeMode === 'full' && !resumable ? cleaningSetupControls : null
  const hasRuntimeActions = state === 'idle'
    || (state === 'error' && !resumable && !lowBattery)
    || resumeReady
    || cancelResumeVisible
    || state === 'cleaning'
    || state === 'paused'
    || state === 'returning'

  if (isUnavailableState(state) || (!visibleCleaningSetupControls && !hasRuntimeActions && !coordinator.cleanError)) return null

  return (
    <ControlSection title={sectionTitle}>
      {visibleCleaningSetupControls}
      {state === 'idle' && <ActionButton description="Send the robot back to the dock." disabled={recoveryCommandsDisabled || cancelResumePending} icon="mdi:home" label="Dock" onClick={dock} />}
      {state === 'error' && !resumable && !lowBattery && <ActionButton description="Stop the current vacuum task." disabled={recoveryCommandsDisabled} icon="mdi:stop" label="Stop" onClick={stop} tone="danger" />}
      {state === 'error' && !resumable && !lowBattery && <ActionButton description="Send the robot back to the dock." disabled={recoveryCommandsDisabled} icon="mdi:home" label="Dock" onClick={dock} />}
      {resumeReady && <ActionButton description="Continue the interrupted cleaning run." disabled={recoveryCommandsDisabled || cancelResumePending} icon="mdi:play" label="Resume" onClick={start} tone="primary" />}
      {cancelResumeVisible && <ActionButton description="Cancel the pending cleaning resume." disabled={recoveryCommandsDisabled || cancelResumePending} icon="mdi:stop" label="Cancel" onClick={cancelResume} tone="danger" />}
      {state === 'cleaning' && <ActionButton description="Pause the current cleaning run." disabled={recoveryCommandsDisabled} icon="mdi:pause" label="Pause" onClick={pause} tone="warning" />}
      {state === 'cleaning' && <ActionButton description="Stop the current cleaning run." disabled={recoveryCommandsDisabled} icon="mdi:stop" label="Stop" onClick={stop} tone="danger" />}
      {state === 'paused' && <ActionButton description="Continue the paused cleaning run." disabled={recoveryCommandsDisabled} icon="mdi:play" label="Resume" onClick={start} tone="primary" />}
      {state === 'paused' && <ActionButton description="Stop the paused cleaning run." disabled={recoveryCommandsDisabled} icon="mdi:stop" label="Stop" onClick={stop} tone="danger" />}
      {state === 'returning' && <ActionButton description="Pause the return-to-dock action." disabled={recoveryCommandsDisabled || cancelResumePending} icon="mdi:pause" label="Pause" onClick={pause} tone="warning" />}
      {coordinator.cleanError && <InlineAlert>{coordinator.cleanError}</InlineAlert>}
    </ControlSection>
  )
}

function VacuumDockControlsSection({
  activeRuntimeOnly = false,
  commandPolicyMode,
  coordinator,
  optimisticState,
  vacuum,
}: {
  activeRuntimeOnly?: boolean
  commandPolicyMode: VacuumCommandPolicyMode
  coordinator: VacuumCommandCoordinator
  optimisticState: OptimisticVacuumState
  vacuum: VacuumConfig
}) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const services = useHass((state) => state.services)
  const dockStatus = useOptionalEntity(vacuum.dockControls?.dockStatusEntityId)
  const mopAttachment = useOptionalEntity(vacuum.dockControls?.mopAttachmentEntityId)
  const state = optimisticState.state
  const liveDockState = dockStatus?.state ?? 'unknown'
  const [displayDockState, commitDockState] = useOptimisticState(liveDockState, { clearOn: 'confirmation', revertMs: VACUUM_OPTIMISTIC_REVERT_MS })
  const docked = state === 'docked'
  const mopAttached = mopAttachment?.state === 'on'
  const cleanActive = displayDockState === 'cleaning'
  const dryActive = displayDockState === 'drying'
  const dockBridgeAvailable = hassServiceAvailable(services, 'valetudo_vacuum_coordinator.dock_action')
  const cleanScriptAvailable = Boolean(vacuum.dockControls && dockBridgeAvailable && hassServiceAvailable(services, vacuum.dockControls.cleanScript))
  const dryScriptAvailable = Boolean(vacuum.dockControls && dockBridgeAvailable && hassServiceAvailable(services, vacuum.dockControls.dryScript))
  const startAllowed = commandPolicyMode === VACUUM_COMMAND_NORMAL && !coordinator.controlsDisabled
  const stopAllowed = commandPolicyMode !== VACUUM_COMMAND_NONE && !coordinator.controlsDisabled
  const cleanAllowed = docked
    && mopAttached
    && cleanScriptAvailable
    && ['idle', 'cleaning', 'pause'].includes(displayDockState)
    && (cleanActive ? stopAllowed : startAllowed)
  const dryAllowed = docked
    && mopAttached
    && dryScriptAvailable
    && ['idle', 'drying', 'pause'].includes(displayDockState)
    && (dryActive ? stopAllowed : startAllowed)
  const emptyAllowed = Boolean(vacuum.dockButtonEntityId && docked && ['idle', 'pause'].includes(displayDockState) && startAllowed)
  const emptyDock = () => vacuum.dockButtonEntityId && callServiceAction(callService, 'button.press', vacuum.dockButtonEntityId)
  const cleanDock = () => {
    if (!vacuum.dockControls || !cleanAllowed) return
    commitDockState(cleanActive ? 'idle' : 'cleaning')
    callServiceAction(callService, vacuum.dockControls.cleanScript)
  }
  const dryMops = () => {
    if (!vacuum.dockControls || !dryAllowed) return
    commitDockState(dryActive ? 'idle' : 'drying')
    callServiceAction(callService, vacuum.dockControls.dryScript)
  }

  if (!vacuum.dockButtonEntityId && !vacuum.dockControls) return null
  const showCleanAction = Boolean(vacuum.dockControls && (!activeRuntimeOnly || cleanActive))
  const showDryAction = Boolean(vacuum.dockControls && (!activeRuntimeOnly || dryActive))
  const showEmptyAction = Boolean(vacuum.dockButtonEntityId && !activeRuntimeOnly)
  if (!showCleanAction && !showDryAction && !showEmptyAction) return null

  return (
    <ControlSection title="Dock Controls">
      <div className={styles.dockActionGrid}>
        {showCleanAction && vacuum.dockControls && (
          <ActionButton
            description={cleanActive ? 'Finish the dock-cleaning phase and drain the wash tray into the dirty-water tank.' : 'Start the mop-dock cleaning phase. Use Stop Dock Clean when finished so the dock drains the wash tray.'}
            disabled={!cleanAllowed}
            icon={cleanActive ? 'mdi:stop' : 'mdi:water'}
            label={cleanActive ? 'Stop Dock Clean' : 'Clean Mop Dock'}
            onClick={cleanDock}
            tone={cleanActive ? 'warning' : 'neutral'}
          />
        )}
        {showDryAction && vacuum.dockControls && (
          <ActionButton
            description={dryActive ? 'Stop the current mop-drying cycle.' : 'Start drying the attached mop pads.'}
            disabled={!dryAllowed}
            icon={dryActive ? 'mdi:stop' : 'mdi:weather-windy'}
            label={dryActive ? 'Stop Mop Drying' : 'Dry Mops'}
            onClick={dryMops}
          />
        )}
        {showEmptyAction && vacuum.dockButtonEntityId && (
          <ActionButton
            description="Trigger the dock to empty the robot dustbin into its dust bag."
            disabled={!emptyAllowed}
            icon="mdi:delete-restore"
            label="Empty Bin"
            onClick={emptyDock}
          />
        )}
      </div>
      {vacuum.dockControls && !mopAttached && <InlineAlert>Attach the mop pads before cleaning or drying them at the dock.</InlineAlert>}
      {vacuum.dockControls && !dockBridgeAvailable && <InlineAlert>Dock cleaning and drying controls will be available after Home Assistant restarts.</InlineAlert>}
    </ControlSection>
  )
}

function VacuumControlsSection({
  areaEditorMeta,
  areaSelection,
  commandPolicyMode,
  coordinator,
  panelStatusVisible,
  onAreaSelectionChange,
  onOpenRoomsTab,
  onEditArea,
  optimisticState,
  runtimeMode,
  status,
  vacuum,
}: {
  areaEditorMeta: ValetudoMapEditorMeta
  areaSelection: MapGridRect | null
  commandPolicyMode: VacuumCommandPolicyMode
  coordinator: VacuumCommandCoordinator
  panelStatusVisible: boolean
  onAreaSelectionChange: (selection: MapGridRect | null) => void
  onOpenRoomsTab: () => void
  onEditArea?: () => void
  optimisticState: OptimisticVacuumState
  runtimeMode: VacuumRuntimeMode
  status: ResolvedVacuumStatus
  vacuum: VacuumConfig
}) {
  const copy = useCopy(VACUUM_COPY_NAMESPACE)
  const statusFlag = useEntity(asEntityName(vacuum.statusFlagEntityId), { returnNullIfNotFound: true })
  const error = useEntity(asEntityName(vacuum.errorEntityId), { returnNullIfNotFound: true })
  const resumable = isResumable(statusFlag?.state)
  const lowBattery = error?.state === 'Low battery'
  const runtimeActionsVisible = !isUnavailableState(optimisticState.state)
    && (
      runtimeMode === 'full'
      || optimisticState.state === 'idle'
      || (optimisticState.state === 'error' && !resumable && !lowBattery)
      || (resumable && (optimisticState.state === 'docked' || optimisticState.state === 'error' || optimisticState.state === 'idle' || optimisticState.state === 'returning'))
      || (resumable && (optimisticState.state === 'docked' || optimisticState.state === 'idle'))
      || optimisticState.state === 'cleaning'
      || optimisticState.state === 'paused'
      || optimisticState.state === 'returning'
    )
  const fallbackMessage = status.primaryAvailable
    ? status.currentIssue.raw ?? formatStateValue(optimisticState.state)
    : copy(VACUUM_COPY_KEYS.status.unavailableHelp)

  return (
    <div className={styles.controlStack}>
      <VacuumStateActions
        areaEditorMeta={areaEditorMeta}
        areaSelection={areaSelection}
        cleanTarget={areaSelection ? 'area' : 'rooms'}
        commandPolicyMode={commandPolicyMode}
        coordinator={coordinator}
        runtimeMode={runtimeMode}
        onAreaSelectionChange={onAreaSelectionChange}
        onOpenRoomsTab={onOpenRoomsTab}
        onEditArea={onEditArea}
        optimisticState={optimisticState}
        vacuum={vacuum}
      />
      {!panelStatusVisible && !runtimeActionsVisible && (
        <ControlSection title={formatStateValue(optimisticState.state)}>
          <Description>{fallbackMessage}</Description>
        </ControlSection>
      )}
      <VacuumPowerSettings coordinator={coordinator} runtimeMode={runtimeMode} vacuum={vacuum} />
    </div>
  )
}

function VacuumWhileAwaySection({
  onOpenOutcomes,
  presentation,
  vacuum,
}: {
  onOpenOutcomes?: () => void
  presentation: VacuumWhileAwayPresentation
  vacuum: VacuumConfig
}) {
  const copy = useCopy(VACUUM_COPY_NAMESPACE)

  if (presentation.kind === 'empty') return null
  if (presentation.kind === 'typed' && onOpenOutcomes) {
    return <VacuumOutcomeOverview contract={presentation.contract} onOpen={onOpenOutcomes} vacuum={vacuum} />
  }
  const cleaned = presentation.cleaned
  const issues = presentation.issues
  if (!cleaned.length && !issues.length) return null

  return (
    <section className={styles.section} data-modal-detail-trigger="vacuum-outcomes" tabIndex={-1}>
      <SectionHeader title={copy(VACUUM_COPY_KEYS.outcomes.sectionTitle, { room: vacuum.title })} />
      <div className={styles.awaySummary}>
        {cleaned.length > 0 && (
          <InfoBox title={copy(VACUUM_COPY_KEYS.cleaned)}>
            <ul>
              {cleaned.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </InfoBox>
        )}
        {issues.length > 0 && (
          <InfoBox title={copy(VACUUM_COPY_KEYS.issues)} tone="warning">
            <ul>
              {issues.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </InfoBox>
        )}
      </div>
    </section>
  )
}

function VacuumZones({
  coordinator,
  onToggleZone,
  runtimeMode,
  vacuum,
}: {
  coordinator: VacuumCommandCoordinator
  onToggleZone: (zone: VacuumZoneConfig) => void
  runtimeMode: VacuumRuntimeMode
  vacuum: VacuumConfig
}) {
  const copy = useCopy(VACUUM_COPY_NAMESPACE)
  const entities = useHass((hass) => hass.entities) as unknown as Record<string, EntityLike | undefined>
  const editableZones = runtimeMode === 'full'

  if (vacuum.zones.length === 0) return null
  const cleaningOrder = new Map(orderedSelectedVacuumZones(vacuum.zones, entities, coordinator).map(({ zone }, index) => [zone.entityId, index + 1]))

  return (
    <section className={styles.section}>
      <SectionHeader title={copy(VACUUM_COPY_KEYS.roomsSection)} />
      <SectionText lines={vacuum.zoneDescription} />
      <Description>{ROOM_ORDER_DESCRIPTION}</Description>
      <div className={styles.zones}>
        {vacuum.zones.map((zone) => <ZoneButton active={vacuumZoneSelected(zone, entities, coordinator)} disabled={!editableZones || coordinator.controlsDisabled} key={zone.entityId} onToggle={onToggleZone} order={cleaningOrder.get(zone.entityId)} zone={zone} />)}
      </div>
    </section>
  )
}

function VacuumAutoCleanDisabledRooms({ vacuum }: { vacuum: VacuumConfig }) {
  const copy = useCopy(VACUUM_COPY_NAMESPACE)
  const rooms = vacuum.autoCleanDisabledRooms ?? []

  if (rooms.length === 0) return null

  return (
    <section className={styles.section}>
      <SectionHeader title="Disabled Auto-Clean Rooms" />
      <Description className={styles.autoCleanDescription}>{AUTO_CLEAN_DISABLED_DESCRIPTION}</Description>
      <DynamicGrid ariaLabel={copy(VACUUM_COPY_KEYS.autoCleanGridLabel)} className={styles.autoCleanCheckboxGrid} columns={2} forceEquivalentColumnCount gap={8}>
        {rooms.map((room) => <AutoCleanDisabledRoomCheckbox key={room.entityId} room={room} />)}
      </DynamicGrid>
    </section>
  )
}

function VacuumModalNav({
  activeTab,
  onTabChange,
  tabs,
  vacuum,
}: {
  activeTab: VacuumModalTab
  onTabChange: (tab: VacuumModalTab) => void
  tabs: readonly (typeof VACUUM_MODAL_TABS)[number][]
  vacuum: VacuumConfig
}) {
  const copy = useCopy(CORE_COPY_NAMESPACE)
  const idPrefix = `vacuum-${vacuum.vacuumMapId}`

  return (
    <ModalIconTabNav
      activeTab={activeTab}
      animateMembership
      idPrefix={idPrefix}
      label={copy(CORE_COPY_KEYS.modal.sectionNavigation, { title: vacuum.title })}
      onTabChange={onTabChange}
      panelId={modalTabPanelId(idPrefix, 'content')}
      tabs={tabs}
    />
  )
}

function VacuumModalTabContent({
  activeTab,
  areaEditorMeta,
  areaEditorOpen,
  areaSelection,
  cleanTarget,
  drawMode,
  onActiveTabChange,
  onAreaEditorMetaChange,
  onAreaSelectionChange,
  onDrawModeChange,
  onEditArea,
  onFinishAreaEditing,
  onOpenOutcomes,
  onResetAreaView,
  outcomePresentation,
  optimisticState,
  resetAreaViewRevision,
  runtimeMode,
  status,
  visibleTabs,
  vacuum,
}: {
  activeTab: VacuumModalTab
  areaEditorMeta: ValetudoMapEditorMeta
  areaEditorOpen: boolean
  areaSelection: MapGridRect | null
  cleanTarget: VacuumCleanTarget
  drawMode: boolean
  onActiveTabChange: (tab: VacuumModalTab) => void
  onAreaEditorMetaChange: (meta: ValetudoMapEditorMeta) => void
  onAreaSelectionChange: (selection: MapGridRect | null) => void
  onDrawModeChange: (drawMode: boolean) => void
  onEditArea?: () => void
  onFinishAreaEditing: () => void
  onOpenOutcomes?: () => void
  onResetAreaView: () => void
  outcomePresentation: VacuumWhileAwayPresentation
  optimisticState: OptimisticVacuumState
  resetAreaViewRevision: number
  runtimeMode: VacuumRuntimeMode
  status: ResolvedVacuumStatus
  visibleTabs: readonly (typeof VACUUM_MODAL_TABS)[number][]
  vacuum: VacuumConfig
}) {
  const copy = useCopy(VACUUM_COPY_NAMESPACE)
  const modalBodyRef = useRef<HTMLDivElement | null>(null)
  const modalPanelRef = useRef<HTMLDivElement | null>(null)
  const leftPaneRef = useRef<HTMLDivElement | null>(null)
  const tabIdPrefix = `vacuum-${vacuum.vacuumMapId}`
  const { displayedTab: displayedActiveTab, transitionState } = useSmoothDisplayedModalTab(activeTab)
  const [requestedMapStatusLayout, setRequestedMapStatusLayout] = useState<VacuumMapStatusLayout>(() => (
    typeof window !== 'undefined' && window.innerWidth >= 760 && window.innerHeight < 560 ? 'split' : 'stacked'
  ))
  const {
    displayedTab: displayedMapStatusLayout,
    transitionState: mapStatusTransitionState,
  } = useSmoothDisplayedModalTab(requestedMapStatusLayout)
  const [layoutMeasured, setLayoutMeasured] = useState(false)
  const [layoutPreparationPhase, setLayoutPreparationPhase] = useState<VacuumLayoutPreparationPhase>('loading')
  const [viewportLayout, setViewportLayout] = useState<VacuumViewportLayout>(() => vacuumViewportLayout(requestedMapStatusLayout))
  const layoutLoadingStartedAtRef = useRef(0)
  const stackedStatusHeightRef = useRef(0)
  const viewportLayoutRef = useRef<VacuumViewportLayout>(viewportLayout)
  const previousAreaEditorOpenRef = useRef(areaEditorOpen)
  const mapLoaded = areaEditorMeta.isLoaded
  const panelSections = visibleTabs.map((tab) => tab.label.toLowerCase())
  const panelLabel = `${vacuum.title} ${panelSections.join(', ')}`
  const coordinator = useVacuumCommandCoordinator(optimisticState.liveState, status.commandPolicyMode, optimisticState.commitState)
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const locate = useCallback(() => callServiceAction(callService, 'vacuum.locate', vacuum.entityId), [callService, vacuum.entityId])
  const entities = useHass((state) => state.entities) as unknown as Record<string, EntityLike | undefined>
  const selectedRooms = orderedSelectedVacuumZones(vacuum.zones, entities, coordinator)
  const selectedRoomMarkers = selectedRooms.map(({ zone }, index) => ({ entityId: zone.entityId, order: index + 1 }))
  useVacuumSettingIntentConfirmations(vacuum, coordinator.confirmIntent)

  const setRoomMode = useCallback((zones: VacuumZoneConfig[]) => {
    if (!vacuum.modeEntityId || zones.length === 0) return
    const option = zones.every((zone) => !vacuumZoneRequiresMop(zone, entities)) ? 'vacuum' : 'vacuum_and_mop'
    const modeEntity = entities[vacuum.modeEntityId]
    const options = entityOptions(modeEntity)
    if (!options.includes(option) || (coordinator.pendingIntentState(vacuum.modeEntityId) ?? modeEntity?.state) === option) return
    coordinator.registerIntent(vacuum.modeEntityId, option)
    callService({ domain: 'select', service: 'select_option', target: vacuum.modeEntityId, serviceData: { option } })
  }, [callService, coordinator, entities, vacuum.modeEntityId])

  const toggleRoom = useCallback((zone: VacuumZoneConfig) => {
    if (runtimeMode !== 'full') return
    const active = vacuumZoneSelected(zone, entities, coordinator)
    if (!active && areaSelection && !window.confirm(copy(VACUUM_COPY_KEYS.confirmations.switchToRooms))) return
    if (!active && areaSelection) onAreaSelectionChange(null)
    const nextActive = !active
    coordinator.registerIntent(zone.entityId, nextActive ? 'on' : 'off')
    callService({ domain: 'input_boolean', service: nextActive ? 'turn_on' : 'turn_off', target: zone.entityId })
    const nextSelectedRooms = vacuum.zones.filter((candidate) => (
      candidate.entityId === zone.entityId ? nextActive : vacuumZoneSelected(candidate, entities, coordinator)
    ))
    setRoomMode(nextSelectedRooms)
  }, [areaSelection, callService, coordinator, copy, entities, onAreaSelectionChange, runtimeMode, setRoomMode, vacuum.zones])

  const editArea = useCallback(() => {
    if (!onEditArea || runtimeMode !== 'full') return
    if (selectedRooms.length > 0 && !window.confirm(copy(VACUUM_COPY_KEYS.confirmations.switchToArea))) return
    for (const { zone } of selectedRooms) {
      coordinator.registerIntent(zone.entityId, 'off')
      callService({ domain: 'input_boolean', service: 'turn_off', target: zone.entityId })
    }
    onEditArea()
  }, [callService, coordinator, copy, onEditArea, runtimeMode, selectedRooms])
  const openRoomsTab = useCallback(() => {
    if (!visibleTabs.some((tab) => tab.tab === 'zones')) return
    onActiveTabChange('zones')
  }, [onActiveTabChange, visibleTabs])

  const resetTabScroll = useCallback(() => {
    const scrollContainers = [
      modalPanelRef.current,
      modalBodyRef.current?.closest<HTMLElement>('[data-modal-sheet-body="true"]'),
    ]
    for (const scrollContainer of scrollContainers) {
      if (!scrollContainer || typeof scrollContainer.scrollTo !== 'function') continue
      scrollContainer.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [])

  useLayoutEffect(() => {
    resetTabScroll()
  }, [displayedActiveTab, resetTabScroll])

  useLayoutEffect(() => {
    if (activeTab !== displayedActiveTab || transitionState !== 'idle') return
    resetTabScroll()
  }, [activeTab, displayedActiveTab, resetTabScroll, transitionState])

  const beginLayoutPreparation = useCallback(() => {
    layoutLoadingStartedAtRef.current = Date.now()
    setLayoutMeasured(false)
    setLayoutPreparationPhase('loading')
  }, [])

  useLayoutEffect(() => {
    if (previousAreaEditorOpenRef.current && !areaEditorOpen) beginLayoutPreparation()
    previousAreaEditorOpenRef.current = areaEditorOpen
  }, [areaEditorOpen, beginLayoutPreparation])

  useLayoutEffect(() => {
    const pane = leftPaneRef.current
    const modalGrid = modalBodyRef.current
    const sheetBody = modalGrid?.closest<HTMLElement>('[data-modal-sheet-body="true"]')
    if (!pane || !modalGrid || !sheetBody) return undefined
    if (areaEditorOpen) {
      pane.style.removeProperty('--vacuum-map-available-height')
      delete modalGrid.dataset.mapStatusLayout
      return undefined
    }

    const measure = () => {
        const gridColumns = getComputedStyle(modalGrid).gridTemplateColumns.split(' ').filter(Boolean)
        if (gridColumns.length < 2) {
          pane.style.removeProperty('--vacuum-map-available-height')
          delete modalGrid.dataset.mapStatusLayout
          setRequestedMapStatusLayout('stacked')
          setLayoutMeasured(true)
          return 'stacked' as const
        }

        const modalShell = modalGrid.parentElement
        const modalNav = modalGrid.nextElementSibling as HTMLElement | null
        const shellGap = modalShell ? Number.parseFloat(getComputedStyle(modalShell).rowGap) || 0 : 0
        const modalGridStyle = getComputedStyle(modalGrid)
        const sheetContentHeight = Number.parseFloat(getComputedStyle(sheetBody).getPropertyValue('--modal-body-content-height'))
        const gridHeight = modalNav && modalShell
          ? Math.max(0, modalShell.clientHeight - modalNav.offsetHeight - shellGap)
          : Number.isFinite(sheetContentHeight) ? sheetContentHeight : sheetBody.clientHeight
        const gridBlockPadding = (Number.parseFloat(modalGridStyle.paddingTop) || 0) + (Number.parseFloat(modalGridStyle.paddingBottom) || 0)
        const availableHeight = Math.max(0, gridHeight - gridBlockPadding)
        const paneHeight = `${availableHeight}px`
        if (modalGrid.style.getPropertyValue('--vacuum-pane-height') !== paneHeight) {
          modalGrid.style.setProperty('--vacuum-pane-height', paneHeight)
        }
        const mapStage = pane.querySelector<HTMLElement>('[data-vacuum-map-stage="true"]')
        const mapFrame = pane.querySelector<HTMLElement>('[data-valetudo-map-frame="true"]')
        const statusDetails = modalGrid.querySelector<HTMLElement>('[data-vacuum-status-details="true"]')
        if (!mapStage || !mapFrame || availableHeight <= 0) return
        if (statusDetails) stackedStatusHeightRef.current = statusDetails.scrollHeight

        const paneStyle = getComputedStyle(pane)
        const gap = Number.parseFloat(paneStyle.rowGap || paneStyle.gap) || 0
        const statusControls = pane.querySelector<HTMLElement>('[data-vacuum-map-status-controls="true"]')
        if (statusControls && pane.dataset.mapStatusLayout === 'split') {
          const paneGap = Number.parseFloat(getComputedStyle(pane).rowGap) || 0
          const mapHeightPx = Math.max(0, availableHeight - statusControls.offsetHeight - paneGap)
          const mapHeight = `${mapHeightPx}px`
          if (pane.style.getPropertyValue('--vacuum-map-available-height') !== mapHeight) {
            pane.style.setProperty('--vacuum-map-available-height', mapHeight)
          }
          modalGrid.dataset.mapStatusLayout = 'split'
        } else {
          pane.style.removeProperty('--vacuum-map-available-height')
          delete modalGrid.dataset.mapStatusLayout
        }

        const mapMinimumHeight = Number.parseFloat(getComputedStyle(mapFrame).getPropertyValue('--map-min-height')) || 0
        const naturalMapHeight = Math.min(mapMinimumHeight, availableHeight * 0.75)
        const mapSupplementHeight = Math.max(0, mapStage.scrollHeight - mapFrame.clientHeight)
        const estimatedStackedHeight = naturalMapHeight + mapSupplementHeight + stackedStatusHeightRef.current + gap
        const nextLayout = estimatedStackedHeight > availableHeight + 1 ? 'split' : 'stacked'
        setRequestedMapStatusLayout(nextLayout)
        setLayoutMeasured(true)
        return nextLayout
    }

    const handleViewportResize = () => {
      const nextLayout = measure()
      if (!nextLayout) return
      const nextViewportLayout = vacuumViewportLayout(nextLayout)
      if (nextViewportLayout !== viewportLayoutRef.current) {
        beginLayoutPreparation()
        setLayoutMeasured(true)
      }
      viewportLayoutRef.current = nextViewportLayout
      setViewportLayout(nextViewportLayout)
    }

    const initialLayout = measure()
    if (initialLayout) {
      const initialViewportLayout = vacuumViewportLayout(initialLayout)
      viewportLayoutRef.current = initialViewportLayout
      setViewportLayout(initialViewportLayout)
    }
    const ResizeObserverConstructor = window.ResizeObserver
    if (typeof ResizeObserverConstructor === 'undefined') {
      window.addEventListener('resize', handleViewportResize)
      return () => window.removeEventListener('resize', handleViewportResize)
    }

    const observer = new ResizeObserverConstructor(measure)
    observer.observe(modalGrid)
    observer.observe(sheetBody)
    observer.observe(pane)
    if (modalGrid.parentElement) observer.observe(modalGrid.parentElement)
    if (modalGrid.nextElementSibling) observer.observe(modalGrid.nextElementSibling)
    const statusDetails = pane.querySelector<HTMLElement>('[data-vacuum-status-details="true"]')
    if (statusDetails) observer.observe(statusDetails)
    window.addEventListener('resize', handleViewportResize)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', handleViewportResize)
    }
  }, [areaEditorOpen, beginLayoutPreparation, displayedMapStatusLayout])

  useEffect(() => {
    if (areaEditorOpen || !layoutMeasured || requestedMapStatusLayout !== displayedMapStatusLayout || mapStatusTransitionState !== 'idle') return undefined

    if (layoutPreparationPhase === 'loading') {
      if (layoutLoadingStartedAtRef.current === 0) layoutLoadingStartedAtRef.current = Date.now()
      const elapsed = Date.now() - layoutLoadingStartedAtRef.current
      const readyDelay = mapLoaded ? VACUUM_LAYOUT_LOADING_MIN_MS : DASHBOARD_PAGE_LOAD_TIMEOUT_MS
      const timer = window.setTimeout(
        () => setLayoutPreparationPhase('exiting'),
        Math.max(0, readyDelay - elapsed),
      )
      return () => window.clearTimeout(timer)
    }

    if (layoutPreparationPhase === 'exiting') {
      const timer = window.setTimeout(() => setLayoutPreparationPhase('content'), VACUUM_LAYOUT_LOADING_EXIT_MS)
      return () => window.clearTimeout(timer)
    }

    return undefined
  }, [areaEditorOpen, displayedMapStatusLayout, layoutMeasured, layoutPreparationPhase, mapLoaded, mapStatusTransitionState, requestedMapStatusLayout])

  const compactMapStatusLayout = !areaEditorOpen && displayedMapStatusLayout === 'split'
  const tallLandscapeLayout = !areaEditorOpen && viewportLayout === 'tall-landscape'
  const compactMapPresentation = compactMapStatusLayout || tallLandscapeLayout
  const modalPresentation = useModalSheetPresentation()
  const landscapeViewport = !areaEditorOpen && (viewportLayout !== 'portrait'
    || modalPresentation !== 'sheet'
    || (typeof window !== 'undefined' && window.innerWidth > window.innerHeight))
  const reportedStatusInRightPane = !areaEditorOpen
    && !status.primaryAvailable
    && landscapeViewport
  const cleaningReportInRightPane = !areaEditorOpen
    && (compactMapStatusLayout || tallLandscapeLayout || modalPresentation !== 'sheet')
  const effectiveMapStatusTransitionState = requestedMapStatusLayout !== displayedMapStatusLayout && mapStatusTransitionState === 'idle'
    ? 'exiting'
    : mapStatusTransitionState
  const visibleLayoutPreparationPhase = areaEditorOpen ? 'content' : layoutPreparationPhase
  const layoutLoadingVisible = !areaEditorOpen && visibleLayoutPreparationPhase !== 'content'
  const layoutLoadingPhase = visibleLayoutPreparationPhase === 'exiting' ? 'exiting' : 'loading'
  const controlsPanelStatusVisible = reportedStatusInRightPane
    || compactMapPresentation
    || (cleaningReportInRightPane && outcomePresentation.kind !== 'empty')

  return (
    <div
      className={[styles.modalBody, areaEditorOpen ? styles.areaEditorModalBody : ''].filter(Boolean).join(' ')}
      data-area-editor={areaEditorOpen ? 'true' : 'false'}
      data-layout-preparation-phase={visibleLayoutPreparationPhase}
      data-map-status-layout={areaEditorOpen ? 'editor' : displayedMapStatusLayout}
      data-map-status-layout-transition={areaEditorOpen ? 'idle' : effectiveMapStatusTransitionState}
      data-reported-status-pane={reportedStatusInRightPane ? 'right' : 'inline'}
      data-vacuum-viewport-layout={areaEditorOpen ? 'editor' : viewportLayout}
      ref={modalBodyRef}
    >
      <VacuumIntentConfirmationTrackers coordinator={coordinator} vacuum={vacuum} />
      <div
        aria-label={`${vacuum.title} map and status`}
        className={[styles.leftPane, areaEditorOpen ? styles.areaEditorPane : ''].filter(Boolean).join(' ')}
        data-map-status-layout={areaEditorOpen ? 'editor' : displayedMapStatusLayout}
        data-map-status-layout-transition={areaEditorOpen ? 'idle' : effectiveMapStatusTransitionState}
        data-vacuum-viewport-layout={areaEditorOpen ? 'editor' : viewportLayout}
        ref={leftPaneRef}
        role="group"
      >
        <VacuumMapAndStatus
          areaEditorOpen={areaEditorOpen}
          compactLayout={compactMapPresentation}
          areaSelection={areaSelection}
          drawMode={drawMode}
          editorMetaChange={onAreaEditorMetaChange}
          onAreaSelectionChange={onAreaSelectionChange}
          onDrawModeChange={onDrawModeChange}
          onFinishAreaEditing={onFinishAreaEditing}
          onLocate={locate}
          onOpenOutcomes={onOpenOutcomes}
          onResetAreaView={onResetAreaView}
          onRoomToggle={runtimeMode === 'full' ? toggleRoom : undefined}
          optimisticState={optimisticState}
          outcomePresentation={outcomePresentation}
          resetAreaViewRevision={resetAreaViewRevision}
          selectedRooms={selectedRoomMarkers}
          showAreaSelection={cleanTarget === 'area'}
          showCleaningReport={!cleaningReportInRightPane}
          showReportedNotice={!reportedStatusInRightPane}
          showStatusDetails={!reportedStatusInRightPane}
          status={status}
          vacuum={vacuum}
        />
      </div>
      {!areaEditorOpen && (
        <div aria-label={panelLabel} className={styles.rightPane} data-modal-tab-transition-state={transitionState} data-scroll-region="vacuum-panel" data-tab={displayedActiveTab} ref={modalPanelRef} role="group">
          <div aria-labelledby={modalTabId(tabIdPrefix, activeTab)} className={styles.rightPaneContent} id={modalTabPanelId(tabIdPrefix, 'content')} role="tabpanel">
            {displayedActiveTab === 'controls' && (
              <>
                {reportedStatusInRightPane ? (
                  <div className={styles.compactStatusStack} data-vacuum-reported-status="true" data-vacuum-status-details="true">
                    <ValetudoReportedMapNotice reportedPositionPresent={areaEditorMeta.reportedPositionPresent} />
                    <VacuumStatusSummary displayState={optimisticState.state} liveState={optimisticState.liveState} locate={locate} mapProvenance={areaEditorMeta.provenance} showLocate={compactMapPresentation} status={status} vacuum={vacuum} />
                    <VacuumWhileAwaySection onOpenOutcomes={onOpenOutcomes} presentation={outcomePresentation} vacuum={vacuum} />
                  </div>
                ) : compactMapPresentation ? (
                  <div className={styles.compactStatusStack} data-vacuum-status-details="true">
                    <VacuumStatusSummary displayState={optimisticState.state} liveState={optimisticState.liveState} locate={locate} mapProvenance={areaEditorMeta.provenance} showLocate status={status} vacuum={vacuum} />
                    <VacuumWhileAwaySection onOpenOutcomes={onOpenOutcomes} presentation={outcomePresentation} vacuum={vacuum} />
                  </div>
                ) : cleaningReportInRightPane ? (
                  <VacuumWhileAwaySection onOpenOutcomes={onOpenOutcomes} presentation={outcomePresentation} vacuum={vacuum} />
                ) : null}
                <VacuumControlsSection
                  areaEditorMeta={areaEditorMeta}
                  areaSelection={areaSelection}
                  commandPolicyMode={status.commandPolicyMode}
                  coordinator={coordinator}
                  onAreaSelectionChange={onAreaSelectionChange}
                  onOpenRoomsTab={openRoomsTab}
                  onEditArea={editArea}
                  panelStatusVisible={controlsPanelStatusVisible}
                  optimisticState={optimisticState}
                  runtimeMode={runtimeMode}
                  status={status}
                  vacuum={vacuum}
                />
              </>
            )}
            {displayedActiveTab === 'zones' && <VacuumZones coordinator={coordinator} onToggleZone={toggleRoom} runtimeMode={runtimeMode} vacuum={vacuum} />}
            {displayedActiveTab === 'autoClean' && <VacuumAutoCleanDisabledRooms vacuum={vacuum} />}
            {displayedActiveTab === 'more' && (
              <VacuumDockControlsSection
                activeRuntimeOnly={runtimeMode === 'minimal'}
                commandPolicyMode={status.commandPolicyMode}
                coordinator={coordinator}
                optimisticState={optimisticState}
                vacuum={vacuum}
              />
            )}
            {displayedActiveTab === 'info' && <VacuumInfoSection vacuum={vacuum} />}
          </div>
        </div>
      )}
      {layoutLoadingVisible && (
        <DashboardPageLoading
          className={styles.vacuumLayoutLoading}
          label={copy('layout.loading')}
          phase={layoutLoadingPhase}
        />
      )}
    </div>
  )
}

function VacuumMapAndStatus({
  areaEditorOpen,
  compactLayout,
  areaSelection,
  drawMode,
  editorMetaChange,
  onAreaSelectionChange,
  onDrawModeChange,
  onFinishAreaEditing,
  onLocate,
  onOpenOutcomes,
  onResetAreaView,
  onRoomToggle,
  optimisticState,
  outcomePresentation,
  resetAreaViewRevision,
  selectedRooms,
  showAreaSelection,
  showCleaningReport,
  showReportedNotice,
  showStatusDetails,
  status,
  vacuum,
}: {
  areaEditorOpen: boolean
  compactLayout: boolean
  areaSelection: MapGridRect | null
  drawMode: boolean
  editorMetaChange: (meta: ValetudoMapEditorMeta) => void
  onAreaSelectionChange: (selection: MapGridRect | null) => void
  onDrawModeChange: (drawMode: boolean) => void
  onFinishAreaEditing: () => void
  onLocate: () => void
  onOpenOutcomes?: () => void
  onResetAreaView: () => void
  onRoomToggle?: (zone: VacuumZoneConfig) => void
  optimisticState: OptimisticVacuumState
  outcomePresentation: VacuumWhileAwayPresentation
  resetAreaViewRevision: number
  selectedRooms: Array<{ entityId: string; order: number }>
  showAreaSelection: boolean
  showCleaningReport: boolean
  showReportedNotice: boolean
  showStatusDetails: boolean
  status: ResolvedVacuumStatus
  vacuum: VacuumConfig
}) {
  const copy = useCopy(VACUUM_COPY_NAMESPACE)
  const deviceCommandsAllowed = status.primaryAvailable && status.commandPolicyMode === VACUUM_COMMAND_NORMAL
  const locateAllowed = status.primaryAvailable
  const [editorMeta, setEditorMeta] = useState<ValetudoMapEditorMeta>({
    displayScope: VALETUDO_MAP_SCOPE_FULL,
    error: null,
    focusAvailable: false,
    geometry: null,
    isLoaded: false,
    provenance: VALETUDO_MAP_PROVENANCE_NONE,
    reportedPositionPresent: false,
    selectionAllowed: true,
  })
  const mapCommandsAllowed = deviceCommandsAllowed && editorMeta.isLoaded
  useLayoutEffect(() => {
    if (!areaEditorOpen || status.primaryAvailable) return
    onDrawModeChange(false)
    onResetAreaView()
    onFinishAreaEditing()
  }, [areaEditorOpen, onDrawModeChange, onFinishAreaEditing, onResetAreaView, status.primaryAvailable])
  const handleEditorMetaChange = useCallback((meta: ValetudoMapEditorMeta) => {
    setEditorMeta(meta)
    editorMetaChange(meta)
  }, [editorMetaChange])
  const dimensions = areaSelection && editorMeta.geometry
    ? mapGridRectDimensionsCm(areaSelection, editorMeta.geometry.pixelSize)
    : null
  const beginDrawing = () => {
    if (areaSelection) onAreaSelectionChange(null)
    onDrawModeChange(true)
  }

  return (
    <>
      {areaEditorOpen && mapCommandsAllowed && (
        <div className={styles.areaEditorToolbar}>
          <button
            className={styles.areaEditorTool}
            data-active={drawMode ? 'true' : 'false'}
            data-modal-detail-autofocus="true"
            disabled={!mapCommandsAllowed}
            onClick={beginDrawing}
            type="button"
          >
            <MaterialIcon name="mdi:selection-drag" size={19} />
            {areaSelection ? 'Redraw' : 'Draw'}
          </button>
          <button className={styles.areaEditorTool} disabled={!mapCommandsAllowed} onClick={onResetAreaView} type="button">
            <MaterialIcon name="mdi:fit-to-screen-outline" size={19} />
            Reset View
          </button>
          <button className={styles.areaEditorTool} disabled={!mapCommandsAllowed || !areaSelection} onClick={() => onAreaSelectionChange(null)} type="button">
            <MaterialIcon name="mdi:delete-outline" size={19} />
            Clear
          </button>
        </div>
      )}
      <div className={[styles.mapStage, areaEditorOpen ? styles.areaEditorMapStage : ''].filter(Boolean).join(' ')} data-vacuum-map-stage="true" key="vacuum-map">
        <ValetudoMapCard
          available={status.primaryAvailable}
          displayMode={compactLayout ? 'fitted' : 'contained'}
          drawMode={drawMode}
          expanded={areaEditorOpen}
          interactive={areaEditorOpen && mapCommandsAllowed}
          minimumSizeCm={vacuum.areaCleaning?.minimumSizeCm}
          onDrawModeChange={onDrawModeChange}
          onEditorMetaChange={handleEditorMetaChange}
          onRoomToggle={areaEditorOpen || !onRoomToggle ? undefined : (entityId) => {
            const zone = vacuum.zones.find((candidate) => candidate.entityId === entityId)
            if (zone) onRoomToggle(zone)
          }}
          onSelectionChange={onAreaSelectionChange}
          resetViewRevision={resetAreaViewRevision}
          selectedRooms={selectedRooms}
          selection={areaEditorOpen || showAreaSelection ? areaSelection : null}
          showReportedNotice={showReportedNotice}
          sourceRevision={status.primaryRevision}
          vacuum={vacuum}
        />
        {!areaEditorOpen && !compactLayout && locateAllowed && (
          <button className={styles.locateButton} data-icon="mdi:map-marker" data-tone="neutral" onClick={onLocate} type="button">
            <MaterialIcon name="mdi:map-marker" size={18} />
            {copy('layout.locate')}
          </button>
        )}
        {areaEditorOpen && (
          <div className={styles.areaEditorHint} data-draw-mode={drawMode ? 'true' : 'false'}>
            {drawMode ? 'Drag on the map to draw the cleaning area.' : areaSelection ? 'Drag the area to move it or use any round corner handle to resize.' : 'Choose Draw, then drag on the map.'}
          </div>
        )}
      </div>
      {areaEditorOpen ? (
        <div className={styles.areaEditorSummary}>
          <span>
            <strong>{dimensions ? `${formatAreaLength(dimensions.width)} × ${formatAreaLength(dimensions.height)}` : 'No area selected'}</strong>
            <small>{dimensions ? `${((dimensions.width * dimensions.height) / 10_000).toFixed(2)} m² selected` : 'Draw a rectangle to continue.'}</small>
          </span>
          <Description>{AREA_EDITOR_DESCRIPTION}</Description>
          {editorMeta.error && <InlineAlert>{editorMeta.error}</InlineAlert>}
          <ModalActionButton
            action={{
              disabled: !mapCommandsAllowed || !areaSelection,
              icon: 'mdi:check',
              label: areaSelection ? 'Use This Area' : 'Draw an Area to Continue',
              onClick: onFinishAreaEditing,
            }}
          />
        </div>
      ) : (
        <div className={styles.mapStatusControls} data-vacuum-map-status-controls="true">
          {!compactLayout && showStatusDetails ? (
            <div className={styles.mapStatusDetails} data-vacuum-status-details="true">
              <VacuumStatusSummary displayState={optimisticState.state} liveState={optimisticState.liveState} mapProvenance={editorMeta.provenance} status={status} vacuum={vacuum} />
              {showCleaningReport && (
                <VacuumWhileAwaySection onOpenOutcomes={onOpenOutcomes} presentation={outcomePresentation} vacuum={vacuum} />
              )}
            </div>
          ) : null}
        </div>
      )}
    </>
  )
}

export function VacuumRoomSourceModalContent({ vacuum }: VacuumCardProps) {
  const session = useOptionalEntity(vacuum.coordinatorSessionEntityId)
  const { optimisticState, runtimeMode, status, visibleTabs } = useVacuumModalRuntime(vacuum)
  const outcomePresentation = vacuumWhileAwayPresentation(session?.attributes)
  const [activeTab, setActiveTab] = useState<VacuumModalTab>('controls')
  const areaEditorSession = useVacuumAreaEditorSession(runtimeMode)
  const [areaSelection, setAreaSelection] = useState<MapGridRect | null>(null)
  const [editorMeta, setEditorMeta] = useState<ValetudoMapEditorMeta>({
    displayScope: VALETUDO_MAP_SCOPE_FULL,
    error: null,
    focusAvailable: false,
    geometry: null,
    isLoaded: false,
    provenance: VALETUDO_MAP_PROVENANCE_NONE,
    reportedPositionPresent: false,
    selectionAllowed: true,
  })
  const [resetAreaViewRevision, setResetAreaViewRevision] = useState(0)
  const effectiveActiveTab = useVacuumActiveTab({
    activeTab,
    areaEditorOpen: areaEditorSession.areaEditorOpen,
    idPrefix: `vacuum-${vacuum.vacuumMapId}`,
    onActiveTabChange: setActiveTab,
    visibleTabs,
  })

  return (
    <div className={styles.roomSourceModalShell}>
      <VacuumModalTabContent
        activeTab={effectiveActiveTab}
        areaEditorMeta={editorMeta}
        areaEditorOpen={areaEditorSession.areaEditorOpen}
        areaSelection={areaSelection}
        cleanTarget={areaSelection ? 'area' : 'rooms'}
        drawMode={areaEditorSession.drawMode}
        onActiveTabChange={setActiveTab}
        onAreaEditorMetaChange={setEditorMeta}
        onAreaSelectionChange={setAreaSelection}
        onDrawModeChange={(drawMode) => areaEditorSession.openAreaEditor(drawMode)}
        onEditArea={() => areaEditorSession.openAreaEditor(!areaSelection)}
        onFinishAreaEditing={areaEditorSession.closeAreaEditor}
        onResetAreaView={() => setResetAreaViewRevision((revision) => revision + 1)}
        outcomePresentation={outcomePresentation}
        optimisticState={optimisticState}
        resetAreaViewRevision={resetAreaViewRevision}
        runtimeMode={runtimeMode}
        status={status}
        visibleTabs={visibleTabs}
        vacuum={vacuum}
      />
      {!areaEditorSession.areaEditorOpen && <VacuumModalNav activeTab={effectiveActiveTab} onTabChange={(tab) => {
        setActiveTab(tab)
      }} tabs={visibleTabs} vacuum={vacuum} />}
    </div>
  )
}

export function VacuumModal({
  onClose,
  open,
  subtitle,
  title: titleOverride,
  vacuum,
}: {
  onClose: () => void
  open: boolean
  subtitle?: string
  title?: string
  vacuum: VacuumConfig
}) {
  const copy = useCopy(VACUUM_COPY_NAMESPACE)
  const session = useOptionalEntity(vacuum.coordinatorSessionEntityId)
  const { optimisticState, runtimeMode, status, visibleTabs } = useVacuumModalRuntime(vacuum)
  const outcomePresentation = vacuumWhileAwayPresentation(session?.attributes)
  const [activeTab, setActiveTab] = useState<VacuumModalTab>('controls')
  const areaEditorSession = useVacuumAreaEditorSession(runtimeMode)
  const [outcomeDetailContract, setOutcomeDetailContract] = useState<VacuumOutcomeContract | null>(null)
  const [areaSelection, setAreaSelection] = useState<MapGridRect | null>(null)
  const [editorMeta, setEditorMeta] = useState<ValetudoMapEditorMeta>({
    displayScope: VALETUDO_MAP_SCOPE_FULL,
    error: null,
    focusAvailable: false,
    geometry: null,
    isLoaded: false,
    provenance: VALETUDO_MAP_PROVENANCE_NONE,
    reportedPositionPresent: false,
    selectionAllowed: true,
  })
  const [resetAreaViewRevision, setResetAreaViewRevision] = useState(0)
  const previousOpenRef = useRef(open)
  const renderedOutcomeContract = outcomeDetailContract
  const showOutcomes = renderedOutcomeContract !== null
  const detailPageKey = areaEditorSession.areaEditorOpen ? 'vacuum-area-editor' : showOutcomes ? 'vacuum-outcomes' : activeTab
  const { bodyElementRef, enterDetailPage, leaveDetailPage, resetDetailPageScroll } = useModalDetailPageScroll(detailPageKey)
  const title = areaEditorSession.areaEditorOpen
    ? `${vacuum.title} Cleaning Area`
    : showOutcomes
      ? copy(VACUUM_COPY_KEYS.outcomes.detailTitle, { room: vacuum.title })
      : titleOverride ?? `${vacuum.title} Robot Vacuum`
  const closeAreaEditor = useCallback(() => {
    leaveDetailPage()
    areaEditorSession.closeAreaEditor()
  }, [areaEditorSession, leaveDetailPage])
  const closeOutcomes = useCallback(() => {
    leaveDetailPage()
    setOutcomeDetailContract(null)
    window.requestAnimationFrame(() => {
      bodyElementRef.current
        ?.closest('[role="dialog"]')
        ?.querySelector<HTMLElement>('[data-modal-detail-trigger="vacuum-outcomes"] button')
        ?.focus({ preventScroll: true })
    })
  }, [bodyElementRef, leaveDetailPage, setOutcomeDetailContract])
  const openAreaEditor = useCallback(() => {
    enterDetailPage('vacuum-area-editor')
    setOutcomeDetailContract(null)
    setActiveTab('controls')
    areaEditorSession.openAreaEditor(!areaSelection)
  }, [areaEditorSession, areaSelection, enterDetailPage, setOutcomeDetailContract])
  const openOutcomes = useCallback(() => {
    if (outcomePresentation.kind !== 'typed') return
    enterDetailPage('vacuum-outcomes')
    areaEditorSession.closeAreaEditor()
    setOutcomeDetailContract(outcomePresentation.contract)
  }, [areaEditorSession, enterDetailPage, outcomePresentation])

  useEffect(() => {
    const wasOpen = previousOpenRef.current
    if (open && !wasOpen) {
      setActiveTab('controls')
      areaEditorSession.closeAreaEditor()
      setOutcomeDetailContract(null)
      setAreaSelection(null)
      setEditorMeta({
        displayScope: VALETUDO_MAP_SCOPE_FULL,
        error: null,
        focusAvailable: false,
        geometry: null,
        isLoaded: false,
        provenance: VALETUDO_MAP_PROVENANCE_NONE,
        reportedPositionPresent: false,
        selectionAllowed: true,
      })
      setResetAreaViewRevision((revision) => revision + 1)
      resetDetailPageScroll()
    }
    previousOpenRef.current = open
  }, [areaEditorSession, open, resetDetailPageScroll])
  const effectiveActiveTab = useVacuumActiveTab({
    activeTab,
    areaEditorOpen: areaEditorSession.areaEditorOpen,
    idPrefix: `vacuum-${vacuum.vacuumMapId}`,
    onActiveTabChange: setActiveTab,
    visibleTabs,
  })

  return (
    <ModalSheet
      backLabel={showOutcomes ? copy(VACUUM_COPY_KEYS.outcomes.backToControls) : 'Back to controls'}
      bodyElementRef={bodyElementRef}
      centeredGeometry={VACUUM_CENTERED_GEOMETRY}
      navigation={areaEditorSession.areaEditorOpen || showOutcomes ? undefined : <VacuumModalNav activeTab={effectiveActiveTab} onTabChange={(tab) => {
        setActiveTab(tab)
      }} tabs={visibleTabs} vacuum={vacuum} />}
      onBack={areaEditorSession.areaEditorOpen ? closeAreaEditor : showOutcomes ? closeOutcomes : undefined}
      onClose={onClose}
      open={open}
      scrollMode={showOutcomes ? 'body' : 'panes'}
      scrollResetKey={areaEditorSession.areaEditorOpen || showOutcomes ? detailPageKey : 'vacuum-root'}
      size="workspace"
      subtitle={areaEditorSession.areaEditorOpen || showOutcomes ? undefined : subtitle}
      title={title}
    >
      {showOutcomes ? (
        <VacuumOutcomeDetail contract={renderedOutcomeContract} vacuum={vacuum} />
      ) : (
        <VacuumModalTabContent
          activeTab={effectiveActiveTab}
          areaEditorMeta={editorMeta}
          areaEditorOpen={areaEditorSession.areaEditorOpen}
          areaSelection={areaSelection}
          cleanTarget={areaSelection ? 'area' : 'rooms'}
          drawMode={areaEditorSession.drawMode}
          onActiveTabChange={setActiveTab}
          onAreaEditorMetaChange={setEditorMeta}
          onAreaSelectionChange={setAreaSelection}
          onDrawModeChange={(drawMode) => areaEditorSession.openAreaEditor(drawMode)}
          onEditArea={openAreaEditor}
          onFinishAreaEditing={closeAreaEditor}
          onOpenOutcomes={openOutcomes}
          onResetAreaView={() => setResetAreaViewRevision((revision) => revision + 1)}
          outcomePresentation={outcomePresentation}
          optimisticState={optimisticState}
          resetAreaViewRevision={resetAreaViewRevision}
          runtimeMode={runtimeMode}
          status={status}
          visibleTabs={visibleTabs}
          vacuum={vacuum}
        />
      )}
    </ModalSheet>
  )
}

function LiveVacuumCard({ vacuum }: Pick<VacuumCardProps, 'vacuum'>) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const syncFromHash = () => setOpen(dashboardHash() === `#${vacuum.hash}`)
    const targets = dashboardEventTargets()

    syncFromHash()
    targets.forEach((target) => {
      target.addEventListener('hashchange', syncFromHash)
      target.addEventListener('popstate', syncFromHash)
      target.addEventListener(DASHBOARD_ROUTE_CHANGE_EVENT, syncFromHash)
    })
    return () => {
      targets.forEach((target) => {
        target.removeEventListener('hashchange', syncFromHash)
        target.removeEventListener('popstate', syncFromHash)
        target.removeEventListener(DASHBOARD_ROUTE_CHANGE_EVENT, syncFromHash)
      })
    }
  }, [vacuum.hash])

  const openModal = useCallback(() => {
    replaceDashboardUrl(`${dashboardPathWithSearch()}#${vacuum.hash}`)
    setOpen(true)
  }, [vacuum.hash])

  const closeModal = useCallback(() => {
    replaceDashboardUrl(dashboardPathWithSearch())
    setOpen(false)
  }, [])

  const modal = useMemo(() => <VacuumModal onClose={closeModal} open={open} vacuum={vacuum} />, [closeModal, open, vacuum])

  return (
    <>
      <VacuumTile interaction={{ kind: 'modal', onOpen: openModal }} vacuum={vacuum} />
      {modal}
    </>
  )
}

export function VacuumCard({ preload = false, vacuum }: VacuumCardProps) {
  return preload
    ? <VacuumTile interaction={{ kind: 'preload' }} vacuum={vacuum} />
    : <LiveVacuumCard vacuum={vacuum} />
}
