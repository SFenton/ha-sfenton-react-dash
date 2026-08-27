import { weatherSceneForCondition } from './weatherPresentation'
import styles from './WeatherAtmosphere.module.css'

interface WeatherAtmosphereProps {
  condition?: string
  isNight?: boolean
}

export function WeatherAtmosphere({ condition, isNight = false }: WeatherAtmosphereProps) {
  const scene = weatherSceneForCondition(condition, isNight)

  return (
    <div aria-hidden="true" className={styles.atmosphere} data-weather-scene={scene}>
      <span className={styles.light} />
      <span className={styles.motion} data-weather-atmosphere-motion="true" />
    </div>
  )
}
