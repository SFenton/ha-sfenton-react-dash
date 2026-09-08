import { describe, expect, it } from 'vitest'
import {
  buildPrecipitationTimeline,
  precipitationAmountAxis,
  precipitationChanceDomain,
  precipitationLabelCadence,
  precipitationLabelIndices,
  precipitationScaledPercent,
  precipitationTotal,
} from './precipitationTimeline'

describe('precipitation timeline', () => {
  it('keeps probability and measured amount independent while accumulating amount only', () => {
    const points = buildPrecipitationTimeline([
      { datetime: '2026-08-27T12:00:00-07:00', precipitation: 0, precipitation_probability: 94 },
      { datetime: '2026-08-27T13:00:00-07:00', precipitation: 0.07, precipitation_probability: 40 },
      { datetime: '2026-08-27T14:00:00-07:00', precipitation: 0.02, precipitation_probability: 20 },
    ])

    expect(points.map((point) => point.probability)).toEqual([94, 40, 20])
    expect(points.map((point) => point.amount)).toEqual([0, 0.07, 0.02])
    expect(points.map((point) => point.cumulative)).toEqual([0, 0.07, 0.09000000000000001])
    expect(precipitationTotal(points)).toBeCloseTo(0.09)
    expect(points[0].endTime?.toISOString()).toBe('2026-08-27T20:00:00.000Z')
  })

  it('clamps invalid provider values without inventing a nonzero bar', () => {
    const points = buildPrecipitationTimeline([
      { precipitation: -1, precipitation_probability: -20 },
      { precipitation: 'unavailable', precipitation_probability: 140 },
    ])

    expect(points[0]).toMatchObject({ amount: 0, cumulative: 0, probability: 0 })
    expect(points[1]).toMatchObject({ amount: null, cumulative: null, probability: 100 })
  })

  it('propagates a missing bucket through subsequent cumulative values and the total', () => {
    const points = buildPrecipitationTimeline([
      { precipitation: 0.2, precipitation_probability: 0 },
      { precipitation: null, precipitation_probability: 65 },
      { precipitation: 0.3 },
    ])
    expect(points.map((point) => point.amount)).toEqual([0.2, null, 0.3])
    expect(points.map((point) => point.cumulative)).toEqual([0.2, null, null])
    expect(points.map((point) => point.probability)).toEqual([0, 65, null])
    expect(precipitationTotal(points)).toBeNull()
    expect(precipitationTotal([])).toBeNull()
  })

  it('distinguishes true zero from wholly unknown amount and probability series', () => {
    const zero = buildPrecipitationTimeline([{ precipitation: 0 }, { precipitation: '0', precipitation_probability: 0 }])
    expect(zero.map((point) => point.cumulative)).toEqual([0, 0])
    expect(zero.map((point) => point.probability)).toEqual([null, 0])
    expect(precipitationTotal(zero)).toBe(0)
    const missing = buildPrecipitationTimeline([{}, { precipitation: Number.NaN, precipitation_probability: Infinity }])
    expect(missing.map((point) => point.cumulative)).toEqual([null, null])
    expect(precipitationTotal(missing)).toBeNull()
  })

  it('uses available width to choose a uniform label cadence without appending a crowded final label', () => {
    expect(precipitationLabelCadence(24, 153, 32)).toBe(6)
    expect(precipitationLabelIndices(24, 6)).toEqual([0, 6, 12, 18])
    expect(precipitationLabelCadence(24, 326, 32)).toBe(3)
    expect(precipitationLabelIndices(24, 3)).toEqual([0, 3, 6, 9, 12, 15, 18, 21])
  })

  it.each([
    [null, 10],
    [0, 10],
    [1, 10],
    [5, 10],
    [9, 10],
    [10, 10],
    [11, 20],
    [20, 20],
    [21, 30],
    [26, 30],
    [41, 50],
    [50, 50],
    [51, 60],
    [60, 60],
    [75, 80],
    [94, 100],
    [100, 100],
  ] as const)('selects a bounded chance domain for %s', (peak, expected) => {
    expect(precipitationChanceDomain(peak)).toBe(expected)
  })

  it.each([
    [0, 'in', 0.02, 0.01, 2],
    [0.005, 'in', 0.02, 0.01, 2],
    [0.01, 'in', 0.02, 0.01, 2],
    [0.02, 'in', 0.02, 0.01, 2],
    [0.04, 'in', 0.04, 0.02, 2],
    [0.09, 'in', 0.1, 0.05, 2],
    [0.12, 'in', 0.12, 0.06, 2],
    [0.19, 'in', 0.2, 0.1, 1],
    [1.01, 'in', 1.2, 0.6, 1],
    [0, 'mm', 0.5, 0.25, 2],
    [0.1, 'mm', 0.5, 0.25, 2],
    [0.7, 'mm', 0.8, 0.4, 1],
    [2.286, 'mm', 2.5, 1.25, 2],
    [7.3, 'mm', 8, 4, 0],
    [130, 'mm', 150, 75, 0],
  ] as const)('selects a nice amount axis for %s %s', (total, unit, domain, step, maximumFractionDigits) => {
    expect(precipitationAmountAxis(total, unit)).toEqual({ domain, maximumFractionDigits, step })
  })

  it('scales values into their selected domains without clipping', () => {
    expect(precipitationScaledPercent(5, 10)).toBe(50)
    expect(precipitationScaledPercent(9, 10)).toBe(90)
    expect(precipitationScaledPercent(41, 50)).toBe(82)
    expect(precipitationScaledPercent(0.09, 0.1)).toBe(90)
    expect(precipitationScaledPercent(100, 100)).toBe(100)
    expect(precipitationScaledPercent(120, 100)).toBe(100)

  })

})
