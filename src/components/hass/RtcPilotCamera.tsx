import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useHass } from '@hakit/core'
import type { CameraConfig } from '../../constants/atAGlance'
import {
  publishCameraStreamMuteState,
  registerCameraStreamActionTarget,
} from './cameraStreamActions'
import { CAMERA_STREAM_PHASE, type CameraStreamStatus } from './cameraStreamStatus'
import {
  forgetRtcStreamCard,
  parkRtcCard,
  rememberRtcStreamCard,
  rtcCardPoolKey,
  rtcPosterSource,
  rtcVideoHasFrame,
  setRtcStreamWarm,
  takePooledRtcCard,
  type RtcCardElement,
} from './rtcCardPool'
import { rtcCardResourceUrl } from './rtcCardResource'
import { retainRtcStream, rtcStreamConfig } from './rtcStreamRetention'
import styles from './HlsCamera.module.css'
import rtcStyles from './RtcPilotCamera.module.css'

const RTC_CARD_TAG = 'webrtc-camera-sfenton'
const RTC_CHROME_STYLE_ID = 'sfenton-rtc-chrome'
const RTC_CARD_SETUP_RETRY_MS = 2_000
const RTC_CARD_SETUP_MAX_RETRIES = 5
const RTC_FIRST_FRAME_FALLBACK_MS = 1_500
const RTC_FRAME_EVENTS = ['loadeddata', 'canplay', 'playing', 'timeupdate', 'resize'] as const

let rtcModulePromise: Promise<void> | null = null
let resourceRetry = 0

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

function importRtcCard(resource: string) {
  // Mock builds have no Home Assistant host, so they register a local stand-in card.
  if (import.meta.env.MODE === 'test') return import('./mockRtcCard')
  return import(/* @vite-ignore */ resource)
}

function loadRtcCard() {
  if (customElements.get(RTC_CARD_TAG)) return Promise.resolve()
  if (!rtcModulePromise) {
    const resource = rtcCardResourceUrl(resourceRetry)
    resourceRetry += 1
    rtcModulePromise = importRtcCard(resource).then(() => {
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

// Live waits for a decoded frame, or a short fallback when the browser never reports one.
function watchRtcStatus(card: RtcCardElement, onStatus: (status: CameraStreamStatus) => void) {
  let last: CameraStreamStatus | null = null
  let frameVideo: HTMLVideoElement | null = null
  let fallbackTimer: number | null = null
  let fallbackElapsed = false
  const emit = (next: CameraStreamStatus) => {
    if (next === last) return
    last = next
    onStatus(next)
  }
  const stopFrameWait = () => {
    if (frameVideo) for (const type of RTC_FRAME_EVENTS) frameVideo.removeEventListener(type, report)
    frameVideo = null
    if (fallbackTimer !== null) window.clearTimeout(fallbackTimer)
    fallbackTimer = null
  }
  function report() {
    const state = card.getAttribute('data-stream-status')
    if (state !== 'connected') {
      stopFrameWait()
      fallbackElapsed = false
      if (state === 'error') emit('error')
      else if (state === null || state === 'idle' || state === 'connecting' || state === 'disconnected') emit('loading')
      else {
        console.error('Unknown RTC stream status:', state)
        emit('error')
      }
      return
    }
    const video = card.video
    if (!video || rtcVideoHasFrame(video) || fallbackElapsed) {
      stopFrameWait()
      emit('live')
      return
    }
    if (frameVideo !== video) {
      stopFrameWait()
      frameVideo = video
      for (const type of RTC_FRAME_EVENTS) video.addEventListener(type, report)
    }
    if (fallbackTimer === null) {
      fallbackTimer = window.setTimeout(() => {
        fallbackTimer = null
        fallbackElapsed = true
        report()
      }, RTC_FIRST_FRAME_FALLBACK_MS)
    }
    emit('loading')
  }
  const observer = new MutationObserver(report)
  observer.observe(card, { attributes: true, attributeFilter: ['data-stream-status'] })
  report()
  return () => {
    observer.disconnect()
    stopFrameWait()
  }
}

function createRtcPoster(host: HTMLElement, card: RtcCardElement, streamId: string, fit: 'cover' | 'contain') {
  let poster: HTMLCanvasElement | null = null
  const remove = () => {
    poster?.remove()
    poster = null
  }
  const update = (status: CameraStreamStatus) => {
    if (status !== CAMERA_STREAM_PHASE.LOADING) {
      remove()
      return
    }
    if (poster) return
    const source = rtcPosterSource(streamId, card)
    if (!source) return
    const canvas = document.createElement('canvas')
    canvas.width = source.videoWidth
    canvas.height = source.videoHeight
    try {
      const drawing = canvas.getContext('2d')
      if (!drawing) return
      drawing.drawImage(source, 0, 0, canvas.width, canvas.height)
    } catch {
      return
    }
    canvas.className = rtcStyles.poster
    canvas.dataset.cameraPoster = 'true'
    canvas.dataset.fit = fit
    canvas.setAttribute('aria-hidden', 'true')
    host.append(canvas)
    poster = canvas
  }
  return { update, remove }
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

  // A layout effect attaches a pooled or already-registered card before the browser paints, so
  // a returning tile never shows an empty frame for even one animation frame.
  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return

    let cancelled = false
    let loading = false
    let queuedRetry = false
    let retryAttempts = 0
    let retryTimer: number | null = null
    let detachCard: ((park: boolean) => void) | null = null
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
    const scheduleRetry = () => {
      if (retryAttempts >= RTC_CARD_SETUP_MAX_RETRIES) return
      const delay = Math.min(30_000, RTC_CARD_SETUP_RETRY_MS * 2 ** retryAttempts)
      retryAttempts += 1
      retryTimer = window.setTimeout(() => {
        retryTimer = null
        mountCard()
      }, delay)
    }
    const fail = (error: unknown, recoverable: boolean) => {
      detachCard?.(false)
      detachCard = null
      host.replaceChildren()
      console.error('Unable to start RTC camera:', error)
      report('error')
      if (recoverable) scheduleRetry()
    }
    const attach = (streamId: string) => {
      const poolKey = rtcCardPoolKey([cardId, streamId, camera.title, controls, fill, variant])
      let card = takePooledRtcCard(poolKey)
      if (!card) {
        const created = document.createElement(RTC_CARD_TAG) as RtcCardElement
        created.className = rtcStyles.card
        created.style.display = 'block'
        created.style.width = '100%'
        created.dataset.dashboardVariant = variant
        created.dataset.dashboardFill = fill ? 'true' : 'false'
        setRtcCardPresentation(created, 'loading')
        created.setConfig({
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
          streams: [rtcStreamConfig(streamId)],
        })
        card = created
      }
      const mounted = card
      let lastStatus: CameraStreamStatus = CAMERA_STREAM_PHASE.LOADING
      let stopChrome: (() => void) | null = null
      let stopWatching: (() => void) | null = null
      let unregisterActions: (() => void) | null = null
      const poster = createRtcPoster(host, mounted, streamId, variant === 'tile' ? 'cover' : 'contain')
      detachCard = (park) => {
        stopWatching?.()
        stopChrome?.()
        unregisterActions?.()
        poster.remove()
        window.removeEventListener('webrtc-audio-state', handleAudioState)
        cardRef.current = null
        if (park && lastStatus !== CAMERA_STREAM_PHASE.ERROR) {
          // Pooled cards reopen with the muted default, like a newly configured card.
          if (mounted.video && !mounted.video.muted) {
            mounted.dispatchEvent(new CustomEvent('webrtc-mute', { detail: { target_id: cardId } }))
          }
          mounted.remove()
          parkRtcCard(poolKey, streamId, mounted)
        } else {
          mounted.remove()
          forgetRtcStreamCard(streamId, mounted)
        }
      }
      mounted.hass = hassShimRef.current
      host.replaceChildren(mounted)
      cardRef.current = mounted
      rememberRtcStreamCard(streamId, mounted)
      retainRtcStream(streamId)
      window.addEventListener('webrtc-audio-state', handleAudioState)
      stopChrome = hideRtcChrome(mounted)
      stopWatching = watchRtcStatus(mounted, (next) => {
        lastStatus = next
        poster.update(next)
        if (next === CAMERA_STREAM_PHASE.LIVE) setRtcStreamWarm(streamId, true)
        else if (next === CAMERA_STREAM_PHASE.ERROR) setRtcStreamWarm(streamId, false)
        report(next)
      })
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
    }
    const attachOrFail = (streamId: string) => {
      try {
        attach(streamId)
      } catch (error) {
        fail(error, true)
      }
    }
    function mountCard() {
      if (cancelled || loading || cardRef.current) return
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer)
        retryTimer = null
      }
      const streamId = camera.rtcStreamId
      if (!streamId) {
        fail(new Error(`No RTC stream configured for ${camera.entityId}`), false)
        return
      }
      if (customElements.get(RTC_CARD_TAG)) {
        attachOrFail(streamId)
        return
      }
      loading = true
      report('loading')
      loadRtcCard().then(() => {
        if (!cancelled) attachOrFail(streamId)
      }, (error: unknown) => {
        if (!cancelled) fail(error, true)
      }).finally(() => {
        loading = false
        if (queuedRetry && !cardRef.current && !cancelled) {
          queuedRetry = false
          retryAttempts = 0
          mountCard()
        }
      })
    }

    mountCardRef.current = () => {
      if (loading) {
        queuedRetry = true
        return
      }
      retryAttempts = 0
      mountCard()
    }
    mountCard()
    return () => {
      cancelled = true
      mountCardRef.current = null
      if (retryTimer !== null) window.clearTimeout(retryTimer)
      detachCard?.(true)
      detachCard = null
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
      data-loaded={status === CAMERA_STREAM_PHASE.LIVE ? 'true' : 'false'}
      data-fill={fill ? 'true' : 'false'}
      data-status={status}
      data-variant={variant}
      style={{ '--camera-min-height': `${minHeight}px` } as CSSProperties}
    >
      <div className={styles.host} ref={hostRef} />
      {status === CAMERA_STREAM_PHASE.ERROR && errorLabel && <div className={styles.message}>{errorLabel}</div>}
    </div>
  )
}
