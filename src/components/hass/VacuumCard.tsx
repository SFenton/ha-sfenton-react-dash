import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useEntity, useHass } from '@hakit/core'
import { GlassTile } from '../core/GlassTile'
import { Description } from '../core/Description'
import { MaterialIcon } from '../core/Icon'
import { ModalSheet } from '../core/ModalSheet'
import { type VacuumConfig, type VacuumConsumableConfig, type VacuumZoneConfig } from '../../constants/portedDashboard'
import { useImmediateVisualTab, useSmoothDisplayedModalTab } from '../../hooks/useSmoothDisplayedModalTab'
import { asEntityName, titleCaseState } from './entityState'
import { ValetudoMapCard } from './ValetudoMapCard'
import { VACUUM_MODAL_STYLE } from './vacuumModalStyle'
import styles from './VacuumCard.module.css'

type VacuumModalTab = 'controls' | 'zones' | 'more' | 'info'

const VACUUM_MODAL_TABS: { icon: string; label: string; tab: VacuumModalTab }[] = [
  { icon: 'mdi:robot-vacuum', label: 'Controls', tab: 'controls' },
  { icon: 'mdi:floor-plan', label: 'Zones', tab: 'zones' },
  { icon: 'mdi:flash', label: 'Actions', tab: 'more' },
  { icon: 'mdi:information-outline', label: 'Info', tab: 'info' },
]
const DESKTOP_MODAL_QUERY = '(min-width: 760px)'
const CLEANING_SETUP_DESCRIPTION = 'Choose how many passes the vacuum should make, then start cleaning with the selected zones.'
const MODE_DESCRIPTION = 'Choose whether the robot vacuums, mops, or combines both for the next run.'
const FAN_DESCRIPTION = 'Adjust suction strength for carpets, hard floors, and quieter cleaning.'
const WATER_DESCRIPTION = 'Set mop water flow so floors get the right amount of moisture.'

type CallService = (params: Record<string, unknown>) => void

interface EntityLike {
  attributes: Record<string, unknown>
  entity_id: string
  state: string
}

interface VacuumCardProps {
  vacuum: VacuumConfig
}

function isUnavailableState(state: string | undefined) {
  return !state || state === 'unavailable' || state === 'unknown'
}

function isResumable(statusFlag: string | undefined) {
  return statusFlag === 'resumable'
}

function shouldResetScrollOnTabChange() {
  return typeof window.matchMedia !== 'function' || window.matchMedia(DESKTOP_MODAL_QUERY).matches
}

function vacuumModalTabs(vacuum: VacuumConfig) {
  return VACUUM_MODAL_TABS.filter((tab) => {
    if (tab.tab === 'zones') return vacuum.zones.length > 0
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

function callServiceAction(callService: CallService, action: string, target?: string) {
  const [domain, service] = action.split('.', 2)
  if (!domain || !service) return
  callService({ domain, service, target })
}

function useOptionalEntity(entityId: string | undefined) {
  return useEntity(asEntityName(entityId ?? 'sensor.unavailable'), { returnNullIfNotFound: true }) as EntityLike | null
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

function ControlItem({ children, description }: { children: ReactNode; description?: string }) {
  return (
    <div className={styles.controlItem} data-has-description={description ? 'true' : 'false'}>
      {description && <Description>{description}</Description>}
      {children}
    </div>
  )
}

function ActionButton({
  description,
  icon,
  label,
  onClick,
  tone = 'neutral',
  variant = 'default',
}: {
  description?: string
  icon: string
  label: string
  onClick: () => void
  tone?: 'danger' | 'neutral' | 'primary' | 'warning'
  variant?: 'default' | 'sub'
}) {
  return (
    <ControlItem description={description}>
      <button aria-label={label} className={styles.actionButton} data-icon={icon} data-tone={tone} data-variant={variant} onClick={onClick} type="button">
        <MaterialIcon name={icon} size={18} />
        <span className={styles.actionButtonText}>{label}</span>
      </button>
    </ControlItem>
  )
}

type InfoPillTone = 'danger' | 'ok' | 'warning'

function InfoPill({ grouped = false, icon, label, tone, value }: { grouped?: boolean; icon: string; label: string; tone?: InfoPillTone; value: string }) {
  const accessibilityProps = grouped ? { 'aria-label': `${label} ${value}`, role: 'group' as const } : {}

  return (
    <span {...accessibilityProps} className={styles.settingPill} data-tone={tone}>
      <MaterialIcon name={icon} size={18} />
      <span className={styles.settingText}>
        <span>{label}</span>
        <strong>{value}</strong>
      </span>
    </span>
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
  if (!entity || isUnavailableState(entity.state)) return undefined
  if (consumable.valueKind === 'duration') return formatConsumableDuration(entity)
  const value = formatStateValue(entity.state)
  return value.toLowerCase() === 'ok' ? 'OK' : value
}

function consumableTone(consumable: VacuumConsumableConfig, entity: EntityLike | null | undefined): InfoPillTone | undefined {
  if (!entity || isUnavailableState(entity.state)) return undefined
  if (consumable.valueKind === 'duration') {
    const minutes = Number(entity.state)
    if (!Number.isFinite(minutes)) return undefined
    if (minutes <= 0) return 'danger'
    if (minutes <= 600) return 'warning'
    return undefined
  }
  return entity.state.trim().toLowerCase() === 'ok' ? 'ok' : 'warning'
}

function VacuumConsumablePill({ consumable }: { consumable: VacuumConsumableConfig }) {
  const entity = useOptionalEntity(consumable.entityId)
  const value = formatConsumableValue(consumable, entity)

  if (!value) return null

  return <InfoPill grouped icon={consumable.icon} label={consumable.title} tone={consumableTone(consumable, entity)} value={value} />
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
  entity,
  entityId,
  formatOptionLabel,
  hideLabel = false,
  icon,
  label,
  showIcon = true,
  valueLabel,
  variant = 'setting',
}: {
  description?: string
  entity: EntityLike | null | undefined
  entityId: string
  formatOptionLabel?: (value: string) => string
  hideLabel?: boolean
  icon: string
  label: string
  showIcon?: boolean
  valueLabel?: string
  variant?: 'setting' | 'sub'
}) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const unavailable = !entity || isUnavailableState(entity.state)
  const options = entityOptions(entity)
  const value = entity?.state ?? ''
  const displayValue = valueLabel ?? formatEntityValue(entity, label)
  const selectOption = (option: string) => {
    if (option !== value) callService({ domain: domainFromEntity(entityId), service: 'select_option', target: entityId, serviceData: { option } })
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
  const selectOptions = renderedOptions.map((option) => ({ value: option, label: formatOptionLabel ? formatOptionLabel(option) : option === value && valueLabel ? valueLabel : formatStateValue(option) }))
  const nativeSelect = (
    <select
      aria-label={`${label} ${displayValue}`}
      className={styles.nativeSelect}
      onChange={(event) => selectOption(event.currentTarget.value)}
      value={value}
    >
      {selectOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  )

  if (variant === 'sub') {
    return (
      <ControlItem description={description}>
        <span className={styles.subSelectButton} data-has-icon={showIcon ? 'true' : 'false'} data-label-hidden={hideLabel ? 'true' : 'false'} data-native-select="true">
          {showIcon && <MaterialIcon name={icon} size={17} />}
          <span aria-hidden="true" className={styles.subSelectText}>
            {!hideLabel && <span>{label}</span>}
            <strong>{displayValue}</strong>
          </span>
          <MaterialIcon name="mdi:chevron-down" size={17} />
          {nativeSelect}
        </span>
      </ControlItem>
    )
  }

  return (
    <ControlItem description={description}>
      <span className={`${styles.settingPill} ${styles.settingButton}`} data-native-select="true">
        <span className={styles.settingIcon}>
          <MaterialIcon name={icon} size={18} />
        </span>
        <span aria-hidden="true" className={styles.settingText}>
          <span>{label}</span>
          <strong>{displayValue}</strong>
        </span>
        <span className={styles.settingChevron}>
          <MaterialIcon name="mdi:chevron-down" size={18} />
        </span>
        {nativeSelect}
      </span>
    </ControlItem>
  )
}

function ZoneButton({ disabled, zone }: { disabled: boolean; zone: VacuumZoneConfig }) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const entity = useEntity(asEntityName(zone.entityId), { returnNullIfNotFound: true })
  const active = entity?.state === 'on'

  return (
    <button
      className={styles.zoneButton}
      data-active={active}
      disabled={disabled}
      onClick={() => callService({ domain: 'input_boolean', service: 'toggle', target: zone.entityId })}
      type="button"
    >
      <MaterialIcon name={zone.icon} size={22} />
      <span>{zone.title}</span>
    </button>
  )
}

function VacuumStatusSummary({ vacuum }: { vacuum: VacuumConfig }) {
  const entity = useEntity(asEntityName(vacuum.entityId), { returnNullIfNotFound: true })
  const battery = useEntity(asEntityName(vacuum.batteryEntityId), { returnNullIfNotFound: true })
  const statusFlag = useEntity(asEntityName(vacuum.statusFlagEntityId), { returnNullIfNotFound: true })
  const error = useEntity(asEntityName(vacuum.errorEntityId), { returnNullIfNotFound: true })
  const mappedError = useEntity(asEntityName(vacuum.errorMessageEntityId), { returnNullIfNotFound: true })
  const state = entity?.state
  const lowBattery = error?.state === 'Low battery'
  const chargingBeforeResume = (state === 'docked' && isResumable(statusFlag?.state)) || (state === 'error' && lowBattery)
  const stateLabel = chargingBeforeResume ? 'Charging Before Resuming' : formatStateValue(state)
  const batteryLabel = battery && !isUnavailableState(battery.state) ? `${battery.state}%` : 'Unknown'
  const mappedErrorText = isErrorText(mappedError?.state) ? mappedError?.state : undefined
  const rawErrorText = isErrorText(error?.state) ? error?.state : undefined
  const errorText = mappedErrorText ?? rawErrorText ?? 'No error'
  const hasError = isErrorText(errorText)

  return (
    <section className={styles.statusPanel}>
      <InfoPill icon="mdi:robot-vacuum" label="Status" value={stateLabel} />
      <InfoPill icon="mdi:battery" label="Battery" value={batteryLabel} />
      {hasError ? (
        <div className={styles.errorMessage} role="alert">
          <MaterialIcon name="mdi:alert-circle" size={20} />
          <span>{errorText}</span>
        </div>
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

function VacuumPowerSettings({ vacuum }: { vacuum: VacuumConfig }) {
  const mode = useOptionalEntity(vacuum.modeEntityId)
  const modeText = useOptionalEntity(vacuum.modeTextEntityId)
  const fan = useOptionalEntity(vacuum.fanEntityId)
  const water = useOptionalEntity(vacuum.waterEntityId)
  const modeState = mode?.state
  const hasMode = Boolean(vacuum.modeEntityId && mode && !isUnavailableState(mode.state))
  const showFan = Boolean(vacuum.fanEntityId && fan && !isUnavailableState(fan.state) && modeState !== 'mop')
  const showWater = Boolean(vacuum.waterEntityId && water && !isUnavailableState(water.state) && (!hasMode || modeState !== 'vacuum'))
  const modeLabel = isMeaningfulText(modeText?.state) ? modeText?.state : formatEntityValue(mode, 'Mode')

  if (!hasMode && !showFan && !showWater) return null

  return (
    <ControlSection title="Power Settings">
      {hasMode && vacuum.modeEntityId && <SelectSetting description={MODE_DESCRIPTION} entity={mode} entityId={vacuum.modeEntityId} icon="mdi:robot-vacuum" label="Mode" valueLabel={modeLabel} variant="sub" />}
      {showFan && vacuum.fanEntityId && <SelectSetting description={FAN_DESCRIPTION} entity={fan} entityId={vacuum.fanEntityId} icon="mdi:fan" label="Fan" variant="sub" />}
      {showWater && vacuum.waterEntityId && <SelectSetting description={WATER_DESCRIPTION} entity={water} entityId={vacuum.waterEntityId} icon="mdi:water" label="Water" variant="sub" />}
    </ControlSection>
  )
}

function VacuumStateActions({ vacuum }: { vacuum: VacuumConfig }) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const entity = useEntity(asEntityName(vacuum.entityId), { returnNullIfNotFound: true })
  const statusFlag = useEntity(asEntityName(vacuum.statusFlagEntityId), { returnNullIfNotFound: true })
  const error = useEntity(asEntityName(vacuum.errorEntityId), { returnNullIfNotFound: true })
  const passes = useEntity(asEntityName(vacuum.passesEntityId), { returnNullIfNotFound: true }) as EntityLike | null
  const state = entity?.state
  const resumable = isResumable(statusFlag?.state)
  const lowBattery = error?.state === 'Low battery'
  const chargingBeforeResume = (state === 'docked' && resumable) || (state === 'error' && lowBattery)
  const showCleaningSetup = (state === 'docked' && !resumable) || state === 'idle' || (state === 'error' && !resumable && !lowBattery)
  const sectionTitle = chargingBeforeResume ? 'Charging Before Resuming' : formatStateValue(state, 'Vacuum')
  const clean = () => callServiceAction(callService, vacuum.cleanScript)
  const dock = () => callServiceAction(callService, 'vacuum.return_to_base', vacuum.entityId)
  const stop = () => callServiceAction(callService, state === 'error' || chargingBeforeResume ? 'vacuum.stop' : 'vacuum.return_to_base', vacuum.entityId)
  const pause = () => callServiceAction(callService, 'vacuum.pause', vacuum.entityId)
  const start = () => callServiceAction(callService, 'vacuum.start', vacuum.entityId)
  const cleaningSetupControls = showCleaningSetup ? (
    <>
      <Description>{CLEANING_SETUP_DESCRIPTION}</Description>
      <div className={styles.cleaningActionGrid} data-layout="cleaning">
        <SelectSetting entity={passes} entityId={vacuum.passesEntityId} formatOptionLabel={formatPassCount} hideLabel icon="mdi:numeric" label="Cleaning Passes" showIcon={false} valueLabel={formatPassCount(passes?.state)} variant="sub" />
        <ActionButton icon="mdi:play" label="Clean" onClick={clean} tone="primary" variant="sub" />
      </div>
    </>
  ) : null

  if (isUnavailableState(state)) return null

  return (
    <ControlSection title={sectionTitle}>
      {cleaningSetupControls}
      {state === 'idle' && <ActionButton description="Send the robot back to the dock." icon="mdi:home" label="Dock" onClick={dock} variant="sub" />}
      {state === 'error' && !resumable && !lowBattery && <ActionButton description="Stop the current vacuum task." icon="mdi:stop" label="Stop" onClick={stop} tone="danger" variant="sub" />}
      {state === 'error' && !resumable && !lowBattery && <ActionButton description="Send the robot back to the dock." icon="mdi:home" label="Dock" onClick={dock} variant="sub" />}
      {chargingBeforeResume && <ActionButton description="Continue the interrupted cleaning run." icon="mdi:play" label="Resume" onClick={start} tone="primary" variant="sub" />}
      {chargingBeforeResume && <ActionButton description="Cancel the pending cleaning resume." icon="mdi:stop" label="Cancel" onClick={stop} tone="danger" variant="sub" />}
      {state === 'cleaning' && <ActionButton description="Pause the current cleaning run." icon="mdi:pause" label="Pause" onClick={pause} tone="warning" variant="sub" />}
      {state === 'cleaning' && <ActionButton description="Stop the current cleaning run." icon="mdi:stop" label="Stop" onClick={stop} tone="danger" variant="sub" />}
      {state === 'paused' && <ActionButton description="Continue the paused cleaning run." icon="mdi:play" label="Resume" onClick={start} tone="primary" variant="sub" />}
      {state === 'paused' && <ActionButton description="Stop the paused cleaning run." icon="mdi:stop" label="Stop" onClick={stop} tone="danger" variant="sub" />}
      {state === 'returning' && <ActionButton description="Pause the return-to-dock action." icon="mdi:pause" label="Pause" onClick={pause} tone="warning" variant="sub" />}
    </ControlSection>
  )
}

function VacuumEmptyDockSection({ vacuum }: { vacuum: VacuumConfig }) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const entity = useEntity(asEntityName(vacuum.entityId), { returnNullIfNotFound: true })
  const statusFlag = useEntity(asEntityName(vacuum.statusFlagEntityId), { returnNullIfNotFound: true })
  const state = entity?.state
  const resumable = isResumable(statusFlag?.state)
  const emptyDock = () => vacuum.dockButtonEntityId && callServiceAction(callService, 'button.press', vacuum.dockButtonEntityId)
  const showEmptyDock = Boolean(vacuum.dockButtonEntityId && state === 'docked' && !resumable)

  if (!showEmptyDock) return null

  return (
    <section className={styles.section}>
      <SectionHeader title="Additional Controls" />
      <div className={styles.singleAction}>
        <ActionButton description="Trigger the auto-empty dock now." icon="mdi:delete-restore" label="Empty Dock" onClick={emptyDock} variant="sub" />
      </div>
    </section>
  )
}

function VacuumControlsSection({ vacuum }: { vacuum: VacuumConfig }) {
  return (
    <div className={styles.controlStack}>
      <VacuumStateActions vacuum={vacuum} />
      <VacuumPowerSettings vacuum={vacuum} />
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

function VacuumZones({ vacuum }: { vacuum: VacuumConfig }) {
  const entity = useEntity(asEntityName(vacuum.entityId), { returnNullIfNotFound: true })
  const statusFlag = useEntity(asEntityName(vacuum.statusFlagEntityId), { returnNullIfNotFound: true })
  const error = useEntity(asEntityName(vacuum.errorEntityId), { returnNullIfNotFound: true })
  const state = entity?.state
  const resumable = isResumable(statusFlag?.state)
  const lowBattery = error?.state === 'Low battery'
  const editableZones = (state === 'docked' && !resumable) || state === 'idle' || (state === 'error' && !resumable && !lowBattery)

  if (vacuum.zones.length === 0) return null

  return (
    <section className={styles.section}>
      <SectionHeader title="Zones" />
      <SectionText lines={vacuum.zoneDescription} />
      <div className={styles.zones}>
        {vacuum.zones.map((zone) => <ZoneButton disabled={!editableZones} key={zone.entityId} zone={zone} />)}
      </div>
    </section>
  )
}

function VacuumModalNav({ activeTab, onTabChange, vacuum }: { activeTab: VacuumModalTab; onTabChange: (tab: VacuumModalTab) => void; vacuum: VacuumConfig }) {
  const tabs = vacuumModalTabs(vacuum)
  const effectiveActiveTab = tabs.some((tab) => tab.tab === activeTab) ? activeTab : 'controls'
  const { clearVisualTab, setVisualTabNow, visualActiveTab } = useImmediateVisualTab(effectiveActiveTab)

  return (
    <nav aria-label={`${vacuum.title} modal sections`} className={styles.vacuumModalNav} style={{ '--vacuum-nav-tab-count': tabs.length } as CSSProperties}>
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

function VacuumModalTabContent({ activeTab, vacuum }: { activeTab: VacuumModalTab; vacuum: VacuumConfig }) {
  const modalBodyRef = useRef<HTMLDivElement | null>(null)
  const modalPanelRef = useRef<HTMLDivElement | null>(null)
  const tabs = vacuumModalTabs(vacuum)
  const targetTab = tabs.some((tab) => tab.tab === activeTab) ? activeTab : 'controls'
  const { displayedTab: effectiveActiveTab, transitionState } = useSmoothDisplayedModalTab(targetTab)
  const panelLabel = vacuum.zones.length > 0 ? `${vacuum.title} controls, zones, actions, and info` : `${vacuum.title} controls, actions, and info`

  useEffect(() => {
    if (!shouldResetScrollOnTabChange()) return

    const scrollContainers = [modalPanelRef.current, modalBodyRef.current?.parentElement]
    for (const scrollContainer of scrollContainers) {
      if (!scrollContainer || typeof scrollContainer.scrollTo !== 'function') continue
      scrollContainer.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [effectiveActiveTab])

  return (
    <div className={styles.modalBody} ref={modalBodyRef}>
      <div aria-label={`${vacuum.title} map and status`} className={styles.leftPane} role="group">
        <VacuumMapAndStatus vacuum={vacuum} />
      </div>
      <div aria-label={panelLabel} className={styles.rightPane} data-modal-tab-transition-state={transitionState} data-scroll-region="vacuum-panel" data-tab={effectiveActiveTab} ref={modalPanelRef} role="group">
        {effectiveActiveTab === 'controls' && <VacuumControlsSection vacuum={vacuum} />}
        {effectiveActiveTab === 'zones' && <VacuumZones vacuum={vacuum} />}
        {effectiveActiveTab === 'more' && <VacuumEmptyDockSection vacuum={vacuum} />}
        {effectiveActiveTab === 'info' && <VacuumInfoSection vacuum={vacuum} />}
      </div>
    </div>
  )
}

function VacuumMapAndStatus({ vacuum }: { vacuum: VacuumConfig }) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const locate = useCallback(() => callServiceAction(callService, 'vacuum.locate', vacuum.entityId), [callService, vacuum.entityId])

  return (
    <>
      <div className={styles.mapStage}>
        <ValetudoMapCard vacuum={vacuum} />
        <button className={`${styles.actionButton} ${styles.locateButton}`} data-icon="mdi:map-marker" data-tone="neutral" onClick={locate} type="button">
          <MaterialIcon name="mdi:map-marker" size={18} />
          Locate
        </button>
      </div>
      <VacuumStatusSummary vacuum={vacuum} />
      <VacuumWhileAwaySection vacuum={vacuum} />
    </>
  )
}

export function VacuumRoomSourceModalContent({ vacuum }: VacuumCardProps) {
  const [activeTab, setActiveTab] = useState<VacuumModalTab>('controls')

  return (
    <>
      <VacuumModalTabContent activeTab={activeTab} vacuum={vacuum} />
      <VacuumModalNav activeTab={activeTab} onTabChange={setActiveTab} vacuum={vacuum} />
    </>
  )
}

function VacuumModal({ onClose, open, vacuum }: { onClose: () => void; open: boolean; vacuum: VacuumConfig }) {
  const [activeTab, setActiveTab] = useState<VacuumModalTab>('controls')
  const title = `${vacuum.title} Robot Vacuum`

  return (
    <ModalSheet
      contentStyle={VACUUM_MODAL_STYLE}
      footer={<VacuumModalNav activeTab={activeTab} onTabChange={setActiveTab} vacuum={vacuum} />}
      onClose={onClose}
      open={open}
      title={title}
    >
      <VacuumModalTabContent activeTab={activeTab} vacuum={vacuum} />
    </ModalSheet>
  )
}

export function VacuumCard({ vacuum }: VacuumCardProps) {
  const entity = useEntity(asEntityName(vacuum.entityId), { returnNullIfNotFound: true })
  const battery = useEntity(asEntityName(vacuum.batteryEntityId), { returnNullIfNotFound: true })
  const [open, setOpen] = useState(false)
  const state = entity?.state
  const unavailable = isUnavailableState(state)
  const subtitle = vacuumSubtitle(state, battery?.state)

  useEffect(() => {
    const syncFromHash = () => setOpen(window.location.hash === `#${vacuum.hash}` && !unavailable)
    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [unavailable, vacuum.hash])

  const openModal = useCallback(() => {
    if (unavailable) return
    window.history.replaceState(null, '', `${window.location.pathname}#${vacuum.hash}`)
    setOpen(true)
  }, [unavailable, vacuum.hash])

  const closeModal = useCallback(() => {
    window.history.replaceState(null, '', window.location.pathname)
    setOpen(false)
  }, [])

  const modal = useMemo(() => <VacuumModal onClose={closeModal} open={open} vacuum={vacuum} />, [closeModal, open, vacuum])

  return (
    <>
      <GlassTile
        icon="mdi:robot-vacuum"
        isOff={unavailable}
        onClick={unavailable ? undefined : openModal}
        subtitle={subtitle}
        tone="vacuum"
        title={vacuum.title}
      />
      {modal}
    </>
  )
}
