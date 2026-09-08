import { describe, expect, it } from 'vitest'
import { copy, WEATHER_COPY_NAMESPACE } from '../../i18n'
import type { WeatherForecast } from './useWeatherForecasts'
import {
  generateWeatherDayBriefing,
  renderWeatherBriefingText,
  weatherBriefingHeadline,
  type WeatherDayBriefingInput,
} from './weatherDayBriefing'

const ZONE = 'America/Los_Angeles'
const briefingCopy = ((key: string, values?: Record<string, unknown>) =>
  copy(WEATHER_COPY_NAMESPACE, key as never, values as never)) as Parameters<typeof renderWeatherBriefingText>[0]

interface HourOptions extends Partial<WeatherForecast> {
  hour: number
}

function day(dateIso: string, hours: HourOptions[]): WeatherForecast[] {
  return hours.map(({ hour, ...rest }) => ({
    datetime: `${dateIso}T${String(hour).padStart(2, '0')}:00:00-08:00`,
    ...rest,
  }))
}

function steadyDay(condition: string, overrides: Partial<WeatherForecast> = {}) {
  return day('2026-01-15', Array.from({ length: 24 }, (_, hour) => ({
    condition,
    hour,
    precipitation: 0,
    precipitation_probability: 0,
    temperature: 50,
    wind_speed: 4,
    ...overrides,
  })))
}

function generate(overrides: Partial<WeatherDayBriefingInput> = {}) {
  return generateWeatherDayBriefing({
    generatedAt: Date.parse('2026-01-15T00:01:00-08:00'),
    precipitationUnit: 'in',
    temperatureUnit: '°F',
    timeZone: ZONE,
    windSpeedUnit: 'mph',
    ...overrides,
  })
}

function text(input: Partial<WeatherDayBriefingInput>) {
  return renderWeatherBriefingText(briefingCopy, generate(input))
}

describe('weather day briefing', () => {
  it('describes a calm sunny day as a single steady arc with high, low, wind and daylight', () => {
    const briefing = generate({
      hourly: steadyDay('sunny', { temperature: 62, wind_speed: 7 }),
      sunrise: '2026-01-15T07:12:00-08:00',
      sunset: '2026-01-15T17:04:00-08:00',
    })
    const sentence = renderWeatherBriefingText(briefingCopy, briefing)

    expect(briefing.severity).toBe('calm')
    expect(briefing.hazard).toBeNull()
    expect(weatherBriefingHeadline(briefingCopy, briefing)).toBe('Sunny')
    expect(briefing.icon).toBe('mdi:weather-sunny')
    expect(sentence).toContain('Expect full sun for most of the day.')
    expect(sentence).toContain('62°')
    expect(sentence).toContain('Sunrise is at 7:12 AM and sunset at 5:04 PM')
    expect(sentence).not.toMatch(/undefined|NaN|\[missing/)
  })

  it('never repeats the old three-bullet fragment format', () => {
    expect(text({ hourly: steadyDay('cloudy') })).not.toContain(' · ')
  })

  it('narrates a changing day from morning rain to an evening clearance', () => {
    const hours = day('2026-01-15', Array.from({ length: 24 }, (_, hour) => ({
      condition: hour < 12 ? 'rainy' : hour < 17 ? 'cloudy' : 'partlycloudy',
      hour,
      precipitation: hour < 12 ? 0.08 : 0,
      precipitation_probability: hour < 12 ? 80 : 10,
      temperature: 48 + hour * 0.4,
      wind_speed: 8,
    })))
    const sentence = text({ hourly: hours })

    expect(sentence).toContain('The day opens with steady rain')
    expect(sentence).toMatch(/Look for rain (through the morning|before|between)/)
    expect(sentence).toContain('80%')
  })

  it('leads with a hazard headline, icon and advisory for thunderstorms', () => {
    const hours = day('2026-01-15', Array.from({ length: 24 }, (_, hour) => ({
      condition: hour >= 14 && hour <= 18 ? 'lightning-rainy' : 'cloudy',
      hour,
      precipitation: hour >= 14 && hour <= 18 ? 0.2 : 0,
      precipitation_probability: hour >= 14 && hour <= 18 ? 90 : 20,
      temperature: 74,
      wind_gust_speed: 38,
      wind_speed: 14,
    })))
    const briefing = generate({ hourly: hours })

    expect(briefing.hazard).toBe('severeStorms')
    expect(briefing.severity).toBe('alert')
    expect(briefing.icon).toBe('mdi:weather-lightning')
    expect(weatherBriefingHeadline(briefingCopy, briefing)).toBe('Severe Storms')
    expect(renderWeatherBriefingText(briefingCopy, briefing)).toContain('Storms could turn strong')
  })

  it('prefers the most severe hazard when several qualify', () => {
    const hours = day('2026-01-15', Array.from({ length: 24 }, (_, hour) => ({
      apparent_temperature: 14,
      condition: hour < 10 ? 'snowy' : 'cloudy',
      hour,
      precipitation: hour < 10 ? 0.12 : 0,
      precipitation_probability: hour < 10 ? 95 : 10,
      temperature: 24,
      uv_index: 9,
      wind_gust_speed: 33,
      wind_speed: 18,
    })))
    const briefing = generate({ hourly: hours })

    expect(briefing.hazard).toBe('heavySnow')
    expect(weatherBriefingHeadline(briefingCopy, briefing)).toBe('Heavy Snow')
    expect(briefing.icon).toBe('mdi:weather-snowy-heavy')
  })

  it('reports damaging wind with the gust figure in native units', () => {
    const briefing = generate({
      hourly: steadyDay('windy', { temperature: 58, wind_gust_speed: 52, wind_speed: 26 }),
    })
    const sentence = renderWeatherBriefingText(briefingCopy, briefing)

    expect(briefing.hazard).toBe('damagingWind')
    expect(sentence).toContain('52 mph')
    expect(sentence).toContain('gust to 52 mph')
  })

  it('converts metric inputs when classifying hazards', () => {
    const briefing = generate({
      hourly: steadyDay('sunny', { apparent_temperature: 41, temperature: 39, wind_speed: 6 }),
      precipitationUnit: 'mm',
      temperatureUnit: '°C',
      windSpeedUnit: 'km/h',
    })

    expect(briefing.hazard).toBe('extremeHeat')
    expect(renderWeatherBriefingText(briefingCopy, briefing)).toContain('106°')
  })

  it('says nothing is coming when the day is dry', () => {
    expect(text({ hourly: steadyDay('partlycloudy') })).toContain('No meaningful rain is expected.')
  })

  it('falls back to the daily forecast when hourly data is missing', () => {
    const briefing = generate({
      daily: [{
        condition: 'rainy',
        datetime: '2026-01-15T00:00:00-08:00',
        precipitation: 0.5,
        precipitation_probability: 70,
        temperature: 55,
        templow: 44,
        wind_speed: 9,
      }],
    })

    expect(briefing.condition).toBe('rainy')
    expect(renderWeatherBriefingText(briefingCopy, briefing)).toContain('55°')
  })

  it('reports the pending state when Home Assistant has returned nothing', () => {
    const briefing = generate({ daily: [], hourly: [] })

    expect(briefing.sentences).toHaveLength(1)
    expect(renderWeatherBriefingText(briefingCopy, briefing)).toContain('Pirate Weather')
  })

  it('keys the briefing to the local calendar day across a spring-forward transition', () => {
    const briefing = generate({
      generatedAt: Date.parse('2026-03-08T00:01:00-08:00'),
      hourly: day('2026-03-08', [
        { condition: 'sunny', hour: 1, temperature: 44 },
        { condition: 'sunny', hour: 13, temperature: 61 },
      ]),
      sunrise: '2026-03-08T07:16:00-07:00',
      sunset: '2026-03-08T19:04:00-07:00',
    })

    expect(briefing.dateKey).toBe('2026-03-08')
    expect(renderWeatherBriefingText(briefingCopy, briefing)).toContain('of daylight')
  })

  it('pulls Home Assistant next_rising from tomorrow back onto the briefing day', () => {
    const briefing = generate({
      generatedAt: Date.parse('2026-01-15T14:00:00-08:00'),
      hourly: steadyDay('sunny'),
      sunrise: '2026-01-16T07:11:00-08:00',
      sunset: '2026-01-15T17:05:00-08:00',
    })

    expect(renderWeatherBriefingText(briefingCopy, briefing)).toContain('Sunrise is at 7:11 AM')
  })

  it('is deterministic for identical inputs', () => {
    const input = { hourly: steadyDay('rainy', { precipitation: 0.05, precipitation_probability: 60 }) }
    expect(JSON.stringify(generate(input))).toBe(JSON.stringify(generate(input)))
  })
})
