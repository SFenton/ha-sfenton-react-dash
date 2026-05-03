import { useEntity, useHass } from '@hakit/core'
import type { CSSProperties } from 'react'
import type { EntityButtonConfig, EntityGroupConfig } from '../../constants/atAGlance'
import { asEntityName, formatCompactEntityState, formatTemperature, isActiveState } from './entityState'
import styles from './EntityGroup.module.css'

function domainOf(entityId: string) {
  return entityId.split('.', 1)[0]
}

function isToggleDomain(entityId: string) {
  return ['light', 'switch', 'fan'].includes(domainOf(entityId))
}

function EntityButton({ item }: { item: EntityButtonConfig }) {
  const entity = useEntity(asEntityName(item.entityId), { returnNullIfNotFound: true })
  const callService = useHass((state) => state.helpers.callService)
  const clickable = isToggleDomain(item.entityId)
  const state = item.entityId.startsWith('sensor.') ? formatTemperature(entity) : formatCompactEntityState(entity)

  const toggleEntity = () => {
    if (!clickable) return
    callService({ domain: 'homeassistant', service: 'toggle', target: item.entityId })
  }

  return (
    <button
      className={styles.entityButton}
      data-active={isActiveState(entity)}
      data-clickable={clickable}
      onClick={toggleEntity}
      style={{ '--entity-active': item.tone === 'climate' ? 'var(--color-climate)' : 'var(--color-light)' } as CSSProperties}
      type="button"
    >
      <span className={styles.entityTitle}>{item.title}</span>
      <span className={styles.entityState}>{state}</span>
    </button>
  )
}

export function EntityGroup({ group }: { group: EntityGroupConfig }) {
  const callService = useHass((state) => state.helpers.callService)

  const toggleGroup = () => {
    if (!group.toggleEntityId) return
    callService({ domain: 'homeassistant', service: 'toggle', target: group.toggleEntityId })
  }

  return (
    <section className={styles.group}>
      <div className={styles.groupHeader}>
        <h3>{group.title}</h3>
        {group.toggleEntityId && (
          <button className={styles.toggle} onClick={toggleGroup} type="button">
            Toggle
          </button>
        )}
      </div>
      <div className={styles.grid}>
        {group.items.map((item) => (
          <EntityButton item={item} key={item.entityId} />
        ))}
      </div>
    </section>
  )
}