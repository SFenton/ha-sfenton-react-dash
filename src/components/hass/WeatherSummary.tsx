import { useEffect, useMemo, useState } from 'react'
import { useEntity } from '@hakit/core'
import type { HassEntity } from 'home-assistant-js-websocket'
import effects from '../../styles/effects.module.css'
import { WEATHER_ENTITY } from '../../constants/atAGlance'
import { asEntityName, titleCaseState } from './entityState'
import styles from './WeatherSummary.module.css'

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function weatherTemperature(entity: HassEntity | null) {
  const temperature = entity?.attributes.temperature
  if (temperature === undefined || temperature === null) return '--'
  const unit = typeof entity?.attributes.temperature_unit === 'string' ? entity.attributes.temperature_unit : 'F'
  return `${Math.round(Number(temperature))}°${unit.replace('°', '')}`
}

export function WeatherSummary() {
  const weather = useEntity(asEntityName(WEATHER_ENTITY), { returnNullIfNotFound: true })
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const dateLabel = useMemo(
    () => now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }),
    [now],
  )

  return (
    <section className={`${effects.frosted} ${styles.card}`}>
      <div className={styles.copy}>
        <span className={styles.eyebrow}>{dateLabel} · {formatTime(now)}</span>
        <span className={styles.condition}>{titleCaseState(weather?.state)}</span>
        <span className={styles.meta}>At-a-glance home overview</span>
      </div>
      <div className={styles.temperature}>{weatherTemperature(weather)}</div>
    </section>
  )
}