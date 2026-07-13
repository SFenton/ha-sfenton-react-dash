import { describe, expect, it } from 'vitest'
import {
  THERMOSTAT_HANDLE_HIT_TARGET_SIZE_PX,
  THERMOSTAT_MARKER_OUTER_SIZE_PX,
  THERMOSTAT_MIN_SUPPORTED_MODAL_DIAL_SIZE_PX,
  THERMOSTAT_MODAL_DIAL_GUTTER_PX,
  thermostatPointIsOnRing,
  thermostatRawValueFromPoint,
  thermostatRequiredTopGutter,
  thermostatTargetBounds,
  thermostatValueFromPoint,
  valueToThermostatPoint,
} from './thermostatDialGeometry'

const MIN_TEMPERATURE = 45
const MAX_TEMPERATURE = 95
const TOP_ARC_TEMPERATURE = 70
const DIAL_RECT = {
  bottom: 500,
  height: 300,
  left: 100,
  right: 400,
  top: 200,
  width: 300,
  x: 100,
  y: 200,
  toJSON: () => ({}),
} as DOMRect

function clientPointForValue(value: number, min: number, max: number) {
  const point = valueToThermostatPoint(value, min, max)
  return {
    x: DIAL_RECT.left + (point.x / 100) * DIAL_RECT.width,
    y: DIAL_RECT.top + (point.y / 100) * DIAL_RECT.height,
  }
}

describe('thermostat dial geometry', () => {
  it('reserves enough modal gutter for the full 64px hit target at every half-degree target', () => {
    for (const dialSize of [THERMOSTAT_MIN_SUPPORTED_MODAL_DIAL_SIZE_PX, 300, 316]) {
      for (let value = MIN_TEMPERATURE; value <= MAX_TEMPERATURE; value += 0.5) {
        expect(
          thermostatRequiredTopGutter(
            value,
            MIN_TEMPERATURE,
            MAX_TEMPERATURE,
            dialSize,
            THERMOSTAT_HANDLE_HIT_TARGET_SIZE_PX,
          ),
        ).toBeLessThanOrEqual(THERMOSTAT_MODAL_DIAL_GUTTER_PX)
      }
    }
  })

  it('captures the former top-arc paint overflow and clears it with the shared gutter', () => {
    const paintOverflow = thermostatRequiredTopGutter(
      TOP_ARC_TEMPERATURE,
      MIN_TEMPERATURE,
      MAX_TEMPERATURE,
      300,
      THERMOSTAT_MARKER_OUTER_SIZE_PX,
    )
    const hitTargetOverflow = thermostatRequiredTopGutter(
      TOP_ARC_TEMPERATURE,
      MIN_TEMPERATURE,
      MAX_TEMPERATURE,
      300,
      THERMOSTAT_HANDLE_HIT_TARGET_SIZE_PX,
    )

    expect(paintOverflow).toBeCloseTo(1.9375)
    expect(hitTargetOverflow).toBeCloseTo(17.9375)
    expect(hitTargetOverflow).toBeLessThan(THERMOSTAT_MODAL_DIAL_GUTTER_PX)
  })

  it('keeps minimum and maximum hit targets inside the dial horizontally and below its top edge', () => {
    for (const value of [MIN_TEMPERATURE, MAX_TEMPERATURE]) {
      const bounds = thermostatTargetBounds(
        value,
        MIN_TEMPERATURE,
        MAX_TEMPERATURE,
        300,
        THERMOSTAT_HANDLE_HIT_TARGET_SIZE_PX,
      )
      expect(bounds.left).toBeGreaterThanOrEqual(0)
      expect(bounds.right).toBeLessThanOrEqual(300)
      expect(bounds.top).toBeGreaterThanOrEqual(0)
      expect(bounds.bottom).toBeLessThanOrEqual(300)
    }
  })

  it('places the midpoint target at the top of the 270-degree arc', () => {
    expect(valueToThermostatPoint(TOP_ARC_TEMPERATURE, MIN_TEMPERATURE, MAX_TEMPERATURE)).toEqual({
      x: 50,
      y: 4.6875,
    })
  })

  it('maps bed dial endpoint and midpoint taps to bounded target levels', () => {
    for (const target of [-10, 0, 10]) {
      const point = clientPointForValue(target, -10, 10)
      expect(thermostatValueFromPoint(DIAL_RECT, point.x, point.y, -10, 10, 1)).toBe(target)
    }
  })

  it('rounds dial taps to the configured step without escaping the entity bounds', () => {
    const lowerPoint = clientPointForValue(4.24, -10, 10)
    const upperPoint = clientPointForValue(4.76, -10, 10)
    const deadArcPoint = {
      x: DIAL_RECT.left + DIAL_RECT.width / 2,
      y: DIAL_RECT.bottom,
    }

    expect(thermostatValueFromPoint(DIAL_RECT, lowerPoint.x, lowerPoint.y, -10, 10, 0.5)).toBe(4)
    expect(thermostatValueFromPoint(DIAL_RECT, upperPoint.x, upperPoint.y, -10, 10, 0.5)).toBe(5)
    expect(thermostatRawValueFromPoint(DIAL_RECT, deadArcPoint.x, deadArcPoint.y, -10, 10)).toBe(-10)
  })

  it('accepts taps on the ring hit target without treating the center readout as a dial tap', () => {
    const ringPoint = clientPointForValue(6, -10, 10)
    expect(thermostatPointIsOnRing(DIAL_RECT, ringPoint.x, ringPoint.y)).toBe(true)
    expect(thermostatPointIsOnRing(DIAL_RECT, DIAL_RECT.left + DIAL_RECT.width / 2, DIAL_RECT.top + DIAL_RECT.height / 2)).toBe(false)
  })
})
