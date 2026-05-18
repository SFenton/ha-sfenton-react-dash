import { useEntity, useHass } from '@hakit/core'
import { CameraTile } from './CameraTile'
import { Card, type CardColor } from '../core/Card'
import { MaterialIcon } from '../core/Icon'
import { ModalSheet } from '../core/ModalSheet'
import { SectionHeader } from '../core/SectionHeader'
import { CAMERA_ITEMS, CONTACT_GROUPS } from '../../constants/atAGlance'
import {
  SECURITY_CONTROL_TILES,
  SECURITY_MACHE_TILES,
  SECURITY_STATUS_CHIPS,
  type SecurityTileConfig,
} from '../../constants/securityPage'
import { useHashModal } from '../../hooks/useHashModal'
import { ContactSheet } from '../../pages/AtAGlancePage'
import { CameraModalContent } from './CameraModalContent'
import { asEntityName, formatCompactEntityState, isActiveState, isContactOpen } from './entityState'
import { SecurityControls } from './SecurityControls'
import { StatusRail } from './StatusRail'
import styles from './SecurityDashboard.module.css'

const UNAVAILABLE_COLOR: CardColor = { r: 255, g: 255, b: 255 }
const UNKNOWN_COLOR: CardColor = { r: 84, g: 110, b: 122 }
const CLOSED_COVER_COLOR: CardColor = { r: 67, g: 160, b: 71 }
const OPEN_COVER_COLOR: CardColor = { r: 229, g: 57, b: 53 }
const TRANSITION_COVER_COLOR: CardColor = { r: 30, g: 136, b: 229 }
const SHOW_MACHE_SECTION = false

const ALARM_COLORS: Record<string, CardColor> = {
  disarmed: { r: 67, g: 160, b: 71 },
  armed_home: { r: 30, g: 136, b: 229 },
  armed_night: { r: 142, g: 36, b: 170 },
  armed_away: { r: 229, g: 57, b: 53 },
  triggered: { r: 229, g: 57, b: 53 },
}

const LOCK_COLORS: Record<string, CardColor> = {
  locked: { r: 67, g: 160, b: 71 },
  locking: { r: 30, g: 136, b: 229 },
  unlocking: { r: 30, g: 136, b: 229 },
  unlocked: { r: 229, g: 57, b: 53 },
}

const COVER_COLORS: Record<string, CardColor> = {
  closed: CLOSED_COVER_COLOR,
  closing: TRANSITION_COVER_COLOR,
  open: OPEN_COVER_COLOR,
  opening: OPEN_COVER_COLOR,
}

type CallService = (params: Record<string, unknown>) => void

function alarmIcon(state?: string) {
  if (state === 'disarmed') return 'mdi:shield-off'
  if (state === 'armed_home') return 'mdi:shield-home'
  if (state === 'armed_night') return 'mdi:shield-moon'
  if (state === 'armed_away') return 'mdi:shield'
  if (state === 'triggered') return 'mdi:shield-alert'
  return 'mdi:shield-outline'
}

function tileColor(item: SecurityTileConfig, state?: string, unavailable = false): CardColor {
  if (unavailable) return UNAVAILABLE_COLOR
  if (item.tone === 'alarm') return (state && ALARM_COLORS[state]) || UNKNOWN_COLOR
  if (item.tone === 'lock') return (state && LOCK_COLORS[state]) || UNKNOWN_COLOR
  if (item.tone === 'cover') return (state && COVER_COLORS[state]) || UNKNOWN_COLOR
  return item.color ?? UNKNOWN_COLOR
}

function tileIcon(item: SecurityTileConfig, state?: string) {
  if (item.tone === 'alarm') return alarmIcon(state)
  return item.icon
}

function tileMuted(item: SecurityTileConfig, active: boolean, unavailable: boolean) {
  if (unavailable) return true
  if (item.tone === 'alarm' || item.tone === 'cover' || item.tone === 'lock') return false
  return !active
}

function SecurityTile({ item, onOpenHash }: { item: SecurityTileConfig; onOpenHash: (hash: string) => void }) {
  const entity = useEntity(asEntityName(item.entityId), { returnNullIfNotFound: true })
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const unavailable = !entity || entity.state === 'unavailable' || entity.state === 'unknown'
  const stateText = formatCompactEntityState(entity, 'Unavailable')
  const active = isActiveState(entity)

  const runAction = () => {
    if (!item.action) return
    if (item.action.type === 'hash') {
      onOpenHash(item.action.hash)
      return
    }
    callService({ domain: 'homeassistant', service: 'toggle', target: item.entityId })
  }

  return (
    <Card
      ariaLabel={`${item.title} ${stateText}`}
      color={tileColor(item, entity?.state, unavailable)}
      disabled={unavailable}
      icon={<MaterialIcon name={tileIcon(item, entity?.state)} size={38} />}
      muted={tileMuted(item, active, unavailable)}
      onClick={item.action && !unavailable ? runAction : undefined}
      pressed={item.action?.type === 'toggle' ? active : undefined}
      size="compact"
      subtitle={stateText}
      title={item.title}
    />
  )
}

function SecurityStatusRail({ onOpenHash }: { onOpenHash: (hash: string) => void }) {
  const openContactCount = useHass((state) =>
    CONTACT_GROUPS.flatMap((group) => group.items).reduce((count, sensor) => count + (isContactOpen(state.entities[sensor.entityId]) ? 1 : 0), 0),
  )
  const contactSubtitle = openContactCount === 0 ? 'All Closed' : `${openContactCount} Open`

  return (
    <div className={styles.statusRailWrap}>
      <StatusRail chips={SECURITY_STATUS_CHIPS} onOpenHash={onOpenHash} subtitleByHash={{ '#contact-sensors-overview': contactSubtitle }} />
    </div>
  )
}

function modalTitle(hash: string) {
  if (hash === '#security-system') return 'Security System'
  if (hash === '#contact-sensors-overview') return 'Contact Sensors'
  const camera = CAMERA_ITEMS.find((item) => item.hash === hash)
  if (camera) return `${camera.title} Camera`
  return 'Security'
}

function SecurityModalContent({ hash }: { hash: string }) {
  if (hash === '#security-system') return <SecurityControls />
  if (hash === '#contact-sensors-overview') return <ContactSheet />
  const camera = CAMERA_ITEMS.find((item) => item.hash === hash)
  if (camera) return <CameraModalContent camera={camera} />
  return null
}

export function SecurityDashboard() {
  const { closeHash, hash, openHash } = useHashModal()

  return (
    <>
      <div className={styles.dashboard}>
        <SecurityStatusRail onOpenHash={openHash} />

        <section className={styles.section}>
          <SectionHeader title="Security" />
          <div className={styles.grid}>
            {SECURITY_CONTROL_TILES.map((item) => <SecurityTile item={item} key={item.entityId} onOpenHash={openHash} />)}
          </div>
        </section>

        <section className={styles.section}>
          <SectionHeader title="Cameras" />
          <div className={styles.cameraGrid}>
            {CAMERA_ITEMS.map((camera) => <CameraTile camera={camera} key={camera.entityId} onOpen={openHash} />)}
          </div>
        </section>

        {SHOW_MACHE_SECTION && (
          <section className={styles.section}>
            <SectionHeader title="Mach-E" />
            <div className={styles.grid}>
              {SECURITY_MACHE_TILES.map((item) => <SecurityTile item={item} key={item.entityId} onOpenHash={openHash} />)}
            </div>
          </section>
        )}
      </div>

      <ModalSheet onClose={closeHash} open={hash !== ''} title={modalTitle(hash)}>
        <SecurityModalContent hash={hash} />
      </ModalSheet>
    </>
  )
}
