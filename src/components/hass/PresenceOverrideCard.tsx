import { useEntity, useHass } from '@hakit/core'
import { useState } from 'react'
import { Card, type CardColor } from '../core/Card'
import { MaterialIcon } from '../core/Icon'
import { OptionPickerDialog, type PickerOption } from '../core/OptionPickerDialog'
import type { ModalSheetStyle } from '../core/ModalSheet'
import type { PresenceOverrideConfig } from '../../constants/portedDashboard'
import { useOptimisticState } from '../../hooks/useOptimisticState'
import { asEntityName } from './entityState'
import { isPresenceOverrideState, PRESENCE_OVERRIDE_STATES, presenceOverrideDisplayState, type PresenceOverrideDisplayState } from './presenceOverrideState'

interface PresenceStatePresentation {
  activeBackground: string
  color: CardColor
  icon: string
  label: string
}

const PRESENCE_OVERRIDE_PICKER_STYLE: ModalSheetStyle = {
  '--modal-desktop-height': 'auto',
  '--modal-desktop-max-width': '500px',
  '--modal-desktop-width': '500px',
}

const PRESENCE_STATE_PRESENTATION: Record<PresenceOverrideDisplayState, PresenceStatePresentation> = {
  on: {
    activeBackground: 'rgba(67, 160, 71, 0.72)',
    color: { r: 67, g: 160, b: 71 },
    icon: 'mdi:lightbulb-auto',
    label: 'On',
  },
  off: {
    activeBackground: 'rgba(84, 110, 122, 0.78)',
    color: { r: 84, g: 110, b: 122 },
    icon: 'mdi:lightbulb-off',
    label: 'Off',
  },
  paused: {
    activeBackground: 'rgba(230, 154, 37, 0.76)',
    color: { r: 230, g: 154, b: 37 },
    icon: 'mdi:pause-circle',
    label: 'Paused',
  },
  quieted: {
    activeBackground: 'rgba(117, 91, 180, 0.76)',
    color: { r: 117, g: 91, b: 180 },
    icon: 'mdi:volume-mute',
    label: 'Quieted',
  },
  active: {
    activeBackground: 'rgba(30, 136, 229, 0.72)',
    color: { r: 30, g: 136, b: 229 },
    icon: 'mdi:motion-sensor',
    label: 'Active',
  },
  unavailable: {
    activeBackground: 'rgba(84, 110, 122, 0.58)',
    color: { r: 84, g: 110, b: 122 },
    icon: 'mdi:alert-circle',
    label: 'Unavailable',
  },
}

const PRESENCE_OVERRIDE_OPTIONS: PickerOption[] = PRESENCE_OVERRIDE_STATES.map((state) => ({
  activeBackground: PRESENCE_STATE_PRESENTATION[state].activeBackground,
  icon: PRESENCE_STATE_PRESENTATION[state].icon,
  label: PRESENCE_STATE_PRESENTATION[state].label,
  value: state,
}))

export function PresenceOverrideCard({ item }: { item: PresenceOverrideConfig }) {
  const entity = useEntity(asEntityName(item.entityId), { returnNullIfNotFound: true })
  const callService = useHass((state) => state.helpers.callService) as unknown as (params: Record<string, unknown>) => void
  const [pickerOpen, setPickerOpen] = useState(false)
  const liveState = presenceOverrideDisplayState(entity)
  const [displayState, commitDisplayState] = useOptimisticState(liveState, { clearOn: 'confirmation' })
  const presentation = PRESENCE_STATE_PRESENTATION[displayState]
  const disabled = displayState === 'unavailable'

  const selectState = (nextState: string) => {
    if (!isPresenceOverrideState(nextState) || disabled) {
      setPickerOpen(false)
      return
    }

    commitDisplayState(nextState)
    callService({
      domain: 'presence_based_lighting',
      service: 'set_automation_state',
      target: item.entityId,
      serviceData: { state: nextState },
    })
    setPickerOpen(false)
  }

  return (
    <>
      <Card
        ariaLabel={`${item.title} ${presentation.label}`}
        color={presentation.color}
        disabled={disabled}
        disclosure
        icon={<MaterialIcon name="mdi:lightbulb-auto" size={38} />}
        muted={disabled}
        onClick={() => setPickerOpen(true)}
        size="admin-modal"
        subtitle={presentation.label}
        title={item.title}
      />
      <OptionPickerDialog
        icon="mdi:lightbulb-auto"
        onClose={() => setPickerOpen(false)}
        onSelect={selectState}
        open={pickerOpen}
        options={PRESENCE_OVERRIDE_OPTIONS}
        presentation="sheet"
        sheetLayout="compact-grid"
        sheetStyle={PRESENCE_OVERRIDE_PICKER_STYLE}
        title={`${item.title} Presence Lighting`}
        value={displayState}
      />
    </>
  )
}
