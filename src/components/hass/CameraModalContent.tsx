import { useEffect, useRef, useState } from 'react'
import { useEntity, useHass } from '@hakit/core'
import type { CameraConfig } from '../../constants/atAGlance'
import { ActionPill } from '../core/ActionPill'
import { MaterialIcon } from '../core/Icon'
import { asEntityName } from './entityState'
import { WebRtcCamera } from './WebRtcCamera'
import styles from './CameraModalContent.module.css'

declare global {
  interface Window {
    __webrtcGetMuteState?: (targetId: string) => boolean
  }
}

type CallService = (params: Record<string, unknown>) => void
type WebRtcAction = 'webrtc-screenshot' | 'webrtc-toggle-mute'

function dispatchWebRtcAction(eventName: WebRtcAction, targetId: string) {
  window.dispatchEvent(new CustomEvent(eventName, { detail: { target_id: targetId } }))
}

function getMuteState(targetId: string) {
  return window.__webrtcGetMuteState?.(targetId) ?? true
}

export function CameraModalContent({ camera, live = true }: { camera: CameraConfig; live?: boolean }) {
  const recordingEntity = useEntity(asEntityName(camera.recordingEntityId ?? 'input_boolean.unknown'), { returnNullIfNotFound: true })
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const [isMuted, setIsMuted] = useState(() => getMuteState(camera.popupCardId))
  const [snapshotPulse, setSnapshotPulse] = useState(false)
  const snapshotTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const handleAudioState = (event: Event) => {
      const detail = (event as CustomEvent<{ muted?: boolean; target_id?: string }>).detail
      if (detail?.target_id === camera.popupCardId && typeof detail.muted === 'boolean') {
        setIsMuted(detail.muted)
      }
    }

    window.addEventListener('webrtc-audio-state', handleAudioState)
    return () => window.removeEventListener('webrtc-audio-state', handleAudioState)
  }, [camera.popupCardId])

  useEffect(() => () => {
    if (snapshotTimerRef.current !== null) window.clearTimeout(snapshotTimerRef.current)
  }, [])

  const toggleRecording = () => {
    if (!camera.recordingScriptEntityId) return
    callService({ domain: 'script', service: 'turn_on', target: camera.recordingScriptEntityId })
  }

  const takeSnapshot = () => {
    setSnapshotPulse(true)
    if (snapshotTimerRef.current !== null) window.clearTimeout(snapshotTimerRef.current)
    snapshotTimerRef.current = window.setTimeout(() => {
      snapshotTimerRef.current = null
      setSnapshotPulse(false)
    }, 900)
    dispatchWebRtcAction('webrtc-screenshot', camera.popupCardId)
  }

  const toggleMute = () => {
    setIsMuted(!getMuteState(camera.popupCardId))
    dispatchWebRtcAction('webrtc-toggle-mute', camera.popupCardId)
  }

  const isRecording = recordingEntity?.state === 'on'

  return (
    <div className={styles.cameraSheet}>
      <div className={styles.cameraFocus}>
        {live ? <WebRtcCamera camera={camera} controls minHeight={310} variant="modal" /> : <div style={{ minHeight: 310 }} />}
      </div>
      <div className={styles.cameraControls} aria-label={`${camera.title} camera controls`}>
        <ActionPill active={snapshotPulse} label="Snapshot" onClick={takeSnapshot} pulse={snapshotPulse}>
          <MaterialIcon name="mdi:camera" size={24} />
        </ActionPill>
        <ActionPill active={isMuted} label={isMuted ? 'Muted' : 'Audio'} onClick={toggleMute}>
          <MaterialIcon name={isMuted ? 'mdi:volume-off' : 'mdi:volume-high'} size={24} />
        </ActionPill>
        {camera.recordingScriptEntityId && (
          <ActionPill active={isRecording} danger label={isRecording ? 'Recording' : 'Record'} onClick={toggleRecording} pulse={isRecording}>
            <MaterialIcon name="mdi:record-circle" size={25} />
          </ActionPill>
        )}
      </div>
    </div>
  )
}
