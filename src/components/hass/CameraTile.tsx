import { useCallback, useState } from 'react'
import { useEntity } from '@hakit/core'
import type { CameraConfig } from '../../constants/atAGlance'
import { MaterialIcon } from '../core/Icon'
import { asEntityName, titleCaseState } from './entityState'
import { WebRtcCamera } from './WebRtcCamera'
import type { WebRtcStatus } from './webRtcStatus'
import styles from './CameraTile.module.css'

interface CameraTileProps {
  camera: CameraConfig
  live?: boolean
  onOpen: (hash: string) => void
}

// The go2rtc stream is served independently of the Home Assistant camera entity, so an
// unavailable entity (e.g. a Frigate integration outage) must not hide a stream that still plays.
// The HA camera state (idle/recording/unavailable) describes HA's own stream session rather than
// the feed on screen, so a playing tile always reads "Live".
function tileStateLabel(entityState: string | undefined, streamStatus: WebRtcStatus) {
  if (streamStatus === 'live') return 'Live'
  return titleCaseState(entityState)
}

export function CameraTile({ camera, live = true, onOpen }: CameraTileProps) {
  const entity = useEntity(asEntityName(camera.entityId), { returnNullIfNotFound: true })
  const [streamStatus, setStreamStatus] = useState<WebRtcStatus>('loading')
  const handleStatusChange = useCallback((status: WebRtcStatus) => setStreamStatus(status), [])

  return (
    <div className={styles.tile}>
      {!live ? (
        <div className={`${styles.placeholder} ${styles.warming}`} aria-hidden="true">
          <MaterialIcon name="mdi:cctv" size={34} />
        </div>
      ) : (
        <>
          <div className={styles.camera}>
            <WebRtcCamera camera={camera} minHeight={190} variant="tile" onStatusChange={handleStatusChange} />
          </div>
          {streamStatus === 'error' && <div className={`${styles.placeholder} ${styles.streamError}`}>Camera unavailable</div>}
        </>
      )}
      <button className={styles.button} onClick={() => onOpen(camera.hash)} type="button" aria-label={`Open ${camera.title} camera`}>
        <span className={styles.label}>
          <span className={styles.title}>{camera.title}</span>
          <span className={styles.trailing}>
            <span className={styles.state}>{tileStateLabel(entity?.state, streamStatus)}</span>
          </span>
        </span>
      </button>
    </div>
  )
}