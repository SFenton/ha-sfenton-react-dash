import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WeatherAtmosphere } from './WeatherAtmosphere'
import { WEATHER_SCENES } from './weatherPresentation'
import { SNOW_FLAKE_COUNT, SNOW_NARROW_FLAKE_COUNT, SNOW_STATIC_FLAKE_COUNT } from './weatherAtmosphereModel'

describe('WeatherAtmosphere', () => {
  it('renders deterministic falling drops for rain and denser storms', () => {
    const view = render(<WeatherAtmosphere condition="rainy" />)
    expect(view.container.querySelector('[data-weather-rain-field="true"]')).toBeInTheDocument()
    expect(view.container.querySelectorAll('[data-weather-raindrop="true"]')).toHaveLength(34)

    view.rerender(<WeatherAtmosphere condition="lightning-rainy" />)
    expect(view.container.querySelectorAll('[data-weather-raindrop="true"]')).toHaveLength(44)
  })

  it('keeps non-rain scenes free of rain particles', () => {
    const view = render(<WeatherAtmosphere condition="clear-night" />)
    expect(view.container.querySelector('[data-weather-rain-field="true"]')).not.toBeInTheDocument()
  })

  it.each(WEATHER_SCENES)('renders an explicit %s scene independently of live conditions and night state', (scene) => {
    const { container } = render(<WeatherAtmosphere condition="rainy" isNight sceneOverride={scene} />)
    expect(container.firstElementChild).toHaveAttribute('data-weather-scene', scene)
    expect(container.querySelectorAll('[data-weather-raindrop="true"]')).toHaveLength(
      scene === 'storm' ? 44 : scene === 'rain' ? 34 : 0,
    )
  })

  it('returns to the live scene when the override is cleared', () => {
    const view = render(<WeatherAtmosphere condition="sunny" isNight sceneOverride="sunny" />)
    expect(view.container.firstElementChild).toHaveAttribute('data-weather-scene', 'sunny')
    view.rerender(<WeatherAtmosphere condition="sunny" isNight />)
    expect(view.container.firstElementChild).toHaveAttribute('data-weather-scene', 'night')
  })

  it('retains every accepted Rain descriptor rather than deriving an expectation from the renderer', () => {
    const { container } = render(<WeatherAtmosphere sceneOverride="rain" />)
    const properties = Array.from(container.querySelectorAll<HTMLElement>('[data-weather-raindrop]')).map((element) => (
      Object.fromEntries(Array.from({ length: element.style.length }, (_, index) => element.style.item(index))
        .sort().map((name) => [name, element.style.getPropertyValue(name)]))
    ))
    // Captured from the user-approved preview before the non-Rain implementation.
    expect(createHash('sha256').update(JSON.stringify(properties)).digest('hex'))
      .toBe('d8c8be5974643f0105a34e8080aa764f8e1f1bdbd773da68922edc2631f9987b')
  })

  it.each(WEATHER_SCENES)('keeps precipitation and illumination DOM scoped to the %s scene', (scene) => {
    const { container } = render(<WeatherAtmosphere sceneOverride={scene} />)
    expect(container.querySelectorAll('[data-weather-storm-flash]')).toHaveLength(scene === 'storm' ? 1 : 0)
    expect(container.querySelectorAll('[data-weather-snow-field]')).toHaveLength(scene === 'snow' ? 1 : 0)
    expect(container.querySelectorAll('[data-weather-snowflake]')).toHaveLength(scene === 'snow' ? SNOW_FLAKE_COUNT : 0)
    expect(container.querySelectorAll('[data-weather-wind-wisp]')).toHaveLength(scene === 'wind' ? 4 : 0)
    expect(container.querySelectorAll('[data-weather-night-star]')).toHaveLength(scene === 'night' ? 35 : 0)
    expect(container.querySelector('img, image, use, canvas, filter, video, iframe')).toBeNull()
  })

  it('renders bounded, inert, deterministic SVG flakes and an explicit static subset', () => {
    const view = render(<WeatherAtmosphere sceneOverride="snow" />)
    const flakes = Array.from(view.container.querySelectorAll<SVGSVGElement>('[data-weather-snowflake]'))
    expect(flakes).toHaveLength(SNOW_FLAKE_COUNT)
    expect(view.container.querySelectorAll('[data-snow-extra="true"]')).toHaveLength(SNOW_FLAKE_COUNT - SNOW_NARROW_FLAKE_COUNT)
    expect(view.container.querySelectorAll('[data-snow-static="true"]')).toHaveLength(SNOW_STATIC_FLAKE_COUNT)
    for (const flake of flakes) {
      expect(flake.tagName.toLowerCase()).toBe('svg')
      expect(flake).toHaveAttribute('aria-hidden', 'true')
      expect(flake).toHaveAttribute('focusable', 'false')
      expect(flake.querySelectorAll('path')).toHaveLength(1)
      expect(flake.querySelector('path')?.getAttribute('d')).toContain('M10 10L')
    }
    const before = flakes.map((flake) => flake.outerHTML)
    view.rerender(<WeatherAtmosphere condition="rainy" isNight sceneOverride="snow" />)
    expect(Array.from(view.container.querySelectorAll('[data-weather-snowflake]')).map((flake) => flake.outerHTML)).toEqual(before)
  })
})
import { createHash } from 'node:crypto'
