import { useEntity, useHass } from '@hakit/core'
import { CameraTile } from './CameraTile'
import { GlassTile, type TileTone } from '../core/GlassTile'
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

const SHOW_MACHE_SECTION = false

type CallService = (params: Record<string, unknown>) => void

function alarmIcon(state?: string) {
  if (state === 'disarmed') return 'mdi:shield-off'
  if (state === 'armed_home') return 'mdi:shield-home'
  if (state === 'armed_night') return 'mdi:shield-moon'
  if (state === 'armed_away') return 'mdi:shield'
  if (state === 'triggered') return 'mdi:shield-alert'
  return 'mdi:shield-outline'
}

function tileIcon(item: SecurityTileConfig, state?: string) {
  if (item.tone === 'alarm') return alarmIcon(state)
  return item.icon
}

function tileTone(item: SecurityTileConfig, state: string | undefined, unavailable: boolean): TileTone {
  if (unavailable) return 'neutral'
  if (item.tone === 'cover') {
    if (state === 'closed') return 'contact'
    if (state === 'closing') return 'security'
    if (state === 'open' || state === 'opening') return 'danger'
  }
  if (item.tone === 'lock') {
    if (state === 'locked') return 'contact'
    if (state === 'locking' || state === 'unlocking') return 'security'
    if (state === 'unlocked') return 'danger'
  }
  if (item.tone === 'alarm') return state === 'disarmed' ? 'contact' : 'security'
  return 'security'
}

function lockServiceForState(state: string | undefined) {
  return state === 'unlocked' || state === 'unlocking' ? 'lock' : 'unlock'
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
    if (item.tone === 'lock') {
      callService({ domain: 'lock', service: lockServiceForState(entity?.state), target: item.entityId })
      return
    }
    callService({ domain: 'homeassistant', service: 'toggle', target: item.entityId })
  }

  return (
    <GlassTile
      icon={tileIcon(item, entity?.state)}
      isOff={unavailable || (item.tone === 'vehicle' && !active)}
      onClick={item.action && !unavailable ? runAction : undefined}
      subtitle={stateText}
      title={item.title}
      tone={tileTone(item, entity?.state, unavailable)}
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
  if (hash === '#contact-sensors-overview') return <ContactSheet overviewMode="grouped" />
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
