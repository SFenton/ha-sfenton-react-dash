import { valetudoMapBounds, type ValetudoMap, type ValetudoMapBounds } from './ValetudoMapCard.utils'

export interface MapGridPoint {
  x: number
  y: number
}

export interface MapGridRect {
  x0: number
  x1: number
  y0: number
  y1: number
}

export type MapGridRectCorner = 'pA' | 'pB' | 'pC' | 'pD'

export interface MapFrameSize {
  height: number
  width: number
}

export interface MapViewport {
  panX: number
  panY: number
  zoom: number
}

export interface AffineMatrix {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

export interface ValetudoMapStageGeometry {
  bounds: ValetudoMapBounds
  height: number
  maxGridX: number
  maxGridY: number
  minGridX: number
  minGridY: number
  pixelHeight: number
  pixelSize: number
  pixelWidth: number
  scale: number
  width: number
}

export interface ValetudoZonePoints {
  pA: MapGridPoint
  pB: MapGridPoint
  pC: MapGridPoint
  pD: MapGridPoint
}

const IDENTITY_MATRIX: AffineMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

function translationMatrix(x: number, y: number): AffineMatrix {
  return { a: 1, b: 0, c: 0, d: 1, e: x, f: y }
}

function scaleMatrix(scale: number): AffineMatrix {
  return { a: scale, b: 0, c: 0, d: scale, e: 0, f: 0 }
}

function rotationMatrix(rotationDegrees: number): AffineMatrix {
  const radians = (rotationDegrees * Math.PI) / 180
  const cosine = Math.cos(radians)
  const sine = Math.sin(radians)
  return { a: cosine, b: sine, c: -sine, d: cosine, e: 0, f: 0 }
}

export function multiplyAffine(left: AffineMatrix, right: AffineMatrix): AffineMatrix {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  }
}

export function applyAffine(matrix: AffineMatrix, point: MapGridPoint): MapGridPoint {
  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f,
  }
}

export function invertAffine(matrix: AffineMatrix): AffineMatrix {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c
  if (Math.abs(determinant) < Number.EPSILON) throw new Error('Map transform is not invertible')

  return {
    a: matrix.d / determinant,
    b: -matrix.b / determinant,
    c: -matrix.c / determinant,
    d: matrix.a / determinant,
    e: (matrix.c * matrix.f - matrix.d * matrix.e) / determinant,
    f: (matrix.b * matrix.e - matrix.a * matrix.f) / determinant,
  }
}

export function affineScale(matrix: AffineMatrix) {
  return Math.hypot(matrix.a, matrix.b)
}

export function affineToCssMatrix(matrix: AffineMatrix) {
  return `matrix(${matrix.a}, ${matrix.b}, ${matrix.c}, ${matrix.d}, ${matrix.e}, ${matrix.f})`
}

export function valetudoMapStageGeometry(
  map: ValetudoMap,
  mapScale: number,
  bounds: ValetudoMapBounds = valetudoMapBounds(map),
): ValetudoMapStageGeometry {
  const scale = Math.max(1, mapScale)
  const pixelWidth = Math.max(1, Math.ceil((bounds.maxX - bounds.minX + 2) * scale))
  const pixelHeight = Math.max(1, Math.ceil((bounds.maxY - bounds.minY + 2) * scale))

  return {
    bounds,
    height: pixelHeight / scale,
    maxGridX: bounds.maxX + 1,
    maxGridY: bounds.maxY + 1,
    minGridX: bounds.minX,
    minGridY: bounds.minY,
    pixelHeight,
    pixelSize: map.pixelSize,
    pixelWidth,
    scale,
    width: pixelWidth / scale,
  }
}

function rotatedStageSize(geometry: ValetudoMapStageGeometry, rotationDegrees: number) {
  const radians = (rotationDegrees * Math.PI) / 180
  const cosine = Math.abs(Math.cos(radians))
  const sine = Math.abs(Math.sin(radians))
  return {
    height: geometry.width * sine + geometry.height * cosine,
    width: geometry.width * cosine + geometry.height * sine,
  }
}

export function mapViewportMatrix(
  geometry: ValetudoMapStageGeometry,
  frame: MapFrameSize,
  viewport: MapViewport,
  rotationDegrees: number,
): AffineMatrix {
  if (frame.width <= 0 || frame.height <= 0) return IDENTITY_MATRIX

  const rotated = rotatedStageSize(geometry, rotationDegrees)
  const fit = Math.min(frame.width / Math.max(rotated.width, 1), frame.height / Math.max(rotated.height, 1))
  const effectiveScale = fit * viewport.zoom

  return [
    translationMatrix(frame.width / 2 + viewport.panX, frame.height / 2 + viewport.panY),
    rotationMatrix(rotationDegrees),
    scaleMatrix(effectiveScale),
    translationMatrix(-geometry.width / 2, -geometry.height / 2),
  ].reduce(multiplyAffine)
}

function transformedStageBounds(geometry: ValetudoMapStageGeometry, matrix: AffineMatrix) {
  const points = [
    applyAffine(matrix, { x: 0, y: 0 }),
    applyAffine(matrix, { x: geometry.width, y: 0 }),
    applyAffine(matrix, { x: geometry.width, y: geometry.height }),
    applyAffine(matrix, { x: 0, y: geometry.height }),
  ]
  return {
    bottom: Math.max(...points.map((point) => point.y)),
    left: Math.min(...points.map((point) => point.x)),
    right: Math.max(...points.map((point) => point.x)),
    top: Math.min(...points.map((point) => point.y)),
  }
}

export function clampMapViewport(
  geometry: ValetudoMapStageGeometry,
  frame: MapFrameSize,
  viewport: MapViewport,
  rotationDegrees: number,
  minimumVisibleRatio = 0.25,
): MapViewport {
  const matrix = mapViewportMatrix(geometry, frame, viewport, rotationDegrees)
  const bounds = transformedStageBounds(geometry, matrix)
  const minimumVisibleX = Math.min(frame.width, bounds.right - bounds.left) * minimumVisibleRatio
  const minimumVisibleY = Math.min(frame.height, bounds.bottom - bounds.top) * minimumVisibleRatio
  let panX = viewport.panX
  let panY = viewport.panY

  if (bounds.right < minimumVisibleX) panX += minimumVisibleX - bounds.right
  if (bounds.left > frame.width - minimumVisibleX) panX -= bounds.left - (frame.width - minimumVisibleX)
  if (bounds.bottom < minimumVisibleY) panY += minimumVisibleY - bounds.bottom
  if (bounds.top > frame.height - minimumVisibleY) panY -= bounds.top - (frame.height - minimumVisibleY)

  return { ...viewport, panX, panY }
}

export function viewportForAnchor(
  geometry: ValetudoMapStageGeometry,
  frame: MapFrameSize,
  anchor: MapGridPoint,
  clientPoint: MapGridPoint,
  zoom: number,
  rotationDegrees: number,
): MapViewport {
  const matrixWithoutPan = mapViewportMatrix(geometry, frame, { panX: 0, panY: 0, zoom }, rotationDegrees)
  const renderedAnchor = applyAffine(matrixWithoutPan, anchor)
  return clampMapViewport(
    geometry,
    frame,
    {
      panX: clientPoint.x - renderedAnchor.x,
      panY: clientPoint.y - renderedAnchor.y,
      zoom,
    },
    rotationDegrees,
  )
}

export function zoomViewportAt(
  geometry: ValetudoMapStageGeometry,
  frame: MapFrameSize,
  viewport: MapViewport,
  clientPoint: MapGridPoint,
  zoom: number,
  rotationDegrees: number,
): MapViewport {
  const anchor = applyAffine(invertAffine(mapViewportMatrix(geometry, frame, viewport, rotationDegrees)), clientPoint)
  return viewportForAnchor(geometry, frame, anchor, clientPoint, zoom, rotationDegrees)
}

export function localPointToGlobalGrid(geometry: ValetudoMapStageGeometry, point: MapGridPoint): MapGridPoint {
  return {
    x: point.x + geometry.minGridX,
    y: point.y + geometry.minGridY,
  }
}

export function globalGridPointToLocal(geometry: ValetudoMapStageGeometry, point: MapGridPoint): MapGridPoint {
  return {
    x: point.x - geometry.minGridX,
    y: point.y - geometry.minGridY,
  }
}

export function normalizeMapGridRect(rect: MapGridRect): MapGridRect {
  return {
    x0: Math.min(rect.x0, rect.x1),
    x1: Math.max(rect.x0, rect.x1),
    y0: Math.min(rect.y0, rect.y1),
    y1: Math.max(rect.y0, rect.y1),
  }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

export function clampMapGridPoint(geometry: ValetudoMapStageGeometry, point: MapGridPoint): MapGridPoint {
  return {
    x: clamp(Math.round(point.x), geometry.minGridX, geometry.maxGridX),
    y: clamp(Math.round(point.y), geometry.minGridY, geometry.maxGridY),
  }
}

export function mapGridRectFromPoints(
  geometry: ValetudoMapStageGeometry,
  anchorPoint: MapGridPoint,
  currentPoint: MapGridPoint,
  minimumGridSize: number,
): MapGridRect {
  const anchor = clampMapGridPoint(geometry, anchorPoint)
  const current = clampMapGridPoint(geometry, currentPoint)
  const rect = normalizeMapGridRect({ x0: anchor.x, x1: current.x, y0: anchor.y, y1: current.y })

  if (rect.x1 - rect.x0 < minimumGridSize) {
    if (current.x >= anchor.x) {
      rect.x1 = Math.min(geometry.maxGridX, rect.x0 + minimumGridSize)
      rect.x0 = Math.max(geometry.minGridX, rect.x1 - minimumGridSize)
    } else {
      rect.x0 = Math.max(geometry.minGridX, rect.x1 - minimumGridSize)
      rect.x1 = Math.min(geometry.maxGridX, rect.x0 + minimumGridSize)
    }
  }

  if (rect.y1 - rect.y0 < minimumGridSize) {
    if (current.y >= anchor.y) {
      rect.y1 = Math.min(geometry.maxGridY, rect.y0 + minimumGridSize)
      rect.y0 = Math.max(geometry.minGridY, rect.y1 - minimumGridSize)
    } else {
      rect.y0 = Math.max(geometry.minGridY, rect.y1 - minimumGridSize)
      rect.y1 = Math.min(geometry.maxGridY, rect.y0 + minimumGridSize)
    }
  }

  return rect
}

export function translateMapGridRect(
  geometry: ValetudoMapStageGeometry,
  rect: MapGridRect,
  delta: MapGridPoint,
): MapGridRect {
  const width = rect.x1 - rect.x0
  const height = rect.y1 - rect.y0
  const x0 = clamp(Math.round(rect.x0 + delta.x), geometry.minGridX, geometry.maxGridX - width)
  const y0 = clamp(Math.round(rect.y0 + delta.y), geometry.minGridY, geometry.maxGridY - height)
  return { x0, x1: x0 + width, y0, y1: y0 + height }
}

export function resizeMapGridRect(
  geometry: ValetudoMapStageGeometry,
  rect: MapGridRect,
  point: MapGridPoint,
  minimumGridSize: number,
): MapGridRect {
  return resizeMapGridRectCorner(geometry, rect, point, minimumGridSize, 'pC')
}

export function resizeMapGridRectCorner(
  geometry: ValetudoMapStageGeometry,
  rect: MapGridRect,
  point: MapGridPoint,
  minimumGridSize: number,
  corner: MapGridRectCorner,
): MapGridRect {
  const clampedPoint = clampMapGridPoint(geometry, point)
  const x0 = Math.min(rect.x0, geometry.maxGridX - minimumGridSize)
  const x1 = Math.max(rect.x1, geometry.minGridX + minimumGridSize)
  const y0 = Math.min(rect.y0, geometry.maxGridY - minimumGridSize)
  const y1 = Math.max(rect.y1, geometry.minGridY + minimumGridSize)

  if (corner === 'pA') {
    return {
      x0: clamp(clampedPoint.x, geometry.minGridX, x1 - minimumGridSize),
      x1,
      y0: clamp(clampedPoint.y, geometry.minGridY, y1 - minimumGridSize),
      y1,
    }
  }
  if (corner === 'pB') {
    return {
      x0,
      x1: clamp(clampedPoint.x, x0 + minimumGridSize, geometry.maxGridX),
      y0: clamp(clampedPoint.y, geometry.minGridY, y1 - minimumGridSize),
      y1,
    }
  }
  if (corner === 'pD') {
    return {
      x0: clamp(clampedPoint.x, geometry.minGridX, x1 - minimumGridSize),
      x1,
      y0,
      y1: clamp(clampedPoint.y, y0 + minimumGridSize, geometry.maxGridY),
    }
  }

  return {
    x0,
    x1: clamp(clampedPoint.x, x0 + minimumGridSize, geometry.maxGridX),
    y0,
    y1: clamp(clampedPoint.y, y0 + minimumGridSize, geometry.maxGridY),
  }
}

export function defaultMapGridRect(
  geometry: ValetudoMapStageGeometry,
  size = 30,
): MapGridRect {
  const width = Math.min(size, geometry.maxGridX - geometry.minGridX)
  const height = Math.min(size, geometry.maxGridY - geometry.minGridY)
  const x0 = Math.round((geometry.minGridX + geometry.maxGridX - width) / 2)
  const y0 = Math.round((geometry.minGridY + geometry.maxGridY - height) / 2)
  return { x0, x1: x0 + width, y0, y1: y0 + height }
}

export function mapGridRectDimensionsCm(rect: MapGridRect, pixelSize: number) {
  return {
    height: Math.round((rect.y1 - rect.y0) * pixelSize),
    width: Math.round((rect.x1 - rect.x0) * pixelSize),
  }
}

export function mapGridRectToZonePoints(rect: MapGridRect, pixelSize: number): ValetudoZonePoints {
  const normalized = normalizeMapGridRect(rect)
  const x0 = Math.round(normalized.x0 * pixelSize)
  const x1 = Math.round(normalized.x1 * pixelSize)
  const y0 = Math.round(normalized.y0 * pixelSize)
  const y1 = Math.round(normalized.y1 * pixelSize)
  return {
    pA: { x: x0, y: y0 },
    pB: { x: x1, y: y0 },
    pC: { x: x1, y: y1 },
    pD: { x: x0, y: y1 },
  }
}

export function mapGridRectToServiceData(rect: MapGridRect, pixelSize: number) {
  const points = mapGridRectToZonePoints(rect, pixelSize)
  return {
    x_max_cm: points.pC.x,
    x_min_cm: points.pA.x,
    y_max_cm: points.pC.y,
    y_min_cm: points.pA.y,
  }
}
