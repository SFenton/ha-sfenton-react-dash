export type MediaRemoteAction =
  | { type: 'service'; domain: string; service: string; target?: string; serviceData?: Record<string, unknown> }
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
}

export interface MediaRemoteAppConfig {
  action: MediaRemoteAction
  background?: 'white'
  icon?: string
  imageUrl: string
  title: string
}

export interface MediaRemoteDeviceConfig {
  action: MediaRemoteAction
  entityId: string
  icon: string
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

function service(domain: string, serviceName: string, target?: string, serviceData?: Record<string, unknown>): MediaRemoteAction {
  return { type: 'service', domain, service: serviceName, target, serviceData }
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
}
