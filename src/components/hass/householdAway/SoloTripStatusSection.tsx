import { useUser } from '@hakit/core'
import { Description } from '../../core/Description'
import { FieldActionButton } from '../../core/FieldActionButton'
import { InfoBox } from '../../core/InfoBox'
import { InlineAlert } from '../../core/InlineAlert'
import { SectionHeader } from '../../core/SectionHeader'
import { HOUSEHOLD_AWAY_MODE, HOUSEHOLD_AWAY_STATE, householdAwayFullyActive } from './householdAwayContract'
import { householdAwayActiveDescription, householdAwayCommandError, householdAwayResidentLabel } from './householdAwayLabels'
import type { useHouseholdAwayController } from './useHouseholdAwayController'
import { useCopy, SOLO_TRIP_COPY_KEYS as C, SOLO_TRIP_COPY_NAMESPACE } from '../../../i18n'
import { householdResidentForHaUserId } from '../../../constants/householdResidents'

export function SoloTripActiveNotice({ controller }: {
  controller: ReturnType<typeof useHouseholdAwayController>
}) {
  const copy = useCopy(SOLO_TRIP_COPY_NAMESPACE)
  const { snapshot } = controller
  const viewer = householdResidentForHaUserId(useUser()?.id)
  const fullyActive = householdAwayFullyActive(snapshot)
  const travelerAway = snapshot.mode === HOUSEHOLD_AWAY_MODE.SOLO_TRIP
    && snapshot.traveler !== 'none'
    && snapshot.state !== HOUSEHOLD_AWAY_STATE.IDLE
    && snapshot.state !== HOUSEHOLD_AWAY_STATE.SCHEDULED
  if (!travelerAway) return null
  const travelerLabel = householdAwayResidentLabel(copy, snapshot.traveler)

  return (
    <InfoBox title={copy(C.status.activeTitle, { traveler: travelerLabel })} tone={fullyActive ? 'success' : 'neutral'}>
      {fullyActive ? householdAwayActiveDescription(copy, snapshot, viewer) : undefined}
    </InfoBox>
  )
}

/** Render only confirmed state; backend codes remain diagnostics rather than household copy. */
export function SoloTripStatusSection({
  controller,
  endNowDisabled = false,
  showConfirmedActiveNotice = true,
  showActivatingEndNow = true,
  onEndNow,
  onResolveRestore,
  restoreDisabled = false,
}: {
  controller: ReturnType<typeof useHouseholdAwayController>
  endNowDisabled?: boolean
  showConfirmedActiveNotice?: boolean
  showActivatingEndNow?: boolean
  onEndNow?: () => void
  onResolveRestore?: (resolveAction: 'keep_current' | 'restore_saved') => void
  restoreDisabled?: boolean
}) {
  const copy = useCopy(SOLO_TRIP_COPY_NAMESPACE)
  const { snapshot } = controller
  const travelerLabel = householdAwayResidentLabel(copy, snapshot.traveler)
  const actionableError = controller.errorCode
    ? <InlineAlert>{householdAwayCommandError(copy, controller.errorCode)}</InlineAlert>
    : null

  if (snapshot.state === 'restore_required') {
    return (
      <div>
        <SectionHeader title={copy(C.status.restoreRequiredTitle)} />
        <Description>{copy(C.status.restoreRequiredDescription)}</Description>
        {actionableError}
        <FieldActionButton
          disabled={restoreDisabled || controller.pending || !snapshot.available || !snapshot.commandAvailable}
          label={copy(C.status.restoreKeepCurrent)}
          onClick={() => {
            if (onResolveRestore) onResolveRestore('keep_current')
            else void controller.resolveRestore('keep_current')
          }}
        />
        <FieldActionButton
          disabled={restoreDisabled || controller.pending || !snapshot.available || !snapshot.commandAvailable}
          label={copy(C.status.restoreSaved)}
          onClick={() => {
            if (onResolveRestore) onResolveRestore('restore_saved')
            else void controller.resolveRestore('restore_saved')
          }}
        />
      </div>
    )
  }

  if (snapshot.state === 'activating') {
    return (
      <div>
        <SectionHeader title={copy(C.status.activatingTitle)} />
        <Description>{copy(C.status.activatingDescription)}</Description>
        {actionableError}
        {showActivatingEndNow && (
          <FieldActionButton
            disabled={endNowDisabled || controller.pending || !snapshot.available || !snapshot.commandAvailable}
            label={copy(C.status.endNow)}
            onClick={onEndNow ?? (() => void controller.endNow())}
            tone="danger"
          />
        )}
      </div>
    )
  }

  if (snapshot.state === 'ending') {
    return (
      <div>
        <SectionHeader title={copy(C.status.endingTitle)} />
        <Description>{copy(C.status.endingDescription)}</Description>
        {actionableError}
      </div>
    )
  }

  if (snapshot.state === 'scheduled') {
    return actionableError
  }

  if (snapshot.state === 'degraded') {
    return (
      <div>
        <SectionHeader title={copy(C.status.degradedTitle)} />
        <Description>{copy(C.status.degradedDescription)}</Description>
        {actionableError}
      </div>
    )
  }

  if (householdAwayFullyActive(snapshot)) {
    if (!showConfirmedActiveNotice) return actionableError
    return (
      <div>
        <SectionHeader title={copy(C.status.activeTitle, { traveler: travelerLabel })} />
        {actionableError}
        <SoloTripActiveNotice controller={controller} />
      </div>
    )
  }

  if (!showConfirmedActiveNotice) {
    return (
      <div>
        {actionableError}
        <Description>{copy(C.status.activeUnconfirmedDescription)}</Description>
      </div>
    )
  }

  return (
    <div>
      <SectionHeader title={copy(C.status.activeTitle, { traveler: travelerLabel })} />
      {actionableError}
      <Description>{copy(C.status.activeUnconfirmedDescription)}</Description>
    </div>
  )
}
