import { useEntity, useHass } from '@hakit/core'
import type { ReactNode } from 'react'
import { SECURITY_ENTITY } from '../../constants/atAGlance'
import { Card, type CardColor } from '../core/Card'
import { MaterialIcon } from '../core/Icon'
import { Separator } from '../core/Separator'
import { asEntityName, titleCaseState } from './entityState'
import styles from './SecurityControls.module.css'

type SecurityModeState = 'armed_away' | 'armed_home' | 'armed_night' | 'disarmed' | 'triggered'

const SECURITY_ICON_SIZE = 30

const SECURITY_COLORS = {
  armed_away: { r: 229, g: 57, b: 53 },
  armed_home: { r: 30, g: 136, b: 229 },
  armed_night: { r: 142, g: 36, b: 170 },
  disarmed: { r: 67, g: 160, b: 71 },
  triggered: { r: 229, g: 57, b: 53 },
  unknown: { r: 84, g: 110, b: 122 },
} satisfies Record<SecurityModeState | 'unknown', CardColor>

const SECURITY_MODES = [
  { title: 'Home', service: 'alarm_arm_home', state: 'armed_home', icon: <MaterialIcon name="mdi:shield-home" size={SECURITY_ICON_SIZE} /> },
  { title: 'Away', service: 'alarm_arm_away', state: 'armed_away', icon: <MaterialIcon name="mdi:shield" size={SECURITY_ICON_SIZE} /> },
  { title: 'Night', service: 'alarm_arm_night', state: 'armed_night', icon: <MaterialIcon name="mdi:shield-moon" size={SECURITY_ICON_SIZE} /> },
  { title: 'Disarmed', service: 'alarm_disarm', state: 'disarmed', icon: <MaterialIcon name="mdi:shield-off" size={SECURITY_ICON_SIZE} /> },
] as const

function securityStateColor(state?: string): CardColor {
  return state && state in SECURITY_COLORS ? SECURITY_COLORS[state as SecurityModeState] : SECURITY_COLORS.unknown
}

function securityStateIcon(state?: string) {
  if (state === 'disarmed') return <MaterialIcon name="mdi:shield-off" size={SECURITY_ICON_SIZE} />
  if (state === 'armed_home') return <MaterialIcon name="mdi:shield-home" size={SECURITY_ICON_SIZE} />
  if (state === 'armed_night') return <MaterialIcon name="mdi:shield-moon" size={SECURITY_ICON_SIZE} />
  if (state === 'triggered') return <MaterialIcon name="mdi:shield-alert" size={SECURITY_ICON_SIZE} />
  return <MaterialIcon name="mdi:shield" size={SECURITY_ICON_SIZE} />
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

export function SecurityControls() {
  const alarm = useEntity(asEntityName(SECURITY_ENTITY), { returnNullIfNotFound: true })
  const callService = useHass((state) => state.helpers.callService)
  const alarmState = alarm?.state
  const alarmStateTitle = titleCaseState(alarmState)

  const callAlarmService = (service: (typeof SECURITY_MODES)[number]['service']) => {
    callService({ domain: 'alarm_control_panel', service, target: SECURITY_ENTITY })
  }

  return (
    <div className={styles.controls}>
      <SecurityCard
        ariaLabel={`Current security system state ${alarmStateTitle}`}
        color={securityStateColor(alarmState)}
        icon={securityStateIcon(alarmState)}
        size="compact"
        title={alarmStateTitle}
      />

      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionLabel}>Security System States</h3>
        <Separator className={styles.sectionSeparator} />
      </div>

      <div className={styles.actions}>
        {SECURITY_MODES.map((mode) => {
          const active = alarmState === mode.state

          return (
            <SecurityCard
              active={active}
              ariaLabel={`Set security system to ${mode.title}`}
              color={SECURITY_COLORS[mode.state]}
              icon={mode.icon}
              key={mode.service}
              onClick={() => callAlarmService(mode.service)}
              size="compact"
              subtitle={active ? 'Active' : 'Inactive'}
              title={mode.title}
            />
          )
        })}
      </div>
    </div>
  )
}
