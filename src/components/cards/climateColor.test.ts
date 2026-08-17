import { cardColorCss, colorFromHumidity, colorFromRgba, colorFromTemperature } from './climateColor'

describe('climate color scales', () => {
  it('keeps the existing temperature gradient and parses HA color helpers', () => {
    expect(colorFromTemperature(50)).toEqual({ r: 0, g: 110, b: 255 })
    expect(colorFromTemperature(85)).toEqual({ r: 255, g: 0, b: 0 })
    expect(colorFromRgba('rgba(12, 34, 56, 1)')).toEqual({ r: 12, g: 34, b: 56 })
  })

  it('maps humidity through the same blue-to-red visual scale', () => {
    expect(colorFromHumidity(20)).toEqual({ r: 0, g: 110, b: 255 })
    expect(colorFromHumidity(45)).toEqual({ r: 128, g: 208, b: 60 })
    expect(colorFromHumidity(70)).toEqual({ r: 255, g: 0, b: 0 })
    expect(cardColorCss({ r: 128, g: 208, b: 60 })).toBe('rgb(128 208 60 / 0.6)')
  })
})
