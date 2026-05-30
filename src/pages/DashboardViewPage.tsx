import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useEntity, useHass } from '@hakit/core'
import { ControlSliderCircular } from '@hakit/components'
import { ClimateCard } from '../components/cards/ClimateCard'
import { ContactSensorCard } from '../components/cards/ContactSensorCard'
import { LightCard } from '../components/cards/LightCard'
import { OccupancyCard } from '../components/cards/OccupancyCard'
import { AppShell } from '../components/shell/AppShell'
import { AppHeader } from '../components/shell/AppHeader'
import { BottomNav } from '../components/shell/BottomNav'
import { EntityActionCard } from '../components/hass/EntityActionCard'
import { SecurityDashboard } from '../components/hass/SecurityDashboard'
import { StatusRail, type StatusRailChip } from '../components/hass/StatusRail'
import { TodoListPanel } from '../components/hass/TodoListPanel'
import { VacuumCard, VacuumModalContent } from '../components/hass/VacuumCard'
import { AirQualityModalContent } from '../components/hass/AirQualityModalContent'
import { GrillModalContent } from '../components/hass/GrillModalContent'
import { MediaRemoteModalContent } from '../components/hass/MediaRemoteModalContent'
import { Card, type CardColor } from '../components/core/Card'
import { Description } from '../components/core/Description'
import { GlassTile } from '../components/core/GlassTile'
import { MaterialIcon } from '../components/core/Icon'
import { ModalSheet } from '../components/core/ModalSheet'
import { OptionPickerDialog, type PickerOption } from '../components/core/OptionPickerDialog'
import { SectionHeader } from '../components/core/SectionHeader'
import { asEntityName, formatCompactEntityState, isActiveState, isContactOpen, titleCaseState } from '../components/hass/entityState'
import { DASHBOARD_ROUTE_CHANGE_EVENT, dashboardEventTargets, dashboardHash, dashboardPathWithSearch, replaceDashboardUrl } from '../hooks/dashboardLocation'
import { useHashModal } from '../hooks/useHashModal'
import {
  AREA_ITEMS,
  CLIMATE_GROUPS,
  CONTACT_GROUPS,
  LIGHT_GROUPS,
  OCCUPANCY_GROUPS,
  type EntityGroupConfig,
} from '../constants/atAGlance'
import { DASHBOARD_ROUTES, PRIMARY_NAV_ROUTES } from '../constants/routes'
import {
  ADMIN_AUTO_REENABLE_ITEMS,
  ADMIN_DESCRIPTIONS,
  ADMIN_PRESENCE_OVERRIDE_ITEMS,
  ADMIN_SECURITY_CONTROLS,
  ADMIN_SHOW_SPECIFIC_CONTROLS,
  CLIMATE_COLOR,
  CONTROL_PAGES,
  GUEST_CONTROLS_DESCRIPTION,
  GUEST_CONTROL_ITEMS,
  MEDIA_COLOR,
  NEUTRAL_COLOR,
  MEDIA_SECTIONS,
  ROOM_EXTRA_SECTIONS,
  SETTINGS_PAGE_ITEMS,
  THERMOSTAT_ROOMS,
  TODO_PAGES,
  UNAVAILABLE_COLOR,
  VACUUM_COLOR,
  VACUUMS,
  type EntityAction,
  type EntitySectionConfig,
  type SettingsLinkConfig,
} from '../constants/portedDashboard'
import { ROOM_PAGE_CONFIGS, type RoomSourceCardConfig, type RoomSourceKind, type RoomSourceModalItem } from '../constants/roomPages'
import { MEDIA_REMOTE_CONFIGS } from '../constants/mediaRemotes'
import { Page } from './Page'
import { ClimateSheet, ContactSheet, LightsSheet, OccupancySheet } from './AtAGlancePage'
import styles from './DashboardViewPage.module.css'

interface DashboardViewPageProps {
  activePath: string
  onNavigate: (path: string) => void
  path: string
}

function routeTitle(path: string) {
  return DASHBOARD_ROUTES.find((route) => route.path === path)?.title ?? 'Dashboard'
}

function roomNameFromPath(path: string) {
  return AREA_ITEMS.find((area) => area.route.endsWith(`/${path}`))?.title
}

function removeSuffix(value: string, suffix: string) {
  return value.endsWith(suffix) ? value.slice(0, -suffix.length) : value
}

function lightRoomTitle(group: EntityGroupConfig) {
  return removeSuffix(removeSuffix(group.title, ' Lights'), ' Light')
}

function climateRoomTitle(group: EntityGroupConfig) {
  return removeSuffix(group.title, ' Climate')
}

function occupancyRoomTitle(group: EntityGroupConfig) {
  return removeSuffix(group.title, ' Occupancy')
}

function contactRoomTitle(group: EntityGroupConfig) {
  return removeSuffix(group.title, ' Contact Sensors')
}

function sectionHasItems(section: EntityGroupConfig | undefined) {
  return Boolean(section?.items.length)
}

function Grid({ children }: { children: ReactNode }) {
  return <div className={styles.grid}>{children}</div>
}

function Notice({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'review' }) {
  return <div className={`${styles.notice} ${tone === 'review' ? styles.review : ''}`}>{children}</div>
}

function EntitySections({ onNavigate, sections }: { onNavigate: (path: string) => void; sections: EntitySectionConfig[] }) {
  return (
    <div className={styles.stack}>
      {sections.map((section) => (
        <section className={styles.section} key={section.title}>
          <SectionHeader title={section.title} />
          <Grid>
            {section.items.map((item) => (
              <EntityActionCard item={item} key={`${section.title}-${item.entityId}-${item.title}`} onNavigate={onNavigate} />
            ))}
          </Grid>
        </section>
      ))}
    </div>
  )
}

function AdminWideGrid({ children }: { children: ReactNode }) {
  return <div className={styles.adminWideGrid}>{children}</div>
}

function AdminModalGrid({ children }: { children: ReactNode }) {
  return <div className={styles.adminModalGrid}>{children}</div>
}

function AdminHashButton({ hash, onOpen, title }: { hash: string; onOpen: (hash: string) => void; title: string }) {
  return (
    <button className={styles.adminHashButton} data-tone="switch-active" onClick={() => onOpen(hash)} type="button">
      <span>{title}</span>
    </button>
  )
}

function AdminTileGrid({ items, onNavigate, variant = 'wide' }: { items: EntitySectionConfig['items']; onNavigate: (path: string) => void; variant?: 'admin-modal' | 'compact' | 'wide' }) {
  const Wrapper = variant === 'wide' ? AdminWideGrid : variant === 'admin-modal' ? AdminModalGrid : Grid
  return (
    <Wrapper>
      {items.map((item) => (
        <EntityActionCard item={item} key={`${item.entityId}-${item.title}`} onNavigate={onNavigate} size={variant} />
      ))}
    </Wrapper>
  )
}

function sectionId(title: string) {
  return `section-${title.toLowerCase().replaceAll(' ', '-')}`
}

function scrollToSection(title: string) {
  document.getElementById(sectionId(title))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function setRoomHash(hash: string) {
  replaceDashboardUrl(`${dashboardPathWithSearch()}${hash}`)
}

function toneForSourceKind(kind: RoomSourceKind): StatusRailChip['tone'] {
  if (kind === 'light') return 'light'
  if (kind === 'air') return 'air'
  if (kind === 'climate' || kind === 'vent' || kind === 'fan') return 'climate'
  if (kind === 'occupancy') return 'presence'
  if (kind === 'contact') return 'contact'
  if (kind === 'vacuum') return 'vacuum'
  if (kind === 'media') return 'media'
  if (kind === 'power') return 'switch'
  if (kind === 'grill') return 'warning'
  return 'neutral'
}

function stateKindForSourceKind(kind: RoomSourceKind): StatusRailChip['stateKind'] {
  if (kind === 'occupancy') return 'presence'
  if (kind === 'contact') return 'contact'
  return undefined
}

function roomCardToStatusChip(card: RoomSourceCardConfig): StatusRailChip {
  return {
    title: card.title,
    entityId: card.entityId,
    hash: card.hash,
    icon: card.icon,
    stateKind: stateKindForSourceKind(card.kind),
    tone: toneForSourceKind(card.kind),
    width: card.title.length > 10 ? 176 : 148,
  }
}

function RoomSectionRail({ path, title }: { path: string; title: string }) {
  const sourcePage = ROOM_PAGE_CONFIGS[path]
  if (sourcePage) {
    return <StatusRail chips={sourcePage.overviewCards.map(roomCardToStatusChip)} onOpenHash={setRoomHash} />
  }

  const lightGroup = LIGHT_GROUPS.find((group) => lightRoomTitle(group) === title)
  const climateGroup = CLIMATE_GROUPS.find((group) => climateRoomTitle(group) === title)
  const occupancyGroup = OCCUPANCY_GROUPS.find((group) => occupancyRoomTitle(group) === title)
  const contactGroup = CONTACT_GROUPS.find((group) => contactRoomTitle(group) === title)
  const extras = ROOM_EXTRA_SECTIONS[path] ?? []
  const links = [
    sectionHasItems(lightGroup) ? { title: 'Lights', icon: 'mdi:lightbulb' } : null,
    sectionHasItems(climateGroup) ? { title: 'Climate', icon: 'mdi:thermostat' } : null,
    sectionHasItems(occupancyGroup) ? { title: 'Occupancy', icon: 'mdi:account-check' } : null,
    sectionHasItems(contactGroup) ? { title: 'Contact Sensors', icon: 'mdi:door' } : null,
    ...extras.map((section) => ({ title: section.title, icon: section.items[0]?.icon ?? 'mdi:home-assistant' })),
  ].filter((link): link is { icon: string; title: string } => Boolean(link))

  return (
    <div className={styles.roomRail} aria-label={`${title} sections`}>
      {links.map((link) => (
        <button className={styles.roomChip} key={link.title} onClick={() => scrollToSection(link.title)} type="button">
          <MaterialIcon name={link.icon} size={22} />
          <span>{link.title}</span>
        </button>
      ))}
    </div>
  )
}

function sourceColor(kind: RoomSourceKind): CardColor {
  if (kind === 'light') return { r: 230, g: 172, b: 44 }
  if (kind === 'climate' || kind === 'air' || kind === 'vent' || kind === 'fan') return CLIMATE_COLOR
  if (kind === 'occupancy' || kind === 'contact') return { r: 75, g: 126, b: 210 }
  if (kind === 'vacuum') return VACUUM_COLOR
  if (kind === 'media') return MEDIA_COLOR
  if (kind === 'grill') return { r: 206, g: 114, b: 38 }
  if (kind === 'appliance' || kind === 'laundry' || kind === 'power') return NEUTRAL_COLOR
  return NEUTRAL_COLOR
}

function isUnavailable(entity: ReturnType<typeof useEntity>) {
  return !entity || entity.state === 'unavailable' || entity.state === 'unknown'
}

function formatRoomSourceState(card: RoomSourceCardConfig, entity: ReturnType<typeof useEntity>) {
  if (!entity) return 'Unavailable'
  const sourceLabel = card.stateLabels?.[entity.state]
  if (sourceLabel) return sourceLabel
  if (card.stateDisplay !== 'climate-action-temperature') return formatCompactEntityState(entity, 'Unavailable')
  const hvacAction = typeof entity.attributes.hvac_action === 'string' ? entity.attributes.hvac_action : entity.state
  const temperature = entity.attributes.temperature ?? entity.attributes.current_temperature
  if (entity.state === 'off' || hvacAction === 'off') return 'Off'
  const action = String(hvacAction === 'heat_cool' ? entity.state : hvacAction)
  const actionLabel = action.split('_').map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join(' ')
  return typeof temperature === 'number' || typeof temperature === 'string' ? `${actionLabel} • ${temperature} °F` : actionLabel
}

function formatRoomSourceSubtitleEntity(entity: ReturnType<typeof useEntity>) {
  const value = formatCompactEntityState(entity, 'Unavailable')
  const unit = typeof entity?.attributes.unit_of_measurement === 'string' ? entity.attributes.unit_of_measurement : ''
  if (!unit || value === 'Unavailable' || value === 'Unknown' || value.endsWith(unit)) return value
  return `${value}${unit}`
}

function roomSourceBackgroundColor(card: RoomSourceCardConfig, entity: ReturnType<typeof useEntity>, presenceEntity: ReturnType<typeof useEntity>) {
  if (!entity) return undefined
  const sourceStateColor = card.stateColors?.[entity.state]
  if (sourceStateColor) return sourceStateColor
  if (card.stateTone !== 'climate-action') return undefined
  const hvacAction = typeof entity.attributes.hvac_action === 'string' ? entity.attributes.hvac_action : entity.state
  if (hvacAction === 'heating') return 'rgba(136, 64, 26, 0.6)'
  if (hvacAction === 'cooling') return 'rgba(25, 84, 130, 0.6)'
  if (hvacAction === 'idle') return 'rgba(229, 57, 53, 0.6)'
  if (entity.state === 'off' && presenceEntity?.state === 'on') return 'rgba(0, 150, 136, 0.6)'
  return undefined
}

function roomLightGroup(roomTitle: string) {
  return LIGHT_GROUPS.find((group) => lightRoomTitle(group) === roomTitle)
}

function roomClimateGroup(roomTitle: string) {
  return CLIMATE_GROUPS.find((group) => climateRoomTitle(group) === roomTitle)
}

function roomOccupancyGroup(roomTitle: string) {
  return OCCUPANCY_GROUPS.find((group) => occupancyRoomTitle(group) === roomTitle)
}

function roomContactGroup(roomTitle: string) {
  return CONTACT_GROUPS.find((group) => contactRoomTitle(group) === roomTitle)
}

function SourceModalItemCard({ fallbackKind, item }: { fallbackKind: RoomSourceKind; item: RoomSourceModalItem }) {
  const entity = useEntity(asEntityName(item.entityId), { returnNullIfNotFound: true })
  const unavailable = isUnavailable(entity)
  const kind = item.kind ?? fallbackKind

  return (
    <Card
      ariaLabel={`${item.title} ${formatCompactEntityState(entity, 'Unavailable')}`}
      color={unavailable ? UNAVAILABLE_COLOR : sourceColor(kind)}
      disabled={unavailable}
      icon={<MaterialIcon name={item.icon} size={34} />}
      muted={unavailable || !isActiveState(entity)}
      size="compact"
      subtitle={item.showState === false ? undefined : formatCompactEntityState(entity, 'Unavailable')}
      title={item.title}
    />
  )
}

function SourceEntityModalContent({ card }: { card: RoomSourceCardConfig }) {
  return (
    <div className={styles.stack}>
      <Grid>
        {card.modalItems?.map((item) => <SourceModalItemCard fallbackKind={card.kind} item={item} key={item.entityId} />)}
      </Grid>
      {card.manualReview && <Notice tone="review">{card.manualReview}</Notice>}
    </div>
  )
}

function renderRoomReusableSheet(card: RoomSourceCardConfig, roomTitle: string): ReactNode {
  if (!card.hash) return null

  if (card.modalItems?.length) return <SourceEntityModalContent card={card} key={`${card.entityId}-items`} />

  if (card.kind === 'light') {
    const group = roomLightGroup(roomTitle)
    if (group) return <LightsSheet directGroup={group} key={group.title} />
  }

  if (card.kind === 'vent' || (card.kind === 'climate' && card.title === 'Climate')) {
    const group = roomClimateGroup(roomTitle)
    if (group) return <ClimateSheet directGroup={group} key={group.title} />
  }

  if (card.kind === 'occupancy') {
    const group = roomOccupancyGroup(roomTitle)
    if (group) return <OccupancySheet directGroup={group} key={group.title} />
  }

  if (card.kind === 'contact') {
    const group = roomContactGroup(roomTitle)
    if (group) return <ContactSheet directGroup={group} key={group.title} />
  }

  if (card.kind === 'vacuum') {
    const vacuum = VACUUMS.find((candidate) => candidate.entityId === card.entityId)
    if (vacuum) return <VacuumModalContent key={vacuum.entityId} vacuum={vacuum} />
  }

  if (card.kind === 'air') {
    return <AirQualityModalContent key={card.entityId} pm25EntityId={card.modalEntityId ?? card.entityId} roomTitle={roomTitle} />
  }

  if (card.kind === 'grill' && card.hash === '#bear-grills') {
    return <GrillModalContent key={card.entityId} />
  }

  if (card.kind === 'media' && card.hash) {
    const mediaRemote = MEDIA_REMOTE_CONFIGS[card.hash]
    if (mediaRemote) return <MediaRemoteModalContent config={mediaRemote} key={mediaRemote.hash} />
  }

  return null
}

function RoomSourceFallback({ card }: { card: RoomSourceCardConfig }) {
  return (
    <div className={styles.sourceModal}>
      <div className={styles.sourceModalIcon}>
        <MaterialIcon name={card.icon} size={30} />
      </div>
      <div>
        <strong>{card.hash ?? 'Source control'}</strong>
        <span>{card.manualReview ?? 'This source card is present in the YAML page and is ready for a dedicated React treatment.'}</span>
      </div>
      <div className={styles.sourceEntity}>{card.entityId}</div>
    </div>
  )
}

function SourceCardIcon({ card, size = 38 }: { card: RoomSourceCardConfig; size?: number }) {
  const [imageFailed, setImageFailed] = useState(false)

  if (card.imageUrl && !imageFailed) {
    return <img alt="" className={styles.appIcon} onError={() => setImageFailed(true)} src={card.imageUrl} />
  }

  return <MaterialIcon name={card.icon} size={size} />
}

function RoomSourceMediaAppCard({ card, isOff, onClick }: { card: RoomSourceCardConfig; isOff: boolean; onClick?: () => void }) {
  const [imageFailed, setImageFailed] = useState(false)
  const className = [styles.mediaAppTile, card.imageBackground === 'white' ? styles.mediaAppTileWhite : '', isOff ? styles.mediaAppTileMuted : ''].filter(Boolean).join(' ')
  const content = imageFailed ? (
    <span className={styles.mediaAppFallback}>
      <MaterialIcon name={card.icon} size={34} />
      <span>{card.title}</span>
    </span>
  ) : (
    <img alt="" onError={() => setImageFailed(true)} src={card.imageUrl} />
  )

  if (onClick) {
    return (
      <button aria-label={card.title} className={className} data-card="media-app" data-muted={isOff ? 'true' : 'false'} data-tone="media" onClick={onClick} type="button">
        {content}
      </button>
    )
  }

  return (
    <div aria-label={card.title} className={className} data-card="media-app" data-muted={isOff ? 'true' : 'false'} data-tone="media">
      {content}
    </div>
  )
}

function useRoomSourceActionRunner() {
  const callService = useHass((state) => state.helpers.callService) as unknown as (params: Record<string, unknown>) => void

  return (entityId: string, action: Exclude<EntityAction, { type: 'navigate' }> | undefined) => {
    if (!action) return
    if (action.type === 'toggle') {
      callService({ domain: 'homeassistant', service: 'toggle', target: entityId })
      return
    }

    const target = action.target === null ? undefined : action.target ?? entityId
    const params: Record<string, unknown> = { domain: action.domain, service: action.service }
    if (action.serviceData !== undefined) params.serviceData = action.serviceData
    if (target !== undefined) params.target = target
    callService(params)
  }
}

function RoomSourceCard({ card, onOpen }: { card: RoomSourceCardConfig; onOpen: (card: RoomSourceCardConfig) => void }) {
  const alternateGate = useEntity(asEntityName(card.alternate?.whenEntityId ?? card.entityId), { returnNullIfNotFound: true })
  const runAction = useRoomSourceActionRunner()
  const useAlternate = Boolean(card.alternate && alternateGate && card.alternate.whenStates.includes(alternateGate.state))
  const effectiveEntityId = useAlternate ? card.alternate?.entityId ?? card.entityId : card.entityId
  const effectiveShowState = useAlternate ? card.alternate?.showState : card.showState
  const effectiveSubtitleEntityIds = useAlternate ? card.alternate?.subtitleEntityIds : card.subtitleEntityIds
  const entity = useEntity(asEntityName(effectiveEntityId), { returnNullIfNotFound: true })
  const presenceEntity = useEntity(asEntityName(card.presenceEntityId ?? effectiveEntityId), { returnNullIfNotFound: true })
  const subtitleEntityOne = useEntity(asEntityName(effectiveSubtitleEntityIds?.[0] ?? effectiveEntityId), { returnNullIfNotFound: true })
  const subtitleEntityTwo = useEntity(asEntityName(effectiveSubtitleEntityIds?.[1] ?? effectiveEntityId), { returnNullIfNotFound: true })
  const unavailable = isUnavailable(entity)
  const disabledByState = Boolean(entity && card.disabledStates?.includes(entity.state))
  const subtitle = effectiveSubtitleEntityIds
    ? [subtitleEntityOne, subtitleEntityTwo].slice(0, effectiveSubtitleEntityIds.length).map((subtitleEntity) => formatRoomSourceSubtitleEntity(subtitleEntity)).join(' • ')
    : effectiveShowState ? formatRoomSourceState(card, entity) : undefined
  const clickable = Boolean(card.hash || card.manualReview || card.action) && !unavailable && !disabledByState
  const activeByState = Boolean(entity && card.activeStates?.includes(entity.state))
  const sourceStateInactive = card.stateDisplay === 'climate-action-temperature' && (entity?.state === 'off' || entity?.attributes.hvac_action === 'off')
  const inactiveMuted = sourceStateInactive || (!unavailable && !activeByState && !isActiveState(entity) && ['fan', 'grill', 'light', 'media', 'power'].includes(card.kind))
  const handleClick = clickable ? (card.action ? () => runAction(card.entityId, card.action) : () => onOpen(card)) : undefined
  const backgroundColor = roomSourceBackgroundColor(card, entity, presenceEntity)
  const content = card.imageUrl && card.kind === 'media' && card.action ? (
    <RoomSourceMediaAppCard card={card} isOff={unavailable || disabledByState} onClick={handleClick} />
  ) : (
    <GlassTile
      icon={<SourceCardIcon card={card} size={24} />}
      backgroundColor={backgroundColor}
      isOff={unavailable || disabledByState || inactiveMuted}
      onClick={handleClick}
      subtitle={subtitle}
      title={card.title}
      tone={unavailable ? 'neutral' : toneForSourceKind(card.kind)}
    />
  )

  if (card.span === 'full') return <div className={styles.fullSpan}>{content}</div>
  return content
}

function RoomSourceModal({ card, onClose, roomTitle }: { card: RoomSourceCardConfig | null; onClose: () => void; roomTitle: string }) {
  const content = card ? renderRoomReusableSheet(card, roomTitle) : null

  return (
    <ModalSheet onClose={onClose} open={Boolean(card)} title={card ? `${roomTitle}: ${card.modalTitle ?? card.title}` : roomTitle}>
      {card && (content ?? <RoomSourceFallback card={card} />)}
    </ModalSheet>
  )
}

function EmptyRoomState() {
  return (
    <div className={styles.emptyRoomState}>
      <h2>Nothing Here Yet!</h2>
      <Description>Once some devices are added to this room, we can display them here.</Description>
    </div>
  )
}

function SourceRoomPage({ room }: { room: (typeof ROOM_PAGE_CONFIGS)[string] }) {
  const [selectedCard, setSelectedCard] = useState<RoomSourceCardConfig | null>(null)

  const closeSourceCard = () => {
    setSelectedCard(null)
    if (dashboardHash()) replaceDashboardUrl(dashboardPathWithSearch())
  }

  useEffect(() => {
    const allCards = [...room.overviewCards, ...room.sourceSections.flatMap((section) => section.cards)]
    const syncFromHash = () => {
      const card = allCards.find((candidate) => candidate.hash === dashboardHash())
      setSelectedCard(card ?? null)
    }

    const targets = dashboardEventTargets()
    syncFromHash()
    targets.forEach((target) => {
      target.addEventListener('hashchange', syncFromHash)
      target.addEventListener('popstate', syncFromHash)
      target.addEventListener(DASHBOARD_ROUTE_CHANGE_EVENT, syncFromHash)
    })

    return () => {
      targets.forEach((target) => {
        target.removeEventListener('hashchange', syncFromHash)
        target.removeEventListener('popstate', syncFromHash)
        target.removeEventListener(DASHBOARD_ROUTE_CHANGE_EVENT, syncFromHash)
      })
    }
  }, [room.overviewCards, room.sourceSections])

  const openSourceCard = (card: RoomSourceCardConfig) => {
    if (card.hash) setRoomHash(card.hash)
    else setSelectedCard(card)
  }

  return (
    <div className={styles.stack}>
      {room.sourceSections.length === 0 && <EmptyRoomState />}

      {room.sourceSections.map((section) => (
        <section className={styles.section} id={sectionId(section.title)} key={`${room.path}-${section.title}`}>
          <SectionHeader title={section.title} />
          <Grid>
            {section.cards.map((card) => <RoomSourceCard card={card} key={`${room.path}-${section.title}-${card.title}-${card.entityId}`} onOpen={openSourceCard} />)}
          </Grid>
        </section>
      ))}

      <RoomSourceModal card={selectedCard} onClose={closeSourceCard} roomTitle={room.title} />
    </div>
  )
}

function RoomPage({ onNavigate, path, title }: { onNavigate: (path: string) => void; path: string; title: string }) {
  const sourceRoom = ROOM_PAGE_CONFIGS[path]
  if (sourceRoom) return <SourceRoomPage room={sourceRoom} />

  const lightGroup = LIGHT_GROUPS.find((group) => lightRoomTitle(group) === title)
  const climateGroup = CLIMATE_GROUPS.find((group) => climateRoomTitle(group) === title)
  const occupancyGroup = OCCUPANCY_GROUPS.find((group) => occupancyRoomTitle(group) === title)
  const contactGroup = CONTACT_GROUPS.find((group) => contactRoomTitle(group) === title)
  const extras = ROOM_EXTRA_SECTIONS[path] ?? []

  return (
    <div className={styles.stack}>
      {sectionHasItems(lightGroup) && (
        <section className={styles.section} id={sectionId('Lights')}>
          <SectionHeader title="Lights" />
          <Grid>
            {lightGroup?.items.map((item) => (
              <LightCard entityId={item.entityId} key={item.entityId} size="compact" title={item.title} />
            ))}
          </Grid>
        </section>
      )}

      {sectionHasItems(climateGroup) && (
        <section className={styles.section} id={sectionId('Climate')}>
          <SectionHeader title="Climate" />
          <Grid>
            {climateGroup?.items.map((item) => (
              <ClimateCard
                colorEntityId={item.colorEntityId}
                entityId={item.entityId}
                icon={item.entityId.startsWith('cover.') ? 'vent' : 'temperature'}
                key={item.entityId}
                size="compact"
                title={item.title}
              />
            ))}
          </Grid>
        </section>
      )}

      {sectionHasItems(occupancyGroup) && (
        <section className={styles.section} id={sectionId('Occupancy')}>
          <SectionHeader title="Occupancy" />
          <Grid>
            {occupancyGroup?.items.map((item) => (
              <OccupancyCard entityId={item.entityId} key={item.entityId} size="compact" title={item.title} />
            ))}
          </Grid>
        </section>
      )}

      {sectionHasItems(contactGroup) && (
        <section className={styles.section} id={sectionId('Contact Sensors')}>
          <SectionHeader title="Contact Sensors" />
          <Grid>
            {contactGroup?.items.map((item) => (
              <ContactSensorCard entityId={item.entityId} key={item.entityId} size="compact" title={item.title} />
            ))}
          </Grid>
        </section>
      )}

      {extras.map((section) => (
        <section className={styles.section} id={sectionId(section.title)} key={section.title}>
          <SectionHeader title={section.title} />
          <Grid>
            {section.items.map((item) => <EntityActionCard item={item} key={`${section.title}-${item.entityId}-${item.title}`} onNavigate={onNavigate} />)}
          </Grid>
        </section>
      ))}
    </div>
  )
}

function TodoPage({ path }: { path: string }) {
  const config = TODO_PAGES[path]
  if (!config) return null

  return (
    <div className={styles.stack}>
      {config.lists.map((list) => (
        <section className={styles.section} key={list.entityId}>
          <SectionHeader title={list.title} />
          <TodoListPanel entityId={list.entityId} title={list.title} />
        </section>
      ))}
    </div>
  )
}

function VacuumPage() {
  return (
    <div className={styles.stack}>
      <section className={styles.section}>
        <SectionHeader title="Robot Vacuums" />
        <Grid>
          {VACUUMS.map((vacuum) => (
            <VacuumCard key={vacuum.entityId} vacuum={vacuum} />
          ))}
        </Grid>
      </section>
    </div>
  )
}

function SecurityPage() {
  return <SecurityDashboard />
}

function navigateExternal(path: string) {
  try {
    const targetWindow = window.top && window.top !== window ? window.top : window
    targetWindow.location.assign(path)
  } catch {
    window.location.assign(path)
  }
}

function SettingsLink({ item, onNavigate }: { item: SettingsLinkConfig; onNavigate: (path: string) => void }) {
  const activate = () => {
    if (item.path) onNavigate(item.path)
    else if (item.externalPath) navigateExternal(item.externalPath)
  }

  return (
    <button aria-label={`${item.title} ${item.subtitle}`} className={styles.settingsLink} data-external-path={item.externalPath} data-navigation-path={item.path} onClick={activate} type="button">
      <span aria-hidden="true" className={styles.settingsLinkIcon}>
        <MaterialIcon name={item.icon} size={32} />
      </span>
      <span className={styles.settingsLinkCopy}>
        <span className={styles.settingsLinkTitle}>{item.title}</span>
        <span className={styles.settingsLinkSubtitle}>{item.subtitle}</span>
      </span>
    </button>
  )
}

function SettingsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <main className={styles.settingsPage}>
      <AppHeader activePath="settings" onNavigate={onNavigate} title="Settings" />
      <nav aria-label="Settings pages" className={styles.settingsList}>
        {SETTINGS_PAGE_ITEMS.map((item) => (
          <SettingsLink item={item} key={item.title} onNavigate={onNavigate} />
        ))}
      </nav>
    </main>
  )
}

function GuestControlsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <main className={styles.guestPage}>
      <AppHeader activePath="settings" backPath="overview" onNavigate={onNavigate} title="Guest Controls" />

      <section className={styles.guestSection}>
        <SectionHeader title="Guest Controls" />
        <Description>{GUEST_CONTROLS_DESCRIPTION}</Description>
        <AdminTileGrid items={GUEST_CONTROL_ITEMS} onNavigate={onNavigate} variant="admin-modal" />
      </section>
    </main>
  )
}

function MediaPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  return <EntitySections onNavigate={onNavigate} sections={MEDIA_SECTIONS} />
}

function AdminPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const { closeHash, hash, openHash } = useHashModal()

  return (
    <div className={styles.stack}>
      <section className={styles.section}>
        <SectionHeader title="Security Controls" />
        <Description>{ADMIN_DESCRIPTIONS.autoLock}</Description>
        <AdminTileGrid items={ADMIN_SECURITY_CONTROLS} onNavigate={onNavigate} />
      </section>

      <section className={styles.section}>
        <SectionHeader title="Presence-Based Light Overrides" />
        <Description>{ADMIN_DESCRIPTIONS.presenceOverrides}</Description>
        <AdminHashButton hash="#presence-based-overrides" onOpen={openHash} title="Open Presence-Based Overrides" />
      </section>

      <section className={styles.section}>
        <SectionHeader title="Show Specific Controls" />
        <Description>{ADMIN_DESCRIPTIONS.showSpecific}</Description>
        <AdminTileGrid items={ADMIN_SHOW_SPECIFIC_CONTROLS} onNavigate={onNavigate} />
      </section>

      <section className={styles.section}>
        <SectionHeader title="Automatic Presence Setting Overrides" />
        <Description>{ADMIN_DESCRIPTIONS.autoReset}</Description>
        <AdminHashButton hash="#presence-based-overrides-auto" onOpen={openHash} title="Open Presence-Based Auto-Reset Configuration" />
      </section>

      <ModalSheet onClose={closeHash} open={hash === '#presence-based-overrides'} surface="hass-popup" title="Presence-Based Overrides">
        <div className={styles.adminModalBody}>
          <AdminTileGrid items={ADMIN_PRESENCE_OVERRIDE_ITEMS} onNavigate={onNavigate} variant="admin-modal" />
        </div>
      </ModalSheet>

      <ModalSheet onClose={closeHash} open={hash === '#presence-based-overrides-auto'} surface="hass-popup" title="Presence-Based Overrides Auto-Reset">
        <div className={styles.adminModalBody}>
          <AdminTileGrid items={ADMIN_AUTO_REENABLE_ITEMS} onNavigate={onNavigate} variant="admin-modal" />
        </div>
      </ModalSheet>
    </div>
  )
}

const THERMOSTAT_SECTION_DESCRIPTIONS = {
  ecoMode:
    "Enable Eco Mode to only track active rooms, and disable heating/cooling inactive, but critical temperature, rooms.\n\nUse the dropdown on the right side of the button to configure Eco Mode's behavior when everyone is out of the house.\n\nTo have specific rooms override Eco mode, enable Track Selected Rooms, and select the rooms you'd like to enable critical monitoring for.",
  forceCritical:
    "For rooms that are not selected above, you can select rooms here that we should still monitor for critical temperatures.\n\nA good example is the theater room, which sits below rooms we want heated or cooled, or the music room, which sits below the living room; even if we aren't actively monitoring them, those rooms being around temp mean more comfortable conditions upstairs.",
  integration: 'Enable or disable automatic thermostat control.',
  trackSelected:
    'Track only a subset of monitored rooms for automated control. Monitored rooms can be configured in the integration settings.\n\nThis setting works in tandem with eco mode, but eco mode is not required to be enabled to use it.',
} as const

const THERMOSTAT_CONTACT_SENSORS = [
  { entityId: 'binary_sensor.office_window_contact_sensor_contact', title: 'Office Window' },
  { entityId: 'binary_sensor.office_pc_window_sensor_contact', title: 'Office PC Window' },
  { entityId: 'binary_sensor.living_room_window_contact_sensor_contact', title: 'Living Room Window' },
  { entityId: 'binary_sensor.front_door_contact_sensor_contact', title: 'Front Door' },
  { entityId: 'binary_sensor.garage_door_contact_sensor_contact', title: 'Garage Door' },
  { entityId: 'binary_sensor.theater_room_door_contact_sensor_contact', title: 'Theater Room Door' },
  { entityId: 'binary_sensor.kitchen_door_contact_sensor_contact', title: 'Kitchen Door' },
  { entityId: 'binary_sensor.guest_room_window_contact_sensor_contact', title: 'Guest Room Window' },
  { entityId: 'binary_sensor.gym_window_contact_sensor_contact', title: 'Gym Window' },
  { entityId: 'binary_sensor.dining_room_door_contact_sensor_contact', title: 'Dining Room Door' },
  { entityId: 'binary_sensor.music_room_door_contact_sensor_contact', title: 'Music Room Door' },
] as const

type ThermostatRoomView = (typeof THERMOSTAT_ROOMS)[number] & {
  hash: string
  key: string
}

function thermostatRoomKey(title: string) {
  return title.toLowerCase().replaceAll(' ', '_')
}

function thermostatRoomHash(title: string) {
  return `#${title.toLowerCase().replaceAll(' ', '-')}`
}

const THERMOSTAT_ROOM_VIEWS: ThermostatRoomView[] = THERMOSTAT_ROOMS.map((room) => ({
  ...room,
  hash: thermostatRoomHash(room.title),
  key: thermostatRoomKey(room.title),
}))
const GLOBAL_THERMOSTAT_ENTITY_ID = 'climate.thermostat_contact_sensors_global_virtual_thermostat'
const THERMOSTAT_ROOM_CLIMATE_ENTITY_IDS = THERMOSTAT_ROOM_VIEWS.map((room) => room.climateEntityId)
const THERMOSTAT_HEAT_COLOR = '#cd5401'
const THERMOSTAT_COOL_COLOR = '#2c8e98'
const THERMOSTAT_NEUTRAL_COLOR = 'rgba(255, 255, 255, 0.78)'

function thermostatTemperatureEntityId(room: ThermostatRoomView) {
  return `sensor.thermostat_contact_sensors_${room.key}_temperature`
}

function thermostatOccupancyEntityId(room: ThermostatRoomView) {
  return `sensor.thermostat_contact_sensors_${room.key}_occupancy`
}

function thermostatTrackEntityId(room: ThermostatRoomView) {
  return `switch.thermostat_contact_sensors_track_${room.key}`
}

function thermostatForceCriticalEntityId(room: ThermostatRoomView) {
  return `switch.thermostat_contact_sensors_${room.key}_force_track_when_critical`
}

function numberValue(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' && value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatOneDecimal(value: unknown, fallback = '--') {
  const parsed = numberValue(value)
  return parsed === null ? fallback : parsed.toFixed(1)
}

function formatTemperatureValue(value: unknown, unit = '°F') {
  return `${formatOneDecimal(value)}${unit}`
}

function temperatureUnit(entity: ReturnType<typeof useEntity>) {
  if (typeof entity?.attributes.temperature_unit === 'string') return entity.attributes.temperature_unit
  if (typeof entity?.attributes.unit_of_measurement === 'string') return entity.attributes.unit_of_measurement
  return '°F'
}

function formatSelectOption(value: string) {
  if (!value) return 'Unknown'
  if (value.includes(' ')) return value
  return titleCaseState(value)
}

function useCallService() {
  return useHass((state) => state.helpers.callService) as unknown as (params: Record<string, unknown>) => void
}

type ThermostatSliderTarget = 'high' | 'low' | 'value'
type ThermostatDisplayTargets = { high: number | null; low: number | null; sourceKey: string; target: number | null }
type ThermostatThermalStatus = 'cool' | 'heat' | 'idle'

function rawThermostatAction(entity: ReturnType<typeof useEntity>) {
  return typeof entity?.attributes.hvac_action === 'string' ? entity.attributes.hvac_action : entity?.state ?? 'idle'
}

function thermostatThermalStatus(action: string): ThermostatThermalStatus {
  if (action === 'heating' || action === 'heat') return 'heat'
  if (action === 'cooling' || action === 'cool') return 'cool'
  return 'idle'
}

function thermostatActionColor(action: string) {
  const status = thermostatThermalStatus(action)
  if (status === 'heat') return THERMOSTAT_HEAT_COLOR
  if (status === 'cool') return THERMOSTAT_COOL_COLOR
  return undefined
}

function thermostatSliderColors(action: string) {
  return {
    color: thermostatActionColor(action) ?? THERMOSTAT_NEUTRAL_COLOR,
    highColor: THERMOSTAT_COOL_COLOR,
    lowColor: THERMOSTAT_HEAT_COLOR,
  }
}

function ThermostatDial({ entityId, size = 'page', title }: { entityId: string; size?: 'modal' | 'page'; title: string }) {
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true })
  const callService = useCallService()
  const unit = temperatureUnit(entity)
  const currentTemperature = entity?.attributes.current_temperature
  const targetLow = entity?.attributes.target_temp_low
  const targetHigh = entity?.attributes.target_temp_high
  const targetTemperature = entity?.attributes.temperature
  const minTemperature = numberValue(entity?.attributes.min_temp) ?? 45
  const maxTemperature = numberValue(entity?.attributes.max_temp) ?? 95
  const targetStep = numberValue(entity?.attributes.target_temp_step) ?? 0.5
  const current = numberValue(currentTemperature) ?? undefined
  const low = numberValue(targetLow)
  const high = numberValue(targetHigh)
  const target = numberValue(targetTemperature)
  const hasRange = low !== null && high !== null
  const sourceTargetKey = `${low ?? 'none'}-${high ?? 'none'}-${target ?? 'none'}`
  const sourceTargets: ThermostatDisplayTargets = { high, low, sourceKey: sourceTargetKey, target }
  const [pendingTargets, setPendingTargets] = useState<ThermostatDisplayTargets | null>(null)
  const lastTemperatureCommit = useRef<{ key: string; time: number } | null>(null)
  const displayTargets = pendingTargets?.sourceKey === sourceTargetKey ? pendingTargets : sourceTargets
  const displayLow = displayTargets.low
  const displayHigh = displayTargets.high
  const displayTarget = displayTargets.target
  const displayRangeText = hasRange ? `${formatOneDecimal(displayLow ?? undefined)} · ${formatOneDecimal(displayHigh ?? undefined)}` : formatTemperatureValue(displayTarget ?? targetTemperature, unit)
  // HAKit 6.0.2 syncs the numeric high prop into localLow after mount; string coercion preserves the high handle and the key remounts on HA updates.
  const sliderHigh = displayHigh !== null ? (String(displayHigh) as unknown as number) : undefined
  const rawHvacAction = rawThermostatAction(entity)
  const actionColor = thermostatActionColor(rawHvacAction)
  const disabled = !entity || entity.state === 'unavailable' || entity.state === 'unknown'
  const inactive = disabled || (!hasRange && !actionColor && entity?.state === 'off')
  const hvacAction = titleCaseState(rawHvacAction)

  const updateDisplayedTarget = (value: number, type: ThermostatSliderTarget) => {
    setPendingTargets((previous) => {
      const base = previous?.sourceKey === sourceTargetKey ? previous : sourceTargets
      if (!hasRange) return { ...base, target: value }
      if (type === 'low') return { ...base, low: value }
      if (type === 'high') return { ...base, high: value }
      return base
    })
  }

  const commitTemperature = (serviceData: Record<string, number>) => {
    const commitKey = JSON.stringify(serviceData)
    const now = Date.now()
    if (lastTemperatureCommit.current?.key === commitKey && now - lastTemperatureCommit.current.time < 400) return
    lastTemperatureCommit.current = { key: commitKey, time: now }
    const target = entityId === GLOBAL_THERMOSTAT_ENTITY_ID && 'target_temp_low' in serviceData && 'target_temp_high' in serviceData ? THERMOSTAT_ROOM_CLIMATE_ENTITY_IDS : entityId
    callService({ domain: 'climate', service: 'set_temperature', target, serviceData })
  }

  const commitDisplayedTargets = () => {
    if (!entity) return
    if (hasRange && displayLow !== null && displayHigh !== null) {
      commitTemperature({ target_temp_low: displayLow, target_temp_high: displayHigh })
      return
    }
    if (!hasRange && displayTarget !== null) commitTemperature({ temperature: displayTarget })
  }

  const applySliderChange = (value: number, type: ThermostatSliderTarget) => {
    if (!entity) return
    updateDisplayedTarget(value, type)
    const nextLow = type === 'low' ? value : displayLow
    const nextHigh = type === 'high' ? value : displayHigh
    if (hasRange && nextLow !== null && nextHigh !== null) {
      commitTemperature({ target_temp_low: nextLow, target_temp_high: nextHigh })
      return
    }

    if (!hasRange) commitTemperature({ temperature: value })
  }

  return (
    <div aria-label={`${title} thermostat ${hvacAction} ${formatTemperatureValue(currentTemperature, unit)} ${displayRangeText}`} className={styles.thermostatDial} data-hvac-action={rawHvacAction} data-size={size} role="region">
      <ControlSliderCircular
        key={`${entityId}-${sourceTargetKey}`}
        className={styles.thermostatCircularSlider}
        colors={thermostatSliderColors(rawHvacAction)}
        current={current}
        disabled={disabled}
        dual={hasRange}
        high={sliderHigh}
        inactive={inactive}
        label={`${title} target temperature`}
        low={displayLow ?? undefined}
        max={maxTemperature}
        min={minTemperature}
        mode={hasRange ? undefined : 'full'}
        onChange={updateDisplayedTarget}
        onChangeApplied={applySliderChange}
        onPointerUpCapture={commitDisplayedTargets}
        step={targetStep}
        value={displayTarget ?? current}
      />
      <div className={styles.thermostatDialReadout}>
        <span className={styles.thermostatAction}>{hvacAction}</span>
        <span className={styles.thermostatPrimaryValue}>{formatOneDecimal(currentTemperature, '--').replace(/\.0$/, '')}<small>{unit}</small></span>
        <span className={styles.thermostatRange}>
          <MaterialIcon name="mdi:thermostat" size={17} />
          {displayRangeText}
        </span>
      </div>
    </div>
  )
}

function ThermostatSelectButton({
  entityId,
  hideWhenEmpty = false,
  icon,
  optionsAttribute = 'options',
  selectedIcon = 'mdi:thermometer-check',
  serviceKind = 'select',
  title,
  valueAttribute,
}: {
  entityId: string
  hideWhenEmpty?: boolean
  icon: string
  optionsAttribute?: string
  selectedIcon?: string
  serviceKind?: 'climate' | 'climate-fan' | 'select'
  title: string
  valueAttribute?: string
}) {
  const [open, setOpen] = useState(false)
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true })
  const callService = useCallService()
  const rawOptions = entity?.attributes[optionsAttribute]
  const options: PickerOption[] = Array.isArray(rawOptions) ? rawOptions.map((option) => ({ label: formatSelectOption(String(option)), value: String(option) })) : []
  const value = valueAttribute && typeof entity?.attributes[valueAttribute] === 'string' ? entity.attributes[valueAttribute] : entity?.state ?? ''
  const disabled = options.length === 0

  if (hideWhenEmpty && disabled) return null

  const selectOption = (nextValue: string) => {
    if (nextValue === value) {
      setOpen(false)
      return
    }

    if (serviceKind === 'climate') callService({ domain: 'climate', service: 'set_hvac_mode', target: entityId, serviceData: { hvac_mode: nextValue } })
    else if (serviceKind === 'climate-fan') callService({ domain: 'climate', service: 'set_fan_mode', target: entityId, serviceData: { fan_mode: nextValue } })
    else callService({ domain: 'select', service: 'select_option', target: entityId, serviceData: { option: nextValue } })
    setOpen(false)
  }

  return (
    <>
      <button aria-label={`${title} ${formatSelectOption(value)}`} className={styles.thermostatSubButton} disabled={disabled} onClick={() => setOpen(true)} type="button">
        <MaterialIcon name={icon} size={22} />
        <MaterialIcon name="mdi:chevron-down" size={22} />
      </button>
      <OptionPickerDialog icon={icon} onClose={() => setOpen(false)} onSelect={selectOption} open={open} options={options} presentation="sheet" selectedIcon={selectedIcon} title={title} value={value} />
    </>
  )
}

function ThermostatRoomRow({ onOpen, room }: { onOpen: (hash: string) => void; room: ThermostatRoomView }) {
  const temperature = useEntity(asEntityName(thermostatTemperatureEntityId(room)), { returnNullIfNotFound: true })
  const occupancy = useEntity(asEntityName(thermostatOccupancyEntityId(room)), { returnNullIfNotFound: true })
  const active = occupancy?.state === 'active'
  const subtitle = `${formatTemperatureValue(temperature?.state, temperatureUnit(temperature))} · ${titleCaseState(occupancy?.state)}`

  return (
    <button aria-label={`${room.title} ${subtitle}`} className={styles.thermostatRoomRow} onClick={() => onOpen(room.hash)} type="button">
      <MaterialIcon name={active ? 'mdi:thermometer-check' : 'mdi:thermometer-off'} size={32} />
      <span>
        <strong>{room.title}</strong>
        <small>{subtitle}</small>
      </span>
    </button>
  )
}

function ThermostatGlassCard({ active = false, ariaLabel, children, hvacAction, icon, onMainClick, pressed, stateText, thermalStatus = 'idle', title }: { active?: boolean; ariaLabel?: string; children?: ReactNode; hvacAction?: string; icon: string; onMainClick?: () => void; pressed?: boolean; stateText: string; thermalStatus?: ThermostatThermalStatus; title: string }) {
  const content = (
    <>
      <MaterialIcon name={icon} size={34} />
      <span>
        <strong>{title}</strong>
        <small>{stateText}</small>
      </span>
    </>
  )

  return (
    <div aria-label={ariaLabel} className={styles.thermostatGlassCard} data-active={active ? 'true' : 'false'} data-hvac-action={hvacAction} data-thermal-status={thermalStatus}>
      {onMainClick ? (
        <button aria-label={`${title} ${stateText}`} aria-pressed={pressed ?? active} className={styles.thermostatGlassMain} onClick={onMainClick} type="button">
          {content}
        </button>
      ) : (
        <span className={styles.thermostatGlassMain}>{content}</span>
      )}
      {children && <div className={styles.thermostatGlassActions}>{children}</div>}
    </div>
  )
}

function ThermostatHubPill() {
  const entity = useEntity(asEntityName('climate.thermostat_hub_w200'), { returnNullIfNotFound: true })
  const rawHvacAction = rawThermostatAction(entity)
  const stateText = formatCompactEntityState(entity, 'Unavailable')

  return (
    <ThermostatGlassCard ariaLabel={`Thermostat Hub ${stateText}`} hvacAction={rawHvacAction} icon="mdi:thermostat" stateText={stateText} thermalStatus={thermostatThermalStatus(rawHvacAction)} title="Thermostat Hub">
      <ThermostatSelectButton entityId="climate.thermostat_hub_w200" icon="mdi:power" optionsAttribute="hvac_modes" serviceKind="climate" title="Thermostat Hub Mode" />
      <ThermostatSelectButton entityId="climate.thermostat_hub_w200" hideWhenEmpty icon="mdi:fan" optionsAttribute="fan_modes" selectedIcon="mdi:fan-check" serviceKind="climate-fan" title="Thermostat Hub Fan" valueAttribute="fan_mode" />
    </ThermostatGlassCard>
  )
}

function ThermostatSwitchCard({ children, entityId, icon, title }: { children?: ReactNode; entityId: string; icon: string; title: string }) {
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true })
  const callService = useCallService()
  const active = entity?.state === 'on'
  const stateText = formatCompactEntityState(entity, 'Unavailable')

  return (
    <ThermostatGlassCard active={active} icon={icon} onMainClick={() => callService({ domain: 'homeassistant', service: 'toggle', target: entityId })} stateText={stateText} title={title}>
      {children}
    </ThermostatGlassCard>
  )
}

function ThermostatCheckbox({ entityId, showState = true, title }: { entityId: string; showState?: boolean; title: string }) {
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true })
  const callService = useCallService()
  const active = entity?.state === 'on'

  return (
    <button aria-label={showState ? `${title} ${formatCompactEntityState(entity, 'Unavailable')}` : title} aria-pressed={active} className={styles.thermostatCheckbox} onClick={() => callService({ domain: 'homeassistant', service: 'toggle', target: entityId })} type="button">
      <MaterialIcon name={active ? 'mdi:checkbox-marked-outline' : 'mdi:checkbox-blank-outline'} size={34} />
      <span>
        <strong>{title}</strong>
        {showState && <small>{formatCompactEntityState(entity, 'Unavailable')}</small>}
      </span>
    </button>
  )
}

function ThermostatTrackCheckbox({ room }: { room: ThermostatRoomView }) {
  return <ThermostatCheckbox entityId={thermostatTrackEntityId(room)} title={room.title} />
}

function ThermostatForceCheckbox({ room }: { room: ThermostatRoomView }) {
  const trackEntity = useEntity(asEntityName(thermostatTrackEntityId(room)), { returnNullIfNotFound: true })
  if (trackEntity?.state === 'on') return null
  return <ThermostatCheckbox entityId={thermostatForceCriticalEntityId(room)} showState={false} title={room.title} />
}

function ThermostatTrackSection() {
  const trackSelected = useEntity(asEntityName('switch.thermostat_contact_sensors_only_track_selected_rooms'), { returnNullIfNotFound: true })
  const criticalTracking = useEntity(asEntityName('select.thermostat_contact_sensors_eco_mode_critical_tracking'), { returnNullIfNotFound: true })
  const showSelectedRooms = trackSelected?.state === 'on'
  const showCriticalRooms = showSelectedRooms && criticalTracking?.state === 'Track Select Critical'

  return (
    <>
      <section className={styles.section}>
        <SectionHeader title="Track Selected Rooms" />
        <Description className={styles.thermostatDescription}>{THERMOSTAT_SECTION_DESCRIPTIONS.trackSelected}</Description>
        <ThermostatSwitchCard entityId="switch.thermostat_contact_sensors_only_track_selected_rooms" icon="mdi:home-thermometer" title="Track Selected Rooms" />
        {showSelectedRooms && (
          <div className={styles.thermostatCheckboxGrid}>
            {THERMOSTAT_ROOM_VIEWS.map((room) => <ThermostatTrackCheckbox key={room.key} room={room} />)}
          </div>
        )}
      </section>
      {showCriticalRooms && (
        <section className={styles.section}>
          <SectionHeader title="Force Track Critical Temperature" />
          <Description className={styles.thermostatDescription}>{THERMOSTAT_SECTION_DESCRIPTIONS.forceCritical}</Description>
          <div className={styles.thermostatCheckboxGrid}>
            {THERMOSTAT_ROOM_VIEWS.map((room) => <ThermostatForceCheckbox key={room.key} room={room} />)}
          </div>
        </section>
      )}
    </>
  )
}

function OpenContactSensorCard({ entityId, title }: { entityId: string; title: string }) {
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true })
  if (!entity || !isContactOpen(entity)) return null
  return <ContactSensorCard entityId={entityId} size="compact" title={title} />
}

function OpenContactSensorsSection() {
  const aggregate = useEntity(asEntityName('binary_sensor.contact_sensors'), { returnNullIfNotFound: true })
  if (!isContactOpen(aggregate)) return null

  return (
    <section className={styles.section}>
      <SectionHeader title="Open Contact Sensors" />
      <Grid>
        {THERMOSTAT_CONTACT_SENSORS.map((sensor) => <OpenContactSensorCard entityId={sensor.entityId} key={sensor.entityId} title={sensor.title} />)}
      </Grid>
    </section>
  )
}

function ThermostatRoomModal({ onClose, room }: { onClose: () => void; room: ThermostatRoomView | null }) {
  const awayMode = useEntity(asEntityName('binary_sensor.thermostat_contact_sensors_away_mode_active'), { returnNullIfNotFound: true })
  const title = room?.title ?? 'Thermostat'
  const ventTitle = room ? `${room.title} ${room.ventEntityIds.length > 1 ? 'Vents' : 'Vent'}` : 'Vents'

  return (
    <ModalSheet onClose={onClose} open={Boolean(room)} surface="hass-popup" title={title}>
      {room && (
        <div className={styles.thermostatModalBody}>
          <ThermostatDial entityId={room.climateEntityId} size="modal" title={room.title} />
          {awayMode?.state === 'on' && <Notice>Away Mode Active. The room may be cooler or warmer than your heat/cool targets to save energy while away.</Notice>}
          <section className={styles.section}>
            <SectionHeader title={ventTitle} />
            <Grid>
              {room.ventEntityIds.map((entityId, index) => <ClimateCard entityId={entityId} icon="vent" key={entityId} size="compact" title={room.ventEntityIds.length > 1 ? `Vent ${index + 1}` : 'Vent'} />)}
            </Grid>
          </section>
        </div>
      )}
    </ModalSheet>
  )
}

function ThermostatPage() {
  const { closeHash, hash, openHash } = useHashModal()
  const selectedRoom = THERMOSTAT_ROOM_VIEWS.find((room) => room.hash === hash) ?? null

  return (
    <div className={`${styles.stack} ${styles.thermostatPage}`}>
      <section className={styles.section}>
        <SectionHeader title="Whole Home" />
        <ThermostatDial entityId={GLOBAL_THERMOSTAT_ENTITY_ID} title="Whole Home" />
        <ThermostatHubPill />
      </section>
      <OpenContactSensorsSection />
      <section className={styles.section}>
        <SectionHeader title="Rooms" />
        <div className={styles.thermostatRoomGrid}>
          {THERMOSTAT_ROOM_VIEWS.map((room) => <ThermostatRoomRow key={room.key} onOpen={openHash} room={room} />)}
        </div>
      </section>
      <section className={styles.section}>
        <SectionHeader title="Eco Mode" />
        <Description className={styles.thermostatDescription}>{THERMOSTAT_SECTION_DESCRIPTIONS.ecoMode}</Description>
        <ThermostatSwitchCard entityId="switch.thermostat_contact_sensors_eco_mode" icon="mdi:leaf" title="Eco Mode">
          <ThermostatSelectButton entityId="select.thermostat_contact_sensors_eco_mode_critical_tracking" icon="mdi:thermometer-alert" title="Eco Mode Critical Tracking" />
          <ThermostatSelectButton entityId="select.thermostat_contact_sensors_eco_behavior_when_away" icon="mdi:leaf-circle" title="Eco Behavior When Away" />
        </ThermostatSwitchCard>
      </section>
      <ThermostatTrackSection />
      <section className={styles.section}>
        <SectionHeader title="Automatic Thermostat" />
        <Description className={styles.thermostatDescription}>{THERMOSTAT_SECTION_DESCRIPTIONS.integration}</Description>
        <ThermostatSwitchCard entityId="input_boolean.enable_disable_thermostat_contact_sensors_integration" icon="mdi:thermostat" title="Automatic Thermostat" />
      </section>
      <ThermostatRoomModal onClose={closeHash} room={selectedRoom} />
    </div>
  )
}

function ControlPage({ onNavigate, path }: { onNavigate: (path: string) => void; path: string }) {
  const config = CONTROL_PAGES[path]
  if (!config) return null
  return <EntitySections onNavigate={onNavigate} sections={config.sections} />
}

function FallbackPage({ title }: { title: string }) {
  return <Notice>{title} is represented in the porting map, but this route still needs a dedicated React view.</Notice>
}

function Content({ onNavigate, path }: { onNavigate: (path: string) => void; path: string }) {
  const roomTitle = roomNameFromPath(path)
  if (roomTitle) return <RoomPage onNavigate={onNavigate} path={path} title={roomTitle} />
  if (TODO_PAGES[path]) return <TodoPage path={path} />
  if (path === 'security') return <SecurityPage />
  if (path === 'vacuums') return <VacuumPage />
  if (path === 'media') return <MediaPage onNavigate={onNavigate} />
  if (path === 'admin') return <AdminPage onNavigate={onNavigate} />
  if (path === 'ecobee') return <ThermostatPage />
  if (CONTROL_PAGES[path]) return <ControlPage onNavigate={onNavigate} path={path} />
  return <FallbackPage title={routeTitle(path)} />
}

export function DashboardViewPage({ activePath, onNavigate, path }: DashboardViewPageProps) {
  const roomTitle = roomNameFromPath(path)
  const title = roomTitle ?? TODO_PAGES[path]?.title ?? CONTROL_PAGES[path]?.title ?? routeTitle(path)
  const showBack = !PRIMARY_NAV_ROUTES.some((route) => route.path === path)

  if (path === 'guests-staying-over') {
    return (
      <AppShell bottomNav={<BottomNav activePath={activePath} onNavigate={onNavigate} />}>
        <GuestControlsPage onNavigate={onNavigate} />
      </AppShell>
    )
  }

  if (path === 'settings') {
    return (
      <AppShell bottomNav={<BottomNav activePath={activePath} onNavigate={onNavigate} />}>
        <SettingsPage onNavigate={onNavigate} />
      </AppShell>
    )
  }

  return (
    <AppShell bottomNav={<BottomNav activePath={activePath} onNavigate={onNavigate} />}>
      <Page activePath={activePath} backPath={showBack ? 'overview' : undefined} headerQuickLinks={roomTitle ? <RoomSectionRail path={path} title={roomTitle} /> : undefined} onNavigate={onNavigate} title={title}>
        <Content onNavigate={onNavigate} path={path} />
      </Page>
    </AppShell>
  )
}
