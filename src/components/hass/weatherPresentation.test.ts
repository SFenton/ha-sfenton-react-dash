import { describe, expect, it } from 'vitest'
import {
  classifyUsAqi,
  feelsLikePresentation,
  pressurePresentation,
  sunArcMarker,
  sunPresentation,
  uvPresentation,
  visibilityPresentation,
  weatherSceneForCondition,
} from './weatherPresentation'

describe('weather presentation', () => {
  it.each([
    [0, 'good'],
    [50, 'good'],
    [51, 'moderate'],
    [100, 'moderate'],
    [101, 'sensitive'],
    [150, 'sensitive'],
    [151, 'unhealthy'],
    [200, 'unhealthy'],
    [201, 'veryUnhealthy'],
    [300, 'veryUnhealthy'],
    [301, 'hazardous'],
    [500, 'hazardous'],
    [501, 'hazardous'],
  ] as const)('classifies US AQI %s as %s', (value, level) => {
    expect(classifyUsAqi(value)?.level).toBe(level)
  })

  it('uses equal-width category bands for the AQI marker', () => {
    expect(classifyUsAqi(50)?.markerPercent).toBeCloseTo(100 / 6)
    expect(classifyUsAqi(151)?.markerPercent).toBeCloseTo(50)
    expect(classifyUsAqi(500)?.markerPercent).toBe(100)
    expect(classifyUsAqi(900)?.markerPercent).toBe(100)
    expect(classifyUsAqi('unavailable')).toBeNull()
  })

  it('rounds AQI before choosing its category and headline priority', () => {
    expect(classifyUsAqi(50.4)).toMatchObject({ elevated: false, level: 'good', value: 50 })
    expect(classifyUsAqi(100.4)).toMatchObject({ elevated: false, level: 'moderate', value: 100 })
    expect(classifyUsAqi(100.6)).toMatchObject({ elevated: true, level: 'sensitive', value: 101 })
  })

  it('classifies UV values before rounding their display', () => {
    expect(uvPresentation(2.9)?.level).toBe('low')
    expect(uvPresentation(3)?.level).toBe('moderate')
    expect(uvPresentation(8)?.level).toBe('veryHigh')
    expect(uvPresentation(11)?.level).toBe('extreme')
  })

  it('presents apparent temperature as a delta from actual temperature', () => {
    expect(feelsLikePresentation(60, 65, '°F')).toMatchObject({ relation: 'warmer' })
    expect(feelsLikePresentation(20, 20.8, '°C')).toMatchObject({ relation: 'similar' })
    expect(feelsLikePresentation(50, 42, '°F')).toMatchObject({ relation: 'cooler' })
  })

  it('normalizes pressure units before assigning a band', () => {
    expect(pressurePresentation(29.92, 'inHg')).toMatchObject({ band: 'typical' })
    expect(pressurePresentation(1000, 'hPa')).toMatchObject({ band: 'below' })
    expect(pressurePresentation(1030, 'hPa')).toMatchObject({ band: 'above' })
    expect(pressurePresentation(101300, 'Pa')?.hpa).toBe(1013)
  })

  it('normalizes visibility and preserves descriptive bands', () => {
    expect(visibilityPresentation(10, 'mi')?.band).toBe('clear')
    expect(visibilityPresentation(10, 'km')?.band).toBe('good')
    expect(visibilityPresentation(800, 'm')?.band).toBe('veryPoor')
  })

  it('selects the next solar event and daylight progress', () => {
    const above = sunPresentation('above_horizon', {
      next_rising: '2026-08-26T13:20:00.000Z',
      next_setting: '2026-08-26T03:00:00.000Z',
    }, Date.parse('2026-08-25T20:00:00.000Z'))
    expect(above).toMatchObject({ primary: 'sunset', secondary: 'sunrise' })
    expect(above?.markerPercent).toBeGreaterThan(0)

    const below = sunPresentation('below_horizon', {
      next_rising: '2026-08-26T13:20:00.000Z',
      next_setting: '2026-08-27T03:00:00.000Z',
    })
    expect(below).toMatchObject({ primary: 'sunrise', secondary: 'sunset', markerPercent: undefined })
  })

  it('keeps the solar marker on the quadratic arc', () => {
    expect(sunArcMarker(0)).toEqual({ x: 8, y: 40 })
    expect(sunArcMarker(50)).toEqual({ x: 50, y: 22 })
    expect(sunArcMarker(100)).toEqual({ x: 92, y: 40 })
  })

  it.each([
    ['sunny', false, 'sunny'],
    ['sunny', true, 'night'],
    ['clear-night', false, 'night'],
    ['partlycloudy', false, 'clouds'],
    ['pouring', false, 'rain'],
    ['lightning-rainy', false, 'storm'],
    ['snowy-rainy', false, 'snow'],
    ['windy-variant', false, 'wind'],
    ['exceptional', false, 'exceptional'],
    [undefined, false, 'neutral'],
  ] as const)('maps %s to the %s scene', (condition, isNight, scene) => {
    expect(weatherSceneForCondition(condition, isNight)).toBe(scene)
  })
})
