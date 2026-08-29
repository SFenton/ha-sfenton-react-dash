import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useEntity, useHass } from '@hakit/core'
import type { VacuumConfig } from '../../constants/portedDashboard'
import { VACUUM_COPY_KEYS, VACUUM_COPY_NAMESPACE, useCopy } from '../../i18n'
import { MaterialIcon } from '../core/Icon'
import { materialIconPath } from '../core/iconPaths'
import { asEntityName } from './entityState'
import { isUnavailableVacuumState } from './vacuumVisualState'
import {
  affineScale,
  affineToCssMatrix,
  applyAffine,
  clampMapViewport,
  invertAffine,
  localPointToGlobalGrid,
  mapGridRectFromPoints,
  mapViewportMatrix,
  resizeMapGridRectCorner,
  translateMapGridRect,
  valetudoMapStageGeometry,
  viewportForAnchor,
  zoomViewportAt,
  type AffineMatrix,
  type MapFrameSize,
  type MapGridPoint,
  type MapGridRect,
  type MapGridRectCorner,
  type MapViewport,
  type ValetudoMapStageGeometry,
} from './ValetudoMapGeometry'
import {
  createMockValetudoMap,
  expandValetudoLayerPixels,
  extractValetudoMapFromPngBytes,
  isReportedMapEntityVisible,
  mapCameraEntityId,
  selectValetudoMapEntity,
  valetudoMapEntityRenderStyle,
  valetudoMapMaterialAccent,
  type ValetudoEntityLike,
  type ValetudoMap,
  type ValetudoMapEntity,
} from './ValetudoMapCard.utils'
import styles from './ValetudoMapCard.module.css'

const VALETUDO_HASS_PULSE_MS = 3_500
const VALETUDO_LIVE_ENTITY_REFRESH_MS = 3_000
const MAP_ZOOM_MIN = 1
const MAP_ZOOM_MAX = 10
const DOCK_ICON_PATH = materialIconPath('mdi:flash')
const GO_TO_ICON_PATH = materialIconPath('mdi:pin')
const OBSTACLE_ICON_PATH = materialIconPath('mdi:alert-circle')
const ROBOT_ICON_PATH = materialIconPath('mdi:robot-vacuum')
const LIVE_ROBOT_COLOR = '#f8fafc'
const REPORTED_ROBOT_STYLE = valetudoMapEntityRenderStyle('obstacle')
const MAP_ICON_PATH_CACHE = new Map<string, Path2D>()
const INITIAL_VIEWPORT: MapViewport = { panX: 0, panY: 0, zoom: 1 }
const IDENTITY_MATRIX: AffineMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

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

export interface ValetudoMapEditorMeta {
  error: string | null
  geometry: ValetudoMapStageGeometry | null
  isLoaded: boolean
  provenance: ValetudoMapProvenance
}

export const VALETUDO_MAP_PROVENANCE_NONE = 'none' as const
export const VALETUDO_MAP_PROVENANCE_REPORTED = 'reported' as const
export type ValetudoMapProvenance = 'live' | typeof VALETUDO_MAP_PROVENANCE_NONE | typeof VALETUDO_MAP_PROVENANCE_REPORTED

interface ValetudoMapCardProps {
  available?: boolean
  drawMode?: boolean
  expanded?: boolean
  frozenGeometry?: ValetudoMapStageGeometry | null
  interactive?: boolean
  minimumSizeCm?: number
  onDrawModeChange?: (drawMode: boolean) => void
  onEditorMetaChange?: (meta: ValetudoMapEditorMeta) => void
  onSelectionChange?: (selection: MapGridRect | null) => void
  resetViewRevision?: number
  selection?: MapGridRect | null
  sourceRevision?: string
  vacuum: VacuumConfig
}

type MapGesture =
  | { anchor: MapGridPoint; type: 'draw' }
  | { origin: MapGridRect; startPoint: MapGridPoint; type: 'move' }
  | { corner: MapGridRectCorner; origin: MapGridRect; type: 'resize' }
  | { origin: MapViewport; startPoint: MapGridPoint; type: 'pan' }
  | { anchor: MapGridPoint; startDistance: number; startZoom: number; type: 'pinch' }

const RESIZE_HANDLES: {
  corner: MapGridRectCorner
  diagonal: 'nwse' | 'nesw'
  label: string
  x: 'x0' | 'x1'
  y: 'y0' | 'y1'
}[] = [
  { corner: 'pA', diagonal: 'nwse', label: 'corner A', x: 'x0', y: 'y0' },
  { corner: 'pB', diagonal: 'nesw', label: 'corner B', x: 'x1', y: 'y0' },
  { corner: 'pC', diagonal: 'nwse', label: 'corner C', x: 'x1', y: 'y1' },
  { corner: 'pD', diagonal: 'nesw', label: 'corner D', x: 'x0', y: 'y1' },
]

function authToken(connection: HassConnectionLike | null | undefined) {
  return connection?.options?.auth?.accessToken
}

function createFetchWithAuth(connection: HassConnectionLike | null | undefined): FetchWithAuth {
  return (path, init) => {
    const headers = new Headers(init?.headers)
    const token = authToken(connection)

    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
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

function mapIconCanvasPath(iconPath: string) {
  const cached = MAP_ICON_PATH_CACHE.get(iconPath)
  if (cached) return cached
  const path = new Path2D(iconPath)
  MAP_ICON_PATH_CACHE.set(iconPath, path)
  return path
}

function mapPointToLocal(value: number, minimum: number, pixelSize: number) {
  return value / pixelSize - minimum
}

function drawPolyline(ctx: CanvasRenderingContext2D, entity: ValetudoMapEntity, geometry: ValetudoMapStageGeometry) {
  const points = entity.points ?? []
  if (points.length < 4) return
  ctx.beginPath()
  ctx.moveTo(mapPointToLocal(points[0] ?? 0, geometry.minGridX, geometry.pixelSize), mapPointToLocal(points[1] ?? 0, geometry.minGridY, geometry.pixelSize))
  for (let index = 2; index + 1 < points.length; index += 2) {
    ctx.lineTo(mapPointToLocal(points[index] ?? 0, geometry.minGridX, geometry.pixelSize), mapPointToLocal(points[index + 1] ?? 0, geometry.minGridY, geometry.pixelSize))
  }
  ctx.stroke()
}

function drawPolygon(ctx: CanvasRenderingContext2D, entity: ValetudoMapEntity, geometry: ValetudoMapStageGeometry) {
  const points = entity.points ?? []
  if (points.length < 6) return
  ctx.beginPath()
  ctx.moveTo(mapPointToLocal(points[0] ?? 0, geometry.minGridX, geometry.pixelSize), mapPointToLocal(points[1] ?? 0, geometry.minGridY, geometry.pixelSize))
  for (let index = 2; index + 1 < points.length; index += 2) {
    ctx.lineTo(mapPointToLocal(points[index] ?? 0, geometry.minGridX, geometry.pixelSize), mapPointToLocal(points[index + 1] ?? 0, geometry.minGridY, geometry.pixelSize))
  }
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

function drawMapIcon(
  ctx: CanvasRenderingContext2D,
  iconPath: string,
  x: number,
  y: number,
  size: number,
  color: string,
  rotationRadians = 0,
  haloColor = 'rgba(8, 16, 24, 0.72)',
) {
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
  ctx.fill(mapIconCanvasPath(iconPath))
  ctx.restore()
}

function drawMapEntityIcon(
  ctx: CanvasRenderingContext2D,
  entity: ValetudoMapEntity,
  geometry: ValetudoMapStageGeometry,
  iconPath: string,
  color: string,
  screenScale: number,
  rotationRadians = 0,
  haloColor?: string,
  screenSize = 22,
) {
  const points = entity.points ?? []
  if (points.length < 2) return
  drawMapIcon(
    ctx,
    iconPath,
    mapPointToLocal(points[0] ?? 0, geometry.minGridX, geometry.pixelSize),
    mapPointToLocal(points[1] ?? 0, geometry.minGridY, geometry.pixelSize),
    Math.max(4, screenSize / Math.max(screenScale, 0.01)),
    color,
    rotationRadians,
    haloColor,
  )
}

function localVisibleBounds(matrix: AffineMatrix, frame: MapFrameSize) {
  const inverse = invertAffine(matrix)
  const corners = [
    applyAffine(inverse, { x: 0, y: 0 }),
    applyAffine(inverse, { x: frame.width, y: 0 }),
    applyAffine(inverse, { x: frame.width, y: frame.height }),
    applyAffine(inverse, { x: 0, y: frame.height }),
  ]
  return {
    maxX: Math.max(...corners.map((point) => point.x)) + 2,
    maxY: Math.max(...corners.map((point) => point.y)) + 2,
    minX: Math.min(...corners.map((point) => point.x)) - 2,
    minY: Math.min(...corners.map((point) => point.y)) - 2,
  }
}

function renderValetudoMap(
  canvas: HTMLCanvasElement,
  map: ValetudoMap,
  geometry: ValetudoMapStageGeometry,
  frame: MapFrameSize,
  matrix: AffineMatrix,
  provenance: Exclude<ValetudoMapProvenance, 'none'>,
) {
  const dpr = window.devicePixelRatio || 1
  const width = Math.max(1, Math.round(frame.width))
  const height = Math.max(1, Math.round(frame.height))
  const canvasWidth = Math.ceil(width * dpr)
  const canvasHeight = Math.ceil(height * dpr)
  if (canvas.width !== canvasWidth) canvas.width = canvasWidth
  if (canvas.height !== canvasHeight) canvas.height = canvasHeight
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = 'rgba(6, 12, 18, 0.56)'
  ctx.fillRect(0, 0, width, height)
  ctx.setTransform(dpr * matrix.a, dpr * matrix.b, dpr * matrix.c, dpr * matrix.d, dpr * matrix.e, dpr * matrix.f)

  const visible = localVisibleBounds(matrix, frame)
  let segmentIndex = 0
  for (const layer of map.layers) {
    const pixels = expandValetudoLayerPixels(layer)
    if (pixels.length === 0) continue
    const isSegment = layer.type === 'segment'
    const material = isSegment ? layer.metaData?.material : undefined
    const accentPixels: number[] = []
    ctx.fillStyle = layer.type === 'wall' ? 'rgba(236, 244, 255, 0.82)' : segmentColor(segmentIndex)
    if (isSegment) segmentIndex += 1
    for (let index = 0; index + 1 < pixels.length; index += 2) {
      const sourceX = pixels[index] ?? 0
      const sourceY = pixels[index + 1] ?? 0
      const x = sourceX - geometry.minGridX
      const y = sourceY - geometry.minGridY
      if (x < visible.minX || x > visible.maxX || y < visible.minY || y > visible.maxY) continue
      ctx.fillRect(x, y, 1.02, 1.02)
      if (material && valetudoMapMaterialAccent(material, sourceX, sourceY)) accentPixels.push(x, y)
    }

    if (!material || accentPixels.length === 0) continue
    ctx.fillStyle = material.startsWith('carpet') ? 'rgba(255, 255, 255, 0.17)' : 'rgba(5, 12, 18, 0.24)'
    for (let index = 0; index + 1 < accentPixels.length; index += 2) {
      ctx.fillRect(accentPixels[index] ?? 0, accentPixels[index + 1] ?? 0, 1.02, 1.02)
    }
  }

  const screenScale = affineScale(matrix)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const entity of map.entities) {
    if (entity.type === 'path' || entity.type === 'predicted_path') {
      ctx.lineWidth = Math.max(0.25, 2 / Math.max(screenScale, 0.01))
      ctx.strokeStyle = entity.type === 'path' ? 'rgba(255, 255, 255, 0.72)' : 'rgba(255, 255, 255, 0.36)'
      drawPolyline(ctx, entity, geometry)
    }
  }

  for (const entity of map.entities) {
    const style = valetudoMapEntityRenderStyle(entity.type)
    if (!style || style.shape === 'point') continue
    ctx.save()
    if (style.lineDash?.length) ctx.setLineDash(style.lineDash.map((length) => length / Math.max(screenScale, 0.01)))
    ctx.strokeStyle = style.strokeStyle
    ctx.fillStyle = style.fillStyle ?? 'rgba(0, 0, 0, 0)'
    if (style.shape === 'polygon') {
      ctx.lineWidth = Math.max(0.2, 2 / Math.max(screenScale, 0.01))
      drawPolygon(ctx, entity, geometry)
    } else {
      ctx.lineWidth = Math.max(0.3, 3 / Math.max(screenScale, 0.01))
      drawPolyline(ctx, entity, geometry)
    }
    ctx.restore()
  }

  for (const entity of map.entities) {
    const style = valetudoMapEntityRenderStyle(entity.type)
    if (!style || style.shape !== 'point' || !style.icon) continue
    drawMapEntityIcon(
      ctx,
      entity,
      geometry,
      style.icon === 'obstacle' ? OBSTACLE_ICON_PATH : GO_TO_ICON_PATH,
      style.strokeStyle,
      screenScale,
      0,
      style.haloColor,
      style.icon === 'obstacle' ? 15 : 18,
    )
  }

  for (const entity of map.entities) {
    if (entity.type === 'charger_location') {
      drawMapEntityIcon(ctx, entity, geometry, DOCK_ICON_PATH, '#66bb6a', screenScale, 0, 'rgba(18, 56, 30, 0.76)')
    }
    if (entity.type === 'robot_position') {
      const angle = typeof entity.metaData?.angle === 'number' ? entity.metaData.angle : 0
      const radians = ((angle - 90) * Math.PI) / 180
      drawMapEntityIcon(
        ctx,
        entity,
        geometry,
        ROBOT_ICON_PATH,
        provenance === 'reported' ? REPORTED_ROBOT_STYLE?.strokeStyle ?? LIVE_ROBOT_COLOR : LIVE_ROBOT_COLOR,
        screenScale,
        radians,
        provenance === 'reported' ? REPORTED_ROBOT_STYLE?.haloColor : undefined,
      )
    }
  }
}

function renderFallbackGrid(canvas: HTMLCanvasElement, frame: MapFrameSize) {
  const dpr = window.devicePixelRatio || 1
  const width = Math.max(1, Math.round(frame.width))
  const height = Math.max(1, Math.round(frame.height))
  const canvasWidth = Math.ceil(width * dpr)
  const canvasHeight = Math.ceil(height * dpr)
  if (canvas.width !== canvasWidth) canvas.width = canvasWidth
  if (canvas.height !== canvasHeight) canvas.height = canvasHeight
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = 'rgba(6, 12, 18, 0.7)'
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
  for (let x = 0; x < width; x += 28) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }
  for (let y = 0; y < height; y += 28) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }
}

function pointerDistance(first: MapGridPoint, second: MapGridPoint) {
  return Math.hypot(second.x - first.x, second.y - first.y)
}

function pointerMidpoint(first: MapGridPoint, second: MapGridPoint): MapGridPoint {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }
}

function keyboardDelta(event: ReactKeyboardEvent<SVGElement>) {
  const step = event.shiftKey ? 10 : 1
  if (event.key === 'ArrowLeft') return { x: -step, y: 0 }
  if (event.key === 'ArrowRight') return { x: step, y: 0 }
  if (event.key === 'ArrowUp') return { x: 0, y: -step }
  if (event.key === 'ArrowDown') return { x: 0, y: step }
  return null
}

export function ValetudoMapCard({
  available = true,
  drawMode = false,
  expanded = false,
  frozenGeometry = null,
  interactive = false,
  minimumSizeCm = 25,
  onDrawModeChange,
  onEditorMetaChange,
  onSelectionChange,
  resetViewRevision = 0,
  selection = null,
  sourceRevision,
  vacuum,
}: ValetudoMapCardProps) {
  const copy = useCopy(VACUUM_COPY_NAMESPACE)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const overlayRef = useRef<SVGSVGElement | null>(null)
  const pointersRef = useRef(new Map<number, MapGridPoint>())
  const gestureRef = useRef<MapGesture | null>(null)
  const draftRectRef = useRef<MapGridRect | null>(null)
  const viewportRef = useRef<MapViewport>(INITIAL_VIEWPORT)
  const matrixRef = useRef<AffineMatrix>(IDENTITY_MATRIX)
  const [draftRect, setDraftRectState] = useState<MapGridRect | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fetchedMapCameraEntity, setFetchedMapCameraEntity] = useState<ValetudoEntityLike | null>(null)
  const [fetchedMapCameraMissing, setFetchedMapCameraMissing] = useState(false)
  const [frame, setFrame] = useState<MapFrameSize>({ height: 0, width: 0 })
  const [isLoaded, setIsLoaded] = useState(import.meta.env.MODE === 'test')
  const [loadedMapSourceKey, setLoadedMapSourceKey] = useState<string | null>(null)
  const [map, setMap] = useState<ValetudoMap | null>(() => import.meta.env.MODE === 'test' ? createMockValetudoMap(vacuum.vacuumMapId) : null)
  const [storedViewport, setStoredViewport] = useState<{ revision: number; value: MapViewport }>({
    revision: resetViewRevision,
    value: INITIAL_VIEWPORT,
  })
  const connection = useHass((state) => state.connection) as unknown as HassConnectionLike | null | undefined
  const isMockMode = import.meta.env.MODE === 'test'
  const cameraEntityId = mapCameraEntityId(vacuum.vacuumMapId)
  const mapCameraEntity = useEntity(asEntityName(cameraEntityId), { returnNullIfNotFound: true }) as ValetudoEntityLike | null
  const liveMapCameraEntity = fetchedMapCameraEntity?.entity_id === cameraEntityId ? fetchedMapCameraEntity : null
  const injectedMapCameraEntity = selectValetudoMapEntity(
    cameraEntityId,
    mapCameraEntity,
    liveMapCameraEntity,
    fetchedMapCameraMissing,
  )
  const cameraAvailabilityEntity = injectedMapCameraEntity
  const liveMapSourceAvailable = available
    && Boolean(cameraAvailabilityEntity)
    && !isUnavailableVacuumState(cameraAvailabilityEntity?.state)
  const reportedMapSourceAvailable = !available && Boolean(cameraAvailabilityEntity)
  const mapProvenance: ValetudoMapProvenance = liveMapSourceAvailable
    ? 'live'
    : reportedMapSourceAvailable
      ? 'reported'
      : 'none'
  const mapSourceReadable = mapProvenance !== 'none'
  const entityPicture = typeof injectedMapCameraEntity?.attributes.entity_picture === 'string' ? injectedMapCameraEntity.attributes.entity_picture : undefined
  const cameraProxyUrl = `/api/camera_proxy/${cameraEntityId}`
  const cameraImageUrl = mapProvenance === 'reported' ? cameraProxyUrl : entityPicture ?? cameraProxyUrl
  const mapSourceKey = mapSourceReadable
    ? `${mapProvenance}|${cameraImageUrl}|${cameraAvailabilityEntity?.last_changed ?? ''}|${sourceRevision ?? ''}`
    : null
  const displayedMap = mapSourceReadable && (isMockMode || loadedMapSourceKey === mapSourceKey) ? map : null
  const renderedMap = useMemo(() => {
    if (!displayedMap || mapProvenance !== 'reported') return displayedMap
    return {
      ...displayedMap,
      entities: displayedMap.entities.filter((entity) => isReportedMapEntityVisible(entity.type)),
    }
  }, [displayedMap, mapProvenance])
  const displayedError = mapSourceReadable ? error : null
  const displayedLoaded = mapSourceReadable && Boolean(renderedMap) && isLoaded
  const liveGeometry = useMemo(() => renderedMap ? valetudoMapStageGeometry(renderedMap, vacuum.mapScale) : null, [renderedMap, vacuum.mapScale])
  const mapInteractive = interactive && mapProvenance === 'live'
  const mapExpanded = expanded && mapProvenance === 'live'
  const geometry = mapInteractive ? frozenGeometry ?? liveGeometry : liveGeometry
  const viewport = storedViewport.revision === resetViewRevision ? storedViewport.value : INITIAL_VIEWPORT
  const rotationDegrees = vacuum.mapRotationDegrees ?? 0
  const matrix = useMemo(
    () => geometry ? mapViewportMatrix(geometry, frame, viewport, rotationDegrees) : IDENTITY_MATRIX,
    [frame, geometry, rotationDegrees, viewport],
  )
  const displayedRect = mapProvenance === 'reported' ? null : mapInteractive ? draftRect ?? selection : selection
  const setDraftRect = useCallback((rect: MapGridRect | null) => {
    draftRectRef.current = rect
    setDraftRectState(rect)
  }, [])
  const setViewport = useCallback((nextViewport: MapViewport) => {
    viewportRef.current = nextViewport
    setStoredViewport({ revision: resetViewRevision, value: nextViewport })
  }, [resetViewRevision])

  useEffect(() => {
    matrixRef.current = matrix
    viewportRef.current = viewport
  }, [matrix, viewport])

  useEffect(() => {
    if (isMockMode) return undefined

    let cancelled = false
    if (!connection || !mapSourceReadable) return undefined

    const fetchMap = () => {
      createFetchWithAuth(connection)(cameraImageUrl, mapProvenance === 'reported' ? { cache: 'no-store' } : undefined)
        .then(async (response) => {
          if (!response.ok) throw new Error(`Camera image request failed (${response.status})`)
          const bytes = new Uint8Array(await response.arrayBuffer())
          const parsedMap = await extractValetudoMapFromPngBytes(bytes)
          if (cancelled) return
          setMap(parsedMap)
          setLoadedMapSourceKey(mapSourceKey)
          setError(null)
          setIsLoaded(true)
        })
        .catch((caughtError: unknown) => {
          if (cancelled) return
          setMap(null)
          setLoadedMapSourceKey(null)
          setIsLoaded(false)
          setError(caughtError instanceof Error ? caughtError.message : 'Unable to load Valetudo map')
        })
    }

    fetchMap()
    if (mapProvenance !== 'live') {
      return () => {
        cancelled = true
      }
    }
    const timer = window.setInterval(fetchMap, VALETUDO_HASS_PULSE_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [cameraImageUrl, connection, isMockMode, mapProvenance, mapSourceKey, mapSourceReadable, vacuum.vacuumMapId])

  useEffect(() => {
    if (!connection || isMockMode) return undefined

    let cancelled = false
    let metadataRefreshTimer: number | undefined
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
      if (!entity) {
        setFetchedMapCameraEntity(null)
        setFetchedMapCameraMissing(true)
        return
      }
      if (entity.entity_id === cameraEntityId) {
        setFetchedMapCameraEntity(entity)
        setFetchedMapCameraMissing(false)
      }
    }

    const refreshLiveEntities = () => {
      void fetchEntityState(cameraEntityId)
        .then(updateLiveEntity)
        .catch(() => undefined)
    }

    if (liveMapSourceAvailable) {
      refreshLiveEntities()
      metadataRefreshTimer = window.setInterval(refreshLiveEntities, VALETUDO_LIVE_ENTITY_REFRESH_MS)
    }
    const subscription = connection.subscribeEvents?.<HassStateChangedEvent>((event) => {
      if (event.data?.entity_id !== cameraEntityId) return
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
      if (metadataRefreshTimer !== undefined) window.clearInterval(metadataRefreshTimer)
      unsubscribe?.()
    }
  }, [cameraEntityId, connection, isMockMode, liveMapSourceAvailable])

  useEffect(() => {
    const element = frameRef.current
    if (!element) return undefined

    const syncFrame = () => {
      const rect = element.getBoundingClientRect()
      setFrame({ height: rect.height || element.clientHeight, width: rect.width || element.clientWidth })
    }

    syncFrame()
    window.addEventListener('resize', syncFrame)
    if (typeof ResizeObserver === 'undefined') return () => window.removeEventListener('resize', syncFrame)
    const observer = new ResizeObserver(syncFrame)
    observer.observe(element)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', syncFrame)
    }
  }, [])

  useEffect(() => {
    pointersRef.current.clear()
    gestureRef.current = null
  }, [mapInteractive, resetViewRevision])

  useLayoutEffect(() => {
    onEditorMetaChange?.({ error: displayedError, geometry, isLoaded: displayedLoaded, provenance: mapProvenance })
  }, [displayedError, displayedLoaded, geometry, mapProvenance, onEditorMetaChange])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || frame.width <= 0 || frame.height <= 0) return undefined
    const frameId = window.requestAnimationFrame(() => {
      if (renderedMap && geometry) renderValetudoMap(canvas, renderedMap, geometry, frame, matrix, mapProvenance === 'reported' ? 'reported' : 'live')
      else renderFallbackGrid(canvas, frame)
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [frame, geometry, mapProvenance, matrix, renderedMap])

  const clientPoint = useCallback((event: { clientX: number; clientY: number }): MapGridPoint => {
    const rect = frameRef.current?.getBoundingClientRect()
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) }
  }, [])

  const clientToGlobalGrid = useCallback((point: MapGridPoint) => {
    if (!geometry) return null
    return localPointToGlobalGrid(geometry, applyAffine(invertAffine(matrixRef.current), point))
  }, [geometry])

  const startPinch = useCallback(() => {
    const points = [...pointersRef.current.values()]
    if (points.length < 2 || !geometry) return
    const midpoint = pointerMidpoint(points[0], points[1])
    const anchor = applyAffine(invertAffine(matrixRef.current), midpoint)
    gestureRef.current = {
      anchor,
      startDistance: Math.max(1, pointerDistance(points[0], points[1])),
      startZoom: viewportRef.current.zoom,
      type: 'pinch',
    }
    setDraftRect(null)
  }, [geometry, setDraftRect])

  const handlePointerDown = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (!mapInteractive || !geometry) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = clientPoint(event)
    pointersRef.current.set(event.pointerId, point)

    if (pointersRef.current.size >= 2) {
      startPinch()
      return
    }

    const globalPoint = clientToGlobalGrid(point)
    if (!globalPoint) return
    const target = event.target instanceof Element ? event.target.closest<SVGElement>('[data-editor-action]') : null
    const action = target?.dataset.editorAction

    if (action === 'resize' && selection) {
      const corner = target?.dataset.editorCorner as MapGridRectCorner | undefined
      if (!corner || !RESIZE_HANDLES.some((handle) => handle.corner === corner)) return
      gestureRef.current = { corner, origin: selection, type: 'resize' }
      return
    }
    if (action === 'move' && selection) {
      gestureRef.current = { origin: selection, startPoint: globalPoint, type: 'move' }
      return
    }
    if (drawMode) {
      gestureRef.current = { anchor: globalPoint, type: 'draw' }
      setDraftRect(mapGridRectFromPoints(geometry, globalPoint, globalPoint, Math.ceil(minimumSizeCm / geometry.pixelSize)))
      return
    }

    gestureRef.current = { origin: viewportRef.current, startPoint: point, type: 'pan' }
  }, [clientPoint, clientToGlobalGrid, drawMode, geometry, mapInteractive, minimumSizeCm, selection, setDraftRect, startPinch])

  const handlePointerMove = useCallback((event: ReactPointerEvent<SVGSVGElement>) => {
    if (!mapInteractive || !geometry || !pointersRef.current.has(event.pointerId)) return
    event.preventDefault()
    event.stopPropagation()
    const point = clientPoint(event)
    pointersRef.current.set(event.pointerId, point)
    const gesture = gestureRef.current
    if (!gesture) return

    if (gesture.type === 'pinch') {
      const points = [...pointersRef.current.values()]
      if (points.length < 2) return
      const midpoint = pointerMidpoint(points[0], points[1])
      const distance = pointerDistance(points[0], points[1])
      const zoom = Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, gesture.startZoom * distance / gesture.startDistance))
      setViewport(viewportForAnchor(geometry, frame, gesture.anchor, midpoint, zoom, rotationDegrees))
      return
    }

    if (gesture.type === 'pan') {
      setViewport(clampMapViewport(
        geometry,
        frame,
        {
          ...gesture.origin,
          panX: gesture.origin.panX + point.x - gesture.startPoint.x,
          panY: gesture.origin.panY + point.y - gesture.startPoint.y,
        },
        rotationDegrees,
      ))
      return
    }

    const globalPoint = clientToGlobalGrid(point)
    if (!globalPoint) return
    const minimumGridSize = Math.ceil(minimumSizeCm / geometry.pixelSize)
    if (gesture.type === 'draw') {
      setDraftRect(mapGridRectFromPoints(geometry, gesture.anchor, globalPoint, minimumGridSize))
    } else if (gesture.type === 'move') {
      setDraftRect(translateMapGridRect(geometry, gesture.origin, {
        x: globalPoint.x - gesture.startPoint.x,
        y: globalPoint.y - gesture.startPoint.y,
      }))
    } else {
      setDraftRect(resizeMapGridRectCorner(geometry, gesture.origin, globalPoint, minimumGridSize, gesture.corner))
    }
  }, [clientPoint, clientToGlobalGrid, frame, geometry, mapInteractive, minimumSizeCm, rotationDegrees, setDraftRect, setViewport])

  const finishPointerGesture = useCallback((event: ReactPointerEvent<SVGSVGElement>, cancelled: boolean) => {
    if (!pointersRef.current.has(event.pointerId)) return
    event.preventDefault()
    event.stopPropagation()
    pointersRef.current.delete(event.pointerId)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)

    if (pointersRef.current.size > 0) {
      if (gestureRef.current?.type === 'pinch') gestureRef.current = null
      return
    }

    const gesture = gestureRef.current
    if (!cancelled && gesture && gesture.type !== 'pan' && gesture.type !== 'pinch' && draftRectRef.current) {
      onSelectionChange?.(draftRectRef.current)
      if (gesture.type === 'draw') onDrawModeChange?.(false)
    }
    gestureRef.current = null
    setDraftRect(null)
  }, [onDrawModeChange, onSelectionChange, setDraftRect])

  const handleWheel = useCallback((event: WheelEvent) => {
    if (!mapInteractive || !geometry) return
    event.preventDefault()
    const point = clientPoint(event)
    const zoom = Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, viewportRef.current.zoom * Math.exp(-event.deltaY * 0.0015)))
    setViewport(zoomViewportAt(geometry, frame, viewportRef.current, point, zoom, rotationDegrees))
  }, [clientPoint, frame, geometry, mapInteractive, rotationDegrees, setViewport])

  useEffect(() => {
    const overlay = overlayRef.current
    if (!mapInteractive || !overlay) return undefined
    const listener = (event: Event) => handleWheel(event as WheelEvent)
    overlay.addEventListener('wheel', listener, { passive: false })
    return () => overlay.removeEventListener('wheel', listener)
  }, [handleWheel, mapInteractive])

  const handleMoveKeyDown = useCallback((event: ReactKeyboardEvent<SVGRectElement>) => {
    if (!selection || !geometry) return
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      onSelectionChange?.(null)
      return
    }
    const delta = keyboardDelta(event)
    if (!delta) return
    event.preventDefault()
    onSelectionChange?.(translateMapGridRect(geometry, selection, delta))
  }, [geometry, onSelectionChange, selection])

  const handleResizeKeyDown = useCallback((event: ReactKeyboardEvent<SVGCircleElement>, corner: MapGridRectCorner) => {
    if (!selection || !geometry) return
    const delta = keyboardDelta(event)
    if (!delta) return
    event.preventDefault()
    const handle = RESIZE_HANDLES.find((candidate) => candidate.corner === corner)
    if (!handle) return
    onSelectionChange?.(resizeMapGridRectCorner(
      geometry,
      selection,
      { x: selection[handle.x] + delta.x, y: selection[handle.y] + delta.y },
      Math.ceil(minimumSizeCm / geometry.pixelSize),
      corner,
    ))
  }, [geometry, minimumSizeCm, onSelectionChange, selection])

  const showUnavailableFallback = mapProvenance === 'none' || Boolean(displayedError)
  const showLoadingFallback = mapSourceReadable && !displayedError && !renderedMap
  const showFallback = showUnavailableFallback || showLoadingFallback
  const effectiveScale = geometry ? Math.max(affineScale(matrix), 0.01) : 1
  const localRect = displayedRect && geometry
    ? {
        x0: displayedRect.x0 - geometry.minGridX,
        x1: displayedRect.x1 - geometry.minGridX,
        y0: displayedRect.y0 - geometry.minGridY,
        y1: displayedRect.y1 - geometry.minGridY,
      }
    : null
  const showOverlay = Boolean(geometry && frame.width > 0 && frame.height > 0 && (mapInteractive || localRect))
  const reportedPosition = renderedMap?.entities.find((entity) => entity.type === 'robot_position')
  const reportedPositionPresent = Boolean(reportedPosition?.points && reportedPosition.points.length >= 2)
  const showReportedNotice = mapProvenance === 'reported' && displayedLoaded && !displayedError
  const reportedNoticeId = `${vacuum.vacuumMapId}-last-reported-map-note`
  const loadingMapKey = mapProvenance === 'reported'
    ? VACUUM_COPY_KEYS.status.loadingLastMapPosition
    : VACUUM_COPY_KEYS.status.loadingCurrentMap
  const mapStyle = {
    '--map-min-height': vacuum.mapScale > 2 ? '300px' : '340px',
  } as CSSProperties

  return (
    <>
      <div
        aria-label={`${vacuum.title} Valetudo map`}
        aria-describedby={showReportedNotice ? reportedNoticeId : undefined}
        className={styles.frame}
        data-draw-mode={mapInteractive && drawMode ? 'true' : 'false'}
        data-expanded={mapExpanded ? 'true' : 'false'}
        data-interactive={mapInteractive ? 'true' : 'false'}
        data-loaded={displayedLoaded ? 'true' : 'false'}
        data-map-provenance={mapProvenance}
        data-source-available={liveMapSourceAvailable ? 'true' : 'false'}
        data-viewport-pan-x={viewport.panX}
        data-viewport-pan-y={viewport.panY}
        data-viewport-zoom={viewport.zoom}
        ref={frameRef}
        role="region"
        style={mapStyle}
      >
        <canvas aria-hidden="true" className={styles.canvas} data-valetudo-map-canvas="true" ref={canvasRef} />
        {showOverlay && geometry && (
          <svg
            aria-hidden={mapInteractive ? undefined : true}
            aria-label={mapInteractive ? `${vacuum.title} cleaning area editor` : undefined}
            className={styles.overlay}
            data-base-ui-swipe-ignore={mapInteractive ? 'true' : undefined}
            data-interactive={mapInteractive ? 'true' : 'false'}
            data-map-editor-overlay="true"
            onPointerCancel={mapInteractive ? (event) => finishPointerGesture(event, true) : undefined}
            onPointerDown={mapInteractive ? handlePointerDown : undefined}
            onPointerMove={mapInteractive ? handlePointerMove : undefined}
            onPointerUp={mapInteractive ? (event) => finishPointerGesture(event, false) : undefined}
            ref={overlayRef}
            role={mapInteractive ? 'application' : undefined}
            viewBox={`0 0 ${frame.width} ${frame.height}`}
          >
            <g transform={affineToCssMatrix(matrix)}>
              {localRect && mapInteractive && (
                <>
                  <rect
                    aria-label="Move cleaning area"
                    className={styles.selection}
                    data-editor-action="move"
                    data-map-rect="true"
                    data-x0={displayedRect?.x0}
                    data-x1={displayedRect?.x1}
                    data-y0={displayedRect?.y0}
                    data-y1={displayedRect?.y1}
                    height={localRect.y1 - localRect.y0}
                    onKeyDown={handleMoveKeyDown}
                    role="button"
                    tabIndex={0}
                    vectorEffect="non-scaling-stroke"
                    width={localRect.x1 - localRect.x0}
                    x={localRect.x0}
                    y={localRect.y0}
                  />
                  {RESIZE_HANDLES.map((handle) => {
                    const cx = localRect[handle.x]
                    const cy = localRect[handle.y]
                    return (
                      <g key={handle.corner}>
                        <circle
                          aria-hidden="true"
                          className={styles.resizeHandleVisual}
                          cx={cx}
                          cy={cy}
                          r={8 / effectiveScale}
                          vectorEffect="non-scaling-stroke"
                        />
                        <circle
                          aria-label={`Resize cleaning area ${handle.label}`}
                          className={styles.resizeHandleHit}
                          cx={cx}
                          cy={cy}
                          data-editor-action="resize"
                          data-editor-corner={handle.corner}
                          data-resize-diagonal={handle.diagonal}
                          onKeyDown={(event) => handleResizeKeyDown(event, handle.corner)}
                          r={22 / effectiveScale}
                          role="button"
                          tabIndex={0}
                        />
                      </g>
                    )
                  })}
                </>
              )}
              {localRect && !mapInteractive && (
                <rect
                  aria-hidden="true"
                  className={[styles.selection, styles.staticSelection].join(' ')}
                  data-map-rect="true"
                  data-x0={displayedRect?.x0}
                  data-x1={displayedRect?.x1}
                  data-y0={displayedRect?.y0}
                  data-y1={displayedRect?.y1}
                  height={localRect.y1 - localRect.y0}
                  vectorEffect="non-scaling-stroke"
                  width={localRect.x1 - localRect.x0}
                  x={localRect.x0}
                  y={localRect.y0}
                />
              )}
            </g>
          </svg>
        )}
        {showFallback && (
          <div className={styles.fallback}>
            <span className={styles.fallbackTitle}>
              {showLoadingFallback
                ? copy(loadingMapKey)
                : copy(VACUUM_COPY_KEYS.status.mapUnavailable)}
            </span>
            {showUnavailableFallback && (
              <span className={styles.fallbackSubtitle}>{copy(VACUUM_COPY_KEYS.status.mapUnavailableHelp)}</span>
            )}
          </div>
        )}
      </div>
      {showReportedNotice && (
        <div className={styles.reportedNotice} data-icon="mdi:alert-outline" data-map-reported-note="true" id={reportedNoticeId} role="note">
          <span aria-hidden="true" className={styles.reportedNoticeIcon}>
            <MaterialIcon name="mdi:alert-outline" size={20} />
          </span>
          <span className={styles.reportedNoticeCopy}>
            <strong>{copy(reportedPositionPresent ? VACUUM_COPY_KEYS.status.lastReportedPosition : VACUUM_COPY_KEYS.status.lastReportedMap)}</strong>
            <small>{copy(VACUUM_COPY_KEYS.status.lastReportedMapHelp)}</small>
          </span>
        </div>
      )}
    </>
  )
}
