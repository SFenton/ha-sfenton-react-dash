import { useEntity, useHass } from '@hakit/core'
import { useEffect, useRef, useState } from 'react'
import type { HassEntity } from 'home-assistant-js-websocket'
import { ClimateCard } from '../components/cards/ClimateCard'
import { ContactSensorCard } from '../components/cards/ContactSensorCard'
import { LightCard } from '../components/cards/LightCard'
import { OccupancyCard } from '../components/cards/OccupancyCard'
import { RoomCard } from '../components/cards/RoomCard'
import { AppShell } from '../components/shell/AppShell'
import { BottomNav } from '../components/shell/BottomNav'
import { ActionPill } from '../components/core/ActionPill'
import { GlassTile } from '../components/core/GlassTile'
import { Icon, MaterialIcon } from '../components/core/Icon'
import { ModalSheet } from '../components/core/ModalSheet'
import { Separator } from '../components/core/Separator'
import { SectionHeader } from '../components/core/SectionHeader'
import { CameraTile } from '../components/hass/CameraTile'
import { SecurityControls } from '../components/hass/SecurityControls'
import { StatusRail } from '../components/hass/StatusRail'
import { WeatherSummary } from '../components/hass/WeatherSummary'
import { formatAirMetricState } from '../components/hass/airQualityState'
import { asEntityName, formatCompactEntityState, isActiveState, isContactOpen, isOccupancyActive } from '../components/hass/entityState'
import { securityStateCssColor, securityStateIconName } from '../components/hass/securityState'
import { WebRtcCamera } from '../components/hass/WebRtcCamera'
import {
  AREA_ITEMS,
  AIR_QUALITY_ROOMS,
  CAMERA_ITEMS,
  CLIMATE_GROUPS,
  CONTACT_GROUPS,
  LIGHT_GROUPS,
  OCCUPANCY_GROUPS,
  OVERVIEW_STATUS_CHIPS,
  QUICK_ACCESS_ITEMS,
  type AirQualityRoomConfig,
  type AreaConfig,
  type EntityGroupConfig,
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

const LIGHTS_SUFFIX = ' Lights'
const LIGHT_SUFFIX = ' Light'
const CLIMATE_SUFFIX = ' Climate'
const OCCUPANCY_SUFFIX = ' Occupancy'
const CONTACT_SUFFIX = ' Contact Sensors'
const ROOM_LIGHT_GROUPS = LIGHT_GROUPS
const ROOM_LIGHT_ENTITY_IDS = [...new Set(ROOM_LIGHT_GROUPS.flatMap((group) => group.items.map((item) => item.entityId)))]
const ROOM_CLIMATE_GROUPS = CLIMATE_GROUPS
const ROOM_OCCUPANCY_GROUPS = OCCUPANCY_GROUPS
const ROOM_CONTACT_GROUPS = CONTACT_GROUPS
const ROOM_AIR_QUALITY_GROUPS = AIR_QUALITY_ROOMS
const ROOM_CONTACT_ENTITY_IDS = [...new Set(ROOM_CONTACT_GROUPS.flatMap((group) => group.items.map((item) => item.entityId)))]
const DEFAULT_CLIMATE_COLOR = { r: 25, g: 84, b: 130 }
const DEFAULT_OCCUPANCY_COLOR = { r: 46, g: 180, b: 120 }
const DEFAULT_CONTACT_COLOR = { r: 220, g: 92, b: 68 }

function sheetTitle(hash: string) {
  const camera = CAMERA_ITEMS.find((item) => item.hash === hash)
  return camera ? camera.title : SHEET_TITLES[hash] ?? 'Overview'
}

function lightsSheetTitle(activeLightCount: number) {
  return `Lights (${lightCountSubtitle(activeLightCount)})`
}

function lightCountSubtitle(activeLightCount: number) {
  if (activeLightCount === 0) return 'All Off'
  return `${activeLightCount} On`
}

function areaForTitle(title: string) {
  return AREA_ITEMS.find((area) => area.title === title)
}

function climateRoomTitle(group: EntityGroupConfig) {
  if (group.title.endsWith(CLIMATE_SUFFIX)) return group.title.slice(0, -CLIMATE_SUFFIX.length)
  return group.title
}

function occupancyRoomTitle(group: EntityGroupConfig) {
  if (group.title.endsWith(OCCUPANCY_SUFFIX)) return group.title.slice(0, -OCCUPANCY_SUFFIX.length)
  return group.title
}

function contactRoomTitle(group: EntityGroupConfig) {
  if (group.title.endsWith(CONTACT_SUFFIX)) return group.title.slice(0, -CONTACT_SUFFIX.length)
  return group.title
}

function climateGroupColor(group: EntityGroupConfig) {
  return areaForTitle(climateRoomTitle(group))?.color ?? DEFAULT_CLIMATE_COLOR
}

function climateGroupIcon(group: EntityGroupConfig) {
  return areaForTitle(climateRoomTitle(group))?.icon ?? 'thermostat'
}

function occupancyGroupColor(group: EntityGroupConfig) {
  return areaForTitle(occupancyRoomTitle(group))?.color ?? DEFAULT_OCCUPANCY_COLOR
}

function contactGroupColor(group: EntityGroupConfig) {
  return areaForTitle(contactRoomTitle(group))?.color ?? DEFAULT_CONTACT_COLOR
}

function parseCssColor(value: string | undefined) {
  if (!value) return null

  const rgb = value.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i)
  if (rgb) return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) }

  const hex = value.match(/^#([0-9a-f]{6})$/i)
  if (!hex) return null

  return {
    r: Number.parseInt(hex[1].slice(0, 2), 16),
    g: Number.parseInt(hex[1].slice(2, 4), 16),
    b: Number.parseInt(hex[1].slice(4, 6), 16),
  }
}

function contactItemKind(item: EntityGroupConfig['items'][number]) {
  const value = `${item.title} ${item.entityId}`.toLowerCase()
  return value.includes('window') ? 'window' : 'door'
}

function contactGroupKind(group: EntityGroupConfig) {
  return group.items.every((item) => contactItemKind(item) === 'window') ? 'window' : 'door'
}

function contactItemCount(item: EntityGroupConfig['items'][number]) {
  return item.contactCount ?? 1
}

function climateItemIcon(entityId: string) {
  return entityId.startsWith('cover.') ? 'vent' : 'temperature'
}

function isVentClimateItem(entityId: string) {
  return entityId.startsWith('cover.')
}

function climateVentSectionTitle(ventItems: EntityGroupConfig['items']) {
  return ventItems.length === 1 && ventItems[0]?.title !== 'Vents' ? 'Vent' : 'Vents'
}

function climateReading(entity: HassEntity | null | undefined) {
  if (!entity || !entity.entity_id.startsWith('sensor.')) return null
  if (entity.state === 'unavailable' || entity.state === 'unknown') return null

  const value = Number(entity.state)
  if (!Number.isFinite(value)) return null

  const unit = typeof entity.attributes.unit_of_measurement === 'string' ? entity.attributes.unit_of_measurement : ''
  return { unit, value }
}

function formatClimateReading(value: number, unit: string) {
  const displayValue = (Math.trunc(value * 10) / 10).toFixed(1)
  return `${displayValue}${unit}`
}

function normalizeClimateRangeText(value: string | undefined) {
  if (!value || value === 'unknown' || value === 'unavailable') return null

  return value.replace(/-?\d+(?:\.\d+)?/g, (match) => (Math.trunc(Number(match) * 10) / 10).toFixed(1))
}

function climateGroupSubtitle(group: EntityGroupConfig, entities: Record<string, HassEntity | undefined>) {
  const readings = group.items.map((item) => climateReading(entities[item.entityId])).filter((reading): reading is { unit: string; value: number } => Boolean(reading))

  if (readings.length === 0) return `${group.items.length} sensors`

  const values = readings.map((reading) => reading.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const unit = readings[0]?.unit ?? ''

  if (Math.abs(min - max) < 0.05) return formatClimateReading(min, unit)
  return `${formatClimateReading(min, unit)} - ${formatClimateReading(max, unit)}`
}

function occupancyGroupActiveCount(group: EntityGroupConfig, entities: Record<string, HassEntity | undefined>) {
  return group.items.reduce((count, item) => count + (isOccupancyActive(entities[item.entityId]) ? 1 : 0), 0)
}

function occupancyGroupSubtitle(group: EntityGroupConfig, entities: Record<string, HassEntity | undefined>) {
  const activeCount = occupancyGroupActiveCount(group, entities)

  return activeCount > 0 ? 'Occupied' : 'Not Occupied'
}

function occupancyGroupSensorSubtitle(group: EntityGroupConfig, entities: Record<string, HassEntity | undefined>) {
  const activeCount = occupancyGroupActiveCount(group, entities)
  return `${activeCount} sensor${activeCount === 1 ? '' : 's'} occupied`
}

function contactGroupOpenCount(group: EntityGroupConfig, entities: Record<string, HassEntity | undefined>) {
  return group.items.reduce((count, item) => count + (isContactOpen(entities[item.entityId]) ? 1 : 0), 0)
}

function contactSensorActiveSubtitle(activeCount: number) {
  return `${activeCount} Sensor${activeCount === 1 ? '' : 's'} Active`
}

function contactKindLabel(kind: ReturnType<typeof contactItemKind>, count: number) {
  if (kind === 'window') return count === 1 ? 'Window' : 'Windows'
  return count === 1 ? 'Door' : 'Doors'
}

function contactKindOpenSummary(kind: ReturnType<typeof contactItemKind>, openCount: number, totalCount: number) {
  if (totalCount === 1) return `${contactKindLabel(kind, 1)} ${openCount === 1 ? 'Open' : 'Closed'}`
  if (openCount === 0) return `All ${contactKindLabel(kind, totalCount)} Closed`
  if (openCount === totalCount) return `All ${contactKindLabel(kind, totalCount)} Open`
  return `${openCount} ${contactKindLabel(kind, openCount)} Open`
}

function contactGroupOpenSummary(group: EntityGroupConfig, entities: Record<string, HassEntity | undefined>) {
  const counts = group.items.reduce(
    (nextCounts, item) => {
      const kind = contactItemKind(item)
      nextCounts[kind].total += contactItemCount(item)
      if (isContactOpen(entities[item.entityId])) nextCounts[kind].open += 1
      return nextCounts
    },
    {
      door: { open: 0, total: 0 },
      window: { open: 0, total: 0 },
    },
  )

  const activeKinds = (['window', 'door'] as const).filter((kind) => counts[kind].total > 0)

  if (activeKinds.length === 1) {
    const kind = activeKinds[0]
    return contactKindOpenSummary(kind, counts[kind].open, counts[kind].total)
  }

  const openParts = activeKinds
    .filter((kind) => counts[kind].open > 0)
    .map((kind) => contactKindOpenSummary(kind, counts[kind].open, counts[kind].total))

  return openParts.length > 0 ? openParts.join(', ') : 'All Closed'
}

function contactGroupSubtitle(group: EntityGroupConfig, entities: Record<string, HassEntity | undefined>) {
  return contactGroupOpenSummary(group, entities)
}

function contactGroupSensorSubtitle(group: EntityGroupConfig, entities: Record<string, HassEntity | undefined>) {
  return contactGroupOpenSummary(group, entities)
}

function dispatchWebRtcAction(eventName: 'webrtc-screenshot' | 'webrtc-mute' | 'webrtc-unmute', targetId: string) {
  window.dispatchEvent(new CustomEvent(eventName, { detail: { target_id: targetId } }))
}

function getMuteState(targetId: string) {
  return window.__webrtcGetMuteState?.(targetId) ?? true
}

function roomTitleFromLightGroup(group: EntityGroupConfig) {
  if (group.title.endsWith(LIGHTS_SUFFIX)) return group.title.slice(0, -LIGHTS_SUFFIX.length)
  if (group.title.endsWith(LIGHT_SUFFIX)) return group.title.slice(0, -LIGHT_SUFFIX.length)
  return group.title
}

function QuickAccessTile({ item, onNavigate, onOpenHash }: { item: QuickAccessConfig; onNavigate: (path: string) => void; onOpenHash: (hash: string) => void }) {
  const entity = useEntity(asEntityName(item.entityId ?? 'sensor.unavailable'), { returnNullIfNotFound: true })
  const subtitle = item.status === 'entity_state' ? formatCompactEntityState(entity) : undefined
  const itemHash = item.hash
  const isSecurityTile = item.tone === 'security' && item.entityId?.startsWith('alarm_control_panel.')

  const handleClick = () => {
    if (itemHash) {
      onOpenHash(itemHash)
      return
    }
    if (item.route) onNavigate(item.route.split('/').filter(Boolean).at(-1) ?? 'overview')
  }

  return (
    <GlassTile
      backgroundColor={isSecurityTile ? securityStateCssColor(entity?.state, 0.5) : undefined}
      icon={isSecurityTile ? securityStateIconName(entity?.state) : item.icon}
      iconColor={isSecurityTile ? 'white' : undefined}
      onClick={itemHash || item.route ? handleClick : undefined}
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
          <MaterialIcon name="mdi:camera" size={24} />
        </ActionPill>
        <ActionPill active={isMuted} label={isMuted ? 'Muted' : 'Audio'} onClick={toggleMute}>
          <MaterialIcon name={isMuted ? 'mdi:volume-off' : 'mdi:volume-high'} size={24} />
        </ActionPill>
        {camera.recordingScriptEntityId && (
          <ActionPill active={isRecording} danger label={isRecording ? 'Recording' : 'Record'} onClick={toggleRecording} pulse={isRecording}>
            <MaterialIcon name="mdi:record-circle" size={25} />
          </ActionPill>
        )}
      </div>
    </div>
  )
}

function RoomsHeader({ showSeparator = true }: { showSeparator?: boolean }) {
  return (
    <div className={styles.lightSectionHeader}>
      <h3 className={styles.lightSectionLabel}>Rooms</h3>
      <Separator className={styles.lightSectionSeparator} visible={showSeparator} />
    </div>
  )
}

function RoomLightOverviewCard({ group, onSelect }: { group: EntityGroupConfig; onSelect: (group: EntityGroupConfig) => void }) {
  const entityId = group.toggleEntityId ?? group.items[0]?.entityId ?? 'light.unavailable'

  return <LightCard ariaLabel={`Open ${group.title}`} entityId={entityId} onClick={() => onSelect(group)} title={roomTitleFromLightGroup(group)} />
}

function roomLightToggleIcon(group: EntityGroupConfig, active: boolean) {
  if (group.items.length > 1) return active ? 'mdi:lightbulb-multiple' : 'mdi:lightbulb-multiple-off'
  return active ? 'mdi:lightbulb' : 'mdi:lightbulb-off'
}

function RoomLightDetailHeader({ group, hideTitleBlock = false, onBack, onToggle }: { group: EntityGroupConfig; hideTitleBlock?: boolean; onBack?: () => void; onToggle: (entityId: string) => void }) {
  const groupToggleEntityId = group.toggleEntityId
  const groupEntity = useEntity(asEntityName(groupToggleEntityId ?? 'light.unavailable'), { returnNullIfNotFound: true })
  const groupActive = isActiveState(groupEntity)
  const itemActive = useHass((state) => {
    let foundItemEntity = false
    let foundActiveItem = false
    group.items.forEach((item) => {
      const entity = state.entities[item.entityId] as HassEntity | undefined
      if (!entity) return
      foundItemEntity = true
      if (isActiveState(entity)) foundActiveItem = true
    })
    return foundItemEntity ? foundActiveItem : undefined
  })
  const toggleActive = itemActive ?? groupActive
  const toggleIcon = roomLightToggleIcon(group, toggleActive)
  const groupState = formatCompactEntityState(groupEntity, 'Off')
  const roomTitle = roomTitleFromLightGroup(group)
  const separatorLabel = group.items.length === 1 ? 'Light' : 'Lights'

  return (
    <div className={styles.roomLightHeader} data-title-hidden={hideTitleBlock} style={buildStaggerStyle(30)}>
      {onBack && (
        <button aria-label="Back to room lights" className={styles.lightBackButton} onClick={onBack} type="button">
          <MaterialIcon name="mdi:chevron-left" size={22} />
        </button>
      )}
      {!hideTitleBlock && (
        <div className={styles.roomLightTitleBlock}>
          <h3>{roomTitle} Lights</h3>
          <p>{groupState}</p>
        </div>
      )}
      {groupToggleEntityId && (
        <div className={styles.roomLightSeparatorBlock}>
          {hideTitleBlock && <h3 className={styles.lightSectionLabel}>{separatorLabel}</h3>}
          <Separator className={styles.roomLightSeparator} />
        </div>
      )}
      {groupToggleEntityId && (
        <button aria-label={`Toggle ${roomTitle} lights`} className={styles.roomLightToggle} data-active={toggleActive} onClick={() => onToggle(groupToggleEntityId)} type="button">
          <MaterialIcon name={toggleIcon} size={22} />
        </button>
      )}
    </div>
  )
}

function RoomLightDetailCards({ group, onToggle }: { group: EntityGroupConfig; onToggle: (entityId: string) => void }) {
  return (
    <section className={styles.roomLightDetail}>
      <div className={styles.roomLightGrid}>
        {group.items.map((item, index) => (
          <div className={styles.roomLightCardShell} key={item.entityId} style={buildStaggerStyle(staggerMs(index, 42, 92))}>
            <LightCard entityId={item.entityId} onClick={() => onToggle(item.entityId)} pressed size="compact" title={item.title} />
          </div>
        ))}
      </div>
    </section>
  )
}

export function LightsSheet({ directGroup, hideDirectTitle = false }: { directGroup?: EntityGroupConfig; hideDirectTitle?: boolean } = {}) {
  const callService = useHass((state) => state.helpers.callService)
  const [selectedGroup, setSelectedGroup] = useState<EntityGroupConfig | null>(directGroup ?? null)
  const [roomCardsExiting, setRoomCardsExiting] = useState(false)
  const transitionTimer = useRef<number | null>(null)
  const roomGroups = ROOM_LIGHT_GROUPS
  const directMode = Boolean(directGroup)

  useEffect(() => {
    return () => {
      if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
    }
  }, [])

  const toggleEntity = (entityId: string) => {
    callService({ domain: 'homeassistant', service: 'toggle', target: entityId })
  }

  const selectGroup = (group: EntityGroupConfig) => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
    setRoomCardsExiting(true)
    transitionTimer.current = window.setTimeout(() => {
      setSelectedGroup(group)
      setRoomCardsExiting(false)
      transitionTimer.current = null
    }, 190)
  }

  const showRoomOverview = () => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
    transitionTimer.current = null
    setRoomCardsExiting(false)
    setSelectedGroup(null)
  }

  return (
    <div className={styles.lightsSheet}>
      {selectedGroup ? <RoomLightDetailHeader group={selectedGroup} hideTitleBlock={directMode && hideDirectTitle} onBack={directMode ? undefined : showRoomOverview} onToggle={toggleEntity} /> : <RoomsHeader />}
      <div className={styles.lightContent}>
        {selectedGroup ? (
          <RoomLightDetailCards group={selectedGroup} onToggle={toggleEntity} />
        ) : (
          <section className={styles.roomLightsOverview} data-exiting={roomCardsExiting}>
            <div className={styles.roomLightGrid}>
              {roomGroups.map((group, index) => (
                <div className={styles.roomLightCardShell} key={group.title} style={roomCardsExiting ? undefined : buildStaggerStyle(staggerMs(index, 38, 76))}>
                  <RoomLightOverviewCard group={group} onSelect={selectGroup} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function RoomClimateOverviewCard({ group, onSelect }: { group: EntityGroupConfig; onSelect: (group: EntityGroupConfig) => void }) {
  const rangeEntity = useEntity(asEntityName(group.rangeEntityId ?? 'input_text.unavailable'), { returnNullIfNotFound: true })
  const fallbackSubtitle = useHass((state) => climateGroupSubtitle(group, state.entities))
  const subtitle = normalizeClimateRangeText(rangeEntity?.state) ?? fallbackSubtitle
  const roomTitle = climateRoomTitle(group)

  return (
    <ClimateCard
      ariaLabel={`Open ${group.title}`}
      color={climateGroupColor(group)}
      colorEntityId={group.colorEntityId}
      icon={<Icon name={climateGroupIcon(group)} size={42} />}
      onClick={() => onSelect(group)}
      subtitle={subtitle}
      title={roomTitle}
    />
  )
}

function RoomClimateDetailHeader({ group, onBack }: { group: EntityGroupConfig; onBack?: () => void }) {
  const rangeEntity = useEntity(asEntityName(group.rangeEntityId ?? 'input_text.unavailable'), { returnNullIfNotFound: true })
  const fallbackSubtitle = useHass((state) => climateGroupSubtitle(group, state.entities))
  const subtitle = normalizeClimateRangeText(rangeEntity?.state) ?? fallbackSubtitle
  const roomTitle = climateRoomTitle(group)

  return (
    <div className={styles.roomClimateHeader} style={buildStaggerStyle(30)}>
      {onBack && (
        <button aria-label="Back to room climates" className={styles.lightBackButton} onClick={onBack} type="button">
          <MaterialIcon name="mdi:chevron-left" size={22} />
        </button>
      )}
      <div className={styles.roomLightTitleBlock}>
        <h3>{roomTitle} Climate</h3>
        <p>{subtitle}</p>
      </div>
      <Separator className={styles.roomLightSeparator} visible={false} />
    </div>
  )
}

function RoomClimateDetailCards({ group }: { group: EntityGroupConfig }) {
  const color = climateGroupColor(group)
  const temperatureItems = group.items.filter((item) => !isVentClimateItem(item.entityId))
  const ventItems = group.items.filter((item) => isVentClimateItem(item.entityId))

  const renderCards = (items: EntityGroupConfig['items'], indexOffset: number) => (
    <div className={styles.roomClimateGrid}>
      {items.map((item, index) => (
        <div className={styles.roomLightCardShell} key={item.entityId} style={buildStaggerStyle(staggerMs(index + indexOffset, 42, 92))}>
          <ClimateCard color={color} colorEntityId={item.colorEntityId} entityId={item.entityId} icon={climateItemIcon(item.entityId)} size="compact" title={item.title} />
        </div>
      ))}
    </div>
  )

  return (
    <section className={styles.roomClimateDetail}>
      <div className={styles.roomClimateDetailContent}>
        {temperatureItems.length > 0 && (
          <section className={styles.roomClimateDetailSection}>
            <div className={styles.lightSectionHeader}>
              <h3 className={styles.lightSectionLabel}>{temperatureItems.length === 1 ? 'Temperature Sensor' : 'Temperature Sensors'}</h3>
              <Separator className={styles.lightSectionSeparator} />
            </div>
            {renderCards(temperatureItems, 0)}
          </section>
        )}
        {ventItems.length > 0 && (
          <section className={styles.roomClimateDetailSection}>
            <div className={styles.lightSectionHeader}>
              <h3 className={styles.lightSectionLabel}>{climateVentSectionTitle(ventItems)}</h3>
              <Separator className={styles.lightSectionSeparator} />
            </div>
            {renderCards(ventItems, temperatureItems.length)}
          </section>
        )}
      </div>
    </section>
  )
}

export function ClimateSheet({ directGroup, hideDirectHeader = false }: { directGroup?: EntityGroupConfig; hideDirectHeader?: boolean } = {}) {
  const [selectedGroup, setSelectedGroup] = useState<EntityGroupConfig | null>(directGroup ?? null)
  const [roomCardsExiting, setRoomCardsExiting] = useState(false)
  const transitionTimer = useRef<number | null>(null)
  const roomGroups = ROOM_CLIMATE_GROUPS
  const directMode = Boolean(directGroup)

  useEffect(() => {
    return () => {
      if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
    }
  }, [])

  const selectGroup = (group: EntityGroupConfig) => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
    setRoomCardsExiting(true)
    transitionTimer.current = window.setTimeout(() => {
      setSelectedGroup(group)
      setRoomCardsExiting(false)
      transitionTimer.current = null
    }, 190)
  }

  const showRoomOverview = () => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
    transitionTimer.current = null
    setRoomCardsExiting(false)
    setSelectedGroup(null)
  }

  return (
    <div className={styles.climateSheet}>
      {selectedGroup ? (!hideDirectHeader && <RoomClimateDetailHeader group={selectedGroup} onBack={directMode ? undefined : showRoomOverview} />) : <RoomsHeader />}
      <div className={styles.climateContent}>
        {selectedGroup ? (
          <RoomClimateDetailCards group={selectedGroup} />
        ) : (
          <section className={styles.roomClimateOverview} data-exiting={roomCardsExiting}>
            <div className={styles.roomClimateGrid}>
              {roomGroups.map((group, index) => (
                <div className={styles.roomLightCardShell} key={group.title} style={roomCardsExiting ? undefined : buildStaggerStyle(staggerMs(index, 38, 76))}>
                  <RoomClimateOverviewCard group={group} onSelect={selectGroup} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function RoomOccupancyOverviewCard({ group, onSelect }: { group: EntityGroupConfig; onSelect: (group: EntityGroupConfig) => void }) {
  const active = useHass((state) => occupancyGroupActiveCount(group, state.entities) > 0)
  const subtitle = useHass((state) => occupancyGroupSubtitle(group, state.entities))
  const roomTitle = occupancyRoomTitle(group)

  return (
    <OccupancyCard
      active={active}
      ariaLabel={`Open ${group.title}`}
      color={occupancyGroupColor(group)}
      onClick={() => onSelect(group)}
      subtitle={subtitle}
      title={roomTitle}
    />
  )
}

function RoomOccupancyDetailHeader({ group, onBack }: { group: EntityGroupConfig; onBack?: () => void }) {
  const subtitle = useHass((state) => occupancyGroupSensorSubtitle(group, state.entities))
  const roomTitle = occupancyRoomTitle(group)

  return (
    <div className={styles.roomOccupancyHeader} style={buildStaggerStyle(30)}>
      {onBack && (
        <button aria-label="Back to room occupancy" className={styles.lightBackButton} onClick={onBack} type="button">
          <MaterialIcon name="mdi:chevron-left" size={22} />
        </button>
      )}
      <div className={styles.roomLightTitleBlock}>
        <h3>{roomTitle} Occupancy</h3>
        <p>{subtitle}</p>
      </div>
      <Separator className={styles.roomLightSeparator} visible={false} />
    </div>
  )
}

function RoomOccupancyDetailCards({ group, indexOffset = 0 }: { group: EntityGroupConfig; indexOffset?: number }) {
  const color = occupancyGroupColor(group)

  return (
    <section className={styles.roomOccupancyDetail}>
      <div className={styles.roomOccupancyGrid}>
        {group.items.map((item, index) => (
          <div className={styles.roomLightCardShell} key={item.entityId} style={buildStaggerStyle(staggerMs(index + indexOffset, 42, 92))}>
            <OccupancyCard color={color} entityId={item.entityId} size="source-row" title={item.title} />
          </div>
        ))}
      </div>
    </section>
  )
}

export function OccupancySheet({ directGroup, hideDirectHeader = false }: { directGroup?: EntityGroupConfig; hideDirectHeader?: boolean } = {}) {
  const [selectedGroup, setSelectedGroup] = useState<EntityGroupConfig | null>(directGroup ?? null)
  const [roomCardsExiting, setRoomCardsExiting] = useState(false)
  const transitionTimer = useRef<number | null>(null)
  const roomGroups = ROOM_OCCUPANCY_GROUPS
  const directMode = Boolean(directGroup)

  useEffect(() => {
    return () => {
      if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
    }
  }, [])

  const selectGroup = (group: EntityGroupConfig) => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
    setRoomCardsExiting(true)
    transitionTimer.current = window.setTimeout(() => {
      setSelectedGroup(group)
      setRoomCardsExiting(false)
      transitionTimer.current = null
    }, 190)
  }

  const showRoomOverview = () => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
    transitionTimer.current = null
    setRoomCardsExiting(false)
    setSelectedGroup(null)
  }

  return (
    <div className={styles.occupancySheet}>
      {selectedGroup ? (!hideDirectHeader && <RoomOccupancyDetailHeader group={selectedGroup} onBack={directMode ? undefined : showRoomOverview} />) : <RoomsHeader />}
      <div className={styles.occupancyContent}>
        {selectedGroup ? (
          <RoomOccupancyDetailCards group={selectedGroup} />
        ) : (
          <section className={styles.roomOccupancyOverview} data-exiting={roomCardsExiting}>
            <div className={styles.roomOccupancyGrid}>
              {roomGroups.map((group, index) => (
                <div className={styles.roomLightCardShell} key={group.title} style={roomCardsExiting ? undefined : buildStaggerStyle(staggerMs(index, 38, 76))}>
                  <RoomOccupancyOverviewCard group={group} onSelect={selectGroup} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function RoomContactOverviewCard({ group, onSelect }: { group: EntityGroupConfig; onSelect: (group: EntityGroupConfig) => void }) {
  const active = useHass((state) => contactGroupOpenCount(group, state.entities) > 0)
  const subtitle = useHass((state) => contactGroupSubtitle(group, state.entities))
  const roomTitle = contactRoomTitle(group)

  return (
    <ContactSensorCard
      active={active}
      ariaLabel={`Open ${group.title}`}
      color={contactGroupColor(group)}
      kind={contactGroupKind(group)}
      onClick={() => onSelect(group)}
      subtitle={subtitle}
      title={roomTitle}
    />
  )
}

function RoomContactDetailHeader({ group, onBack }: { group: EntityGroupConfig; onBack?: () => void }) {
  const subtitle = useHass((state) => contactGroupSensorSubtitle(group, state.entities))
  const roomTitle = contactRoomTitle(group)

  return (
    <div className={styles.roomContactHeader} style={buildStaggerStyle(30)}>
      {onBack && (
        <button aria-label="Back to room contact sensors" className={styles.lightBackButton} onClick={onBack} type="button">
          <MaterialIcon name="mdi:chevron-left" size={22} />
        </button>
      )}
      <div className={styles.roomLightTitleBlock}>
        <h3>{roomTitle} Contact Sensors</h3>
        <p>{subtitle}</p>
      </div>
      <Separator className={styles.roomLightSeparator} visible={false} />
    </div>
  )
}

function RoomContactDetailCards({ group, indexOffset = 0, size = 'bubble' }: { group: EntityGroupConfig; indexOffset?: number; size?: 'bubble' | 'source-row' }) {
  const color = contactGroupColor(group)

  return (
    <section className={styles.roomContactDetail}>
      <div className={styles.roomContactGrid}>
        {group.items.map((item, index) => (
          <div className={styles.roomLightCardShell} key={item.entityId} style={buildStaggerStyle(staggerMs(index + indexOffset, 42, 92))}>
            <ContactSensorCard color={color} entityId={item.entityId} size={size} title={item.title} />
          </div>
        ))}
      </div>
    </section>
  )
}

function RoomContactSection({ group, indexOffset = 0 }: { group: EntityGroupConfig; indexOffset?: number }) {
  return (
    <section className={styles.roomStateSection}>
      <div className={styles.lightSectionHeader}>
        <h3 className={styles.lightSectionLabel}>{contactRoomTitle(group)}</h3>
        <Separator className={styles.lightSectionSeparator} />
      </div>
      <RoomContactDetailCards group={group} indexOffset={indexOffset} />
    </section>
  )
}

function groupsWithIndexOffsets(groups: EntityGroupConfig[]) {
  return groups.map((group, index) => ({
    group,
    indexOffset: groups.slice(0, index).reduce((total, previousGroup) => total + previousGroup.items.length, 0),
  }))
}

export function ContactSheet({ directGroup, hideDirectHeader = false, overviewMode = 'rooms' }: { directGroup?: EntityGroupConfig; hideDirectHeader?: boolean; overviewMode?: 'grouped' | 'rooms' } = {}) {
  const [selectedGroup, setSelectedGroup] = useState<EntityGroupConfig | null>(directGroup ?? null)
  const [roomCardsExiting, setRoomCardsExiting] = useState(false)
  const transitionTimer = useRef<number | null>(null)
  const roomGroups = ROOM_CONTACT_GROUPS
  const directMode = Boolean(directGroup)

  useEffect(() => {
    return () => {
      if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
    }
  }, [])

  const selectGroup = (group: EntityGroupConfig) => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
    setRoomCardsExiting(true)
    transitionTimer.current = window.setTimeout(() => {
      setSelectedGroup(group)
      setRoomCardsExiting(false)
      transitionTimer.current = null
    }, 190)
  }

  const showRoomOverview = () => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
    transitionTimer.current = null
    setRoomCardsExiting(false)
    setSelectedGroup(null)
  }

  if (!directGroup && overviewMode === 'grouped') {
    return (
      <div className={styles.contactSheet}>
        <div className={styles.contactContent}>
          <section className={styles.roomContactOverview}>
            <div className={styles.roomStateStack}>
              {groupsWithIndexOffsets(roomGroups).map(({ group, indexOffset }) => <RoomContactSection group={group} indexOffset={indexOffset} key={group.title} />)}
            </div>
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.contactSheet}>
      {selectedGroup ? (!hideDirectHeader && <RoomContactDetailHeader group={selectedGroup} onBack={directMode ? undefined : showRoomOverview} />) : <RoomsHeader />}
      <div className={styles.contactContent}>
        {selectedGroup ? (
          <RoomContactDetailCards group={selectedGroup} size={directMode ? 'source-row' : 'bubble'} />
        ) : (
          <section className={styles.roomContactOverview} data-exiting={roomCardsExiting}>
            <div className={styles.roomContactGrid}>
              {roomGroups.map((group, index) => (
                <div className={styles.roomLightCardShell} key={group.title} style={roomCardsExiting ? undefined : buildStaggerStyle(staggerMs(index, 38, 76))}>
                  <RoomContactOverviewCard group={group} onSelect={selectGroup} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function airQualityRoomArea(room: AirQualityRoomConfig, colorEntity: HassEntity | null | undefined): AreaConfig {
  const baseArea = areaForTitle(room.title)

  return {
    color: parseCssColor(colorEntity?.state) ?? { r: 0, g: 150, b: 136 },
    icon: 'mdi:blur',
    route: baseArea?.route ?? '/overview',
    title: room.title,
  }
}

function RoomAirQualityOverviewCard({ room }: { room: AirQualityRoomConfig }) {
  const aqiEntity = useEntity(asEntityName(room.aqiEntityId), { returnNullIfNotFound: true })
  const colorEntity = useEntity(asEntityName(room.colorEntityId), { returnNullIfNotFound: true })
  const pm25Entity = useEntity(asEntityName(room.pm25EntityId), { returnNullIfNotFound: true })
  const aqiRow = formatAirMetricState(aqiEntity)
  const pm25Row = formatAirMetricState(pm25Entity)

  return (
    <RoomCard
      area={airQualityRoomArea(room, colorEntity)}
      ariaLabel={`${room.title} AQI ${aqiRow} PM2.5 ${pm25Row}`}
      subtitle={`${aqiRow} • ${pm25Row}`}
    />
  )
}

export function AirQualitySheet() {
  return (
    <div className={styles.airQualitySheet}>
      <RoomsHeader />
      <div className={styles.airQualityContent}>
        <section className={styles.roomAirQualityOverview}>
          <div className={styles.roomAirQualityGrid}>
            {ROOM_AIR_QUALITY_GROUPS.map((room, index) => (
              <div className={styles.roomLightCardShell} key={room.title} style={buildStaggerStyle(staggerMs(index, 38, 76))}>
                <RoomAirQualityOverviewCard room={room} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function SheetContent({ hash }: { hash: string }) {
  if (hash === '#lights-overview') {
    return <LightsSheet />
  }

  if (hash === '#climate-overview') {
    return <ClimateSheet />
  }

  if (hash === '#occupancy-overview') {
    return <OccupancySheet />
  }

  if (hash === '#contact-sensors-overview') {
    return <ContactSheet />
  }

  if (hash === '#aqi-overview') {
    return <AirQualitySheet />
  }

  if (hash === '#security-system') return <SecurityControls />

  if (CAMERA_ITEMS.some((item) => item.hash === hash)) return <CameraSheet hash={hash} key={hash} />

  return <p className={styles.sheetText}>This section is represented in the Home Assistant dashboard and is queued for the next recreation pass.</p>
}

interface AtAGlancePageProps {
  activePath?: string
  onNavigate?: (path: string) => void
}

export function AtAGlancePage({ activePath = 'overview', onNavigate = () => undefined }: AtAGlancePageProps) {
  const { hash, openHash, closeHash } = useHashModal()
  const activeRoomLightCount = useHass((state) =>
    ROOM_LIGHT_ENTITY_IDS.reduce((count, entityId) => count + (isActiveState(state.entities[entityId] ?? null) ? 1 : 0), 0),
  )
  const activeContactSensorCount = useHass((state) =>
    ROOM_CONTACT_ENTITY_IDS.reduce((count, entityId) => count + (isContactOpen(state.entities[entityId]) ? 1 : 0), 0),
  )
  const airQualityStatusSubtitle = useHass((state) => {
    const aqiRange = formatCompactEntityState(state.entities['input_text.all_aqi_range'] ?? null)
    const pm25Range = formatCompactEntityState(state.entities['input_text.all_pm25_range'] ?? null)
    return `AQI ${aqiRange} · PM2.5 ${pm25Range}`
  })
  const lightStatusSubtitle = lightCountSubtitle(activeRoomLightCount)
  const contactStatusSubtitle = contactSensorActiveSubtitle(activeContactSensorCount)
  const modalTitle = hash === '#lights-overview' ? lightsSheetTitle(activeRoomLightCount) : sheetTitle(hash)

  return (
    <AppShell bottomNav={<BottomNav activePath={activePath} onNavigate={onNavigate} />}>
      <Page
        activePath={activePath}
        title="Home"
        onNavigate={onNavigate}
        onSettings={() => openHash('#settings-preview')}
        headerQuickLinks={
          <StatusRail
            chips={OVERVIEW_STATUS_CHIPS}
            onOpenHash={openHash}
            subtitleByHash={{ '#aqi-overview': airQualityStatusSubtitle, '#contact-sensors-overview': contactStatusSubtitle, '#lights-overview': lightStatusSubtitle }}
          />
        }
      >
        <div className={styles.weatherWrap} style={buildStaggerStyle(120)}>
          <WeatherSummary />
        </div>

        <SectionHeader title="Quick Links" />
        <section className={styles.quickGrid}>
          {QUICK_ACCESS_ITEMS.map((item, index) => (
            <div key={item.title} style={buildStaggerStyle(staggerMs(index, 42, 70))}>
              <QuickAccessTile item={item} onNavigate={onNavigate} onOpenHash={openHash} />
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
              <RoomCard area={area} onNavigate={onNavigate} />
            </div>
          ))}
        </section>
      </Page>

      <ModalSheet open={hash !== ''} title={modalTitle} onClose={closeHash}>
        <SheetContent hash={hash} />
      </ModalSheet>
    </AppShell>
  )
}
