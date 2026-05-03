import type { CSSProperties } from 'react'
import type { AreaConfig } from '../../constants/atAGlance'
import { Icon } from './Icon'
import styles from './RoomCard.module.css'

interface RoomCardProps {
  area: AreaConfig
}

type RoomCardStyle = CSSProperties & {
  '--room-rgb': string
}

export function RoomCard({ area }: RoomCardProps) {
  const style: RoomCardStyle = {
    '--room-rgb': `${area.color.r} ${area.color.g} ${area.color.b}`,
  }

  return (
    <article aria-label={`${area.title} area`} className={styles.card} data-route={area.route} style={style}>
      <span aria-hidden="true" className={styles.icon}>
        <Icon name={area.icon} size={42} />
      </span>
      <span className={styles.title}>{area.title}</span>
    </article>
  )
}