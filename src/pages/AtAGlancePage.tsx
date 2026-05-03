import { useEntity, useHass } from '@hakit/core'
import { Camera as CameraIcon, CircleDot, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AppShell } from '../components/shell/AppShell'
import { BottomNav } from '../components/shell/BottomNav'
import { ActionPill } from '../components/core/ActionPill'
import { GlassTile } from '../components/core/GlassTile'
import { ModalSheet } from '../components/core/ModalSheet'
import { RoomCard } from '../components/core/RoomCard'
import { SectionHeader } from '../components/core/SectionHeader'
import { CameraTile } from '../components/hass/CameraTile'
import { EntityGroup } from '../components/hass/EntityGroup'
import { SecurityControls } from '../components/hass/SecurityControls'
import { StatusRail } from '../components/hass/StatusRail'
import { WeatherSummary } from '../components/hass/WeatherSummary'
import { asEntityName, formatCompactEntityState } from '../components/hass/entityState'
import { WebRtcCamera } from '../components/hass/WebRtcCamera'
import {
  AREA_ITEMS,
  CAMERA_ITEMS,
  CLIMATE_GROUPS,
  LIGHT_GROUPS,
  OVERVIEW_STATUS_CHIPS,
  QUICK_ACCESS_ITEMS,
  type QuickAccessConfig,
} from '../constants/atAGlance'
import { buildStaggerStyle, staggerMs } from '../hooks/useStaggerStyle'
import { useHashModal } from '../hooks/useHashModal'
import styles from './AtAGlancePage.module.css'
import { Page } from './Page'

declare global {
  interface Window {
    __webrtcGetMuteState?: (targetId: string) => boolean
  }
}

const SHEET_TITLES: Record<string, string> = {
  '#lights-overview': 'Lights',
  '#security-system': 'Security System',
  '#climate-overview': 'Climate',
  '#occupancy-overview': 'Occupancy',
  '#contact-sensors-overview': 'Contact Sensors',
  '#aqi-overview': 'Air Quality',
  '#chores-preview': 'Chores',
  '#settings-preview': 'Settings',
}

function sheetTitle(hash: string) {
  const camera = CAMERA_ITEMS.find((item) => item.hash === hash)
  return camera ? camera.title : SHEET_TITLES[hash] ?? 'Overview'
}

function dispatchWebRtcAction(eventName: 'webrtc-screenshot' | 'webrtc-mute' | 'webrtc-unmute', targetId: string) {
  window.dispatchEvent(new CustomEvent(eventName, { detail: { target_id: targetId } }))
}

function getMuteState(targetId: string) {
  return window.__webrtcGetMuteState?.(targetId) ?? true
}

function formatClimatePowerState(entity: ReturnType<typeof useEntity>) {
  if (!entity || entity.state === 'unavailable') return 'Unavailable'
  return entity.state === 'off' ? 'Off' : 'On'
}

function QuickAccessTile({ item, onOpenHash }: { item: QuickAccessConfig; onOpenHash: (hash: string) => void }) {
  const entity = useEntity(asEntityName(item.entityId ?? 'sensor.unavailable'), { returnNullIfNotFound: true })
  const subtitle = item.status === 'climate_power' ? formatClimatePowerState(entity) : item.status === 'entity_state' ? formatCompactEntityState(entity) : undefined
  const itemHash = item.hash

  return (
    <GlassTile
      icon={item.icon}
      onClick={itemHash ? () => onOpenHash(itemHash) : undefined}
      subtitle={subtitle}
      title={item.title}
      tone={item.tone}
    />
  )
}

function CameraSheet({ hash }: { hash: string }) {
  const camera = CAMERA_ITEMS.find((item) => item.hash === hash)
  const recordingEntity = useEntity(asEntityName(camera?.recordingEntityId ?? 'input_boolean.unknown'), { returnNullIfNotFound: true })
  const callService = useHass((state) => state.helpers.callService)
  const targetId = camera?.popupCardId ?? ''
  const [isMuted, setIsMuted] = useState(() => (targetId ? getMuteState(targetId) : true))
  const [snapshotPulse, setSnapshotPulse] = useState(false)

  useEffect(() => {
    if (!targetId) return undefined

    const handleAudioState = (event: Event) => {
      const detail = (event as CustomEvent<{ target_id?: string; muted?: boolean }>).detail
      if (detail?.target_id === targetId && typeof detail.muted === 'boolean') {
        setIsMuted(detail.muted)
      }
    }

    window.addEventListener('webrtc-audio-state', handleAudioState)
    return () => window.removeEventListener('webrtc-audio-state', handleAudioState)
  }, [targetId])

  if (!camera) return null

  const toggleRecording = () => {
    if (!camera.recordingScriptEntityId) return
    callService({ domain: 'script', service: 'turn_on', target: camera.recordingScriptEntityId })
  }

  const takeSnapshot = () => {
    setSnapshotPulse(true)
    window.setTimeout(() => setSnapshotPulse(false), 900)
    dispatchWebRtcAction('webrtc-screenshot', camera.popupCardId)
  }
  const toggleMute = () => {
    const nextMuted = !getMuteState(camera.popupCardId)
    setIsMuted(nextMuted)
    dispatchWebRtcAction(nextMuted ? 'webrtc-mute' : 'webrtc-unmute', camera.popupCardId)
  }
  const isRecording = recordingEntity?.state === 'on'

  return (
    <div className={styles.cameraSheet}>
      <div className={styles.cameraFocus}>
        <WebRtcCamera camera={camera} controls minHeight={310} variant="modal" />
      </div>
      <div className={styles.cameraControls} aria-label={`${camera.title} camera controls`}>
        <ActionPill active={snapshotPulse} label="Snapshot" onClick={takeSnapshot} pulse={snapshotPulse}>
          <CameraIcon size={24} strokeWidth={2.4} />
        </ActionPill>
        <ActionPill active={isMuted} label={isMuted ? 'Muted' : 'Audio'} onClick={toggleMute}>
          {isMuted ? <VolumeX size={24} strokeWidth={2.4} /> : <Volume2 size={24} strokeWidth={2.4} />}
        </ActionPill>
        {camera.recordingScriptEntityId && (
          <ActionPill active={isRecording} danger label={isRecording ? 'Recording' : 'Record'} onClick={toggleRecording} pulse={isRecording}>
            <CircleDot size={25} strokeWidth={2.5} />
          </ActionPill>
        )}
      </div>
    </div>
  )
}

function SheetContent({ hash }: { hash: string }) {
  if (hash === '#lights-overview') {
    return LIGHT_GROUPS.map((group) => <EntityGroup group={group} key={group.title} />)
  }

  if (hash === '#climate-overview') {
    return CLIMATE_GROUPS.map((group) => <EntityGroup group={group} key={group.title} />)
  }

  if (hash === '#security-system') return <SecurityControls />

  if (CAMERA_ITEMS.some((item) => item.hash === hash)) return <CameraSheet hash={hash} key={hash} />

  return <p className={styles.sheetText}>This section is represented in the Home Assistant dashboard and is queued for the next recreation pass.</p>
}

export function AtAGlancePage() {
  const { hash, openHash, closeHash } = useHashModal()

  const openOrCloseHash = (nextHash: string) => {
    if (!nextHash) {
      closeHash()
      return
    }
    openHash(nextHash)
  }

  return (
    <AppShell bottomNav={<BottomNav activeHash={hash} onOpenHash={openOrCloseHash} />}>
      <Page title="Home" onSettings={() => openHash('#settings-preview')} headerQuickLinks={<StatusRail chips={OVERVIEW_STATUS_CHIPS} onOpenHash={openHash} />}>
        <div className={styles.weatherWrap} style={buildStaggerStyle(120)}>
          <WeatherSummary />
        </div>

        <SectionHeader title="Quick Links" />
        <section className={styles.quickGrid}>
          {QUICK_ACCESS_ITEMS.map((item, index) => (
            <div key={item.title} style={buildStaggerStyle(staggerMs(index, 42, 70))}>
              <QuickAccessTile item={item} onOpenHash={openHash} />
            </div>
          ))}
        </section>

        <SectionHeader title="Cameras" />
        <section className={styles.cameraGrid}>
          {CAMERA_ITEMS.map((camera, index) => (
            <div key={camera.title} style={buildStaggerStyle(staggerMs(index, 42, 130))}>
              <CameraTile camera={camera} onOpen={openHash} />
            </div>
          ))}
        </section>

        <SectionHeader title="Areas" />
        <section className={styles.areaGrid}>
          {AREA_ITEMS.map((area, index) => (
            <div key={area.title} style={buildStaggerStyle(staggerMs(index, 28, 190))}>
              <RoomCard area={area} />
            </div>
          ))}
        </section>
      </Page>

      <ModalSheet open={hash !== ''} title={sheetTitle(hash)} onClose={closeHash}>
        <SheetContent hash={hash} />
      </ModalSheet>
    </AppShell>
  )
}