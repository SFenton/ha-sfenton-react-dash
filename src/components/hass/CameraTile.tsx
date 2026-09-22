import { useCallback, useState } from 'react'
import { useEntity } from '@hakit/core'
import type { CameraConfig } from '../../constants/atAGlance'
import { MaterialIcon } from '../core/Icon'
import { asEntityName, titleCaseState } from './entityState'
import { HlsCamera } from './HlsCamera'
import type { CameraStreamStatus } from './cameraStreamStatus'
import styles from './CameraTile.module.css'

interface CameraTileProps {
  camera: CameraConfig
  live?: boolean
  onOpen: (hash: string) => void
}

// Transport status is authoritative while frames are playing. The entity state remains the
// fallback label while the Home Assistant stream is loading or unavailable.
function tileStateLabel(entityState: string | undefined, streamStatus: CameraStreamStatus) {
  if (streamStatus === 'live') return 'Live'
  return titleCaseState(entityState)
}

export function CameraTile({ camera, live = true, onOpen }: CameraTileProps) {
  const entity = useEntity(asEntityName(camera.entityId), { returnNullIfNotFound: true })
  const [streamStatus, setStreamStatus] = useState<CameraStreamStatus>('loading')
  const handleStatusChange = useCallback((status: CameraStreamStatus) => setStreamStatus(status), [])

  return (
    <div className={styles.tile}>
      {!live ? (
        <div className={`${styles.placeholder} ${styles.warming}`} aria-hidden="true">
          <MaterialIcon name="mdi:cctv" size={34} />
        </div>
      ) : (
        <>
          <div className={styles.camera}>
            <HlsCamera camera={camera} minHeight={190} variant="tile" onStatusChange={handleStatusChange} />
          </div>
          {streamStatus === 'error' && <div className={`${styles.placeholder} ${styles.streamError}`}>Camera unavailable</div>}
        </>
      )}
      <button className={styles.button} onClick={() => onOpen(camera.hash)} type="button" aria-label={`Open ${camera.title} camera`}>
        <span className={styles.label} data-dynamic-grid-label-container="true">
          <span className={styles.title} data-dynamic-grid-label="true">{camera.title}</span>
          <span className={styles.trailing}>
            <span className={styles.state} data-dynamic-grid-label="true">{tileStateLabel(entity?.state, streamStatus)}</span>
          </span>
        </span>
      </button>
    </div>
  )
}