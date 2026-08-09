import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { useEntity, useHass, useUser } from '@hakit/core'
import type { HassEntity } from 'home-assistant-js-websocket'
import { ClimateCard } from '../components/cards/ClimateCard'
import { ContactSensorCard } from '../components/cards/ContactSensorCard'
import { LightCard } from '../components/cards/LightCard'
import { OccupancyCard } from '../components/cards/OccupancyCard'
import { AppShell } from '../components/shell/AppShell'
import { BottomNav } from '../components/shell/BottomNav'
import { DashboardPageLoading, type DashboardPageLoadingPhase } from '../components/shell/DashboardPageLoading'
import { DashboardFloatingAction } from '../components/shell/DashboardFloatingAction'
import { dashboardRoomNameFromPath, hasDashboardFloatingAction } from '../components/shell/dashboardFloatingAction'
import { EntityActionCard } from '../components/hass/EntityActionCard'
import { PresenceOverrideCard, PresenceOverrideDetailPage } from '../components/hass/PresenceOverrideCard'
import { SecurityDashboard, SecurityStatusRail } from '../components/hass/SecurityDashboard'
import { StatusRail, type StatusRailChip } from '../components/hass/StatusRail'
import { TodoListPanel } from '../components/hass/TodoListPanel'
import { CreateDonetickTaskSheet } from '../components/hass/CreateDonetickTaskSheet'
import type { DonetickTaskEditTarget } from '../components/hass/donetickTaskForm'
import { EverShelfInventoryPanel, type EverShelfInventoryLocation } from '../components/hass/EverShelfInventoryPanel'
import { useEverShelfInventoryControls, type EverShelfInventoryControls } from '../components/hass/EverShelfInventoryControls'
import type { RecipeControls } from '../components/hass/recipes/useRecipeControls'
import { useRecipeControls } from '../components/hass/recipes/useRecipeControls'
import { VacuumAutoCleanControlCard } from '../components/hass/VacuumAutoCleanControls'
import { VacuumCard, VacuumModal, VacuumRoomSourceModalContent } from '../components/hass/VacuumCard'
import { VACUUM_MODAL_STYLE } from '../components/hass/vacuumModalStyle'
import { AirQualityModalContent } from '../components/hass/AirQualityModalContent'
import { GrillModalContent } from '../components/hass/GrillModalContent'
import { HumidifierModal, HumidifierModalContent } from '../components/hass/HumidifierModalContent'
import { MediaRemoteModalContent, MediaRemoteModalNav, type MediaRemoteModalTab } from '../components/hass/MediaRemoteModalContent'
import { MEDIA_REMOTE_MODAL_STYLE } from '../components/hass/mediaRemoteModalStyle'
import { BedTemperatureScopePrompt } from '../components/hass/BedTemperatureScopePrompt'
import { CircularControlDial } from '../components/hass/CircularControlDial'
import { SleepypodActiveAlarmSection } from '../components/hass/SleepypodActiveAlarmSection'
import { isSleepypodAlarmActive, sleepypodAlarmState, sleepypodAlarmStatusText } from '../components/hass/sleepypodAlarmState'
import {
  SLEEPYPOD_SCHEDULE_PHASE_ENTITY_IDS,
  sleepypodOutsideScheduleTemperatureService,
  sleepypodSchedulePhase,
  sleepypodSchedulePhaseAvailable,
  sleepypodTemperatureScopeService,
  type SleepypodSchedulePhase,
  type SleepypodTemperatureScope,
} from '../components/hass/bedTemperatureScope'
import { Card, type CardColor } from '../components/core/Card'
import { CheckboxRow } from '../components/core/CheckboxRow'
import { Description } from '../components/core/Description'
import { DynamicGrid } from '../components/core/DynamicGrid'
import { EmptyState } from '../components/core/EmptyState'
import { GlassTile } from '../components/core/GlassTile'
import { MaterialIcon } from '../components/core/Icon'
import { InlineAlert } from '../components/core/InlineAlert'
import { ModalSheet, type ModalSheetStyle } from '../components/core/ModalSheet'
import { ModalDisclosureIcon } from '../components/core/ModalDisclosureIcon'
import { ModalOpenerRow } from '../components/core/ModalOpenerRow'
import { NativePickerField } from '../components/core/NativePickerField'
import { OptionPickerDialog, type PickerOption } from '../components/core/OptionPickerDialog'
import { ScheduleEditorFields } from '../components/core/ScheduleEditorFields'
import { resolveScheduleDefaultDays } from '../components/core/scheduleDays'
import { ScheduleCollection, ScheduleDetailFooter, ScheduleListRow } from '../components/core/ScheduleFlow'
import { isValidScheduleTime } from '../components/core/scheduleTime'
import { SectionHeader } from '../components/core/SectionHeader'
import { Stepper } from '../components/core/Stepper'
import { ToggleControl } from '../components/core/ToggleControl'
import { ToggleSetting } from '../components/core/ToggleSetting'
import { derivedAirPurifierEntityIds, formatAirQualitySummary } from '../components/hass/airQualityState'
import { resolveEntityAction, type EntityActionStateMap } from '../components/hass/entityActions'
import { asEntityName, formatCompactEntityState, formatContactEntityState, isActiveState, isContactOpen, isOccupancyActive, titleCaseState } from '../components/hass/entityState'
import { DASHBOARD_ROUTE_CHANGE_EVENT, dashboardEventTargets, dashboardHash, dashboardPathWithSearch, replaceDashboardUrl } from '../hooks/dashboardLocation'
import { useHashModal } from '../hooks/useHashModal'
import { useModalDetailPageScroll } from '../hooks/useModalDetailPageScroll'
import { useOptimisticState } from '../hooks/useOptimisticState'
import { useScheduleDetailPage } from '../hooks/useScheduleDetailPage'
import { useImmediateVisualTab, useSmoothDisplayedModalTab } from '../hooks/useSmoothDisplayedModalTab'
import { useTodoOptimisticStatuses } from '../hooks/useTodoOptimisticStatuses'
import {
  CLIMATE_GROUPS,
  CONTACT_GROUPS,
  LIGHT_GROUPS,
  OCCUPANCY_GROUPS,
  type EntityGroupConfig,
} from '../constants/atAGlance'
import { DASHBOARD_ROUTES, HOME_ALL_FOOD_ROUTE_PATH, HOME_CABINET_ROUTE_PATH, HOME_FOOD_ROUTE_PATH, HOME_FREEZER_ROUTE_PATH, HOME_FRIDGE_ROUTE_PATH, HOME_GROCERY_LIST_ROUTE_PATH, HOME_PANTRY_ROUTE_PATH, HOME_RECIPES_ROUTE_PATH, HOME_SPICE_RACK_ROUTE_PATH, fallbackBackPathForRoute } from '../constants/routes'
import {
  ADMIN_AUTO_REENABLE_ITEMS,
  CHORE_QUICK_LINKS,
  ADMIN_DESCRIPTIONS,
  ADMIN_PRESENCE_OVERRIDE_ITEMS,
  ADMIN_RELAY_CONTROL_ITEMS,
  ADMIN_SECURITY_CONTROLS,
  ADMIN_SHOW_SPECIFIC_CONTROLS,
  CLIMATE_COLOR,
  CONTROL_COLOR,
  CONTROL_PAGES,
  GUEST_CONTROLS_DESCRIPTION,
  GUEST_CONTROL_ITEMS,
  MEDIA_COLOR,
  NEUTRAL_COLOR,
  MEDIA_SECTIONS,
  ROOM_EXTRA_SECTIONS,
  SECURITY_COLOR,
  SETTINGS_PAGE_ITEMS,
  THERMOSTAT_ROOMS,
  TODO_PAGES,
  UNAVAILABLE_COLOR,
  SWITCH_ACTIVE_COLOR,
  VACATION_DATE_RANGE_ERROR,
  VACATION_DATES_DESCRIPTION,
  VACATION_END_ENTITY_ID,
  VACATION_INVALID_DATES_PENDING_ENTITY_ID,
  VACATION_MODE_DESCRIPTION,
  VACATION_EMPTY_DESCRIPTION,
  VACATION_MODE_ENTITY_ID,
  VACATION_MODE_ITEMS,
  VACATION_PRE_CHECKLIST_ERROR,
  VACATION_PRE_CHECKLIST_ITEMS,
  VACATION_START_ENTITY_ID,
  VACUUM_COLOR,
  VACUUMS,
  type TodoListConfig,
  type TodoPageConfig,
  type EntitySectionConfig,
  type PresenceOverrideConfig,
  type SettingsLinkConfig,
} from '../constants/portedDashboard'
import { choreQuickLinkCounts, choreQuickLinkSubtitle, groceryCountSubtitle } from '../constants/choreQuickLinkCounts'
import { FOOD_CARD_BACKGROUND_COLOR, foodSummarySubtitle } from '../constants/everShelfFood'
import { modalSquareGridModalStyle, modalSquareGridStyle, type ModalSquareGridStyle, useModalSquareGridLayout } from './modalSquareGrid'
import { ROOM_PAGE_CONFIGS, type RoomSourceCardAction, type RoomSourceCardConfig, type RoomSourceKind, type RoomSourceModalItem } from '../constants/roomPages'
import { humidifierForPowerEntity, type HumidifierConfig } from '../constants/humidifiers'
import { MEDIA_REMOTE_CONFIGS } from '../constants/mediaRemotes'
import { VACUUM_AUTO_CLEAN_CONTROLS } from '../constants/vacuumAutoClean'
import {
  THERMOSTAT_MODAL_DIAL_GUTTER_PX,
  thermostatPointIsOnRing,
  thermostatRawValueFromPoint,
  thermostatValueFromPoint,
} from '../components/hass/thermostatDialGeometry'
import { Page } from './Page'
import { ClimateSheet, ContactSheet, LightsSheet, OccupancySheet } from './AtAGlancePage'
import { CustomLightsPage } from './CustomLightsPage'
import { FoodHubPage } from './FoodHubPage'
import { RecipesPage } from './RecipesPage'
import styles from './DashboardViewPage.module.css'

interface DashboardViewPageProps {
  activePath: string
  onNavigate: (path: string) => void
  onBack?: (fallbackPath?: string) => void
  initialContentTransitionState?: 'entering' | 'idle' | 'pre-entering'
  inventoryControls?: EverShelfInventoryControls
  loadingPhase?: DashboardPageLoadingPhase
  path: string
  preload?: boolean
  preloadHash?: string
  preloadHashes?: string[]
  recipeControls?: RecipeControls
  withShell?: boolean
}

function routeTitle(path: string) {
  return DASHBOARD_ROUTES.find((route) => route.path === path)?.title ?? 'Dashboard'
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

function RoomGrid({ ariaLabel, children }: { ariaLabel: string; children: ReactNode }) {
  return <DynamicGrid ariaLabel={ariaLabel} className={styles.roomGrid} columns={2}>{children}</DynamicGrid>
}

const VACUUM_AUTO_CLEAN_TITLE_ORDER = new Map(VACUUM_AUTO_CLEAN_CONTROLS.map((control, index) => [control.title, index]))
const ORDERED_VACUUMS = [...VACUUMS].sort((first, second) => {
  const firstOrder = VACUUM_AUTO_CLEAN_TITLE_ORDER.get(first.title) ?? Number.MAX_SAFE_INTEGER
  const secondOrder = VACUUM_AUTO_CLEAN_TITLE_ORDER.get(second.title) ?? Number.MAX_SAFE_INTEGER
  return firstOrder - secondOrder || first.title.localeCompare(second.title)
})

const SECURITY_SIZED_ROOM_SOURCE_KINDS = new Set<RoomSourceKind>(['air', 'climate', 'contact', 'light', 'occupancy', 'vent'])

const ROOM_SOURCE_SECURITY_SIZED_MODAL_STYLE: ModalSheetStyle = {
  '--modal-desktop-height': 'auto',
  '--modal-desktop-max-width': '500px',
  '--modal-desktop-width': '500px',
}

const DISHWASHER_ENTITY_IDS = {
  activeProgram: 'select.dishwasher_active_program',
  cleanUnopened: 'input_boolean.dishwasher_clean_unopened',
  connectivity: 'binary_sensor.dishwasher_connectivity',
  door: 'sensor.dishwasher_door',
  halfLoad: 'switch.dishwasher_half_load',
  hygiene: 'switch.dishwasher_hygiene',
  operation: 'sensor.dishwasher_operation_state',
  power: 'switch.dishwasher_power',
  progress: 'sensor.dishwasher_program_progress',
  programFinishTime: 'sensor.dishwasher_program_finish_time',
  remoteControl: 'binary_sensor.dishwasher_remote_control',
  remoteStart: 'binary_sensor.dishwasher_remote_start',
  resumeProgram: 'button.dishwasher_resume_program',
  rinseAid: 'sensor.dishwasher_rinse_aid_nearly_empty',
  salt: 'sensor.dishwasher_salt_nearly_empty',
  selectedProgram: 'select.dishwasher_selected_program',
  startProgram: 'input_button.start_dishwasher',
  stopProgram: 'button.dishwasher_stop_program',
  zeoliteDry: 'switch.dishwasher_zeolite_dry',
} as const

const DISHWASHER_PROGRESS_COLOR = 'linear-gradient(90deg, rgba(0, 188, 174, 0.72), rgba(0, 150, 136, 0.58))'
const DISHWASHER_OPTIMISTIC_REVERT_MS = 10000
const DISHWASHER_PROGRESS_STATES = new Set(['run', 'pause', 'actionrequired', 'aborting', 'finished'])
const DISHWASHER_RESUME_ACTION_STATES = new Set(['actionrequired', 'pause'])
const DISHWASHER_STOP_ACTION_STATES = new Set(['actionrequired', 'delayedstart', 'pause', 'run'])

const DISHWASHER_OPERATION_LABELS: Record<string, string> = {
  aborting: 'Stopping',
  actionrequired: 'Needs Attention',
  delayedstart: 'Delayed Start',
  error: 'Error',
  finished: 'Clean',
  inactive: 'Not Running',
  pause: 'Paused',
  ready: 'Not Running',
  run: 'Cleaning',
}

const DISHWASHER_PROGRAM_LABELS: Record<string, string> = {
  dishcare_dishwasher_program_auto_2: 'Auto',
  dishcare_dishwasher_program_eco_50: 'Eco 50',
  dishcare_dishwasher_program_glas_40: 'Glass 40',
  dishcare_dishwasher_program_intensiv_70: 'Intensive 70',
  dishcare_dishwasher_program_machine_care: 'Machine Care',
  dishcare_dishwasher_program_pre_rinse: 'Pre-Rinse',
  dishcare_dishwasher_program_quick_45: 'Quick 45',
  dishcare_dishwasher_program_quick_65: 'Quick 65',
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className={styles.notice}>{children}</div>
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

function AdminModalGrid({ children, label, squareGridRef, squareGridStyle }: { children: ReactNode; label?: string; squareGridRef?: (node: HTMLElement | null) => void; squareGridStyle?: ModalSquareGridStyle }) {
  return <div aria-label={label} className={squareGridStyle ? styles.adminSquareGrid : styles.adminModalGrid} ref={squareGridRef} role={label ? 'group' : undefined} style={squareGridStyle}>{children}</div>
}

function AdminHashButton({ hash, onOpen, title }: { hash: string; onOpen: (hash: string) => void; title: string }) {
  return <ModalOpenerRow onClick={() => onOpen(hash)} title={title} tone="switch-active" variant="wide" />
}

const LIVING_ROOM_POWER_RECOVERY_AUTOMATION = 'automation.attempt_to_turn_power_back_on_in_living_room'

function LivingRoomPowerRecoveryButton() {
  const callService = useCallService()
  const title = 'Attempt to turn power back on'

  return (
    <button
      aria-label={`${title} in Living Room`}
      className={styles.adminAutomationButton}
      data-automation-target={LIVING_ROOM_POWER_RECOVERY_AUTOMATION}
      onClick={() => callService({ domain: 'automation', service: 'trigger', target: LIVING_ROOM_POWER_RECOVERY_AUTOMATION })}
      type="button"
    >
      <span aria-hidden="true" className={styles.adminAutomationButtonIcon}>
        <MaterialIcon name="mdi:flash" size={30} />
      </span>
      <span className={styles.adminAutomationButtonCopy}>
        <span className={styles.adminAutomationButtonTitle}>{title}</span>
      </span>
    </button>
  )
}

function AdminTileGrid({ gridLabel, items, onNavigate, squareGridRef, squareGridStyle, variant = 'wide' }: { gridLabel?: string; items: EntitySectionConfig['items']; onNavigate: (path: string) => void; squareGridRef?: (node: HTMLElement | null) => void; squareGridStyle?: ModalSquareGridStyle; variant?: 'admin-modal' | 'compact' | 'wide' }) {
  const cards = items.map((item) => (
    <EntityActionCard item={item} key={`${item.entityId}-${item.title}`} onNavigate={onNavigate} size={variant} />
  ))
  if (variant === 'wide') return <AdminWideGrid>{cards}</AdminWideGrid>
  if (variant === 'admin-modal') return <AdminModalGrid label={gridLabel} squareGridRef={squareGridRef} squareGridStyle={squareGridStyle}>{cards}</AdminModalGrid>
  return <Grid>{cards}</Grid>
}

function AdminPresenceOverrideGrid({ gridLabel, items, onSelect, squareGridRef, squareGridStyle }: { gridLabel: string; items: PresenceOverrideConfig[]; onSelect: (item: PresenceOverrideConfig) => void; squareGridRef?: (node: HTMLElement | null) => void; squareGridStyle?: ModalSquareGridStyle }) {
  return (
    <AdminModalGrid label={gridLabel} squareGridRef={squareGridRef} squareGridStyle={squareGridStyle}>
      {items.map((item) => <PresenceOverrideCard item={item} key={`${item.entityId}-${item.title}`} onSelect={onSelect} />)}
    </AdminModalGrid>
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
  if (kind === 'climate' || kind === 'vent' || kind === 'fan' || kind === 'humidifier') return 'climate'
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
  if (kind === 'climate' || kind === 'air' || kind === 'vent' || kind === 'fan' || kind === 'humidifier') return CLIMATE_COLOR
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

function snapshotEntity(entity: ReturnType<typeof useEntity>): ReturnType<typeof useEntity> {
  if (!entity) return entity
  return { ...entity, attributes: { ...entity.attributes } } as ReturnType<typeof useEntity>
}

function useRecentAvailableEntity(entity: ReturnType<typeof useEntity>, holdMs: number) {
  const [stableEntity, setStableEntity] = useState(() => snapshotEntity(entity))
  const [trackedState, setTrackedState] = useState(entity?.state)
  const timerRef = useRef<number | null>(null)
  const entityState = entity?.state

  const clearTimer = useCallback(() => {
    if (timerRef.current === null) return
    window.clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  if (entityState !== trackedState) {
    setTrackedState(entityState)
    if (!isUnavailable(entity)) setStableEntity(snapshotEntity(entity))
  }

  useEffect(() => clearTimer, [clearTimer])

  useEffect(() => {
    clearTimer()
    if (!isUnavailable(entity)) return

    const entitySnapshot = snapshotEntity(entity)
    timerRef.current = window.setTimeout(() => {
      setStableEntity(entitySnapshot)
      timerRef.current = null
    }, holdMs)
  }, [clearTimer, entity, entity?.state, holdMs])

  return isUnavailable(entity) ? stableEntity : entity
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

function formatRoomSourceSubtitleEntity(entity: HassEntity | null | undefined) {
  const value = formatCompactEntityState(entity ?? null, 'Unavailable')
  const unit = typeof entity?.attributes.unit_of_measurement === 'string' ? entity.attributes.unit_of_measurement : ''
  if (!unit || value === 'Unavailable' || value === 'Unknown' || value.endsWith(unit)) return value
  return `${value}${unit}`
}

function isDishwasherSourceCard(card: RoomSourceCardConfig) {
  return card.entityId === DISHWASHER_ENTITY_IDS.selectedProgram
}

function dishwasherEntityUnavailable(entity: HassEntity | null | undefined) {
  return !dishwasherEntityAvailable(entity)
}

function dishwasherEntityAvailable(entity: HassEntity | null | undefined): entity is HassEntity {
  return Boolean(entity && entity.state !== 'unavailable' && entity.state !== 'unknown')
}

function dishwasherProgressPercent(entity: HassEntity | null | undefined) {
  if (!dishwasherEntityAvailable(entity)) return undefined
  const progress = Number.parseFloat(String(entity.state).replace('%', ''))
  if (!Number.isFinite(progress)) return undefined
  return Math.max(0, Math.min(100, progress))
}

function formatDishwasherOperation(entity: HassEntity | null | undefined) {
  if (!dishwasherEntityAvailable(entity)) return 'Unavailable'
  return formatDishwasherOperationState(entity.state)
}

function formatDishwasherOperationState(state: string | null | undefined) {
  if (!state || state === 'unavailable' || state === 'unknown') return 'Unavailable'
  return DISHWASHER_OPERATION_LABELS[state] ?? titleCaseState(state)
}

function dishwasherProgressFillPercent(operationEntity: HassEntity | null | undefined, progressEntity: HassEntity | null | undefined) {
  return dishwasherProgressFillPercentForState(operationEntity?.state, progressEntity)
}

function dishwasherProgressFillPercentForState(operationState: string | null | undefined, progressEntity: HassEntity | null | undefined) {
  if (!operationState || !DISHWASHER_PROGRESS_STATES.has(operationState)) return undefined
  return dishwasherProgressPercent(progressEntity)
}

function dishwasherCleanUnopened(entity: HassEntity | null | undefined) {
  return entity?.state === 'on'
}

function formatDishwasherSummary(operationEntity: HassEntity | null | undefined, progressEntity: HassEntity | null | undefined, cleanUnopenedEntity?: HassEntity | null | undefined) {
  return formatDishwasherSummaryForState(operationEntity?.state, progressEntity, dishwasherCleanUnopened(cleanUnopenedEntity))
}

function formatDishwasherSummaryForState(operationState: string | null | undefined, progressEntity: HassEntity | null | undefined, cleanUnopened = false) {
  const operation = formatDishwasherOperationState(operationState)
  const progress = dishwasherProgressFillPercentForState(operationState, progressEntity)
  if (progress === undefined && cleanUnopened && operation !== 'Clean' && operation !== 'Unavailable') return `${operation} • Clean`
  return progress === undefined ? operation : `${operation} • ${Math.round(progress)}%`
}

function formatDishwasherProgram(value: unknown) {
  const rawValue = String(value ?? '')
  if (!rawValue || rawValue === 'unknown' || rawValue === 'unavailable') return 'Unavailable'
  const mapped = DISHWASHER_PROGRAM_LABELS[rawValue]
  if (mapped) return mapped
  if (rawValue.includes(' ')) return rawValue
  return titleCaseState(rawValue.replace('dishcare_dishwasher_program_', ''))
}

function formatDishwasherSupplyState(entity: HassEntity | null | undefined) {
  if (!dishwasherEntityAvailable(entity)) return 'Unavailable'
  if (entity.state === 'off') return 'OK'
  if (entity.state === 'present' || entity.state === 'confirmed') return 'Low'
  return titleCaseState(entity.state)
}

function formatDishwasherEnumState(entity: HassEntity | null | undefined) {
  if (!dishwasherEntityAvailable(entity)) return 'Unavailable'
  return titleCaseState(entity.state)
}

function roomSourceBackgroundColor(card: RoomSourceCardConfig, entity: HassEntity | null | undefined, presenceEntity: HassEntity | null | undefined) {
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

function occupancySensorSubtitleForRoom(roomTitle: string, entities: Record<string, HassEntity | undefined>) {
  const group = roomOccupancyGroup(roomTitle)
  if (!group) return undefined
  const activeCount = group.items.reduce((count, item) => count + (isOccupancyActive(entities[item.entityId]) ? 1 : 0), 0)
  return activeCount > 0 ? 'Occupied' : 'Clear'
}

function contactSensorSubtitleForRoom(roomTitle: string, entities: Record<string, HassEntity | undefined>) {
  const group = roomContactGroup(roomTitle)
  if (!group) return undefined
  const openCount = group.items.reduce((count, item) => count + (isContactOpen(entities[item.entityId]) ? 1 : 0), 0)
  return openCount > 0 ? `${openCount} Open` : 'All Closed'
}

function roomSourceModalSubtitle(card: RoomSourceCardConfig, roomTitle: string, entities: Record<string, HassEntity | undefined>) {
  if (card.showState === false) return undefined
  if (card.kind === 'occupancy') return occupancySensorSubtitleForRoom(roomTitle, entities)
  if (card.kind === 'contact') return contactSensorSubtitleForRoom(roomTitle, entities)
  if (card.kind === 'humidifier') {
    const humidifier = humidifierForPowerEntity(card.entityId)
    if (humidifier) return humidifierModalSummary(humidifier, entities)
  }
  if (card.kind === 'air') {
    const pm25EntityId = card.modalEntityId ?? card.entityId
    const { aqiEntityId } = derivedAirPurifierEntityIds(pm25EntityId)
    return formatAirQualitySummary(entities[aqiEntityId], entities[pm25EntityId])
  }
  return formatRoomSourceState(card, entities[card.entityId] ?? null)
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
    </div>
  )
}

function renderRoomReusableSheet(card: RoomSourceCardConfig, roomTitle: string): ReactNode {
  if (!card.hash) return null

  if (isDishwasherSourceCard(card)) return <DishwasherModalContent key="dishwasher" />

  if (card.modalItems?.length) return <SourceEntityModalContent card={card} key={`${card.entityId}-items`} />

  if (card.kind === 'light') {
    const group = roomLightGroup(roomTitle)
    if (group) return <LightsSheet directGroup={group} hideDirectTitle key={group.title} />
  }

  if (card.kind === 'vent' || (card.kind === 'climate' && card.title === 'Climate')) {
    const group = roomClimateGroup(roomTitle)
    if (group) return <ClimateSheet directGroup={group} hideDirectHeader key={group.title} />
  }

  if (card.kind === 'occupancy') {
    const group = roomOccupancyGroup(roomTitle)
    if (group) return <OccupancySheet directGroup={group} hideDirectHeader key={group.title} />
  }

  if (card.kind === 'contact') {
    const group = roomContactGroup(roomTitle)
    if (group) return <ContactSheet directGroup={group} hideDirectHeader key={group.title} />
    return <ContactSheet key="contact-sensors-overview" />
  }

  if (card.kind === 'vacuum') {
    const vacuum = VACUUMS.find((candidate) => candidate.entityId === card.entityId)
    if (vacuum) return <VacuumRoomSourceModalContent key={vacuum.entityId} vacuum={vacuum} />
  }

  if (card.kind === 'air') {
    return <AirQualityModalContent key={card.entityId} pm25EntityId={card.modalEntityId ?? card.entityId} roomTitle={roomTitle} />
  }

  if (card.kind === 'humidifier') {
    const humidifier = humidifierForPowerEntity(card.entityId)
    if (humidifier) return <HumidifierModalContent config={humidifier} key={humidifier.id} roomTitle={roomTitle} />
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
        <span>This source does not have interactive controls available from this view.</span>
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

interface EntityStateLike {
  state: string
}

function humidifierSummaryFromStates(
  power: EntityStateLike | null | undefined,
  tankRemoved: EntityStateLike | null | undefined,
  waterLow: EntityStateLike | null | undefined,
  currentHumidity: EntityStateLike | null | undefined,
  humidifying: EntityStateLike | null | undefined,
) {
  if (!power || power.state === 'unknown' || power.state === 'unavailable') return 'Unavailable'
  if (tankRemoved?.state === 'on') return 'Tank Removed'
  if (waterLow?.state === 'on') return 'Water Low'
  const humidityValue = Number(currentHumidity?.state)
  const humidity = Number.isFinite(humidityValue) ? `${Math.round(humidityValue)}%` : undefined
  const status = power.state === 'on' ? humidifying?.state === 'on' ? 'Humidifying' : 'On' : 'Off'
  return [status, humidity].filter(Boolean).join(' • ')
}

function humidifierSummary(config: HumidifierConfig, entities: Record<string, HassEntity | undefined>) {
  return humidifierSummaryFromStates(
    entities[config.powerEntityId],
    entities[config.tankRemovedEntityId],
    entities[config.waterLowEntityId],
    entities[config.currentHumidityEntityId],
    entities[config.humidifyingEntityId],
  )
}

function humidifierModalSummary(config: HumidifierConfig, entities: Record<string, HassEntity | undefined>) {
  const power = entities[config.powerEntityId]
  if (!power || power.state === 'unknown' || power.state === 'unavailable') return 'Unavailable'
  if (power.state === 'off') return 'Off'
  return humidifierSummary(config, entities)
}

function HumidifierRoomSourceCard({ card, onOpen }: RoomSourceCardProps) {
  const humidifier = humidifierForPowerEntity(card.entityId)
  const power = useEntity(asEntityName(card.entityId), { returnNullIfNotFound: true })
  const tankRemovedEntity = useEntity(asEntityName(humidifier?.tankRemovedEntityId ?? card.entityId), { returnNullIfNotFound: true })
  const waterLowEntity = useEntity(asEntityName(humidifier?.waterLowEntityId ?? card.entityId), { returnNullIfNotFound: true })
  const currentHumidityEntity = useEntity(asEntityName(humidifier?.currentHumidityEntityId ?? card.entityId), { returnNullIfNotFound: true })
  const humidifyingEntity = useEntity(asEntityName(humidifier?.humidifyingEntityId ?? card.entityId), { returnNullIfNotFound: true })
  const unavailable = isUnavailable(power) || !humidifier
  const tankRemoved = humidifier ? tankRemovedEntity?.state === 'on' : false
  const waterLow = humidifier ? waterLowEntity?.state === 'on' : false
  const powerOn = power?.state === 'on'
  const backgroundColor = tankRemoved
    ? 'rgba(229, 57, 53, 0.5)'
    : waterLow
      ? 'rgba(251, 140, 0, 0.5)'
      : powerOn
        ? 'rgba(0, 150, 136, 0.58)'
        : undefined
  const summary = humidifier
    ? humidifierSummaryFromStates(power, tankRemovedEntity, waterLowEntity, currentHumidityEntity, humidifyingEntity)
    : 'Unavailable'
  const handleClick = card.hash && !unavailable ? () => onOpen(card) : undefined
  const content = (
    <GlassTile
      backgroundColor={backgroundColor}
      disclosure={Boolean(handleClick)}
      icon={<SourceCardIcon card={card} size={24} />}
      isOff={unavailable || !powerOn}
      onClick={handleClick}
      subtitle={summary}
      title={card.title}
      tone={tankRemoved ? 'danger' : waterLow ? 'warning' : 'climate'}
    />
  )

  if (card.span === 'full') return <div className={styles.fullSpan}>{content}</div>
  return content
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
  const entities = useHass((state) => state.entities) as unknown as EntityActionStateMap

  return (entityId: string, action: RoomSourceCardAction | undefined) => {
    const resolvedAction = resolveEntityAction(entityId, action, entities)
    if (!resolvedAction) return
    if (resolvedAction.type === 'toggle') {
      callService({ domain: 'homeassistant', service: 'toggle', target: entityId })
      return
    }

    const target = resolvedAction.target === null ? undefined : resolvedAction.target ?? entityId
    const params: Record<string, unknown> = { domain: resolvedAction.domain, service: resolvedAction.service }
    if (resolvedAction.serviceData !== undefined) params.serviceData = resolvedAction.serviceData
    if (target !== undefined) params.target = target
    callService(params)
  }
}

interface RoomSourceCardProps {
  card: RoomSourceCardConfig
  eightSleepModalState?: EightSleepBedModalState
  onOpen: (card: RoomSourceCardConfig) => void
}

function RoomSourceCard(props: RoomSourceCardProps) {
  if (isDishwasherSourceCard(props.card)) return <DishwasherRoomSourceCard {...props} />
  if (props.card.kind === 'humidifier') return <HumidifierRoomSourceCard {...props} />
  return <DefaultRoomSourceCard {...props} />
}

function DishwasherRoomSourceCard({ card, onOpen }: RoomSourceCardProps) {
  const cleanUnopened = useEntity(asEntityName(DISHWASHER_ENTITY_IDS.cleanUnopened), { returnNullIfNotFound: true })
  const selectedProgram = useEntity(asEntityName(DISHWASHER_ENTITY_IDS.selectedProgram), { returnNullIfNotFound: true })
  const operation = useEntity(asEntityName(DISHWASHER_ENTITY_IDS.operation), { returnNullIfNotFound: true })
  const progress = useEntity(asEntityName(DISHWASHER_ENTITY_IDS.progress), { returnNullIfNotFound: true })
  const displayUnavailable = dishwasherEntityUnavailable(selectedProgram) && dishwasherEntityUnavailable(operation)
  const disabledByState = Boolean(selectedProgram && card.disabledStates?.includes(selectedProgram.state))
  const handleClick = card.hash && !displayUnavailable && !disabledByState ? () => onOpen(card) : undefined
  const content = (
    <GlassTile
      disclosure={Boolean(handleClick)}
      icon={<SourceCardIcon card={card} size={24} />}
      isOff={displayUnavailable || disabledByState}
      onClick={handleClick}
      progress={dishwasherProgressFillPercent(operation, progress)}
      progressColor={DISHWASHER_PROGRESS_COLOR}
      subtitle={formatDishwasherSummary(operation, progress, cleanUnopened)}
      title={card.title}
      tone="neutral"
    />
  )

  if (card.span === 'full') return <div className={styles.fullSpan}>{content}</div>
  return content
}

function DefaultRoomSourceCard({ card, eightSleepModalState, onOpen }: RoomSourceCardProps) {
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
  const displayUnavailable = eightSleepModalState ? !eightSleepModalState.sideAvailable : unavailable
  const displaySubtitle = eightSleepModalState ? eightSleepModalState.subtitle : subtitle
  const clickable = Boolean(card.hash || card.action) && !displayUnavailable && !disabledByState
  const activeByState = Boolean(entity && card.activeStates?.includes(entity.state))
  const sourceStateInactive = card.stateDisplay === 'climate-action-temperature' && (entity?.state === 'off' || entity?.attributes.hvac_action === 'off')
  const inactiveMuted = eightSleepModalState ? !eightSleepModalState.controlsSideOn : sourceStateInactive || (!unavailable && !activeByState && !isActiveState(entity) && ['fan', 'grill', 'light', 'media', 'power'].includes(card.kind))
  const handleClick = clickable ? (card.action ? () => runAction(card.entityId, card.action) : () => onOpen(card)) : undefined
  const backgroundColor = eightSleepModalState ? eightSleepCardBackgroundColor(eightSleepModalState) : roomSourceBackgroundColor(card, entity, presenceEntity)
  const content = card.imageUrl && card.kind === 'media' && card.action ? (
    <RoomSourceMediaAppCard card={card} isOff={displayUnavailable || disabledByState} onClick={handleClick} />
  ) : (
    <GlassTile
      icon={<SourceCardIcon card={card} size={24} />}
      backgroundColor={backgroundColor}
      disclosure={Boolean(handleClick && card.hash && !card.action)}
      isOff={displayUnavailable || disabledByState || inactiveMuted}
      onClick={handleClick}
      subtitle={displaySubtitle}
      title={card.title}
      tone={displayUnavailable ? 'neutral' : toneForSourceKind(card.kind)}
    />
  )

  if (card.span === 'full') return <div className={styles.fullSpan}>{content}</div>
  return content
}

function RoomSourceModal({ card, eightSleepModalState, onClose, preloadCard, roomTitle }: { card: RoomSourceCardConfig | null; eightSleepModalState?: EightSleepBedModalState; onClose: () => void; preloadCard?: RoomSourceCardConfig | null; roomTitle: string }) {
  const lastCardRef = useRef<RoomSourceCardConfig | null>(null)
  const lastEightSleepModalStateRef = useRef<EightSleepBedModalState | null>(null)
  const [mediaActiveTab, setMediaActiveTab] = useState<MediaRemoteModalTab>('controls')
  if (card) lastCardRef.current = card

  const renderCard = card ?? preloadCard ?? lastCardRef.current
  const eightSleepSide = renderCard ? eightSleepSideForHash(renderCard.hash) : undefined
  if (card && eightSleepSide && eightSleepModalState) lastEightSleepModalStateRef.current = eightSleepModalState

  const renderedEightSleepModalState = card ? eightSleepModalState : lastEightSleepModalStateRef.current
  const mediaRemote = renderCard?.kind === 'media' && renderCard.hash ? MEDIA_REMOTE_CONFIGS[renderCard.hash] : undefined
  const content = renderCard && !eightSleepSide
    ? mediaRemote
      ? <MediaRemoteModalContent activeTab={mediaActiveTab} config={mediaRemote} key={mediaRemote.hash} onTabChange={setMediaActiveTab} />
      : renderRoomReusableSheet(renderCard, roomTitle)
    : null
  const plainTitle = renderCard?.kind === 'air' || renderCard?.kind === 'climate' || renderCard?.kind === 'contact' || renderCard?.kind === 'humidifier' || renderCard?.kind === 'light' || renderCard?.kind === 'occupancy'
  const mediaTitle = mediaRemote?.remoteTitle
  const title = renderCard
    ? isDishwasherSourceCard(renderCard)
      ? renderCard.modalTitle ?? renderCard.title
      : mediaTitle ?? `${roomTitle}${plainTitle ? ' ' : ': '}${renderCard.modalTitle ?? renderCard.title}`
    : roomTitle
  const subtitle = useHass((state) => {
    if (renderCard && isDishwasherSourceCard(renderCard)) return undefined
    return renderCard && plainTitle && renderCard.kind !== 'contact' && renderCard.kind !== 'light' ? roomSourceModalSubtitle(renderCard, roomTitle, state.entities) : undefined
  })
  const modalStyle = renderCard?.kind === 'media'
    ? MEDIA_REMOTE_MODAL_STYLE
    : renderCard?.kind === 'vacuum'
      ? VACUUM_MODAL_STYLE
    : renderCard && SECURITY_SIZED_ROOM_SOURCE_KINDS.has(renderCard.kind) ? ROOM_SOURCE_SECURITY_SIZED_MODAL_STYLE : undefined

  useEffect(() => {
    setMediaActiveTab('controls')
  }, [mediaRemote?.hash])

  if (renderCard && eightSleepSide && renderedEightSleepModalState) {
    return (
      <EightSleepBedModal key={eightSleepSide.hash} modalState={renderedEightSleepModalState} onClose={onClose} open={Boolean(card)} side={eightSleepSide} />
    )
  }

  const humidifier = renderCard?.kind === 'humidifier' ? humidifierForPowerEntity(renderCard.entityId) : undefined
  if (humidifier) {
    return <HumidifierModal config={humidifier} onClose={onClose} open={Boolean(card)} roomTitle={roomTitle} />
  }

  const vacuum = renderCard?.kind === 'vacuum' ? VACUUMS.find((candidate) => candidate.entityId === renderCard.entityId) : undefined
  if (vacuum) {
    return <VacuumModal onClose={onClose} open={Boolean(card)} subtitle={subtitle} title={title} vacuum={vacuum} />
  }

  return (
    <ModalSheet
      contentStyle={modalStyle}
      footer={mediaRemote ? <MediaRemoteModalNav activeTab={mediaActiveTab} onTabChange={setMediaActiveTab} remoteTitle={mediaRemote.title} showDevices={Boolean(mediaRemote.devices?.length)} /> : undefined}
      onClose={onClose}
      open={Boolean(card)}
      subtitle={subtitle}
      title={title}
    >
      {renderCard && (content ?? <RoomSourceFallback card={renderCard} />)}
    </ModalSheet>
  )
}

function RoomSourcePreloadContent({ card, eightSleepModalState, roomTitle }: { card: RoomSourceCardConfig; eightSleepModalState?: EightSleepBedModalState; roomTitle: string }) {
  const eightSleepSide = eightSleepSideForHash(card.hash)
  if (eightSleepSide && eightSleepModalState) {
    return <EightSleepBedModalContentView activeTab="schedule" alarmPage={null} modalState={eightSleepModalState} side={eightSleepSide} />
  }

  const mediaRemote = card.kind === 'media' && card.hash ? MEDIA_REMOTE_CONFIGS[card.hash] : undefined
  const content = mediaRemote ? <MediaRemoteModalContent config={mediaRemote} /> : renderRoomReusableSheet(card, roomTitle)
  return <>{content ?? <RoomSourceFallback card={card} />}</>
}

function EmptyRoomState() {
  return (
    <div className={styles.emptyRoomState} data-empty-layout="centered" data-empty-typography="festival">
      <h2>Nothing Here Yet!</h2>
      <Description>Once some devices are added to this room, we can display them here.</Description>
    </div>
  )
}

function SourceRoomPage({ onNavigate, preload = false, preloadHash, preloadHashes = [], room }: { onNavigate: (path: string) => void; preload?: boolean; preloadHash?: string; preloadHashes?: string[]; room: (typeof ROOM_PAGE_CONFIGS)[string] }) {
  const [selectedCard, setSelectedCard] = useState<RoomSourceCardConfig | null>(null)
  const eightSleepModalStates = useEightSleepBedModalStates()
  const allCards = useMemo(() => [...room.overviewCards, ...room.sourceSections.flatMap((section) => section.cards)], [room.overviewCards, room.sourceSections])
  const preloadCard = preloadHash ? allCards.find((candidate) => candidate.hash === preloadHash) ?? null : null
  const preloadCards = useMemo(() => preloadHashes.map((preloadTargetHash) => allCards.find((candidate) => candidate.hash === preloadTargetHash)).filter((card): card is RoomSourceCardConfig => Boolean(card?.hash)), [allCards, preloadHashes])

  const closeSourceCard = () => {
    setSelectedCard(null)
    if (preload) return
    if (dashboardHash()) replaceDashboardUrl(dashboardPathWithSearch())
  }

  useEffect(() => {
    if (preload) return undefined

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
  }, [allCards, preload])

  const openSourceCard = (card: RoomSourceCardConfig) => {
    if (card.hash) setRoomHash(card.hash)
    else setSelectedCard(card)
  }

  return (
    <div className={styles.stack}>
      {room.sourceSections.length === 0 && <EmptyRoomState />}

      {room.path === 'kitchen' && <KitchenGroceriesSection onNavigate={onNavigate} />}

      {room.sourceSections.map((section) => {
        const leadRow = section.layout === 'lead-row'
        const leadCards = leadRow ? section.cards.slice(0, 1) : section.cards
        const followUpCards = leadRow ? section.cards.slice(1) : []
        const renderCard = (card: RoomSourceCardConfig) => (
          <RoomSourceCard card={card} eightSleepModalState={card.hash ? eightSleepModalStates[card.hash] : undefined} key={`${room.path}-${section.title}-${card.title}-${card.entityId}`} onOpen={openSourceCard} />
        )

        return (
          <section className={styles.section} id={sectionId(section.title)} key={`${room.path}-${section.title}`}>
            <SectionHeader title={section.title} />
            <RoomGrid ariaLabel={`${room.title} ${section.title}`}>
              {leadCards.map(renderCard)}
            </RoomGrid>
            {followUpCards.length > 0 && (
              <RoomGrid ariaLabel={`${room.title} ${section.title} Controls`}>
                {followUpCards.map(renderCard)}
              </RoomGrid>
            )}
          </section>
        )
      })}

      <RoomSourceModal card={selectedCard} eightSleepModalState={selectedCard?.hash ? eightSleepModalStates[selectedCard.hash] : preloadCard?.hash ? eightSleepModalStates[preloadCard.hash] : undefined} onClose={closeSourceCard} preloadCard={preloadCard} roomTitle={room.title} />
      {preloadCards.map((card) => (
        <div data-preload-modal={`${room.path}${card.hash}`} key={`${room.path}-preload-${card.hash}`}>
          <RoomSourcePreloadContent card={card} eightSleepModalState={card.hash ? eightSleepModalStates[card.hash] : undefined} roomTitle={room.title} />
        </div>
      ))}
    </div>
  )
}

function RoomPage({ onNavigate, path, preload = false, preloadHash, preloadHashes, title }: { onNavigate: (path: string) => void; path: string; preload?: boolean; preloadHash?: string; preloadHashes?: string[]; title: string }) {
  const sourceRoom = ROOM_PAGE_CONFIGS[path]
  if (sourceRoom) return <SourceRoomPage onNavigate={onNavigate} preload={preload} preloadHash={preloadHash} preloadHashes={preloadHashes} room={sourceRoom} />

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
          <RoomGrid ariaLabel={`${title} Lights`}>
            {lightGroup?.items.map((item) => (
              <LightCard entityId={item.entityId} key={item.entityId} size="compact" title={item.title} />
            ))}
          </RoomGrid>
        </section>
      )}

      {sectionHasItems(climateGroup) && (
        <section className={styles.section} id={sectionId('Climate')}>
          <SectionHeader title="Climate" />
          <RoomGrid ariaLabel={`${title} Climate`}>
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
          </RoomGrid>
        </section>
      )}

      {sectionHasItems(occupancyGroup) && (
        <section className={styles.section} id={sectionId('Occupancy')}>
          <SectionHeader title="Occupancy" />
          <RoomGrid ariaLabel={`${title} Occupancy`}>
            {occupancyGroup?.items.map((item) => (
              <OccupancyCard entityId={item.entityId} key={item.entityId} size="compact" title={item.title} />
            ))}
          </RoomGrid>
        </section>
      )}

      {sectionHasItems(contactGroup) && (
        <section className={styles.section} id={sectionId('Contact Sensors')}>
          <SectionHeader title="Contact Sensors" />
          <RoomGrid ariaLabel={`${title} Contact Sensors`}>
            {contactGroup?.items.map((item) => (
              <ContactSensorCard entityId={item.entityId} key={item.entityId} size="compact" title={item.title} />
            ))}
          </RoomGrid>
        </section>
      )}

      {extras.map((section) => (
        <section className={styles.section} id={sectionId(section.title)} key={section.title}>
          <SectionHeader title={section.title} />
          <RoomGrid ariaLabel={`${title} ${section.title}`}>
            {section.items.map((item) => <EntityActionCard item={item} key={`${section.title}-${item.entityId}-${item.title}`} onNavigate={onNavigate} />)}
          </RoomGrid>
        </section>
      ))}
    </div>
  )
}

function todoPageConfigPath(path: string) {
  return path === HOME_GROCERY_LIST_ROUTE_PATH ? 'groceries' : path
}

function TodoPage({ path, configPath = path, onNavigate, onScrollLockChange }: { configPath?: string; onNavigate: (path: string) => void; onScrollLockChange?: (locked: boolean) => void; path: string }) {
  const config = TODO_PAGES[configPath]
  if (!config) return null
  return <TodoPageContent config={config} configPath={configPath} onNavigate={onNavigate} onScrollLockChange={onScrollLockChange} path={path} />
}

function TodoPageContent({ config, configPath, onNavigate, onScrollLockChange, path }: { config: TodoPageConfig; configPath: string; onNavigate: (path: string) => void; onScrollLockChange?: (locked: boolean) => void; path: string }) {
  const user = useUser()
  const entities = useHass((state) => state.entities) as unknown as EntityActionStateMap
  const [sectionStates, setSectionStates] = useState<Record<string, { loaded: boolean; visible: boolean } | undefined>>({})
  const [editingTask, setEditingTask] = useState<DonetickTaskEditTarget | null>(null)
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [todoReloadVersion, setTodoReloadVersion] = useState(0)
  const hideEmptyTodoSections = config.showEmptyStateWhenEmpty ?? isChoreTodoPage(configPath)
  // Donetick empties these lists during vacation, so "nice job" would take credit for hidden chores.
  const hiddenByVacation = Boolean(config.hiddenByVacation) && entities[VACATION_MODE_ENTITY_ID]?.state === 'on'
  const visibleLists = config.lists.filter((list) => todoListVisible(list, user?.id, entities))
  const visibleListKeys = visibleLists.map((list) => list.entityId)
  const loadedSectionStates = visibleListKeys.map((entityId) => sectionStates[entityId]).filter((state): state is { loaded: boolean; visible: boolean } => Boolean(state))
  const allSectionsLoaded = hideEmptyTodoSections && visibleListKeys.length > 0 && loadedSectionStates.length === visibleListKeys.length && loadedSectionStates.every((state) => state.loaded)
  const hasRenderedTaskSection = hideEmptyTodoSections ? loadedSectionStates.some((state) => state.visible) : visibleLists.length > 0
  const showTodoEmptyState = hideEmptyTodoSections && (visibleLists.length === 0 || (allSectionsLoaded && !hasRenderedTaskSection))
  const lockPageScroll = path !== 'chores' && showTodoEmptyState
  const editableDonetickTasks = config.taskSource === 'donetick'

  const handleTodoSectionState = (entityId: string, state: { loaded: boolean; visible: boolean }) => {
    setSectionStates((current) => {
      const previous = current[entityId]
      if (previous?.loaded === state.loaded && previous.visible === state.visible) return current
      return { ...current, [entityId]: state }
    })
  }

  useEffect(() => {
    onScrollLockChange?.(lockPageScroll)
    return () => onScrollLockChange?.(false)
  }, [lockPageScroll, onScrollLockChange])

  const openTaskEditor = (target: DonetickTaskEditTarget) => {
    setEditingTask(target)
    setEditSheetOpen(true)
  }

  const refreshTodoLists = () => {
    setTodoReloadVersion((current) => current + 1)
  }

  return (
    <div className={styles.stack} data-empty-todo-page={lockPageScroll ? 'true' : undefined}>
      {configPath === 'chores' && <ChoresIntro onNavigate={onNavigate} />}
      {showTodoEmptyState && <TodoEmptyState description={hiddenByVacation ? VACATION_EMPTY_DESCRIPTION : config.emptyDescription} title={config.emptyTitle} />}
      {visibleLists.map((list) => {
        const entity = entities[list.entityId] as (typeof entities)[string] & { last_changed?: string; last_updated?: string }
        const entityVersion = `${entity?.state ?? ''}:${entity?.last_changed ?? ''}:${entity?.last_updated ?? ''}`
        return <TodoSection entityVersion={entityVersion} hideListHeader={config.hideListHeaders} hideWhenEmpty={hideEmptyTodoSections} key={list.entityId} list={list} mayHaveItems={todoEntityMayHaveItems(entity)} onEditTask={editableDonetickTasks ? openTaskEditor : undefined} onSectionStateChange={handleTodoSectionState} reloadVersion={todoReloadVersion} rowVariant={configPath === 'to-do' ? 'settings' : undefined} />
      })}
      {editingTask && (
        <CreateDonetickTaskSheet
          editTarget={editingTask}
          onClose={() => setEditSheetOpen(false)}
          onDeleted={refreshTodoLists}
          onSaved={refreshTodoLists}
          open={editSheetOpen}
        />
      )}
    </div>
  )
}

function isChoreTodoPage(path: string) {
  return path === 'chores' || path === 'groceries' || path.endsWith('-chores')
}

function todoEntityMayHaveItems(entity: EntityActionStateMap[string] & { state?: string } | undefined) {
  if (!entity || entity.state === undefined || entity.state === 'unknown' || entity.state === 'unavailable') return true
  return Number(entity.state) > 0
}

function TodoSection({ entityVersion, hideListHeader = false, hideWhenEmpty, list, mayHaveItems, onEditTask, onSectionStateChange, reloadVersion, rowVariant }: { entityVersion: string; hideListHeader?: boolean; hideWhenEmpty: boolean | undefined; list: TodoListConfig; mayHaveItems: boolean; onEditTask?: (target: DonetickTaskEditTarget) => void; onSectionStateChange?: (entityId: string, state: { loaded: boolean; visible: boolean }) => void; reloadVersion?: number; rowVariant?: 'settings' }) {
  const [visibleItemCount, setVisibleItemCount] = useState<number | null>(hideWhenEmpty && !mayHaveItems ? 0 : null)
  const sectionVisible = !(hideWhenEmpty && visibleItemCount === 0)
  const todoOptimisticStatuses = useTodoOptimisticStatuses()

  useEffect(() => {
    if (!hideWhenEmpty || !mayHaveItems) return
    setVisibleItemCount((current) => (current === 0 ? null : current))
  }, [entityVersion, hideWhenEmpty, mayHaveItems])

  useEffect(() => {
    onSectionStateChange?.(list.entityId, { loaded: visibleItemCount !== null, visible: sectionVisible })
  }, [list.entityId, onSectionStateChange, sectionVisible, visibleItemCount])

  if (!sectionVisible) return null

  return (
    <section className={styles.section}>
      {!hideListHeader && <SectionHeader title={list.title} />}
      <TodoListPanel completionScript={list.completionScript} entityId={list.entityId} hideCompleted={list.hideCompleted} onEditTask={onEditTask} onVisibleItemsChange={hideWhenEmpty ? setVisibleItemCount : undefined} optimisticStatuses={todoOptimisticStatuses} reloadVersion={reloadVersion} rowVariant={rowVariant} title={list.title} />
    </section>
  )
}

function todoListVisible(list: TodoListConfig, userId: string | undefined, entities: EntityActionStateMap) {
  if (list.userIds?.length && (!userId || !list.userIds.includes(userId))) return false
  if (!list.hideWhenNoOpenItems) return true
  return Number(entities[list.entityId]?.state ?? 0) > 0
}

function ChoresIntro({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <section className={styles.section}>
      <SectionHeader title="Quick Links" />
      <DynamicGrid ariaLabel="Chore quick links" className={styles.choreQuickGrid} columns={2}>
        {CHORE_QUICK_LINKS.map((item) => (
          <ChoreQuickLink item={item} key={item.path} onNavigate={onNavigate} />
        ))}
      </DynamicGrid>
    </section>
  )
}

function ChoreQuickLink({ item, onNavigate }: { item: (typeof CHORE_QUICK_LINKS)[number]; onNavigate: (path: string) => void }) {
  const entities = useHass((state) => state.entities) as unknown as EntityActionStateMap
  const counts = choreQuickLinkCounts(item.path, entities)
  const subtitle = item.countType === 'groceries' ? groceryCountSubtitle(counts.total) : choreQuickLinkSubtitle(counts)

  return (
    <GlassTile
      backgroundColor={`rgba(${item.color.r}, ${item.color.g}, ${item.color.b}, 0.72)`}
      icon={item.icon}
      onClick={() => onNavigate(item.path)}
      subtitle={subtitle}
      title={item.title}
    />
  )
}

const EVERSHELF_INVENTORY_PAGES: Record<string, { location: EverShelfInventoryLocation; title: string }> = {
  [HOME_ALL_FOOD_ROUTE_PATH]: { location: 'all', title: 'All Food' },
  [HOME_PANTRY_ROUTE_PATH]: { location: 'dispensa', title: 'Pantry' },
  [HOME_FRIDGE_ROUTE_PATH]: { location: 'frigo', title: 'Fridge' },
  [HOME_FREEZER_ROUTE_PATH]: { location: 'freezer', title: 'Freezer' },
  [HOME_SPICE_RACK_ROUTE_PATH]: { location: 'spice_rack', title: 'Spice Rack' },
  [HOME_CABINET_ROUTE_PATH]: { location: 'cabinet', title: 'Cabinet' },
}

function KitchenGroceriesSection({ onNavigate }: { onNavigate: (path: string) => void }) {
  const entities = useHass((state) => state.entities) as unknown as EntityActionStateMap
  const groceryList = TODO_PAGES.groceries?.lists[0]
  const groceryCount = choreQuickLinkCounts('groceries', entities).total

  return (
    <section className={styles.section} id={sectionId('Groceries')}>
      <SectionHeader title="Groceries" />
      <RoomGrid ariaLabel="Kitchen Groceries">
        <GlassTile
          backgroundColor="rgba(155, 67, 72, 0.72)"
          icon="mdi:clipboard-list"
          onClick={() => onNavigate(HOME_GROCERY_LIST_ROUTE_PATH)}
          subtitle={groceryCountSubtitle(groceryCount)}
          title={groceryList?.title ?? 'Grocery List'}
        />
        <GlassTile
          backgroundColor={FOOD_CARD_BACKGROUND_COLOR}
          icon="mdi:food-fork-drink"
          onClick={() => onNavigate(HOME_FOOD_ROUTE_PATH)}
          subtitle={foodSummarySubtitle(entities)}
          title="Food"
        />
      </RoomGrid>
    </section>
  )
}

function TodoEmptyState({ description = 'You have no chores due- nice job!', title = 'No Chores Due' }: { description?: string; title?: string }) {
  return <EmptyState className={styles.choresEmpty} description={description} title={title} />
}

function VacuumPage({ preload = false }: { preload?: boolean }) {
  return (
    <div className={styles.stack}>
      <section className={styles.section}>
        <SectionHeader title="Robot Vacuums" />
        <DynamicGrid ariaLabel="Robot vacuums" className={styles.vacuumGrid} columns={2}>
          {ORDERED_VACUUMS.map((vacuum) => (
            <VacuumCard disableHashSync={preload} key={vacuum.entityId} vacuum={vacuum} />
          ))}
        </DynamicGrid>
      </section>
      <section className={styles.section}>
        <SectionHeader title="Auto-Clean" />
        <DynamicGrid ariaLabel="Vacuum auto-clean controls" className={styles.vacuumGrid} columns={2}>
          {VACUUM_AUTO_CLEAN_CONTROLS.map((item) => <VacuumAutoCleanControlCard control={item} key={item.entityId} />)}
        </DynamicGrid>
      </section>
    </div>
  )
}

function SecurityPage({ activePath, backPath, contentTransitionState = 'idle', loadingPhase, onBack, onNavigate, preload = false, preloadHash, preloadHashes, title }: { activePath: string; backPath?: string; contentTransitionState?: 'entering' | 'idle' | 'pre-entering'; loadingPhase?: DashboardPageLoadingPhase; onBack?: (fallbackPath?: string) => void; onNavigate: (path: string) => void; preload?: boolean; preloadHash?: string; preloadHashes?: string[]; title: string }) {
  const { closeHash, hash, openHash } = useHashModal({ disabled: preload })
  return (
    <Page activePath={activePath} backPath={backPath} chromeHidden={Boolean(loadingPhase)} contentTransitionState={contentTransitionState} headerQuickLinks={<SecurityStatusRail onOpenHash={openHash} />} onBack={onBack} onNavigate={onNavigate} title={title}>
      {loadingPhase ? <DashboardPageLoading phase={loadingPhase} /> : <SecurityDashboard closeHash={closeHash} hash={hash} onOpenHash={openHash} preload={preload} preloadHash={preloadHash} preloadHashes={preloadHashes} />}
    </Page>
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

function SettingsLink({ item, onNavigate }: { item: SettingsLinkConfig; onNavigate: (path: string) => void }) {
  const activate = () => {
    if (item.path) onNavigate(item.path)
    else if (item.externalPath) navigateExternal(item.externalPath)
  }

  return (
    <button aria-label={`${item.title} ${item.subtitle}`} className={styles.settingsLink} data-external-path={item.externalPath} data-navigation-path={item.path} onClick={activate} type="button">
      <span aria-hidden="true" className={styles.settingsLinkIcon}>
        <MaterialIcon name={item.icon} size={28} />
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
    <nav aria-label="Settings pages" className={styles.settingsList}>
      {SETTINGS_PAGE_ITEMS.map((item) => (
        <SettingsLink item={item} key={item.title} onNavigate={onNavigate} />
      ))}
    </nav>
  )
}

function GuestControlsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <div className={styles.stack}>
      <section className={styles.section}>
        <SectionHeader title="Guest Controls" />
        <Description>{GUEST_CONTROLS_DESCRIPTION}</Description>
        <DynamicGrid ariaLabel="Guest controls" columns={2} gap={8}>
          {GUEST_CONTROL_ITEMS.map((item) => (
            <EntityActionCard item={item} key={`${item.entityId}-${item.title}`} onNavigate={onNavigate} size="admin-modal" />
          ))}
        </DynamicGrid>
      </section>
    </div>
  )
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0')
}

function dateInputValue(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`
}

function timeInputValue(date: Date) {
  return `${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`
}

function dateTimeParts(date: Date) {
  return { date: dateInputValue(date), time: `${timeInputValue(date)}:00` }
}

function parsedInputDateTime(state: string | undefined) {
  if (!state) return { date: '', time: '' }
  const [date = '', time = ''] = state.replace('T', ' ').split(' ')
  return {
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
    time: /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : '',
  }
}

function normalizedInputTime(time: string) {
  return time.length === 5 ? `${time}:00` : time
}

function inputDateTimeServiceData(date: string, time: string) {
  return { date, time: normalizedInputTime(time) }
}

interface VacationDateTimeParts {
  date: string
  time: string
}

interface VacationDateRange {
  end: VacationDateTimeParts
  start: VacationDateTimeParts
}

function timestampFromInputDateTime({ date, time }: VacationDateTimeParts) {
  if (!date || !time) return null
  const timestamp = new Date(`${date}T${normalizedInputTime(time)}`).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

function isVacationDateRangeInvalid({ end, start }: VacationDateRange) {
  const startTimestamp = timestampFromInputDateTime(start)
  const endTimestamp = timestampFromInputDateTime(end)
  return startTimestamp !== null && endTimestamp !== null && startTimestamp >= endTimestamp
}

function isVacationDateRangeFuture({ end }: VacationDateRange) {
  const endTimestamp = timestampFromInputDateTime(end)
  return endTimestamp !== null && endTimestamp > Date.now()
}

function defaultVacationDateRange(): VacationDateRange {
  const fallbackStart = dateTimeParts(new Date())
  const fallbackEndDate = new Date()
  fallbackEndDate.setDate(fallbackEndDate.getDate() + 1)
  const fallbackEnd = dateTimeParts(fallbackEndDate)

  return {
    start: {
      date: fallbackStart.date,
      time: fallbackStart.time.slice(0, 5),
    },
    end: {
      date: fallbackEnd.date,
      time: fallbackEnd.time.slice(0, 5),
    },
  }
}

function vacationDateRangeFromStates(startState: string | undefined, endState: string | undefined): VacationDateRange {
  const fallback = defaultVacationDateRange()
  const start = parsedInputDateTime(startState)
  const end = parsedInputDateTime(endState)

  return {
    start: {
      date: start.date || fallback.start.date,
      time: start.time || fallback.start.time,
    },
    end: {
      date: end.date || fallback.end.date,
      time: end.time || fallback.end.time,
    },
  }
}

function parsedInputTime(state: string | undefined, fallback = '07:00') {
  const match = state?.match(/\b([01]\d|2[0-3]):[0-5]\d/)
  return match?.[0] ?? fallback
}

function formatClockTime(time: string) {
  const [rawHours, rawMinutes] = time.split(':').map(Number)
  if (!Number.isFinite(rawHours) || !Number.isFinite(rawMinutes)) return time
  const period = rawHours >= 12 ? 'PM' : 'AM'
  const hours = rawHours % 12 || 12
  return `${hours}:${String(rawMinutes).padStart(2, '0')} ${period}`
}

function openNativeTimePicker(input: HTMLInputElement | null) {
  if (!input) return
  input.focus({ preventScroll: true })
  if (typeof input.showPicker === 'function') {
    try {
      input.showPicker()
      return
    } catch {
      // Fall back to the native click path if the browser rejects programmatic picker opening.
    }
  }
  input.click()
}

function resetVacationChecklist(callService: (params: Record<string, unknown>) => void) {
  for (const item of VACATION_PRE_CHECKLIST_ITEMS) {
    callService({ domain: 'input_boolean', service: 'turn_off', target: item.entityId })
  }
}

const VACATION_CHECKLIST_STATE_SEPARATOR = '\u001f'

function vacationChecklistStateKeyFromEntities(entities: Record<string, HassEntity | undefined>) {
  return VACATION_PRE_CHECKLIST_ITEMS.map((item) => entities[item.entityId]?.state ?? 'unavailable').join(VACATION_CHECKLIST_STATE_SEPARATOR)
}

function vacationChecklistStatesFromKey(stateKey: string) {
  const states = stateKey.split(VACATION_CHECKLIST_STATE_SEPARATOR)
  return Object.fromEntries(VACATION_PRE_CHECKLIST_ITEMS.map((item, index) => [item.entityId, states[index] ?? 'unavailable']))
}

function vacationChecklistStateKeyWithItem(stateKey: string, entityId: string, nextState: string) {
  const states = stateKey.split(VACATION_CHECKLIST_STATE_SEPARATOR)
  const index = VACATION_PRE_CHECKLIST_ITEMS.findIndex((item) => item.entityId === entityId)
  if (index < 0) return stateKey
  states[index] = nextState
  return states.join(VACATION_CHECKLIST_STATE_SEPARATOR)
}

function isVacationChecklistComplete(stateKey: string) {
  return stateKey.split(VACATION_CHECKLIST_STATE_SEPARATOR).every((state) => state === 'on')
}

function VacationModeCard({ disabled = false, enabled, onBlockedEnable, onEnabledChange, onPendingChange, pending = false, preChecklistComplete = true }: { disabled?: boolean; enabled: boolean; onBlockedEnable?: () => void; onEnabledChange: (enabled: boolean) => void; onPendingChange: (pending: boolean) => void; pending?: boolean; preChecklistComplete?: boolean }) {
  const entity = useEntity(asEntityName(VACATION_MODE_ENTITY_ID), { returnNullIfNotFound: true })
  const callService = useCallService()
  const entityUnavailable = !entity || entity.state === 'unavailable' || entity.state === 'unknown'
  const cardDisabled = entityUnavailable || disabled
  const subtitle = pending ? 'Pending' : formatCompactEntityState(entity, 'Unavailable', !entityUnavailable ? (enabled ? 'on' : 'off') : undefined)

  const toggleVacationMode = () => {
    if (cardDisabled) return
    if (enabled) {
      onEnabledChange(false)
      callService({ domain: 'input_boolean', service: 'turn_off', target: VACATION_MODE_ENTITY_ID })
      callService({ domain: 'input_boolean', service: 'turn_off', target: VACATION_INVALID_DATES_PENDING_ENTITY_ID })
      resetVacationChecklist(callService)
      return
    }
    if (pending) {
      onPendingChange(false)
      return
    }
    if (!preChecklistComplete) {
      onBlockedEnable?.()
      return
    }
    onPendingChange(true)
  }

  return (
    <Card
      ariaLabel={`Vacation Mode ${subtitle}`}
      color={pending ? SECURITY_COLOR : SWITCH_ACTIVE_COLOR}
      disabled={cardDisabled}
      disclosure={!cardDisabled && !enabled && !pending && preChecklistComplete}
      icon={<MaterialIcon name={VACATION_MODE_ITEMS[0].icon} size={38} />}
      muted={cardDisabled || (!enabled && !pending)}
      onClick={toggleVacationMode}
      pressed={!entityUnavailable ? enabled || pending : undefined}
      size="wide"
      subtitle={subtitle}
      title="Vacation Mode"
    />
  )
}

function VacationChecklistRow({ item, onStateChange, state }: { item: typeof VACATION_PRE_CHECKLIST_ITEMS[number]; onStateChange: (entityId: string, nextState: string) => void; state: string }) {
  const callService = useCallService()
  const active = state === 'on'
  const unavailable = state === 'unavailable' || state === 'unknown'

  const toggle = () => {
    if (unavailable) return
    const nextState = active ? 'off' : 'on'
    onStateChange(item.entityId, nextState)
    callService({ domain: 'input_boolean', service: active ? 'turn_off' : 'turn_on', target: item.entityId })
  }

  return (
    <li className={styles.vacationChecklistRow}>
      <CheckboxRow
        active={active}
        aria-label={item.title}
        className={styles.vacationChecklistItem}
        disabled={unavailable}
        onClick={toggle}
        title={item.title}
      />
    </li>
  )
}

function VacationChecklistSection({ onStateChange, states }: { onStateChange: (entityId: string, nextState: string) => void; states: Record<string, string> }) {
  return (
    <section className={styles.section}>
      <SectionHeader title="Pre-Vacation Checklist" />
      <ul className={styles.vacationChecklist}>
        {VACATION_PRE_CHECKLIST_ITEMS.map((item) => (
          <VacationChecklistRow item={item} key={item.entityId} onStateChange={onStateChange} state={states[item.entityId] ?? 'unavailable'} />
        ))}
      </ul>
    </section>
  )
}

function VacationDateControls({ dateRange, invalidDateRange, onConfirm, onDateRangeChange, pending, recoveringInvalidDates, showConfirm = false }: { dateRange: VacationDateRange; invalidDateRange: boolean; onConfirm?: () => void; onDateRangeChange: (dateRange: VacationDateRange) => void; pending: boolean; recoveringInvalidDates: boolean; showConfirm?: boolean }) {
  const callService = useCallService()
  const startDate = dateRange.start.date
  const startTime = dateRange.start.time
  const endDate = dateRange.end.date
  const endTime = dateRange.end.time

  const updateDateTime = (entityId: string, date: string, time: string, nextRange: VacationDateRange) => {
    if (pending) {
      onDateRangeChange(nextRange)
      return
    }
    callService({ domain: 'input_datetime', service: 'set_datetime', target: entityId, serviceData: inputDateTimeServiceData(date, time) })
    if (recoveringInvalidDates && !isVacationDateRangeInvalid(nextRange) && isVacationDateRangeFuture(nextRange)) {
      callService({ domain: 'input_boolean', service: 'turn_on', target: VACATION_MODE_ENTITY_ID })
      callService({ domain: 'input_boolean', service: 'turn_off', target: VACATION_INVALID_DATES_PENDING_ENTITY_ID })
    }
  }

  return (
    <>
      <Description>{VACATION_DATES_DESCRIPTION}</Description>
      {invalidDateRange && <Description className={styles.vacationDateError}>{VACATION_DATE_RANGE_ERROR}</Description>}
      <div className={styles.vacationDateGrid}>
        <NativePickerField className={styles.vacationDatePicker} label="Start Date" onChange={(value) => updateDateTime(VACATION_START_ENTITY_ID, value, startTime, { ...dateRange, start: { date: value, time: startTime } })} type="date" value={startDate} />
        <NativePickerField className={styles.vacationDatePicker} label="Start Time" onChange={(value) => updateDateTime(VACATION_START_ENTITY_ID, startDate, value, { ...dateRange, start: { date: startDate, time: value } })} type="time" value={startTime} />
        <NativePickerField className={styles.vacationDatePicker} label="End Date" onChange={(value) => updateDateTime(VACATION_END_ENTITY_ID, value, endTime, { ...dateRange, end: { date: value, time: endTime } })} type="date" value={endDate} />
        <NativePickerField className={styles.vacationDatePicker} label="End Time" onChange={(value) => updateDateTime(VACATION_END_ENTITY_ID, endDate, value, { ...dateRange, end: { date: endDate, time: value } })} type="time" value={endTime} />
      </div>
      {showConfirm && !invalidDateRange && (
        <button className={styles.vacationConfirmButton} onClick={onConfirm} type="button">
          Confirm Vacation
        </button>
      )}
    </>
  )
}

function VacationDatesSection({ dateRange, invalidDateRange, onDateRangeChange, recoveringInvalidDates }: { dateRange: VacationDateRange; invalidDateRange: boolean; onDateRangeChange: (dateRange: VacationDateRange) => void; recoveringInvalidDates: boolean }) {
  return (
    <section className={styles.section}>
      <SectionHeader title="Vacation Dates" />
      <VacationDateControls dateRange={dateRange} invalidDateRange={invalidDateRange} onDateRangeChange={onDateRangeChange} pending={false} recoveringInvalidDates={recoveringInvalidDates} />
    </section>
  )
}

function VacationConfirmationModal({ dateRange, invalidDateRange, onClose, onConfirm, onDateRangeChange, open }: { dateRange: VacationDateRange; invalidDateRange: boolean; onClose: () => void; onConfirm: () => void; onDateRangeChange: (dateRange: VacationDateRange) => void; open: boolean }) {
  return (
    <ModalSheet onClose={onClose} open={open} scrollResetKey={open ? 'open' : 'closed'} title="Confirm Vacation">
      <div className={styles.vacationModalBody}>
        <VacationDateControls dateRange={dateRange} invalidDateRange={invalidDateRange} onConfirm={onConfirm} onDateRangeChange={onDateRangeChange} pending={true} recoveringInvalidDates={false} showConfirm />
      </div>
    </ModalSheet>
  )
}

function VacationPage() {
  const entities = useHass((state) => state.entities) as unknown as Record<string, HassEntity | undefined>
  const vacationMode = useEntity(asEntityName(VACATION_MODE_ENTITY_ID), { returnNullIfNotFound: true })
  const invalidDatesPending = useEntity(asEntityName(VACATION_INVALID_DATES_PENDING_ENTITY_ID), { returnNullIfNotFound: true })
  const startEntity = useEntity(asEntityName(VACATION_START_ENTITY_ID), { returnNullIfNotFound: true })
  const endEntity = useEntity(asEntityName(VACATION_END_ENTITY_ID), { returnNullIfNotFound: true })
  const callService = useCallService()
  const [optimisticEnabled, commitEnabled] = useOptimisticState(isActiveState(vacationMode))
  const [checklistStateKey, commitChecklistStateKey] = useOptimisticState(vacationChecklistStateKeyFromEntities(entities))
  const [blockedEnableAttempted, setBlockedEnableAttempted] = useState(false)
  const [pendingDateRange, setPendingDateRange] = useState<VacationDateRange | null>(null)
  const pendingVacation = pendingDateRange !== null
  const dateRange = pendingDateRange ?? vacationDateRangeFromStates(startEntity?.state, endEntity?.state)
  const invalidDateRange = isVacationDateRangeInvalid(dateRange)
  const recoveringInvalidDates = !pendingVacation && (invalidDateRange || isActiveState(invalidDatesPending))
  const inlineDatesVisible = optimisticEnabled || recoveringInvalidDates
  const checklistStates = vacationChecklistStatesFromKey(checklistStateKey)
  const checklistComplete = isVacationChecklistComplete(checklistStateKey)
  const showPreChecklistError = blockedEnableAttempted && !checklistComplete && !inlineDatesVisible && !pendingVacation

  const commitChecklistItemState = (entityId: string, nextState: string) => {
    const nextKey = vacationChecklistStateKeyWithItem(checklistStateKey, entityId, nextState)
    commitChecklistStateKey(nextKey)
    if (isVacationChecklistComplete(nextKey)) setBlockedEnableAttempted(false)
  }

  const commitVacationEnabled = (nextEnabled: boolean) => {
    if (nextEnabled) setBlockedEnableAttempted(false)
    if (!nextEnabled) setPendingDateRange(null)
    commitEnabled(nextEnabled)
  }

  const setVacationPending = (pending: boolean) => {
    setPendingDateRange(pending ? defaultVacationDateRange() : null)
    if (pending) setBlockedEnableAttempted(false)
  }

  const confirmVacation = () => {
    const confirmedRange = pendingDateRange ?? dateRange
    callService({ domain: 'input_datetime', service: 'set_datetime', target: VACATION_START_ENTITY_ID, serviceData: inputDateTimeServiceData(confirmedRange.start.date, confirmedRange.start.time) })
    callService({ domain: 'input_datetime', service: 'set_datetime', target: VACATION_END_ENTITY_ID, serviceData: inputDateTimeServiceData(confirmedRange.end.date, confirmedRange.end.time) })
    callService({ domain: 'input_boolean', service: 'turn_off', target: VACATION_INVALID_DATES_PENDING_ENTITY_ID })
    callService({ domain: 'input_boolean', service: 'turn_on', target: VACATION_MODE_ENTITY_ID })
    setPendingDateRange(null)
    commitVacationEnabled(true)
  }

  return (
    <div className={styles.stack}>
      <section className={styles.section}>
        <SectionHeader title="Vacation Mode" />
        <Description>{VACATION_MODE_DESCRIPTION}</Description>
        {showPreChecklistError && <InlineAlert className={styles.vacationModeError}>{VACATION_PRE_CHECKLIST_ERROR}</InlineAlert>}
        <VacationModeCard disabled={recoveringInvalidDates && invalidDateRange} enabled={optimisticEnabled || recoveringInvalidDates} onBlockedEnable={() => setBlockedEnableAttempted(true)} onEnabledChange={commitVacationEnabled} onPendingChange={setVacationPending} pending={pendingVacation} preChecklistComplete={checklistComplete} />
      </section>
      {inlineDatesVisible
        ? <VacationDatesSection dateRange={dateRange} invalidDateRange={invalidDateRange} onDateRangeChange={setPendingDateRange} recoveringInvalidDates={recoveringInvalidDates} />
        : <VacationChecklistSection onStateChange={commitChecklistItemState} states={checklistStates} />}
      <VacationConfirmationModal dateRange={pendingDateRange ?? dateRange} invalidDateRange={pendingVacation && invalidDateRange} onClose={() => setVacationPending(false)} onConfirm={confirmVacation} onDateRangeChange={setPendingDateRange} open={pendingVacation} />
    </div>
  )
}

const MEDIA_PAGE_REMOTE_HASH_BY_ENTITY_ID: Record<string, string> = {
  'media_player.living_room_shield': '#living-room-shield',
  'media_player.living_room_shield_2': '#living-room-shield',
  'media_player.sony_projector': '#theater-room-shield',
  'media_player.theater_room_shield': '#theater-room-shield',
}

function mediaPageCardFromItem(item: EntitySectionConfig['items'][number]): RoomSourceCardConfig {
  const hash = item.action?.type === 'navigate' && item.action.path.startsWith('#')
    ? item.action.path
    : MEDIA_PAGE_REMOTE_HASH_BY_ENTITY_ID[item.entityId]
  const isLivingRoomShield = item.entityId === 'media_player.living_room_shield'
  return {
    action: hash ? undefined : item.action as RoomSourceCardAction | undefined,
    activeStates: ['on', 'playing'],
    entityId: item.entityId,
    hash,
    icon: isLivingRoomShield ? 'mdi:television' : item.icon ?? 'mdi:remote',
    kind: 'media',
    showState: true,
    span: item.title === 'Theater Room' || item.entityId === 'media_player.living_room_shield' ? 'full' : undefined,
    stateIcons: isLivingRoomShield ? { off: 'mdi:television-off', unavailable: 'mdi:television-off', unknown: 'mdi:television-off' } : undefined,
    title: item.title,
  }
}

const MEDIA_SOURCE_SECTIONS = MEDIA_SECTIONS.map((section) => ({
  ...section,
  cards: section.items.map(mediaPageCardFromItem),
}))

const MEDIA_SOURCE_CARDS = MEDIA_SOURCE_SECTIONS.flatMap((section) => section.cards)

function MediaPage({ preload = false, preloadHash, preloadHashes = [] }: { preload?: boolean; preloadHash?: string; preloadHashes?: string[] }) {
  const [selectedCard, setSelectedCard] = useState<RoomSourceCardConfig | null>(null)
  const preloadCard = preloadHash ? MEDIA_SOURCE_CARDS.find((candidate) => candidate.hash === preloadHash) ?? null : null
  const preloadCards = useMemo(() => preloadHashes.map((preloadTargetHash) => MEDIA_SOURCE_CARDS.find((candidate) => candidate.hash === preloadTargetHash)).filter((card): card is RoomSourceCardConfig => Boolean(card?.hash)), [preloadHashes])

  const closeSourceCard = () => {
    setSelectedCard(null)
    if (preload) return
    if (dashboardHash()) replaceDashboardUrl(dashboardPathWithSearch())
  }

  const openSourceCard = (card: RoomSourceCardConfig) => {
    setSelectedCard(card)
    if (card.hash) setRoomHash(card.hash)
  }

  useEffect(() => {
    if (preload) return undefined

    const syncFromHash = () => {
      const card = MEDIA_SOURCE_CARDS.find((candidate) => candidate.hash === dashboardHash())
      setSelectedCard(card ?? null)
    }

    const targets = dashboardEventTargets()
    syncFromHash()
    targets.forEach((target) => {
      target.addEventListener('hashchange', syncFromHash)
      target.addEventListener(DASHBOARD_ROUTE_CHANGE_EVENT, syncFromHash)
    })
    return () => {
      targets.forEach((target) => {
        target.removeEventListener('hashchange', syncFromHash)
        target.removeEventListener(DASHBOARD_ROUTE_CHANGE_EVENT, syncFromHash)
      })
    }
  }, [preload])

  return (
    <div className={styles.stack}>
      {MEDIA_SOURCE_SECTIONS.map((section) => (
        <section className={styles.section} key={section.title}>
          <SectionHeader title={section.title} />
          <Grid>
            {section.cards.map((card) => <RoomSourceCard card={card} key={`${section.title}-${card.entityId}-${card.title}`} onOpen={openSourceCard} />)}
          </Grid>
        </section>
      ))}
      <RoomSourceModal card={selectedCard} onClose={closeSourceCard} preloadCard={preloadCard} roomTitle={(selectedCard ?? preloadCard)?.title === 'Theater Room' ? 'Theater Room' : 'Living Room'} />
      {preloadCards.map((card) => (
        <div data-preload-modal={`media${card.hash}`} key={`media-preload-${card.hash}`}>
          <RoomSourcePreloadContent card={card} roomTitle={card.title === 'Theater Room' ? 'Theater Room' : 'Living Room'} />
        </div>
      ))}
    </div>
  )
}

function AdminPage({ onNavigate, preload = false, preloadHash, preloadHashes = [] }: { onNavigate: (path: string) => void; preload?: boolean; preloadHash?: string; preloadHashes?: string[] }) {
  const { closeHash, hash, openHash } = useHashModal({ disabled: preload })
  const [selectedPresenceOverride, setSelectedPresenceOverride] = useState<PresenceOverrideConfig | null>(null)
  const presenceDetailPageKey = selectedPresenceOverride?.entityId ?? 'overview'
  const { bodyElementRef, enterDetailPage, leaveDetailPage, resetDetailPageScroll } = useModalDetailPageScroll(presenceDetailPageKey)
  const contentHash = hash || preloadHash || ''
  const presenceModalOpen = hash === '#presence-based-overrides'
  const autoResetModalOpen = hash === '#presence-based-overrides-auto'
  const presenceModalContentActive = contentHash === '#presence-based-overrides'
  const autoResetModalContentActive = contentHash === '#presence-based-overrides-auto'
  const [presenceGridRef, presenceGridLayout] = useModalSquareGridLayout(presenceModalOpen, ADMIN_PRESENCE_OVERRIDE_ITEMS.length)
  const [autoResetGridRef, autoResetGridLayout] = useModalSquareGridLayout(autoResetModalOpen, ADMIN_AUTO_REENABLE_ITEMS.length)
  const openPresenceModal = (nextHash: string) => {
    resetDetailPageScroll()
    setSelectedPresenceOverride(null)
    openHash(nextHash)
  }
  const openPresenceDetail = (item: PresenceOverrideConfig) => {
    enterDetailPage(item.entityId)
    setSelectedPresenceOverride(item)
  }
  const closePresenceDetail = () => {
    leaveDetailPage()
    setSelectedPresenceOverride(null)
  }

  return (
    <div className={styles.stack}>
      <section className={styles.section}>
        <SectionHeader title="Security Controls" />
        <Description>{ADMIN_DESCRIPTIONS.autoLock}</Description>
        <AdminTileGrid items={ADMIN_SECURITY_CONTROLS} onNavigate={onNavigate} />
      </section>

      <section className={styles.section}>
        <SectionHeader title="Living Room Power Recovery" />
        <Description>{ADMIN_DESCRIPTIONS.livingRoomPowerRecovery}</Description>
        <LivingRoomPowerRecoveryButton />
      </section>

      <section className={styles.section}>
        <SectionHeader title="Relay Control Mode" />
        <Description>{ADMIN_DESCRIPTIONS.relayControlMode}</Description>
        <AdminTileGrid items={ADMIN_RELAY_CONTROL_ITEMS} onNavigate={onNavigate} />
      </section>

      <section className={styles.section}>
        <SectionHeader title="Presence-Based Light Overrides" />
        <Description>{ADMIN_DESCRIPTIONS.presenceOverrides}</Description>
        <AdminHashButton hash="#presence-based-overrides" onOpen={openPresenceModal} title="Open Presence-Based Overrides" />
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

      <ModalSheet
        backLabel="Back to presence overrides"
        bodyElementRef={bodyElementRef}
        contentStyle={presenceModalContentActive ? modalSquareGridModalStyle(presenceGridLayout) : undefined}
        onBack={selectedPresenceOverride ? closePresenceDetail : undefined}
        onClose={closeHash}
        open={presenceModalOpen}
        scrollResetKey={presenceDetailPageKey}
        surface="hass-popup"
        title={selectedPresenceOverride ? `${selectedPresenceOverride.title} Presence Lighting` : 'Presence-Based Overrides'}
      >
        <div className={styles.adminModalBody}>
          {presenceModalContentActive && (
            selectedPresenceOverride
              ? <PresenceOverrideDetailPage item={selectedPresenceOverride} />
              : <AdminPresenceOverrideGrid gridLabel="Presence-Based Overrides by room" items={ADMIN_PRESENCE_OVERRIDE_ITEMS} onSelect={openPresenceDetail} squareGridRef={presenceGridRef} squareGridStyle={modalSquareGridStyle(presenceGridLayout)} />
          )}
        </div>
      </ModalSheet>

      <ModalSheet contentStyle={autoResetModalContentActive ? modalSquareGridModalStyle(autoResetGridLayout) : undefined} onClose={closeHash} open={autoResetModalOpen} surface="hass-popup" title="Presence-Based Overrides Auto-Reset">
        <div className={styles.adminModalBody}>
          {autoResetModalContentActive && <AdminTileGrid gridLabel="Presence-Based Auto-Reset by room" items={ADMIN_AUTO_REENABLE_ITEMS} onNavigate={onNavigate} squareGridRef={autoResetGridRef} squareGridStyle={modalSquareGridStyle(autoResetGridLayout)} variant="admin-modal" />}
        </div>
      </ModalSheet>
      {preloadHashes.includes('#presence-based-overrides') && (
        <div data-preload-modal="admin#presence-based-overrides">
          <div className={styles.adminModalBody}>
            <AdminPresenceOverrideGrid gridLabel="Presence-Based Overrides by room" items={ADMIN_PRESENCE_OVERRIDE_ITEMS} onSelect={() => undefined} />
          </div>
        </div>
      )}
      {preloadHashes.includes('#presence-based-overrides-auto') && (
        <div data-preload-modal="admin#presence-based-overrides-auto">
          <div className={styles.adminModalBody}>
            <AdminTileGrid gridLabel="Presence-Based Auto-Reset by room" items={ADMIN_AUTO_REENABLE_ITEMS} onNavigate={onNavigate} variant="admin-modal" />
          </div>
        </div>
      )}
    </div>
  )
}

const THERMOSTAT_SECTION_DESCRIPTIONS = {
  ecoMode:
    "Enable Eco Mode to only track active rooms, and disable heating/cooling inactive, but critical temperature, rooms.\n\nUse the dropdown on the right side of the button to configure Eco Mode's behavior when everyone is out of the house.\n\nTo have specific rooms override Eco mode, enable Track Selected Rooms, and select the rooms you'd like to enable critical monitoring for.",
  forceCritical:
    "For rooms that are not selected above, you can select rooms here that we should still monitor for critical temperatures.\n\nA good example is the theater room, which sits below rooms we want heated or cooled, or the music room, which sits below the living room; even if we aren't actively monitoring them, those rooms being around temp mean more comfortable conditions upstairs.",
  integration: 'Enable or disable automatic thermostat control.',
  predictiveComfort:
    'Use forecast weather, humidity, indoor sensors, and learned heat-load patterns to prepare the house before it drifts out of the comfort band.\n\nThis enables predictive recommendations. Thermostat setpoint changes still require the separate auto-adjust option in the integration settings.',
  trackOnlyWhenOccupied:
    'Choose which rooms should stay out of thermostat decisions until they are occupied. When enabled, the room is ignored for temperature demand and minimum-vent balancing while empty, and its vent closes; once occupied, it participates normally.',
  trackSelected:
    'Track only a subset of monitored rooms for automated control. Monitored rooms can be configured in the integration settings.\n\nThis setting works in tandem with eco mode, but eco mode is not required to be enabled to use it.',
} as const

function contactSensorTitle(group: EntityGroupConfig, item: EntityGroupConfig['items'][number]) {
  const groupTitle = group.title.replace(/\s+Contact Sensors$/, '')
  if (item.title.includes(groupTitle) || item.title === 'Front Door') return item.title
  return `${groupTitle} ${item.title}`
}

const THERMOSTAT_CONTACT_SENSORS = CONTACT_GROUPS.flatMap((group) =>
  group.items.map((item) => ({
    entityId: item.entityId,
    title: contactSensorTitle(group, item),
  })),
)

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
const ECO_AWAY_THERMOSTAT_ENTITY_ID = 'climate.thermostat_contact_sensors_eco_away_virtual_thermostat'
const THERMOSTAT_AWAY_MODE_ENTITY_ID = 'binary_sensor.thermostat_contact_sensors_away_mode_active'
const THERMOSTAT_HOME_AWAY_ENTITY_ID = 'sensor.thermostat_effective_home_away'
const THERMOSTAT_HOME_AWAY_REASON_ENTITY_ID = 'sensor.thermostat_home_away_reason'
const PREDICTIVE_COMFORT_SWITCH_ENTITY_ID = 'switch.thermostat_contact_sensors_predictive_comfort_mode'
const PREDICTIVE_AUTO_ADJUST_SWITCH_ENTITY_ID = 'switch.thermostat_contact_sensors_predictive_auto_adjust'
const PREDICTIVE_HVAC_MODE_CHANGE_SWITCH_ENTITY_ID = 'switch.thermostat_contact_sensors_predictive_hvac_mode_changes'
const PREDICTIVE_ALLOW_AWAY_SWITCH_ENTITY_ID = 'switch.thermostat_contact_sensors_predictive_allow_away'
const PREDICTIVE_COMFORT_SENSOR_ENTITY_ID = 'sensor.living_room_thermostat_contact_sensors_predictive_comfort_mode'
const PREDICTIVE_COMFORT_HASH = '#predictive-comfort'
const PREDICTIVE_STATE_LABELS: Readonly<Record<string, string>> = {
  pre_cool: 'Pre-Cool',
}
const THERMOSTAT_ROOM_CLIMATE_ENTITY_IDS = THERMOSTAT_ROOM_VIEWS.map((room) => room.climateEntityId)
const THERMOSTAT_HEAT_COLOR = '#cd5401'
const THERMOSTAT_COOL_COLOR = '#2c8e98'
const THERMOSTAT_NEUTRAL_COLOR = 'rgba(255, 255, 255, 0.78)'
const THERMOSTAT_MODAL_DIAL_SHELL_STYLE = {
  '--thermostat-modal-dial-gutter': `${THERMOSTAT_MODAL_DIAL_GUTTER_PX}px`,
} as CSSProperties
const THERMOSTAT_ROOM_MODAL_STYLE: ModalSheetStyle = {
  '--modal-desktop-width': '600px',
  '--modal-desktop-max-width': '600px',
  '--modal-desktop-height': 'auto',
}

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

function thermostatTrackOnlyWhenOccupiedEntityId(room: ThermostatRoomView) {
  return `switch.living_room_thermostat_contact_sensors_${room.key}_track_only_when_occupied`
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

function temperatureUnit(entity: HassEntity | null | undefined) {
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

type DashboardCallService = ReturnType<typeof useCallService>

function formatDishwasherBinaryStatus(entity: HassEntity | null | undefined, onLabel = 'On', offLabel = 'Off') {
  if (!dishwasherEntityAvailable(entity)) return 'Unavailable'
  if (entity.state === 'on') return onLabel
  if (entity.state === 'off') return offLabel
  return titleCaseState(entity.state)
}

function formatDishwasherProgressStatus(entity: HassEntity | null | undefined) {
  const progress = dishwasherProgressPercent(entity)
  return progress === undefined ? 'No active cycle' : `${Math.round(progress)}%`
}

function formatDishwasherFinishTime(entity: HassEntity | null | undefined) {
  if (!dishwasherEntityAvailable(entity)) return 'No active cycle'
  const finishDate = new Date(entity.state)
  if (Number.isNaN(finishDate.getTime())) return formatCompactEntityState(entity, 'Unavailable')
  return finishDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

type DishwasherInfoPillTone = 'danger' | 'ok' | 'warning'

function DishwasherInfoPill({ label, tone, value }: { label: string; tone?: DishwasherInfoPillTone; value: string }) {
  return (
    <span aria-label={`${label} ${value}`} className={styles.dishwasherInfoPill} data-tone={tone} role="group">
      <span className={styles.dishwasherInfoText}>
        <span>{label}</span>
        <strong>{value}</strong>
      </span>
    </span>
  )
}

function DishwasherStatusChip({ entityId, formatter = (entity) => formatCompactEntityState(entity ?? null, 'Unavailable'), title, tone, valueOverride }: { entityId: string; formatter?: (entity: HassEntity | null | undefined) => string; title: string; tone?: DishwasherInfoPillTone; valueOverride?: string }) {
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true })
  const value = valueOverride ?? formatter(entity)

  return <DishwasherInfoPill label={title} tone={tone} value={value} />
}

function DishwasherSupplyStatusChip({ entityId, title }: { entityId: string; title: string }) {
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true })
  const value = formatDishwasherSupplyState(entity)
  const tone = value === 'Low' ? 'warning' : value === 'OK' ? 'ok' : undefined

  return <DishwasherInfoPill label={title} tone={tone} value={value} />
}

function DishwasherActionButton({ domain, entityId, expectedOperationState, icon, onOptimisticOperationState, span, title, tone = 'switch' }: { domain: 'button' | 'input_button'; entityId: string; expectedOperationState: string; icon: string; onOptimisticOperationState: (state: string) => void; span?: 'full'; title: string; tone?: 'danger' | 'neutral' | 'switch' }) {
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true })
  const callService = useCallService()
  const disabled = !entity || entity.state === 'unavailable'
  const handleClick = () => {
    onOptimisticOperationState(expectedOperationState)
    callService({ domain, service: 'press', target: entityId })
  }
  const tile = (
    <GlassTile
      icon={<MaterialIcon name={icon} size={24} />}
      isOff={disabled}
      onClick={disabled ? undefined : handleClick}
      subtitle={disabled ? 'Unavailable' : undefined}
      title={title}
      tone={disabled ? 'neutral' : tone}
    />
  )

  if (span === 'full') return <div className={styles.fullSpan}>{tile}</div>
  return tile
}

function DishwasherSwitchOption({ entityId, icon, title }: { entityId: string; icon: string; title: string }) {
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true })
  const callService = useCallService()
  const liveState = entity?.state ?? 'unavailable'
  const [displayState, commitState] = useOptimisticState(liveState)
  const disabled = !entity || entity.state === 'unavailable' || entity.state === 'unknown'
  const active = displayState === 'on'
  const stateLabel = disabled ? 'Unavailable' : active ? 'On' : 'Off'
  const toggle = () => {
    const nextState = active ? 'off' : 'on'
    commitState(nextState)
    callService({ domain: 'switch', service: nextState === 'on' ? 'turn_on' : 'turn_off', target: entityId })
  }

  return <GlassTile icon={<MaterialIcon name={icon} size={24} />} isOff={disabled || !active} onClick={disabled ? undefined : toggle} pressed={active} subtitle={stateLabel} title={title} tone={active ? 'switch' : 'neutral'} />
}

function DishwasherProgramPicker() {
  const entity = useEntity(asEntityName(DISHWASHER_ENTITY_IDS.selectedProgram), { returnNullIfNotFound: true })
  const callService = useCallService()
  const rawOptions = entity?.attributes.options
  const options: PickerOption[] = Array.isArray(rawOptions)
    ? rawOptions.map((option) => {
        const value = String(option)
        return { icon: 'mdi:dishwasher', label: formatDishwasherProgram(value), value }
      })
    : []
  const liveValue = entity?.state ?? ''
  const [displayValue, commitValue] = useOptimisticState(liveValue)
  const disabled = dishwasherEntityUnavailable(entity) || options.length === 0
  const displayLabel = formatDishwasherProgram(displayValue)
  const selectOptions = displayValue && !options.some((option) => option.value === displayValue) ? [{ icon: 'mdi:dishwasher', label: displayLabel, value: displayValue }, ...options] : options
  const selectProgram = (nextValue: string) => {
    if (nextValue === displayValue) return

    commitValue(nextValue)
    callService({ domain: 'select', service: 'select_option', target: DISHWASHER_ENTITY_IDS.selectedProgram, serviceData: { option: nextValue } })
  }

  return (
    <label className={styles.dishwasherProgramSelect} data-disabled={disabled ? 'true' : 'false'}>
      <span aria-hidden="true" className={styles.dishwasherProgramIcon}>
        <MaterialIcon name="mdi:dishwasher" size={30} />
      </span>
      <span className={styles.dishwasherProgramCopy}>
        <span className={styles.dishwasherProgramLabel}>Program</span>
        <span className={styles.dishwasherProgramValue}>{displayLabel}</span>
      </span>
      <select aria-label="Program" className={styles.dishwasherProgramNativeSelect} disabled={disabled} onChange={(event) => selectProgram(event.target.value)} value={displayValue}>
        {selectOptions.length === 0 && <option value={displayValue}>{displayLabel}</option>}
        {selectOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <span aria-hidden="true" className={styles.dishwasherProgramChevron}>
        <MaterialIcon name="mdi:chevron-down" size={24} />
      </span>
    </label>
  )
}

function DishwasherActionStatusCard({ icon, subtitle, title }: { icon: string; subtitle: string; title: string }) {
  return (
    <Card
      ariaLabel={`${title} ${subtitle}`}
      color={CONTROL_COLOR}
      icon={<MaterialIcon name={icon} size={30} />}
      muted={false}
      size="compact"
      subtitle={subtitle}
      title={title}
    />
  )
}

function DishwasherActionsSection({ onOptimisticOperationState, operationState }: { onOptimisticOperationState: (state: string) => void; operationState: string }) {
  const showStop = DISHWASHER_STOP_ACTION_STATES.has(operationState)
  const showResume = DISHWASHER_RESUME_ACTION_STATES.has(operationState)
  const showStopping = operationState === 'aborting'

  return (
    <section className={styles.section}>
      <SectionHeader title="Actions" />
      <Grid>
        {!showStop && !showStopping && <DishwasherActionButton domain="input_button" entityId={DISHWASHER_ENTITY_IDS.startProgram} expectedOperationState="run" icon="mdi:play" onOptimisticOperationState={onOptimisticOperationState} span="full" title="Start Dishwasher" />}
        {showResume && <DishwasherActionButton domain="button" entityId={DISHWASHER_ENTITY_IDS.resumeProgram} expectedOperationState="run" icon="mdi:play-pause" onOptimisticOperationState={onOptimisticOperationState} title="Resume Program" />}
        {showStop && <DishwasherActionButton domain="button" entityId={DISHWASHER_ENTITY_IDS.stopProgram} expectedOperationState="aborting" icon="mdi:stop" onOptimisticOperationState={onOptimisticOperationState} title="Stop Program" tone="danger" />}
        {showStopping && <DishwasherActionStatusCard icon="mdi:timer-sand" subtitle="Waiting for Home Assistant" title="Stopping" />}
      </Grid>
    </section>
  )
}

function DishwasherModalContent() {
  const operation = useEntity(asEntityName(DISHWASHER_ENTITY_IDS.operation), { returnNullIfNotFound: true })
  const liveOperationState = operation?.state ?? 'unavailable'
  const [displayOperationState, commitDisplayOperationState] = useOptimisticState(liveOperationState, { revertMs: DISHWASHER_OPTIMISTIC_REVERT_MS })

  return (
    <div className={styles.dishwasherModal}>
      <section className={styles.section}>
        <SectionHeader title="Program" />
        <DishwasherProgramPicker />
        <Description>Start uses the Home Assistant dishwasher helper so Home Assistant owns the Home Connect program and option command.</Description>
      </section>

      <DishwasherActionsSection onOptimisticOperationState={commitDisplayOperationState} operationState={displayOperationState} />

      <section className={styles.section}>
        <SectionHeader title="Options" />
        <Grid>
          <DishwasherSwitchOption entityId={DISHWASHER_ENTITY_IDS.power} icon="mdi:power" title="Power" />
          <DishwasherSwitchOption entityId={DISHWASHER_ENTITY_IDS.halfLoad} icon="mdi:fraction-one-half" title="Half Load" />
          <DishwasherSwitchOption entityId={DISHWASHER_ENTITY_IDS.zeoliteDry} icon="mdi:weather-windy" title="Zeolite Dry" />
          <DishwasherSwitchOption entityId={DISHWASHER_ENTITY_IDS.hygiene} icon="mdi:shield-plus" title="Hygiene +" />
        </Grid>
      </section>

      <section className={styles.section}>
        <SectionHeader title="Status" />
        <div className={styles.dishwasherStatusPanel}>
          <DishwasherStatusChip entityId={DISHWASHER_ENTITY_IDS.operation} formatter={formatDishwasherOperation} title="Operation" valueOverride={formatDishwasherOperationState(displayOperationState)} />
          <DishwasherStatusChip entityId={DISHWASHER_ENTITY_IDS.cleanUnopened} formatter={(entity) => formatDishwasherBinaryStatus(entity, 'Clean', 'Cleared')} title="Clean Unopened" />
          <DishwasherStatusChip entityId={DISHWASHER_ENTITY_IDS.progress} formatter={formatDishwasherProgressStatus} title="Progress" />
          <DishwasherStatusChip entityId={DISHWASHER_ENTITY_IDS.activeProgram} formatter={(entity) => formatDishwasherProgram(entity?.state)} title="Active Program" />
          <DishwasherStatusChip entityId={DISHWASHER_ENTITY_IDS.door} formatter={formatDishwasherEnumState} title="Door" />
          <DishwasherStatusChip entityId={DISHWASHER_ENTITY_IDS.connectivity} formatter={(entity) => formatDishwasherBinaryStatus(entity, 'Online', 'Offline')} title="Connectivity" />
          <DishwasherStatusChip entityId={DISHWASHER_ENTITY_IDS.remoteControl} formatter={(entity) => formatDishwasherBinaryStatus(entity, 'Enabled', 'Disabled')} title="Remote Control" />
          <DishwasherStatusChip entityId={DISHWASHER_ENTITY_IDS.remoteStart} formatter={(entity) => formatDishwasherBinaryStatus(entity, 'Enabled', 'Disabled')} title="Remote Start" />
          <DishwasherStatusChip entityId={DISHWASHER_ENTITY_IDS.programFinishTime} formatter={formatDishwasherFinishTime} title="Finish Time" />
          <DishwasherSupplyStatusChip entityId={DISHWASHER_ENTITY_IDS.rinseAid} title="Rinse Aid" />
          <DishwasherSupplyStatusChip entityId={DISHWASHER_ENTITY_IDS.salt} title="Salt" />
        </div>
      </section>
    </div>
  )
}

type ThermostatSliderTarget = 'high' | 'low' | 'value'
type ThermostatDisplayTargets = { high: number | null; low: number | null; sourceKey: string; target: number | null }
type ThermostatThermalStatus = 'cool' | 'heat' | 'idle'
type ThermostatGlassTone = 'contact' | 'default'
type FreeSleepScheduleStage = 'bedtime' | 'asleep' | 'dawn'
type FreeSleepSide = 'left' | 'right'
type FreeSleepAlarmOwner = 'stephen' | 'steph'
type FreeSleepAlarmDay = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'
type FreeSleepSideSchedule = Partial<Record<FreeSleepAlarmDay, FreeSleepDailySchedule>>

interface EightSleepSideConfig {
  alarmOwner: FreeSleepAlarmOwner
  alarmSnoozeButtonEntityId: string
  alarmStateEntityId: string
  alarmStopButtonEntityId: string
  awayModeEntityId: string
  bedtimeEntityId: string
  breathingRateEntityId?: string
  climateEntityId?: string
  currentTemperatureEntityId: string
  hash: string
  heartRateEntityId?: string
  hotFlashActiveEntityId: string
  hotFlashButtonEntityId: string
  hotFlashCancelButtonEntityId: string
  hotFlashRestoreAtEntityId: string
  hotFlashTimerEntityId: string
  hrvEntityId?: string
  powerSwitchEntityId: string
  presenceEntityId: string
  pumpClogEntityId?: string
  pumpLoopTemperatureEntityId?: string
  pumpRpmEntityId?: string
  pumpStallEntityId?: string
  scheduleStageTemperatureEntityIds: Record<FreeSleepScheduleStage, string>
  secondsRemainingEntityId: string
  scheduleSide: FreeSleepSide
  targetLevelEntityId?: string
  targetTemperatureEntityId: string
  title: string
}

interface FreeSleepAlarmSchedule {
  alarmTemperature: number
  duration: number
  enabled: boolean
  time: string
  vibrationIntensity: number
  vibrationPattern: 'double' | 'rise'
}

interface FreeSleepDailySchedule {
  alarm?: Partial<FreeSleepAlarmSchedule>
  alarms?: Partial<FreeSleepAlarmSchedule>[]
  power?: {
    enabled?: boolean
    on?: string
    off?: string
    onTemperature?: number
  }
  temperatures?: Record<string, unknown>
}

type FreeSleepSchedulesState = Partial<Record<FreeSleepSide, FreeSleepSideSchedule>>

interface FreeSleepAlarmRecord extends FreeSleepAlarmSchedule {
  day: FreeSleepAlarmDay
  id: string
  index: number
}

interface EightSleepBedModalState {
  activeSchedulePhase: SleepypodSchedulePhase | null
  cancelTargetTemperature: () => void
  commitDisplaySideOn: (sideOn: boolean) => void
  commitHotFlashActive: (active: boolean) => void
  commitTargetTemperature: (value: number) => void
  controlMode: 'climate' | 'legacy'
  controlsSideOn: boolean
  currentTemperature: number | null
  displayedTargetValue: number | null
  heroAction: string
  hotFlashActive: boolean
  hotFlashAvailable: boolean
  schedulePhaseAvailable: boolean
  sideAvailable: boolean
  subtitle: string
  targetMax: number
  targetMin: number
  targetScale: 'level' | 'temperature'
  targetStep: number
}

interface BedTemperatureScopeRequest {
  open: boolean
  phase: SleepypodSchedulePhase
  returnFocus: HTMLElement | null
  targetText: string
  value: number
}

interface EightSleepAlarmEditorDraft {
  days: FreeSleepAlarmDay[]
  editingId: string | null
  enabled: boolean
  time: string
  title: string
}

interface EightSleepAlarmDayPage {
  day: FreeSleepAlarmDay
  kind: 'day'
}

interface EightSleepAlarmEditorPage {
  draft: EightSleepAlarmEditorDraft
  kind: 'editor'
  lockedDay: FreeSleepAlarmDay | null
}

type EightSleepAlarmDetailPage = EightSleepAlarmDayPage | EightSleepAlarmEditorPage

const FREE_SLEEP_TARGET_MIN = -10
const FREE_SLEEP_TARGET_MAX = 10
const FREE_SLEEP_TARGET_STEP = 1
const FREE_SLEEP_TARGET_REVERT_MS = 30000
const SLEEPYPOD_TARGET_CONFIRMATION_HOLD_MS = 3000
const THERMOSTAT_DIAL_TAP_TOLERANCE_PX = 8
const FREE_SLEEP_ALARM_SYNC_DEBOUNCE_MS = 450
const FREE_SLEEP_NUMBER_SYNC_DEBOUNCE_MS = 300
const EIGHT_SLEEP_LEVEL_ZERO_F = 82.5
const EIGHT_SLEEP_LEVEL_RANGE_F = 27.5
const EIGHT_SLEEP_POWER_REVERT_MS = 30000
const EIGHT_SLEEP_UNAVAILABLE_HOLD_MS = 10000
const FREE_SLEEP_SCHEDULE_SENSOR_ENTITY_ID = 'sensor.nightcanvasrestful_schedules'
const FREE_SLEEP_SCHEDULE_SET_TOPIC = 'free-sleep/NightCanvasRestful/schedules/set'
const SLEEPYPOD_SCHEDULE_SENSOR_ENTITY_ID = 'sensor.master_bedroom_sleepypod_eight_pod_schedules'
const SLEEPYPOD_SCHEDULE_SET_TOPIC = 'sleepypod/eight-pod/cmd/set-schedules'
const FREE_SLEEP_BEDTIME_SET_TOPIC_PREFIX = 'free-sleep/NightCanvasRestful'
const FREE_SLEEP_ALARM_DEBUG_TOPIC = 'free-sleep/NightCanvasRestful/debug/react-dash/alarm'
const FREE_SLEEP_ALARM_DIAGNOSTICS_STORAGE_KEY = 'freeSleepAlarmDiagnostics'
const SLEEPYPOD_DEFAULT_BEDTIME = '21:30'
const SLEEPYPOD_DEFAULT_WAKE_TIME = '09:00'
const SLEEPYPOD_DEFAULT_ASLEEP_TIME = '01:00'
const SLEEPYPOD_DEFAULT_DAWN_TIME = '05:00'
let freeSleepAlarmDebugSequence = 0
const FREE_SLEEP_DEFAULT_ALARM: FreeSleepAlarmSchedule = {
  alarmTemperature: 82,
  duration: 300,
  enabled: true,
  time: '07:00',
  vibrationIntensity: 100,
  vibrationPattern: 'rise',
}
const FREE_SLEEP_SCHEDULE_STAGES: { icon: string; key: FreeSleepScheduleStage; label: string }[] = [
  { icon: 'mdi:bed', key: 'bedtime', label: 'Bedtime' },
  { icon: 'mdi:moon-waning-crescent', key: 'asleep', label: 'Asleep' },
  { icon: 'mdi:weather-sunny', key: 'dawn', label: 'Dawn' },
]
type EightSleepModalTab = 'schedule' | 'modes' | 'alarms' | 'status' | 'settings'
const EIGHT_SLEEP_MODAL_TABS: { icon: string; label: string; tab: EightSleepModalTab }[] = [
  { icon: 'mdi:thermostat', label: 'Sleep Schedule', tab: 'schedule' },
  { icon: 'mdi:snowflake', label: 'Special Modes', tab: 'modes' },
  { icon: 'mdi:alarm', label: 'Alarms', tab: 'alarms' },
  { icon: 'mdi:information-outline', label: 'Status', tab: 'status' },
  { icon: 'mdi:cog', label: 'Settings', tab: 'settings' },
]
const SLEEPYPOD_MODAL_TABS: { icon: string; label: string; tab: EightSleepModalTab }[] = [
  { icon: 'mdi:thermostat', label: 'Temperature', tab: 'schedule' },
  { icon: 'mdi:snowflake', label: 'Special Modes', tab: 'modes' },
  { icon: 'mdi:alarm', label: 'Alarms', tab: 'alarms' },
  { icon: 'mdi:information-outline', label: 'Status', tab: 'status' },
]
const EIGHT_SLEEP_BED_MODAL_STYLE: ModalSheetStyle = {
  '--modal-desktop-width': '700px',
  '--modal-desktop-max-width': '700px',
  '--modal-desktop-height': '70vh',
  '--modal-desktop-max-height': '70vh',
}
const EIGHT_SLEEP_ALARM_EDITOR_MODAL_STYLE: ModalSheetStyle = {
  ...EIGHT_SLEEP_BED_MODAL_STYLE,
  '--modal-desktop-height': 'auto',
}
const DESKTOP_MODAL_QUERY = '(min-width: 760px)'
const FREE_SLEEP_ALARM_DAYS: { key: FreeSleepAlarmDay; label: string }[] = [
  { key: 'sunday', label: 'Sunday' },
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
]
const FREE_SLEEP_ALARM_DAY_OPTIONS = FREE_SLEEP_ALARM_DAYS.map((day) => ({ label: day.label, value: day.key }))

function shouldResetScrollOnTabChange() {
  return typeof window.matchMedia !== 'function' || window.matchMedia(DESKTOP_MODAL_QUERY).matches
}
const FREE_SLEEP_ALARM_DAY_KEYS = FREE_SLEEP_ALARM_DAYS.map((day) => day.key)

const EIGHT_SLEEP_SIDE_CONFIGS: EightSleepSideConfig[] = [
  {
    alarmOwner: 'stephen',
    alarmSnoozeButtonEntityId: 'button.master_bedroom_sleepypod_eight_pod_left_alarm_snooze',
    alarmStateEntityId: 'sensor.master_bedroom_sleepypod_eight_pod_left_alarm_state',
    alarmStopButtonEntityId: 'button.master_bedroom_sleepypod_eight_pod_left_alarm_stop',
    awayModeEntityId: 'switch.nightcanvasrestful_left_away_mode',
    bedtimeEntityId: 'text.master_bedroom_eight_sleep_pod_5_left_bedtime',
    breathingRateEntityId: 'sensor.sleepypod_eight_pod_left_breathing_rate',
    climateEntityId: 'climate.sleepypod_eight_pod_left_side',
    currentTemperatureEntityId: 'sensor.nightcanvasrestful_left_current_temperature',
    hash: '#stephens-bed',
    heartRateEntityId: 'sensor.sleepypod_eight_pod_left_heart_rate',
    hotFlashActiveEntityId: 'input_boolean.eight_sleep_stephen_hot_flash_active',
    hotFlashButtonEntityId: 'input_button.eight_sleep_stephen_hot_flash',
    hotFlashCancelButtonEntityId: 'input_button.eight_sleep_stephen_cancel_hot_flash',
    hotFlashRestoreAtEntityId: 'input_datetime.eight_sleep_stephen_hot_flash_restore_at',
    hotFlashTimerEntityId: 'timer.eight_sleep_stephen_hot_flash',
    hrvEntityId: 'sensor.sleepypod_eight_pod_left_hrv',
    powerSwitchEntityId: 'switch.nightcanvasrestful_left_power',
    presenceEntityId: 'binary_sensor.nightcanvasrestful_left_presence',
    pumpClogEntityId: 'binary_sensor.sleepypod_eight_pod_left_pump_clog_detected',
    pumpLoopTemperatureEntityId: 'sensor.sleepypod_eight_pod_left_pump_loop_temp',
    pumpRpmEntityId: 'sensor.sleepypod_eight_pod_left_pump_rpm',
    pumpStallEntityId: 'binary_sensor.sleepypod_eight_pod_left_pump_stall',
    scheduleStageTemperatureEntityIds: {
      asleep: 'input_number.eight_sleep_stephen_asleep_level',
      bedtime: 'input_number.eight_sleep_stephen_bedtime_level',
      dawn: 'input_number.eight_sleep_stephen_dawn_level',
    },
    secondsRemainingEntityId: 'sensor.nightcanvasrestful_left_seconds_remaining',
    scheduleSide: 'left',
    targetLevelEntityId: 'number.master_bedroom_sleepypod_eight_pod_left_target_level',
    targetTemperatureEntityId: 'number.nightcanvasrestful_left_target_temperature',
    title: "Stephen's Bed",
  },
  {
    alarmOwner: 'steph',
    alarmSnoozeButtonEntityId: 'button.master_bedroom_sleepypod_eight_pod_right_alarm_snooze',
    alarmStateEntityId: 'sensor.master_bedroom_sleepypod_eight_pod_right_alarm_state',
    alarmStopButtonEntityId: 'button.master_bedroom_sleepypod_eight_pod_right_alarm_stop',
    awayModeEntityId: 'switch.nightcanvasrestful_right_away_mode',
    bedtimeEntityId: 'text.master_bedroom_eight_sleep_pod_5_right_bedtime',
    breathingRateEntityId: 'sensor.sleepypod_eight_pod_right_breathing_rate',
    climateEntityId: 'climate.sleepypod_eight_pod_right_side',
    currentTemperatureEntityId: 'sensor.nightcanvasrestful_right_current_temperature',
    hash: '#stephs-bed',
    heartRateEntityId: 'sensor.sleepypod_eight_pod_right_heart_rate',
    hotFlashActiveEntityId: 'input_boolean.eight_sleep_steph_hot_flash_active',
    hotFlashButtonEntityId: 'input_button.eight_sleep_steph_hot_flash',
    hotFlashCancelButtonEntityId: 'input_button.eight_sleep_steph_cancel_hot_flash',
    hotFlashRestoreAtEntityId: 'input_datetime.eight_sleep_steph_hot_flash_restore_at',
    hotFlashTimerEntityId: 'timer.eight_sleep_steph_hot_flash',
    hrvEntityId: 'sensor.sleepypod_eight_pod_right_hrv',
    powerSwitchEntityId: 'switch.nightcanvasrestful_right_power',
    presenceEntityId: 'binary_sensor.nightcanvasrestful_right_presence',
    pumpClogEntityId: 'binary_sensor.sleepypod_eight_pod_right_pump_clog_detected',
    pumpLoopTemperatureEntityId: 'sensor.sleepypod_eight_pod_right_pump_loop_temp',
    pumpRpmEntityId: 'sensor.sleepypod_eight_pod_right_pump_rpm',
    pumpStallEntityId: 'binary_sensor.sleepypod_eight_pod_right_pump_stall',
    scheduleStageTemperatureEntityIds: {
      asleep: 'input_number.eight_sleep_steph_asleep_level',
      bedtime: 'input_number.eight_sleep_steph_bedtime_level',
      dawn: 'input_number.eight_sleep_steph_dawn_level',
    },
    secondsRemainingEntityId: 'sensor.nightcanvasrestful_right_seconds_remaining',
    scheduleSide: 'right',
    targetLevelEntityId: 'number.master_bedroom_sleepypod_eight_pod_right_target_level',
    targetTemperatureEntityId: 'number.nightcanvasrestful_right_target_temperature',
    title: "Steph's Bed",
  },
]

function eightSleepSideForHash(hash: string | undefined) {
  return EIGHT_SLEEP_SIDE_CONFIGS.find((side) => side.hash === hash)
}

function eightSleepAlarmEnabledEntityId(owner: FreeSleepAlarmOwner, day: FreeSleepAlarmDay) {
  return `input_boolean.${owner}_${day}_alarm_enabled`
}

function eightSleepAlarmConfiguredEntityId(owner: FreeSleepAlarmOwner, day: FreeSleepAlarmDay) {
  return `input_boolean.${owner}_${day}_alarm_configured`
}

function eightSleepAlarmTimeEntityId(owner: FreeSleepAlarmOwner, day: FreeSleepAlarmDay) {
  return `input_datetime.${owner}_${day}_alarm_time`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeFreeSleepAlarmSchedule(value: unknown): FreeSleepAlarmSchedule | null {
  if (!isRecord(value)) return null
  const time = parsedInputTime(typeof value.time === 'string' ? value.time : undefined, '')
  if (!time) return null
  const alarmTemperature = numberValue(value.alarmTemperature) ?? FREE_SLEEP_DEFAULT_ALARM.alarmTemperature
  const duration = numberValue(value.duration) ?? FREE_SLEEP_DEFAULT_ALARM.duration
  const vibrationIntensity = numberValue(value.vibrationIntensity) ?? FREE_SLEEP_DEFAULT_ALARM.vibrationIntensity
  const vibrationPattern = value.vibrationPattern === 'double' ? 'double' : FREE_SLEEP_DEFAULT_ALARM.vibrationPattern
  return {
    alarmTemperature,
    duration,
    enabled: value.enabled === true,
    time,
    vibrationIntensity,
    vibrationPattern,
  }
}

function scheduleFromEntityAttributes(attributes: Record<string, unknown> | undefined): FreeSleepSchedulesState | null {
  if (!attributes) return null
  const schedule: FreeSleepSchedulesState = {}
  for (const side of ['left', 'right'] as const) {
    const sideValue = attributes[side]
    if (!isRecord(sideValue)) continue
    schedule[side] = {}
    for (const day of FREE_SLEEP_ALARM_DAYS) {
      const dayValue = sideValue[day.key]
      if (isRecord(dayValue)) schedule[side][day.key] = dayValue as FreeSleepDailySchedule
    }
  }
  return schedule.left || schedule.right ? schedule : null
}

function sideBedtimeFromSchedule(schedule: FreeSleepSchedulesState | null, side: FreeSleepSide) {
  const sideSchedule = schedule?.[side]
  if (!sideSchedule) return null
  const values = FREE_SLEEP_ALARM_DAYS.map((day) => parsedInputTime(sideSchedule[day.key]?.power?.on, '')).filter(Boolean)
  const first = values[0]
  return first && values.length === FREE_SLEEP_ALARM_DAYS.length && values.every((value) => value === first) ? first : null
}

function freeSleepBedtimeSetTopic(side: FreeSleepSide) {
  return `${FREE_SLEEP_BEDTIME_SET_TOPIC_PREFIX}/${side}/schedule/bedtime/set`
}

function eightSleepLevelToFahrenheit(level: number) {
  return Math.round(EIGHT_SLEEP_LEVEL_ZERO_F + (level / FREE_SLEEP_TARGET_MAX) * EIGHT_SLEEP_LEVEL_RANGE_F)
}

function scheduleTemperatureEntries(daySchedule: FreeSleepDailySchedule | undefined, powerOn: string) {
  return Object.entries(daySchedule?.temperatures ?? {})
    .map(([time, value]) => {
      const parsedTime = parsedInputTime(time, '')
      const temperature = numberValue(isRecord(value) ? value.temperature ?? value.temperatureF ?? value.level ?? value.value : value)
      return parsedTime && temperature !== null ? { temperature, time: parsedTime } : null
    })
    .filter((entry): entry is { temperature: number; time: string } => Boolean(entry))
    .sort((a, b) => {
      const adjustedA = (timeStringToMinutes(a.time) - timeStringToMinutes(powerOn) + 1440) % 1440
      const adjustedB = (timeStringToMinutes(b.time) - timeStringToMinutes(powerOn) + 1440) % 1440
      return adjustedA - adjustedB
    })
}

function timeStringToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function isSleepypodPlaceholderPower(power: FreeSleepDailySchedule['power'] | undefined) {
  return parsedInputTime(power?.on, '') === '00:00' && parsedInputTime(power?.off, '') === '23:59'
}

function sleepypodPowerForPayload(daySchedule: FreeSleepDailySchedule | undefined, bedtimeLevel: number) {
  const power = daySchedule?.power
  const useExistingTimes = power && !isSleepypodPlaceholderPower(power)
  return {
    enabled: power?.enabled !== false,
    off: useExistingTimes ? parsedInputTime(power.off, SLEEPYPOD_DEFAULT_WAKE_TIME) : SLEEPYPOD_DEFAULT_WAKE_TIME,
    on: useExistingTimes ? parsedInputTime(power.on, SLEEPYPOD_DEFAULT_BEDTIME) : SLEEPYPOD_DEFAULT_BEDTIME,
    onTemperature: eightSleepLevelToFahrenheit(bedtimeLevel),
  }
}

function sleepypodTemperaturesForPayload(daySchedule: FreeSleepDailySchedule | undefined, powerOn: string, levels: Record<FreeSleepScheduleStage, number>) {
  const entries = scheduleTemperatureEntries(daySchedule, powerOn)
  const asleepTime = entries[0]?.time ?? SLEEPYPOD_DEFAULT_ASLEEP_TIME
  const dawnTime = entries.length > 1 ? entries.at(-1)?.time ?? SLEEPYPOD_DEFAULT_DAWN_TIME : SLEEPYPOD_DEFAULT_DAWN_TIME
  const temperatures = Object.fromEntries(entries.map(({ temperature, time }) => [time, temperature]))
  temperatures[asleepTime] = eightSleepLevelToFahrenheit(levels.asleep)
  temperatures[dawnTime] = eightSleepLevelToFahrenheit(levels.dawn)
  return temperatures
}

function sleepypodSchedulePayload(side: EightSleepSideConfig, schedule: FreeSleepSchedulesState | null, levels: Record<FreeSleepScheduleStage, number>) {
  const sideSchedule = schedule?.[side.scheduleSide]
  return {
    [side.scheduleSide]: Object.fromEntries(FREE_SLEEP_ALARM_DAYS.map((day) => {
      const daySchedule = sideSchedule?.[day.key]
      const power = sleepypodPowerForPayload(daySchedule, levels.bedtime)
      return [
        day.key,
        {
          alarms: alarmsFromDailySchedule(daySchedule),
          power,
          temperatures: sleepypodTemperaturesForPayload(daySchedule, power.on, levels),
        },
      ]
    })),
  }
}

function alarmsFromDailySchedule(daySchedule: FreeSleepDailySchedule | undefined): FreeSleepAlarmSchedule[] {
  const scheduledAlarms = Array.isArray(daySchedule?.alarms) ? daySchedule.alarms.map(normalizeFreeSleepAlarmSchedule).filter((alarm): alarm is FreeSleepAlarmSchedule => Boolean(alarm)) : []
  if (scheduledAlarms.length > 0) return scheduledAlarms
  const legacyAlarm = normalizeFreeSleepAlarmSchedule(daySchedule?.alarm)
  return legacyAlarm?.enabled ? [legacyAlarm] : []
}

function alarmDayOffset(day: FreeSleepAlarmDay, offset: number) {
  const index = FREE_SLEEP_ALARM_DAY_KEYS.indexOf(day)
  const nextIndex = (index + offset + FREE_SLEEP_ALARM_DAY_KEYS.length) % FREE_SLEEP_ALARM_DAY_KEYS.length
  return FREE_SLEEP_ALARM_DAY_KEYS[nextIndex]
}

function alarmExecutesNextMorning(daySchedule: FreeSleepDailySchedule | undefined) {
  const powerOff = parsedInputTime(daySchedule?.power?.off, '09:00')
  return Number(powerOff.split(':')[0]) <= 12
}

function wakeDayFromFreeSleepScheduleDay(scheduleDay: FreeSleepAlarmDay, daySchedule: FreeSleepDailySchedule | undefined) {
  return alarmExecutesNextMorning(daySchedule) ? alarmDayOffset(scheduleDay, 1) : scheduleDay
}

function freeSleepScheduleDayFromWakeDay(wakeDay: FreeSleepAlarmDay, sideSchedule: FreeSleepSideSchedule | undefined) {
  return FREE_SLEEP_ALARM_DAY_KEYS.find((scheduleDay) => wakeDayFromFreeSleepScheduleDay(scheduleDay, sideSchedule?.[scheduleDay]) === wakeDay) ?? alarmDayOffset(wakeDay, -1)
}

function alarmRecordsFromSchedule(schedule: FreeSleepSchedulesState, side: EightSleepSideConfig): FreeSleepAlarmRecord[] {
  const sideSchedule = schedule[side.scheduleSide]
  return FREE_SLEEP_ALARM_DAYS.flatMap((scheduleDay) =>
    alarmsFromDailySchedule(sideSchedule?.[scheduleDay.key]).map((alarm, index) => {
      const wakeDay = wakeDayFromFreeSleepScheduleDay(scheduleDay.key, sideSchedule?.[scheduleDay.key])
      return {
        ...alarm,
        day: wakeDay,
        id: `${wakeDay}-${index}-${alarm.time}-${alarm.enabled ? 'on' : 'off'}`,
        index,
      }
    }),
  ).sort(compareAlarmRecords)
}

function compareAlarmRecords(a: FreeSleepAlarmRecord, b: FreeSleepAlarmRecord) {
  const dayDelta = FREE_SLEEP_ALARM_DAYS.findIndex((day) => day.key === a.day) - FREE_SLEEP_ALARM_DAYS.findIndex((day) => day.key === b.day)
  if (dayDelta !== 0) return dayDelta
  if (a.time !== b.time) return a.time.localeCompare(b.time)
  return a.index - b.index
}

function compareAlarmRecordSourceOrder(a: FreeSleepAlarmRecord, b: FreeSleepAlarmRecord) {
  const dayDelta = FREE_SLEEP_ALARM_DAYS.findIndex((day) => day.key === a.day) - FREE_SLEEP_ALARM_DAYS.findIndex((day) => day.key === b.day)
  return dayDelta !== 0 ? dayDelta : a.index - b.index
}

function normalizeAlarmRecordIndexes(records: FreeSleepAlarmRecord[]) {
  const dayCounts = new Map<FreeSleepAlarmDay, number>()
  return [...records].sort(compareAlarmRecords).map((alarm) => {
    const index = dayCounts.get(alarm.day) ?? 0
    dayCounts.set(alarm.day, index + 1)
    return { ...alarm, index }
  })
}

function alarmRecordsStateKey(records: FreeSleepAlarmRecord[]) {
  return JSON.stringify([...records].sort(compareAlarmRecordSourceOrder).map(({ alarmTemperature, day, duration, enabled, time, vibrationIntensity, vibrationPattern }) => ({
    alarmTemperature,
    day,
    duration,
    enabled,
    time,
    vibrationIntensity,
    vibrationPattern,
  })))
}

function sameAlarmRecord(a: FreeSleepAlarmRecord, b: FreeSleepAlarmRecord) {
  return a.alarmTemperature === b.alarmTemperature
    && a.day === b.day
    && a.duration === b.duration
    && a.enabled === b.enabled
    && a.id === b.id
    && a.index === b.index
    && a.time === b.time
    && a.vibrationIntensity === b.vibrationIntensity
    && a.vibrationPattern === b.vibrationPattern
}

function alarmSchedulePayload(records: FreeSleepAlarmRecord[], side: EightSleepSideConfig, schedule: FreeSleepSchedulesState | null) {
  const sideSchedule = schedule?.[side.scheduleSide]
  const sidePayload = Object.fromEntries(FREE_SLEEP_ALARM_DAYS.map((day) => [
    day.key,
    {
      alarms: records
        .filter((alarm) => freeSleepScheduleDayFromWakeDay(alarm.day, sideSchedule) === day.key)
        .sort(compareAlarmRecordSourceOrder)
        .map(({ alarmTemperature, duration, enabled, time, vibrationIntensity, vibrationPattern }) => ({
          alarmTemperature,
          duration,
          enabled,
          time,
          vibrationIntensity,
          vibrationPattern,
        })),
    },
  ]))
  return { [side.scheduleSide]: sidePayload }
}

function compactAlarmRecordForDebug({ day, enabled, id, index, time }: FreeSleepAlarmRecord) {
  return { day, enabled, id, index, time }
}

function compactAlarmRecordsForDebug(records: FreeSleepAlarmRecord[]) {
  return records.map(compactAlarmRecordForDebug)
}

function debugFreeSleepAlarm(callService: DashboardCallService, event: string, details: Record<string, unknown>) {
  if (typeof window === 'undefined' || window.localStorage.getItem(FREE_SLEEP_ALARM_DIAGNOSTICS_STORAGE_KEY) !== 'true') return
  const payload = {
    at: new Date().toISOString(),
    event,
    sequence: freeSleepAlarmDebugSequence += 1,
    source: 'react-dash',
    ...details,
  }
  const message = `FS_ALARM_DBG ${JSON.stringify(payload)}`
  console.info(message)
  callService({
    domain: 'system_log',
    service: 'write',
    serviceData: {
      level: 'warning',
      logger: 'react_dash.free_sleep_alarm',
      message,
    },
  })
  callService({
    domain: 'mqtt',
    service: 'publish',
    serviceData: {
      payload: JSON.stringify(payload),
      topic: FREE_SLEEP_ALARM_DEBUG_TOPIC,
    },
  })
}

function legacyAlarmRecords(owner: FreeSleepAlarmOwner, entities: EntityActionStateMap): FreeSleepAlarmRecord[] {
  return FREE_SLEEP_ALARM_DAYS.flatMap((day) => {
    const configured = entities[eightSleepAlarmConfiguredEntityId(owner, day.key)]?.state === 'on'
    if (!configured) return []
    const enabled = entities[eightSleepAlarmEnabledEntityId(owner, day.key)]?.state === 'on'
    const time = parsedInputTime(entities[eightSleepAlarmTimeEntityId(owner, day.key)]?.state, FREE_SLEEP_DEFAULT_ALARM.time)
    return [{
      ...FREE_SLEEP_DEFAULT_ALARM,
      day: day.key,
      enabled,
      id: `${day.key}-legacy-${time}-${enabled ? 'on' : 'off'}`,
      index: 0,
      time,
    }]
  })
}

function alarmDayLabel(day: FreeSleepAlarmDay) {
  return FREE_SLEEP_ALARM_DAYS.find((alarmDay) => alarmDay.key === day)?.label ?? titleCaseState(day)
}

function formatTemperatureCompact(value: unknown, unit = '°F') {
  const parsed = numberValue(value)
  if (parsed === null) return `--${unit}`
  const displayValue = Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(1)
  return `${displayValue}${unit}`
}

function formatEightSleepTargetLevel(value: unknown) {
  const parsed = numberValue(value)
  if (parsed === null) return '--'
  const displayValue = Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(1)
  return parsed > 0 ? `+${displayValue}` : displayValue
}

function formatBedTargetValue(value: unknown, modalState: EightSleepBedModalState) {
  if (modalState.targetScale === 'temperature') return formatTemperatureCompact(value)
  return formatEightSleepTargetLevel(value)
}

function formatSecondsRemaining(value: unknown) {
  const parsed = numberValue(value)
  if (parsed === null) return 'Unknown'
  const totalSeconds = Math.max(0, Math.round(parsed))
  if (totalSeconds === 0) return 'Complete'
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return `${totalSeconds}s`
}

function formatEightSleepCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function eightSleepTimerCountdown(timerEntity: ReturnType<typeof useEntity>, now: number) {
  if (timerEntity?.state !== 'active') return null
  const finishesAt = typeof timerEntity.attributes.finishes_at === 'string' ? Date.parse(timerEntity.attributes.finishes_at) : NaN
  if (Number.isFinite(finishesAt)) return formatEightSleepCountdown(finishesAt - now)
  if (typeof timerEntity.attributes.remaining === 'string') {
    const parts = timerEntity.attributes.remaining.split(':').map((part: string) => Number(part))
    if (parts.length >= 2 && parts.every(Number.isFinite)) return `${parts.at(-2)}:${String(parts.at(-1)).padStart(2, '0')}`
  }
  return null
}

function eightSleepRestoreAtCountdown(restoreAtEntity: ReturnType<typeof useEntity>, now: number) {
  if (!restoreAtEntity || isUnavailable(restoreAtEntity)) return null
  const timestamp = numberValue(restoreAtEntity.attributes.timestamp)
  if (timestamp !== null) return formatEightSleepCountdown((timestamp * 1000) - now)
  if (restoreAtEntity.state) {
    const parsed = Date.parse(restoreAtEntity.state.replace(' ', 'T'))
    if (Number.isFinite(parsed)) return formatEightSleepCountdown(parsed - now)
  }
  return null
}

function eightSleepHotFlashCountdown(timerEntity: ReturnType<typeof useEntity>, restoreAtEntity: ReturnType<typeof useEntity>, now: number) {
  return eightSleepTimerCountdown(timerEntity, now) ?? eightSleepRestoreAtCountdown(restoreAtEntity, now)
}

function snapNumberToStep(value: number, min: number, max: number, step: number) {
  const safeStep = step > 0 ? step : 1
  const snapped = Math.round((value - min) / safeStep) * safeStep + min
  const decimalPlaces = Math.max(0, (safeStep.toString().split('.')[1] ?? '').length)
  return Number(Math.max(min, Math.min(max, snapped)).toFixed(decimalPlaces))
}

function eightSleepTemperatureAction(targetLevel: number | null, sideOn: boolean) {
  if (!sideOn) return 'off'
  if (targetLevel === null) return 'idle'
  if (targetLevel > 0.5) return 'heating'
  if (targetLevel < -0.5) return 'cooling'
  return 'idle'
}

function sleepypodTemperatureAction(targetTemperature: number | null, currentTemperature: number | null, sideOn: boolean) {
  if (!sideOn) return 'off'
  if (targetTemperature === null || currentTemperature === null) return 'idle'
  if (targetTemperature > currentTemperature + 0.5) return 'heating'
  if (targetTemperature < currentTemperature - 0.5) return 'cooling'
  return 'idle'
}

function eightSleepCardBackgroundColor(modalState: EightSleepBedModalState) {
  if (!modalState.controlsSideOn) return undefined
  if (modalState.heroAction === 'heating') return 'rgba(136, 64, 26, 0.6)'
  if (modalState.heroAction === 'cooling') return 'rgba(25, 84, 130, 0.6)'
  return 'rgba(67, 160, 71, 0.6)'
}

function useEightSleepBedModalStates() {
  const stephenState = useEightSleepBedModalState(EIGHT_SLEEP_SIDE_CONFIGS[0])
  const stephState = useEightSleepBedModalState(EIGHT_SLEEP_SIDE_CONFIGS[1])

  return {
    [EIGHT_SLEEP_SIDE_CONFIGS[0].hash]: stephenState,
    [EIGHT_SLEEP_SIDE_CONFIGS[1].hash]: stephState,
  }
}

function useEightSleepBedModalState(side: EightSleepSideConfig | undefined): EightSleepBedModalState {
  const climateEntity = useEntity(asEntityName(side?.climateEntityId ?? 'climate.sleepypod_unselected_side'), { returnNullIfNotFound: true })
  const hotFlashActiveEntity = useEntity(asEntityName(side?.hotFlashActiveEntityId ?? 'input_boolean.free_sleep_unselected_hot_flash_active'), { returnNullIfNotFound: true })
  const schedulePhaseEntity = useEntity(asEntityName(side ? SLEEPYPOD_SCHEDULE_PHASE_ENTITY_IDS[side.scheduleSide] : 'sensor.sleepypod_unselected_schedule_phase'), { returnNullIfNotFound: true })
  const targetLevelEntity = useEntity(asEntityName(side?.targetLevelEntityId ?? 'number.sleepypod_unselected_target_level'), { returnNullIfNotFound: true })
  const targetEntity = useEntity(asEntityName(side?.targetTemperatureEntityId ?? 'number.free_sleep_unselected_target_temperature'), { returnNullIfNotFound: true })
  const currentEntity = useEntity(asEntityName(side?.currentTemperatureEntityId ?? 'sensor.free_sleep_unselected_current_temperature'), { returnNullIfNotFound: true })
  const powerEntity = useEntity(asEntityName(side?.powerSwitchEntityId ?? 'switch.free_sleep_unselected_power'), { returnNullIfNotFound: true })
  const stableClimateEntity = useRecentAvailableEntity(climateEntity, EIGHT_SLEEP_UNAVAILABLE_HOLD_MS)
  const stableTargetLevelEntity = useRecentAvailableEntity(targetLevelEntity, EIGHT_SLEEP_UNAVAILABLE_HOLD_MS)
  const stablePowerEntity = useRecentAvailableEntity(powerEntity, EIGHT_SLEEP_UNAVAILABLE_HOLD_MS)
  const stableTargetEntity = useRecentAvailableEntity(targetEntity, EIGHT_SLEEP_UNAVAILABLE_HOLD_MS)
  const stableCurrentEntity = useRecentAvailableEntity(currentEntity, EIGHT_SLEEP_UNAVAILABLE_HOLD_MS)
  const useClimateEntity = Boolean(side?.climateEntityId && stableClimateEntity && !isUnavailable(stableClimateEntity))
  const useTargetLevelEntity = Boolean(side?.targetLevelEntityId && stableTargetLevelEntity && !isUnavailable(stableTargetLevelEntity))
  const sleepypodAdapterConfigured = Boolean(side?.climateEntityId && side?.targetLevelEntityId)
  const useSleepypodAdapter = Boolean(sleepypodAdapterConfigured && useClimateEntity && useTargetLevelEntity)
  const sleepypodAdapterPartiallyAvailable = Boolean(sleepypodAdapterConfigured && useClimateEntity !== useTargetLevelEntity)
  const targetScale: EightSleepBedModalState['targetScale'] = 'level'
  const sideAvailable = sleepypodAdapterPartiallyAvailable
    ? false
    : useSleepypodAdapter
    ? Boolean(side && stableClimateEntity && !isUnavailable(stableClimateEntity))
    : Boolean(side && stableTargetEntity && stablePowerEntity && !isUnavailable(stableTargetEntity) && !isUnavailable(stablePowerEntity))
  const liveSideOn = useSleepypodAdapter
    ? Boolean(stableClimateEntity && !isUnavailable(stableClimateEntity) && stableClimateEntity.state !== 'off')
    : Boolean(side && stablePowerEntity && !isUnavailable(stablePowerEntity) && stablePowerEntity.state === 'on')
  const climateCurrentTemperature = stableClimateEntity && !isUnavailable(stableClimateEntity) ? numberValue(stableClimateEntity.attributes.current_temperature) : null
  const liveTargetTemperature = useSleepypodAdapter
    ? numberValue(stableTargetLevelEntity?.state)
    : stableTargetEntity && !isUnavailable(stableTargetEntity) ? numberValue(stableTargetEntity.state) : null
  const currentTemperature = useSleepypodAdapter
    ? climateCurrentTemperature
    : stableCurrentEntity && !isUnavailable(stableCurrentEntity) ? numberValue(stableCurrentEntity.state) : null
  const targetMin = useSleepypodAdapter
    ? numberValue(stableTargetLevelEntity?.attributes.min) ?? FREE_SLEEP_TARGET_MIN
    : numberValue(stableTargetEntity?.attributes.min) ?? FREE_SLEEP_TARGET_MIN
  const targetMax = useSleepypodAdapter
    ? numberValue(stableTargetLevelEntity?.attributes.max) ?? FREE_SLEEP_TARGET_MAX
    : numberValue(stableTargetEntity?.attributes.max) ?? FREE_SLEEP_TARGET_MAX
  const targetStep = useSleepypodAdapter
    ? numberValue(stableTargetLevelEntity?.attributes.step) ?? FREE_SLEEP_TARGET_STEP
    : numberValue(stableTargetEntity?.attributes.step) ?? FREE_SLEEP_TARGET_STEP
  const liveHotFlashActive = Boolean(side && hotFlashActiveEntity && !isUnavailable(hotFlashActiveEntity) && hotFlashActiveEntity.state === 'on')
  const hotFlashAvailable = Boolean(side && hotFlashActiveEntity && !isUnavailable(hotFlashActiveEntity))
  const schedulePhaseState = schedulePhaseEntity?.state
  const activeSchedulePhase = sleepypodSchedulePhase(schedulePhaseState)
  const schedulePhaseIsAvailable = Boolean(side && schedulePhaseEntity && sleepypodSchedulePhaseAvailable(schedulePhaseState))
  const [displayHotFlashActive, commitHotFlashActive] = useOptimisticState(liveHotFlashActive, { clearOn: 'confirmation', revertMs: EIGHT_SLEEP_POWER_REVERT_MS })
  const targetConfirmationHoldMs = useSleepypodAdapter ? SLEEPYPOD_TARGET_CONFIRMATION_HOLD_MS : 0
  const [displayedTargetValueRaw, commitTargetTemperature, cancelTargetTemperature] = useOptimisticState(liveTargetTemperature, { clearOn: 'confirmation', confirmationHoldMs: targetConfirmationHoldMs, revertMs: FREE_SLEEP_TARGET_REVERT_MS })
  const [displaySideOn, commitDisplaySideOn] = useOptimisticState(liveSideOn, { clearOn: 'confirmation', revertMs: EIGHT_SLEEP_POWER_REVERT_MS })
  const previousSchedulePhaseStateRef = useRef(schedulePhaseState)
  const displayedTargetValue = displayHotFlashActive ? targetMin : displayedTargetValueRaw
  const controlsSideOn = sideAvailable && displaySideOn
  const heroAction = eightSleepTemperatureAction(displayedTargetValue, controlsSideOn)
  const targetText = formatEightSleepTargetLevel(displayedTargetValue)
  const subtitle = displayHotFlashActive ? 'Hot Flash Mode' : controlsSideOn ? `${titleCaseState(heroAction)} • ${targetText}` : 'Off'

  useEffect(() => {
    if (previousSchedulePhaseStateRef.current === schedulePhaseState) return
    previousSchedulePhaseStateRef.current = schedulePhaseState
    cancelTargetTemperature()
  }, [cancelTargetTemperature, schedulePhaseState])

  return {
    activeSchedulePhase,
    cancelTargetTemperature,
    commitDisplaySideOn,
    commitHotFlashActive,
    commitTargetTemperature,
    controlMode: useSleepypodAdapter ? 'climate' : 'legacy',
    controlsSideOn,
    currentTemperature,
    displayedTargetValue,
    heroAction,
    hotFlashActive: displayHotFlashActive,
    hotFlashAvailable,
    schedulePhaseAvailable: schedulePhaseIsAvailable,
    sideAvailable,
    subtitle,
    targetMax,
    targetMin,
    targetScale,
    targetStep,
  }
}

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

function ThermostatDial({ actionOverride, entityId, inactiveOverride, interactive = true, primaryUnitOverride, primaryValueOverride, rangeTextOverride, size = 'page', title }: { actionOverride?: string; entityId: string; inactiveOverride?: boolean; interactive?: boolean; primaryUnitOverride?: string | null; primaryValueOverride?: string; rangeTextOverride?: string | null; size?: 'modal' | 'page'; title: string }) {
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true })
  const callService = useCallService()
  const dialRef = useRef<HTMLDivElement>(null)
  const activeHandle = useRef<{ pointerId: number; type: ThermostatSliderTarget } | null>(null)
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
  const lastTemperatureCommit = useRef<string | null>(null)
  const lastTemperatureCommitReset = useRef<number | null>(null)
  const displayTargets = pendingTargets?.sourceKey === sourceTargetKey ? pendingTargets : sourceTargets
  const displayLow = displayTargets.low
  const displayHigh = displayTargets.high
  const displayTarget = displayTargets.target
  const sourceRangeText = hasRange ? `${formatOneDecimal(displayLow ?? undefined)} · ${formatOneDecimal(displayHigh ?? undefined)}` : formatTemperatureValue(displayTarget ?? targetTemperature, unit)
  const displayRangeText = rangeTextOverride === null ? null : rangeTextOverride ?? sourceRangeText
  const primaryValueText = primaryValueOverride ?? formatOneDecimal(currentTemperature, '--').replace(/\.0$/, '')
  const primaryUnitText = primaryUnitOverride === undefined ? unit : primaryUnitOverride
  // HAKit 6.0.2 syncs the numeric high prop into localLow after mount; string coercion preserves the high handle and the key remounts on HA updates.
  const sliderHigh = displayHigh !== null ? (String(displayHigh) as unknown as number) : undefined
  const rawHvacAction = actionOverride ?? rawThermostatAction(entity)
  const actionColor = thermostatActionColor(rawHvacAction)
  const disabled = !entity || entity.state === 'unavailable' || entity.state === 'unknown'
  const inactive = inactiveOverride ?? (disabled || (!hasRange && !actionColor && entity?.state === 'off'))
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
    if (lastTemperatureCommit.current === commitKey) return
    lastTemperatureCommit.current = commitKey
    if (lastTemperatureCommitReset.current !== null) window.clearTimeout(lastTemperatureCommitReset.current)
    lastTemperatureCommitReset.current = window.setTimeout(() => {
      if (lastTemperatureCommit.current === commitKey) lastTemperatureCommit.current = null
      lastTemperatureCommitReset.current = null
    }, 400)
    const target = entityId === GLOBAL_THERMOSTAT_ENTITY_ID && 'target_temp_low' in serviceData && 'target_temp_high' in serviceData ? THERMOSTAT_ROOM_CLIMATE_ENTITY_IDS : entityId
    callService({ domain: 'climate', service: 'set_temperature', target, serviceData })
  }

  useEffect(() => () => {
    if (lastTemperatureCommitReset.current !== null) window.clearTimeout(lastTemperatureCommitReset.current)
  }, [])

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

  const nextValueFromHandleEvent = (event: PointerEvent<HTMLElement>, type: ThermostatSliderTarget) => {
    const rect = dialRef.current?.getBoundingClientRect()
    if (!rect) return null
    const rawValue = thermostatValueFromPoint(rect, event.clientX, event.clientY, minTemperature, maxTemperature, targetStep)
    if (hasRange && type === 'low' && displayHigh !== null) return Math.min(rawValue, displayHigh)
    if (hasRange && type === 'high' && displayLow !== null) return Math.max(rawValue, displayLow)
    return rawValue
  }

  const startHandleDrag = (type: ThermostatSliderTarget) => (event: PointerEvent<HTMLElement>) => {
    const nextValue = nextValueFromHandleEvent(event, type)
    if (nextValue === null) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    activeHandle.current = { pointerId: event.pointerId, type }
    updateDisplayedTarget(nextValue, type)
  }

  const moveHandleDrag = (event: PointerEvent<HTMLElement>) => {
    const active = activeHandle.current
    if (!active || active.pointerId !== event.pointerId) return
    const nextValue = nextValueFromHandleEvent(event, active.type)
    if (nextValue === null) return
    event.preventDefault()
    updateDisplayedTarget(nextValue, active.type)
  }

  const endHandleDrag = (event: PointerEvent<HTMLElement>) => {
    const active = activeHandle.current
    if (!active || active.pointerId !== event.pointerId) return
    const nextValue = nextValueFromHandleEvent(event, active.type)
    activeHandle.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (nextValue === null) return
    event.preventDefault()
    event.stopPropagation()
    applySliderChange(nextValue, active.type)
  }

  const handleTargets = hasRange
    ? ([
        displayLow !== null ? { type: 'low' as const, value: displayLow } : null,
        displayHigh !== null ? { type: 'high' as const, value: displayHigh } : null,
      ].filter(Boolean) as Array<{ type: ThermostatSliderTarget; value: number }>)
    : displayTarget !== null
      ? [{ type: 'value' as const, value: displayTarget }]
      : []

  return (
    <CircularControlDial
      actionText={hvacAction}
      ariaLabel={`${title} thermostat ${hvacAction} ${[primaryValueOverride ?? formatTemperatureValue(currentTemperature, unit), displayRangeText].filter(Boolean).join(' ')}`}
      colors={thermostatSliderColors(rawHvacAction)}
      current={current}
      disabled={disabled}
      dual={hasRange}
      handles={!disabled && interactive ? handleTargets.map((handle) => ({
        accessible: false,
        ariaLabel: `${title} ${handle.type} target`,
        ariaValueText: formatTemperatureValue(handle.value, unit),
        color: handle.type === 'low' ? THERMOSTAT_HEAT_COLOR : handle.type === 'high' ? THERMOSTAT_COOL_COLOR : actionColor ?? THERMOSTAT_NEUTRAL_COLOR,
        dataTarget: handle.type,
        dragging: activeHandle.current?.type === handle.type,
        id: handle.type,
        onPointerCancel: endHandleDrag,
        onPointerDown: startHandleDrag(handle.type),
        onPointerMove: moveHandleDrag,
        onPointerUp: endHandleDrag,
        value: handle.value,
      })) : []}
      high={sliderHigh}
      inactive={inactive}
      label={`${title} target temperature`}
      low={displayLow ?? undefined}
      max={maxTemperature}
      min={minTemperature}
      onChange={updateDisplayedTarget}
      onChangeApplied={applySliderChange}
      onPointerUpCapture={commitDisplayedTargets}
      primaryText={primaryValueText}
      primaryUnit={primaryUnitText}
      readonly={!interactive}
      ref={dialRef}
      secondaryText={displayRangeText !== null ? (
        <>
          <MaterialIcon name="mdi:thermostat" size={17} />
          {displayRangeText}
        </>
      ) : undefined}
      size={size}
      sliderAriaHidden={false}
      step={targetStep}
      trails={hasRange && displayLow !== null && displayHigh !== null ? [
        { color: THERMOSTAT_HEAT_COLOR, from: minTemperature, id: 'low-range', to: displayLow },
        { color: THERMOSTAT_COOL_COLOR, from: displayHigh, id: 'high-range', to: maxTemperature },
      ] : []}
      value={displayTarget ?? current}
    />
  )
}

function EightSleepThermostatHero({
  modalState,
  onRequestTemperatureScope,
  side,
}: {
  modalState: EightSleepBedModalState
  onRequestTemperatureScope?: (value: number, phase: SleepypodSchedulePhase, returnFocus: HTMLElement | null) => void
  side: EightSleepSideConfig
}) {
  const callService = useCallService()
  const dialRef = useRef<HTMLDivElement>(null)
  const dialTapCandidateRef = useRef<{ moved: boolean; pointerId: number; startX: number; startY: number } | null>(null)
  const activeHandle = useRef<number | null>(null)
  const previousActiveSchedulePhaseRef = useRef<SleepypodSchedulePhase | null>(modalState.activeSchedulePhase)
  const targetSyncTimerRef = useRef<number | null>(null)
  const pendingTargetValueRef = useRef<number | null>(null)
  const controlsSideOnRef = useRef(false)
  const targetSliderRef = useRef<HTMLSpanElement>(null)
  const [dragValue, setDragValue] = useState<number | null>(null)
  const [targetDragging, setTargetDragging] = useState(false)
  const { activeSchedulePhase, cancelTargetTemperature, commitDisplaySideOn, commitTargetTemperature, controlMode, controlsSideOn, currentTemperature, displayedTargetValue: sourceTargetValue, schedulePhaseAvailable, sideAvailable, targetMax, targetMin, targetScale, targetStep } = modalState
  const targetConfirmationHoldMs = controlMode === 'climate' && targetScale === 'level' ? SLEEPYPOD_TARGET_CONFIRMATION_HOLD_MS : 0
  const [optimisticTargetValue, commitHeroTargetValue, cancelHeroTargetValue] = useOptimisticState(sourceTargetValue, { clearOn: 'confirmation', confirmationHoldMs: targetConfirmationHoldMs, revertMs: FREE_SLEEP_TARGET_REVERT_MS })
  const displayedTargetValue = modalState.hotFlashActive ? sourceTargetValue : dragValue ?? optimisticTargetValue
  const scopedSleepypodTarget = controlMode === 'climate' && targetScale === 'level'
  const canSetTarget = sideAvailable && controlsSideOn && !modalState.hotFlashActive && displayedTargetValue !== null && (!scopedSleepypodTarget || schedulePhaseAvailable)
  const [previousCanSetTarget, setPreviousCanSetTarget] = useState(canSetTarget)
  if (previousCanSetTarget !== canSetTarget) {
    setPreviousCanSetTarget(canSetTarget)
    if (!canSetTarget) {
      setDragValue(null)
      setTargetDragging(false)
    }
  }
  const heroAction = targetScale === 'temperature' ? sleepypodTemperatureAction(displayedTargetValue, currentTemperature, controlsSideOn) : eightSleepTemperatureAction(displayedTargetValue, controlsSideOn)
  const heroTargetText = displayedTargetValue === null ? '--' : formatBedTargetValue(displayedTargetValue, modalState)
  const heroReadoutAction = controlsSideOn ? titleCaseState(heroAction) : null
  const heroReadoutText = controlsSideOn ? heroTargetText : 'OFF'
  const heroLabel = !sideAvailable
    ? `${side.title} thermostat unavailable`
    : controlsSideOn ? `${side.title} thermostat ${heroReadoutAction} ${heroTargetText}` : `${side.title} thermostat Off`
  const heroHintText = !sideAvailable
    ? 'Bed controls are unavailable.'
    : !controlsSideOn
      ? 'Use the power control to turn on the Pod.'
      : scopedSleepypodTarget && !schedulePhaseAvailable
        ? 'Schedule phase is unavailable.'
        : modalState.hotFlashActive ? 'Hot Flash Mode controls the target.' : 'Tap or drag the dial to set the target.'
  const powerButtonLabel = sideAvailable ? `${controlsSideOn ? 'Turn off' : 'Turn on'} ${side.title}` : `${side.title} unavailable`
  const powerButtonText = sideAvailable ? (controlsSideOn ? 'Turn Off' : 'Turn On') : 'Unavailable'
  const targetSliderLabel = `${side.title} target ${targetScale === 'temperature' ? 'temperature' : 'level'}`
  const sliderValue = displayedTargetValue ?? (targetScale === 'temperature' ? targetMin : 0)

  useEffect(() => {
    controlsSideOnRef.current = controlsSideOn
  }, [controlsSideOn])

  const sendTargetTemperatureToHass = useCallback((pendingValue: number) => {
    if (controlMode === 'climate' && targetScale === 'level') {
      callService({ domain: 'script', service: sleepypodOutsideScheduleTemperatureService(side.scheduleSide), serviceData: { level: pendingValue } })
      return
    }
    if (controlMode === 'climate' && targetScale === 'temperature' && side.climateEntityId) {
      callService({ domain: 'climate', service: 'set_temperature', target: side.climateEntityId, serviceData: { temperature: pendingValue } })
      return
    }
    callService({ domain: 'number', service: 'set_value', target: controlMode === 'climate' && side.targetLevelEntityId ? side.targetLevelEntityId : side.targetTemperatureEntityId, serviceData: { value: pendingValue } })
  }, [callService, controlMode, side.climateEntityId, side.scheduleSide, side.targetLevelEntityId, side.targetTemperatureEntityId, targetScale])

  const flushTargetTemperatureSync = useCallback(() => {
    if (targetSyncTimerRef.current !== null) window.clearTimeout(targetSyncTimerRef.current)
    targetSyncTimerRef.current = null
    const pendingValue = pendingTargetValueRef.current
    pendingTargetValueRef.current = null
    if (pendingValue !== null) sendTargetTemperatureToHass(pendingValue)
  }, [sendTargetTemperatureToHass])

  useEffect(() => () => flushTargetTemperatureSync(), [flushTargetTemperatureSync])

  useEffect(() => {
    if (canSetTarget) return
    if (targetSyncTimerRef.current !== null) window.clearTimeout(targetSyncTimerRef.current)
    targetSyncTimerRef.current = null
    pendingTargetValueRef.current = null
    activeHandle.current = null
    dialTapCandidateRef.current = null
    cancelHeroTargetValue()
    cancelTargetTemperature()
  }, [canSetTarget, cancelHeroTargetValue, cancelTargetTemperature])

  useEffect(() => {
    if (previousActiveSchedulePhaseRef.current === activeSchedulePhase) return
    previousActiveSchedulePhaseRef.current = activeSchedulePhase
    if (!scopedSleepypodTarget) return
    if (targetSyncTimerRef.current !== null) window.clearTimeout(targetSyncTimerRef.current)
    targetSyncTimerRef.current = null
    pendingTargetValueRef.current = null
    cancelHeroTargetValue()
    cancelTargetTemperature()
  }, [activeSchedulePhase, cancelHeroTargetValue, cancelTargetTemperature, scopedSleepypodTarget])

  const queueTargetTemperatureSync = (clampedValue: number) => {
    pendingTargetValueRef.current = clampedValue
    if (targetSyncTimerRef.current !== null) window.clearTimeout(targetSyncTimerRef.current)
    targetSyncTimerRef.current = window.setTimeout(flushTargetTemperatureSync, FREE_SLEEP_NUMBER_SYNC_DEBOUNCE_MS)
  }

  const setTargetTemperature = (nextValue: number) => {
    if (!canSetTarget) return
    const clampedValue = snapNumberToStep(nextValue, targetMin, targetMax, targetStep)
    setDragValue(null)
    if (scopedSleepypodTarget && activeSchedulePhase) {
      if (targetSyncTimerRef.current !== null) window.clearTimeout(targetSyncTimerRef.current)
      targetSyncTimerRef.current = null
      pendingTargetValueRef.current = null
      onRequestTemperatureScope?.(clampedValue, activeSchedulePhase, targetSliderRef.current)
      return
    }
    commitHeroTargetValue(clampedValue)
    commitTargetTemperature(clampedValue)
    queueTargetTemperatureSync(clampedValue)
  }

  const updateDragValue = (nextValue: number) => {
    const clampedValue = snapNumberToStep(nextValue, targetMin, targetMax, targetStep)
    setDragValue(clampedValue)
  }

  const targetValueFromPointer = (event: PointerEvent<HTMLElement>) => {
    const rect = dialRef.current?.getBoundingClientRect()
    if (!rect) return null
    return thermostatRawValueFromPoint(rect, event.clientX, event.clientY, targetMin, targetMax)
  }

  const startTargetDrag = (event: PointerEvent<HTMLElement>) => {
    if (!canSetTarget) return
    const nextValue = targetValueFromPointer(event)
    if (nextValue === null) return
    event.preventDefault()
    event.stopPropagation()
    activeHandle.current = event.pointerId
    setTargetDragging(true)
    updateDragValue(nextValue)
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Some synthetic/browser-assisted drags do not expose an active pointer capture target.
    }
  }

  const moveTargetDrag = (event: PointerEvent<HTMLElement>) => {
    if (activeHandle.current !== event.pointerId) return
    const nextValue = targetValueFromPointer(event)
    if (nextValue === null) return
    event.preventDefault()
    updateDragValue(nextValue)
  }

  const endTargetDrag = (event: PointerEvent<HTMLElement>) => {
    if (activeHandle.current !== event.pointerId) return
    const nextValue = targetValueFromPointer(event)
    activeHandle.current = null
    setTargetDragging(false)
    if (typeof event.currentTarget.hasPointerCapture === 'function' && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (nextValue === null) return
    event.preventDefault()
    event.stopPropagation()
    const clampedValue = snapNumberToStep(nextValue, targetMin, targetMax, targetStep)
    setTargetTemperature(clampedValue)
  }

  const cancelTargetDrag = (event: PointerEvent<HTMLElement>) => {
    if (activeHandle.current !== event.pointerId) return
    activeHandle.current = null
    setTargetDragging(false)
    setDragValue(null)
    if (typeof event.currentTarget.hasPointerCapture === 'function' && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    event.preventDefault()
    event.stopPropagation()
  }

  const startDialTap = (event: PointerEvent<HTMLDivElement>) => {
    if (!canSetTarget || (event.pointerType === 'mouse' && event.button !== 0)) return
    dialTapCandidateRef.current = {
      moved: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    }
  }

  const moveDialTap = (event: PointerEvent<HTMLDivElement>) => {
    const candidate = dialTapCandidateRef.current
    if (!candidate || candidate.pointerId !== event.pointerId || candidate.moved) return
    if (Math.hypot(event.clientX - candidate.startX, event.clientY - candidate.startY) > THERMOSTAT_DIAL_TAP_TOLERANCE_PX) {
      candidate.moved = true
    }
  }

  const cancelDialTap = (event: PointerEvent<HTMLDivElement>) => {
    if (dialTapCandidateRef.current?.pointerId === event.pointerId) dialTapCandidateRef.current = null
  }

  const endDialTap = (event: PointerEvent<HTMLDivElement>) => {
    const candidate = dialTapCandidateRef.current
    if (!candidate || candidate.pointerId !== event.pointerId) return
    dialTapCandidateRef.current = null
    if (candidate.moved) return
    const rect = dialRef.current?.getBoundingClientRect()
    if (!rect || !thermostatPointIsOnRing(rect, event.clientX, event.clientY)) return
    const nextValue = targetValueFromPointer(event)
    if (nextValue === null) return
    event.preventDefault()
    event.stopPropagation()
    setTargetTemperature(nextValue)
  }

  const adjustTargetFromKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (!canSetTarget || displayedTargetValue === null) return
    let nextValue: number | null = null
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') nextValue = displayedTargetValue + targetStep
    if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') nextValue = displayedTargetValue - targetStep
    if (event.key === 'Home') nextValue = targetMin
    if (event.key === 'End') nextValue = targetMax
    if (event.key === 'PageUp') nextValue = displayedTargetValue + targetStep * 10
    if (event.key === 'PageDown') nextValue = displayedTargetValue - targetStep * 10
    if (nextValue === null) return
    event.preventDefault()
    event.stopPropagation()
    setTargetTemperature(nextValue)
  }

  const toggleSidePower = () => {
    if (!sideAvailable) return
    if (!controlsSideOnRef.current) {
      controlsSideOnRef.current = true
      commitDisplaySideOn(true)
      if (controlMode === 'climate' && side.climateEntityId) callService({ domain: 'climate', service: 'set_hvac_mode', target: side.climateEntityId, serviceData: { hvac_mode: 'heat' } })
      else callService({ domain: 'switch', service: 'turn_on', target: side.powerSwitchEntityId })
      return
    }

    if (!window.confirm(`Turn off ${side.title}?`)) return
    controlsSideOnRef.current = false
    setDragValue(null)
    commitDisplaySideOn(false)
    if (controlMode === 'climate' && side.climateEntityId) callService({ domain: 'climate', service: 'set_hvac_mode', target: side.climateEntityId, serviceData: { hvac_mode: 'off' } })
    else callService({ domain: 'switch', service: 'turn_off', target: side.powerSwitchEntityId })
  }

  return (
    <div className={styles.eightSleepThermostatHero}>
      <div className={styles.eightSleepThermostatControl}>
        <CircularControlDial
          actionText={heroReadoutAction}
          ariaLabel={heroLabel}
          colors={thermostatSliderColors(heroAction)}
          current={0}
          disabled={!canSetTarget}
          handles={canSetTarget ? [{
            ariaLabel: targetSliderLabel,
            ariaValueText: heroTargetText,
            color: thermostatActionColor(heroAction) ?? THERMOSTAT_NEUTRAL_COLOR,
            dataTarget: 'value',
            dragging: targetDragging,
            elementRef: targetSliderRef,
            id: 'value',
            onKeyDown: adjustTargetFromKeyboard,
            onPointerCancel: cancelTargetDrag,
            onPointerDown: startTargetDrag,
            onPointerMove: moveTargetDrag,
            onPointerUp: endTargetDrag,
            value: sliderValue,
          }] : []}
          inactive={!controlsSideOn}
          inert
          label={targetSliderLabel}
          max={targetMax}
          min={targetMin}
          mode="full"
          off={!heroReadoutAction}
          onChange={updateDragValue}
          onChangeApplied={setTargetTemperature}
          onPointerCancel={cancelDialTap}
          onPointerDown={startDialTap}
          onPointerMove={moveDialTap}
          onPointerUp={endDialTap}
          primaryText={heroReadoutText}
          readonly={!canSetTarget}
          ref={dialRef}
          size="modal"
          step={targetStep}
          value={sliderValue}
        />
      </div>
      <div className={styles.eightSleepThermostatActions}>
        <button aria-label={powerButtonLabel} className={styles.eightSleepPowerButton} data-active={controlsSideOn ? 'true' : 'false'} disabled={!sideAvailable} onClick={toggleSidePower} type="button">
          <MaterialIcon name="mdi:power" size={20} />
          <span>{powerButtonText}</span>
        </button>
        <Description className={styles.eightSleepThermostatHint}>{heroHintText}</Description>
      </div>
    </div>
  )
}

function EightSleepAwayModeCard({ side }: { side: EightSleepSideConfig }) {
  const awayEntity = useEntity(asEntityName(side.awayModeEntityId), { returnNullIfNotFound: true })
  const callService = useCallService()
  const [displayAwayMode, commitAwayMode] = useOptimisticState(awayEntity?.state === 'on', { clearOn: 'confirmation', revertMs: EIGHT_SLEEP_POWER_REVERT_MS })
  const active = displayAwayMode
  const activeRef = useRef(active)

  useEffect(() => {
    activeRef.current = active
  }, [active])

  const toggleAwayMode = () => {
    if (!awayEntity || isUnavailable(awayEntity)) return
    const nextActive = !activeRef.current
    activeRef.current = nextActive
    commitAwayMode(nextActive)
    callService({ domain: 'switch', service: nextActive ? 'turn_on' : 'turn_off', target: side.awayModeEntityId })
  }

  return (
    <ThermostatGlassCard active={active} icon="mdi:bed-empty" onMainClick={toggleAwayMode} stateText={active ? 'On' : 'Off'} title="Away Mode" />
  )
}

function EightSleepScheduleSection({ modalState, side }: { modalState: EightSleepBedModalState; side: EightSleepSideConfig }) {
  const scheduleEntityId = modalState.controlMode === 'climate' ? SLEEPYPOD_SCHEDULE_SENSOR_ENTITY_ID : FREE_SLEEP_SCHEDULE_SENSOR_ENTITY_ID
  const scheduleSetTopic = modalState.controlMode === 'climate' ? SLEEPYPOD_SCHEDULE_SET_TOPIC : undefined

  return (
    <section className={styles.section}>
      <SectionHeader title="Sleep Schedule" />
      <div className={styles.eightSleepStageGrid}>
        {FREE_SLEEP_SCHEDULE_STAGES.map((stage) => (
          <EightSleepScheduleTemperatureControl
            entityId={side.scheduleStageTemperatureEntityIds[stage.key]}
            fallbackTemperature={modalState.displayedTargetValue}
            icon={stage.icon}
            key={stage.key}
            label={stage.label}
            scheduleEntityId={scheduleEntityId}
            scheduleSetTopic={scheduleSetTopic}
            side={side}
            sideTitle={side.title}
            stageKey={stage.key}
          />
        ))}
      </div>
    </section>
  )
}

function EightSleepBedtimeSetting({ side }: { side: EightSleepSideConfig }) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const bedtimeEntity = useEntity(asEntityName(side.bedtimeEntityId), { returnNullIfNotFound: true })
  const schedulesEntity = useEntity(asEntityName(FREE_SLEEP_SCHEDULE_SENSOR_ENTITY_ID), { returnNullIfNotFound: true })
  const callService = useCallService()
  const fallbackTime = sideBedtimeFromSchedule(scheduleFromEntityAttributes(schedulesEntity?.attributes), side.scheduleSide)
  const entityTime = !isUnavailable(bedtimeEntity) ? parsedInputTime(bedtimeEntity?.state, '') : ''
  const liveTime = entityTime || fallbackTime || ''
  const [displayTime, commitDisplayTime] = useOptimisticState(liveTime, { clearOn: 'confirmation', revertMs: EIGHT_SLEEP_POWER_REVERT_MS })
  const pickerValue = displayTime || fallbackTime || '21:00'
  const stateText = displayTime ? formatClockTime(displayTime) : fallbackTime ? formatClockTime(fallbackTime) : schedulesEntity ? 'Mixed' : 'Set time'

  const openPicker = () => {
    openNativeTimePicker(inputRef.current)
  }

  const setBedtime = (nextTime: string) => {
    const normalizedTime = parsedInputTime(nextTime, '')
    if (!normalizedTime) return
    commitDisplayTime(normalizedTime)
    if (!isUnavailable(bedtimeEntity)) {
      callService({ domain: 'text', service: 'set_value', target: side.bedtimeEntityId, serviceData: { value: normalizedTime } })
      return
    }
    callService({ domain: 'mqtt', service: 'publish', serviceData: { payload: normalizedTime, topic: freeSleepBedtimeSetTopic(side.scheduleSide) } })
  }

  return (
    <div className={[styles.thermostatGlassCard, styles.eightSleepBedtimeCard].join(' ')} data-active="true" data-thermal-status="idle" onClick={openPicker}>
      <button aria-label={`${side.title} bedtime ${stateText}`} className={styles.thermostatGlassMain} type="button">
        <MaterialIcon name="mdi:bed" size={34} />
        <span>
          <strong>Bedtime</strong>
          <small>{stateText}</small>
        </span>
      </button>
      <input aria-label={`${side.title} bedtime`} className={styles.eightSleepBedtimeInput} onChange={(event) => setBedtime(event.currentTarget.value)} ref={inputRef} type="time" value={pickerValue} />
    </div>
  )
}

interface FreeSleepAlarmDayGroup {
  alarms: FreeSleepAlarmRecord[]
  day: FreeSleepAlarmDay
  disabledCount: number
  enabledCount: number
}

function alarmDayGroups(records: FreeSleepAlarmRecord[]): FreeSleepAlarmDayGroup[] {
  return FREE_SLEEP_ALARM_DAYS.flatMap(({ key }) => {
    const alarms = records.filter((alarm) => alarm.day === key)
    if (alarms.length === 0) return []
    const enabledCount = alarms.filter((alarm) => alarm.enabled).length
    return [{
      alarms,
      day: key,
      disabledCount: alarms.length - enabledCount,
      enabledCount,
    }]
  })
}

function alarmDayGroupLabel(day: FreeSleepAlarmDay, count: number) {
  return `${alarmDayLabel(day)} ${count === 1 ? 'Alarm' : 'Alarms'}`
}

function alarmEnabledSummary(enabledCount: number, disabledCount: number) {
  if (enabledCount + disabledCount === 1) return enabledCount === 1 ? 'Enabled' : 'Disabled'
  return [
    enabledCount > 0 ? String(enabledCount) + ' Enabled' : null,
    disabledCount > 0 ? String(disabledCount) + ' Disabled' : null,
  ].filter(Boolean).join(' • ')
}

interface EightSleepAlarmsController {
  alarmRecords: FreeSleepAlarmRecord[]
  available: boolean
  removeAlarm: (draft: EightSleepAlarmEditorDraft) => boolean
  saveAlarm: (draft: EightSleepAlarmEditorDraft) => boolean
  setAlarmEnabled: (alarm: FreeSleepAlarmRecord, enabled: boolean) => boolean
  supportsMultiplePerDay: boolean
}

function useEightSleepAlarmsController({
  scheduleEntityId = FREE_SLEEP_SCHEDULE_SENSOR_ENTITY_ID,
  scheduleSetTopic = FREE_SLEEP_SCHEDULE_SET_TOPIC,
  side,
}: {
  scheduleEntityId?: string
  scheduleSetTopic?: string
  side: EightSleepSideConfig
}) {
  const scheduleEntity = useEntity(asEntityName(scheduleEntityId), { returnNullIfNotFound: true })
  const entities = useHass((state) => state.entities) as unknown as EntityActionStateMap
  const callService = useCallService()
  const schedule = useMemo(
    () => scheduleEntity && !isUnavailable(scheduleEntity) ? scheduleFromEntityAttributes(scheduleEntity.attributes as Record<string, unknown> | undefined) : null,
    [scheduleEntity],
  )
  const scheduleSideAvailable = Boolean(schedule?.[side.scheduleSide])
  const legacyAlarmAvailable = scheduleEntityId === FREE_SLEEP_SCHEDULE_SENSOR_ENTITY_ID && FREE_SLEEP_ALARM_DAY_KEYS.every((day) => (
    [eightSleepAlarmConfiguredEntityId(side.alarmOwner, day), eightSleepAlarmEnabledEntityId(side.alarmOwner, day), eightSleepAlarmTimeEntityId(side.alarmOwner, day)]
      .every((entityId) => {
        const entity = entities[entityId]
        return Boolean(entity && !isUnavailable(entity))
      })
  ))
  const available = scheduleSideAvailable || legacyAlarmAvailable
  const supportsMultiplePerDay = scheduleSideAvailable
  const legacyAlarmSourceKey = legacyAlarmAvailable
    ? FREE_SLEEP_ALARM_DAY_KEYS.flatMap((day) => [
      entities[eightSleepAlarmConfiguredEntityId(side.alarmOwner, day)]?.state,
      entities[eightSleepAlarmEnabledEntityId(side.alarmOwner, day)]?.state,
      entities[eightSleepAlarmTimeEntityId(side.alarmOwner, day)]?.state,
    ]).join('|')
    : ''
  const sourceRecords = useMemo(() => {
    if (scheduleSideAvailable && schedule) return alarmRecordsFromSchedule(schedule, side)
    if (legacyAlarmAvailable && legacyAlarmSourceKey) return legacyAlarmRecords(side.alarmOwner, entities)
    return []
  }, [entities, legacyAlarmAvailable, legacyAlarmSourceKey, schedule, scheduleSideAvailable, side])
  const sourceRecordKey = alarmRecordsStateKey(sourceRecords)
  const alarmSyncSourceKey = [scheduleEntityId, scheduleSetTopic, side.scheduleSide, sourceRecordKey].join('|')
  const [optimisticRecords, setOptimisticRecords] = useState<FreeSleepAlarmRecord[] | null>(null)
  const alarmRecords = optimisticRecords ?? sourceRecords
  const alarmSyncTimerRef = useRef<number | null>(null)
  const localPublishedAlarmRecordKeysRef = useRef<string[]>([])
  const optimisticAlarmSourceKeyRef = useRef<string | null>(null)
  const pendingAlarmRecordsRef = useRef<FreeSleepAlarmRecord[] | null>(null)
  const pendingAlarmSourceKeyRef = useRef<string | null>(null)
  const syncAlarmRecordsRef = useRef<(records: FreeSleepAlarmRecord[]) => void>(() => undefined)
  const alarmRecordsRef = useRef(alarmRecords)
  const availableRef = useRef(available)
  const alarmSyncSourceKeyRef = useRef(alarmSyncSourceKey)
  const sourceRecordsRef = useRef(sourceRecords)
  const lastSourceRecordKeyRef = useRef(sourceRecordKey)

  const rebaseLocalAlarmAcknowledgement = useCallback((acknowledgedRecordKey: string, nextSourceKey: string) => {
    const publishedKeys = localPublishedAlarmRecordKeysRef.current
    const publishedIndex = publishedKeys.indexOf(acknowledgedRecordKey)
    if (publishedIndex < 0) return false
    localPublishedAlarmRecordKeysRef.current = publishedKeys.filter((_key, index) => index !== publishedIndex)
    optimisticAlarmSourceKeyRef.current = nextSourceKey
    if (pendingAlarmRecordsRef.current) pendingAlarmSourceKeyRef.current = nextSourceKey
    return true
  }, [])

  useLayoutEffect(() => {
    alarmRecordsRef.current = alarmRecords
    availableRef.current = available
    alarmSyncSourceKeyRef.current = alarmSyncSourceKey
    sourceRecordsRef.current = sourceRecords
  }, [alarmRecords, alarmSyncSourceKey, available, sourceRecords])

  useEffect(() => {
    if (lastSourceRecordKeyRef.current !== sourceRecordKey) {
      debugFreeSleepAlarm(callService, 'section-source-records-change', {
        side: side.scheduleSide,
        sourceRecordKey,
      })
      lastSourceRecordKeyRef.current = sourceRecordKey
    }
    // Reconcile the optimistic list only when Home Assistant confirms a serialized record state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOptimisticRecords((currentRecords) => {
      const sourceWasLocalAcknowledgement = rebaseLocalAlarmAcknowledgement(sourceRecordKey, alarmSyncSourceKey)
      if (!currentRecords) {
        optimisticAlarmSourceKeyRef.current = null
        return currentRecords
      }
      const currentKey = alarmRecordsStateKey(currentRecords)
      if (currentKey === sourceRecordKey) {
        debugFreeSleepAlarm(callService, 'section-optimistic-clear-confirmed', {
          records: compactAlarmRecordsForDebug(currentRecords),
          side: side.scheduleSide,
          sourceRecordKey,
        })
        optimisticAlarmSourceKeyRef.current = null
        return null
      }
      if (!sourceWasLocalAcknowledgement && optimisticAlarmSourceKeyRef.current !== alarmSyncSourceKey) {
        if (alarmSyncTimerRef.current !== null) window.clearTimeout(alarmSyncTimerRef.current)
        pendingAlarmRecordsRef.current = null
        pendingAlarmSourceKeyRef.current = null
        alarmSyncTimerRef.current = null
        alarmRecordsRef.current = sourceRecords
        optimisticAlarmSourceKeyRef.current = null
        return null
      }
      debugFreeSleepAlarm(callService, 'section-optimistic-retain-stale-source', {
        optimisticKey: currentKey,
        optimisticRecords: compactAlarmRecordsForDebug(currentRecords),
        side: side.scheduleSide,
        sourceRecordKey,
      })
      return currentRecords
    })
  }, [alarmSyncSourceKey, callService, rebaseLocalAlarmAcknowledgement, side.scheduleSide, sourceRecordKey, sourceRecords])

  const syncAlarmRecords = useCallback((sortedRecords: FreeSleepAlarmRecord[]) => {
    const publishedRecordKey = alarmRecordsStateKey(sortedRecords)
    const publishedKeys = localPublishedAlarmRecordKeysRef.current
    if (!publishedKeys.includes(publishedRecordKey)) {
      localPublishedAlarmRecordKeysRef.current = [...publishedKeys, publishedRecordKey].slice(-8)
    }
    if (!scheduleSideAvailable || !schedule) {
      if (!legacyAlarmAvailable) return
      debugFreeSleepAlarm(callService, 'section-sync-legacy-services', {
        records: compactAlarmRecordsForDebug(sortedRecords),
        side: side.scheduleSide,
      })
      for (const day of FREE_SLEEP_ALARM_DAY_KEYS) {
        const record = sortedRecords.find((alarm) => alarm.day === day)
        callService({ domain: 'input_boolean', service: record ? 'turn_on' : 'turn_off', target: eightSleepAlarmConfiguredEntityId(side.alarmOwner, day) })
        callService({ domain: 'input_boolean', service: record?.enabled ? 'turn_on' : 'turn_off', target: eightSleepAlarmEnabledEntityId(side.alarmOwner, day) })
        if (record) {
          callService({ domain: 'input_datetime', service: 'set_datetime', target: eightSleepAlarmTimeEntityId(side.alarmOwner, day), serviceData: { time: normalizedInputTime(record.time) } })
        }
      }
      return
    }

    const payload = alarmSchedulePayload(sortedRecords, side, schedule)
    debugFreeSleepAlarm(callService, 'section-sync-mqtt-publish', {
      payload,
      records: compactAlarmRecordsForDebug(sortedRecords),
      side: side.scheduleSide,
      topic: scheduleSetTopic,
    })
    callService({
      domain: 'mqtt',
      service: 'publish',
      serviceData: {
        payload: JSON.stringify(payload),
        topic: scheduleSetTopic,
      },
    })
  }, [callService, legacyAlarmAvailable, schedule, scheduleSetTopic, scheduleSideAvailable, side])

  useLayoutEffect(() => {
    syncAlarmRecordsRef.current = syncAlarmRecords
  }, [syncAlarmRecords])

  useEffect(() => () => {
    if (alarmSyncTimerRef.current !== null) window.clearTimeout(alarmSyncTimerRef.current)
    const pendingRecords = pendingAlarmRecordsRef.current
    const pendingSourceKey = pendingAlarmSourceKeyRef.current
    pendingAlarmRecordsRef.current = null
    pendingAlarmSourceKeyRef.current = null
    alarmSyncTimerRef.current = null
    if (pendingRecords && availableRef.current && pendingSourceKey === alarmSyncSourceKeyRef.current) {
      syncAlarmRecordsRef.current(pendingRecords)
    }
  }, [])

  const queueAlarmRecordsSync = (sortedRecords: FreeSleepAlarmRecord[]) => {
    pendingAlarmRecordsRef.current = sortedRecords
    pendingAlarmSourceKeyRef.current = alarmSyncSourceKeyRef.current
    if (alarmSyncTimerRef.current !== null) window.clearTimeout(alarmSyncTimerRef.current)
    debugFreeSleepAlarm(callService, 'section-queue-sync', {
      debounceMs: FREE_SLEEP_ALARM_SYNC_DEBOUNCE_MS,
      records: compactAlarmRecordsForDebug(sortedRecords),
      side: side.scheduleSide,
    })
    alarmSyncTimerRef.current = window.setTimeout(() => {
      const pendingRecords = pendingAlarmRecordsRef.current
      const pendingSourceKey = pendingAlarmSourceKeyRef.current
      pendingAlarmRecordsRef.current = null
      pendingAlarmSourceKeyRef.current = null
      alarmSyncTimerRef.current = null
      let sourceIsCurrent = pendingSourceKey === alarmSyncSourceKeyRef.current
      if (!sourceIsCurrent) {
        sourceIsCurrent = rebaseLocalAlarmAcknowledgement(
          alarmRecordsStateKey(sourceRecordsRef.current),
          alarmSyncSourceKeyRef.current,
        )
      }
      debugFreeSleepAlarm(callService, 'section-sync-timer-fire', {
        available: availableRef.current,
        hasPendingRecords: Boolean(pendingRecords),
        records: pendingRecords ? compactAlarmRecordsForDebug(pendingRecords) : [],
        side: side.scheduleSide,
        sourceIsCurrent,
      })
      if (!pendingRecords) return
      if (!availableRef.current || !sourceIsCurrent) {
        alarmRecordsRef.current = sourceRecordsRef.current
        optimisticAlarmSourceKeyRef.current = null
        setOptimisticRecords(null)
        return
      }
      syncAlarmRecordsRef.current(pendingRecords)
    }, FREE_SLEEP_ALARM_SYNC_DEBOUNCE_MS)
  }

  const setAlarmRecords = (nextRecords: FreeSleepAlarmRecord[]) => {
    const sortedRecords = normalizeAlarmRecordIndexes(nextRecords)
    debugFreeSleepAlarm(callService, 'section-set-alarm-records', {
      nextRecords: compactAlarmRecordsForDebug(sortedRecords),
      previousRecords: compactAlarmRecordsForDebug(alarmRecordsRef.current),
      side: side.scheduleSide,
    })
    alarmRecordsRef.current = sortedRecords
    optimisticAlarmSourceKeyRef.current ??= alarmSyncSourceKeyRef.current
    setOptimisticRecords(sortedRecords)
    queueAlarmRecordsSync(sortedRecords)
  }

  const saveAlarm = (draft: EightSleepAlarmEditorDraft) => {
    if (!available) return false
    const createdAt = Date.now()
    const currentRecords = alarmRecordsRef.current
    if (!supportsMultiplePerDay && !draft.editingId && draft.days.some((day) => currentRecords.some((alarm) => alarm.day === day))) return false
    const original = draft.editingId
      ? currentRecords.find((alarm) => alarm.id === draft.editingId)
      : undefined
    if (draft.editingId && !original) return false
    const remainingRecords = original ? currentRecords.filter((alarm) => alarm.id !== original.id) : currentRecords
    const baseAlarm = original ?? FREE_SLEEP_DEFAULT_ALARM
    const normalizedTime = parsedInputTime(normalizedInputTime(draft.time), baseAlarm.time)
    const nextRecords = [
      ...remainingRecords,
      ...draft.days.map((day, offset) => ({
        ...baseAlarm,
        day,
        enabled: draft.enabled,
        id: original && day === original.day ? original.id : `${original ? 'edited' : 'new'}-${createdAt}-${offset}-${day}`,
        index: remainingRecords.filter((alarm) => alarm.day === day).length,
        time: normalizedTime,
      })),
    ]
    debugFreeSleepAlarm(callService, original ? 'section-handle-alarm-edit' : 'section-handle-alarm-add', {
      editingId: draft.editingId,
      nextRecords: compactAlarmRecordsForDebug(nextRecords),
      side: side.scheduleSide,
    })
    setAlarmRecords(nextRecords)
    return true
  }

  const setAlarmEnabled = (alarm: FreeSleepAlarmRecord, enabled: boolean) => {
    if (!availableRef.current) return false
    if (optimisticRecords && optimisticAlarmSourceKeyRef.current !== alarmSyncSourceKeyRef.current) {
      const sourceWasLocalAcknowledgement = rebaseLocalAlarmAcknowledgement(
        alarmRecordsStateKey(sourceRecordsRef.current),
        alarmSyncSourceKeyRef.current,
      )
      if (!sourceWasLocalAcknowledgement) {
        if (alarmSyncTimerRef.current !== null) window.clearTimeout(alarmSyncTimerRef.current)
        pendingAlarmRecordsRef.current = null
        pendingAlarmSourceKeyRef.current = null
        alarmSyncTimerRef.current = null
        alarmRecordsRef.current = sourceRecordsRef.current
        optimisticAlarmSourceKeyRef.current = null
        setOptimisticRecords(null)
        return false
      }
    }
    const currentRecords = alarmRecordsRef.current
    const currentAlarm = currentRecords.find((record) => record.id === alarm.id)
    if (!currentAlarm || !sameAlarmRecord(currentAlarm, alarm)) return false
    if (currentAlarm.enabled === enabled) return true

    const nextRecords = currentRecords.map((record) => (
      record.id === currentAlarm.id ? { ...record, enabled } : record
    ))
    debugFreeSleepAlarm(callService, 'section-set-alarm-enabled', {
      alarm: compactAlarmRecordForDebug(currentAlarm),
      enabled,
      side: side.scheduleSide,
    })
    alarmRecordsRef.current = nextRecords
    optimisticAlarmSourceKeyRef.current ??= alarmSyncSourceKeyRef.current
    setOptimisticRecords(nextRecords)
    queueAlarmRecordsSync(nextRecords)
    return true
  }

  const removeAlarm = (draft: EightSleepAlarmEditorDraft) => {
    if (!available) return false
    const deletedAlarm = alarmRecordsRef.current.find((alarm) => alarm.id === draft.editingId)
    if (!deletedAlarm) return false
    debugFreeSleepAlarm(callService, 'section-handle-alarm-delete', {
      deletedAlarm: compactAlarmRecordForDebug(deletedAlarm),
      side: side.scheduleSide,
    })
    setAlarmRecords(alarmRecordsRef.current.filter((alarm) => alarm.id !== deletedAlarm.id))
    return true
  }

  return {
    alarmRecords,
    available,
    removeAlarm,
    saveAlarm,
    setAlarmEnabled,
    supportsMultiplePerDay,
  }
}

function EightSleepAlarmToggle({
  alarm,
  controller,
  side,
}: {
  alarm: FreeSleepAlarmRecord
  controller: EightSleepAlarmsController
  side: EightSleepSideConfig
}) {
  const label = side.title + ' ' + alarmDayLabel(alarm.day) + ' alarm at ' + formatClockTime(alarm.time)
  return (
    <ToggleControl
      checked={alarm.enabled}
      disabled={!controller.available}
      label={label}
      onChange={(enabled) => controller.setAlarmEnabled(alarm, enabled)}
    />
  )
}

function EightSleepAlarmsSection({
  controller,
  onAddAlarm,
  onOpenDay,
  side,
}: {
  controller: EightSleepAlarmsController
  onAddAlarm: () => void
  onOpenDay: (day: FreeSleepAlarmDay) => void
  side: EightSleepSideConfig
}) {
  const { alarmRecords, available } = controller
  const dayGroups = alarmDayGroups(alarmRecords)

  return (
    <ScheduleCollection
      addAction={{ disabled: !available, focusKey: 'add-alarm', label: 'Add Alarm', onClick: onAddAlarm }}
      empty={dayGroups.length === 0}
      emptyText='No alarms yet. Add one to choose days and a time.'
      error={!available ? 'Home Assistant alarm schedule data is unavailable.' : undefined}
      itemsTitle='Alarms'
    >
      {dayGroups.map((group) => {
        const label = alarmDayGroupLabel(group.day, group.alarms.length)
        const summary = alarmEnabledSummary(group.enabledCount, group.disabledCount)
        const singleAlarm = group.alarms.length === 1 ? group.alarms[0] : null
        return (
          <ScheduleListRow
            accessibleLabel={[side.title, label, summary].join(' ')}
            active={group.enabledCount > 0}
            disabled={!available}
            focusKey={'alarm-day-' + group.day}
            icon={group.enabledCount > 0 ? 'mdi:alarm-check' : 'mdi:alarm-off'}
            key={group.day}
            onClick={() => onOpenDay(group.day)}
            primary={label}
            secondary={summary}
            trailingControl={singleAlarm ? (
              <EightSleepAlarmToggle alarm={singleAlarm} controller={controller} side={side} />
            ) : undefined}
          />
        )
      })}
    </ScheduleCollection>
  )
}

function EightSleepAlarmDayPage({
  controller,
  day,
  onAddAlarm,
  onEditAlarm,
  side,
}: {
  controller: EightSleepAlarmsController
  day: FreeSleepAlarmDay
  onAddAlarm: () => void
  onEditAlarm: (alarm: FreeSleepAlarmRecord) => void
  side: EightSleepSideConfig
}) {
  const alarms = controller.alarmRecords.filter((alarm) => alarm.day === day)
  const canAddAlarm = controller.supportsMultiplePerDay || alarms.length === 0

  return (
    <div className={styles.eightSleepAlarmDetailPage}>
      <SleepypodActiveAlarmSection
        side={side.scheduleSide}
        sideTitle={side.title}
        snoozeButtonEntityId={side.alarmSnoozeButtonEntityId}
        stateEntityId={side.alarmStateEntityId}
        stopButtonEntityId={side.alarmStopButtonEntityId}
      />
      <ScheduleCollection
        addAction={canAddAlarm ? {
          autoFocus: alarms.length === 0,
          disabled: !controller.available,
          focusKey: 'add-' + day + '-alarm',
          label: 'Add Alarm',
          onClick: onAddAlarm,
        } : undefined}
        empty={alarms.length === 0}
        emptyText={'No ' + alarmDayLabel(day) + ' alarms are configured.'}
        error={!controller.available ? 'Home Assistant alarm schedule data is unavailable.' : undefined}
        itemsTitle='Alarms'
        readOnlyText={!canAddAlarm ? 'Fallback alarm helpers support one alarm per day.' : undefined}
      >
        {alarms.map((alarm, index) => {
          const scheduleState = alarm.enabled ? 'Enabled' : 'Disabled'
          return (
            <ScheduleListRow
              accessibleLabel={side.title + ' ' + alarmDayLabel(day) + ' alarm at ' + formatClockTime(alarm.time) + ', ' + scheduleState}
              active={alarm.enabled}
              autoFocus={index === 0}
              disabled={!controller.available}
              focusKey={alarm.id}
              icon={alarm.enabled ? 'mdi:alarm-check' : 'mdi:alarm-off'}
              key={alarm.id}
              onClick={() => onEditAlarm(alarm)}
              primary={formatClockTime(alarm.time)}
              secondary={scheduleState}
              trailingControl={<EightSleepAlarmToggle alarm={alarm} controller={controller} side={side} />}
            />
          )
        })}
      </ScheduleCollection>
    </div>
  )
}

function EightSleepScheduleTemperatureControl({
  entityId,
  fallbackTemperature,
  icon,
  label,
  scheduleEntityId,
  scheduleSetTopic,
  side,
  sideTitle,
  stageKey,
}: {
  entityId: string
  fallbackTemperature: number | null
  icon: string
  label: string
  scheduleEntityId: string
  scheduleSetTopic?: string
  side: EightSleepSideConfig
  sideTitle: string
  stageKey: FreeSleepScheduleStage
}) {
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true })
  const scheduleEntity = useEntity(asEntityName(scheduleEntityId), { returnNullIfNotFound: true })
  const entities = useHass((state) => state.entities) as unknown as EntityActionStateMap
  const callService = useCallService()
  const valueSyncTimerRef = useRef<number | null>(null)
  const pendingValueRef = useRef<number | null>(null)
  const unavailable = !entity || entity.state === 'unavailable'
  const liveValue = unavailable ? null : numberValue(entity.state)
  const min = numberValue(entity?.attributes.min) ?? FREE_SLEEP_TARGET_MIN
  const max = numberValue(entity?.attributes.max) ?? FREE_SLEEP_TARGET_MAX
  const step = numberValue(entity?.attributes.step) ?? FREE_SLEEP_TARGET_STEP
  const [displayValue, commitDisplayValue] = useOptimisticState(liveValue, { clearOn: 'confirmation', revertMs: FREE_SLEEP_TARGET_REVERT_MS })
  const baseValue = displayValue ?? fallbackTemperature
  const baseValueRef = useRef(baseValue)
  const canChange = !unavailable && baseValue !== null
  const stateText = formatEightSleepTargetLevel(displayValue)

  useEffect(() => {
    baseValueRef.current = baseValue
  }, [baseValue])

  useEffect(() => () => {
    if (valueSyncTimerRef.current !== null) window.clearTimeout(valueSyncTimerRef.current)
  }, [])

  const queueValueSync = (nextValue: number) => {
    pendingValueRef.current = nextValue
    if (valueSyncTimerRef.current !== null) window.clearTimeout(valueSyncTimerRef.current)
    valueSyncTimerRef.current = window.setTimeout(() => {
      const pendingValue = pendingValueRef.current
      pendingValueRef.current = null
      valueSyncTimerRef.current = null
      if (pendingValue === null) return
      callService({ domain: entityId.split('.')[0], service: 'set_value', target: entityId, serviceData: { value: pendingValue } })
      if (scheduleSetTopic) {
        const levels = Object.fromEntries(FREE_SLEEP_SCHEDULE_STAGES.map((stage) => {
          if (stage.key === stageKey) return [stage.key, pendingValue]
          const stageEntityId = side.scheduleStageTemperatureEntityIds[stage.key]
          return [stage.key, numberValue(entities[stageEntityId]?.state) ?? fallbackTemperature ?? 0]
        })) as Record<FreeSleepScheduleStage, number>
        const schedule = scheduleFromEntityAttributes(scheduleEntity?.attributes as Record<string, unknown> | undefined)
        callService({
          domain: 'mqtt',
          service: 'publish',
          serviceData: {
            payload: JSON.stringify(sleepypodSchedulePayload(side, schedule, levels)),
            topic: scheduleSetTopic,
          },
        })
      }
    }, FREE_SLEEP_NUMBER_SYNC_DEBOUNCE_MS)
  }

  const applyDelta = (delta: number) => {
    const currentValue = baseValueRef.current
    if (!canChange || currentValue === null) return
    const nextValue = snapNumberToStep(currentValue + delta, min, max, step)
    baseValueRef.current = nextValue
    commitDisplayValue(nextValue)
    queueValueSync(nextValue)
  }

  return (
    <Stepper
      decrementLabel={`Decrease ${sideTitle} ${label} level`}
      disabled={!canChange}
      displayValue={stateText}
      icon={icon}
      incrementLabel={`Increase ${sideTitle} ${label} level`}
      label={label}
      onDecrement={() => applyDelta(-step)}
      onIncrement={() => applyDelta(step)}
    />
  )
}

function EightSleepHotFlashButton({ modalState, side }: { modalState: EightSleepBedModalState; side: EightSleepSideConfig }) {
  const restoreAtEntity = useEntity(asEntityName(side.hotFlashRestoreAtEntityId), { returnNullIfNotFound: true })
  const timerEntity = useEntity(asEntityName(side.hotFlashTimerEntityId), { returnNullIfNotFound: true })
  const callService = useCallService()
  const [now, setNow] = useState(() => Date.now())
  const unavailable = !modalState.hotFlashAvailable
  const active = modalState.hotFlashActive
  const stateText = unavailable ? 'Unavailable' : active ? 'Active' : 'Inactive'
  const countdown = active ? eightSleepHotFlashCountdown(timerEntity, restoreAtEntity, now) : null

  useEffect(() => {
    if (!active) return undefined
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [active])

  const activate = () => {
    if (unavailable) return
    modalState.commitHotFlashActive(true)
    modalState.commitDisplaySideOn(true)
    callService({ domain: 'input_button', service: 'press', target: side.hotFlashButtonEntityId })
  }

  const cancel = () => {
    modalState.commitHotFlashActive(false)
    callService({ domain: 'input_button', service: 'press', target: side.hotFlashCancelButtonEntityId })
  }

  return (
    <ThermostatGlassCard active={active} icon="mdi:snowflake" onMainClick={activate} pressed={active} stateText={stateText} title="Hot Flash Mode">
      {active && (
        <div className={styles.eightSleepHotFlashStatus}>
          {countdown && <span className={styles.eightSleepCountdown}>{countdown}</span>}
          <button aria-label={`Cancel ${side.title} hot flash mode`} className={styles.eightSleepCancelButton} onClick={cancel} type="button">
            <MaterialIcon name="mdi:close" size={20} />
          </button>
        </div>
      )}
    </ThermostatGlassCard>
  )
}

function EightSleepBedModal({ modalState, onClose, open, side }: { modalState: EightSleepBedModalState; onClose: () => void; open: boolean; side: EightSleepSideConfig }) {
  const callService = useCallService()
  const [activeTab, setActiveTab] = useState<EightSleepModalTab>('schedule')
  const [alarmPage, setAlarmPage] = useState<EightSleepAlarmDetailPage | null>(null)
  const alarmController = useEightSleepAlarmsController({
    scheduleEntityId: modalState.controlMode === 'climate' ? SLEEPYPOD_SCHEDULE_SENSOR_ENTITY_ID : FREE_SLEEP_SCHEDULE_SENSOR_ENTITY_ID,
    scheduleSetTopic: modalState.controlMode === 'climate' ? SLEEPYPOD_SCHEDULE_SET_TOPIC : FREE_SLEEP_SCHEDULE_SET_TOPIC,
    side,
  })
  const [scopeRequest, setScopeRequest] = useState<BedTemperatureScopeRequest>({
    open: false,
    phase: 'bedtime',
    returnFocus: null,
    targetText: '--',
    value: 0,
  })
  const scopeCommandStateRef = useRef({
    activeSchedulePhase: modalState.activeSchedulePhase,
    request: scopeRequest,
    sideAvailable: modalState.sideAvailable,
  })
  const alarmPanelRef = useRef<HTMLDivElement | null>(null)
  const alarmEditor = alarmPage?.kind === 'editor' ? alarmPage.draft : null
  const alarmEditorStale = Boolean(alarmController.available && alarmEditor?.editingId && !alarmController.alarmRecords.some((alarm) => alarm.id === alarmEditor.editingId))
  const alarmEditorLegacyConflict = Boolean(
    alarmEditor
    && !alarmEditor.editingId
    && !alarmController.supportsMultiplePerDay
    && alarmEditor.days.some((day) => alarmController.alarmRecords.some((alarm) => alarm.day === day)),
  )
  const alarmEditorInvalid = Boolean(alarmEditor && (!alarmController.available || alarmEditorStale || alarmEditorLegacyConflict || alarmEditor.days.length === 0 || !isValidScheduleTime(alarmEditor.time)))
  const {
    bodyElementRef,
    closeAllDetailPages,
    closeDetailPage,
    detailOpen: alarmDetailPage,
    openDetailPage,
    resetDetailPage,
  } = useScheduleDetailPage(alarmPage, setAlarmPage, alarmPanelRef, {
    getPageKey: (page) => page.kind === 'day'
      ? `alarm-day:${page.day}`
      : `alarm-editor:${page.draft.editingId ?? 'new'}:${page.lockedDay ?? 'global'}`,
  })
  const setAlarmPanelElement = useCallback((element: HTMLDivElement | null) => {
    alarmPanelRef.current = element
  }, [])
  const [previousOpen, setPreviousOpen] = useState(open)
  const tabs = modalState.controlMode === 'climate' ? SLEEPYPOD_MODAL_TABS : EIGHT_SLEEP_MODAL_TABS
  const renderedActiveTab = tabs.some((tab) => tab.tab === activeTab) ? activeTab : tabs[0].tab
  const scopeRequestInvalid = scopeRequest.open && (!modalState.sideAvailable || modalState.activeSchedulePhase !== scopeRequest.phase)
  if (previousOpen !== open) {
    setPreviousOpen(open)
    if (!open) {
      if (scopeRequest.open) setScopeRequest((current) => ({ ...current, open: false }))
      if (alarmPage) resetDetailPage()
    }
  } else if (scopeRequestInvalid) {
    setScopeRequest((current) => ({ ...current, open: false }))
  } else if (alarmPage && !modalState.sideAvailable) {
    resetDetailPage()
  }

  useLayoutEffect(() => {
    scopeCommandStateRef.current = {
      activeSchedulePhase: modalState.activeSchedulePhase,
      request: scopeRequest,
      sideAvailable: modalState.sideAvailable,
    }
  }, [modalState.activeSchedulePhase, modalState.sideAvailable, scopeRequest])

  const closeScopePrompt = () => {
    setScopeRequest((current) => ({ ...current, open: false }))
  }

  const closeBedModal = () => {
    closeScopePrompt()
    resetDetailPage()
    onClose()
  }

  const createAlarmDraft = (days: FreeSleepAlarmDay[], title: string): EightSleepAlarmEditorDraft => ({
    days,
    editingId: null,
    enabled: true,
    time: FREE_SLEEP_DEFAULT_ALARM.time,
    title,
  })

  const openAlarmDay = (day: FreeSleepAlarmDay) => {
    openDetailPage({ day, kind: 'day' }, `alarm-day-${day}`)
  }

  const openGlobalAlarmEditor = () => {
    const defaultDayOptions = alarmController.supportsMultiplePerDay
      ? FREE_SLEEP_ALARM_DAY_OPTIONS
      : FREE_SLEEP_ALARM_DAY_OPTIONS.filter((option) => !alarmController.alarmRecords.some((alarm) => alarm.day === option.value))
    openDetailPage({
      draft: createAlarmDraft(resolveScheduleDefaultDays(defaultDayOptions), `Add ${side.title} Alarm`),
      kind: 'editor',
      lockedDay: null,
    }, 'add-alarm')
  }

  const openDayAlarmEditor = (day: FreeSleepAlarmDay) => {
    openDetailPage({
      draft: createAlarmDraft(resolveScheduleDefaultDays(FREE_SLEEP_ALARM_DAY_OPTIONS, [day]), `Add ${side.title} ${alarmDayLabel(day)} Alarm`),
      kind: 'editor',
      lockedDay: day,
    }, `add-${day}-alarm`)
  }

  const openAlarmEditor = (alarm: FreeSleepAlarmRecord) => {
    openDetailPage({
      draft: {
        days: [alarm.day],
        editingId: alarm.id,
        enabled: alarm.enabled,
        time: alarm.time,
        title: `${side.title} ${alarmDayLabel(alarm.day)} Alarm`,
      },
      kind: 'editor',
      lockedDay: alarm.day,
    }, alarm.id)
  }

  const updateAlarmEditor = (draft: EightSleepAlarmEditorDraft) => {
    setAlarmPage((current) => current?.kind === 'editor' ? { ...current, draft } : current)
  }

  const saveAlarm = () => {
    if (!alarmEditor || alarmEditorInvalid) return
    if (alarmController.saveAlarm(alarmEditor)) closeDetailPage()
  }

  const deleteAlarm = () => {
    if (!alarmEditor?.editingId) return
    const alarmToDelete = alarmController.alarmRecords.find((alarm) => alarm.id === alarmEditor.editingId)
    if (!alarmToDelete) return
    if (!window.confirm(`Delete alarm set for ${formatClockTime(alarmToDelete.time)} on ${alarmDayLabel(alarmToDelete.day)}?`)) return
    const alarmDay = alarmToDelete.day
    const deletingLastAlarmForDay = alarmController.alarmRecords.filter((alarm) => alarm.day === alarmDay).length <= 1
    if (!alarmController.removeAlarm(alarmEditor)) return
    if (deletingLastAlarmForDay) closeAllDetailPages()
    else closeDetailPage()
  }

  const requestTemperatureScope = (value: number, phase: SleepypodSchedulePhase, returnFocus: HTMLElement | null) => {
    setScopeRequest({
      open: true,
      phase,
      returnFocus,
      targetText: formatBedTargetValue(value, modalState),
      value,
    })
  }

  const chooseTemperatureScope = (scope: SleepypodTemperatureScope) => {
    const current = scopeCommandStateRef.current
    if (!current.request.open || !current.sideAvailable || current.activeSchedulePhase !== current.request.phase) {
      closeScopePrompt()
      return
    }
    closeScopePrompt()
    modalState.commitTargetTemperature(current.request.value)
    callService({
      domain: 'script',
      service: sleepypodTemperatureScopeService(side.scheduleSide, scope, current.request.phase),
      serviceData: { level: current.request.value },
    })
  }

  const alarmDayPage = alarmPage?.kind === 'day' ? alarmPage : null
  const alarmDayCount = alarmDayPage
    ? alarmController.alarmRecords.filter((alarm) => alarm.day === alarmDayPage.day).length
    : 0
  const modalTitle = alarmEditor?.title
    ?? (alarmDayPage ? `${side.title} ${alarmDayGroupLabel(alarmDayPage.day, alarmDayCount)}` : side.title)
  const backLabel = alarmPage?.kind === 'editor' && alarmPage.lockedDay
    ? `Back to ${alarmDayLabel(alarmPage.lockedDay)} alarms`
    : 'Back to alarms'

  return (
    <>
      <ModalSheet
        backLabel={backLabel}
        bodyElementRef={bodyElementRef}
        contentStyle={alarmDetailPage ? EIGHT_SLEEP_ALARM_EDITOR_MODAL_STYLE : EIGHT_SLEEP_BED_MODAL_STYLE}
        footer={alarmEditor ? (
          <ScheduleDetailFooter
            deleteAction={alarmEditor.editingId ? { disabled: !alarmController.available || alarmEditorStale, icon: 'mdi:delete', label: 'Delete Alarm', onClick: deleteAlarm } : undefined}
            primaryAction={{ disabled: alarmEditorInvalid, icon: alarmEditor.editingId ? 'mdi:content-save' : 'mdi:plus', label: alarmEditor.editingId ? 'Save Alarm' : 'Add Alarm', onClick: saveAlarm }}
          />
        ) : alarmPage ? undefined : <EightSleepModalNav activeTab={renderedActiveTab} onTabChange={setActiveTab} sideTitle={side.title} tabs={tabs} />}
        onBack={alarmDetailPage ? closeDetailPage : undefined}
        onClose={closeBedModal}
        open={open}
        subtitle={alarmDetailPage ? undefined : modalState.subtitle}
        surface="hass-popup"
        title={modalTitle}
      >
        {renderedActiveTab === 'alarms' || alarmDetailPage ? (
          <EightSleepBedModalContentView
            activeTab={renderedActiveTab}
            alarmController={alarmController}
            alarmPage={alarmPage}
            modalState={modalState}
            onAddAlarm={openGlobalAlarmEditor}
            onAddDayAlarm={openDayAlarmEditor}
            onAlarmEditorChange={updateAlarmEditor}
            alarmEditorLegacyConflict={alarmEditorLegacyConflict}
            alarmEditorStale={alarmEditorStale}
            onEditAlarm={openAlarmEditor}
            onOpenAlarmDay={openAlarmDay}
            onPanelElementChange={setAlarmPanelElement}
            onRequestTemperatureScope={requestTemperatureScope}
            side={side}
            tabs={tabs}
          />
        ) : (
          <EightSleepBedModalContentView
            activeTab={renderedActiveTab}
            alarmPage={null}
            modalState={modalState}
            onPanelElementChange={setAlarmPanelElement}
            onRequestTemperatureScope={requestTemperatureScope}
            side={side}
            tabs={tabs}
          />
        )}
      </ModalSheet>
      <BedTemperatureScopePrompt
        onChoose={chooseTemperatureScope}
        onClose={closeScopePrompt}
        open={open && scopeRequest.open && modalState.sideAvailable && modalState.activeSchedulePhase === scopeRequest.phase}
        phase={scopeRequest.phase}
        returnFocus={scopeRequest.returnFocus}
        sideTitle={side.title}
        targetText={scopeRequest.targetText}
      />
    </>
  )
}

function EightSleepModalNav({ activeTab, onTabChange, sideTitle, tabs }: { activeTab: EightSleepModalTab; onTabChange: (tab: EightSleepModalTab) => void; sideTitle: string; tabs: typeof EIGHT_SLEEP_MODAL_TABS }) {
  const { clearVisualTab, setVisualTabNow, visualActiveTab } = useImmediateVisualTab(activeTab)
  const navStyle = { '--eight-sleep-modal-nav-cols': tabs.length } as CSSProperties

  return (
    <nav aria-label={`${sideTitle} modal sections`} className={styles.eightSleepModalNav} data-tab-count={tabs.length} style={navStyle}>
      {tabs.map((item) => {
        const isActive = visualActiveTab === item.tab
        const isCurrent = activeTab === item.tab
        return (
          <button
            aria-current={isCurrent ? 'page' : undefined}
            aria-label={item.label}
            className={[styles.eightSleepModalNavButton, isActive ? styles.eightSleepModalNavButtonActive : ''].filter(Boolean).join(' ')}
            data-active={isActive}
            key={item.tab}
            onBlur={clearVisualTab}
            onClick={() => {
              setVisualTabNow(item.tab)
              onTabChange(item.tab)
            }}
            onPointerCancel={clearVisualTab}
            onPointerDown={() => setVisualTabNow(item.tab)}
            type="button"
          >
            <MaterialIcon name={item.icon} size={22} />
          </button>
        )
      })}
    </nav>
  )
}

function SleepypodMetricCard({ active = false, entityId, icon, title }: { active?: boolean; entityId: string | undefined; icon: string; title: string }) {
  const entity = useEntity(asEntityName(entityId ?? 'sensor.sleepypod_unselected_metric'), { returnNullIfNotFound: true })
  const stateText = formatCompactEntityState(entity, 'Unavailable')
  return <ThermostatGlassCard active={active && !isUnavailable(entity)} icon={icon} stateText={stateText} title={title} />
}

function SleepypodStatusSection({ modalState, side }: { modalState: EightSleepBedModalState; side: EightSleepSideConfig }) {
  const pumpStall = useEntity(asEntityName(side.pumpStallEntityId ?? 'binary_sensor.sleepypod_unselected_pump_stall'), { returnNullIfNotFound: true })
  const pumpClog = useEntity(asEntityName(side.pumpClogEntityId ?? 'binary_sensor.sleepypod_unselected_pump_clog'), { returnNullIfNotFound: true })
  const pumpAlert = pumpStall?.state === 'on' || pumpClog?.state === 'on'
  const pumpText = pumpAlert ? 'Check pump' : pumpStall || pumpClog ? 'OK' : 'Unavailable'

  return (
    <section className={styles.section}>
      <SectionHeader title="Status" />
      <div className={styles.eightSleepStageGrid}>
        <ThermostatGlassCard active={modalState.controlsSideOn} hvacAction={modalState.heroAction} icon="mdi:thermometer" stateText={formatTemperatureCompact(modalState.currentTemperature)} thermalStatus={thermostatThermalStatus(modalState.heroAction)} title="Current Temp" />
        <ThermostatGlassCard active={!pumpAlert && Boolean(pumpStall || pumpClog)} icon={pumpAlert ? 'mdi:alert' : 'mdi:pump'} stateText={pumpText} title="Pump Status" />
        <SleepypodMetricCard entityId={side.pumpLoopTemperatureEntityId} icon="mdi:coolant-temperature" title="Loop Temp" />
        <SleepypodMetricCard entityId={side.pumpRpmEntityId} icon="mdi:pump" title="Pump RPM" />
        <SleepypodMetricCard active entityId={side.heartRateEntityId} icon="mdi:heart-pulse" title="Heart Rate" />
        <SleepypodMetricCard active entityId={side.breathingRateEntityId} icon="mdi:lungs" title="Breathing" />
        <SleepypodMetricCard active entityId={side.hrvEntityId} icon="mdi:chart-bell-curve" title="HRV" />
      </div>
    </section>
  )
}

interface EightSleepBedModalContentProps {
  activeTab: EightSleepModalTab
  alarmController?: EightSleepAlarmsController
  alarmEditorLegacyConflict?: boolean
  alarmEditorStale?: boolean
  alarmPage: EightSleepAlarmDetailPage | null
  modalState: EightSleepBedModalState
  onAddAlarm?: () => void
  onAddDayAlarm?: (day: FreeSleepAlarmDay) => void
  onAlarmEditorChange?: (draft: EightSleepAlarmEditorDraft) => void
  onEditAlarm?: (alarm: FreeSleepAlarmRecord) => void
  onOpenAlarmDay?: (day: FreeSleepAlarmDay) => void
  onPanelElementChange?: (element: HTMLDivElement | null) => void
  onRequestTemperatureScope?: (value: number, phase: SleepypodSchedulePhase, returnFocus: HTMLElement | null) => void
  side: EightSleepSideConfig
  tabs?: typeof EIGHT_SLEEP_MODAL_TABS
}

function EightSleepBedModalContentView({
  activeTab,
  alarmController,
  alarmEditorLegacyConflict = false,
  alarmEditorStale = false,
  alarmPage,
  modalState,
  onAddAlarm,
  onAddDayAlarm,
  onAlarmEditorChange,
  onEditAlarm,
  onOpenAlarmDay,
  onPanelElementChange,
  onRequestTemperatureScope,
  side,
  tabs,
}: EightSleepBedModalContentProps) {
  const modalBodyRef = useRef<HTMLDivElement | null>(null)
  const modalPanelRef = useRef<HTMLDivElement | null>(null)
  const { displayedTab: effectiveActiveTab, transitionState } = useSmoothDisplayedModalTab(activeTab)
  const currentTemperature = useEntity(asEntityName(side.currentTemperatureEntityId), { returnNullIfNotFound: true })
  const presence = useEntity(asEntityName(side.presenceEntityId), { returnNullIfNotFound: true })
  const secondsRemaining = useEntity(asEntityName(side.secondsRemainingEntityId), { returnNullIfNotFound: true })
  const alarmStateEntity = useEntity(asEntityName(side.alarmStateEntityId), { returnNullIfNotFound: true })
  const currentTemperatureText = formatTemperatureCompact(currentTemperature?.state, temperatureUnit(currentTemperature))
  const presenceText = presence?.state === 'on' ? 'In Bed' : presence?.state === 'off' ? 'Away' : titleCaseState(presence?.state ?? 'unavailable')
  const timeRemainingText = formatSecondsRemaining(secondsRemaining?.state)
  const alarmState = sleepypodAlarmState(alarmStateEntity?.state)
  const alarmActive = isSleepypodAlarmActive(alarmState)
  const selectedTabLabel = (tabs ?? EIGHT_SLEEP_MODAL_TABS).find((tab) => tab.tab === effectiveActiveTab)?.label ?? 'Sleep Schedule'
  const alarmEditorPage = alarmPage?.kind === 'editor' ? alarmPage : null
  const alarmEditor = alarmEditorPage?.draft ?? null
  const alarmDayOptions = alarmEditor && alarmEditorPage?.lockedDay === null && !alarmEditor.editingId && alarmController && !alarmController.supportsMultiplePerDay
    ? FREE_SLEEP_ALARM_DAY_OPTIONS.map((option) => ({
      ...option,
      disabled: alarmController.alarmRecords.some((alarm) => alarm.day === option.value),
    }))
    : FREE_SLEEP_ALARM_DAY_OPTIONS

  useEffect(() => {
    if (!shouldResetScrollOnTabChange()) return

    const scrollContainers = [modalPanelRef.current, modalBodyRef.current?.parentElement]
    for (const scrollContainer of scrollContainers) {
      if (!scrollContainer || typeof scrollContainer.scrollTo !== 'function') continue
      scrollContainer.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [effectiveActiveTab])

  if (alarmEditor && alarmEditorPage) {
    return (
      <div className={styles.eightSleepAlarmEditor}>
        <SleepypodActiveAlarmSection
          side={side.scheduleSide}
          sideTitle={side.title}
          snoozeButtonEntityId={side.alarmSnoozeButtonEntityId}
          stateEntityId={side.alarmStateEntityId}
          stopButtonEntityId={side.alarmStopButtonEntityId}
        />
        <ScheduleEditorFields
          dayOptions={alarmDayOptions}
          days={alarmEditor.days}
          onDaysChange={(days: FreeSleepAlarmDay[]) => onAlarmEditorChange?.({ ...alarmEditor, days })}
          showDays={alarmEditorPage.lockedDay === null}
          timeFields={[{
            ariaLabel: 'Alarm time',
            label: 'Time',
            onChange: (time) => onAlarmEditorChange?.({ ...alarmEditor, time }),
            value: alarmEditor.time,
          }]}
        >
          {alarmEditor.editingId && (
            <ToggleSetting
              checked={alarmEditor.enabled}
              disabled={!alarmController?.available || alarmEditorStale}
              icon={alarmEditor.enabled ? 'mdi:alarm-check' : 'mdi:alarm-off'}
              label="Alarm Enabled"
              onChange={(enabled) => onAlarmEditorChange?.({ ...alarmEditor, enabled })}
            />
          )}
          {!alarmController?.available && <InlineAlert>Home Assistant alarm schedule data is unavailable.</InlineAlert>}
          {alarmEditorStale && <InlineAlert>This alarm changed in Home Assistant. Go back and reopen it.</InlineAlert>}
          {alarmEditorLegacyConflict && <InlineAlert>Fallback alarm helpers support one alarm per day. Choose a day without an alarm.</InlineAlert>}
          {alarmEditor.days.length === 0 && <InlineAlert>Select at least one day.</InlineAlert>}
          {!isValidScheduleTime(alarmEditor.time) && <InlineAlert>Choose a valid alarm time.</InlineAlert>}
        </ScheduleEditorFields>
      </div>
    )
  }

  if (alarmPage?.kind === 'day' && alarmController) {
    return (
      <EightSleepAlarmDayPage
        controller={alarmController}
        day={alarmPage.day}
        onAddAlarm={() => onAddDayAlarm?.(alarmPage.day)}
        onEditAlarm={(alarm) => onEditAlarm?.(alarm)}
        side={side}
      />
    )
  }


  return (
    <div className={`${styles.thermostatModalBody} ${styles.eightSleepModalBody}`} data-layout="eight-sleep-modal-body" ref={modalBodyRef}>
      <div className={styles.eightSleepHeroColumn} data-scroll-region="eight-sleep-hero-column">
        <div className={`${styles.eightSleepModalHeroShell} ${styles.thermostatModalDialShell}`} data-section="eight-sleep-hero" data-thermostat-modal-dial-shell="true" style={THERMOSTAT_MODAL_DIAL_SHELL_STYLE}>
          <EightSleepThermostatHero modalState={modalState} onRequestTemperatureScope={onRequestTemperatureScope} side={side} />
        </div>
        <SleepypodActiveAlarmSection
          side={side.scheduleSide}
          sideTitle={side.title}
          snoozeButtonEntityId={side.alarmSnoozeButtonEntityId}
          stateEntityId={side.alarmStateEntityId}
          stopButtonEntityId={side.alarmStopButtonEntityId}
        />
      </div>
      <div
        aria-label={`${side.title} ${selectedTabLabel}`}
        className={styles.eightSleepModalPanel}
        data-modal-tab-transition-state={transitionState}
        data-scroll-region="eight-sleep-panel"
        ref={(element) => {
          modalPanelRef.current = element
          onPanelElementChange?.(element)
        }}
      >
        {!modalState.sideAvailable && (
          <section className={styles.section}>
            <InlineAlert>Bed controls are unavailable. No changes can be made until the active bed connection recovers.</InlineAlert>
          </section>
        )}
        {modalState.sideAvailable && effectiveActiveTab === 'schedule' && <EightSleepScheduleSection modalState={modalState} side={side} />}
        {modalState.sideAvailable && effectiveActiveTab === 'modes' && (
          <section className={styles.section}>
            <SectionHeader title="Special Modes" />
            <Description className={styles.thermostatDescription}>Activating hot flash mode will set the bed to {modalState.targetScale === 'temperature' ? '55°F' : '-10'} for fifteen minutes.</Description>
            <EightSleepHotFlashButton modalState={modalState} side={side} />
          </section>
        )}
        {modalState.sideAvailable && effectiveActiveTab === 'alarms' && alarmController && (
          <EightSleepAlarmsSection controller={alarmController} onAddAlarm={() => onAddAlarm?.()} onOpenDay={(day) => onOpenAlarmDay?.(day)} side={side} />
        )}
        {modalState.sideAvailable && effectiveActiveTab === 'status' && modalState.controlMode === 'climate' && <SleepypodStatusSection modalState={modalState} side={side} />}
        {modalState.sideAvailable && effectiveActiveTab === 'status' && modalState.controlMode === 'legacy' && (
          <section className={styles.section}>
            <SectionHeader title="Status" />
            <div className={styles.eightSleepStageGrid}>
              <ThermostatGlassCard active={modalState.controlsSideOn} hvacAction={modalState.heroAction} icon="mdi:thermometer" stateText={currentTemperatureText} thermalStatus={thermostatThermalStatus(modalState.heroAction)} title="Current Temp" />
              <ThermostatGlassCard active={presence?.state === 'on'} icon={presence?.state === 'on' ? 'mdi:bed' : 'mdi:bed-empty'} stateText={presenceText} title="Presence" />
              <ThermostatGlassCard icon="mdi:timer-outline" stateText={timeRemainingText} title="Time Remaining" />
              <ThermostatGlassCard active={alarmActive} icon={alarmState === 'ringing' ? 'mdi:alarm-bell' : alarmState === 'snoozed' ? 'mdi:alarm-snooze' : 'mdi:alarm-check'} stateText={sleepypodAlarmStatusText(alarmState)} title="Alarm" />
            </div>
          </section>
        )}
        {modalState.sideAvailable && effectiveActiveTab === 'settings' && modalState.controlMode === 'legacy' && (
          <>
            <section className={styles.section}>
              <SectionHeader title="Bedtime" />
              <Description className={styles.thermostatDescription}>Choose when this side starts bedtime mode. Free Sleep will prime one hour before the earlier side bedtime.</Description>
              <EightSleepBedtimeSetting side={side} />
            </section>
            <section className={styles.section}>
              <SectionHeader title="Controls" />
              <EightSleepAwayModeCard side={side} />
            </section>
          </>
        )}
      </div>
    </div>
  )
}

const HVAC_MODE_ICONS: Record<string, string> = {
  auto: 'mdi:autorenew',
  cool: 'mdi:snowflake',
  dry: 'mdi:water-percent',
  fan_only: 'mdi:fan',
  heat: 'mdi:fire',
  heat_cool: 'mdi:sun-snowflake-variant',
  off: 'mdi:power',
}

const HVAC_MODE_LABELS: Record<string, string> = {
  heat_cool: 'Heat/Cool',
}

const HVAC_MODE_ACTIVE_COLORS: Record<string, string> = {
  cool: 'rgba(44, 142, 152, 0.6)',
  heat: 'rgba(205, 84, 1, 0.6)',
  heat_cool: 'linear-gradient(90deg, rgba(205, 84, 1, 0.6) 0%, rgba(44, 142, 152, 0.6) 100%)',
}
const THERMOSTAT_COMPACT_PICKER_MODAL_STYLE: ModalSheetStyle = {
  '--modal-desktop-height': 'auto',
  '--modal-desktop-max-width': '500px',
  '--modal-desktop-width': '500px',
}

function ThermostatSelectButton({
  entityId,
  hideWhenEmpty = false,
  icon,
  keepOpenOnSelect = false,
  optionActiveColors,
  optionIcons,
  optionLabels,
  optionsAttribute = 'options',
  pickerSheetLayout,
  pickerSheetStyle,
  selectedIcon = 'mdi:thermometer-check',
  serviceKind = 'select',
  title,
  valueAttribute,
}: {
  entityId: string
  hideWhenEmpty?: boolean
  icon: string
  keepOpenOnSelect?: boolean
  optionActiveColors?: Record<string, string>
  optionIcons?: Record<string, string>
  optionLabels?: Record<string, string>
  optionsAttribute?: string
  pickerSheetLayout?: 'card-grid' | 'compact-grid'
  pickerSheetStyle?: ModalSheetStyle
  selectedIcon?: string
  serviceKind?: 'climate' | 'climate-fan' | 'select'
  title: string
  valueAttribute?: string
}) {
  const [open, setOpen] = useState(false)
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true })
  const callService = useCallService()
  const rawOptions = entity?.attributes[optionsAttribute]
  const options: PickerOption[] = Array.isArray(rawOptions)
    ? rawOptions.map((option) => {
        const optionValue = String(option)
        return { activeBackground: optionActiveColors?.[optionValue], icon: optionIcons?.[optionValue], label: optionLabels?.[optionValue] ?? formatSelectOption(optionValue), value: optionValue }
      })
    : []
  const value = valueAttribute && typeof entity?.attributes[valueAttribute] === 'string' ? entity.attributes[valueAttribute] : entity?.state ?? ''
  const [displayValue, commitValue] = useOptimisticState(value)
  const disabled = options.length === 0

  if (hideWhenEmpty && disabled) return null

  const selectOption = (nextValue: string) => {
    if (nextValue === displayValue) {
      if (!keepOpenOnSelect) setOpen(false)
      return
    }

    commitValue(nextValue)
    if (serviceKind === 'climate') callService({ domain: 'climate', service: 'set_hvac_mode', target: entityId, serviceData: { hvac_mode: nextValue } })
    else if (serviceKind === 'climate-fan') callService({ domain: 'climate', service: 'set_fan_mode', target: entityId, serviceData: { fan_mode: nextValue } })
    else callService({ domain: 'select', service: 'select_option', target: entityId, serviceData: { option: nextValue } })
    if (!keepOpenOnSelect) setOpen(false)
  }

  return (
    <>
      <button aria-label={`${title} ${formatSelectOption(displayValue)}`} className={styles.thermostatSubButton} data-modal-opener-exception="option-picker" disabled={disabled} onClick={() => setOpen(true)} type="button">
        <MaterialIcon name={icon} size={22} />
        <MaterialIcon name="mdi:chevron-down" size={22} />
      </button>
      <OptionPickerDialog icon={icon} onClose={() => setOpen(false)} onSelect={selectOption} open={open} options={options} presentation="sheet" selectedIcon={selectedIcon} sheetLayout={pickerSheetLayout} sheetStyle={pickerSheetStyle} title={title} value={displayValue} />
    </>
  )
}

function ThermostatRoomRow({ onOpen, room }: { onOpen: (hash: string) => void; room: ThermostatRoomView }) {
  const temperature = useEntity(asEntityName(thermostatTemperatureEntityId(room)), { returnNullIfNotFound: true })
  const occupancy = useEntity(asEntityName(thermostatOccupancyEntityId(room)), { returnNullIfNotFound: true })
  const active = occupancy?.state === 'active'
  const subtitle = `${formatTemperatureValue(temperature?.state, temperatureUnit(temperature))} · ${titleCaseState(occupancy?.state)}`

  return (
    <ModalOpenerRow
      ariaLabel={`${room.title} ${subtitle}`}
      icon={<MaterialIcon name={active ? 'mdi:thermometer-check' : 'mdi:thermometer-off'} size={32} />}
      onClick={() => onOpen(room.hash)}
      subtitle={subtitle}
      title={room.title}
    />
  )
}

function ThermostatGlassCard({ active = false, ariaLabel, children, hvacAction, icon, onMainClick, pressed, stateText, thermalStatus = 'idle', title, tone = 'default' }: { active?: boolean; ariaLabel?: string; children?: ReactNode; hvacAction?: string; icon: string; onMainClick?: () => void; pressed?: boolean; stateText: string; thermalStatus?: ThermostatThermalStatus; title: string; tone?: ThermostatGlassTone }) {
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
    <div aria-label={ariaLabel} className={styles.thermostatGlassCard} data-active={active ? 'true' : 'false'} data-hvac-action={hvacAction} data-thermal-status={thermalStatus} data-tone={tone}>
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

function useThermostatHomeAwayStatus() {
  const statusEntity = useEntity(asEntityName(THERMOSTAT_HOME_AWAY_ENTITY_ID), { returnNullIfNotFound: true })
  const reasonEntity = useEntity(asEntityName(THERMOSTAT_HOME_AWAY_REASON_ENTITY_ID), { returnNullIfNotFound: true })
  const state = formatCompactEntityState(statusEntity, 'Unavailable')
  const reason = reasonEntity && !isUnavailable(reasonEntity) && reasonEntity.state.trim()
    ? reasonEntity.state
    : 'Home Assistant has not provided an effective-mode reason.'

  return { reason, state }
}

function WholeHomeThermostatDial() {
  const { state } = useThermostatHomeAwayStatus()
  const globalThermostat = useEntity(asEntityName(GLOBAL_THERMOSTAT_ENTITY_ID), { returnNullIfNotFound: true })
  const awayMode = useEntity(asEntityName(THERMOSTAT_AWAY_MODE_ENTITY_ID), { returnNullIfNotFound: true })
  const effectiveAway = thermostatEffectiveAway(state, awayMode?.state === 'on')

  return (
    <ThermostatDial
      actionOverride={rawThermostatAction(globalThermostat)}
      entityId={effectiveAway ? ECO_AWAY_THERMOSTAT_ENTITY_ID : GLOBAL_THERMOSTAT_ENTITY_ID}
      title="Whole Home"
    />
  )
}

function ThermostatHubPill() {
  const entity = useEntity(asEntityName('climate.thermostat_hub_w200'), { returnNullIfNotFound: true })
  const rawHvacAction = rawThermostatAction(entity)
  const stateText = formatCompactEntityState(entity, 'Unavailable')

  return (
    <ThermostatGlassCard ariaLabel={`Thermostat Hub ${stateText}`} hvacAction={rawHvacAction} icon="mdi:thermostat" stateText={stateText} thermalStatus={thermostatThermalStatus(rawHvacAction)} title="Thermostat Hub">
      <ThermostatSelectButton entityId="climate.thermostat_hub_w200" icon="mdi:power" keepOpenOnSelect optionActiveColors={HVAC_MODE_ACTIVE_COLORS} optionIcons={HVAC_MODE_ICONS} optionLabels={HVAC_MODE_LABELS} optionsAttribute="hvac_modes" pickerSheetLayout="compact-grid" pickerSheetStyle={THERMOSTAT_COMPACT_PICKER_MODAL_STYLE} serviceKind="climate" title="Thermostat Hub Mode" />
      <ThermostatSelectButton entityId="climate.thermostat_hub_w200" hideWhenEmpty icon="mdi:fan" optionsAttribute="fan_modes" selectedIcon="mdi:fan-check" serviceKind="climate-fan" title="Thermostat Hub Fan" valueAttribute="fan_mode" />
    </ThermostatGlassCard>
  )
}

function ThermostatSwitchCard({ children, entityId, icon, title }: { children?: ReactNode; entityId: string; icon: string; title: string }) {
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true })
  const callService = useCallService()
  const [state, commitState] = useOptimisticState(entity?.state ?? 'unavailable')
  const active = state === 'on'
  const stateText = formatCompactEntityState(entity, 'Unavailable', state)

  const toggle = () => {
    commitState(active ? 'off' : 'on')
    callService({ domain: 'homeassistant', service: 'toggle', target: entityId })
  }

  return (
    <ThermostatGlassCard active={active} icon={icon} onMainClick={toggle} stateText={stateText} title={title}>
      {children}
    </ThermostatGlassCard>
  )
}

function PredictiveComfortCard({ onOpen }: { onOpen: () => void }) {
  const entity = useEntity(asEntityName(PREDICTIVE_COMFORT_SWITCH_ENTITY_ID), { returnNullIfNotFound: true })
  const sensor = useEntity(asEntityName(PREDICTIVE_COMFORT_SENSOR_ENTITY_ID), { returnNullIfNotFound: true })
  const callService = useCallService()
  const [state, commitState] = useOptimisticState(entity?.state ?? 'unavailable')
  const active = state === 'on'
  const currentRecommendation = predictiveAttribute(entity, 'current_recommendation') ?? sensor?.state
  const stateText = active
    ? `${formatCompactEntityState(entity, 'Unavailable', state)} · ${formatPredictiveState(currentRecommendation)}`
    : formatCompactEntityState(entity, 'Unavailable', state)

  const handleMainClick = () => {
    if (active) {
      onOpen()
      return
    }
    commitState('on')
    callService({ domain: 'switch', service: 'turn_on', target: PREDICTIVE_COMFORT_SWITCH_ENTITY_ID })
  }

  const turnOff = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    commitState('off')
    callService({ domain: 'switch', service: 'turn_off', target: PREDICTIVE_COMFORT_SWITCH_ENTITY_ID })
  }

  const openControls = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    onOpen()
  }

  return (
    <ThermostatGlassCard active={active} icon="mdi:home-thermometer-outline" onMainClick={handleMainClick} pressed={active} stateText={stateText} title="Predictive Comfort">
      {active && (
        <>
          <button aria-label="Turn off Predictive Comfort" className={styles.thermostatIconButton} onClick={turnOff} type="button">
            <MaterialIcon name="mdi:power" size={22} />
          </button>
          <button aria-label="Open Predictive Comfort controls" className={styles.thermostatBareIconButton} onClick={openControls} type="button">
            <ModalDisclosureIcon />
          </button>
        </>
      )}
    </ThermostatGlassCard>
  )
}

function predictiveAttribute(entity: ReturnType<typeof useEntity>, key: string) {
  return entity?.attributes[key]
}

function formatPredictiveState(value: unknown) {
  if (typeof value !== 'string' || value === '') return 'Unknown'
  const stateKey = value.trim().toLowerCase().replace(/[\s-]+/g, '_')
  return PREDICTIVE_STATE_LABELS[stateKey] ?? formatSelectOption(value)
}

function formatPredictiveEntityLabel(value: unknown) {
  if (typeof value !== 'string' || value.trim() === '') return 'Unknown'
  const entityName = value.includes('.') ? value.split('.').slice(1).join('.') : value
  return titleCaseState(entityName.replace(/\./g, '_')).replace(/\bPc\b/g, 'PC')
}

function formatPredictiveEntityList(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) return 'None'
  return value.map(formatPredictiveEntityLabel).join(', ')
}

function sentence(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

function buildPredictiveReasonBullets(sensor: ReturnType<typeof useEntity>) {
  const bullets: string[] = []
  const reason = predictiveAttribute(sensor, 'reason')
  const indoor = numberValue(predictiveAttribute(sensor, 'indoor_temperature'))
  const predicted = numberValue(predictiveAttribute(sensor, 'predicted_temperature'))
  const comfortLow = numberValue(predictiveAttribute(sensor, 'comfort_low'))
  const comfortHigh = numberValue(predictiveAttribute(sensor, 'comfort_high'))
  const forecastLow = numberValue(predictiveAttribute(sensor, 'forecast_low'))
  const forecastHigh = numberValue(predictiveAttribute(sensor, 'forecast_high'))
  const activeHeatLoads = predictiveAttribute(sensor, 'active_activity_entities')
  const adjustmentStatus = predictiveAttribute(sensor, 'adjustment_status')

  if (typeof reason === 'string' && reason.trim()) bullets.push(sentence(reason))

  if (predicted !== null && comfortLow !== null && comfortHigh !== null) {
    if (predicted > comfortHigh) {
      bullets.push(`Predicted indoor temperature is ${formatTemperatureValue(predicted)}, above your ${formatTemperatureValue(comfortLow)} - ${formatTemperatureValue(comfortHigh)} comfort band.`)
    } else if (predicted < comfortLow) {
      bullets.push(`Predicted indoor temperature is ${formatTemperatureValue(predicted)}, below your ${formatTemperatureValue(comfortLow)} - ${formatTemperatureValue(comfortHigh)} comfort band.`)
    } else {
      bullets.push(`Predicted indoor temperature is ${formatTemperatureValue(predicted)}, inside your ${formatTemperatureValue(comfortLow)} - ${formatTemperatureValue(comfortHigh)} comfort band.`)
    }
  } else if (indoor !== null) {
    bullets.push(`Current indoor temperature is ${formatTemperatureValue(indoor)}, so the forecast is being compared against where the house is starting from.`)
  }

  if (forecastLow !== null || forecastHigh !== null) {
    const forecastRange = forecastLow !== null && forecastHigh !== null ? `${formatTemperatureValue(forecastLow)} - ${formatTemperatureValue(forecastHigh)}` : formatTemperatureValue(forecastLow ?? forecastHigh)
    bullets.push(`Today's forecast range is ${forecastRange}, which Predictive Comfort uses to estimate where the house is heading.`)
  }

  if (Array.isArray(activeHeatLoads) && activeHeatLoads.length > 0) {
    bullets.push(`${formatPredictiveEntityList(activeHeatLoads)} ${activeHeatLoads.length === 1 ? 'is' : 'are'} active, so the model is accounting for extra heat from configured devices.`)
  } else {
    bullets.push('No configured heat-load devices are active right now.')
  }

  if (adjustmentStatus === 'auto_adjust_disabled') bullets.push('Auto setpoint adjustments are off, so this is only a recommendation.')
  else if (adjustmentStatus === 'hvac_mode_changes_disabled') bullets.push('HVAC mode changes are off, so Predictive Comfort will not switch between heat and cool automatically.')
  else if (adjustmentStatus === 'skipped_away_mode') bullets.push('Away Mode is active and away adjustments are off, so Predictive Comfort will not change the thermostat.')
  else if (adjustmentStatus === 'rate_limited') bullets.push('Thermostat changes are paused briefly to avoid rapid repeated adjustments.')
  else if (adjustmentStatus === 'applied') bullets.push('Predictive Comfort has already applied the safe thermostat change.')

  return bullets.length > 0 ? bullets : ['Predictive Comfort is waiting for enough live sensor and forecast data to explain this recommendation.']
}

function PredictiveMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.predictiveMetric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function usePredictiveComfortData() {
  const sensor = useEntity(asEntityName(PREDICTIVE_COMFORT_SENSOR_ENTITY_ID), { returnNullIfNotFound: true })
  const switchEntity = useEntity(asEntityName(PREDICTIVE_COMFORT_SWITCH_ENTITY_ID), { returnNullIfNotFound: true })
  const currentRecommendation = predictiveAttribute(switchEntity, 'current_recommendation') ?? sensor?.state
  const comfortLow = predictiveAttribute(sensor, 'comfort_low')
  const comfortHigh = predictiveAttribute(sensor, 'comfort_high')
  const forecastHigh = predictiveAttribute(sensor, 'forecast_high')
  const forecastLow = predictiveAttribute(sensor, 'forecast_low')
  const forecastSummary = forecastHigh === undefined && forecastLow === undefined
    ? 'Unknown'
    : `${formatTemperatureValue(forecastLow)} - ${formatTemperatureValue(forecastHigh)}`
  const reasonBullets = buildPredictiveReasonBullets(sensor)

  return {
    comfortHigh,
    comfortLow,
    currentRecommendation,
    forecastSummary,
    reasonBullets,
    sensor,
  }
}

function PredictiveComfortModalContent() {
  const { comfortHigh, comfortLow, forecastSummary, reasonBullets, sensor } = usePredictiveComfortData()

  return (
    <div className={styles.thermostatModalBody}>
      <section className={styles.section}>
        <SectionHeader title="Controls" />
        <div className={styles.predictiveControlGrid}>
          <div className={styles.predictiveControlGroup}>
            <Description>Lets Predictive Comfort nudge the thermostat target before the house drifts out of range.</Description>
            <ThermostatSwitchCard entityId={PREDICTIVE_AUTO_ADJUST_SWITCH_ENTITY_ID} icon="mdi:thermostat-auto" title="Auto Setpoint Adjustments" />
          </div>
          <div className={styles.predictiveControlGroup}>
            <Description>Allows Predictive Comfort to switch between heat and cool when a proactive correction needs it.</Description>
            <ThermostatSwitchCard entityId={PREDICTIVE_HVAC_MODE_CHANGE_SWITCH_ENTITY_ID} icon="mdi:hvac" title="HVAC Mode Changes" />
          </div>
          <div className={styles.predictiveControlGroup}>
            <Description>Allows proactive thermostat changes while everyone is away; leave off to only act when someone is home.</Description>
            <ThermostatSwitchCard entityId={PREDICTIVE_ALLOW_AWAY_SWITCH_ENTITY_ID} icon="mdi:home-export-outline" title="Predictive Comfort While Away" />
          </div>
        </div>
      </section>
      <section className={styles.section}>
        <SectionHeader title="Current Prediction" />
        <div className={styles.predictiveMetricGrid}>
          <PredictiveMetric label="Indoor" value={formatTemperatureValue(predictiveAttribute(sensor, 'indoor_temperature'))} />
          <PredictiveMetric label="Predicted" value={formatTemperatureValue(predictiveAttribute(sensor, 'predicted_temperature'))} />
          <PredictiveMetric label="Comfort Band" value={`${formatTemperatureValue(comfortLow)} - ${formatTemperatureValue(comfortHigh)}`} />
          <PredictiveMetric label="Forecast" value={forecastSummary} />
          <PredictiveMetric label="Weather" value={String(predictiveAttribute(sensor, 'weather_entity') ?? 'Unknown')} />
          <PredictiveMetric label="Adjustment" value={formatPredictiveState(predictiveAttribute(sensor, 'adjustment_status'))} />
        </div>
        <div className={styles.predictiveReasonCard}>
          <strong>Why this prediction?</strong>
          <ul>
            {reasonBullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}

function PredictiveComfortModal({ onClose, open }: { onClose: () => void; open: boolean }) {
  const { currentRecommendation } = usePredictiveComfortData()

  return (
    <ModalSheet onClose={onClose} open={open} subtitle={formatPredictiveState(currentRecommendation)} surface="hass-popup" title="Predictive Comfort">
      <PredictiveComfortModalContent />
    </ModalSheet>
  )
}

function ThermostatCheckbox({ entityId, showState = true, title }: { entityId: string; showState?: boolean; title: string }) {
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true })
  const callService = useCallService()
  const [state, commitState] = useOptimisticState(entity?.state ?? 'unavailable')
  const active = state === 'on'

  const toggle = () => {
    commitState(active ? 'off' : 'on')
    callService({ domain: 'homeassistant', service: 'toggle', target: entityId })
  }

  return (
    <CheckboxRow
      active={active}
      aria-label={showState ? `${title} ${formatCompactEntityState(entity, 'Unavailable', state)}` : title}
      className={styles.thermostatCheckbox}
      onClick={toggle}
      subtitle={showState ? formatCompactEntityState(entity, 'Unavailable', state) : undefined}
      title={title}
    />
  )
}

function ThermostatTrackCheckbox({ room }: { room: ThermostatRoomView }) {
  return <ThermostatCheckbox entityId={thermostatTrackEntityId(room)} showState={false} title={room.title} />
}

function ThermostatForceCheckbox({ room }: { room: ThermostatRoomView }) {
  const trackEntity = useEntity(asEntityName(thermostatTrackEntityId(room)), { returnNullIfNotFound: true })
  if (trackEntity?.state === 'on') return null
  return <ThermostatCheckbox entityId={thermostatForceCriticalEntityId(room)} showState={false} title={room.title} />
}

function ThermostatTrackOnlyWhenOccupiedCheckbox({ room }: { room: ThermostatRoomView }) {
  return <ThermostatCheckbox entityId={thermostatTrackOnlyWhenOccupiedEntityId(room)} showState={false} title={room.title} />
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

function ThermostatTrackOnlyWhenOccupiedSection() {
  return (
    <section className={styles.section}>
      <SectionHeader title="Track Only When Occupied" />
      <Description className={styles.thermostatDescription}>{THERMOSTAT_SECTION_DESCRIPTIONS.trackOnlyWhenOccupied}</Description>
      <div className={styles.thermostatCheckboxGrid}>
        {THERMOSTAT_ROOM_VIEWS.map((room) => <ThermostatTrackOnlyWhenOccupiedCheckbox key={room.key} room={room} />)}
      </div>
    </section>
  )
}

function OpenContactSensorCard({ entityId, title }: { entityId: string; title: string }) {
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true })
  if (!entity || !isContactOpen(entity)) return null
  const icon = title.toLowerCase().includes('window') ? 'mdi:window-open' : 'mdi:door-open'
  const stateText = formatContactEntityState(entity)
  return <ThermostatGlassCard active ariaLabel={`${title} ${stateText}`} icon={icon} stateText={stateText} title={title} tone="contact" />
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

function useThermostatRoomAwayMode(climateEntityId: string) {
  const climateEntity = useEntity(asEntityName(climateEntityId), { returnNullIfNotFound: true })
  const awayMode = useEntity(asEntityName(THERMOSTAT_AWAY_MODE_ENTITY_ID), { returnNullIfNotFound: true })
  const roomAwayMode = climateEntity?.attributes.away_mode_active
  return typeof roomAwayMode === 'boolean' ? roomAwayMode : awayMode?.state === 'on'
}

function thermostatEffectiveAway(state: string, fallbackAwayMode: boolean) {
  return state === 'Away' || ((state === 'Unknown' || state === 'Unavailable') && fallbackAwayMode)
}

function ThermostatAwayModeDetails({ climateEntityId, label, useEffectiveMode = false }: { climateEntityId: string; label: string; useEffectiveMode?: boolean }) {
  const { reason, state } = useThermostatHomeAwayStatus()
  const vacationMode = useEntity(asEntityName(VACATION_MODE_ENTITY_ID), { returnNullIfNotFound: true })
  const entityAwayModeActive = useThermostatRoomAwayMode(climateEntityId)
  const awayModeActive = useEffectiveMode ? thermostatEffectiveAway(state, entityAwayModeActive) : entityAwayModeActive
  const showStatusNotice = state === 'Away' || state === 'Unknown' || state === 'Unavailable'
  const modeTitle = vacationMode?.state === 'on' ? 'Vacation Mode' : 'Away Mode'
  const statusNotice = state === 'Away' || awayModeActive
    ? `${modeTitle} Active. The room may be cooler or warmer than your heat/cool targets to save energy while away.`
    : `${state} Mode. ${reason}`

  if (!awayModeActive && !showStatusNotice) return null

  return (
    <section aria-label={`${label} ${modeTitle}`} className={styles.thermostatModalAway}>
      <Notice>{statusNotice}</Notice>
    </section>
  )
}

function ThermostatRoomModalContent({ room }: { room: ThermostatRoomView }) {
  const ventTitle = `${room.title} ${room.ventEntityIds.length > 1 ? 'Vents' : 'Vent'}`

  return (
    <div className={styles.thermostatModalBody}>
      <section aria-label={`${room.title} thermostat control`} className={`${styles.thermostatModalHero} ${styles.thermostatModalDialShell}`} data-thermostat-modal-dial-shell="true" style={THERMOSTAT_MODAL_DIAL_SHELL_STYLE}>
        <ThermostatDial entityId={room.climateEntityId} size="modal" title={room.title} />
      </section>
      <section aria-label={ventTitle} className={`${styles.section} ${styles.thermostatModalVents}`}>
        <SectionHeader title={ventTitle} />
        <Grid>
          {room.ventEntityIds.map((entityId, index) => <ClimateCard entityId={entityId} icon="vent" key={entityId} size="compact" title={room.ventEntityIds.length > 1 ? `Vent ${index + 1}` : 'Vent'} />)}
        </Grid>
      </section>
      <ThermostatAwayModeDetails climateEntityId={room.climateEntityId} label={room.title} />
    </div>
  )
}

function ThermostatRoomModal({ onClose, open, room }: { onClose: () => void; open: boolean; room: ThermostatRoomView | null }) {
  const title = room?.title ?? 'Thermostat'

  return (
    <ModalSheet contentStyle={THERMOSTAT_ROOM_MODAL_STYLE} onClose={onClose} open={open} surface="hass-popup" title={title}>
      {room && <ThermostatRoomModalContent room={room} />}
    </ModalSheet>
  )
}

function ThermostatPage({ preload = false, preloadHash, preloadHashes = [] }: { preload?: boolean; preloadHash?: string; preloadHashes?: string[] }) {
  const { closeHash, hash, openHash } = useHashModal({ disabled: preload })
  const selectedRoom = THERMOSTAT_ROOM_VIEWS.find((room) => room.hash === hash) ?? null
  const preloadRoom = preloadHash ? THERMOSTAT_ROOM_VIEWS.find((room) => room.hash === preloadHash) ?? null : null
  const preloadRooms = useMemo(() => preloadHashes.map((preloadTargetHash) => THERMOSTAT_ROOM_VIEWS.find((room) => room.hash === preloadTargetHash)).filter((room): room is ThermostatRoomView => Boolean(room)), [preloadHashes])
  const [renderedRoom, setRenderedRoom] = useState<ThermostatRoomView | null>(selectedRoom)
  const roomModalOpen = Boolean(selectedRoom)
  const modalRoom = selectedRoom ?? preloadRoom ?? renderedRoom

  const openThermostatRoom = (nextHash: string) => {
    const nextRoom = THERMOSTAT_ROOM_VIEWS.find((room) => room.hash === nextHash) ?? null
    if (nextRoom) setRenderedRoom(nextRoom)
    openHash(nextHash)
  }

  const closeThermostatRoom = () => {
    if (selectedRoom) setRenderedRoom(selectedRoom)
    closeHash()
  }

  return (
    <div className={`${styles.stack} ${styles.thermostatPage}`}>
      <section className={styles.section}>
        <SectionHeader title="Whole Home" />
        <WholeHomeThermostatDial />
        <ThermostatHubPill />
        <ThermostatAwayModeDetails climateEntityId={GLOBAL_THERMOSTAT_ENTITY_ID} label="Whole Home" useEffectiveMode />
      </section>
      <OpenContactSensorsSection />
      <section className={styles.section}>
        <SectionHeader title="Rooms" />
        <DynamicGrid ariaLabel="Thermostat rooms" className={styles.thermostatRoomGrid} columns={2} forceEquivalentColumnCount gap={8}>
          {THERMOSTAT_ROOM_VIEWS.map((room) => <ThermostatRoomRow key={room.key} onOpen={openThermostatRoom} room={room} />)}
        </DynamicGrid>
      </section>
      <section className={styles.section}>
        <SectionHeader title="Eco Mode" />
        <Description className={styles.thermostatDescription}>{THERMOSTAT_SECTION_DESCRIPTIONS.ecoMode}</Description>
        <ThermostatSwitchCard entityId="switch.thermostat_contact_sensors_eco_mode" icon="mdi:leaf" title="Eco Mode">
          <ThermostatSelectButton entityId="select.thermostat_contact_sensors_eco_mode_critical_tracking" icon="mdi:thermometer-alert" pickerSheetLayout="card-grid" pickerSheetStyle={THERMOSTAT_COMPACT_PICKER_MODAL_STYLE} title="Eco Mode Critical Tracking" />
          <ThermostatSelectButton entityId="select.thermostat_contact_sensors_eco_behavior_when_away" icon="mdi:leaf-circle" pickerSheetLayout="card-grid" pickerSheetStyle={THERMOSTAT_COMPACT_PICKER_MODAL_STYLE} title="Eco Behavior When Away" />
        </ThermostatSwitchCard>
      </section>
      <section className={styles.section}>
        <SectionHeader title="Predictive Comfort" />
        <Description className={styles.thermostatDescription}>{THERMOSTAT_SECTION_DESCRIPTIONS.predictiveComfort}</Description>
        <PredictiveComfortCard onOpen={() => openHash(PREDICTIVE_COMFORT_HASH)} />
      </section>
      <ThermostatTrackSection />
      <ThermostatTrackOnlyWhenOccupiedSection />
      <section className={styles.section}>
        <SectionHeader title="Automatic Thermostat" />
        <Description className={styles.thermostatDescription}>{THERMOSTAT_SECTION_DESCRIPTIONS.integration}</Description>
        <ThermostatSwitchCard entityId="input_boolean.enable_disable_thermostat_contact_sensors_integration" icon="mdi:thermostat" title="Automatic Thermostat" />
      </section>
      <PredictiveComfortModal onClose={closeHash} open={hash === PREDICTIVE_COMFORT_HASH} />
      <ThermostatRoomModal onClose={closeThermostatRoom} open={roomModalOpen} room={modalRoom} />
      {preloadHashes.includes(PREDICTIVE_COMFORT_HASH) && (
        <div data-preload-modal={`ecobee${PREDICTIVE_COMFORT_HASH}`}>
          <PredictiveComfortModalContent />
        </div>
      )}
      {preloadRooms.map((room) => (
        <div data-preload-modal={`ecobee${room.hash}`} key={`ecobee-preload-${room.hash}`}>
          <ThermostatRoomModalContent room={room} />
        </div>
      ))}
    </div>
  )
}

function ControlPage({ onNavigate, path }: { onNavigate: (path: string) => void; path: string }) {
  const config = CONTROL_PAGES[path]
  if (!config) return null
  return <EntitySections onNavigate={onNavigate} sections={config.sections} />
}

function EverShelfInventoryPage({ controls, path }: { controls: EverShelfInventoryControls; path: string }) {
  const config = EVERSHELF_INVENTORY_PAGES[path]
  if (!config) return null
  return <EverShelfInventoryPanel controls={controls} location={config.location} title={config.title} />
}

function FallbackPage({ title }: { title: string }) {
  return <Notice>{title} is not available in the React dashboard yet.</Notice>
}

function Content({ inventoryControls, onNavigate, onScrollLockChange, path, preload = false, preloadHash, preloadHashes, recipeControls }: { inventoryControls: EverShelfInventoryControls; onNavigate: (path: string) => void; onScrollLockChange?: (locked: boolean) => void; path: string; preload?: boolean; preloadHash?: string; preloadHashes?: string[]; recipeControls: RecipeControls }) {
  const roomTitle = dashboardRoomNameFromPath(path)
  if (roomTitle) return <RoomPage onNavigate={onNavigate} path={path} preload={preload} preloadHash={preloadHash} preloadHashes={preloadHashes} title={roomTitle} />
  const todoConfigPath = todoPageConfigPath(path)
  if (TODO_PAGES[todoConfigPath]) return <TodoPage configPath={todoConfigPath} onNavigate={onNavigate} onScrollLockChange={onScrollLockChange} path={path} />
  if (path === 'settings') return <SettingsPage onNavigate={onNavigate} />
  if (path === 'guests-staying-over') return <GuestControlsPage onNavigate={onNavigate} />
  if (path === 'vacation') return <VacationPage />
  if (path === 'vacuums') return <VacuumPage preload={preload} />
  if (path === 'media') return <MediaPage preload={preload} preloadHash={preloadHash} preloadHashes={preloadHashes} />
  if (path === 'admin') return <AdminPage onNavigate={onNavigate} preload={preload} preloadHash={preloadHash} preloadHashes={preloadHashes} />
  if (path === 'ecobee') return <ThermostatPage preload={preload} preloadHash={preloadHash} preloadHashes={preloadHashes} />
  if (path === 'custom-lights') return <CustomLightsPage />
  if (path === HOME_FOOD_ROUTE_PATH) return <FoodHubPage onNavigate={onNavigate} preload={preload} />
  if (path === HOME_RECIPES_ROUTE_PATH) return <RecipesPage controls={recipeControls} preload={preload} />
  if (EVERSHELF_INVENTORY_PAGES[path]) return <EverShelfInventoryPage controls={inventoryControls} path={path} />
  if (CONTROL_PAGES[path]) return <ControlPage onNavigate={onNavigate} path={path} />
  return <FallbackPage title={routeTitle(path)} />
}

export function DashboardViewPage({ activePath, initialContentTransitionState = 'idle', inventoryControls: providedInventoryControls, loadingPhase, onBack, onNavigate, path, preload = false, preloadHash, preloadHashes, recipeControls: providedRecipeControls, withShell = true }: DashboardViewPageProps) {
  const roomTitle = dashboardRoomNameFromPath(path)
  const todoConfig = TODO_PAGES[todoPageConfigPath(path)]
  const title = path === 'guests-staying-over' ? 'Guest Controls' : roomTitle ?? todoConfig?.title ?? CONTROL_PAGES[path]?.title ?? routeTitle(path)
  const backPath = fallbackBackPathForRoute(path)
  const [pageScrollLock, setPageScrollLock] = useState<{ locked: boolean; path: string }>({ locked: false, path })
  const pageScrollLocked = pageScrollLock.path === path && pageScrollLock.locked
  const fallbackInventoryControls = useEverShelfInventoryControls(path, !preload && Boolean(EVERSHELF_INVENTORY_PAGES[path]))
  const inventoryControls = providedInventoryControls ?? fallbackInventoryControls
  const fallbackRecipeControls = useRecipeControls(path, !preload && path === HOME_RECIPES_ROUTE_PATH)
  const recipeControls = providedRecipeControls ?? fallbackRecipeControls
  const handlePageScrollLockChange = useCallback((locked: boolean) => {
    setPageScrollLock((current) => (current.path === path && current.locked === locked ? current : { locked, path }))
  }, [path])

  const page = path === 'security' ? (
    <SecurityPage activePath={activePath} backPath={backPath} contentTransitionState={loadingPhase ? 'idle' : initialContentTransitionState} loadingPhase={loadingPhase} onBack={onBack} onNavigate={onNavigate} preload={preload} preloadHash={preloadHash} preloadHashes={preloadHashes} title={title} />
  ) : (
    <Page activePath={activePath} backPath={backPath} chromeHidden={Boolean(loadingPhase)} contentTransitionState={loadingPhase ? 'idle' : initialContentTransitionState} headerQuickLinks={roomTitle ? <RoomSectionRail path={path} title={roomTitle} /> : undefined} onBack={onBack} onNavigate={onNavigate} scrollLocked={pageScrollLocked} title={title}>
      {loadingPhase ? <DashboardPageLoading phase={loadingPhase} /> : <Content inventoryControls={inventoryControls} onNavigate={onNavigate} onScrollLockChange={handlePageScrollLockChange} path={path} preload={preload} preloadHash={preloadHash} preloadHashes={preloadHashes} recipeControls={recipeControls} />}
    </Page>
  )

  if (!withShell || preload) return page

  return (
    <AppShell bottomNav={<BottomNav activePath={activePath} onNavigate={onNavigate} />} chromeHidden={Boolean(loadingPhase)} floatingAction={!preload && hasDashboardFloatingAction(path) ? <DashboardFloatingAction inventoryControls={inventoryControls} onNavigate={onNavigate} path={path} recipeControls={recipeControls} /> : undefined}>
      {page}
    </AppShell>
  )
}
