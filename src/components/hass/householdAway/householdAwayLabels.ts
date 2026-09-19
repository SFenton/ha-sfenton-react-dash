import { SOLO_TRIP_COPY_KEYS as C, type useCopy } from '../../../i18n'
import { HOUSEHOLD_RESIDENT, type HouseholdAwayBedScope, type HouseholdAwaySnapshot, type HouseholdResident } from './householdAwayContract'
import type { HouseholdAwayControllerErrorCode } from './useHouseholdAwayController'

export function householdAwayResidentLabel(
  copy: ReturnType<typeof useCopy>,
  resident: string,
) {
  if (resident === HOUSEHOLD_RESIDENT.STEPHEN) return copy(C.editor.travelerStephen)
  if (resident === HOUSEHOLD_RESIDENT.STEPH) return copy(C.editor.travelerSteph)
  return ''
}

export function householdAwayActiveDescription(
  copy: ReturnType<typeof useCopy>,
  snapshot: HouseholdAwaySnapshot,
  viewer: HouseholdResident | undefined,
) {
  const traveler = householdAwayResidentLabel(copy, snapshot.traveler)
  const homeResident = householdAwayResidentLabel(copy, snapshot.homeResident)
  return viewer === snapshot.traveler && homeResident
    ? copy(C.status.activeDescriptionTraveler, { homeResident })
    : copy(C.status.activeDescription, { traveler })
}

export function householdAwayBedDescription(
  copy: ReturnType<typeof useCopy>,
  scope: HouseholdAwayBedScope,
  viewer: HouseholdResident | undefined,
) {
  const traveler = householdAwayResidentLabel(copy, scope.traveler)
  const homeResident = householdAwayResidentLabel(copy, scope.homeResident)
  if (scope.controlsWholeBed) {
    return viewer === scope.traveler && homeResident
      ? copy(C.bed.wholeBedDescriptionTraveler, { homeResident })
      : copy(C.bed.wholeBedDescription, { traveler })
  }
  if (viewer === scope.traveler && homeResident) {
    return copy(C.bed.awayReadOnlyDescriptionTraveler, { homeResident })
  }
  if (viewer === scope.homeResident && traveler) {
    return copy(C.bed.awayReadOnlyDescriptionHome, { traveler })
  }
  return copy(C.bed.awayReadOnlyDescription, { homeResident })
}

export function householdAwayCommandError(
  copy: ReturnType<typeof useCopy>,
  errorCode: HouseholdAwayControllerErrorCode | null,
) {
  if (!errorCode) return null
  return errorCode === 'unknown_outcome'
    ? copy(C.errors.unknownOutcome)
    : copy(C.errors.commandFailed)
}
