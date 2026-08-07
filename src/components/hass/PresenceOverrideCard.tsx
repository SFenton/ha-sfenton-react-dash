import { useEntity, useHass } from '@hakit/core'
import { Card, type CardColor } from '../core/Card'
import { DynamicGrid } from '../core/DynamicGrid'
import { MaterialIcon } from '../core/Icon'
import { ScheduleListRow } from '../core/ScheduleFlow'
import type { PresenceOverrideConfig } from '../../constants/portedDashboard'
import { useOptimisticState } from '../../hooks/useOptimisticState'
import { asEntityName } from './entityState'
import { PRESENCE_OVERRIDE_STATES, presenceOverrideDisplayState, presenceOverrideServiceState, type PresenceOverrideDisplayState, type PresenceOverrideState } from './presenceOverrideState'
import styles from './PresenceOverrideCard.module.css'

interface PresenceStatePresentation {
  color: CardColor
  description: string
  icon: string
  label: string
  summaryLabel: string
}

const PRESENCE_STATE_PRESENTATION: Record<PresenceOverrideDisplayState, PresenceStatePresentation> = {
  enabled: {
    color: { r: 67, g: 160, b: 71 },
    description: 'Presence and occupancy can control the lights.',
    icon: 'mdi:lightbulb-auto',
    label: 'Enable Presence-Based Lighting',
    summaryLabel: 'Enabled',
  },
  off: {
    color: { r: 84, g: 110, b: 122 },
    description: 'Presence-Based Lighting is disabled for this room.',
    icon: 'mdi:lightbulb-off',
    label: 'Disable Presence-Based Lighting',
    summaryLabel: 'Disabled',
  },
  paused: {
    color: { r: 230, g: 154, b: 37 },
    description: 'Lights stay in their current state until explicitly resumed.',
    icon: 'mdi:pause-circle',
    label: 'Paused',
    summaryLabel: 'Paused',
  },
  quieted: {
    color: { r: 117, g: 91, b: 180 },
    description: 'Stay dark, then rearm after the room clears.',
    icon: 'mdi:volume-mute',
    label: 'Quieted',
    summaryLabel: 'Quieted',
  },
  unavailable: {
    color: { r: 84, g: 110, b: 122 },
    description: 'Home Assistant state is unavailable.',
    icon: 'mdi:alert-circle',
    label: 'Unavailable',
    summaryLabel: 'Unavailable',
  },
}

export function PresenceOverrideCard({ item, onSelect }: { item: PresenceOverrideConfig; onSelect: (item: PresenceOverrideConfig) => void }) {
  const entity = useEntity(asEntityName(item.entityId), { returnNullIfNotFound: true })
  const displayState = presenceOverrideDisplayState(entity)
  const presentation = PRESENCE_STATE_PRESENTATION[displayState]
  const disabled = displayState === 'unavailable'
  return (
    <div className={styles.detailMarker} data-modal-detail-trigger={item.entityId}>
      <Card
        ariaLabel={`${item.title} ${presentation.summaryLabel}`}
        color={presentation.color}
        disabled={disabled}
        disclosure
        icon={<MaterialIcon name="mdi:lightbulb-auto" size={38} />}
        muted={disabled}
        onClick={() => onSelect(item)}
        size="admin-modal"
        subtitle={presentation.summaryLabel}
        title={item.title}
      />
    </div>
  )
}

export function PresenceOverrideDetailPage({ item }: { item: PresenceOverrideConfig }) {
  const entity = useEntity(asEntityName(item.entityId), { returnNullIfNotFound: true })
  const callService = useHass((state) => state.helpers.callService) as unknown as (params: Record<string, unknown>) => void
  const liveState = presenceOverrideDisplayState(entity)
  const [displayState, commitDisplayState] = useOptimisticState(liveState, { clearOn: 'confirmation' })
  const disabled = displayState === 'unavailable'
  const selectState = (nextState: PresenceOverrideState) => {
    if (disabled) return
    commitDisplayState(nextState)
    callService({
      domain: 'presence_based_lighting',
      service: 'set_automation_state',
      target: item.entityId,
      serviceData: { state: presenceOverrideServiceState(nextState) },
    })
  }
  return (
    <section aria-label={`${item.title} presence lighting controls`} className={styles.detailPage}>
      <DynamicGrid ariaLabel={`${item.title} presence lighting states`} className={styles.stateGrid} columns={2} gap={8}>
        {PRESENCE_OVERRIDE_STATES.map((state, index) => {
          const presentation = PRESENCE_STATE_PRESENTATION[state]
          const selected = displayState === state
          return (
            <ScheduleListRow
              accessibleLabel={`Set ${item.title} presence lighting to ${presentation.label}`}
              active={selected}
              autoFocus={index === 0}
              disabled={disabled}
              disclosure={false}
              focusKey={state}
              icon={presentation.icon}
              iconSurface={false}
              key={state}
              onClick={() => selectState(state)}
              primary={presentation.label}
              secondary={presentation.description}
              wrapText
            />
          )
        })}
      </DynamicGrid>
    </section>
  )
}
