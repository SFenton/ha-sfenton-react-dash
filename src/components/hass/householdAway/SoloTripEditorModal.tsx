import { Description } from '../../core/Description'
import { FieldActionButton } from '../../core/FieldActionButton'
import { InlineAlert } from '../../core/InlineAlert'
import { ModalSheet, type ModalCenteredGeometry } from '../../core/ModalSheet'
import { NativePickerField } from '../../core/NativePickerField'
import scheduleFormStyles from '../../core/ScheduleConfirmationForm.module.css'
import {
  HOUSEHOLD_RESIDENT,
  validateSoloTripDraft,
  type SoloTripDraft,
} from './householdAwayContract'
import { householdAwayCommandError } from './householdAwayLabels'
import type { useHouseholdAwayController } from './useHouseholdAwayController'
import { useCopy, SOLO_TRIP_COPY_KEYS as C, SOLO_TRIP_COPY_NAMESPACE } from '../../../i18n'

const SOLO_TRIP_EDITOR_CENTERED_GEOMETRY = {
  blockPolicy: 'fixed',
  blockSize: '620px',
  id: 'solo-trip-editor',
  inlineSize: '560px',
} satisfies ModalCenteredGeometry

export function SoloTripEditorModal({
  availabilityMessage = null,
  busy = false,
  controller,
  draft,
  onClose,
  onConfirm,
  onDraftChange,
  open,
  selectedTraveler,
}: {
  availabilityMessage?: string | null
  busy?: boolean
  controller: ReturnType<typeof useHouseholdAwayController>
  draft: SoloTripDraft
  onClose: () => void
  onConfirm: () => void
  onDraftChange: (draft: SoloTripDraft) => void
  open: boolean
  selectedTraveler: typeof HOUSEHOLD_RESIDENT.STEPH | typeof HOUSEHOLD_RESIDENT.STEPHEN | null
}) {
  const copy = useCopy(SOLO_TRIP_COPY_NAMESPACE)
  const validation = validateSoloTripDraft({ ...draft, traveler: selectedTraveler })
  const commandError = !availabilityMessage && controller.errorCode
    ? householdAwayCommandError(copy, controller.errorCode)
    : null
  const disabled = busy || controller.pending

  return (
    <ModalSheet
      centeredGeometry={SOLO_TRIP_EDITOR_CENTERED_GEOMETRY}
      onClose={onClose}
      open={open}
      scrollResetKey={open ? 'open' : 'closed'}
      size="form"
      title={copy(C.editor.title)}
    >
      <div className={scheduleFormStyles.body} data-schedule-confirmation-form="true">
        <Description>{copy(C.editor.description)}</Description>
        <div className={scheduleFormStyles.fields} data-schedule-confirmation-fields="true">
          <NativePickerField className={scheduleFormStyles.picker} label={copy(C.editor.startDate)} onChange={(value) => onDraftChange({ ...draft, startDate: value })} type="date" value={draft.startDate} />
          <NativePickerField className={scheduleFormStyles.picker} label={copy(C.editor.startTime)} onChange={(value) => onDraftChange({ ...draft, startTime: value })} type="time" value={draft.startTime} />
          <NativePickerField className={scheduleFormStyles.picker} label={copy(C.editor.endDate)} onChange={(value) => onDraftChange({ ...draft, endDate: value })} type="date" value={draft.endDate} />
          <NativePickerField className={scheduleFormStyles.picker} label={copy(C.editor.endTime)} onChange={(value) => onDraftChange({ ...draft, endTime: value })} type="time" value={draft.endTime} />
        </div>
        {!selectedTraveler && <InlineAlert>{copy(C.errors.travelerRequired)}</InlineAlert>}
        {!validation.startInFuture && <InlineAlert>{copy(C.editor.validation.startInFuture)}</InlineAlert>}
        {validation.startInFuture && !validation.endAfterStart && <InlineAlert>{copy(C.editor.validation.endAfterStart)}</InlineAlert>}
        {availabilityMessage && <InlineAlert>{availabilityMessage}</InlineAlert>}
        {commandError && <InlineAlert>{commandError}</InlineAlert>}
        <FieldActionButton data-schedule-confirmation-action="true" disabled={disabled || !validation.valid || !selectedTraveler} label={copy(C.editor.confirm)} onClick={onConfirm} variant="primary" />
      </div>
    </ModalSheet>
  )
}
