import { useEffect, useState } from 'react'
import { useEntity } from '@hakit/core'
import type { BathroomFanConfig } from '../../constants/bathroomFans'
import { BATHROOM_FAN_COPY_KEYS, BATHROOM_FAN_COPY_NAMESPACE, useCopy } from '../../i18n'
import { cardColorCss, colorFromHumidity, colorFromRgba, colorFromTemperature } from '../cards/climateColor'
import { DynamicGrid } from '../core/DynamicGrid'
import { GlassTile } from '../core/GlassTile'
import { MaterialIcon } from '../core/Icon'
import { InfoBox } from '../core/InfoBox'
import { ModalSheet, type ModalSheetStyle } from '../core/ModalSheet'
import { SelectActionField } from '../core/SelectActionField'
import { SectionHeader } from '../core/SectionHeader'
import { StatusPill } from '../core/StatusPill'
import { TimerRow } from '../core/TimerRow'
import { formatTimerRemaining } from '../core/timerFormatting'
import type { ControlSemantics } from '../core/controlSemantics'
import { asEntityName, isOccupancyActive } from './entityState'
import { BATHROOM_FAN_DEFAULT_TIMER_MINUTES } from './bathroomFanState'
import { type BathroomFanCommandController, useSharedBathroomFanCommand } from './bathroomFanCommandContext'
import { useBathroomFanCommand } from './useBathroomFanCommand'
import styles from './BathroomFanModalContent.module.css'

const BATHROOM_FAN_MODAL_STYLE: ModalSheetStyle = {
  '--modal-desktop-height': 'auto',
  '--modal-desktop-max-width': '500px',
  '--modal-desktop-width': '500px',
}
const NOOP = () => undefined

interface BathroomFanModalContentProps {
  config: BathroomFanConfig
  preload?: boolean
  runtimeActive?: boolean
}

interface BathroomFanModalViewProps {
  autoUnlock: boolean
  autoUnlockAvailable: boolean
  humidity: string
  humidityAvailable: boolean
  humidityColor?: string
  lockAvailable: boolean
  locked: boolean
  minutes: number
  occupancy: string
  occupancyActive: boolean
  occupancyAvailable: boolean
  onAutoUnlockChange: (enabled: boolean) => void
  onCancelTimer: () => void
  onLockChange: (locked: boolean) => void
  onMinutesChange: (minutes: number) => void
  onPowerChange: (powerOn: boolean) => void
  onSetTimer: () => void
  powerAvailable: boolean
  powerOn: boolean
  remainingSeconds: number | null
  temperatureAvailable: boolean
  temperatureColor?: string
  temperatureRange: string
  timerAvailable: boolean
  timerPending: boolean
}

function entityAvailable(entity: ReturnType<typeof useEntity>) {
  return Boolean(entity && entity.state !== 'unavailable' && entity.state !== 'unknown')
}

function humidityReading(entity: ReturnType<typeof useEntity>, unavailable: string) {
  if (!entityAvailable(entity)) return unavailable
  const value = Number(entity?.state)
  return Number.isFinite(value) ? `${Math.round(value)}%` : unavailable
}

function numericState(entity: ReturnType<typeof useEntity>) {
  if (!entityAvailable(entity)) return null
  const value = Number(entity?.state)
  return Number.isFinite(value) ? value : null
}

function occupancyState(entity: ReturnType<typeof useEntity>, occupied: string, clear: string, unavailable: string) {
  if (!entityAvailable(entity)) return unavailable
  return isOccupancyActive(entity) ? occupied : clear
}

function temperatureRangeValue(value: string) {
  const matches = [...value.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0])).filter(Number.isFinite)
  if (matches.length === 0) return null
  return matches.reduce((sum, current) => sum + current, 0) / matches.length
}

function textState(entity: ReturnType<typeof useEntity>, unavailable: string) {
  return entityAvailable(entity) ? entity?.state ?? unavailable : unavailable
}

function timerDeadlineMs(entity: ReturnType<typeof useEntity>) {
  if (!entityAvailable(entity)) return null
  const timestamp = Number(entity?.attributes.timestamp)
  if (Number.isFinite(timestamp)) return timestamp * 1000
  const parsed = Date.parse((entity?.state ?? '').replace(' ', 'T'))
  return Number.isFinite(parsed) ? parsed : null
}

function useBathroomFanTimerRemaining(deadlineEntity: ReturnType<typeof useEntity>, timerPending: boolean, runtimeActive: boolean) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!runtimeActive || !timerPending) return undefined
    const syncTimer = window.setTimeout(() => setNow(Date.now()), 0)
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      window.clearTimeout(syncTimer)
      window.clearInterval(interval)
    }
  }, [runtimeActive, timerPending])

  if (!timerPending) return null
  const deadline = timerDeadlineMs(deadlineEntity)
  return deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000))
}

function BathroomFanModalView({
  autoUnlock,
  autoUnlockAvailable,
  humidity,
  humidityAvailable,
  humidityColor,
  lockAvailable,
  locked,
  minutes,
  occupancy,
  occupancyActive,
  occupancyAvailable,
  onAutoUnlockChange,
  onCancelTimer,
  onLockChange,
  onMinutesChange,
  onPowerChange,
  onSetTimer,
  powerAvailable,
  powerOn,
  remainingSeconds,
  temperatureAvailable,
  temperatureColor,
  temperatureRange,
  timerAvailable,
  timerPending,
}: BathroomFanModalViewProps) {
  const copy = useCopy(BATHROOM_FAN_COPY_NAMESPACE)
  const autoUnlockSemantics = { kind: 'toggle', checked: autoUnlock } satisfies ControlSemantics
  const powerState = powerAvailable
    ? powerOn ? copy(BATHROOM_FAN_COPY_KEYS.states.on) : copy(BATHROOM_FAN_COPY_KEYS.states.off)
    : copy(BATHROOM_FAN_COPY_KEYS.states.unavailable)
  const lockState = lockAvailable
    ? locked ? copy(BATHROOM_FAN_COPY_KEYS.states.locked) : copy(BATHROOM_FAN_COPY_KEYS.states.unlocked)
    : copy(BATHROOM_FAN_COPY_KEYS.states.unavailable)
  const timerOptions = [
    { label: copy(BATHROOM_FAN_COPY_KEYS.durations.fiveMinutes), value: '5' },
    { label: copy(BATHROOM_FAN_COPY_KEYS.durations.tenMinutes), value: '10' },
    { label: copy(BATHROOM_FAN_COPY_KEYS.durations.fifteenMinutes), value: '15' },
    { label: copy(BATHROOM_FAN_COPY_KEYS.durations.twentyMinutes), value: '20' },
    { label: copy(BATHROOM_FAN_COPY_KEYS.durations.thirtyMinutes), value: '30' },
    { label: copy(BATHROOM_FAN_COPY_KEYS.durations.oneHour), value: '60' },
  ]
  const timerValue = remainingSeconds === null
    ? copy(BATHROOM_FAN_COPY_KEYS.states.unavailable)
    : formatTimerRemaining(remainingSeconds)
  const timerLabel = copy(BATHROOM_FAN_COPY_KEYS.timer)

  return (
    <div className={styles.root} data-bathroom-fan-modal-content="true">
      <DynamicGrid columns={2} gap={8}>
        <StatusPill
          grouped
          icon={occupancyActive ? 'mdi:motion-sensor' : 'mdi:motion-sensor-off'}
          label={copy(BATHROOM_FAN_COPY_KEYS.roomOccupancy)}
          tone={!occupancyAvailable ? 'unavailable' : occupancyActive ? 'ok' : 'neutral'}
          value={occupancy}
        />
        <StatusPill
          backgroundColor={temperatureColor}
          grouped
          icon="mdi:thermometer"
          label={copy(BATHROOM_FAN_COPY_KEYS.roomTemperatureRange)}
          tone={temperatureAvailable ? 'neutral' : 'unavailable'}
          value={temperatureRange}
        />
        <StatusPill
          backgroundColor={humidityColor}
          grouped
          icon="mdi:water-percent"
          label={copy(BATHROOM_FAN_COPY_KEYS.humidity)}
          tone={humidityAvailable ? 'neutral' : 'unavailable'}
          value={humidity}
        />
      </DynamicGrid>

      <div className={styles.toggleGrid}>
        <GlassTile
          compact
          disabled={!powerAvailable}
          icon="mdi:power"
          isOff={!powerOn || !powerAvailable}
          onClick={() => onPowerChange(!powerOn)}
          semantics={{ kind: 'toggle', checked: powerOn }}
          subtitle={powerState}
          title={copy(BATHROOM_FAN_COPY_KEYS.power)}
          tone="switch"
        />
        <GlassTile
          compact
          disabled={!lockAvailable}
          icon={locked ? 'mdi:lock' : 'mdi:lock-open-variant'}
          isOff={!locked || !lockAvailable}
          onClick={() => onLockChange(!locked)}
          semantics={{ kind: 'toggle', checked: locked }}
          subtitle={lockState}
          title={copy(BATHROOM_FAN_COPY_KEYS.lock)}
          tone="security"
        />
      </div>

      {(powerOn || timerPending) && (
        <section aria-label={timerLabel} className={styles.timerSection}>
          <SectionHeader className={styles.timerHeader} title={timerLabel} />
            {powerOn && !timerPending && (
              <SelectActionField
                actionDisabled={!timerAvailable}
                actionLabel={copy(BATHROOM_FAN_COPY_KEYS.set)}
                hideLabel
                label={copy(BATHROOM_FAN_COPY_KEYS.timer)}
                onAction={onSetTimer}
                onChange={(value) => onMinutesChange(Number(value))}
                options={timerOptions}
                value={String(minutes)}
              />
            )}
            {timerPending && (
              <TimerRow
                ariaLabel={copy(BATHROOM_FAN_COPY_KEYS.timerRowLabel, { label: timerLabel, value: timerValue })}
                clearDisabled={!timerAvailable}
                clearLabel={copy(BATHROOM_FAN_COPY_KEYS.clear)}
                onClear={onCancelTimer}
                value={timerValue}
              />
            )}
            {locked && (
              <button
                aria-checked={autoUnlockSemantics.checked}
                aria-label={copy(BATHROOM_FAN_COPY_KEYS.autoDisableLock)}
                className={styles.autoUnlock}
                data-action-kind={autoUnlockSemantics.kind}
                data-checked={autoUnlock ? 'true' : 'false'}
                disabled={!autoUnlockAvailable}
                onClick={() => onAutoUnlockChange(!autoUnlock)}
                role="checkbox"
                type="button"
              >
                <MaterialIcon name={autoUnlock ? 'mdi:checkbox-marked-outline' : 'mdi:checkbox-blank-outline'} size={30} />
                <span>{copy(BATHROOM_FAN_COPY_KEYS.autoDisableLock)}</span>
              </button>
            )}
        </section>
      )}

      <InfoBox title={copy(BATHROOM_FAN_COPY_KEYS.hintTitle)}>
        <ul>
          <li>{copy(BATHROOM_FAN_COPY_KEYS.hintOn)}</li>
          <li>{copy(BATHROOM_FAN_COPY_KEYS.hintOff)}</li>
        </ul>
        <p>{copy(BATHROOM_FAN_COPY_KEYS.hintBody)}</p>
      </InfoBox>
    </div>
  )
}

function BathroomFanModalPreloadContent() {
  const copy = useCopy(BATHROOM_FAN_COPY_NAMESPACE)
  return (
    <BathroomFanModalView
      autoUnlock={false}
      autoUnlockAvailable={false}
      humidity={copy(BATHROOM_FAN_COPY_KEYS.states.unavailable)}
      humidityAvailable={false}
      lockAvailable={false}
      locked={false}
      minutes={BATHROOM_FAN_DEFAULT_TIMER_MINUTES}
      occupancy={copy(BATHROOM_FAN_COPY_KEYS.states.unavailable)}
      occupancyActive={false}
      occupancyAvailable={false}
      onAutoUnlockChange={NOOP}
      onCancelTimer={NOOP}
      onLockChange={NOOP}
      onMinutesChange={NOOP}
      onPowerChange={NOOP}
      onSetTimer={NOOP}
      powerAvailable={false}
      powerOn={false}
      remainingSeconds={null}
      temperatureAvailable={false}
      temperatureRange={copy(BATHROOM_FAN_COPY_KEYS.states.unavailable)}
      timerAvailable={false}
      timerPending={false}
    />
  )
}

function BathroomFanModalControllerContent({ config, fan, runtimeActive }: { config: BathroomFanConfig; fan: BathroomFanCommandController; runtimeActive: boolean }) {
  const copy = useCopy(BATHROOM_FAN_COPY_NAMESPACE)
  const occupancyEntity = useEntity(asEntityName(config.occupancyEntityId), { returnNullIfNotFound: true })
  const temperatureRangeEntity = useEntity(asEntityName(config.temperatureRangeEntityId), { returnNullIfNotFound: true })
  const temperatureColorEntity = useEntity(asEntityName(config.temperatureColorEntityId), { returnNullIfNotFound: true })
  const humidityEntity = useEntity(asEntityName(config.humidityEntityId), { returnNullIfNotFound: true })
  const deadlineEntity = useEntity(asEntityName(config.deadlineEntityId), { returnNullIfNotFound: true })
  const [minutes, setMinutes] = useState<number>(BATHROOM_FAN_DEFAULT_TIMER_MINUTES)
  const remainingSeconds = useBathroomFanTimerRemaining(deadlineEntity, fan.timerPending, runtimeActive)
  const autoUnlockChoiceKey = `${fan.locked ? 'locked' : 'unlocked'}:${fan.timerPending ? 'active' : 'idle'}`
  const [inactiveAutoUnlock, setInactiveAutoUnlock] = useState({ enabled: fan.locked, key: autoUnlockChoiceKey })
  if (inactiveAutoUnlock.key !== autoUnlockChoiceKey) {
    setInactiveAutoUnlock({ enabled: fan.locked, key: autoUnlockChoiceKey })
  }
  const inactiveAutoUnlockEnabled = inactiveAutoUnlock.key === autoUnlockChoiceKey ? inactiveAutoUnlock.enabled : fan.locked
  const displayedAutoUnlock = fan.timerPending ? fan.autoUnlock : inactiveAutoUnlockEnabled
  const occupancyAvailable = entityAvailable(occupancyEntity)
  const occupancyActive = occupancyAvailable && isOccupancyActive(occupancyEntity)
  const temperatureRange = textState(temperatureRangeEntity, copy(BATHROOM_FAN_COPY_KEYS.states.unavailable))
  const temperatureAvailable = entityAvailable(temperatureRangeEntity)
  const temperatureColor = temperatureAvailable
    ? cardColorCss(colorFromRgba(temperatureColorEntity?.state) ?? colorFromTemperature(temperatureRangeValue(temperatureRange)))
    : undefined
  const humidityValue = numericState(humidityEntity)
  const humidityAvailable = humidityValue !== null
  const humidityColor = cardColorCss(colorFromHumidity(humidityValue))

  const handleAutoUnlockChange = (enabled: boolean) => {
    if (fan.timerPending) fan.setTimerAutoUnlock(enabled)
    else setInactiveAutoUnlock({ enabled, key: autoUnlockChoiceKey })
  }

  return (
    <BathroomFanModalView
      autoUnlock={displayedAutoUnlock}
      autoUnlockAvailable={fan.timerPending ? fan.autoUnlockAvailable : true}
      humidity={humidityReading(humidityEntity, copy(BATHROOM_FAN_COPY_KEYS.states.unavailable))}
      humidityAvailable={humidityAvailable}
      humidityColor={humidityColor}
      lockAvailable={fan.lockAvailable}
      locked={fan.locked}
      minutes={minutes}
      occupancy={occupancyState(
        occupancyEntity,
        copy(BATHROOM_FAN_COPY_KEYS.states.occupied),
        copy(BATHROOM_FAN_COPY_KEYS.states.clear),
        copy(BATHROOM_FAN_COPY_KEYS.states.unavailable),
      )}
      occupancyActive={occupancyActive}
      occupancyAvailable={occupancyAvailable}
      onAutoUnlockChange={handleAutoUnlockChange}
      onCancelTimer={fan.cancelTimer}
      onLockChange={fan.setLocked}
      onMinutesChange={setMinutes}
      onPowerChange={fan.setPower}
      onSetTimer={() => fan.startTimer(minutes, displayedAutoUnlock)}
      powerAvailable={fan.powerAvailable}
      powerOn={fan.powerOn}
      remainingSeconds={remainingSeconds}
      temperatureAvailable={temperatureAvailable}
      temperatureColor={temperatureColor}
      temperatureRange={temperatureRange}
      timerAvailable={fan.timerAvailable}
      timerPending={fan.timerPending}
    />
  )
}

function StandaloneBathroomFanModalContent({ config, runtimeActive }: { config: BathroomFanConfig; runtimeActive: boolean }) {
  const fan = useBathroomFanCommand(config)
  return <BathroomFanModalControllerContent config={config} fan={fan} runtimeActive={runtimeActive} />
}

function BathroomFanModalLiveContent({ config, runtimeActive }: { config: BathroomFanConfig; runtimeActive: boolean }) {
  const sharedFan = useSharedBathroomFanCommand(config)
  return sharedFan
    ? <BathroomFanModalControllerContent config={config} fan={sharedFan} runtimeActive={runtimeActive} />
    : <StandaloneBathroomFanModalContent config={config} runtimeActive={runtimeActive} />
}

export function BathroomFanModalContent({ config, preload = false, runtimeActive = true }: BathroomFanModalContentProps) {
  if (preload) return <BathroomFanModalPreloadContent />
  return <BathroomFanModalLiveContent config={config} runtimeActive={runtimeActive} />
}

export function BathroomFanModal({ config, onClose, open, roomTitle }: { config: BathroomFanConfig; onClose: () => void; open: boolean; roomTitle: string }) {
  const copy = useCopy(BATHROOM_FAN_COPY_NAMESPACE)
  return (
    <ModalSheet contentStyle={BATHROOM_FAN_MODAL_STYLE} onClose={onClose} open={open} title={copy(BATHROOM_FAN_COPY_KEYS.title, { room: roomTitle })}>
      <BathroomFanModalContent config={config} runtimeActive={open} />
    </ModalSheet>
  )
}
