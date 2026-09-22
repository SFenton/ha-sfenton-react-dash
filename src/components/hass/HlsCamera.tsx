import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useHass } from '@hakit/core'
import type { CameraConfig } from '../../constants/atAGlance'
import {
  publishCameraStreamMuteState,
  registerCameraStreamActionTarget,
} from './cameraStreamActions'
import { CAMERA_STREAM_PHASE, type CameraStreamStatus } from './cameraStreamStatus'
import { createHaHlsSession } from './haHlsSession'
import styles from './HlsCamera.module.css'

function downloadSnapshot(video: HTMLVideoElement) {
  if (!video.videoWidth || !video.videoHeight) return

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  const timestamp = new Date().toISOString().substring(0, 19).replaceAll('-', '').replaceAll(':', '')
  const link = document.createElement('a')
  link.download = `snapshot_${timestamp}.jpeg`
  link.href = canvas.toDataURL('image/jpeg')
  link.click()
}

function videoStyle(variant: 'tile' | 'modal', fill: boolean): CSSProperties {
  return {
    background: 'transparent',
    display: 'block',
    height: variant === 'tile' || fill ? '100%' : 'auto',
    minHeight: variant === 'tile' || fill ? 0 : undefined,
    objectFit: variant === 'tile' ? 'cover' : 'contain',
    width: '100%',
  }
}

interface HlsCameraProps {
  camera: CameraConfig
  variant: 'tile' | 'modal'
  minHeight: number
  controls?: boolean
  errorLabel?: string
  fill?: boolean
  onStatusChange?: (status: CameraStreamStatus) => void
}

export function HlsCamera({ camera, variant, minHeight, controls = false, errorLabel, fill = false, onStatusChange }: HlsCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [hasError, setHasError] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [status, setStatus] = useState<CameraStreamStatus>('loading')
  const cardId = variant === 'modal' ? camera.popupCardId : `${camera.entityId}-tile`
  const connection = useHass((state) => state.connection)
  const resolveUrl = useHass((state) => state.helpers.joinHassUrl)
  const onStatusChangeRef = useRef(onStatusChange)
  const mutedRef = useRef(isMuted)

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange
  }, [onStatusChange])

  useEffect(() => {
    mutedRef.current = isMuted
  }, [isMuted])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !controls) return

    let frame = 0
    const initialRect = video.getBoundingClientRect()
    let previousHeight = initialRect.height
    let previousWidth = initialRect.width
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return

      const { height, width } = entry.contentRect
      const resized = Math.abs(height - previousHeight) > 0.5 || Math.abs(width - previousWidth) > 0.5
      previousHeight = height
      previousWidth = width
      if (!resized) return

      video.controls = false
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        frame = 0
        if (video.isConnected) video.controls = true
      })
    })
    observer.observe(video)

    return () => {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [controls])

  const updateMuted = useCallback((muted: boolean) => {
    mutedRef.current = muted
    if (videoRef.current) videoRef.current.muted = muted
    setIsMuted(muted)
    publishCameraStreamMuteState(cardId, muted)
  }, [cardId])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !connection) return

    const unregisterActionTarget = registerCameraStreamActionTarget(cardId, {
      getMuted: () => mutedRef.current,
      setMuted: updateMuted,
      takeSnapshot: () => downloadSnapshot(video),
    })
    updateMuted(mutedRef.current)

    setHasError(false)
    setStatus('loading')
    onStatusChangeRef.current?.('loading')

    const session = createHaHlsSession({
      connection,
      entityId: camera.entityId,
      video,
      resolveUrl,
      mockPlayback: import.meta.env.MODE === 'test',
      onError: () => setHasError(true),
      onStatusChange: (nextStatus) => {
        setStatus(nextStatus)
        if (nextStatus !== 'error') setHasError(false)
        onStatusChangeRef.current?.(nextStatus)
      },
    })
    const handleVolumeChange = () => {
      if (video.muted !== mutedRef.current) {
        mutedRef.current = video.muted
        setIsMuted(video.muted)
        publishCameraStreamMuteState(cardId, video.muted)
      }
    }
    video.addEventListener('volumechange', handleVolumeChange)
    session.start()

    return () => {
      session.stop()
      unregisterActionTarget()
      video.removeEventListener('volumechange', handleVolumeChange)
    }
  }, [camera.entityId, cardId, connection, resolveUrl, updateMuted])

  return (
    <div
      className={styles.frame}
      data-camera-transport="hls"
      data-loaded={status === 'live' ? 'true' : 'false'}
      data-fill={fill ? 'true' : 'false'}
      data-status={status}
      data-variant={variant}
      style={{ '--camera-min-height': `${minHeight}px` } as CSSProperties}
    >
      <div className={styles.host}>
        <video
          autoPlay
          controls={controls}
          crossOrigin="anonymous"
          data-camera-entity={camera.entityId}
          muted={isMuted}
          playsInline
          ref={videoRef}
          style={videoStyle(variant, fill)}
        />
      </div>
      {status === CAMERA_STREAM_PHASE.ERROR && hasError && errorLabel && <div className={styles.message}>{errorLabel}</div>}
    </div>
  )
}
