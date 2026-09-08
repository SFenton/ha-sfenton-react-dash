import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { resetMockHass, setMockEntityAttribute } from '../../test/mocks/hakitCoreState'
import { WeatherSummary } from './WeatherSummary'

describe('weather pressure highlight', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
    resetMockHass()
  })

  afterEach(cleanup)

  it.each([
    [29.92, 'inHg', '29.92', false],
    [1013.25, 'hPa', '1,013.25', true],
    [1013.25, 'mbar', '1,013.25', true],
    [1013.25, 'mb', '1,013.25', true],
    [101.325, 'kPa', '101.33', false],
    [101325.25, 'Pa', '101,325.25', true],
  ])('keeps the complete %s %s reading and inert gauge', async (value, unit, formatted, compact) => {
    setMockEntityAttribute('weather.pirate_weather', 'pressure', value)
    setMockEntityAttribute('weather.pirate_weather', 'pressure_unit', unit)
    render(<WeatherSummary />)
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: /Open seven-day weather forecast/ }))
    const tile = screen.getByRole('article', { name: `Pressure ${formatted} ${unit}` })
    const reading = within(tile).getByText(formatted)
    expect(within(tile).getByText(unit)).toBeInTheDocument()
    expect(reading.getAttribute('data-pressure-compact')).toBe(compact ? 'true' : null)
    expect(tile.querySelector('svg[viewBox="0 18 200 140"]')).toHaveAttribute('aria-hidden', 'true')
    expect(tile.querySelector('svg[viewBox="0 18 200 140"]')).toHaveAttribute('focusable', 'false')
    expect(tile.querySelectorAll('line')).toHaveLength(50)
  })

  it.each([[undefined, 'hPa'], ['unknown', 'hPa'], [29.92, 'unknown']])(
    'does not invent a gauge or reading for %s %s',
    async (value, unit) => {
      setMockEntityAttribute('weather.pirate_weather', 'pressure', value)
      setMockEntityAttribute('weather.pirate_weather', 'pressure_unit', unit)
      render(<WeatherSummary />)
      await act(async () => {})
      fireEvent.click(screen.getByRole('button', { name: /Open seven-day weather forecast/ }))
      const tile = screen.getByRole('article', { name: 'Pressure Unavailable' })
      expect(tile).toHaveAttribute('data-unavailable', 'true')
      expect(tile.querySelector('svg[viewBox="0 18 200 140"]')).not.toBeInTheDocument()
    },
  )
})
