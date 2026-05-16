import type { ReactNode } from 'react'
import { useEntity, useHass } from '@hakit/core'
import { Card } from '../core/Card'
import { MaterialIcon } from '../core/Icon'
import { CLIMATE_COLOR, UNAVAILABLE_COLOR } from '../../constants/portedDashboard'
import { asEntityName, formatCompactEntityState } from './entityState'
import styles from './AirQualityModalContent.module.css'

type CallService = (params: Record<string, unknown>) => void

const FAN_MODE_OPTIONS = [
  { icon: 'mdi:fan', label: 'Manual' },
  { icon: 'mdi:weather-night', label: 'Sleep' },
  { icon: 'mdi:fan-auto', label: 'Auto' },
]

const AUTO_MODE_OPTIONS = [
  { icon: 'mdi:fan', label: 'Default' },
  { icon: 'mdi:volume-off', label: 'Quiet' },
  { icon: 'mdi:leaf', label: 'Efficient' },
]

const MANUAL_SPEED_OPTIONS = [
  { icon: 'mdi:fan-off', label: 'Off', percentage: 0 },
  { icon: 'mdi:fan-speed-1', label: 'Low', percentage: 33 },
  { icon: 'mdi:fan-speed-2', label: 'Medium', percentage: 66 },
  { icon: 'mdi:fan-speed-3', label: 'High', percentage: 100 },
]

interface AirQualityModalContentProps {
  pm25EntityId: string
  roomTitle: string
}

function derivedAirPurifierEntityIds(pm25EntityId: string) {
  const base = pm25EntityId.replace(/^sensor\./, '').replace(/_pm2_5$/, '')
  return {
    aqiEntityId: `sensor.${base}_air_quality_index`,
    autoModeEntityId: `select.${base}_auto_mode`,
    fanEntityId: `fan.${base}_levoit_purifier`,
    modeEntityId: `select.${base}_fan_mode`,
  }
}

function isUnavailable(state: string | undefined) {
  return !state || state === 'unknown' || state === 'unavailable'
}

function selectOption(callService: CallService, entityId: string, option: string) {
  callService({ domain: 'select', service: 'select_option', target: entityId, serviceData: { option } })
}

function setFanPercentage(callService: CallService, entityId: string, percentage: number) {
  callService({ domain: 'fan', service: 'set_percentage', target: entityId, serviceData: { percentage } })
}

function AirMetricCard({ entityId, icon, title }: { entityId: string; icon: string; title: string }) {
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true })
  const unavailable = isUnavailable(entity?.state)

  return (
    <Card
      color={unavailable ? UNAVAILABLE_COLOR : CLIMATE_COLOR}
      disabled={unavailable}
      icon={<MaterialIcon name={icon} size={34} />}
      muted={unavailable}
      size="compact"
      subtitle={formatCompactEntityState(entity, 'Unavailable')}
      title={title}
    />
  )
}

function ControlSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className={styles.controlSection}>
      <div className={styles.separator}>{title}</div>
      <div className={styles.modeGrid}>{children}</div>
    </section>
  )
}

function ModeButton({ active, disabled = false, icon, label, onClick }: { active: boolean; disabled?: boolean; icon: string; label: string; onClick: () => void }) {
  return (
    <button aria-pressed={active} className={styles.modeButton} data-active={active} disabled={disabled} onClick={onClick} type="button">
      <MaterialIcon name={icon} size={24} />
      <span>{label}</span>
    </button>
  )
}

export function AirQualityModalContent({ pm25EntityId, roomTitle }: AirQualityModalContentProps) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const pm25Entity = useEntity(asEntityName(pm25EntityId), { returnNullIfNotFound: true })
  const { aqiEntityId, autoModeEntityId, fanEntityId, modeEntityId } = derivedAirPurifierEntityIds(pm25EntityId)
  const modeEntity = useEntity(asEntityName(modeEntityId), { returnNullIfNotFound: true })
  const autoModeEntity = useEntity(asEntityName(autoModeEntityId), { returnNullIfNotFound: true })
  const fanEntity = useEntity(asEntityName(fanEntityId), { returnNullIfNotFound: true })
  const summary = formatCompactEntityState(pm25Entity, 'Unavailable')
  const fanModeUnavailable = isUnavailable(modeEntity?.state)
  const autoModeUnavailable = isUnavailable(autoModeEntity?.state)
  const fanUnavailable = isUnavailable(fanEntity?.state)
  const fanPercentage = typeof fanEntity?.attributes.percentage === 'number' ? fanEntity.attributes.percentage : undefined

  return (
    <div className={styles.sheet}>
      <div className={styles.header}>
        <span className={styles.headerIcon}>
          <MaterialIcon name="mdi:air-purifier" size={28} />
        </span>
        <div className={styles.titleBlock}>
          <h3>{roomTitle} Air Quality</h3>
          <p>{summary}</p>
        </div>
      </div>

      <ControlSection title="Fan Modes">
        {FAN_MODE_OPTIONS.map((option) => (
          <ModeButton
            active={modeEntity?.state === option.label}
            disabled={fanModeUnavailable}
            icon={option.icon}
            key={option.label}
            label={option.label}
            onClick={() => selectOption(callService, modeEntityId, option.label)}
          />
        ))}
      </ControlSection>

      {modeEntity?.state === 'Auto' && (
        <ControlSection title="Auto Modes">
          {AUTO_MODE_OPTIONS.map((option) => (
            <ModeButton
              active={autoModeEntity?.state === option.label}
              disabled={autoModeUnavailable}
              icon={option.icon}
              key={option.label}
              label={option.label}
              onClick={() => selectOption(callService, autoModeEntityId, option.label)}
            />
          ))}
        </ControlSection>
      )}

      {modeEntity?.state === 'Manual' && (
        <ControlSection title="Manual Modes">
          {MANUAL_SPEED_OPTIONS.map((option) => (
            <ModeButton
              active={fanPercentage === option.percentage}
              disabled={fanUnavailable}
              icon={option.icon}
              key={option.label}
              label={option.label}
              onClick={() => setFanPercentage(callService, fanEntityId, option.percentage)}
            />
          ))}
        </ControlSection>
      )}

      <div className={styles.separator}>Current Readings</div>
      <div className={styles.grid}>
        <AirMetricCard entityId={pm25EntityId} icon="mdi:air-filter" title="PM2.5" />
        <AirMetricCard entityId={aqiEntityId} icon="mdi:air-filter" title="AQI" />
        <AirMetricCard entityId={modeEntityId} icon="mdi:fan" title="Fan Mode" />
        <AirMetricCard entityId={fanEntityId} icon="mdi:air-purifier" title="Purifier" />
      </div>
    </div>
  )
}