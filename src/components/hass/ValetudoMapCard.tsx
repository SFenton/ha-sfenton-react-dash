import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useEntity, useHass } from '@hakit/core'
import type { VacuumConfig } from '../../constants/portedDashboard'
import { asEntityName } from './entityState'
import styles from './ValetudoMapCard.module.css'

const VALETUDO_MAP_RESOURCE_PATH = '/hacsfiles/lovelace-valetudo-map-card/valetudo-map-card.js'
const VALETUDO_ELEMENT_NAME = 'valetudo-map-card'
const VALETUDO_CHROME_STYLE_ID = 'sfenton-valetudo-map-card-chrome'

type CallService = (params: Record<string, unknown>) => void
type FetchWithAuth = (path: string, init?: RequestInit) => Promise<Response>
interface HassEntityLike {
  attributes: Record<string, unknown>
  entity_id: string
  state: string
}

let valetudoMapModulePromise: Promise<void> | null = null

interface ValetudoElement extends HTMLElement {
  drawingMap: boolean
  lastMapPoll: Date
  setConfig: (config: Record<string, unknown>) => void
  hass: unknown
}

function ensureHomeAssistantRoot() {
  const existingRoot = document.getElementsByTagName('home-assistant')[0] as HTMLElement | undefined
  if (existingRoot) return existingRoot

  const root = document.createElement('home-assistant')
  root.setAttribute('aria-hidden', 'true')
  root.style.setProperty('display', 'none')
  root.style.setProperty('--secondary-background-color', 'rgba(148, 163, 184, 0.22)')
  root.style.setProperty('--accent-color', '#38bdf8')
  root.style.setProperty('--secondary-text-color', '#cbd5e1')
  root.style.setProperty('--primary-text-color', '#f8fafc')
  root.style.setProperty('--valetudo-map-floor-color', 'rgba(148, 163, 184, 0.24)')
  root.style.setProperty('--valetudo-map-wall-color', '#e2e8f0')
  root.style.setProperty('--valetudo-map-path-color', '#f8fafc')
  document.body.appendChild(root)
  return root
}

function loadValetudoMapModule() {
  if (customElements.get(VALETUDO_ELEMENT_NAME)) return Promise.resolve()

  if (!valetudoMapModulePromise) {
    valetudoMapModulePromise = import(/* @vite-ignore */ VALETUDO_MAP_RESOURCE_PATH).then(() => undefined)
  }

  return valetudoMapModulePromise
}

function hideValetudoChrome(element: HTMLElement) {
  const applyStyle = () => {
    const { shadowRoot } = element
    if (!shadowRoot || shadowRoot.getElementById(VALETUDO_CHROME_STYLE_ID)) return

    const style = document.createElement('style')
    style.id = VALETUDO_CHROME_STYLE_ID
    style.textContent = `
      ha-card {
        width: 100% !important;
        height: 100% !important;
        border: none !important;
        box-shadow: none !important;
        background: transparent !important;
      }
    `
    shadowRoot.appendChild(style)
  }

  applyStyle()
  window.requestAnimationFrame(applyStyle)
}

function valetudoMapConfig(vacuum: VacuumConfig) {
  return {
    type: 'custom:valetudo-map-card',
    vacuum: vacuum.vacuumMapId,
    title: '',
    background_color: 'transparent',
    show_status: false,
    show_start_button: false,
    show_pause_button: false,
    show_stop_button: false,
    show_home_button: false,
    show_locate_button: false,
    map_scale: vacuum.mapScale,
    card_mod: {
      style: 'ha-card { border: none !important; box-shadow: none !important; background: transparent !important; }',
    },
  }
}

function mapCameraEntityId(vacuumMapId: string) {
  return `camera.${vacuumMapId}_map_data`
}

function authToken(connection: { options?: { auth?: { accessToken?: string } } } | null | undefined) {
  return connection?.options?.auth?.accessToken
}

function createFetchWithAuth(connection: { options?: { auth?: { accessToken?: string } } } | null | undefined): FetchWithAuth {
  return (path, init) => {
    const headers = new Headers(init?.headers)
    const token = authToken(connection)

    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    return fetch(path, { ...init, credentials: init?.credentials ?? 'same-origin', headers })
  }
}

interface ValetudoMapCardProps {
  vacuum: VacuumConfig
}

export function ValetudoMapCard({ vacuum }: ValetudoMapCardProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const elementRef = useRef<ValetudoElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fetchedMapCameraEntity, setFetchedMapCameraEntity] = useState<HassEntityLike | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [showCameraFallback, setShowCameraFallback] = useState(false)
  const connection = useHass((state) => state.connection)
  const entities = useHass((state) => state.entities)
  const config = useHass((state) => state.config)
  const services = useHass((state) => state.services)
  const hassUrl = useHass((state) => state.hassUrl)
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const joinHassUrl = useHass((state) => state.helpers.joinHassUrl)
  const isMockMode = import.meta.env.MODE === 'test'
  const cameraEntityId = mapCameraEntityId(vacuum.vacuumMapId)
  const mapCameraEntity = useEntity(asEntityName(cameraEntityId), { returnNullIfNotFound: true })
  const fallbackMapCameraEntity = fetchedMapCameraEntity?.entity_id === cameraEntityId ? fetchedMapCameraEntity : null
  const injectedMapCameraEntity = mapCameraEntity ?? fallbackMapCameraEntity
  const entityPicture = typeof injectedMapCameraEntity?.attributes.entity_picture === 'string' ? injectedMapCameraEntity.attributes.entity_picture : undefined
  const cameraImageUrl = entityPicture ?? `/api/camera_proxy/${cameraEntityId}`
  const states = useMemo(
    () => (injectedMapCameraEntity ? { ...entities, [cameraEntityId]: injectedMapCameraEntity } : entities),
    [cameraEntityId, entities, injectedMapCameraEntity],
  )

  const hassShim = useMemo(
    () => ({
      connection,
      states,
      config,
      services,
      fetchWithAuth: createFetchWithAuth(connection),
      localize: (key: string) => key,
      hassUrl: joinHassUrl,
      callService: (domain: string, service: string, serviceData?: Record<string, unknown>, target?: unknown) => {
        callService({ domain, service, serviceData, target })
      },
      callWS: (message: { type: string } & Record<string, unknown>) => {
        if (!connection) return Promise.reject(new Error('Home Assistant connection is not ready'))
        return connection.sendMessagePromise(message)
      },
    }),
    [callService, config, connection, joinHassUrl, services, states],
  )
  const hassShimRef = useRef(hassShim)

  useEffect(() => {
    hassShimRef.current = hassShim
    if (elementRef.current) {
      ensureHomeAssistantRoot()
      elementRef.current.drawingMap = false
      elementRef.current.lastMapPoll = new Date(0)
      elementRef.current.hass = hassShim
    }
  }, [hassShim])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined

    if (isMockMode) {
      host.textContent = ''
      return undefined
    }

    if (!hassUrl || !connection) return undefined
    if (!injectedMapCameraEntity) return undefined

    let cancelled = false

    loadValetudoMapModule()
      .then(() => {
        if (cancelled || !hostRef.current) return

        host.textContent = ''
    ensureHomeAssistantRoot()
        const valetudoElement = document.createElement(VALETUDO_ELEMENT_NAME) as ValetudoElement
        valetudoElement.style.display = 'block'
        valetudoElement.style.width = '100%'
        valetudoElement.style.height = '100%'
        valetudoElement.setConfig(valetudoMapConfig(vacuum))
          valetudoElement.drawingMap = false
        valetudoElement.lastMapPoll = new Date(0)
        valetudoElement.hass = hassShimRef.current
        elementRef.current = valetudoElement
        host.appendChild(valetudoElement)
        hideValetudoChrome(valetudoElement)
        setError(null)
        setIsLoaded(true)
      })
      .catch((caughtError: unknown) => {
        if (!cancelled) {
          setIsLoaded(false)
          setError(caughtError instanceof Error ? caughtError.message : 'Unable to load Valetudo map')
        }
      })

    return () => {
      cancelled = true
      elementRef.current = null
      if (host) host.textContent = ''
    }
  }, [connection, hassUrl, injectedMapCameraEntity, isMockMode, vacuum])

  useEffect(() => {
    if (isMockMode || mapCameraEntity || !connection) return undefined

    let cancelled = false

    const fetchMapCameraEntity = async () => {
      const cameraResponse = await createFetchWithAuth(connection)(`/api/states/${cameraEntityId}`)
      if (cameraResponse.ok) return cameraResponse.json() as Promise<HassEntityLike>

      const statesList = await connection.sendMessagePromise<HassEntityLike[]>({ type: 'get_states' })
      return statesList.find((entity) => entity.entity_id === cameraEntityId) ?? null
    }

    fetchMapCameraEntity()
      .then((cameraEntity) => {
        if (cancelled) return
        if (cameraEntity) setFetchedMapCameraEntity(cameraEntity)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [cameraEntityId, connection, isMockMode, mapCameraEntity])

  useEffect(() => {
    if (isMockMode || !isLoaded) return undefined

    const timer = window.setTimeout(() => {
      const warning = elementRef.current?.shadowRoot?.querySelector<HTMLElement>('#valetudoMapCardWarning1')
      setShowCameraFallback(Boolean(warning?.textContent?.match(/Entity not available/i) && warning.style.display !== 'none'))
    }, 700)

    return () => window.clearTimeout(timer)
  }, [injectedMapCameraEntity, isLoaded, isMockMode])

  const showFallback = isMockMode || Boolean(error)
  const showImageFallback = !isMockMode && showCameraFallback

  return (
    <div
      aria-label={`${vacuum.title} Valetudo map`}
      className={styles.frame}
      data-loaded={isLoaded ? 'true' : 'false'}
      role="region"
      style={{ '--map-min-height': vacuum.mapScale > 2 ? '300px' : '340px' } as CSSProperties}
    >
      <div className={styles.host} ref={hostRef} />
      {showImageFallback && <img alt="" className={styles.cameraFallback} src={cameraImageUrl} />}
      {showFallback && (
        <div className={styles.fallback}>
          <span className={styles.fallbackTitle}>Valetudo map</span>
          <span className={styles.fallbackSubtitle}>{vacuum.vacuumMapId}</span>
        </div>
      )}
      {error && <div className={styles.message}>Map unavailable: {error}</div>}
    </div>
  )
}
