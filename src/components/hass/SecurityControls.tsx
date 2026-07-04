import { useEntity, useHass } from '@hakit/core'
import type { ReactNode } from 'react'
import { SECURITY_ENTITY } from '../../constants/atAGlance'
import { Card, type CardColor } from '../core/Card'
import { Description } from '../core/Description'
import { MaterialIcon } from '../core/Icon'
import { Separator } from '../core/Separator'
import { asEntityName } from './entityState'
import { securityStateColor } from './securityState'
import styles from './SecurityControls.module.css'

const SECURITY_ICON_SIZE = 30

const SECURITY_MODES = [
  { title: 'Home', service: 'alarm_arm_home', state: 'armed_home', icon: <MaterialIcon name="mdi:shield-home" size={SECURITY_ICON_SIZE} /> },
  { title: 'Away', service: 'alarm_arm_away', state: 'armed_away', icon: <MaterialIcon name="mdi:shield" size={SECURITY_ICON_SIZE} /> },
  { title: 'Night', service: 'alarm_arm_night', state: 'armed_night', icon: <MaterialIcon name="mdi:shield-moon" size={SECURITY_ICON_SIZE} /> },
  { title: 'Disarmed', service: 'alarm_disarm', state: 'disarmed', icon: <MaterialIcon name="mdi:shield-off" size={SECURITY_ICON_SIZE} /> },
] as const

export interface SecurityControlsProps {
  description?: ReactNode
  sectionTitle?: string
}

interface SecurityCardProps {
  active?: boolean
  ariaLabel?: string
  color: CardColor
  icon: ReactNode
  onClick?: () => void
  size?: 'compact' | 'standard'
  subtitle?: string
  title: string
}

function SecurityCard({ active = true, ariaLabel, color, icon, onClick, size = 'standard', subtitle, title }: SecurityCardProps) {
  return (
    <Card
      ariaLabel={ariaLabel}
      color={color}
      icon={icon}
      muted={!active}
      onClick={onClick}
      pressed={onClick ? active : undefined}
      size={size}
      subtitle={subtitle}
      title={title}
    />
  )
}

export function SecurityControls({ description, sectionTitle = 'Security System States' }: SecurityControlsProps = {}) {
  const alarm = useEntity(asEntityName(SECURITY_ENTITY), { returnNullIfNotFound: true })
  const callService = useHass((state) => state.helpers.callService)
  const alarmState = alarm?.state

  const callAlarmService = (service: (typeof SECURITY_MODES)[number]['service']) => {
    callService({ domain: 'alarm_control_panel', service, target: SECURITY_ENTITY })
  }

  return (
    <div className={styles.controls}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionLabel}>{sectionTitle}</h3>
        <Separator className={styles.sectionSeparator} />
      </div>
      {description && <Description>{description}</Description>}

      <div className={styles.actions}>
        {SECURITY_MODES.map((mode) => {
          const active = alarmState === mode.state

          return (
            <SecurityCard
              active={active}
              ariaLabel={`Set security system to ${mode.title}`}
              color={securityStateColor(mode.state)}
              icon={mode.icon}
              key={mode.service}
              onClick={() => callAlarmService(mode.service)}
              size="compact"
              title={mode.title}
            />
          )
        })}
      </div>
    </div>
  )
}
