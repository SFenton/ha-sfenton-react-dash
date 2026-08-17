import { useCallback } from 'react'
import { useEntity, useHass } from '@hakit/core'
import type { BathroomFanConfig } from '../../constants/bathroomFans'
import { useOptimisticState } from '../../hooks/useOptimisticState'
import { asEntityName } from './entityState'
import { bathroomFanServiceCall } from './bathroomFanState'

type BinaryDisplayState = 'off' | 'on' | 'unavailable'
type CallService = (params: Record<string, unknown>) => void

function binaryFlag(entity: ReturnType<typeof useEntity>): BinaryDisplayState {
  if (!entity || entity.state === 'unavailable' || entity.state === 'unknown') return 'unavailable'
  return entity.state === 'on' ? 'on' : 'off'
}

export function useBathroomFanCommand(config: BathroomFanConfig) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const powerEntity = useEntity(asEntityName(config.powerEntityId), { returnNullIfNotFound: true })
  const lockEntity = useEntity(asEntityName(config.lockEntityId), { returnNullIfNotFound: true })
  const pendingEntity = useEntity(asEntityName(config.pendingEntityId), { returnNullIfNotFound: true })
  const autoUnlockEntity = useEntity(asEntityName(config.autoUnlockEntityId), { returnNullIfNotFound: true })
  const livePowerState = binaryFlag(powerEntity)
  const liveLockState = binaryFlag(lockEntity)
  const livePendingState = binaryFlag(pendingEntity)
  const liveAutoUnlockState = binaryFlag(autoUnlockEntity)
  const [powerState, commitPowerState] = useOptimisticState(livePowerState)
  const [lockState, commitLockState] = useOptimisticState(liveLockState)
  const [pendingState, commitPendingState] = useOptimisticState(livePendingState)
  const [autoUnlockState, commitAutoUnlockState] = useOptimisticState(liveAutoUnlockState)
  const powerOn = powerState === 'on'
  const locked = lockState === 'on'
  const timerPending = pendingState === 'on'
  const autoUnlock = autoUnlockState === 'on'

  const send = useCallback((command: Parameters<typeof bathroomFanServiceCall>[1]) => {
    callService(bathroomFanServiceCall(config, command))
  }, [callService, config])

  const setPower = useCallback((nextPowerOn: boolean) => {
    if (livePowerState === 'unavailable' || nextPowerOn === powerOn) return
    commitPowerState(nextPowerOn ? 'on' : 'off')
    if (timerPending) commitPendingState('off')
    if (locked) commitLockState('off')
    if (autoUnlock) commitAutoUnlockState('off')
    send({ type: 'power', targetPower: nextPowerOn ? 'on' : 'off' })
  }, [autoUnlock, commitAutoUnlockState, commitLockState, commitPendingState, commitPowerState, livePowerState, locked, powerOn, send, timerPending])

  const setLocked = useCallback((nextLocked: boolean) => {
    if (liveLockState === 'unavailable' || nextLocked === locked) return
    commitLockState(nextLocked ? 'on' : 'off')
    if (nextLocked && timerPending) commitAutoUnlockState('on')
    send({ type: 'lock', locked: nextLocked })
  }, [commitAutoUnlockState, commitLockState, liveLockState, locked, send, timerPending])

  const startTimer = useCallback((minutes: number, nextAutoUnlock: boolean) => {
    if (!powerOn || livePendingState === 'unavailable') return
    const enabled = locked && nextAutoUnlock
    commitPendingState('on')
    commitAutoUnlockState(enabled ? 'on' : 'off')
    send({ type: 'timer-start', autoUnlock: enabled, minutes })
  }, [commitAutoUnlockState, commitPendingState, livePendingState, locked, powerOn, send])

  const cancelTimer = useCallback(() => {
    if (!timerPending || livePendingState === 'unavailable') return
    commitPendingState('off')
    commitAutoUnlockState('off')
    send({ type: 'timer-cancel' })
  }, [commitAutoUnlockState, commitPendingState, livePendingState, send, timerPending])

  const setTimerAutoUnlock = useCallback((enabled: boolean) => {
    if (!timerPending || !locked || liveAutoUnlockState === 'unavailable' || enabled === autoUnlock) return
    commitAutoUnlockState(enabled ? 'on' : 'off')
    send({ type: 'timer-auto-unlock', enabled })
  }, [autoUnlock, commitAutoUnlockState, liveAutoUnlockState, locked, send, timerPending])

  return {
    autoUnlock,
    autoUnlockAvailable: liveAutoUnlockState !== 'unavailable',
    cancelTimer,
    lockAvailable: liveLockState !== 'unavailable',
    locked,
    powerAvailable: livePowerState !== 'unavailable',
    powerOn,
    setLocked,
    setPower,
    setTimerAutoUnlock,
    startTimer,
    timerAvailable: livePendingState !== 'unavailable',
    timerPending,
  }
}
