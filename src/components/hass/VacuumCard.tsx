import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useEntity, useHass } from '@hakit/core'
import { GlassTile } from '../core/GlassTile'
import { Description } from '../core/Description'
import { InlineAlert } from '../core/InlineAlert'
import { MaterialIcon } from '../core/Icon'
import { ModalActionButton, type ModalActionTone } from '../core/ModalActionFooter'
import { ModalSheet } from '../core/ModalSheet'
import { NativeSelectField } from '../core/NativeSelectField'
import { StatusPill } from '../core/StatusPill'
import { type VacuumAutoCleanDisabledRoomConfig, type VacuumConfig, type VacuumConsumableConfig, type VacuumZoneConfig } from '../../constants/portedDashboard'
import { DASHBOARD_ROUTE_CHANGE_EVENT, dashboardEventTargets, dashboardHash, dashboardPathWithSearch, replaceDashboardUrl } from '../../hooks/dashboardLocation'
import { useModalDetailPageScroll } from '../../hooks/useModalDetailPageScroll'
import { useImmediateVisualTab, useSmoothDisplayedModalTab } from '../../hooks/useSmoothDisplayedModalTab'
import { useOptimisticState, type OptimisticCommitOptions } from '../../hooks/useOptimisticState'
import { asEntityName, titleCaseState } from './entityState'
import { mapGridRectDimensionsCm, mapGridRectToServiceData, type MapGridRect } from './ValetudoMapGeometry'
import { ValetudoMapCard, type ValetudoMapEditorMeta } from './ValetudoMapCard'
import { VACUUM_AREA_EDITOR_MODAL_STYLE, VACUUM_MODAL_STYLE } from './vacuumModalStyle'
import { isUnavailableVacuumState, vacuumConsumableVisual, vacuumStateVisual, type VacuumVisualTone } from './vacuumVisualState'
import styles from './VacuumCard.module.css'

type VacuumModalTab = 'controls' | 'zones' | 'autoClean' | 'more' | 'info'
type VacuumCleanTarget = 'rooms' | 'area'
const VACUUM_MODAL_TABS: { icon: string; label: string; tab: VacuumModalTab }[] = [
  { icon: 'mdi:robot-vacuum', label: 'Controls', tab: 'controls' },
  { icon: 'mdi:floor-plan', label: 'Zones', tab: 'zones' },
  { icon: 'mdi:robot-vacuum-off', label: 'Auto-Clean', tab: 'autoClean' },
  { icon: 'mdi:flash', label: 'Actions', tab: 'more' },
  { icon: 'mdi:information-outline', label: 'Info', tab: 'info' },
]
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

type CallService = (params: Record<string, unknown>) => unknown

interface EntityLike {
  attributes: Record<string, unknown>
  entity_id: string
  last_changed?: string
  state: string
}

interface VacuumCardProps {
  disableHashSync?: boolean
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

function isUnavailableState(state: string | undefined) {
  return isUnavailableVacuumState(state)
}

function isResumable(statusFlag: string | undefined) {
  return statusFlag === 'resumable'
}

function canStartVacuumCleaning(state: string, statusFlag: string | undefined, error: string | undefined) {
  const resumable = isResumable(statusFlag)
  const lowBattery = error === 'Low battery'
  return (state === 'docked' && !resumable) || state === 'idle' || (state === 'error' && !resumable && !lowBattery)
}

function vacuumModalTabs(vacuum: VacuumConfig) {
  return VACUUM_MODAL_TABS.filter((tab) => {
    if (tab.tab === 'zones') return vacuum.zones.length > 0
    if (tab.tab === 'autoClean') return Boolean(vacuum.autoCleanDisabledRooms?.length)
    if (tab.tab === 'info') return vacuum.consumables.length > 0
    return true
  })
}

function isMeaningfulText(value: string | undefined) {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized !== '' && normalized !== 'unknown' && normalized !== 'unavailable'
}

function isErrorText(value: string | undefined) {
  if (!isMeaningfulText(value)) return false
  return value?.trim().toLowerCase() !== 'no error'
}

function vacuumSubtitle(state: string | undefined, battery: string | undefined) {
  if (isUnavailableState(state)) return undefined
  const label = titleCaseState(state)
  if (!battery || battery === 'unknown' || battery === 'unavailable') return label
  return `${label} • ${battery}%`
}

function formatStateValue(value: string | undefined, fallback = 'Unavailable') {
  if (!value) return fallback
  if (value === 'unknown') return 'Unknown'
  if (value === 'unavailable') return 'Unavailable'
  return titleCaseState(value)
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

function useVacuumCommandCoordinator(liveState: string, commitDisplayState: (nextState: string, options?: OptimisticCommitOptions) => void): VacuumCommandCoordinator {
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
  }, [callService, failClean])

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
    [commitDisplayState, invokeClean, settingsSettled],
  )

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

function stringListAttribute(entity: EntityLike | null | undefined, name: string) {
  const value = entity?.attributes[name]
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
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
  disabled,
  onChange,
  value,
}: {
  disabled: boolean
  onChange: (target: VacuumCleanTarget) => void
  value: VacuumCleanTarget
}) {
  return (
    <div aria-label="Cleaning target" className={styles.cleanTargetSelector} role="group">
      {([
        { icon: 'mdi:floor-plan', label: 'Rooms', value: 'rooms' },
        { icon: 'mdi:selection-drag', label: 'Area', value: 'area' },
      ] as const).map((option) => (
        <button
          aria-pressed={value === option.value}
          className={styles.cleanTargetButton}
          data-active={value === option.value ? 'true' : 'false'}
          disabled={disabled}
          key={option.value}
          onClick={() => onChange(option.value)}
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
  if (!entity || isUnavailableState(entity.state)) return 'Unavailable'
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

function ZoneButton({ disabled, onIntent, order, zone }: { disabled: boolean; onIntent: (entityId: string, expectedState: string) => void; order?: number; zone: VacuumZoneConfig }) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const entity = useEntity(asEntityName(zone.entityId), { returnNullIfNotFound: true })
  const liveActive = entity?.state === 'on'
  const [active, commitActive] = useOptimisticState(liveActive, { clearOn: 'confirmation', revertMs: VACUUM_OPTIMISTIC_REVERT_MS })
  const nextActive = !active

  return (
    <button
      aria-label={order ? `${zone.title}, cleaning order ${order}` : zone.title}
      className={styles.zoneButton}
      data-active={active}
      disabled={disabled}
      onClick={() => {
        commitActive(nextActive)
        onIntent(zone.entityId, nextActive ? 'on' : 'off')
        callService({ domain: 'input_boolean', service: nextActive ? 'turn_on' : 'turn_off', target: zone.entityId })
      }}
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
      <span>
        <strong>{room.title}</strong>
      </span>
    </button>
  )
}

function VacuumStatusSummary({ displayState, vacuum }: { displayState: string; vacuum: VacuumConfig }) {
  const battery = useEntity(asEntityName(vacuum.batteryEntityId), { returnNullIfNotFound: true })
  const dockStatus = useOptionalEntity(vacuum.dockControls?.dockStatusEntityId)
  const statusFlag = useEntity(asEntityName(vacuum.statusFlagEntityId), { returnNullIfNotFound: true })
  const error = useEntity(asEntityName(vacuum.errorEntityId), { returnNullIfNotFound: true })
  const mappedError = useEntity(asEntityName(vacuum.errorMessageEntityId), { returnNullIfNotFound: true })
  const state = displayState
  const lowBattery = error?.state === 'Low battery'
  const chargingBeforeResume = (state === 'docked' && isResumable(statusFlag?.state)) || (state === 'error' && lowBattery)
  const stateLabel = chargingBeforeResume ? 'Charging Before Resuming' : formatStateValue(state)
  const batteryLabel = battery && !isUnavailableState(battery.state) ? `${battery.state}%` : 'Unknown'
  const mappedErrorText = isErrorText(mappedError?.state) ? mappedError?.state : undefined
  const rawErrorText = isErrorText(error?.state) ? error?.state : undefined
  const errorText = mappedErrorText ?? rawErrorText ?? 'No error'
  const hasError = isErrorText(errorText)
  const visual = vacuumStateVisual(state)
  const dockVisual = dockStatusVisual(dockStatus?.state)

  return (
    <section className={styles.statusPanel}>
      <InfoPill icon={visual.icon} label="Status" tone={visual.tone} value={stateLabel} />
      <InfoPill icon="mdi:battery" label="Battery" value={batteryLabel} />
      {vacuum.dockControls && (
        <div className={styles.dockStatusChip}>
          <InfoPill grouped icon={dockVisual.icon} label="Dock Status" tone={dockVisual.tone} value={formatStateValue(dockStatus?.state)} />
        </div>
      )}
      {hasError ? (
        <InlineAlert className={styles.errorMessage}>{errorText}</InlineAlert>
      ) : null}
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

function VacuumPowerSettings({ coordinator, vacuum }: { coordinator: VacuumCommandCoordinator; vacuum: VacuumConfig }) {
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

  if (!hasMode && !showFan && !showWater) return null

  return (
    <ControlSection title="Power Settings">
      {hasMode && vacuum.modeEntityId && <SelectSetting description={MODE_DESCRIPTION} disabled={coordinator.controlsDisabled} entity={mode} entityId={vacuum.modeEntityId} icon="mdi:robot-vacuum" label="Mode" onIntent={coordinator.registerIntent} onOptimisticValueChange={commitDisplayModeState} optimisticValue={displayModeState} valueLabel={modeLabel} variant="sub" />}
      {showFan && vacuum.fanEntityId && <SelectSetting description={FAN_DESCRIPTION} disabled={coordinator.controlsDisabled} entity={fan} entityId={vacuum.fanEntityId} icon="mdi:fan" label="Fan" onIntent={coordinator.registerIntent} variant="sub" />}
      {showWater && vacuum.waterEntityId && <SelectSetting description={WATER_DESCRIPTION} disabled={coordinator.controlsDisabled} entity={water} entityId={vacuum.waterEntityId} icon="mdi:water" label="Water" onIntent={coordinator.registerIntent} variant="sub" />}
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

function VacuumSelectedRoomsSummary({ coordinator, vacuum }: { coordinator: VacuumCommandCoordinator; vacuum: VacuumConfig }) {
  const entities = useHass((state) => state.entities) as unknown as Record<string, EntityLike | undefined>
  if (vacuum.zones.length === 0) return null

  const selectedRooms = orderedSelectedVacuumZones(vacuum.zones, entities, coordinator)

  return (
    <div className={styles.awaySummary}>
      <div className={styles.awayGroup} data-tone={selectedRooms.length > 0 ? 'selected' : 'neutral'}>
        <h4>Selected Rooms</h4>
        {selectedRooms.length > 0 ? (
          <ol>
            {selectedRooms.map(({ zone }) => <li key={zone.entityId}>{zone.title}</li>)}
          </ol>
        ) : (
          <Description className={styles.selectedRoomsEmpty}>
            No rooms are selected. If you begin cleaning, the robot vacuum will attempt to clean every mapped area.
          </Description>
        )}
      </div>
    </div>
  )
}

function VacuumStateActions({
  areaEditorMeta,
  areaSelection,
  cleanTarget,
  coordinator,
  onAreaSelectionChange,
  onCleanTargetChange,
  onEditArea,
  optimisticState,
  vacuum,
}: {
  areaEditorMeta: ValetudoMapEditorMeta
  areaSelection: MapGridRect | null
  cleanTarget: VacuumCleanTarget
  coordinator: VacuumCommandCoordinator
  onAreaSelectionChange: (selection: MapGridRect | null) => void
  onCleanTargetChange: (target: VacuumCleanTarget) => void
  onEditArea?: () => void
  optimisticState: OptimisticVacuumState
  vacuum: VacuumConfig
}) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const services = useHass((state) => state.services)
  const statusFlag = useEntity(asEntityName(vacuum.statusFlagEntityId), { returnNullIfNotFound: true })
  const error = useEntity(asEntityName(vacuum.errorEntityId), { returnNullIfNotFound: true })
  const passes = useEntity(asEntityName(vacuum.passesEntityId), { returnNullIfNotFound: true }) as EntityLike | null
  const areaCleaning = vacuum.areaCleaning
  const state = optimisticState.state
  const resumable = isResumable(statusFlag?.state)
  const lowBattery = error?.state === 'Low battery'
  const chargingBeforeResume = (state === 'docked' && resumable) || (state === 'error' && lowBattery)
  const showCleaningSetup = canStartVacuumCleaning(state, statusFlag?.state, error?.state)
  const sectionTitle = chargingBeforeResume ? 'Charging Before Resuming' : formatStateValue(state, 'Vacuum')
  const mapReady = areaEditorMeta.isLoaded && Boolean(areaEditorMeta.geometry) && !areaEditorMeta.error
  const servicesLoaded = isRecord(services) && Object.keys(services).length > 0
  const areaServiceReady = Boolean(areaCleaning && hassServiceAvailable(services, areaCleaning.script))
  const areaStartDisabled = !showCleaningSetup || !areaSelection || !areaEditorMeta.geometry || !mapReady || !areaServiceReady || coordinator.controlsDisabled
  const commitAndCall = (nextState: string, action: string, target?: string) => {
    optimisticState.commitState(nextState)
    callServiceAction(callService, action, target)
  }
  const clean = () => coordinator.requestClean(vacuum.cleanScript)
  const cleanArea = () => {
    if (!areaCleaning || !areaSelection || !areaEditorMeta.geometry || areaStartDisabled) return
    coordinator.requestClean(areaCleaning.script, mapGridRectToServiceData(areaSelection, areaEditorMeta.geometry.pixelSize))
  }
  const dock = () => commitAndCall('returning', 'vacuum.return_to_base', vacuum.entityId)
  const stop = () => commitAndCall(state === 'error' ? 'idle' : chargingBeforeResume ? 'docked' : 'returning', state === 'error' || chargingBeforeResume ? 'vacuum.stop' : 'vacuum.return_to_base', vacuum.entityId)
  const pause = () => commitAndCall('paused', 'vacuum.pause', vacuum.entityId)
  const start = () => commitAndCall('cleaning', 'vacuum.start', vacuum.entityId)
  const roomsCleaningSetup = (
    <>
      <Description>{CLEANING_SETUP_DESCRIPTION}</Description>
      <VacuumSelectedRoomsSummary coordinator={coordinator} vacuum={vacuum} />
      <div className={styles.cleaningActionGrid} data-layout="cleaning">
        <SelectSetting disabled={coordinator.controlsDisabled} entity={passes} entityId={vacuum.passesEntityId} formatOptionLabel={formatPassCount} hideLabel icon="mdi:numeric" label="Cleaning Passes" onIntent={coordinator.registerIntent} valueLabel={formatPassCount(passes?.state)} variant="sub" />
        <ActionButton icon="mdi:play" label="Clean" onClick={clean} tone="primary" />
      </div>
    </>
  )
  const areaCleaningSetup = areaCleaning ? (
    <>
      <Description>{AREA_DESCRIPTION}</Description>
      <div className={styles.areaActionGrid}>
        <ActionButton
          detailTrigger="vacuum-area-editor"
          disabled={!mapReady || !onEditArea}
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
        <SelectSetting disabled={!showCleaningSetup || coordinator.controlsDisabled} entity={passes} entityId={vacuum.passesEntityId} formatOptionLabel={formatPassCount} hideLabel icon="mdi:numeric" label="Cleaning Passes" onIntent={coordinator.registerIntent} valueLabel={formatPassCount(passes?.state)} variant="sub" />
        <ActionButton disabled={areaStartDisabled} icon="mdi:play" label="Start Area Clean" onClick={cleanArea} tone="primary" />
      </div>
      {coordinator.cleanError && <InlineAlert>{coordinator.cleanError}</InlineAlert>}
    </>
  ) : roomsCleaningSetup
  const cleaningSetupControls = areaCleaning ? (
    <>
      <VacuumCleanTargetSelector disabled={coordinator.controlsDisabled} onChange={onCleanTargetChange} value={cleanTarget} />
      {cleanTarget === 'area' ? areaCleaningSetup : showCleaningSetup ? roomsCleaningSetup : null}
    </>
  ) : showCleaningSetup ? roomsCleaningSetup : null

  if (isUnavailableState(state)) return null

  return (
    <ControlSection title={sectionTitle}>
      {cleaningSetupControls}
      {state === 'idle' && <ActionButton description="Send the robot back to the dock." disabled={coordinator.controlsDisabled} icon="mdi:home" label="Dock" onClick={dock} />}
      {state === 'error' && !resumable && !lowBattery && <ActionButton description="Stop the current vacuum task." disabled={coordinator.controlsDisabled} icon="mdi:stop" label="Stop" onClick={stop} tone="danger" />}
      {state === 'error' && !resumable && !lowBattery && <ActionButton description="Send the robot back to the dock." disabled={coordinator.controlsDisabled} icon="mdi:home" label="Dock" onClick={dock} />}
      {chargingBeforeResume && <ActionButton description="Continue the interrupted cleaning run." disabled={coordinator.controlsDisabled} icon="mdi:play" label="Resume" onClick={start} tone="primary" />}
      {chargingBeforeResume && <ActionButton description="Cancel the pending cleaning resume." disabled={coordinator.controlsDisabled} icon="mdi:stop" label="Cancel" onClick={stop} tone="danger" />}
      {state === 'cleaning' && <ActionButton description="Pause the current cleaning run." disabled={coordinator.controlsDisabled} icon="mdi:pause" label="Pause" onClick={pause} tone="warning" />}
      {state === 'cleaning' && <ActionButton description="Stop the current cleaning run." disabled={coordinator.controlsDisabled} icon="mdi:stop" label="Stop" onClick={stop} tone="danger" />}
      {state === 'paused' && <ActionButton description="Continue the paused cleaning run." disabled={coordinator.controlsDisabled} icon="mdi:play" label="Resume" onClick={start} tone="primary" />}
      {state === 'paused' && <ActionButton description="Stop the paused cleaning run." disabled={coordinator.controlsDisabled} icon="mdi:stop" label="Stop" onClick={stop} tone="danger" />}
      {state === 'returning' && <ActionButton description="Pause the return-to-dock action." disabled={coordinator.controlsDisabled} icon="mdi:pause" label="Pause" onClick={pause} tone="warning" />}
    </ControlSection>
  )
}

function VacuumDockControlsSection({
  coordinator,
  optimisticState,
  vacuum,
}: {
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
  const cleanAllowed = docked && mopAttached && cleanScriptAvailable && ['idle', 'cleaning', 'pause'].includes(displayDockState) && !coordinator.controlsDisabled
  const dryAllowed = docked && mopAttached && dryScriptAvailable && ['idle', 'drying', 'pause'].includes(displayDockState) && !coordinator.controlsDisabled
  const emptyAllowed = Boolean(vacuum.dockButtonEntityId && docked && ['idle', 'pause'].includes(displayDockState) && !coordinator.controlsDisabled)
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

  return (
    <ControlSection title="Dock Controls">
      <div className={styles.dockActionGrid}>
        {vacuum.dockControls && (
          <ActionButton
            description={cleanActive ? 'Finish the dock-cleaning phase and drain the wash tray into the dirty-water tank.' : 'Start the mop-dock cleaning phase. Use Stop Dock Clean when finished so the dock drains the wash tray.'}
            disabled={!cleanAllowed}
            icon={cleanActive ? 'mdi:stop' : 'mdi:water'}
            label={cleanActive ? 'Stop Dock Clean' : 'Clean Mop Dock'}
            onClick={cleanDock}
            tone={cleanActive ? 'warning' : 'neutral'}
          />
        )}
        {vacuum.dockControls && (
          <ActionButton
            description={dryActive ? 'Stop the current mop-drying cycle.' : 'Start drying the attached mop pads.'}
            disabled={!dryAllowed}
            icon={dryActive ? 'mdi:stop' : 'mdi:weather-windy'}
            label={dryActive ? 'Stop Mop Drying' : 'Dry Mops'}
            onClick={dryMops}
          />
        )}
        {vacuum.dockButtonEntityId && (
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
  cleanTarget,
  coordinator,
  onAreaSelectionChange,
  onCleanTargetChange,
  onEditArea,
  optimisticState,
  vacuum,
}: {
  areaEditorMeta: ValetudoMapEditorMeta
  areaSelection: MapGridRect | null
  cleanTarget: VacuumCleanTarget
  coordinator: VacuumCommandCoordinator
  onAreaSelectionChange: (selection: MapGridRect | null) => void
  onCleanTargetChange: (target: VacuumCleanTarget) => void
  onEditArea?: () => void
  optimisticState: OptimisticVacuumState
  vacuum: VacuumConfig
}) {
  return (
    <div className={styles.controlStack}>
      <VacuumStateActions
        areaEditorMeta={areaEditorMeta}
        areaSelection={areaSelection}
        cleanTarget={cleanTarget}
        coordinator={coordinator}
        onAreaSelectionChange={onAreaSelectionChange}
        onCleanTargetChange={onCleanTargetChange}
        onEditArea={onEditArea}
        optimisticState={optimisticState}
        vacuum={vacuum}
      />
      <VacuumPowerSettings coordinator={coordinator} vacuum={vacuum} />
    </div>
  )
}

function VacuumWhileAwaySection({ vacuum }: { vacuum: VacuumConfig }) {
  const session = useOptionalEntity(vacuum.coordinatorSessionEntityId)
  const cleaned = stringListAttribute(session, 'while_away_cleaned')
  const issues = stringListAttribute(session, 'while_away_issues')

  if (!cleaned.length && !issues.length) return null

  return (
    <section className={styles.section}>
      <SectionHeader title="While You Were Away" />
      <div className={styles.awaySummary}>
        {cleaned.length > 0 && (
          <div className={styles.awayGroup}>
            <h4>Cleaned</h4>
            <ul>
              {cleaned.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
        )}
        {issues.length > 0 && (
          <div className={styles.awayGroup} data-tone="issue">
            <h4>Issues</h4>
            <ul>
              {issues.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

function VacuumZones({ coordinator, optimisticState, vacuum }: { coordinator: VacuumCommandCoordinator; optimisticState: OptimisticVacuumState; vacuum: VacuumConfig }) {
  const entities = useHass((hass) => hass.entities) as unknown as Record<string, EntityLike | undefined>
  const statusFlag = useEntity(asEntityName(vacuum.statusFlagEntityId), { returnNullIfNotFound: true })
  const error = useEntity(asEntityName(vacuum.errorEntityId), { returnNullIfNotFound: true })
  const state = optimisticState.state
  const editableZones = canStartVacuumCleaning(state, statusFlag?.state, error?.state)

  if (vacuum.zones.length === 0) return null
  const cleaningOrder = new Map(orderedSelectedVacuumZones(vacuum.zones, entities, coordinator).map(({ zone }, index) => [zone.entityId, index + 1]))

  return (
    <section className={styles.section}>
      <SectionHeader title="Zones" />
      <SectionText lines={vacuum.zoneDescription} />
      <Description>{ROOM_ORDER_DESCRIPTION}</Description>
      <div className={styles.zones}>
        {vacuum.zones.map((zone) => <ZoneButton disabled={!editableZones || coordinator.controlsDisabled} key={zone.entityId} onIntent={coordinator.registerIntent} order={cleaningOrder.get(zone.entityId)} zone={zone} />)}
      </div>
    </section>
  )
}

function VacuumAutoCleanDisabledRooms({ vacuum }: { vacuum: VacuumConfig }) {
  const rooms = vacuum.autoCleanDisabledRooms ?? []

  if (rooms.length === 0) return null

  return (
    <section className={styles.section}>
      <SectionHeader title="Disabled Auto-Clean Rooms" />
      <Description className={styles.autoCleanDescription}>{AUTO_CLEAN_DISABLED_DESCRIPTION}</Description>
      <div className={styles.autoCleanCheckboxGrid}>
        {rooms.map((room) => <AutoCleanDisabledRoomCheckbox key={room.entityId} room={room} />)}
      </div>
    </section>
  )
}

function VacuumModalNav({ activeTab, onTabChange, vacuum }: { activeTab: VacuumModalTab; onTabChange: (tab: VacuumModalTab) => void; vacuum: VacuumConfig }) {
  const tabs = vacuumModalTabs(vacuum)
  const effectiveActiveTab = tabs.some((tab) => tab.tab === activeTab) ? activeTab : 'controls'
  const { clearVisualTab, setVisualTabNow, visualActiveTab } = useImmediateVisualTab(effectiveActiveTab)

  return (
    <nav aria-label={`${vacuum.title} modal sections`} className={styles.vacuumModalNav} data-tab-count={tabs.length} style={{ '--vacuum-nav-tab-count': tabs.length } as CSSProperties}>
      {tabs.map((item) => {
        const isActive = visualActiveTab === item.tab
        const isCurrent = effectiveActiveTab === item.tab
        return (
          <button
            aria-current={isCurrent ? 'page' : undefined}
            aria-label={item.label}
            className={[styles.vacuumModalNavButton, isActive ? styles.vacuumModalNavButtonActive : ''].filter(Boolean).join(' ')}
            data-active={isActive}
            key={item.tab}
            onBlur={clearVisualTab}
            onClick={() => {
              setVisualTabNow(item.tab)
              onTabChange(item.tab)
            }}
            onPointerCancel={clearVisualTab}
            onPointerDown={() => setVisualTabNow(item.tab)}
            type="button"
          >
            <MaterialIcon name={item.icon} size={22} />
          </button>
        )
      })}
    </nav>
  )
}

function VacuumModalTabContent({
  activeTab,
  areaEditorMeta,
  areaEditorOpen,
  areaSelection,
  cleanTarget,
  drawMode,
  onAreaEditorMetaChange,
  onAreaSelectionChange,
  onCleanTargetChange,
  onDrawModeChange,
  onEditArea,
  onFinishAreaEditing,
  onResetAreaView,
  resetAreaViewRevision,
  vacuum,
}: {
  activeTab: VacuumModalTab
  areaEditorMeta: ValetudoMapEditorMeta
  areaEditorOpen: boolean
  areaSelection: MapGridRect | null
  cleanTarget: VacuumCleanTarget
  drawMode: boolean
  onAreaEditorMetaChange: (meta: ValetudoMapEditorMeta) => void
  onAreaSelectionChange: (selection: MapGridRect | null) => void
  onCleanTargetChange: (target: VacuumCleanTarget) => void
  onDrawModeChange: (drawMode: boolean) => void
  onEditArea?: () => void
  onFinishAreaEditing: () => void
  onResetAreaView: () => void
  resetAreaViewRevision: number
  vacuum: VacuumConfig
}) {
  const entity = useEntity(asEntityName(vacuum.entityId), { returnNullIfNotFound: true })
  const liveState = entity?.state ?? 'unavailable'
  const [displayState, commitDisplayState] = useOptimisticState(liveState, { clearOn: 'confirmation', revertMs: VACUUM_OPTIMISTIC_REVERT_MS })
  const modalBodyRef = useRef<HTMLDivElement | null>(null)
  const modalPanelRef = useRef<HTMLDivElement | null>(null)
  const tabs = vacuumModalTabs(vacuum)
  const targetTab = tabs.some((tab) => tab.tab === activeTab) ? activeTab : 'controls'
  const { displayedTab: effectiveActiveTab, transitionState } = useSmoothDisplayedModalTab(targetTab)
  const panelSections = [
    'controls',
    vacuum.zones.length > 0 ? 'zones' : null,
    vacuum.autoCleanDisabledRooms?.length ? 'auto-clean' : null,
    'actions',
    'info',
  ].filter(Boolean)
  const panelLabel = `${vacuum.title} ${panelSections.join(', ')}`
  const optimisticState = useMemo<OptimisticVacuumState>(() => ({ commitState: commitDisplayState, liveState, state: displayState }), [commitDisplayState, displayState, liveState])
  const coordinator = useVacuumCommandCoordinator(liveState, commitDisplayState)
  useVacuumSettingIntentConfirmations(vacuum, coordinator.confirmIntent)

  useEffect(() => {
    const scrollContainers = [modalPanelRef.current, modalBodyRef.current?.parentElement]
    for (const scrollContainer of scrollContainers) {
      if (!scrollContainer || typeof scrollContainer.scrollTo !== 'function') continue
      scrollContainer.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [effectiveActiveTab])

  return (
    <div className={[styles.modalBody, areaEditorOpen ? styles.areaEditorModalBody : ''].filter(Boolean).join(' ')} data-area-editor={areaEditorOpen ? 'true' : 'false'} ref={modalBodyRef}>
      <VacuumIntentConfirmationTrackers coordinator={coordinator} vacuum={vacuum} />
      <div aria-label={`${vacuum.title} map and status`} className={[styles.leftPane, areaEditorOpen ? styles.areaEditorPane : ''].filter(Boolean).join(' ')} role="group">
        <VacuumMapAndStatus
          areaEditorOpen={areaEditorOpen}
          areaSelection={areaSelection}
          drawMode={drawMode}
          editorMetaChange={onAreaEditorMetaChange}
          onAreaSelectionChange={onAreaSelectionChange}
          onDrawModeChange={onDrawModeChange}
          onFinishAreaEditing={onFinishAreaEditing}
          onResetAreaView={onResetAreaView}
          optimisticState={optimisticState}
          resetAreaViewRevision={resetAreaViewRevision}
          showAreaSelection={cleanTarget === 'area'}
          vacuum={vacuum}
        />
      </div>
      {!areaEditorOpen && (
        <div aria-label={panelLabel} className={styles.rightPane} data-modal-tab-transition-state={transitionState} data-scroll-region="vacuum-panel" data-tab={effectiveActiveTab} ref={modalPanelRef} role="group">
          {effectiveActiveTab === 'controls' && (
            <VacuumControlsSection
              areaEditorMeta={areaEditorMeta}
              areaSelection={areaSelection}
              cleanTarget={cleanTarget}
              coordinator={coordinator}
              onAreaSelectionChange={onAreaSelectionChange}
              onCleanTargetChange={onCleanTargetChange}
              onEditArea={onEditArea}
              optimisticState={optimisticState}
              vacuum={vacuum}
            />
          )}
          {effectiveActiveTab === 'zones' && <VacuumZones coordinator={coordinator} optimisticState={optimisticState} vacuum={vacuum} />}
          {effectiveActiveTab === 'autoClean' && <VacuumAutoCleanDisabledRooms vacuum={vacuum} />}
          {effectiveActiveTab === 'more' && <VacuumDockControlsSection coordinator={coordinator} optimisticState={optimisticState} vacuum={vacuum} />}
          {effectiveActiveTab === 'info' && <VacuumInfoSection vacuum={vacuum} />}
        </div>
      )}
    </div>
  )
}

function VacuumMapAndStatus({
  areaEditorOpen,
  areaSelection,
  drawMode,
  editorMetaChange,
  onAreaSelectionChange,
  onDrawModeChange,
  onFinishAreaEditing,
  onResetAreaView,
  optimisticState,
  resetAreaViewRevision,
  showAreaSelection,
  vacuum,
}: {
  areaEditorOpen: boolean
  areaSelection: MapGridRect | null
  drawMode: boolean
  editorMetaChange: (meta: ValetudoMapEditorMeta) => void
  onAreaSelectionChange: (selection: MapGridRect | null) => void
  onDrawModeChange: (drawMode: boolean) => void
  onFinishAreaEditing: () => void
  onResetAreaView: () => void
  optimisticState: OptimisticVacuumState
  resetAreaViewRevision: number
  showAreaSelection: boolean
  vacuum: VacuumConfig
}) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const locate = useCallback(() => callServiceAction(callService, 'vacuum.locate', vacuum.entityId), [callService, vacuum.entityId])
  const [editorMeta, setEditorMeta] = useState<ValetudoMapEditorMeta>({ error: null, geometry: null, isLoaded: false })
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
      {areaEditorOpen && (
        <div className={styles.areaEditorToolbar}>
          <button
            className={styles.areaEditorTool}
            data-active={drawMode ? 'true' : 'false'}
            data-modal-detail-autofocus="true"
            onClick={beginDrawing}
            type="button"
          >
            <MaterialIcon name="mdi:selection-drag" size={19} />
            {areaSelection ? 'Redraw' : 'Draw'}
          </button>
          <button className={styles.areaEditorTool} onClick={onResetAreaView} type="button">
            <MaterialIcon name="mdi:fit-to-screen-outline" size={19} />
            Reset View
          </button>
          <button className={styles.areaEditorTool} disabled={!areaSelection} onClick={() => onAreaSelectionChange(null)} type="button">
            <MaterialIcon name="mdi:delete-outline" size={19} />
            Clear
          </button>
        </div>
      )}
      <div className={[styles.mapStage, areaEditorOpen ? styles.areaEditorMapStage : ''].filter(Boolean).join(' ')} key="vacuum-map">
        <ValetudoMapCard
          drawMode={drawMode}
          expanded={areaEditorOpen}
          frozenGeometry={areaEditorOpen ? editorMeta.geometry : null}
          interactive={areaEditorOpen}
          minimumSizeCm={vacuum.areaCleaning?.minimumSizeCm}
          onDrawModeChange={onDrawModeChange}
          onEditorMetaChange={handleEditorMetaChange}
          onSelectionChange={onAreaSelectionChange}
          resetViewRevision={resetAreaViewRevision}
          selection={areaEditorOpen || showAreaSelection ? areaSelection : null}
          vacuum={vacuum}
        />
        {!areaEditorOpen && (
          <button className={styles.locateButton} data-icon="mdi:map-marker" data-tone="neutral" onClick={locate} type="button">
            <MaterialIcon name="mdi:map-marker" size={18} />
            Locate
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
              disabled: !areaSelection,
              icon: 'mdi:check',
              label: areaSelection ? 'Use This Area' : 'Draw an Area to Continue',
              onClick: onFinishAreaEditing,
            }}
          />
        </div>
      ) : (
        <>
          <VacuumStatusSummary displayState={optimisticState.state} vacuum={vacuum} />
          <VacuumWhileAwaySection vacuum={vacuum} />
        </>
      )}
    </>
  )
}

export function VacuumRoomSourceModalContent({ vacuum }: VacuumCardProps) {
  const [activeTab, setActiveTab] = useState<VacuumModalTab>('controls')
  const [areaEditorOpen, setAreaEditorOpen] = useState(false)
  const [areaSelection, setAreaSelection] = useState<MapGridRect | null>(null)
  const [cleanTarget, setCleanTarget] = useState<VacuumCleanTarget>('rooms')
  const [drawMode, setDrawMode] = useState(false)
  const [editorMeta, setEditorMeta] = useState<ValetudoMapEditorMeta>({ error: null, geometry: null, isLoaded: false })
  const [resetAreaViewRevision, setResetAreaViewRevision] = useState(0)

  return (
    <div className={styles.roomSourceModalShell}>
      <VacuumModalTabContent
        activeTab={activeTab}
        areaEditorMeta={editorMeta}
        areaEditorOpen={areaEditorOpen}
        areaSelection={areaSelection}
        cleanTarget={cleanTarget}
        drawMode={drawMode}
        onAreaEditorMetaChange={setEditorMeta}
        onAreaSelectionChange={setAreaSelection}
        onCleanTargetChange={setCleanTarget}
        onDrawModeChange={setDrawMode}
        onEditArea={() => {
          setCleanTarget('area')
          setDrawMode(!areaSelection)
          setAreaEditorOpen(true)
        }}
        onFinishAreaEditing={() => setAreaEditorOpen(false)}
        onResetAreaView={() => setResetAreaViewRevision((revision) => revision + 1)}
        resetAreaViewRevision={resetAreaViewRevision}
        vacuum={vacuum}
      />
      {!areaEditorOpen && <VacuumModalNav activeTab={activeTab} onTabChange={(tab) => {
        if (tab === 'zones') setCleanTarget('rooms')
        setActiveTab(tab)
      }} vacuum={vacuum} />}
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
  const [activeTab, setActiveTab] = useState<VacuumModalTab>('controls')
  const [areaEditorOpen, setAreaEditorOpen] = useState(false)
  const [areaSelection, setAreaSelection] = useState<MapGridRect | null>(null)
  const [cleanTarget, setCleanTarget] = useState<VacuumCleanTarget>('rooms')
  const [drawMode, setDrawMode] = useState(false)
  const [editorMeta, setEditorMeta] = useState<ValetudoMapEditorMeta>({ error: null, geometry: null, isLoaded: false })
  const [resetAreaViewRevision, setResetAreaViewRevision] = useState(0)
  const previousOpenRef = useRef(open)
  const detailPageKey = areaEditorOpen ? 'vacuum-area-editor' : activeTab
  const { bodyElementRef, enterDetailPage, leaveDetailPage, resetDetailPageScroll } = useModalDetailPageScroll(detailPageKey)
  const title = areaEditorOpen ? `${vacuum.title} Cleaning Area` : titleOverride ?? `${vacuum.title} Robot Vacuum`
  const closeAreaEditor = useCallback(() => {
    leaveDetailPage()
    setDrawMode(false)
    setAreaEditorOpen(false)
  }, [leaveDetailPage])
  const openAreaEditor = useCallback(() => {
    enterDetailPage('vacuum-area-editor')
    setActiveTab('controls')
    setCleanTarget('area')
    setDrawMode(!areaSelection)
    setAreaEditorOpen(true)
  }, [areaSelection, enterDetailPage])

  useEffect(() => {
    const wasOpen = previousOpenRef.current
    if (open && !wasOpen) {
      setActiveTab('controls')
      setAreaEditorOpen(false)
      setAreaSelection(null)
      setCleanTarget('rooms')
      setDrawMode(false)
      setEditorMeta({ error: null, geometry: null, isLoaded: false })
      setResetAreaViewRevision((revision) => revision + 1)
      resetDetailPageScroll()
    }
    previousOpenRef.current = open
  }, [open, resetDetailPageScroll])

  return (
    <ModalSheet
      backLabel="Back to controls"
      bodyElementRef={bodyElementRef}
      contentStyle={areaEditorOpen ? VACUUM_AREA_EDITOR_MODAL_STYLE : VACUUM_MODAL_STYLE}
      footer={areaEditorOpen ? undefined : <VacuumModalNav activeTab={activeTab} onTabChange={(tab) => {
        if (tab === 'zones') setCleanTarget('rooms')
        setActiveTab(tab)
      }} vacuum={vacuum} />}
      onBack={areaEditorOpen ? closeAreaEditor : undefined}
      onClose={onClose}
      open={open}
      scrollResetKey={detailPageKey}
      subtitle={areaEditorOpen ? undefined : subtitle}
      title={title}
    >
      <VacuumModalTabContent
        activeTab={activeTab}
        areaEditorMeta={editorMeta}
        areaEditorOpen={areaEditorOpen}
        areaSelection={areaSelection}
        cleanTarget={cleanTarget}
        drawMode={drawMode}
        onAreaEditorMetaChange={setEditorMeta}
        onAreaSelectionChange={setAreaSelection}
        onCleanTargetChange={setCleanTarget}
        onDrawModeChange={setDrawMode}
        onEditArea={openAreaEditor}
        onFinishAreaEditing={closeAreaEditor}
        onResetAreaView={() => setResetAreaViewRevision((revision) => revision + 1)}
        resetAreaViewRevision={resetAreaViewRevision}
        vacuum={vacuum}
      />
    </ModalSheet>
  )
}

export function VacuumCard({ disableHashSync = false, vacuum }: VacuumCardProps) {
  const entity = useEntity(asEntityName(vacuum.entityId), { returnNullIfNotFound: true })
  const battery = useEntity(asEntityName(vacuum.batteryEntityId), { returnNullIfNotFound: true })
  const [open, setOpen] = useState(false)
  const state = entity?.state
  const unavailable = isUnavailableState(state)
  const subtitle = vacuumSubtitle(state, battery?.state)
  const visual = vacuumStateVisual(state)

  useEffect(() => {
    if (disableHashSync) return undefined

    const syncFromHash = () => setOpen(dashboardHash() === `#${vacuum.hash}` && !unavailable)
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
  }, [disableHashSync, unavailable, vacuum.hash])

  const openModal = useCallback(() => {
    if (disableHashSync || unavailable) return
    replaceDashboardUrl(`${dashboardPathWithSearch()}#${vacuum.hash}`)
    setOpen(true)
  }, [disableHashSync, unavailable, vacuum.hash])

  const closeModal = useCallback(() => {
    if (!disableHashSync) replaceDashboardUrl(dashboardPathWithSearch())
    setOpen(false)
  }, [disableHashSync])

  const modal = useMemo(() => <VacuumModal onClose={closeModal} open={open} vacuum={vacuum} />, [closeModal, open, vacuum])

  return (
    <>
      <GlassTile
        backgroundColor={visual.backgroundColor}
        disclosure={!unavailable}
        icon={visual.icon}
        iconColor={visual.iconColor}
        isOff={unavailable}
        onClick={unavailable ? undefined : openModal}
        subtitle={subtitle}
        tone={visual.tileTone}
        title={vacuum.title}
      />
      {modal}
    </>
  )
}
