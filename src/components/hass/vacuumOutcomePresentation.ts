import { VACUUM_COPY_KEYS, formatDate, formatNumber, type CopyKey, type CopyValues } from '../../i18n'
import { vacuumOutcomeDayDate, type VacuumOutcomeContract, type VacuumOutcomeReason } from './vacuumOutcomes'

type VacuumCopy = (key: CopyKey<'modalVacuum'>, values?: CopyValues) => string

const OUTCOME_COPY_KEYS = VACUUM_COPY_KEYS.outcomes

export function countVacuumOutcomes(contract: VacuumOutcomeContract) {
  const completed = contract.rooms.filter((room) => room.status === 'completed').length
  const due = contract.rooms.filter((room) => room.outstanding !== null).length
  const attention = contract.rooms.filter((room) => room.status === 'failed').length
  const interrupted = contract.rooms.filter((room) => room.status === 'interrupted').length
  return { attention, completed, due, interrupted }
}

export function vacuumOutcomeDayValue(day: string) {
  return formatDate(vacuumOutcomeDayDate(day), { day: 'numeric', month: 'short', year: 'numeric' })
}

function finiteReasonNumber(reason: VacuumOutcomeReason, key: string) {
  const value = reason.data[key]
  return typeof value === 'number' && Number.isFinite(value) ? formatNumber(value) : null
}

export function vacuumOutcomeReasonValue(copy: VacuumCopy, reason: VacuumOutcomeReason, roomNames: Record<string, string>) {
  if (reason.code === 'mop.fresh_water_unavailable') {
    const state = reason.data.state
    if (state === 'missing') return copy(OUTCOME_COPY_KEYS.reasons.freshWaterMissing)
    if (state === 'unknown') return copy(OUTCOME_COPY_KEYS.reasons.freshWaterUnknown)
    if (state === 'unavailable') return copy(OUTCOME_COPY_KEYS.reasons.freshWaterUnavailable)
    return copy(OUTCOME_COPY_KEYS.reasons.unknown)
  }
  if (reason.code === 'mop.clean_water_empty') return copy(OUTCOME_COPY_KEYS.reasons.cleanWaterEmpty)
  if (reason.code === 'dock.dustbag_full_or_duct_blocked') return copy(OUTCOME_COPY_KEYS.reasons.autoEmptyBlocked)
  if (reason.code === 'occupancy.person_arrived') return copy(OUTCOME_COPY_KEYS.reasons.someoneReturned)
  if (reason.code === 'power.low_battery') return copy(OUTCOME_COPY_KEYS.reasons.lowBattery)
  if (reason.code === 'dispatch.failed') return copy(OUTCOME_COPY_KEYS.reasons.dispatchFailed)
  if (reason.code === 'navigation.stuck') return copy(OUTCOME_COPY_KEYS.reasons.stuck)
  if (reason.code === 'navigation.room_unreachable') return copy(OUTCOME_COPY_KEYS.reasons.roomUnreachable)
  if (reason.code === 'navigation.dock_unreachable') return copy(OUTCOME_COPY_KEYS.reasons.dockUnreachable)
  if (reason.code === 'execution.cleaning_not_observed') return copy(OUTCOME_COPY_KEYS.reasons.cleaningNotStarted)
  if (reason.code === 'execution.segment_not_observed') return copy(OUTCOME_COPY_KEYS.reasons.segmentNotReported)
  if (reason.code === 'operation.cancelled') return copy(OUTCOME_COPY_KEYS.reasons.roomRunCancelled)
  if (reason.code === 'mop.attachment_missing') return copy(OUTCOME_COPY_KEYS.reasons.mopAttachmentMissing)
  if (reason.code === 'mop.dirty_water_unavailable') return copy(OUTCOME_COPY_KEYS.reasons.dirtyWaterUnavailable)
  if (reason.code === 'mop.detergent_unavailable') return copy(OUTCOME_COPY_KEYS.reasons.cleaningLiquidUnavailable)
  if (reason.code === 'mop.hardware_unavailable') return copy(OUTCOME_COPY_KEYS.reasons.mopHardwareUnavailable)

  if (reason.code === 'dispatch.timeout' || reason.code === 'recovery.native_resume_timeout') {
    const seconds = finiteReasonNumber(reason, 'timeout_seconds')
    if (!seconds) {
      return copy(
        reason.code === 'dispatch.timeout'
          ? OUTCOME_COPY_KEYS.reasons.dispatchTimeoutWithoutDuration
          : OUTCOME_COPY_KEYS.reasons.resumeTimeoutWithoutDuration,
      )
    }
    return copy(
      reason.code === 'dispatch.timeout' ? OUTCOME_COPY_KEYS.reasons.dispatchTimeout : OUTCOME_COPY_KEYS.reasons.resumeTimeout,
      { seconds },
    )
  }

  if (
    reason.code === 'verification.duration_below_minimum'
    || reason.code === 'verification.estimated_dwell_below_minimum'
  ) {
    const observed = finiteReasonNumber(reason, 'observed_seconds')
    const minimum = finiteReasonNumber(reason, 'minimum_seconds')
    if (!observed || !minimum) {
      return copy(
        reason.code === 'verification.duration_below_minimum'
          ? OUTCOME_COPY_KEYS.reasons.durationBelowMinimumWithoutValues
          : OUTCOME_COPY_KEYS.reasons.estimatedRoomTimeBelowMinimumWithoutValues,
      )
    }
    return copy(
      reason.code === 'verification.duration_below_minimum'
        ? OUTCOME_COPY_KEYS.reasons.durationBelowMinimum
        : OUTCOME_COPY_KEYS.reasons.estimatedRoomTimeBelowMinimum,
      { minimum, observed },
    )
  }

  if (reason.code === 'verification.area_below_minimum') {
    return copy(OUTCOME_COPY_KEYS.reasons.areaBelowMinimumWithoutValues)
  }

  if (reason.code === 'verification.wrong_room') {
    const dominantSeconds = finiteReasonNumber(reason, 'dominant_seconds')
    const commandedSeconds = finiteReasonNumber(reason, 'commanded_seconds')
    if (!dominantSeconds || !commandedSeconds) return copy(OUTCOME_COPY_KEYS.reasons.unknown)
    const dominantId = reason.data.dominant_room_id
    const commandedId = reason.data.commanded_room_id
    const dominantRoom = typeof dominantId === 'string' ? roomNames[dominantId] : undefined
    const commandedRoom = typeof commandedId === 'string' ? roomNames[commandedId] : undefined
    return dominantRoom && commandedRoom
      ? copy(OUTCOME_COPY_KEYS.reasons.wrongRoom, { commandedRoom, commandedSeconds, dominantRoom, dominantSeconds })
      : copy(OUTCOME_COPY_KEYS.reasons.wrongRoomWithoutNames, { commandedSeconds, dominantSeconds })
  }

  return copy(OUTCOME_COPY_KEYS.reasons.unknown)
}
