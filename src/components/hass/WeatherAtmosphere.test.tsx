import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WeatherAtmosphere } from './WeatherAtmosphere'

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
})
