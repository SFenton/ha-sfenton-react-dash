import { describe, expect, it } from 'vitest'
import { NIGHT_STARS, SNOW_CRYSTAL_PATHS, SNOW_FLAKES, SNOW_FLAKE_COUNT, WIND_WISPS } from './weatherAtmosphereModel'

describe('weather atmosphere model', () => {
  it('bounds sizes, independent phases, travel and static placement without runtime randomness', () => {
    expect(SNOW_FLAKES).toHaveLength(SNOW_FLAKE_COUNT)
    expect(new Set(SNOW_FLAKES.map((flake) => flake.size))).toEqual(new Set([5, 8, 12]))
    expect(new Set(SNOW_FLAKES.map((flake) => flake.x)).size).toBe(SNOW_FLAKE_COUNT)
    expect(new Set(SNOW_FLAKES.map((flake) => flake.delay)).size).toBeGreaterThan(25)
    for (const flake of SNOW_FLAKES) {
      expect(flake.delay).toBeLessThan(0)
      expect(flake.delay).toBeGreaterThan(-flake.duration)
      expect(flake.duration).toBeGreaterThanOrEqual(14)
      expect(flake.duration).toBeLessThanOrEqual(32)
      expect(flake.x).toBeGreaterThanOrEqual(2)
      expect(flake.x).toBeLessThanOrEqual(98)
      expect(flake.staticY).toBeGreaterThan(0)
      expect(flake.staticY).toBeLessThan(100)
      expect(flake.opacity).toBeLessThanOrEqual(0.7)
      expect(flake.sway).toBeLessThanOrEqual(22)
      expect(flake.trajectory).toHaveLength(9)
      expect(flake.trajectory.every((point) => Number.isFinite(point.angle) && Math.abs(point.x) <= 60)).toBe(true)
    }
  })

  it('uses branched six-arm geometry near and middle, not repeated dot textures', () => {
    expect(SNOW_CRYSTAL_PATHS.dendrite.match(/M/g)).toHaveLength(18)
    expect(SNOW_CRYSTAL_PATHS.fern.match(/M/g)).toHaveLength(12)
    expect(SNOW_CRYSTAL_PATHS.grain.match(/M/g)).toHaveLength(6)
    expect(SNOW_CRYSTAL_PATHS.plate).toContain('Z')
    expect(new Set(SNOW_FLAKES.map((flake) => flake.shape)).size).toBe(4)
    expect(new Set(SNOW_FLAKES.map((flake) => JSON.stringify(flake.trajectory))).size).toBe(SNOW_FLAKE_COUNT)
    expect(Object.values(SNOW_CRYSTAL_PATHS).every((path) => !path.includes('NaN'))).toBe(true)
  })

  it('uses bounded non-tiled star positions and asymmetric gust shapes', () => {
    expect(NIGHT_STARS).toHaveLength(35)
    expect(new Set(NIGHT_STARS.map((star) => `${star.x},${star.y}`)).size).toBe(35)
    expect(NIGHT_STARS.every((star) => star.x > 0 && star.x < 100 && star.y > 0 && star.y < 100)).toBe(true)
    expect(WIND_WISPS).toHaveLength(4)
    expect(new Set(WIND_WISPS.map((wisp) => wisp.path)).size).toBe(4)
    expect(WIND_WISPS.every((wisp) => wisp.delay < 0 && wisp.delay > -wisp.duration)).toBe(true)
  })
})
