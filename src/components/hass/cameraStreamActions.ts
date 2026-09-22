interface CameraStreamActionTarget {
  getMuted: () => boolean
  setMuted: (muted: boolean) => void
  takeSnapshot: () => void
}

export interface CameraStreamMuteState {
  targetId: string
  muted: boolean
}

const actionTargets = new Map<string, CameraStreamActionTarget>()
const muteStateListeners = new Set<(state: CameraStreamMuteState) => void>()

export function registerCameraStreamActionTarget(targetId: string, target: CameraStreamActionTarget) {
  actionTargets.set(targetId, target)
  return () => {
    if (actionTargets.get(targetId) === target) actionTargets.delete(targetId)
  }
}

export function getCameraStreamMuteState(targetId: string) {
  return actionTargets.get(targetId)?.getMuted() ?? true
}

export function publishCameraStreamMuteState(targetId: string, muted: boolean) {
  for (const listener of muteStateListeners) listener({ targetId, muted })
}

export function setCameraStreamMuted(targetId: string, muted: boolean) {
  const target = actionTargets.get(targetId)
  if (!target) return getCameraStreamMuteState(targetId)
  target.setMuted(muted)
  return muted
}

export function toggleCameraStreamMuted(targetId: string) {
  return setCameraStreamMuted(targetId, !getCameraStreamMuteState(targetId))
}

export function takeCameraStreamSnapshot(targetId: string) {
  actionTargets.get(targetId)?.takeSnapshot()
}

export function subscribeCameraStreamMuteState(listener: (state: CameraStreamMuteState) => void) {
  muteStateListeners.add(listener)
  return () => {
    muteStateListeners.delete(listener)
  }
}
