import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { formatDate, formatNumber, useCopy, WEATHER_COPY_KEYS, WEATHER_COPY_NAMESPACE } from '../../i18n'
import { MaterialIcon } from '../core/Icon'
import {
  buildPrecipitationTimeline,
  precipitationAmountAxis,
  precipitationChanceDomain,
  precipitationLabelCadence,
  precipitationLabelIndices,
  precipitationPeakChance,
  precipitationScaledPercent,
  precipitationTotal,
  type PrecipitationForecastInput,
  type PrecipitationTimelinePoint,
} from './precipitationTimeline'
import summaryStyles from './WeatherSummary.module.css'
import styles from './WeatherPrecipitationTile.module.css'

interface WeatherPrecipitationTileProps {
  forecasts: readonly PrecipitationForecastInput[]
  precipitationUnit: string
}

const PRECIPITATION_TILE_HOURS = 6

type TileStyle = CSSProperties & {
  '--precipitation-columns': string
}

type BarStyle = CSSProperties & {
  '--precipitation-probability': string
}

type CumulativeBarStyle = CSSProperties & {
  '--cumulative-amount': string
}

function sameNumbers(left: readonly number[], right: readonly number[]) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function measuredWidth(element: HTMLElement) {
  return element.getBoundingClientRect().width || element.scrollWidth
}

function useResponsivePrecipitationLabels({
  measurementKey,
  pointCount,
}: {
  measurementKey: string
  pointCount: number
}) {
  const hourlyPlotRef = useRef<HTMLSpanElement>(null)
  const measurementRef = useRef<HTMLSpanElement>(null)
  const [hourLabelIndices, setHourLabelIndices] = useState<number[]>(() => precipitationLabelIndices(pointCount, Math.max(1, Math.ceil(pointCount / 4))))

  useEffect(() => {
    let frame = 0
    let active = true

    const measure = () => {
      frame = 0
      const measurementRoot = measurementRef.current
      if (!measurementRoot) return

      const hourlyPlot = hourlyPlotRef.current
      if (hourlyPlot) {
        const hourMeasurementWidths = Array.from(measurementRoot.querySelectorAll<HTMLElement>('[data-precipitation-hour-measure]')).map(measuredWidth)
        const widestHourLabel = Math.max(0, ...hourMeasurementWidths)
        const cadence = precipitationLabelCadence(pointCount, measuredWidth(hourlyPlot), widestHourLabel)
        const nextHourLabelIndices = precipitationLabelIndices(pointCount, cadence)
        setHourLabelIndices((current) => sameNumbers(current, nextHourLabelIndices) ? current : nextHourLabelIndices)
      } else {
        setHourLabelIndices([])
      }
    }

    const scheduleMeasure = () => {
      if (!active) return
      if (frame) window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(measure)
    }

    scheduleMeasure()
    const ResizeObserverConstructor = window.ResizeObserver
    const observer = typeof ResizeObserverConstructor === 'undefined' ? null : new ResizeObserverConstructor(scheduleMeasure)
    if (observer) {
      if (hourlyPlotRef.current) observer.observe(hourlyPlotRef.current)
    } else {
      window.addEventListener('resize', scheduleMeasure)
    }
    void document.fonts?.ready.then(scheduleMeasure)

    return () => {
      active = false
      if (frame) window.cancelAnimationFrame(frame)
      observer?.disconnect()
      if (!observer) window.removeEventListener('resize', scheduleMeasure)
    }
  }, [measurementKey, pointCount])

  return {
    hourLabelIndices,
    hourlyPlotRef,
    measurementRef,
  }
}

function displayHour(date: Date | null) {
  return date ? formatDate(date, { hour: 'numeric' }).replace(/\s+/g, ' ') : '--'
}

function displayChance(value: number | null, unavailable: string) {
  return value === null ? unavailable : `${Math.round(value)}%`
}

function displayAmount(value: number | null, unit: string, unavailable: string) {
  if (value === null) return unavailable
  const normalizedUnit = unit.trim() || 'in'
  const digits = normalizedUnit.toLowerCase().includes('mm') ? 1 : 2
  return `${formatNumber(value, { maximumFractionDigits: digits, minimumFractionDigits: digits })} ${normalizedUnit}`
}

function precipitationBarStyle(probability: number | null, domain: number): BarStyle {
  return { '--precipitation-probability': `${precipitationScaledPercent(probability, domain)}%` }
}

function cumulativeBarStyle(cumulative: number, domain: number): CumulativeBarStyle {
  return { '--cumulative-amount': `${precipitationScaledPercent(cumulative, domain)}%` }
}

function displayAxisAmount(value: number, unit: string, maximumFractionDigits: number) {
  const normalizedUnit = unit.trim() || 'in'
  return `${formatNumber(value, { maximumFractionDigits })} ${normalizedUnit}`
}

function ChancePlot({
  axisTimeLabels,
  chanceDomain,
  hourLabelIndices,
  plotRef,
  points,
}: {
  axisTimeLabels: readonly string[]
  chanceDomain: number
  hourLabelIndices: readonly number[]
  plotRef?: RefObject<HTMLSpanElement | null>
  points: readonly PrecipitationTimelinePoint[]
}) {
  return (
    <span className={styles.hourlyVisual}>
      <span aria-hidden="true" className={styles.bars} data-precipitation-hourly-plot="true" ref={plotRef}>
        <span className={styles.gridLines} data-precipitation-grid-lines="chance">
          <i />
          <i />
          <i />
        </span>
        {points.map((point) => (
          <span className={styles.barSlot} data-precipitation-bar-slot="true" key={point.index}>
            <span
              className={styles.hourlyBar}
              data-amount={point.amount ?? 'unavailable'}
              data-measurable={point.amount !== null && point.amount > 0 ? 'true' : 'false'}
              data-precipitation-bar="true"
              data-probability={point.probability ?? 'unavailable'}
              data-unavailable={point.probability === null ? 'true' : undefined}
              style={precipitationBarStyle(point.probability, chanceDomain)}
            />
          </span>
        ))}
      </span>
      <span aria-hidden="true" className={styles.yAxis} data-precipitation-y-axis="chance">
        <span data-axis-level="high">{displayChance(chanceDomain, '')}</span>
        <span data-axis-level="middle">{displayChance(chanceDomain / 2, '')}</span>
        <span data-axis-level="low">{displayChance(0, '')}</span>
      </span>
      <span aria-hidden="true" className={styles.axisRow} data-precipitation-axis="time">
        {hourLabelIndices.map((index) => (
          <span className={styles.axisLabel} data-index={index} data-precipitation-hour-label="time" key={index} style={{ gridColumn: index + 1 }}>
            {axisTimeLabels[index]}
          </span>
        ))}
      </span>
    </span>
  )
}

function AccumulationPlot({
  amountAxis,
  axisTimeLabels,
  hourLabelIndices,
  points,
  precipitationUnit,
}: {
  amountAxis: ReturnType<typeof precipitationAmountAxis>
  axisTimeLabels: readonly string[]
  hourLabelIndices: readonly number[]
  points: readonly PrecipitationTimelinePoint[]
  precipitationUnit: string
}) {
  return (
    <span className={styles.cumulativeVisual}>
      <span aria-hidden="true" className={styles.cumulativeBars} data-precipitation-cumulative-plot="true">
        <span className={styles.gridLines} data-precipitation-grid-lines="cumulative">
          <i />
          <i />
          <i />
        </span>
        {points.map((point) => (
          <span className={styles.cumulativeBarSlot} data-cumulative-bar-slot="true" key={point.index}>
            <span
              className={styles.cumulativeBar}
              data-cumulative-bar="true"
              data-index={point.index}
              style={cumulativeBarStyle(point.cumulative, amountAxis.domain)}
            />
          </span>
        ))}
      </span>
      <span aria-hidden="true" className={styles.yAxis} data-precipitation-y-axis="cumulative">
        <span data-axis-level="high">{displayAxisAmount(amountAxis.domain, precipitationUnit, amountAxis.maximumFractionDigits)}</span>
        <span data-axis-level="middle">{displayAxisAmount(amountAxis.step, precipitationUnit, amountAxis.maximumFractionDigits)}</span>
        <span data-axis-level="low">{displayAxisAmount(0, precipitationUnit, amountAxis.maximumFractionDigits)}</span>
      </span>
      <span aria-hidden="true" className={styles.axisRow} data-precipitation-axis="cumulative-time">
        {hourLabelIndices.map((index) => (
          <span className={styles.axisLabel} data-index={index} data-precipitation-hour-label="cumulative-time" key={index} style={{ gridColumn: index + 1 }}>
            {axisTimeLabels[index]}
          </span>
        ))}
      </span>
    </span>
  )
}

export function WeatherPrecipitationTile({ forecasts, precipitationUnit }: WeatherPrecipitationTileProps) {
  const copy = useCopy(WEATHER_COPY_NAMESPACE)
  const unavailable = copy(WEATHER_COPY_KEYS.unavailable)
  const points = useMemo(() => buildPrecipitationTimeline(forecasts, PRECIPITATION_TILE_HOURS), [forecasts])
  const pointCount = points.length
  const hasMeasuredAmount = points.some((point) => point.amount !== null)
  const peakChance = precipitationPeakChance(points)
  const total = precipitationTotal(points)
  const chanceDomain = precipitationChanceDomain(peakChance)
  const amountAxis = precipitationAmountAxis(total, precipitationUnit)
  const peakChanceText = displayChance(peakChance, unavailable)
  const totalText = hasMeasuredAmount ? displayAmount(total, precipitationUnit, unavailable) : unavailable
  const startLabels = points.map((point) => displayHour(point.startTime))
  const axisTimeLabels = startLabels.map((label, index) => index === 0 ? copy(WEATHER_COPY_KEYS.precipitation.now) : label)
  const chanceLabels = points.map((point) => displayChance(point.probability, unavailable))
  const amountLabels = points.map((point) => displayAmount(point.amount, precipitationUnit, unavailable))
  const cumulativeLabels = points.map((point) => displayAmount(point.cumulative, precipitationUnit, unavailable))
  const measurementKey = axisTimeLabels.join('\0')
  const {
    hourLabelIndices,
    hourlyPlotRef,
    measurementRef,
  } = useResponsivePrecipitationLabels({
    measurementKey,
    pointCount,
  })
  const tileStyle: TileStyle = { '--precipitation-columns': String(Math.max(1, pointCount)) }
  const chanceAriaLabel = copy(WEATHER_COPY_KEYS.precipitation.chanceChartAriaLabel, { chance: peakChanceText, hours: pointCount })
  const cumulativeAriaLabel = copy(WEATHER_COPY_KEYS.precipitation.cumulativeChartAriaLabel, { hours: pointCount, total: totalText })

  return (
    <div
      className={styles.sampleGrid}
      data-precipitation-amount-domain={amountAxis.domain}
      data-precipitation-chance-domain={chanceDomain}
      data-precipitation-samples="true"
      data-weather-precipitation-tile="true"
      style={tileStyle}
    >
      <article
        aria-label={chanceAriaLabel}
        className={`${summaryStyles.highlightTile} ${styles.sampleTile}`}
        data-precipitation-sample="chance"
        data-unavailable={peakChance === null ? 'true' : undefined}
      >
        <span className={summaryStyles.highlightTitle}>
          <span className={summaryStyles.highlightIcon}>
            <MaterialIcon name="mdi:weather-rainy" size={16} />
          </span>
          {copy(WEATHER_COPY_KEYS.precipitation.title)}
        </span>
        {peakChance !== null
          ? <ChancePlot axisTimeLabels={axisTimeLabels} chanceDomain={chanceDomain} hourLabelIndices={hourLabelIndices} plotRef={hourlyPlotRef} points={points} />
          : <span className={styles.unavailable}>{unavailable}</span>}
      </article>

      <article
        aria-label={cumulativeAriaLabel}
        className={`${summaryStyles.highlightTile} ${styles.sampleTile}`}
        data-precipitation-sample="cumulative"
        data-unavailable={pointCount && hasMeasuredAmount ? undefined : 'true'}
      >
        <span className={summaryStyles.highlightTitle}>
          <span className={summaryStyles.highlightIcon}>
            <MaterialIcon name="mdi:weather-rainy" size={16} />
          </span>
          {copy(WEATHER_COPY_KEYS.precipitation.cumulativeHeading)}
        </span>
        {pointCount && hasMeasuredAmount
          ? <AccumulationPlot amountAxis={amountAxis} axisTimeLabels={axisTimeLabels} hourLabelIndices={hourLabelIndices} points={points} precipitationUnit={precipitationUnit} />
          : <span className={styles.unavailable}>{unavailable}</span>}
      </article>

      <span aria-hidden="true" className={styles.measurementBank} ref={measurementRef}>
        {axisTimeLabels.map((label, index) => <span data-precipitation-hour-measure="true" key={`${label}-${index}`}>{label}</span>)}
      </span>

      {pointCount ? (
        <table className={styles.visuallyHidden}>
          <caption>{copy(WEATHER_COPY_KEYS.precipitation.tableCaption, { hours: pointCount })}</caption>
          <thead>
            <tr>
              <th>{copy(WEATHER_COPY_KEYS.precipitation.table.time)}</th>
              <th>{copy(WEATHER_COPY_KEYS.precipitation.table.chance)}</th>
              <th>{copy(WEATHER_COPY_KEYS.precipitation.table.amount)}</th>
              <th>{copy(WEATHER_COPY_KEYS.precipitation.table.cumulative)}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point, index) => (
              <tr key={point.index}>
                <td>{startLabels[index]}</td>
                <td>{chanceLabels[index]}</td>
                <td>{amountLabels[index]}</td>
                <td>{hasMeasuredAmount ? cumulativeLabels[index] : unavailable}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  )
}
