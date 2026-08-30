import { describe, expect, it } from 'vitest'
import { hourlyPercentAxis, hourlyPercentPosition, type HourlyPercentMetric } from './hourlyPercentAxis'

describe('hourly percent axis', () => {
  it.each([
    ['humidity', [62, 70], { lower: 60, middle: 65, truncated: true, upper: 70 }],
    ['cloud', [31, 61], { lower: 30, middle: 50, truncated: true, upper: 70 }],
    ['humidity', [62, 74], { lower: 60, middle: 70, truncated: true, upper: 80 }],
    ['cloud', [20, 70], { lower: 0, middle: 35, truncated: false, upper: 70 }],
    ['humidity', [65, 65], { lower: 60, middle: 65, truncated: true, upper: 70 }],
    ['cloud', [0, 0], { lower: 0, middle: 5, truncated: false, upper: 10 }],
    ['humidity', [100, 100], { lower: 90, middle: 95, truncated: true, upper: 100 }],
    ['humidity', [68, 72], { lower: 65, middle: 70, truncated: true, upper: 75 }],
    ['cloud', [5, 15], { lower: 0, middle: 10, truncated: false, upper: 20 }],
    ['cloud', [0, 30], { lower: 0, middle: 15, truncated: false, upper: 30 }],
    ['humidity', [92, 99], { lower: 90, middle: 95, truncated: true, upper: 100 }],
  ] as const)('selects %s guides for %j', (metric, values, expected) => {
    expect(hourlyPercentAxis(values, metric as HourlyPercentMetric)).toEqual(expected)
  })

  it('ignores missing values and returns unavailable when no values remain', () => {
    expect(hourlyPercentAxis([62, null, 70], 'humidity')).toEqual({ lower: 60, middle: 65, truncated: true, upper: 70 })
    expect(hourlyPercentAxis([null, null], 'cloud')).toBeNull()
  })

  it('positions values within a ranged axis without collapsing the lower bound', () => {
    const axis = { lower: 60, middle: 65, truncated: true, upper: 70 }
    expect(hourlyPercentPosition(60, axis)).toBe(0)
    expect(hourlyPercentPosition(65, axis)).toBe(50)
    expect(hourlyPercentPosition(70, axis)).toBe(100)
    expect(hourlyPercentPosition(null, axis)).toBe(0)
  })
})
