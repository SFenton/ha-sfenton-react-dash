import { useEntity, useHass } from '@hakit/core'
import type { ReactNode } from 'react'
import { GlassTile } from '../core/GlassTile'
import { asEntityName, formatCompactEntityState, isActiveState } from './entityState'
import styles from './HumidifierModalContent.module.css'

type CallService = (params: Record<string, unknown>) => void

const TARGET_STEP = 5

function numericAttribute(entity: ReturnType<typeof useEntity> | null, key: string) {
  const value = entity?.attributes[key]
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function modeList(entity: ReturnType<typeof useEntity> | null) {
  const modes = entity?.attributes.available_modes
  return Array.isArray(modes) ? modes.filter((mode): mode is string => typeof mode === 'string' && mode.trim().length > 0) : []
}

function formatHumidity(value: number | null) {
  return value === null ? 'Unavailable' : `${Math.round(value)}%`
}

function formatMode(mode: string) {
  return mode.split(/[_\s-]+/).filter(Boolean).map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join(' ')
}

function clampHumidity(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function setHumidity(callService: CallService, entityId: string, humidity: number) {
  callService({ domain: 'humidifier', service: 'set_humidity', target: entityId, serviceData: { humidity } })
}

function setMode(callService: CallService, entityId: string, mode: string) {
  callService({ domain: 'humidifier', service: 'set_mode', target: entityId, serviceData: { mode } })
}

function ControlSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className={styles.controlSection}>
      <div className={styles.separator}>{title}</div>
      {children}
    </section>
  )
}

function ModeTile({ active, disabled = false, icon, label, onClick, subtitle }: { active: boolean; disabled?: boolean; icon: string; label: string; onClick: () => void; subtitle?: string }) {
  return (
    <div className={styles.modeTile} data-disabled={disabled}>
      <GlassTile compact backgroundColor={active ? 'rgba(0, 150, 136, 0.58)' : undefined} icon={icon} isOff={!active} onClick={disabled ? undefined : onClick} pressed={active} subtitle={subtitle} title={label} tone={active ? 'climate' : 'neutral'} />
    </div>
  )
}

export function HumidifierModalContent({ entityId, roomTitle }: { entityId: string; roomTitle: string }) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true })
  const unavailable = !entity || entity.state === 'unknown' || entity.state === 'unavailable'
  const active = isActiveState(entity)
  const currentHumidity = numericAttribute(entity, 'current_humidity')
  const targetHumidity = numericAttribute(entity, 'humidity')
  const minHumidity = numericAttribute(entity, 'min_humidity') ?? 0
  const maxHumidity = numericAttribute(entity, 'max_humidity') ?? 100
  const currentMode = typeof entity?.attributes.mode === 'string' ? entity.attributes.mode : undefined
  const modes = modeList(entity)
  const canSetHumidity = !unavailable && targetHumidity !== null
  const lowerTarget = targetHumidity === null ? null : clampHumidity(targetHumidity - TARGET_STEP, minHumidity, maxHumidity)
  const higherTarget = targetHumidity === null ? null : clampHumidity(targetHumidity + TARGET_STEP, minHumidity, maxHumidity)

  return (
    <div aria-label={`${roomTitle} humidifier controls`} className={styles.sheet}>
      <div className={styles.summaryGrid}>
        <GlassTile icon="mdi:water-percent" isOff={unavailable} subtitle={formatHumidity(currentHumidity)} title="Current Humidity" tone="climate" />
        <GlassTile icon="mdi:gauge" isOff={unavailable} subtitle={formatHumidity(targetHumidity)} title="Target Humidity" tone="climate" />
        <div className={styles.wideTile}>
          <GlassTile
            icon="mdi:air-humidifier"
            isOff={!active || unavailable}
            onClick={unavailable ? undefined : () => callService({ domain: 'humidifier', service: 'toggle', target: entityId })}
            pressed={!unavailable ? active : undefined}
            subtitle={formatCompactEntityState(entity, 'Unavailable')}
            title={active ? 'Turn Off' : 'Turn On'}
            tone="climate"
          />
        </div>
      </div>

      <ControlSection title="Target Humidity">
        <div className={styles.modeGrid}>
          <ModeTile active={false} disabled={!canSetHumidity || lowerTarget === targetHumidity} icon="mdi:minus" label="Decrease Target" onClick={() => lowerTarget !== null && setHumidity(callService, entityId, lowerTarget)} subtitle={formatHumidity(lowerTarget)} />
          <ModeTile active={false} disabled={!canSetHumidity || higherTarget === targetHumidity} icon="mdi:plus" label="Increase Target" onClick={() => higherTarget !== null && setHumidity(callService, entityId, higherTarget)} subtitle={formatHumidity(higherTarget)} />
        </div>
      </ControlSection>

      {modes.length > 0 && (
        <ControlSection title="Mode">
          <div className={styles.modeGrid}>
            {modes.map((mode) => (
              <ModeTile active={currentMode === mode} disabled={unavailable} icon={mode === 'auto' ? 'mdi:fan-auto' : 'mdi:water'} key={mode} label={formatMode(mode)} onClick={() => setMode(callService, entityId, mode)} />
            ))}
          </div>
        </ControlSection>
      )}
    </div>
  )
}
