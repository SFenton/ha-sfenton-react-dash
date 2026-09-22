import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useEntity, useHass } from '@hakit/core'
import type { CameraConfig } from '../../constants/atAGlance'
import { ActionPill } from '../core/ActionPill'
import { MaterialIcon } from '../core/Icon'
import {
  getCameraStreamMuteState,
  subscribeCameraStreamMuteState,
  takeCameraStreamSnapshot,
  toggleCameraStreamMuted,
} from './cameraStreamActions'
import { asEntityName } from './entityState'
import { HlsCamera } from './HlsCamera'
import { useCopy } from '../../i18n'
import styles from './CameraModalContent.module.css'

type CallService = (params: Record<string, unknown>) => void

export function CameraModalContent({ camera, live = true }: { camera: CameraConfig; live?: boolean }) {
  const copy = useCopy('modalCamera')
  const recordingEntity = useEntity(asEntityName(camera.recordingEntityId ?? 'input_boolean.unknown'), { returnNullIfNotFound: true })
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const [isMuted, setIsMuted] = useState(() => getCameraStreamMuteState(camera.popupCardId))
  const [snapshotPulse, setSnapshotPulse] = useState(false)
  const snapshotTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return subscribeCameraStreamMuteState(({ muted, targetId }) => {
      if (targetId === camera.popupCardId) setIsMuted(muted)
    })
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
    takeCameraStreamSnapshot(camera.popupCardId)
  }

  const toggleMute = () => {
    setIsMuted(toggleCameraStreamMuted(camera.popupCardId))
  }

  const isRecording = recordingEntity?.state === 'on'

  return (
    <div className={styles.cameraSheet} data-modal-landscape-layout="media-split">
      <div className={styles.cameraFocus} style={{ '--camera-aspect-ratio': camera.aspectRatio } as CSSProperties}>
        {live ? <HlsCamera camera={camera} controls errorLabel={copy('status.unavailable')} fill minHeight={310} variant="modal" /> : <div style={{ minHeight: 310 }} />}
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
