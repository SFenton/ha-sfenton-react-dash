import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useEntity, useHass } from '@hakit/core'
import { Card } from '../core/Card'
import { MaterialIcon } from '../core/Icon'
import { ModalSheet } from '../core/ModalSheet'
import { UNAVAILABLE_COLOR, VACUUM_COLOR, type VacuumConfig, type VacuumZoneConfig } from '../../constants/portedDashboard'
import { asEntityName, formatCompactEntityState, titleCaseState } from './entityState'
import styles from './VacuumCard.module.css'

type CallService = (params: Record<string, unknown>) => void

interface VacuumCardProps {
  vacuum: VacuumConfig
}

function isUnavailableState(state: string | undefined) {
  return !state || state === 'unavailable' || state === 'unknown'
}

function isResumable(statusFlag: string | undefined) {
  return statusFlag === 'resumable'
}

function vacuumSubtitle(state: string | undefined, battery: string | undefined) {
  if (isUnavailableState(state)) return undefined
  const label = titleCaseState(state)
  if (!battery || battery === 'unknown' || battery === 'unavailable') return label
  return `${label} • ${battery}%`
}

function callServiceAction(callService: CallService, action: string, target?: string) {
  const [domain, service] = action.split('.', 2)
  if (!domain || !service) return
  callService({ domain, service, target })
}

function InfoPill({ icon, label }: { icon: string; label: string }) {
  return (
    <span className={styles.infoPill}>
      <MaterialIcon name={icon} size={17} />
      {label}
    </span>
  )
}

function ActionButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button className={styles.actionButton} onClick={onClick} type="button">
      <MaterialIcon name={icon} size={17} />
      {label}
    </button>
  )
}

function useOptionalEntity(entityId: string | undefined) {
  return useEntity(asEntityName(entityId ?? 'sensor.unavailable'), { returnNullIfNotFound: true })
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
      {zone.title}
    </button>
  )
}

function VacuumMapPreview({ vacuum }: { vacuum: VacuumConfig }) {
  const rooms = vacuum.zones.length > 0 ? vacuum.zones.slice(0, 6) : [{ title: vacuum.title, entityId: vacuum.entityId }]

  return (
    <div className={styles.mapShell} style={{ '--map-scale': String(Math.min(vacuum.mapScale, 1.35)) } as CSSProperties} aria-label={`${vacuum.title} vacuum map`}>
      <div className={styles.mapRooms} aria-hidden="true">
        {rooms.map((room) => <span className={styles.mapRoom} key={`${vacuum.vacuumMapId}-${room.entityId}`}>{room.title.replace(/^Clean /, '')}</span>)}
      </div>
      <div className={styles.mapMeta}>
        <span className={styles.mapBadge}>{vacuum.vacuumMapId}</span>
        <span className={styles.mapBadge}>{vacuum.mapScale}x</span>
      </div>
    </div>
  )
}

function VacuumControls({ vacuum }: { vacuum: VacuumConfig }) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const entity = useEntity(asEntityName(vacuum.entityId), { returnNullIfNotFound: true })
  const battery = useEntity(asEntityName(vacuum.batteryEntityId), { returnNullIfNotFound: true })
  const statusFlag = useEntity(asEntityName(vacuum.statusFlagEntityId), { returnNullIfNotFound: true })
  const error = useEntity(asEntityName(vacuum.errorEntityId), { returnNullIfNotFound: true })
  const mappedError = useEntity(asEntityName(vacuum.errorMessageEntityId), { returnNullIfNotFound: true })
  const mode = useOptionalEntity(vacuum.modeEntityId)
  const fan = useOptionalEntity(vacuum.fanEntityId)
  const water = useOptionalEntity(vacuum.waterEntityId)
  const passes = useEntity(asEntityName(vacuum.passesEntityId), { returnNullIfNotFound: true })
  const state = entity?.state
  const resumable = isResumable(statusFlag?.state)
  const lowBattery = error?.state === 'Low battery'
  const chargingBeforeResume = (state === 'docked' && resumable) || (state === 'error' && lowBattery)
  const editableZones = (state === 'docked' && !resumable) || state === 'idle' || (state === 'error' && !resumable && !lowBattery)
  const showError = state === 'error' && error?.state && !['No error', 'unknown', 'unavailable'].includes(error.state)
  const errorText = mappedError?.state && !['unknown', 'unavailable', ''].includes(mappedError.state) ? mappedError.state : error?.state
  const clean = () => callServiceAction(callService, vacuum.cleanScript)
  const dock = () => callServiceAction(callService, 'vacuum.return_to_base', vacuum.entityId)
  const stop = () => callServiceAction(callService, state === 'cleaning' || state === 'paused' ? 'vacuum.return_to_base' : 'vacuum.stop', vacuum.entityId)
  const pause = () => callServiceAction(callService, 'vacuum.pause', vacuum.entityId)
  const start = () => callServiceAction(callService, 'vacuum.start', vacuum.entityId)

  const controlTitle = chargingBeforeResume ? 'Charging Before Resuming' : titleCaseState(state)
  const status = vacuumSubtitle(state, battery?.state)

  return (
    <>
      {showError && (
        <section className={styles.controlCard}>
          <div className={styles.separator}>Error</div>
          <div className={styles.errorText}>{errorText}</div>
        </section>
      )}

      {!isUnavailableState(state) && (
        <section className={styles.controlCard}>
          <div className={styles.separator}>Power Settings</div>
          <div className={styles.buttonRow}>
            {mode && !isUnavailableState(mode.state) && <InfoPill icon="mdi:robot-vacuum" label={formatCompactEntityState(mode, 'Mode')} />}
            {fan && !isUnavailableState(fan.state) && <InfoPill icon="mdi:fan" label={formatCompactEntityState(fan, 'Fan')} />}
            {water && !isUnavailableState(water.state) && <InfoPill icon="mdi:water" label={formatCompactEntityState(water, 'Water')} />}
          </div>
        </section>
      )}

      {!isUnavailableState(state) && (
        <section className={styles.controlCard}>
          <div className={styles.controlHeader}>
            <span className={styles.controlTitle}>
              <strong>{controlTitle}</strong>
              {status && <span>{status}</span>}
            </span>
          </div>
          <div className={styles.buttonRow}>
            {(state === 'docked' || state === 'idle' || (state === 'error' && !lowBattery)) && <InfoPill icon="mdi:numeric" label={`${passes?.state ?? '1'}x`} />}
            {(state === 'docked' || state === 'idle' || (state === 'error' && !lowBattery)) && <ActionButton icon="mdi:play" label="Clean" onClick={clean} />}
            {state === 'idle' && <ActionButton icon="mdi:home" label="Dock" onClick={dock} />}
            {chargingBeforeResume && <ActionButton icon="mdi:play" label="Resume" onClick={start} />}
            {state === 'cleaning' && <ActionButton icon="mdi:pause" label="Pause" onClick={pause} />}
            {state === 'returning' && <ActionButton icon="mdi:pause" label="Pause" onClick={pause} />}
            {state === 'paused' && <ActionButton icon="mdi:play" label="Resume" onClick={start} />}
            {(state === 'cleaning' || state === 'paused' || state === 'error' || chargingBeforeResume) && <ActionButton icon="mdi:stop" label={chargingBeforeResume ? 'Cancel' : 'Stop'} onClick={stop} />}
            {state === 'error' && !lowBattery && <ActionButton icon="mdi:home" label="Dock" onClick={dock} />}
          </div>
        </section>
      )}

      {vacuum.zones.length > 0 && (
        <section className={styles.controlCard}>
          <div className={styles.separator}>Zones</div>
          <p className={styles.instructions}>Select any zones to focus cleaning in those areas. If no zones are selected, cleaning runs for the whole {vacuum.title}.</p>
          <div className={styles.zones}>
            {vacuum.zones.map((zone) => <ZoneButton disabled={!editableZones} key={zone.entityId} zone={zone} />)}
          </div>
        </section>
      )}

      {vacuum.dockButtonEntityId && state === 'docked' && !resumable && (
        <section className={styles.controlCard}>
          <div className={styles.separator}>Additional Controls</div>
          <div className={styles.buttonRow}>
            <ActionButton icon="mdi:home" label="Empty Dock" onClick={() => callServiceAction(callService, 'button.press', vacuum.dockButtonEntityId)} />
          </div>
        </section>
      )}
    </>
  )
}

export function VacuumModalContent({ vacuum }: VacuumCardProps) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const title = `${vacuum.title} Robot Vacuum`
  const locate = useCallback(() => callServiceAction(callService, 'vacuum.locate', vacuum.entityId), [callService, vacuum.entityId])

  return (
    <div className={styles.modalBody}>
      <div className={styles.separator}>{title}</div>
      <div className={styles.buttonRow}>
        <ActionButton icon="mdi:map-marker" label="Locate" onClick={locate} />
      </div>
      <VacuumMapPreview vacuum={vacuum} />
      <div className={styles.reviewNotice}>The YAML dashboard uses the Valetudo map custom card here. This React map surface is a visual port and still needs live-map renderer review.</div>
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
      <Card
        ariaLabel={subtitle ? `${vacuum.title} ${subtitle}` : vacuum.title}
        color={unavailable ? UNAVAILABLE_COLOR : VACUUM_COLOR}
        disabled={unavailable}
        icon={<MaterialIcon name="mdi:robot-vacuum" size={38} />}
        muted={unavailable}
        onClick={unavailable ? undefined : openModal}
        size="compact"
        subtitle={subtitle}
        title={vacuum.title}
      />
      {modal}
    </>
  )
}