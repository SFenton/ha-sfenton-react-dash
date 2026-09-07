import { type CSSProperties, useId } from 'react'
import { NIGHT_STARS, SNOW_CRYSTAL_PATHS, SNOW_FLAKES, SNOW_NARROW_FLAKE_COUNT, SNOW_STATIC_FLAKE_COUNT, WIND_WISPS } from './weatherAtmosphereModel'
import { weatherSceneForCondition, type WeatherScene } from './weatherPresentation'
import styles from './WeatherAtmosphere.module.css'

interface WeatherAtmosphereProps {
  condition?: string
  isNight?: boolean
  sceneOverride?: WeatherScene
}

type RainDropStyle = CSSProperties & {
  '--rain-delay': string
  '--rain-drift': string
  '--rain-duration': string
  '--rain-length': string
  '--rain-opacity': number
  '--rain-width': string
  '--rain-x': string
}

const RAIN_DROPS = Array.from({ length: 44 }, (_, index) => ({
  delay: -(((index * 29) % 240) / 100),
  drift: ((index * 17) % 9) - 4,
  duration: 0.92 + ((index * 31) % 72) / 100,
  length: 13 + ((index * 19) % 20),
  opacity: 0.26 + ((index * 23) % 48) / 100,
  width: index % 6 === 0 ? 2 : 1,
  x: (index * 37 + 11) % 101,
}))

function rainDropStyle(drop: (typeof RAIN_DROPS)[number]): RainDropStyle {
  return {
    '--rain-delay': `${drop.delay}s`,
    '--rain-drift': `${drop.drift}px`,
    '--rain-duration': `${drop.duration}s`,
    '--rain-length': `${drop.length}px`,
    '--rain-opacity': drop.opacity,
    '--rain-width': `${drop.width}px`,
    '--rain-x': `${drop.x}%`,
  }
}

function rainScene(scene: ReturnType<typeof weatherSceneForCondition>) {
  return scene === 'rain' || scene === 'storm'
}

type SnowFlakeStyle = CSSProperties & {
  '--snow-angle': string
  '--snow-delay': string
  '--snow-duration': string
  '--snow-opacity': number
  '--snow-size': string
  '--snow-static-y': string
  '--snow-x': string
} & Record<`--snow-offset-${number}` | `--snow-rotation-${number}`, string>

function snowFlakeStyle(flake: (typeof SNOW_FLAKES)[number]): SnowFlakeStyle {
  return {
    '--snow-angle': `${flake.angle}deg`,
    '--snow-delay': `${flake.delay}s`,
    '--snow-duration': `${flake.duration}s`,
    '--snow-opacity': flake.opacity,
    '--snow-size': `${flake.size}px`,
    '--snow-static-y': `${flake.staticY}%`,
    '--snow-x': `${flake.x}%`,
    ...Object.fromEntries(flake.trajectory.flatMap((point, index) => [
      [`--snow-offset-${index}`, `${point.x}px`],
      [`--snow-rotation-${index}`, `${point.angle}deg`],
    ])),
  }
}

function WindWisps() {
  const id = useId()
  return (
    <span className={styles.windField} data-weather-wind-field="true">
      {WIND_WISPS.map((wisp, index) => (
        <svg
          aria-hidden="true"
          className={styles.windWisp}
          data-weather-wind-wisp="true"
          data-wind-static={index < 2 ? 'true' : undefined}
          focusable="false"
          key={index}
          preserveAspectRatio="none"
          style={{
            '--gust-top': `${wisp.top}%`,
            '--gust-left': `${wisp.left}%`,
            '--gust-width': `${wisp.width}%`,
            '--gust-duration': `${wisp.duration}s`,
            '--gust-delay': `${wisp.delay}s`,
          } as CSSProperties}
          viewBox="0 0 600 120"
        >
          <defs>
            <linearGradient id={`${id}-${index}`}>
              <stop offset="0" stopColor="var(--rd-weather-wind-wisp)" stopOpacity="0" />
              <stop offset=".24" stopColor="var(--rd-weather-wind-wisp)" stopOpacity=".35" />
              <stop offset=".5" stopColor="var(--rd-weather-wind-wisp)" />
              <stop offset=".78" stopColor="var(--rd-weather-wind-wisp)" stopOpacity=".3" />
              <stop offset="1" stopColor="var(--rd-weather-wind-wisp)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className={styles.windWispHalo} d={wisp.path} stroke={`url(#${id}-${index})`} />
          <path className={styles.windWispCore} d={wisp.path} stroke={`url(#${id}-${index})`} />
        </svg>
      ))}
    </span>
  )
}

export function WeatherAtmosphere({ condition, isNight = false, sceneOverride }: WeatherAtmosphereProps) {
  const scene = sceneOverride ?? weatherSceneForCondition(condition, isNight)
  const rainDropCount = scene === 'storm' ? RAIN_DROPS.length : 34
  const showRain = rainScene(scene)
  const showStorm = scene === 'storm'
  const showSnow = scene === 'snow'
  const showWind = scene === 'wind'
  const showNight = scene === 'night'

  return (
    <div aria-hidden="true" className={styles.atmosphere} data-weather-scene={scene}>
      <span className={styles.light} />
      {showStorm ? <span className={styles.stormFlash} data-weather-storm-flash="true" /> : null}
      <span className={styles.motion} data-weather-atmosphere-motion="true">
        {showNight ? NIGHT_STARS.map((star, index) => (
          <i
            className={styles.nightStar}
            data-weather-night-star="true"
            key={index}
            style={{
              '--star-x': `${star.x}%`,
              '--star-y': `${star.y}%`,
              '--star-size': `${star.size}px`,
              '--star-opacity': star.opacity,
            } as CSSProperties}
          />
        )) : null}
      </span>
      {showWind ? <WindWisps /> : null}
      {showRain ? (
        <span className={styles.rainField} data-weather-rain-field="true">
          {RAIN_DROPS.slice(0, rainDropCount).map((drop, index) => <i className={styles.rainDrop} data-weather-raindrop="true" key={index} style={rainDropStyle(drop)} />)}
        </span>
      ) : null}
      {showSnow ? (
        <span className={styles.snowField} data-weather-snow-field="true">
          {SNOW_FLAKES.map((flake, index) => (
            <svg
              aria-hidden="true"
              className={styles.snowflake}
              data-snow-depth={flake.depth}
              data-snow-shape={flake.shape}
              data-snow-extra={index >= SNOW_NARROW_FLAKE_COUNT ? 'true' : undefined}
              data-snow-static={index < SNOW_STATIC_FLAKE_COUNT ? 'true' : undefined}
              data-weather-snowflake="true"
              focusable="false"
              key={index}
              style={snowFlakeStyle(flake)}
              viewBox="0 0 20 20"
            >
              <path d={SNOW_CRYSTAL_PATHS[flake.shape]} />
            </svg>
          ))}
        </span>
      ) : null}
    </div>
  )
}
