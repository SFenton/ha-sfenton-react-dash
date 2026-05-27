import { useEffect, useState, type ReactNode } from 'react'
import { useEntity } from '@hakit/core'
import { ClimateCard } from '../components/cards/ClimateCard'
import { ContactSensorCard } from '../components/cards/ContactSensorCard'
import { LightCard } from '../components/cards/LightCard'
import { OccupancyCard } from '../components/cards/OccupancyCard'
import { AppShell } from '../components/shell/AppShell'
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
import { MaterialIcon } from '../components/core/Icon'
import { ModalSheet } from '../components/core/ModalSheet'
import { SectionHeader } from '../components/core/SectionHeader'
import { asEntityName, formatCompactEntityState, isActiveState } from '../components/hass/entityState'
import { useHashModal } from '../hooks/useHashModal'
import {
  AREA_ITEMS,
  CLIMATE_GROUPS,
  CONTACT_GROUPS,
  LIGHT_GROUPS,
  OCCUPANCY_GROUPS,
  type EntityGroupConfig,
} from '../constants/atAGlance'
import { DASHBOARD_ROUTES } from '../constants/routes'
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
  window.history.replaceState(null, '', `${window.location.pathname}${hash}`)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

function toneForSourceKind(kind: RoomSourceKind): StatusRailChip['tone'] {
  if (kind === 'light') return 'light'
  if (kind === 'air') return 'air'
  if (kind === 'climate' || kind === 'vent' || kind === 'fan') return 'climate'
  if (kind === 'occupancy') return 'presence'
  if (kind === 'contact') return 'contact'
  if (kind === 'vacuum') return 'vacuum'
  if (kind === 'media') return 'media'
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

function RoomSourceCard({ card, onOpen }: { card: RoomSourceCardConfig; onOpen: (card: RoomSourceCardConfig) => void }) {
  const alternateGate = useEntity(asEntityName(card.alternate?.whenEntityId ?? card.entityId), { returnNullIfNotFound: true })
  const useAlternate = Boolean(card.alternate && alternateGate && card.alternate.whenStates.includes(alternateGate.state))
  const effectiveEntityId = useAlternate ? card.alternate?.entityId ?? card.entityId : card.entityId
  const effectiveShowState = useAlternate ? card.alternate?.showState : card.showState
  const effectiveSubtitleEntityIds = useAlternate ? card.alternate?.subtitleEntityIds : card.subtitleEntityIds
  const entity = useEntity(asEntityName(effectiveEntityId), { returnNullIfNotFound: true })
  const subtitleEntityOne = useEntity(asEntityName(effectiveSubtitleEntityIds?.[0] ?? effectiveEntityId), { returnNullIfNotFound: true })
  const subtitleEntityTwo = useEntity(asEntityName(effectiveSubtitleEntityIds?.[1] ?? effectiveEntityId), { returnNullIfNotFound: true })
  const unavailable = isUnavailable(entity)
  const disabledByState = Boolean(entity && card.disabledStates?.includes(entity.state))
  const subtitle = effectiveSubtitleEntityIds
    ? [subtitleEntityOne, subtitleEntityTwo].slice(0, effectiveSubtitleEntityIds.length).map((subtitleEntity) => formatCompactEntityState(subtitleEntity, 'Unavailable')).join(' • ')
    : effectiveShowState ? formatCompactEntityState(entity, 'Unavailable') : undefined
  const clickable = Boolean(card.hash || card.manualReview) && !unavailable && !disabledByState
  const inactiveMuted = !unavailable && !isActiveState(entity) && ['fan', 'grill', 'light', 'media', 'power'].includes(card.kind)

  return (
    <Card
      ariaLabel={subtitle ? `${card.title} ${subtitle}` : card.title}
      color={unavailable ? UNAVAILABLE_COLOR : sourceColor(card.kind)}
      disabled={unavailable}
      icon={<SourceCardIcon card={card} />}
      muted={unavailable || disabledByState || inactiveMuted}
      onClick={clickable ? () => onOpen(card) : undefined}
      size="compact"
      subtitle={subtitle}
      title={card.title}
    />
  )
}

function RoomSourceModal({ card, onClose, roomTitle }: { card: RoomSourceCardConfig | null; onClose: () => void; roomTitle: string }) {
  const content = card ? renderRoomReusableSheet(card, roomTitle) : null

  return (
    <ModalSheet onClose={onClose} open={Boolean(card)} title={card ? `${roomTitle}: ${card.title}` : roomTitle}>
      {card && (content ?? <RoomSourceFallback card={card} />)}
    </ModalSheet>
  )
}

function SourceRoomPage({ room }: { room: (typeof ROOM_PAGE_CONFIGS)[string] }) {
  const [selectedCard, setSelectedCard] = useState<RoomSourceCardConfig | null>(null)

  const closeSourceCard = () => {
    setSelectedCard(null)
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }

  useEffect(() => {
    const allCards = [...room.overviewCards, ...room.sourceSections.flatMap((section) => section.cards)]
    const syncFromHash = () => {
      const card = allCards.find((candidate) => candidate.hash === window.location.hash)
      setSelectedCard(card ?? null)
    }

    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [room.overviewCards, room.sourceSections])

  const openSourceCard = (card: RoomSourceCardConfig) => {
    if (card.hash) setRoomHash(card.hash)
    else setSelectedCard(card)
  }

  return (
    <div className={styles.stack}>
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
      <header className={styles.settingsHeader}>
        <span aria-hidden="true" className={styles.settingsHeaderIcon}>
          <MaterialIcon name="mdi:cog" size={32} />
        </span>
        <h1>Settings</h1>
      </header>
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
      <header className={styles.guestHeader}>
        <button aria-label="Back to overview" className={styles.guestBackButton} onClick={() => onNavigate('overview')} type="button">
          <MaterialIcon name="mdi:chevron-left" size={36} />
        </button>
        <h1>Guest Controls</h1>
      </header>

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

function ThermostatPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <div className={styles.stack}>
      <Notice tone="review">Thermostat controls are ported as state cards and room drill-ins for now. The original HASS thermostat UX is dense and should be manually reviewed before replacing it.</Notice>
      <section className={styles.section}>
        <SectionHeader title="Whole Home" />
        <Grid>
          <ClimateCard entityId="climate.thermostat_contact_sensors_global_virtual_thermostat" icon={<MaterialIcon name="mdi:thermostat" size={38} />} size="compact" title="Whole Home" />
          <ClimateCard entityId="climate.thermostat_hub_w200" icon={<MaterialIcon name="mdi:thermostat" size={38} />} size="compact" title="Thermostat Hub" />
        </Grid>
      </section>
      <section className={styles.section}>
        <SectionHeader title="Rooms" />
        <Grid>
          {THERMOSTAT_ROOMS.map((room) => (
            <EntityActionCard
              item={{ title: room.title, entityId: room.climateEntityId, icon: 'mdi:thermostat', color: CLIMATE_COLOR, action: { type: 'navigate', path: room.title.toLowerCase().replaceAll(' ', '-') }, manualReview: true }}
              key={room.climateEntityId}
              onNavigate={onNavigate}
            />
          ))}
        </Grid>
      </section>
      <section className={styles.section}>
        <SectionHeader title="Automatic Thermostat" />
        <Grid>
          <EntityActionCard item={{ title: 'Eco Mode', entityId: 'switch.thermostat_contact_sensors_eco_mode', icon: 'mdi:leaf', color: CLIMATE_COLOR, action: { type: 'toggle' }, manualReview: true }} onNavigate={onNavigate} />
          <EntityActionCard item={{ title: 'Track Selected Rooms', entityId: 'switch.thermostat_contact_sensors_only_track_selected_rooms', icon: 'mdi:map-marker-check', color: CLIMATE_COLOR, action: { type: 'toggle' }, manualReview: true }} onNavigate={onNavigate} />
          <EntityActionCard item={{ title: 'Integration Enabled', entityId: 'input_boolean.enable_disable_thermostat_contact_sensors_integration', icon: 'mdi:home-thermometer', color: CLIMATE_COLOR, action: { type: 'toggle' }, manualReview: true }} onNavigate={onNavigate} />
        </Grid>
      </section>
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
  if (path === 'ecobee') return <ThermostatPage onNavigate={onNavigate} />
  if (CONTROL_PAGES[path]) return <ControlPage onNavigate={onNavigate} path={path} />
  return <FallbackPage title={routeTitle(path)} />
}

export function DashboardViewPage({ activePath, onNavigate, path }: DashboardViewPageProps) {
  const roomTitle = roomNameFromPath(path)
  const title = roomTitle ?? TODO_PAGES[path]?.title ?? CONTROL_PAGES[path]?.title ?? routeTitle(path)

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
      <Page headerQuickLinks={roomTitle ? <RoomSectionRail path={path} title={roomTitle} /> : undefined} title={title}>
        <Content onNavigate={onNavigate} path={path} />
      </Page>
    </AppShell>
  )
}