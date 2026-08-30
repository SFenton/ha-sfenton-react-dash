import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WeatherHourlyMetricTiles } from './WeatherHourlyMetricTiles'

const FORECASTS = [
  { cloud_coverage: 20, datetime: '2026-08-29T14:00:00-07:00', humidity: 62 },
  { cloud_coverage: 35, datetime: '2026-08-29T15:00:00-07:00', humidity: 66 },
  { cloud_coverage: 55, datetime: '2026-08-29T16:00:00-07:00', humidity: 71 },
  { cloud_coverage: 70, datetime: '2026-08-29T17:00:00-07:00', humidity: 74 },
  { cloud_coverage: 45, datetime: '2026-08-29T18:00:00-07:00', humidity: 69 },
  { cloud_coverage: 25, datetime: '2026-08-29T19:00:00-07:00', humidity: 64 },
]

describe('WeatherHourlyMetricTiles', () => {
  it('renders filled humidity and cloud cover columns with shared labels', () => {
    render(<WeatherHourlyMetricTiles forecasts={FORECASTS} />)

    const humidity = screen.getByRole('article', { name: 'Hourly Humidity over 6 hours, ranging from 62% to 74%' })
    const cloud = screen.getByRole('article', { name: 'Hourly Cloud Cover over 6 hours, ranging from 20% to 70%' })
    const humidityLabels = [...humidity.querySelectorAll('[data-hourly-metric-label="humidity"]')].map((label) => label.textContent)
    const cloudLabels = [...cloud.querySelectorAll('[data-hourly-metric-label="cloud"]')].map((label) => label.textContent)

    expect(humidity.querySelectorAll('[data-hourly-metric-bar="true"]')).toHaveLength(6)
    expect(cloud.querySelectorAll('[data-hourly-metric-bar="true"]')).toHaveLength(6)
    expect(humidity.querySelector('[data-precipitation-y-axis="humidity"]')).toHaveTextContent('80%40%0%')
    expect(cloud.querySelector('[data-precipitation-y-axis="cloud"]')).toHaveTextContent('70%35%0%')
    expect(humidity.querySelector('[data-hourly-metric-plot="humidity"]')).not.toHaveAttribute('data-axis-truncated')
    expect(humidity.querySelectorAll('[class*="metricTrack"]')).toHaveLength(0)
    expect(cloud.querySelectorAll('[class*="metricTrack"]')).toHaveLength(0)
    expect(humidityLabels).toEqual(cloudLabels)
    expect(humidityLabels[0]).toBe('Now')
    expect(humidity.querySelector('[data-metric="humidity"]')).toHaveAttribute('data-value', '62')
    expect(humidity.querySelector('[data-metric="humidity"]')).toHaveStyle({ '--weather-metric-percent': '77.5%' })
    expect(cloud.querySelector('[data-metric="cloud"]')).toHaveAttribute('data-value', '20')
    expect(within(document.querySelector('[data-weather-hourly-metric-tiles="true"]') as HTMLElement).getAllByRole('row')).toHaveLength(7)
  })

  it('keeps each metric independently available', () => {
    render(<WeatherHourlyMetricTiles forecasts={[{ cloud_coverage: 12 }]} />)

    expect(screen.getByRole('article', { name: 'Hourly Humidity over 1 hours, ranging from Unavailable to Unavailable' })).toHaveAttribute('data-unavailable', 'true')
    expect(screen.getByRole('article', { name: 'Hourly Cloud Cover over 1 hours, ranging from 12% to 12%' })).not.toHaveAttribute('data-unavailable')
  })
})
