import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { mockCallServiceCalls, mockEntities, resetMockHass, setMockEntityState } from '../../test/mocks/hakitCoreState'
import { WeatherSummary } from './WeatherSummary'
import { WEATHER_SCENES } from './weatherPresentation'

describe('weather scene debug URLs', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('MODE', 'test')
    window.history.replaceState(null, '', '/')
    resetMockHass()
    mockEntities['weather.pirate_weather'].state = 'cloudy'
    mockEntities['sun.sun'].state = 'below_horizon'
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
  })

  async function openWeather() {
    render(<WeatherSummary />)
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: /Open seven-day weather forecast/ }))
    return screen.getByRole('dialog', { name: 'Weather' })
  }

  function setDebugScene(scene?: string) {
    const url = new URL(window.location.href)
    url.searchParams.set('weatherSceneDebug', '1')
    if (scene) url.searchParams.set('weatherScene', scene)
    else url.searchParams.delete('weatherScene')
    window.history.replaceState(window.history.state, '', url)
    fireEvent.click(screen.getByRole('button', { name: /Open seven-day weather forecast/, hidden: true }))
  }

  it('previews every explicit debug scene without visible controls, changed readings or service calls', async () => {
    const dialog = await openWeather()
    const initialCalls = mockCallServiceCalls.length
    const conditions = dialog.querySelector('[aria-label="Current weather conditions"]')?.textContent

    for (const scene of WEATHER_SCENES) {
      setDebugScene(scene)
      expect(dialog.querySelector('[data-weather-scene]')).toHaveAttribute('data-weather-scene', scene)
      expect(dialog.querySelector('[aria-label="Current weather conditions"]')?.textContent).toBe(conditions)
      expect(new URLSearchParams(window.location.search).get('weatherScene')).toBe(scene)
      expect(within(dialog).queryByRole('combobox')).not.toBeInTheDocument()
      expect(dialog.querySelector('[data-weather-scene-preview]')).not.toBeInTheDocument()
    }
    await act(async () => {})
    expect(mockCallServiceCalls).toHaveLength(initialCalls)
  })

  it('honors explicit legacy rain links, preserves other query parameters, and restores live weather', async () => {
    window.history.replaceState(null, '', '/?path=overview&weatherSceneDebug=1&weatherScene=rainy&modalBackdrop=full')
    const dialog = await openWeather()
    expect(dialog.querySelector('[data-weather-scene]')).toHaveAttribute('data-weather-scene', 'rain')

    setDebugScene('sunny')
    expect(dialog.querySelector('[data-weather-scene]')).toHaveAttribute('data-weather-scene', 'sunny')
    expect(new URLSearchParams(window.location.search).get('modalBackdrop')).toBe('full')
    setDebugScene()
    expect(new URLSearchParams(window.location.search).has('weatherScene')).toBe(false)
    expect(dialog.querySelector('[data-weather-scene]')).toHaveAttribute('data-weather-scene', 'clouds')
    await act(async () => setMockEntityState('weather.pirate_weather', 'sunny'))
    expect(dialog.querySelector('[data-weather-scene]')).toHaveAttribute('data-weather-scene', 'night')
  })

  it.each([
    '?weatherScene=rainy',
    '?weatherSceneDebug=0&weatherScene=snow',
    '?weatherSceneDebug=true&weatherScene=storm',
    '?weatherSceneDebug=1&weatherScene=invalid',
  ])('uses live weather for stale or invalid preview URL %s', async (query) => {
    window.history.replaceState(null, '', `/${query}`)
    const dialog = await openWeather()
    expect(dialog.querySelector('[data-weather-scene]')).toHaveAttribute('data-weather-scene', 'clouds')
    expect(within(dialog).queryByRole('combobox')).not.toBeInTheDocument()
    await act(async () => setMockEntityState('weather.pirate_weather', 'sunny'))
    expect(dialog.querySelector('[data-weather-scene]')).toHaveAttribute('data-weather-scene', 'night')
  })

  it('keeps controls and explicit debug overrides out of production', async () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('MODE', 'production')
    window.history.replaceState(null, '', '/?weatherSceneDebug=1&weatherScene=rainy')
    const dialog = await openWeather()
    expect(within(dialog).queryByRole('combobox', { name: 'Background preview' })).not.toBeInTheDocument()
    expect(dialog.querySelector('[data-weather-scene]')).toHaveAttribute('data-weather-scene', 'clouds')
  })
})
