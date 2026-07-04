import { useEntity, useHass } from '@hakit/core'
import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import type { HassEntity } from 'home-assistant-js-websocket'
import { ClimateCard } from '../components/cards/ClimateCard'
import { ContactSensorCard } from '../components/cards/ContactSensorCard'
import { LightCard } from '../components/cards/LightCard'
import { OccupancyCard } from '../components/cards/OccupancyCard'
import { RoomCard } from '../components/cards/RoomCard'
import { AppShell } from '../components/shell/AppShell'
import { BottomNav } from '../components/shell/BottomNav'
import { DashboardPageLoading, type DashboardPageLoadingPhase } from '../components/shell/DashboardPageLoading'
import { ActionPill } from '../components/core/ActionPill'
import { FloatingActionButton } from '../components/core/FloatingActionButton'
import { GlassTile } from '../components/core/GlassTile'
import { Icon, MaterialIcon } from '../components/core/Icon'
import { ModalSheet } from '../components/core/ModalSheet'
import { Separator } from '../components/core/Separator'
import { SectionHeader } from '../components/core/SectionHeader'
import { CameraTile } from '../components/hass/CameraTile'
import { SecurityControls } from '../components/hass/SecurityControls'
import { SECURITY_SYSTEM_MODAL_STYLE, securitySystemModalSubtitle } from '../components/hass/securityControlsConfig'
import { GuestPresenceSecurityModalContent, GuestPresenceSecuritySection, GUEST_PRESENCE_SECURITY_HASH } from '../components/hass/GuestPresenceSecurity'
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
  SECURITY_ENTITY,
  type AirQualityRoomConfig,
  type AreaConfig,
  type EntityGroupConfig,
  type QuickAccessConfig,
} from '../constants/atAGlance'
import { CHORE_BLUE, CHORE_QUICK_LINKS, SETTINGS_PAGE_ITEMS, TODO_PAGES, type ChoreQuickLinkConfig, type SettingsLinkConfig } from '../constants/portedDashboard'
import { useHashModal } from '../hooks/useHashModal'
import { markDeferredRouteHydrated, useDeferredRouteHydration, type DeferredRouteHydrationPhase } from '../hooks/useDeferredRouteHydration'
import type { RouteTransitionState } from '../components/shell/SmoothRouteOutlet'
import { modalSquareGridModalStyle, modalSquareGridModalStyleForHash, modalSquareGridStyle, useModalSquareGridLayout, type ModalSquareGridStyle } from './modalSquareGrid'
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
  [GUEST_PRESENCE_SECURITY_HASH]: 'Guest Presence Security',
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

function squareGridClassName(baseClassName: string, squareOverview: boolean) {
  return [baseClassName, squareOverview ? styles.modalSquareGrid : ''].filter(Boolean).join(' ')
}

function squareGridCellClassName(squareOverview: boolean) {
  return [styles.roomLightCardShell, squareOverview ? styles.modalSquareCell : ''].filter(Boolean).join(' ')
}

function immediateSelectGroup(
  group: EntityGroupConfig,
  transitionTimer: MutableRefObject<number | null>,
  setRoomCardsExiting: (exiting: boolean) => void,
  setSelectedGroup: (group: EntityGroupConfig) => void,
) {
  if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
  transitionTimer.current = null
  setRoomCardsExiting(false)
  setSelectedGroup(group)
}
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

function lightGroupActiveCount(group: EntityGroupConfig, entities: Record<string, HassEntity | undefined>) {
  return group.items.reduce((count, item) => count + (isActiveState(entities[item.entityId] ?? null) ? 1 : 0), 0)
}

function lightGroupActive(group: EntityGroupConfig, entities: Record<string, HassEntity | undefined>) {
  const toggleActive = group.toggleEntityId ? isActiveState(entities[group.toggleEntityId] ?? null) : false
  return toggleActive || lightGroupActiveCount(group, entities) > 0
}

function lightGroupSubtitle(group: EntityGroupConfig, entities: Record<string, HassEntity | undefined>) {
  const activeItemCount = lightGroupActiveCount(group, entities)
  if (activeItemCount > 0) return group.items.length === 1 ? 'On' : `${activeItemCount} On`

  const toggleEntity = group.toggleEntityId ? entities[group.toggleEntityId] ?? null : null
  return formatCompactEntityState(toggleEntity, 'Off')
}

function splitRoomGroupsByState(
  groups: EntityGroupConfig[],
  entities: Record<string, HassEntity | undefined>,
  isGroupActive: (group: EntityGroupConfig, entities: Record<string, HassEntity | undefined>) => boolean,
) {
  return groups.reduce(
    (sections, group) => {
      sections[isGroupActive(group, entities) ? 'active' : 'inactive'].push(group)
      return sections
    },
    { active: [] as EntityGroupConfig[], inactive: [] as EntityGroupConfig[] },
  )
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

function contactSensorStatusSubtitle(openCount: number) {
  return openCount > 0 ? `${openCount} Open` : 'All Closed'
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

function todoCountForChoreLink(item: ChoreQuickLinkConfig, entities: Record<string, HassEntity | undefined>) {
  const page = TODO_PAGES[item.path]
  if (!page) return 0
  return page.lists.reduce((total, list) => {
    const value = Number(entities[list.entityId]?.state ?? 0)
    return total + (Number.isFinite(value) && value > 0 ? value : 0)
  }, 0)
}

function taskCountSubtitle(count: number) {
  if (!Number.isFinite(count) || count <= 0) return 'No active tasks'
  if (count === 1) return '1 active task'
  return `${count} active tasks`
}

function groceryCountSubtitle(count: number) {
  if (!Number.isFinite(count) || count <= 0) return 'No groceries listed'
  if (count === 1) return '1 item'
  return `${count} items`
}

function ChorePreviewTile({ closeHash, item, onNavigate }: { closeHash: () => void; item: ChoreQuickLinkConfig; onNavigate: (path: string) => void }) {
  const entities = useHass((state) => state.entities)
  const count = todoCountForChoreLink(item, entities)
  const subtitle = item.countType === 'groceries' ? groceryCountSubtitle(count) : taskCountSubtitle(count)

  const openPage = () => {
    closeHash()
    onNavigate(item.path)
  }

  return (
    <GlassTile
      backgroundColor={`rgba(${item.color.r}, ${item.color.g}, ${item.color.b}, 0.72)`}
      icon={item.icon}
      onClick={openPage}
      subtitle={subtitle}
      title={item.title}
    />
  )
}

function ChoresPreviewSheet({ closeHash, onNavigate }: { closeHash: () => void; onNavigate: (path: string) => void }) {
  return (
    <div className={styles.previewSheet}>
      <p className={styles.sheetText}>Open groceries, personal chores, unassigned tasks, or home projects.</p>
      <div className={styles.previewGrid}>
        {CHORE_QUICK_LINKS.map((item) => <ChorePreviewTile closeHash={closeHash} item={item} key={item.path} onNavigate={onNavigate} />)}
      </div>
    </div>
  )
}

function navigateExternal(path: string) {
  try {
    const targetWindow = window.top && window.top !== window ? window.top : window
    targetWindow.location.assign(path)
  } catch {
    window.location.assign(path)
  }
}

function SettingsPreviewLink({ closeHash, item, onNavigate }: { closeHash: () => void; item: SettingsLinkConfig; onNavigate: (path: string) => void }) {
  const activate = () => {
    closeHash()
    if (item.path) onNavigate(item.path)
    else if (item.externalPath) navigateExternal(item.externalPath)
  }

  return (
    <button aria-label={`${item.title} ${item.subtitle}`} className={styles.previewLink} data-external-path={item.externalPath} data-navigation-path={item.path} onClick={activate} type="button">
      <span aria-hidden="true" className={styles.previewLinkIcon}>
        <MaterialIcon name={item.icon} size={28} />
      </span>
      <span className={styles.previewLinkCopy}>
        <strong>{item.title}</strong>
        <small>{item.subtitle}</small>
      </span>
      <MaterialIcon name="mdi:chevron-right" size={24} />
    </button>
  )
}

function SettingsPreviewSheet({ closeHash, onNavigate }: { closeHash: () => void; onNavigate: (path: string) => void }) {
  return (
    <nav aria-label="Settings pages" className={styles.previewList}>
      {SETTINGS_PAGE_ITEMS.map((item) => <SettingsPreviewLink closeHash={closeHash} item={item} key={item.title} onNavigate={onNavigate} />)}
    </nav>
  )
}

function CameraSheet({ hash, live = true }: { hash: string; live?: boolean }) {
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
        {live ? <WebRtcCamera camera={camera} controls minHeight={310} variant="modal" /> : <div style={{ minHeight: 310 }} />}
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

function RoomSectionHeader({ showSeparator = true, title }: { showSeparator?: boolean; title: string }) {
  return (
    <div className={styles.lightSectionHeader}>
      <h3 className={styles.lightSectionLabel}>{title}</h3>
      <Separator className={styles.lightSectionSeparator} visible={showSeparator} />
    </div>
  )
}

function RoomsHeader({ showSeparator = true }: { showSeparator?: boolean }) {
  return <RoomSectionHeader showSeparator={showSeparator} title="Rooms" />
}

interface GroupedRoomOverviewProps {
  activeGroups: EntityGroupConfig[]
  activeTitle: string
  cardShellClassName: string
  gridClassName: string
  inactiveGroups: EntityGroupConfig[]
  inactiveTitle: string
  overviewGridRef?: (node: HTMLElement | null) => void
  overviewGridStyle?: ModalSquareGridStyle
  renderCard: (group: EntityGroupConfig) => ReactNode
}

function groupedRoomGridStyle(overviewGridStyle: ModalSquareGridStyle | undefined, groupCount: number) {
  if (!overviewGridStyle) return undefined

  const columnCount = Number(overviewGridStyle['--modal-square-cols'])
  const sectionRows = Number.isFinite(columnCount) && columnCount > 0 ? Math.ceil(groupCount / columnCount) : overviewGridStyle['--modal-square-rows']
  return { ...overviewGridStyle, '--modal-square-rows': sectionRows }
}

function GroupedRoomOverview({ activeGroups, activeTitle, cardShellClassName, gridClassName, inactiveGroups, inactiveTitle, overviewGridRef, overviewGridStyle, renderCard }: GroupedRoomOverviewProps) {
  const sections = [
    ...(activeGroups.length > 0 ? [{ groups: activeGroups, title: activeTitle }] : []),
    ...(inactiveGroups.length > 0 ? [{ groups: inactiveGroups, title: inactiveTitle }] : []),
  ]

  return (
    <div className={styles.roomStateStack}>
      {sections.map((section, sectionIndex) => (
        <section aria-label={`${section.title} rooms`} className={styles.roomStateSection} key={section.title}>
          <RoomSectionHeader title={section.title} />
          <div className={gridClassName} ref={sectionIndex === 0 ? overviewGridRef : undefined} style={groupedRoomGridStyle(overviewGridStyle, section.groups.length)}>
            {section.groups.map((group) => (
              <div className={cardShellClassName} key={group.title}>
                {renderCard(group)}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function RoomLightOverviewCard({ group, onSelect }: { group: EntityGroupConfig; onSelect: (group: EntityGroupConfig) => void }) {
  const entityId = group.toggleEntityId ?? group.items[0]?.entityId ?? 'light.unavailable'
  const active = useHass((state) => lightGroupActive(group, state.entities))
  const subtitle = useHass((state) => lightGroupSubtitle(group, state.entities))

  return (
    <LightCard
      activeOverride={active}
      ariaLabel={`Open ${group.title}`}
      entityId={entityId}
      icon={group.items.length > 1 ? 'multi' : 'single'}
      onClick={() => onSelect(group)}
      subtitleOverride={subtitle}
      title={roomTitleFromLightGroup(group)}
    />
  )
}

function roomLightToggleIcon(group: EntityGroupConfig, active: boolean) {
  if (group.items.length > 1) return active ? 'mdi:lightbulb-multiple' : 'mdi:lightbulb-multiple-off'
  return active ? 'mdi:lightbulb' : 'mdi:lightbulb-off'
}

function RoomLightDetailHeader({ group, hideTitleBlock = false, onBack, onToggle }: { group: EntityGroupConfig; hideTitleBlock?: boolean; onBack?: () => void; onToggle: (entityId: string) => void }) {
  const groupToggleEntityId = group.toggleEntityId
  const toggleActive = useHass((state) => lightGroupActive(group, state.entities))
  const toggleIcon = roomLightToggleIcon(group, toggleActive)
  const groupState = useHass((state) => lightGroupSubtitle(group, state.entities))
  const roomTitle = roomTitleFromLightGroup(group)
  const separatorLabel = group.items.length === 1 ? 'Light' : 'Lights'

  return (
    <div className={styles.roomLightHeader} data-title-hidden={hideTitleBlock}>
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
        {group.items.map((item) => (
          <div className={styles.roomLightCardShell} key={item.entityId}>
            <LightCard entityId={item.entityId} onClick={() => onToggle(item.entityId)} pressed size="compact" title={item.title} />
          </div>
        ))}
      </div>
    </section>
  )
}

interface LightsSheetProps {
  directGroup?: EntityGroupConfig
  hideDirectTitle?: boolean
  overviewGridRef?: (node: HTMLElement | null) => void
  overviewGridStyle?: ModalSquareGridStyle
}

export function LightsSheet({ directGroup, hideDirectTitle = false, overviewGridRef, overviewGridStyle }: LightsSheetProps = {}) {
  const callService = useHass((state) => state.helpers.callService)
  const [selectedGroup, setSelectedGroup] = useState<EntityGroupConfig | null>(directGroup ?? null)
  const [roomCardsExiting, setRoomCardsExiting] = useState(false)
  const transitionTimer = useRef<number | null>(null)
  const roomGroups = ROOM_LIGHT_GROUPS
  const entities = useHass((state) => state.entities)
  const groupedRoomGroups = splitRoomGroupsByState(roomGroups, entities, lightGroupActive)
  const directMode = Boolean(directGroup)
  const squareOverview = !selectedGroup && Boolean(overviewGridStyle)
  const lightGridClassName = squareGridClassName(styles.roomLightGrid, squareOverview)
  const lightCardShellClassName = squareGridCellClassName(squareOverview)

  useEffect(() => {
    return () => {
      if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
    }
  }, [])

  const toggleEntity = (entityId: string) => {
    callService({ domain: 'homeassistant', service: 'toggle', target: entityId })
  }

  const selectGroup = (group: EntityGroupConfig) => {
    immediateSelectGroup(group, transitionTimer, setRoomCardsExiting, setSelectedGroup)
  }

  const showRoomOverview = () => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
    transitionTimer.current = null
    setRoomCardsExiting(false)
    setSelectedGroup(null)
  }

  return (
    <div className={styles.lightsSheet} data-square-overview="false">
      {selectedGroup && <RoomLightDetailHeader group={selectedGroup} hideTitleBlock={directMode && hideDirectTitle} onBack={directMode ? undefined : showRoomOverview} onToggle={toggleEntity} />}
      <div className={styles.lightContent}>
        {selectedGroup ? (
          <RoomLightDetailCards group={selectedGroup} onToggle={toggleEntity} />
        ) : (
          <section aria-label="Lights by room" className={styles.roomLightsOverview} data-exiting={roomCardsExiting}>
            <GroupedRoomOverview
              activeGroups={groupedRoomGroups.active}
              activeTitle="Lights On"
              cardShellClassName={lightCardShellClassName}
              gridClassName={lightGridClassName}
              inactiveGroups={groupedRoomGroups.inactive}
              inactiveTitle="Lights Off"
              overviewGridRef={overviewGridRef}
              overviewGridStyle={overviewGridStyle}
              renderCard={(group) => <RoomLightOverviewCard group={group} onSelect={selectGroup} />}
            />
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
    <div className={styles.roomClimateHeader}>
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

  const renderCards = (items: EntityGroupConfig['items']) => (
    <div className={styles.roomClimateGrid}>
      {items.map((item) => (
        <div className={styles.roomLightCardShell} key={item.entityId}>
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
            {renderCards(temperatureItems)}
          </section>
        )}
        {ventItems.length > 0 && (
          <section className={styles.roomClimateDetailSection}>
            <div className={styles.lightSectionHeader}>
              <h3 className={styles.lightSectionLabel}>{climateVentSectionTitle(ventItems)}</h3>
              <Separator className={styles.lightSectionSeparator} />
            </div>
            {renderCards(ventItems)}
          </section>
        )}
      </div>
    </section>
  )
}

interface RoomOverviewSheetProps {
  directGroup?: EntityGroupConfig
  hideDirectHeader?: boolean
  overviewGridRef?: (node: HTMLElement | null) => void
  overviewGridStyle?: ModalSquareGridStyle
}

export function ClimateSheet({ directGroup, hideDirectHeader = false, overviewGridRef, overviewGridStyle }: RoomOverviewSheetProps = {}) {
  const [selectedGroup, setSelectedGroup] = useState<EntityGroupConfig | null>(directGroup ?? null)
  const [roomCardsExiting, setRoomCardsExiting] = useState(false)
  const transitionTimer = useRef<number | null>(null)
  const roomGroups = ROOM_CLIMATE_GROUPS
  const directMode = Boolean(directGroup)
  const squareOverview = !selectedGroup && Boolean(overviewGridStyle)
  const climateGridClassName = squareGridClassName(styles.roomClimateGrid, squareOverview)
  const cardShellClassName = squareGridCellClassName(squareOverview)

  useEffect(() => {
    return () => {
      if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
    }
  }, [])

  const selectGroup = (group: EntityGroupConfig) => {
    immediateSelectGroup(group, transitionTimer, setRoomCardsExiting, setSelectedGroup)
  }

  const showRoomOverview = () => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
    transitionTimer.current = null
    setRoomCardsExiting(false)
    setSelectedGroup(null)
  }

  return (
    <div className={styles.climateSheet} data-square-overview={squareOverview ? 'true' : 'false'}>
      {selectedGroup ? (!hideDirectHeader && <RoomClimateDetailHeader group={selectedGroup} onBack={directMode ? undefined : showRoomOverview} />) : <RoomsHeader />}
      <div className={styles.climateContent}>
        {selectedGroup ? (
          <RoomClimateDetailCards group={selectedGroup} />
        ) : (
          <section aria-label="Climate by room" className={styles.roomClimateOverview} data-exiting={roomCardsExiting}>
            <div className={climateGridClassName} ref={overviewGridRef} style={overviewGridStyle}>
              {roomGroups.map((group) => (
                <div className={cardShellClassName} key={group.title}>
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
    <div className={styles.roomOccupancyHeader}>
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

function RoomOccupancyDetailCards({ group }: { group: EntityGroupConfig }) {
  const color = occupancyGroupColor(group)

  return (
    <section className={styles.roomOccupancyDetail}>
      <div className={styles.roomOccupancyGrid}>
        {group.items.map((item) => (
          <div className={styles.roomLightCardShell} key={item.entityId}>
            <OccupancyCard color={color} entityId={item.entityId} size="source-row" title={item.title} />
          </div>
        ))}
      </div>
    </section>
  )
}

export function OccupancySheet({ directGroup, hideDirectHeader = false, overviewGridRef, overviewGridStyle }: RoomOverviewSheetProps = {}) {
  const [selectedGroup, setSelectedGroup] = useState<EntityGroupConfig | null>(directGroup ?? null)
  const [roomCardsExiting, setRoomCardsExiting] = useState(false)
  const transitionTimer = useRef<number | null>(null)
  const roomGroups = ROOM_OCCUPANCY_GROUPS
  const entities = useHass((state) => state.entities)
  const groupedRoomGroups = splitRoomGroupsByState(roomGroups, entities, (group, entities) => occupancyGroupActiveCount(group, entities) > 0)
  const directMode = Boolean(directGroup)
  const squareOverview = !selectedGroup && Boolean(overviewGridStyle)
  const occupancyGridClassName = squareGridClassName(styles.roomOccupancyGrid, squareOverview)
  const cardShellClassName = squareGridCellClassName(squareOverview)

  useEffect(() => {
    return () => {
      if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
    }
  }, [])

  const selectGroup = (group: EntityGroupConfig) => {
    immediateSelectGroup(group, transitionTimer, setRoomCardsExiting, setSelectedGroup)
  }

  const showRoomOverview = () => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
    transitionTimer.current = null
    setRoomCardsExiting(false)
    setSelectedGroup(null)
  }

  return (
    <div className={styles.occupancySheet} data-square-overview="false">
      {selectedGroup && !hideDirectHeader && <RoomOccupancyDetailHeader group={selectedGroup} onBack={directMode ? undefined : showRoomOverview} />}
      <div className={styles.occupancyContent}>
        {selectedGroup ? (
          <RoomOccupancyDetailCards group={selectedGroup} />
        ) : (
          <section aria-label="Occupancy by room" className={styles.roomOccupancyOverview} data-exiting={roomCardsExiting}>
            <GroupedRoomOverview
              activeGroups={groupedRoomGroups.active}
              activeTitle="Occupied"
              cardShellClassName={cardShellClassName}
              gridClassName={occupancyGridClassName}
              inactiveGroups={groupedRoomGroups.inactive}
              inactiveTitle="Clear"
              overviewGridRef={overviewGridRef}
              overviewGridStyle={overviewGridStyle}
              renderCard={(group) => <RoomOccupancyOverviewCard group={group} onSelect={selectGroup} />}
            />
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
    <div className={styles.roomContactHeader}>
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

function RoomContactDetailCards({ group }: { group: EntityGroupConfig }) {
  const color = contactGroupColor(group)

  return (
    <section className={styles.roomContactDetail}>
      <div className={styles.roomContactGrid}>
        {group.items.map((item) => (
          <div className={styles.roomLightCardShell} key={item.entityId}>
            <ContactSensorCard color={color} entityId={item.entityId} size="source-row" title={item.title} />
          </div>
        ))}
      </div>
    </section>
  )
}

function RoomContactSection({ group }: { group: EntityGroupConfig }) {
  return (
    <section className={styles.roomStateSection}>
      <div className={styles.lightSectionHeader}>
        <h3 className={styles.lightSectionLabel}>{contactRoomTitle(group)}</h3>
        <Separator className={styles.lightSectionSeparator} />
      </div>
      <RoomContactDetailCards group={group} />
    </section>
  )
}

export function ContactSheet({
  directGroup,
  hideDirectHeader = false,
  overviewGridRef,
  overviewGridStyle,
  overviewMode = 'rooms',
}: RoomOverviewSheetProps & { overviewMode?: 'grouped' | 'rooms' } = {}) {
  const [selectedGroup, setSelectedGroup] = useState<EntityGroupConfig | null>(directGroup ?? null)
  const [roomCardsExiting, setRoomCardsExiting] = useState(false)
  const transitionTimer = useRef<number | null>(null)
  const roomGroups = ROOM_CONTACT_GROUPS
  const directMode = Boolean(directGroup)
  const squareOverview = overviewMode === 'rooms' && !selectedGroup && Boolean(overviewGridStyle)
  const contactGridClassName = squareGridClassName(styles.roomContactGrid, squareOverview)
  const cardShellClassName = squareGridCellClassName(squareOverview)

  useEffect(() => {
    return () => {
      if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
    }
  }, [])

  const selectGroup = (group: EntityGroupConfig) => {
    immediateSelectGroup(group, transitionTimer, setRoomCardsExiting, setSelectedGroup)
  }

  const showRoomOverview = () => {
    if (transitionTimer.current !== null) window.clearTimeout(transitionTimer.current)
    transitionTimer.current = null
    setRoomCardsExiting(false)
    setSelectedGroup(null)
  }

  if (!directGroup && overviewMode === 'grouped') {
    return (
      <div className={styles.contactSheet} data-square-overview={squareOverview ? 'true' : 'false'}>
        <div className={styles.contactContent}>
          <section className={styles.roomContactOverview}>
            <div className={styles.roomStateStack}>
              {roomGroups.map((group) => <RoomContactSection group={group} key={group.title} />)}
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
          <RoomContactDetailCards group={selectedGroup} />
        ) : (
          <section aria-label="Contact sensors by room" className={styles.roomContactOverview} data-exiting={roomCardsExiting}>
            <div className={contactGridClassName} ref={overviewGridRef} style={overviewGridStyle}>
              {roomGroups.map((group) => (
                <div className={cardShellClassName} key={group.title}>
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

interface AirQualitySheetProps {
  overviewGridRef?: (node: HTMLElement | null) => void
  overviewGridStyle?: ModalSquareGridStyle
}

export function AirQualitySheet({ overviewGridRef, overviewGridStyle }: AirQualitySheetProps = {}) {
  const squareOverview = Boolean(overviewGridStyle)
  const airQualityGridClassName = squareGridClassName(styles.roomAirQualityGrid, squareOverview)
  const cardShellClassName = squareGridCellClassName(squareOverview)

  return (
    <div className={styles.airQualitySheet} data-square-overview={squareOverview ? 'true' : 'false'}>
      <RoomsHeader />
      <div className={styles.airQualityContent}>
        <section aria-label="AQI by room" className={styles.roomAirQualityOverview}>
          <div className={airQualityGridClassName} ref={overviewGridRef} style={overviewGridStyle}>
            {ROOM_AIR_QUALITY_GROUPS.map((room) => (
              <div className={cardShellClassName} key={room.title}>
                <RoomAirQualityOverviewCard room={room} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function modalSquareGridCount(hash: string) {
  if (hash === '#lights-overview') return ROOM_LIGHT_GROUPS.length
  if (hash === '#climate-overview') return ROOM_CLIMATE_GROUPS.length
  if (hash === '#occupancy-overview') return ROOM_OCCUPANCY_GROUPS.length
  if (hash === '#contact-sensors-overview') return ROOM_CONTACT_GROUPS.length
  if (hash === '#aqi-overview') return ROOM_AIR_QUALITY_GROUPS.length
  return 0
}

function SheetContent({
  closeHash,
  hash,
  overviewGridRef,
  overviewGridStyle,
  onNavigate,
  preload = false,
}: {
  closeHash: () => void
  hash: string
  overviewGridRef?: (node: HTMLElement | null) => void
  overviewGridStyle?: ModalSquareGridStyle
  onNavigate: (path: string) => void
  preload?: boolean
}) {
  if (hash === '#lights-overview') {
    return <LightsSheet overviewGridRef={overviewGridRef} overviewGridStyle={overviewGridStyle} />
  }

  if (hash === '#climate-overview') {
    return <ClimateSheet overviewGridRef={overviewGridRef} overviewGridStyle={overviewGridStyle} />
  }

  if (hash === '#occupancy-overview') {
    return <OccupancySheet overviewGridRef={overviewGridRef} overviewGridStyle={overviewGridStyle} />
  }

  if (hash === '#contact-sensors-overview') {
    return <ContactSheet overviewGridRef={overviewGridRef} overviewGridStyle={overviewGridStyle} />
  }

  if (hash === '#aqi-overview') {
    return <AirQualitySheet overviewGridRef={overviewGridRef} overviewGridStyle={overviewGridStyle} />
  }

  if (hash === '#chores-preview') return <ChoresPreviewSheet closeHash={closeHash} onNavigate={onNavigate} />
  if (hash === '#settings-preview') return <SettingsPreviewSheet closeHash={closeHash} onNavigate={onNavigate} />
  if (hash === '#security-system') return <SecurityControls />
  if (hash === GUEST_PRESENCE_SECURITY_HASH) return <GuestPresenceSecurityModalContent />

  if (CAMERA_ITEMS.some((item) => item.hash === hash)) return <CameraSheet hash={hash} key={hash} live={!preload} />

  return <p className={styles.sheetText}>This overview section is not available from Home.</p>
}

export function RoomPickerButton({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [gridRef, gridLayout] = useModalSquareGridLayout(modalOpen, AREA_ITEMS.length)
  const modalStyle = modalSquareGridModalStyle(gridLayout)
  const gridStyle = modalSquareGridStyle(gridLayout)

  const handleNavigate = (path: string) => {
    setModalOpen(false)
    onNavigate(path)
  }

  return (
    <>
      <FloatingActionButton color={CHORE_BLUE} icon="mdi:floor-plan" label="Rooms" onClick={() => setModalOpen(true)} />
      <ModalSheet contentStyle={modalStyle} open={modalOpen} title="Rooms" onClose={() => setModalOpen(false)}>
        <section className={styles.roomPickerGrid} aria-label="Rooms" ref={gridRef} style={gridStyle}>
          {AREA_ITEMS.map((area) => (
            <div className={styles.roomPickerCell} key={area.title}>
              <RoomCard area={area} onNavigate={handleNavigate} />
            </div>
          ))}
        </section>
      </ModalSheet>
    </>
  )
}

interface AtAGlancePageProps {
  activePath?: string
  deferRouteContent?: boolean
  onHydrationPhaseChange?: (phase: DeferredRouteHydrationPhase) => void
  onNavigate?: (path: string) => void
  loadingPhase?: DashboardPageLoadingPhase
  preload?: boolean
  preloadHash?: string
  preloadHashes?: string[]
  routeTransitionState?: RouteTransitionState
  withShell?: boolean
}

export function AtAGlancePage({ activePath = 'overview', deferRouteContent = false, loadingPhase: routeLoadingPhase, onHydrationPhaseChange, onNavigate = () => undefined, preload = false, preloadHash, preloadHashes = [], routeTransitionState = 'idle', withShell = true }: AtAGlancePageProps) {
  const { hash, openHash, closeHash } = useHashModal({ disabled: preload })
  const { hydrateHeavyContent, loadingPhase: homeHydrationPhase, showContent } = useDeferredRouteHydration({
    cacheKey: 'home',
    enabled: deferRouteContent,
    transitionState: routeTransitionState,
  })
  const activeRoomLightCount = useHass((state) =>
    ROOM_LIGHT_ENTITY_IDS.reduce((count, entityId) => count + (isActiveState(state.entities[entityId] ?? null) ? 1 : 0), 0),
  )
  const openContactSensorCount = useHass((state) =>
    ROOM_CONTACT_ENTITY_IDS.reduce((count, entityId) => count + (isContactOpen(state.entities[entityId]) ? 1 : 0), 0),
  )
  const airQualityStatusSubtitle = useHass((state) => {
    const aqiRange = formatCompactEntityState(state.entities['input_text.all_aqi_range'] ?? null)
    const pm25Range = formatCompactEntityState(state.entities['input_text.all_pm25_range'] ?? null)
    return `AQI ${aqiRange} · PM2.5 ${pm25Range}`
  })
  const securitySystemSubtitle = useHass((state) => securitySystemModalSubtitle(state.entities[SECURITY_ENTITY]?.state))
  const contentHash = hash || preloadHash || ''
  const squareGridModalCount = modalSquareGridCount(contentHash)
  const squareGridModalOpen = squareGridModalCount > 0
  const [overviewGridRef, overviewGridLayout] = useModalSquareGridLayout(squareGridModalOpen, squareGridModalCount)
  const lightStatusSubtitle = lightCountSubtitle(activeRoomLightCount)
  const contactStatusSubtitle = contactSensorStatusSubtitle(openContactSensorCount)
  const modalTitle = contentHash === '#lights-overview' ? lightsSheetTitle(activeRoomLightCount) : sheetTitle(contentHash)
  const squareGridModalStyle = modalSquareGridModalStyleForHash(contentHash, overviewGridLayout)
  const squareGridStyle = modalSquareGridStyle(overviewGridLayout)
  const sheetStyle = contentHash === '#security-system' ? SECURITY_SYSTEM_MODAL_STYLE : squareGridModalOpen ? squareGridModalStyle : undefined
  const sheetSubtitle = contentHash === '#security-system' ? securitySystemSubtitle : undefined
  const preloadModalHashes = useMemo(() => [...new Set(preloadHashes.filter((targetHash) => targetHash !== contentHash))], [contentHash, preloadHashes])
  const homeLoadingPhase: DashboardPageLoadingPhase | undefined = showContent ? undefined : homeHydrationPhase === 'loading-exiting' ? 'exiting' : 'loading'
  const activeLoadingPhase = routeLoadingPhase ?? homeLoadingPhase

  useEffect(() => {
    onHydrationPhaseChange?.(homeHydrationPhase)
  }, [homeHydrationPhase, onHydrationPhaseChange])

  useEffect(() => {
    if (preload) markDeferredRouteHydrated('home')
  }, [preload])

  const page = (
    <>
      <Page
        activePath={activePath}
        chromeHidden={Boolean(activeLoadingPhase)}
        title="Home"
        onNavigate={onNavigate}
        headerQuickLinks={
          <StatusRail
            chips={OVERVIEW_STATUS_CHIPS}
            onOpenHash={openHash}
            subtitleByHash={{ '#aqi-overview': airQualityStatusSubtitle, '#contact-sensors-overview': contactStatusSubtitle, '#lights-overview': lightStatusSubtitle }}
          />
        }
      >
        {activeLoadingPhase ? (
          <DashboardPageLoading label="Loading Home dashboard content" phase={activeLoadingPhase} />
        ) : (
          <div className={styles.homeContent}>
            <div className={styles.weatherWrap}>
              <WeatherSummary deferRefresh={!hydrateHeavyContent} />
            </div>

            <SectionHeader title="Quick Links" />
            <section className={styles.quickGrid}>
              {QUICK_ACCESS_ITEMS.map((item) => (
                <div key={item.title}>
                  <QuickAccessTile item={item} onNavigate={onNavigate} onOpenHash={openHash} />
                </div>
              ))}
            </section>

            <GuestPresenceSecuritySection onOpen={openHash} />

            <SectionHeader title="Cameras" />
            <section className={styles.cameraGrid}>
              {CAMERA_ITEMS.map((camera) => (
                <div key={camera.title}>
                  <CameraTile camera={camera} live={hydrateHeavyContent && !preload} onOpen={openHash} />
                </div>
              ))}
            </section>
          </div>
        )}
      </Page>

      <ModalSheet contentStyle={sheetStyle} open={hash !== ''} subtitle={sheetSubtitle} title={modalTitle} onClose={closeHash}>
        <SheetContent closeHash={closeHash} hash={contentHash} overviewGridRef={overviewGridRef} overviewGridStyle={squareGridStyle} onNavigate={onNavigate} />
      </ModalSheet>
      {preloadModalHashes.map((preloadTargetHash) => (
        <div data-preload-modal={`overview${preloadTargetHash}`} key={`overview-preload-${preloadTargetHash}`}>
          <SheetContent closeHash={closeHash} hash={preloadTargetHash} onNavigate={onNavigate} preload />
        </div>
      ))}
    </>
  )

  if (!withShell) return page

  return (
    <AppShell bottomNav={<BottomNav activePath={activePath} onNavigate={onNavigate} />} chromeHidden={Boolean(activeLoadingPhase)} floatingAction={<RoomPickerButton onNavigate={onNavigate} />}>
      {page}
    </AppShell>
  )
}
