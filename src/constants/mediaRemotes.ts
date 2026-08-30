import type { ControlSemanticsResolver } from '../components/core/controlSemantics'
import { MEDIA_COPY_KEYS, MEDIA_COPY_NAMESPACE, copy } from '../i18n'
import type { OptimisticActionMetadata, OptimisticStateIntent } from './actionIntents'

type MediaRemoteServiceAction = {
  type: 'service'
  domain: string
  service: string
  target?: string
  serviceData?: Record<string, unknown>
} & OptimisticActionMetadata

export type MediaRemoteAction =
  | MediaRemoteServiceAction
  | { type: 'textPrompt'; targetEntityId: string }
  | { type: 'state'; cases: Array<{ action: Exclude<MediaRemoteAction, { type: 'state' }>; states: string[] }>; defaultAction: Exclude<MediaRemoteAction, { type: 'state' }>; entityId?: string }

export interface MediaRemoteIconColorRule {
  activeColor: string
  entityIds: string[]
  inactiveColor: string
  inactiveStates: string[]
  inactiveStatesByEntity?: Record<string, string[]>
}

export interface MediaRemoteButtonConfig {
  action: MediaRemoteAction
  icon: string
  iconColorRule?: MediaRemoteIconColorRule
  iconRotationDegrees?: number
  label: string
  semantics?: ControlSemanticsResolver
}

export interface MediaRemoteAppConfig {
  action: MediaRemoteAction
  activeStates?: readonly string[]
  background?: 'white'
  icon?: string
  imageUrl?: string
  semantics?: ControlSemanticsResolver
  stateEntityId?: string
  title: string
}

export interface MediaRemoteDeviceConfig {
  action?: MediaRemoteAction
  activeStates?: readonly string[]
  entityId: string
  icon: string
  semantics?: ControlSemanticsResolver
  stateLabels?: Partial<Record<string, string>>
  title: string
}

export interface MediaRemoteConfig {
  appCards?: MediaRemoteAppConfig[]
  appSectionTitle?: string
  backButton: MediaRemoteButtonConfig
  controlEntityId: string
  devices?: MediaRemoteDeviceConfig[]
  downButton: MediaRemoteButtonConfig
  hash: string
  hideKeyboardWhenOff?: boolean
  homeButton: MediaRemoteButtonConfig
  keyboardButton?: MediaRemoteButtonConfig
  leftButton: MediaRemoteButtonConfig
  mediaEntityId: string
  optimisticStateEntityIds?: readonly string[]
  pauseButton: MediaRemoteButtonConfig
  playButton: MediaRemoteButtonConfig
  powerButton: MediaRemoteButtonConfig
  remoteTitle: string
  rightButton: MediaRemoteButtonConfig
  roomTitle: string
  selectButton: MediaRemoteButtonConfig
  showVolumeWhenOff?: boolean
  title: string
  upButton: MediaRemoteButtonConfig
  volumeDownButton: MediaRemoteButtonConfig
  volumeEntityId: string
  volumeMuteButton: MediaRemoteButtonConfig
  volumeTitle: string
  volumeUpButton: MediaRemoteButtonConfig
}

function service(
  domain: string,
  serviceName: string,
  target?: string,
  serviceData?: Record<string, unknown>,
  optimisticState?: readonly OptimisticStateIntent[],
  optimisticResetState?: OptimisticActionMetadata['optimisticResetState'],
): MediaRemoteServiceAction {
  return { type: 'service', domain, service: serviceName, target, serviceData, optimisticResetState, optimisticState }
}

function inputButtonPress(target: string): Exclude<MediaRemoteAction, { type: 'state' }> {
  return { type: 'service', domain: 'input_button', service: 'press', target }
}

function pcPowerAction(onTarget: string, offTarget: string): MediaRemoteAction {
  return {
    type: 'state',
    cases: [{ states: ['on'], action: inputButtonPress(offTarget) }],
    defaultAction: inputButtonPress(onTarget),
  }
}

function remoteCommand(remoteEntityId: string, command: string): MediaRemoteAction {
  return service('remote', 'send_command', remoteEntityId, { command })
}

function appleTvCommand(command: string): MediaRemoteAction {
  return service('script', 'apple_tv_remote_send_command', undefined, { remote_entity: 'remote.master_bedroom_apple_tv', command })
}

function androidAppLauncher(entity: string, remoteEntity: string, appId: string, extraServiceData: Record<string, unknown> = {}): MediaRemoteAction {
  return service('script', 'launch_app_on_media_player', undefined, { entity, remote_entity: remoteEntity, app_id: appId, ...extraServiceData })
}

function appleTvAppLauncher(appName: string): MediaRemoteAction {
  return service('script', 'launch_app_on_apple_tv', undefined, { entity: 'media_player.master_bedroom_apple_tv', app_name: appName, remote_entity: 'remote.master_bedroom_apple_tv' })
}

function powerIconColorRule(entityIds: string[], inactiveStates: string[], inactiveStatesByEntity?: Record<string, string[]>): MediaRemoteIconColorRule {
  return { activeColor: 'red', entityIds, inactiveColor: 'green', inactiveStates, inactiveStatesByEntity }
}

const livingRoomRemote = 'remote.living_room_shield'
const livingRoomLaunchEntity = 'media_player.living_room_shield'
const livingRoomShield = 'media_player.living_room_shield_2'
const theaterRemote = 'remote.theater_shield_remote'
const theaterLaunchRemote = theaterRemote
const theaterShield = 'media_player.theater_room_shield'
const theaterProjector = 'media_player.sony_projector'
const theaterReceiver = 'media_player.theater'
export const MUSIC_ROOM_REMOTE_HASH = '#music-room-remote'
export const MUSIC_ROOM_CONTROL_ENTITY_ID = 'media_player.music_room_tv_android'
export const MUSIC_ROOM_XBOX_ENTITY_ID = 'media_player.xbox'
export const MUSIC_ROOM_REMOTE_ENTITY_ID = 'remote.music_room_tv_android'
export const MUSIC_ROOM_VOLUME_ENTITY_ID = 'media_player.beam'
export const MUSIC_ROOM_MEDIA_SOURCE_ENTITY_ID = 'input_select.music_room_media_source'
export const MUSIC_ROOM_MEDIA_SOURCE_STATES = {
  fortnite: 'Fortnite',
  off: 'Off',
  server: 'Server',
  tv: 'TV',
  xbox: 'Xbox',
} as const

export const MUSIC_ROOM_COMMAND_REVERT_MS = {
  fortnite: 120_000,
  server: 20_000,
  tv: 20_000,
  xbox: 90_000,
} as const

export const MUSIC_ROOM_XBOX_ACTIVE_STATES = ['on', 'playing', 'paused'] as const
export const MUSIC_ROOM_MEDIA_OPTIMISTIC_ENTITY_IDS = [
  MUSIC_ROOM_MEDIA_SOURCE_ENTITY_ID,
  MUSIC_ROOM_CONTROL_ENTITY_ID,
  MUSIC_ROOM_XBOX_ENTITY_ID,
] as const

function optimisticIntent(entityId: string, value: string, revertMs: number): OptimisticStateIntent {
  return { entityId, revertMs, value }
}

const musicRoomTvOnAction = service('script', 'music_room_tv', undefined, undefined, [
  optimisticIntent(MUSIC_ROOM_CONTROL_ENTITY_ID, 'on', MUSIC_ROOM_COMMAND_REVERT_MS.tv),
  optimisticIntent(MUSIC_ROOM_MEDIA_SOURCE_ENTITY_ID, MUSIC_ROOM_MEDIA_SOURCE_STATES.tv, MUSIC_ROOM_COMMAND_REVERT_MS.tv),
])
const musicRoomTvOffAction = service('script', 'music_room_tv_off', undefined, undefined, [
  optimisticIntent(MUSIC_ROOM_CONTROL_ENTITY_ID, 'off', MUSIC_ROOM_COMMAND_REVERT_MS.tv),
  optimisticIntent(MUSIC_ROOM_MEDIA_SOURCE_ENTITY_ID, MUSIC_ROOM_MEDIA_SOURCE_STATES.off, MUSIC_ROOM_COMMAND_REVERT_MS.tv),
])
const musicRoomXboxOnAction = service('script', 'music_room_xbox', undefined, undefined, [
  optimisticIntent(MUSIC_ROOM_XBOX_ENTITY_ID, 'on', MUSIC_ROOM_COMMAND_REVERT_MS.xbox),
  optimisticIntent(MUSIC_ROOM_CONTROL_ENTITY_ID, 'on', MUSIC_ROOM_COMMAND_REVERT_MS.xbox),
  optimisticIntent(MUSIC_ROOM_MEDIA_SOURCE_ENTITY_ID, MUSIC_ROOM_MEDIA_SOURCE_STATES.xbox, MUSIC_ROOM_COMMAND_REVERT_MS.xbox),
])
const musicRoomXboxOffAction = service(
  'script',
  'music_room_xbox_off',
  undefined,
  undefined,
  [optimisticIntent(MUSIC_ROOM_XBOX_ENTITY_ID, 'off', MUSIC_ROOM_COMMAND_REVERT_MS.xbox)],
  [{
    entityId: MUSIC_ROOM_MEDIA_SOURCE_ENTITY_ID,
    values: [MUSIC_ROOM_MEDIA_SOURCE_STATES.xbox, MUSIC_ROOM_MEDIA_SOURCE_STATES.fortnite],
  }],
)

export const MUSIC_ROOM_MEDIA_ACTIONS = {
  fortnite: service('script', 'music_room_fortnite', undefined, undefined, [
    optimisticIntent(MUSIC_ROOM_XBOX_ENTITY_ID, 'on', MUSIC_ROOM_COMMAND_REVERT_MS.fortnite),
    optimisticIntent(MUSIC_ROOM_CONTROL_ENTITY_ID, 'on', MUSIC_ROOM_COMMAND_REVERT_MS.fortnite),
    optimisticIntent(MUSIC_ROOM_MEDIA_SOURCE_ENTITY_ID, MUSIC_ROOM_MEDIA_SOURCE_STATES.fortnite, MUSIC_ROOM_COMMAND_REVERT_MS.fortnite),
  ]),
  server: service('script', 'music_room_server', undefined, undefined, [
    optimisticIntent(MUSIC_ROOM_CONTROL_ENTITY_ID, 'on', MUSIC_ROOM_COMMAND_REVERT_MS.server),
    optimisticIntent(MUSIC_ROOM_MEDIA_SOURCE_ENTITY_ID, MUSIC_ROOM_MEDIA_SOURCE_STATES.server, MUSIC_ROOM_COMMAND_REVERT_MS.server),
  ]),
  tvToggle: {
    type: 'state',
    entityId: MUSIC_ROOM_CONTROL_ENTITY_ID,
    cases: [{ states: ['off', 'unavailable', 'unknown'], action: musicRoomTvOnAction }],
    defaultAction: musicRoomTvOffAction,
  },
  xboxSource: musicRoomXboxOnAction,
  xboxToggle: {
    type: 'state',
    entityId: MUSIC_ROOM_XBOX_ENTITY_ID,
    cases: [{ states: [...MUSIC_ROOM_XBOX_ACTIVE_STATES], action: musicRoomXboxOffAction }],
    defaultAction: musicRoomXboxOnAction,
  },
} satisfies Record<'fortnite' | 'server' | 'tvToggle' | 'xboxSource' | 'xboxToggle', MediaRemoteAction>

const musicRoomPowerAction = MUSIC_ROOM_MEDIA_ACTIONS.tvToggle

function musicRoomPowerSemantics(state: string | undefined) {
  return { kind: 'toggle', checked: Boolean(state && !['off', 'unavailable', 'unknown'].includes(state)) } as const
}

const musicRoomXboxPowerSemantics: ControlSemanticsResolver = (state) => ({
  kind: 'toggle',
  checked: MUSIC_ROOM_XBOX_ACTIVE_STATES.some((activeState) => activeState === state),
})
const musicRoomFortniteSemantics: ControlSemanticsResolver = (state) => ({
  kind: 'selection',
  selected: state === MUSIC_ROOM_MEDIA_SOURCE_STATES.fortnite,
})
const musicRoomServerSemantics: ControlSemanticsResolver = (state) => ({
  kind: 'selection',
  selected: state === MUSIC_ROOM_MEDIA_SOURCE_STATES.server,
})

const stateSemantics: ControlSemanticsResolver = () => ({ kind: 'state' })

export function musicRoomSourceLabels(activeState: string) {
  return Object.fromEntries(
    Object.values(MUSIC_ROOM_MEDIA_SOURCE_STATES).map((state) => [
      state,
      copy('common', state === activeState ? 'states.on' : 'states.off'),
    ]),
  )
}

const androidApps = [
  { title: 'Plex', appId: 'com.plexapp.android', imageUrl: '/local/images/apps/plex.png' },
  { title: 'YouTube', appId: 'com.google.android.youtube.tv', imageUrl: '/local/images/apps/youtube.png', background: 'white' as const },
  { title: 'Netflix', appId: 'com.netflix.ninja', imageUrl: '/local/images/apps/netflix.png' },
  { title: 'Prime Video', appId: 'com.amazon.amazonvideo.livingroom', imageUrl: '/local/images/apps/prime.jpeg' },
  { title: 'Paramount+', appId: 'com.cbs.ott', imageUrl: '/local/images/apps/paramount.png' },
  { title: 'Disney+', appId: 'com.disney.disneyplus', imageUrl: '/local/images/apps/disney.png' },
]

function androidAppCards(entity: string, remoteEntity: string, extraServiceData?: Record<string, unknown>): MediaRemoteAppConfig[] {
  return androidApps.map((app) => ({
    action: androidAppLauncher(entity, remoteEntity, app.appId, extraServiceData),
    background: app.background,
    imageUrl: app.imageUrl,
    title: app.title,
  }))
}

export const MEDIA_REMOTE_CONFIGS: Record<string, MediaRemoteConfig> = {
  '#living-room-shield': {
    hash: '#living-room-shield',
    title: 'Living Room SHIELD',
    roomTitle: 'Living Room',
    remoteTitle: 'Living Room SHIELD Remote',
    mediaEntityId: livingRoomShield,
    controlEntityId: livingRoomShield,
    appSectionTitle: 'Media',
    appCards: androidAppCards(livingRoomLaunchEntity, livingRoomRemote),
    volumeTitle: 'Sonos Volume',
    volumeEntityId: 'media_player.sonos',
    powerButton: { label: 'Power', icon: 'mdi:power', iconColorRule: powerIconColorRule([livingRoomShield], ['off', 'unavailable', 'unknown']), action: remoteCommand(livingRoomRemote, 'POWER') },
    upButton: { label: 'Up', icon: 'mdi:chevron-up', action: remoteCommand(livingRoomRemote, 'DPAD_UP') },
    leftButton: { label: 'Left', icon: 'mdi:chevron-left', action: remoteCommand(livingRoomRemote, 'DPAD_LEFT') },
    selectButton: { label: 'Select', icon: ' ', action: remoteCommand(livingRoomRemote, 'DPAD_CENTER') },
    rightButton: { label: 'Right', icon: 'mdi:chevron-right', action: remoteCommand(livingRoomRemote, 'DPAD_RIGHT') },
    downButton: { label: 'Down', icon: 'mdi:chevron-down', action: remoteCommand(livingRoomRemote, 'DPAD_DOWN') },
    backButton: { label: 'Back', icon: 'mdi:triangle-down', iconRotationDegrees: 90, action: remoteCommand(livingRoomRemote, 'BACK') },
    homeButton: { label: 'Home', icon: 'mdi:circle', action: remoteCommand(livingRoomRemote, 'HOME') },
    keyboardButton: { label: 'Keyboard', icon: 'mdi:keyboard', action: { type: 'textPrompt', targetEntityId: livingRoomShield } },
    volumeDownButton: { label: 'Volume Down', icon: 'mdi:volume-minus', action: service('media_player', 'volume_down', 'media_player.sonos') },
    volumeMuteButton: { label: 'Mute', icon: 'mdi:volume-mute', action: service('script', 'toggle_sonos_mute', undefined, { sonosdevice: ['media_player.sonos'] }) },
    volumeUpButton: { label: 'Volume Up', icon: 'mdi:volume-plus', action: service('media_player', 'volume_up', 'media_player.sonos') },
    pauseButton: { label: 'Pause', icon: 'mdi:pause', action: remoteCommand(livingRoomRemote, 'MEDIA_PAUSE') },
    playButton: { label: 'Play', icon: 'mdi:play', action: remoteCommand(livingRoomRemote, 'MEDIA_PLAY') },
  },
  '#master-bedroom-apple-tv': {
    hash: '#master-bedroom-apple-tv',
    title: 'Apple TV',
    roomTitle: 'Master Bedroom',
    remoteTitle: 'Apple TV Remote',
    mediaEntityId: 'media_player.master_bedroom_apple_tv',
    controlEntityId: 'media_player.master_bedroom_apple_tv',
    appSectionTitle: 'Media',
    appCards: [{ title: 'Plex', imageUrl: '/local/images/apps/plex.png', action: appleTvAppLauncher('Plex') }],
    volumeTitle: 'Volume',
    volumeEntityId: 'media_player.primary_bedroom',
    powerButton: { label: 'Power', icon: 'mdi:power', iconColorRule: powerIconColorRule(['media_player.master_bedroom_apple_tv'], ['off', 'standby', 'unavailable']), action: service('script', 'apple_tv_power_on_off') },
    upButton: { label: 'Up', icon: 'mdi:chevron-up', action: appleTvCommand('up') },
    leftButton: { label: 'Left', icon: 'mdi:chevron-left', action: appleTvCommand('left') },
    selectButton: { label: 'Select', icon: 'mdi:circle', action: appleTvCommand('select') },
    rightButton: { label: 'Right', icon: 'mdi:chevron-right', action: appleTvCommand('right') },
    downButton: { label: 'Down', icon: 'mdi:chevron-down', action: appleTvCommand('down') },
    backButton: { label: 'Menu', icon: 'mdi:chevron-left', action: appleTvCommand('menu') },
    homeButton: { label: 'Home', icon: 'mdi:home', action: appleTvCommand('home') },
    volumeDownButton: { label: 'Volume Down', icon: 'mdi:volume-minus', action: service('media_player', 'volume_down', 'media_player.primary_bedroom') },
    volumeMuteButton: { label: 'Mute', icon: 'mdi:volume-mute', action: service('script', 'toggle_sonos_mute', undefined, { sonosdevice: ['media_player.primary_bedroom'] }) },
    volumeUpButton: { label: 'Volume Up', icon: 'mdi:volume-plus', action: service('media_player', 'volume_up', 'media_player.primary_bedroom') },
    pauseButton: { label: 'Pause', icon: 'mdi:pause', action: appleTvCommand('pause') },
    playButton: { label: 'Play', icon: 'mdi:play', action: appleTvCommand('play') },
  },
  '#theater-room-shield': {
    hash: '#theater-room-shield',
    title: 'Theater Room SHIELD',
    roomTitle: 'Theater Room',
    remoteTitle: 'Theater Room SHIELD Remote',
    mediaEntityId: theaterShield,
    controlEntityId: theaterShield,
    appSectionTitle: 'Media',
    appCards: androidAppCards(theaterShield, theaterLaunchRemote, { turn_on_projector: true }),
    volumeTitle: 'Yamaha Volume',
    volumeEntityId: theaterReceiver,
    showVolumeWhenOff: true,
    powerButton: {
      label: 'Power',
      icon: 'mdi:power',
      iconColorRule: powerIconColorRule([theaterShield], ['off', 'unavailable', 'unknown']),
      action: service('script', 'toggle_on_off_theater_room'),
    },
    upButton: { label: 'Up', icon: 'mdi:chevron-up', action: remoteCommand(theaterRemote, 'DPAD_UP') },
    leftButton: { label: 'Left', icon: 'mdi:chevron-left', action: remoteCommand(theaterRemote, 'DPAD_LEFT') },
    selectButton: { label: 'Select', icon: ' ', action: remoteCommand(theaterRemote, 'DPAD_CENTER') },
    rightButton: { label: 'Right', icon: 'mdi:chevron-right', action: remoteCommand(theaterRemote, 'DPAD_RIGHT') },
    downButton: { label: 'Down', icon: 'mdi:chevron-down', action: remoteCommand(theaterRemote, 'DPAD_DOWN') },
    backButton: { label: 'Back', icon: 'mdi:triangle-down', iconRotationDegrees: 90, action: remoteCommand(theaterRemote, 'BACK') },
    homeButton: { label: 'Home', icon: 'mdi:circle', action: remoteCommand(theaterRemote, 'HOME') },
    keyboardButton: { label: 'Keyboard', icon: 'mdi:keyboard', action: { type: 'textPrompt', targetEntityId: theaterShield } },
    volumeDownButton: { label: 'Volume Down', icon: 'mdi:volume-minus', action: service('media_player', 'volume_down', theaterReceiver) },
    volumeMuteButton: { label: 'Mute', icon: 'mdi:volume-mute', action: service('media_player', 'volume_mute', theaterReceiver, { is_volume_muted: true }) },
    volumeUpButton: { label: 'Volume Up', icon: 'mdi:volume-plus', action: service('media_player', 'volume_up', theaterReceiver) },
    pauseButton: { label: 'Pause', icon: 'mdi:pause', action: remoteCommand(theaterRemote, 'MEDIA_PAUSE') },
    playButton: { label: 'Play', icon: 'mdi:play', action: remoteCommand(theaterRemote, 'MEDIA_PLAY') },
    devices: [
      { title: 'Projector', entityId: theaterProjector, icon: 'mdi:projector', action: service('media_player', 'toggle', theaterProjector) },
      { title: 'Yamaha AVR', entityId: theaterReceiver, icon: 'mdi:audio-video', action: service('media_player', 'toggle', theaterReceiver) },
      { title: 'Theater Room SHIELD', entityId: theaterShield, icon: 'mdi:remote-tv', action: service('media_player', 'toggle', theaterShield) },
      { title: 'Theater Room PC', entityId: 'input_boolean.theater_pc_power', icon: 'mdi:projector', action: pcPowerAction('input_button.theater_pc_on', 'input_button.theater_pc_off') },
    ],
  },
  [MUSIC_ROOM_REMOTE_HASH]: {
    hash: MUSIC_ROOM_REMOTE_HASH,
    title: copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.musicRoom.remote),
    roomTitle: copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.musicRoom.title),
    remoteTitle: copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.musicRoom.remote),
    mediaEntityId: MUSIC_ROOM_CONTROL_ENTITY_ID,
    controlEntityId: MUSIC_ROOM_CONTROL_ENTITY_ID,
    optimisticStateEntityIds: MUSIC_ROOM_MEDIA_OPTIMISTIC_ENTITY_IDS,
    appSectionTitle: copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.musicRoom.quickAppLaunch),
    appCards: [{
      title: copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.musicRoom.fortnite),
      icon: 'mdi:gamepad-variant',
      stateEntityId: MUSIC_ROOM_MEDIA_SOURCE_ENTITY_ID,
      activeStates: [MUSIC_ROOM_MEDIA_SOURCE_STATES.fortnite],
      semantics: musicRoomFortniteSemantics,
      action: MUSIC_ROOM_MEDIA_ACTIONS.fortnite,
    }],
    volumeTitle: copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.musicRoom.sonosBeamVolume),
    volumeEntityId: MUSIC_ROOM_VOLUME_ENTITY_ID,
    showVolumeWhenOff: true,
    powerButton: {
      label: copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.remoteControls.power),
      icon: 'mdi:power',
      iconColorRule: powerIconColorRule([MUSIC_ROOM_CONTROL_ENTITY_ID], ['off', 'unavailable', 'unknown']),
      action: musicRoomPowerAction,
      semantics: musicRoomPowerSemantics,
    },
    upButton: { label: copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.remoteControls.up), icon: 'mdi:chevron-up', action: remoteCommand(MUSIC_ROOM_REMOTE_ENTITY_ID, 'DPAD_UP') },
    leftButton: { label: copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.remoteControls.left), icon: 'mdi:chevron-left', action: remoteCommand(MUSIC_ROOM_REMOTE_ENTITY_ID, 'DPAD_LEFT') },
    selectButton: { label: copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.remoteControls.select), icon: ' ', action: remoteCommand(MUSIC_ROOM_REMOTE_ENTITY_ID, 'DPAD_CENTER') },
    rightButton: { label: copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.remoteControls.right), icon: 'mdi:chevron-right', action: remoteCommand(MUSIC_ROOM_REMOTE_ENTITY_ID, 'DPAD_RIGHT') },
    downButton: { label: copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.remoteControls.down), icon: 'mdi:chevron-down', action: remoteCommand(MUSIC_ROOM_REMOTE_ENTITY_ID, 'DPAD_DOWN') },
    backButton: { label: copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.remoteControls.back), icon: 'mdi:triangle-down', iconRotationDegrees: 90, action: remoteCommand(MUSIC_ROOM_REMOTE_ENTITY_ID, 'BACK') },
    homeButton: { label: copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.remoteControls.home), icon: 'mdi:circle', action: remoteCommand(MUSIC_ROOM_REMOTE_ENTITY_ID, 'HOME') },
    volumeDownButton: { label: copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.remoteControls.volumeDown), icon: 'mdi:volume-minus', action: service('media_player', 'volume_down', MUSIC_ROOM_VOLUME_ENTITY_ID) },
    volumeMuteButton: { label: copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.remoteControls.mute), icon: 'mdi:volume-mute', action: service('script', 'toggle_sonos_mute', undefined, { sonosdevice: [MUSIC_ROOM_VOLUME_ENTITY_ID] }) },
    volumeUpButton: { label: copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.remoteControls.volumeUp), icon: 'mdi:volume-plus', action: service('media_player', 'volume_up', MUSIC_ROOM_VOLUME_ENTITY_ID) },
    pauseButton: { label: copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.remoteControls.pause), icon: 'mdi:pause', action: remoteCommand(MUSIC_ROOM_REMOTE_ENTITY_ID, 'MEDIA_PAUSE') },
    playButton: { label: copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.remoteControls.play), icon: 'mdi:play', action: remoteCommand(MUSIC_ROOM_REMOTE_ENTITY_ID, 'MEDIA_PLAY') },
    devices: [
      {
        title: copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.musicRoom.tv),
        entityId: MUSIC_ROOM_CONTROL_ENTITY_ID,
        icon: 'mdi:television',
        semantics: musicRoomPowerSemantics,
        action: MUSIC_ROOM_MEDIA_ACTIONS.tvToggle,
      },
      {
        title: copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.musicRoom.xbox),
        entityId: MUSIC_ROOM_XBOX_ENTITY_ID,
        icon: 'mdi:microsoft-xbox',
        activeStates: MUSIC_ROOM_XBOX_ACTIVE_STATES,
        semantics: musicRoomXboxPowerSemantics,
        action: MUSIC_ROOM_MEDIA_ACTIONS.xboxToggle,
      },
      {
        title: copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.musicRoom.server),
        entityId: MUSIC_ROOM_MEDIA_SOURCE_ENTITY_ID,
        icon: 'mdi:server',
        activeStates: [MUSIC_ROOM_MEDIA_SOURCE_STATES.server],
        stateLabels: musicRoomSourceLabels(MUSIC_ROOM_MEDIA_SOURCE_STATES.server),
        semantics: musicRoomServerSemantics,
        action: MUSIC_ROOM_MEDIA_ACTIONS.server,
      },
      {
        title: copy(MEDIA_COPY_NAMESPACE, MEDIA_COPY_KEYS.musicRoom.sonosBeam),
        entityId: MUSIC_ROOM_VOLUME_ENTITY_ID,
        icon: 'mdi:speaker',
        semantics: stateSemantics,
      },
    ],
  },
}
