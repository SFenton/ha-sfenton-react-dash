import { useEntity, useHass } from '@hakit/core'
import type { HassEntity } from 'home-assistant-js-websocket'
import type { CardColor } from '../core/Card'
import { Description } from '../core/Description'
import { GlassTile } from '../core/GlassTile'
import { SectionHeader } from '../core/SectionHeader'
import { GUEST_CONTROLS_DESCRIPTION, GUEST_CONTROL_ITEMS, SECURITY_COLOR, SWITCH_ACTIVE_COLOR } from '../../constants/portedDashboard'
import { SECURITY_CONTROL_TILES } from '../../constants/securityPage'
import { VACUUM_AUTO_CLEAN_CONTROLS } from '../../constants/vacuumAutoClean'
import { useOptimisticState } from '../../hooks/useOptimisticState'
import { asEntityName, formatCompactEntityState, titleCaseState } from './entityState'
import { SecurityControls, type SecurityControlsProps } from './SecurityControls'
import { VacuumAutoCleanControlCard } from './VacuumAutoCleanControls'
import styles from './GuestPresenceSecurity.module.css'

export const GUEST_PRESENCE_SECURITY_HASH = '#guest-presence-security'

export const GUEST_PRESENCE_SECURITY_SUMMARY =
  'Guest mode skips some away automations. Review security, climate, and auto-clean controls before leaving.'

const DANGER_COLOR: CardColor = { r: 229, g: 57, b: 53 }
const CLIMATE_GUEST_COLOR: CardColor = { r: 25, g: 84, b: 130 }
const CONTROL_REVERT_MS = 8000
const ECO_BEHAVIOR_ENTITY_ID = 'select.thermostat_contact_sensors_eco_behavior_when_away'
const ECO_ENFORCE_HOME_OPTION = 'Disable Eco When Away'
const ECO_ALLOW_AWAY_OPTION = 'Use Eco Away Targets'
const GARAGE_DOORS_DESCRIPTION = 'The away routine normally closes both garage doors when residents leave. Check them here because guest mode skips that automatic close.'
const FRONT_DOOR_DESCRIPTION = 'The away routine normally locks the front door, and auto-lock is also paused while guests are present. Use this if you still want the door secured.'
const SECURITY_SYSTEM_DESCRIPTION = 'The away routine normally arms the security system to Away. Guest mode leaves arming to you so guests are not surprised by the alarm.'
const VACUUM_AUTO_CLEAN_DESCRIPTION = 'Guest stay guards pause whole-home auto-cleaning. Re-enable only the vacuum schedules that are safe to run while guests are still present.'
const THERMOSTAT_DESCRIPTION = 'Guest thermostat guard keeps away mode from using energy-saving temperatures. Turn this off only if away eco targets are acceptable.'
const AWAY_ROUTINE_EXTRAS_DESCRIPTION = 'The skipped away routine normally turns off these towel racks. Check them here if the house is empty but guests are marked present.'

type CallService = (params: Record<string, unknown>) => void

type EntityMap = Record<string, Pick<HassEntity, 'state'> | undefined>

interface ControlService {
  domain: string
  service: string
  serviceData?: Record<string, unknown>
  target?: string
}

interface GuestServiceCardProps {
  activeStates?: string[]
  color?: CardColor
  colorForState?: (state: string) => CardColor
  disabled?: boolean
  entityId: string
  icon: string
  mutedWhenInactive?: boolean
  nextStateForState: (state: string) => string
  serviceForState: (state: string, nextState: string) => ControlService
  subtitleForState?: (state: string, entity: HassEntity | null) => string
  title: string
}

const guestToggleEntityIds = GUEST_CONTROL_ITEMS.map((item) => item.entityId)

const garageDoorControls = SECURITY_CONTROL_TILES.filter((item) => item.tone === 'cover')
const frontDoorControl = SECURITY_CONTROL_TILES.find((item) => item.tone === 'lock')

const towelRackControls = [
  { title: 'Guest Bathroom', entityId: 'switch.guest_bathroom_towel_rack_switch_top', icon: 'mdi:radiator' },
  { title: 'Master Bathroom', entityId: 'switch.master_bathroom_towel_rack_switch_top', icon: 'mdi:radiator' },
]

function isUnavailableState(state: string | undefined) {
  return !state || state === 'unavailable' || state === 'unknown'
}

function hasGuestPresenceSecurityActive(entities: EntityMap) {
  return guestToggleEntityIds.some((entityId) => entities[entityId]?.state === 'on')
}

function useGuestPresenceSecurityActive() {
  return useHass((state) => hasGuestPresenceSecurityActive(state.entities as EntityMap))
}

function formatGuestControlState(entity: HassEntity | null, state: string) {
  if (isUnavailableState(state)) return 'Unavailable'
  return formatCompactEntityState(entity, 'Unavailable', state)
}

function cardBackgroundColor(color: CardColor) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, 0.6)`
}

function GuestServiceCard({
  activeStates = ['on'],
  color = SWITCH_ACTIVE_COLOR,
  colorForState,
  disabled: disabledOverride,
  entityId,
  icon,
  mutedWhenInactive = true,
  nextStateForState,
  serviceForState,
  subtitleForState,
  title,
}: GuestServiceCardProps) {
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true })
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const liveState = entity?.state ?? 'unavailable'
  const [displayState, commitDisplayState] = useOptimisticState(liveState, { clearOn: 'confirmation', revertMs: CONTROL_REVERT_MS })
  const disabled = Boolean(disabledOverride || !entity || isUnavailableState(displayState))
  const active = activeStates.includes(displayState)
  const subtitle = subtitleForState?.(displayState, entity) ?? formatGuestControlState(entity, displayState)
  const cardColor = colorForState?.(displayState) ?? color
  const isOff = disabled || (mutedWhenInactive && !active)

  const runAction = () => {
    if (disabled) return
    const nextState = nextStateForState(displayState)
    const service = serviceForState(displayState, nextState)
    commitDisplayState(nextState)
    const params: Record<string, unknown> = {
      domain: service.domain,
      service: service.service,
      target: service.target ?? entityId,
    }
    if (service.serviceData) params.serviceData = service.serviceData
    callService(params)
  }

  return (
    <GlassTile
      backgroundColor={isOff ? undefined : cardBackgroundColor(cardColor)}
      icon={icon}
      isOff={isOff}
      onClick={disabled ? undefined : runAction}
      pressed={active}
      subtitle={subtitle}
      title={title}
    />
  )
}

function BooleanControlCard({ color = SWITCH_ACTIVE_COLOR, entityId, icon, title }: { color?: CardColor; entityId: string; icon: string; title: string }) {
  return (
    <GuestServiceCard
      color={color}
      entityId={entityId}
      icon={icon}
      nextStateForState={(state) => (state === 'on' ? 'off' : 'on')}
      serviceForState={() => ({ domain: 'homeassistant', service: 'toggle' })}
      title={title}
    />
  )
}

function GarageDoorCard({ entityId, title }: { entityId: string; title: string }) {
  return (
    <GuestServiceCard
      activeStates={['closed']}
      colorForState={(state) => {
        if (state === 'closed') return SWITCH_ACTIVE_COLOR
        if (state === 'closing' || state === 'opening') return SECURITY_COLOR
        return DANGER_COLOR
      }}
      entityId={entityId}
      icon="mdi:garage"
      mutedWhenInactive={false}
      nextStateForState={(state) => (state === 'closed' ? 'open' : 'closed')}
      serviceForState={() => ({ domain: 'homeassistant', service: 'toggle' })}
      title={title}
    />
  )
}

function FrontDoorLockCard() {
  if (!frontDoorControl) return null

  return (
    <GuestServiceCard
      activeStates={['locked']}
      colorForState={(state) => (state === 'locked' ? SWITCH_ACTIVE_COLOR : DANGER_COLOR)}
      entityId={frontDoorControl.entityId}
      icon="mdi:lock"
      mutedWhenInactive={false}
      nextStateForState={(state) => (state === 'unlocked' || state === 'unlocking' ? 'locked' : 'unlocked')}
      serviceForState={(state) => ({ domain: 'lock', service: state === 'unlocked' || state === 'unlocking' ? 'lock' : 'unlock' })}
      title="Front Door"
    />
  )
}

function ThermostatHomeTemperatureCard() {
  const entity = useEntity(asEntityName(ECO_BEHAVIOR_ENTITY_ID), { returnNullIfNotFound: true })
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const liveState = entity?.state ?? 'unavailable'
  const [displayState, commitDisplayState] = useOptimisticState(liveState, { clearOn: 'confirmation', revertMs: CONTROL_REVERT_MS })
  const disabled = !entity || isUnavailableState(displayState)
  const active = displayState === ECO_ENFORCE_HOME_OPTION
  const subtitle = active ? 'Enforced' : displayState === ECO_ALLOW_AWAY_OPTION ? 'Away eco targets' : titleCaseState(displayState)

  const toggle = () => {
    if (disabled) return
    const nextOption = active ? ECO_ALLOW_AWAY_OPTION : ECO_ENFORCE_HOME_OPTION
    commitDisplayState(nextOption)
    callService({
      domain: 'select',
      service: 'select_option',
      serviceData: { option: nextOption },
      target: ECO_BEHAVIOR_ENTITY_ID,
    })
  }

  return (
    <GlassTile
      backgroundColor={disabled || !active ? undefined : cardBackgroundColor(CLIMATE_GUEST_COLOR)}
      icon="mdi:home-thermometer"
      isOff={disabled || !active}
      onClick={disabled ? undefined : toggle}
      pressed={active}
      subtitle={disabled ? 'Unavailable' : subtitle}
      title="Enforce Home Temperatures"
    />
  )
}

function GuestRoomsSection() {
  return (
    <section className={styles.modalSection}>
      <SectionHeader title="Guest Rooms" />
      <Description className={styles.modalDescription}>{GUEST_CONTROLS_DESCRIPTION}</Description>
      <div className={styles.controlGrid}>
        {GUEST_CONTROL_ITEMS.map((item) => (
          <BooleanControlCard color={item.color} entityId={item.entityId} icon={item.icon ?? 'mdi:account'} key={item.entityId} title={item.title} />
        ))}
      </div>
    </section>
  )
}

function GarageDoorsSection() {
  return (
    <section className={styles.modalSection}>
      <SectionHeader title="Garage Doors" />
      <Description className={styles.modalDescription}>{GARAGE_DOORS_DESCRIPTION}</Description>
      <div className={styles.controlGrid}>
        {garageDoorControls.map((item) => <GarageDoorCard entityId={item.entityId} key={item.entityId} title={item.title} />)}
      </div>
    </section>
  )
}

function FrontDoorSection() {
  return (
    <section className={styles.modalSection}>
      <SectionHeader title="Front Door" />
      <Description className={styles.modalDescription}>{FRONT_DOOR_DESCRIPTION}</Description>
      <div className={styles.controlGrid}>
        <FrontDoorLockCard />
      </div>
    </section>
  )
}

function VacuumAutoCleanSection() {
  return (
    <section className={styles.modalSection}>
      <SectionHeader title="Vacuum Auto-Clean" />
      <Description className={styles.modalDescription}>{VACUUM_AUTO_CLEAN_DESCRIPTION}</Description>
      <div className={styles.controlGrid}>
        {VACUUM_AUTO_CLEAN_CONTROLS.map((item) => <VacuumAutoCleanControlCard control={item} key={item.entityId} />)}
      </div>
    </section>
  )
}

function ThermostatSection() {
  return (
    <section className={styles.modalSection}>
      <SectionHeader title="Thermostat" />
      <Description className={styles.modalDescription}>{THERMOSTAT_DESCRIPTION}</Description>
      <div className={styles.controlGrid}>
        <div className={styles.fullWidthControl}>
          <ThermostatHomeTemperatureCard />
        </div>
      </div>
    </section>
  )
}

function AwayRoutineExtrasSection() {
  return (
    <section className={styles.modalSection}>
      <SectionHeader title="Away Routine Extras" />
      <Description className={styles.modalDescription}>{AWAY_ROUTINE_EXTRAS_DESCRIPTION}</Description>
      <div className={`${styles.controlGrid} ${styles.singleColumnControls}`}>
        {towelRackControls.map((item) => <BooleanControlCard entityId={item.entityId} icon={item.icon} key={item.entityId} title={item.title} />)}
      </div>
    </section>
  )
}

function SecuritySystemSection() {
  const props: SecurityControlsProps = { description: SECURITY_SYSTEM_DESCRIPTION, sectionTitle: 'Security System' }
  return <SecurityControls {...props} />
}

export function GuestPresenceSecurityModalContent() {
  return (
    <div className={styles.modalContent}>
      <GuestRoomsSection />
      <GarageDoorsSection />
      <FrontDoorSection />
      <SecuritySystemSection />
      <VacuumAutoCleanSection />
      <ThermostatSection />
      <AwayRoutineExtrasSection />
    </div>
  )
}

export function GuestPresenceSecuritySection({ onOpen }: { onOpen: (hash: string) => void }) {
  const active = useGuestPresenceSecurityActive()

  if (!active) return null

  return (
    <section className={styles.promptSection}>
      <SectionHeader title="Guest Presence Security" />
      <Description>{GUEST_PRESENCE_SECURITY_SUMMARY}</Description>
      <GlassTile disclosure icon="mdi:shield" iconColor="white" onClick={() => onOpen(GUEST_PRESENCE_SECURITY_HASH)} title="Guest Presence Security" tone="switch" />
    </section>
  )
}
