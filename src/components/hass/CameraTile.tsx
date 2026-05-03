import { useEntity } from '@hakit/core'
import type { CameraConfig } from '../../constants/atAGlance'
import { asEntityName, titleCaseState } from './entityState'
import { WebRtcCamera } from './WebRtcCamera'
import styles from './CameraTile.module.css'

interface CameraTileProps {
  camera: CameraConfig
  onOpen: (hash: string) => void
}

export function CameraTile({ camera, onOpen }: CameraTileProps) {
  const entity = useEntity(asEntityName(camera.entityId), { returnNullIfNotFound: true })
  const isUnavailable = !entity || entity.state === 'unavailable'

  return (
    <div className={styles.tile}>
      {isUnavailable ? (
        <div className={styles.placeholder}>Camera unavailable</div>
      ) : (
        <div className={styles.camera}>
          <WebRtcCamera camera={camera} minHeight={190} variant="tile" />
        </div>
      )}
      <button className={styles.button} onClick={() => onOpen(camera.hash)} type="button" aria-label={`Open ${camera.title} camera`}>
        <span className={styles.label}>
          <span className={styles.title}>{camera.title}</span>
          <span className={styles.state}>{titleCaseState(entity?.state)}</span>
        </span>
      </button>
    </div>
  )
}