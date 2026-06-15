import { useEntity, useHass } from '@hakit/core'
import { Card } from '../core/Card'
import { MaterialIcon } from '../core/Icon'
import { UNAVAILABLE_COLOR } from '../../constants/portedDashboard'
import { asEntityName, formatCompactEntityState, isActiveState } from './entityState'
import styles from './GrillModalContent.module.css'

const GRILL_COLOR = { r: 206, g: 114, b: 38 }

const GRILL_DETAILS = [
  { title: 'Probe 1', entityId: 'sensor.bear_grills_probe_probe0', icon: 'mdi:thermometer' },
  { title: 'Pellet Level', entityId: 'sensor.d8478fa2ad0a_pellet_level', icon: 'mdi:percent' },
  { title: 'Keep Warm', entityId: 'switch.d8478fa2ad0a_keep_warm_enabled', icon: 'mdi:fire' },
  { title: 'Super Smoke', entityId: 'switch.d8478fa2ad0a_super_smoke_enabled', icon: 'mdi:smoke' },
]

function isUnavailable(state: string | undefined) {
  return !state || state === 'unknown' || state === 'unavailable'
}

function GrillMetricCard({ entityId, icon, title }: { entityId: string; icon: string; title: string }) {
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true })
  const callService = useHass((state) => state.helpers.callService) as unknown as (params: Record<string, unknown>) => void
  const unavailable = isUnavailable(entity?.state)
  const muted = !unavailable && !isActiveState(entity)
  const clickable = entityId.startsWith('switch.') && !unavailable

  return (
    <Card
      ariaLabel={`${title} ${formatCompactEntityState(entity, 'Unavailable')}`}
      color={unavailable ? UNAVAILABLE_COLOR : GRILL_COLOR}
      disabled={unavailable}
      icon={<MaterialIcon name={icon} size={34} />}
      muted={unavailable || muted}
      onClick={clickable ? () => callService({ domain: 'homeassistant', service: 'toggle', target: entityId }) : undefined}
      pressed={clickable ? isActiveState(entity) : undefined}
      size="compact"
      subtitle={formatCompactEntityState(entity, 'Unavailable')}
      title={title}
    />
  )
}

export function GrillModalContent() {
  const grill = useEntity(asEntityName('sensor.d8478fa2ad0a_grill_state'), { returnNullIfNotFound: true })
  const state = formatCompactEntityState(grill, 'Unavailable')

  return (
    <div className={styles.sheet}>
      <div className={styles.header}>
        <span className={styles.headerIcon}>
          <MaterialIcon name="mdi:grill" size={28} />
        </span>
        <div className={styles.titleBlock}>
          <h3>Bear Grills</h3>
          <p>{state}</p>
        </div>
      </div>
      <div className={styles.grid}>
        {GRILL_DETAILS.map((detail) => <GrillMetricCard entityId={detail.entityId} icon={detail.icon} key={detail.entityId} title={detail.title} />)}
      </div>
    </div>
  )
}