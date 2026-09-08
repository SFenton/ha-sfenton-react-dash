import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WeatherPrecipitationTile } from './WeatherPrecipitationTile'

const LOW_FORECAST = [
  { datetime: '2026-08-29T10:00:00-07:00', precipitation: 0.04, precipitation_probability: 41 },
  { datetime: '2026-08-29T11:00:00-07:00', precipitation: 0.02, precipitation_probability: 26 },
  { datetime: '2026-08-29T12:00:00-07:00', precipitation: 0.03, precipitation_probability: 17 },
]

describe('WeatherPrecipitationTile', () => {
  it('uses the 10 percent low-range domain for the current six-hour pattern', () => {
    render(<WeatherPrecipitationTile
      forecasts={[8, 9, 7, 6, 6, 0].map((precipitationProbability) => ({
        precipitation: 0,
        precipitation_probability: precipitationProbability,
      }))}
      precipitationUnit="in"
    />)

    const group = document.querySelector('[data-weather-precipitation-tile="true"]')
    const chanceTile = screen.getByRole('article', { name: 'Hourly precipitation chance over 6 hours, peaking at 9%' })
    const cumulativeTile = screen.getByRole('article', { name: 'Cumulative precipitation through 6 hours, totaling 0.00 in' })
    const chanceTimes = [...chanceTile.querySelectorAll('[data-precipitation-hour-label="time"]')].map((label) => label.textContent)
    const cumulativeTimes = [...cumulativeTile.querySelectorAll('[data-precipitation-hour-label="cumulative-time"]')].map((label) => label.textContent)
    expect(group).toHaveAttribute('data-precipitation-chance-domain', '10')
    expect(chanceTile).toHaveTextContent('Precipitation')
    expect(cumulativeTile).toHaveTextContent('Accumulation')
    expect(chanceTile.querySelector('[data-precipitation-y-axis="chance"]')).toHaveTextContent('10%5%0%')
    expect(cumulativeTile.querySelectorAll('[data-precipitation-hour-label="cumulative-time"]')).toHaveLength(3)
    expect(chanceTimes).toEqual(cumulativeTimes)
    expect(chanceTimes[0]).toBe('Now')
    expect(chanceTile.querySelector('[data-probability="9"]')).toHaveStyle({ '--precipitation-probability': '90%' })
    expect(chanceTile.querySelector('[data-probability="0"]')).toHaveStyle({ '--precipitation-probability': '0%' })
    expect(group?.querySelectorAll('[data-precipitation-sample]')).toHaveLength(2)
    expect(chanceTile.querySelectorAll('[data-precipitation-bar="true"]')).toHaveLength(6)
    expect(cumulativeTile.querySelectorAll('[data-cumulative-bar="true"]')).toHaveLength(6)
  })

  it('rescales low chance and amount data to readable nice domains', () => {
    render(<WeatherPrecipitationTile forecasts={LOW_FORECAST} precipitationUnit="in" />)

    const group = document.querySelector('[data-weather-precipitation-tile="true"]')
    const chanceTile = screen.getByRole('article', { name: 'Hourly precipitation chance over 3 hours, peaking at 41%' })
    const cumulativeTile = screen.getByRole('article', { name: 'Cumulative precipitation through 3 hours, totaling 0.09 in' })
    expect(group).toHaveAttribute('data-precipitation-chance-domain', '50')
    expect(group).toHaveAttribute('data-precipitation-amount-domain', '0.1')
    expect(chanceTile.querySelector('[data-precipitation-y-axis="chance"]')).toHaveTextContent('50%25%0%')
    expect(cumulativeTile.querySelector('[data-precipitation-y-axis="cumulative"]')).toHaveTextContent('0.1 in0.05 in0 in')
    expect(chanceTile.querySelector('[data-probability="41"]')).toHaveStyle({ '--precipitation-probability': '82%' })
    expect(cumulativeTile.querySelector('[data-cumulative-bar="true"][data-index="2"]')).toHaveStyle({ '--cumulative-amount': '90%' })
  })

  it('updates both domains when new forecast values arrive', () => {
    const view = render(<WeatherPrecipitationTile forecasts={LOW_FORECAST} precipitationUnit="in" />)
    view.rerender(<WeatherPrecipitationTile
      forecasts={[
        { precipitation: 0.06, precipitation_probability: 50 },
        { precipitation: 0.06, precipitation_probability: 49 },
      ]}
      precipitationUnit="in"
    />)

    const group = document.querySelector('[data-weather-precipitation-tile="true"]')
    const chanceTile = screen.getByRole('article', { name: 'Hourly precipitation chance over 2 hours, peaking at 50%' })
    const cumulativeTile = screen.getByRole('article', { name: 'Cumulative precipitation through 2 hours, totaling 0.12 in' })
    expect(group).toHaveAttribute('data-precipitation-chance-domain', '50')
    expect(group).toHaveAttribute('data-precipitation-amount-domain', '0.12')
    expect(chanceTile.querySelector('[data-precipitation-y-axis="chance"]')).toHaveTextContent('50%25%0%')
    expect(cumulativeTile.querySelector('[data-precipitation-y-axis="cumulative"]')).toHaveTextContent('0.12 in0.06 in0 in')
    expect(chanceTile.querySelector('[data-probability="50"]')).toHaveStyle({ '--precipitation-probability': '100%' })
  })

  it('uses a trace-scale floor for zero amounts and unit-aware millimeter ticks', () => {
    const view = render(<WeatherPrecipitationTile
      forecasts={[{ precipitation: 0, precipitation_probability: 0 }]}
      precipitationUnit="in"
    />)
    let cumulativeTile = screen.getByRole('article', { name: 'Cumulative precipitation through 1 hours, totaling 0.00 in' })
    expect(cumulativeTile.querySelector('[data-precipitation-y-axis="cumulative"]')).toHaveTextContent('0.02 in0.01 in0 in')

    view.rerender(<WeatherPrecipitationTile
      forecasts={[{ precipitation: 2.286, precipitation_probability: 20 }]}
      precipitationUnit="mm"
    />)
    const group = document.querySelector('[data-weather-precipitation-tile="true"]')
    cumulativeTile = screen.getByRole('article', { name: 'Cumulative precipitation through 1 hours, totaling 2.3 mm' })
    expect(group).toHaveAttribute('data-precipitation-amount-domain', '2.5')
    expect(cumulativeTile.querySelector('[data-precipitation-y-axis="cumulative"]')).toHaveTextContent('2.5 mm1.25 mm0 mm')
    expect(within(group as HTMLElement).getByRole('table', { name: '1-hour precipitation details' })).toBeInTheDocument()
  })

  it.each(['in', 'mm'])('does not claim a complete accumulation after a gap (%s)', (unit) => {
    const { container } = render(<WeatherPrecipitationTile forecasts={[
      { precipitation: 0.2, precipitation_probability: 0 },
      { precipitation: null, precipitation_probability: 65 },
      { precipitation: 0.3, precipitation_probability: 10 },
    ]} precipitationUnit={unit} />)
    const tile = screen.getByRole('article', { name: 'Cumulative precipitation through 3 hours, totaling Unavailable' })
    expect(tile).toHaveAttribute('data-unavailable', 'true')
    expect(tile).toHaveTextContent('Unavailable')
    expect(tile.querySelector('[data-cumulative-bar="true"]')).toBeNull()
    expect(tile.querySelector('[data-precipitation-y-axis="cumulative"]')).toBeNull()
    expect(container.querySelector('[data-weather-precipitation-tile]')).toHaveAttribute('data-precipitation-amount-domain', 'unavailable')
    const chanceTile = screen.getByRole('article', { name: 'Hourly precipitation chance over 3 hours, peaking at 65%' })
    expect(chanceTile.querySelector('[data-probability="0"]')).toHaveStyle({ '--precipitation-probability': '0%' })
    expect(chanceTile.querySelector('[data-amount="unavailable"]')).toHaveAttribute('data-probability', '65')
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    const digits = unit === 'mm' ? 1 : 2
    expect(within(rows[0]).getAllByRole('cell')[3]).toHaveTextContent(`${(0.2).toFixed(digits)} ${unit}`)
    expect(within(rows[1]).getAllByRole('cell')[2]).toHaveTextContent('Unavailable')
    expect(within(rows[1]).getAllByRole('cell')[3]).toHaveTextContent('Unavailable')
    expect(within(rows[2]).getAllByRole('cell')[2]).toHaveTextContent(`${(0.3).toFixed(digits)} ${unit}`)
    expect(within(rows[2]).getAllByRole('cell')[3]).toHaveTextContent('Unavailable')
  })

  it('keeps millimeter zero accumulation independent of unknown chance', () => {
    render(<WeatherPrecipitationTile forecasts={[{ precipitation: 0 }, { precipitation: 0 }]} precipitationUnit="mm" />)
    const tile = screen.getByRole('article', { name: 'Cumulative precipitation through 2 hours, totaling 0.0 mm' })
    expect(tile).not.toHaveAttribute('data-unavailable')
    expect(tile.querySelectorAll('[data-cumulative-bar="true"]')).toHaveLength(2)
    expect(tile.querySelector('[data-cumulative-bar="true"]')).toHaveStyle({ '--cumulative-amount': '0%' })
    expect(screen.getByRole('article', { name: 'Hourly precipitation chance over 2 hours, peaking at Unavailable' })).toHaveAttribute('data-unavailable', 'true')
  })

  it('does not turn known zero probability into known zero amount', () => {
    render(<WeatherPrecipitationTile forecasts={[{ precipitation_probability: 0 }]} precipitationUnit="mm" />)
    expect(screen.getByRole('article', { name: 'Cumulative precipitation through 1 hours, totaling Unavailable' })).toHaveAttribute('data-unavailable', 'true')
    const chance = screen.getByRole('article', { name: 'Hourly precipitation chance over 1 hours, peaking at 0%' })
    expect(chance).not.toHaveAttribute('data-unavailable')
    expect(chance.querySelector('[data-probability="0"]')).toHaveAttribute('data-amount', 'unavailable')
  })
})
