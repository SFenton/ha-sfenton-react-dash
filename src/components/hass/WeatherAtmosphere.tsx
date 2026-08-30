import { type CSSProperties } from 'react'
import { weatherSceneForCondition } from './weatherPresentation'
import styles from './WeatherAtmosphere.module.css'

interface WeatherAtmosphereProps {
  condition?: string
  isNight?: boolean
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

export function WeatherAtmosphere({ condition, isNight = false }: WeatherAtmosphereProps) {
  const scene = weatherSceneForCondition(condition, isNight)
  const rainDropCount = scene === 'storm' ? RAIN_DROPS.length : 34
  const showRain = rainScene(scene)

  return (
    <div aria-hidden="true" className={styles.atmosphere} data-weather-scene={scene}>
      <span className={styles.light} />
      <span className={styles.motion} data-weather-atmosphere-motion="true" />
      {showRain ? (
        <span className={styles.rainField} data-weather-rain-field="true">
          {RAIN_DROPS.slice(0, rainDropCount).map((drop, index) => <i className={styles.rainDrop} data-weather-raindrop="true" key={index} style={rainDropStyle(drop)} />)}
        </span>
      ) : null}
    </div>
  )
}
