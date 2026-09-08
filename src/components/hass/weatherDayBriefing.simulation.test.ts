import { describe, expect, it } from 'vitest'
import { copy, WEATHER_COPY_NAMESPACE } from '../../i18n'
import type { WeatherForecast } from './useWeatherForecasts'
import {
  generateWeatherDayBriefing,
  localDateKey,
  renderWeatherBriefingText,
  weatherBriefingHeadline,
  type WeatherDayBriefing,
} from './weatherDayBriefing'

const SCENARIO_COUNT = 5_000
const CONDITIONS = [
  'clear-night',
  'cloudy',
  'exceptional',
  'fog',
  'hail',
  'lightning',
  'lightning-rainy',
  'partlycloudy',
  'pouring',
  'rainy',
  'snowy',
  'snowy-rainy',
  'sunny',
  'windy',
  'windy-variant',
] as const
const ZONES = ['America/Los_Angeles', 'America/New_York', 'UTC', 'Europe/Berlin', 'Australia/Sydney', 'Asia/Kolkata']
// Spring-forward, fall-back, leap day and ordinary days.
const DATES = ['2026-03-08', '2026-11-01', '2028-02-29', '2026-01-15', '2026-07-04', '2026-09-23']
const UNITS = [
  { precipitation: 'in', temperature: '°F', wind: 'mph' },
  { precipitation: 'mm', temperature: '°C', wind: 'km/h' },
  { precipitation: 'mm', temperature: '°C', wind: 'm/s' },
  { precipitation: undefined, temperature: undefined, wind: undefined },
]

const briefingCopy = ((key: string, values?: Record<string, unknown>) =>
  copy(WEATHER_COPY_NAMESPACE, key as never, values as never)) as Parameters<typeof renderWeatherBriefingText>[0]

function mulberry32(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

interface ScenarioSummary {
  hazard: string
  kind: string
  severity: string
}

type Random = () => number

function pick<T>(random: Random, values: readonly T[]) {
  return values[Math.floor(random() * values.length) % values.length]
}

function range(random: Random, min: number, max: number) {
  return min + random() * (max - min)
}

function scenarioKind(random: Random) {
  const roll = random()
  if (roll < 0.1) return 'benign'
  if (roll < 0.24) return 'consistent'
  if (roll < 0.38) return 'frontal'
  if (roll < 0.52) return 'storms'
  if (roll < 0.62) return 'winter'
  if (roll < 0.7) return 'heat'
  if (roll < 0.76) return 'cold'
  if (roll < 0.82) return 'fog'
  if (roll < 0.88) return 'chaotic'
  if (roll < 0.93) return 'sparse'
  if (roll < 0.97) return 'degraded'
  return 'absurd'
}

function buildScenario(random: Random) {
  const kind = scenarioKind(random)
  const date = pick(random, DATES)
  const timeZone = pick(random, ZONES)
  const units = pick(random, UNITS)
  const metricTemperature = units.temperature === '°C'
  const mild = kind === 'benign' || kind === 'consistent' || kind === 'frontal' || kind === 'fog'
  const baseTemperature = kind === 'benign'
    ? metricTemperature ? range(random, 7, 18) : range(random, 45, 65)
    : mild
    ? metricTemperature ? range(random, 2, 24) : range(random, 36, 76)
    : kind === 'heat'
      ? metricTemperature ? range(random, 22, 34) : range(random, 72, 94)
      : kind === 'cold' || kind === 'winter'
        ? metricTemperature ? range(random, -22, 2) : range(random, -8, 35)
        : metricTemperature ? range(random, -25, 40) : range(random, -10, 105)
  const swing = kind === 'benign'
    ? metricTemperature ? range(random, 2, 6) : range(random, 4, 12)
    : metricTemperature ? range(random, 0, 12) : range(random, 0, 25)
  const steadyCondition = kind === 'benign' || (kind === 'consistent' && random() < 0.75)
    ? pick(random, kind === 'benign' ? (['sunny', 'partlycloudy', 'cloudy'] as const) : (['sunny', 'partlycloudy', 'cloudy', 'clear-night', 'rainy'] as const))
    : pick(random, CONDITIONS)
  // Wind draws are expressed in mph and converted so unit choice does not change the weather.
  const windScale = units.wind === 'km/h' ? 1.609 : units.wind === 'm/s' ? 0.447 : 1
  const hourCount = kind === 'sparse' ? Math.floor(range(random, 1, 5)) : 24

  const hourly: WeatherForecast[] = []
  for (let index = 0; index < hourCount; index += 1) {
    const hour = kind === 'sparse' ? Math.floor(range(random, 0, 24)) : index
    const daylight = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI))
    let condition = steadyCondition
    let probability = range(random, 0, 20)
    let precipitation = 0
    let gust = range(random, 0, 18)
    let wind = gust * 0.5

    if (kind === 'frontal') {
      condition = hour < 11 ? 'rainy' : hour < 16 ? 'cloudy' : 'partlycloudy'
      probability = hour < 11 ? range(random, 55, 100) : range(random, 0, 30)
      precipitation = hour < 11 ? range(random, 0.01, 0.2) : 0
    } else if (kind === 'storms') {
      const active = hour >= 13 && hour <= 20
      condition = active ? pick(random, ['lightning-rainy', 'pouring', 'hail', 'lightning']) : 'cloudy'
      probability = active ? range(random, 60, 100) : range(random, 5, 35)
      precipitation = active ? range(random, 0.05, 0.6) : 0
      gust = active ? range(random, 25, 70) : range(random, 5, 20)
      wind = gust * 0.55
    } else if (kind === 'winter') {
      condition = pick(random, ['snowy', 'snowy-rainy', 'cloudy'])
      probability = range(random, 40, 100)
      precipitation = range(random, 0.01, 0.5)
    } else if (kind === 'fog') {
      condition = hour < 10 ? 'fog' : 'partlycloudy'
    } else if (kind === 'chaotic') {
      condition = pick(random, CONDITIONS)
      probability = range(random, 0, 100)
      precipitation = random() < 0.5 ? range(random, 0, 0.4) : 0
      gust = range(random, 0, 90)
      wind = range(random, 0, 60)
    } else if (kind === 'absurd') {
      condition = random() < 0.2 ? 'meteor-shower' : pick(random, CONDITIONS)
      probability = range(random, -50, 250)
      precipitation = range(random, -2, 40)
      gust = range(random, -20, 400)
      wind = range(random, -20, 400)
    }

    const temperature = kind === 'heat'
      ? baseTemperature + (metricTemperature ? 6 : 12) * daylight
      : baseTemperature + swing * daylight

    const forecast: WeatherForecast = {
      condition,
      datetime: `${date}T${String(hour).padStart(2, '0')}:00:00Z`,
      precipitation,
      precipitation_probability: probability,
      temperature,
      uv_index: Math.round(daylight * range(random, 0, kind === 'benign' ? 5 : 12)),
      wind_bearing: random() < 0.1 ? pick(random, ['N', 'SW', 'E']) : range(random, 0, 360),
      wind_gust_speed: gust * windScale,
      wind_speed: wind * windScale,
    }
    if (random() < 0.7) forecast.apparent_temperature = temperature + range(random, kind === 'benign' ? -3 : -14, kind === 'benign' ? 3 : 14)
    if (random() < 0.5) forecast.humidity = range(random, 5, 100)
    if (random() < 0.5) forecast.cloud_coverage = range(random, 0, 100)
    if (kind === 'degraded') {
      if (random() < 0.5) delete forecast.temperature
      if (random() < 0.5) delete forecast.precipitation_probability
      if (random() < 0.4) delete forecast.condition
      if (random() < 0.3) delete forecast.wind_speed
      if (random() < 0.3) forecast.datetime = random() < 0.5 ? 'not-a-date' : undefined
    }
    hourly.push(forecast)
  }

  // Outside the deliberately inconsistent scenarios the daily roll-up agrees with the hours,
  // exactly as Home Assistant reports it.
  const inconsistentDaily = kind === 'degraded' || kind === 'absurd'
  const temperatures = hourly.map((forecast) => forecast.temperature).filter((value) => value !== undefined)
  const daily: WeatherForecast[] = kind === 'degraded' && random() < 0.3 ? [] : [{
    condition: steadyCondition,
    datetime: `${date}T00:00:00Z`,
    precipitation: inconsistentDaily
      ? range(random, 0, 1.5)
      : hourly.reduce((total, forecast) => total + (forecast.precipitation ?? 0), 0),
    precipitation_probability: inconsistentDaily
      ? range(random, 0, 100)
      : Math.max(0, ...hourly.map((forecast) => forecast.precipitation_probability ?? 0)),
    temperature: temperatures.length && !inconsistentDaily ? Math.max(...temperatures) : baseTemperature + swing,
    templow: temperatures.length && !inconsistentDaily ? Math.min(...temperatures) : baseTemperature - swing,
    uv_index: inconsistentDaily
      ? range(random, 0, 12)
      : Math.max(0, ...hourly.map((forecast) => forecast.uv_index ?? 0)),
    wind_bearing: range(random, 0, 360),
    wind_gust_speed: inconsistentDaily
      ? range(random, 0, 60) * windScale
      : Math.max(0, ...hourly.map((forecast) => forecast.wind_gust_speed ?? 0)),
    wind_speed: inconsistentDaily
      ? range(random, 0, 35) * windScale
      : Math.max(0, ...hourly.map((forecast) => forecast.wind_speed ?? 0)),
  }]

  const generatedAt = Date.parse(`${date}T00:01:00Z`) + Math.floor(range(random, 0, 3) * 3_600_000)
  const sunOffset = random() < 0.15 ? 86_400_000 : 0
  return {
    input: {
      // Air quality is usually good, so bias the draw low with an occasional wildfire day.
      aqi: kind === 'benign' ? range(random, 5, 45) : random() < 0.35 ? Math.round(range(random, 0, 1) ** 3 * 500) : undefined,
      daily,
      generatedAt,
      hourly,
      precipitationUnit: units.precipitation,
      sunrise: random() < 0.9 ? new Date(Date.parse(`${date}T14:12:00Z`) + sunOffset).toISOString() : undefined,
      sunset: random() < 0.9 ? new Date(Date.parse(`${date}T01:58:00Z`) + 86_400_000).toISOString() : undefined,
      temperatureUnit: units.temperature,
      timeZone: 'UTC',
      windSpeedUnit: units.wind,
    },
    kind,
    timeZone,
  }
}

function assertBriefing(briefing: WeatherDayBriefing, seed: number) {
  const headline = weatherBriefingHeadline(briefingCopy, briefing)
  const narrative = renderWeatherBriefingText(briefingCopy, briefing)
  const context = `seed ${seed}: ${headline} — ${narrative}`

  expect(narrative, context).not.toMatch(/\[missing|undefined|NaN|\{\{|Infinity/)
  expect(headline, context).not.toMatch(/\[missing|undefined|NaN|\{\{/)
  expect(headline.length, context).toBeGreaterThan(0)
  expect(narrative, context).toMatch(/^[A-Z]/)
  expect(narrative.trim(), context).toMatch(/\.$/)
  expect(narrative, context).not.toMatch(/ {2}| \.|,\.|\.\./)
  expect(narrative.length, context).toBeLessThan(700)
  expect(briefing.icon, context).toMatch(/^mdi:/)
  expect(briefing.sentences.length, context).toBeGreaterThan(0)
  expect(briefing.sentences.length, context).toBeLessThanOrEqual(6)
  expect(new Set(briefing.sentences.map((sentence) => sentence.key)).size, context).toBe(briefing.sentences.length)
  expect(briefing.dateKey, context).toBe(localDateKey(briefing.generatedAt, 'UTC'))
  if (briefing.severity === 'alert' || briefing.severity === 'caution') {
    expect(briefing.hazard, context).not.toBeNull()
    expect(narrative.split('. ').length, context).toBeGreaterThan(1)
  }
  if (briefing.hazard === null) expect(briefing.severity, context).toBe('calm')
  return narrative
}

describe('weather day briefing simulation', () => {
  it(`stays well-formed across ${SCENARIO_COUNT} simulated days`, () => {
    const summaries: ScenarioSummary[] = []
    const distinctNarratives = new Set<string>()

    for (let seed = 1; seed <= SCENARIO_COUNT; seed += 1) {
      const random = mulberry32(seed * 2_654_435_761)
      const { input, kind } = buildScenario(random)
      const briefing = generateWeatherDayBriefing(input)
      const narrative = assertBriefing(briefing, seed)
      distinctNarratives.add(narrative)
      summaries.push({ hazard: briefing.hazard ?? 'none', kind, severity: briefing.severity })

      if (seed % 250 === 0) {
        expect(JSON.stringify(generateWeatherDayBriefing(input))).toBe(JSON.stringify(briefing))
      }
    }

    const severities = new Set(summaries.map((summary) => summary.severity))
    const hazards = new Set(summaries.map((summary) => summary.hazard))
    // A realistic gamut must exercise calm days, advisories and true alerts alike.
    expect(severities.size).toBeGreaterThanOrEqual(3)
    expect(hazards.size).toBeGreaterThanOrEqual(8)
    expect(summaries.filter((summary) => summary.severity === 'calm' || summary.severity === 'notable').length)
      .toBeGreaterThan(500)
    expect(summaries.filter((summary) => summary.severity === 'alert').length).toBeGreaterThan(200)
    const benign = summaries.filter((summary) => summary.kind === 'benign')
    expect(benign.length).toBeGreaterThan(300)
    // An ordinary, uneventful day must never be dressed up as a hazard.
    expect(benign.every((summary) => summary.hazard === 'none' && summary.severity === 'calm')).toBe(true)
    // The narrative must respond to the data rather than collapsing into a few templates.
    expect(distinctNarratives.size).toBeGreaterThan(SCENARIO_COUNT / 2)
  }, 60_000)

  it('flags storm, snow and heat scenarios rather than reporting them as calm', () => {
    const flagged = { heat: 0, storms: 0, winter: 0 }
    const seen = { heat: 0, storms: 0, winter: 0 }

    for (let seed = 1; seed <= SCENARIO_COUNT; seed += 1) {
      const random = mulberry32(seed * 40_503)
      const { input, kind } = buildScenario(random)
      if (kind !== 'storms' && kind !== 'winter' && kind !== 'heat') continue
      const briefing = generateWeatherDayBriefing(input)
      seen[kind] += 1
      if (briefing.hazard !== null) flagged[kind] += 1
    }

    for (const kind of ['heat', 'storms', 'winter'] as const) {
      expect(seen[kind]).toBeGreaterThan(50)
      expect(flagged[kind] / seen[kind]).toBeGreaterThan(0.9)
    }
  }, 60_000)
})
