import { useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties } from 'react'
import {
  WEATHER_DATA_TRANSITION_MS,
  WIND_ROTATION_EASING,
} from './weatherPresentation'
import styles from './WeatherRail.module.css'

export type WeatherRailTone = 'aqi' | 'feels' | 'precipitation' | 'temperature' | 'uv' | 'visibility'

export interface WeatherRailRange {
  markerPercent?: number
  rangeSizePercent?: number
  rangeStartPercent?: number
}

interface WeatherRailProps extends WeatherRailRange {
  motionEnabled?: boolean
  tone: WeatherRailTone
}

type WeatherRailStyle = CSSProperties & {
  '--weather-rail-marker'?: string
  '--weather-rail-size': string
  '--weather-rail-start': string
}

function percent(value: number | undefined, fallback = 0) {
  return `${numericPercent(value, fallback)}%`
}

interface WeatherRailTarget {
  marker: number | undefined
  size: number
  start: number
}

function numericPercent(value: number | undefined, fallback = 0) {
  return Math.min(100, Math.max(0, value !== undefined && Number.isFinite(value) ? value : fallback))
}

function boundedTarget({ marker, size, start }: WeatherRailTarget): WeatherRailTarget {
  const boundedStart = numericPercent(start)
  return {
    marker: marker !== undefined && Number.isFinite(marker) ? numericPercent(marker) : undefined,
    size: Number.isFinite(start) ? Math.min(numericPercent(size), 100 - boundedStart) : 0,
    start: boundedStart,
  }
}

function computedPercent(style: CSSStyleDeclaration, property: string, fallback: number) {
  const value = Number.parseFloat(style.getPropertyValue(property))
  return Number.isFinite(value) ? value : fallback
}

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function WeatherRail({
  markerPercent,
  motionEnabled = false,
  rangeSizePercent,
  rangeStartPercent,
  tone,
}: WeatherRailProps) {
  const railRef = useRef<HTMLSpanElement>(null)
  const animationRef = useRef<Animation | null>(null)
  const previousTargetRef = useRef<WeatherRailTarget | null>(null)
  const motionWasEnabledRef = useRef(false)
  const scale = tone === 'aqi' || tone === 'feels' || tone === 'uv'
  const markerVisible = markerPercent !== undefined && Number.isFinite(markerPercent)
  const target = useMemo<WeatherRailTarget>(() => boundedTarget({
    marker: markerVisible ? numericPercent(markerPercent) : undefined,
    size: scale ? 100 : rangeSizePercent ?? 0,
    start: scale ? 0 : rangeStartPercent ?? 0,
  }), [markerPercent, markerVisible, rangeSizePercent, rangeStartPercent, scale])
  const style: WeatherRailStyle = {
    '--weather-rail-marker': target.marker === undefined ? undefined : percent(target.marker),
    '--weather-rail-size': percent(target.size),
    '--weather-rail-start': percent(target.start),
  }

  useLayoutEffect(() => {
    const rail = railRef.current
    const previousTarget = previousTargetRef.current
    previousTargetRef.current = target
    const motionJustEnabled = motionEnabled && !motionWasEnabledRef.current
    motionWasEnabledRef.current = motionEnabled

    let paintedTarget = previousTarget
    if (animationRef.current && rail && previousTarget) {
      const computedStyle = getComputedStyle(rail)
      paintedTarget = boundedTarget({
        marker: previousTarget.marker === undefined
          ? undefined
          : computedPercent(computedStyle, '--weather-rail-marker', previousTarget.marker),
        size: computedPercent(computedStyle, '--weather-rail-size', previousTarget.size),
        start: computedPercent(computedStyle, '--weather-rail-start', previousTarget.start),
      })
    }
    animationRef.current?.cancel()
    animationRef.current = null

    if (
      !rail
      || !motionEnabled
      || motionJustEnabled
      || prefersReducedMotion()
      || !paintedTarget
      || typeof rail.animate !== 'function'
    ) {
      return
    }

    const markerCanAnimate = paintedTarget.marker !== undefined && target.marker !== undefined
    const startMarker = markerCanAnimate ? paintedTarget.marker ?? 0 : target.marker ?? 0
    const endMarker = target.marker ?? startMarker
    if (
      Math.abs(paintedTarget.start - target.start) < 0.01
      && Math.abs(paintedTarget.size - target.size) < 0.01
      && Math.abs(startMarker - endMarker) < 0.01
    ) {
      return
    }

    const animation = rail.animate(
      [
        {
          '--weather-rail-marker': percent(startMarker),
          '--weather-rail-size': percent(paintedTarget.size),
          '--weather-rail-start': percent(paintedTarget.start),
        },
        {
          '--weather-rail-marker': percent(endMarker),
          '--weather-rail-size': percent(target.size),
          '--weather-rail-start': percent(target.start),
        },
      ],
      {
        duration: WEATHER_DATA_TRANSITION_MS,
        easing: WIND_ROTATION_EASING,
      },
    )
    const sharedStartTime = document.timeline?.currentTime ?? null
    if (sharedStartTime !== null) animation.startTime = sharedStartTime
    animationRef.current = animation
    animation.onfinish = () => {
      if (animationRef.current !== animation) return
      animationRef.current = null
      animation.cancel()
    }
    animation.oncancel = () => {
      if (animationRef.current === animation) animationRef.current = null
    }
  }, [motionEnabled, target])

  useEffect(() => () => animationRef.current?.cancel(), [])

  return (
    <span
      aria-hidden="true"
      className={styles.rail}
      data-visibility-visual={tone === 'visibility' ? 'distance-rail' : undefined}
      data-weather-highlight-rail={tone === 'feels' || tone === 'uv' ? tone : undefined}
      data-weather-rail-motion={motionEnabled ? 'true' : undefined}
      data-weather-rail={tone}
      data-tone={tone}
      ref={railRef}
      style={style}
    >
      <span className={styles.fill} data-weather-rail-fill="true" />
      {markerVisible ? <span className={styles.marker} data-weather-rail-marker="true" /> : null}
    </span>
  )
}
