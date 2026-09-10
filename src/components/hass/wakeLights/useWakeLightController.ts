import { useEntity, useHass, useUser } from '@hakit/core'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { WakeLightConfig } from '../../../constants/wakeLights'
import { useOptimisticState } from '../../../hooks/useOptimisticState'
import { useCopy, WAKE_LIGHT_COPY_KEYS as C, WAKE_LIGHT_COPY_NAMESPACE } from '../../../i18n'
import { asEntityName } from '../entityState'
import {
  wakeLightServiceCall, wakeLightSnapshotFromEntity,
  WAKE_LIGHT_FAILURE_KIND,
  type WakeLightAlarm, type WakeLightCommandOperation, type WakeLightDefaults,
} from './wakeLightContract'

const REVERT_MS = 8000
const COMMAND_TIMEOUT_MS = 10_000
type CallService = (request: Record<string, unknown>) => unknown

function useStableValue<T>(value: T): T {
  const [previous, setPrevious] = useState(value)
  if (JSON.stringify(previous) !== JSON.stringify(value)) {
    setPrevious(value)
    return value
  }
  return previous
}

function useTimedIntents<K, V>(revertMs: number) {
  const [intents, setIntents] = useState(new Map<K, V>())
  const timers = useRef(new Map<K, number>())
  const clear = useCallback((key: K) => {
    const timer = timers.current.get(key)
    if (timer !== undefined) window.clearTimeout(timer)
    timers.current.delete(key)
    setIntents(current => {
      if (!current.has(key)) return current
      const next = new Map(current)
      next.delete(key)
      return next
    })
  }, [])
  const commit = useCallback((key: K, value: V) => {
    const timer = timers.current.get(key)
    if (timer !== undefined) window.clearTimeout(timer)
    setIntents(current => new Map(current).set(key, value))
    timers.current.set(key, window.setTimeout(() => clear(key), revertMs))
  }, [clear, revertMs])
  const reset = useCallback(() => {
    for (const timer of timers.current.values()) window.clearTimeout(timer)
    timers.current.clear()
    setIntents(new Map())
  }, [])
  useEffect(() => () => {
    for (const timer of timers.current.values()) window.clearTimeout(timer)
    timers.current.clear()
  }, [])
  return [intents, commit, clear, reset] as const
}

function responseFrom(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  const envelope = value as Record<string, unknown>
  return envelope.response && typeof envelope.response === 'object'
    ? envelope.response as Record<string, unknown> : envelope
}

function commandPendingKeys(command: WakeLightCommandOperation) {
  if (command.operation === 'end_episode') return ['end_episode']
  if (command.operation === 'upsert_alarm') return [`alarm:${command.alarm.id}`]
  if (command.operation === 'delete_alarm') return [`alarm:${command.alarmId}`]
  if (command.operation === 'link_alarm') return command.linkKeys.map(key => `link:${key}`)
  if (command.operation === 'update_defaults') return ['defaults']
  return [`occurrence:${command.occurrenceId}`]
}

export function useWakeLightController(config: WakeLightConfig) {
  const copy = useCopy(WAKE_LIGHT_COPY_NAMESPACE)
  const callService = useHass(state => state.helpers.callService) as unknown as CallService
  const entity = useEntity(asEntityName(config.statusEntityId), { returnNullIfNotFound: true })
  const user = useUser() as { is_admin?: boolean } | null
  const entityState = entity?.state
  const entityAttributes = entity?.attributes
  const parsed = useMemo(() => wakeLightSnapshotFromEntity(
    config, entityState === undefined ? null : { state: entityState, attributes: entityAttributes },
  ), [config, entityAttributes, entityState])
  const liveAlarms = useStableValue(parsed.alarms)
  const liveDefaults = useStableValue(parsed.defaults)
  const liveLinks = useStableValue(parsed.alarmLinks)
  const liveOccurrences = useStableValue(parsed.activeOccurrences)
  const [alarmIntents, commitAlarmIntent, clearAlarmIntent, resetAlarmIntents] = useTimedIntents<string, WakeLightAlarm | null>(REVERT_MS)
  const alarms = useMemo(() => {
    const next = liveAlarms.flatMap(alarm => {
      if (!alarmIntents.has(alarm.id)) return [alarm]
      const intent = alarmIntents.get(alarm.id)
      return intent === null || intent === undefined ? [] : [intent]
    })
    for (const [alarmId, intent] of alarmIntents) {
      if (intent !== null && !liveAlarms.some(alarm => alarm.id === alarmId)) next.push(intent)
    }
    return next
  }, [alarmIntents, liveAlarms])
  const [defaults, commitDefaults, resetDefaults] = useOptimisticState(liveDefaults, { revertMs: REVERT_MS })
  const [linkIntents, commitLinkIntent, clearLinkIntent, resetLinkIntents] = useTimedIntents<string, boolean>(REVERT_MS)
  const alarmLinks = useMemo(() => {
    const next = { ...liveLinks }
    for (const [linkKey, linked] of linkIntents) {
      if (linked) delete next[linkKey]
      else next[linkKey] = false
    }
    return next
  }, [linkIntents, liveLinks])
  const [activeOccurrences, commitOccurrences, resetOccurrences] = useOptimisticState(liveOccurrences, { revertMs: REVERT_MS })
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [requiresAlarmReload, setRequiresAlarmReload] = useState(false)
  const [pending, setPending] = useState<string[]>([])
  const pendingRef = useRef(new Set<string>())
  const revisionRef = useRef(parsed.revision)
  const errorEpoch = useRef(0)
  const activeIntent = useRef(0)
  const profileRef = useRef(parsed.profileId)
  const mounted = useRef(true)
  const cancelRequests = useRef(new Set<() => void>())
  const configurationQueue = useRef<Promise<unknown> | null>(null)

  useEffect(() => {
    mounted.current = true
    const cancellations = cancelRequests.current
    return () => {
      mounted.current = false
      for (const cancel of cancellations) cancel()
      cancellations.clear()
    }
  }, [])

  useLayoutEffect(() => {
    if (profileRef.current !== parsed.profileId) {
      profileRef.current = parsed.profileId
      revisionRef.current = parsed.revision
      errorEpoch.current += 1
      setErrorCode(null)
      setRequiresAlarmReload(false)
      for (const cancel of cancelRequests.current) cancel()
      resetAlarmIntents()
      resetDefaults()
      resetLinkIntents()
      resetOccurrences()
    } else {
      revisionRef.current = Math.max(revisionRef.current, parsed.revision)
    }
  }, [parsed.profileId, parsed.revision, resetAlarmIntents, resetLinkIntents, resetDefaults, resetOccurrences])

  const clearError = useCallback(() => {
    errorEpoch.current += 1
    setErrorCode(null)
    setRequiresAlarmReload(false)
  }, [])

  const send = useCallback(async (
    command: WakeLightCommandOperation,
    optimistic: () => void,
    rollback: () => void,
  ): Promise<boolean> => {
    const urgent = command.operation === 'end_episode'
    const pendingKeys = commandPendingKeys(command)
    if (pendingKeys.some(key => pendingRef.current.has(key))) return false
    if (!parsed.available || (urgent && !parsed.episodeRef)) {
      setErrorCode('unavailable')
      return false
    }
    const epoch = errorEpoch.current
    for (const key of pendingKeys) pendingRef.current.add(key)
    setPending([...pendingRef.current])
    setErrorCode(null)
    optimistic()
    const execute = async () => {
      let timeout: number | undefined
      let cancel: (() => void) | undefined
      setErrorCode(null)
      try {
        const request = wakeLightServiceCall({ ...parsed, revision: Math.max(revisionRef.current, parsed.revision) }, command)
        const response = responseFrom(await Promise.race([
          Promise.resolve(callService(request)),
          new Promise<never>((_resolve, reject) => {
            timeout = window.setTimeout(() => reject(new Error('transport')), COMMAND_TIMEOUT_MS)
            cancel = () => {
              if (timeout !== undefined) window.clearTimeout(timeout)
              timeout = undefined
              reject(new Error('discarded'))
            }
            cancelRequests.current.add(cancel)
          }),
        ]))
        if (!response || typeof response.outcome !== 'string') throw new Error('transport')
        if (Number.isInteger(response.revision)) {
          revisionRef.current = Math.max(revisionRef.current, Number(response.revision))
        }
        if (response.outcome === 'accepted') return true
        if (response.outcome === 'no_change') {
          if (mounted.current) rollback()
          return true
        }
        if (mounted.current) rollback()
        if (mounted.current && errorEpoch.current === epoch) {
          setErrorCode(typeof response.error === 'string' ? response.error : response.outcome)
          setRequiresAlarmReload(response.conflict === 'alarm_revision')
        }
        return false
      } catch {
        if (mounted.current) rollback()
        if (mounted.current && errorEpoch.current === epoch) setErrorCode('transport')
        return false
      } finally {
        if (timeout !== undefined) window.clearTimeout(timeout)
        if (cancel) cancelRequests.current.delete(cancel)
      }
    }
    const request = urgent
      ? execute()
      : configurationQueue.current
        ? configurationQueue.current.then(() => execute(), () => execute())
        : execute()
    if (!urgent) {
      const tail = request.then(() => undefined, () => undefined)
      configurationQueue.current = tail
      void tail.finally(() => {
        if (configurationQueue.current === tail) configurationQueue.current = null
      })
    }
    try {
      return await request
    } finally {
      for (const key of pendingKeys) pendingRef.current.delete(key)
      if (mounted.current) setPending([...pendingRef.current])
    }
  }, [callService, parsed])

  const saveAlarm = (alarm: WakeLightAlarm) => send(
    { operation: 'upsert_alarm', alarm },
    () => commitAlarmIntent(alarm.id, { ...alarm, revision: alarm.revision + 1 }),
    () => clearAlarmIntent(alarm.id),
  )
  const deleteAlarm = (alarmId: string) => send(
    { operation: 'delete_alarm', alarmId },
    () => commitAlarmIntent(alarmId, null),
    () => clearAlarmIntent(alarmId),
  )
  const updateDefaults = (value: WakeLightDefaults) => send(
    { operation: 'update_defaults', defaults: value }, () => commitDefaults(value), resetDefaults,
  )
  const setAlarmLink = (linkKeys: string[], value: boolean) => send(
    { operation: 'link_alarm', linkKeys, enabled: value },
    () => {
      for (const linkKey of linkKeys) commitLinkIntent(linkKey, value)
    },
    () => {
      for (const linkKey of linkKeys) clearLinkIntent(linkKey)
    },
  )
  const endEpisode = () => {
    const intent = ++activeIntent.current
    return send(
      { operation: 'end_episode' }, () => commitOccurrences([]),
      () => { if (intent === activeIntent.current) resetOccurrences() },
    )
  }
  const error = errorCode === null ? null
    : errorCode === 'revision_conflict' || errorCode === 'request_id_conflict' ? copy(C.feedback.conflict)
    : errorCode === 'episode_duration_exceeded' ? copy(C.feedback.episodeLimit)
    : errorCode === 'no_active_occurrence' || errorCode === 'occurrence_already_ended' ? copy(C.feedback.inactive)
    : errorCode === WAKE_LIGHT_FAILURE_KIND.TRANSPORT ? copy(C.feedback.transport)
    : errorCode === WAKE_LIGHT_FAILURE_KIND.UNAVAILABLE ? copy(C.errors.unavailable)
    : copy(C.errors.commandFailed)

  return {
    canEdit: user?.is_admin !== false,
    requiresAlarmReload,
    clearError, deleteAlarm, endEpisode, error, errorCode,
    liveAlarms,
    configurationPending: pending.some(key => key !== 'end_episode'),
    isAlarmPending: (alarmId: string) => pending.includes(`alarm:${alarmId}`),
    areAlarmLinksPending: (linkKeys: string[]) => linkKeys.some(key => pending.includes(`link:${key}`)),
    stopping: pending.includes('end_episode'),
    saveAlarm, setAlarmLink, updateDefaults,
    snapshot: { ...parsed, alarmLinks, alarms, defaults, activeOccurrences },
  }
}

export type WakeLightController = ReturnType<typeof useWakeLightController>
