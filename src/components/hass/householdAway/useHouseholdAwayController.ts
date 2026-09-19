import { useEntity, useHass } from '@hakit/core'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { HOUSEHOLD_AWAY_STATUS_ENTITY_ID } from '../../../constants/householdAway'
import { asEntityName } from '../entityState'
import {
  householdAwayServiceCall, householdAwaySnapshotFromEntity,
  type HouseholdAwayCommandOperation, type HouseholdAwaySnapshot, type SleepypodSchedulePayload,
  type HouseholdResident, type SleepypodAlarmRow, type SleepypodSide,
} from './householdAwayContract'

const COMMAND_TIMEOUT_MS = 10_000
const COMMAND_TIMEOUT = Symbol('household-away-command-timeout')

type CallService = (request: Record<string, unknown>) => unknown
export type HouseholdAwayControllerErrorCode = 'transport' | 'unavailable' | 'unknown_outcome' | (string & {})

export type HouseholdAwayCommandResult =
  | { acknowledgedRevision: number | null; status: 'accepted' }
  | { errorCode: HouseholdAwayControllerErrorCode; status: 'rejected' }
  | { reason: 'timeout'; status: 'unknown' }

function responseFrom(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  const envelope = value as Record<string, unknown>
  return envelope.response && typeof envelope.response === 'object'
    ? envelope.response as Record<string, unknown> : envelope
}

/** Thin controller around the native queued script; mirrors useWakeLightController's
 * response-checked send pattern but without per-item optimistic queues, since exactly one plan exists. */
export function useHouseholdAwayController() {
  const callService = useHass(state => state.helpers.callService) as unknown as CallService
  const entity = useEntity(asEntityName(HOUSEHOLD_AWAY_STATUS_ENTITY_ID), { returnNullIfNotFound: true })
  const entityState = entity?.state
  const entityAttributes = entity?.attributes
  const snapshot = useMemo(() => householdAwaySnapshotFromEntity(
    entityState === undefined ? null : { state: entityState, attributes: entityAttributes },
  ), [entityAttributes, entityState])
  const [pending, setPending] = useState(false)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const pendingRef = useRef(false)
  const snapshotRef = useRef(snapshot)
  const revisionRef = useRef(snapshot.revision)
  useLayoutEffect(() => {
    snapshotRef.current = snapshot
    revisionRef.current = Math.max(revisionRef.current, snapshot.revision)
  }, [snapshot])

  const send = useCallback(async (command: HouseholdAwayCommandOperation): Promise<HouseholdAwayCommandResult> => {
    if (pendingRef.current) return { errorCode: 'transport', status: 'rejected' }
    const currentSnapshot = snapshotRef.current
    if (!currentSnapshot.available || !currentSnapshot.commandAvailable) {
      setErrorCode('unavailable')
      return { errorCode: 'unavailable', status: 'rejected' }
    }
    pendingRef.current = true
    setPending(true)
    setErrorCode(null)
    let timeout: number | undefined
    try {
      const request = householdAwayServiceCall({ ...currentSnapshot, revision: revisionRef.current }, command)
      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeout = window.setTimeout(
          () => reject(COMMAND_TIMEOUT),
          COMMAND_TIMEOUT_MS,
        )
      })
      const response = responseFrom(await Promise.race([
        Promise.resolve(callService(request)),
        timeoutPromise,
      ]))
      if (!response || (typeof response.status !== 'string' && typeof response.outcome !== 'string')) throw new Error('transport')
      const acknowledgedRevision = Number.isInteger(response.revision) ? Number(response.revision) : null
      if (acknowledgedRevision !== null) revisionRef.current = Math.max(revisionRef.current, acknowledgedRevision)
      const outcome = typeof response.status === 'string' ? response.status : response.outcome
      if (outcome === 'accepted' || outcome === 'no_change') {
        return { acknowledgedRevision, status: 'accepted' }
      }
      const errorCode = (typeof response.error_code === 'string'
        ? response.error_code
        : typeof response.error === 'string'
          ? response.error
          : outcome) as HouseholdAwayControllerErrorCode
      setErrorCode(errorCode)
      return { errorCode, status: 'rejected' }
    } catch (error) {
      if (error === COMMAND_TIMEOUT) {
        setErrorCode('unknown_outcome')
        return { reason: 'timeout', status: 'unknown' }
      }
      setErrorCode('transport')
      return { errorCode: 'transport', status: 'rejected' }
    } finally {
      if (timeout !== undefined) window.clearTimeout(timeout)
      pendingRef.current = false
      setPending(false)
    }
  }, [callService])

  const cancel = useCallback(() => send({ operation: 'cancel' }), [send])
  const clearError = useCallback(() => setErrorCode(null), [])
  const endNow = useCallback(() => send({ operation: 'end_now' }), [send])
  const resolveRestore = useCallback(
    (resolveAction: 'keep_current' | 'restore_saved') => send({ operation: 'resolve_restore', resolveAction }),
    [send],
  )
  const scheduleSoloTrip = useCallback(
    (input: { endDate: string; endTime: string; startDate: string; startTime: string; traveler: HouseholdResident }) => send({
      operation: 'schedule', mode: 'solo_trip', traveler: input.traveler,
      startDate: input.startDate, startTime: input.startTime, endDate: input.endDate, endTime: input.endTime,
    }),
    [send],
  )
  const sendSleepypodCommand = useCallback((command:
    | { action: 'set_power'; side: SleepypodSide; enabled: boolean }
    | { action: 'set_outside_level' | 'set_tonight_level'; side: SleepypodSide; level: number }
    | { action: 'set_stage_level'; side: SleepypodSide; level: number; phase: 'asleep' | 'bedtime' | 'dawn' }
    | { action: 'set_schedule'; side?: SleepypodSide; schedule: SleepypodSchedulePayload }
    | { action: 'replace_alarms'; side: SleepypodSide; alarmRows: SleepypodAlarmRow[] }
    | { action: 'snooze_alarm' | 'stop_alarm'; side: SleepypodSide }
  ) => send({ operation: 'sleepypod_command', ...command }), [send])
  const sendSleepypodSchedule = useCallback(
    (schedule: SleepypodSchedulePayload, side?: SleepypodSide) => send({
      operation: 'sleepypod_command', action: 'set_schedule', schedule, ...(side ? { side } : {}),
    }),
    [send],
  )
  const updateEnd = useCallback(
    (endDate: string, endTime: string) => send({ operation: 'update_end', endDate, endTime }),
    [send],
  )

  return {
    cancel,
    clearError,
    endNow,
    errorCode,
    pending,
    resolveRestore,
    scheduleSoloTrip,
    sendSleepypodCommand,
    sendSleepypodSchedule,
    snapshot,
    updateEnd,
  }
}

export type HouseholdAwayController = ReturnType<typeof useHouseholdAwayController>
export type { HouseholdAwaySnapshot }
