import { useMemo, type CSSProperties, type RefObject } from 'react'
import { formatDate, useCopy, WEATHER_COPY_KEYS, WEATHER_COPY_NAMESPACE } from '../../i18n'
import { MaterialIcon } from '../core/Icon'
import { precipitationChanceDomain, precipitationScaledPercent } from './precipitationTimeline'
import chartStyles from './WeatherPrecipitationTile.module.css'
import summaryStyles from './WeatherSummary.module.css'
import { useResponsiveWeatherChartLabels } from './useResponsiveWeatherChartLabels'

interface HourlyWeatherMetricForecast {
  cloud_coverage?: unknown
  datetime?: string
  humidity?: unknown
}

interface WeatherHourlyMetricTilesProps {
  forecasts: readonly HourlyWeatherMetricForecast[]
}

interface HourlyMetricPoint {
  cloudCover: number | null
  humidity: number | null
  index: number
  time: Date | null
}

type MetricTone = 'cloud' | 'humidity'

type TileStyle = CSSProperties & {
  '--precipitation-columns': string
}

type MetricBarStyle = CSSProperties & {
  '--weather-metric-percent': string
}

const HOURLY_METRIC_HOURS = 6

function percentValue(value: unknown) {
  const numeric = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim()
      ? Number(value)
      : Number.NaN
  return Number.isFinite(numeric) ? Math.min(100, Math.max(0, numeric)) : null
}

function dateValue(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function displayHour(date: Date | null) {
  return date ? formatDate(date, { hour: 'numeric' }).replace(/\s+/g, ' ') : '--'
}

function displayPercent(value: number | null, unavailable: string) {
  return value === null ? unavailable : `${Math.round(value)}%`
}

function metricBarStyle(value: number | null, domain: number): MetricBarStyle {
  return { '--weather-metric-percent': `${precipitationScaledPercent(value, domain)}%` }
}

function metricValues(points: readonly HourlyMetricPoint[], tone: MetricTone) {
  return points.map((point) => tone === 'humidity' ? point.humidity : point.cloudCover)
}

function metricPlot({
  axisTimeLabels,
  labelIndices,
  plotRef,
  points,
  tone,
  unavailable,
  domain,
}: {
  axisTimeLabels: readonly string[]
  domain: number
  labelIndices: readonly number[]
  plotRef?: RefObject<HTMLSpanElement | null>
  points: readonly HourlyMetricPoint[]
  tone: MetricTone
  unavailable: string
}) {
  const values = metricValues(points, tone)
  return (
    <span className={chartStyles.hourlyVisual}>
      <span aria-hidden="true" className={chartStyles.bars} data-hourly-metric-plot={tone} ref={plotRef}>
        <span className={chartStyles.gridLines} data-hourly-metric-grid-lines={tone}>
          <i />
          <i />
          <i />
        </span>
        {values.map((value, index) => (
          <span className={chartStyles.barSlot} data-hourly-metric-bar-slot="true" key={index}>
            <span
              className={`${chartStyles.metricBar} ${tone === 'humidity' ? chartStyles.humidityBar : chartStyles.cloudBar}`}
              data-hourly-metric-bar="true"
              data-metric={tone}
              data-unavailable={value === null ? 'true' : undefined}
              data-value={value ?? 'unavailable'}
              style={metricBarStyle(value, domain)}
            />
          </span>
        ))}
      </span>
      <span aria-hidden="true" className={chartStyles.yAxis} data-precipitation-y-axis={tone}>
        <span data-axis-level="high">{displayPercent(domain, unavailable)}</span>
        <span data-axis-level="middle">{displayPercent(domain / 2, unavailable)}</span>
        <span data-axis-level="low">{displayPercent(0, unavailable)}</span>
      </span>
      <span aria-hidden="true" className={chartStyles.axisRow} data-hourly-metric-axis={tone}>
        {labelIndices.map((index) => (
          <span className={chartStyles.axisLabel} data-hourly-metric-label={tone} data-index={index} key={index} style={{ gridColumn: index + 1 }}>
            {axisTimeLabels[index]}
          </span>
        ))}
      </span>
    </span>
  )
}

export function WeatherHourlyMetricTiles({ forecasts }: WeatherHourlyMetricTilesProps) {
  const copy = useCopy(WEATHER_COPY_NAMESPACE)
  const unavailable = copy(WEATHER_COPY_KEYS.unavailable)
  const points = useMemo(() => forecasts.slice(0, HOURLY_METRIC_HOURS).map((forecast, index): HourlyMetricPoint => ({
    cloudCover: percentValue(forecast.cloud_coverage),
    humidity: percentValue(forecast.humidity),
    index,
    time: dateValue(forecast.datetime),
  })), [forecasts])
  const pointCount = points.length
  const humidityValues = metricValues(points, 'humidity').filter((value): value is number => value !== null)
  const cloudValues = metricValues(points, 'cloud').filter((value): value is number => value !== null)
  const humidityDomain = precipitationChanceDomain(humidityValues.length ? Math.max(...humidityValues) : null)
  const cloudDomain = precipitationChanceDomain(cloudValues.length ? Math.max(...cloudValues) : null)
  const rawTimeLabels = points.map((point) => displayHour(point.time))
  const axisTimeLabels = rawTimeLabels.map((label, index) => index === 0 ? copy(WEATHER_COPY_KEYS.precipitation.now) : label)
  const measurementKey = axisTimeLabels.join('\0')
  const {
    labelIndices,
    measurementRef,
    plotRef,
  } = useResponsiveWeatherChartLabels({
    measurementKey,
    pointCount,
  })
  const tileStyle: TileStyle = { '--precipitation-columns': String(Math.max(1, pointCount)) }
  const humidityTitle = copy(WEATHER_COPY_KEYS.hourlyMetrics.humidity)
  const cloudTitle = copy(WEATHER_COPY_KEYS.hourlyMetrics.cloudCover)
  const humidityMinimum = humidityValues.length ? Math.min(...humidityValues) : null
  const humidityMaximum = humidityValues.length ? Math.max(...humidityValues) : null
  const cloudMinimum = cloudValues.length ? Math.min(...cloudValues) : null
  const cloudMaximum = cloudValues.length ? Math.max(...cloudValues) : null

  return (
    <div className={chartStyles.sampleGrid} data-weather-hourly-metric-tiles="true" style={tileStyle}>
      <article
        aria-label={copy(WEATHER_COPY_KEYS.hourlyMetrics.ariaLabel, {
          hours: pointCount,
          maximum: displayPercent(humidityMaximum, unavailable),
          minimum: displayPercent(humidityMinimum, unavailable),
          title: humidityTitle,
        })}
        className={`${summaryStyles.highlightTile} ${chartStyles.sampleTile}`}
        data-axis-lower="0"
        data-axis-upper={humidityDomain}
        data-hourly-metric-tile="humidity"
        data-unavailable={humidityValues.length ? undefined : 'true'}
      >
        <span className={summaryStyles.highlightTitle}>
          <span className={summaryStyles.highlightIcon}>
            <MaterialIcon name="mdi:water-percent" size={16} />
          </span>
          {humidityTitle}
        </span>
        {humidityValues.length
          ? metricPlot({
              axisTimeLabels,
              domain: humidityDomain,
              labelIndices,
              plotRef,
              points,
              tone: 'humidity',
              unavailable,
            })
          : <span className={chartStyles.unavailable}>{unavailable}</span>}
      </article>

      <article
        aria-label={copy(WEATHER_COPY_KEYS.hourlyMetrics.ariaLabel, {
          hours: pointCount,
          maximum: displayPercent(cloudMaximum, unavailable),
          minimum: displayPercent(cloudMinimum, unavailable),
          title: cloudTitle,
        })}
        className={`${summaryStyles.highlightTile} ${chartStyles.sampleTile}`}
        data-axis-lower="0"
        data-axis-upper={cloudDomain}
        data-hourly-metric-tile="cloud"
        data-unavailable={cloudValues.length ? undefined : 'true'}
      >
        <span className={summaryStyles.highlightTitle}>
          <span className={summaryStyles.highlightIcon}>
            <MaterialIcon name="mdi:cloud" size={16} />
          </span>
          {cloudTitle}
        </span>
        {cloudValues.length
          ? metricPlot({
              axisTimeLabels,
              domain: cloudDomain,
              labelIndices,
              plotRef: humidityValues.length ? undefined : plotRef,
              points,
              tone: 'cloud',
              unavailable,
            })
          : <span className={chartStyles.unavailable}>{unavailable}</span>}
      </article>

      <span aria-hidden="true" className={chartStyles.measurementBank} ref={measurementRef}>
        {axisTimeLabels.map((label, index) => <span data-weather-chart-label-measure="true" key={`${label}-${index}`}>{label}</span>)}
      </span>

      {pointCount ? (
        <table className={chartStyles.visuallyHidden}>
          <caption>{copy(WEATHER_COPY_KEYS.hourlyMetrics.tableCaption, { hours: pointCount })}</caption>
          <thead>
            <tr>
              <th>{copy(WEATHER_COPY_KEYS.hourlyMetrics.table.time)}</th>
              <th>{humidityTitle}</th>
              <th>{cloudTitle}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point, index) => (
              <tr key={point.index}>
                <td>{rawTimeLabels[index]}</td>
                <td>{displayPercent(point.humidity, unavailable)}</td>
                <td>{displayPercent(point.cloudCover, unavailable)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  )
}
