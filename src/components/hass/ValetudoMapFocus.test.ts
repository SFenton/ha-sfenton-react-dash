import { VACUUMS, type VacuumMapFocusConfig } from '../../constants/portedDashboard'
import { createMockValetudoMap, type ValetudoMap, type ValetudoMapLayer } from './ValetudoMapCard.utils'
import {
  mapGridRectWithinBounds,
  resolveValetudoMapFocus,
  valetudoMapPixelKey,
} from './ValetudoMapFocus'

function rectanglePixels(minX: number, maxX: number, minY: number, maxY: number) {
  const pixels: number[] = []
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) pixels.push(x, y)
  }
  return pixels
}

function outlinePixels(minX: number, maxX: number, minY: number, maxY: number) {
  const pixels = [
    ...rectanglePixels(minX, maxX, minY, minY),
    ...rectanglePixels(minX, maxX, maxY, maxY),
  ]
  for (let y = minY + 1; y < maxY; y += 1) {
    pixels.push(minX, y, maxX, y)
  }
  return pixels
}

function layer(
  type: string,
  pixels: number[],
  metaData?: ValetudoMapLayer['metaData'],
): ValetudoMapLayer {
  const xs = pixels.filter((_, index) => index % 2 === 0)
  const ys = pixels.filter((_, index) => index % 2 === 1)
  return {
    type,
    dimensions: {
      x: { min: Math.min(...xs), max: Math.max(...xs) },
      y: { min: Math.min(...ys), max: Math.max(...ys) },
    },
    metaData,
    pixels,
  }
}

function createFocusedMap(overrides: Partial<ValetudoMap> = {}): ValetudoMap {
  const intendedLayers = [
    layer('segment', rectanglePixels(20, 30, 20, 30), { name: 'Music Room', segmentId: '3' }),
    layer('segment', rectanglePixels(31, 35, 24, 30), { name: 'Downstairs Hallway', segmentId: '10' }),
    layer('segment', rectanglePixels(24, 35, 31, 35), { name: 'Downstairs Bathroom', segmentId: '12' }),
  ]
  const phantom = layer('segment', rectanglePixels(0, 10, 15, 35), { segmentId: '4' })
  const walls = layer('wall', [
    ...outlinePixels(19, 36, 19, 36),
    ...outlinePixels(0, 11, 14, 36),
  ])

  return {
    __class: 'ValetudoMap',
    entities: [
      { type: 'robot_position', points: [25 * 5, 25 * 5] },
      { type: 'charger_location', points: [25 * 5, 25 * 5] },
    ],
    layers: [walls, ...intendedLayers, phantom],
    metaData: { nonce: 'focused-fixture', version: 2 },
    pixelSize: 5,
    size: { x: 500, y: 500 },
    ...overrides,
  }
}

const focusPolicy: VacuumMapFocusConfig = {
  maximumViewAreaRatio: 0.9,
  minimumExcludedAreaM2: 0,
  minimumExcludedFraction: 0,
  paddingCm: 15,
  requiredSegments: [
    { id: '3', name: 'Music Room' },
    { id: '10', name: 'Downstairs Hallway' },
    { id: '12', name: 'Downstairs Bathroom' },
  ],
  wallAssociationCm: 20,
}

describe('Valetudo map focus', () => {
  it('applies the production Music Room policy to the phantom-map regression fixture', () => {
    const musicRoom = VACUUMS.find((vacuum) => vacuum.title === 'Music Room')
    if (!musicRoom) throw new Error('Expected Music Room vacuum config')

    const result = resolveValetudoMapFocus(createMockValetudoMap(musicRoom.vacuumMapId), musicRoom.mapFocus)

    expect(result.mode).toBe('focused')
    expect(result.excludedSegmentIds).toEqual(['4'])
    expect(result.interactionBounds).toEqual({ minX: 638, maxX: 781, minY: 556, maxY: 721 })
    expect(result.viewBounds).toEqual({ minX: 634, maxX: 782, minY: 552, maxY: 722 })
    expect(result.excludedAreaM2).toBeGreaterThan(4)
  })

  it('focuses the configured connected house segments without changing their IDs', () => {
    const map = createFocusedMap()
    const before = JSON.stringify(map)
    const result = resolveValetudoMapFocus(map, focusPolicy)

    expect(result.mode).toBe('focused')
    expect(result.reason).toBe('focused')
    expect([...result.acceptedSegmentIds]).toEqual(['3', '10', '12'])
    expect(result.excludedSegmentIds).toEqual(['4'])
    expect(result.interactionBounds).toEqual({ minX: 20, maxX: 35, minY: 20, maxY: 35 })
    expect(result.viewBounds.minX).toBeGreaterThan(11)
    expect(result.renderWallPixelKeys).toContain(valetudoMapPixelKey(19, 24))
    expect(result.renderWallPixelKeys).not.toContain(valetudoMapPixelKey(11, 24))
    expect(JSON.stringify(map)).toBe(before)
  })

  it('falls back to the full map when an excluded segment is named', () => {
    const map = createFocusedMap()
    const phantom = map.layers.find((candidate) => candidate.metaData?.segmentId === '4')
    if (!phantom?.metaData) throw new Error('Expected phantom segment')
    phantom.metaData.name = 'Sunroom'

    const result = resolveValetudoMapFocus(map, focusPolicy)

    expect(result.mode).toBe('full')
    expect(result.reason).toBe('named-segment-excluded')
    expect(result.viewBounds).toEqual(result.rawBounds)
  })

  it('keeps an unnamed helper segment that touches the intended graph diagonally', () => {
    const map = createFocusedMap()
    map.layers.push(layer('segment', rectanglePixels(36, 36, 36, 36), { segmentId: '6' }))

    const result = resolveValetudoMapFocus(map, focusPolicy)

    expect(result.mode).toBe('focused')
    expect(result.acceptedSegmentIds.has('6')).toBe(true)
    expect(result.excludedSegmentIds).toEqual(['4'])
  })

  it('falls back when an excluded segment is active', () => {
    const map = createFocusedMap()
    const phantom = map.layers.find((candidate) => candidate.metaData?.segmentId === '4')
    if (!phantom?.metaData) throw new Error('Expected phantom segment')
    phantom.metaData.active = true

    expect(resolveValetudoMapFocus(map, focusPolicy).reason).toBe('active-segment-excluded')
  })

  it('falls back when the robot resolves to the excluded component', () => {
    const map = createFocusedMap({
      entities: [
        { type: 'robot_position', points: [5 * 5, 25 * 5] },
        { type: 'charger_location', points: [25 * 5, 25 * 5] },
      ],
    })

    expect(resolveValetudoMapFocus(map, focusPolicy).reason).toBe('anchor-outside-focus')
  })

  it('falls back when an active route enters the excluded component', () => {
    const map = createFocusedMap()
    map.entities.push({ type: 'path', points: [25 * 5, 25 * 5, 5 * 5, 25 * 5] })

    expect(resolveValetudoMapFocus(map, focusPolicy).reason).toBe('active-route-excluded')
  })

  it('falls back when an active zone surrounds excluded floor without placing a corner inside it', () => {
    const map = createFocusedMap()
    map.entities.push({
      type: 'active_zone',
      points: [-5, 65, 60, 65, 60, 185, -5, 185],
    })

    expect(resolveValetudoMapFocus(map, focusPolicy).reason).toBe('active-route-excluded')
  })

  it('does not treat a no-go zone over excluded space as reachable-floor evidence', () => {
    const map = createFocusedMap()
    map.entities.push({
      type: 'no_go_area',
      points: [10, 90, 45, 90, 45, 140, 10, 140],
    })

    expect(resolveValetudoMapFocus(map, focusPolicy).mode).toBe('focused')
  })

  it('falls back when configured segment identity no longer matches', () => {
    const map = createFocusedMap()
    const musicRoom = map.layers.find((candidate) => candidate.metaData?.segmentId === '3')
    if (!musicRoom?.metaData) throw new Error('Expected Music Room segment')
    musicRoom.metaData.name = 'Different Room'

    expect(resolveValetudoMapFocus(map, focusPolicy).reason).toBe('segment-name-mismatch')
  })

  it('keeps focus optional for vacuums without an explicit policy', () => {
    const result = resolveValetudoMapFocus(createFocusedMap(), undefined)

    expect(result.mode).toBe('full')
    expect(result.reason).toBe('unconfigured')
  })

  it('checks drawn rectangles against the unpadded interaction bounds', () => {
    const bounds = { minX: 20, maxX: 35, minY: 20, maxY: 35 }

    expect(mapGridRectWithinBounds({ x0: 20, x1: 36, y0: 20, y1: 36 }, bounds)).toBe(true)
    expect(mapGridRectWithinBounds({ x0: 19, x1: 24, y0: 20, y1: 25 }, bounds)).toBe(false)
    expect(mapGridRectWithinBounds({ x0: 20, x1: 24, y0: 20, y1: 37 }, bounds)).toBe(false)
  })
})
