import {
  affineScale,
  applyAffine,
  clampMapViewport,
  defaultMapGridRect,
  invertAffine,
  mapGridRectDimensionsCm,
  mapGridRectFromPoints,
  mapGridRectToServiceData,
  mapGridRectToZonePoints,
  mapViewportMatrix,
  resizeMapGridRect,
  resizeMapGridRectCorner,
  translateMapGridRect,
  valetudoMapStageGeometry,
  viewportForAnchor,
  zoomViewportAt,
  type MapGridPoint,
} from './ValetudoMapGeometry'
import { createMockValetudoMap } from './ValetudoMapCard.utils'

describe('Valetudo map geometry', () => {
  const map = createMockValetudoMap('valetudo_exaltedsneakydeer')
  const geometry = valetudoMapStageGeometry(map, 1.2)
  const frame = { width: 359, height: 420 }

  it('shares the renderer ceiling and asymmetric right/bottom padding', () => {
    expect(geometry).toMatchObject({
      minGridX: 558,
      minGridY: 639,
      maxGridX: 729,
      maxGridY: 1028,
      pixelSize: 5,
      pixelWidth: 207,
      pixelHeight: 468,
    })
    expect(geometry.width).toBe(172.5)
    expect(geometry.height).toBe(390)
  })

  it.each([0, 90, 180, 270])('round trips map points through a %s degree viewport', (rotationDegrees) => {
    const matrix = mapViewportMatrix(geometry, frame, { panX: -42, panY: 61, zoom: 3.4 }, rotationDegrees)
    const inverse = invertAffine(matrix)
    const points: MapGridPoint[] = [
      { x: 0, y: 0 },
      { x: geometry.width / 2, y: geometry.height / 2 },
      { x: geometry.width, y: geometry.height },
    ]

    for (const point of points) {
      const roundTripped = applyAffine(inverse, applyAffine(matrix, point))
      expect(roundTripped.x).toBeCloseTo(point.x, 10)
      expect(roundTripped.y).toBeCloseTo(point.y, 10)
    }
    expect(affineScale(matrix)).toBeGreaterThan(0)
  })

  it('keeps the zoom anchor fixed under rotation', () => {
    const viewport = { panX: 12, panY: -18, zoom: 1.4 }
    const clientPoint = { x: 92, y: 174 }
    const before = mapViewportMatrix(geometry, frame, viewport, 180)
    const anchor = applyAffine(invertAffine(before), clientPoint)
    const zoomed = zoomViewportAt(geometry, frame, viewport, clientPoint, 4, 180)
    const afterPoint = applyAffine(mapViewportMatrix(geometry, frame, zoomed, 180), anchor)

    expect(afterPoint.x).toBeCloseTo(clientPoint.x, 8)
    expect(afterPoint.y).toBeCloseTo(clientPoint.y, 8)
  })

  it('anchors pinch zoom at a moving midpoint', () => {
    const anchor = { x: geometry.width / 3, y: geometry.height / 4 }
    const viewport = viewportForAnchor(geometry, frame, anchor, { x: 240, y: 130 }, 5, 180)
    const rendered = applyAffine(mapViewportMatrix(geometry, frame, viewport, 180), anchor)

    expect(rendered.x).toBeCloseTo(240, 8)
    expect(rendered.y).toBeCloseTo(130, 8)
  })

  it('creates, translates, and resizes a minimum 25 cm rectangle', () => {
    const minimumGridSize = 5
    const drawn = mapGridRectFromPoints(geometry, { x: 600, y: 700 }, { x: 602, y: 701 }, minimumGridSize)
    expect(drawn).toEqual({ x0: 600, x1: 605, y0: 700, y1: 705 })

    const translated = translateMapGridRect(geometry, drawn, { x: -1000, y: 1000 })
    expect(translated).toEqual({ x0: 558, x1: 563, y0: 1023, y1: 1028 })

    const resized = resizeMapGridRect(geometry, drawn, { x: 603, y: 702 }, minimumGridSize)
    expect(resized).toEqual(drawn)
  })

  it('creates a Valetudo-sized default rectangle in the map center', () => {
    const rect = defaultMapGridRect(geometry)
    expect(rect.x1 - rect.x0).toBe(30)
    expect(rect.y1 - rect.y0).toBe(30)
    expect(mapGridRectDimensionsCm(rect, geometry.pixelSize)).toEqual({ width: 150, height: 150 })
  })

  it.each([
    ['pA', { x: 595, y: 695 }, { x0: 595, x1: 620, y0: 695, y1: 720 }],
    ['pB', { x: 625, y: 695 }, { x0: 600, x1: 625, y0: 695, y1: 720 }],
    ['pC', { x: 625, y: 725 }, { x0: 600, x1: 625, y0: 700, y1: 725 }],
    ['pD', { x: 595, y: 725 }, { x0: 595, x1: 620, y0: 700, y1: 725 }],
  ] as const)('resizes the %s corner independently', (corner, point, expected) => {
    expect(resizeMapGridRectCorner(
      geometry,
      { x0: 600, x1: 620, y0: 700, y1: 720 },
      point,
      5,
      corner,
    )).toEqual(expected)
  })

  it('enforces the minimum size from every moving corner', () => {
    const rect = { x0: 600, x1: 620, y0: 700, y1: 720 }
    expect(resizeMapGridRectCorner(geometry, rect, { x: 619, y: 719 }, 5, 'pA')).toEqual({ x0: 615, x1: 620, y0: 715, y1: 720 })
    expect(resizeMapGridRectCorner(geometry, rect, { x: 601, y: 719 }, 5, 'pB')).toEqual({ x0: 600, x1: 605, y0: 715, y1: 720 })
    expect(resizeMapGridRectCorner(geometry, rect, { x: 601, y: 701 }, 5, 'pC')).toEqual({ x0: 600, x1: 605, y0: 700, y1: 705 })
    expect(resizeMapGridRectCorner(geometry, rect, { x: 619, y: 701 }, 5, 'pD')).toEqual({ x0: 615, x1: 620, y0: 700, y1: 705 })
  })

  it('shifts an edge-bound resize origin to preserve the minimum dimensions', () => {
    const resized = resizeMapGridRect(
      geometry,
      { x0: geometry.maxGridX - 2, x1: geometry.maxGridX, y0: geometry.maxGridY - 2, y1: geometry.maxGridY },
      { x: geometry.maxGridX, y: geometry.maxGridY },
      5,
    )

    expect(resized).toEqual({
      x0: geometry.maxGridX - 5,
      x1: geometry.maxGridX,
      y0: geometry.maxGridY - 5,
      y1: geometry.maxGridY,
    })
  })

  it('orders all four Valetudo corners and script data in integer centimetres', () => {
    const rect = { x0: 600, x1: 625, y0: 700, y1: 730 }
    expect(mapGridRectToZonePoints(rect, 5)).toEqual({
      pA: { x: 3000, y: 3500 },
      pB: { x: 3125, y: 3500 },
      pC: { x: 3125, y: 3650 },
      pD: { x: 3000, y: 3650 },
    })
    expect(mapGridRectToServiceData(rect, 5)).toEqual({
      x_min_cm: 3000,
      y_min_cm: 3500,
      x_max_cm: 3125,
      y_max_cm: 3650,
    })
  })

  it('keeps at least one quarter of the stage visible after extreme panning', () => {
    const viewport = clampMapViewport(geometry, frame, { panX: 10_000, panY: -10_000, zoom: 2 }, 180)
    expect(viewport.panX).toBeLessThan(10_000)
    expect(viewport.panY).toBeGreaterThan(-10_000)
  })
})
