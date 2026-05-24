import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useEntity, useHass } from '@hakit/core'
import type { VacuumConfig } from '../../constants/portedDashboard'
import { asEntityName } from './entityState'
import { materialIconPath } from '../core/iconPaths'
import { mapCameraEntityId, selectValetudoMapEntity, type ValetudoEntityLike } from './ValetudoMapCard.utils'
import styles from './ValetudoMapCard.module.css'

const VALETUDO_MAP_RESOURCE_PATH = '/hacsfiles/lovelace-valetudo-map-card/valetudo-map-card.js'
const VALETUDO_ELEMENT_NAME = 'valetudo-map-card'
const VALETUDO_CHROME_STYLE_ID = 'sfenton-valetudo-map-card-chrome'
const VALETUDO_HASS_PULSE_MS = 3_500
const VALETUDO_LIVE_ENTITY_REFRESH_MS = 3_000

type CallService = (params: Record<string, unknown>) => void
type FetchWithAuth = (path: string, init?: RequestInit) => Promise<Response>

interface HassStateChangedEvent {
  data?: {
    entity_id?: string
    new_state?: ValetudoEntityLike | null
  }
}

interface HassConnectionLike {
  options?: { auth?: { accessToken?: string } }
  sendMessagePromise?: <T>(message: Record<string, unknown>) => Promise<T>
  subscribeEvents?: <T>(callback: (event: T) => void, eventType?: string) => Promise<() => void> | (() => void)
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

function ensureHaIconElement() {
  if (customElements.get('ha-icon')) return

  customElements.define(
    'ha-icon',
    class ReactDashHaIcon extends HTMLElement {
      private iconName = ''

      static get observedAttributes() {
        return ['icon']
      }

      constructor() {
        super()
        this.attachShadow({ mode: 'open' })
      }

      get icon() {
        return this.iconName
      }

      set icon(value: string) {
        this.iconName = value
        this.render()
      }

      attributeChangedCallback(_name: string, _oldValue: string | null, newValue: string | null) {
        this.icon = newValue ?? ''
      }

      connectedCallback() {
        this.render()
      }

      private render() {
        if (!this.shadowRoot) return

        const iconPath = this.iconName ? materialIconPath(this.iconName) : ''

        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: ${iconPath ? 'inline-grid' : 'none'};
              width: 24px;
              height: 24px;
              place-items: center;
              color: inherit;
              line-height: 0;
            }

            svg {
              width: 24px;
              height: 24px;
              fill: currentColor;
            }
          </style>
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
            <path d="${iconPath}"></path>
          </svg>
        `
      }
    },
  )
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
        min-height: inherit !important;
        border: none !important;
        box-shadow: none !important;
        background: transparent !important;
      }

      #valetudoMapCardMap {
        min-height: inherit !important;
      }
    `
    shadowRoot.appendChild(style)
  }

  applyStyle()
  window.requestAnimationFrame(applyStyle)
}

function valetudoMapConfig(vacuumMapId: string, mapScale: number) {
  return {
    type: 'custom:valetudo-map-card',
    vacuum: vacuumMapId,
    title: '',
    background_color: 'transparent',
    show_status: false,
    show_start_button: false,
    show_pause_button: false,
    show_stop_button: false,
    show_home_button: false,
    show_locate_button: false,
    map_scale: mapScale,
    card_mod: {
      style: 'ha-card { border: none !important; box-shadow: none !important; background: transparent !important; }',
    },
  }
}

function selectLiveEntity(entityId: string, storeEntity: ValetudoEntityLike | null, liveEntity: ValetudoEntityLike | null) {
  return liveEntity?.entity_id === entityId ? liveEntity : storeEntity
}

function authToken(connection: HassConnectionLike | null | undefined) {
  return connection?.options?.auth?.accessToken
}

function createFetchWithAuth(connection: HassConnectionLike | null | undefined): FetchWithAuth {
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
  const [fetchedMapCameraEntity, setFetchedMapCameraEntity] = useState<ValetudoEntityLike | null>(null)
  const [fetchedVacuumEntity, setFetchedVacuumEntity] = useState<ValetudoEntityLike | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [showCameraFallback, setShowCameraFallback] = useState(false)
  const connection = useHass((state) => state.connection) as unknown as HassConnectionLike | null | undefined
  const entities = useHass((state) => state.entities)
  const config = useHass((state) => state.config)
  const services = useHass((state) => state.services)
  const hassUrl = useHass((state) => state.hassUrl)
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const joinHassUrl = useHass((state) => state.helpers.joinHassUrl)
  const isMockMode = import.meta.env.MODE === 'test'
  const cameraEntityId = mapCameraEntityId(vacuum.vacuumMapId)
  const mapCameraEntity = useEntity(asEntityName(cameraEntityId), { returnNullIfNotFound: true }) as ValetudoEntityLike | null
  const vacuumEntity = useEntity(asEntityName(vacuum.entityId), { returnNullIfNotFound: true }) as ValetudoEntityLike | null
  const liveMapCameraEntity = fetchedMapCameraEntity?.entity_id === cameraEntityId ? fetchedMapCameraEntity : null
  const liveVacuumEntity = fetchedVacuumEntity?.entity_id === vacuum.entityId ? fetchedVacuumEntity : null
  const injectedMapCameraEntity = selectValetudoMapEntity(cameraEntityId, mapCameraEntity, liveMapCameraEntity)
  const injectedVacuumEntity = selectLiveEntity(vacuum.entityId, vacuumEntity, liveVacuumEntity)
  const hasMapCameraEntity = Boolean(injectedMapCameraEntity)
  const entityPicture = typeof injectedMapCameraEntity?.attributes.entity_picture === 'string' ? injectedMapCameraEntity.attributes.entity_picture : undefined
  const cameraImageUrl = entityPicture ?? `/api/camera_proxy/${cameraEntityId}`
  const states = useMemo(() => {
    if (!injectedMapCameraEntity && !injectedVacuumEntity) return entities

    return {
      ...entities,
      ...(injectedMapCameraEntity ? { [cameraEntityId]: injectedMapCameraEntity } : {}),
      ...(injectedVacuumEntity ? { [vacuum.entityId]: injectedVacuumEntity } : {}),
    }
  }, [cameraEntityId, entities, injectedMapCameraEntity, injectedVacuumEntity, vacuum.entityId])

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
        if (!connection?.sendMessagePromise) return Promise.reject(new Error('Home Assistant connection is not ready'))
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
    if (!hasMapCameraEntity) return undefined
    if (elementRef.current) return undefined

    let cancelled = false

    loadValetudoMapModule()
      .then(() => {
        if (cancelled || !hostRef.current) return

        host.textContent = ''
        ensureHomeAssistantRoot()
        ensureHaIconElement()
        const valetudoElement = document.createElement(VALETUDO_ELEMENT_NAME) as ValetudoElement
        valetudoElement.style.display = 'block'
        valetudoElement.style.width = '100%'
        valetudoElement.style.height = '100%'
        valetudoElement.setConfig(valetudoMapConfig(vacuum.vacuumMapId, vacuum.mapScale))
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
  }, [connection, hasMapCameraEntity, hassUrl, isMockMode, vacuum.mapScale, vacuum.vacuumMapId])

  useEffect(() => {
    if (isMockMode || !connection) return undefined

    let cancelled = false
    let unsubscribe: (() => void) | undefined

    const fetchEntityState = async (entityId: string) => {
      const entityResponse = await createFetchWithAuth(connection)(`/api/states/${entityId}`)
      if (entityResponse.ok) return entityResponse.json() as Promise<ValetudoEntityLike>

      if (!connection.sendMessagePromise) return null
      const statesList = await connection.sendMessagePromise<ValetudoEntityLike[]>({ type: 'get_states' })
      return statesList.find((entity) => entity.entity_id === entityId) ?? null
    }

    const updateLiveEntity = (entity: ValetudoEntityLike | null | undefined) => {
      if (cancelled) return
      if (entity?.entity_id === cameraEntityId) setFetchedMapCameraEntity(entity)
      if (entity?.entity_id === vacuum.entityId) setFetchedVacuumEntity(entity)
    }

    const refreshLiveEntities = () => {
      void Promise.all([fetchEntityState(cameraEntityId), fetchEntityState(vacuum.entityId)])
        .then((liveEntities) => liveEntities.forEach(updateLiveEntity))
        .catch(() => undefined)
    }

    refreshLiveEntities()
    const metadataRefreshTimer = window.setInterval(refreshLiveEntities, VALETUDO_LIVE_ENTITY_REFRESH_MS)
    const subscription = connection.subscribeEvents?.<HassStateChangedEvent>((event) => {
      if (event.data?.entity_id !== cameraEntityId && event.data?.entity_id !== vacuum.entityId) return
      updateLiveEntity(event.data.new_state)
    }, 'state_changed')

    if (subscription) {
      void Promise.resolve(subscription)
        .then((resolvedUnsubscribe) => {
          if (cancelled) {
            resolvedUnsubscribe()
            return
          }
          unsubscribe = resolvedUnsubscribe
        })
        .catch(() => undefined)
    }

    return () => {
      cancelled = true
      window.clearInterval(metadataRefreshTimer)
      unsubscribe?.()
    }
  }, [cameraEntityId, connection, isMockMode, vacuum.entityId])

  useEffect(() => {
    if (isMockMode || !isLoaded) return undefined

    const pulseValetudoHass = () => {
      if (!elementRef.current) return
      elementRef.current.hass = hassShimRef.current
    }

    const pulseTimer = window.setInterval(pulseValetudoHass, VALETUDO_HASS_PULSE_MS)
    return () => window.clearInterval(pulseTimer)
  }, [isLoaded, isMockMode])

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
