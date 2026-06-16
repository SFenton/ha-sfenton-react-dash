import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useEntity, useHass } from '@hakit/core'
import { GlassTile } from '../core/GlassTile'
import { MaterialIcon } from '../core/Icon'
import { ModalSheet } from '../core/ModalSheet'
import { OptionPickerDialog, type PickerOption } from '../core/OptionPickerDialog'
import { type VacuumConfig, type VacuumZoneConfig } from '../../constants/portedDashboard'
import { asEntityName, titleCaseState } from './entityState'
import { ValetudoMapCard } from './ValetudoMapCard'
import styles from './VacuumCard.module.css'

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

function ActionButton({
  icon,
  label,
  onClick,
  tone = 'neutral',
  variant = 'default',
}: {
  icon: string
  label: string
  onClick: () => void
  tone?: 'danger' | 'neutral' | 'primary' | 'warning'
  variant?: 'default' | 'sub'
}) {
  return (
    <button className={styles.actionButton} data-icon={icon} data-tone={tone} data-variant={variant} onClick={onClick} type="button">
      <MaterialIcon name={icon} size={18} />
      {label}
    </button>
  )
}

function InfoPill({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <span className={styles.settingPill}>
      <MaterialIcon name={icon} size={18} />
      <span className={styles.settingText}>
        <span>{label}</span>
        <strong>{value}</strong>
      </span>
    </span>
  )
}

function CompositeControl({ children, icon, subtitle, title }: { children: ReactNode; icon: string; subtitle?: string; title: string }) {
  return (
    <div aria-label={title} className={styles.compositeButton} role="group">
      <div className={styles.compositeHeader}>
        <span className={styles.compositeIcon}>
          <MaterialIcon name={icon} size={20} />
        </span>
        <span className={styles.compositeText}>
          <h3>{title}</h3>
          {subtitle && <span>{subtitle}</span>}
        </span>
      </div>
      <div className={styles.compositeControls}>{children}</div>
    </div>
  )
}

function SelectSetting({
  entity,
  entityId,
  icon,
  label,
  showIcon = true,
  valueLabel,
  variant = 'setting',
}: {
  entity: EntityLike | null | undefined
  entityId: string
  icon: string
  label: string
  showIcon?: boolean
  valueLabel?: string
  variant?: 'setting' | 'sub'
}) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const [pickerOpen, setPickerOpen] = useState(false)
  const unavailable = !entity || isUnavailableState(entity.state)
  const options = entityOptions(entity)
  const value = entity?.state ?? ''
  const displayValue = valueLabel ?? formatEntityValue(entity, label)
  const selectOption = (option: string) => {
    setPickerOpen(false)
    if (option !== value) callService({ domain: domainFromEntity(entityId), service: 'select_option', target: entityId, serviceData: { option } })
  }

  if (unavailable || options.length === 0) {
    return variant === 'sub' ? (
      <span className={styles.subInfoPill}>
        <span>{label}</span>
        <strong>{displayValue}</strong>
      </span>
    ) : (
      <InfoPill icon={icon} label={label} value={displayValue} />
    )
  }

  const renderedOptions = options.includes(value) ? options : [value, ...options].filter(Boolean)
  const pickerOptions: PickerOption[] = renderedOptions.map((option) => ({ value: option, label: formatStateValue(option) }))

  if (variant === 'sub') {
    return (
      <>
        <button
          aria-expanded={pickerOpen}
          aria-haspopup="dialog"
          aria-label={`${label} ${displayValue}`}
          className={styles.subSelectButton}
          data-has-icon={showIcon ? 'true' : 'false'}
          onClick={() => setPickerOpen(true)}
          type="button"
        >
          {showIcon && <MaterialIcon name={icon} size={17} />}
          <span className={styles.subSelectText}>
            <span>{label}</span>
            <strong>{displayValue}</strong>
          </span>
          <MaterialIcon name="mdi:chevron-down" size={17} />
        </button>
        <OptionPickerDialog onClose={() => setPickerOpen(false)} onSelect={selectOption} open={pickerOpen} options={pickerOptions} title={label} value={value} />
      </>
    )
  }

  return (
    <>
      <button
        aria-expanded={pickerOpen}
        aria-haspopup="dialog"
        aria-label={`${label} ${displayValue}`}
        className={`${styles.settingPill} ${styles.settingButton}`}
        onClick={() => setPickerOpen(true)}
        type="button"
      >
        <span className={styles.settingIcon}>
          <MaterialIcon name={icon} size={18} />
        </span>
        <span className={styles.settingText}>
          <span>{label}</span>
          <strong>{displayValue}</strong>
        </span>
        <span className={styles.settingChevron}>
          <MaterialIcon name="mdi:chevron-down" size={18} />
        </span>
      </button>
      <OptionPickerDialog onClose={() => setPickerOpen(false)} onSelect={selectOption} open={pickerOpen} options={pickerOptions} title={label} value={value} />
    </>
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
    <CompositeControl icon="mdi:robot-vacuum" title="Power Settings">
      {hasMode && vacuum.modeEntityId && <SelectSetting entity={mode} entityId={vacuum.modeEntityId} icon="mdi:robot-vacuum" label="Mode" valueLabel={modeLabel} variant="sub" />}
      {showFan && vacuum.fanEntityId && <SelectSetting entity={fan} entityId={vacuum.fanEntityId} icon="mdi:fan" label="Fan" variant="sub" />}
      {showWater && vacuum.waterEntityId && <SelectSetting entity={water} entityId={vacuum.waterEntityId} icon="mdi:water" label="Water" variant="sub" />}
    </CompositeControl>
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

  if (isUnavailableState(state)) return null

  return (
    <CompositeControl icon="mdi:home" title={sectionTitle}>
      {showCleaningSetup && <SelectSetting entity={passes} entityId={vacuum.passesEntityId} icon="mdi:numeric" label="Cleaning Passes" showIcon={false} variant="sub" />}
      {showCleaningSetup && <ActionButton icon="mdi:play" label="Clean" onClick={clean} tone="primary" variant="sub" />}
      {state === 'idle' && <ActionButton icon="mdi:home" label="Dock" onClick={dock} variant="sub" />}
      {state === 'error' && !resumable && !lowBattery && <ActionButton icon="mdi:stop" label="Stop" onClick={stop} tone="danger" variant="sub" />}
      {state === 'error' && !resumable && !lowBattery && <ActionButton icon="mdi:home" label="Dock" onClick={dock} variant="sub" />}
      {chargingBeforeResume && <ActionButton icon="mdi:play" label="Resume" onClick={start} tone="primary" variant="sub" />}
      {chargingBeforeResume && <ActionButton icon="mdi:stop" label="Cancel" onClick={stop} tone="danger" variant="sub" />}
      {state === 'cleaning' && <ActionButton icon="mdi:pause" label="Pause" onClick={pause} tone="warning" variant="sub" />}
      {state === 'cleaning' && <ActionButton icon="mdi:stop" label="Stop" onClick={stop} tone="danger" variant="sub" />}
      {state === 'paused' && <ActionButton icon="mdi:play" label="Resume" onClick={start} tone="primary" variant="sub" />}
      {state === 'paused' && <ActionButton icon="mdi:stop" label="Stop" onClick={stop} tone="danger" variant="sub" />}
      {state === 'returning' && <ActionButton icon="mdi:pause" label="Pause" onClick={pause} tone="warning" variant="sub" />}
    </CompositeControl>
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
        <ActionButton icon="mdi:delete-restore" label="Empty Dock" onClick={emptyDock} variant="sub" />
      </div>
    </section>
  )
}

function VacuumControlsSection({ vacuum }: { vacuum: VacuumConfig }) {
  return (
    <section className={styles.section}>
      <SectionHeader title="Vacuum Controls" />
      <div className={styles.controlStack}>
        <VacuumPowerSettings vacuum={vacuum} />
        <VacuumStateActions vacuum={vacuum} />
      </div>
    </section>
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

function VacuumControls({ vacuum }: { vacuum: VacuumConfig }) {
  return (
    <>
      <VacuumStatusSummary vacuum={vacuum} />
      <VacuumWhileAwaySection vacuum={vacuum} />
      <VacuumControlsSection vacuum={vacuum} />
      <VacuumZones vacuum={vacuum} />
      <VacuumEmptyDockSection vacuum={vacuum} />
    </>
  )
}

export function VacuumModalContent({ vacuum }: VacuumCardProps) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const locate = useCallback(() => callServiceAction(callService, 'vacuum.locate', vacuum.entityId), [callService, vacuum.entityId])

  return (
    <div className={styles.modalBody}>
      <div className={styles.mapStage}>
        <ValetudoMapCard vacuum={vacuum} />
        <button className={`${styles.actionButton} ${styles.locateButton}`} data-icon="mdi:map-marker" data-tone="neutral" onClick={locate} type="button">
          <MaterialIcon name="mdi:map-marker" size={18} />
          Locate
        </button>
      </div>
      <VacuumControls vacuum={vacuum} />
    </div>
  )
}

export function VacuumCard({ vacuum }: VacuumCardProps) {
  const entity = useEntity(asEntityName(vacuum.entityId), { returnNullIfNotFound: true })
  const battery = useEntity(asEntityName(vacuum.batteryEntityId), { returnNullIfNotFound: true })
  const [open, setOpen] = useState(false)
  const state = entity?.state
  const unavailable = isUnavailableState(state)
  const subtitle = vacuumSubtitle(state, battery?.state)
  const title = `${vacuum.title} Robot Vacuum`

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

  const modal = useMemo(() => (
    <ModalSheet onClose={closeModal} open={open} title={title}>
      <VacuumModalContent vacuum={vacuum} />
    </ModalSheet>
  ), [closeModal, open, title, vacuum])

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
