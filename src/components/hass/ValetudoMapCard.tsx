import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useEntity, useHass } from '@hakit/core'
import type { VacuumConfig } from '../../constants/portedDashboard'
import { asEntityName } from './entityState'
import { materialIconPath } from '../core/iconPaths'
import {
  expandValetudoLayerPixels,
  extractValetudoMapFromPngBytes,
  mapCameraEntityId,
  selectValetudoMapEntity,
  valetudoMapBounds,
  type ValetudoEntityLike,
  type ValetudoMap,
  type ValetudoMapBounds,
  type ValetudoMapEntity,
} from './ValetudoMapCard.utils'
import styles from './ValetudoMapCard.module.css'

const VALETUDO_HASS_PULSE_MS = 3_500
const VALETUDO_LIVE_ENTITY_REFRESH_MS = 3_000
const DOCK_ICON_PATH = materialIconPath('mdi:flash')
const ROBOT_ICON_PATH = materialIconPath('mdi:robot-vacuum')

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

function segmentColor(index: number) {
  const colors = [
    'rgba(61, 176, 145, 0.78)',
    'rgba(73, 152, 220, 0.78)',
    'rgba(158, 130, 226, 0.78)',
    'rgba(235, 154, 87, 0.78)',
    'rgba(106, 190, 92, 0.78)',
    'rgba(226, 115, 141, 0.78)',
    'rgba(88, 175, 205, 0.78)',
  ]
  return colors[index % colors.length]
}

function mapPointToCanvas(value: number, min: number, pixelSize: number, scale: number) {
  return (value / pixelSize - min) * scale
}

function drawPolyline(ctx: CanvasRenderingContext2D, entity: ValetudoMapEntity, bounds: ValetudoMapBounds, pixelSize: number, scale: number) {
  const points = entity.points ?? []
  if (points.length < 4) return
  ctx.beginPath()
  ctx.moveTo(mapPointToCanvas(points[0] ?? 0, bounds.minX, pixelSize, scale), mapPointToCanvas(points[1] ?? 0, bounds.minY, pixelSize, scale))
  for (let index = 2; index + 1 < points.length; index += 2) {
    ctx.lineTo(mapPointToCanvas(points[index] ?? 0, bounds.minX, pixelSize, scale), mapPointToCanvas(points[index + 1] ?? 0, bounds.minY, pixelSize, scale))
  }
  ctx.stroke()
}

function drawPolygon(ctx: CanvasRenderingContext2D, entity: ValetudoMapEntity, bounds: ValetudoMapBounds, pixelSize: number, scale: number) {
  const points = entity.points ?? []
  if (points.length < 6) return
  ctx.beginPath()
  ctx.moveTo(mapPointToCanvas(points[0] ?? 0, bounds.minX, pixelSize, scale), mapPointToCanvas(points[1] ?? 0, bounds.minY, pixelSize, scale))
  for (let index = 2; index + 1 < points.length; index += 2) {
    ctx.lineTo(mapPointToCanvas(points[index] ?? 0, bounds.minX, pixelSize, scale), mapPointToCanvas(points[index + 1] ?? 0, bounds.minY, pixelSize, scale))
  }
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

function drawMapIcon(ctx: CanvasRenderingContext2D, iconPath: string, x: number, y: number, size: number, color: string, rotationRadians = 0, haloColor = 'rgba(8, 16, 24, 0.72)') {
  ctx.save()
  ctx.translate(x, y)
  ctx.beginPath()
  ctx.fillStyle = haloColor
  ctx.arc(0, 0, size * 0.62, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = Math.max(1.5, size * 0.08)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.86)'
  ctx.stroke()
  ctx.rotate(rotationRadians)
  ctx.scale(size / 24, size / 24)
  ctx.translate(-12, -12)
  ctx.fillStyle = color
  ctx.fill(new Path2D(iconPath))
  ctx.restore()
}

function drawMapEntityIcon(ctx: CanvasRenderingContext2D, entity: ValetudoMapEntity, bounds: ValetudoMapBounds, pixelSize: number, scale: number, iconPath: string, color: string, rotationRadians = 0, haloColor?: string) {
  const points = entity.points ?? []
  if (points.length < 2) return
  drawMapIcon(
    ctx,
    iconPath,
    mapPointToCanvas(points[0] ?? 0, bounds.minX, pixelSize, scale),
    mapPointToCanvas(points[1] ?? 0, bounds.minY, pixelSize, scale),
    Math.max(18, scale * 8),
    color,
    rotationRadians,
    haloColor,
  )
}

function renderValetudoMap(canvas: HTMLCanvasElement, map: ValetudoMap, mapScale: number) {
  const bounds = valetudoMapBounds(map)
  const scale = Math.max(1, mapScale)
  const width = Math.max(1, Math.ceil((bounds.maxX - bounds.minX + 2) * scale))
  const height = Math.max(1, Math.ceil((bounds.maxY - bounds.minY + 2) * scale))
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.ceil(width * dpr)
  canvas.height = Math.ceil(height * dpr)
  canvas.style.aspectRatio = `${width} / ${height}`
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = 'rgba(6, 12, 18, 0.56)'
  ctx.fillRect(0, 0, width, height)

  let segmentIndex = 0
  for (const layer of map.layers) {
    const pixels = expandValetudoLayerPixels(layer)
    if (pixels.length === 0) continue
    ctx.fillStyle = layer.type === 'wall' ? 'rgba(236, 244, 255, 0.82)' : segmentColor(segmentIndex)
    if (layer.type === 'segment') segmentIndex += 1
    for (let index = 0; index + 1 < pixels.length; index += 2) {
      ctx.fillRect(((pixels[index] ?? 0) - bounds.minX) * scale, ((pixels[index + 1] ?? 0) - bounds.minY) * scale, scale, scale)
    }
  }

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const entity of map.entities) {
    if (entity.type === 'path' || entity.type === 'predicted_path') {
      ctx.lineWidth = Math.max(2, scale * 0.8)
      ctx.strokeStyle = entity.type === 'path' ? 'rgba(255, 255, 255, 0.72)' : 'rgba(255, 255, 255, 0.36)'
      drawPolyline(ctx, entity, bounds, map.pixelSize, scale)
    }
  }

  for (const entity of map.entities) {
    if (entity.type === 'no_go_area' || entity.type === 'no_mop_area') {
      ctx.lineWidth = 2
      ctx.fillStyle = entity.type === 'no_go_area' ? 'rgba(239, 83, 80, 0.22)' : 'rgba(33, 150, 243, 0.2)'
      ctx.strokeStyle = entity.type === 'no_go_area' ? 'rgba(255, 138, 128, 0.76)' : 'rgba(144, 202, 249, 0.76)'
      drawPolygon(ctx, entity, bounds, map.pixelSize, scale)
    }
  }

  for (const entity of map.entities) {
    if (entity.type === 'charger_location') {
      drawMapEntityIcon(ctx, entity, bounds, map.pixelSize, scale, DOCK_ICON_PATH, '#66bb6a', 0, 'rgba(18, 56, 30, 0.76)')
    }
    if (entity.type === 'robot_position') {
      const angle = typeof entity.metaData?.angle === 'number' ? entity.metaData.angle : 0
      const radians = ((angle - 90) * Math.PI) / 180
      drawMapEntityIcon(ctx, entity, bounds, map.pixelSize, scale, ROBOT_ICON_PATH, '#f8fafc', radians)
    }
  }
}

interface ValetudoMapCardProps {
  vacuum: VacuumConfig
}

export function ValetudoMapCard({ vacuum }: ValetudoMapCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fetchedMapCameraEntity, setFetchedMapCameraEntity] = useState<ValetudoEntityLike | null>(null)
  const [fetchedVacuumEntity, setFetchedVacuumEntity] = useState<ValetudoEntityLike | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [map, setMap] = useState<ValetudoMap | null>(null)
  const connection = useHass((state) => state.connection) as unknown as HassConnectionLike | null | undefined
  const entities = useHass((state) => state.entities)
  const config = useHass((state) => state.config)
  const services = useHass((state) => state.services)
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
  }, [hassShim])

  useEffect(() => {
    let cancelled = false
    if (isMockMode || !connection || !injectedMapCameraEntity) {
      setIsLoaded(false)
      return undefined
    }

    const fetchMap = () => {
      createFetchWithAuth(connection)(cameraImageUrl)
        .then(async (response) => {
          if (!response.ok) throw new Error(`Camera image request failed (${response.status})`)
          const bytes = new Uint8Array(await response.arrayBuffer())
          const parsedMap = await extractValetudoMapFromPngBytes(bytes)
          if (cancelled) return
          setMap(parsedMap)
          setError(null)
          setIsLoaded(true)
        })
        .catch((caughtError: unknown) => {
          if (cancelled) return
          setIsLoaded(false)
          setError(caughtError instanceof Error ? caughtError.message : 'Unable to load Valetudo map')
        })
    }

    fetchMap()
    const timer = window.setInterval(fetchMap, VALETUDO_HASS_PULSE_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [cameraImageUrl, connection, injectedMapCameraEntity, isMockMode])

  useEffect(() => {
    if (!map || !canvasRef.current) return
    renderValetudoMap(canvasRef.current, map, vacuum.mapScale)
  }, [map, vacuum.mapScale])

  useEffect(() => {
    if (!map || !canvasRef.current) return undefined
    const redraw = () => {
      if (canvasRef.current) renderValetudoMap(canvasRef.current, map, vacuum.mapScale)
    }
    window.addEventListener('resize', redraw)
    return () => window.removeEventListener('resize', redraw)
  }, [map, vacuum.mapScale])

  useEffect(() => {
    if (!map || !canvasRef.current) return undefined
    const canvas = canvasRef.current
    const observer = new ResizeObserver(() => renderValetudoMap(canvas, map, vacuum.mapScale))
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [map, vacuum.mapScale])

  useEffect(() => {
    if (!isMockMode && map) return
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    canvas.width = 400
    canvas.height = 260
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = 'rgba(6, 12, 18, 0.7)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'
    for (let x = 0; x < canvas.width; x += 28) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvas.height)
      ctx.stroke()
    }
    for (let y = 0; y < canvas.height; y += 28) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvas.width, y)
      ctx.stroke()
    }
  }, [isMockMode, map])

  useEffect(() => {
    if (!isMockMode) return undefined
    const timer = window.setTimeout(() => {
      setIsLoaded(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [isMockMode])

  useEffect(() => {
    if (!connection) return undefined

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
  }, [cameraEntityId, connection, vacuum.entityId])

  const showFallback = isMockMode || Boolean(error)
  const mapRotation = `${vacuum.mapRotationDegrees ?? 0}deg`

  return (
    <div
      aria-label={`${vacuum.title} Valetudo map`}
      className={styles.frame}
      data-loaded={isLoaded ? 'true' : 'false'}
      role="region"
      style={{ '--map-min-height': vacuum.mapScale > 2 ? '300px' : '340px', '--map-rotation': mapRotation } as CSSProperties}
    >
      <div className={styles.host}>
        <canvas aria-hidden="true" className={styles.canvas} data-valetudo-map-canvas="true" ref={canvasRef} />
      </div>
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
