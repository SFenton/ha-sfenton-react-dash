import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useEntity, useHass } from '@hakit/core'
import type { CameraConfig } from '../../constants/atAGlance'
import { ActionPill } from '../core/ActionPill'
import { MaterialIcon } from '../core/Icon'
import { asEntityName } from './entityState'
import { WebRtcCamera } from './WebRtcCamera'
import { useModalSheetPresentation } from '../core/modalSheetPresentation'
import { useCopy } from '../../i18n'
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
  const copy = useCopy('modalCamera')
  const presentation = useModalSheetPresentation()
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
    <div className={styles.cameraSheet} data-modal-landscape-layout="media-split">
      <div className={styles.cameraFocus} style={{ '--camera-aspect-ratio': camera.aspectRatio } as CSSProperties}>
        {live ? <WebRtcCamera camera={camera} controls fill={presentation !== 'sheet'} minHeight={310} variant="modal" /> : <div style={{ minHeight: 310 }} />}
      </div>
      <div className={styles.cameraControls} aria-label={copy('controls', { title: camera.title })} data-security-camera-controls="true">
        <ActionPill active={snapshotPulse} label={copy('actions.snapshot')} onClick={takeSnapshot} pulse={snapshotPulse}>
          <MaterialIcon name="mdi:camera" size={24} />
        </ActionPill>
        <ActionPill active={isMuted} label={isMuted ? copy('actions.muted') : copy('actions.audio')} onClick={toggleMute}>
          <MaterialIcon name={isMuted ? 'mdi:volume-off' : 'mdi:volume-high'} size={24} />
        </ActionPill>
        {camera.recordingScriptEntityId && (
          <ActionPill active={isRecording} danger label={isRecording ? copy('actions.recording') : copy('actions.record')} onClick={toggleRecording} pulse={isRecording}>
            <MaterialIcon name="mdi:record-circle" size={25} />
          </ActionPill>
        )}
      </div>
    </div>
  )
}
