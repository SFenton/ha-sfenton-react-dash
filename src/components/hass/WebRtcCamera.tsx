import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useHass } from '@hakit/core'
import type { CameraConfig } from '../../constants/atAGlance'
import styles from './WebRtcCamera.module.css'

const WEBRTC_RESOURCE_PATH = '/webrtc/webrtc-camera.js?v=v3.10.1'
const WEBRTC_MODES = 'webrtc,webrtc/tcp,mse,hls,mjpeg'
const WEBRTC_CHROME_STYLE_ID = 'sfenton-webrtc-camera-chrome'

let webRtcModulePromise: Promise<void> | null = null

interface WebRtcElement extends HTMLElement {
  setConfig: (config: Record<string, unknown>) => void
  hass: unknown
}

function loadWebRtcModule() {
  if (!webRtcModulePromise) {
    webRtcModulePromise = import(/* @vite-ignore */ WEBRTC_RESOURCE_PATH).then(() => undefined)
  }

  return webRtcModulePromise
}

function disabledDigitalPtzConfig() {
  return {
    mouse_drag_pan: false,
    mouse_wheel_zoom: false,
    mouse_double_click_zoom: false,
    touch_drag_pan: false,
    touch_pinch_zoom: false,
    touch_tap_drag_zoom: false,
    persist: true,
  }
}

function hideWebRtcChrome(element: HTMLElement) {
  const applyStyle = () => {
    const { shadowRoot } = element
    if (!shadowRoot || shadowRoot.getElementById(WEBRTC_CHROME_STYLE_ID)) return

    const style = document.createElement('style')
    style.id = WEBRTC_CHROME_STYLE_ID
    style.textContent = `
      .header,
      .label {
        display: none !important;
      }

      :host([data-dashboard-variant='tile']) ha-card,
      :host([data-dashboard-variant='tile']) .player,
      :host([data-dashboard-variant='tile']) .ptz-transform,
      :host([data-dashboard-variant='tile']) video {
        width: 100% !important;
        height: 100% !important;
      }

      :host([data-dashboard-variant='tile']) video {
        object-fit: cover !important;
      }
    `
    shadowRoot.appendChild(style)
  }

  applyStyle()
  window.requestAnimationFrame(applyStyle)
}

interface WebRtcCameraProps {
  camera: CameraConfig
  variant: 'tile' | 'modal'
  minHeight: number
  controls?: boolean
}

export function WebRtcCamera({ camera, variant, minHeight, controls = false }: WebRtcCameraProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const webRtcElementRef = useRef<WebRtcElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const cardId = variant === 'modal' ? camera.popupCardId : `${camera.streamId}-tile`
  const connection = useHass((state) => state.connection)
  const entities = useHass((state) => state.entities)
  const config = useHass((state) => state.config)
  const services = useHass((state) => state.services)
  const hassUrl = useHass((state) => state.hassUrl)
  const joinHassUrl = useHass((state) => state.helpers.joinHassUrl)

  const hassShim = useMemo(
    () => ({
      connection,
      states: entities,
      config,
      services,
      localize: (key: string) => key,
      hassUrl: joinHassUrl,
      callWS: (message: { type: string } & Record<string, unknown>) => {
        if (!connection) return Promise.reject(new Error('Home Assistant connection is not ready'))
        return connection.sendMessagePromise(message)
      },
    }),
    [config, connection, entities, joinHassUrl, services],
  )
  const hassShimRef = useRef(hassShim)

  useEffect(() => {
    hassShimRef.current = hassShim
    if (webRtcElementRef.current) {
      webRtcElementRef.current.hass = hassShim
    }
  }, [hassShim])

  useEffect(() => {
    const host = hostRef.current
    if (!host || !hassUrl || !connection) return

    let cancelled = false
    setError(null)
    setIsLoaded(false)

    loadWebRtcModule()
      .then(() => {
        if (cancelled || !hostRef.current) return

        host.textContent = ''
        const webRtcElement = document.createElement('webrtc-camera-sfenton') as WebRtcElement
        webRtcElement.style.display = 'block'
        webRtcElement.style.width = '100%'
        webRtcElement.dataset.dashboardVariant = variant
        webRtcElement.setConfig({
          card_id: cardId,
          id: cardId,
          label: camera.title,
          title: camera.title,
          shared: true,
          ui: controls,
          muted: true,
          controls,
          intersection: 0,
          digital_ptz: disabledDigitalPtzConfig(),
          streams: [
            {
              url: camera.streamId,
              mode: WEBRTC_MODES,
              media: 'video,audio',
            },
          ],
        })
        webRtcElement.hass = hassShimRef.current
        webRtcElementRef.current = webRtcElement
        host.appendChild(webRtcElement)
        hideWebRtcChrome(webRtcElement)
        setIsLoaded(true)
      })
      .catch((caughtError: unknown) => {
        if (!cancelled) {
          setIsLoaded(false)
          setError(caughtError instanceof Error ? caughtError.message : 'Unable to load WebRTC camera')
        }
      })

    return () => {
      cancelled = true
      webRtcElementRef.current = null
      if (host) host.textContent = ''
    }
  }, [camera.streamId, camera.title, cardId, connection, controls, hassUrl, variant])

  return (
    <div
      className={styles.frame}
      data-loaded={isLoaded ? 'true' : 'false'}
      data-variant={variant}
      style={{ '--camera-min-height': `${minHeight}px` } as CSSProperties}
    >
      <div className={styles.host} ref={hostRef} />
      {error && <div className={styles.message}>{error}</div>}
    </div>
  )
}