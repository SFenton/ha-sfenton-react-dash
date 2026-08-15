import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useHass } from '@hakit/core'
import { callService as callHassService } from 'home-assistant-js-websocket'
import {
  GARAGE_DOOR_COMMAND_LOCKOUT_MS,
  GARAGE_DOOR_CONFIRM_TIMEOUT_MS,
  GARAGE_DOOR_FAILURE_HOLD_MS,
  GARAGE_DOOR_SENDING_FEEDBACK_MS,
  GARAGE_DOOR_SERVICE_TIMEOUT_MS,
} from '../../constants/garageDoors'
import { useOptimisticState } from '../../hooks/useOptimisticState'
import { garageDoorCommandForState, type GarageDoorCommand } from './garageDoorState'

export const GarageDoorCommandPhase = {
  Idle: 0,
  Sending: 1,
  Pending: 2,
  Error: 3,
} as const

export type GarageDoorCommandPhase = (typeof GarageDoorCommandPhase)[keyof typeof GarageDoorCommandPhase]

type GarageDoorFeedback =
  | { state: typeof GarageDoorCommandPhase.Idle }
  | {
      opens: boolean
      liveState: string
      state:
        | typeof GarageDoorCommandPhase.Sending
        | typeof GarageDoorCommandPhase.Pending
        | typeof GarageDoorCommandPhase.Error
      requestId: number
    }

interface RequestProgress {
  acknowledged: boolean
  command: GarageDoorCommand
  feedbackElapsed: boolean
  lockoutElapsed: boolean
  requestId: number
}

function connectionCannotSend(connectionStatus: string | undefined) {
  return connectionStatus === 'disconnected' || connectionStatus === 'suspended'
}

export function useGarageDoorCommand(entityId: string, liveState: string) {
  const connection = useHass((state) => state.connection)
  const connectionStatus = useHass((state) => state.connectionStatus)
  const [displayState, commitDisplayState, resetDisplayState] = useOptimisticState(liveState, {
    clearOn: 'live-change',
    revertMs: GARAGE_DOOR_CONFIRM_TIMEOUT_MS + 1000,
  })
  const [feedback, setFeedback] = useState<GarageDoorFeedback>({ state: GarageDoorCommandPhase.Idle })
  const [interactionLocked, setInteractionLocked] = useState(false)
  const requestSequenceRef = useRef(0)
  const activeRequestRef = useRef<number | null>(null)
  const requestProgressRef = useRef<RequestProgress | null>(null)
  const interactionLockedRef = useRef(false)
  const sendingTimerRef = useRef<number | null>(null)
  const lockoutTimerRef = useRef<number | null>(null)
  const serviceTimerRef = useRef<number | null>(null)
  const confirmationTimerRef = useRef<number | null>(null)
  const failureTimerRef = useRef<number | null>(null)
  const previousLiveStateRef = useRef(liveState)

  const clearTimer = useCallback((timerRef: { current: number | null }) => {
    if (timerRef.current === null) return
    window.clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const clearCommandTimers = useCallback(() => {
    clearTimer(sendingTimerRef)
    clearTimer(lockoutTimerRef)
    clearTimer(serviceTimerRef)
    clearTimer(confirmationTimerRef)
  }, [clearTimer])

  const clearFailureTimer = useCallback(() => {
    clearTimer(failureTimerRef)
  }, [clearTimer])

  const finishActiveRequest = useCallback(() => {
    activeRequestRef.current = null
    requestProgressRef.current = null
    interactionLockedRef.current = false
    setInteractionLocked(false)
    clearCommandTimers()
  }, [clearCommandTimers])

  const failRequest = useCallback((requestId: number, command: GarageDoorCommand) => {
    if (activeRequestRef.current !== requestId) return
    finishActiveRequest()
    resetDisplayState()
    clearFailureTimer()
    setFeedback({
      liveState,
      opens: command.opens,
      requestId,
      state: GarageDoorCommandPhase.Error,
    })
    failureTimerRef.current = window.setTimeout(() => {
      failureTimerRef.current = null
      setFeedback((current) => current.state === GarageDoorCommandPhase.Error && current.requestId === requestId
        ? { state: GarageDoorCommandPhase.Idle }
        : current)
    }, GARAGE_DOOR_FAILURE_HOLD_MS)
  }, [clearFailureTimer, finishActiveRequest, liveState, resetDisplayState])

  const enterPendingWhenReady = useCallback((requestId: number) => {
    const progress = requestProgressRef.current
    if (activeRequestRef.current !== requestId || !progress || progress.requestId !== requestId) return
    if (!progress.acknowledged || !progress.feedbackElapsed) return
    setFeedback((current) => current.state === GarageDoorCommandPhase.Sending && current.requestId === requestId
      ? { ...current, state: GarageDoorCommandPhase.Pending }
      : current)
  }, [])

  const unlockInteractionWhenReady = useCallback((requestId: number) => {
    const progress = requestProgressRef.current
    if (activeRequestRef.current !== requestId || !progress || progress.requestId !== requestId) return
    if (!progress.acknowledged || !progress.lockoutElapsed) return
    interactionLockedRef.current = false
    setInteractionLocked(false)
  }, [])

  const sendCommand = useCallback(() => {
    if (interactionLockedRef.current) return
    const command = garageDoorCommandForState(liveState)
    if (!command) return

    clearCommandTimers()
    clearFailureTimer()
    const requestId = requestSequenceRef.current + 1
    requestSequenceRef.current = requestId
    activeRequestRef.current = requestId
    interactionLockedRef.current = true
    setInteractionLocked(true)
    requestProgressRef.current = {
      acknowledged: false,
      command,
      feedbackElapsed: false,
      lockoutElapsed: false,
      requestId,
    }
    commitDisplayState(command.state)
    setFeedback({
      liveState,
      opens: command.opens,
      requestId,
      state: GarageDoorCommandPhase.Sending,
    })

    sendingTimerRef.current = window.setTimeout(() => {
      sendingTimerRef.current = null
      const progress = requestProgressRef.current
      if (activeRequestRef.current !== requestId || !progress || progress.requestId !== requestId) return
      progress.feedbackElapsed = true
      enterPendingWhenReady(requestId)
    }, GARAGE_DOOR_SENDING_FEEDBACK_MS)

    lockoutTimerRef.current = window.setTimeout(() => {
      lockoutTimerRef.current = null
      const progress = requestProgressRef.current
      if (activeRequestRef.current !== requestId || !progress || progress.requestId !== requestId) return
      progress.lockoutElapsed = true
      unlockInteractionWhenReady(requestId)
    }, GARAGE_DOOR_COMMAND_LOCKOUT_MS)

    confirmationTimerRef.current = window.setTimeout(() => {
      confirmationTimerRef.current = null
      failRequest(requestId, command)
    }, GARAGE_DOOR_CONFIRM_TIMEOUT_MS)

    if (!connection || connectionCannotSend(connectionStatus)) {
      failRequest(requestId, command)
      return
    }

    serviceTimerRef.current = window.setTimeout(() => {
      serviceTimerRef.current = null
      failRequest(requestId, command)
    }, GARAGE_DOOR_SERVICE_TIMEOUT_MS)

    try {
      void callHassService(connection, 'cover', command.service, undefined, { entity_id: entityId }).then(
        () => {
          if (activeRequestRef.current !== requestId) return
          clearTimer(serviceTimerRef)
          const progress = requestProgressRef.current
          if (!progress || progress.requestId !== requestId) return
          progress.acknowledged = true
          enterPendingWhenReady(requestId)
          unlockInteractionWhenReady(requestId)
        },
        () => failRequest(requestId, command),
      )
    } catch {
      failRequest(requestId, command)
    }
  }, [
    clearCommandTimers,
    clearFailureTimer,
    clearTimer,
    commitDisplayState,
    connection,
    connectionStatus,
    enterPendingWhenReady,
    entityId,
    failRequest,
    liveState,
    unlockInteractionWhenReady,
  ])

  useLayoutEffect(() => {
    if (previousLiveStateRef.current === liveState) return
    previousLiveStateRef.current = liveState
    finishActiveRequest()
    clearFailureTimer()
    resetDisplayState()
    setFeedback({ state: GarageDoorCommandPhase.Idle })
  }, [clearFailureTimer, finishActiveRequest, liveState, resetDisplayState])

  useEffect(() => {
    if (!connectionCannotSend(connectionStatus)) return
    const progress = requestProgressRef.current
    if (!progress || activeRequestRef.current !== progress.requestId) return
    failRequest(progress.requestId, progress.command)
  }, [connectionStatus, failRequest])

  useEffect(() => () => {
    activeRequestRef.current = null
    requestProgressRef.current = null
    interactionLockedRef.current = false
    clearCommandTimers()
    clearFailureTimer()
  }, [clearCommandTimers, clearFailureTimer])

  const activeFeedback = feedback.state === GarageDoorCommandPhase.Idle ? null : feedback
  const feedbackOutdated = activeFeedback !== null && activeFeedback.liveState !== liveState
  const currentFeedback = feedbackOutdated ? null : activeFeedback
  const phase = currentFeedback?.state ?? GarageDoorCommandPhase.Idle

  return {
    available: garageDoorCommandForState(liveState) !== null,
    displayState,
    interactionLocked,
    opens: currentFeedback?.opens,
    phase,
    sendCommand,
  }
}
