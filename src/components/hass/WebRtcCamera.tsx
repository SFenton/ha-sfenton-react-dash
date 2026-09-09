import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useHass } from '@hakit/core'
import type { CameraConfig } from '../../constants/atAGlance'
import { readStatusFromMode, type WebRtcStatus } from './webRtcStatus'
import styles from './WebRtcCamera.module.css'

const WEBRTC_RESOURCE_PATH = '/webrtc/webrtc-camera.js?v=v3.10.1'
const WEBRTC_MODES = 'webrtc,webrtc/tcp,mse,hls,mjpeg'
const WEBRTC_CHROME_STYLE_ID = 'sfenton-webrtc-camera-chrome'
const WEBRTC_STATUS_POLL_MS = 400

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

      :host([data-dashboard-fill='true']) ha-card,
      :host([data-dashboard-fill='true']) .player,
      :host([data-dashboard-fill='true']) .ptz-transform,
      :host([data-dashboard-fill='true']) video {
        width: 100% !important;
        height: 100% !important;
      }

      :host([data-dashboard-fill='true']) video {
        object-fit: contain !important;
      }
    `
    shadowRoot.appendChild(style)
  }

  applyStyle()
  window.requestAnimationFrame(applyStyle)
}

// The shadow root and its `.mode` node are not guaranteed to exist the moment the element is
// appended, so poll until it appears and then observe it directly.
function watchWebRtcStatus(element: HTMLElement, onStatus: (status: WebRtcStatus) => void) {
  let observer: MutationObserver | null = null
  let pollTimer: number | null = null
  let lastStatus: WebRtcStatus | null = null

  const report = (mode: string | null | undefined) => {
    const status = readStatusFromMode(mode)
    if (status === lastStatus) return
    lastStatus = status
    onStatus(status)
  }

  const attach = () => {
    const modeNode = element.shadowRoot?.querySelector('.mode')
    if (!modeNode) return false

    report(modeNode.textContent)
    observer = new MutationObserver(() => report(modeNode.textContent))
    observer.observe(modeNode, { characterData: true, childList: true, subtree: true })
    return true
  }

  if (!attach()) {
    pollTimer = window.setInterval(() => {
      if (attach() && pollTimer !== null) {
        window.clearInterval(pollTimer)
        pollTimer = null
      }
    }, WEBRTC_STATUS_POLL_MS)
  }

  return () => {
    if (pollTimer !== null) window.clearInterval(pollTimer)
    observer?.disconnect()
  }
}

interface WebRtcCameraProps {
  camera: CameraConfig
  variant: 'tile' | 'modal'
  minHeight: number
  controls?: boolean
  fill?: boolean
  onStatusChange?: (status: WebRtcStatus) => void
}
export function WebRtcCamera({ camera, variant, minHeight, controls = false, fill = false, onStatusChange }: WebRtcCameraProps) {
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
  const onStatusChangeRef = useRef(onStatusChange)

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange
  }, [onStatusChange])

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
    let stopWatchingStatus: (() => void) | null = null
    setError(null)
    setIsLoaded(false)
    onStatusChangeRef.current?.('loading')

    loadWebRtcModule()
      .then(() => {
        if (cancelled || !hostRef.current) return

        host.textContent = ''
        const webRtcElement = document.createElement('webrtc-camera-sfenton') as WebRtcElement
        webRtcElement.style.display = 'block'
        webRtcElement.style.width = '100%'
        webRtcElement.dataset.dashboardVariant = variant
        webRtcElement.dataset.dashboardFill = fill ? 'true' : 'false'
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
        stopWatchingStatus = watchWebRtcStatus(webRtcElement, (status) => {
          if (!cancelled) onStatusChangeRef.current?.(status)
        })
        setIsLoaded(true)
      })
      .catch((caughtError: unknown) => {
        if (!cancelled) {
          setIsLoaded(false)
          setError(caughtError instanceof Error ? caughtError.message : 'Unable to load WebRTC camera')
          onStatusChangeRef.current?.('error')
        }
      })

    return () => {
      cancelled = true
      stopWatchingStatus?.()
      webRtcElementRef.current = null
      if (host) host.textContent = ''
    }
  }, [camera.streamId, camera.title, cardId, connection, controls, fill, hassUrl, variant])

  return (
    <div
      className={styles.frame}
      data-loaded={isLoaded ? 'true' : 'false'}
      data-fill={fill ? 'true' : 'false'}
      data-variant={variant}
      style={{ '--camera-min-height': `${minHeight}px` } as CSSProperties}
    >
      <div className={styles.host} ref={hostRef} />
      {error && <div className={styles.message}>{error}</div>}
    </div>
  )
}