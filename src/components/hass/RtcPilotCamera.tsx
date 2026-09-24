import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useHass } from '@hakit/core'
import type { CameraConfig } from '../../constants/atAGlance'
import { RTC_PILOT_RESOURCE_PATH } from '../../constants/rtcPilot'
import {
  publishCameraStreamMuteState,
  registerCameraStreamActionTarget,
} from './cameraStreamActions'
import type { CameraStreamStatus } from './cameraStreamStatus'
import styles from './HlsCamera.module.css'
import rtcStyles from './RtcPilotCamera.module.css'

const RTC_CARD_TAG = 'webrtc-camera-sfenton'
const RTC_CHROME_STYLE_ID = 'sfenton-rtc-pilot-chrome'
const RTC_CARD_SETUP_RETRY_MS = 2_000
const RTC_CARD_SETUP_MAX_RETRIES = 5

let rtcModulePromise: Promise<void> | null = null
let resourceRetry = 0

interface RtcCardElement extends HTMLElement {
  hass: unknown
  setConfig: (config: Record<string, unknown>) => void
}

type RtcCardWindow = Window & {
  __webrtcGetMuteState?: (cardId: string) => boolean | undefined
}

interface RtcPilotCameraProps {
  camera: CameraConfig
  variant: 'tile' | 'modal'
  minHeight: number
  controls?: boolean
  errorLabel?: string
  fill?: boolean
  onStatusChange?: (status: CameraStreamStatus) => void
}

function loadRtcCard() {
  if (customElements.get(RTC_CARD_TAG)) return Promise.resolve()
  if (!rtcModulePromise) {
    const resource = resourceRetry === 0 ? RTC_PILOT_RESOURCE_PATH : `${RTC_PILOT_RESOURCE_PATH}&retry=${resourceRetry}`
    resourceRetry += 1
    rtcModulePromise = import(/* @vite-ignore */ resource).then(() => {
      if (!customElements.get(RTC_CARD_TAG)) throw new Error('The RTC camera module did not register its card.')
    }).catch((error: unknown) => {
      rtcModulePromise = null
      throw error
    })
  }
  return rtcModulePromise
}

function hideRtcChrome(card: RtcCardElement) {
  const apply = () => {
    const shadow = card.shadowRoot
    if (!shadow || shadow.getElementById(RTC_CHROME_STYLE_ID)) return
    const style = document.createElement('style')
    style.id = RTC_CHROME_STYLE_ID
    style.textContent = `
      .header, .label { display: none !important; }
      :host([data-dashboard-variant='tile']) ha-card,
      :host([data-dashboard-variant='tile']) .player,
      :host([data-dashboard-variant='tile']) .ptz-transform,
      :host([data-dashboard-variant='tile']) video,
      :host([data-dashboard-fill='true']) ha-card,
      :host([data-dashboard-fill='true']) .player,
      :host([data-dashboard-fill='true']) .ptz-transform,
      :host([data-dashboard-fill='true']) video {
        width: 100% !important;
        height: 100% !important;
      }
      :host([data-dashboard-variant='tile']) video { object-fit: cover !important; }
      :host([data-dashboard-fill='true']) video { object-fit: contain !important; }
    `
    shadow.append(style)
  }
  apply()
  const frame = window.requestAnimationFrame(apply)
  return () => window.cancelAnimationFrame(frame)
}

function watchRtcStatus(card: RtcCardElement, onStatus: (status: CameraStreamStatus) => void) {
  const report = () => {
    const state = card.getAttribute('data-stream-status')
    if (state === 'connected') onStatus('live')
    else if (state === 'error') onStatus('error')
    else if (state === null || state === 'idle' || state === 'connecting' || state === 'disconnected') onStatus('loading')
    else {
      console.error('Unknown RTC stream status:', state)
      onStatus('error')
    }
  }
  const observer = new MutationObserver(report)
  observer.observe(card, { attributes: true, attributeFilter: ['data-stream-status'] })
  report()
  return () => observer.disconnect()
}

function setRtcCardPresentation(card: RtcCardElement, status: CameraStreamStatus) {
  const visible = status === 'live'
  card.dataset.dashboardVisible = visible ? 'true' : 'false'
  if (visible) {
    card.removeAttribute('aria-hidden')
    card.removeAttribute('inert')
  } else {
    card.setAttribute('aria-hidden', 'true')
    card.setAttribute('inert', '')
  }
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

function cardMuted(cardId: string) {
  const state = (window as RtcCardWindow).__webrtcGetMuteState?.(cardId)
  if (typeof state === 'boolean') return state
  console.error('The RTC camera did not publish its mute state.')
  return true
}

export function RtcPilotCamera({
  camera, variant, minHeight, controls = false, errorLabel, fill = false, onStatusChange,
}: RtcPilotCameraProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const cardRef = useRef<RtcCardElement | null>(null)
  const mountCardRef = useRef<(() => void) | null>(null)
  const onStatusChangeRef = useRef(onStatusChange)
  const [status, setStatus] = useState<CameraStreamStatus>('loading')
  const connection = useHass((state) => state.connection)
  const entities = useHass((state) => state.entities)
  const config = useHass((state) => state.config)
  const services = useHass((state) => state.services)
  const joinHassUrl = useHass((state) => state.helpers.joinHassUrl)
  const cardId = variant === 'modal' ? camera.popupCardId : `${camera.entityId}-tile`

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange
  }, [onStatusChange])

  const hassShim = useMemo(() => ({
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
  }), [config, connection, entities, joinHassUrl, services])
  const hassShimRef = useRef(hassShim)

  useEffect(() => {
    hassShimRef.current = hassShim
    if (cardRef.current) cardRef.current.hass = hassShim
  }, [hassShim])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let cancelled = false
    let loading = false
    let queuedRetry = false
    let retryAttempts = 0
    let retryTimer: number | null = null
    let stopWatching: (() => void) | null = null
    let stopChrome: (() => void) | null = null
    let unregisterActions: (() => void) | null = null
    const report = (next: CameraStreamStatus) => {
      if (cancelled) return
      if (cardRef.current) setRtcCardPresentation(cardRef.current, next)
      setStatus(next)
      onStatusChangeRef.current?.(next)
    }
    const handleAudioState = (event: Event) => {
      const detail = (event as CustomEvent<{ target_id?: string; muted?: boolean }>).detail
      if (detail?.target_id === cardId && typeof detail.muted === 'boolean') {
        publishCameraStreamMuteState(cardId, detail.muted)
      }
    }
    const mountCard = async () => {
      if (cancelled || loading || cardRef.current) return
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer)
        retryTimer = null
      }
      loading = true
      report('loading')
      let recoverable = true
      try {
        if (!camera.rtcStreamId) {
          recoverable = false
          throw new Error(`No RTC stream configured for ${camera.entityId}`)
        }
        await loadRtcCard()
        if (cancelled) return

        const card = document.createElement(RTC_CARD_TAG) as RtcCardElement
        card.className = rtcStyles.card
        card.style.display = 'block'
        card.style.width = '100%'
        card.dataset.dashboardVariant = variant
        card.dataset.dashboardFill = fill ? 'true' : 'false'
        setRtcCardPresentation(card, 'loading')
        card.setConfig({
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
          streams: [{ url: camera.rtcStreamId, mode: 'webrtc', media: 'video,audio' }],
        })
        card.hass = hassShimRef.current
        host.replaceChildren(card)
        cardRef.current = card
        window.addEventListener('webrtc-audio-state', handleAudioState)
        stopChrome = hideRtcChrome(card)
        stopWatching = watchRtcStatus(card, report)
        unregisterActions = registerCameraStreamActionTarget(cardId, {
          getMuted: () => cardMuted(cardId),
          setMuted: (muted) => window.dispatchEvent(new CustomEvent(
            muted ? 'webrtc-mute' : 'webrtc-unmute', { detail: { target_id: cardId } },
          )),
          takeSnapshot: () => window.dispatchEvent(new CustomEvent(
            'webrtc-screenshot', { detail: { target_id: cardId } },
          )),
        })
        retryAttempts = 0
      } catch (error) {
        if (cancelled) return
        stopWatching?.()
        stopChrome?.()
        unregisterActions?.()
        window.removeEventListener('webrtc-audio-state', handleAudioState)
        cardRef.current = null
        host.replaceChildren()
        console.error('Unable to start RTC camera pilot:', error)
        report('error')
        if (recoverable && retryAttempts < RTC_CARD_SETUP_MAX_RETRIES) {
          const delay = Math.min(30_000, RTC_CARD_SETUP_RETRY_MS * 2 ** retryAttempts)
          retryAttempts += 1
          retryTimer = window.setTimeout(() => {
            retryTimer = null
            void mountCard()
          }, delay)
        }
      } finally {
        loading = false
        if (queuedRetry && recoverable && !cardRef.current && !cancelled) {
          queuedRetry = false
          retryAttempts = 0
          void mountCard()
        }
      }
    }

    mountCardRef.current = () => {
      if (loading) {
        queuedRetry = true
        return
      }
      retryAttempts = 0
      void mountCard()
    }
    void mountCard()
    return () => {
      cancelled = true
      mountCardRef.current = null
      if (retryTimer !== null) window.clearTimeout(retryTimer)
      stopWatching?.()
      stopChrome?.()
      unregisterActions?.()
      window.removeEventListener('webrtc-audio-state', handleAudioState)
      cardRef.current = null
      host.replaceChildren()
    }
  }, [camera.entityId, camera.rtcStreamId, camera.title, cardId, controls, fill, variant])

  useEffect(() => {
    if (!connection) return
    const retry = () => {
      if (!cardRef.current) mountCardRef.current?.()
    }
    connection.addEventListener('ready', retry)
    return () => connection.removeEventListener('ready', retry)
  }, [connection])

  return (
    <div
      className={styles.frame}
      data-camera-transport="webrtc"
      data-loaded={status === 'live' ? 'true' : 'false'}
      data-fill={fill ? 'true' : 'false'}
      data-status={status}
      data-variant={variant}
      style={{ '--camera-min-height': `${minHeight}px` } as CSSProperties}
    >
      <div className={styles.host} ref={hostRef} />
      {status === 'error' && errorLabel && <div className={styles.message}>{errorLabel}</div>}
    </div>
  )
}

export { RtcPilotCamera as HlsCamera }
