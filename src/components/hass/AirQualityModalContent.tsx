import type { ReactNode } from 'react'
import { useEntity, useHass } from '@hakit/core'
import { GlassTile } from '../core/GlassTile'
import { derivedAirPurifierEntityIds } from './airQualityState'
import { asEntityName } from './entityState'
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

function isUnavailable(state: string | undefined) {
  return !state || state === 'unknown' || state === 'unavailable'
}

function selectOption(callService: CallService, entityId: string, option: string) {
  callService({ domain: 'select', service: 'select_option', target: entityId, serviceData: { option } })
}

function setFanPercentage(callService: CallService, entityId: string, percentage: number) {
  callService({ domain: 'fan', service: 'set_percentage', target: entityId, serviceData: { percentage } })
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
    <div className={styles.modeTile} data-disabled={disabled}>
      <GlassTile compact backgroundColor={active ? 'rgba(0, 150, 136, 0.58)' : undefined} icon={icon} isOff={!active} onClick={disabled ? undefined : onClick} pressed={active} title={label} tone={active ? 'air' : 'neutral'} />
    </div>
  )
}

export function AirQualityModalContent({ pm25EntityId, roomTitle }: AirQualityModalContentProps) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const { autoModeEntityId, fanEntityId, modeEntityId } = derivedAirPurifierEntityIds(pm25EntityId)
  const modeEntity = useEntity(asEntityName(modeEntityId), { returnNullIfNotFound: true })
  const autoModeEntity = useEntity(asEntityName(autoModeEntityId), { returnNullIfNotFound: true })
  const fanEntity = useEntity(asEntityName(fanEntityId), { returnNullIfNotFound: true })
  const fanModeUnavailable = isUnavailable(modeEntity?.state)
  const autoModeUnavailable = isUnavailable(autoModeEntity?.state)
  const fanUnavailable = isUnavailable(fanEntity?.state)
  const fanPercentage = typeof fanEntity?.attributes.percentage === 'number' ? fanEntity.attributes.percentage : undefined

  return (
    <div className={styles.sheet} aria-label={`${roomTitle} air purifier controls`}>
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
    </div>
  )
}