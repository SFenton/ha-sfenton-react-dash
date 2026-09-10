import type { EntityBasicAction, EntityStateAction } from './portedDashboard'
import type { ControlSemanticsResolver } from '../components/core/controlSemantics'
import { BATHROOM_FANS } from './bathroomFans'
import { GARAGE_DOOR_ENTITY_IDS } from './garageDoors'
import { MASTER_BEDROOM_HUMIDIFIER } from './humidifiers'
import { MASTER_BEDROOM_WAKE_LIGHT } from './wakeLights'
import {
  MEDIA_REMOTE_CONFIGS,
  MUSIC_ROOM_ACTIVE_MEDIA_SOURCE_ENTITY_ID,
  MUSIC_ROOM_CONTROL_ENTITY_ID,
  MUSIC_ROOM_FORTNITE_ARTWORK_URL,
  MUSIC_ROOM_MEDIA_ACTIONS,
  MUSIC_ROOM_MEDIA_LIVE_CHANGE_OPTIMISTIC_ENTITY_IDS,
  MUSIC_ROOM_MEDIA_OPTIMISTIC_ENTITY_IDS,
  MUSIC_ROOM_MEDIA_SOURCE_STATES,
  MUSIC_ROOM_REMOTE_HASH,
  musicRoomSourceLabels,
  type MediaRemoteAction,
} from './mediaRemotes'
import { MEDIA_COPY_KEYS, MEDIA_COPY_NAMESPACE, copy } from '../i18n'

export type RoomSourceKind = 'air' | 'appliance' | 'climate' | 'contact' | 'fan' | 'grill' | 'humidifier' | 'laundry' | 'light' | 'media' | 'occupancy' | 'power' | 'vacuum' | 'vent' | 'wake-light'
type RoomSourceBaseAction = Exclude<EntityBasicAction, { type: 'navigate' }>
export type RoomSourceCardAction = RoomSourceBaseAction | EntityStateAction<RoomSourceBaseAction>

export interface RoomSourceCardConfig {
  action?: RoomSourceCardAction
  activeStates?: string[]
  alternate?: {
    entityId: string
    showState?: boolean
    subtitleEntityIds?: string[]
    whenEntityId: string
    whenStates: string[]
  }
  disabledStates?: string[]
  control?: 'bathroom-fan' | 'garage-door'
  entityId: string
  hash?: string
  icon: string
  imageBackground?: 'white'
  imageUrl?: string
  kind: RoomSourceKind
  modalEntityId?: string
  modalItems?: RoomSourceModalItem[]
  modalTitle?: string
  presentation?: 'app'
  presenceEntityId?: string
  semantics?: ControlSemanticsResolver
  showState?: boolean
  span?: 'full'
  stateColors?: Partial<Record<string, string>>
  stateDisplay?: 'climate-action-temperature'
  stateIcons?: Partial<Record<string, string>>
  stateLabels?: Partial<Record<string, string>>
  stateTone?: 'climate-action'
  subtitleEntityIds?: string[]
  title: string
}

export interface RoomSourceModalItem {
  entityId: string
  icon: string
  kind?: RoomSourceKind
  showState?: boolean
  title: string
}

// `app-launch` keeps square branded tiles in a responsive grid.
// `lead-row` renders the first card above the remaining controls.
// `two-column-fill` keeps a section at two responsive columns and consumes all of its available width.
export type RoomSourceSectionLayout = 'app-launch' | 'lead-row' | 'two-column-fill'

export interface RoomSourceSectionConfig {
  cards: RoomSourceCardConfig[]
  layout?: RoomSourceSectionLayout
  showOnRoomPage?: boolean
  span?: 'full'
  title: string
}

export interface RoomPageSourceConfig {
  overviewCards: RoomSourceCardConfig[]
  optimisticStateEntityIds?: readonly string[]
  optimisticLiveChangeEntityIds?: readonly string[]
  path: string
  popupTemplates: string[]
  sourceSections: RoomSourceSectionConfig[]
  title: string
}

function sourceActionFromMediaAction(action: MediaRemoteAction, serviceDataOverride?: Record<string, unknown>): RoomSourceCardAction | undefined {
  if (action.type === 'textPrompt') return undefined
  if (action.type === 'state') {
    const defaultAction = sourceActionFromMediaAction(action.defaultAction, serviceDataOverride)
    if (!defaultAction || defaultAction.type === 'state') return undefined
    return {
      type: 'state',
      entityId: action.entityId,
      cases: action.cases.flatMap((candidate) => {
        const resolvedAction = sourceActionFromMediaAction(candidate.action, serviceDataOverride)
        return resolvedAction && resolvedAction.type !== 'state'
          ? [{ action: resolvedAction, states: candidate.states }]
          : []
      }),
      defaultAction,
    }
  }
  return {
    type: 'service',
    domain: action.domain,
    service: action.service,
    target: action.target ?? null,
    serviceData: action.serviceData || serviceDataOverride ? { ...action.serviceData, ...serviceDataOverride } : undefined,
    optimisticResetState: action.optimisticResetState,
    optimisticState: action.optimisticState,
  }
}

function inputButtonPress(target: string): RoomSourceBaseAction {
  return { type: 'service', domain: 'input_button', service: 'press', target }
}

function scriptAction(service: string): RoomSourceBaseAction {
  return { type: 'service', domain: 'script', service, target: null }
}

function pcPowerAction(onTarget: string, offTarget: string): RoomSourceCardAction {
  return {
    type: 'state',
    cases: [{ states: ['on'], action: inputButtonPress(offTarget) }],
    defaultAction: inputButtonPress(onTarget),
  }
}

function mediaAppShortcuts(hash: string, entityId: string, serviceDataOverride?: Record<string, unknown>): RoomSourceCardConfig[] {
  return (MEDIA_REMOTE_CONFIGS[hash]?.appCards ?? []).map((app) => ({
    title: app.title,
    entityId,
    icon: app.icon ?? 'mdi:play-box',
    imageBackground: app.background,
    imageUrl: app.imageUrl,
    kind: 'media',
    presentation: 'app',
    action: sourceActionFromMediaAction(app.action, serviceDataOverride),
  }))
}

const livingRoomShieldAppShortcuts = mediaAppShortcuts('#living-room-shield', 'media_player.living_room_shield')
const theaterAppShortcuts = mediaAppShortcuts('#theater-room-shield', 'media_player.theater_room_shield', { remote_entity: 'remote.theater_shield_remote' })
const modalSemantics: ControlSemanticsResolver = () => ({ kind: 'modal' })
const commandSemantics: ControlSemanticsResolver = () => ({ kind: 'command' })
const musicRoomXboxSemantics: ControlSemanticsResolver = (state) => ({ kind: 'selection', selected: state === MUSIC_ROOM_MEDIA_SOURCE_STATES.xbox || state === MUSIC_ROOM_MEDIA_SOURCE_STATES.fortnite })
const musicRoomServerSemantics: ControlSemanticsResolver = (state) => ({ kind: 'selection', selected: state === MUSIC_ROOM_MEDIA_SOURCE_STATES.server })
const musicRoomFortniteSemantics: ControlSemanticsResolver = (state) => ({ kind: 'selection', selected: state === MUSIC_ROOM_MEDIA_SOURCE_STATES.fortnite })
const musicRoomTitle = copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.musicRoom.title)
const musicRoomRemoteTitle = copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.musicRoom.remote)
const musicRoomXboxTitle = copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.musicRoom.xbox)
const musicRoomServerTitle = copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.musicRoom.server)
const musicRoomFortniteTitle = copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.musicRoom.fortnite)

export const ROOM_PAGE_CONFIGS: Record<string, RoomPageSourceConfig> = {
  'living-room': {
    title: 'Living Room',
    path: 'living-room',
    overviewCards: [
      { title: 'Lights', entityId: 'light.living_room', icon: 'mdi:lightbulb-group', kind: 'light', hash: '#lights-living-room', showState: true },
      { title: 'Climate', entityId: 'input_text.living_room_climate_range', icon: 'mdi:thermometer', kind: 'climate', hash: '#climate-living-room', showState: true },
      { title: 'Occupancy', entityId: 'binary_sensor.living_room_occupancy_sensors', icon: 'mdi:motion-sensor', kind: 'occupancy', hash: '#living-room-occupancy', showState: true },
      { title: 'Window', entityId: 'binary_sensor.living_room_window_contact_sensor_contact', icon: 'mdi:window-closed', kind: 'contact', hash: '#window-living-room' },
      { title: 'Air Quality', entityId: 'sensor.living_room_air_purifier_pm2_5', icon: 'mdi:air-purifier', kind: 'air', hash: '#air-purifier', showState: true },
    ],
    sourceSections: [
      { title: 'Climate', cards: [
        { title: 'Vents', entityId: 'cover.living_room_vents', icon: 'mdi:air-filter', kind: 'vent', hash: '#vents', showState: true, modalItems: [{ title: 'Vent 1', entityId: 'cover.living_room_vent_1_vent', icon: 'mdi:air-filter' }, { title: 'Vent 2', entityId: 'cover.living_room_vent_2_vent', icon: 'mdi:air-filter' }] },
        { title: 'Air Purifier', entityId: 'select.living_room_air_purifier_fan_mode', icon: 'mdi:fan', kind: 'air', hash: '#air-purifier', modalEntityId: 'sensor.living_room_air_purifier_pm2_5', subtitleEntityIds: ['select.living_room_air_purifier_fan_mode', 'fan.living_room_air_purifier_levoit_purifier'] },
      ] },
      { title: 'Devices', cards: [{ title: 'Main Floor', modalTitle: 'Robot Vacuum', entityId: 'vacuum.valetudo_exaltedsneakydeer', icon: 'mdi:robot-vacuum', kind: 'vacuum', hash: '#robot-vacuum', span: 'full' }] },
      { title: 'Remote', cards: [{ title: copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.remoteOpeners.livingRoom), entityId: 'media_player.living_room_shield', icon: 'mdi:remote', kind: 'media', hash: '#living-room-shield', semantics: modalSemantics, showState: true }] },
      { title: 'Quick App Launch', layout: 'app-launch', cards: livingRoomShieldAppShortcuts },
    ],
    popupTemplates: ['light-slider-toggle', 'window-popup-single', 'air-purifier-popup', 'vent-popup-2', 'vacuum-*', 'media-player-popup'],
  },
  'guest-room': {
    title: 'Guest Room',
    path: 'guest-room',
    overviewCards: [
      { title: 'Lights', entityId: 'light.guest_room', icon: 'mdi:lightbulb-group', kind: 'light', hash: '#lights-guest-room', showState: true },
      { title: 'Climate', entityId: 'input_text.guest_room_climate_range', icon: 'mdi:thermometer', kind: 'climate', hash: '#climate-guest-room', showState: true },
      { title: 'Occupancy', entityId: 'binary_sensor.guest_room_occupancy_sensors', icon: 'mdi:motion-sensor', kind: 'occupancy', hash: '#guest-room-occupancy', showState: true },
      { title: 'Window', entityId: 'binary_sensor.guest_room_window_contact_sensor_contact', icon: 'mdi:window-closed', kind: 'contact', hash: '#window-guest-room' },
      { title: 'Air Quality', entityId: 'sensor.guest_room_air_purifier_pm2_5', icon: 'mdi:air-purifier', kind: 'air', hash: '#air-purifier', showState: true },
    ],
    sourceSections: [{ title: 'Climate', cards: [
      { title: 'Vent', entityId: 'cover.guest_room_vent_vent', icon: 'mdi:air-filter', kind: 'vent', hash: '#vents', showState: true, modalItems: [{ title: 'Vent', entityId: 'cover.guest_room_vent_vent', icon: 'mdi:air-filter' }] },
      { title: 'Air Purifier', entityId: 'select.guest_room_air_purifier_fan_mode', icon: 'mdi:fan', kind: 'air', hash: '#air-purifier', modalEntityId: 'sensor.guest_room_air_purifier_pm2_5', subtitleEntityIds: ['select.guest_room_air_purifier_fan_mode', 'fan.guest_room_air_purifier_levoit_purifier'] },
    ] }],
    popupTemplates: ['light-popup-2', 'window-popup-single', 'vent-popup-single', 'climate-popup-2', 'air-purifier-popup', 'occupancy-popup-2'],
  },
  'master-bedroom': {
    title: 'Master Bedroom',
    path: 'master-bedroom',
    overviewCards: [
      { title: 'Lights', entityId: 'light.master_bedroom', icon: 'mdi:lightbulb-group', kind: 'light', hash: '#lights-master-bedroom', showState: true },
      { title: 'Climate', entityId: 'input_text.master_bedroom_climate_range', icon: 'mdi:thermometer', kind: 'climate', hash: '#climate-master-bedroom', showState: true },
      { title: 'Occupancy', entityId: 'binary_sensor.master_bedroom_occupancy_sensors', icon: 'mdi:motion-sensor', kind: 'occupancy', hash: '#master-bedroom-occupancy', showState: true },
      { title: 'Window', entityId: 'binary_sensor.master_bedroom_street_window_contact_sensor_contact', icon: 'mdi:window-closed', kind: 'contact', hash: '#window-master-bedroom' },
      { title: 'Air Quality', entityId: 'sensor.master_bedroom_air_purifier_pm2_5', icon: 'mdi:air-purifier', kind: 'air', hash: '#air-purifier', showState: true },
    ],
    sourceSections: [
      { title: MASTER_BEDROOM_WAKE_LIGHT.roomSectionTitle, layout: 'two-column-fill', cards: [
        {
          title: MASTER_BEDROOM_WAKE_LIGHT.title,
          entityId: MASTER_BEDROOM_WAKE_LIGHT.statusEntityId,
          icon: 'mdi:weather-sunset-up',
          kind: 'wake-light',
          hash: MASTER_BEDROOM_WAKE_LIGHT.hash,
          semantics: modalSemantics,
          showState: true,
        },
      ] },
      { title: 'SleepyPod', layout: 'two-column-fill', cards: [
        { title: "Stephen's Bed", entityId: 'climate.sleepypod_eight_pod_left_side', icon: 'mdi:bed', kind: 'climate', hash: '#stephens-bed', showState: true, stateTone: 'climate-action' },
        { title: "Steph's Bed", entityId: 'climate.sleepypod_eight_pod_right_side', icon: 'mdi:bed', kind: 'climate', hash: '#stephs-bed', showState: true, stateTone: 'climate-action' },
      ] },
      { title: 'Media', cards: [{ title: 'Apple TV', entityId: 'media_player.master_bedroom_apple_tv', icon: 'mdi:apple', kind: 'media', hash: '#master-bedroom-apple-tv', showState: true, span: 'full', activeStates: ['idle', 'paused', 'playing'] }] },
      { title: 'Climate', cards: [
        { title: 'Vents', entityId: 'cover.master_bedroom_vents', icon: 'mdi:air-filter', kind: 'vent', hash: '#vents', showState: true, modalItems: [{ title: 'Vent 1', entityId: 'cover.master_bedroom_vent_2_vent', icon: 'mdi:air-filter' }, { title: 'Vent 2', entityId: 'cover.master_bedroom_vent_3_vent', icon: 'mdi:air-filter' }] },
        { title: 'Air Purifier', entityId: 'select.master_bedroom_air_purifier_fan_mode', icon: 'mdi:fan', kind: 'air', hash: '#air-purifier', modalEntityId: 'sensor.master_bedroom_air_purifier_pm2_5', subtitleEntityIds: ['select.master_bedroom_air_purifier_fan_mode', 'fan.master_bedroom_air_purifier_levoit_purifier'] },
        {
          title: 'Humidifier',
          entityId: MASTER_BEDROOM_HUMIDIFIER.powerEntityId,
          icon: 'mdi:air-humidifier',
          kind: 'humidifier',
          hash: '#humidifier-master-bedroom',
          showState: true,
          subtitleEntityIds: [MASTER_BEDROOM_HUMIDIFIER.powerEntityId, MASTER_BEDROOM_HUMIDIFIER.currentHumidityEntityId],
        },
      ] },
    ],
    popupTemplates: ['light-popup-6', 'window-popup-single', 'humidifier', 'vent-popup-2', 'climate-popup-4', 'air-purifier-popup', 'eight-sleep-popups', 'media-player-popup', 'occupancy-popup-4'],
  },
  gym: {
    title: 'Gym',
    path: 'gym',
    overviewCards: [
      { title: 'Light', entityId: 'light.gym_light', icon: 'mdi:lightbulb', kind: 'light', hash: '#lights-gym', showState: true },
      { title: 'Climate', entityId: 'input_text.gym_climate_range', icon: 'mdi:thermometer', kind: 'climate', hash: '#climate-gym', showState: true },
      { title: 'Occupancy', entityId: 'binary_sensor.gym_presence_sensor_presence', icon: 'mdi:motion-sensor', kind: 'occupancy', hash: '#gym-occupancy', showState: true },
      { title: 'Window', entityId: 'binary_sensor.gym_window_contact_sensor_contact', icon: 'mdi:window-closed', kind: 'contact', hash: '#window-gym' },
    ],
    sourceSections: [{ title: 'Climate', cards: [{ title: 'Vent', entityId: 'cover.gym_vent_vent', icon: 'mdi:air-filter', kind: 'vent', hash: '#vents', showState: true, modalItems: [{ title: 'Vent', entityId: 'cover.gym_vent_vent', icon: 'mdi:air-filter' }] }] }],
    popupTemplates: ['light-popup-single', 'window-popup-single', 'vent-popup-single', 'climate-popup-2', 'occupancy-popup-single'],
  },
  hallway: {
    title: 'Hallway',
    path: 'hallway',
    overviewCards: [
      { title: 'Lights', entityId: 'light.hallway_lights', icon: 'mdi:lightbulb-group', kind: 'light', hash: '#lights-hallway', showState: true },
      { title: 'Climate', entityId: 'input_text.hallway_climate_range', icon: 'mdi:thermometer', kind: 'climate', hash: '#climate-hallway', showState: true },
      { title: 'Occupancy', entityId: 'binary_sensor.hallway_occupancy_sensors', icon: 'mdi:motion-sensor', kind: 'occupancy', hash: '#hallway-occupancy', showState: true },
    ],
    sourceSections: [],
    popupTemplates: ['light-popup-4', 'climate-popup-3', 'occupancy-popup-3'],
  },
  office: {
    title: 'Office',
    path: 'office',
    overviewCards: [
      { title: 'Light', entityId: 'light.office_light', icon: 'mdi:lightbulb', kind: 'light', hash: '#lights-office', showState: true },
      { title: 'Climate', entityId: 'input_text.office_climate_range', icon: 'mdi:thermometer', kind: 'climate', hash: '#climate-office', showState: true },
      { title: 'Occupancy', entityId: 'binary_sensor.office_occupancy_sensors', icon: 'mdi:motion-sensor', kind: 'occupancy', hash: '#office-occupancy', showState: true },
      { title: 'Windows', entityId: 'binary_sensor.office_windows', icon: 'mdi:window-closed', kind: 'contact', hash: '#windows-office' },
      { title: 'Air Quality', entityId: 'sensor.office_air_purifier_pm2_5', icon: 'mdi:air-purifier', kind: 'air', hash: '#air-purifier', showState: true },
    ],
    sourceSections: [
      { title: 'Climate', cards: [
        { title: 'Vent', entityId: 'cover.office_vent_vent', icon: 'mdi:air-filter', kind: 'vent', hash: '#vents', showState: true, modalItems: [{ title: 'Vent', entityId: 'cover.office_vent_vent', icon: 'mdi:air-filter' }] },
        { title: 'Air Purifier', entityId: 'select.office_air_purifier_fan_mode', icon: 'mdi:fan', kind: 'air', hash: '#air-purifier', modalEntityId: 'sensor.office_air_purifier_pm2_5', subtitleEntityIds: ['select.office_air_purifier_fan_mode', 'fan.office_air_purifier_levoit_purifier'] },
      ] },
      { title: 'Office PCs', cards: [
        { title: "Stephen's PC", entityId: 'input_boolean.stephen_s_pc_power', icon: 'mdi:controller', kind: 'power', subtitleEntityIds: ['input_text.stephen_s_pc_power_state'], action: pcPowerAction('input_button.stephen_s_pc_on', 'input_button.stephen_s_pc_off') },
        { title: "Steph's PC", entityId: 'input_boolean.steph_s_pc_power', icon: 'mdi:controller', kind: 'power', subtitleEntityIds: ['input_text.steph_s_pc_power_state'], action: pcPowerAction('input_button.steph_s_pc_on', 'input_button.steph_s_pc_off') },
      ] },
    ],
    popupTemplates: ['light-popup-single', 'window-popup-2', 'vent-popup-single', 'climate-popup-3', 'air-purifier-popup', 'occupancy-popup-2'],
  },
  kitchen: {
    title: 'Kitchen',
    path: 'kitchen',
    overviewCards: [
      { title: 'Lights', entityId: 'light.kitchen', icon: 'mdi:lightbulb-group', kind: 'light', hash: '#lights-kitchen', showState: true },
      { title: 'Climate', entityId: 'input_text.kitchen_climate_range', icon: 'mdi:thermometer', kind: 'climate', hash: '#climate-kitchen', showState: true },
      { title: 'Occupancy', entityId: 'binary_sensor.kitchen_presence_sensor_presence', icon: 'mdi:motion-sensor', kind: 'occupancy', hash: '#kitchen-occupancy', showState: true },
      { title: 'Door', entityId: 'binary_sensor.kitchen_door_contact_sensor_contact', icon: 'mdi:door', kind: 'contact', hash: '#door-kitchen' },
    ],
    sourceSections: [
      { title: 'Appliances', cards: [
        { title: 'Dishwasher', entityId: 'select.dishwasher_selected_program', icon: 'mdi:dishwasher', kind: 'appliance', hash: '#dishwasher', span: 'full', subtitleEntityIds: ['sensor.dishwasher_door', 'select.dishwasher_selected_program'], alternate: { whenEntityId: 'sensor.dishwasher_operation_state', whenStates: ['run', 'pause'], entityId: 'sensor.dishwasher_program_progress', showState: true, subtitleEntityIds: ['select.dishwasher_selected_program', 'sensor.dishwasher_program_progress'] } },
      ] },
      { title: 'Climate', cards: [{ title: 'Vent', entityId: 'cover.kitchen_vent_vent', icon: 'mdi:air-filter', kind: 'vent', hash: '#vents', showState: true, modalItems: [{ title: 'Vent', entityId: 'cover.kitchen_vent_vent', icon: 'mdi:air-filter' }] }] },
    ],
    popupTemplates: ['light-popup-4', 'door-popup-single', 'vent-popup-single', 'climate-popup-1', 'occupancy-popup-single'],
  },
  'dining-room': {
    title: 'Dining Room',
    path: 'dining-room',
    overviewCards: [
      { title: 'Light', entityId: 'light.dining_room_dimmer_switch', icon: 'mdi:lightbulb', kind: 'light', hash: '#lights-dining-room', showState: true },
      { title: 'Climate', entityId: 'input_text.dining_room_climate_range', icon: 'mdi:thermometer', kind: 'climate', hash: '#climate-dining-room', showState: true },
      { title: 'Occupancy', entityId: 'binary_sensor.dining_room_presence_sensor_presence', icon: 'mdi:motion-sensor', kind: 'occupancy', hash: '#dining-room-occupancy', showState: true },
      { title: 'Door', entityId: 'binary_sensor.dining_room_door_contact_sensor_contact', icon: 'mdi:door', kind: 'contact', hash: '#door-dining-room' },
    ],
    sourceSections: [{ title: 'Climate', cards: [{ title: 'Vent', entityId: 'cover.dining_room_vent_vent', icon: 'mdi:air-filter', kind: 'vent', hash: '#vents', showState: true, modalItems: [{ title: 'Vent', entityId: 'cover.dining_room_vent_vent', icon: 'mdi:air-filter' }] }] }],
    popupTemplates: ['light-popup-single', 'door-popup-single', 'vent-popup-single', 'climate-popup-1', 'occupancy-popup-single'],
  },
  'back-deck': {
    title: 'Back Deck',
    path: 'back-deck',
    overviewCards: [
      { title: 'Lights', entityId: 'light.back_deck', icon: 'mdi:lightbulb-group', kind: 'light', hash: '#lights-back-deck', showState: true },
      { title: 'Occupancy', entityId: 'binary_sensor.upper_deck_camera_person_occupancy', icon: 'mdi:motion-sensor', kind: 'occupancy', showState: true },
      { title: 'Doors', entityId: 'binary_sensor.back_deck_doors', icon: 'mdi:door', kind: 'contact', hash: '#doors-back-deck', showState: true },
    ],
    sourceSections: [{ title: 'Grill', cards: [
      { title: 'Bear Grills', entityId: 'sensor.d8478fa2ad0a_grill_state', icon: 'mdi:grill', kind: 'grill', hash: '#bear-grills', showState: true, disabledStates: ['off', 'unavailable', 'unknown'], stateLabels: { off: 'Off', unavailable: 'Off', unknown: 'Off' } },
    ] }],
    popupTemplates: ['light-popup-2', 'door-popup-2', 'grill-popup'],
  },
  'music-room': {
    title: musicRoomTitle,
    path: 'music-room',
    optimisticStateEntityIds: MUSIC_ROOM_MEDIA_OPTIMISTIC_ENTITY_IDS,
    optimisticLiveChangeEntityIds: MUSIC_ROOM_MEDIA_LIVE_CHANGE_OPTIMISTIC_ENTITY_IDS,
    overviewCards: [
      { title: 'Lights', entityId: 'light.music_room', icon: 'mdi:lightbulb-group', kind: 'light', hash: '#lights-music-room', showState: true },
      { title: 'Climate', entityId: 'input_text.music_room_climate_range', icon: 'mdi:thermometer', kind: 'climate', hash: '#climate-music-room', showState: true },
      { title: 'Occupancy', entityId: 'binary_sensor.music_room_occupancy_sensors', icon: 'mdi:motion-sensor', kind: 'occupancy', hash: '#music-room-occupancy', showState: true },
      { title: 'Door', entityId: 'binary_sensor.music_room_door_contact_sensor_contact', icon: 'mdi:door', kind: 'contact', hash: '#door-music-room' },
      { title: 'Air Quality', entityId: 'sensor.air_purifier_pm2_5', icon: 'mdi:air-purifier', kind: 'air', hash: '#air-purifier', showState: true },
    ],
    sourceSections: [
      { title: 'Climate', cards: [
        { title: 'Vents', entityId: 'cover.music_room_vent_vent', icon: 'mdi:air-filter', kind: 'vent', hash: '#vents', showState: true, modalItems: [{ title: 'Vent', entityId: 'cover.music_room_vent_vent', icon: 'mdi:air-filter' }] },
        { title: 'Air Purifier', entityId: 'select.air_purifier_fan_mode', icon: 'mdi:fan', kind: 'air', hash: '#air-purifier', modalEntityId: 'sensor.air_purifier_pm2_5', subtitleEntityIds: ['select.air_purifier_fan_mode', 'fan.air_purifier_levoit_purifier'] },
      ] },
      {
        title: copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.musicRoom.remoteSection),
        layout: 'lead-row',
        cards: [
          { title: musicRoomRemoteTitle, entityId: MUSIC_ROOM_CONTROL_ENTITY_ID, icon: 'mdi:remote', kind: 'media', hash: MUSIC_ROOM_REMOTE_HASH, semantics: modalSemantics, showState: true },
          {
            title: musicRoomXboxTitle,
            entityId: MUSIC_ROOM_ACTIVE_MEDIA_SOURCE_ENTITY_ID,
            icon: 'mdi:microsoft-xbox',
            kind: 'media',
            showState: true,
            activeStates: [MUSIC_ROOM_MEDIA_SOURCE_STATES.xbox, MUSIC_ROOM_MEDIA_SOURCE_STATES.fortnite],
            stateLabels: musicRoomSourceLabels([MUSIC_ROOM_MEDIA_SOURCE_STATES.xbox, MUSIC_ROOM_MEDIA_SOURCE_STATES.fortnite]),
            semantics: musicRoomXboxSemantics,
            action: sourceActionFromMediaAction(MUSIC_ROOM_MEDIA_ACTIONS.xboxSourceToggle),
          },
          {
            title: musicRoomServerTitle,
            entityId: MUSIC_ROOM_ACTIVE_MEDIA_SOURCE_ENTITY_ID,
            icon: 'mdi:server',
            kind: 'media',
            showState: true,
            activeStates: [MUSIC_ROOM_MEDIA_SOURCE_STATES.server],
            stateLabels: musicRoomSourceLabels(MUSIC_ROOM_MEDIA_SOURCE_STATES.server),
            semantics: musicRoomServerSemantics,
            action: sourceActionFromMediaAction(MUSIC_ROOM_MEDIA_ACTIONS.serverToggle),
          },
        ],
      },
      {
        title: copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.musicRoom.quickAppLaunch),
        layout: 'app-launch',
        showOnRoomPage: false,
        cards: [{
          title: musicRoomFortniteTitle,
          entityId: MUSIC_ROOM_ACTIVE_MEDIA_SOURCE_ENTITY_ID,
          icon: 'mdi:gamepad-variant',
          imageUrl: MUSIC_ROOM_FORTNITE_ARTWORK_URL,
          kind: 'media',
          presentation: 'app',
          activeStates: [MUSIC_ROOM_MEDIA_SOURCE_STATES.fortnite],
          semantics: musicRoomFortniteSemantics,
          action: sourceActionFromMediaAction(MUSIC_ROOM_MEDIA_ACTIONS.fortnite),
        }],
      },
      { title: 'Devices', cards: [{ title: musicRoomTitle, modalTitle: 'Robot Vacuum', entityId: 'vacuum.valetudo_elatedusedram', icon: 'mdi:robot-vacuum', kind: 'vacuum', hash: '#robot-vacuum', span: 'full' }] },
    ],
    popupTemplates: ['light-popup-10', 'door-popup-single', 'vent-popup-single', 'climate-popup-3', 'air-purifier-popup', 'occupancy-popup-3', 'media-player-popup', 'vacuum-*'],
  },
  'theater-room': {
    title: 'Theater Room',
    path: 'theater-room',
    overviewCards: [
      { title: 'Lights', entityId: 'light.theater_room', icon: 'mdi:lightbulb-group', kind: 'light', hash: '#lights-theater-room', showState: true },
      { title: 'Climate', entityId: 'input_text.theater_room_climate_range', icon: 'mdi:thermometer', kind: 'climate', hash: '#climate-theater-room', showState: true },
      { title: 'Occupancy', entityId: 'binary_sensor.theater_room_presence_sensor_presence', icon: 'mdi:motion-sensor', kind: 'occupancy', hash: '#theater-room-occupancy', showState: true },
      { title: 'Door', entityId: 'binary_sensor.theater_room_door_contact_sensor_contact', icon: 'mdi:door', kind: 'contact', hash: '#door-theater-room' },
      { title: 'Air Quality', entityId: 'sensor.theater_room_air_purifier_pm2_5', icon: 'mdi:air-purifier', kind: 'air', hash: '#air-purifier', showState: true },
    ],
    sourceSections: [
      { title: 'Climate', cards: [
        { title: 'Vents', entityId: 'cover.theater_room_vents', icon: 'mdi:air-filter', kind: 'vent', hash: '#vents', showState: true, modalItems: [{ title: 'Vent 1', entityId: 'cover.theater_room_vent_1_vent', icon: 'mdi:air-filter' }, { title: 'Vent 2', entityId: 'cover.theater_room_vent_2_vent', icon: 'mdi:air-filter' }] },
        { title: 'Air Purifier', entityId: 'select.theater_room_air_purifier_fan_mode', icon: 'mdi:fan', kind: 'air', hash: '#air-purifier', modalEntityId: 'sensor.theater_room_air_purifier_pm2_5', subtitleEntityIds: ['select.theater_room_air_purifier_fan_mode', 'fan.theater_room_air_purifier_levoit_purifier'] },
      ] },
      { title: 'Remote', layout: 'lead-row', cards: [
        { title: copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.remoteOpeners.theaterRoom), entityId: 'media_player.sony_projector', icon: 'mdi:projector', kind: 'media', hash: '#theater-room-shield', semantics: modalSemantics, showState: true },
        { title: 'Nintendo Switch', entityId: 'input_boolean.is_nintendo_switch_active', icon: 'mdi:gamepad', kind: 'media', semantics: commandSemantics, showState: true, action: scriptAction('theater_room_nintendo_switch') },
        { title: 'Theater SHIELD', entityId: 'input_boolean.is_theater_shield_active', icon: 'mdi:television', kind: 'media', semantics: commandSemantics, showState: true, action: scriptAction('theater_room_tv_movie') },
      ] },
      { title: 'Quick App Launch', layout: 'app-launch', cards: theaterAppShortcuts },
      { title: 'Theater Room PCs', cards: [{ title: 'Theater Room PC', entityId: 'input_boolean.theater_pc_power', icon: 'mdi:projector', kind: 'power', subtitleEntityIds: ['input_text.theater_pc_power_state'], action: pcPowerAction('input_button.theater_pc_on', 'input_button.theater_pc_off') }] },
      { title: 'Devices', cards: [{ title: 'Theater Room', modalTitle: 'Robot Vacuum', entityId: 'vacuum.valetudo_politefatherlykingfisher', icon: 'mdi:robot-vacuum', kind: 'vacuum', hash: '#robot-vacuum', span: 'full' }] },
    ],
    popupTemplates: ['light-popup-6', 'door-popup-single', 'occupancy-popup-single', 'vent-popup-2', 'climate-popup-1', 'air-purifier-popup', 'media-player-popup', 'vacuum-*'],
  },
  'downstairs-hallway': {
    title: 'Downstairs Hallway',
    path: 'downstairs-hallway',
    overviewCards: [
      { title: 'Light', entityId: 'light.downstairs_hallway_light', icon: 'mdi:lightbulb', kind: 'light', hash: '#light-downstairs-hallway', showState: true },
      { title: 'Climate', entityId: 'input_text.downstairs_hallway_climate_range', icon: 'mdi:thermometer', kind: 'climate', hash: '#climate-downstairs-hallway', showState: true },
      { title: 'Occupancy', entityId: 'binary_sensor.downstairs_hallway_presence_sensor_presence', icon: 'mdi:motion-sensor', kind: 'occupancy', hash: '#downstairs-hallway-occupancy', showState: true },
      { title: 'Door', entityId: 'binary_sensor.garage_door_contact_sensor_contact', icon: 'mdi:door', kind: 'contact', hash: '#door-downstairs-hallway' },
    ],
    sourceSections: [],
    popupTemplates: ['light-popup-single', 'door-popup-single', 'occupancy-popup-single', 'climate-popup-1'],
  },
  garage: {
    title: 'Garage',
    path: 'garage',
    overviewCards: [
      { title: 'Doors', entityId: 'binary_sensor.garage_doors', icon: 'mdi:door', kind: 'contact', hash: '#doors-garage', showState: true },
    ],
    sourceSections: [
      { title: 'Appliances', cards: [
        { title: 'Washing Machine', entityId: 'input_boolean.washer_started_helper', icon: 'mdi:washing-machine', kind: 'laundry', showState: true },
        { title: 'Dryer', entityId: 'input_boolean.dryer_started_helper', icon: 'mdi:tumble-dryer', kind: 'laundry', showState: true },
      ] },
      { title: 'Garage Doors', cards: [
        { title: 'Left Door', entityId: GARAGE_DOOR_ENTITY_IDS.left, icon: 'mdi:garage', kind: 'contact', showState: true, control: 'garage-door' },
        { title: 'Right Door', entityId: GARAGE_DOOR_ENTITY_IDS.right, icon: 'mdi:garage', kind: 'contact', showState: true, control: 'garage-door' },
      ] },
    ],
    popupTemplates: ['door-popup-2'],
  },
  'guest-bathroom': {
    title: 'Guest Bathroom',
    path: 'guest-bathroom',
    overviewCards: [
      { title: 'Light', entityId: 'light.guest_bathroom_dimmer_switch', icon: 'mdi:lightbulb', kind: 'light', hash: '#lights-guest-bathroom', showState: true },
      { title: 'Climate', entityId: 'input_text.all_climate_range', icon: 'mdi:thermometer', kind: 'climate', hash: '#climate-overview', showState: true },
      { title: 'Occupancy', entityId: 'binary_sensor.guest_bathroom_occupancy_sensors', icon: 'mdi:motion-sensor', kind: 'occupancy', hash: '#guest-bathroom-occupancy', showState: true },
    ],
    sourceSections: [{ title: 'Climate', layout: 'lead-row', cards: [
      { title: 'Fan', entityId: BATHROOM_FANS.guest.powerEntityId, icon: 'mdi:fan', kind: 'fan', control: 'bathroom-fan', hash: BATHROOM_FANS.guest.hash, showState: true, span: 'full' },
      { title: 'Vent', entityId: 'cover.guest_bathroom_vent_vent', icon: 'mdi:air-filter', kind: 'vent', hash: '#vents', showState: true, modalItems: [{ title: 'Vent', entityId: 'cover.guest_bathroom_vent_vent', icon: 'mdi:air-filter' }] },
      { title: 'Towel Rack', entityId: 'switch.guest_bathroom_towel_rack_switch_top', icon: 'mdi:heat-wave', kind: 'light', showState: true, stateColors: { on: 'rgba(136, 64, 26, 0.6)' }, action: { type: 'toggle' } },
    ] }],
    popupTemplates: ['light-popup-single', 'climate-overview-popup', 'vent-popup-single', 'occupancy-popup-2', 'fan-switch'],
  },
  'master-bathroom': {
    title: 'Master Bathroom',
    path: 'master-bathroom',
    overviewCards: [
      { title: 'Light', entityId: 'light.master_bathroom_dimmer_switch', icon: 'mdi:lightbulb', kind: 'light', hash: '#lights-master-bathroom', showState: true },
      { title: 'Climate', entityId: 'input_text.all_climate_range', icon: 'mdi:thermometer', kind: 'climate', hash: '#climate-overview', showState: true },
      { title: 'Occupancy', entityId: 'binary_sensor.master_bathroom_presence_sensor_presence', icon: 'mdi:motion-sensor', kind: 'occupancy', hash: '#master-bathroom-occupancy', showState: true },
    ],
    sourceSections: [{ title: 'Climate', layout: 'lead-row', cards: [
      { title: 'Fan', entityId: BATHROOM_FANS.master.powerEntityId, icon: 'mdi:fan', kind: 'fan', control: 'bathroom-fan', hash: BATHROOM_FANS.master.hash, showState: true, span: 'full' },
      { title: 'Vent', entityId: 'cover.master_bathroom_vent_vent', icon: 'mdi:air-filter', kind: 'vent', hash: '#vents', showState: true, modalItems: [{ title: 'Vent', entityId: 'cover.master_bathroom_vent_vent', icon: 'mdi:air-filter' }] },
      { title: 'Towel Rack', entityId: 'switch.master_bathroom_towel_rack_switch_top', icon: 'mdi:heat-wave', kind: 'light', showState: true, stateColors: { on: 'rgba(136, 64, 26, 0.6)' }, action: { type: 'toggle' } },
    ] }],
    popupTemplates: ['light-popup-single', 'climate-popup-1', 'vent-popup-single', 'fan-switch', 'occupancy-popup-single'],
  },
  entryway: {
    title: 'Entryway',
    path: 'entryway',
    overviewCards: [
      { title: 'Light', entityId: 'switch.upper_entryway_light_switch_top', icon: 'mdi:lightbulb', kind: 'light', hash: '#lights-entryway', showState: true },
      { title: 'Occupancy', entityId: 'binary_sensor.entryway_presence_sensors', icon: 'mdi:motion-sensor', kind: 'occupancy', hash: '#entryway-occupancy', showState: true },
      { title: 'Climate', entityId: 'input_text.front_door_climate_range', icon: 'mdi:thermometer', kind: 'climate', hash: '#climate-overview', showState: true },
      { title: 'Door', entityId: 'binary_sensor.front_door_contact_sensor_contact', icon: 'mdi:door', kind: 'contact', hash: '#door-entryway' },
    ],
    sourceSections: [],
    popupTemplates: ['entryway-light-popup', 'climate-popup-1', 'door-popup-single', 'occupancy-popup-2'],
  },
}

export const ROOM_PAGE_ORDER = Object.keys(ROOM_PAGE_CONFIGS)