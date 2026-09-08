import { render } from '@testing-library/react'
import { WeatherRail } from './WeatherRail'
import { WEATHER_DATA_TRANSITION_MS, WIND_ROTATION_EASING } from './weatherPresentation'

describe('WeatherRail', () => {
  it('renders a ranged temperature rail with the shared marker geometry', () => {
    const { container } = render(<WeatherRail markerPercent={40} rangeSizePercent={55} rangeStartPercent={20} tone="temperature" />)

    const rail = container.querySelector('[data-weather-rail="temperature"]')
    expect(rail).toHaveAttribute('data-weather-rail', 'temperature')
    expect(rail).toHaveStyle({
      '--weather-rail-marker': '40%',
      '--weather-rail-size': '55%',
      '--weather-rail-start': '20%',
    })
    expect(rail?.querySelector('[data-weather-rail-marker="true"]')).toBeInTheDocument()
  })

  it('fills scale rails and preserves the existing highlight selector', () => {
    const { container } = render(<WeatherRail markerPercent={67} tone="uv" />)
    const rail = container.querySelector('[data-weather-rail="uv"]')

    expect(rail).toHaveAttribute('data-weather-highlight-rail', 'uv')
    expect(rail).toHaveStyle({
      '--weather-rail-marker': '67%',
      '--weather-rail-size': '100%',
      '--weather-rail-start': '0%',
    })
  })

  it('uses the shared scale and marker for AQI', () => {
    const { container } = render(<WeatherRail markerPercent={30.4} tone="aqi" />)
    const rail = container.querySelector('[data-weather-rail="aqi"]')

    expect(rail).toHaveStyle({
      '--weather-rail-marker': '30.4%',
      '--weather-rail-size': '100%',
      '--weather-rail-start': '0%',
    })
    expect(rail?.querySelector('[data-weather-rail-marker="true"]')).toBeInTheDocument()
  })

  it('renders precipitation as a progress rail', () => {
    const { container } = render(<WeatherRail markerPercent={72} rangeSizePercent={72} tone="precipitation" />)
    const rail = container.querySelector('[data-weather-rail="precipitation"]')

    expect(rail).toHaveStyle({
      '--weather-rail-marker': '72%',
      '--weather-rail-size': '72%',
      '--weather-rail-start': '0%',
    })
  })

  it('supports a markerless visibility progress rail', () => {
    const { container } = render(<WeatherRail rangeSizePercent={0} tone="visibility" />)
    const rail = container.querySelector('[data-weather-rail="visibility"]')

    expect(rail).toHaveAttribute('data-visibility-visual', 'distance-rail')
    expect(rail?.querySelector('[data-weather-rail-marker="true"]')).toBeNull()
  })

  it.each([
    [100, 6, 100, 0],
    [98, 6, 98, 2],
    [0, 0, 0, 0],
    [50, 0, 50, 0],
    [0, 100, 0, 100],
    [-20, 30, 0, 30],
    [120, 30, 100, 0],
    [50, -30, 50, 0],
    [Number.NaN, 50, 0, 0],
    [Infinity, 50, 0, 0],
    [-Infinity, 50, 0, 0],
    [25, Number.NaN, 25, 0],
    [25, Infinity, 25, 0],
  ])('bounds start=%s size=%s without inventing a minimum range', (start, size, expectedStart, expectedSize) => {
    const { container } = render(<WeatherRail rangeSizePercent={size} rangeStartPercent={start} tone="temperature" />)
    const rail = container.querySelector<HTMLElement>('[data-weather-rail="temperature"]')!
    const renderedStart = Number.parseFloat(rail.style.getPropertyValue('--weather-rail-start'))
    const renderedSize = Number.parseFloat(rail.style.getPropertyValue('--weather-rail-size'))
    expect(renderedStart).toBe(expectedStart)
    expect(renderedSize).toBe(expectedSize)
    expect(renderedStart + renderedSize).toBeLessThanOrEqual(100)
    expect(Number.isFinite(renderedStart + renderedSize)).toBe(true)
  })

  it.each([Number.NaN, Infinity, -Infinity])('hides invalid markers (%s)', (markerPercent) => {
    const { container } = render(<WeatherRail markerPercent={markerPercent} tone="uv" />)
    expect(container.querySelector('[data-weather-rail-marker="true"]')).toBeNull()
    expect(container.querySelector('[data-weather-rail="uv"]')).toHaveStyle({ '--weather-rail-start': '0%', '--weather-rail-size': '100%' })
  })

  it('preserves synchronized motion with bounded keyframes and no initial sweep', () => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate')
    const cancel = vi.fn()
    const animation = { cancel, startTime: null, onfinish: null, oncancel: null } as unknown as Animation
    const animate = vi.fn(() => animation)
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate })
    try {
      const view = render(<WeatherRail markerPercent={0} motionEnabled rangeSizePercent={10} rangeStartPercent={0} tone="temperature" />)
      expect(animate).not.toHaveBeenCalled()
      view.rerender(<WeatherRail markerPercent={100} motionEnabled rangeSizePercent={6} rangeStartPercent={98} tone="temperature" />)
      expect(animate).toHaveBeenCalledTimes(1)
      const [frames, options] = animate.mock.calls[0] as unknown as [Record<string, string>[], KeyframeAnimationOptions]
      expect(options).toMatchObject({ duration: WEATHER_DATA_TRANSITION_MS, easing: WIND_ROTATION_EASING })
      expect(WEATHER_DATA_TRANSITION_MS).toBe(390)
      for (const frame of frames) {
        expect(Number.parseFloat(frame['--weather-rail-start']) + Number.parseFloat(frame['--weather-rail-size'])).toBeLessThanOrEqual(100)
      }
      expect(frames[1]).toMatchObject({ '--weather-rail-marker': '100%', '--weather-rail-size': '2%', '--weather-rail-start': '98%' })
      view.unmount()
      expect(cancel).toHaveBeenCalledTimes(1)
    } finally {
      if (descriptor) Object.defineProperty(HTMLElement.prototype, 'animate', descriptor)
      else Reflect.deleteProperty(HTMLElement.prototype, 'animate')
    }
  })

  it('does not animate data hydration when motion is first enabled', () => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate')
    const animate = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'animate', { configurable: true, value: animate })
    try {
      const view = render(<WeatherRail tone="temperature" />)
      view.rerender(<WeatherRail motionEnabled rangeSizePercent={100} tone="temperature" />)
      expect(animate).not.toHaveBeenCalled()
    } finally {
      if (descriptor) Object.defineProperty(HTMLElement.prototype, 'animate', descriptor)
      else Reflect.deleteProperty(HTMLElement.prototype, 'animate')
    }
  })
})
