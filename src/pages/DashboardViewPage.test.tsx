import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { act } from 'react'
import { vi } from 'vitest'
import { materialIconPath } from '../components/core/iconPaths'
import { INVENTORY_SEARCH_DEBOUNCE_MS } from '../components/hass/EverShelfInventoryControls'
import { valueToThermostatPoint } from '../components/hass/thermostatDialGeometry'
import { VacuumRoomSourceModalContent } from '../components/hass/VacuumCard'
import { DashboardViewPage } from './DashboardViewPage'
import { CONTACT_GROUPS } from '../constants/atAGlance'
import { MUSIC_ROOM_ACTIVE_MEDIA_SOURCE_ENTITY_ID, MUSIC_ROOM_COMMAND_REVERT_MS, MUSIC_ROOM_HUE_SYNC_HDMI_INPUT_ENTITY_ID, MUSIC_ROOM_HUE_SYNC_POWER_ENTITY_ID, MUSIC_ROOM_XBOX_HDMI_STATUS_ENTITY_ID } from '../constants/mediaRemotes'
import { HOUSEHOLD_RESIDENTS } from '../constants/householdResidents'
import { TODO_PAGES, VACUUMS } from '../constants/portedDashboard'
import { ROOM_PAGE_CONFIGS, ROOM_PAGE_ORDER } from '../constants/roomPages'
import {
  EVIDENCE_FREE_V2_VACUUM_OUTCOME_PAYLOAD,
  LEGACY_VACUUM_OUTCOMES,
  MISLEADING_V2_LEGACY_VACUUM_OUTCOMES,
  NINE_ROOM_VACUUM_OUTCOME_CONTRACT,
} from '../test/fixtures/vacuumOutcomes'
import { entity, mockCallServiceCalls, mockDonetickTasksById, mockEntities, mockFreeSleepScheduleAttributes, mockScheduleMessages, mockState, mockTodoItemsByEntity, resetMockHass, setMockEntityState } from '../test/mocks/hakitCoreState'

// @covers src/constants/portedDashboard.ts
// @covers src/constants/roomPages.ts
// @covers src/constants/householdResidents.ts
// @covers src/i18n/index.ts
// @covers src/i18n/locales/en/pages/food.json

type MockDecodeCallback = (
  result: { getText: () => string } | undefined,
  error: { message?: string, name?: string } | undefined,
  controls: { stop: () => void },
) => void

const zxingMock = vi.hoisted(() => ({
  decodeFromVideoElement: vi.fn(),
  latestCallback: undefined as MockDecodeCallback | undefined,
  possibleFormats: [] as unknown[],
  scannerStop: vi.fn(),
}))

vi.mock('@zxing/browser', () => ({
  BarcodeFormat: {
    CODE_128: 'CODE_128',
    CODE_39: 'CODE_39',
    EAN_13: 'EAN_13',
    EAN_8: 'EAN_8',
    ITF: 'ITF',
    UPC_A: 'UPC_A',
    UPC_E: 'UPC_E',
  },
  BrowserMultiFormatReader: vi.fn(function BrowserMultiFormatReader() {
    return {
      set possibleFormats(formats: unknown[]) {
        zxingMock.possibleFormats = formats
      },
      decodeFromVideoElement: zxingMock.decodeFromVideoElement,
    }
  }),
}))

const MODAL_TAB_TEST_SETTLE_MS = 340

type RoleScope = Pick<typeof screen, 'getByRole'>

async function settleModalTabTransition() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, MODAL_TAB_TEST_SETTLE_MS))
  })
}

async function clickModalTab(scope: RoleScope, name: string) {
  const button = scope.getByRole('tab', { name })
  fireEvent.pointerDown(button)
  fireEvent.click(button)
  await settleModalTabTransition()
  return button
}

async function clickIconModalTab(scope: RoleScope, name: string) {
  const tab = scope.getByRole('tab', { name })
  fireEvent.pointerDown(tab)
  fireEvent.click(tab)
  await settleModalTabTransition()
  return tab
}

async function openThermostatControls() {
  fireEvent.click(screen.getByRole('button', { name: 'Room Thermostats' }))
  return screen.findByRole('dialog', { name: 'Thermostat · Advanced Controls' })
}

function mqttPublishCalls() {
  return mockCallServiceCalls.filter(call => call.domain === 'mqtt' && call.service === 'publish')
}

function restoreProperty(target: object, property: PropertyKey, descriptor: PropertyDescriptor | undefined) {
  if (descriptor) {
    Object.defineProperty(target, property, descriptor)
  } else {
    delete (target as Record<PropertyKey, unknown>)[property]
  }
}

interface MockCameraOptions {
  viewportHeight?: number
  viewportWidth?: number
  videoHeight?: number
  videoWidth?: number
}

function setupMockCamera(options: MockCameraOptions = {}) {
  const videoWidth = options.videoWidth ?? 1280
  const videoHeight = options.videoHeight ?? 720
  const viewportWidth = options.viewportWidth ?? 320
  const viewportHeight = options.viewportHeight ?? 180
  const stop = vi.fn()
  const stream = { getTracks: () => [{ stop } as unknown as MediaStreamTrack] } as unknown as MediaStream
  const getUserMedia = vi.fn(() => Promise.resolve(stream))
  const originalMediaDevices = navigator.mediaDevices
  const originalIsSecureContext = window.isSecureContext
  const originalVideoWidth = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, 'videoWidth')
  const originalVideoHeight = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, 'videoHeight')
  const originalReadyState = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'readyState')
  const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  const rectSpy = vi.spyOn(HTMLVideoElement.prototype, 'getBoundingClientRect').mockReturnValue({
    bottom: viewportHeight,
    height: viewportHeight,
    left: 0,
    right: viewportWidth,
    toJSON: () => ({}),
    top: 0,
    width: viewportWidth,
    x: 0,
    y: 0,
  } as DOMRect)
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, value: videoWidth })
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, value: videoHeight })
  Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { configurable: true, value: 4 })

  return {
    getUserMedia,
    restore: () => {
      playSpy.mockRestore()
      rectSpy.mockRestore()
      Object.defineProperty(window, 'isSecureContext', { configurable: true, value: originalIsSecureContext })
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: originalMediaDevices })
      restoreProperty(HTMLVideoElement.prototype, 'videoWidth', originalVideoWidth)
      restoreProperty(HTMLVideoElement.prototype, 'videoHeight', originalVideoHeight)
      restoreProperty(HTMLMediaElement.prototype, 'readyState', originalReadyState)
    },
    stop,
  }
}

function setupMockCanvas(dataUrl = 'data:image/jpeg;base64,expiry-image') {
  const drawImage = vi.fn()
  const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({ drawImage }) as unknown as CanvasRenderingContext2D)
  const toDataUrlSpy = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(dataUrl)

  return {
    dataUrl,
    drawImage,
    toDataUrl: toDataUrlSpy,
    restore: () => {
      getContextSpy.mockRestore()
      toDataUrlSpy.mockRestore()
    },
  }
}

function testDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function testDisplayDateValue(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}/${day}/${date.getFullYear()}`
}

function testExpiryLabel(days: number, quantity?: number) {
  const expiryDate = testAddDays(testTodayDate(), days)
  const label = `${days < 0 ? 'Expired' : 'Expires'} on ${testDisplayDateValue(expiryDate)}`
  return quantity && quantity > 1 ? `Quantity ${quantity} · ${label}` : label
}

function testTodayDate() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function testAddDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function testAddMonths(date: Date, months: number) {
  const nextDate = new Date(date.getFullYear(), date.getMonth() + months, 1)
  const lastDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()
  nextDate.setDate(Math.min(date.getDate(), lastDay))
  return nextDate
}

function testQuickExpirationDateValue(value: '3-days' | '1-week' | '1-month' | '6-months' | '1-year') {
  const today = testTodayDate()
  if (value === '3-days') return testDateInputValue(testAddDays(today, 3))
  if (value === '1-week') return testDateInputValue(testAddDays(today, 7))
  if (value === '1-month') return testDateInputValue(testAddMonths(today, 1))
  if (value === '6-months') return testDateInputValue(testAddMonths(today, 6))
  return testDateInputValue(testAddMonths(today, 12))
}

const VACATION_CHECKLIST_ENTITY_IDS = [
  'input_boolean.vacation_checklist_turn_off_outdoor_sprinklers',
  'input_boolean.vacation_checklist_pour_boiling_water_down_the_drain',
  'input_boolean.vacation_checklist_make_the_bed',
  'input_boolean.vacation_checklist_unload_and_check_dishwasher',
  'input_boolean.vacation_checklist_trash_and_recycles_taken_out',
]

function setVacationChecklistMockState(state: string) {
  for (const entityId of VACATION_CHECKLIST_ENTITY_IDS) {
    mockEntities[entityId].state = state
  }
}

function setupStephenSleepypodLevelControl(phase: string) {
  mockEntities['climate.sleepypod_eight_pod_left_side'] = entity('climate.sleepypod_eight_pod_left_side', 'heat', {
    current_temperature: 81,
    hvac_modes: ['off', 'heat'],
    max_temp: 110,
    min_temp: 55,
    target_temp_step: 1,
    temperature: 77,
  })
  mockEntities['number.master_bedroom_sleepypod_eight_pod_left_target_level'] = entity('number.master_bedroom_sleepypod_eight_pod_left_target_level', '-2', {
    max: 10,
    min: -10,
    step: 1,
  })
  mockEntities['sensor.sleepypod_stephen_schedule_phase'].state = phase
}

function setupStephSleepypodLevelControl(phase: string) {
  mockEntities['climate.sleepypod_eight_pod_right_side'] = entity('climate.sleepypod_eight_pod_right_side', 'heat', {
    current_temperature: 84,
    hvac_modes: ['off', 'heat'],
    max_temp: 110,
    min_temp: 55,
    target_temp_step: 1,
    temperature: 85,
  })
  mockEntities['number.master_bedroom_sleepypod_eight_pod_right_target_level'] = entity('number.master_bedroom_sleepypod_eight_pod_right_target_level', '1', {
    max: 10,
    min: -10,
    step: 1,
  })
  mockEntities['sensor.sleepypod_steph_schedule_phase'].state = phase
}

type TestFreeSleepAlarm = {
  alarmTemperature: number
  duration: number
  enabled: boolean
  time: string
  vibrationIntensity: number
  vibrationPattern: 'double' | 'rise'
}

const TEST_FREE_SLEEP_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

function testFreeSleepAlarm(time: string, enabled = true, overrides: Partial<TestFreeSleepAlarm> = {}): TestFreeSleepAlarm {
  return {
    alarmTemperature: 82,
    duration: 300,
    enabled,
    time,
    vibrationIntensity: 100,
    vibrationPattern: 'rise',
    ...overrides,
  }
}

function setFreeSleepWakeDayAlarms(side: 'left' | 'right', wakeDay: (typeof TEST_FREE_SLEEP_DAYS)[number], alarms: TestFreeSleepAlarm[]) {
  const scheduleDay = TEST_FREE_SLEEP_DAYS[(TEST_FREE_SLEEP_DAYS.indexOf(wakeDay) + TEST_FREE_SLEEP_DAYS.length - 1) % TEST_FREE_SLEEP_DAYS.length]
  const attributes = mockEntities['sensor.nightcanvasrestful_schedules'].attributes as Record<string, unknown>
  const sideSchedule = attributes[side] as Record<string, Record<string, unknown>>
  const daySchedule = sideSchedule[scheduleDay]
  daySchedule.alarms = alarms
  if (alarms.length > 0) daySchedule.alarm = alarms[0]
  else delete daySchedule.alarm
}

async function startAndCaptureExpirationDate(buttonName = 'Read Expiration Date') {
  expect(await screen.findByLabelText('Live expiration date camera feed')).toBeInTheDocument()
  await act(async () => {
    fireEvent.click(await screen.findByRole('button', { name: buttonName }))
  })
}

describe('DashboardViewPage', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', window.location.pathname)
    resetMockHass()
    zxingMock.decodeFromVideoElement.mockReset()
    zxingMock.latestCallback = undefined
    zxingMock.possibleFormats = []
    zxingMock.scannerStop.mockReset()
    zxingMock.decodeFromVideoElement.mockImplementation(async (_video: HTMLVideoElement, callback: MockDecodeCallback) => {
      zxingMock.latestCallback = callback
      return { stop: zxingMock.scannerStop }
    })
    delete mockEntities['climate.sleepypod_eight_pod_left_side']
    delete mockEntities['climate.sleepypod_eight_pod_right_side']
    delete mockEntities['number.master_bedroom_sleepypod_eight_pod_left_target_level']
    delete mockEntities['number.master_bedroom_sleepypod_eight_pod_right_target_level']
    delete mockEntities['sensor.master_bedroom_sleepypod_eight_pod_schedules']
    delete mockEntities['sensor.main_floor_vacuum_status']
    delete mockEntities['sensor.music_room_vacuum_status']
    delete mockEntities['sensor.theater_room_vacuum_status']
    mockEntities['alarm_control_panel.aqara_hub_m3_0056_security_system_2'].state = 'armed_home'
    mockEntities['binary_sensor.contact_sensors'].state = 'off'
    CONTACT_GROUPS.flatMap((group) => group.items).forEach((item) => {
      mockEntities[item.entityId].state = 'off'
    })
    mockEntities['select.living_room_air_purifier_fan_mode'].state = 'Auto'
    mockEntities['select.living_room_air_purifier_auto_mode'].state = 'Default'
    mockEntities['fan.living_room_air_purifier_levoit_purifier'].attributes.percentage = 33
    mockEntities['vacuum.valetudo_exaltedsneakydeer'].state = 'docked'
    mockEntities['sensor.valetudo_exaltedsneakydeer_status_flag'].state = 'none'
    mockEntities['sensor.valetudo_exaltedsneakydeer_error'].state = 'No error'
    mockEntities['input_text.main_floor_vacuum_error_message'].state = ''
    mockEntities['input_text.main_floor_vacuum_mode'].state = 'Vacuum'
    mockEntities['select.valetudo_exaltedsneakydeer_mode'].state = 'vacuum'
    mockEntities['select.valetudo_exaltedsneakydeer_fan'].state = 'balanced'
    mockEntities['select.valetudo_exaltedsneakydeer_water'].state = 'medium'
    mockEntities['input_select.main_floor_vacuum_cleaning_passes'].state = '1'
    mockEntities['vacuum.valetudo_elatedusedram'].state = 'unavailable'
    mockEntities['input_boolean.roborock_living_room_toggle'].state = 'off'
    mockEntities['input_boolean.guests_staying_in_guest_room'].state = 'off'
    mockEntities['input_boolean.guests_staying_in_music_room'].state = 'off'
    mockEntities['input_boolean.guests_staying_in_theater_room'].state = 'off'
    mockEntities['input_boolean.vacation_mode'].state = 'off'
    mockEntities['input_boolean.vacation_checklist_turn_off_outdoor_sprinklers'].state = 'off'
    mockEntities['input_boolean.vacation_checklist_pour_boiling_water_down_the_drain'].state = 'off'
    mockEntities['input_boolean.vacation_checklist_make_the_bed'].state = 'off'
    mockEntities['input_boolean.vacation_checklist_unload_and_check_dishwasher'].state = 'off'
    mockEntities['input_boolean.vacation_checklist_trash_and_recycles_taken_out'].state = 'off'
    mockEntities['media_player.living_room_shield_2'].state = 'off'
    mockEntities['media_player.sonos'].state = 'playing'
    mockEntities['media_player.master_bedroom_apple_tv'].state = 'paused'
    mockEntities['media_player.primary_bedroom'].state = 'playing'
    mockEntities['number.nightcanvasrestful_left_target_temperature'].state = '-1'
    mockEntities['number.nightcanvasrestful_right_target_temperature'].state = '0'
    mockEntities['number.nightcanvasrestful_left_bedtime_temperature'].state = '0'
    mockEntities['number.nightcanvasrestful_left_asleep_temperature'].state = '-1'
    mockEntities['number.nightcanvasrestful_left_dawn_temperature'].state = '0'
    mockEntities['number.nightcanvasrestful_right_bedtime_temperature'].state = '0'
    mockEntities['number.nightcanvasrestful_right_asleep_temperature'].state = '0'
    mockEntities['number.nightcanvasrestful_right_dawn_temperature'].state = '0'
    mockEntities['input_number.eight_sleep_stephen_bedtime_level'].state = '0'
    mockEntities['input_number.eight_sleep_stephen_asleep_level'].state = '-1'
    mockEntities['input_number.eight_sleep_stephen_dawn_level'].state = '0'
    mockEntities['input_number.eight_sleep_steph_bedtime_level'].state = '0'
    mockEntities['input_number.eight_sleep_steph_asleep_level'].state = '0'
    mockEntities['input_number.eight_sleep_steph_dawn_level'].state = '0'
    mockEntities['text.master_bedroom_eight_sleep_pod_5_left_bedtime'].state = '21:30'
    mockEntities['text.master_bedroom_eight_sleep_pod_5_right_bedtime'].state = '22:00'
    mockEntities['sensor.nightcanvasrestful_left_current_temperature'].state = '86'
    mockEntities['sensor.nightcanvasrestful_right_current_temperature'].state = '72'
    mockEntities['sensor.nightcanvasrestful_left_seconds_remaining'].state = '7200'
    mockEntities['sensor.nightcanvasrestful_right_seconds_remaining'].state = '0'
    mockEntities['switch.nightcanvasrestful_left_power'].state = 'on'
    mockEntities['switch.nightcanvasrestful_right_power'].state = 'off'
    mockEntities['switch.nightcanvasrestful_left_away_mode'].state = 'off'
    mockEntities['switch.nightcanvasrestful_right_away_mode'].state = 'off'
    mockEntities['switch.nightcanvasrestful_left_alarms_enabled'].state = 'off'
    mockEntities['switch.nightcanvasrestful_right_alarms_enabled'].state = 'off'
    mockEntities['input_boolean.eight_sleep_stephen_hot_flash_active'].state = 'off'
    mockEntities['input_boolean.eight_sleep_steph_hot_flash_active'].state = 'off'
    mockEntities['timer.eight_sleep_stephen_hot_flash'].state = 'idle'
    mockEntities['timer.eight_sleep_steph_hot_flash'].state = 'idle'
    mockEntities['sensor.nightcanvasrestful_schedules'].attributes = mockFreeSleepScheduleAttributes()
    mockEntities['sensor.master_bedroom_sleepypod_eight_pod_left_alarm_state'].state = 'idle'
    mockEntities['sensor.master_bedroom_sleepypod_eight_pod_left_alarm_state'].attributes.snoozed_until = null
    mockEntities['binary_sensor.nightcanvasrestful_left_presence'].state = 'on'
    mockEntities['sensor.master_bedroom_sleepypod_eight_pod_right_alarm_state'].state = 'idle'
    mockEntities['sensor.master_bedroom_sleepypod_eight_pod_right_alarm_state'].attributes.snoozed_until = null
    mockEntities['binary_sensor.nightcanvasrestful_right_presence'].state = 'off'
    mockEntities['media_player.theater_room_shield'].state = 'off'
    mockEntities['media_player.theater'].state = 'off'
    mockEntities['media_player.sony_projector'].state = 'off'
    mockEntities['switch.guest_bathroom_fan_switch_top'].state = 'off'
    mockEntities['switch.guest_bathroom_towel_rack_switch_top'].state = 'on'
    mockEntities['switch.master_bathroom_fan_switch_top'].state = 'off'
    mockEntities['switch.master_bathroom_towel_rack_switch_top'].state = 'on'
    mockEntities['cover.garage_left_door'].state = 'closed'
    mockEntities['cover.garage_right_door'].state = 'closed'
    mockEntities['lock.aqara_smart_lock_u400'].state = 'locked'
    mockEntities['lock.fordpass_3fmtk3su5mma09266_doorlock'].state = 'locked'
  })

  it('renders a statically ported room page from React-owned config', () => {
    const navigate = vi.fn()
    render(<DashboardViewPage activePath="living-room" onNavigate={navigate} path="living-room" />)

    expect(screen.getByRole('heading', { name: 'Living Room' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
    expect(navigate).toHaveBeenCalledWith('overview')
    expect(screen.queryByRole('heading', { name: 'Room Status' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lights/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Window/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Climate' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Devices' })).toBeInTheDocument()
  })

  it('uses dynamic grids for every room section, splits lead rows, and sizes app launch grids by tile width', () => {
    for (const path of ROOM_PAGE_ORDER) {
      const room = ROOM_PAGE_CONFIGS[path]
      const view = render(<DashboardViewPage activePath={path} onNavigate={() => undefined} path={path} />)

      if (path === 'kitchen') {
        expect(screen.getByRole('group', { name: 'Kitchen Groceries' })).toHaveAttribute('data-dynamic-grid', 'true')
      }

      for (const section of room.sourceSections.filter((candidate) => candidate.showOnRoomPage !== false)) {
        const grid = screen.getByRole('group', { name: `${room.title} ${section.title}` })
        expect(grid).toHaveAttribute('data-dynamic-grid', 'true')

        if (section.layout === 'app-launch') {
          expect(grid).toHaveAttribute('data-dynamic-grid-max-cell-width', '200')
          expect(grid).toHaveAttribute('data-dynamic-grid-last-row', 'center')
        } else if (section.layout === 'lead-row') {
          expect(grid).not.toHaveAttribute('data-dynamic-grid-max-cell-width')
          expect(grid).toHaveAttribute('data-dynamic-grid-layout', 'fill')
        } else if (section.layout === 'two-column-fill') {
          expect(grid).not.toHaveAttribute('data-dynamic-grid-max-cell-width')
          expect(grid).toHaveAttribute('data-dynamic-grid-last-row', 'fill')
          expect(grid).toHaveAttribute('data-dynamic-grid-layout', 'fill')
        } else {
          expect(grid).toHaveAttribute('data-dynamic-grid-max-cell-width', '280')
          expect(grid).toHaveAttribute('data-dynamic-grid-last-row', 'fill-minimum')
          expect(grid).toHaveAttribute('data-dynamic-grid-layout', 'bounded')
        }
        if (section.layout === 'app-launch') expect(grid).toHaveAttribute('data-dynamic-grid-layout', 'bounded')

        if (section.layout === 'lead-row') {
          expect(grid.querySelectorAll('[data-dynamic-grid-cell="true"]')).toHaveLength(1)
          expect(grid.querySelector('[data-dynamic-grid-cell="true"]')).toHaveAttribute('data-dynamic-grid-span', '2')
          const followUpGrid = screen.getByRole('group', { name: `${room.title} ${section.title} Controls` })
          expect(followUpGrid).toHaveAttribute('data-dynamic-grid', 'true')
          expect(followUpGrid).toHaveAttribute('data-dynamic-grid-max-cell-width', '280')
          expect(followUpGrid.querySelectorAll('[data-dynamic-grid-cell="true"]')).toHaveLength(section.cards.length - 1)
        }
      }

      view.unmount()
    }
  })

  it('keeps three-plus-card room sections within two columns and fills the Master Bedroom Climate rows', () => {
    const implicitlyExpandableSections = ROOM_PAGE_ORDER.flatMap((path) =>
      ROOM_PAGE_CONFIGS[path].sourceSections
        .filter((section) => section.showOnRoomPage !== false)
        .filter((section) => section.layout !== 'app-launch' && section.layout !== 'two-column-fill')
        .filter((section) => (section.layout === 'lead-row' ? section.cards.length - 1 : section.cards.length) > 2)
        .map((section) => `${path}:${section.title}`),
    )
    expect(implicitlyExpandableSections).toEqual([])

    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    const climateGrid = screen.getByRole('group', { name: 'Master Bedroom Climate' })
    expect(climateGrid).toHaveAttribute('data-dynamic-grid-columns', '2')
    expect(climateGrid).toHaveAttribute('data-dynamic-grid-last-row', 'fill')
    expect(climateGrid).toHaveAttribute('data-dynamic-grid-layout', 'fill')
    expect(Array.from(climateGrid.children).map((cell) => cell.getAttribute('data-dynamic-grid-span'))).toEqual(['1', '1', '2'])
  })

  it('separates room remotes, device controls, and quick app launch grids', () => {
    const theaterView = render(<DashboardViewPage activePath="theater-room" onNavigate={() => undefined} path="theater-room" />)

    expect(ROOM_PAGE_CONFIGS['theater-room'].sourceSections.map((section) => section.title)).toEqual([
      'Climate',
      'Remote',
      'Quick App Launch',
      'Theater Room PCs',
      'Devices',
    ])
    const theaterRemote = screen.getByRole('group', { name: 'Theater Room Remote' })
    expect(within(theaterRemote).getByRole('button', { name: /^Theater Room Remote/ })).toBeInTheDocument()
    expect(within(theaterRemote).queryByRole('button', { name: /^Nintendo Switch/ })).not.toBeInTheDocument()
    expect(within(theaterRemote).queryByRole('button', { name: /^Theater SHIELD/ })).not.toBeInTheDocument()

    const theaterRemoteControls = screen.getByRole('group', { name: 'Theater Room Remote Controls' })
    expect(within(theaterRemoteControls).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
      'Nintendo Switch Off',
      'Theater SHIELD Off',
    ])
    expect(theaterRemote.compareDocumentPosition(theaterRemoteControls) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Media Controls' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Theater Room Off$/ })).not.toBeInTheDocument()

    const theaterApps = screen.getByRole('group', { name: 'Theater Room Quick App Launch' })
    expect(within(theaterApps).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
      'Plex',
      'YouTube',
      'Netflix',
      'Prime Video',
      'Paramount+',
      'Disney+',
    ])
    theaterView.unmount()

    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    expect(ROOM_PAGE_CONFIGS['living-room'].sourceSections.map((section) => section.title)).toEqual([
      'Climate',
      'Devices',
      'Remote',
      'Quick App Launch',
    ])
    const livingRemote = screen.getByRole('group', { name: 'Living Room Remote' })
    expect(within(livingRemote).getByRole('button', { name: /^Living Room Remote/ })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Living Room Remote' })).not.toBeInTheDocument()
    const livingApps = screen.getByRole('group', { name: 'Living Room Quick App Launch' })
    expect(within(livingApps).getAllByRole('button')).toHaveLength(6)
  })

  it('keeps the theater remote opener and source scripts wired after the section split', async () => {
    render(<DashboardViewPage activePath="theater-room" onNavigate={() => undefined} path="theater-room" />)

    fireEvent.click(screen.getByRole('button', { name: /^Nintendo Switch/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Theater SHIELD/ }))
    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', service: 'theater_room_nintendo_switch', serviceData: undefined },
      { domain: 'script', service: 'theater_room_tv_movie', serviceData: undefined },
    ])

    fireEvent.click(screen.getByRole('button', { name: /^Theater Room Remote/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Theater Room SHIELD Remote' })).toBeInTheDocument()
  })

  it('keeps the Music Room remote controls while hiding its page-level Fortnite app tile', () => {
    render(<DashboardViewPage activePath="music-room" onNavigate={() => undefined} path="music-room" />)

    expect(ROOM_PAGE_CONFIGS['music-room'].sourceSections.map((section) => section.title)).toEqual([
      'Climate',
      'Remote',
      'Quick App Launch',
      'Devices',
    ])
    expect(ROOM_PAGE_CONFIGS['music-room'].sourceSections.find((section) => section.title === 'Quick App Launch')?.showOnRoomPage).toBe(false)

    const opener = screen.getByRole('group', { name: 'Music Room Remote' })
    const controls = screen.getByRole('group', { name: 'Music Room Remote Controls' })
    const remote = within(opener).getByRole('button', { name: 'Music Room Remote Off' })
    const xbox = within(controls).getByRole('button', { name: 'Xbox Off' })
    const server = within(controls).getByRole('button', { name: 'Server Off' })

    expect(remote).toHaveAttribute('data-action-kind', 'modal')
    expect(remote).toHaveAttribute('data-modal-opener', 'true')
    expect(xbox).toHaveAttribute('data-action-kind', 'selection')
    expect(xbox).toHaveAttribute('aria-pressed', 'false')
    expect(server).toHaveAttribute('data-action-kind', 'selection')
    expect(server).toHaveAttribute('aria-pressed', 'false')
    expect(server).not.toHaveAttribute('data-modal-opener')
    expect(screen.queryByRole('heading', { name: 'Quick App Launch' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Fortnite' })).not.toBeInTheDocument()
  })

  it('runs Music Room source scripts with their configured optimistic windows', () => {
    vi.useFakeTimers()
    try {
      render(<DashboardViewPage activePath="music-room" onNavigate={() => undefined} path="music-room" />)

      fireEvent.click(screen.getByRole('button', { name: 'Xbox Off' }))
      expect(screen.getByRole('button', { name: 'Xbox On' })).toHaveAttribute('aria-pressed', 'true')
      expect(mockCallServiceCalls).toEqual([
        { domain: 'script', returnResponse: true, service: 'music_room_xbox' },
      ])

      act(() => vi.advanceTimersByTime(MUSIC_ROOM_COMMAND_REVERT_MS.tv))
      expect(screen.getByRole('button', { name: 'Xbox On' })).toHaveAttribute('aria-pressed', 'true')
      act(() => vi.advanceTimersByTime(MUSIC_ROOM_COMMAND_REVERT_MS.xbox - MUSIC_ROOM_COMMAND_REVERT_MS.tv))
      expect(screen.getByRole('button', { name: 'Xbox Off' })).toHaveAttribute('aria-pressed', 'false')

      fireEvent.click(screen.getByRole('button', { name: 'Server Off' }))
      expect(screen.getByRole('button', { name: 'Server On' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'Xbox Off' })).toHaveAttribute('aria-pressed', 'false')
      act(() => vi.advanceTimersByTime(MUSIC_ROOM_COMMAND_REVERT_MS.server - 1))
      expect(screen.getByRole('button', { name: 'Server On' })).toBeInTheDocument()
      act(() => vi.advanceTimersByTime(1))
      expect(screen.getByRole('button', { name: 'Server Off' })).toHaveAttribute('aria-pressed', 'false')

      expect(mockCallServiceCalls).toEqual([
        { domain: 'script', returnResponse: true, service: 'music_room_xbox' },
        { domain: 'script', returnResponse: true, service: 'music_room_server' },
      ])
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })

  it('turns the full system off from an already-selected Xbox source and shares that optimism with the modal', async () => {
    mockEntities[MUSIC_ROOM_ACTIVE_MEDIA_SOURCE_ENTITY_ID].state = 'Xbox'
    mockEntities['input_select.music_room_media_source'].state = 'Xbox'
    mockEntities['media_player.music_room_tv_android'].state = 'on'
    mockEntities['media_player.xbox'].state = 'on'
    mockEntities[MUSIC_ROOM_HUE_SYNC_POWER_ENTITY_ID].state = 'on'
    mockEntities[MUSIC_ROOM_HUE_SYNC_HDMI_INPUT_ENTITY_ID].state = 'HDMI 1'
    mockEntities[MUSIC_ROOM_XBOX_HDMI_STATUS_ENTITY_ID].state = 'linked'
    render(<DashboardViewPage activePath="music-room" onNavigate={() => undefined} path="music-room" />)

    const xbox = screen.getByRole('button', { name: 'Xbox On' })
    expect(xbox).toHaveAttribute('data-action-kind', 'selection')
    expect(xbox).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(xbox)

    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', returnResponse: true, service: 'music_room_tv_off' },
    ])
    expect(screen.getByRole('button', { name: 'Xbox Off' })).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(screen.getByRole('button', { name: 'Music Room Remote Off' }))
    const dialog = await screen.findByRole('dialog', { name: 'Music Room Remote' })
    await clickModalTab(within(dialog), 'Devices')
    expect(within(dialog).getByRole('switch', { name: 'Xbox Off' })).toHaveAttribute('aria-checked', 'false')
  })

  it('turns the full system off from an already-selected Server source', () => {
    mockEntities[MUSIC_ROOM_ACTIVE_MEDIA_SOURCE_ENTITY_ID].state = 'Server'
    mockEntities['input_select.music_room_media_source'].state = 'Server'
    mockEntities['media_player.music_room_tv_android'].state = 'on'
    mockEntities[MUSIC_ROOM_HUE_SYNC_POWER_ENTITY_ID].state = 'on'
    mockEntities[MUSIC_ROOM_HUE_SYNC_HDMI_INPUT_ENTITY_ID].state = 'HDMI 2'
    render(<DashboardViewPage activePath="music-room" onNavigate={() => undefined} path="music-room" />)

    fireEvent.click(screen.getByRole('button', { name: 'Server On' }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', returnResponse: true, service: 'music_room_tv_off' },
    ])
    expect(screen.getByRole('button', { name: 'Server Off' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('lets an external routed-source change replace pending Xbox optimism immediately', () => {
    render(<DashboardViewPage activePath="music-room" onNavigate={() => undefined} path="music-room" />)

    fireEvent.click(screen.getByRole('button', { name: 'Xbox Off' }))
    expect(screen.getByRole('button', { name: 'Xbox On' })).toHaveAttribute('aria-pressed', 'true')

    act(() => setMockEntityState(MUSIC_ROOM_ACTIVE_MEDIA_SOURCE_ENTITY_ID, 'Server'))

    expect(screen.getByRole('button', { name: 'Xbox Off' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Server On' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('switches directly between active Xbox and Server routes without dual selection', () => {
    mockEntities[MUSIC_ROOM_ACTIVE_MEDIA_SOURCE_ENTITY_ID].state = 'Xbox'
    const view = render(<DashboardViewPage activePath="music-room" onNavigate={() => undefined} path="music-room" />)

    fireEvent.click(screen.getByRole('button', { name: 'Server Off' }))
    expect(screen.getByRole('button', { name: 'Xbox Off' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Server On' })).toHaveAttribute('aria-pressed', 'true')
    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', returnResponse: true, service: 'music_room_server' },
    ])

    view.unmount()
    resetMockHass()
    mockEntities[MUSIC_ROOM_ACTIVE_MEDIA_SOURCE_ENTITY_ID].state = 'Server'
    render(<DashboardViewPage activePath="music-room" onNavigate={() => undefined} path="music-room" />)

    fireEvent.click(screen.getByRole('button', { name: 'Xbox Off' }))
    expect(screen.getByRole('button', { name: 'Xbox On' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Server Off' })).toHaveAttribute('aria-pressed', 'false')
    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', returnResponse: true, service: 'music_room_xbox' },
    ])
  })

  it('treats Fortnite as the active Xbox route on room source tiles', () => {
    mockEntities[MUSIC_ROOM_ACTIVE_MEDIA_SOURCE_ENTITY_ID].state = 'Fortnite'
    render(<DashboardViewPage activePath="music-room" onNavigate={() => undefined} path="music-room" />)

    expect(screen.getByRole('button', { name: 'Xbox On' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Server Off' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('opens the Music Room remote with its configured title, apps, and devices', async () => {
    render(<DashboardViewPage activePath="music-room" onNavigate={() => undefined} path="music-room" />)

    fireEvent.click(screen.getByRole('button', { name: 'Music Room Remote Off' }))
    const dialog = await screen.findByRole('dialog', { name: 'Music Room Remote' })
    expect(within(dialog).getByRole('heading', { name: 'Music Room Remote' })).toBeInTheDocument()
    expect(within(dialog).getByRole('tab', { name: 'Apps' })).toBeInTheDocument()
    expect(within(dialog).getByRole('tab', { name: 'Devices' })).toBeInTheDocument()
    expect(within(dialog).getByRole('tab', { name: 'Hue Sync' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Keyboard' })).not.toBeInTheDocument()

    await clickModalTab(within(dialog), 'Apps')
    expect(within(dialog).getByRole('button', { name: 'Fortnite' })).toBeInTheDocument()

    await clickModalTab(within(dialog), 'Devices')
    expect(within(dialog).getByRole('switch', { name: 'TV Off' })).toBeInTheDocument()
    expect(within(dialog).getByRole('switch', { name: 'Xbox Off' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Server Off' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Sonos Beam Playing')).toHaveAttribute('data-action-kind', 'state')

    await clickModalTab(within(dialog), 'Hue Sync')
    expect(within(dialog).getByRole('switch', { name: 'Sync Box Power On' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Music' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).getByRole('button', { name: 'HDMI 1 Selected • Unplugged' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders the source empty room state for room pages without body cards', () => {
    render(<DashboardViewPage activePath="hallway" onNavigate={() => undefined} path="hallway" />)

    expect(screen.getByRole('heading', { name: 'Hallway' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nothing Here Yet!' })).toBeInTheDocument()
    expect(screen.getByText('Once some devices are added to this room, we can display them here.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nothing Here Yet!' }).parentElement).toHaveAttribute('data-empty-layout', 'centered')
    expect(screen.getByRole('heading', { name: 'Nothing Here Yet!' }).parentElement).toHaveAttribute('data-empty-typography', 'festival')
  })

  it('keeps non-Home content hidden for the first frame after the preload spinner exits', () => {
    const { container, rerender } = render(<DashboardViewPage activePath="security" initialContentTransitionState="pre-entering" onNavigate={() => undefined} path="security" />)
    const page = container.querySelector('main')

    expect(page).toHaveAttribute('data-content-transition-state', 'pre-entering')

    rerender(<DashboardViewPage activePath="security" initialContentTransitionState="entering" onNavigate={() => undefined} path="security" />)

    expect(page).toHaveAttribute('data-content-transition-state', 'entering')

    rerender(<DashboardViewPage activePath="security" initialContentTransitionState="idle" onNavigate={() => undefined} path="security" />)

    expect(page).not.toHaveAttribute('data-content-transition-state')
  })

  it('opens room status hashes with reusable Home modal sheets directly', async () => {
    mockEntities['light.kitchen'] = entity('light.kitchen', 'off')
    mockEntities['light.kitchen_table_light'] = entity('light.kitchen_table_light', 'off')
    mockEntities['light.kitchen_door_light'] = entity('light.kitchen_door_light', 'off')
    mockEntities['light.kitchen_counter_light'] = entity('light.kitchen_counter_light', 'off')
    mockEntities['light.kitchen_sink_light'] = entity('light.kitchen_sink_light', 'off')
    render(<DashboardViewPage activePath="kitchen" onNavigate={() => undefined} path="kitchen" />)

    expect(screen.getByRole('button', { name: 'Scan Item' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Lights/i }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { name: 'Kitchen Lights' })).toHaveLength(1)
    expect(screen.queryByRole('heading', { name: 'Kitchen: Lights' })).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Kitchen Lights: Off')).not.toBeInTheDocument()
    expect(within(dialog).getByText('Kitchen Lights controls and status details')).toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: 'Toggle Kitchen lights' })
    expect(toggle).toBeInTheDocument()
    expect(toggle.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:lightbulb-multiple-off'))
    expect(within(dialog).queryByText('Rooms')).not.toBeInTheDocument()
  })

  it('opens Rooms from Quick Links on room pages without a standalone Rooms FAB', async () => {
    const navigate = vi.fn()
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={navigate} path="master-bedroom" />)

    const floatingDock = document.querySelector('[data-floating-action-dock="true"]') as HTMLElement
    expect(within(floatingDock).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual(['Open Chat and Quick Links'])
    fireEvent.click(screen.getByRole('button', { name: 'Open Chat and Quick Links' }))
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Home Assistant' })).getByRole('tab', { name: 'Quick Links' }))
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Quick Links' })).getByRole('button', { name: 'Rooms' }))

    const dialog = await screen.findByRole('dialog', { name: 'Rooms' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Living Room area' }))

    expect(navigate).toHaveBeenCalledWith('living-room')
  })

  it('opens the Kitchen scan item camera modal from the FAB', async () => {
    const camera = setupMockCamera()

    try {
      render(<DashboardViewPage activePath="kitchen" onNavigate={() => undefined} path="kitchen" />)

      const floatingDock = document.querySelector('[data-floating-action-dock="true"]')
      const scanButton = screen.getByRole('button', { name: 'Scan Item' })
      expect(scanButton).toHaveTextContent('Scan Item')
      expect(floatingDock).toContainElement(scanButton)
      expect(screen.queryByRole('button', { name: 'Rooms' })).not.toBeInTheDocument()
      expect(within(floatingDock as HTMLElement).getAllByRole('button').map((button) => button.textContent?.trim())).toEqual(['Scan Item', ''])
      fireEvent.click(scanButton)

      expect(await screen.findByRole('dialog', { name: 'Add Item' })).toBeInTheDocument()
      expect(screen.getByText('Scan Barcode · Step 1 of 3')).toBeInTheDocument()
      expect(screen.getByText('Use the product barcode to look up item details')).toBeInTheDocument()
      expect(screen.getByText('Center the barcode inside the camera window and hold steady.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Skip Barcode' })).toBeEnabled()
      expect(screen.queryByText('Scanning for a barcode...')).not.toBeInTheDocument()
      expect(await screen.findByLabelText('Live item scan camera feed')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Manually Enter Name' })).toBeEnabled()
      expect(screen.queryByRole('button', { name: 'Back to barcode scan' })).not.toBeInTheDocument()
      await waitFor(() => expect(camera.getUserMedia).toHaveBeenCalledWith({
        audio: false,
        video: {
          aspectRatio: { ideal: 16 / 9 },
          facingMode: { ideal: 'environment' },
          height: { ideal: 720 },
          width: { ideal: 1280 },
        },
      }))
      expect(await screen.findByRole('button', { name: 'Skip Barcode' })).toBeEnabled()
      await waitFor(() => expect(zxingMock.decodeFromVideoElement).toHaveBeenCalled())
      act(() => {
        zxingMock.latestCallback?.(undefined, { message: 'No MultiFormat Readers were able to detect the code.', name: 'Error' }, { stop: zxingMock.scannerStop })
      })
      expect(screen.queryByText(/No MultiFormat Readers/i)).not.toBeInTheDocument()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      await waitFor(() => expect(camera.stop).toHaveBeenCalled())
    } finally {
      camera.restore()
    }
  })

  it('resolves scanned Kitchen barcodes through EverShelf', async () => {
    const camera = setupMockCamera()

    try {
      render(<DashboardViewPage activePath="kitchen" onNavigate={() => undefined} path="kitchen" />)

      fireEvent.click(screen.getByRole('button', { name: 'Scan Item' }))
      expect(await screen.findByRole('dialog', { name: 'Add Item' })).toBeInTheDocument()
      await waitFor(() => expect(zxingMock.latestCallback).toEqual(expect.any(Function)))

      act(() => {
        zxingMock.latestCallback?.({ getText: () => '3017620422003' }, undefined, { stop: zxingMock.scannerStop })
      })

      await waitFor(() => expect(mockCallServiceCalls).toContainEqual({
        domain: 'evershelf',
        returnResponse: true,
        service: 'resolve_barcode',
        serviceData: { barcode: '3017620422003' },
      }))
      expect(await screen.findByLabelText('Product name')).toHaveValue('Nutella')
      expect(mockCallServiceCalls.some((call) => call.domain === 'evershelf' && call.service === 'prepare_scanned_product')).toBe(false)
      expect(mockCallServiceCalls.some((call) => call.domain === 'evershelf' && call.service === 'suggest_location')).toBe(false)
      expect(screen.getByRole('button', { name: 'Scan Barcode Again' })).toBeEnabled()
      expect(screen.queryByText('Source: mock')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Live item scan camera feed')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
      expect(camera.stop).toHaveBeenCalled()

      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
      expect(screen.getByText('Expiration Date · Step 2 of 3')).toBeInTheDocument()
      await waitFor(() => expect(mockCallServiceCalls).toContainEqual({
        domain: 'evershelf',
        returnResponse: true,
        service: 'prepare_scanned_product',
        serviceData: {
          barcode: '3017620422003',
          brand: 'Ferrero',
          image_url: 'https://example.test/nutella.jpg',
          name: 'Nutella',
          product_id: 42,
        },
      }))
      await waitFor(() => expect(mockCallServiceCalls).toContainEqual({
        domain: 'evershelf',
        returnResponse: true,
        service: 'suggest_location',
        serviceData: {
          barcode: '3017620422003',
          mode: 'barcode',
          name: 'Nutella',
          product_fingerprint: 'f'.repeat(64),
          product_id: 42,
        },
      }))

      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      await waitFor(() => expect(camera.stop).toHaveBeenCalled())
    } finally {
      camera.restore()
    }
  })

  it('keeps exact barcode history ahead of the location-page fallback', async () => {
    const camera = setupMockCamera()
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => {
      if (params.domain === 'evershelf' && params.service === 'resolve_barcode' && params.returnResponse === true) {
        mockCallServiceCalls.push(params)
        return Promise.resolve({
          response: {
            barcode: '196633809865',
            found: true,
            location_suggestion: {
              confidence: 1,
              location: 'frigo',
              source: 'history_barcode',
              success: true,
            },
            product: { brand: 'Costco', id: 77, name: 'Costco Dairy-Free Reduced fat milk' },
            source: 'local',
          },
        })
      }
      if (params.domain === 'evershelf' && params.service === 'suggest_location' && params.returnResponse === true) {
        mockCallServiceCalls.push(params)
        return Promise.resolve({
          response: {
            confidence: 1,
            location: 'frigo',
            source: 'history_barcode',
            success: true,
          },
        })
      }
      return originalCallService(params)
    }

    try {
      render(<DashboardViewPage activePath="freezer" onNavigate={() => undefined} path="freezer" />)
      fireEvent.click(await screen.findByRole('button', { name: 'Scan Item' }))
      await waitFor(() => expect(zxingMock.latestCallback).toEqual(expect.any(Function)))

      act(() => {
        zxingMock.latestCallback?.({ getText: () => '196633809865' }, undefined, { stop: zxingMock.scannerStop })
      })
      expect(await screen.findByLabelText('Product name')).toHaveValue('Costco Dairy-Free Reduced fat milk')
      expect(await screen.findByLabelText('Product name')).toHaveValue('Costco Dairy-Free Reduced fat milk')
      expect(mockCallServiceCalls.some((call) => call.domain === 'evershelf' && call.service === 'suggest_location')).toBe(false)
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
      expect(await screen.findByLabelText('Live expiration date camera feed')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Manually Enter Expiration Date' }))
      fireEvent.click(screen.getByRole('radio', { name: 'In 3 Days' }))
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))

      expect(screen.getByRole('radio', { name: 'Fridge' })).toBeChecked()
      expect(screen.getByText('Selected from your previous EverShelf entries.')).toBeInTheDocument()
      expect(mockCallServiceCalls).toContainEqual({
        domain: 'evershelf',
        returnResponse: true,
        service: 'prepare_scanned_product',
        serviceData: {
          barcode: '196633809865',
          brand: 'Costco',
          name: 'Costco Dairy-Free Reduced fat milk',
          product_id: 77,
        },
      })
      expect(mockCallServiceCalls).toContainEqual({
        domain: 'evershelf',
        returnResponse: true,
        service: 'suggest_location',
        serviceData: {
          barcode: '196633809865',
          mode: 'barcode',
          name: 'Costco Dairy-Free Reduced fat milk',
          product_fingerprint: 'f'.repeat(64),
          product_id: 77,
        },
      })
    } finally {
      mockState.helpers.callService = originalCallService
      camera.restore()
    }
  })

  it('allows manual Kitchen item name and expiration date entry from scan pages', async () => {
    const camera = setupMockCamera()

    try {
      render(<DashboardViewPage activePath="kitchen" onNavigate={() => undefined} path="kitchen" />)

      fireEvent.click(screen.getByRole('button', { name: 'Scan Item' }))
      expect(await screen.findByRole('dialog', { name: 'Add Item' })).toBeInTheDocument()
      expect(await screen.findByLabelText('Live item scan camera feed')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Manually Enter Name' }))
      expect(screen.getByText('Enter Product Name · Step 1 of 3')).toBeInTheDocument()
      expect(screen.getByText('Review or enter the product name before continuing.')).toBeInTheDocument()
      expect(screen.queryByText('Center the barcode inside the camera window and hold steady.')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Live item scan camera feed')).not.toBeInTheDocument()
      expect(camera.stop).toHaveBeenCalled()
      expect(screen.getByLabelText('Product name')).toHaveValue('')
      expect(screen.getByRole('button', { name: 'Scan Barcode' })).toBeEnabled()
      expect(screen.queryByRole('button', { name: 'Skip Barcode' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
      fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Almond Milk' } })
      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))

      expect(screen.getByText('Expiration Date · Step 2 of 3')).toBeInTheDocument()
      expect(screen.getByText('Take a clear photo of the printed expiration date')).toBeInTheDocument()
      expect(screen.getByText('Center the printed expiration date inside the camera window and keep the label flat.')).toBeInTheDocument()
      expect(await screen.findByLabelText('Live expiration date camera feed')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Manually Enter Expiration Date' })).toBeEnabled()
      expect(await screen.findByRole('button', { name: 'Read Expiration Date' })).toBeEnabled()
      expect(screen.getByRole('button', { name: 'Skip Expiration' })).toBeEnabled()
      fireEvent.click(screen.getByRole('button', { name: 'Manually Enter Expiration Date' }))
      expect(screen.getByText('Enter the expiration date manually, or read it from the camera.')).toBeInTheDocument()
      expect(screen.queryByText('Center the printed expiration date inside the camera window and keep the label flat.')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Live expiration date camera feed')).not.toBeInTheDocument()
      expect(screen.getByLabelText('Expiration date')).toHaveValue('')
      expect(screen.getByText('Quick Expiration Dates')).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: 'In 3 Days' })).not.toBeChecked()
      expect(screen.getByRole('radio', { name: 'In 1 Week' })).not.toBeChecked()
      expect(screen.getByRole('button', { name: 'Read Expiration Date' })).toBeEnabled()
      expect(screen.queryByRole('button', { name: 'Skip Expiration' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
      const inThreeDays = testQuickExpirationDateValue('3-days')
      const inOneWeek = testQuickExpirationDateValue('1-week')
      fireEvent.click(screen.getByRole('radio', { name: 'In 3 Days' }))
      expect(screen.getByLabelText('Expiration date')).toHaveValue(inThreeDays)
      expect(screen.getByRole('radio', { name: 'In 3 Days' })).toBeChecked()
      fireEvent.change(screen.getByLabelText('Expiration date'), { target: { value: inOneWeek } })
      expect(screen.getByRole('radio', { name: 'In 1 Week' })).toBeChecked()
      expect(screen.getByRole('radio', { name: 'In 3 Days' })).not.toBeChecked()
      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))

      expect(screen.getByText('Review Item · Step 3 of 3')).toBeInTheDocument()
      expect(screen.getByLabelText('Product name')).toHaveValue('Almond Milk')
      expect(screen.getByLabelText('Expiration date')).toHaveValue(inOneWeek)
    } finally {
      camera.restore()
    }
  })

  it('shows a blank processing spinner while Kitchen scan services are running', async () => {
    const camera = setupMockCamera()
    const canvas = setupMockCanvas()
    const originalCallService = mockState.helpers.callService
    let resolveBarcodeResponse!: (value: unknown) => void
    let resolveExpiryResponse!: (value: unknown) => void

    mockState.helpers.callService = (params) => {
      if (params.domain === 'evershelf' && params.service === 'resolve_barcode' && params.returnResponse === true) {
        mockCallServiceCalls.push(params)
        return new Promise((resolve) => {
          resolveBarcodeResponse = resolve
        })
      }
      if (params.domain === 'evershelf' && params.service === 'read_expiry_image' && params.returnResponse === true) {
        mockCallServiceCalls.push(params)
        return new Promise((resolve) => {
          resolveExpiryResponse = resolve
        })
      }
      return originalCallService(params)
    }

    try {
      render(<DashboardViewPage activePath="kitchen" onNavigate={() => undefined} path="kitchen" />)

      fireEvent.click(screen.getByRole('button', { name: 'Scan Item' }))
      expect(await screen.findByRole('dialog', { name: 'Add Item' })).toBeInTheDocument()
      await waitFor(() => expect(zxingMock.latestCallback).toEqual(expect.any(Function)))

      act(() => {
        zxingMock.latestCallback?.({ getText: () => '3017620422003' }, undefined, { stop: zxingMock.scannerStop })
      })

      const barcodeProgress = await screen.findByRole('status')
      expect(barcodeProgress).toHaveAttribute('data-scan-progress', 'processing')
      expect(barcodeProgress).toHaveTextContent('Processing...')
      expect(barcodeProgress.querySelector('[data-scan-progress-spinner="true"]')).toBeInTheDocument()
      expect(screen.queryByText('Use the product barcode to look up item details')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Live item scan camera feed')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Skip Barcode' })).not.toBeInTheDocument()

      await act(async () => {
        resolveBarcodeResponse({
          response: {
            barcode: '3017620422003',
            found: true,
            product: { brand: 'Ferrero', image_url: 'https://example.test/nutella.jpg', name: 'Nutella' },
            source: 'mock',
          },
        })
      })

      expect(await screen.findByLabelText('Product name')).toHaveValue('Nutella')
      expect(screen.getByRole('button', { name: 'Scan Barcode Again' })).toBeEnabled()
      expect(screen.queryByLabelText('Live item scan camera feed')).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
      await startAndCaptureExpirationDate()

      const expiryProgress = await screen.findByRole('status')
      expect(expiryProgress).toHaveAttribute('data-scan-progress', 'processing')
      expect(expiryProgress).toHaveTextContent('Processing...')
      expect(expiryProgress.querySelector('[data-scan-progress-spinner="true"]')).toBeInTheDocument()
      expect(screen.queryByText('Take a clear photo of the printed expiration date')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Live expiration date camera feed')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Read Expiration Date' })).not.toBeInTheDocument()
      expect(screen.queryByAltText('Captured expiration date preview')).not.toBeInTheDocument()

      await act(async () => {
        resolveExpiryResponse({
          response: {
            expiry_date: '2026-06-30',
            raw_text: 'EXP 06/30/2026',
            source: 'mock_ocr',
            success: true,
          },
        })
      })

      expect(await screen.findByText('Jun 30, 2026')).toBeInTheDocument()
      expect(screen.getByLabelText('Expiration date')).toHaveValue('2026-06-30')
      expect(screen.getByRole('button', { name: 'Read Expiration Date Again' })).toBeEnabled()
      expect(screen.queryByLabelText('Live expiration date camera feed')).not.toBeInTheDocument()
    } finally {
      mockState.helpers.callService = originalCallService
      canvas.restore()
      camera.restore()
    }
  })

  it('reads expiration dates from Kitchen scan item photos through EverShelf', async () => {
    const camera = setupMockCamera({ videoHeight: 960, videoWidth: 1280 })
    const canvas = setupMockCanvas()

    try {
      render(<DashboardViewPage activePath="kitchen" onNavigate={() => undefined} path="kitchen" />)

      fireEvent.click(screen.getByRole('button', { name: 'Scan Item' }))
      expect(await screen.findByRole('dialog', { name: 'Add Item' })).toBeInTheDocument()
      expect(await screen.findByLabelText('Live item scan camera feed')).toBeInTheDocument()
      await waitFor(() => expect(zxingMock.decodeFromVideoElement).toHaveBeenCalledTimes(1))
      fireEvent.click(screen.getByRole('button', { name: 'Skip Barcode' }))
      expect(screen.getByText('Expiration Date · Step 2 of 3')).toBeInTheDocument()
      expect(screen.queryByText('Enter the expiration date manually, or read it from the camera.')).not.toBeInTheDocument()
      expect(screen.getByText('Take a clear photo of the printed expiration date')).toBeInTheDocument()
      expect(screen.getByText('Center the printed expiration date inside the camera window and keep the label flat.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Back to barcode scan' })).toBeInTheDocument()
      expect(await screen.findByLabelText('Live expiration date camera feed')).toBeInTheDocument()
      expect(screen.queryByText('Quick Expiration Dates')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Manually Enter Expiration Date' })).toBeEnabled()
      await waitFor(() => expect(camera.getUserMedia).toHaveBeenCalledTimes(2))
      fireEvent.click(screen.getByRole('button', { name: 'Back to barcode scan' }))
      expect(screen.getByText('Scan Barcode · Step 1 of 3')).toBeInTheDocument()
      expect(await screen.findByLabelText('Live item scan camera feed')).toBeInTheDocument()
      await waitFor(() => expect(zxingMock.decodeFromVideoElement).toHaveBeenCalledTimes(2))
      expect(camera.getUserMedia).toHaveBeenCalledTimes(2)
      fireEvent.click(screen.getByRole('button', { name: 'Skip Barcode' }))

      expect(await screen.findByLabelText('Live expiration date camera feed')).toBeInTheDocument()
      expect(screen.getByText('Take a clear photo of the printed expiration date')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Manually Enter Expiration Date' })).toBeEnabled()
      await waitFor(() => expect(camera.getUserMedia).toHaveBeenCalledTimes(3))
      fireEvent.click(await screen.findByRole('button', { name: 'Read Expiration Date' }))

      expect(canvas.drawImage).toHaveBeenCalledWith(expect.any(HTMLVideoElement), 0, 120, 1280, 720, 0, 0, 1280, 720)
      expect(canvas.toDataUrl).toHaveBeenCalledWith('image/jpeg')
      await waitFor(() => expect(mockCallServiceCalls).toContainEqual({
        domain: 'evershelf',
        returnResponse: true,
        service: 'read_expiry_image',
        serviceData: { image: canvas.dataUrl },
      }))
      expect(await screen.findByText('Jun 30, 2026')).toBeInTheDocument()
      expect(screen.getByLabelText('Expiration date')).toHaveValue('2026-06-30')
      expect(screen.queryByText('Source: mock_ocr')).not.toBeInTheDocument()
      expect(screen.queryByText('Read: EXP 06/30/2026')).not.toBeInTheDocument()
      expect(screen.queryByText(/EverShelf read/i)).not.toBeInTheDocument()
      expect(screen.queryByText('Center the printed expiration date inside the camera window and keep the label flat.')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Read Expiration Date Again' })).toBeEnabled()
      expect(screen.queryByLabelText('Live expiration date camera feed')).not.toBeInTheDocument()
      expect(screen.getByText('Quick Expiration Dates')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
      expect(screen.queryByAltText('Captured expiration date preview')).not.toBeInTheDocument()
      const modalBody = document.querySelector('[data-modal-sheet-body="true"]') as HTMLElement
      modalBody.scrollTop = 160
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
      expect(screen.getByText('Review Item · Step 3 of 3')).toBeInTheDocument()
      expect(screen.getByText('Confirm the item details before adding it to your pantry.')).toBeInTheDocument()
      expect(modalBody.scrollTop).toBe(0)
      expect(camera.stop).toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Back to expiration date' }))
      expect(screen.getByText('Expiration Date · Step 2 of 3')).toBeInTheDocument()
      expect(screen.getByLabelText('Expiration date')).toHaveValue('2026-06-30')
      expect(screen.queryByLabelText('Live expiration date camera feed')).not.toBeInTheDocument()
      expect(screen.getByText('Quick Expiration Dates')).toBeInTheDocument()
      expect(camera.getUserMedia).toHaveBeenCalledTimes(3)
      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      await waitFor(() => expect(camera.stop).toHaveBeenCalled())
    } finally {
      canvas.restore()
      camera.restore()
    }
  })

  it('selects matching quick expiration dates returned from Kitchen image parsing', async () => {
    const camera = setupMockCamera()
    const canvas = setupMockCanvas()
    const originalCallService = mockState.helpers.callService
    const inOneMonth = testQuickExpirationDateValue('1-month')

    mockState.helpers.callService = (params) => {
      if (params.domain === 'evershelf' && params.service === 'read_expiry_image' && params.returnResponse === true) {
        mockCallServiceCalls.push(params)
        return Promise.resolve({
          response: {
            expiry_date: inOneMonth,
            raw_text: 'BEST BY next month',
            source: 'mock_ocr',
            success: true,
          },
        })
      }
      return originalCallService(params)
    }

    try {
      render(<DashboardViewPage activePath="kitchen" onNavigate={() => undefined} path="kitchen" />)

      fireEvent.click(screen.getByRole('button', { name: 'Scan Item' }))
      expect(await screen.findByRole('dialog', { name: 'Add Item' })).toBeInTheDocument()
      fireEvent.click(await screen.findByRole('button', { name: 'Skip Barcode' }))
      await startAndCaptureExpirationDate()

      expect(await screen.findByLabelText('Expiration date')).toHaveValue(inOneMonth)
      expect(screen.getByRole('radio', { name: 'In 1 Month' })).toBeChecked()
      expect(screen.getByRole('radio', { name: 'In 3 Days' })).not.toBeChecked()
      expect(screen.getByText('Quick Expiration Dates')).toBeInTheDocument()
    } finally {
      mockState.helpers.callService = originalCallService
      canvas.restore()
      camera.restore()
    }
  })

  it('surfaces Gemini rate limits as a manual expiration entry prompt', async () => {
    const camera = setupMockCamera()
    const canvas = setupMockCanvas()
    const originalCallService = mockState.helpers.callService

    mockState.helpers.callService = (params) => {
      if (params.domain === 'evershelf' && params.service === 'read_expiry_image' && params.returnResponse === true) {
        mockCallServiceCalls.push(params)
        return Promise.resolve({
          response: {
            error: 'Gemini API error: HTTP 429 too many requests',
            http_code: 429,
            success: false,
          },
        })
      }
      return originalCallService(params)
    }

    try {
      render(<DashboardViewPage activePath="kitchen" onNavigate={() => undefined} path="kitchen" />)

      fireEvent.click(screen.getByRole('button', { name: 'Scan Item' }))
      expect(await screen.findByRole('dialog', { name: 'Add Item' })).toBeInTheDocument()
      fireEvent.click(await screen.findByRole('button', { name: 'Skip Barcode' }))
      await startAndCaptureExpirationDate()

      expect(await screen.findByText('AI-based expiration date parsing is unavailable. Please enter the expiration date manually or try again later.')).toBeInTheDocument()
      expect(screen.getByLabelText('Expiration date')).toHaveValue('')
      expect(screen.getByRole('button', { name: 'Read Expiration Date' })).toBeEnabled()
      expect(screen.queryByLabelText('Live expiration date camera feed')).not.toBeInTheDocument()
      expect(screen.getByText('Quick Expiration Dates')).toBeInTheDocument()
      await waitFor(() => expect(mockCallServiceCalls).toContainEqual({
        domain: 'evershelf',
        returnResponse: true,
        service: 'read_expiry_image',
        serviceData: { image: canvas.dataUrl },
      }))
    } finally {
      mockState.helpers.callService = originalCallService
      canvas.restore()
      camera.restore()
    }
  })

  it('adds scanned Kitchen items to EverShelf inventory', async () => {
    const camera = setupMockCamera()
    const canvas = setupMockCanvas()

    try {
      render(<DashboardViewPage activePath="kitchen" onNavigate={() => undefined} path="kitchen" />)

      fireEvent.click(screen.getByRole('button', { name: 'Scan Item' }))
      expect(await screen.findByRole('dialog', { name: 'Add Item' })).toBeInTheDocument()
      await waitFor(() => expect(zxingMock.latestCallback).toEqual(expect.any(Function)))

      act(() => {
        zxingMock.latestCallback?.({ getText: () => '3017620422003' }, undefined, { stop: zxingMock.scannerStop })
      })

      expect(await screen.findByLabelText('Product name')).toHaveValue('Nutella')
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
      await startAndCaptureExpirationDate()
      expect(await screen.findByText('Jun 30, 2026')).toBeInTheDocument()
      expect(screen.getByLabelText('Expiration date')).toHaveValue('2026-06-30')
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))

      expect(screen.getByText('Review Item · Step 3 of 3')).toBeInTheDocument()
      expect(screen.getByText('Confirm the item details before adding it to your pantry.')).toBeInTheDocument()
      expect(screen.getByLabelText('Product name')).toHaveValue('Nutella')
      const quantityInput = screen.getByLabelText('Quantity') as HTMLInputElement
      expect(quantityInput.value).toBe('1')
      fireEvent.change(quantityInput, { target: { value: '' } })
      expect(quantityInput.value).toBe('')
      fireEvent.blur(quantityInput)
      expect(screen.getByRole('alert')).toHaveTextContent('Quantity must be at least 1.')
      expect(quantityInput).toHaveAttribute('aria-describedby', 'scan-item-quantity-error')
      expect(quantityInput).toHaveAttribute('aria-invalid', 'true')
      fireEvent.click(screen.getByRole('button', { name: 'Add' }))
      expect(mockCallServiceCalls.some((call) => call.domain === 'evershelf' && call.service === 'add_scanned_item')).toBe(false)
      fireEvent.change(quantityInput, { target: { value: '2' } })
      expect(quantityInput.value).toBe('2')
      expect(screen.queryByText('Quantity must be at least 1.')).not.toBeInTheDocument()
      expect(screen.getByRole('radio', { name: 'Pantry' })).toBeChecked()
      expect(screen.queryByText('Unit of measurement (optional)')).not.toBeInTheDocument()
      expect(screen.getByLabelText('Expiration date')).toHaveValue('2026-06-30')
      fireEvent.click(screen.getByRole('radio', { name: 'Freezer' }))
      expect(screen.getByText('Confirm the item details before adding it to your freezer.')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Add' }))

      expect(screen.getByText('Adding Item')).toBeInTheDocument()
      expect(screen.getByText('Adding to Freezer...')).toBeInTheDocument()

      await waitFor(() => expect(mockCallServiceCalls).toContainEqual(expect.objectContaining({
        domain: 'evershelf',
        returnResponse: true,
        service: 'add_scanned_item',
        serviceData: expect.objectContaining({
          barcode: '3017620422003',
          brand: 'Ferrero',
          expiry_date: '2026-06-30',
          expiry_user_set: true,
          image_url: 'https://example.test/nutella.jpg',
          location: 'freezer',
          name: 'Nutella',
          product_id: 42,
          quantity: 2,
        }),
      })))
      const addCall = mockCallServiceCalls.find((call) => call.domain === 'evershelf' && call.service === 'add_scanned_item')
      expect(addCall?.serviceData).not.toHaveProperty('unit')
      expect(addCall?.serviceData).not.toHaveProperty('package_unit')
      expect(await screen.findByText('Item Added')).toBeInTheDocument()
      expect(screen.getByText('Added to Freezer')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled()
      fireEvent.click(screen.getByRole('button', { name: 'Done' }))
      await waitFor(() => expect(camera.stop).toHaveBeenCalled())
    } finally {
      canvas.restore()
      camera.restore()
    }
  })

  it('loads and explicitly clears prepared-food state for an existing barcode product', async () => {
    const camera = setupMockCamera()
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => {
      if (params.domain === 'evershelf' && params.service === 'resolve_barcode') {
        mockCallServiceCalls.push(params)
        return Promise.resolve({
          response: {
            barcode: '3017620422003',
            found: true,
            product: {
              brand: 'Ferrero',
              id: 42,
              image_url: 'https://example.test/nutella.jpg',
              name: 'Nutella',
              prepared_food: true,
            },
            source: 'mock',
          },
        })
      }
      return originalCallService(params)
    }

    try {
      render(<DashboardViewPage activePath="kitchen" onNavigate={() => undefined} path="kitchen" />)
      fireEvent.click(screen.getByRole('button', { name: 'Scan Item' }))
      await waitFor(() => expect(zxingMock.latestCallback).toEqual(expect.any(Function)))

      act(() => {
        zxingMock.latestCallback?.({ getText: () => '3017620422003' }, undefined, { stop: zxingMock.scannerStop })
      })

      expect(await screen.findByLabelText('Product name')).toHaveValue('Nutella')
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Manually Enter Expiration Date' }))
      fireEvent.click(screen.getByRole('radio', { name: 'In 3 Days' }))
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))

      const preparedButton = screen.getByRole('button', { name: 'Prepared Food Item' })
      expect(preparedButton).toHaveAttribute('aria-pressed', 'true')
      fireEvent.click(preparedButton)
      expect(preparedButton).toHaveAttribute('aria-pressed', 'false')
      fireEvent.click(screen.getByRole('button', { name: 'Add' }))

      await waitFor(() => {
        const addCall = mockCallServiceCalls.find((call) => (
          call.domain === 'evershelf'
          && call.service === 'add_scanned_item'
        ))
        expect(addCall?.serviceData).toMatchObject({
          prepared_food: false,
          product_id: 42,
        })
      })
    } finally {
      mockState.helpers.callService = originalCallService
      camera.restore()
    }
  })

  it('returns to Kitchen scan review with an error when EverShelf add fails', async () => {
    const camera = setupMockCamera()

    try {
      render(<DashboardViewPage activePath="kitchen" onNavigate={() => undefined} path="kitchen" />)

      fireEvent.click(screen.getByRole('button', { name: 'Scan Item' }))
      expect(await screen.findByRole('dialog', { name: 'Add Item' })).toBeInTheDocument()
      await waitFor(() => expect(zxingMock.latestCallback).toEqual(expect.any(Function)))

      act(() => {
        zxingMock.latestCallback?.({ getText: () => '3017620422003' }, undefined, { stop: zxingMock.scannerStop })
      })

      expect(await screen.findByLabelText('Product name')).toHaveValue('Nutella')
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
      expect(await screen.findByLabelText('Live expiration date camera feed')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Manually Enter Expiration Date' }))
      fireEvent.click(screen.getByRole('radio', { name: 'In 3 Days' }))
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
      expect(screen.getByText('Review Item · Step 3 of 3')).toBeInTheDocument()
      fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Fail Item' } })
      fireEvent.click(screen.getByRole('radio', { name: 'Freezer' }))
      fireEvent.click(screen.getByRole('button', { name: 'Add' }))

      expect(screen.getByText('Adding Item')).toBeInTheDocument()
      await waitFor(() => expect(screen.getByText('Review Item · Step 3 of 3')).toBeInTheDocument())
      expect(screen.getByText('Confirm the item details before adding it to your freezer.')).toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent('Mock add failure')
      expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled()
      expect(camera.stop).toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      await waitFor(() => expect(camera.stop).toHaveBeenCalled())
    } finally {
      camera.restore()
    }
  })

  it('uses a singular active bulb icon for single-light room toggles', async () => {
    mockEntities['light.gym_light'] = entity('light.gym_light', 'on')
    render(<DashboardViewPage activePath="gym" onNavigate={() => undefined} path="gym" />)

    fireEvent.click(screen.getByRole('button', { name: /Light/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: 'Toggle Gym lights' })
    expect(toggle.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:lightbulb'))
  })

  it('opens Living Room climate, occupancy, and air quality popups from header chips', async () => {
    const renderLivingRoom = () => render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    let view = renderLivingRoom()
    fireEvent.click(document.querySelector('[data-status-chip="Climate"] button')!)
    let dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getAllByRole('heading', { name: 'Living Room Climate' })).toHaveLength(1)
    expect(within(dialog).getByText('69°F - 72°F')).toBeInTheDocument()
    view.unmount()
    window.history.replaceState(null, '', window.location.pathname)

    view = renderLivingRoom()
    fireEvent.click(document.querySelector('[data-status-chip="Occupancy"] button')!)
    dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getAllByRole('heading', { name: 'Living Room Occupancy' })).toHaveLength(1)
    expect(within(dialog).getByText('Occupied')).toBeInTheDocument()
    view.unmount()
    window.history.replaceState(null, '', window.location.pathname)

    renderLivingRoom()
    fireEvent.click(document.querySelector('[data-status-chip="Air Quality"] button')!)
    dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Living Room Air Quality' })).toBeInTheDocument()
    expect(within(dialog).getByText('1 • 2 μg/m³')).toBeInTheDocument()
    expect(screen.getByText('Fan Modes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Auto Modes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Default' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('Current Readings')).not.toBeInTheDocument()
  })

  it('shows the bed sensor in the Master Bedroom occupancy and climate popups', async () => {
    const renderMasterBedroom = () => render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    let view = renderMasterBedroom()
    fireEvent.click(document.querySelector('[data-status-chip="Occupancy"] button')!)
    let dialog = await screen.findByRole('dialog')
    expect(within(dialog).getAllByRole('article').map((card) => card.getAttribute('aria-label'))).toEqual([
      'Master Bedroom Clear',
      'Bed Clear',
      'Bathroom Clear',
      'Closet Clear',
    ])
    view.unmount()
    window.history.replaceState(null, '', window.location.pathname)

    view = renderMasterBedroom()
    fireEvent.click(document.querySelector('[data-status-chip="Climate"] button')!)
    dialog = await screen.findByRole('dialog')
    expect(within(dialog).getAllByRole('article').map((card) => card.getAttribute('aria-label'))).toEqual([
      'Window 70.0°F',
      'Bed 73.1°F',
      'Bathroom 70.0°F',
      'Closet 70.0°F',
      'Vents Closed',
    ])
    expect(within(dialog).getByRole('article', { name: 'Bed 73.1°F' })).toHaveStyle('--card-rgb: 220 213 17')
    view.unmount()
  })

  it('ports the Guest Room source page with its status chips and reusable popups', async () => {
    const renderGuestRoom = () => render(<DashboardViewPage activePath="guest-room" onNavigate={() => undefined} path="guest-room" />)

    let view = renderGuestRoom()
    expect(screen.getByRole('heading', { name: 'Guest Room' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Room Status' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Lights On$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Climate 69°F - 71°F$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Occupancy Detected$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Occupancy Detected$/i })).toHaveAttribute('data-icon', 'mdi:motion-sensor')
    expect(screen.getByRole('button', { name: /^Window Closed$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Air Quality 1 • 2 μg\/m³$/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Climate' })).toBeInTheDocument()
    const ventCard = screen.getByRole('button', { name: /^Vent Open$/i })
    const airPurifierCard = screen.getByRole('button', { name: /^Air Purifier Auto • On$/i })
    expect(ventCard).toHaveAttribute('data-tone', 'climate')
    expect(ventCard).not.toHaveAttribute('data-size')
    expect(airPurifierCard).toHaveAttribute('data-tone', 'air')
    expect(airPurifierCard).not.toHaveAttribute('data-size')

    fireEvent.click(ventCard)
    let dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('data-size', 'compact')
    expect(within(dialog).getByRole('heading', { name: 'Guest Room: Vent' })).toBeInTheDocument()
    expect(within(dialog).getByRole('article', { name: /^Vent Open$/i })).toBeInTheDocument()
    view.unmount()
    window.history.replaceState(null, '', window.location.pathname)

    view = renderGuestRoom()
    fireEvent.click(screen.getByRole('button', { name: /^Lights On$/i }))
    dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('data-size', 'compact')
    expect(screen.getByRole('heading', { name: 'Guest Room Lights' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /TV Light On/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bed Light Off/i })).toBeInTheDocument()
    view.unmount()
    window.history.replaceState(null, '', window.location.pathname)

    view = renderGuestRoom()
    fireEvent.click(screen.getByRole('button', { name: /^Climate 69°F - 71°F$/i }))
    dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('data-size', 'compact')
    expect(screen.getByRole('heading', { name: 'Guest Room Climate' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Temperature Sensors' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Vent' })).toBeInTheDocument()
    expect(screen.getByText('69.5°F')).toBeInTheDocument()
    expect(screen.getByText('70.2°F')).toBeInTheDocument()
    view.unmount()
    window.history.replaceState(null, '', window.location.pathname)

    view = renderGuestRoom()
    fireEvent.click(screen.getByRole('button', { name: /^Occupancy Detected$/i }))
    dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('data-size', 'compact')
    expect(within(dialog).getByRole('heading', { name: 'Guest Room Occupancy' })).toBeInTheDocument()
    expect(within(dialog).getByText('Detected')).toBeInTheDocument()
    view.unmount()
    window.history.replaceState(null, '', window.location.pathname)

    view = renderGuestRoom()
    fireEvent.click(screen.getByRole('button', { name: /^Window Closed$/i }))
    dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('data-size', 'compact')
    expect(within(dialog).getByRole('heading', { name: 'Guest Room Window' })).toBeInTheDocument()
    expect(within(dialog).queryByText('All Closed')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Guest Room Window: All Closed')).not.toBeInTheDocument()
    const windowRow = within(dialog).getByLabelText('Window Closed')
    expect(windowRow.tagName).toBe('ARTICLE')
    expect(within(dialog).queryByRole('button', { name: /^Window Closed$/i })).not.toBeInTheDocument()
    view.unmount()
    window.history.replaceState(null, '', window.location.pathname)

    renderGuestRoom()
    fireEvent.click(screen.getByRole('button', { name: /^Air Quality 1 • 2 μg\/m³$/i }))
    dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('data-size', 'compact')
    expect(within(dialog).getByRole('heading', { name: 'Guest Room Air Quality' })).toBeInTheDocument()
    expect(within(dialog).getByText('1 • 2 μg/m³')).toBeInTheDocument()
    expect(screen.getByText('Fan Modes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Auto Modes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Default' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('Current Readings')).not.toBeInTheDocument()
  })

  it('uses the clear motion sensor icon for clear occupancy header chips', () => {
    mockEntities['binary_sensor.living_room_occupancy_sensors'].state = 'off'

    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    expect(screen.getByRole('button', { name: /^Occupancy Clear$/i })).toHaveAttribute('data-icon', 'mdi:motion-sensor-off')
  })

  it('runs HASS air purifier mode services from the source popup', async () => {
    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    fireEvent.click(screen.getAllByRole('button', { name: /Air Quality/i })[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Quiet' }))
    fireEvent.click(screen.getByRole('button', { name: 'Manual' }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'select', service: 'select_option', target: 'select.living_room_air_purifier_auto_mode', serviceData: { option: 'Quiet' } },
      { domain: 'select', service: 'select_option', target: 'select.living_room_air_purifier_fan_mode', serviceData: { option: 'Manual' } },
    ])
  })

  it('ports the Admin page sections, descriptions, and presence override modal', async () => {
    render(<DashboardViewPage activePath="admin" onNavigate={() => undefined} path="admin" />)

    expect(screen.getByRole('heading', { name: 'Admin' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Security Controls' })).toBeInTheDocument()
    expect(screen.getByText('Enables automatic locking of the front door. Turn this off temporarily when contractors are over or people are frequently entering and leaving the home.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Front Door Auto-Lock On/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Front Door Auto-Lock On/i })).toHaveStyle({ '--card-rgb': '67 160 71' })
    expect(screen.getByRole('heading', { name: 'Living Room Power Recovery' })).toBeInTheDocument()
    expect(screen.getByText('If the living room switch loses power and comes back with the relay off, run this to temporarily couple the top paddle, unlock the relay, turn power back on, relock it, and return the paddle to decoupled mode.')).toBeInTheDocument()
    const recoveryButton = screen.getByRole('button', { name: 'Attempt to turn power back on in Living Room' })
    expect(recoveryButton).toHaveAttribute('data-automation-target', 'automation.attempt_to_turn_power_back_on_in_living_room')
    expect(recoveryButton).toHaveAttribute('data-action-kind', 'command')
    expect(recoveryButton).not.toHaveAttribute('aria-pressed')
    expect(recoveryButton.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:flash'))
    expect(screen.getByRole('heading', { name: 'Relay Control Mode' })).toBeInTheDocument()
    expect(screen.getByText(/Couples every smart-bulb wall switch to its own relay/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Relay Control Mode Off/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Relay Control Mode Off/i }).querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:toggle-switch'))
    expect(materialIconPath('mdi:toggle-switch')).not.toBe(materialIconPath('mdi:unregistered-icon-fallback-probe'))
    expect(screen.getByRole('heading', { name: 'Presence-Based Light Overrides' })).toBeInTheDocument()
    expect(screen.getByText("Choose whether each room's presence lighting is Enabled, Disabled, Paused, or Quieted. Paused stays fail-dark until resumed; Quieted rearms after the room clears.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Presence-Based Overrides' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Presence-Based Overrides' })).toHaveAttribute('data-tone', 'switch-active')
    expect(screen.getByRole('button', { name: 'Open Presence-Based Overrides' }).querySelector('[data-modal-disclosure="right-chevron"]')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Show Specific Controls' })).toBeInTheDocument()
    expect(screen.getByText("Shows the outdoor faucets in our Home Assistant pages. Useful to disable during the winter, when we aren't using them.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Outdoor Faucets Off/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Christmas Lights Off/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Automatic Presence Setting Overrides' })).toBeInTheDocument()
    expect(screen.getByText("Sometimes, we disable automatic presence-based lighting in rooms that we'd otherwise want to wake up and have that presence-based lighting active.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Presence-Based Auto-Reset Configuration' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Presence-Based Auto-Reset Configuration' })).toHaveAttribute('data-tone', 'switch-active')

    fireEvent.click(screen.getByRole('button', { name: 'Open Presence-Based Overrides' }))
    const presenceDialog = await screen.findByRole('dialog', { name: 'Presence-Based Overrides' })
    expect(presenceDialog).toHaveAttribute('data-surface', 'hass-popup')
    expect(presenceDialog).toHaveAttribute('data-modal-geometry-intent', 'admin-presence-overrides')
    expect(presenceDialog).toHaveStyle({
      '--modal-centered-block-size': '860px',
    })
    expect(screen.getByRole('heading', { name: 'Presence-Based Overrides' })).toBeInTheDocument()
    const livingRoomPresence = within(presenceDialog).getByRole('button', { name: 'Living Room Enabled' })
    expect(livingRoomPresence).toHaveStyle({ '--card-rgb': '67 160 71' })
    expect(livingRoomPresence.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:lightbulb-auto'))
    expect(within(presenceDialog).getByRole('button', { name: 'Upper Deck Enabled' })).toBeInTheDocument()
    fireEvent.click(recoveryButton)
    fireEvent.click(livingRoomPresence)

    const detailPage = await screen.findByRole('dialog', { name: 'Living Room Presence Lighting' })
    expect(detailPage).toBe(presenceDialog)
    expect(detailPage).toHaveAttribute('data-modal-geometry-intent', 'admin-presence-overrides')
    expect(detailPage).toHaveStyle({
      '--modal-centered-block-size': '860px',
    })
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(within(detailPage).getAllByRole('button', { name: /Set Living Room presence lighting to/i })).toHaveLength(4)
    fireEvent.click(within(detailPage).getByRole('button', { name: 'Set Living Room presence lighting to Paused' }))
    expect(within(detailPage).getByRole('button', { name: 'Set Living Room presence lighting to Paused' })).toHaveAttribute('data-active', 'true')

    fireEvent.click(within(detailPage).getByRole('button', { name: 'Back to presence overrides' }))
    await waitFor(() => expect(presenceDialog).toHaveAccessibleName('Presence-Based Overrides'))
    expect(within(presenceDialog).getByRole('button', { name: 'Living Room Enabled' })).toHaveFocus()

    expect(mockCallServiceCalls).toEqual([
      {
        domain: 'automation',
        service: 'trigger',
        target: 'automation.attempt_to_turn_power_back_on_in_living_room',
      },
      {
        domain: 'presence_based_lighting',
        service: 'set_automation_state',
        target: 'switch.living_room_presence_living_room_lights_presence_allowed',
        serviceData: { state: 'paused' },
      },
    ])
  })

  it('warns when global relay control and Guest Room guest mode are both active', () => {
    mockEntities['input_boolean.relay_control_mode'].state = 'on'
    mockEntities['input_boolean.guests_staying_in_guest_room'].state = 'on'

    render(<DashboardViewPage activePath="admin" onNavigate={() => undefined} path="admin" />)

    const relaySection = screen.getByRole('heading', { name: 'Relay Control Mode' }).closest('section')
    const warning = within(relaySection as HTMLElement).getByRole('alert')
    expect(warning).toHaveTextContent('Guest Room guest mode is active. Turning off Relay Control Mode keeps the Guest Room on direct wall control and Guest Bathroom presence lighting off. Turn off Guest Room in Guest Controls to restore normal behavior.')
    expect(warning.parentElement).toHaveAttribute('data-settings-section-controls', 'true')
  })

  it('routes SleepyPod power changes through the Hot Flash broker', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    setupStephenSleepypodLevelControl('bedtime')
    mockEntities['climate.sleepypod_eight_pod_left_side'].state = 'off'
    mockEntities['switch.nightcanvasrestful_left_power'].state = 'off'
    try {
      render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

      fireEvent.click(screen.getByRole('button', { name: /Your Side Off/i }))
      const dialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
      fireEvent.click(within(dialog).getByRole('button', { name: "Turn on Stephen's Bed" }))
      expect(mockCallServiceCalls).toContainEqual({
        domain: 'script',
        service: 'sleepypod_hot_flash_broker',
        serviceData: { action: 'power_heat', side: 'left' },
      })
      fireEvent.click(within(dialog).getByRole('button', { name: "Turn off Stephen's Bed" }))
      expect(confirm).toHaveBeenCalledWith("Turn off Stephen's Bed?")
      expect(mockCallServiceCalls).toContainEqual({
        domain: 'script',
        service: 'sleepypod_hot_flash_broker',
        serviceData: { action: 'power_off', side: 'left' },
      })
    } finally {
      confirm.mockRestore()
    }
  })

  it.each([
    ['off', 'off'],
    ['on', 'off'],
    ['off', 'on'],
  ])('hides the relay guest-mode warning when relay=%s and guest=%s', (relayState, guestState) => {
    mockEntities['input_boolean.relay_control_mode'].state = relayState
    mockEntities['input_boolean.guests_staying_in_guest_room'].state = guestState

    render(<DashboardViewPage activePath="admin" onNavigate={() => undefined} path="admin" />)

    expect(screen.queryByText(/Guest Room guest mode is active/)).not.toBeInTheDocument()
  })

  it('keeps the Presence Override detail page stable while closing and resets on reopen', async () => {
    render(<DashboardViewPage activePath="admin" onNavigate={() => undefined} path="admin" />)

    fireEvent.click(screen.getByRole('button', { name: 'Open Presence-Based Overrides' }))
    let dialog = await screen.findByRole('dialog', { name: 'Presence-Based Overrides' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Master Bedroom Enabled' }))

    dialog = await screen.findByRole('dialog', { name: 'Master Bedroom Presence Lighting' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(dialog).toHaveAttribute('data-state', 'closed')
    expect(within(dialog).getByRole('heading', { hidden: true, name: 'Master Bedroom Presence Lighting' })).toBeInTheDocument()

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Master Bedroom Presence Lighting' })).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Open Presence-Based Overrides' }))
    expect(await screen.findByRole('dialog', { name: 'Presence-Based Overrides' })).toBeInTheDocument()
  })

  it('opens the Admin auto-reset modal and toggles room auto re-enable switches', async () => {
    render(<DashboardViewPage activePath="admin" onNavigate={() => undefined} path="admin" />)

    fireEvent.click(screen.getByRole('button', { name: 'Open Presence-Based Auto-Reset Configuration' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Presence-Based Overrides Auto-Reset' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Living Room On/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Living Room On/i })).toHaveStyle({ '--card-rgb': '67 160 71' })
    expect(screen.getByRole('button', { name: /Living Room On/i }).querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:autorenew'))
    expect(screen.getByRole('button', { name: /Upper Deck On/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Kitchen On/i }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'homeassistant', service: 'toggle', target: 'switch.kitchen_auto_re_enable_presence_lighting' },
    ])
  })

  it('ports the Settings tab as the source row list with exact navigation targets', () => {
    const navigate = vi.fn()
    render(<DashboardViewPage activePath="settings" onNavigate={navigate} path="settings" />)

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Settings pages' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pages' })).not.toBeInTheDocument()
    expect(screen.queryByText('Groceries')).not.toBeInTheDocument()
    expect(screen.queryByText('Custom Lights')).not.toBeInTheDocument()

    const page = screen.getByRole('main')
    const settingsHeading = screen.getByRole('heading', { name: 'Settings' })
    const [, scroller] = Array.from(page.children)
    expect(page.firstElementChild).toContainElement(settingsHeading)
    expect(scroller).not.toContainElement(settingsHeading)

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Security' }))
    expect(navigate).toHaveBeenLastCalledWith('security')

    const admin = screen.getByRole('button', { name: /Admin Controls Presence-Based Toggles, Automation Overrides, and More/i })
    expect(admin.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:shield-account'))
    expect(admin).toHaveAttribute('data-action-kind', 'navigate')
    expect(admin).toHaveAttribute('data-navigation-opener', 'true')
    expect(admin.querySelector('[data-modal-disclosure="right-chevron"]')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Settings pages' }).firstElementChild).toBe(admin)
    fireEvent.click(admin)
    expect(navigate).toHaveBeenLastCalledWith('admin')

    const specialDeviceModes = screen.getByRole('button', { name: /Special Device Modes Allows enabling special device modes, such as High AQI Mode\./i })
    expect(specialDeviceModes.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:tune-vertical'))
    expect(specialDeviceModes).toHaveAttribute('data-action-kind', 'navigate')
    expect(specialDeviceModes).toHaveAttribute('data-navigation-opener', 'true')
    expect(specialDeviceModes.querySelector('[data-modal-disclosure="right-chevron"]')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Settings pages' }).children[1]).toBe(specialDeviceModes)
    fireEvent.click(specialDeviceModes)
    expect(navigate).toHaveBeenLastCalledWith('special-device-modes')

    fireEvent.click(screen.getByRole('button', { name: /Guest Controls Toggle automations when guests stay over\./i }))
    expect(navigate).toHaveBeenLastCalledWith('guests-staying-over')

    const vacation = screen.getByRole('button', { name: /Vacation Set away dates and prepare the house for vacation\./i })
    expect(vacation.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:airplane'))
    fireEvent.click(vacation)
    expect(navigate).toHaveBeenLastCalledWith('vacation')

    fireEvent.click(screen.getByRole('button', { name: /To-Do An admin panel for to-do tasks\./i }))
    expect(navigate).toHaveBeenLastCalledWith('to-do')

    const machE = screen.getByRole('button', { name: /Mach-E Controls for the Mustang Mach-E\./i })
    expect(machE.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:car-estate'))
    fireEvent.click(machE)
    expect(navigate).toHaveBeenLastCalledWith('mach-e')

    const hassSettings = screen.getByRole('button', { name: /Home Assistant Settings Access more in-depth Home Assistant details and settings\./i })
    expect(hassSettings).toHaveAttribute('data-action-kind', 'external')
    expect(hassSettings).toHaveAttribute('data-external-path', '/config')
    expect(hassSettings.querySelector('[data-surface-accessory="external"]')).toBeInTheDocument()
    expect(hassSettings.querySelector('[data-modal-disclosure]')).not.toBeInTheDocument()
  })

  it('renders Special Device Modes as an optimistic typed High AQI toggle', () => {
    const view = render(<DashboardViewPage activePath="special-device-modes" onNavigate={() => undefined} path="special-device-modes" />)

    expect(screen.getByRole('heading', { name: 'Special Device Modes' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'High AQI Mode' })).toBeInTheDocument()
    expect(screen.getByText('Toggling High AQI Mode sets all air purifiers in the house to their highest setting to ward off smoke and other inhalation hazards.')).toBeInTheDocument()

    const disabledMode = screen.getByRole('switch', { name: 'High AQI Mode Off' })
    expect(disabledMode).toHaveAttribute('aria-checked', 'false')
    expect(disabledMode).toHaveAttribute('data-action-kind', 'toggle')
    expect(disabledMode.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:air-purifier'))
    expect(disabledMode.querySelector('[data-modal-disclosure]')).not.toBeInTheDocument()

    fireEvent.click(disabledMode)
    expect(disabledMode).toHaveAttribute('aria-checked', 'true')
    expect(mockCallServiceCalls).toEqual([
      { domain: 'input_boolean', service: 'turn_on', target: 'input_boolean.high_aqi_mode' },
    ])

    mockEntities['input_boolean.high_aqi_mode'].state = 'on'
    view.rerender(<DashboardViewPage activePath="special-device-modes" onNavigate={() => undefined} path="special-device-modes" />)

    const enabledMode = screen.getByRole('switch', { name: 'High AQI Mode On' })
    expect(enabledMode).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(enabledMode)
    expect(enabledMode).toHaveAttribute('aria-checked', 'false')
    expect(mockCallServiceCalls).toEqual([
      { domain: 'input_boolean', service: 'turn_on', target: 'input_boolean.high_aqi_mode' },
      { domain: 'input_boolean', service: 'turn_off', target: 'input_boolean.high_aqi_mode' },
    ])
  })

  it('disables High AQI Mode when its Home Assistant helper is unavailable', () => {
    mockEntities['input_boolean.high_aqi_mode'].state = 'unavailable'

    render(<DashboardViewPage activePath="special-device-modes" onNavigate={() => undefined} path="special-device-modes" />)

    const mode = screen.getByRole('switch', { name: 'High AQI Mode Unavailable' })
    expect(mode).toBeDisabled()
    expect(mode).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(mode)
    expect(mockCallServiceCalls).toEqual([])
  })

  it('preloads Special Device Modes as inert card geometry', () => {
    render(<DashboardViewPage activePath="special-device-modes" onNavigate={() => undefined} path="special-device-modes" preload />)

    expect(screen.getByRole('article', { name: 'High AQI Mode' })).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: /High AQI Mode/i })).not.toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([])
  })

  it('keeps the Settings bottom nav item active on settings subpages', () => {
    render(<DashboardViewPage activePath="special-device-modes" onNavigate={() => undefined} path="special-device-modes" />)

    const bottomNav = document.querySelector('[data-adaptive-navigation="bottom"]')!
    expect(within(bottomNav).getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-current', 'page')
  })

  it('renders the Vacation page and blocks Vacation Mode until the checklist is complete', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 14, 10, 1, 0))
    const navigate = vi.fn()

    try {
      render(<DashboardViewPage activePath="settings" onNavigate={navigate} path="vacation-mode" />)

      expect(screen.getByRole('button', { name: 'Vacation Mode Off' })).toBeInTheDocument()
      expect(screen.getByText('Enable or disable vacation mode for the house')).toBeInTheDocument()
      expect(screen.getByText('Enable or disable vacation mode for the house')).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Vacation Dates' })).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Pre-Vacation Checklist' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Turn off outdoor sprinklers' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Pour boiling water down the drain' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Make the bed' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Unload and Check Dishwasher' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Trash and Recycles taken out' })).toBeInTheDocument()

      const vacationMode = screen.getByRole('button', { name: 'Vacation Mode Off' })
      expect(vacationMode).toHaveStyle({ '--card-rgb': '67 160 71' })
      expect(vacationMode).toHaveAttribute('aria-pressed', 'false')
      expect(vacationMode).toHaveAttribute('data-muted', 'true')
      expect(vacationMode.className).toContain('wide')
      expect(vacationMode.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:airplane'))

      fireEvent.click(vacationMode)
      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent('All pre-vacation tasks must be checked off before Vacation Mode can be enabled.')
      expect(alert.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:alert-circle'))
      expect(mockCallServiceCalls).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows Vacation Mode as pending until valid vacation dates are confirmed', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 14, 10, 1, 0))
    setVacationChecklistMockState('on')
    mockEntities['sensor.household_away_status'].state = 'unavailable'

    try {
      render(<DashboardViewPage activePath="settings" onNavigate={() => undefined} path="vacation-mode" />)

      const vacationMode = screen.getByRole('button', { name: 'Vacation Mode Off' })
      fireEvent.click(vacationMode)

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { hidden: true, name: 'Vacation Mode Pending' })).toHaveStyle({ '--card-rgb': '30 136 229' })
      expect(screen.getByRole('button', { hidden: true, name: 'Vacation Mode Pending' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.queryByRole('heading', { name: 'Vacation Dates' })).not.toBeInTheDocument()
      const dialog = screen.getByRole('dialog', { name: 'Confirm Vacation' })
      expect(dialog.querySelector('[data-schedule-confirmation-form="true"]')).toBeInTheDocument()
      expect(dialog.querySelector('[data-schedule-confirmation-fields="true"]')).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'Confirm Vacation' })).toHaveAttribute('data-variant', 'primary')
      expect(within(dialog).getByLabelText('Start Date')).toHaveValue('2026-06-14')
      expect(within(dialog).getByLabelText('Start Time')).toHaveValue('10:01')
      expect(within(dialog).getByLabelText('End Date')).toHaveValue('2026-06-15')
      expect(within(dialog).getByLabelText('End Time')).toHaveValue('10:01')
      expect(mockCallServiceCalls).toEqual([])

      fireEvent.change(within(dialog).getByLabelText('End Time'), { target: { value: '18:30' } })
      expect(mockCallServiceCalls).toEqual([])
      fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm Vacation' }))

      expect(mockCallServiceCalls).toEqual([
        { domain: 'input_datetime', service: 'set_datetime', target: 'input_datetime.vacation_start', serviceData: { date: '2026-06-14', time: '10:01:00' } },
        { domain: 'input_datetime', service: 'set_datetime', target: 'input_datetime.vacation_end', serviceData: { date: '2026-06-15', time: '18:30:00' } },
        { domain: 'input_boolean', service: 'turn_off', target: 'input_boolean.vacation_mode_invalid_dates_pending' },
        { domain: 'input_boolean', service: 'turn_on', target: 'input_boolean.vacation_mode' },
      ])
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the Pre-Vacation checklist visible while checked items toggle Home Assistant booleans', () => {
    mockEntities['input_boolean.vacation_checklist_pour_boiling_water_down_the_drain'].state = 'on'
    render(<DashboardViewPage activePath="settings" onNavigate={() => undefined} path="vacation-mode" />)

    expect(screen.getByRole('heading', { name: 'Pre-Vacation Checklist' })).toBeInTheDocument()
    const sprinklers = screen.getByRole('button', { name: 'Turn off outdoor sprinklers' })
    const drain = screen.getByRole('button', { name: 'Pour boiling water down the drain' })

    fireEvent.click(sprinklers)
    fireEvent.click(drain)

    expect(sprinklers).toHaveAttribute('aria-pressed', 'true')
    expect(drain).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Make the bed')).toBeInTheDocument()
    expect(screen.getByText('Unload and Check Dishwasher')).toBeInTheDocument()
    expect(screen.getByText('Trash and Recycles taken out')).toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([
      { domain: 'input_boolean', service: 'turn_on', target: 'input_boolean.vacation_checklist_turn_off_outdoor_sprinklers' },
      { domain: 'input_boolean', service: 'turn_off', target: 'input_boolean.vacation_checklist_pour_boiling_water_down_the_drain' },
    ])
  })

  it('shows Vacation date native inputs when Vacation Mode is on and updates HASS helpers', () => {
    mockEntities['input_boolean.vacation_mode'].state = 'on'
    render(<DashboardViewPage activePath="settings" onNavigate={() => undefined} path="vacation" />)

    expect(screen.queryByRole('heading', { name: 'Pre-Vacation Checklist' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Vacation Dates' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm Vacation' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Vacation Controls' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Disable Home Tasks/i })).not.toBeInTheDocument()
    expect(screen.getByText('Set the start and end time for your vacation. Vacation mode will automatically be turned off at the set end date and time.')).toBeInTheDocument()
    expect(screen.getByLabelText('Start Date')).toHaveAttribute('type', 'date')
    expect(screen.getByLabelText('Start Time')).toHaveAttribute('type', 'time')
    expect(screen.getByLabelText('End Date')).toHaveAttribute('type', 'date')
    expect(screen.getByLabelText('End Time')).toHaveAttribute('type', 'time')
    expect(screen.getByLabelText('Start Date')).toHaveValue('2026-06-14')
    expect(screen.getByLabelText('Start Time')).toHaveValue('10:01')
    expect(screen.getByLabelText('End Date')).toHaveValue('2026-06-15')
    expect(screen.getByLabelText('End Time')).toHaveValue('10:01')

    const originalShowPicker = HTMLInputElement.prototype.showPicker
    const showPicker = vi.fn()
    Object.defineProperty(HTMLInputElement.prototype, 'showPicker', { configurable: true, value: showPicker })
    try {
      fireEvent.click(screen.getByText('Start Date'))
      expect(showPicker).toHaveBeenCalledTimes(1)
    } finally {
      if (originalShowPicker) Object.defineProperty(HTMLInputElement.prototype, 'showPicker', { configurable: true, value: originalShowPicker })
      else Reflect.deleteProperty(HTMLInputElement.prototype, 'showPicker')
    }

    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-06-20' } })
    fireEvent.change(screen.getByLabelText('End Time'), { target: { value: '18:30' } })

    expect(mockCallServiceCalls).toEqual([
      { domain: 'input_datetime', service: 'set_datetime', target: 'input_datetime.vacation_start', serviceData: { date: '2026-06-20', time: '10:01:00' } },
      { domain: 'input_datetime', service: 'set_datetime', target: 'input_datetime.vacation_end', serviceData: { date: '2026-06-15', time: '18:30:00' } },
    ])
  })

  it('resets the Pre-Vacation checklist when Vacation Mode turns off', () => {
    mockEntities['input_boolean.vacation_mode'].state = 'on'
    mockEntities['sensor.household_away_status'].state = 'unavailable'
    mockEntities['input_boolean.vacation_checklist_turn_off_outdoor_sprinklers'].state = 'on'
    mockEntities['input_boolean.vacation_checklist_pour_boiling_water_down_the_drain'].state = 'on'
    mockEntities['input_boolean.vacation_checklist_make_the_bed'].state = 'on'
    mockEntities['input_boolean.vacation_checklist_unload_and_check_dishwasher'].state = 'on'
    mockEntities['input_boolean.vacation_checklist_trash_and_recycles_taken_out'].state = 'on'
    render(<DashboardViewPage activePath="settings" onNavigate={() => undefined} path="vacation" />)

    fireEvent.click(screen.getByRole('button', { name: 'Vacation Mode On' }))

    expect(screen.getByRole('heading', { name: 'Pre-Vacation Checklist' })).toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([
      { domain: 'input_boolean', service: 'turn_off', target: 'input_boolean.vacation_mode' },
      { domain: 'input_boolean', service: 'turn_off', target: 'input_boolean.vacation_mode_invalid_dates_pending' },
      { domain: 'input_boolean', service: 'turn_off', target: 'input_boolean.vacation_checklist_turn_off_outdoor_sprinklers' },
      { domain: 'input_boolean', service: 'turn_off', target: 'input_boolean.vacation_checklist_pour_boiling_water_down_the_drain' },
      { domain: 'input_boolean', service: 'turn_off', target: 'input_boolean.vacation_checklist_make_the_bed' },
      { domain: 'input_boolean', service: 'turn_off', target: 'input_boolean.vacation_checklist_unload_and_check_dishwasher' },
      { domain: 'input_boolean', service: 'turn_off', target: 'input_boolean.vacation_checklist_trash_and_recycles_taken_out' },
    ])
  })

  it('shows invalid Vacation dates as an on but disabled mode with editable date controls', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 14, 8, 0, 0))
    mockEntities['input_boolean.vacation_mode'].state = 'off'
    mockEntities['input_boolean.vacation_mode_invalid_dates_pending'].state = 'on'
    mockEntities['input_datetime.vacation_start'].state = '2026-06-14 10:01:00'
    mockEntities['input_datetime.vacation_end'].state = '2026-06-13 09:07:00'

    try {
      render(<DashboardViewPage activePath="settings" onNavigate={() => undefined} path="vacation" />)

      const vacationMode = screen.getByRole('button', { name: 'Vacation Mode On' })
      expect(vacationMode).toBeDisabled()
      expect(vacationMode).toHaveAttribute('aria-pressed', 'true')
      expect(vacationMode).toHaveAttribute('data-disabled', 'true')
      expect(vacationMode).toHaveAttribute('data-muted', 'true')
      expect(screen.getByRole('heading', { name: 'Vacation Dates' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Confirm Vacation' })).not.toBeInTheDocument()
      expect(screen.getByText('Start date and time must be before end date and time. Vacation mode is disabled until the dates are fixed.')).toBeInTheDocument()
      expect(screen.getByLabelText('Start Date')).toHaveValue('2026-06-14')
      expect(screen.getByLabelText('Start Time')).toHaveValue('10:01')
      expect(screen.getByLabelText('End Date')).toHaveValue('2026-06-13')
      expect(screen.getByLabelText('End Time')).toHaveValue('09:07')

      fireEvent.click(vacationMode)
      fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2026-06-15' } })

      expect(mockCallServiceCalls).toEqual([
        { domain: 'input_datetime', service: 'set_datetime', target: 'input_datetime.vacation_end', serviceData: { date: '2026-06-15', time: '09:07:00' } },
        { domain: 'input_boolean', service: 'turn_on', target: 'input_boolean.vacation_mode' },
        { domain: 'input_boolean', service: 'turn_off', target: 'input_boolean.vacation_mode_invalid_dates_pending' },
      ])
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps corrected pending-invalid Vacation Mode visible while backend mode turns back on', () => {
    mockEntities['input_boolean.vacation_mode'].state = 'off'
    mockEntities['input_boolean.vacation_mode_invalid_dates_pending'].state = 'on'
    mockEntities['input_datetime.vacation_start'].state = '2026-06-14 10:01:00'
    mockEntities['input_datetime.vacation_end'].state = '2026-06-15 09:07:00'

    render(<DashboardViewPage activePath="settings" onNavigate={() => undefined} path="vacation" />)

    const vacationMode = screen.getByRole('button', { name: 'Vacation Mode On' })
    expect(vacationMode).not.toBeDisabled()
    expect(vacationMode).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'Vacation Dates' })).toBeInTheDocument()
    expect(screen.queryByText('Start date and time must be before end date and time. Vacation mode is disabled until the dates are fixed.')).not.toBeInTheDocument()
  })

  it('ports the Guest Controls page with source text, icons, states, and toggle actions', () => {
    mockEntities['input_boolean.guests_staying_in_guest_room'].state = 'off'
    mockEntities['input_boolean.guests_staying_in_music_room'].state = 'on'
    mockEntities['input_boolean.guests_staying_in_theater_room'].state = 'off'
    const navigate = vi.fn()

    render(<DashboardViewPage activePath="settings" onNavigate={navigate} path="guests-staying-over" />)

    expect(screen.getByRole('heading', { name: 'Guest Controls', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Guests Staying Over' })).not.toBeInTheDocument()
    expect(screen.getByText("When guests stay over, toggle these controls on based on the rooms they're staying in to disable automations (like automatic vacuuming in the music room) and ensure that rooms are tracked for temperature monitoring and vent control.")).toBeInTheDocument()

    const page = screen.getByRole('main')
    const guestHeading = screen.getByRole('heading', { name: 'Guest Controls', level: 1 })
    const guestSectionHeading = screen.getByRole('heading', { name: 'Guest Controls', level: 2 })
    const guestSection = guestSectionHeading.closest('section')
    expect(guestSection).toHaveClass(/section/)
    expect(guestSection?.parentElement).toHaveClass(/stack/)
    const guestGrid = screen.getByRole('group', { name: 'Guest controls' })
    expect(Array.from(guestGrid.children).map((cell) => cell.getAttribute('data-dynamic-grid-span'))).toEqual(['1', '1', '2'])
    const [, scroller] = Array.from(page.children)
    expect(page.firstElementChild).toContainElement(guestHeading)
    expect(scroller).not.toContainElement(guestHeading)

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
    expect(navigate).toHaveBeenCalledWith('settings')

    const guestRoom = screen.getByRole('button', { name: /Guest Room Off/i })
    expect(guestRoom).toHaveAttribute('aria-pressed', 'false')
    expect(guestRoom.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:bed'))

    const musicRoom = screen.getByRole('button', { name: /Music Room On/i })
    expect(musicRoom).toHaveAttribute('aria-pressed', 'true')
    expect(musicRoom).toHaveStyle({ '--card-rgb': '67 160 71' })
    expect(musicRoom.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:guitar-electric'))

    const theaterRoom = screen.getByRole('button', { name: /Theater Room Off/i })
    expect(theaterRoom.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:projector'))
    fireEvent.click(theaterRoom)

    expect(mockCallServiceCalls).toEqual([
      { domain: 'homeassistant', service: 'toggle', target: 'input_boolean.guests_staying_in_theater_room' },
    ])
  })

  it('uses the no-gap dynamic grid for thermostat room selection', async () => {
    render(<DashboardViewPage activePath="thermostat" onNavigate={() => undefined} path="thermostat" />)

    const dialog = await openThermostatControls()
    expect(within(dialog).getByRole('heading', { name: 'Thermostat · Advanced Controls' })).toBeInTheDocument()
    expect(within(dialog).queryByText(/11 rooms/i)).not.toBeInTheDocument()
    const roomGrid = within(dialog).getByRole('group', { name: 'Thermostat rooms' })
    expect(roomGrid.children).toHaveLength(11)
    expect(roomGrid).toHaveAttribute('data-dynamic-grid-item-sizing', 'content-aware')
    expect(roomGrid.lastElementChild).toHaveAttribute('data-dynamic-grid-span', '2')
  })

  it('uses the active thermostat icon for occupied rooms', async () => {
    const occupancy = mockEntities['sensor.thermostat_contact_sensors_living_room_occupancy']
    const previousState = occupancy.state
    occupancy.state = 'occupied'
    const view = render(<DashboardViewPage activePath="thermostat" onNavigate={() => undefined} path="thermostat" />)

    const dialog = await openThermostatControls()
    const livingRoom = within(dialog).getByRole('button', { name: 'Living Room 70.2°F · Occupied' })
    expect(livingRoom.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:thermometer-check'))
    view.unmount()
    occupancy.state = previousState
  })

  it('keeps the Whole Home thermostat range colors visible while the aggregate climate is off', () => {
    render(<DashboardViewPage activePath="thermostat" onNavigate={() => undefined} path="thermostat" />)

    expect(screen.getByRole('region', { name: /Whole Home thermostat Idle 71.0°F 72.0 · 74.0/i })).toBeInTheDocument()
    expect(screen.getAllByTestId('control-slider-circular')[0]).toHaveStyle({ '--ha-control-slider-color': 'rgba(255, 255, 255, 0.78)', '--ha-control-slider-high-color': '#2c8e98', '--ha-control-slider-low-color': '#cd5401' })
    expect(screen.getAllByTestId('control-slider-circular')[0]).toHaveAttribute('data-inactive', 'false')
  })

  it('drags a thermostat range handle and commits the final value once', () => {
    render(<DashboardViewPage activePath="thermostat" onNavigate={() => undefined} path="thermostat" />)

    const dial = screen.getByRole('region', { name: /Whole Home thermostat Idle 71.0°F 72.0 · 74.0/i })
    const lowHandle = dial.querySelector<HTMLElement>('[data-target="low"]')
    const dialRect = {
      bottom: 500,
      height: 300,
      left: 100,
      right: 400,
      top: 200,
      width: 300,
      x: 100,
      y: 200,
      toJSON: () => ({}),
    } as DOMRect
    const clientPoint = (value: number) => {
      const point = valueToThermostatPoint(value, 45, 95)
      return {
        clientX: dialRect.left + (point.x / 100) * dialRect.width,
        clientY: dialRect.top + (point.y / 100) * dialRect.height,
      }
    }
    const rectSpy = vi.spyOn(dial, 'getBoundingClientRect').mockReturnValue(dialRect)

    try {
      fireEvent.pointerDown(lowHandle!, { ...clientPoint(72), pointerId: 41 })
      expect(lowHandle).toHaveAttribute('data-dragging', 'true')

      fireEvent.pointerMove(lowHandle!, { ...clientPoint(70), pointerId: 41 })
      fireEvent.pointerUp(lowHandle!, { ...clientPoint(70), pointerId: 41 })

      expect(lowHandle).not.toHaveAttribute('data-dragging')
      expect(mockCallServiceCalls).toHaveLength(1)
      expect(mockCallServiceCalls[0]).toMatchObject({
        domain: 'climate',
        service: 'set_temperature',
        serviceData: { target_temp_high: 74, target_temp_low: 70 },
      })
    } finally {
      rectSpy.mockRestore()
    }
  })

  it('renders HA-owned vacation, non-vacation, and guest home-away transitions without inferring from raw inputs', async () => {
    const view = render(<DashboardViewPage activePath="thermostat" onNavigate={() => undefined} path="thermostat" />)

    expect(screen.queryByLabelText(/Whole Home (?:Away|Vacation) Mode/)).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Whole Home thermostat Idle 71.0°F 72.0 · 74.0/i })).toBeInTheDocument()

    mockEntities['input_boolean.vacation_mode'].state = 'on'
    mockEntities['binary_sensor.thermostat_contact_sensors_away_mode_active'].state = 'on'
    mockEntities['sensor.thermostat_effective_home_away'].state = 'Away'
    mockEntities['sensor.thermostat_home_away_reason'].state = 'Vacation Mode is active and everyone is away; TCS is using Eco Away targets.'
    view.rerender(<DashboardViewPage activePath="thermostat" onNavigate={() => undefined} path="thermostat" />)

    const hero = screen.getByRole('region', { name: /Whole Home thermostat Idle 71.0°F 62.0 · 78.0/i })
    expect(hero.querySelector('[data-marker="current"]')).toHaveAttribute('data-value', '71')
    const hub = screen.getByLabelText('Thermostat Hub Off')
    const vacationMode = screen.getByLabelText('Whole Home Vacation Mode')
    expect(screen.getByText('Vacation Mode Active. The room may be cooler or warmer than your heat/cool targets to save energy while away.')).toBeInTheDocument()
    expect(hero.compareDocumentPosition(hub) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(hub.compareDocumentPosition(vacationMode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const awayTargetSliders = screen.getAllByRole('slider', { name: 'Whole Home target temperature' })
    fireEvent.change(awayTargetSliders[0], { target: { value: '63' } })
    fireEvent.pointerUp(awayTargetSliders[0])
    expect(mockCallServiceCalls).toEqual([{
      domain: 'climate',
      service: 'set_temperature',
      serviceData: { target_temp_high: 78, target_temp_low: 63 },
      target: 'climate.thermostat_contact_sensors_eco_away_virtual_thermostat',
    }])
    mockCallServiceCalls.length = 0

    mockEntities['input_boolean.vacation_mode'].state = 'off'
    mockEntities['sensor.thermostat_home_away_reason'].state = 'Everyone is away; TCS is keeping Eco active without heating or cooling.'
    view.rerender(<DashboardViewPage activePath="thermostat" onNavigate={() => undefined} path="thermostat" />)

    expect(screen.getByRole('region', { name: /Whole Home thermostat Idle 71.0°F 63.0 · 78.0/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Whole Home Away Mode')).toBeInTheDocument()
    expect(screen.getByText('Away Mode Active. The room may be cooler or warmer than your heat/cool targets to save energy while away.')).toBeInTheDocument()

    mockEntities['input_boolean.vacation_mode'].state = 'on'
    mockEntities['sensor.thermostat_effective_home_away'].state = 'Home'
    mockEntities['sensor.thermostat_home_away_reason'].state = 'Guest stay protection is active during Vacation Mode, so TCS is enforcing home-style temperatures.'
    mockEntities['climate.thermostat_contact_sensors_living_room_virtual_thermostat'].attributes.away_mode_active = false
    view.rerender(<DashboardViewPage activePath="thermostat" onNavigate={() => undefined} path="thermostat" />)

    expect(screen.queryByLabelText(/Whole Home (?:Away|Vacation) Mode/)).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Whole Home thermostat Idle 71.0°F 72.0 · 74.0/i })).toBeInTheDocument()
    const thermostatDialog = await openThermostatControls()
    fireEvent.click(within(thermostatDialog).getByRole('button', { name: 'Living Room 70.2°F · Inactive' }))
    const dialog = await screen.findByRole('dialog', { name: 'Living Room' })
    expect(within(dialog).queryByLabelText(/effective thermostat mode Away/i)).not.toBeInTheDocument()
    expect(within(dialog).queryByText(/(?:Away|Vacation) Mode/i)).not.toBeInTheDocument()
  })

  it('keeps main and room dial ranges and handle positions correct after Vacation Mode ends', async () => {
    const expectRangeHandlePositions = (dial: HTMLElement, low: number, high: number) => {
      const lowPoint = valueToThermostatPoint(low, 45, 95)
      const highPoint = valueToThermostatPoint(high, 45, 95)
      const lowHandle = dial.querySelector<HTMLElement>('[data-target="low"]')
      const highHandle = dial.querySelector<HTMLElement>('[data-target="high"]')

      expect(lowHandle).not.toBeNull()
      expect(highHandle).not.toBeNull()
      expect(lowHandle!).toHaveStyle({
        '--thermostat-handle-x': `${lowPoint.x}%`,
        '--thermostat-handle-y': `${lowPoint.y}%`,
      })
      expect(highHandle!).toHaveStyle({
        '--thermostat-handle-x': `${highPoint.x}%`,
        '--thermostat-handle-y': `${highPoint.y}%`,
      })
    }

    mockEntities['input_boolean.vacation_mode'].state = 'on'
    mockEntities['binary_sensor.thermostat_contact_sensors_away_mode_active'].state = 'on'
    mockEntities['sensor.thermostat_effective_home_away'].state = 'Away'
    mockEntities['sensor.thermostat_home_away_reason'].state = 'Vacation Mode is active and everyone is away; TCS is keeping Eco active without heating or cooling.'
    mockEntities['climate.thermostat_contact_sensors_living_room_virtual_thermostat'].attributes.away_mode_active = true
    const view = render(<DashboardViewPage activePath="thermostat" onNavigate={() => undefined} path="thermostat" />)

    let wholeHomeDial = screen.getByRole('region', { name: /Whole Home thermostat Idle 71.0°F 62.0 · 78.0/i })
    expectRangeHandlePositions(wholeHomeDial, 62, 78)
    expect(screen.getByLabelText('Whole Home Vacation Mode')).toBeInTheDocument()

    const thermostatDialog = await openThermostatControls()
    fireEvent.click(within(thermostatDialog).getByRole('button', { name: 'Living Room 70.2°F · Inactive' }))
    const dialog = await screen.findByRole('dialog', { name: 'Living Room' })
    let roomDial = within(dialog).getByRole('region', { name: /Living Room thermostat Idle 70.2°F 72.0 · 74.0/i })
    expectRangeHandlePositions(roomDial, 72, 74)
    expect(within(dialog).getByLabelText('Living Room Vacation Mode')).toBeInTheDocument()

    mockEntities['input_boolean.vacation_mode'].state = 'off'
    mockEntities['sensor.thermostat_home_away_reason'].state = 'Everyone is away; TCS is keeping Eco active without heating or cooling.'
    view.rerender(<DashboardViewPage activePath="thermostat" onNavigate={() => undefined} path="thermostat" />)

    wholeHomeDial = screen.getByRole('region', { hidden: true, name: /Whole Home thermostat Idle 71.0°F 62.0 · 78.0/i })
    roomDial = within(dialog).getByRole('region', { name: /Living Room thermostat Idle 70.2°F 72.0 · 74.0/i })
    expectRangeHandlePositions(wholeHomeDial, 62, 78)
    expectRangeHandlePositions(roomDial, 72, 74)
    expect(screen.getByLabelText('Whole Home Away Mode')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Living Room Away Mode')).toBeInTheDocument()

    mockEntities['binary_sensor.thermostat_contact_sensors_away_mode_active'].state = 'off'
    mockEntities['sensor.thermostat_effective_home_away'].state = 'Home'
    mockEntities['sensor.thermostat_home_away_reason'].state = 'A resident is home, so TCS is using home behavior.'
    mockEntities['climate.thermostat_contact_sensors_living_room_virtual_thermostat'].attributes.away_mode_active = false
    view.rerender(<DashboardViewPage activePath="thermostat" onNavigate={() => undefined} path="thermostat" />)

    wholeHomeDial = screen.getByRole('region', { hidden: true, name: /Whole Home thermostat Idle 71.0°F 72.0 · 74.0/i })
    roomDial = within(dialog).getByRole('region', { name: /Living Room thermostat Idle 70.2°F 72.0 · 74.0/i })
    expectRangeHandlePositions(wholeHomeDial, 72, 74)
    expectRangeHandlePositions(roomDial, 72, 74)
    expect(screen.queryByLabelText(/Whole Home (?:Away|Vacation) Mode/)).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText(/Living Room (?:Away|Vacation) Mode/)).not.toBeInTheDocument()
  })

  it('shows the room Vacation Mode tile without adding a React-owned action', async () => {
    mockEntities['input_boolean.vacation_mode'].state = 'on'
    mockEntities['binary_sensor.thermostat_contact_sensors_away_mode_active'].state = 'on'
    mockEntities['sensor.thermostat_effective_home_away'].state = 'Away'
    mockEntities['sensor.thermostat_home_away_reason'].state = 'Vacation Mode is active and everyone is away; TCS is keeping Eco active without heating or cooling.'
    mockEntities['climate.thermostat_contact_sensors_living_room_virtual_thermostat'].attributes.away_mode_active = true
    render(<DashboardViewPage activePath="thermostat" onNavigate={() => undefined} path="thermostat" />)

    const thermostatDialog = await openThermostatControls()
    fireEvent.click(within(thermostatDialog).getByRole('button', { name: 'Living Room 70.2°F · Inactive' }))
    const dialog = await screen.findByRole('dialog', { name: 'Living Room' })
    const vacationMode = within(dialog).getByLabelText('Living Room Vacation Mode')

    expect(within(dialog).queryByLabelText('Vacation Mode On')).not.toBeInTheDocument()
    expect(within(dialog).getByText('Vacation Mode Active. The room may be cooler or warmer than your heat/cool targets to save energy while away.')).toBeInTheDocument()
    fireEvent.click(vacationMode)
    expect(mockCallServiceCalls).toEqual([])
  })

  it('renders the shared modal dial gutter when a heat marker occupies the top arc', async () => {
    const climateEntity = mockEntities['climate.thermostat_contact_sensors_living_room_virtual_thermostat']
    const previousLow = climateEntity.attributes.target_temp_low
    const previousHigh = climateEntity.attributes.target_temp_high
    climateEntity.attributes.target_temp_low = 70
    climateEntity.attributes.target_temp_high = 72
    window.history.replaceState(null, '', '/at-a-glance/thermostat#living-room')

    const view = render(<DashboardViewPage activePath="thermostat" onNavigate={() => undefined} path="thermostat" />)

    const dialog = await screen.findByRole('dialog', { name: 'Living Room' })
    const shell = within(dialog).getByRole('region', { name: 'Living Room thermostat control' })
    const dial = within(shell).getByRole('region', { name: /Living Room thermostat Idle 70.2°F 70.0 · 72.0/i })
    const lowHandle = dial.querySelector('[data-target="low"]')

    expect(shell).toHaveAttribute('data-thermostat-modal-dial-shell', 'true')
    expect(shell).toHaveStyle({ '--thermostat-modal-dial-gutter': '20px' })
    expect(lowHandle).toHaveStyle({ '--thermostat-handle-x': '50%', '--thermostat-handle-y': '4.6875%' })

    view.unmount()
    climateEntity.attributes.target_temp_low = previousLow
    climateEntity.attributes.target_temp_high = previousHigh
  })

  it('colors the Thermostat Hub glass card from active heat and cool status', () => {
    mockEntities['climate.thermostat_hub_w200'].attributes.hvac_action = 'cooling'
    const view = render(<DashboardViewPage activePath="thermostat" onNavigate={() => undefined} path="thermostat" />)

    expect(screen.getByLabelText(/Thermostat Hub Off/i)).toHaveAttribute('data-thermal-status', 'cool')

    view.unmount()
    mockEntities['climate.thermostat_hub_w200'].attributes.hvac_action = 'heating'
    render(<DashboardViewPage activePath="thermostat" onNavigate={() => undefined} path="thermostat" />)

    expect(screen.getByLabelText(/Thermostat Hub Off/i)).toHaveAttribute('data-thermal-status', 'heat')
  })

  it('uses HASS climate dropdowns for Thermostat Hub mode and fan mode when exposed', async () => {
    mockEntities['climate.thermostat_hub_w200'].attributes.fan_modes = ['auto', 'off']
    mockEntities['climate.thermostat_hub_w200'].attributes.fan_mode = 'auto'
    render(<DashboardViewPage activePath="thermostat" onNavigate={() => undefined} path="thermostat" />)

    fireEvent.click(screen.getByLabelText(/Thermostat Hub Mode Off/i))
    let pickerSheet = await screen.findByRole('dialog')
    fireEvent.click(within(pickerSheet).getByRole('button', { name: 'Heat' }))
    expect(mockCallServiceCalls).toContainEqual({ domain: 'climate', service: 'set_hvac_mode', target: 'climate.thermostat_hub_w200', serviceData: { hvac_mode: 'heat' } })

    fireEvent.click(screen.getByLabelText(/Thermostat Hub Fan Auto/i))
    pickerSheet = await screen.findByRole('dialog')
    fireEvent.click(within(pickerSheet).getByRole('button', { name: 'Off' }))
    expect(mockCallServiceCalls).toContainEqual({ domain: 'climate', service: 'set_fan_mode', target: 'climate.thermostat_hub_w200', serviceData: { fan_mode: 'off' } })
  })

  it('renders open thermostat contact sensors as glass cards', () => {
    mockEntities['binary_sensor.contact_sensors'].state = 'on'
    mockEntities['binary_sensor.office_window_contact_sensor_contact'].state = 'on'
    mockEntities['binary_sensor.master_bedroom_street_window_contact_sensor_contact'].state = 'on'

    render(<DashboardViewPage activePath="thermostat" onNavigate={() => undefined} path="thermostat" />)

    const openSensor = screen.getByLabelText(/^Office Window Open$/i)
    const masterBedroomSensor = screen.getByLabelText(/^Master Bedroom Street Windows Open$/i)
    expect(screen.getByRole('heading', { name: 'Open Contact Sensors' })).toBeInTheDocument()
    expect(openSensor).toHaveAttribute('data-active', 'true')
    expect(openSensor).toHaveAttribute('data-tone', 'contact')
    expect(masterBedroomSensor).toHaveAttribute('data-active', 'true')
    expect(masterBedroomSensor).toHaveAttribute('data-tone', 'contact')
    expect(screen.queryByRole('article', { name: /^Office Window Open$/i })).not.toBeInTheDocument()
  })

  it('renders Thermostat Hub as a mode-only card without temperature and humidity chips', () => {
    render(<DashboardViewPage activePath="thermostat" onNavigate={() => undefined} path="thermostat" />)

    expect(screen.getByLabelText(/Thermostat Hub Off/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Thermostat Hub Mode Off/i)).toBeInTheDocument()
    expect(screen.queryByText('73.4 °F')).not.toBeInTheDocument()
    expect(screen.queryByText('38.0%')).not.toBeInTheDocument()
  })

  it('renders the thermostat page with source controls and room popups', async () => {
    mockEntities['climate.thermostat_contact_sensors_global_virtual_thermostat'].attributes.hvac_action = 'heating'
    mockEntities['climate.thermostat_contact_sensors_living_room_virtual_thermostat'].attributes.current_temperature = null
    render(<DashboardViewPage activePath="thermostat" onNavigate={() => undefined} path="thermostat" />)

    expect(screen.getByRole('heading', { name: 'Thermostat' })).toBeInTheDocument()
    expect(screen.queryByText(/not available in the React dashboard yet/i)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Whole Home' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/Whole Home (?:Away|Vacation) Mode/)).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Whole Home thermostat Heating 71.0°F 72.0 · 74.0/i })).toBeInTheDocument()
    expect(screen.getAllByTestId('control-slider-circular')[0]).toHaveStyle({ '--ha-control-slider-color': '#cd5401', '--ha-control-slider-high-color': '#2c8e98', '--ha-control-slider-low-color': '#cd5401' })
    expect(screen.getAllByTestId('control-slider-circular')[0]).toHaveAttribute('data-inactive', 'false')
    expect(screen.queryByRole('button', { name: /Decrease Whole Home target temperature/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Increase Whole Home target temperature/i })).not.toBeInTheDocument()
    const targetSliders = screen.getAllByRole('slider', { name: 'Whole Home target temperature' })
    expect(targetSliders).toHaveLength(2)
    fireEvent.change(targetSliders[0], { target: { value: '73' } })
    expect(screen.getByRole('region', { name: /Whole Home thermostat Heating 71.0°F 73.0 · 74.0/i })).toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([])
    fireEvent.pointerUp(targetSliders[0])
    expect(mockCallServiceCalls).toEqual([{ domain: 'climate', service: 'set_temperature', target: [
      'climate.thermostat_contact_sensors_living_room_virtual_thermostat',
      'climate.thermostat_contact_sensors_office_virtual_thermostat',
      'climate.thermostat_contact_sensors_master_bedroom_virtual_thermostat',
      'climate.thermostat_contact_sensors_master_bathroom_virtual_thermostat',
      'climate.thermostat_contact_sensors_kitchen_virtual_thermostat',
      'climate.thermostat_contact_sensors_guest_room_virtual_thermostat',
      'climate.thermostat_contact_sensors_dining_room_virtual_thermostat',
      'climate.thermostat_contact_sensors_gym_virtual_thermostat',
      'climate.thermostat_contact_sensors_guest_bathroom_virtual_thermostat',
      'climate.thermostat_contact_sensors_music_room_virtual_thermostat',
      'climate.thermostat_contact_sensors_theater_room_virtual_thermostat',
    ], serviceData: { target_temp_high: 74, target_temp_low: 73 } }])
    mockCallServiceCalls.length = 0
    expect(screen.getByLabelText(/Thermostat Hub Off/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Thermostat Hub Mode Off/i)).toBeInTheDocument()
    expect(screen.queryByText('73.4 °F')).not.toBeInTheDocument()
    expect(screen.queryByText('38.0%')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Room Thermostats' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Advanced Configuration' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Room Tracking' })).toBeInTheDocument()

    const dialog = await openThermostatControls()
    const tabs = within(dialog).getAllByRole('tab')
    expect(tabs.map((tab) => tab.getAttribute('aria-label'))).toEqual(['Rooms', 'Automation', 'Tracking'])
    expect(within(dialog).getByRole('tab', { name: 'Rooms' })).toHaveAttribute('aria-selected', 'true')
    expect(within(dialog).getByRole('button', { name: 'Living Room 70.2°F · Inactive' })).toBeInTheDocument()
    const officeOpener = within(dialog).getByRole('button', { name: 'Office 71.6°F · Active' })
    expect(officeOpener).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Master Bedroom 71.0°F · Active' })).toBeInTheDocument()

    const roomOpener = within(dialog).getByRole('button', { name: 'Living Room 70.2°F · Inactive' })
    expect(roomOpener).toHaveAttribute('data-tone', 'switch')
    expect(roomOpener).toHaveAttribute('data-muted', 'true')
    expect(officeOpener).toHaveAttribute('data-tone', 'switch')
    expect(officeOpener).toHaveAttribute('data-muted', 'false')
    expect(roomOpener.querySelector('[data-modal-disclosure="right-chevron"]')).toBeInTheDocument()
    fireEvent.click(roomOpener)
    expect(dialog).toHaveAttribute('data-surface', 'hass-popup')
    expect(within(dialog).getByRole('heading', { name: 'Living Room' })).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Living Room Vents' })).toBeInTheDocument()
    expect(within(dialog).getByRole('region', { name: /Living Room thermostat Idle --°F 72.0 · 74.0/i })).toBeInTheDocument()
    expect(within(dialog).queryByRole('region', { name: /Living Room thermostat Idle 0.0°F/i })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('article', { name: /^Vent 1 Open$/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('article', { name: /^Vent 2 Open$/i })).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to rooms' }))
    await clickIconModalTab(within(dialog), 'Automation')
    const automaticToggle = within(dialog).getByRole('switch', { name: 'Turn off Automatic Thermostat' })
    const ecoToggle = within(dialog).getByRole('switch', { name: 'Turn off Eco Mode' })
    const predictiveToggle = within(dialog).getByRole('button', { name: 'Turn on Predictive Comfort' })
    const criticalTracking = within(dialog).getByRole('button', { name: /Eco Mode Critical Tracking Track Select Critical/i })
    const awayBehavior = within(dialog).getByRole('button', { name: /Eco Behavior When Away Keep Eco Active/i })
    for (const tile of [automaticToggle, ecoToggle, criticalTracking, awayBehavior]) {
      expect(tile).toHaveAttribute('data-tone', 'switch')
      expect(tile).toHaveAttribute('data-muted', 'false')
    }
    expect(automaticToggle).toHaveAttribute('aria-checked', 'true')
    expect(ecoToggle).toHaveAttribute('aria-checked', 'true')
    expect(predictiveToggle).toHaveAttribute('data-tone', 'switch')
    expect(predictiveToggle).toHaveAttribute('data-muted', 'true')
    expect(criticalTracking).toHaveAttribute('data-modal-opener', 'true')
    expect(awayBehavior).toHaveAttribute('data-modal-opener', 'true')

    fireEvent.click(criticalTracking)
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(within(dialog).getByRole('group', { name: 'Eco Mode Critical Tracking options' })).not.toHaveAttribute('data-dynamic-grid')
    const selectedCriticalOption = within(dialog).getByRole('button', { name: /^Set Eco Mode Critical Tracking to Track Select Critical:/ })
    const unselectedCriticalOption = within(dialog).getByRole('button', { name: /^Set Eco Mode Critical Tracking to Track All Critical:/ })
    expect(selectedCriticalOption).toHaveAttribute('aria-pressed', 'true')
    expect(selectedCriticalOption).toHaveAttribute('data-modal-detail-autofocus', 'true')
    expect(selectedCriticalOption).toHaveAttribute('data-tone', 'switch')
    expect(selectedCriticalOption).toHaveAttribute('data-muted', 'false')
    expect(selectedCriticalOption.querySelectorAll('[data-dynamic-grid-label]')).toHaveLength(1)
    expect(unselectedCriticalOption).toHaveAttribute('aria-pressed', 'false')
    expect(unselectedCriticalOption).toHaveAttribute('data-tone', 'switch')
    expect(unselectedCriticalOption).toHaveAttribute('data-muted', 'true')
    expect(unselectedCriticalOption.querySelectorAll('[data-dynamic-grid-label]')).toHaveLength(1)
    const selectedCriticalDescription = within(dialog).getByText('Protect only the unselected rooms chosen in Critical Protection.')
    expect(selectedCriticalDescription.closest('button')).toBeNull()
    expect(selectedCriticalDescription.compareDocumentPosition(selectedCriticalOption) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(unselectedCriticalOption)
    await waitFor(() => expect(within(dialog).getByRole('button', { name: /^Set Eco Mode Critical Tracking to Track All Critical:/ })).toHaveAttribute('aria-pressed', 'true'))
    expect(within(dialog).getByRole('heading', { name: 'Eco Mode Critical Tracking' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Back to automation' })).toBeInTheDocument()
    expect(mockCallServiceCalls).toContainEqual({
      domain: 'select',
      service: 'select_option',
      serviceData: { option: 'Track All Critical' },
      target: 'select.thermostat_contact_sensors_eco_mode_critical_tracking',
    })

    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to automation' }))
    fireEvent.click(within(dialog).getByRole('switch', { name: 'Turn off Eco Mode' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Turn on Predictive Comfort' }))
    fireEvent.click(within(dialog).getByRole('switch', { name: 'Turn off Automatic Thermostat' }))
    expect(mockCallServiceCalls).toEqual(expect.arrayContaining([
      { domain: 'homeassistant', service: 'toggle', target: 'switch.thermostat_contact_sensors_eco_mode' },
      { domain: 'switch', service: 'turn_on', target: 'switch.thermostat_contact_sensors_predictive_comfort_mode' },
      { domain: 'homeassistant', service: 'toggle', target: 'input_boolean.enable_disable_thermostat_contact_sensors_integration' },
    ]))
  })

  it('toggles occupancy-only thermostat rooms from the Thermostat tracking page', async () => {
    render(<DashboardViewPage activePath="thermostat" onNavigate={() => undefined} path="thermostat" />)

    const dialog = await openThermostatControls()
    await clickIconModalTab(within(dialog), 'Tracking')
    fireEvent.click(within(dialog).getByRole('button', { name: /Occupied Only 2 of 11 occupied only/i }))
    expect(within(dialog).getByRole('group', { name: 'Occupied-only thermostat rooms' })).toHaveAttribute('data-dynamic-grid', 'true')
    const livingRoomGate = within(dialog).getByRole('button', { name: /^Living Room$/i })
    const guestBathroomGate = within(dialog).getByRole('button', { name: /^Guest Bathroom$/i })
    const masterBathroomGate = within(dialog).getByRole('button', { name: /^Master Bathroom$/i })

    fireEvent.click(livingRoomGate)
    fireEvent.click(guestBathroomGate)

    expect(livingRoomGate).toHaveAttribute('aria-pressed', 'true')
    expect(guestBathroomGate).toHaveAttribute('aria-pressed', 'false')
    expect(masterBathroomGate).toHaveAttribute('aria-pressed', 'true')
    expect(mockCallServiceCalls).toEqual([
      { domain: 'homeassistant', service: 'toggle', target: 'switch.living_room_thermostat_contact_sensors_living_room_track_only_when_occupied' },
      { domain: 'homeassistant', service: 'toggle', target: 'switch.living_room_thermostat_contact_sensors_guest_bathroom_track_only_when_occupied' },
    ])
  })

  it('keeps selected-room and critical-protection controls mapped to their HA switches', async () => {
    render(<DashboardViewPage activePath="thermostat" onNavigate={() => undefined} path="thermostat" />)

    const dialog = await openThermostatControls()
    await clickIconModalTab(within(dialog), 'Tracking')
    mockCallServiceCalls.length = 0

    fireEvent.click(within(dialog).getByRole('button', { name: /Selected Rooms \d+ of 11 selected/i }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Office' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to tracking' }))

    fireEvent.click(within(dialog).getByRole('button', { name: /Critical Protection \d+ rooms forced/i }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Music Room' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to tracking' }))

    fireEvent.click(within(dialog).getByRole('switch', { name: 'Turn off Track Selected Rooms' }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'homeassistant', service: 'toggle', target: 'switch.thermostat_contact_sensors_track_office' },
      { domain: 'homeassistant', service: 'toggle', target: 'switch.thermostat_contact_sensors_music_room_force_track_when_critical' },
      { domain: 'homeassistant', service: 'toggle', target: 'switch.thermostat_contact_sensors_only_track_selected_rooms' },
    ])
  })

  it('keeps the thermostat room modal title stable while closing', async () => {
    render(<DashboardViewPage activePath="thermostat" onNavigate={() => undefined} path="thermostat" />)

    const thermostatDialog = await openThermostatControls()
    fireEvent.click(within(thermostatDialog).getByRole('button', { name: 'Living Room 70.2°F · Inactive' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Living Room' })).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    const closingDialog = screen.queryByRole('dialog')
    if (closingDialog) {
      expect(within(closingDialog).getByRole('heading', { name: 'Living Room' })).toBeInTheDocument()
      expect(within(closingDialog).queryByRole('heading', { name: 'Thermostat · Advanced Controls' })).not.toBeInTheDocument()
    }
  })

  it('uses green thermostat entry tiles without live-state subtitles', () => {
    const tracking = mockEntities['switch.thermostat_contact_sensors_only_track_selected_rooms']
    const previousState = tracking.state
    tracking.state = 'unavailable'

    try {
      render(<DashboardViewPage activePath="thermostat" onNavigate={() => undefined} path="thermostat" />)
      for (const label of ['Room Thermostats', 'Advanced Configuration', 'Room Tracking']) {
        const tile = screen.getByRole('button', { name: label })
        expect(tile).toHaveAttribute('data-tone', 'switch')
        expect(tile).toHaveAttribute('data-modal-opener', 'true')
        expect(tile.querySelectorAll('[data-dynamic-grid-label]')).toHaveLength(1)
      }
      expect(screen.queryByText(/Selected tracking unavailable/i)).not.toBeInTheDocument()
    } finally {
      tracking.state = previousState
    }
  })

  it('opens Predictive Comfort controls when active and powers it off from the card action', async () => {
    mockEntities['switch.thermostat_contact_sensors_predictive_comfort_mode'].state = 'on'
    render(<DashboardViewPage activePath="climate" onNavigate={() => undefined} path="thermostat" />)

    const dialog = await openThermostatControls()
    await clickIconModalTab(within(dialog), 'Automation')
    const predictiveComfort = within(dialog).getByRole('button', { name: /Open Predictive Comfort controls, On · Idle/i })
    expect(within(dialog).getByRole('switch', { name: 'Turn off Predictive Comfort' })).toBeInTheDocument()
    const predictiveControls = predictiveComfort
    expect(predictiveControls).toBeInTheDocument()
    expect(predictiveControls).toHaveAttribute('data-tone', 'switch')
    expect(predictiveControls).toHaveAttribute('data-muted', 'false')
    expect(predictiveControls.querySelector('[data-modal-disclosure="right-chevron"]')).toBeInTheDocument()
    expect(predictiveControls.querySelector('[data-modal-disclosure="right-chevron"] path')).toHaveAttribute('d', materialIconPath('mdi:chevron-right'))
    fireEvent.click(predictiveComfort)
    expect(dialog).toHaveAttribute('data-surface', 'hass-popup')
    expect(within(dialog).getByRole('heading', { name: 'Predictive Comfort' })).toBeInTheDocument()
    await waitFor(() => expect(dialog.querySelector('[data-modal-detail-autofocus="true"]')).toHaveFocus())
    expect(within(dialog).getByText(/^Idle$/i)).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Controls' })).toBeInTheDocument()
    const autoAdjustDescription = within(dialog).getByText(/adjust the thermostat target before the house leaves the comfort range/i)
    const autoAdjustButton = within(dialog).getByRole('switch', { name: 'Turn on Auto Setpoint Adjustments' })
    const hvacModeDescription = within(dialog).getByText(/switch between heating and cooling when the recommendation requires it/i)
    const hvacModeButton = within(dialog).getByRole('switch', { name: 'Turn on HVAC Mode Changes' })
    const awayDescription = within(dialog).getByText(/act only while someone is home/i)
    const awayButton = within(dialog).getByRole('switch', { name: 'Turn on Predictive Comfort While Away' })
    expect(autoAdjustDescription.closest('button')).toBeNull()
    expect(hvacModeDescription.closest('button')).toBeNull()
    expect(awayDescription.closest('button')).toBeNull()
    expect(autoAdjustDescription.compareDocumentPosition(autoAdjustButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(hvacModeDescription.compareDocumentPosition(hvacModeButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(awayDescription.compareDocumentPosition(awayButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(dialog).getByRole('heading', { name: 'Current Prediction' })).toBeInTheDocument()
    expect(within(dialog).getByText('Predicted')).toBeInTheDocument()
    expect(within(dialog).getByText('74.8°F')).toBeInTheDocument()
    expect(within(dialog).queryByText(/Active heat loads:/i)).not.toBeInTheDocument()
    expect(within(dialog).getByText('Why this prediction?')).toBeInTheDocument()
    expect(within(dialog).getByText(/Forecast and current indoor conditions are inside the comfort band\./i)).toBeInTheDocument()
    expect(within(dialog).getByText(/Predicted indoor temperature is 74\.8°F, above your 71\.0°F - 74\.0°F comfort band\./i)).toBeInTheDocument()
    expect(within(dialog).getByText(/Today's forecast range is 68\.0°F - 83\.0°F/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/Office PC is active, so the model is accounting for extra heat/i)).toBeInTheDocument()
    expect(within(dialog).getByText(/Auto setpoint adjustments are off, so this is only a recommendation\./i)).toBeInTheDocument()

    fireEvent.click(autoAdjustButton)
    fireEvent.click(hvacModeButton)
    fireEvent.click(awayButton)
    expect(mockCallServiceCalls).toEqual([
      { domain: 'homeassistant', service: 'toggle', target: 'switch.thermostat_contact_sensors_predictive_auto_adjust' },
      { domain: 'homeassistant', service: 'toggle', target: 'switch.thermostat_contact_sensors_predictive_hvac_mode_changes' },
      { domain: 'homeassistant', service: 'toggle', target: 'switch.thermostat_contact_sensors_predictive_allow_away' },
    ])
  })

  it('renders the Pre-Cool recommendation consistently from the HA state', async () => {
    mockEntities['switch.thermostat_contact_sensors_predictive_comfort_mode'].state = 'on'
    mockEntities['sensor.living_room_thermostat_contact_sensors_predictive_comfort_mode'].state = 'pre_cool'
    render(<DashboardViewPage activePath="climate" onNavigate={() => undefined} path="thermostat" />)

    const dialog = await openThermostatControls()
    await clickIconModalTab(within(dialog), 'Automation')
    const predictiveComfort = within(dialog).getByRole('button', { name: /Open Predictive Comfort controls, On · Pre-Cool/i })
    expect(within(dialog).queryByText('Pre Cool')).not.toBeInTheDocument()

    fireEvent.click(predictiveComfort)
    expect(within(dialog).getByText('Pre-Cool')).toBeInTheDocument()
    expect(within(dialog).queryByText('Pre Cool')).not.toBeInTheDocument()
  })

  it('turns Predictive Comfort off from the active card power action', async () => {
    mockEntities['switch.thermostat_contact_sensors_predictive_comfort_mode'].state = 'on'
    render(<DashboardViewPage activePath="climate" onNavigate={() => undefined} path="thermostat" />)

    const dialog = await openThermostatControls()
    await clickIconModalTab(within(dialog), 'Automation')
    expect(within(dialog).getByRole('switch', { name: 'Turn off Predictive Comfort' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /Open Predictive Comfort controls/i })).toBeInTheDocument()

    mockCallServiceCalls.length = 0
    fireEvent.click(within(dialog).getByRole('switch', { name: 'Turn off Predictive Comfort' }))
    expect(mockCallServiceCalls).toEqual([
      { domain: 'switch', service: 'turn_off', target: 'switch.thermostat_contact_sensors_predictive_comfort_mode' },
    ])
    expect(within(dialog).queryByRole('switch', { name: 'Turn off Predictive Comfort' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Turn on Predictive Comfort' })).toBeInTheDocument()
  })

  it('shows manual air purifier fan speeds and runs fan percentage services', async () => {
    mockEntities['select.living_room_air_purifier_fan_mode'].state = 'Manual'
    mockEntities['fan.living_room_air_purifier_levoit_purifier'].attributes.percentage = 66
    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    fireEvent.click(screen.getAllByRole('button', { name: /Air Quality/i })[0])
    expect(await screen.findByText('Manual Modes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Medium' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'High' }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'fan', service: 'set_percentage', target: 'fan.living_room_air_purifier_levoit_purifier', serviceData: { percentage: 100 } },
    ])
    mockEntities['select.living_room_air_purifier_fan_mode'].state = 'Auto'
    mockEntities['fan.living_room_air_purifier_levoit_purifier'].attributes.percentage = 33
  })

  it('keeps unavailable humidifier cards read-only while SleepyPod cards use native modals', async () => {
    mockEntities['switch.lv600s_humidifier_power'].state = 'unavailable'
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    expect(screen.getByLabelText(/Humidifier Unavailable/i)).toHaveAttribute('data-muted', 'true')
    const headings = screen.getAllByRole('heading').map((heading) => heading.textContent)
    expect(headings.indexOf('SleepyPod')).toBeGreaterThan(-1)
    expect(headings.indexOf('SleepyPod')).toBeLessThan(headings.indexOf('Climate'))
    expect(headings.indexOf('Media')).toBeLessThan(headings.indexOf('Climate'))
    expect(screen.getByRole('button', { name: /Your Side Cooling • -1/i })).toHaveStyle('--tile-color: rgba(25, 84, 130, 0.6)')
    expect(screen.getByRole('button', { name: /Steph's Side Off/i })).toHaveAttribute('data-muted', 'true')
    expect(screen.getByRole('button', { name: /Apple TV Paused/i })).toHaveAttribute('data-muted', 'false')

    fireEvent.click(screen.getByLabelText(/Humidifier Unavailable/i))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Master Bedroom Climate' })).not.toBeInTheDocument()
  })

  it('fails closed instead of mixing SleepyPod and legacy controls when only one MQTT adapter entity is available', async () => {
    mockEntities['climate.sleepypod_eight_pod_left_side'] = entity('climate.sleepypod_eight_pod_left_side', 'heat', {
      current_temperature: 81,
      hvac_modes: ['off', 'heat'],
      max_temp: 110,
      min_temp: 55,
      target_temp_step: 1,
      temperature: 70,
    })
    const climateOnly = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    const climateOnlyCard = screen.getByLabelText(/Your Side Off/i)
    expect(climateOnlyCard).toHaveAttribute('data-muted', 'true')
    expect(climateOnlyCard.tagName).toBe('DIV')
    expect(screen.queryByRole('dialog', { name: "Stephen's Bed" })).not.toBeInTheDocument()

    climateOnly.unmount()
    window.history.replaceState(null, '', `${window.location.pathname}#stephens-bed`)
    const climateOnlyDeepLink = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    const unavailableDialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
    expect(within(unavailableDialog).getByRole('alert')).toHaveTextContent('Bed controls are unavailable.')
    expect(within(unavailableDialog).queryByRole('button', { name: "Increase Stephen's Bed Bedtime level" })).not.toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([])

    climateOnlyDeepLink.unmount()
    window.history.replaceState(null, '', window.location.pathname)
    delete mockEntities['climate.sleepypod_eight_pod_left_side']
    mockEntities['number.master_bedroom_sleepypod_eight_pod_left_target_level'] = entity('number.master_bedroom_sleepypod_eight_pod_left_target_level', '-2', {
      max: 10,
      min: -10,
      step: 1,
    })
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    const levelOnlyCard = screen.getByLabelText(/Your Side Off/i)
    expect(levelOnlyCard).toHaveAttribute('data-muted', 'true')
    expect(levelOnlyCard.tagName).toBe('DIV')
    expect(screen.queryByRole('dialog', { name: "Stephen's Bed" })).not.toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([])
  })

  it('uses SleepyPod target-level controls when the MQTT level adapter is available', async () => {
    mockEntities['climate.sleepypod_eight_pod_left_side'] = entity('climate.sleepypod_eight_pod_left_side', 'heat', {
      current_temperature: 81,
      hvac_modes: ['off', 'heat'],
      max_temp: 110,
      min_temp: 55,
      target_temp_step: 1,
      temperature: 77,
    })
    mockEntities['number.master_bedroom_sleepypod_eight_pod_left_target_level'] = entity('number.master_bedroom_sleepypod_eight_pod_left_target_level', '-2', {
      max: 10,
      min: -10,
      step: 1,
    })
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -2/i }))

    const dialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
    expect(within(dialog).getByRole('tab', { name: 'Alarms' })).toBeInTheDocument()
    expect(within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -2/i })).toBeInTheDocument()
    expect(within(dialog).getByText('Bedtime')).toBeInTheDocument()
    expect(within(dialog).getByText('Asleep')).toBeInTheDocument()
    expect(within(dialog).getByText('Dawn')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: "Increase Stephen's Bed Bedtime level" }))
    await waitFor(() => expect(mockCallServiceCalls).toContainEqual({
      domain: 'input_number',
      service: 'set_value',
      target: 'input_number.eight_sleep_stephen_bedtime_level',
      serviceData: { value: 1 },
    }))
    await waitFor(() => expect(mockCallServiceCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        domain: 'mqtt',
        service: 'publish',
        serviceData: expect.objectContaining({ topic: 'sleepypod/eight-pod/cmd/set-schedules' }),
      }),
    ])))
    const schedulePublish = mockCallServiceCalls.find((call) => call.domain === 'mqtt' && (call.serviceData as { topic?: string } | undefined)?.topic === 'sleepypod/eight-pod/cmd/set-schedules')
    const stagePayload = JSON.parse(String((schedulePublish?.serviceData as { payload: string }).payload))
    expect(stagePayload.left.monday.power).toEqual({ enabled: true, off: '09:00', on: '21:30', onTemperature: 85 })
    expect(stagePayload.left.monday.temperatures).toEqual({ '01:00': 80, '05:00': 83 })

    const targetSlider = within(dialog).getByRole('slider', { name: "Stephen's Bed target level" })
    fireEvent.keyDown(targetSlider, { key: 'ArrowLeft' })

    expect(within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -3/i })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Set Bed Temperature' })).not.toBeInTheDocument()

    await waitFor(() => expect(mockCallServiceCalls).toContainEqual({
      domain: 'script',
      service: 'sleepypod_stephen_temperature_outside_schedule',
      serviceData: { level: -3 },
    }))
  })

  it.each([
    ['bedtime', 'Tonight', null],
    ['bedtime', 'All Nights', 'input_number.eight_sleep_stephen_bedtime_level'],
    ['asleep', 'Tonight', null],
    ['asleep', 'All Nights', 'input_number.eight_sleep_stephen_asleep_level'],
    ['dawn', 'Tonight', null],
    ['dawn', 'All Nights', 'input_number.eight_sleep_stephen_dawn_level'],
  ])('commits Tonight during %s before persisting %s without reapplying the current target', async (phase, choice, allNightsTarget) => {
    setupStephenSleepypodLevelControl(phase)
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -2/i }))
    const bedDialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
    const targetSlider = within(bedDialog).getByRole('slider', { name: "Stephen's Bed target level" })
    fireEvent.keyDown(targetSlider, { key: 'ArrowLeft' })

    expect(targetSlider).toHaveAttribute('aria-valuenow', '-3')
    expect(within(bedDialog).getByRole('region', { hidden: true, name: /Stephen's Bed thermostat Cooling -3/i })).toBeInTheDocument()
    const scopeDialog = await screen.findByRole('dialog', { name: 'Set Bed Temperature' })
    expect(scopeDialog).toHaveTextContent(new RegExp(`Stephen's Bed • ${phase} • -3`, 'i'))
    await waitFor(() => expect(within(scopeDialog).getByRole('button', { name: 'Tonight' })).toHaveFocus())
    expect(within(scopeDialog).getByRole('button', { name: 'Tonight' }).querySelector('[data-modal-disclosure]')).not.toBeInTheDocument()
    expect(within(scopeDialog).getByRole('button', { name: 'All Nights' }).querySelector('[data-modal-disclosure]')).not.toBeInTheDocument()
    const tonightCall = {
      domain: 'script',
      service: 'sleepypod_stephen_temperature_tonight',
      serviceData: { level: -3 },
    }
    expect(mockCallServiceCalls).toEqual([tonightCall])

    fireEvent.click(within(scopeDialog).getByRole('button', { name: choice }))

    expect(targetSlider).toHaveAttribute('aria-valuenow', '-3')
    const expectedCalls = allNightsTarget
      ? [tonightCall, {
          domain: 'input_number',
          service: 'set_value',
          target: allNightsTarget,
          serviceData: { value: -3 },
        }]
      : [tonightCall]
    await waitFor(() => expect(mockCallServiceCalls).toEqual(expectedCalls))
    await waitFor(() => expect(scopeDialog).toHaveAttribute('data-state', 'closed'))
    expect(scopeDialog).toHaveAttribute('data-closing', 'true')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Set Bed Temperature' })).not.toBeInTheDocument())
    expect(within(bedDialog).getByRole('region', { hidden: true, name: /Stephen's Bed thermostat Cooling -3/i })).toBeInTheDocument()
    await waitFor(() => expect(within(bedDialog).getByRole('slider', { name: "Stephen's Bed target level" })).toHaveFocus())
    expect(mockCallServiceCalls.some((call) => call.domain === 'number')).toBe(false)
    expect(mockCallServiceCalls.some((call) => call.domain === 'script' && call.service.includes('all_nights'))).toBe(false)
  })

  it('offers All Nights without sending a current-target command when the active-phase value is unchanged', async () => {
    setupStephenSleepypodLevelControl('bedtime')
    mockEntities['number.master_bedroom_sleepypod_eight_pod_left_target_level'].state = '-10'
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -10/i }))
    const bedDialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
    const targetSlider = within(bedDialog).getByRole('slider', { name: "Stephen's Bed target level" })
    fireEvent.keyDown(targetSlider, { key: 'Home' })

    expect(targetSlider).toHaveAttribute('aria-valuenow', '-10')
    const scopeDialog = await screen.findByRole('dialog', { name: 'Set Bed Temperature' })
    expect(mockCallServiceCalls).toEqual([])
    fireEvent.click(within(scopeDialog).getByRole('button', { name: 'All Nights' }))

    await waitFor(() => expect(mockCallServiceCalls).toEqual([{
      domain: 'input_number',
      service: 'set_value',
      target: 'input_number.eight_sleep_stephen_bedtime_level',
      serviceData: { value: -10 },
    }]))
  })

  it('does not send a command when an outside-window dial commit keeps the current target', async () => {
    setupStephenSleepypodLevelControl('outside')
    mockEntities['number.master_bedroom_sleepypod_eight_pod_left_target_level'].state = '-10'
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -10/i }))
    const bedDialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
    const targetSlider = within(bedDialog).getByRole('slider', { name: "Stephen's Bed target level" })
    fireEvent.keyDown(targetSlider, { key: 'Home' })

    expect(targetSlider).toHaveAttribute('aria-valuenow', '-10')
    expect(screen.queryByRole('dialog', { name: 'Set Bed Temperature' })).not.toBeInTheDocument()
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 400))
    })
    expect(mockCallServiceCalls).toEqual([])
  })

  it('cancels a queued outside-window command when the dial returns to the live target', async () => {
    setupStephenSleepypodLevelControl('outside')
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -2/i }))
    const bedDialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
    const targetSlider = within(bedDialog).getByRole('slider', { name: "Stephen's Bed target level" })
    fireEvent.keyDown(targetSlider, { key: 'ArrowLeft' })
    fireEvent.keyDown(targetSlider, { key: 'ArrowRight' })

    expect(targetSlider).toHaveAttribute('aria-valuenow', '-2')
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 400))
    })
    expect(mockCallServiceCalls).toEqual([])
  })

  it('cancels a stale queued outside-window command after HA reports a new live target', async () => {
    setupStephenSleepypodLevelControl('outside')
    const view = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -2/i }))
    const bedDialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
    const targetSlider = within(bedDialog).getByRole('slider', { name: "Stephen's Bed target level" })
    fireEvent.keyDown(targetSlider, { key: 'ArrowLeft' })

    act(() => {
      mockEntities['number.master_bedroom_sleepypod_eight_pod_left_target_level'].state = '-4'
      view.rerender(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    })
    fireEvent.keyDown(targetSlider, { key: 'ArrowLeft' })

    expect(targetSlider).toHaveAttribute('aria-valuenow', '-4')
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 400))
    })
    expect(mockCallServiceCalls).toEqual([])
  })

  it('allows the same target to be reasserted after HA reports an intervening external change', async () => {
    setupStephenSleepypodLevelControl('outside')
    mockEntities['number.master_bedroom_sleepypod_eight_pod_left_target_level'].state = '-9'
    const view = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -9/i }))
    const bedDialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
    const targetSlider = within(bedDialog).getByRole('slider', { name: "Stephen's Bed target level" })
    fireEvent.keyDown(targetSlider, { key: 'Home' })
    await waitFor(() => expect(mockCallServiceCalls).toHaveLength(1))

    act(() => {
      mockEntities['number.master_bedroom_sleepypod_eight_pod_left_target_level'].state = '-8'
      view.rerender(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    })
    fireEvent.keyDown(targetSlider, { key: 'Home' })

    await waitFor(() => expect(mockCallServiceCalls).toEqual([
      {
        domain: 'script',
        service: 'sleepypod_stephen_temperature_outside_schedule',
        serviceData: { level: -10 },
      },
      {
        domain: 'script',
        service: 'sleepypod_stephen_temperature_outside_schedule',
        serviceData: { level: -10 },
      },
    ]))
  })

  it('persists Steph All Nights through the schedule helper without another current-target script', async () => {
    setupStephSleepypodLevelControl('bedtime')
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Side/i }))
    const bedDialog = await screen.findByRole('dialog', { name: "Steph's Bed" })
    const targetSlider = within(bedDialog).getByRole('slider', { name: "Steph's Bed target level" })
    fireEvent.keyDown(targetSlider, { key: 'ArrowLeft' })
    const scopeDialog = await screen.findByRole('dialog', { name: 'Set Bed Temperature' })
    const allNights = within(scopeDialog).getByRole('button', { name: 'All Nights' })

    act(() => {
      allNights.click()
      allNights.click()
    })

    await waitFor(() => expect(mockCallServiceCalls).toEqual([
      {
        domain: 'script',
        service: 'sleepypod_steph_temperature_tonight',
        serviceData: { level: 0 },
      },
      {
        domain: 'input_number',
        service: 'set_value',
        target: 'input_number.eight_sleep_steph_bedtime_level',
        serviceData: { value: 0 },
      },
    ]))
  })

  it('keeps Tonight changes when the scope prompt is dismissed from the action, close button, or backdrop', async () => {
    setupStephenSleepypodLevelControl('asleep')
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -2/i }))
    const bedDialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
    const targetSlider = within(bedDialog).getByRole('slider', { name: "Stephen's Bed target level" })

    const openScopePrompt = async (expectedValue: number) => {
      fireEvent.keyDown(targetSlider, { key: 'ArrowLeft' })
      expect(targetSlider).toHaveAttribute('aria-valuenow', String(expectedValue))
      const scopeDialog = await screen.findByRole('dialog', { name: 'Set Bed Temperature' })
      expect(mockCallServiceCalls.at(-1)).toEqual({
        domain: 'script',
        service: 'sleepypod_stephen_temperature_tonight',
        serviceData: { level: expectedValue },
      })
      return scopeDialog
    }

    let scopeDialog = await openScopePrompt(-3)
    fireEvent.click(within(scopeDialog).getByRole('button', { name: 'Cancel' }))
    expect(scopeDialog).toHaveTextContent("Stephen's Bed • Asleep • -3")
    expect(targetSlider).toHaveAttribute('aria-valuenow', '-3')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Set Bed Temperature' })).not.toBeInTheDocument())
    await waitFor(() => expect(targetSlider).toHaveFocus())

    scopeDialog = await openScopePrompt(-4)
    fireEvent.click(within(scopeDialog).getByRole('button', { name: 'Close' }))
    expect(targetSlider).toHaveAttribute('aria-valuenow', '-4')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Set Bed Temperature' })).not.toBeInTheDocument())
    await waitFor(() => expect(targetSlider).toHaveFocus())

    scopeDialog = await openScopePrompt(-5)
    const overlays = document.querySelectorAll('[data-modal-sheet-overlay]')
    fireEvent.click(overlays[overlays.length - 1])
    expect(targetSlider).toHaveAttribute('aria-valuenow', '-5')
    await waitFor(() => expect(scopeDialog).toHaveAttribute('data-state', 'closed'))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Set Bed Temperature' })).not.toBeInTheDocument())
    await waitFor(() => expect(targetSlider).toHaveFocus())

    expect(mockCallServiceCalls).toEqual([-3, -4, -5].map((level) => ({
      domain: 'script',
      service: 'sleepypod_stephen_temperature_tonight',
      serviceData: { level },
    })))
    expect(within(bedDialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -5/i })).toBeInTheDocument()
  })

  it('keeps active-phase ring taps and drag commits visible while the scope prompt is open', async () => {
    setupStephenSleepypodLevelControl('bedtime')
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -2/i }))
    const bedDialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
    const dial = within(bedDialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -2/i })
    const targetSlider = within(bedDialog).getByRole('slider', { name: "Stephen's Bed target level" })
    const dialRect = {
      bottom: 500,
      height: 300,
      left: 100,
      right: 400,
      top: 200,
      width: 300,
      x: 100,
      y: 200,
      toJSON: () => ({}),
    } as DOMRect
    const clientPoint = (value: number) => {
      const point = valueToThermostatPoint(value, -10, 10)
      return {
        clientX: dialRect.left + (point.x / 100) * dialRect.width,
        clientY: dialRect.top + (point.y / 100) * dialRect.height,
      }
    }
    const rectSpy = vi.spyOn(dial, 'getBoundingClientRect').mockReturnValue(dialRect)
    Object.defineProperties(targetSlider, {
      hasPointerCapture: { configurable: true, value: () => false },
      setPointerCapture: { configurable: true, value: () => undefined },
    })

    try {
      fireEvent.pointerDown(dial, { ...clientPoint(-3), button: 0, pointerId: 51, pointerType: 'mouse' })
      fireEvent.pointerUp(dial, { ...clientPoint(-3), button: 0, pointerId: 51, pointerType: 'mouse' })

      expect(targetSlider).toHaveAttribute('aria-valuenow', '-3')
      expect(within(bedDialog).getByRole('region', { hidden: true, name: /Stephen's Bed thermostat Cooling -3/i })).toBeInTheDocument()
      let scopeDialog = await screen.findByRole('dialog', { name: 'Set Bed Temperature' })
      expect(mockCallServiceCalls).toEqual([{
        domain: 'script',
        service: 'sleepypod_stephen_temperature_tonight',
        serviceData: { level: -3 },
      }])

      fireEvent.click(within(scopeDialog).getByRole('button', { name: 'Cancel' }))
      expect(targetSlider).toHaveAttribute('aria-valuenow', '-3')
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Set Bed Temperature' })).not.toBeInTheDocument())

      fireEvent.pointerDown(targetSlider, { ...clientPoint(-3), pointerId: 52 })
      fireEvent.pointerMove(targetSlider, { ...clientPoint(-5), pointerId: 52 })
      fireEvent.pointerUp(targetSlider, { ...clientPoint(-5), pointerId: 52 })

      expect(targetSlider).toHaveAttribute('aria-valuenow', '-5')
      expect(within(bedDialog).getByRole('region', { hidden: true, name: /Stephen's Bed thermostat Cooling -5/i })).toBeInTheDocument()
      scopeDialog = await screen.findByRole('dialog', { name: 'Set Bed Temperature' })
      expect(mockCallServiceCalls).toEqual([-3, -5].map((level) => ({
        domain: 'script',
        service: 'sleepypod_stephen_temperature_tonight',
        serviceData: { level },
      })))

      fireEvent.click(within(scopeDialog).getByRole('button', { name: 'Cancel' }))
      expect(targetSlider).toHaveAttribute('aria-valuenow', '-5')
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Set Bed Temperature' })).not.toBeInTheDocument())
      expect(mockCallServiceCalls).toHaveLength(2)
    } finally {
      rectSpy.mockRestore()
    }
  })

  it('does not steal a newer parent-modal focus choice after the scope prompt closes', async () => {
    setupStephenSleepypodLevelControl('asleep')
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -2/i }))
    const bedDialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
    fireEvent.keyDown(within(bedDialog).getByRole('slider', { name: "Stephen's Bed target level" }), { key: 'ArrowLeft' })
    const scopeDialog = await screen.findByRole('dialog', { name: 'Set Bed Temperature' })
    const parentClose = bedDialog.querySelector<HTMLButtonElement>('button[aria-label="Close"]')
    if (!parentClose) throw new Error('Bed modal close button was not found')

    fireEvent.click(within(scopeDialog).getByRole('button', { name: 'Cancel' }))
    parentClose.focus()
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 600))
    })

    expect(parentClose).toHaveFocus()
    expect(mockCallServiceCalls).toEqual([{
      domain: 'script',
      service: 'sleepypod_stephen_temperature_tonight',
      serviceData: { level: -3 },
    }])
  })

  it('closes a stale scope prompt when HA advances the schedule phase', async () => {
    setupStephenSleepypodLevelControl('bedtime')
    const view = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -2/i }))
    const bedDialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
    const targetSlider = within(bedDialog).getByRole('slider', { name: "Stephen's Bed target level" })
    fireEvent.keyDown(targetSlider, { key: 'ArrowLeft' })
    const scopeDialog = await screen.findByRole('dialog', { name: 'Set Bed Temperature' })
    expect(targetSlider).toHaveAttribute('aria-valuenow', '-3')

    act(() => {
      mockEntities['sensor.sleepypod_stephen_schedule_phase'].state = 'asleep'
      view.rerender(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    })

    await waitFor(() => expect(scopeDialog).toHaveAttribute('data-state', 'closed'))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Set Bed Temperature' })).not.toBeInTheDocument())
    expect(mockCallServiceCalls).toEqual([{
      domain: 'script',
      service: 'sleepypod_stephen_temperature_tonight',
      serviceData: { level: -3 },
    }])
    expect(within(bedDialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -2/i })).toBeInTheDocument()
  })

  it('closes the scope prompt without a second command when the SleepyPod adapter becomes unavailable', async () => {
    setupStephenSleepypodLevelControl('bedtime')
    const view = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -2/i }))
    const bedDialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
    const targetSlider = within(bedDialog).getByRole('slider', { name: "Stephen's Bed target level" })
    fireEvent.keyDown(targetSlider, { key: 'ArrowLeft' })
    const scopeDialog = await screen.findByRole('dialog', { name: 'Set Bed Temperature' })
    const retainedTonightAction = within(scopeDialog).getByRole('button', { name: 'Tonight' })
    expect(targetSlider).toHaveAttribute('aria-valuenow', '-3')

    vi.useFakeTimers()
    try {
      act(() => {
        mockEntities['climate.sleepypod_eight_pod_left_side'].state = 'unavailable'
        view.rerender(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
      })
      act(() => {
        vi.advanceTimersByTime(10_001)
      })

      expect(scopeDialog).toHaveAttribute('data-state', 'closed')
      fireEvent.click(retainedTonightAction)
      expect(mockCallServiceCalls).toEqual([{
        domain: 'script',
        service: 'sleepypod_stephen_temperature_tonight',
        serviceData: { level: -3 },
      }])
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })

  it('reverts optimistic feedback when HA leaves the phase used by a completed choice', async () => {
    setupStephenSleepypodLevelControl('bedtime')
    const view = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -2/i }))
    const bedDialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
    fireEvent.keyDown(within(bedDialog).getByRole('slider', { name: "Stephen's Bed target level" }), { key: 'ArrowLeft' })
    const scopeDialog = await screen.findByRole('dialog', { name: 'Set Bed Temperature' })
    fireEvent.click(within(scopeDialog).getByRole('button', { name: 'Tonight' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Set Bed Temperature' })).not.toBeInTheDocument())
    expect(within(bedDialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -3/i })).toBeInTheDocument()

    act(() => {
      mockEntities['sensor.sleepypod_stephen_schedule_phase'].state = 'outside'
      view.rerender(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    })

    await waitFor(() => expect(within(bedDialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -2/i })).toBeInTheDocument())
    expect(mockCallServiceCalls).toEqual([{
      domain: 'script',
      service: 'sleepypod_stephen_temperature_tonight',
      serviceData: { level: -3 },
    }])
  })

  it('cancels a queued outside-window command when HA enters an active phase', async () => {
    setupStephenSleepypodLevelControl('outside')
    const view = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -2/i }))
    const bedDialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
    fireEvent.keyDown(within(bedDialog).getByRole('slider', { name: "Stephen's Bed target level" }), { key: 'ArrowLeft' })
    expect(within(bedDialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -3/i })).toBeInTheDocument()

    act(() => {
      mockEntities['sensor.sleepypod_stephen_schedule_phase'].state = 'bedtime'
      view.rerender(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    })
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 400))
    })

    expect(within(bedDialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -2/i })).toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([])
  })

  it('fails closed when the HA schedule phase is unavailable', async () => {
    setupStephenSleepypodLevelControl('unavailable')
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -2/i }))
    const dialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })

    expect(within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -2/i })).not.toHaveAttribute('aria-disabled')
    expect(within(dialog).queryByRole('slider', { name: "Stephen's Bed target level" })).not.toBeInTheDocument()
    expect(within(dialog).getByText('Schedule phase is unavailable.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Set Bed Temperature' })).not.toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([])
  })

  it('maps bed dial taps to bounded targets without entering the off confirmation path', async () => {
    mockEntities['climate.sleepypod_eight_pod_left_side'] = entity('climate.sleepypod_eight_pod_left_side', 'heat', {
      current_temperature: 81,
      hvac_modes: ['off', 'heat'],
      max_temp: 110,
      min_temp: 55,
      target_temp_step: 1,
      temperature: 77,
    })
    mockEntities['number.master_bedroom_sleepypod_eight_pod_left_target_level'] = entity('number.master_bedroom_sleepypod_eight_pod_left_target_level', '-2', {
      max: 10,
      min: -10,
      step: 1,
    })
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -2/i }))

    const dialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
    const dial = within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -2/i })
    const dialRect = {
      bottom: 500,
      height: 300,
      left: 100,
      right: 400,
      top: 200,
      width: 300,
      x: 100,
      y: 200,
      toJSON: () => ({}),
    } as DOMRect
    const maxPoint = valueToThermostatPoint(10, -10, 10)
    const clientX = dialRect.left + (maxPoint.x / 100) * dialRect.width
    const clientY = dialRect.top + (maxPoint.y / 100) * dialRect.height
    const rectSpy = vi.spyOn(dial, 'getBoundingClientRect').mockReturnValue(dialRect)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    try {
      fireEvent.pointerDown(dial, { button: 0, clientX: 250, clientY: 350, pointerId: 5, pointerType: 'mouse' })
      fireEvent.pointerUp(dial, { button: 0, clientX: 250, clientY: 350, pointerId: 5, pointerType: 'mouse' })
      fireEvent.pointerDown(dial, { button: 0, clientX, clientY, pointerId: 6, pointerType: 'mouse' })
      fireEvent.pointerMove(dial, { button: 0, clientX, clientY: clientY + 12, pointerId: 6, pointerType: 'mouse' })
      fireEvent.pointerUp(dial, { button: 0, clientX, clientY: clientY + 12, pointerId: 6, pointerType: 'mouse' })
      expect(mockCallServiceCalls).toEqual([])

      fireEvent.pointerDown(dial, { button: 0, clientX, clientY, pointerId: 7, pointerType: 'mouse' })
      fireEvent.pointerUp(dial, { button: 0, clientX, clientY, pointerId: 7, pointerType: 'mouse' })

      expect(within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Heating \+10/i })).toBeInTheDocument()
      expect(confirm).not.toHaveBeenCalled()
      await waitFor(() => expect(mockCallServiceCalls).toContainEqual({
        domain: 'script',
        service: 'sleepypod_stephen_temperature_outside_schedule',
        serviceData: { level: 10 },
      }))

      const targetSlider = within(dialog).getByRole('slider', { name: "Stephen's Bed target level" })
      expect(targetSlider).toHaveAttribute('aria-valuemin', '-10')
      expect(targetSlider).toHaveAttribute('aria-valuemax', '10')
      expect(targetSlider).toHaveAttribute('aria-valuenow', '10')
      fireEvent.keyDown(targetSlider, { key: 'ArrowLeft' })
      expect(within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Heating \+9/i })).toBeInTheDocument()
      await waitFor(() => expect(mockCallServiceCalls).toContainEqual({
        domain: 'script',
        service: 'sleepypod_stephen_temperature_outside_schedule',
        serviceData: { level: 9 },
      }))
      expect(confirm).not.toHaveBeenCalled()
    } finally {
      confirm.mockRestore()
      rectSpy.mockRestore()
    }
  })

  it('keeps off and unavailable bed dials non-interactive while exposing power separately', async () => {
    mockEntities['climate.sleepypod_eight_pod_left_side'] = entity('climate.sleepypod_eight_pod_left_side', 'off', {
      current_temperature: 81,
      hvac_modes: ['off', 'heat'],
      max_temp: 110,
      min_temp: 55,
      target_temp_step: 1,
      temperature: null,
    })
    mockEntities['number.master_bedroom_sleepypod_eight_pod_left_target_level'] = entity('number.master_bedroom_sleepypod_eight_pod_left_target_level', '0', {
      max: 10,
      min: -10,
      step: 1,
    })
    const view = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Off/i }))
    let dialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
    const offDial = within(dialog).getByRole('region', { name: "Stephen's Bed thermostat Off" })
    expect(offDial).toHaveAttribute('aria-disabled', 'true')
    expect(within(dialog).queryByRole('slider', { name: "Stephen's Bed target level" })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: "Turn on Stephen's Bed" })).toBeEnabled()
    expect(within(dialog).getByText('Use the power control to turn on the Pod.')).toBeInTheDocument()
    fireEvent.pointerDown(offDial, { button: 0, clientX: 150, clientY: 20, pointerId: 2, pointerType: 'mouse' })
    fireEvent.pointerUp(offDial, { button: 0, clientX: 150, clientY: 20, pointerId: 2, pointerType: 'mouse' })
    expect(mockCallServiceCalls).toEqual([])

    view.unmount()
    window.history.replaceState(null, '', `${window.location.pathname}#stephens-bed`)
    mockEntities['climate.sleepypod_eight_pod_left_side'].state = 'unavailable'
    mockEntities['number.master_bedroom_sleepypod_eight_pod_left_target_level'].state = 'unavailable'
    mockEntities['number.nightcanvasrestful_left_target_temperature'].state = 'unavailable'
    mockEntities['switch.nightcanvasrestful_left_power'].state = 'unavailable'
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    dialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
    expect(within(dialog).getByRole('region', { name: "Stephen's Bed thermostat unavailable" })).toHaveAttribute('aria-disabled', 'true')
    expect(within(dialog).getByRole('button', { name: "Stephen's Bed unavailable" })).toBeDisabled()
    expect(within(dialog).getByText('Bed controls are unavailable.')).toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([])
  })

  it('keeps the SleepyPod target-level hero stable through stale confirmation echoes', async () => {
    mockEntities['climate.sleepypod_eight_pod_left_side'] = entity('climate.sleepypod_eight_pod_left_side', 'heat', {
      current_temperature: 81,
      hvac_modes: ['off', 'heat'],
      max_temp: 110,
      min_temp: 55,
      target_temp_step: 1,
      temperature: 77,
    })
    mockEntities['number.master_bedroom_sleepypod_eight_pod_left_target_level'] = entity('number.master_bedroom_sleepypod_eight_pod_left_target_level', '-3', {
      max: 10,
      min: -10,
      step: 1,
    })
    const view = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -3/i }))

    const dialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
    vi.useFakeTimers()
    try {
      const targetSlider = within(dialog).getByRole('slider', { name: "Stephen's Bed target level" })
      for (let step = 0; step < 5; step += 1) fireEvent.keyDown(targetSlider, { key: 'ArrowRight' })
      expect(within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Heating \+2/i })).toBeInTheDocument()

      act(() => {
        mockEntities['number.master_bedroom_sleepypod_eight_pod_left_target_level'].state = '2'
        view.rerender(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
      })
      expect(within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Heating \+2/i })).toBeInTheDocument()

      act(() => {
        mockEntities['number.master_bedroom_sleepypod_eight_pod_left_target_level'].state = '-3'
        view.rerender(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
      })
      expect(within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Heating \+2/i })).toBeInTheDocument()
      expect(within(dialog).queryByRole('region', { name: /Stephen's Bed thermostat Cooling -3/i })).not.toBeInTheDocument()
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })

  it('preserves SleepyPod alarm payload fields when editing an active alarm', async () => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
    const mondayAlarms = [
      { alarmTemperature: 78, duration: 30, enabled: true, time: '06:30', vibrationIntensity: 75, vibrationPattern: 'double' },
      { alarmTemperature: 82, duration: 45, enabled: true, time: '07:15', vibrationIntensity: 100, vibrationPattern: 'rise' },
    ]
    const dayPayload = (alarms: typeof mondayAlarms = []) => ({
      alarm: alarms[0],
      alarms,
      power: { enabled: true, off: '23:59', on: '00:00' },
    })
    mockEntities['climate.sleepypod_eight_pod_left_side'] = entity('climate.sleepypod_eight_pod_left_side', 'heat', {
      current_temperature: 81,
      hvac_modes: ['off', 'heat'],
      max_temp: 110,
      min_temp: 55,
      target_temp_step: 1,
      temperature: 77,
    })
    mockEntities['number.master_bedroom_sleepypod_eight_pod_left_target_level'] = entity('number.master_bedroom_sleepypod_eight_pod_left_target_level', '-2', {
      max: 10,
      min: -10,
      step: 1,
    })
    mockEntities['sensor.master_bedroom_sleepypod_eight_pod_schedules'] = entity('sensor.master_bedroom_sleepypod_eight_pod_schedules', 'ready', {
      left: Object.fromEntries(days.map((day) => [day, dayPayload(day === 'monday' ? mondayAlarms : [])])),
      right: Object.fromEntries(days.map((day) => [day, dayPayload()])),
    })
    mockEntities['switch.nightcanvasrestful_left_alarms_enabled'].state = 'unavailable'
    mockEntities['input_boolean.stephen_alarms_enabled'].state = 'on'
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -2/i }))
    const dialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
    await clickModalTab(within(dialog), 'Alarms')

    const dayRow = within(dialog).getByRole('button', { name: /Stephen's Bed Monday Alarms 2 Enabled/i })
    expect(dayRow).toHaveAttribute('data-active', 'true')
    fireEvent.click(dayRow)
    const dayPage = await screen.findByRole('dialog', { name: "Stephen's Bed Monday Alarms" })
    fireEvent.click(within(dayPage).getByRole('button', { name: /Stephen's Bed Monday alarm at 6:30 AM, Enabled/i }))
    const editor = await screen.findByRole('dialog', { name: "Stephen's Bed Monday Alarm" })
    expect(within(editor).getByRole('switch', { name: 'Turn off Use Room Wake Lights' })).toBeInTheDocument()
    fireEvent.click(within(editor).getByRole('switch', { name: 'Turn off Alarm Enabled' }))
    fireEvent.change(within(editor).getByLabelText('Alarm time'), { target: { value: '06:40' } })
    fireEvent.click(within(editor).getByRole('button', { name: 'Save Alarm' }))

    await waitFor(() => expect(mqttPublishCalls()).toHaveLength(1))
    expect(mqttPublishCalls()[0]).toMatchObject({
      domain: 'mqtt',
      service: 'publish',
      serviceData: { topic: 'sleepypod/eight-pod/cmd/set-schedules' },
    })
    const payload = JSON.parse(String((mqttPublishCalls()[0].serviceData as { payload: string }).payload))
    expect(payload.left.monday.alarms).toEqual([
      { alarmTemperature: 78, duration: 30, enabled: false, time: '06:40', vibrationIntensity: 75, vibrationPattern: 'double' },
      { alarmTemperature: 82, duration: 45, enabled: true, time: '07:15', vibrationIntensity: 100, vibrationPattern: 'rise' },
    ])

    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to alarms' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Alarm' }))
    const addEditor = await screen.findByRole('dialog', { name: "Add Stephen's Bed Alarm" })
    const wakeLightToggle = within(addEditor).getByRole('switch', { name: 'Turn off Use Room Wake Lights' })
    expect(wakeLightToggle).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(wakeLightToggle)
    fireEvent.change(within(addEditor).getByLabelText('Alarm time'), { target: { value: '08:00' } })
    fireEvent.click(within(addEditor).getByRole('button', { name: 'Add Alarm' }))

    await waitFor(() => expect(mqttPublishCalls()).toHaveLength(2))
    const wakeLightCalls = mockCallServiceCalls.filter(call => (
      call.domain === 'wake_light'
      && call.service === 'command'
      && (call.serviceData as { operation?: string } | undefined)?.operation === 'link_alarm'
    ))
    expect(wakeLightCalls.at(-1)).toMatchObject({
      serviceData: {
        enabled: false,
        link_keys: [
          'sleepypod:left#monday#08:00',
          'sleepypod:left#tuesday#08:00',
          'sleepypod:left#wednesday#08:00',
          'sleepypod:left#thursday#08:00',
          'sleepypod:left#friday#08:00',
        ],
      },
    })
  })


  it('directly toggles one SleepyPod alarm with an exact side-only MQTT payload', async () => {
    const mondayAlarms = [
      testFreeSleepAlarm('06:30', true, { alarmTemperature: 78, duration: 30, vibrationIntensity: 75, vibrationPattern: 'double' }),
      testFreeSleepAlarm('07:15', false, { alarmTemperature: 84, duration: 45, vibrationIntensity: 60 }),
    ]
    const dayPayload = (alarms: TestFreeSleepAlarm[] = []) => ({
      alarm: alarms[0],
      alarms,
      power: { enabled: true, off: '23:59', on: '00:00' },
    })
    setupStephenSleepypodLevelControl('outside')
    mockEntities['sensor.master_bedroom_sleepypod_eight_pod_schedules'] = entity(
      'sensor.master_bedroom_sleepypod_eight_pod_schedules',
      'ready',
      {
        left: Object.fromEntries(TEST_FREE_SLEEP_DAYS.map((day) => [day, dayPayload(day === 'monday' ? mondayAlarms : [])])),
        right: Object.fromEntries(TEST_FREE_SLEEP_DAYS.map((day) => [day, dayPayload()])),
      },
    )
    render(<DashboardViewPage activePath='master-bedroom' onNavigate={() => undefined} path='master-bedroom' />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -2/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Stephen\u0027s Bed' })
    await clickModalTab(within(dialog), 'Alarms')
    const dayRow = within(dialog).getByRole('button', { name: /Stephen.s Bed Monday Alarms 1 Enabled • 1 Disabled/i })
    expect(within(dialog).queryByRole('switch', { name: /Monday alarm/i })).not.toBeInTheDocument()
    fireEvent.click(dayRow)
    fireEvent.click(within(dialog).getByRole('switch', { name: 'Turn off Stephen\u0027s Bed Monday alarm at 6:30 AM' }))

    expect(dialog).toHaveAccessibleName('Stephen\u0027s Bed Monday Alarms')
    expect(within(dialog).getByRole('button', { name: /Stephen.s Bed Monday alarm at 6:30 AM, Disabled/i })).toBeInTheDocument()
    await waitFor(() => expect(mockCallServiceCalls).toHaveLength(1))
    expect(mockCallServiceCalls[0]).toMatchObject({
      domain: 'mqtt',
      service: 'publish',
      serviceData: { topic: 'sleepypod/eight-pod/cmd/set-schedules' },
    })
    const payload = JSON.parse(String((mockCallServiceCalls[0].serviceData as { payload: string }).payload))
    expect(Object.keys(payload)).toEqual(['left'])
    expect(payload.left.monday.alarms).toEqual([
      { ...mondayAlarms[0], enabled: false },
      mondayAlarms[1],
    ])
    expect(payload.left.sunday.alarms).toEqual([])
    expect(payload.left.tuesday.alarms).toEqual([])
  })

  it('does not expose SleepyPod cover button gesture settings from the bed modal', async () => {
    mockEntities['climate.sleepypod_eight_pod_left_side'] = entity('climate.sleepypod_eight_pod_left_side', 'heat', {
      current_temperature: 81,
      hvac_modes: ['off', 'heat'],
      max_temp: 110,
      min_temp: 55,
      target_temp_step: 1,
      temperature: 70,
    })
    mockEntities['number.master_bedroom_sleepypod_eight_pod_left_target_level'] = entity('number.master_bedroom_sleepypod_eight_pod_left_target_level', '-2', {
      max: 10,
      min: -10,
      step: 1,
    })
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -2/i }))

    const dialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })

    expect(within(dialog).queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('heading', { name: 'Top Button' })).not.toBeInTheDocument()
    expect(mockCallServiceCalls.some(call => call.domain === 'mqtt' && call.service === 'publish')).toBe(false)
  })

  it('shows signed positive Free Sleep target levels on cards and modal readouts', async () => {
    mockEntities['number.nightcanvasrestful_left_target_temperature'].state = '2'
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    const bedCard = screen.getByRole('button', { name: /Your Side Heating • \+2/i })
    expect(bedCard).toBeInTheDocument()

    fireEvent.click(bedCard)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText("Stephen's Bed: Heating • +2")).toBeInTheDocument()
    expect(within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Heating \+2/i })).toBeInTheDocument()
  })

  it('opens the Master Bedroom LV600S modal with optimistic controls and tabs', async () => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Humidifier Humidifying • 46%/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Master Bedroom Humidifier' })).toBeInTheDocument()
    expect(within(dialog).getAllByLabelText('Master Bedroom humidifier controls').length).toBeGreaterThan(0)
    const mistDial = within(dialog).getByRole('region', { name: 'Humidifier mist level 5 • 5' })
    const mistTarget = within(mistDial).getByRole('slider', { name: 'Mist level' })
    const mistCurrent = mistDial.querySelector('[data-marker="current"]')
    expect(mistTarget).toHaveAttribute('aria-valuenow', '5')
    expect(mistCurrent).toHaveAttribute('data-value', '5')
    expect(mistCurrent!.compareDocumentPosition(mistTarget) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(dialog).getByRole('tablist', { name: 'Humidifier modal sections' })).toBeInTheDocument()
    expect(within(dialog).getByRole('tab', { name: 'Controls' })).toHaveAttribute('aria-selected', 'true')
    expect(within(dialog).getByText('46%')).toBeInTheDocument()
    expect(within(dialog).getByText('72°F')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Turn Off' }))
    fireEvent.click(within(dialog).getByRole('button', { name: /High Level 8/i }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Auto Humidity' }))
    fireEvent.keyDown(await within(dialog).findByRole('slider', { name: 'Target humidity' }), { key: 'ArrowRight' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'High' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Increase device timer' }))
    const displaySection = within(dialog).getByRole('heading', { name: 'Display' }).closest('section')
    expect(displaySection).not.toBeNull()
    expect(within(displaySection!).queryByText('On')).not.toBeInTheDocument()
    const displayToggle = within(dialog).getByRole('switch', { name: 'Turn off Display' })
    expect(displayToggle).toHaveStyle({ height: '34px', maxHeight: '34px', maxWidth: '56px', minHeight: '34px', minWidth: '56px', width: '56px' })
    fireEvent.click(displayToggle)

    expect(mockCallServiceCalls).toEqual([
      { domain: 'switch', service: 'turn_off', target: 'switch.lv600s_humidifier_power' },
      { domain: 'script', service: 'master_bedroom_humidifier_set_level', serviceData: { level: 8 } },
      { domain: 'select', service: 'select_option', target: 'select.lv600s_humidifier_mode', serviceData: { option: 'Target Humidity' } },
      { domain: 'number', service: 'set_value', target: 'number.lv600s_humidifier_target_humidity', serviceData: { value: 55 } },
      { domain: 'number', service: 'set_value', target: 'number.lv600s_humidifier_warm_level', serviceData: { value: 3 } },
      { domain: 'number', service: 'set_value', target: 'number.lv600s_humidifier_timer_minutes', serviceData: { value: 30 } },
      { domain: 'switch', service: 'turn_off', target: 'switch.lv600s_humidifier_display' },
    ])
  })

  it('creates an overnight humidifier scheduled activity through the HA schedule API', async () => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    fireEvent.click(screen.getByRole('button', { name: /Humidifier Humidifying • 46%/i }))
    const dialog = await screen.findByRole('dialog')

    fireEvent.click(within(dialog).getByRole('tab', { name: 'Schedules' }))
    expect(await within(dialog).findByText('No activities yet. Add morning, evening, or overnight profiles.')).toBeInTheDocument()
    await act(async () => {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
    })
    expect(dialog).toHaveStyle('--modal-body-footer-padding-bottom: 0px')
    const modalBody = dialog.querySelector<HTMLElement>('[data-modal-sheet-body="true"]')
    expect(modalBody).not.toBeNull()
    const schedulePanel = dialog.querySelector<HTMLElement>('[data-tab="schedules"]')
    expect(schedulePanel).not.toBeNull()
    modalBody!.scrollTop = 180
    schedulePanel!.scrollTop = 90
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Scheduled Activity' }))
    const activityPage = await screen.findByRole('dialog', { name: 'Add Master Bedroom Humidifier Schedule' })
    expect(activityPage).toBe(dialog)
    expect(activityPage).toHaveAttribute('data-scroll-mode', 'body')
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(within(activityPage).getByLabelText('Name')).toHaveFocus()
    expect(modalBody).toHaveProperty('scrollTop', 0)
    expect(within(activityPage).getByRole('button', { name: 'Back to schedules' })).toBeInTheDocument()
    expect(within(activityPage).queryByText('Recurring Home Assistant schedule')).not.toBeInTheDocument()
    expect(within(activityPage).queryByRole('region', { name: /Humidifier mist level/i })).not.toBeInTheDocument()
    expect(within(activityPage).getByRole('heading', { name: 'Mist Level' })).toBeInTheDocument()
    expect(within(activityPage).getByRole('slider', { name: 'Scheduled mist level' })).toBeInTheDocument()
    expect(within(activityPage).getByRole('button', { name: 'Low' })).toHaveAttribute('aria-pressed', 'true')
    const activityDisplaySection = within(activityPage).getByRole('heading', { name: 'Display' }).closest('section')
    expect(activityDisplaySection).not.toBeNull()
    expect(within(activityDisplaySection!).queryByText('On')).not.toBeInTheDocument()
    const activityDisplayToggle = within(activityPage).getByRole('switch', { name: 'Turn off Display' })
    expect(activityDisplayToggle).toHaveStyle({ height: '34px', width: '56px' })
    fireEvent.change(within(activityPage).getByLabelText('Start'), { target: { value: '' } })
    expect(within(activityPage).getByRole('alert')).toHaveTextContent('Choose valid start and end times.')
    expect(within(activityPage).getByRole('button', { name: 'Save Activity' })).toBeDisabled()
    fireEvent.change(within(activityPage).getByLabelText('Start'), { target: { value: '22:00' } })
    modalBody!.scrollTop = 420
    fireEvent.click(activityDisplayToggle)
    expect(modalBody).toHaveProperty('scrollTop', 420)
    fireEvent.change(within(activityPage).getByLabelText('Mode'), { target: { value: 'Target Humidity' } })
    expect(within(activityPage).getByRole('heading', { name: 'Target Humidity' })).toBeInTheDocument()
    expect(within(activityPage).getByRole('slider', { name: 'Scheduled target humidity' })).toBeInTheDocument()
    fireEvent.click(within(activityPage).getByRole('button', { name: 'Back to schedules' }))
    await waitFor(() => expect(within(dialog).getByRole('heading', { name: 'Master Bedroom Humidifier' })).toBeInTheDocument())
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(modalBody).toHaveProperty('scrollTop', 180)
    expect(dialog.querySelector<HTMLElement>('[data-tab="schedules"]')).toHaveProperty('scrollTop', 90)
    expect(within(dialog).getByRole('button', { name: 'Add Scheduled Activity' })).toHaveFocus()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Scheduled Activity' }))
    const reopenedActivityPage = await screen.findByRole('dialog', { name: 'Add Master Bedroom Humidifier Schedule' })
    expect(reopenedActivityPage).toBe(dialog)
    fireEvent.change(within(reopenedActivityPage).getByLabelText('Name'), { target: { value: 'Overnight' } })
    fireEvent.change(within(reopenedActivityPage).getByLabelText('Start'), { target: { value: '21:30' } })
    fireEvent.change(within(reopenedActivityPage).getByLabelText('End'), { target: { value: '06:30' } })
    fireEvent.change(within(reopenedActivityPage).getByLabelText('Mode'), { target: { value: 'Sleep' } })
    const saveActivity = within(reopenedActivityPage).getByRole('button', { name: 'Save Activity' })
    expect(saveActivity.closest('[data-modal-sheet-footer="true"]')).not.toBeNull()
    fireEvent.click(saveActivity)

    await waitFor(() => expect(mockScheduleMessages).toHaveLength(1))
    expect(mockScheduleMessages[0]).toMatchObject({
      type: 'schedule/update',
      schedule_id: 'master_bedroom_humidifier',
      monday: [{ from: '21:30', to: '24:00' }],
      tuesday: expect.arrayContaining([
        expect.objectContaining({ from: '00:00', to: '06:30' }),
        expect.objectContaining({ from: '21:30', to: '24:00' }),
      ]),
    })
    await waitFor(() => expect(within(dialog).getByRole('heading', { name: 'Master Bedroom Humidifier' })).toBeInTheDocument())
    expect(await within(dialog).findByText('Overnight')).toBeInTheDocument()
    expect(within(dialog).getByText('Weekdays · 9:30 PM–6:30 AM')).toBeInTheDocument()
    expect(within(dialog).getByText('Sleep')).toBeInTheDocument()
    expect(within(dialog).queryByText(/Sleep • Warm/)).not.toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([
      { domain: 'input_boolean', service: 'turn_on', target: 'input_boolean.master_bedroom_humidifier_schedule_enabled' },
    ])
  })

  it('hides display and device timer controls while the humidifier is off', async () => {
    mockEntities['switch.lv600s_humidifier_power'].state = 'off'
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Humidifier Off • 46%/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Off', { selector: 'p' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('heading', { name: 'Device Timer' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('heading', { name: 'Display' })).not.toBeInTheDocument()
    expect(within(dialog).queryByText(/Last level/i)).not.toBeInTheDocument()
    expect(within(dialog).getByText('OFF')).toBeInTheDocument()
  })

  it.each([
    ['Manual', 'Manual'],
    ['Auto Humidity', 'Target Humidity'],
    ['Sleep', 'Sleep'],
  ] as const)('turns the humidifier on when selecting %s while it is off', async (buttonLabel, mode) => {
    mockEntities['switch.lv600s_humidifier_power'].state = 'off'
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Humidifier Off • 46%/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: buttonLabel }))

    expect(within(dialog).getByRole('button', { name: 'Turn Off' })).toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([{
      domain: 'script',
      service: 'master_bedroom_humidifier_apply_profile',
      serviceData: {
        display: true,
        mist_level: 5,
        mode,
        target_humidity: 50,
        warm_level: 1,
      },
    }])
  })

  it('uses the wide status readout for humidifier Sleep mode', async () => {
    mockEntities['select.lv600s_humidifier_mode'].state = 'Sleep'
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Humidifier Humidifying • 46%/i }))
    const dialog = await screen.findByRole('dialog')
    const sleepReadout = within(dialog).getByRole('region', { name: 'Humidifier mist level Sleep • 5' })

    expect(within(sleepReadout).getByText('Sleep').closest('[data-primary-variant]')).toHaveAttribute('data-primary-variant', 'wide-status')
    expect(sleepReadout).not.toHaveAttribute('aria-disabled')
    expect(sleepReadout.querySelector('[data-marker="current"]')).toHaveAttribute('data-value', '5')
    expect(within(sleepReadout).queryByRole('slider', { name: 'Mist level' })).not.toBeInTheDocument()
  })

  it('omits the humidifier current marker when the live mist level is unavailable', async () => {
    mockEntities['number.lv600s_humidifier_mist_level'].state = 'unavailable'
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Humidifier Humidifying • 46%/i }))
    const dialog = await screen.findByRole('dialog')
    const mistDial = within(dialog).getByRole('region', { name: 'Humidifier mist level 5' })

    expect(mistDial.querySelector('[data-marker="current"]')).not.toBeInTheDocument()
    expect(within(mistDial).getByRole('slider', { name: 'Mist level' })).toHaveAttribute('aria-valuenow', '5')

    fireEvent.click(within(dialog).getByRole('tab', { name: 'Info' }))
    expect(await within(dialog).findByRole('group', { name: 'Mist Level Unavailable' })).toBeInTheDocument()
  })

  it('disables activity save when a new rule overlaps an existing activity', async () => {
    await mockState.connection.sendMessagePromise({
      type: 'schedule/update',
      schedule_id: 'master_bedroom_humidifier',
      name: 'Master Bedroom Humidifier',
      icon: 'mdi:calendar-clock',
      sunday: [],
      monday: [{ from: '21:30', to: '23:00', data: { rule_id: 'night', rule_days: 'monday', label: 'Night', start_time: '21:30', end_time: '23:00', mode: 'Sleep', mist_level: 1, target_humidity: 50, warm_level: 0, display: false } }],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
    })
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Humidifier Humidifying • 46%/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Schedules' }))
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Add Scheduled Activity' }))
    const activityPage = await screen.findByRole('dialog', { name: 'Add Master Bedroom Humidifier Schedule' })
    expect(within(activityPage).getByRole('alert')).toHaveTextContent('This activity overlaps another activity on Monday.')
    expect(within(activityPage).getByRole('button', { name: 'Save Activity' })).toBeDisabled()
  })

  it('uses the activity label as the edit-page title without a subtitle', async () => {
    await mockState.connection.sendMessagePromise({
      type: 'schedule/update',
      schedule_id: 'master_bedroom_humidifier',
      name: 'Master Bedroom Humidifier',
      icon: 'mdi:calendar-clock',
      sunday: [],
      monday: [
        { from: '20:00', to: '21:00', data: { rule_id: 'evening', rule_days: 'monday', label: 'Evening', start_time: '20:00', end_time: '21:00', mode: 'Manual', mist_level: 4, target_humidity: 50, warm_level: 0, display: true } },
        { from: '21:30', to: '23:00', data: { rule_id: 'night', rule_days: 'monday', label: 'Night', start_time: '21:30', end_time: '23:00', mode: 'Sleep', mist_level: 1, target_humidity: 50, warm_level: 0, display: false } },
      ],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
    })
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Humidifier Humidifying • 46%/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Schedules' }))
    const activityLabel = await within(dialog).findByText('Night')
    fireEvent.click(activityLabel.closest('button')!)
    const activityPage = await screen.findByRole('dialog', { name: 'Night' })
    expect(activityPage).toBe(dialog)
    expect(within(activityPage).queryByText('Recurring Home Assistant schedule')).not.toBeInTheDocument()
    expect(within(activityPage).getByRole('button', { name: 'Delete Activity' }).closest('[data-modal-sheet-footer="true"]')).not.toBeNull()
    expect(within(activityPage).getByRole('button', { name: 'Save Activity' }).closest('[data-modal-sheet-footer="true"]')).not.toBeNull()
    fireEvent.change(within(activityPage).getByLabelText('Start'), { target: { value: '20:30' } })
    fireEvent.change(within(activityPage).getByLabelText('End'), { target: { value: '21:30' } })
    expect(within(activityPage).getByRole('alert')).toHaveTextContent('This activity overlaps another activity on Monday.')
    expect(within(activityPage).getByRole('button', { name: 'Save Activity' })).toBeDisabled()
  })

  it('locks activity navigation while a schedule save is in flight', async () => {
    await mockState.connection.sendMessagePromise({
      type: 'schedule/update',
      schedule_id: 'master_bedroom_humidifier',
      name: 'Master Bedroom Humidifier',
      icon: 'mdi:calendar-clock',
      sunday: [],
      monday: [{ from: '21:30', to: '23:00', data: { rule_id: 'night', rule_days: 'monday', label: 'Night', start_time: '21:30', end_time: '23:00', mode: 'Sleep', mist_level: 1, target_humidity: 50, warm_level: 0, display: false } }],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
    })
    const originalSendMessage = mockState.connection.sendMessagePromise
    let releaseSave: (() => void) | undefined
    mockState.connection.sendMessagePromise = async (message) => {
      if (message.type === 'schedule/update') await new Promise<void>((resolve) => {
        releaseSave = resolve
      })
      return originalSendMessage(message)
    }

    try {
      render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
      fireEvent.click(screen.getByRole('button', { name: /Humidifier Humidifying • 46%/i }))
      const dialog = await screen.findByRole('dialog')
      fireEvent.click(within(dialog).getByRole('tab', { name: 'Schedules' }))
      fireEvent.click((await within(dialog).findByText('Night')).closest('button')!)
      const activityPage = await screen.findByRole('dialog', { name: 'Night' })

      fireEvent.click(within(activityPage).getByRole('button', { name: 'Save Activity' }))
      await waitFor(() => expect(within(activityPage).getByRole('button', { name: 'Saving...' })).toBeDisabled())
      expect(within(activityPage).getByLabelText('Name')).toBeDisabled()
      expect(within(activityPage).queryByRole('button', { name: 'Back to schedules' })).not.toBeInTheDocument()

      act(() => releaseSave?.())
      await waitFor(() => expect(within(dialog).getByRole('heading', { name: 'Master Bedroom Humidifier' })).toBeInTheDocument())
      await waitFor(() => expect(within(dialog).getByText('Night').closest('button')).toBeEnabled())
    } finally {
      mockState.connection.sendMessagePromise = originalSendMessage
    }
  })

  it('clears the unset-target warning immediately when 50% is explicitly committed', async () => {
    mockEntities['select.lv600s_humidifier_mode'].state = 'Target Humidity'
    mockEntities['number.lv600s_humidifier_target_humidity'].state = '100'
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Humidifier Humidifying • 46%/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Choose a target before relying on Auto Humidity.')).toBeInTheDocument()
    const targetDial = within(dialog).getByRole('region', { name: 'Target humidity 50% • 46%' })
    expect(targetDial.querySelector('[data-marker="current"]')).toHaveAttribute('data-value', '46')
    const nativeSlider = within(targetDial).getByTestId('control-slider-circular').querySelector('input')
    expect(nativeSlider).not.toBeNull()
    fireEvent.change(nativeSlider!, { target: { value: '50' } })
    fireEvent.pointerUp(nativeSlider!)

    expect(within(dialog).queryByText('Choose a target before relying on Auto Humidity.')).not.toBeInTheDocument()
  })

  it('shows scheduling as paused and non-editable while Vacation mode is active', async () => {
    await mockState.connection.sendMessagePromise({
      type: 'schedule/update',
      schedule_id: 'master_bedroom_humidifier',
      name: 'Master Bedroom Humidifier',
      icon: 'mdi:calendar-clock',
      sunday: [],
      monday: [{ from: '21:30', to: '23:00', data: { rule_id: 'night', rule_days: 'monday', label: 'Night', start_time: '21:30', end_time: '23:00', mode: 'Sleep', mist_level: 1, target_humidity: 50, warm_level: 0, display: false } }],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
    })
    mockEntities['input_boolean.master_bedroom_humidifier_schedule_enabled'].state = 'off'
    mockEntities['input_boolean.vacation_mode'].state = 'on'
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Humidifier Humidifying • 46%/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Schedules' }))
    expect(await within(dialog).findByText('Paused for Vacation')).toBeInTheDocument()
    expect(within(dialog).getByText('Vacation mode disables scheduled runs')).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /Paused for Vacation/i })).not.toBeInTheDocument()
  })

  it('disables an unavailable humidifier schedule master without blocking activity editing', async () => {
    await mockState.connection.sendMessagePromise({
      type: 'schedule/update',
      schedule_id: 'master_bedroom_humidifier',
      name: 'Master Bedroom Humidifier',
      icon: 'mdi:calendar-clock',
      sunday: [],
      monday: [{ from: '21:30', to: '23:00', data: { rule_id: 'night', rule_days: 'monday', label: 'Night', start_time: '21:30', end_time: '23:00', mode: 'Sleep', mist_level: 1, target_humidity: 50, warm_level: 0, display: false } }],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
    })
    mockEntities['input_boolean.master_bedroom_humidifier_schedule_enabled'].state = 'unavailable'
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Humidifier Humidifying • 46%/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Schedules' }))

    expect(await within(dialog).findByText('Scheduling Unavailable')).toBeInTheDocument()
    expect(within(dialog).getByText('Home Assistant schedule control is unavailable')).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /Scheduling Unavailable/i })).not.toBeInTheDocument()
    const activity = within(dialog).getByText('Night').closest('button')
    expect(activity).toBeEnabled()
    fireEvent.click(activity!)
    expect(await screen.findByRole('dialog', { name: 'Night' })).toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([])
  })

  it('prioritizes tank faults while keeping the power-off action available', async () => {
    mockEntities['binary_sensor.lv600s_humidifier_tank_removed'].state = 'on'
    mockEntities['binary_sensor.lv600s_humidifier_water_low'].state = 'on'
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Humidifier Tank Removed/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Tank removed')
    expect(within(dialog).queryByRole('slider', { name: 'Mist level' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Turn Off' })).toBeEnabled()
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Info' }))
    expect(await within(dialog).findByRole('group', { name: 'Tank Removed' })).toHaveAttribute('data-tone', 'danger')
  })

  it('opens Free Sleep bed modals with MQTT status and native controls', async () => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -1/i }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('data-surface', 'hass-popup')
    expect(within(dialog).getByRole('heading', { name: "Stephen's Bed" })).toBeInTheDocument()
    expect(within(dialog).getByText("Stephen's Bed: Cooling • -1")).toBeInTheDocument()
    expect(within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -1/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('slider', { name: "Stephen's Bed target level" })).toHaveAttribute('aria-readonly', 'false')
    expect(within(dialog).getByRole('heading', { name: 'Sleep Schedule' })).toBeInTheDocument()
    expect(within(dialog).getByText('Bedtime')).toBeInTheDocument()
    expect(within(dialog).getAllByText('0').length).toBeGreaterThanOrEqual(2)
    expect(within(dialog).queryByText('0°')).not.toBeInTheDocument()
    expect(within(dialog).getByText('Asleep')).toBeInTheDocument()
    expect(within(dialog).getAllByText('-1').length).toBeGreaterThanOrEqual(1)
    expect(within(dialog).getByText('Dawn')).toBeInTheDocument()
    expect(within(dialog).queryByRole('heading', { name: 'Alarms' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('heading', { name: 'Special Modes' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('heading', { name: 'Status' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('heading', { name: 'Controls' })).not.toBeInTheDocument()

    await clickModalTab(within(dialog), 'Special Modes')
    expect(within(dialog).getByRole('heading', { name: 'Special Modes' })).toBeInTheDocument()
    expect(within(dialog).getByText('Activating hot flash mode will set the bed to -10 for fifteen minutes.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Hot Flash Mode Inactive' })).toBeInTheDocument()

    await clickModalTab(within(dialog), 'Alarms')
    expect(within(dialog).getByRole('heading', { name: 'Alarms' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('heading', { name: 'Schedule Control' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Add Alarm' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('article', { name: /Stephen's Bed Monday alarm disabled/i })).not.toBeInTheDocument()

    await clickModalTab(within(dialog), 'Status')
    expect(within(dialog).getByRole('heading', { name: 'Status' })).toBeInTheDocument()
    expect(within(dialog).getByText('Current Temp')).toBeInTheDocument()
    expect(within(dialog).getAllByText('86°F').length).toBeGreaterThanOrEqual(1)
    expect(within(dialog).getByText('Presence')).toBeInTheDocument()
    expect(within(dialog).getByText('In Bed')).toBeInTheDocument()
    expect(within(dialog).getByText('Time Remaining')).toBeInTheDocument()
    expect(within(dialog).getByText('2h')).toBeInTheDocument()
    expect(within(dialog).getByText('Alarm')).toBeInTheDocument()
    expect(within(dialog).getByText('Idle')).toBeInTheDocument()

    await clickModalTab(within(dialog), 'Settings')
    expect(within(dialog).getByRole('heading', { name: 'Bedtime' })).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Controls' })).toBeInTheDocument()
    const awayMode = within(dialog).getByRole('button', { name: 'Away Mode Off' })

    fireEvent.click(awayMode)

    expect(mockCallServiceCalls).toEqual([
      { domain: 'switch', service: 'turn_on', target: 'switch.nightcanvasrestful_left_away_mode' },
    ])
  })

  it('updates Free Sleep bedtime from the bed modal settings tab', async () => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -1/i }))

    const dialog = await screen.findByRole('dialog')
    await clickModalTab(within(dialog), 'Settings')
    expect(within(dialog).getByRole('button', { name: "Stephen's Bed bedtime 9:30 PM" })).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: "Change Stephen's Bed bedtime" })).not.toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText("Stephen's Bed bedtime"), { target: { value: '22:15' } })

    expect(within(dialog).getByRole('button', { name: "Stephen's Bed bedtime 10:15 PM" })).toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([
      { domain: 'text', service: 'set_value', target: 'text.master_bedroom_eight_sleep_pod_5_left_bedtime', serviceData: { value: '22:15' } },
    ])
  })

  it('lets Free Sleep bed modals animate closed through the shared sheet state', async () => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -1/i }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))

    await waitFor(() => expect(dialog).toHaveAttribute('data-state', 'closed'))
  })

  it('falls back to the Free Sleep bedtime MQTT command before the text entity is discovered', async () => {
    mockEntities['text.master_bedroom_eight_sleep_pod_5_left_bedtime'].state = 'unavailable'
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -1/i }))

    const dialog = await screen.findByRole('dialog')
    await clickModalTab(within(dialog), 'Settings')
    expect(within(dialog).getByRole('button', { name: "Stephen's Bed bedtime 9:30 PM" })).toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText("Stephen's Bed bedtime"), { target: { value: '20:45' } })

    expect(mockCallServiceCalls).toEqual([
      { domain: 'mqtt', service: 'publish', serviceData: { payload: '20:45', topic: 'free-sleep/NightCanvasRestful/left/schedule/bedtime/set' } },
    ])
  })

  it('resets the bed modal scroll position when switching content tabs', async () => {
    const originalScrollTo = HTMLElement.prototype.scrollTo
    const scrollTo = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: scrollTo })
    try {
      render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

      fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -1/i }))

      const dialog = await screen.findByRole('dialog')
      scrollTo.mockClear()
      await clickModalTab(within(dialog), 'Status')

      expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
    } finally {
      if (originalScrollTo) Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: originalScrollTo })
      else Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo')
    }
  })

  it('aligns the SleepyPod current marker when HA reports the physical target is reached', async () => {
    setupStephenSleepypodLevelControl('bedtime')
    mockEntities['climate.sleepypod_eight_pod_left_side'].attributes.current_temperature = 85
    mockEntities['number.master_bedroom_sleepypod_eight_pod_left_target_level'].state = '1'
    mockEntities['number.master_bedroom_sleepypod_eight_pod_left_target_level'].attributes.targetTemperature = 85
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Heating • \+1/i }))

    const dialog = await screen.findByRole('dialog')
    const dial = within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Heating \+1 • 85°F/i })
    const target = within(dial).getByRole('slider', { name: "Stephen's Bed target level" })
    const current = dial.querySelector('[data-marker="current"]')

    expect(current).toHaveAttribute('data-value', '1')
    expect(current).toHaveAttribute('style', target.getAttribute('style'))
  })

  it('starts SleepyPod hot flash mode in the cooling phase from the bed modal', async () => {
    setupStephenSleepypodLevelControl('bedtime')
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling/i }))

    const dialog = await screen.findByRole('dialog')
    await clickModalTab(within(dialog), 'Special Modes')
    const hotFlash = within(dialog).getByRole('button', { name: 'Hot Flash Mode Inactive' })
    expect(hotFlash.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:snowflake'))

    fireEvent.click(hotFlash)

    expect(within(dialog).getByText("Stephen's Bed: Hot Flash Mode")).toBeInTheDocument()
    const hotFlashDial = within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -10/i })
    expect(hotFlashDial).toBeInTheDocument()
    expect(hotFlashDial.querySelector('[data-marker="target"]')).toHaveAttribute('data-value', '-10')
    const currentMarker = hotFlashDial.querySelector('[data-marker="current"]')
    expect(Number(currentMarker?.getAttribute('data-value'))).toBeCloseTo(-0.55, 2)
    expect(within(dialog).queryByRole('slider', { name: "Stephen's Bed target level" })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Hot Flash Mode Active' })).toBeInTheDocument()
    expect(within(dialog).getByText('Cooling Bed')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Your Side Hot Flash Mode • Cooling/i, hidden: true }).some((button) => button.getAttribute('data-muted') === 'false')).toBe(true)
    expect(mockCallServiceCalls).toEqual([
      { domain: 'input_button', service: 'press', target: 'input_button.eight_sleep_stephen_hot_flash' },
    ])
  })

  it('shows the SleepyPod hot flash countdown only during the hold and cancels it', async () => {
    setupStephSleepypodLevelControl('asleep')
    mockEntities['input_boolean.eight_sleep_steph_hot_flash_active'].state = 'on'
    mockEntities['timer.eight_sleep_steph_hot_flash'].state = 'active'
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Side 12:34 Remaining/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText("Steph's Bed: Hot Flash Mode")).toBeInTheDocument()
    await clickModalTab(within(dialog), 'Special Modes')
    expect(within(dialog).getByRole('button', { name: 'Hot Flash Mode Active' })).toBeInTheDocument()
    expect(within(dialog).getByText('12:34')).toBeInTheDocument()
    expect(within(dialog).queryByText('Cooling Bed')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Steph's Side 12:34 Remaining/i, hidden: true }).some((button) => button.getAttribute('data-muted') === 'false')).toBe(true)
    const cancel = within(dialog).getByRole('button', { name: "Cancel Steph's Bed hot flash mode" })
    expect(cancel.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:close'))

    fireEvent.click(cancel)

    expect(within(dialog).getByText("Steph's Bed: Heating • +1")).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Hot Flash Mode Inactive' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Steph's Side Heating • \+1/i, hidden: true }).some((button) => button.getAttribute('data-muted') === 'false')).toBe(true)
    expect(mockCallServiceCalls).toEqual([
      { domain: 'input_button', service: 'press', target: 'input_button.eight_sleep_steph_cancel_hot_flash' },
    ])
  })

  it('updates the bed tile countdown while the SleepyPod hot flash hold is active', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-19T12:00:00Z'))
    try {
      setupStephSleepypodLevelControl('asleep')
      mockEntities['input_boolean.eight_sleep_steph_hot_flash_active'].state = 'on'
      mockEntities['timer.eight_sleep_steph_hot_flash'] = entity('timer.eight_sleep_steph_hot_flash', 'active', {
        finishes_at: new Date(Date.now() + 65_000).toISOString(),
      })
      render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

      expect(screen.getByRole('button', { name: /Steph's Side 1:05 Remaining/i })).toBeInTheDocument()

      act(() => vi.advanceTimersByTime(1000))

      expect(screen.getByRole('button', { name: /Steph's Side 1:04 Remaining/i })).toBeInTheDocument()
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })

  it('shows Cooling Bed instead of the restore deadline while SleepyPod hot flash is cooling', async () => {
    setupStephenSleepypodLevelControl('bedtime')
    mockEntities['input_boolean.eight_sleep_stephen_hot_flash_active'].state = 'on'
    mockEntities['timer.eight_sleep_stephen_hot_flash'].state = 'idle'
    mockEntities['number.master_bedroom_sleepypod_eight_pod_left_target_level'].state = '-10'
    mockEntities['input_datetime.eight_sleep_stephen_hot_flash_restore_at'].attributes.timestamp = (Date.now() + (14 * 60 + 34) * 1000) / 1000
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Hot Flash Mode • Cooling/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText("Stephen's Bed: Hot Flash Mode")).toBeInTheDocument()
    expect(within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -10/i })).not.toHaveAttribute('aria-disabled')
    expect(within(dialog).queryByRole('slider', { name: "Stephen's Bed target level" })).not.toBeInTheDocument()
    expect(within(dialog).getByText('Hot Flash Mode controls the target.')).toBeInTheDocument()
    await clickModalTab(within(dialog), 'Special Modes')
    expect(within(dialog).getByRole('button', { name: 'Hot Flash Mode Active' })).toBeInTheDocument()
    expect(within(dialog).getByText('Cooling Bed')).toBeInTheDocument()
    expect(within(dialog).queryByText('14:34')).not.toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: "Cancel Stephen's Bed hot flash mode" }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'input_button', service: 'press', target: 'input_button.eight_sleep_stephen_cancel_hot_flash' },
    ])
  })

  it('uses the restore deadline only as a fallback for an active SleepyPod hold timer', async () => {
    setupStephenSleepypodLevelControl('bedtime')
    mockEntities['input_boolean.eight_sleep_stephen_hot_flash_active'].state = 'on'
    mockEntities['timer.eight_sleep_stephen_hot_flash'] = entity('timer.eight_sleep_stephen_hot_flash', 'active')
    mockEntities['input_datetime.eight_sleep_stephen_hot_flash_restore_at'].attributes.timestamp = (Date.now() + (14 * 60 + 34) * 1000) / 1000
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side 14:34 Remaining/i }))

    const dialog = await screen.findByRole('dialog')
    await clickModalTab(within(dialog), 'Special Modes')
    expect(within(dialog).getByText('14:34')).toBeInTheDocument()
    expect(within(dialog).queryByText('Cooling Bed')).not.toBeInTheDocument()
  })

  it('cancels an in-flight target edit when Hot Flash mode takes ownership', async () => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -1/i }))
    const dialog = await screen.findByRole('dialog')
    await clickModalTab(within(dialog), 'Special Modes')
    vi.useFakeTimers()
    try {
      fireEvent.keyDown(within(dialog).getByRole('slider', { name: "Stephen's Bed target level" }), { key: 'ArrowLeft' })
      expect(within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -2/i })).toBeInTheDocument()
      fireEvent.click(within(dialog).getByRole('button', { name: 'Hot Flash Mode Inactive' }))

      expect(within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -10/i })).not.toHaveAttribute('aria-disabled')
      expect(within(dialog).queryByRole('slider', { name: "Stephen's Bed target level" })).not.toBeInTheDocument()
      act(() => vi.advanceTimersByTime(300))
      expect(mockCallServiceCalls).toEqual([
        { domain: 'input_button', service: 'press', target: 'input_button.eight_sleep_stephen_hot_flash' },
      ])
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })

  it.each([
    ["left", /Your Side Cooling/, "Stephen\u0027s Bed", "Steph\u0027s Bed"],
    ["right", /Steph's Side Off/, "Steph\u0027s Bed", "Stephen\u0027s Bed"],
  ] as const)("shows only the opened %s active alarm directly below its hero and in alarm detail pages", async (side, bedButtonName, sideTitle, otherSideTitle) => {
    if (side === "left") {
      setFreeSleepWakeDayAlarms("left", "sunday", [testFreeSleepAlarm("06:30"), testFreeSleepAlarm("07:15")])
    }
    mockEntities["sensor.master_bedroom_sleepypod_eight_pod_left_alarm_state"].state = "ringing"
    mockEntities["sensor.master_bedroom_sleepypod_eight_pod_right_alarm_state"].state = "ringing"
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole("button", { name: bedButtonName }))

    const dialog = await screen.findByRole("dialog", { name: sideTitle })
    const heading = within(dialog).getByRole("heading", { name: "Alarm Active" })
    const section = heading.closest("section")
    const heroColumn = section?.parentElement
    expect(within(dialog).getByRole("group", { name: `${sideTitle} active alarm controls` })).toBeInTheDocument()
    expect(within(dialog).queryByRole("group", { name: `${otherSideTitle} active alarm controls` })).not.toBeInTheDocument()
    expect(within(dialog).getByRole("heading", { name: "Sleep Schedule" })).toBeInTheDocument()
    expect(heroColumn?.firstElementChild).toHaveAttribute("data-section", "eight-sleep-hero")
    expect(heroColumn?.lastElementChild).toBe(section)
    expect(heroColumn?.nextElementSibling).toHaveAttribute("data-scroll-region", "eight-sleep-panel")

    await clickModalTab(within(dialog), 'Alarms')
    fireEvent.click(within(dialog).getByRole('button', { name: new RegExp(`${sideTitle} Sunday Alarms 2 Enabled`, 'i') }))
    expect(dialog).toHaveAccessibleName(`${sideTitle} Sunday Alarms`)
    expect(within(dialog).getByRole('group', { name: `${sideTitle} active alarm controls` })).toBeInTheDocument()
    expect(within(dialog).getAllByRole('switch')).toHaveLength(2)
    expect(within(dialog).getByRole('switch', { name: 'Turn off ' + sideTitle + ' Sunday alarm at 6:30 AM' })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: new RegExp(`${sideTitle} Sunday alarm at 6:30 AM, Enabled`, 'i') }))
    expect(dialog).toHaveAccessibleName(`${sideTitle} Sunday Alarm`)
    expect(within(dialog).getByRole('group', { name: `${sideTitle} active alarm controls` })).toBeInTheDocument()
  })

  it('groups alarm rows by ordered wake day with exact singular, plural, and state summaries', async () => {
    setFreeSleepWakeDayAlarms('right', 'sunday', [testFreeSleepAlarm('06:30'), testFreeSleepAlarm('07:15', false)])
    setFreeSleepWakeDayAlarms('right', 'monday', [testFreeSleepAlarm('06:45')])
    setFreeSleepWakeDayAlarms('right', 'tuesday', [testFreeSleepAlarm('07:00', false), testFreeSleepAlarm('08:00', false)])
    setFreeSleepWakeDayAlarms('right', 'saturday', [testFreeSleepAlarm('09:00')])
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Side Off/i }))
    const dialog = await screen.findByRole('dialog', { name: "Steph's Bed" })
    await clickModalTab(within(dialog), 'Alarms')

    const groupedNames = within(dialog).getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? '')
      .filter((name) => name.startsWith("Steph's Bed ") && / Alarms? /.test(name))
    expect(groupedNames).toEqual([
      "Steph's Bed Sunday Alarms 1 Enabled • 1 Disabled",
      "Steph's Bed Monday Alarm Enabled",
      "Steph's Bed Tuesday Alarms 2 Disabled",
      "Steph's Bed Saturday Alarm Enabled",
    ])
    expect(within(dialog).queryByText('Sunday Alarm 2')).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('heading', { name: 'Wake Light' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('switch', { name: /Use Room Wake Lights/ })).not.toBeInTheDocument()
    expect(within(dialog).getAllByRole('switch').map(toggle => toggle.getAttribute('aria-label'))).toEqual([
      "Turn off Steph's Bed Monday alarm at 6:45 AM",
      "Turn off Steph's Bed Saturday alarm at 9:00 AM",
    ])
  })

  it.each([
    ['left', /Your Side Cooling • -1/i, 'Stephen\u0027s Bed', '06:45', '6:45 AM'],
    ['right', /Steph's Side Off/i, 'Steph\u0027s Bed', '07:05', '7:05 AM'],
  ] as const)('directly disables and enables the %s single-alarm main row without opening edit', async (side, bedButtonName, sideTitle, time, displayTime) => {
    setFreeSleepWakeDayAlarms(side, 'sunday', [testFreeSleepAlarm(time)])
    render(<DashboardViewPage activePath='master-bedroom' onNavigate={() => undefined} path='master-bedroom' />)

    fireEvent.click(screen.getByRole('button', { name: bedButtonName }))
    const dialog = await screen.findByRole('dialog', { name: sideTitle })
    await clickModalTab(within(dialog), 'Alarms')

    const rowName = sideTitle + ' Sunday Alarm Enabled'
    const toggleLabel = sideTitle + ' Sunday alarm at ' + displayTime
    const row = within(dialog).getByRole('button', { name: rowName })
    const disableToggle = within(dialog).getByRole('switch', { name: 'Turn off ' + toggleLabel })
    expect(row).not.toContainElement(disableToggle)
    expect(within(dialog).queryByRole('switch', { name: /Use Room Wake Lights/ })).not.toBeInTheDocument()
    expect(within(dialog).getAllByRole('switch')).toHaveLength(1)

    fireEvent.click(disableToggle)

    expect(dialog).toHaveAccessibleName(sideTitle)
    expect(within(dialog).getByRole('button', { name: sideTitle + ' Sunday Alarm Disabled' })).toHaveAttribute('data-active', 'false')
    const enableToggle = within(dialog).getByRole('switch', { name: 'Turn on ' + toggleLabel })
    expect(enableToggle).toHaveAttribute('aria-checked', 'false')
    await waitFor(() => expect(mockCallServiceCalls).toHaveLength(1))
    const disabledPayload = JSON.parse(String((mockCallServiceCalls[0].serviceData as { payload: string }).payload))
    expect(Object.keys(disabledPayload)).toEqual([side])
    expect(disabledPayload[side].saturday.alarms).toEqual([
      { alarmTemperature: 82, duration: 300, enabled: false, time, vibrationIntensity: 100, vibrationPattern: 'rise' },
    ])

    fireEvent.click(enableToggle)

    expect(dialog).toHaveAccessibleName(sideTitle)
    expect(within(dialog).getByRole('button', { name: rowName })).toHaveAttribute('data-active', 'true')
    await waitFor(() => expect(mockCallServiceCalls).toHaveLength(2))
    const enabledPayload = JSON.parse(String((mockCallServiceCalls[1].serviceData as { payload: string }).payload))
    expect(enabledPayload[side].saturday.alarms).toEqual([
      { alarmTemperature: 82, duration: 300, enabled: true, time, vibrationIntensity: 100, vibrationPattern: 'rise' },
    ])
  })

  it('toggles one multi-alarm day row inline and preserves exact MQTT fields and order', async () => {
    const firstAlarm = testFreeSleepAlarm('06:30', true, {
      alarmTemperature: 78,
      duration: 30,
      vibrationIntensity: 75,
      vibrationPattern: 'double',
    })
    const secondAlarm = testFreeSleepAlarm('07:15', false, {
      alarmTemperature: 84,
      duration: 45,
      vibrationIntensity: 60,
    })
    setFreeSleepWakeDayAlarms('right', 'sunday', [firstAlarm, secondAlarm])
    render(<DashboardViewPage activePath='master-bedroom' onNavigate={() => undefined} path='master-bedroom' />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Side Off/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Steph\u0027s Bed' })
    await clickModalTab(within(dialog), 'Alarms')
    const dayGroup = within(dialog).getByRole('button', { name: 'Steph\u0027s Bed Sunday Alarms 1 Enabled • 1 Disabled' })
    expect(within(dialog).queryByRole('switch', { name: /Sunday alarm/i })).not.toBeInTheDocument()
    fireEvent.click(dayGroup)

    expect(dialog).toHaveAccessibleName('Steph\u0027s Bed Sunday Alarms')
    expect(within(dialog).getAllByRole('switch')).toHaveLength(2)
    const alarmRow = within(dialog).getByRole('button', { name: /Steph.s Bed Sunday alarm at 6:30 AM, Enabled/i })
    const toggle = within(dialog).getByRole('switch', { name: 'Turn off Steph\u0027s Bed Sunday alarm at 6:30 AM' })
    expect(alarmRow).not.toContainElement(toggle)

    fireEvent.click(toggle)

    expect(dialog).toHaveAccessibleName('Steph\u0027s Bed Sunday Alarms')
    expect(within(dialog).getByRole('button', { name: /Steph.s Bed Sunday alarm at 6:30 AM, Disabled/i })).toHaveAttribute('data-active', 'false')
    expect(within(dialog).queryByText('Alarm Enabled')).not.toBeInTheDocument()
    await waitFor(() => expect(mqttPublishCalls()).toHaveLength(1))
    const payload = JSON.parse(String((mqttPublishCalls()[0].serviceData as { payload: string }).payload))
    expect(Object.keys(payload)).toEqual(['right'])
    expect(payload.right.saturday.alarms).toEqual([
      { ...firstAlarm, enabled: false },
      secondAlarm,
    ])
  })

  it.each([
    ['left', /Your Side Cooling • -1/i, "Stephen's Bed"],
    ['right', /Steph's Side Off/i, "Steph's Bed"],
  ] as const)('uses per-alarm state without a %s schedule master', async (_side, bedButtonName, sideTitle) => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: bedButtonName }))
    const dialog = await screen.findByRole('dialog', { name: sideTitle })
    await clickModalTab(within(dialog), 'Alarms')

    expect(within(dialog).queryByRole('heading', { name: 'Schedule Control' })).not.toBeInTheDocument()
    expect(within(dialog).queryByText(/Alarm Schedule (Enabled|Disabled)/)).not.toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([])
  })

  it.each([
    ['left', /Your Side Cooling • -1/i, "Stephen's Bed", '06:45'],
    ['right', /Steph's Side Off/i, "Steph's Bed", '07:05'],
  ] as const)('globally adds weekday-default alarms for the %s side and restores main scroll and focus', async (side, bedButtonName, sideTitle, time) => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: bedButtonName }))
    const dialog = await screen.findByRole('dialog', { name: sideTitle })
    await clickModalTab(within(dialog), 'Alarms')
    const alarmPanel = dialog.querySelector<HTMLElement>('[data-scroll-region="eight-sleep-panel"]')
    expect(alarmPanel).not.toBeNull()
    alarmPanel!.scrollTop = 120

    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Alarm' }))
    const firstEditor = await screen.findByRole('dialog', { name: `Add ${sideTitle} Alarm` })
    expect(firstEditor).toBe(dialog)
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(within(firstEditor).getByRole('button', { name: 'Sunday' })).toHaveFocus()
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
      expect(within(firstEditor).getByRole('button', { name: day })).toHaveAttribute('aria-pressed', 'true')
    }
    expect(within(firstEditor).getByRole('button', { name: 'Sunday' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(firstEditor).getByRole('button', { name: 'Saturday' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(firstEditor).queryByRole('switch')).not.toBeInTheDocument()
    expect(within(firstEditor).queryByText('Alarm Enabled')).not.toBeInTheDocument()
    const monday = within(firstEditor).getByRole('button', { name: 'Monday' })
    fireEvent.click(monday)
    fireEvent.change(within(firstEditor).getByLabelText('Alarm time'), { target: { value: time } })
    expect(monday).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(within(firstEditor).getByRole('button', { name: 'Back to alarms' }))

    await waitFor(() => expect(within(dialog).getByRole('heading', { name: sideTitle })).toBeInTheDocument())
    expect(dialog.querySelector<HTMLElement>('[data-scroll-region="eight-sleep-panel"]')).toHaveProperty('scrollTop', 120)
    expect(within(dialog).getByRole('button', { name: 'Add Alarm' })).toHaveFocus()
    expect(mockCallServiceCalls).toEqual([])

    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Alarm' }))
    const editor = await screen.findByRole('dialog', { name: `Add ${sideTitle} Alarm` })
    fireEvent.change(within(editor).getByLabelText('Alarm time'), { target: { value: time } })
    fireEvent.click(within(editor).getByRole('button', { name: 'Add Alarm' }))

    await waitFor(() => expect(mqttPublishCalls()).toHaveLength(1))
    const payload = JSON.parse(String((mqttPublishCalls()[0].serviceData as { payload: string }).payload))
    for (const scheduleDay of ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday']) {
      expect(payload[side][scheduleDay].alarms).toEqual(expect.arrayContaining([expect.objectContaining({ enabled: true, time })]))
    }
    await waitFor(() => expect(within(dialog).getByRole('heading', { name: sideTitle })).toBeInTheDocument())
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
      expect(within(dialog).getByRole('button', { name: new RegExp(`${sideTitle} ${day} Alarm Enabled`, 'i') })).toBeInTheDocument()
    }
  })

  it.each([
    ['left', /Your Side Cooling • -1/i, "Stephen's Bed", '08:10'],
    ['right', /Steph's Side Off/i, "Steph's Bed", '08:20'],
  ] as const)('uses a locked day override and nested Back scroll and focus for the %s side', async (side, bedButtonName, sideTitle, time) => {
    if (side === 'left') {
      setFreeSleepWakeDayAlarms('left', 'sunday', [testFreeSleepAlarm('06:30'), testFreeSleepAlarm('07:15')])
    }
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: bedButtonName }))
    const dialog = await screen.findByRole('dialog', { name: sideTitle })
    await clickModalTab(within(dialog), 'Alarms')
    const mainPanel = dialog.querySelector<HTMLElement>('[data-scroll-region="eight-sleep-panel"]')!
    mainPanel.scrollTop = 120
    const sundayGroup = within(dialog).getByRole('button', { name: new RegExp(`${sideTitle} Sunday Alarms 2 Enabled`, 'i') })
    fireEvent.click(sundayGroup)

    const dayPage = await screen.findByRole('dialog', { name: `${sideTitle} Sunday Alarms` })
    const firstAlarm = within(dayPage).getByRole('button', { name: new RegExp(`${sideTitle} Sunday alarm at 6:30 AM, Enabled`, 'i') })
    expect(firstAlarm).toHaveFocus()
    const modalBody = dayPage.querySelector<HTMLElement>('[data-modal-sheet-body="true"]')!
    modalBody.scrollTop = 84
    fireEvent.click(within(dayPage).getByRole('button', { name: 'Add Alarm' }))

    const editor = await screen.findByRole('dialog', { name: `Add ${sideTitle} Sunday Alarm` })
    expect(within(editor).queryByRole('button', { name: 'Sunday' })).not.toBeInTheDocument()
    expect(within(editor).queryByText('Days')).not.toBeInTheDocument()
    expect(within(editor).queryByRole('switch')).not.toBeInTheDocument()
    expect(within(editor).getByLabelText('Alarm time')).toHaveFocus()
    fireEvent.click(within(editor).getByRole('button', { name: 'Back to Sunday alarms' }))

    await waitFor(() => expect(dayPage).toHaveAccessibleName(`${sideTitle} Sunday Alarms`))
    expect(modalBody).toHaveProperty('scrollTop', 84)
    expect(within(dayPage).getByRole('button', { name: 'Add Alarm' })).toHaveFocus()
    fireEvent.click(within(dayPage).getByRole('button', { name: 'Back to alarms' }))

    await waitFor(() => expect(dialog).toHaveAccessibleName(sideTitle))
    expect(dialog.querySelector<HTMLElement>('[data-scroll-region="eight-sleep-panel"]')).toHaveProperty('scrollTop', 120)
    expect(within(dialog).getByRole('button', { name: new RegExp(`${sideTitle} Sunday Alarms 2 Enabled`, 'i') })).toHaveFocus()

    fireEvent.click(within(dialog).getByRole('button', { name: new RegExp(`${sideTitle} Sunday Alarms 2 Enabled`, 'i') }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Alarm' }))
    fireEvent.change(within(dialog).getByLabelText('Alarm time'), { target: { value: time } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Alarm' }))

    await waitFor(() => expect(mqttPublishCalls()).toHaveLength(1))
    expect(dialog).toHaveAccessibleName(`${sideTitle} Sunday Alarms`)
    expect(within(dialog).getAllByRole('button', { name: new RegExp(`${sideTitle} Sunday alarm at`, 'i') })).toHaveLength(3)
    const payload = JSON.parse(String((mqttPublishCalls()[0].serviceData as { payload: string }).payload))
    expect(payload[side].saturday.alarms).toEqual(expect.arrayContaining([expect.objectContaining({ enabled: true, time })]))
  })

  it.each([
    ['left', /Your Side Cooling • -1/i, "Stephen's Bed"],
    ['right', /Steph's Side Off/i, "Steph's Bed"],
  ] as const)('edits, deletes, normalizes, and returns through the %s day flow', async (side, bedButtonName, sideTitle) => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true).mockReturnValueOnce(false)
    if (side === 'left') {
      setFreeSleepWakeDayAlarms('left', 'sunday', [testFreeSleepAlarm('06:30'), testFreeSleepAlarm('07:15')])
    }
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: bedButtonName }))
    const dialog = await screen.findByRole('dialog', { name: sideTitle })
    await clickModalTab(within(dialog), 'Alarms')
    fireEvent.click(within(dialog).getByRole('button', { name: new RegExp(`${sideTitle} Sunday Alarms 2 Enabled`, 'i') }))
    fireEvent.click(within(dialog).getByRole('button', { name: new RegExp(`${sideTitle} Sunday alarm at 6:30 AM, Enabled`, 'i') }))

    const editor = await screen.findByRole('dialog', { name: `${sideTitle} Sunday Alarm` })
    expect(within(editor).queryByRole('button', { name: 'Sunday' })).not.toBeInTheDocument()
    expect(within(editor).getByText('Alarm Enabled')).toBeInTheDocument()
    fireEvent.click(within(editor).getByRole('switch', { name: 'Turn off Alarm Enabled' }))
    fireEvent.change(within(editor).getByLabelText('Alarm time'), { target: { value: '06:50' } })
    fireEvent.click(within(editor).getByRole('button', { name: 'Save Alarm' }))

    await waitFor(() => expect(mqttPublishCalls()).toHaveLength(1))
    expect(dialog).toHaveAccessibleName(`${sideTitle} Sunday Alarms`)
    const disabledAlarm = within(dialog).getByRole('button', { name: new RegExp(`${sideTitle} Sunday alarm at 6:50 AM, Disabled`, 'i') })
    expect(disabledAlarm).toHaveAttribute('data-active', 'false')
    const editPayload = JSON.parse(String((mqttPublishCalls()[0].serviceData as { payload: string }).payload))
    expect(editPayload[side].saturday.alarms).toEqual([
      expect.objectContaining({ enabled: false, time: '06:50' }),
      expect.objectContaining({ enabled: true, time: '07:15' }),
    ])

    fireEvent.click(disabledAlarm)
    const firstDeleteButton = within(dialog).getByRole('button', { name: 'Delete Alarm' })
    fireEvent.click(firstDeleteButton)
    expect(confirm).toHaveBeenLastCalledWith('Delete alarm set for 6:50 AM on Sunday?')
    expect(mqttPublishCalls()).toHaveLength(1)
    expect(dialog).toHaveAccessibleName(`${sideTitle} Sunday Alarm`)
    fireEvent.click(firstDeleteButton)
    await waitFor(() => expect(mqttPublishCalls()).toHaveLength(2))
    expect(dialog).toHaveAccessibleName(`${sideTitle} Sunday Alarm`)
    expect(within(dialog).getByRole('button', { name: new RegExp(`${sideTitle} Sunday alarm at 7:15 AM, Enabled`, 'i') })).toBeInTheDocument()
    const firstDeletePayload = JSON.parse(String((mqttPublishCalls()[1].serviceData as { payload: string }).payload))
    expect(firstDeletePayload[side].saturday.alarms).toEqual([expect.objectContaining({ enabled: true, time: '07:15' })])

    fireEvent.click(within(dialog).getByRole('button', { name: new RegExp(`${sideTitle} Sunday alarm at 7:15 AM, Enabled`, 'i') }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete Alarm' }))
    await waitFor(() => expect(mqttPublishCalls()).toHaveLength(3))
    expect(dialog).toHaveAccessibleName(sideTitle)
    expect(within(dialog).queryByRole('button', { name: new RegExp(`${sideTitle} Sunday Alarm`, 'i') })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Add Alarm' })).toHaveFocus()
    const finalPayload = JSON.parse(String((mqttPublishCalls()[2].serviceData as { payload: string }).payload))
    expect(finalPayload[side].saturday.alarms).toEqual([])
    expect(confirm).toHaveBeenNthCalledWith(2, 'Delete alarm set for 6:50 AM on Sunday?')
    expect(confirm).toHaveBeenNthCalledWith(3, 'Delete alarm set for 7:15 AM on Sunday?')
    confirm.mockRestore()
  })

  it('confirms deletion against the saved alarm while preserving a cancelled unsaved draft', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    setFreeSleepWakeDayAlarms('right', 'sunday', [testFreeSleepAlarm('06:30'), testFreeSleepAlarm('07:15')])
    render(<DashboardViewPage activePath='master-bedroom' onNavigate={() => undefined} path='master-bedroom' />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Side Off/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Steph\u0027s Bed' })
    await clickModalTab(within(dialog), 'Alarms')
    fireEvent.click(within(dialog).getByRole('button', { name: /Steph.s Bed Sunday Alarms 2 Enabled/i }))
    fireEvent.click(within(dialog).getByRole('button', { name: /Steph.s Bed Sunday alarm at 6:30 AM, Enabled/i }))

    fireEvent.change(within(dialog).getByLabelText('Alarm time'), { target: { value: '06:40' } })
    const deleteButton = within(dialog).getByRole('button', { name: 'Delete Alarm' })
    fireEvent.click(deleteButton)

    expect(confirm).toHaveBeenCalledWith('Delete alarm set for 6:30 AM on Sunday?')
    expect(within(dialog).getByLabelText('Alarm time')).toHaveValue('06:40')
    expect(mockCallServiceCalls).toEqual([])

    fireEvent.click(deleteButton)
    await waitFor(() => expect(mqttPublishCalls()).toHaveLength(1))
    expect(confirm).toHaveBeenLastCalledWith('Delete alarm set for 6:30 AM on Sunday?')
    expect(mockCallServiceCalls.find(call => call.serviceData?.operation === 'link_alarm')).toMatchObject({
      domain: 'wake_light',
      service: 'command',
      serviceData: {
        enabled: false,
        link_keys: ['sleepypod:right#sunday#06:30'],
        operation: 'link_alarm',
      },
    })
    expect(JSON.stringify(mockCallServiceCalls)).not.toContain('sleepypod:left#sunday#06:30')
    const payload = JSON.parse(String((mqttPublishCalls()[0].serviceData as { payload: string }).payload))
    expect(payload.right.saturday.alarms).toEqual([expect.objectContaining({ enabled: true, time: '07:15' })])
    confirm.mockRestore()
  })

  it('drops a direct toggle when the alarm schedule changes before its queued sync', async () => {
    setFreeSleepWakeDayAlarms('right', 'sunday', [testFreeSleepAlarm('06:30'), testFreeSleepAlarm('07:15')])
    const view = render(<DashboardViewPage activePath='master-bedroom' onNavigate={() => undefined} path='master-bedroom' />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Side Off/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Steph\u0027s Bed' })
    await clickModalTab(within(dialog), 'Alarms')
    fireEvent.click(within(dialog).getByRole('button', { name: /Steph.s Bed Sunday Alarms 2 Enabled/i }))
    fireEvent.click(within(dialog).getByRole('switch', { name: 'Turn off Steph\u0027s Bed Sunday alarm at 6:30 AM' }))

    setFreeSleepWakeDayAlarms('right', 'sunday', [testFreeSleepAlarm('06:30'), testFreeSleepAlarm('07:20')])
    act(() => {
      mockEntities['sensor.nightcanvasrestful_schedules'] = entity(
        'sensor.nightcanvasrestful_schedules',
        'ready',
        mockEntities['sensor.nightcanvasrestful_schedules'].attributes,
      )
      view.rerender(<DashboardViewPage activePath='master-bedroom' onNavigate={() => undefined} path='master-bedroom' />)
    })

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 500))
    })
    expect(mockCallServiceCalls).toEqual([])
    expect(dialog).toHaveAccessibleName('Steph\u0027s Bed Sunday Alarms')
    expect(within(dialog).getByRole('switch', { name: 'Turn off Steph\u0027s Bed Sunday alarm at 6:30 AM' })).toHaveAttribute('aria-checked', 'true')
    expect(within(dialog).getByRole('button', { name: /Steph.s Bed Sunday alarm at 7:20 AM, Enabled/i })).toBeInTheDocument()
  })

  it('preserves backend alarm array order when directly toggling a chronologically earlier alarm', async () => {
    const laterSourceAlarm = testFreeSleepAlarm('07:15', true, {
      alarmTemperature: 78,
      duration: 45,
      vibrationIntensity: 75,
      vibrationPattern: 'double',
    })
    const earlierSourceAlarm = testFreeSleepAlarm('06:30', true, {
      alarmTemperature: 84,
      duration: 60,
      vibrationIntensity: 90,
    })
    setFreeSleepWakeDayAlarms('right', 'sunday', [laterSourceAlarm, earlierSourceAlarm])
    render(<DashboardViewPage activePath='master-bedroom' onNavigate={() => undefined} path='master-bedroom' />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Side Off/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Steph\u0027s Bed' })
    await clickModalTab(within(dialog), 'Alarms')
    fireEvent.click(within(dialog).getByRole('button', { name: /Steph.s Bed Sunday Alarms 2 Enabled/i }))
    fireEvent.click(within(dialog).getByRole('switch', { name: 'Turn off Steph\u0027s Bed Sunday alarm at 6:30 AM' }))

    await waitFor(() => expect(mockCallServiceCalls).toHaveLength(1))
    const payload = JSON.parse(String((mockCallServiceCalls[0].serviceData as { payload: string }).payload))
    expect(payload.right.saturday.alarms).toEqual([
      laterSourceAlarm,
      { ...earlierSourceAlarm, enabled: false },
    ])
  })

  it('publishes a newer toggle after Home Assistant confirms the prior local toggle', async () => {
    setFreeSleepWakeDayAlarms('right', 'sunday', [testFreeSleepAlarm('06:30')])
    const view = render(<DashboardViewPage activePath='master-bedroom' onNavigate={() => undefined} path='master-bedroom' />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Side Off/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Steph\u0027s Bed' })
    await clickModalTab(within(dialog), 'Alarms')
    fireEvent.click(within(dialog).getByRole('switch', { name: 'Turn off Steph\u0027s Bed Sunday alarm at 6:30 AM' }))

    await waitFor(() => expect(mockCallServiceCalls).toHaveLength(1))
    act(() => {
      mockEntities['sensor.nightcanvasrestful_schedules'] = entity(
        'sensor.nightcanvasrestful_schedules',
        'ready',
        mockEntities['sensor.nightcanvasrestful_schedules'].attributes,
      )
      view.rerender(<DashboardViewPage activePath='master-bedroom' onNavigate={() => undefined} path='master-bedroom' />)
    })
    fireEvent.click(within(dialog).getByRole('switch', { name: 'Turn on Steph\u0027s Bed Sunday alarm at 6:30 AM' }))

    await waitFor(() => expect(mockCallServiceCalls).toHaveLength(2))
    const payload = JSON.parse(String((mockCallServiceCalls[1].serviceData as { payload: string }).payload))
    expect(payload.right.saturday.alarms).toEqual([
      { alarmTemperature: 82, duration: 300, enabled: true, time: '06:30', vibrationIntensity: 100, vibrationPattern: 'rise' },
    ])
  })

  it('shows an external schedule update that arrives after a local toggle publish', async () => {
    setFreeSleepWakeDayAlarms('right', 'sunday', [testFreeSleepAlarm('06:30'), testFreeSleepAlarm('07:15')])
    const view = render(<DashboardViewPage activePath='master-bedroom' onNavigate={() => undefined} path='master-bedroom' />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Side Off/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Steph\u0027s Bed' })
    await clickModalTab(within(dialog), 'Alarms')
    fireEvent.click(within(dialog).getByRole('button', { name: /Steph.s Bed Sunday Alarms 2 Enabled/i }))
    fireEvent.click(within(dialog).getByRole('switch', { name: 'Turn off Steph\u0027s Bed Sunday alarm at 6:30 AM' }))

    await waitFor(() => expect(mockCallServiceCalls).toHaveLength(1))
    setFreeSleepWakeDayAlarms('right', 'sunday', [testFreeSleepAlarm('06:30', false), testFreeSleepAlarm('07:20')])
    act(() => {
      mockEntities['sensor.nightcanvasrestful_schedules'] = entity(
        'sensor.nightcanvasrestful_schedules',
        'ready',
        mockEntities['sensor.nightcanvasrestful_schedules'].attributes,
      )
      view.rerender(<DashboardViewPage activePath='master-bedroom' onNavigate={() => undefined} path='master-bedroom' />)
    })

    expect(within(dialog).getByRole('button', { name: /Steph.s Bed Sunday alarm at 6:30 AM, Disabled/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /Steph.s Bed Sunday alarm at 7:20 AM, Enabled/i })).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /Steph.s Bed Sunday alarm at 7:15 AM/i })).not.toBeInTheDocument()
  })

  it('disables an inline toggle and drops its queued sync when SleepyPod schedule data becomes unavailable', async () => {
    setupStephenSleepypodLevelControl('outside')
    const schedules = mockFreeSleepScheduleAttributes()
    const leftSchedule = schedules.left as Record<string, Record<string, unknown>>
    const alarms = [testFreeSleepAlarm('06:30'), testFreeSleepAlarm('07:15')]
    leftSchedule.saturday = { ...leftSchedule.saturday, alarm: alarms[0], alarms }
    mockEntities['sensor.master_bedroom_sleepypod_eight_pod_schedules'] = entity(
      'sensor.master_bedroom_sleepypod_eight_pod_schedules',
      'ready',
      schedules,
    )
    const view = render(<DashboardViewPage activePath='master-bedroom' onNavigate={() => undefined} path='master-bedroom' />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -2/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Stephen\u0027s Bed' })
    await clickModalTab(within(dialog), 'Alarms')
    fireEvent.click(within(dialog).getByRole('button', { name: /Stephen.s Bed Saturday Alarms 2 Enabled/i }))
    fireEvent.click(within(dialog).getByRole('switch', { name: 'Turn off Stephen\u0027s Bed Saturday alarm at 6:30 AM' }))

    act(() => {
      mockEntities['sensor.master_bedroom_sleepypod_eight_pod_schedules'] = entity(
        'sensor.master_bedroom_sleepypod_eight_pod_schedules',
        'unavailable',
      )
      view.rerender(<DashboardViewPage activePath='master-bedroom' onNavigate={() => undefined} path='master-bedroom' />)
    })

    expect(dialog).toHaveAccessibleName('Stephen\u0027s Bed Saturday Alarms')
    expect(within(dialog).queryByRole('switch')).not.toBeInTheDocument()

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 500))
    })
    expect(mockCallServiceCalls).toEqual([])
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Home Assistant alarm schedule data is unavailable.')
  })

  it('disables the SleepyPod alarm flow when schedule data is unavailable', async () => {
    mockEntities['climate.sleepypod_eight_pod_right_side'] = entity('climate.sleepypod_eight_pod_right_side', 'off', {
      current_temperature: 77,
      hvac_modes: ['off', 'heat'],
      max_temp: 110,
      min_temp: 55,
      target_temp_step: 1,
      temperature: null,
    })
    mockEntities['number.master_bedroom_sleepypod_eight_pod_right_target_level'] = entity('number.master_bedroom_sleepypod_eight_pod_right_target_level', '0', {
      max: 10,
      min: -10,
      step: 1,
    })
    mockEntities['sensor.master_bedroom_sleepypod_eight_pod_schedules'] = entity('sensor.master_bedroom_sleepypod_eight_pod_schedules', 'unavailable')
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Side Off/i }))
    const dialog = await screen.findByRole('dialog', { name: "Steph's Bed" })
    await clickModalTab(within(dialog), 'Alarms')

    expect(within(dialog).getByRole('button', { name: 'Add Alarm' })).toBeDisabled()
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Home Assistant alarm schedule data is unavailable.')
    expect(within(dialog).queryByRole('button', { name: /Steph's Bed Sunday Alarm/i })).not.toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([])
  })

  it('does not treat another SleepyPod side schedule as editable data', async () => {
    mockEntities['climate.sleepypod_eight_pod_right_side'] = entity('climate.sleepypod_eight_pod_right_side', 'off', {
      current_temperature: 77,
      hvac_modes: ['off', 'heat'],
      max_temp: 110,
      min_temp: 55,
      target_temp_step: 1,
      temperature: null,
    })
    mockEntities['number.master_bedroom_sleepypod_eight_pod_right_target_level'] = entity('number.master_bedroom_sleepypod_eight_pod_right_target_level', '0', {
      max: 10,
      min: -10,
      step: 1,
    })
    const schedules = mockFreeSleepScheduleAttributes()
    mockEntities['sensor.master_bedroom_sleepypod_eight_pod_schedules'] = entity('sensor.master_bedroom_sleepypod_eight_pod_schedules', 'ready', {
      left: schedules.left,
    })
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Side Off/i }))
    const dialog = await screen.findByRole('dialog', { name: "Steph's Bed" })
    await clickModalTab(within(dialog), 'Alarms')

    expect(within(dialog).getByRole('button', { name: 'Add Alarm' })).toBeDisabled()
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Home Assistant alarm schedule data is unavailable.')
    expect(mockCallServiceCalls).toEqual([])
  })

  it('requires a complete legacy alarm helper set before enabling edits', async () => {
    mockEntities['sensor.nightcanvasrestful_schedules'] = entity('sensor.nightcanvasrestful_schedules', 'unavailable')
    mockEntities['input_datetime.steph_monday_alarm_time'].state = 'unavailable'
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Side Off/i }))
    const dialog = await screen.findByRole('dialog', { name: "Steph's Bed" })
    await clickModalTab(within(dialog), 'Alarms')

    expect(within(dialog).getByRole('button', { name: 'Add Alarm' })).toBeDisabled()
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Home Assistant alarm schedule data is unavailable.')
    expect(mockCallServiceCalls).toEqual([])
  })

  it('directly toggles a guarded legacy alarm without changing its configured day or time', async () => {
    mockEntities['sensor.nightcanvasrestful_schedules'] = entity('sensor.nightcanvasrestful_schedules', 'unavailable')
    mockEntities['input_boolean.steph_monday_alarm_configured'].state = 'on'
    mockEntities['input_boolean.steph_monday_alarm_enabled'].state = 'on'
    mockEntities['input_datetime.steph_monday_alarm_time'].state = '06:30:00'
    render(<DashboardViewPage activePath='master-bedroom' onNavigate={() => undefined} path='master-bedroom' />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Side Off/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Steph\u0027s Bed' })
    await clickModalTab(within(dialog), 'Alarms')
    fireEvent.click(within(dialog).getByRole('switch', { name: 'Turn off Steph\u0027s Bed Monday alarm at 6:30 AM' }))

    expect(dialog).toHaveAccessibleName('Steph\u0027s Bed')
    expect(within(dialog).getByRole('button', { name: 'Steph\u0027s Bed Monday Alarm Disabled' })).toBeInTheDocument()
    await waitFor(() => expect(mockCallServiceCalls).toEqual(expect.arrayContaining([
      { domain: 'input_boolean', service: 'turn_on', target: 'input_boolean.steph_monday_alarm_configured' },
      { domain: 'input_boolean', service: 'turn_off', target: 'input_boolean.steph_monday_alarm_enabled' },
      { domain: 'input_datetime', service: 'set_datetime', target: 'input_datetime.steph_monday_alarm_time', serviceData: { time: '06:30:00' } },
    ])))
    expect(mockCallServiceCalls.some((call) => call.domain === 'mqtt')).toBe(false)
  })

  it('clears legacy configured and enabled helpers when the last alarm is deleted', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockEntities['sensor.nightcanvasrestful_schedules'] = entity('sensor.nightcanvasrestful_schedules', 'unavailable')
    mockEntities['input_boolean.steph_sunday_alarm_configured'].state = 'on'
    mockEntities['input_boolean.steph_sunday_alarm_enabled'].state = 'on'
    mockEntities['input_datetime.steph_sunday_alarm_time'].state = '06:30:00'
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Side Off/i }))
    const dialog = await screen.findByRole('dialog', { name: "Steph's Bed" })
    await clickModalTab(within(dialog), 'Alarms')
    fireEvent.click(within(dialog).getByRole('button', { name: /Steph's Bed Sunday Alarm Enabled/i }))
    fireEvent.click(within(dialog).getByRole('button', { name: /Steph's Bed Sunday alarm at 6:30 AM, Enabled/i }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete Alarm' }))

    await waitFor(() => expect(mockCallServiceCalls).toEqual(expect.arrayContaining([
      { domain: 'input_boolean', service: 'turn_off', target: 'input_boolean.steph_sunday_alarm_configured' },
      { domain: 'input_boolean', service: 'turn_off', target: 'input_boolean.steph_sunday_alarm_enabled' },
    ])))
    expect(confirm).toHaveBeenCalledWith('Delete alarm set for 6:30 AM on Sunday?')
    expect(dialog).toHaveAccessibleName("Steph's Bed")
    expect(within(dialog).queryByRole('button', { name: /Steph's Bed Sunday Alarm/i })).not.toBeInTheDocument()
    confirm.mockRestore()
  })

  it('prevents unsupported same-day additions while using legacy alarm helpers', async () => {
    mockEntities['sensor.nightcanvasrestful_schedules'] = entity('sensor.nightcanvasrestful_schedules', 'unavailable')
    mockEntities['input_boolean.steph_monday_alarm_configured'].state = 'on'
    mockEntities['input_boolean.steph_monday_alarm_enabled'].state = 'on'
    mockEntities['input_datetime.steph_monday_alarm_time'].state = '06:30:00'
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Side Off/i }))
    const dialog = await screen.findByRole('dialog', { name: "Steph's Bed" })
    await clickModalTab(within(dialog), 'Alarms')
    fireEvent.click(within(dialog).getByRole('button', { name: /Steph's Bed Monday Alarm Enabled/i }))

    expect(dialog).toHaveAccessibleName("Steph's Bed Monday Alarm")
    expect(within(dialog).queryByRole('button', { name: 'Add Alarm' })).not.toBeInTheDocument()
    expect(within(dialog).getByText('Fallback alarm helpers support one alarm per day.')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to alarms' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Alarm' }))

    const editor = await screen.findByRole('dialog', { name: "Add Steph's Bed Alarm" })
    expect(within(editor).getByRole('button', { name: 'Monday' })).toBeDisabled()
    expect(within(editor).getByRole('button', { name: 'Monday' })).toHaveAttribute('aria-pressed', 'false')
    for (const day of ['Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
      expect(within(editor).getByRole('button', { name: day })).toHaveAttribute('aria-pressed', 'true')
    }
  })

  it('fails closed when a legacy alarm changes externally during editing', async () => {
    mockEntities['sensor.nightcanvasrestful_schedules'] = entity('sensor.nightcanvasrestful_schedules', 'unavailable')
    mockEntities['input_boolean.steph_monday_alarm_configured'].state = 'on'
    mockEntities['input_boolean.steph_monday_alarm_enabled'].state = 'on'
    mockEntities['input_datetime.steph_monday_alarm_time'].state = '06:30:00'
    const view = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Side Off/i }))
    const dialog = await screen.findByRole('dialog', { name: "Steph's Bed" })
    await clickModalTab(within(dialog), 'Alarms')
    fireEvent.click(within(dialog).getByRole('button', { name: /Steph's Bed Monday Alarm Enabled/i }))
    fireEvent.click(within(dialog).getByRole('button', { name: /Steph's Bed Monday alarm at 6:30 AM, Enabled/i }))
    const editor = await screen.findByRole('dialog', { name: "Steph's Bed Monday Alarm" })

    act(() => {
      mockEntities['input_datetime.steph_monday_alarm_time'] = entity('input_datetime.steph_monday_alarm_time', '07:00:00')
      view.rerender(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    })

    expect(within(editor).getByRole('alert')).toHaveTextContent('This alarm changed in Home Assistant. Go back and reopen it.')
    expect(within(editor).getByRole('button', { name: 'Save Alarm' })).toBeDisabled()
    expect(within(editor).getByRole('button', { name: 'Delete Alarm' })).toBeDisabled()
    expect(mockCallServiceCalls).toEqual([])
  })

  it('keeps the selected alarm day page available as read-only when schedule data becomes unavailable', async () => {
    mockEntities['climate.sleepypod_eight_pod_right_side'] = entity('climate.sleepypod_eight_pod_right_side', 'off', {
      current_temperature: 77,
      hvac_modes: ['off', 'heat'],
      max_temp: 110,
      min_temp: 55,
      target_temp_step: 1,
      temperature: null,
    })
    mockEntities['number.master_bedroom_sleepypod_eight_pod_right_target_level'] = entity('number.master_bedroom_sleepypod_eight_pod_right_target_level', '0', {
      max: 10,
      min: -10,
      step: 1,
    })
    mockEntities['sensor.master_bedroom_sleepypod_eight_pod_schedules'] = entity(
      'sensor.master_bedroom_sleepypod_eight_pod_schedules',
      'ready',
      mockFreeSleepScheduleAttributes(),
    )
    const view = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Side Off/i }))
    const dialog = await screen.findByRole('dialog', { name: "Steph's Bed" })
    await clickModalTab(within(dialog), 'Alarms')
    fireEvent.click(within(dialog).getByRole('button', { name: /Steph's Bed Saturday Alarms 2 Enabled/i }))
    expect(dialog).toHaveAccessibleName("Steph's Bed Saturday Alarms")

    act(() => {
      mockEntities['sensor.master_bedroom_sleepypod_eight_pod_schedules'] = entity('sensor.master_bedroom_sleepypod_eight_pod_schedules', 'unavailable')
      view.rerender(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    })

    expect(dialog).toHaveAccessibleName("Steph's Bed Saturday Alarms")
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Home Assistant alarm schedule data is unavailable.')
    expect(within(dialog).getByRole('button', { name: 'Add Alarm' })).toBeDisabled()
    expect(within(dialog).queryByRole('button', { name: /Saturday alarm at/i })).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to alarms' }))
    expect(dialog).toHaveAccessibleName("Steph's Bed")
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Home Assistant alarm schedule data is unavailable.')
    expect(mockCallServiceCalls).toEqual([])
  })

  it('keeps an alarm draft open when SleepyPod schedule data becomes unavailable', async () => {
    mockEntities['climate.sleepypod_eight_pod_right_side'] = entity('climate.sleepypod_eight_pod_right_side', 'off', {
      current_temperature: 77,
      hvac_modes: ['off', 'heat'],
      max_temp: 110,
      min_temp: 55,
      target_temp_step: 1,
      temperature: null,
    })
    mockEntities['number.master_bedroom_sleepypod_eight_pod_right_target_level'] = entity('number.master_bedroom_sleepypod_eight_pod_right_target_level', '0', {
      max: 10,
      min: -10,
      step: 1,
    })
    mockEntities['sensor.master_bedroom_sleepypod_eight_pod_schedules'] = entity(
      'sensor.master_bedroom_sleepypod_eight_pod_schedules',
      'ready',
      mockFreeSleepScheduleAttributes(),
    )
    const view = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Side Off/i }))
    const dialog = await screen.findByRole('dialog', { name: "Steph's Bed" })
    await clickModalTab(within(dialog), 'Alarms')
    fireEvent.click(within(dialog).getByRole('button', { name: /Steph's Bed Saturday Alarms 2 Enabled/i }))
    fireEvent.click(within(dialog).getByRole('button', { name: /Steph's Bed Saturday alarm at 6:30 AM, Enabled/i }))
    const editor = await screen.findByRole('dialog', { name: "Steph's Bed Saturday Alarm" })

    act(() => {
      mockEntities['sensor.master_bedroom_sleepypod_eight_pod_schedules'] = entity('sensor.master_bedroom_sleepypod_eight_pod_schedules', 'unavailable')
      view.rerender(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    })

    expect(within(editor).getByRole('alert')).toHaveTextContent('Home Assistant alarm schedule data is unavailable.')
    expect(within(editor).getByRole('switch', { name: 'Turn off Alarm Enabled' })).toHaveAttribute('data-disabled', 'true')
    expect(within(editor).getByRole('button', { name: 'Save Alarm' })).toBeDisabled()
    expect(within(editor).getByRole('button', { name: 'Delete Alarm' })).toBeDisabled()
    expect(editor).toHaveAccessibleName("Steph's Bed Saturday Alarm")
    expect(mockCallServiceCalls).toEqual([])
  })

  it('fails closed when an edited alarm changes externally', async () => {
    mockEntities['climate.sleepypod_eight_pod_right_side'] = entity('climate.sleepypod_eight_pod_right_side', 'off', {
      current_temperature: 77,
      hvac_modes: ['off', 'heat'],
      max_temp: 110,
      min_temp: 55,
      target_temp_step: 1,
      temperature: null,
    })
    mockEntities['number.master_bedroom_sleepypod_eight_pod_right_target_level'] = entity('number.master_bedroom_sleepypod_eight_pod_right_target_level', '0', {
      max: 10,
      min: -10,
      step: 1,
    })
    const schedules = mockFreeSleepScheduleAttributes()
    mockEntities['sensor.master_bedroom_sleepypod_eight_pod_schedules'] = entity(
      'sensor.master_bedroom_sleepypod_eight_pod_schedules',
      'ready',
      schedules,
    )
    const view = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Side Off/i }))
    const dialog = await screen.findByRole('dialog', { name: "Steph's Bed" })
    await clickModalTab(within(dialog), 'Alarms')
    fireEvent.click(within(dialog).getByRole('button', { name: /Steph's Bed Saturday Alarms 2 Enabled/i }))
    fireEvent.click(within(dialog).getByRole('button', { name: /Steph's Bed Saturday alarm at 6:30 AM, Enabled/i }))
    const editor = await screen.findByRole('dialog', { name: "Steph's Bed Saturday Alarm" })

    const updatedSchedules = mockFreeSleepScheduleAttributes()
    const rightSchedule = updatedSchedules.right as Record<string, Record<string, unknown>>
    const saturday = rightSchedule.saturday
    const alarms = saturday.alarms as Record<string, unknown>[]
    rightSchedule.saturday = { ...saturday, alarm: alarms[1], alarms: [alarms[1]] }
    act(() => {
      mockEntities['sensor.master_bedroom_sleepypod_eight_pod_schedules'] = entity(
        'sensor.master_bedroom_sleepypod_eight_pod_schedules',
        'ready',
        updatedSchedules,
      )
      view.rerender(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    })

    expect(within(editor).getByRole('alert')).toHaveTextContent('This alarm changed in Home Assistant. Go back and reopen it.')
    expect(within(editor).getByRole('switch', { name: 'Turn off Alarm Enabled' })).toHaveAttribute('data-disabled', 'true')
    expect(within(editor).getByRole('button', { name: 'Save Alarm' })).toBeDisabled()
    expect(within(editor).getByRole('button', { name: 'Delete Alarm' })).toBeDisabled()
    expect(mockCallServiceCalls).toEqual([])
  })


  it('turns on an off Free Sleep side from the thermostat tap target', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Side Off/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText("Steph's Bed: Off")).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: "Turn on Steph's Bed" }))

    expect(confirm).not.toHaveBeenCalled()
    expect(within(dialog).getByRole('button', { name: "Turn off Steph's Bed" })).toBeInTheDocument()
    expect(within(dialog).getByText("Steph's Bed: Idle • 0")).toBeInTheDocument()
    expect(within(dialog).getByRole('region', { name: /Steph's Bed thermostat Idle 0/i })).toBeInTheDocument()
    expect(within(dialog).queryByText('Tap the thermostat to turn on the Pod.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Steph's Side Idle • 0/i, hidden: true })).toHaveAttribute('data-muted', 'false')
    expect(mockCallServiceCalls).toEqual([
      { domain: 'switch', service: 'turn_on', target: 'switch.nightcanvasrestful_right_power' },
    ])

    confirm.mockRestore()
  })

  it('keeps the Free Sleep hero dial stable during brief MQTT availability blips', async () => {
    const { rerender } = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -1/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText("Stephen's Bed: Cooling • -1")).toBeInTheDocument()

    mockEntities['switch.nightcanvasrestful_left_power'].state = 'unavailable'
    mockEntities['number.nightcanvasrestful_left_target_temperature'].state = 'unavailable'
    mockEntities['sensor.nightcanvasrestful_left_current_temperature'].state = 'unavailable'

    act(() => {
      rerender(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    })

    expect(within(dialog).getByText("Stephen's Bed: Cooling • -1")).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: "Turn off Stephen's Bed" })).toBeInTheDocument()
  })

  it('clears active and queued Free Sleep target edits when HA turns the bed side off', async () => {
    const view = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -1/i }))
    const dialog = await screen.findByRole('dialog')
    const dial = within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -1/i })
    let slider = within(dialog).getByRole('slider', { name: "Stephen's Bed target level" })
    const dialRect = {
      bottom: 500,
      height: 300,
      left: 100,
      right: 400,
      top: 200,
      width: 300,
      x: 100,
      y: 200,
      toJSON: () => ({}),
    } as DOMRect
    const startPoint = valueToThermostatPoint(-1, -10, 10)
    const targetPoint = valueToThermostatPoint(-2.2, -10, 10)
    const clientPoint = (point: { x: number; y: number }) => ({
      clientX: dialRect.left + (point.x / 100) * dialRect.width,
      clientY: dialRect.top + (point.y / 100) * dialRect.height,
    })
    const rectSpy = vi.spyOn(dial, 'getBoundingClientRect').mockReturnValue(dialRect)
    Object.defineProperty(slider, 'setPointerCapture', { configurable: true, value: () => undefined })
    try {
      fireEvent.pointerDown(slider, { ...clientPoint(startPoint), pointerId: 31 })
      fireEvent.pointerMove(slider, { ...clientPoint(targetPoint), pointerId: 31 })
      expect(within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -2/i })).toBeInTheDocument()

      act(() => {
        mockEntities['switch.nightcanvasrestful_left_power'].state = 'off'
        view.rerender(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
      })
      expect(within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Off/i })).toHaveAttribute('aria-disabled', 'true')

      act(() => {
        mockEntities['switch.nightcanvasrestful_left_power'].state = 'on'
        view.rerender(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
      })
      expect(within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -1/i })).toBeInTheDocument()
      slider = within(dialog).getByRole('slider', { name: "Stephen's Bed target level" })

      vi.useFakeTimers()
      fireEvent.keyDown(slider, { key: 'ArrowLeft' })
      act(() => {
        mockEntities['switch.nightcanvasrestful_left_power'].state = 'off'
        view.rerender(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
      })
      act(() => vi.advanceTimersByTime(300))
      expect(mockCallServiceCalls).toEqual([])
      act(() => {
        mockEntities['switch.nightcanvasrestful_left_power'].state = 'on'
        view.rerender(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
      })
      expect(within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -1/i })).toBeInTheDocument()
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
      rectSpy.mockRestore()
    }
  })

  it('drags the Free Sleep hero dial as a target level control', async () => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -1/i }))
    const dialog = await screen.findByRole('dialog')
    const dial = within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -1/i })
    const slider = within(dialog).getByRole('slider', { name: "Stephen's Bed target level" })
    const dialRect = {
      bottom: 500,
      height: 300,
      left: 100,
      right: 400,
      top: 200,
      width: 300,
      x: 100,
      y: 200,
      toJSON: () => ({}),
    } as DOMRect
    const startPoint = valueToThermostatPoint(-1, -10, 10)
    const targetPoint = valueToThermostatPoint(-2.2, -10, 10)
    const clientPoint = (point: { x: number; y: number }) => ({
      clientX: dialRect.left + (point.x / 100) * dialRect.width,
      clientY: dialRect.top + (point.y / 100) * dialRect.height,
    })
    const rectSpy = vi.spyOn(dial, 'getBoundingClientRect').mockReturnValue(dialRect)
    Object.defineProperties(slider, {
      hasPointerCapture: { configurable: true, value: () => false },
      setPointerCapture: { configurable: true, value: () => undefined },
    })
    try {
      fireEvent.pointerDown(slider, { ...clientPoint(startPoint), pointerId: 17 })
      fireEvent.pointerMove(slider, { ...clientPoint(targetPoint), pointerId: 17 })
      expect(within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -2/i })).toBeInTheDocument()
      expect(within(dialog).getByText("Stephen's Bed: Cooling • -1")).toBeInTheDocument()
      fireEvent.pointerCancel(slider, { ...clientPoint(targetPoint), pointerId: 17 })
      expect(within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -1/i })).toBeInTheDocument()
      expect(mockCallServiceCalls).toEqual([])

      fireEvent.pointerDown(slider, { ...clientPoint(startPoint), pointerId: 18 })
      fireEvent.pointerMove(slider, { ...clientPoint(targetPoint), pointerId: 18 })
      fireEvent.pointerUp(slider, { ...clientPoint(targetPoint), pointerId: 18 })

      expect(within(dialog).getByText("Stephen's Bed: Cooling • -2")).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Your Side Cooling • -2/i, hidden: true })).toHaveAttribute('data-muted', 'false')

      await waitFor(() => expect(mockCallServiceCalls).toEqual([
        { domain: 'number', service: 'set_value', target: 'number.nightcanvasrestful_left_target_temperature', serviceData: { value: -2 } },
      ]))
    } finally {
      rectSpy.mockRestore()
    }
  })

  it('updates Free Sleep schedule stage temperatures through preserved helpers', async () => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -1/i }))
    const dialog = await screen.findByRole('dialog')

    fireEvent.click(within(dialog).getByRole('button', { name: "Increase Stephen's Bed Asleep level" }))

    expect(within(dialog).getAllByText('0').length).toBeGreaterThanOrEqual(3)
    expect(within(dialog).queryByText('0°')).not.toBeInTheDocument()
    await waitFor(() => expect(mockCallServiceCalls).toEqual([
      { domain: 'input_number', service: 'set_value', target: 'input_number.eight_sleep_stephen_asleep_level', serviceData: { value: 0 } },
    ]))
  })

  it('coalesces rapid Free Sleep schedule stage temperature taps to the final value', async () => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -1/i }))
    const dialog = await screen.findByRole('dialog')
    const increaseAsleep = within(dialog).getByRole('button', { name: "Increase Stephen's Bed Asleep level" })

    act(() => {
      fireEvent.click(increaseAsleep)
      fireEvent.click(increaseAsleep)
      fireEvent.click(increaseAsleep)
    })

    expect(within(dialog).getByText('+2')).toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([])
    await waitFor(() => expect(mockCallServiceCalls).toEqual([
      { domain: 'input_number', service: 'set_value', target: 'input_number.eight_sleep_stephen_asleep_level', serviceData: { value: 2 } },
    ]))
  })

  it('keeps Free Sleep schedule stage controls settable while the bed side is off', async () => {
    mockEntities['number.nightcanvasrestful_right_asleep_temperature'].state = 'unknown'
    mockEntities['number.nightcanvasrestful_right_dawn_temperature'].state = 'unknown'
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Side Off/i }))
    const dialog = await screen.findByRole('dialog')
    const asleepIncrease = within(dialog).getByRole('button', { name: "Increase Steph's Bed Asleep level" })

    expect(within(dialog).getByRole('button', { name: "Turn on Steph's Bed" })).toBeInTheDocument()
    expect(asleepIncrease).toBeEnabled()

    fireEvent.click(asleepIncrease)

    expect(within(dialog).getByText('+1')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: "Turn on Steph's Bed" })).toBeInTheDocument()
    await waitFor(() => expect(mockCallServiceCalls).toEqual([
      { domain: 'input_number', service: 'set_value', target: 'input_number.eight_sleep_steph_asleep_level', serviceData: { value: 1 } },
    ]))
  })

  it('confirms before turning off an on Free Sleep side from the thermostat tap target', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -1/i }))
    const dialog = await screen.findByRole('dialog')
    const toggle = within(dialog).getByRole('button', { name: "Turn off Stephen's Bed" })

    fireEvent.click(toggle)
    expect(confirm).toHaveBeenCalledWith("Turn off Stephen's Bed?")
    expect(mockCallServiceCalls).toEqual([])

    fireEvent.click(toggle)
    expect(mockCallServiceCalls).toEqual([
      { domain: 'switch', service: 'turn_off', target: 'switch.nightcanvasrestful_left_power' },
    ])
    expect(within(dialog).getByRole('button', { name: "Turn on Stephen's Bed" })).toBeInTheDocument()
    expect(within(dialog).getByText("Stephen's Bed: Off")).toBeInTheDocument()
    const offHero = within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Off/i })
    expect(within(offHero).getByText('OFF').parentElement).toHaveAttribute('data-readout-state', 'off')
    expect(within(offHero).queryByText('Idle')).not.toBeInTheDocument()
    expect(within(offHero).queryByText('-1')).not.toBeInTheDocument()
    expect(within(dialog).getByText('Use the power control to turn on the Pod.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Your Side Off/i, hidden: true })).toHaveAttribute('data-muted', 'true')

    confirm.mockRestore()
  })

  it('disables Free Sleep target changes when that bed side is off', async () => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Side Off/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText("Steph's Bed: Off")).toBeInTheDocument()
    const offHero = within(dialog).getByRole('region', { name: /Steph's Bed thermostat Off/i })
    expect(within(offHero).getByText('OFF').parentElement).toHaveAttribute('data-readout-state', 'off')
    expect(within(offHero).queryByText('Idle')).not.toBeInTheDocument()
    expect(within(offHero).queryByText('0')).not.toBeInTheDocument()
    expect(within(dialog).getByText('Use the power control to turn on the Pod.')).toBeInTheDocument()
    expect(within(dialog).queryByRole('slider', { name: "Steph's Bed target level" })).not.toBeInTheDocument()
    fireEvent.pointerDown(offHero, { button: 0, clientX: 150, clientY: 20, pointerId: 21, pointerType: 'mouse' })
    fireEvent.pointerUp(offHero, { button: 0, clientX: 150, clientY: 20, pointerId: 21, pointerType: 'mouse' })

    expect(mockCallServiceCalls).toEqual([])
  })

  it('keeps Free Sleep target edits visible while stale HASS values catch up', async () => {
    const view = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -1/i }))
    const dialog = await screen.findByRole('dialog')
    const slider = within(dialog).getByRole('slider', { name: "Stephen's Bed target level" })
    fireEvent.keyDown(slider, { key: 'ArrowLeft' })

    expect(within(dialog).getByText("Stephen's Bed: Cooling • -2")).toBeInTheDocument()

    mockEntities['number.nightcanvasrestful_left_target_temperature'].state = '-1'
    view.rerender(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    expect(within(screen.getByRole('dialog')).getByText("Stephen's Bed: Cooling • -2")).toBeInTheDocument()

    mockEntities['number.nightcanvasrestful_left_target_temperature'].state = '-2'
    view.rerender(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    mockEntities['number.nightcanvasrestful_left_target_temperature'].state = '-1'
    view.rerender(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    expect(within(screen.getByRole('dialog')).getByText("Stephen's Bed: Cooling • -1")).toBeInTheDocument()
  })

  it('flushes the final Free Sleep target when the bed modal unmounts before debounce', async () => {
    const view = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Your Side Cooling • -1/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.keyDown(within(dialog).getByRole('slider', { name: "Stephen's Bed target level" }), { key: 'ArrowLeft' })
    expect(mockCallServiceCalls).toEqual([])

    view.unmount()

    expect(mockCallServiceCalls).toEqual([
      { domain: 'number', service: 'set_value', target: 'number.nightcanvasrestful_left_target_temperature', serviceData: { value: -2 } },
    ])
  })

  it('ports the Living Room SHIELD remote modal and only runs explicit controls', async () => {
    mockEntities['media_player.living_room_shield_2'].state = 'playing'
    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    fireEvent.click(screen.getByRole('button', { name: /^Living Room Remote Off$/i }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('data-size', 'workspace')
    expect(dialog).toHaveAttribute('data-scroll-mode', 'panes')
    expect(dialog).toHaveAttribute('data-has-navigation', 'true')
    expect(screen.getByRole('heading', { name: 'Living Room SHIELD Remote' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Power' })).not.toBeInTheDocument()
    expect(screen.getByText('Power Off')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Power' }).closest('[data-scroll-region]')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Sonos Volume' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Navigation' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Controls' })).toBeInTheDocument()
    expect(within(dialog).getByRole('group', { name: 'Living Room SHIELD remote controls' })).toBeInTheDocument()
    expect(within(dialog).getByRole('group', { name: 'Living Room SHIELD Controls' })).toBeInTheDocument()
    expect(within(dialog).getByRole('tablist', { name: 'Living Room SHIELD modal sections' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Controls' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('heading', { name: 'Media' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Power' })).toHaveStyle({ color: 'rgb(255, 0, 0)' })
    expect(screen.getByRole('button', { name: 'Select' })).toHaveAttribute('data-icon', ' ')
    expect(screen.getByRole('button', { name: 'Select' }).querySelector('svg')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back' }).querySelector('path')).toHaveAttribute('transform', 'rotate(90 12 12)')
    expect(mockCallServiceCalls).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: 'Up' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    fireEvent.click(screen.getByRole('button', { name: 'Volume Down' }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'remote', service: 'send_command', target: 'remote.living_room_shield', serviceData: { command: 'DPAD_UP' } },
      { domain: 'remote', service: 'send_command', target: 'remote.living_room_shield', serviceData: { command: 'MEDIA_PAUSE' } },
      { domain: 'media_player', service: 'volume_down', target: 'media_player.sonos', serviceData: undefined },
    ])
  })

  it('hides remote volume and disables playback controls when their entities are off', async () => {
    mockEntities['media_player.living_room_shield_2'].state = 'off'
    mockEntities['media_player.sonos'].state = 'off'
    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    fireEvent.click(screen.getByRole('button', { name: /^Living Room Remote Off$/i }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('data-has-navigation', 'true')
    expect(screen.getByRole('heading', { name: 'Living Room SHIELD Remote' })).toBeInTheDocument()
    expect(screen.getByText('Power On')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Power' })).toHaveStyle({ color: 'rgb(0, 128, 0)' })
    expect(screen.queryByRole('heading', { name: 'Sonos Volume' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Volume Down' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Controls' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pause' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled()
    expect(mockCallServiceCalls).toEqual([])
  })

  it('resets the mobile remote scroll offset when switching modal tabs', async () => {
    const originalMatchMedia = window.matchMedia
    const mobileMatchMedia = vi.fn((query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    }))
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: mobileMatchMedia })

    try {
      mockEntities['media_player.living_room_shield_2'].state = 'playing'
      render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)
      fireEvent.click(screen.getByRole('button', { name: /^Living Room Remote Off$/i }))

      const dialog = await screen.findByRole('dialog')
      const panel = dialog.querySelector<HTMLElement>('[data-scroll-region="media-remote-panel"]')
      expect(panel).toBeInTheDocument()

      panel!.scrollTop = 137
      await clickModalTab(within(dialog), 'Apps')

      expect(panel).toHaveAttribute('data-tab', 'apps')
      expect(panel!.scrollTop).toBe(0)
    } finally {
      Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia })
    }
  })

  it('ports media app cards inside remote modals with YAML service payloads', async () => {
    mockEntities['media_player.living_room_shield_2'].state = 'playing'
    let view = render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)
    fireEvent.click(screen.getByRole('button', { name: /^Living Room Remote Off$/i }))
    await clickModalTab(within(await screen.findByRole('dialog')), 'Apps')
    expect(await screen.findByRole('heading', { name: 'Media' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Power' })).not.toBeInTheDocument()
    expect(screen.getByText('Power Off')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Power' }).closest('[data-scroll-region]')).toBeNull()
    const livingRoomRemoteDialog = screen.getByRole('dialog')
    expect(within(livingRoomRemoteDialog).getByRole('button', { name: 'YouTube' })).toHaveAttribute('data-background', 'white')
    fireEvent.click(within(livingRoomRemoteDialog).getByRole('button', { name: 'Plex' }))
    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', service: 'launch_app_on_media_player', target: undefined, serviceData: { entity: 'media_player.living_room_shield', remote_entity: 'remote.living_room_shield', app_id: 'com.plexapp.android' } },
    ])
    view.unmount()
    resetMockHass()
    window.history.replaceState(null, '', window.location.pathname)

    view = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    fireEvent.click(screen.getByRole('button', { name: /^Apple TV Paused$/i }))
    await clickModalTab(within(await screen.findByRole('dialog')), 'Apps')
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Plex' }))
    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', service: 'launch_app_on_apple_tv', target: undefined, serviceData: { entity: 'media_player.master_bedroom_apple_tv', app_name: 'Plex', remote_entity: 'remote.master_bedroom_apple_tv' } },
    ])
    view.unmount()
    resetMockHass()
    window.history.replaceState(null, '', window.location.pathname)

    render(<DashboardViewPage activePath="theater-room" onNavigate={() => undefined} path="theater-room" />)
    fireEvent.click(screen.getByRole('button', { name: /^Theater Room Remote Off$/i }))
    await clickModalTab(within(await screen.findByRole('dialog')), 'Apps')
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Disney+' }))
    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', service: 'launch_app_on_media_player', target: undefined, serviceData: { entity: 'media_player.theater_room_shield', remote_entity: 'remote.theater_shield_remote', app_id: 'com.disney.disneyplus', turn_on_projector: true } },
    ])
  })

  it('opens Media page room remote modals while the rooms are off', async () => {
    let view = render(<DashboardViewPage activePath="media" onNavigate={() => undefined} path="media" />)

    fireEvent.click(screen.getByRole('button', { name: /^Living Room SHIELD Off$/i }))
    expect(await screen.findByRole('heading', { name: 'Living Room SHIELD Remote' })).toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([])

    view.unmount()
    resetMockHass()
    window.history.replaceState(null, '', window.location.pathname)

    view = render(<DashboardViewPage activePath="media" onNavigate={() => undefined} path="media" />)
    fireEvent.click(screen.getByRole('button', { name: /^Theater Room Off$/i }))
    expect(await screen.findByRole('heading', { name: 'Theater Room SHIELD Remote' })).toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([])

    view.unmount()
  })

  it('renders simplified Media page room controls and runs Theater scripts', () => {
    render(<DashboardViewPage activePath="media" onNavigate={() => undefined} path="media" />)

    expect(screen.getByRole('button', { name: /^Living Room SHIELD Off$/i }).parentElement).toHaveClass(/fullSpan/)
    expect(screen.queryByRole('button', { name: /Living Room SHIELD 2/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Sonos/i })).not.toBeInTheDocument()

    expect(screen.getByRole('button', { name: /^Theater Room Off$/i }).parentElement).toHaveClass(/fullSpan/)
    expect(screen.queryByRole('button', { name: /^Theater Off$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Projector Off$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Theater SHIELD Off$/i }).querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:television'))
    const livingSection = screen.getByRole('button', { name: /^Living Room SHIELD Off$/i }).closest('[data-responsive-section-item="true"]')
    const theaterSection = screen.getByRole('button', { name: /^Theater Room Off$/i }).closest('[data-responsive-section-item="true"]')
    expect(livingSection).not.toBe(theaterSection)
    expect(screen.getByRole('button', { name: /^Living Room SHIELD Off$/i }).closest('[data-dynamic-grid="true"]')).toHaveAttribute('data-dynamic-grid-layout', 'fill')
    expect(screen.getByRole('button', { name: /^Nintendo Switch Off$/i }).closest('[data-dynamic-grid="true"]')).toHaveAttribute('data-dynamic-grid-layout', 'fill')
    expect(screen.getByRole('button', { name: /^Nintendo Switch Off$/i }).closest('[data-dynamic-grid="true"]')).toHaveAttribute('data-dynamic-grid-item-sizing', 'content-aware')
    expect(screen.getByRole('group', { name: 'Theater Room Controls' })).toContainElement(screen.getByRole('button', { name: /^Nintendo Switch Off$/i }))

    fireEvent.click(screen.getByRole('button', { name: /^Nintendo Switch Off$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Theater SHIELD Off$/i }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', service: 'theater_room_nintendo_switch' },
      { domain: 'script', service: 'theater_room_tv_movie' },
    ])
  })

  it('adds the Music Room remote, source commands, and Fortnite to the Media page', async () => {
    render(<DashboardViewPage activePath="media" onNavigate={() => undefined} path="media" />)

    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
      'Living Room',
      'Music Room',
      'Theater Room',
    ])
    const musicHeading = screen.getByRole('heading', { name: 'Music Room' })
    const musicSection = musicHeading.closest('section')
    expect(musicSection).not.toBeNull()
    const remote = within(musicSection!).getByRole('button', { name: 'Music Room Remote Off' })
    const xbox = within(musicSection!).getByRole('button', { name: 'Xbox Off' })
    const server = within(musicSection!).getByRole('button', { name: 'Server Off' })
    const fortnite = within(musicSection!).getByRole('button', { name: 'Fortnite' })

    expect(remote).toHaveAttribute('data-action-kind', 'modal')
    expect(xbox).toHaveAttribute('data-action-kind', 'selection')
    expect(server).toHaveAttribute('data-action-kind', 'selection')
    expect(fortnite).toHaveAttribute('data-action-kind', 'selection')
    expect(fortnite).toHaveAttribute('aria-pressed', 'false')
    expect(remote.compareDocumentPosition(xbox) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(xbox.compareDocumentPosition(server) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(server.compareDocumentPosition(fortnite) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    fireEvent.click(remote)
    const dialog = await screen.findByRole('dialog', { name: 'Music Room Remote' })
    await clickModalTab(within(dialog), 'Hue Sync')
    expect(within(dialog).getByRole('switch', { name: 'Light Sync Off' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'High' })).toHaveAttribute('data-action-kind', 'selection')
    expect(within(dialog).queryByText('Entertainment Stream')).not.toBeInTheDocument()
  })

  it('runs Living Room page-level media app shortcuts from source image tiles', () => {
    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    const plex = screen.getByRole('button', { name: 'Plex' })
    expect(plex).toHaveAttribute('data-card', 'media-app')
    expect(screen.getByRole('button', { name: 'YouTube' })).toHaveClass(/mediaAppTileWhite/)

    fireEvent.click(plex)

    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', service: 'launch_app_on_media_player', target: undefined, serviceData: { entity: 'media_player.living_room_shield', remote_entity: 'remote.living_room_shield', app_id: 'com.plexapp.android' } },
    ])
  })

  it('matches the Music Room source vacuum overview card', () => {
    mockEntities['vacuum.valetudo_elatedusedram'].state = 'docked'
    mockEntities['sensor.valetudo_elatedusedram_battery_level'].state = '100'
    render(<DashboardViewPage activePath="music-room" onNavigate={() => undefined} path="music-room" />)

    expect(screen.getByRole('heading', { name: 'Devices' })).toBeInTheDocument()
    const vacuum = screen.getByRole('button', { name: /Music Room Docked • 100%/i })
    expect(vacuum).toHaveAttribute('data-icon', 'mdi:home')
    expect(vacuum).toHaveAttribute('data-tone', 'vacuum')
    expect(vacuum).toHaveStyle('--tile-color: rgba(67, 160, 71, 0.48)')
    expect(screen.queryByRole('button', { name: /Robot Vacuum Docked/i })).not.toBeInTheDocument()
  })

  it('matches Theater Room source media app, PC, and vacuum cards', () => {
    render(<DashboardViewPage activePath="theater-room" onNavigate={() => undefined} path="theater-room" />)

    fireEvent.click(screen.getByRole('button', { name: 'Plex' }))
    fireEvent.click(screen.getByRole('button', { name: /Theater Room PC Off/i }))

    const vacuum = screen.getByRole('button', { name: /Theater Room Docked • 99%/i })
    expect(vacuum).toHaveAttribute('data-icon', 'mdi:home')
    expect(vacuum).toHaveAttribute('data-tone', 'vacuum')
    expect(vacuum).toHaveStyle('--tile-color: rgba(67, 160, 71, 0.48)')
    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', service: 'launch_app_on_media_player', serviceData: { entity: 'media_player.theater_room_shield', remote_entity: 'remote.theater_shield_remote', app_id: 'com.plexapp.android', turn_on_projector: true } },
      { domain: 'input_button', service: 'press', target: 'input_button.theater_pc_on' },
    ])
  })

  it.each([
    ['living-room', 'vacuum.valetudo_exaltedsneakydeer', 'sensor.valetudo_exaltedsneakydeer_battery_level', 'cleaning', '72', 'Main Floor Cleaning • 72%', 'mdi:broom', 'vacuum'],
    ['music-room', 'vacuum.valetudo_elatedusedram', 'sensor.valetudo_elatedusedram_battery_level', 'unavailable', '87', 'Music Room Unavailable', 'mdi:robot-vacuum-off', 'neutral'],
    ['theater-room', 'vacuum.valetudo_politefatherlykingfisher', 'sensor.valetudo_politefatherlykingfisher_battery_level', 'error', '0', 'Theater Room Error • 0%', 'mdi:alert-circle', 'danger'],
  ])('uses the shared vacuum tile presentation on %s', (path, entityId, batteryEntityId, state, battery, accessibleName, icon, tone) => {
    mockEntities[entityId].state = state
    mockEntities[batteryEntityId].state = battery
    render(<DashboardViewPage activePath={path} onNavigate={() => undefined} path={path} />)

    const tile = screen.getByRole('button', { name: accessibleName })
    expect(tile).toHaveAttribute('data-icon', icon)
    expect(tile).toHaveAttribute('data-tone', tone)
    expect(tile).toHaveAttribute('data-modal-opener', 'true')
    expect(tile).not.toHaveAttribute('aria-disabled')
  })

  it('opens an unavailable room vacuum without calling Home Assistant', async () => {
    mockEntities['vacuum.valetudo_elatedusedram'].state = 'unavailable'
    mockEntities['sensor.valetudo_elatedusedram_battery_level'].state = '87'
    mockEntities['sensor.valetudo_elatedusedram_error'].state = 'unavailable'
    render(<DashboardViewPage activePath="music-room" onNavigate={() => undefined} path="music-room" />)

    fireEvent.click(screen.getByRole('button', { name: 'Music Room Unavailable' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Music Room: Robot Vacuum' })).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Unavailable')).not.toBeInTheDocument()
    expect(within(dialog).getByText('Last Reported Position').closest('[role="note"]')).toHaveTextContent('Last Reported Position')
    expect(within(dialog).getByText('Battery').closest('[data-icon]')).toHaveAttribute('data-tone', 'unavailable')
    expect(within(dialog).getByRole('button', { name: 'Locate' })).toBeDisabled()
    expect(mockCallServiceCalls).toEqual([])
  })

  it('keeps the unavailable notice when no retained vacuum map exists', async () => {
    const cameraEntityId = 'camera.valetudo_elatedusedram_map_data'
    const cameraEntity = mockEntities[cameraEntityId]
    delete mockEntities[cameraEntityId]

    try {
      render(<DashboardViewPage activePath="music-room" onNavigate={() => undefined} path="music-room" />)
      fireEvent.click(screen.getByRole('button', { name: 'Music Room Unavailable' }))

      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText('Map Unavailable')).toBeInTheDocument()
      expect(within(dialog).getByLabelText('Unavailable')).toHaveTextContent('Home Assistant does not have a current status for the vacuum.')
      expect(within(dialog).queryByText('Last Reported Position')).not.toBeInTheDocument()
    } finally {
      if (cameraEntity) mockEntities[cameraEntityId] = cameraEntity
    }
  })

  it('retains room vacuum focus when the vacuum becomes unavailable', () => {
    mockEntities['vacuum.valetudo_elatedusedram'].state = 'docked'
    mockEntities['sensor.valetudo_elatedusedram_battery_level'].state = '100'
    render(<DashboardViewPage activePath="music-room" onNavigate={() => undefined} path="music-room" />)

    const tile = screen.getByRole('button', { name: 'Music Room Docked • 100%' })
    tile.focus()

    act(() => {
      setMockEntityState('vacuum.valetudo_elatedusedram', 'unavailable')
      setMockEntityState('sensor.valetudo_elatedusedram_battery_level', 'unavailable')
    })

    expect(screen.getByRole('button', { name: 'Music Room Unavailable' })).toBe(tile)
    expect(tile).toHaveFocus()
  })

  it('runs bathroom fan script controls and preserves the towel-rack switch behavior', () => {
    render(<DashboardViewPage activePath="guest-bathroom" onNavigate={() => undefined} path="guest-bathroom" />)

    const fan = screen.getByRole('button', { name: /Fan Off/i })
    const power = screen.getByRole('switch', { name: 'Power' })
    const towelRack = screen.getByRole('button', { name: /Towel Rack On/i })
    expect(fan.closest('[data-bathroom-fan-tile="guest"]')?.parentElement).toHaveClass(/fullSpan/)
    expect(fan.closest('[data-dynamic-grid-cell="true"]')).toHaveAttribute('data-dynamic-grid-span', '2')
    expect(fan).toHaveAttribute('data-modal-opener', 'true')
    expect(towelRack).toHaveStyle('--tile-color: rgba(136, 64, 26, 0.6)')

    fireEvent.click(power)
    fireEvent.click(towelRack)

    expect(mockCallServiceCalls).toEqual([
      {
        domain: 'script',
        service: 'guest_bathroom_fan_command',
        serviceData: { command: 'power', target_power: 'on' },
      },
      { domain: 'homeassistant', service: 'toggle', target: 'switch.guest_bathroom_towel_rack_switch_top' },
    ])
  })

  it('opens the bathroom fan hash modal and preserves its mounted close lifecycle', async () => {
    render(<DashboardViewPage activePath="guest-bathroom" onNavigate={() => undefined} path="guest-bathroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Fan Off/i }))

    const dialog = await screen.findByRole('dialog')
    expect(window.location.hash).toBe('#fan-guest-bathroom')
    expect(screen.getByRole('heading', { name: 'Guest Bathroom Fan' })).toBeInTheDocument()
    expect(within(dialog).getByText('Room occupancy')).toBeInTheDocument()
    expect(dialog.querySelector('[data-modal-sheet-footer="true"]')).toBeNull()
    expect(mockCallServiceCalls).toEqual([])

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))

    expect(window.location.hash).toBe('')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('data-state', 'closed')
  })

  it('shares bathroom fan optimistic intent between the tile and modal', async () => {
    render(<DashboardViewPage activePath="guest-bathroom" onNavigate={() => undefined} path="guest-bathroom" />)

    fireEvent.click(screen.getByRole('switch', { name: 'Power' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fan On' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('switch', { name: 'Power On' })).toHaveAttribute('aria-checked', 'true')
    expect(within(dialog).getByRole('heading', { name: 'Timer' })).toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([
      {
        domain: 'script',
        service: 'guest_bathroom_fan_command',
        serviceData: { command: 'power', target_power: 'on' },
      },
    ])
  })

  it('ports the Master Bedroom Apple TV remote modal from the source popup', async () => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /^Apple TV Paused$/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Apple TV Remote' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Volume' })).toBeInTheDocument()
    expect(screen.getByText('Power Off')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Power' })).toHaveStyle({ color: 'rgb(255, 0, 0)' })
    expect(mockCallServiceCalls).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: 'Select' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }))
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', service: 'apple_tv_remote_send_command', target: undefined, serviceData: { remote_entity: 'remote.master_bedroom_apple_tv', command: 'select' } },
      { domain: 'script', service: 'toggle_sonos_mute', target: undefined, serviceData: { sonosdevice: ['media_player.primary_bedroom'] } },
      { domain: 'script', service: 'apple_tv_remote_send_command', target: undefined, serviceData: { remote_entity: 'remote.master_bedroom_apple_tv', command: 'play' } },
    ])
  })

  it('ports the Theater Room remote modal with device controls', async () => {
    mockEntities['media_player.theater_room_shield'].state = 'playing'
    mockEntities['media_player.theater'].state = 'on'
    mockEntities['input_boolean.theater_pc_power'].state = 'on'
    render(<DashboardViewPage activePath="theater-room" onNavigate={() => undefined} path="theater-room" />)

    fireEvent.click(screen.getByRole('button', { name: /^Theater Room Remote Off$/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Theater Room SHIELD Remote' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Yamaha Volume' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Yamaha Volume volume' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Volume Down' })).toBeEnabled()
    expect(screen.getByRole('tab', { name: 'Devices' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Devices' })).not.toBeInTheDocument()
    expect(screen.getByText('Power Off')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Power' })).toHaveStyle({ color: 'rgb(255, 0, 0)' })
    const remoteControls = within(screen.getByRole('dialog')).getByRole('group', { name: 'Theater Room SHIELD remote controls' })
    expect(screen.getByRole('button', { name: 'Power' }).compareDocumentPosition(remoteControls) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(screen.getByRole('dialog')).getByRole('tabpanel', { name: 'Controls' })).toHaveAttribute('data-scroll-region', 'media-remote-panel')
    expect(mockCallServiceCalls).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: 'Power' }))
    fireEvent.click(screen.getByRole('button', { name: 'Right' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    fireEvent.click(screen.getByRole('button', { name: 'Volume Up' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }))

    await clickModalTab(within(screen.getByRole('dialog')), 'Devices')
    expect(screen.getByRole('tab', { name: 'Devices' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: 'Devices' })).toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).getByRole('tabpanel', { name: 'Devices' })).toHaveAttribute('data-tab', 'devices')
    expect(screen.queryByRole('heading', { name: 'Yamaha Volume' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Projector Off/i })).toHaveAttribute('data-tone', 'media')
    expect(screen.getByRole('button', { name: /Projector Off/i })).toHaveAttribute('data-icon', 'mdi:projector')
    const deviceGrid = screen.getByRole('button', { name: /Projector Off/i }).closest('[data-dynamic-grid="true"]')
    expect(deviceGrid).toHaveAttribute('data-dynamic-grid-item-sizing', 'content-aware')
    expect(deviceGrid).toHaveAttribute('data-dynamic-grid-max-cell-width', '260')
    expect(deviceGrid).toHaveAttribute('data-dynamic-grid-max-columns', '4')
    expect(screen.getByRole('button', { name: /Theater Room PC On/i })).toHaveAttribute('data-tone', 'switch')
    fireEvent.click(screen.getByRole('button', { name: /Projector Off/i }))
    fireEvent.click(screen.getByRole('button', { name: /Theater Room PC On/i }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', service: 'toggle_on_off_theater_room', target: undefined, serviceData: undefined },
      { domain: 'remote', service: 'send_command', target: 'remote.theater_shield_remote', serviceData: { command: 'DPAD_RIGHT' } },
      { domain: 'remote', service: 'send_command', target: 'remote.theater_shield_remote', serviceData: { command: 'MEDIA_PAUSE' } },
      { domain: 'media_player', service: 'volume_up', target: 'media_player.theater', serviceData: undefined },
      { domain: 'media_player', service: 'volume_mute', target: 'media_player.theater', serviceData: { is_volume_muted: true } },
      { domain: 'media_player', service: 'toggle', target: 'media_player.sony_projector', serviceData: undefined },
      { domain: 'input_button', service: 'press', target: 'input_button.theater_pc_off', serviceData: undefined },
    ])
  })

  it('shows disabled Theater Yamaha volume controls when the receiver is off', async () => {
    mockEntities['media_player.theater_room_shield'].state = 'playing'
    mockEntities['media_player.theater'].state = 'off'
    render(<DashboardViewPage activePath="theater-room" onNavigate={() => undefined} path="theater-room" />)

    fireEvent.click(screen.getByRole('button', { name: /^Theater Room Remote Off$/i }))

    expect(await screen.findByRole('heading', { name: 'Theater Room SHIELD Remote' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Yamaha Volume' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Yamaha Volume volume' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Volume Down' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Mute' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Volume Up' })).toBeDisabled()
    expect(mockCallServiceCalls).toEqual([])
  })

  it('opens room vacuum source cards with reusable vacuum modal controls', async () => {
    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    fireEvent.click(screen.getByRole('button', { name: /Main Floor Docked/i }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('data-size', 'workspace')
    expect(dialog).toHaveAttribute('data-scroll-mode', 'panes')
    expect(screen.getByRole('heading', { name: 'Living Room: Robot Vacuum' })).toBeInTheDocument()
    expect(screen.queryByText('Main Floor Robot Vacuum')).not.toBeInTheDocument()
    const mapPane = within(dialog).getByRole('group', { name: 'Main Floor map and status' })
    const controlsPane = within(dialog).getByRole('group', { name: 'Main Floor controls, rooms, auto-clean, actions, info' })
    const modalNav = within(dialog).getByRole('tablist', { name: 'Main Floor modal sections' })
    const modalNavButtons = within(modalNav).getAllByRole('tab')
    expect(modalNavButtons.map((button) => button.getAttribute('aria-label'))).toEqual(['Controls', 'Rooms', 'Auto-Clean', 'Actions', 'Info'])
    expect(modalNavButtons[2].querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:robot-vacuum-off'))
    expect(modalNavButtons[3].querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:flash'))
    expect(modalNavButtons[4].querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:information-outline'))
    expect(within(mapPane).getByRole('region', { name: 'Main Floor Valetudo map' })).toBeInTheDocument()
    expect(within(controlsPane).getByText('Battery')).toBeInTheDocument()
    const dockStatusChip = within(controlsPane).getByRole('group', { name: 'Dock Status Idle' })
    expect(dockStatusChip).toHaveAttribute('data-icon', 'mdi:home')
    expect(dockStatusChip).toHaveAttribute('data-tone', 'neutral')
    expect(within(mapPane).queryByRole('heading', { name: 'Consumables' })).not.toBeInTheDocument()
    expect(within(mapPane).queryByRole('heading', { name: 'Bin State' })).not.toBeInTheDocument()
    expect(screen.queryByText('No error')).not.toBeInTheDocument()
    expect(within(controlsPane).queryByRole('heading', { name: 'Vacuum Controls' })).not.toBeInTheDocument()
    expect(within(controlsPane).getAllByRole('heading').map((heading) => heading.textContent)).toEqual(['Docked', 'Full Clean', 'Power Settings'])
    expect(screen.queryByRole('button', { name: 'Empty Bin' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Mode options' })).not.toBeInTheDocument()
    const modeSelect = screen.getByRole('combobox', { name: /Mode Vacuum/i })
    expect(modeSelect).toHaveValue('vacuum')
    expect(modeSelect.closest('[data-layout]')).toHaveAttribute('data-layout', 'default')
    expect(modeSelect.closest('[data-has-description]')).toHaveAttribute('data-has-description', 'true')
    expect(modeSelect.closest('[data-native-select-field]')).toHaveAttribute('data-native-select-field', 'true')
    expect(modeSelect.closest('[data-native-select-field]')).toHaveAttribute('data-has-icon', 'true')
    expect(within(modeSelect.closest('[data-native-select-field]') as HTMLElement).getByText('Mode').parentElement?.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:robot-vacuum'))
    const modeDescription = screen.getByText('Choose whether the robot vacuums, mops, or combines both for the next run.')
    expect(modeDescription).toBeInTheDocument()
    expect(modeDescription.closest('[data-native-select-field]')).toBeNull()
    expect(modeDescription.compareDocumentPosition(modeSelect) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByText('Set the cleaning mode, suction, and water level before starting the next run.')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Mode' })).not.toBeInTheDocument()
    const fanSelect = screen.getByRole('combobox', { name: /Fan Balanced/i })
    expect(fanSelect).toHaveValue('balanced')
    expect(within(fanSelect.closest('[data-native-select-field]') as HTMLElement).getByText('Fan').parentElement?.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:fan'))
    expect(screen.getByText('Adjust suction strength for carpets, hard floors, and quieter cleaning.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Fan' })).not.toBeInTheDocument()
    expect(screen.queryByText('Cleaning Passes')).not.toBeInTheDocument()
    const cleaningPassesSelect = screen.getByRole('combobox', { name: /Cleaning Passes 1x/i })
    const cleaningSetupDescription = screen.getByText('Choose how many passes the vacuum should make, then start cleaning with the selected rooms.')
    expect(cleaningSetupDescription).toBeInTheDocument()
    expect(cleaningSetupDescription.closest('[data-native-select-field]')).toBeNull()
    expect(cleaningSetupDescription.closest('button')).toBeNull()
    expect(cleaningSetupDescription.compareDocumentPosition(cleaningPassesSelect) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(cleaningPassesSelect).toHaveValue('1')
    expect(cleaningPassesSelect.closest('[data-layout]')).toHaveAttribute('data-layout', 'cleaning')
    expect(cleaningPassesSelect.closest('[data-has-description]')).toHaveAttribute('data-has-description', 'false')
    expect(cleaningPassesSelect.closest('[data-label-hidden]')).toHaveAttribute('data-label-hidden', 'true')
    expect(cleaningPassesSelect.closest('[data-native-select-field]')).toHaveAttribute('data-native-select-field', 'true')
    expect(within(cleaningPassesSelect).getAllByRole('option').map((option) => option.textContent)).toEqual(['1x', '2x', '3x'])
    expect(screen.queryByRole('dialog', { name: 'Cleaning Passes' })).not.toBeInTheDocument()
    const cleanButton = screen.getByRole('button', { name: 'Clean' })
    expect(cleaningSetupDescription.compareDocumentPosition(cleanButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const selectedRoomsSummary = screen.getByText('Full Clean').closest('div') as HTMLElement
    expect(within(selectedRoomsSummary).getByText('No rooms are selected, and no areas are drawn. If you begin cleaning, the robot vacuum will attempt to clean every mapped area.')).toBeInTheDocument()
    expect(cleanButton).toHaveAttribute('data-icon', 'mdi:play')
    expect(cleanButton).toHaveAttribute('data-modal-action-button', 'true')
    expect(cleanButton).toHaveAttribute('data-tone', 'primary')
    const cleaningTarget = within(dialog).getByRole('group', { name: 'Cleaning target' })
    expect(within(cleaningTarget).getByRole('button', { name: 'Rooms' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(cleaningTarget).getByRole('button', { name: 'Area' })).toHaveAttribute('aria-pressed', 'false')
    await clickModalTab(within(dialog), 'Rooms')
    const zonesHeading = within(controlsPane).getByRole('heading', { name: 'Rooms' })
    expect(screen.getByText('Select any zones to focus cleaning in those areas. If you press clean and no zones are selected, we will clean all zones on the Main Floor.')).toBeInTheDocument()
    expect(screen.getByText('Zones are not selectable or changeable while cleaning is ongoing.')).toBeInTheDocument()
    expect(screen.getByText('Rooms are cleaned in the order you select them. The numbered badges show the current cleaning sequence.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /living room/i }).querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:sofa'))
    await clickModalTab(within(dialog), 'Auto-Clean')
    const autoCleanHeading = within(controlsPane).getByRole('heading', { name: 'Disabled Auto-Clean Rooms' })
    expect(autoCleanHeading).toBeInTheDocument()
    const autoCleanGrid = autoCleanHeading.closest('section')?.querySelector('[data-dynamic-grid]')
    expect(autoCleanGrid).toHaveAttribute('data-dynamic-grid-item-sizing', 'uniform')
    expect(screen.getByText('Check rooms that should be skipped when the coordinator starts an automatic away clean. Use this for closed doors, guests, or projects on the floor; manual selected-room cleans still use the Zones tab.')).toBeInTheDocument()
    const livingRoomAutoClean = screen.getByRole('button', { name: 'Living Room auto-clean enabled' })
    expect(livingRoomAutoClean).toHaveAttribute('aria-pressed', 'false')
    expect(livingRoomAutoClean.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:checkbox-blank-outline'))
    expect(within(livingRoomAutoClean).queryByText(/auto-clean/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Closet auto-clean enabled' })).toBeInTheDocument()
    await clickModalTab(within(dialog), 'Actions')
    const dockControlsHeading = within(controlsPane).getByRole('heading', { name: 'Dock Controls' })
    expect(dockControlsHeading).toBeInTheDocument()
    expect(zonesHeading).not.toBeInTheDocument()
    expect(autoCleanHeading).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clean Mop Dock' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Dry Mops' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Empty Bin' }).querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:delete-restore'))
    await clickModalTab(within(dialog), 'Info')
    expect(within(controlsPane).getAllByRole('heading').map((heading) => heading.textContent)).toEqual(['Bin State', 'Consumables'])
    expect(within(controlsPane).getByRole('heading', { name: 'Bin State' })).toBeInTheDocument()
    expect(within(controlsPane).getByRole('heading', { name: 'Consumables' })).toBeInTheDocument()
    expect(within(controlsPane).getByRole('group', { name: 'Main Brush 204h left' })).toBeInTheDocument()
    expect(within(controlsPane).getByRole('group', { name: 'Dustbag OK' })).toBeInTheDocument()
  })

  it.each([
    { state: 'docked', stateLabel: 'Docked', heading: 'Docked', actions: ['Resume', 'Cancel'] },
    { state: 'idle', stateLabel: 'Idle', heading: 'Idle', actions: ['Resume', 'Cancel'] },
    { state: 'paused', stateLabel: 'Paused', heading: 'Paused', actions: ['Resume', 'Stop'] },
    { state: 'returning', stateLabel: 'Returning', heading: 'Returning', actions: ['Pause', 'Cancel'] },
  ])('uses the resumable action matrix while $state', async ({ actions, heading, state, stateLabel }) => {
    mockEntities['vacuum.valetudo_exaltedsneakydeer'].state = state
    mockEntities['sensor.valetudo_exaltedsneakydeer_status_flag'].state = 'resumable'
    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    fireEvent.click(screen.getByRole('button', { name: new RegExp(`Main Floor ${stateLabel}`, 'i') }))

    const dialog = await screen.findByRole('dialog')
    const controlsPane = within(dialog).getByRole('group', { name: 'Main Floor controls, auto-clean, info' })
    expect(within(controlsPane).getByRole('heading', { name: heading })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Home Assistant Condition')).toHaveTextContent('Kept for Later')
    expect(dialog.querySelector('[data-vacuum-live-status="true"]')).toHaveTextContent('Kept for Later')
    expect(within(controlsPane).queryByRole('button', { name: 'Clean' })).not.toBeInTheDocument()
    expect(within(controlsPane).queryByRole('group', { name: 'Cleaning target' })).not.toBeInTheDocument()
    if (state === 'idle') {
      expect(within(controlsPane).getByRole('button', { name: 'Dock' })).toBeEnabled()
    } else {
      expect(within(controlsPane).queryByRole('button', { name: 'Dock' })).not.toBeInTheDocument()
    }
    for (const action of actions) expect(within(controlsPane).getByRole('button', { name: action })).toBeEnabled()

    expect(within(dialog).queryByRole('tab', { name: 'Rooms' })).not.toBeInTheDocument()
  })

  it.each(['docked', 'idle', 'returning'])('cancels a %s resumable run with vacuum.stop', async (state) => {
    mockEntities['vacuum.valetudo_exaltedsneakydeer'].state = state
    mockEntities['sensor.valetudo_exaltedsneakydeer_status_flag'].state = 'resumable'
    const { rerender } = render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    const stateLabel = state[0].toUpperCase() + state.slice(1)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`Main Floor ${stateLabel}`, 'i') }))
    const dialog = await screen.findByRole('dialog')
    const controlsPane = within(dialog).getByRole('group', { name: 'Main Floor controls, auto-clean, info' })
    fireEvent.click(within(controlsPane).getByRole('button', { name: 'Cancel' }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'vacuum', service: 'stop', target: 'vacuum.valetudo_exaltedsneakydeer' },
    ])
    expect(within(controlsPane).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(within(controlsPane).queryByRole('button', { name: 'Clean' })).not.toBeInTheDocument()

    mockEntities['sensor.valetudo_exaltedsneakydeer_status_flag'].state = 'none'
    rerender(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    if (state === 'returning') {
      expect(within(controlsPane).queryByRole('button', { name: 'Clean' })).not.toBeInTheDocument()
      mockEntities['vacuum.valetudo_exaltedsneakydeer'].state = 'idle'
      rerender(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)
    }
    await waitFor(() => expect(within(controlsPane).getByRole('button', { name: 'Clean' })).toBeEnabled())
    expect(within(controlsPane).queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
  })

  it.each([
    { state: 'idle', stateLabel: 'Idle', actions: ['Clean', 'Dock'] },
    { state: 'paused', stateLabel: 'Paused', actions: ['Resume', 'Stop'] },
    { state: 'returning', stateLabel: 'Returning', actions: ['Pause'] },
  ])('keeps ordinary $state controls when the status flag is none', async ({ actions, state, stateLabel }) => {
    mockEntities['vacuum.valetudo_exaltedsneakydeer'].state = state
    mockEntities['sensor.valetudo_exaltedsneakydeer_status_flag'].state = 'none'
    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    fireEvent.click(screen.getByRole('button', { name: new RegExp(`Main Floor ${stateLabel}`, 'i') }))

    const dialog = await screen.findByRole('dialog')
    const controlsPane = within(dialog).getByRole('group', {
      name: state === 'idle' ? 'Main Floor controls, rooms, auto-clean, actions, info' : 'Main Floor controls, auto-clean, info',
    })
    if (state === 'idle') {
      expect(within(controlsPane).getByRole('group', { name: 'Cleaning target' })).toBeInTheDocument()
    } else {
      expect(within(controlsPane).queryByRole('group', { name: 'Cleaning target' })).not.toBeInTheDocument()
    }
    expect(within(controlsPane).queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    for (const action of actions) expect(within(controlsPane).getByRole('button', { name: action })).toBeEnabled()
  })

  it('opens the vacuum area editor as a same-sheet detail page', async () => {
    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    fireEvent.click(screen.getByRole('button', { name: /Main Floor Docked/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(within(dialog).getByRole('group', { name: 'Cleaning target' })).getByRole('button', { name: 'Area' }))

    expect(within(dialog).getByRole('heading', { name: 'Main Floor Cleaning Area' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Back to controls' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Draw' })).toHaveAttribute('data-active', 'true')
    expect(within(dialog).getByRole('button', { name: 'Draw an Area to Continue' })).toBeDisabled()
    expect(within(dialog).queryByRole('tablist', { name: 'Main Floor modal sections' })).not.toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to controls' }))

    expect(within(dialog).getByRole('heading', { name: 'Living Room: Robot Vacuum' })).toBeInTheDocument()
    expect(within(dialog).getByRole('tablist', { name: 'Main Floor modal sections' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Area' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(dialog).getByRole('button', { name: 'Rooms' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('confirms before replacing selected rooms with area drawing', async () => {
    mockEntities['input_boolean.roborock_living_room_toggle'].state = 'on'
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)

    try {
      render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)
      fireEvent.click(screen.getByRole('button', { name: /Main Floor Docked/i }))
      const dialog = await screen.findByRole('dialog')
      const areaButton = within(within(dialog).getByRole('group', { name: 'Cleaning target' })).getByRole('button', { name: 'Area' })

      fireEvent.click(areaButton)
      expect(confirm).toHaveBeenLastCalledWith('Switch to Area? Continuing clears your selected rooms and opens area drawing.')
      expect(within(dialog).queryByRole('heading', { name: 'Main Floor Cleaning Area' })).not.toBeInTheDocument()
      expect(mockCallServiceCalls).toEqual([])

      fireEvent.click(areaButton)
      expect(within(dialog).getByRole('heading', { name: 'Main Floor Cleaning Area' })).toBeInTheDocument()
      expect(mockCallServiceCalls).toEqual([
        { domain: 'input_boolean', service: 'turn_off', target: 'input_boolean.roborock_living_room_toggle' },
      ])
    } finally {
      confirm.mockRestore()
      mockEntities['input_boolean.roborock_living_room_toggle'].state = 'off'
    }
  })

  it('closes the area editor when the vacuum becomes unavailable', async () => {
    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    fireEvent.click(screen.getByRole('button', { name: /Main Floor Docked/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(within(dialog).getByRole('group', { name: 'Cleaning target' })).getByRole('button', { name: 'Area' }))
    expect(within(dialog).getByRole('heading', { name: 'Main Floor Cleaning Area' })).toBeInTheDocument()

    act(() => setMockEntityState('vacuum.valetudo_exaltedsneakydeer', 'unavailable'))

    await waitFor(() => expect(within(dialog).getByRole('heading', { name: 'Living Room: Robot Vacuum' })).toBeInTheDocument())
    expect(within(dialog).queryByRole('button', { name: 'Draw' })).not.toBeInTheDocument()
    expect(within(dialog).getByText('Last Reported Position').closest('[role="note"]')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Locate' })).toBeDisabled()
    expect(mockCallServiceCalls).toEqual([])
  })

  it('runs source-derived vacuum modal services without activating hidden actions', async () => {
    const { rerender } = render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    fireEvent.click(screen.getByRole('button', { name: /Main Floor Docked/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Locate' }))
    fireEvent.change(screen.getByRole('combobox', { name: /Fan Balanced/i }), { target: { value: 'turbo' } })
    expect(screen.getByRole('combobox', { name: /Fan Turbo/i })).toHaveValue('turbo')
    await clickModalTab(within(screen.getByRole('dialog')), 'Actions')
    fireEvent.click(screen.getByRole('button', { name: 'Empty Bin' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clean Mop Dock' }))
    await clickModalTab(within(screen.getByRole('dialog')), 'Rooms')
    fireEvent.click(screen.getByRole('button', { name: 'Living Room' }))
    await clickModalTab(within(screen.getByRole('dialog')), 'Auto-Clean')
    fireEvent.click(screen.getByRole('button', { name: 'Office auto-clean enabled' }))
    await clickModalTab(within(screen.getByRole('dialog')), 'Controls')
    fireEvent.click(screen.getByRole('button', { name: 'Clean' }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'vacuum', service: 'locate', target: 'vacuum.valetudo_exaltedsneakydeer' },
      { domain: 'select', service: 'select_option', target: 'select.valetudo_exaltedsneakydeer_fan', serviceData: { option: 'turbo' } },
      { domain: 'button', service: 'press', target: 'button.valetudo_exaltedsneakydeer_trigger_auto_empty_dock' },
      { domain: 'script', service: 'main_floor_vacuum_mop_dock_clean' },
      { domain: 'input_boolean', service: 'turn_on', target: 'input_boolean.roborock_living_room_toggle' },
      { domain: 'switch', service: 'turn_on', target: 'switch.main_floor_vacuum_coordinator_office_auto_clean_disabled' },
    ])

    mockEntities['select.valetudo_exaltedsneakydeer_fan'].state = 'turbo'
    mockEntities['input_boolean.roborock_living_room_toggle'].state = 'on'
    rerender(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    await waitFor(() => expect(mockCallServiceCalls).toEqual([
      { domain: 'vacuum', service: 'locate', target: 'vacuum.valetudo_exaltedsneakydeer' },
      { domain: 'select', service: 'select_option', target: 'select.valetudo_exaltedsneakydeer_fan', serviceData: { option: 'turbo' } },
      { domain: 'button', service: 'press', target: 'button.valetudo_exaltedsneakydeer_trigger_auto_empty_dock' },
      { domain: 'script', service: 'main_floor_vacuum_mop_dock_clean' },
      { domain: 'input_boolean', service: 'turn_on', target: 'input_boolean.roborock_living_room_toggle' },
      { domain: 'switch', service: 'turn_on', target: 'switch.main_floor_vacuum_coordinator_office_auto_clean_disabled' },
      { domain: 'script', service: 'main_floor_vacuum_clean_selected_segments', target: undefined },
    ]), { timeout: 1500 })
  })

  it('keeps dock-cleaning state in minimal mode with an Actions stop command and Info visible', async () => {
    mockEntities['sensor.valetudo_exaltedsneakydeer_dock_status'].state = 'cleaning'
    try {
      render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)
      fireEvent.click(screen.getByRole('button', { name: /Main Floor Docked/i }))
      const dialog = await screen.findByRole('dialog')
      const dockStatus = await within(dialog).findByRole('group', { name: 'Dock Status Cleaning' })
      expect(dockStatus).toHaveAttribute('data-icon', 'mdi:water')
      expect(dockStatus).toHaveAttribute('data-tone', 'active')
      expect(within(dialog).getAllByRole('tab').map((tab) => tab.getAttribute('aria-label'))).toEqual(['Controls', 'Auto-Clean', 'Actions', 'Info'])
      const controlsPane = within(dialog).getByRole('group', { name: 'Main Floor controls, auto-clean, actions, info' })
      expect(within(controlsPane).queryByRole('button', { name: 'Stop Dock Clean' })).not.toBeInTheDocument()
      expect(within(controlsPane).queryByRole('button', { name: 'Clean Mop Dock' })).not.toBeInTheDocument()
      expect(within(controlsPane).queryByRole('button', { name: 'Dry Mops' })).not.toBeInTheDocument()
      expect(within(controlsPane).queryByRole('button', { name: 'Empty Bin' })).not.toBeInTheDocument()
      fireEvent.click(within(dialog).getByRole('tab', { name: 'Actions' }))
      await waitFor(() => expect(within(dialog).getByRole('tab', { name: 'Actions' })).toHaveAttribute('aria-selected', 'true'))
      expect(await within(controlsPane).findByRole('button', { name: 'Stop Dock Clean' })).toBeInTheDocument()
      fireEvent.click(within(dialog).getByRole('tab', { name: 'Info' }))
      await waitFor(() => expect(within(dialog).getByRole('tab', { name: 'Info' })).toHaveAttribute('aria-selected', 'true'))
      expect(within(controlsPane).getByRole('group', { name: 'Fresh Water OK' })).toBeInTheDocument()
      expect(within(controlsPane).getByRole('group', { name: 'Waste Water OK' })).toBeInTheDocument()
      expect(mockCallServiceCalls).toEqual([])
    } finally {
      mockEntities['sensor.valetudo_exaltedsneakydeer_dock_status'].state = 'idle'
    }
  })

  it('shows only the coherent raw vacuum issue as non-assertive current status', async () => {
    mockEntities['vacuum.valetudo_exaltedsneakydeer'].state = 'error'
    mockEntities['sensor.valetudo_exaltedsneakydeer_error'].state = 'Brush stuck'
    mockEntities['input_text.main_floor_vacuum_error_message'].state = 'Main brush is stuck under the sofa'
    mockEntities['sensor.main_floor_vacuum_status'] = entity('sensor.main_floor_vacuum_status', 'error', {
      active_conditions: [],
      availability: { since: null, status: 'available' },
      command_policy: { mode: 'normal', reason: null },
      current_issue: { status: 'clear' },
      last_issue: null,
      observed_vacuum_state: 'error',
      vacuum_entity_id: 'vacuum.valetudo_exaltedsneakydeer',
      version: 1,
    })
    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    fireEvent.click(screen.getByRole('button', { name: /Main Floor Error/i }))

    const currentIssue = await screen.findByLabelText('Current Issue')
    const statusPill = screen.getByText('Status').closest('[data-icon]')
    expect(currentIssue).toHaveTextContent('Brush stuck')
    expect(screen.queryByText('Main brush is stuck under the sofa')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(statusPill).toHaveAttribute('data-icon', 'mdi:alert-circle')
    expect(statusPill).toHaveAttribute('data-tone', 'danger')
    expect(statusPill?.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:alert-circle'))
    expect(screen.getByRole('button', { name: 'Locate' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dock' })).toBeInTheDocument()
  })

  it('opens Theater Room vacuum with map and full Valetudo power controls', async () => {
    render(<DashboardViewPage activePath="theater-room" onNavigate={() => undefined} path="theater-room" />)

    fireEvent.click(screen.getByRole('button', { name: /Theater Room Docked/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Theater Room: Robot Vacuum' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Theater Room Valetudo map' })).toBeInTheDocument()
    expect(screen.getByRole('tablist', { name: 'Theater Room modal sections' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Controls' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Actions' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Info' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Rooms' })).not.toBeInTheDocument()
    const cleaningTarget = screen.getByRole('group', { name: 'Cleaning target' })
    expect(within(cleaningTarget).getByRole('button', { name: 'Rooms' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(cleaningTarget).getByRole('button', { name: 'Area' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByText('No rooms are selected, and no areas are drawn. If you begin cleaning, the robot vacuum will attempt to clean every mapped area.')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Mode Vacuum/i })).toHaveValue('vacuum')
    expect(screen.queryByRole('dialog', { name: 'Mode' })).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Fan Balanced/i })).toHaveValue('balanced')
    expect(screen.queryByRole('dialog', { name: 'Fan' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Entity not available/i)).not.toBeInTheDocument()
  })

  it('runs migrated room source actions for theater sources and garage doors', () => {
    const theaterView = render(<DashboardViewPage activePath="theater-room" onNavigate={() => undefined} path="theater-room" />)

    fireEvent.click(screen.getByRole('button', { name: /^Theater SHIELD Off$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Nintendo Switch Off$/i }))
    expect(screen.queryByText(/interactive controls available from this view/i)).not.toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', service: 'theater_room_tv_movie' },
      { domain: 'script', service: 'theater_room_nintendo_switch' },
    ])

    theaterView.unmount()
    mockCallServiceCalls.length = 0
    render(<DashboardViewPage activePath="garage" onNavigate={() => undefined} path="garage" />)

    fireEvent.click(screen.getByRole('button', { name: /^Left Door Closed$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Right Door Closed$/i }))
    expect(screen.queryByText(/interactive controls available from this view/i)).not.toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([
      { domain: 'cover', service: 'open_cover', target: 'cover.garage_left_door' },
      { domain: 'cover', service: 'open_cover', target: 'cover.garage_right_door' },
    ])
  })

  it('matches Kitchen section order, groceries summaries, and dishwasher subtitle', async () => {
    const navigate = vi.fn()
    render(<DashboardViewPage activePath="kitchen" onNavigate={navigate} path="kitchen" />)

    const groceriesHeading = screen.getByRole('heading', { name: 'Groceries' })
    const appliancesHeading = screen.getByRole('heading', { name: 'Appliances' })
    expect(groceriesHeading).toBeInTheDocument()
    expect(appliancesHeading).toBeInTheDocument()
    expect(groceriesHeading.compareDocumentPosition(appliancesHeading)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(screen.getByRole('heading', { name: 'Climate' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Grocery List 2 items' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Food 35 Items • 5 Expiring Soon' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pantry 12 Items • 1 Expiring Soon' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Fridge 8 Items • 1 Expiring Soon' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Freezer 5 Items • 1 Expiring Soon' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Spice Rack 6 Items • 1 Expiring Soon' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cabinet 4 Items • 1 Expiring Soon' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Grocery List 2 items' }))
    expect(navigate).toHaveBeenCalledWith('grocery-list')
    fireEvent.click(screen.getByRole('button', { name: 'Food 35 Items • 5 Expiring Soon' }))
    expect(navigate).toHaveBeenCalledWith('food')
    const dishwasher = screen.getByRole('button', { name: 'Dishwasher Not Running' })
    expect(dishwasher).toBeInTheDocument()
    expect(dishwasher.parentElement).toHaveClass(/fullSpan/)
    expect(screen.queryByText('Dishwasher Program')).not.toBeInTheDocument()
    expect(screen.queryByText('Dishwasher Progress')).not.toBeInTheDocument()

    fireEvent.click(dishwasher)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Dishwasher' })).toBeInTheDocument()
    const startDishwasher = within(dialog).getByRole('button', { name: 'Start Dishwasher' })
    expect(startDishwasher).toBeInTheDocument()
    expect(startDishwasher.parentElement).toHaveClass(/fullSpan/)
    expect(within(dialog).queryByRole('button', { name: 'Stop Program' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Resume Program' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('group', { name: 'Door Closed' })).toBeInTheDocument()

    fireEvent.click(startDishwasher)
    expect(mockCallServiceCalls).toContainEqual({ domain: 'input_button', service: 'press', target: 'input_button.start_dishwasher' })
    expect(within(dialog).getByRole('group', { name: 'Operation Cleaning' })).toBeInTheDocument()
    expect(within(dialog).getByRole('group', { name: 'Progress 0%' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Stop Program' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Start Dishwasher' })).not.toBeInTheDocument()
  })

  it('flags the Kitchen dishwasher card as clean until the door opens', async () => {
    mockEntities['input_boolean.dishwasher_clean_unopened'].state = 'on'
    mockEntities['sensor.dishwasher_operation_state'].state = 'ready'
    mockEntities['switch.dishwasher_power'].state = 'off'

    render(<DashboardViewPage activePath="kitchen" onNavigate={() => undefined} path="kitchen" />)

    const dishwasher = screen.getByRole('button', { name: 'Dishwasher Not Running • Clean' })
    expect(dishwasher).toBeInTheDocument()

    fireEvent.click(dishwasher)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('group', { name: 'Operation Not Running' })).toBeInTheDocument()
    expect(within(dialog).getByRole('group', { name: 'Clean Unopened Clean' })).toBeInTheDocument()
  })

  it('fills the Kitchen dishwasher button from live progress and exposes dishwasher controls', async () => {
    mockEntities['sensor.dishwasher_operation_state'].state = 'run'
    mockEntities['sensor.dishwasher_program_progress'].state = '97'
    mockEntities['sensor.dishwasher_program_finish_time'] = entity('sensor.dishwasher_program_finish_time', '2026-07-04T01:30:00+00:00')
    mockEntities['select.dishwasher_active_program'].state = 'dishcare_dishwasher_program_eco_50'
    mockEntities['select.dishwasher_selected_program'].state = 'dishcare_dishwasher_program_eco_50'
    mockEntities['select.dishwasher_selected_program'].attributes.options = ['dishcare_dishwasher_program_eco_50', 'dishcare_dishwasher_program_glas_40']
    mockEntities['switch.dishwasher_half_load'].state = 'off'
    mockEntities['switch.dishwasher_zeolite_dry'].state = 'off'
    mockEntities['switch.dishwasher_power'].state = 'off'

    render(<DashboardViewPage activePath="kitchen" onNavigate={() => undefined} path="kitchen" />)

    const dishwasher = screen.getByRole('button', { name: 'Dishwasher Cleaning • 97%' })
    expect(dishwasher).toHaveAttribute('data-progress', '97')
    expect(dishwasher.parentElement).toHaveClass(/fullSpan/)

    fireEvent.click(dishwasher)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Dishwasher' })).toBeInTheDocument()
    expect(within(dialog).getByRole('group', { name: 'Operation Cleaning' })).toBeInTheDocument()
    expect(within(dialog).getByRole('group', { name: 'Progress 97%' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Stop Program' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Start Dishwasher' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Resume Program' })).not.toBeInTheDocument()
    const programSelect = within(dialog).getByRole('combobox', { name: 'Program' })
    expect(programSelect).toHaveValue('dishcare_dishwasher_program_eco_50')
    expect(within(dialog).getByRole('group', { name: 'Rinse Aid OK' })).toBeInTheDocument()

    fireEvent.change(programSelect, { target: { value: 'dishcare_dishwasher_program_glas_40' } })
    expect(mockCallServiceCalls).toContainEqual({ domain: 'select', service: 'select_option', target: 'select.dishwasher_selected_program', serviceData: { option: 'dishcare_dishwasher_program_glas_40' } })

    fireEvent.click(within(dialog).getByRole('button', { name: 'Half Load Off' }))
    expect(mockCallServiceCalls).toContainEqual({ domain: 'switch', service: 'turn_on', target: 'switch.dishwasher_half_load' })

    fireEvent.click(within(dialog).getByRole('button', { name: 'Stop Program' }))
    expect(mockCallServiceCalls).toContainEqual({ domain: 'button', service: 'press', target: 'button.dishwasher_stop_program' })
    expect(within(dialog).getAllByText('Stopping').length).toBeGreaterThan(0)
    expect(within(dialog).queryByRole('button', { name: 'Stop Program' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Start Dishwasher' })).not.toBeInTheDocument()
  })

  it('renders the Food & Recipes hub in approved order with food spaces and a Scan Item FAB', async () => {
    const navigate = vi.fn()
    render(<DashboardViewPage activePath="food" onNavigate={navigate} path="food" />)

    await screen.findByRole('button', { name: 'Open Suggested Citrus Pantry Bowl with Roasted Garden Vegetables recipe details' })
    expect(screen.getByRole('heading', { name: 'Food & Recipes' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Suggested Recipes' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'All Food' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Food Spaces' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Recipes' })).not.toBeInTheDocument()
    const carouselPages = Array.from(document.querySelectorAll('[data-carousel-page]'))
    expect(carouselPages).toHaveLength(5)
    const carouselPageSize = carouselPages[0].querySelectorAll('[data-carousel-card]').length
    expect(carouselPageSize).toBeGreaterThanOrEqual(6)
    expect(document.querySelectorAll('[data-carousel-card]')).toHaveLength(carouselPageSize * 5)
    const floatingDock = document.querySelector('[data-floating-action-dock="true"]')
    const scanButton = screen.getByRole('button', { name: 'Scan Item' })
    expect(scanButton).toHaveTextContent('Scan Item')
    expect(floatingDock).toContainElement(scanButton)
    expect(floatingDock).not.toContainElement(screen.queryByRole('button', { name: 'Rooms' }))
    expect(screen.getByRole('button', { name: 'All Food 35 Items • 6 Expiring Soon' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pantry 12 Items • 1 Expiring Soon' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fridge 8 Items • 1 Expiring Soon' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Freezer 5 Items • 1 Expiring Soon' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Spice Rack 6 Items • 1 Expiring Soon' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cabinet 4 Items • 1 Expiring Soon' })).toBeInTheDocument()

    const allRecipes = screen.getByRole('button', { name: 'All Recipes' })
    expect(allRecipes).toHaveAttribute('data-icon', 'mdi:book-open-page-variant')
    fireEvent.click(allRecipes)
    expect(navigate).toHaveBeenCalledWith('recipes')
    fireEvent.click(screen.getByRole('button', { name: 'All Food 35 Items • 6 Expiring Soon' }))
    expect(navigate).toHaveBeenCalledWith('all-food')
    fireEvent.click(screen.getByRole('button', { name: 'Pantry 12 Items • 1 Expiring Soon' }))
    expect(navigate).toHaveBeenCalledWith('pantry')
    fireEvent.click(screen.getByRole('button', { name: 'Fridge 8 Items • 1 Expiring Soon' }))
    expect(navigate).toHaveBeenCalledWith('fridge')
    fireEvent.click(screen.getByRole('button', { name: 'Freezer 5 Items • 1 Expiring Soon' }))
    expect(navigate).toHaveBeenCalledWith('freezer')
    fireEvent.click(screen.getByRole('button', { name: 'Spice Rack 6 Items • 1 Expiring Soon' }))
    expect(navigate).toHaveBeenCalledWith('spice-rack')
    fireEvent.click(screen.getByRole('button', { name: 'Cabinet 4 Items • 1 Expiring Soon' }))
    expect(navigate).toHaveBeenCalledWith('cabinet')
  })

  it('preloads Food and Recipes with no recipe service calls or images', () => {
    const originalCallService = mockState.helpers.callService
    const callService = vi.fn(originalCallService)
    mockState.helpers.callService = callService
    try {
      const food = render(<DashboardViewPage activePath="food" onNavigate={() => undefined} path="food" preload />)
      const recipes = render(<DashboardViewPage activePath="recipes" onNavigate={() => undefined} path="recipes" preload />)

      expect(callService.mock.calls.flatMap(([params]) => params).filter((params) => params.domain === 'evershelf' && (params.service === 'recipe_query' || params.service === 'recipe_hydration'))).toHaveLength(0)
      expect(food.container.querySelector('img')).toBeNull()
      expect(recipes.container.querySelector('img')).toBeNull()
      expect(document.querySelector('[data-floating-action-dock="true"]')).toBeNull()
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('renders Recipes with search, sort, and filter controls instead of Scan Item', async () => {
    render(<DashboardViewPage activePath="recipes" onNavigate={() => undefined} path="recipes" />)

    expect(screen.getByRole('heading', { name: 'Recipes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search recipes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sort' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Scan Item' })).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Open Catalog Recipe 1 recipe details' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Open Catalog Recipe \d+ recipe details/ })).toHaveLength(50)
  })

  it('opens Kitchen vent as the exact vent popup rather than the full climate sheet', async () => {
    render(<DashboardViewPage activePath="kitchen" onNavigate={() => undefined} path="kitchen" />)

    const ventCard = screen.getByRole('button', { name: /Vent Open/i })
    expect(ventCard).toHaveAttribute('data-tone', 'climate')
    expect(ventCard).not.toHaveAttribute('data-size')
    fireEvent.click(ventCard)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Kitchen: Vent' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Kitchen Climate' })).not.toBeInTheDocument()
  })

  it('keeps Back Deck grill controls inside the grill popup', async () => {
    const inactiveView = render(<DashboardViewPage activePath="back-deck" onNavigate={() => undefined} path="back-deck" />)

    expect(screen.getByRole('heading', { name: 'Grill' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Bear Grills Off/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Bear Grills Off')).toHaveAttribute('data-muted', 'true')
    expect(screen.queryByText('Pellet Level')).not.toBeInTheDocument()
    expect(screen.queryByText('Keep Warm')).not.toBeInTheDocument()

    inactiveView.unmount()
    mockEntities['sensor.d8478fa2ad0a_grill_state'].state = 'ignite'
    const activeView = render(<DashboardViewPage activePath="back-deck" onNavigate={() => undefined} path="back-deck" />)

    fireEvent.click(screen.getByRole('button', { name: /Bear Grills Ignite/i }))

    const dialog = await screen.findByRole('dialog')
    expect(screen.getByRole('heading', { name: 'Back Deck: Bear Grills' })).toBeInTheDocument()
    expect(screen.getAllByText('Pellet Level').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Keep Warm').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Super Smoke').length).toBeGreaterThan(0)
    expect(within(dialog).queryByText(/interactive controls available from this view/i)).not.toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep Warm Off' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Super Smoke Off' }))
    expect(mockCallServiceCalls).toEqual([
      { domain: 'homeassistant', service: 'toggle', target: 'switch.d8478fa2ad0a_keep_warm_enabled' },
      { domain: 'homeassistant', service: 'toggle', target: 'switch.d8478fa2ad0a_super_smoke_enabled' },
    ])
    activeView.unmount()
    mockEntities['sensor.d8478fa2ad0a_grill_state'].state = 'off'
  })

  it('matches HASS Office PC icons and subtitles', () => {
    mockEntities['input_boolean.stephen_s_pc_power'].state = 'on'
    mockEntities['input_text.stephen_s_pc_power_state'].state = 'On'
    mockEntities['input_boolean.steph_s_pc_power'].state = 'off'
    mockEntities['input_text.steph_s_pc_power_state'].state = 'Off'
    render(<DashboardViewPage activePath="office" onNavigate={() => undefined} path="office" />)

    expect(screen.getByRole('heading', { name: 'Office PCs' })).toBeInTheDocument()
    const stephenPc = screen.getByRole('button', { name: /Your PC On/i })
    const stephPc = screen.getByRole('button', { name: /Steph's PC Off/i })
    expect(stephenPc).toHaveAttribute('data-tone', 'switch')
    expect(stephenPc).toHaveAttribute('data-muted', 'false')
    expect(stephPc).toHaveAttribute('data-tone', 'switch')
    expect(stephPc).toHaveAttribute('data-muted', 'true')
    expect(stephenPc.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:controller'))
    expect(stephPc.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:controller'))

    fireEvent.click(stephenPc)
    fireEvent.click(stephPc)

    expect(mockCallServiceCalls).toEqual([
      { domain: 'input_button', service: 'press', target: 'input_button.stephen_s_pc_off' },
      { domain: 'input_button', service: 'press', target: 'input_button.steph_s_pc_on' },
    ])
  })

  it('personalizes bedroom sides and Office PCs for Steph and preserves names for unknown users', () => {
    mockState.user = { id: HOUSEHOLD_RESIDENTS.steph.haUserId, name: 'Steph' }
    const bedroom = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    expect(screen.getByRole('button', { name: /Stephen's Side Cooling • -1/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Your Side Off/i })).toBeInTheDocument()

    bedroom.unmount()
    const office = render(<DashboardViewPage activePath="office" onNavigate={() => undefined} path="office" />)
    expect(screen.getByRole('button', { name: /Stephen's PC On/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Your PC Off/i })).toBeInTheDocument()

    office.unmount()
    mockState.user = { id: 'unknown-user', name: 'Unknown' }
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    expect(screen.getByRole('button', { name: /Stephen's Bed Cooling • -1/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Steph's Bed Off/i })).toBeInTheDocument()
  })

  it('ports the Security page visible YAML sections and controls', () => {
    render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    expect(screen.getAllByRole('heading', { name: 'Security' }).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByRole('button', { name: /Security\s*Armed Home/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Security\s*Armed Home/i })).toHaveAttribute('data-icon', 'mdi:shield-home')
    expect(screen.getByRole('button', { name: /Security\s*Armed Home/i })).toHaveAttribute('data-icon-color', 'white')
    expect(screen.getByRole('button', { name: /Contact Sensors\s*All Closed/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Contact Sensors\s*All Closed/i })).toHaveAttribute('data-icon', 'mdi:door')
    expect(screen.getByRole('button', { name: /Security System Armed Home/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Front Door Locked/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Left Door Closed/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cameras' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Front Door camera' })).toBeInTheDocument()
    const securityGrid = screen.getByRole('button', { name: /Security System Armed Home/i }).closest('[data-dynamic-grid="true"]')
    const cameraGrid = screen.getByRole('button', { name: 'Open Front Door camera' }).closest('[data-dynamic-grid="true"]')
    expect(securityGrid).toHaveAttribute('data-dynamic-grid-item-sizing', 'fixed')
    expect(securityGrid).toHaveAttribute('data-dynamic-grid-layout', 'fill')
    expect(securityGrid).toHaveAttribute('data-dynamic-grid-max-cell-width', '280')
    expect(cameraGrid).toHaveAttribute('data-dynamic-grid-item-sizing', 'fixed')
    expect(cameraGrid).toHaveAttribute('data-dynamic-grid-layout', 'fill')
    expect(cameraGrid).toHaveAttribute('data-dynamic-grid-max-cell-width', '280')
    expect(screen.getByRole('button', { name: /Security System Armed Home/i }).closest('[data-responsive-section-item="true"]')).toHaveAttribute('data-span', 'full')
    expect(screen.getByRole('button', { name: 'Open Front Door camera' }).closest('[data-responsive-section-item="true"]')).toHaveAttribute('data-span', 'full')
    expect(screen.queryByRole('heading', { name: 'Mach-E' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Doors Locked/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/not available in the React dashboard yet/i)).not.toBeInTheDocument()
  })

  it('shows Guest Presence Security on the Security page when a guest room is active', async () => {
    mockEntities['input_boolean.guests_staying_in_music_room'].state = 'on'
    render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    expect(screen.getByRole('heading', { name: 'Guest Presence Security' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Security System Armed Home/i }).closest('[data-responsive-section-item="true"]')).toHaveAttribute('data-span', 'full')
    expect(screen.getByRole('button', { name: 'Guest Presence Security' }).closest('[data-responsive-section-item="true"]')).toHaveAttribute('data-span', 'full')
    fireEvent.click(screen.getByRole('button', { name: 'Guest Presence Security' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Guest Presence Security' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /Music Room On/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /Left Door Closed/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /Front Door Locked/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /Music Room Enabled/i })).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: /Music Room Enabled/i }))

    expect(mockCallServiceCalls.at(-1)).toEqual({
      domain: 'automation',
      service: 'turn_off',
      target: 'automation.automatically_vacuum_or_mop_music_room',
    })
  })

  it('does not open the Security modal for a Home-only URL hash', () => {
    window.history.replaceState(null, '', `${window.location.pathname}#lights-overview`)
    render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getAllByRole('heading', { name: 'Security' }).length).toBeGreaterThanOrEqual(1)
  })

  it('preloads Security modal content without opening the live URL hash modal', () => {
    window.history.replaceState(null, '', `${window.location.pathname}#lights-overview`)
    const { container } = render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" preload preloadHashes={['#security-system']} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(container.querySelector('[data-preload-modal="security#security-system"]')).toBeInTheDocument()
  })

  it('keeps Security header chips outside the page scroller', () => {
    render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    const page = screen.getByRole('main')
    const securityChip = screen.getByRole('button', { name: /Security\s*Armed Home/i })
    const [, scroller] = Array.from(page.children)

    expect(page.firstElementChild).toContainElement(securityChip)
    expect(scroller).not.toContainElement(securityChip)
  })

  it('uses the live contact summary entity for open-state icon and tone', () => {
    mockEntities['binary_sensor.contact_sensors'].state = 'on'
    mockEntities['binary_sensor.front_door_contact_sensor_contact'].state = 'on'
    render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    const contactChip = screen.getByRole('button', { name: /Contact Sensors\s*1 Open/i })
    expect(contactChip).toHaveAttribute('data-icon', 'mdi:door-open')
    expect(contactChip).toHaveAttribute('data-muted', 'false')
  })

  it('reflects alarm state in the Security header chip', () => {
    mockEntities['alarm_control_panel.aqara_hub_m3_0056_security_system_2'].state = 'disarmed'
    const disarmedView = render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    expect(screen.getByRole('button', { name: /Security\s*Disarmed/i })).toHaveAttribute('data-icon', 'mdi:shield-off')
    expect(screen.getByRole('button', { name: /Security\s*Disarmed/i })).toHaveAttribute('data-icon-color', 'white')
    disarmedView.unmount()

    mockEntities['alarm_control_panel.aqara_hub_m3_0056_security_system_2'].state = 'armed_away'
    const awayView = render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    expect(screen.getByRole('button', { name: /Security\s*Armed Away/i })).toHaveAttribute('data-icon', 'mdi:shield')
    expect(screen.getByRole('button', { name: /Security\s*Armed Away/i })).toHaveAttribute('data-icon-color', 'white')
    awayView.unmount()

    mockEntities['alarm_control_panel.aqara_hub_m3_0056_security_system_2'].state = 'armed_night'
    render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    expect(screen.getByRole('button', { name: /Security\s*Armed Night/i })).toHaveAttribute('data-icon', 'mdi:shield-moon')
    expect(screen.getByRole('button', { name: /Security\s*Armed Night/i })).toHaveAttribute('data-icon-color', 'white')
  })

  it('matches HASS Security garage door colors for closed, open, and closing states', () => {
    const closedView = render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    expect(screen.getByRole('button', { name: /Left Door Closed/i })).toHaveAttribute('data-tone', 'contact')
    expect(screen.getByRole('button', { name: /Left Door Closed/i })).toHaveAttribute('data-muted', 'false')
    expect(screen.getByRole('button', { name: /Right Door Closed/i })).toHaveAttribute('data-tone', 'contact')
    expect(screen.getByRole('button', { name: /Right Door Closed/i })).toHaveAttribute('data-muted', 'false')
    closedView.unmount()

    mockEntities['cover.garage_left_door'].state = 'open'
    mockEntities['cover.garage_right_door'].state = 'open'
    const openView = render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    expect(screen.getByRole('button', { name: /Left Door Open/i })).toHaveAttribute('data-tone', 'danger')
    expect(screen.getByRole('button', { name: /Left Door Open/i })).toHaveAttribute('data-muted', 'false')
    expect(screen.getByRole('button', { name: /Right Door Open/i })).toHaveAttribute('data-tone', 'danger')
    expect(screen.getByRole('button', { name: /Right Door Open/i })).toHaveAttribute('data-muted', 'false')
    openView.unmount()

    mockEntities['cover.garage_left_door'].state = 'closing'
    mockEntities['cover.garage_right_door'].state = 'closing'
    render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    expect(screen.getByRole('button', { name: /Left Door Closing/i })).toHaveAttribute('data-tone', 'security')
    expect(screen.getByRole('button', { name: /Left Door Closing/i })).toHaveAttribute('data-muted', 'false')
    expect(screen.getByRole('button', { name: /Right Door Closing/i })).toHaveAttribute('data-tone', 'security')
    expect(screen.getByRole('button', { name: /Right Door Closing/i })).toHaveAttribute('data-muted', 'false')
  })

  it('opens Security System as a modal and only calls alarm services from explicit mode buttons', async () => {
    render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    fireEvent.click(screen.getByRole('button', { name: /Security System Armed Home/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Security System' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Set security system to Away' })).toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: 'Set security system to Away' }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'alarm_control_panel', service: 'alarm_arm_away', target: 'alarm_control_panel.aqara_hub_m3_0056_security_system_2' },
    ])
  })

  it('runs explicit lock and garage door services from live state', () => {
    render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    fireEvent.click(screen.getByRole('button', { name: /Front Door Locked/i }))
    fireEvent.click(screen.getByRole('button', { name: /Left Door Closed/i }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'lock', service: 'unlock', target: 'lock.aqara_smart_lock_u400' },
      { domain: 'cover', service: 'open_cover', target: 'cover.garage_left_door' },
    ])
  })

  it('locks the Front Door when the U400 lock is already unlocked', () => {
    mockEntities['lock.aqara_smart_lock_u400'].state = 'unlocked'
    render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    fireEvent.click(screen.getByRole('button', { name: /Front Door Unlocked/i }))

    expect(mockCallServiceCalls).toEqual([{ domain: 'lock', service: 'lock', target: 'lock.aqara_smart_lock_u400' }])
  })

  it('opens the Security contact sensor overview with the same room flow as Home', async () => {
    render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    fireEvent.click(screen.getByRole('button', { name: /Contact Sensors\s*All Closed/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Contact Sensors' })).toBeInTheDocument()
    expect(within(dialog).getByText('Rooms')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Open Entryway Contact Sensors' })).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('PC Window Closed')).not.toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Open Office Contact Sensors' }))

    expect(within(dialog).getByRole('heading', { name: 'Office Contact Sensors' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('PC Window Closed')).toHaveClass(/sourceRow/)
    expect(within(dialog).getByLabelText('PC Window Closed')).not.toHaveClass(/bubble/)
  })

  it('opens Security camera popups with WebRTC actions and recording script payloads', async () => {
    const firedEvents: string[] = []
    window.addEventListener('webrtc-screenshot', () => firedEvents.push('webrtc-screenshot'), { once: true })
    window.addEventListener('webrtc-toggle-mute', () => firedEvents.push('webrtc-toggle-mute'), { once: true })
    render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    fireEvent.click(screen.getByRole('button', { name: 'Open Front Door camera' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Front Door Camera' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Snapshot' }))
    fireEvent.click(screen.getByRole('button', { name: 'Muted' }))
    fireEvent.click(screen.getByRole('button', { name: 'Record' }))

    expect(firedEvents).toEqual(['webrtc-screenshot', 'webrtc-toggle-mute'])
    expect(mockCallServiceCalls).toEqual([{ domain: 'script', service: 'turn_on', target: 'script.front_door_manual_recording' }])
  })

  it('has YAML-derived scaffolds for every room route', () => {
    expect(ROOM_PAGE_ORDER).toHaveLength(16)
    for (const path of ROOM_PAGE_ORDER) {
      const room = ROOM_PAGE_CONFIGS[path]
      expect(room.overviewCards.length).toBeGreaterThan(0)
      expect(room.popupTemplates.length).toBeGreaterThan(0)
    }
  })

  it('keeps room overview chips on the shared icon standard', () => {
    const expectedIconFor = (title: string, kind: string) => {
      if (kind === 'light') return title === 'Lights' ? 'mdi:lightbulb-group' : 'mdi:lightbulb'
      if (kind === 'climate') return 'mdi:thermometer'
      if (kind === 'occupancy') return 'mdi:motion-sensor'
      if (kind === 'contact') return title.toLowerCase().includes('window') ? 'mdi:window-closed' : 'mdi:door'
      if (kind === 'air') return 'mdi:air-purifier'
      return undefined
    }
    const mismatches = ROOM_PAGE_ORDER.flatMap((path) =>
      ROOM_PAGE_CONFIGS[path].overviewCards.flatMap((card) => {
        const expectedIcon = expectedIconFor(card.title, card.kind)
        return expectedIcon && card.icon !== expectedIcon ? [`${path} ${card.title}: ${card.icon} should be ${expectedIcon}`] : []
      }),
    )

    expect(mismatches).toEqual([])
    expect(ROOM_PAGE_CONFIGS.garage.overviewCards.map((card) => card.title)).toEqual(['Doors'])
  })

  it('renders todo list panels through the mock HASS websocket', async () => {
    render(<DashboardViewPage activePath="groceries" onNavigate={() => undefined} path="groceries" />)

    expect(screen.getByRole('heading', { name: 'Groceries' })).toBeInTheDocument()
    expect(await screen.findByText('Mock task one')).toBeInTheDocument()
    expect(Array.from(screen.getByRole('main').children)[1]).not.toHaveAttribute('data-scroll-lock')
  })

  it('renders the Home grocery list route with the shared Chores grocery todo page', async () => {
    render(<DashboardViewPage activePath="grocery-list" onNavigate={() => undefined} path="grocery-list" />)

    expect(screen.getByRole('heading', { name: 'Groceries' })).toBeInTheDocument()
    expect(await screen.findByLabelText('Grocery List todo list')).toBeInTheDocument()
    expect(await screen.findByText('Mock task one')).toBeInTheDocument()
  })

  it('renders Pantry, Fridge, and Freezer inventory rows alphabetically with expiration subtitles', async () => {
    const almondFlourLabel = testExpiryLabel(-10)
    const cannedBeansLabel = 'Quantity 5 · Multiple Expiration Dates'
    const zitiLabel = testExpiryLabel(40)
    const greekYogurtLabel = testExpiryLabel(5, 2)
    const milkLabel = testExpiryLabel(-400)
    const salsaLabel = testExpiryLabel(370)
    const frozenPeasLabel = testExpiryLabel(20)
    const wafflesLabel = testExpiryLabel(190)
    const cuminLabel = testExpiryLabel(400)
    const paprikaLabel = testExpiryLabel(4)
    const paperPlatesLabel = testExpiryLabel(80)
    const teaBagsLabel = testExpiryLabel(6)
    const allFoodView = render(<DashboardViewPage activePath="all-food" onNavigate={() => undefined} path="all-food" />)

    expect(screen.getByRole('heading', { name: 'All Food' })).toBeInTheDocument()
    const allFoodList = await screen.findByLabelText('All Food inventory list')
    await waitFor(() => expect(within(allFoodList).getAllByRole('group', { name: /Expires|Expired|No expiration date|Multiple Expiration Dates/i })).toHaveLength(12))
    expect(mockCallServiceCalls).toContainEqual({
      domain: 'evershelf',
      returnResponse: true,
      service: 'list_inventory',
      serviceData: {},
    })

    allFoodView.unmount()
    mockCallServiceCalls.length = 0
    const pantryView = render(<DashboardViewPage activePath="pantry" onNavigate={() => undefined} path="pantry" />)

    expect(screen.getByRole('heading', { name: 'Pantry' })).toBeInTheDocument()
    const pantryList = await screen.findByLabelText('Pantry inventory list')
    await waitFor(() => expect(within(pantryList).getAllByRole('group', { name: /Expires|Expired|No expiration date|Multiple Expiration Dates/i })).toHaveLength(3))
    expect(screen.getByRole('button', { name: 'Sort' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument()
    expect(within(pantryList).getAllByRole('group', { name: /Expires|Expired|No expiration date|Multiple Expiration Dates/i }).map((row) => row.getAttribute('aria-label'))).toEqual([
      `Almond Flour ${almondFlourLabel}`,
      `Canned Beans ${cannedBeansLabel}`,
      `Ziti ${zitiLabel}`,
    ])
    expect(within(pantryList).getByRole('group', { name: `Almond Flour ${almondFlourLabel}` })).toHaveAttribute('data-expiry-tone', 'expired')
    const almondFlourRow = within(pantryList).getByRole('group', { name: `Almond Flour ${almondFlourLabel}` })
    const editAlmondFlourButton = within(almondFlourRow).getByRole('button', { name: 'Edit Almond Flour' })
    expect(editAlmondFlourButton).toBeEnabled()
    fireEvent.click(editAlmondFlourButton)
    expect(await screen.findByRole('dialog', { name: /Almond Flour/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Expiration date for Almond Flour')).toHaveAttribute('type', 'date')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Almond Flour/i })).not.toBeInTheDocument())
    const cannedBeansRow = within(pantryList).getByRole('group', { name: `Canned Beans ${cannedBeansLabel}` })
    expect(cannedBeansRow).toHaveAttribute('data-expiry-tone', 'soon')
    expect(within(cannedBeansRow).getByText(cannedBeansLabel)).toBeInTheDocument()
    expect(cannedBeansRow.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:cart-plus'))
    expect(cannedBeansRow.querySelector(`path[d="${materialIconPath('mdi:checkbox-blank-outline')}"]`)).toBeNull()
    let resolveAddToShopping: () => void = () => undefined
    const addToShoppingPromise = new Promise<void>((resolve) => {
      resolveAddToShopping = resolve
    })
    const originalCallService = mockState.helpers.callService
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('2')
    mockState.helpers.callService = (params) => {
      if (params.domain === 'evershelf' && params.service === 'add_to_shopping') {
        mockCallServiceCalls.push(params)
        return addToShoppingPromise
      }
      return originalCallService(params)
    }
    vi.useFakeTimers()
    try {
      const addCannedBeansButton = within(cannedBeansRow).getByRole('button', { name: 'Add Canned Beans to shopping list' })
      expect(addCannedBeansButton).toBeEnabled()
      fireEvent.click(addCannedBeansButton)
      expect(within(cannedBeansRow).getByRole('button', { name: 'Adding Canned Beans to shopping list' })).toHaveAttribute('aria-busy', 'true')
      expect(within(cannedBeansRow).getByRole('button', { name: 'Adding Canned Beans to shopping list' })).toHaveAttribute('data-shopping-state', 'adding')
      expect(mockCallServiceCalls).toContainEqual({
        domain: 'evershelf',
        service: 'add_to_shopping',
        serviceData: { name: 'Canned Beans', quantity: 2 },
      })
      expect(mockCallServiceCalls).toContainEqual({
        domain: 'todo',
        service: 'add_item',
        target: 'todo.shopping_list',
        serviceData: { item: 'Canned Beans' },
      })
      await act(async () => {
        resolveAddToShopping()
        await addToShoppingPromise
        await Promise.resolve()
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(within(cannedBeansRow).getByRole('button', { name: 'Added Canned Beans to shopping list' })).toBeDisabled()
      expect(within(cannedBeansRow).getByRole('button', { name: 'Added Canned Beans to shopping list' }).querySelector(`path[d="${materialIconPath('mdi:check')}"]`)).toBeInTheDocument()
      expect(within(cannedBeansRow).getByRole('button', { name: 'Added Canned Beans to shopping list' })).toHaveAttribute('data-shopping-state', 'added')
      act(() => {
        vi.advanceTimersByTime(3000)
      })
      expect(within(cannedBeansRow).getByRole('button', { name: 'Add Canned Beans to shopping list' })).toBeEnabled()
      expect(within(cannedBeansRow).getByRole('button', { name: 'Add Canned Beans to shopping list' })).toHaveAttribute('data-shopping-state', 'idle')
      const callCountAfterValidQuantity = mockCallServiceCalls.length
      promptSpy.mockReturnValue('0')
      fireEvent.click(within(cannedBeansRow).getByRole('button', { name: 'Add Canned Beans to shopping list' }))
      expect(mockCallServiceCalls).toHaveLength(callCountAfterValidQuantity)
      expect(within(cannedBeansRow).getByRole('button', { name: 'Add Canned Beans to shopping list' })).toHaveAttribute('data-shopping-state', 'idle')
    } finally {
      promptSpy.mockRestore()
      vi.useRealTimers()
      mockState.helpers.callService = originalCallService
    }
    expect(within(cannedBeansRow).queryByRole('button', { name: 'Delete Canned Beans' })).not.toBeInTheDocument()
    const editCannedBeansButton = within(cannedBeansRow).getByRole('button', { name: 'Edit Canned Beans' })
    expect(editCannedBeansButton).toHaveAttribute('data-modal-disclosure-button', 'true')
    expect(editCannedBeansButton.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:chevron-right'))
    fireEvent.click(editCannedBeansButton)
    expect(await screen.findByRole('dialog', { name: /Canned Beans/i })).toBeInTheDocument()
    expect(screen.queryByText('Individual pantry items')).not.toBeInTheDocument()
    const cannedBeansBatch = `expiring ${testDisplayDateValue(testAddDays(testTodayDate(), 3))}`
    const cannedBeansLaterBatch = `expiring ${testDisplayDateValue(testAddDays(testTodayDate(), 200))}`
    expect(screen.getByRole('spinbutton', { name: `Quantity for Canned Beans ${cannedBeansLaterBatch}` })).toHaveTextContent('3')
    const expirationInput = screen.getByLabelText(`Expiration date for Canned Beans ${cannedBeansBatch}`)
    expect(expirationInput).toHaveAttribute('type', 'date')
    expect(screen.getByRole('spinbutton', { name: `Quantity for Canned Beans ${cannedBeansBatch}` })).toHaveTextContent('2')
    expect(screen.queryByRole('button', { name: `Save Canned Beans ${cannedBeansBatch}` })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Delete Canned Beans ${cannedBeansBatch}` })).toHaveClass(/deleteAction/)

    const callCountBeforeDeniedDelete = mockCallServiceCalls.length
    const batchDeleteConfirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const batchDeletePrompt = vi.spyOn(window, 'prompt').mockReturnValue(null)
    fireEvent.click(screen.getByRole('button', { name: `Delete Canned Beans ${cannedBeansBatch}` }))
    expect(batchDeletePrompt).toHaveBeenCalledWith(
      `Choose how many Canned Beans ${cannedBeansBatch} to delete from the pantry. Enter a number from 1 to 2.`,
      '1',
    )
    expect(batchDeleteConfirm).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(mockCallServiceCalls).toHaveLength(callCountBeforeDeniedDelete)
    batchDeleteConfirm.mockRestore()
    batchDeletePrompt.mockRestore()

    fireEvent.change(expirationInput, { target: { value: '2026-09-30' } })
    expect(screen.getByRole('button', { name: `Save Canned Beans ${cannedBeansBatch}` })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: `Save Canned Beans ${cannedBeansBatch}` }))
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(mockCallServiceCalls).toContainEqual({
      domain: 'evershelf',
      service: 'update_inventory_item',
      serviceData: { expiry_date: '2026-09-30', inventory_id: 102 },
    })
    expect(mockCallServiceCalls).toContainEqual({
      domain: 'evershelf',
      service: 'update_inventory_item',
      serviceData: { expiry_date: '2026-09-30', inventory_id: 106 },
    })
    expect(mockCallServiceCalls).toContainEqual({
      domain: 'evershelf',
      returnResponse: true,
      service: 'list_inventory',
      serviceData: { location: 'dispensa' },
    })

    pantryView.unmount()
    mockCallServiceCalls.length = 0
    const fridgeView = render(<DashboardViewPage activePath="fridge" onNavigate={() => undefined} path="fridge" />)

    expect(screen.getByRole('heading', { name: 'Fridge' })).toBeInTheDocument()
    const fridgeList = await screen.findByLabelText('Fridge inventory list')
    await waitFor(() => expect(within(fridgeList).getAllByRole('group', { name: /Expires|Expired|No expiration date|Multiple Expiration Dates/i })).toHaveLength(3))
    expect(within(fridgeList).getAllByRole('group', { name: /Expires|Expired|No expiration date|Multiple Expiration Dates/i }).map((row) => row.getAttribute('aria-label'))).toEqual([
      `Greek Yogurt ${greekYogurtLabel}`,
      `Milk ${milkLabel}`,
      `Salsa ${salsaLabel}`,
    ])
    const greekYogurtRow = within(fridgeList).getByRole('group', { name: `Greek Yogurt ${greekYogurtLabel}` })
    expect(greekYogurtRow).toHaveAttribute('data-expiry-tone', 'soon')
    expect(within(fridgeList).getByRole('group', { name: `Milk ${milkLabel}` })).toHaveAttribute('data-expiry-tone', 'expired')
    expect(mockCallServiceCalls).toContainEqual({
      domain: 'evershelf',
      returnResponse: true,
      service: 'list_inventory',
      serviceData: { location: 'frigo' },
    })
    mockCallServiceCalls.length = 0
    const rowDeleteConfirmCancelled = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const rowDeletePromptCancelled = vi.spyOn(window, 'prompt').mockReturnValue(null)
    const callCountBeforeCancelledRowDelete = mockCallServiceCalls.length
    fireEvent.click(within(greekYogurtRow).getByRole('button', { name: 'Delete Greek Yogurt' }))
    expect(rowDeletePromptCancelled).toHaveBeenCalledWith(
      'Choose how many Greek Yogurt to delete from the fridge. Enter a number from 1 to 2.',
      '1',
    )
    expect(rowDeleteConfirmCancelled).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(mockCallServiceCalls).toHaveLength(callCountBeforeCancelledRowDelete)
    rowDeleteConfirmCancelled.mockRestore()
    rowDeletePromptCancelled.mockRestore()

    const rowDeleteConfirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const rowDeletePrompt = vi.spyOn(window, 'prompt').mockReturnValue('1')
    fireEvent.click(within(greekYogurtRow).getByRole('button', { name: 'Delete Greek Yogurt' }))
    expect(rowDeletePrompt).toHaveBeenCalledWith(
      'Choose how many Greek Yogurt to delete from the fridge. Enter a number from 1 to 2.',
      '1',
    )
    expect(rowDeleteConfirm).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    await waitFor(() => expect(mockCallServiceCalls).toContainEqual({
      domain: 'evershelf',
      service: 'delete_inventory',
      serviceData: { inventory_id: 203, quantity: 1 },
    }))
    await waitFor(() => expect(within(fridgeList).getByRole('group', { name: `Greek Yogurt ${testExpiryLabel(5)}` })).toBeInTheDocument())
    rowDeleteConfirm.mockRestore()
    rowDeletePrompt.mockRestore()

    mockCallServiceCalls.length = 0
    fridgeView.unmount()
    render(<DashboardViewPage activePath="freezer" onNavigate={() => undefined} path="freezer" />)

    expect(screen.getByRole('heading', { name: 'Freezer' })).toBeInTheDocument()
    const freezerList = await screen.findByLabelText('Freezer inventory list')
    await waitFor(() => expect(within(freezerList).getAllByRole('group', { name: /Expires|Expired|No expiration date|Multiple Expiration Dates/i })).toHaveLength(2))
    expect(within(freezerList).getAllByRole('group', { name: /Expires|Expired|No expiration date|Multiple Expiration Dates/i }).map((row) => row.getAttribute('aria-label'))).toEqual([
      `Frozen Peas ${frozenPeasLabel}`,
      `Waffles ${wafflesLabel}`,
    ])
    expect(mockCallServiceCalls).toContainEqual({
      domain: 'evershelf',
      returnResponse: true,
      service: 'list_inventory',
      serviceData: { location: 'freezer' },
    })

    mockCallServiceCalls.length = 0
    render(<DashboardViewPage activePath="spice-rack" onNavigate={() => undefined} path="spice-rack" />)

    expect(screen.getByRole('heading', { name: 'Spice Rack' })).toBeInTheDocument()
    const spiceRackList = await screen.findByLabelText('Spice Rack inventory list')
    await waitFor(() => expect(within(spiceRackList).getAllByRole('group', { name: /Expires|Expired|No expiration date|Multiple Expiration Dates/i })).toHaveLength(2))
    expect(within(spiceRackList).getAllByRole('group', { name: /Expires|Expired|No expiration date|Multiple Expiration Dates/i }).map((row) => row.getAttribute('aria-label'))).toEqual([
      `Cumin ${cuminLabel}`,
      `Paprika ${paprikaLabel}`,
    ])
    expect(mockCallServiceCalls).toContainEqual({
      domain: 'evershelf',
      returnResponse: true,
      service: 'list_inventory',
      serviceData: { location: 'spice_rack' },
    })

    mockCallServiceCalls.length = 0
    render(<DashboardViewPage activePath="cabinet" onNavigate={() => undefined} path="cabinet" />)

    expect(screen.getByRole('heading', { name: 'Cabinet' })).toBeInTheDocument()
    const cabinetList = await screen.findByLabelText('Cabinet inventory list')
    await waitFor(() => expect(within(cabinetList).getAllByRole('group', { name: /Expires|Expired|No expiration date|Multiple Expiration Dates/i })).toHaveLength(2))
    expect(within(cabinetList).getAllByRole('group', { name: /Expires|Expired|No expiration date|Multiple Expiration Dates/i }).map((row) => row.getAttribute('aria-label'))).toEqual([
      `Paper Plates ${paperPlatesLabel}`,
      `Tea Bags ${teaBagsLabel}`,
    ])
    expect(mockCallServiceCalls).toContainEqual({
      domain: 'evershelf',
      returnResponse: true,
      service: 'list_inventory',
      serviceData: { location: 'cabinet' },
    })
  })

  it('shows a centered inventory spinner and hides inventory FABs until loading completes', async () => {
    let resolveInventory: (value: unknown) => void = () => undefined
    const inventoryPromise = new Promise((resolve) => {
      resolveInventory = resolve
    })
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => {
      if (params.domain === 'evershelf' && params.service === 'list_inventory') return inventoryPromise
      return originalCallService(params)
    }

    try {
      render(<DashboardViewPage activePath="pantry" onNavigate={() => undefined} path="pantry" />)

      const status = await screen.findByRole('status', { name: 'Loading Pantry' })
      expect(status).toHaveAttribute('data-state', 'loading')
      expect(status).toHaveClass(/inventoryLoading/)
      expect(screen.queryByRole('button', { name: 'Search inventory' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Sort' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Filter' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Scan Item' })).not.toBeInTheDocument()

      await act(async () => {
        resolveInventory({
          response: {
            inventory: [{ expiry_date: testDateInputValue(testAddDays(testTodayDate(), 2)), id: 901, location: 'dispensa', name: 'Loading Apples' }],
          },
        })
      })

      expect(await screen.findByRole('status', { name: 'Loading Pantry' })).toHaveAttribute('data-state', 'exiting')
      expect(screen.queryByRole('button', { name: 'Scan Item' })).not.toBeInTheDocument()

      const pantryList = await screen.findByLabelText('Pantry inventory list')
      await waitFor(() => expect(within(pantryList).getByRole('group', { name: /Loading Apples Expires/i })).toBeInTheDocument())
      expect(screen.getByRole('button', { name: 'Search inventory' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Sort' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Scan Item' })).toBeInTheDocument()
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('sorts and filters inventory from the floating action modals', async () => {
    const greekYogurtLabel = testExpiryLabel(5, 2)
    const milkLabel = testExpiryLabel(-400)
    const salsaLabel = testExpiryLabel(370)
    render(<DashboardViewPage activePath="fridge" onNavigate={() => undefined} path="fridge" />)

    const fridgeList = await screen.findByLabelText('Fridge inventory list')
    await waitFor(() => expect(within(fridgeList).getAllByRole('group', { name: /Expires|Expired|No expiration date|Multiple Expiration Dates/i })).toHaveLength(3))
    expect(within(fridgeList).getAllByRole('group', { name: /Expires|Expired|No expiration date|Multiple Expiration Dates/i }).map((row) => row.getAttribute('aria-label'))).toEqual([
      `Greek Yogurt ${greekYogurtLabel}`,
      `Milk ${milkLabel}`,
      `Salsa ${salsaLabel}`,
    ])
    const floatingDock = document.querySelector('[data-floating-action-dock="true"]')
    expect(screen.queryByRole('button', { name: 'Rooms' })).not.toBeInTheDocument()
    expect(floatingDock).toContainElement(screen.getByRole('button', { name: 'Search inventory' }))
    expect(floatingDock).toContainElement(screen.getByRole('button', { name: 'Scan Item' }))
    expect(floatingDock).toContainElement(screen.getByRole('button', { name: 'Sort' }))
    expect(floatingDock).toContainElement(screen.getByRole('button', { name: 'Filter' }))
    expect(within(floatingDock as HTMLElement).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual(['Search inventory', 'Sort', 'Filter', 'Scan Item', 'Open Chat and Quick Links'])
    expect(within(floatingDock as HTMLElement).getAllByRole('button').map((button) => button.textContent?.trim())).toEqual(['Search', '', '', '', ''])
    expect(screen.queryByLabelText('Fridge inventory controls')).not.toBeInTheDocument()

    const sortButton = screen.getByRole('button', { name: 'Sort' })
    const filterButton = screen.getByRole('button', { name: 'Filter' })
    expect(sortButton).toHaveTextContent('')
    expect(sortButton).toHaveStyle({ '--card-rgb': '42 126 180' })
    expect(filterButton).toHaveTextContent('')
    expect(filterButton).toHaveStyle({ '--card-rgb': '42 126 180' })

    fireEvent.click(sortButton)
    expect(await screen.findByRole('heading', { name: 'Sort Inventory' })).toBeInTheDocument()
    expect(screen.getByText('Ascending (A-Z, soonest first)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ascending' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Descending' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Reset' })).toHaveClass(/resetAction/)
    fireEvent.click(screen.getByRole('radio', { name: /Expiration Date/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Sort Inventory' })).not.toBeInTheDocument())
    expect(sortButton).toHaveStyle({ '--card-rgb': '155 110 64' })
    expect(within(fridgeList).getAllByRole('group', { name: /Expires|Expired|No expiration date|Multiple Expiration Dates/i }).map((row) => row.getAttribute('aria-label'))).toEqual([
      `Milk ${milkLabel}`,
      `Greek Yogurt ${greekYogurtLabel}`,
      `Salsa ${salsaLabel}`,
    ])

    fireEvent.click(sortButton)
    expect(await screen.findByRole('heading', { name: 'Sort Inventory' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Descending' }))
    expect(screen.getByText('Descending (Z-A, latest first)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Descending' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Sort Inventory' })).not.toBeInTheDocument())
    expect(within(fridgeList).getAllByRole('group', { name: /Expires|Expired|No expiration date|Multiple Expiration Dates/i }).map((row) => row.getAttribute('aria-label'))).toEqual([
      `Salsa ${salsaLabel}`,
      `Greek Yogurt ${greekYogurtLabel}`,
      `Milk ${milkLabel}`,
    ])

    fireEvent.click(filterButton)
    expect(await screen.findByRole('heading', { name: 'Filter Inventory' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset' })).toHaveClass(/resetAction/)
    fireEvent.click(screen.getByRole('radio', { name: /Expiring Within a Week/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Filter Inventory' })).not.toBeInTheDocument())
    expect(filterButton).toHaveStyle({ '--card-rgb': '155 110 64' })
    expect(within(fridgeList).getAllByRole('group', { name: /Expires|Expired|No expiration date|Multiple Expiration Dates/i }).map((row) => row.getAttribute('aria-label'))).toEqual([
      `Greek Yogurt ${greekYogurtLabel}`,
    ])
  })

  it('shows a centred empty state when a filter hides every inventory item', async () => {
    render(<DashboardViewPage activePath="fridge" onNavigate={() => undefined} path="fridge" />)

    const fridgeList = await screen.findByLabelText('Fridge inventory list')
    await waitFor(() => expect(within(fridgeList).getAllByRole('group', { name: /Expires|Expired|No expiration date|Multiple Expiration Dates/i })).toHaveLength(3))

    fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
    expect(await screen.findByRole('heading', { name: 'Filter Inventory' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: /No Expiration Date/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Filter Inventory' })).not.toBeInTheDocument())

    const heading = await screen.findByRole('heading', { name: 'No Matching Items' })
    expect(heading.parentElement).toHaveAttribute('data-empty-layout', 'centered')
    expect(screen.getByText('Try a different filter, or clear it to show all items.')).toBeInTheDocument()
    expect(within(fridgeList).queryAllByRole('group', { name: /Expires|Expired|No expiration date|Multiple Expiration Dates/i })).toHaveLength(0)
  })

  it('searches inventory from the floating action dock with Festival-style debounce, clear, and collapse behavior', async () => {
    const greekYogurtLabel = testExpiryLabel(5, 2)
    const milkLabel = testExpiryLabel(-400)
    const salsaLabel = testExpiryLabel(370)
    render(<DashboardViewPage activePath="fridge" onNavigate={() => undefined} path="fridge" />)

    const fridgeList = await screen.findByLabelText('Fridge inventory list')
    await waitFor(() => expect(within(fridgeList).getAllByRole('group', { name: /Expires|Expired|No expiration date|Multiple Expiration Dates/i })).toHaveLength(3))
    const floatingDock = document.querySelector('[data-floating-action-dock="true"]') as HTMLElement
    const searchButton = within(floatingDock).getByRole('button', { name: 'Search inventory' })

    fireEvent.click(searchButton)

    const searchInput = await screen.findByLabelText('Search inventory')
    await waitFor(() => expect(searchInput).toHaveFocus())
    const collapsedSort = within(floatingDock).getByRole('button', { name: 'Sort', hidden: true }).closest('span')
    const collapsedFilter = within(floatingDock).getByRole('button', { name: 'Filter', hidden: true }).closest('span')
    expect(collapsedSort).toHaveAttribute('data-collapsed', 'true')
    expect(collapsedSort).toHaveAttribute('inert')
    expect(collapsedFilter).toHaveAttribute('data-collapsed', 'true')
    expect(collapsedFilter).toHaveAttribute('aria-hidden', 'true')

    fireEvent.change(searchInput, { target: { value: 'milk' } })

    expect(searchInput).toHaveValue('milk')
    expect(screen.getByRole('button', { name: 'Clear Search' })).toBeInTheDocument()
    expect(within(fridgeList).getAllByRole('group', { name: /Expires|Expired|No expiration date|Multiple Expiration Dates/i })).toHaveLength(3)

    await waitFor(
      () => expect(within(fridgeList).getAllByRole('group', { name: /Expires|Expired|No expiration date|Multiple Expiration Dates/i }).map((row) => row.getAttribute('aria-label'))).toEqual([
        `Milk ${milkLabel}`,
      ]),
      { timeout: INVENTORY_SEARCH_DEBOUNCE_MS + 500 },
    )

    fireEvent.change(searchInput, { target: { value: 'dragonfruit' } })

    await waitFor(
      () => expect(screen.getByRole('heading', { name: 'No Matching Items' })).toBeInTheDocument(),
      { timeout: INVENTORY_SEARCH_DEBOUNCE_MS + 500 },
    )
    expect(screen.getByText('Try a different search or clear the search to show all items.')).toBeInTheDocument()

    fireEvent.blur(searchInput)

    const collapsedSearchButton = await screen.findByRole('button', { name: 'Search inventory' })
    expect(collapsedSearchButton).toHaveTextContent('dragonfruit')
    expect(screen.getByRole('button', { name: 'Sort' }).closest('span')).not.toHaveAttribute('data-collapsed')
    expect(screen.getByRole('button', { name: 'Filter' }).closest('span')).not.toHaveAttribute('data-collapsed')

    fireEvent.click(collapsedSearchButton)
    const reopenedInput = await screen.findByLabelText('Search inventory')
    expect(reopenedInput).toHaveValue('dragonfruit')
    fireEvent.click(screen.getByRole('button', { name: 'Clear Search' }))

    await waitFor(() => expect(screen.getByLabelText('Search inventory')).toHaveValue(''))
    expect(screen.getByLabelText('Search inventory')).toHaveFocus()
    await waitFor(
      () => expect(within(fridgeList).getAllByRole('group', { name: /Expires|Expired|No expiration date|Multiple Expiration Dates/i }).map((row) => row.getAttribute('aria-label'))).toEqual([
        `Greek Yogurt ${greekYogurtLabel}`,
        `Milk ${milkLabel}`,
        `Salsa ${salsaLabel}`,
      ]),
      { timeout: INVENTORY_SEARCH_DEBOUNCE_MS + 500 },
    )
  })

  it('renders an inventory empty state when an inventory location has no items', async () => {
    mockCallServiceCalls.length = 0
    const listInventory = vi.fn(() => Promise.resolve({ response: { inventory: [] } }))
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => {
      if (params.domain === 'evershelf' && params.service === 'list_inventory') return listInventory(params)
      return originalCallService(params)
    }

    try {
      render(<DashboardViewPage activePath="pantry" onNavigate={() => undefined} path="pantry" />)

      expect(await screen.findByRole('heading', { name: 'No Items Found' })).toBeInTheDocument()
      expect(screen.getByText('Scan an item to add it to your pantry.')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'No Items Found' }).closest('[data-empty-layout]')).toHaveAttribute('data-empty-layout', 'centered')
      expect(screen.queryByRole('button', { name: 'Search inventory' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Sort' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Filter' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Scan Item' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Scan Item' })).toHaveTextContent('Scan Item')
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('renders an inventory error as an empty state when inventory cannot load', async () => {
    mockCallServiceCalls.length = 0
    const originalCallService = mockState.helpers.callService
    mockState.helpers.callService = (params) => {
      if (params.domain === 'evershelf' && params.service === 'list_inventory') return Promise.reject(new Error('EverShelf is unavailable'))
      return originalCallService(params)
    }

    try {
      render(<DashboardViewPage activePath="freezer" onNavigate={() => undefined} path="freezer" />)

      expect(await screen.findByRole('heading', { name: 'Unable to Load Freezer' })).toBeInTheDocument()
      expect(screen.getByText('Freezer is unavailable')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Unable to Load Freezer' }).closest('[data-empty-layout]')).toHaveAttribute('data-empty-layout', 'centered')
      expect(screen.queryByRole('button', { name: 'Search inventory' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Sort' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Filter' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Scan Item' })).toHaveTextContent('Scan Item')
    } finally {
      mockState.helpers.callService = originalCallService
    }
  })

  it('defaults inventory Scan Item storage to the current inventory route', async () => {
    for (const { destination, label, location, path } of [
      { destination: 'pantry', label: 'Pantry', location: 'dispensa', path: 'all-food' },
      { destination: 'pantry', label: 'Pantry', location: 'dispensa', path: 'pantry' },
      { destination: 'fridge', label: 'Fridge', location: 'frigo', path: 'fridge' },
      { destination: 'freezer', label: 'Freezer', location: 'freezer', path: 'freezer' },
      { destination: 'spice rack', label: 'Spice Rack', location: 'spice_rack', path: 'spice-rack' },
      { destination: 'cabinet', label: 'Cabinet', location: 'cabinet', path: 'cabinet' },
    ]) {
      const camera = setupMockCamera()
      const itemName = `${label} Test Item`

      try {
        const view = render(<DashboardViewPage activePath={path} onNavigate={() => undefined} path={path} />)
        await screen.findByLabelText(`${path === 'all-food' ? 'All Food' : label} inventory list`)
        await screen.findByRole('button', { name: 'Scan Item' })

        fireEvent.click(screen.getByRole('button', { name: 'Scan Item' }))
        expect(await screen.findByRole('dialog', { name: 'Add Item' })).toBeInTheDocument()
        expect(await screen.findByLabelText('Live item scan camera feed')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Manually Enter Name' }))
        fireEvent.change(screen.getByLabelText('Product name'), { target: { value: itemName } })
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        expect(await screen.findByLabelText('Live expiration date camera feed')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Manually Enter Expiration Date' }))
        fireEvent.click(screen.getByRole('radio', { name: 'In 3 Days' }))
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))

        expect(screen.getByText(`Confirm the item details before adding it to your ${destination}.`)).toBeInTheDocument()
        expect(screen.getByRole('radio', { name: label })).toBeChecked()
        fireEvent.click(screen.getByRole('button', { name: 'Add' }))

        await waitFor(() => expect(mockCallServiceCalls).toContainEqual(expect.objectContaining({
          domain: 'evershelf',
          returnResponse: true,
          service: 'add_scanned_item',
          serviceData: expect.objectContaining({
            location,
            name: itemName,
          }),
        })))
        expect(await screen.findByText(`Added to ${label}`)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Done' }))
        await waitFor(() => expect(camera.stop).toHaveBeenCalled())
        view.unmount()
      } finally {
        camera.restore()
      }
    }
  }, 20_000)

  it('renders chore tasks as checkbox rows with optional subtitles', async () => {
    for (const entityId of ['todo.stephen_s_past_due', 'todo.stephen_s_due_today', 'todo.stephen_s_upcoming', 'todo.stephen_s_no_due_date']) {
      mockTodoItemsByEntity[entityId] = []
    }
    mockTodoItemsByEntity['todo.stephen_s_due_today'] = [
      {
        uid: 'with-subtitle',
        summary: 'Replace HVAC filter',
        description: 'Use MERV 13',
        status: 'needs_action',
        due: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { uid: 'plain-task', summary: 'Take out trash', description: '   ', status: 'needs_action' },
    ]

    render(<DashboardViewPage activePath="stephens-chores" onNavigate={() => undefined} path="stephens-chores" />)

    const dueTodayList = await screen.findByLabelText('Due Today todo list')
    const describedTask = within(dueTodayList).getByRole('button', { name: /Replace HVAC filter\s+Due in 2 days/i })
    const plainTask = within(dueTodayList).getByRole('button', { name: 'Take out trash' })

    expect(describedTask.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:checkbox-blank-outline'))
    expect(within(describedTask).getByText('Due in 2 days')).toBeInTheDocument()
    expect(within(dueTodayList).queryByText('Use MERV 13')).not.toBeInTheDocument()
    expect(plainTask.querySelector('small')).toBeNull()
  })

  it('ports the Chores page source sections, quick links, and Stephen user visibility', async () => {
    const navigate = vi.fn()
    mockEntities['todo.stephen_s_tasks'] = entity('todo.stephen_s_tasks', '8')
    mockEntities['todo.stephen_s_due_today'] = entity('todo.stephen_s_due_today', '4')
    mockEntities['todo.stephen_s_no_due_date'] = entity('todo.stephen_s_no_due_date', '1')
    render(<DashboardViewPage activePath="chores" onNavigate={navigate} path="chores" />)

    expect(screen.getByRole('heading', { name: 'Chores' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'House Calendar' })).not.toBeInTheDocument()
  expect(screen.queryByText('No events to display')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Quick Links' })).toBeInTheDocument()
    const quickLinks = screen.getByRole('group', { name: 'Chore quick links' })
    expect(quickLinks).toHaveAttribute('data-dynamic-grid', 'true')
    expect(quickLinks).toHaveAttribute('data-dynamic-grid-item-sizing', 'content-aware')
    expect(quickLinks).not.toHaveAttribute('data-dynamic-grid-item-sizing-min-width')
    expect(quickLinks.children).toHaveLength(5)
    expect(screen.getByRole('button', { name: /Groceries 2 items/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Your Chores 4 upcoming tasks · 1 task listed/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Steph's Chores No tasks listed/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Unassigned Tasks 17 tasks listed/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Groceries 2 items/i }))
    expect(navigate).toHaveBeenCalledWith('groceries')
    fireEvent.click(screen.getByRole('button', { name: /Your Chores 4 upcoming tasks · 1 task listed/i }))
    expect(navigate).toHaveBeenCalledWith('stephens-chores')

    expect(screen.getByRole('heading', { name: 'Past Due' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Evening Tasks' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Afternoon Tasks' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No Due Date' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Upcoming' })).toBeInTheDocument()
    const todoLists = screen.getAllByLabelText(/todo list$/)
    expect(todoLists).toHaveLength(4)
    expect(todoLists.every((list) => list.getAttribute('data-layout') === 'responsive-grid')).toBe(true)
    expect(within(screen.getByLabelText('Past Due todo list')).queryByText('Active')).not.toBeInTheDocument()
  })

  it('summarizes chore quick links by overdue and undated counts instead of a raw total', async () => {
    mockEntities['todo.unassigned_past_due'] = entity('todo.unassigned_past_due', '1')
    mockEntities['todo.unassigned_due_today'] = entity('todo.unassigned_due_today', '2')
    mockEntities['todo.unassigned_upcoming'] = entity('todo.unassigned_upcoming', '4')
    mockEntities['todo.unassigned_no_due_date'] = entity('todo.unassigned_no_due_date', '6')
    mockEntities['todo.home_improvement_s_no_due_date'] = entity('todo.home_improvement_s_no_due_date', '2')

    render(<DashboardViewPage activePath="chores" onNavigate={() => undefined} path="chores" />)

    // Overdue outranks the 6 upcoming tasks, and the total (13) is never shown.
    expect(screen.getByRole('button', { name: /Unassigned Tasks 1 overdue task · 6 tasks listed/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Home Tasks 2 tasks listed/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /13 active tasks/i })).not.toBeInTheDocument()
  })

  it.each([
    ['chores', 'todo.stephen_s_no_due_date_with_unassigned', 'No Due Date'],
    ['stephens-chores', 'todo.stephen_s_no_due_date', 'No Due Date'],
    ['stephs-chores', 'todo.steph_s_no_due_date', 'No Due Date'],
    ['unassigned-chores', 'todo.unassigned_no_due_date', 'No Due Date'],
    ['home-improvement-chores', 'todo.home_improvement_s_no_due_date', 'No Due Date'],
  ])('renders exactly the tasks supplied by HA on the %s page while Vacation Mode is on', async (path, entityId, title) => {
    mockEntities['input_boolean.vacation_mode'].state = 'on'
    mockEntities[entityId] = entity(entityId, '2')
    mockTodoItemsByEntity[entityId] = [
      { uid: 'ha-item-alpha', summary: 'HA supplied task alpha ' + path, status: 'needs_action' },
      { uid: 'ha-item-beta', summary: 'HA supplied task beta ' + path, status: 'needs_action' },
    ]

    render(<DashboardViewPage activePath={path} onNavigate={() => undefined} path={path} />)

    const list = await screen.findByLabelText(title + ' todo list')
    expect(within(list).getByRole('button', { name: 'HA supplied task alpha ' + path })).toBeInTheDocument()
    expect(within(list).getByRole('button', { name: 'HA supplied task beta ' + path })).toBeInTheDocument()
    expect(within(list).getAllByRole('button')).toHaveLength(2)
  })

  it('switches Chores user-gated todo sections for Steph and updates the Steph list', async () => {
    mockState.user = { id: '43cb71bbd1cb4860b2a7de4c829020f0', name: 'Steph' }
    render(<DashboardViewPage activePath="chores" onNavigate={() => undefined} path="chores" />)

    expect(screen.getByRole('button', { name: /Stephen's Chores/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Your Chores/ })).toBeInTheDocument()
    const eveningList = await screen.findByLabelText('Evening Tasks todo list')
    fireEvent.click(within(eveningList).getByRole('button', { name: /Mock task one/i, pressed: false }))

    expect(mockCallServiceCalls).toContainEqual({
      domain: 'todo',
      service: 'update_item',
      target: 'todo.steph_s_evening_with_unassigned',
      serviceData: { item: '1001--2026-06-04 17:30:00+00:00', status: 'completed' },
    })
  })

  it('keeps configured Chores quick-link labels for an unknown viewer', () => {
    mockState.user = { id: 'unknown-user', name: 'Unknown' }
    render(<DashboardViewPage activePath="chores" onNavigate={() => undefined} path="chores" />)

    expect(screen.getByRole('button', { name: /Stephen's Tasks/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Steph's Tasks/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Your Chores/ })).not.toBeInTheDocument()
  })

  it('personalizes personal Chores page titles and the viewer empty state', async () => {
    for (const list of TODO_PAGES['stephens-chores'].lists) {
      mockEntities[list.entityId].state = '0'
      mockTodoItemsByEntity[list.entityId] = []
    }
    const ownView = render(<DashboardViewPage activePath="stephens-chores" onNavigate={() => undefined} path="stephens-chores" />)
    expect(screen.getByRole('heading', { name: 'Your Chores' })).toBeInTheDocument()
    expect(await screen.findByText('You have no chores due- nice job!')).toBeInTheDocument()

    ownView.unmount()
    mockState.user = { id: HOUSEHOLD_RESIDENTS.steph.haUserId, name: 'Steph' }
    const otherView = render(<DashboardViewPage activePath="stephens-chores" onNavigate={() => undefined} path="stephens-chores" />)
    expect(screen.getByRole('heading', { name: "Stephen's Chores" })).toBeInTheDocument()

    otherView.unmount()
    mockState.user = { id: 'unknown-user', name: 'Unknown' }
    render(<DashboardViewPage activePath="stephs-chores" onNavigate={() => undefined} path="stephs-chores" />)
    expect(screen.getByRole('heading', { name: "Steph's Chores" })).toBeInTheDocument()
  })

  it('removes completed chore rows immediately and reloads rows when Home Assistant updates the todo entity', async () => {
    mockTodoItemsByEntity['todo.stephen_s_past_due_with_unassigned'] = [{ uid: 'past-due-1', summary: 'First live task', status: 'needs_action' }]
    const view = render(<DashboardViewPage activePath="chores" onNavigate={() => undefined} path="chores" />)

    const pastDueList = await screen.findByLabelText('Past Due todo list')
    fireEvent.click(within(pastDueList).getByRole('button', { name: /First live task/i }))

    await waitFor(() => expect(screen.queryByLabelText('Past Due todo list')).not.toBeInTheDocument())

    mockTodoItemsByEntity['todo.stephen_s_past_due_with_unassigned'] = [{ uid: 'past-due-2', summary: 'Second live task', status: 'needs_action' }]
    mockEntities['todo.stephen_s_past_due_with_unassigned'].state = '2'
    view.rerender(<DashboardViewPage activePath="chores" onNavigate={() => undefined} path="chores" />)

    const reloadedPastDueList = await screen.findByLabelText('Past Due todo list')
    expect(await within(reloadedPastDueList).findByRole('button', { name: /Second live task/i })).toBeInTheDocument()
  })

  it('keeps a visible chore todo section mounted when Home Assistant updates the todo entity', async () => {
    mockTodoItemsByEntity['todo.stephen_s_evening_with_unassigned'] = [
      { uid: 'evening-1', summary: 'First visible task', status: 'needs_action' },
      { uid: 'evening-2', summary: 'Second visible task', status: 'needs_action' },
    ]
    mockEntities['todo.stephen_s_evening_with_unassigned'].state = '2'
    const view = render(<DashboardViewPage activePath="chores" onNavigate={() => undefined} path="chores" />)

    const eveningList = await screen.findByLabelText('Evening Tasks todo list')
    const eveningSection = eveningList.closest('section')
    fireEvent.click(within(eveningList).getByRole('button', { name: /First visible task/i }))
    mockTodoItemsByEntity['todo.stephen_s_evening_with_unassigned'] = [
      { uid: 'evening-1', summary: 'First visible task', status: 'completed' },
      { uid: 'evening-2', summary: 'Second visible task', status: 'needs_action' },
    ]
    Object.assign(mockEntities['todo.stephen_s_evening_with_unassigned'], { last_updated: '2026-06-12T12:00:00.000Z', state: '1' })

    view.rerender(<DashboardViewPage activePath="chores" onNavigate={() => undefined} path="chores" />)

    await waitFor(() => expect(screen.getByLabelText('Evening Tasks todo list').closest('section')).toBe(eveningSection))
    expect(within(screen.getByLabelText('Evening Tasks todo list')).queryByText('First visible task')).not.toBeInTheDocument()
    expect(within(screen.getByLabelText('Evening Tasks todo list')).getByText('Second visible task')).toBeInTheDocument()
  })

  it('keeps recently checked chore rows hidden through stale DoneTick refreshes across sections', async () => {
    mockTodoItemsByEntity['todo.stephen_s_past_due_with_unassigned'] = [
      { uid: 'stale-past-due', summary: 'Stale past due task', status: 'needs_action' },
    ]
    mockTodoItemsByEntity['todo.stephen_s_evening_with_unassigned'] = [
      { uid: 'stale-evening', summary: 'Stale evening task', status: 'needs_action' },
    ]
    const view = render(<DashboardViewPage activePath="chores" onNavigate={() => undefined} path="chores" />)

    const pastDueList = await screen.findByLabelText('Past Due todo list')
    const eveningList = await screen.findByLabelText('Evening Tasks todo list')
    act(() => {
      fireEvent.click(within(pastDueList).getByRole('button', { name: /Stale past due task/i }))
      fireEvent.click(within(eveningList).getByRole('button', { name: /Stale evening task/i }))
    })

    expect(screen.queryByRole('button', { name: /Stale past due task/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Stale evening task/i })).not.toBeInTheDocument()

    mockTodoItemsByEntity['todo.stephen_s_past_due_with_unassigned'] = [
      { uid: 'stale-past-due', summary: 'Stale past due task', status: 'needs_action' },
      { uid: 'fresh-past-due', summary: 'Fresh past due task', status: 'needs_action' },
    ]
    mockTodoItemsByEntity['todo.stephen_s_evening_with_unassigned'] = [
      { uid: 'stale-evening', summary: 'Stale evening task', status: 'needs_action' },
      { uid: 'fresh-evening', summary: 'Fresh evening task', status: 'needs_action' },
    ]
    Object.assign(mockEntities['todo.stephen_s_past_due_with_unassigned'], { last_updated: '2026-07-07T23:59:00.000Z', state: '2' })
    Object.assign(mockEntities['todo.stephen_s_evening_with_unassigned'], { last_updated: '2026-07-07T23:59:01.000Z', state: '2' })
    view.rerender(<DashboardViewPage activePath="chores" onNavigate={() => undefined} path="chores" />)

    expect(await screen.findByRole('button', { name: /Fresh past due task/i })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Fresh evening task/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Stale past due task/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Stale evening task/i })).not.toBeInTheDocument()
  })

  it('does not render chore sections whose loaded todo list has no visible tasks', async () => {
    mockTodoItemsByEntity['todo.stephen_s_evening_with_unassigned'] = []
    mockEntities['todo.stephen_s_evening_with_unassigned'].state = '1'
    render(<DashboardViewPage activePath="chores" onNavigate={() => undefined} path="chores" />)

    expect(screen.getByRole('heading', { name: 'Evening Tasks' })).toBeInTheDocument()

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Evening Tasks' })).not.toBeInTheDocument())
  })

  it.each([
    ['stephs-chores', 'todo.steph_s_due_today', 'Due Today', 'Past Due'],
    ['stephens-chores', 'todo.stephen_s_due_today', 'Due Today', 'Past Due'],
    ['unassigned-chores', 'todo.unassigned_upcoming', 'Upcoming', 'Past Due'],
    ['home-improvement-chores', 'todo.home_improvement_s_upcoming', 'Upcoming', 'No Due Date'],
  ])('does not render empty sections on the %s subpage', async (path, emptyEntityId, emptyHeading, remainingHeading) => {
    const remainingList = TODO_PAGES[path].lists.find((list) => list.title === remainingHeading)
    expect(remainingList).toBeDefined()
    mockEntities[emptyEntityId] = entity(emptyEntityId, '1')
    mockEntities[remainingList!.entityId] = entity(remainingList!.entityId, '1')
    mockTodoItemsByEntity[emptyEntityId] = []
    render(<DashboardViewPage activePath={path} onNavigate={() => undefined} path={path} />)

    expect(screen.getByRole('heading', { name: emptyHeading })).toBeInTheDocument()

    await waitFor(() => expect(screen.queryByRole('heading', { name: emptyHeading })).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: remainingHeading })).toBeInTheDocument()
  })

  it('does not render the Groceries section when the shopping list has no visible items', async () => {
    mockTodoItemsByEntity['todo.shopping_list'] = []
    mockEntities['todo.shopping_list'].state = '1'
    render(<DashboardViewPage activePath="groceries" onNavigate={() => undefined} path="groceries" />)
    const [, scroller] = Array.from(screen.getByRole('main').children)

    expect(screen.getByRole('heading', { name: 'Grocery List' })).toBeInTheDocument()

    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Grocery List' })).not.toBeInTheDocument())
    expect(await screen.findByRole('heading', { name: 'No Groceries Listed' })).toBeInTheDocument()
    expect(screen.getByText('Add some groceries to see them appear.')).toBeInTheDocument()
    await waitFor(() => expect(scroller).toHaveAttribute('data-scroll-lock', 'true'))
    expect(screen.getByRole('heading', { name: 'No Groceries Listed' }).closest('[data-empty-todo-page]')).toHaveAttribute('data-empty-todo-page', 'true')
  })

  it('renders an empty task state when a todo page has no visible task sections', async () => {
    for (const entityId of ['todo.steph_s_past_due', 'todo.steph_s_due_today', 'todo.steph_s_upcoming', 'todo.steph_s_no_due_date']) {
      mockTodoItemsByEntity[entityId] = []
      mockEntities[entityId] = entity(entityId, '1')
    }

    render(<DashboardViewPage activePath="stephs-chores" onNavigate={() => undefined} path="stephs-chores" />)

    expect(await screen.findByRole('heading', { name: 'No Chores Due' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByLabelText(/todo list$/)).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'No Chores Due' }).parentElement).toHaveAttribute('data-empty-layout', 'centered')
    expect(screen.getByRole('heading', { name: 'No Chores Due' }).parentElement).toHaveAttribute('data-empty-typography', 'festival')
    expect(Array.from(screen.getByRole('main').children)[1]).toHaveAttribute('data-scroll-lock', 'true')
    expect(screen.getByText('Steph has no chores due- nice job!')).toBeInTheDocument()
  })

  it('credits vacation instead of the user when Donetick hides the chores', async () => {
    for (const entityId of ['todo.steph_s_past_due', 'todo.steph_s_due_today', 'todo.steph_s_upcoming', 'todo.steph_s_no_due_date']) {
      mockTodoItemsByEntity[entityId] = []
      mockEntities[entityId] = entity(entityId, '1')
    }
    mockEntities['input_boolean.vacation_mode'].state = 'on'

    render(<DashboardViewPage activePath="stephs-chores" onNavigate={() => undefined} path="stephs-chores" />)

    expect(await screen.findByRole('heading', { name: 'No Chores Due' })).toBeInTheDocument()
    expect(screen.getByText('Enjoy vacation!')).toBeInTheDocument()
    expect(screen.queryByText('Steph has no chores due- nice job!')).not.toBeInTheDocument()
  })

  it('keeps the normal empty copy on lists vacation does not hide', async () => {
    mockTodoItemsByEntity['todo.shopping_list'] = []
    mockEntities['todo.shopping_list'] = entity('todo.shopping_list', '0')
    mockEntities['input_boolean.vacation_mode'].state = 'on'

    render(<DashboardViewPage activePath="groceries" onNavigate={() => undefined} path="groceries" />)

    expect(await screen.findByRole('heading', { name: 'No Groceries Listed' })).toBeInTheDocument()
    expect(screen.queryByText('Enjoy vacation!')).not.toBeInTheDocument()
  })

  it('renders chore due dates as explicit overdue durations instead of calendar phrases', async () => {
    mockTodoItemsByEntity['todo.stephen_s_past_due_with_unassigned'] = [
      { uid: 'past-due-overdue', summary: 'Explicit overdue task', status: 'needs_action', due: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
      { uid: 'past-due-hours', summary: 'Hours overdue task', status: 'needs_action', due: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString() },
      { uid: 'past-due-months', summary: 'Months overdue task', status: 'needs_action', due: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() },
      { uid: 'past-due-future', summary: 'Future task', status: 'needs_action', due: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() },
    ]
    render(<DashboardViewPage activePath="chores" onNavigate={() => undefined} path="chores" />)

    const pastDueList = await screen.findByLabelText('Past Due todo list')

    expect(within(pastDueList).getByText('5 days overdue')).toBeInTheDocument()
    expect(within(pastDueList).getByText('7 hours overdue')).toBeInTheDocument()
    expect(within(pastDueList).getByText('3 months overdue')).toBeInTheDocument()
    expect(within(pastDueList).getByText('Due in 2 days')).toBeInTheDocument()
    expect(within(pastDueList).getByRole('button', { name: /Hours overdue task/i })).toHaveAttribute('data-due-tone', 'overdue-hours')
    expect(within(pastDueList).getByRole('button', { name: /Explicit overdue task/i })).toHaveAttribute('data-due-tone', 'overdue-long')
    expect(within(pastDueList).getByRole('button', { name: /Months overdue task/i })).toHaveAttribute('data-due-tone', 'overdue-long')
    expect(within(pastDueList).queryByText(/last week|this week/i)).not.toBeInTheDocument()
  })

  it('opens the source create Donetick task modal from Chores and submits Donetick service data', async () => {
    render(<DashboardViewPage activePath="chores" onNavigate={() => undefined} path="chores" />)

    expect(await screen.findAllByText('Mock task one')).not.toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Create Task' })).toBeInTheDocument()
    expect(within(dialog).queryByText('Create Donetick Task')).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText('Task Name')).toBeRequired()
    expect(within(dialog).getByLabelText('Due Date')).toHaveAttribute('type', 'date')
    expect(within(dialog).getByLabelText('Due Time')).toHaveAttribute('type', 'time')
    expect(within(dialog).getByLabelText('Assignee')).toHaveValue('')
    expect(within(dialog).getByLabelText('Priority')).toHaveValue('critical')
    expect(within(dialog).getByLabelText('Recurrence')).toHaveValue('no_repeat')
    expect(within(dialog).queryByRole('option', { name: /Adaptive/i })).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Repeat Every')).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Days of Week')).not.toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText('Task Name'), { target: { value: 'Clean the gutters' } })
    fireEvent.change(within(dialog).getByLabelText('Assignee'), { target: { value: '3' } })
    fireEvent.change(within(dialog).getByLabelText('Description'), { target: { value: 'Use the tall ladder' } })
    fireEvent.change(within(dialog).getByLabelText('Due Date'), { target: { value: '2026-06-07' } })
    fireEvent.change(within(dialog).getByLabelText('Due Time'), { target: { value: '08:30' } })
    fireEvent.change(within(dialog).getByLabelText('Priority'), { target: { value: 'high' } })
    fireEvent.change(within(dialog).getByLabelText('Recurrence'), { target: { value: 'interval' } })
    expect(within(dialog).getByLabelText('Repeat Every')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Interval Unit')).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Days of Week')).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText('Repeat Every')).toHaveAttribute('inputmode', 'numeric')
    fireEvent.change(within(dialog).getByLabelText('Repeat Every'), { target: { value: '0' } })
    fireEvent.blur(within(dialog).getByLabelText('Repeat Every'))
    expect(within(dialog).getByLabelText('Repeat Every')).toHaveValue('1')
    fireEvent.change(within(dialog).getByLabelText('Repeat Every'), { target: { value: '2' } })
    fireEvent.change(within(dialog).getByLabelText('Interval Unit'), { target: { value: 'weeks' } })

    fireEvent.click(within(dialog).getByRole('button', { name: 'Create Task' }))

    await waitFor(() => expect(mockCallServiceCalls).toEqual([
      {
        domain: 'donetick',
        service: 'create_task_form',
        serviceData: {
          assignees: '3',
          description: 'Use the tall ladder',
          due_date: '2026-06-07T08:30:00',
          hide_on_vacation: true,
          name: 'Clean the gutters',
          priority: 'high',
          recurrence: 'interval',
          recurrence_days: [],
          recurrence_interval: 2,
          recurrence_unit: 'weeks',
        },
      },
    ]))
    await waitFor(() => expect(dialog).toHaveAttribute('data-state', 'closed'))
  })

  it('opens a chore row in the prefilled edit modal and saves through DoneTick', async () => {
    for (const entityId of [
      'todo.stephen_s_past_due_with_unassigned',
      'todo.stephen_s_evening_with_unassigned',
      'todo.stephen_s_afternoon_with_unassigned',
      'todo.stephen_s_morning_with_unassigned',
      'todo.stephen_s_all_day_with_unassigned',
      'todo.stephen_s_no_due_date_with_unassigned',
      'todo.stephen_s_upcoming_today_by_time_and_future_with_unassigned',
    ]) {
      mockTodoItemsByEntity[entityId] = []
      mockEntities[entityId].state = '0'
    }
    mockTodoItemsByEntity['todo.stephen_s_past_due_with_unassigned'] = [
      { uid: '240--None', summary: 'Clean the gutters', status: 'needs_action' },
    ]
    mockEntities['todo.stephen_s_past_due_with_unassigned'].state = '1'
    mockDonetickTasksById[240] = {
      assignees: [1],
      assigned_to: 1,
      description: 'Use the tall ladder',
      frequency: 1,
      frequency_metadata: {},
      frequency_type: 'once',
      hide_on_vacation: true,
      id: 240,
      name: 'Clean the gutters',
      next_due_date: null,
      priority: 2,
    }

    render(<DashboardViewPage activePath="chores" onNavigate={() => undefined} path="chores" />)

    const pastDueList = await screen.findByLabelText('Past Due todo list')
    fireEvent.click(within(pastDueList).getByRole('button', { name: 'Edit Clean the gutters' }))

    const dialog = await screen.findByRole('dialog', { name: 'Edit Task' })
    await waitFor(() => expect(within(dialog).getByLabelText('Task Name')).toHaveValue('Clean the gutters'))
    expect(within(dialog).getByLabelText('Assignee')).toHaveValue('1')
    expect(within(dialog).getByLabelText('Description')).toHaveValue('Use the tall ladder')
    expect(within(dialog).getByRole('button', { name: 'Delete Task' })).toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText('Task Name'), { target: { value: 'Clean and inspect the gutters' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Task' }))

    await waitFor(() => expect(mockCallServiceCalls.at(-1)).toMatchObject({
      domain: 'donetick',
      service: 'update_task_form',
      serviceData: {
        config_entry_id: 'todo.stephen_s_past_due_with_unassigned',
        name: 'Clean and inspect the gutters',
        task_id: 240,
      },
    }))
    await waitFor(() => expect(dialog).toHaveAttribute('data-state', 'closed'))
  })

  it('does not add DoneTick edit buttons to Home Assistant todo lists', async () => {
    mockTodoItemsByEntity['todo.shopping_list'] = [
      { uid: 'shopping-1', summary: 'Milk', status: 'needs_action' },
    ]
    mockEntities['todo.shopping_list'].state = '1'

    render(<DashboardViewPage activePath="groceries" onNavigate={() => undefined} path="groceries" />)

    expect(await screen.findByRole('button', { name: 'Milk' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit Milk' })).not.toBeInTheDocument()
  })

  it('only shows recurrence days for the specific days recurrence option', async () => {
    render(<DashboardViewPage activePath="chores" onNavigate={() => undefined} path="chores" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Add Task' }))
    const dialog = await screen.findByRole('dialog')

    fireEvent.change(within(dialog).getByLabelText('Recurrence'), { target: { value: 'days_of_the_week' } })

    expect(within(dialog).getByLabelText('Days of Week')).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Repeat Every')).not.toBeInTheDocument()
  })

  it('resets create task recurrence state after closing and reopening the modal', async () => {
    render(<DashboardViewPage activePath="chores" onNavigate={() => undefined} path="chores" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Add Task' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Recurrence'), { target: { value: 'interval' } })

    expect(within(dialog).getByLabelText('Recurrence')).toHaveValue('interval')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(dialog).toHaveAttribute('data-state', 'closed'))
    fireEvent.click(screen.getByRole('button', { name: 'Add Task', hidden: true }))

    const reopenedDialog = await screen.findByRole('dialog')
    expect(within(reopenedDialog).getByLabelText('Recurrence')).toHaveValue('no_repeat')
    expect(within(reopenedDialog).queryByLabelText('Repeat Every')).not.toBeInTheDocument()
  })

  it('shows the create task FAB on chore task pages with route-specific assignee defaults', async () => {
    for (const [path, assignee] of [
      ['chores', ''],
      ['stephens-chores', '1'],
      ['stephs-chores', '2'],
      ['unassigned-chores', ''],
      ['home-improvement-chores', '3'],
    ] as const) {
      const view = render(<DashboardViewPage activePath={path} onNavigate={() => undefined} path={path} />)
      fireEvent.click(await screen.findByRole('button', { name: 'Add Task' }))
      expect(within(await screen.findByRole('dialog')).getByLabelText('Assignee')).toHaveValue(assignee)
      view.unmount()
    }

    const groceries = render(<DashboardViewPage activePath="groceries" onNavigate={() => undefined} path="groceries" />)
    expect(screen.queryByRole('button', { name: 'Add Task' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Groceries' })).toBeInTheDocument()
    groceries.unmount()
  })

  it('opens a grocery item modal on the Groceries page and adds to the shopping list', async () => {
    render(<DashboardViewPage activePath="groceries" onNavigate={() => undefined} path="groceries" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Add Groceries' }))
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByRole('heading', { name: 'Add Grocery Item' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Item')).toBeRequired()
    expect(within(dialog).queryByLabelText('Assignee')).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Priority')).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Recurrence')).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Description')).not.toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText('Item'), { target: { value: 'Bananas' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Item' }))

    await waitFor(() => expect(mockCallServiceCalls).toEqual([
      {
        domain: 'todo',
        service: 'add_item',
        target: 'todo.shopping_list',
        serviceData: { item: 'Bananas' },
      },
    ]))
  })

  it('renders the Settings To-Do list without a top section separator and adds tasks to the admin to-do', async () => {
    mockTodoItemsByEntity['todo.groceries'] = [{ uid: 'admin-task-1', summary: 'Review reminders', status: 'needs_action' }]
    render(<DashboardViewPage activePath="settings" onNavigate={() => undefined} path="to-do" />)

    const list = await screen.findByLabelText('Admin To-Do todo list')
    expect(screen.getByRole('heading', { name: 'To-Do' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Admin To-Do' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Groceries' })).not.toBeInTheDocument()
    expect(list).toHaveAttribute('data-row-variant', 'settings')
    expect(within(list).getByRole('button', { name: 'Review reminders' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }))
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByRole('heading', { name: 'Add Task' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Task')).toBeRequired()
    expect(within(dialog).queryByLabelText('Assignee')).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Priority')).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Recurrence')).not.toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText('Task'), { target: { value: 'Renew parking permit' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Task' }))

    await waitFor(() => expect(mockCallServiceCalls).toEqual([
      {
        domain: 'todo',
        service: 'add_item',
        target: 'todo.groceries',
        serviceData: { item: 'Renew parking permit' },
      },
    ]))
  })

  it('opens the title-only editor only on the Settings Admin To-Do surface', async () => {
    mockTodoItemsByEntity['todo.groceries'] = [
      { uid: 'admin-task-1', summary: 'Raw admin title', status: 'needs_action' },
    ]
    render(<DashboardViewPage activePath="settings" onNavigate={() => undefined} path="to-do" />)

    const list = await screen.findByLabelText('Admin To-Do todo list')
    fireEvent.click(within(list).getByRole('button', { name: 'Edit Raw admin title' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit Task' })

    expect(within(dialog).getByLabelText('Task Name')).toHaveValue('Raw admin title')
    expect(within(dialog).getByRole('button', { name: 'Reset' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit Task' })).not.toBeInTheDocument())

    cleanup()
    mockTodoItemsByEntity['todo.shopping_list'] = [{ uid: 'grocery-1', summary: 'Milk', status: 'needs_action' }]
    render(<DashboardViewPage activePath="chores" onNavigate={() => undefined} path="groceries" />)
    const groceryList = await screen.findByLabelText('Grocery List todo list')
    expect(within(groceryList).queryByRole('button', { name: 'Edit Milk' })).not.toBeInTheDocument()
  })

  it('renders the shared empty state when the Settings To-Do list is empty', async () => {
    mockTodoItemsByEntity['todo.groceries'] = []
    mockEntities['todo.groceries'].state = '0'
    render(<DashboardViewPage activePath="settings" onNavigate={() => undefined} path="to-do" />)

    const emptyHeading = await screen.findByRole('heading', { name: 'No To-Do Tasks' })

    expect(emptyHeading.parentElement).toHaveAttribute('data-empty-layout', 'centered')
    expect(emptyHeading.parentElement).toHaveAttribute('data-empty-typography', 'festival')
    expect(screen.getByText('Use Add Task to create an admin to-do.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Admin To-Do todo list')).not.toBeInTheDocument()
  })

  it('renders the dedicated thermostat route', () => {
    render(<DashboardViewPage activePath="thermostat" onNavigate={() => undefined} path="thermostat" />)

    expect(screen.getByRole('heading', { name: 'Thermostat' })).toBeInTheDocument()
    expect(screen.queryByText(/not available in the React dashboard yet/i)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Room Thermostats' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Advanced Configuration' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Room Tracking' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Eco Mode' })).not.toBeInTheDocument()
  })

  it('keeps vacuum modal controls optimistic while Valetudo state is still stale', async () => {
    const { rerender } = render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    fireEvent.click(screen.getByRole('button', { name: /Main Floor Docked/i }))

    const dialog = await screen.findByRole('dialog')
    const controlsPane = within(dialog).getByRole('group', { name: 'Main Floor controls, rooms, auto-clean, actions, info' })
    const modeSelect = screen.getByRole('combobox', { name: /Mode Vacuum/i })
    modeSelect.focus()
    expect(modeSelect).toHaveFocus()
    fireEvent.change(modeSelect, { target: { value: 'mop' } })

    expect(mockEntities['select.valetudo_exaltedsneakydeer_mode'].state).toBe('vacuum')
    expect(screen.getByRole('combobox', { name: /Mode Mop/i })).toHaveValue('mop')
    expect(Array.from(screen.getByRole<HTMLSelectElement>('combobox', { name: /Mode Mop/i }).options).map((option) => option.text)).toEqual(['Vacuum And Mop', 'Mop', 'Vacuum', 'Vacuum Then Mop'])
    expect(screen.getByRole('combobox', { name: /Mode Mop/i })).not.toHaveFocus()
    expect(screen.queryByRole('combobox', { name: /Fan/i })).not.toBeInTheDocument()
    const waterSelect = screen.getByRole('combobox', { name: /Water Medium/i })
    expect(waterSelect).toHaveValue('medium')
    expect(within(waterSelect.closest('[data-native-select-field]') as HTMLElement).getByText('Water').parentElement?.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:water'))

    const cleaningPasses = screen.getByRole('combobox', { name: /Cleaning Passes 1x/i })
    fireEvent.change(cleaningPasses, { target: { value: '3' } })

    expect(mockEntities['input_select.main_floor_vacuum_cleaning_passes'].state).toBe('1')
    expect(screen.getByRole('combobox', { name: /Cleaning Passes 3x/i })).toHaveValue('3')

    fireEvent.click(screen.getByRole('button', { name: 'Clean' }))

    expect(mockEntities['vacuum.valetudo_exaltedsneakydeer'].state).toBe('docked')
    expect(await within(controlsPane).findByRole('heading', { name: 'Cleaning' })).toBeInTheDocument()
    expect(within(controlsPane).queryByRole('button', { name: 'Clean' })).not.toBeInTheDocument()
    expect(within(controlsPane).getByRole('button', { name: 'Pause' })).toHaveAttribute('data-modal-action-button', 'true')
    expect(within(controlsPane).getByRole('button', { name: 'Pause' })).toHaveAttribute('data-tone', 'warning')
    expect(within(controlsPane).getByRole('button', { name: 'Pause' })).toBeDisabled()
    expect(within(controlsPane).getByRole('button', { name: 'Stop' })).toHaveAttribute('data-tone', 'destructive')
    expect(within(controlsPane).getByRole('button', { name: 'Stop' })).toBeDisabled()

    expect(within(dialog).queryByRole('tab', { name: 'Rooms' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('tab', { name: 'Auto-Clean' })).toBeInTheDocument()
    expect(within(dialog).getByRole('tab', { name: 'Info' })).toBeInTheDocument()

    expect(mockCallServiceCalls).toEqual([
      { domain: 'select', service: 'select_option', target: 'select.valetudo_exaltedsneakydeer_mode', serviceData: { option: 'mop' } },
      { domain: 'input_select', service: 'select_option', target: 'input_select.main_floor_vacuum_cleaning_passes', serviceData: { option: '3' } },
    ])

    mockEntities['select.valetudo_exaltedsneakydeer_mode'].state = 'mop'
    mockEntities['input_select.main_floor_vacuum_cleaning_passes'].state = '3'
    rerender(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 700))
    })

    await waitFor(() => expect(mockCallServiceCalls).toEqual([
      { domain: 'select', service: 'select_option', target: 'select.valetudo_exaltedsneakydeer_mode', serviceData: { option: 'mop' } },
      { domain: 'input_select', service: 'select_option', target: 'input_select.main_floor_vacuum_cleaning_passes', serviceData: { option: '3' } },
      { domain: 'script', service: 'main_floor_vacuum_clean_selected_segments', target: undefined },
    ]), { timeout: 1500 })

    await clickModalTab(within(dialog), 'Controls')
    expect(within(controlsPane).getByRole('button', { name: 'Pause' })).toBeDisabled()
    mockEntities['vacuum.valetudo_exaltedsneakydeer'].state = 'cleaning'
    rerender(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    await waitFor(() => expect(within(controlsPane).getByRole('button', { name: 'Pause' })).toBeEnabled())
    expect(within(controlsPane).getByRole('button', { name: 'Stop' })).toBeEnabled()
  })

  it('lets an unexpected live error replace optimistic vacuum state and routes Stop from live truth', async () => {
    mockEntities['vacuum.valetudo_exaltedsneakydeer'].state = 'idle'
    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)
    fireEvent.click(screen.getByRole('button', { name: /Main Floor Idle/i }))
    const dialog = await screen.findByRole('dialog')
    const controlsPane = within(dialog).getByRole('group', { name: 'Main Floor controls, rooms, auto-clean, actions, info' })

    fireEvent.click(within(controlsPane).getByRole('button', { name: 'Dock' }))
    expect(await within(controlsPane).findByRole('heading', { name: 'Returning' })).toBeInTheDocument()

    act(() => {
      setMockEntityState('sensor.valetudo_exaltedsneakydeer_error', 'Brush stuck')
      setMockEntityState('vacuum.valetudo_exaltedsneakydeer', 'error')
    })

    await waitFor(() => expect(within(controlsPane).getByRole('heading', { name: 'Error' })).toBeInTheDocument())
    fireEvent.click(within(controlsPane).getByRole('button', { name: 'Stop' }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'vacuum', service: 'return_to_base', target: 'vacuum.valetudo_exaltedsneakydeer' },
      { domain: 'vacuum', service: 'stop', target: 'vacuum.valetudo_exaltedsneakydeer' },
    ])
  })

  it('cancels a queued clean before dispatch when live command policy becomes restricted', async () => {
    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)
    fireEvent.click(screen.getByRole('button', { name: /Main Floor Docked/i }))
    const dialog = await screen.findByRole('dialog')

    fireEvent.change(within(dialog).getByRole('combobox', { name: /Mode Vacuum/i }), { target: { value: 'mop' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Clean' }))
    act(() => setMockEntityState('sensor.valetudo_exaltedsneakydeer_error', 'unavailable'))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('The queued cleaning request was canceled because the vacuum is no longer ready. Retry when ready.')
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 700))
    })
    expect(mockCallServiceCalls).toEqual([
      { domain: 'select', service: 'select_option', target: 'select.valetudo_exaltedsneakydeer_mode', serviceData: { option: 'mop' } },
    ])
  })

  it('does not report a clean failure when only a setting confirmation expires', async () => {
    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    fireEvent.click(screen.getByRole('button', { name: /Main Floor Docked/i }))
    await screen.findByRole('dialog')

    vi.useFakeTimers()
    try {
      fireEvent.change(screen.getByRole('combobox', { name: /Mode Vacuum/i }), { target: { value: 'mop' } })
      act(() => {
        vi.advanceTimersByTime(8001)
      })

      expect(screen.queryByText('The vacuum settings did not confirm before cleaning could start.')).not.toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: /Mode Vacuum/i })).toHaveValue('vacuum')
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })

  it('keeps manual vacuum starts locked past the generic optimistic timeout', async () => {
    const { rerender } = render(<DashboardViewPage activePath="theater-room" onNavigate={() => undefined} path="theater-room" />)

    fireEvent.click(screen.getByRole('button', { name: /Theater Room Docked/i }))

    const dialog = await screen.findByRole('dialog')
    const controlsPane = within(dialog).getByRole('group', { name: 'Theater Room controls, actions, info' })
    vi.useFakeTimers()
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Clean' }))

      expect(mockEntities['vacuum.valetudo_politefatherlykingfisher'].state).toBe('docked')
      act(() => {
        vi.advanceTimersByTime(MODAL_TAB_TEST_SETTLE_MS)
      })
      expect(within(controlsPane).getByRole('heading', { name: 'Cleaning' })).toBeInTheDocument()
      expect(within(controlsPane).queryByRole('button', { name: 'Clean' })).not.toBeInTheDocument()
      expect(within(controlsPane).getByRole('button', { name: 'Pause' })).toBeDisabled()
      expect(within(controlsPane).getByRole('button', { name: 'Stop' })).toBeDisabled()

      act(() => {
        vi.advanceTimersByTime(8001)
      })

      expect(mockEntities['vacuum.valetudo_politefatherlykingfisher'].state).toBe('docked')
      expect(within(controlsPane).getByRole('heading', { name: 'Cleaning' })).toBeInTheDocument()
      expect(within(controlsPane).queryByRole('button', { name: 'Clean' })).not.toBeInTheDocument()
      expect(within(controlsPane).getByRole('button', { name: 'Pause' })).toBeDisabled()
      expect(within(controlsPane).getByRole('button', { name: 'Stop' })).toBeDisabled()

      mockEntities['vacuum.valetudo_politefatherlykingfisher'].state = 'cleaning'
      rerender(<DashboardViewPage activePath="theater-room" onNavigate={() => undefined} path="theater-room" />)
      act(() => {
        vi.advanceTimersByTime(0)
      })

      expect(within(controlsPane).getByRole('button', { name: 'Pause' })).toBeEnabled()
      expect(within(controlsPane).getByRole('button', { name: 'Stop' })).toBeEnabled()
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })

  it('does not steal focus from a vacuum dropdown reopened immediately after changing', async () => {
    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    fireEvent.click(screen.getByRole('button', { name: /Main Floor Docked/i }))

    const modeSelect = await screen.findByRole('combobox', { name: /Mode Vacuum/i })
    fireEvent.change(modeSelect, { target: { value: 'mop' } })

    const reopenedModeSelect = screen.getByRole('combobox', { name: /Mode Mop/i })
    reopenedModeSelect.focus()
    expect(reopenedModeSelect).toHaveFocus()

    await act(async () => {
      await new Promise((resolve) => window.requestAnimationFrame(resolve))
    })

    expect(screen.getByRole('combobox', { name: /Mode Mop/i })).toHaveFocus()
    expect(mockCallServiceCalls).toEqual([
      { domain: 'select', service: 'select_option', target: 'select.valetudo_exaltedsneakydeer_mode', serviceData: { option: 'mop' } },
    ])
  })

  it('orders selected vacuum rooms by the time their toggles changed', async () => {
    const kitchen = mockEntities['input_boolean.roborock_kitchen_toggle'] as typeof mockEntities[string] & { last_changed?: string }
    const livingRoom = mockEntities['input_boolean.roborock_living_room_toggle'] as typeof mockEntities[string] & { last_changed?: string }
    kitchen.state = 'on'
    kitchen.last_changed = '2026-08-07T12:00:00.000Z'
    livingRoom.state = 'on'
    livingRoom.last_changed = '2026-08-07T12:01:00.000Z'

    try {
      render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)
      fireEvent.click(screen.getByRole('button', { name: /Main Floor Docked/i }))

      const selectedRoomsSummary = (await screen.findByText('Selected Rooms')).closest('div') as HTMLElement
      expect(within(selectedRoomsSummary).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Kitchen', 'Living Room'])
    } finally {
      kitchen.state = 'off'
      livingRoom.state = 'off'
      delete kitchen.last_changed
      delete livingRoom.last_changed
    }
  })

  it('toggles vacuum zones optimistically while Home Assistant input booleans are still stale', async () => {
    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    fireEvent.click(screen.getByRole('button', { name: /Main Floor Docked/i }))
    const dialog = await screen.findByRole('dialog')
    await clickModalTab(within(dialog), 'Rooms')

    const livingRoomZone = screen.getByRole('button', { name: 'Living Room' })
    const kitchenZone = screen.getByRole('button', { name: 'Kitchen' })
    expect(livingRoomZone).toHaveAttribute('data-active', 'false')
    expect(kitchenZone).toHaveAttribute('data-active', 'false')

    fireEvent.click(kitchenZone)
    fireEvent.click(livingRoomZone)

    expect(mockEntities['input_boolean.roborock_living_room_toggle'].state).toBe('off')
    expect(kitchenZone).toHaveAttribute('data-active', 'true')
    expect(livingRoomZone).toHaveAttribute('data-active', 'true')
    expect(kitchenZone).toHaveAccessibleName('Kitchen, cleaning order 1')
    expect(livingRoomZone).toHaveAccessibleName('Living Room, cleaning order 2')
    expect(within(kitchenZone).getByText('1')).toHaveAttribute('class', expect.stringContaining('zoneOrder'))
    expect(within(livingRoomZone).getByText('2')).toHaveAttribute('class', expect.stringContaining('zoneOrder'))
    expect(mockCallServiceCalls).toEqual([
      { domain: 'input_boolean', service: 'turn_on', target: 'input_boolean.roborock_kitchen_toggle' },
      { domain: 'select', service: 'select_option', target: 'select.valetudo_exaltedsneakydeer_mode', serviceData: { option: 'vacuum_and_mop' } },
      { domain: 'input_boolean', service: 'turn_on', target: 'input_boolean.roborock_living_room_toggle' },
    ])

    await clickModalTab(within(dialog), 'Controls')
    const selectedRoomsSummary = screen.getByText('Selected Rooms').closest('div') as HTMLElement
    expect(within(selectedRoomsSummary).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Kitchen', 'Living Room'])
    expect(within(selectedRoomsSummary).queryByText('No rooms are selected, and no areas are drawn. If you begin cleaning, the robot vacuum will attempt to clean every mapped area.')).not.toBeInTheDocument()
  })

  it('selects vacuum mode for vacuum-only rooms and leaves mode unchanged when the last room is removed', async () => {
    mockEntities['select.valetudo_exaltedsneakydeer_mode'].state = 'vacuum_and_mop'

    try {
      render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)
      fireEvent.click(screen.getByRole('button', { name: /Main Floor Docked/i }))
      const dialog = await screen.findByRole('dialog')
      await clickModalTab(within(dialog), 'Rooms')

      const livingRoomZone = screen.getByRole('button', { name: 'Living Room' })
      fireEvent.click(livingRoomZone)
      fireEvent.click(livingRoomZone)

      expect(mockCallServiceCalls).toEqual([
        { domain: 'input_boolean', service: 'turn_on', target: 'input_boolean.roborock_living_room_toggle' },
        { domain: 'select', service: 'select_option', target: 'select.valetudo_exaltedsneakydeer_mode', serviceData: { option: 'vacuum' } },
        { domain: 'input_boolean', service: 'turn_off', target: 'input_boolean.roborock_living_room_toggle' },
      ])
    } finally {
      mockEntities['select.valetudo_exaltedsneakydeer_mode'].state = 'vacuum'
    }
  })

  it('opens available vacuum cards as modal controls', async () => {
    render(<DashboardViewPage activePath="vacuums" onNavigate={() => undefined} path="vacuums" />)

    const musicRoomVacuum = screen.getByRole('button', { name: 'Music Room Unavailable' })
    expect(musicRoomVacuum).toHaveAttribute('data-icon', 'mdi:robot-vacuum-off')
    expect(musicRoomVacuum).toHaveAttribute('data-modal-opener', 'true')
    const mainFloorVacuum = screen.getByRole('button', { name: /main floor docked/i })
    expect(mainFloorVacuum).toHaveAttribute('data-tone', 'vacuum')
    expect(mainFloorVacuum).toHaveAttribute('data-icon', 'mdi:home')
    fireEvent.click(mainFloorVacuum)

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('data-size', 'workspace')
    expect(dialog).toHaveAttribute('data-scroll-mode', 'panes')
    expect(screen.getByRole('heading', { name: 'Main Floor Robot Vacuum' })).toBeInTheDocument()
    const mapPane = within(dialog).getByRole('group', { name: 'Main Floor map and status' })
    const controlsPane = within(dialog).getByRole('group', { name: 'Main Floor controls, rooms, auto-clean, actions, info' })
    expect(within(mapPane).getByRole('region', { name: 'Main Floor Valetudo map' })).toBeInTheDocument()
    expect(within(controlsPane).getByText('Battery')).toBeInTheDocument()
    expect(within(controlsPane).getByRole('group', { name: 'Dock Status Idle' })).toBeInTheDocument()
    expect(screen.queryByText('No error')).not.toBeInTheDocument()
    expect(within(controlsPane).getAllByRole('heading').map((heading) => heading.textContent)).toEqual(['Docked', 'Full Clean', 'Power Settings'])
    const fanSelect = screen.getByRole('combobox', { name: /Fan Balanced/i })
    expect(fanSelect).toHaveValue('balanced')
    expect(fanSelect.closest('[data-layout]')).toHaveAttribute('data-layout', 'default')
    expect(fanSelect.closest('[data-has-description]')).toHaveAttribute('data-has-description', 'true')
    const fanDescription = screen.getByText('Adjust suction strength for carpets, hard floors, and quieter cleaning.')
    expect(fanDescription).toBeInTheDocument()
    expect(fanDescription.closest('[data-native-select-field]')).toBeNull()
    expect(fanDescription.compareDocumentPosition(fanSelect) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByText('Set the cleaning mode, suction, and water level before starting the next run.')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Fan' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clean' })).toBeInTheDocument()
    await clickModalTab(within(dialog), 'Rooms')
    expect(screen.getByRole('button', { name: /living room/i })).toBeInTheDocument()
    await clickModalTab(within(dialog), 'Auto-Clean')
    expect(screen.getByRole('button', { name: 'Dining Room auto-clean enabled' })).toBeInTheDocument()
    await clickModalTab(within(dialog), 'Info')
    const mainFilter = within(controlsPane).getByRole('group', { name: 'Main Filter 54h left' })
    const detergent = within(controlsPane).getByRole('group', { name: 'Detergent OK' })
    const sensors = within(controlsPane).getByRole('group', { name: 'Sensors 2h left' })
    expect(mainFilter).toHaveAttribute('data-icon', 'mdi:air-filter')
    expect(detergent).toHaveAttribute('data-icon', 'mdi:bottle-tonic')
    expect(sensors).toHaveAttribute('data-icon', 'mdi:timer-alert-outline')
    expect(sensors).toHaveAttribute('data-tone', 'warning')
  })

  it.each([
    ['error', /Main Floor Error/i, 'Error', 'danger'],
    ['unavailable', 'Main Floor Unavailable', 'Unavailable', 'unavailable'],
  ])('opens %s vacuum cards for status access without calling Home Assistant', async (state, cardName, statusValue, statusTone) => {
    mockEntities['vacuum.valetudo_exaltedsneakydeer'].state = state
    render(<DashboardViewPage activePath="vacuums" onNavigate={() => undefined} path="vacuums" />)

    const card = screen.getByRole('button', { name: cardName })
    expect(card).toHaveAttribute('data-action-kind', 'modal')
    expect(card).toHaveAttribute('data-modal-opener', 'true')
    fireEvent.click(card)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Main Floor Robot Vacuum' })).toBeInTheDocument()
    const statusPill = within(dialog).getByText('Status').closest('[data-icon]')
    expect(statusPill).toHaveTextContent(statusValue)
    expect(statusPill).toHaveAttribute('data-tone', statusTone)
    if (state === 'unavailable') {
      expect(within(dialog).queryByLabelText('Unavailable')).not.toBeInTheDocument()
      expect(within(dialog).getByText('Last Reported Position').closest('[role="note"]')).toHaveTextContent('Last Reported Position')
      expect(within(dialog).getByText('Battery').closest('[data-icon]')).toHaveAttribute('data-tone', 'unavailable')
      expect(within(dialog).queryByText('Map Unavailable')).not.toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'Locate' })).toBeDisabled()
      expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
    }
    expect(mockCallServiceCalls).toEqual([])
  })

  it('ignores stale helper prose while the vacuum and raw error source are unavailable', async () => {
    mockEntities['vacuum.valetudo_elatedusedram'].state = 'unavailable'
    mockEntities['sensor.valetudo_elatedusedram_error'].state = 'unavailable'
    mockEntities['input_text.music_room_vacuum_error_message'].state = 'The battery is critically low and the vacuum will shut down soon.'
    render(<DashboardViewPage activePath="vacuums" onNavigate={() => undefined} path="vacuums" />)

    fireEvent.click(screen.getByRole('button', { name: 'Music Room Unavailable' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByText(/battery is critically low/i)).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Unavailable')).not.toBeInTheDocument()
    expect(within(dialog).getByText('Last Reported Position').closest('[role="note"]')).toHaveTextContent('Last Reported Position')
    expect(within(dialog).getByRole('button', { name: 'Locate' })).toBeDisabled()
    expect(mockCallServiceCalls).toEqual([])
  })

  it('renders only provenance-backed historical issues from a coherent status contract', async () => {
    mockEntities['vacuum.valetudo_elatedusedram'].state = 'unavailable'
    mockEntities['sensor.valetudo_elatedusedram_error'].state = 'unavailable'
    mockEntities['sensor.music_room_vacuum_status'] = entity('sensor.music_room_vacuum_status', 'unavailable', {
      active_conditions: [],
      availability: { since: '2026-08-21T21:51:49Z', status: 'unavailable' },
      command_policy: { mode: 'none', reason: 'primary_unavailable' },
      current_issue: { status: 'unknown' },
      last_issue: {
        code: 'vendor.unknown_error_75',
        provenance: 'recorder_backfill',
        raw: 'Unknown error 75',
        reported_at: '2026-08-21T21:20:11Z',
      },
      observed_vacuum_state: 'unavailable',
      vacuum_entity_id: 'vacuum.valetudo_elatedusedram',
      version: 1,
    })
    render(<DashboardViewPage activePath="vacuums" onNavigate={() => undefined} path="vacuums" />)

    fireEvent.click(screen.getByRole('button', { name: 'Music Room Unavailable' }))

    const dialog = await screen.findByRole('dialog')
    const previousIssue = within(dialog).getByLabelText('Previous Issue')
    expect(previousIssue).toHaveTextContent('Unknown error 75')
    expect(previousIssue).toHaveTextContent('Observed')
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Locate' })).toBeDisabled()
  })

  it('does not present a previously cleared status-contract issue as unresolved history', async () => {
    mockEntities['vacuum.valetudo_elatedusedram'].state = 'unavailable'
    mockEntities['sensor.valetudo_elatedusedram_error'].state = 'unavailable'
    mockEntities['sensor.music_room_vacuum_status'] = entity('sensor.music_room_vacuum_status', 'unavailable', {
      active_conditions: [],
      availability: { since: '2026-08-27T21:00:00Z', status: 'unavailable' },
      command_policy: { mode: 'none', reason: 'primary_unavailable' },
      current_issue: { status: 'unknown' },
      last_issue: {
        cleared_at: '2026-08-26T18:00:00Z',
        code: 'navigation.stuck',
        provenance: 'observed',
        raw: 'Robot stuck or trapped',
        reported_at: '2026-08-26T17:00:00Z',
      },
      observed_vacuum_state: 'unavailable',
      vacuum_entity_id: 'vacuum.valetudo_elatedusedram',
      version: 1,
    })
    render(<DashboardViewPage activePath="vacuums" onNavigate={() => undefined} path="vacuums" />)

    fireEvent.click(screen.getByRole('button', { name: 'Music Room Unavailable' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByLabelText('Previous Issue')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Robot stuck or trapped')).not.toBeInTheDocument()
  })

  it('fails closed when the primary vacuum is available but its error source is unreadable', async () => {
    mockEntities['vacuum.valetudo_exaltedsneakydeer'].state = 'docked'
    mockEntities['sensor.valetudo_exaltedsneakydeer_error'].state = 'unavailable'
    mockEntities['sensor.main_floor_vacuum_status'] = entity('sensor.main_floor_vacuum_status', 'docked', {
      active_conditions: [],
      availability: { since: null, status: 'available' },
      command_policy: { mode: 'normal', reason: null },
      current_issue: { status: 'clear' },
      last_issue: null,
      observed_vacuum_state: 'docked',
      vacuum_entity_id: 'vacuum.valetudo_exaltedsneakydeer',
      version: 1,
    })
    render(<DashboardViewPage activePath="vacuums" onNavigate={() => undefined} path="vacuums" />)

    fireEvent.click(screen.getByRole('button', { name: /Main Floor Docked/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText('Error Source Unavailable')).toHaveTextContent('The current vacuum error status cannot be confirmed because its error source is unavailable.')
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Locate' })).toBeEnabled()
    expect(within(dialog).queryByRole('button', { name: 'Clean' })).not.toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([])
  })

  it('keeps unresolved history visible while the recovered primary has an unreadable error source', async () => {
    mockEntities['vacuum.valetudo_elatedusedram'].state = 'docked'
    mockEntities['sensor.valetudo_elatedusedram_error'].state = 'unavailable'
    mockEntities['sensor.valetudo_elatedusedram_battery_level'].state = '100'
    mockEntities['sensor.valetudo_elatedusedram_status_flag'].state = 'none'
    mockEntities['sensor.valetudo_elatedusedram_dock_status'].state = 'idle'
    mockEntities['camera.valetudo_elatedusedram_map_data'].state = 'idle'
    mockEntities['sensor.music_room_vacuum_status'] = entity('sensor.music_room_vacuum_status', 'docked', {
      active_conditions: [],
      availability: { since: null, status: 'available' },
      command_policy: { mode: 'restricted', reason: 'source_unreadable' },
      current_issue: { status: 'unknown' },
      last_issue: {
        cleared_at: null,
        code: 'navigation.stuck',
        provenance: 'observed',
        raw: 'Robot stuck or trapped',
        reported_at: '2026-08-26T17:00:00Z',
      },
      observed_vacuum_state: 'docked',
      vacuum_entity_id: 'vacuum.valetudo_elatedusedram',
      version: 1,
    })
    render(<DashboardViewPage activePath="vacuums" onNavigate={() => undefined} path="vacuums" />)

    fireEvent.click(screen.getByRole('button', { name: /Music Room Docked/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText('Error Source Unavailable')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Previous Issue')).toHaveTextContent('Robot stuck or trapped')
    expect(within(dialog).getByRole('button', { name: 'Locate' })).toBeEnabled()
  })

  it('keeps an open vacuum status modal mounted when the vacuum goes offline', async () => {
    mockEntities['input_text.main_floor_vacuum_error_message'].state = 'Battery level is low. The vacuum will return to charge.'
    render(<DashboardViewPage activePath="vacuums" onNavigate={() => undefined} path="vacuums" />)
    fireEvent.click(screen.getByRole('button', { name: /Main Floor Docked/i }))
    const dialog = await screen.findByRole('dialog')

    act(() => setMockEntityState('vacuum.valetudo_exaltedsneakydeer', 'unavailable'))

    expect(screen.getByRole('dialog')).toBe(dialog)
    const statusPill = within(dialog).getByText('Status').closest('[data-icon]')
    await waitFor(() => expect(statusPill).toHaveTextContent('Unavailable'))
    expect(statusPill).toHaveAttribute('data-tone', 'unavailable')
    expect(within(dialog).getByText('Battery').closest('[data-icon]')).toHaveTextContent('Unknown')
    expect(within(dialog).getByRole('group', { name: 'Dock Status Unknown' })).toBeInTheDocument()
    expect(within(dialog).getByText('Last Reported Position').closest('[role="note"]')).toHaveTextContent('Last Reported Position')
    expect(within(dialog).queryByText('Map Unavailable')).not.toBeInTheDocument()
    expect(within(dialog).queryByText(/Battery level is low/i)).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Locate' })).toBeDisabled()
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([])
  })

  it('opens typed vacuum outcomes in the same mounted sheet and restores overview focus without HA calls', async () => {
    mockEntities['sensor.main_floor_vacuum_coordinator_session_state'].attributes = {
      while_away_outcomes: structuredClone(NINE_ROOM_VACUUM_OUTCOME_CONTRACT),
    }
    render(<DashboardViewPage activePath="vacuums" onNavigate={() => undefined} path="vacuums" />)

    fireEvent.click(screen.getByRole('button', { name: /Main Floor Docked/i }))
    const dialog = await screen.findByRole('dialog')
    const summary = within(dialog).getByRole('button', { name: 'Open Main Floor Automatic Cleaning Report for Aug 19, 2026' })
    summary.focus()
    fireEvent.click(summary)

    expect(screen.getByRole('dialog')).toBe(dialog)
    expect(dialog).toHaveAttribute('data-size', 'workspace')
    expect(dialog).toHaveAttribute('data-scroll-mode', 'body')
    expect(within(dialog).getByRole('heading', { name: 'Main Floor · Automatic Cleaning Report' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('tablist', { name: 'Main Floor modal sections' })).not.toBeInTheDocument()
    expect(within(dialog).getAllByLabelText('Dining Room Failed')).toHaveLength(1)
    expect(within(dialog).queryByRole('button', { name: 'Show Dining Room History' })).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Show Office History' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Show Office Technical Vacuum Diagnostics' }))
    expect(mockCallServiceCalls).toEqual([])

    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to Vacuum Controls' }))
    await waitFor(() => expect(
      within(dialog).getByRole('button', { name: 'Open Main Floor Automatic Cleaning Report for Aug 19, 2026' }),
    ).toHaveFocus())
    expect(dialog).toHaveAttribute('data-scroll-mode', 'panes')
    expect(within(dialog).getByRole('tablist', { name: 'Main Floor modal sections' })).toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([])
  })

  it('opens retained v2 uncertainty instead of the misleading legacy issue fallback', async () => {
    mockEntities['sensor.main_floor_vacuum_coordinator_session_state'].attributes = {
      ...MISLEADING_V2_LEGACY_VACUUM_OUTCOMES,
      while_away_outcomes: structuredClone(EVIDENCE_FREE_V2_VACUUM_OUTCOME_PAYLOAD),
    }
    render(<DashboardViewPage activePath="vacuums" onNavigate={() => undefined} path="vacuums" />)

    fireEvent.click(screen.getByRole('button', { name: /Main Floor Docked/i }))
    const dialog = await screen.findByRole('dialog')
    const summary = within(dialog).getByRole('button', { name: 'Open Main Floor Automatic Cleaning Report for Sep 17, 2026' })
    expect(summary).toHaveTextContent('1 Room Unverified • 1 Room Needs Attention')
    expect(dialog).not.toHaveTextContent(MISLEADING_V2_LEGACY_VACUUM_OUTCOMES.while_away_issues[0])

    fireEvent.click(summary)

    const office = within(dialog).getByLabelText('Office Completion Unverified')
    expect(office).toHaveTextContent('Vacuuming completion could not be verified.')
    expect(office).toHaveTextContent('Vacuuming remains due.')
    expect(office).not.toHaveTextContent('Could not clean')
    expect(mockCallServiceCalls).toEqual([])
  })

  it('keeps typed outcomes authoritative in room-source content when detail has no opener', () => {
    mockEntities['sensor.main_floor_vacuum_coordinator_session_state'].attributes = {
      ...MISLEADING_V2_LEGACY_VACUUM_OUTCOMES,
      while_away_outcomes: structuredClone(EVIDENCE_FREE_V2_VACUUM_OUTCOME_PAYLOAD),
    }
    const mainFloorVacuum = VACUUMS.find((vacuum) => vacuum.coordinatorSessionEntityId)
    if (!mainFloorVacuum) throw new Error('Expected Main Floor vacuum fixture')

    render(<VacuumRoomSourceModalContent vacuum={mainFloorVacuum} />)

    expect(screen.getByRole('heading', { name: 'Main Floor Cleaning Report' })).toBeInTheDocument()
    expect(document.querySelector('[data-action-kind="state"][data-icon="mdi:help-circle-outline"]')).toHaveTextContent(
      /Sep 17, 2026\s*1 Room Unverified • 1 Room Needs Attention/,
    )
    expect(screen.queryByText(MISLEADING_V2_LEGACY_VACUUM_OUTCOMES.while_away_issues[0])).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Automatic Cleaning Report for/ })).not.toBeInTheDocument()
  })

  it('renders a noninteractive typed summary for room-source content without legacy arrays', () => {
    mockEntities['sensor.main_floor_vacuum_coordinator_session_state'].attributes = {
      while_away_outcomes: structuredClone(NINE_ROOM_VACUUM_OUTCOME_CONTRACT),
    }
    const mainFloorVacuum = VACUUMS.find((vacuum) => vacuum.coordinatorSessionEntityId)
    if (!mainFloorVacuum) throw new Error('Expected Main Floor vacuum fixture')

    render(<VacuumRoomSourceModalContent vacuum={mainFloorVacuum} />)

    expect(screen.getByRole('heading', { name: 'Main Floor Cleaning Report' })).toBeInTheDocument()
    expect(document.querySelector('[data-action-kind="state"][data-icon="mdi:alert-circle"]')).toHaveTextContent(
      /Aug 19, 2026\s*4 Rooms Completed • 4 Rooms Need Attention • 1 Error/,
    )
    expect(screen.queryByRole('button', { name: /Automatic Cleaning Report for/ })).not.toBeInTheDocument()
  })

  it('keeps the captured outcome detail stable across live legacy updates until Back', async () => {
    const session = mockEntities['sensor.main_floor_vacuum_coordinator_session_state']
    session.attributes = {
      ...LEGACY_VACUUM_OUTCOMES,
      while_away_outcomes: structuredClone(NINE_ROOM_VACUUM_OUTCOME_CONTRACT),
    }
    const view = render(<DashboardViewPage activePath="vacuums" onNavigate={() => undefined} path="vacuums" />)
    fireEvent.click(screen.getByRole('button', { name: /Main Floor Docked/i }))
    const dialog = await screen.findByRole('dialog')
    const body = dialog.querySelector<HTMLElement>('[data-modal-sheet-body="true"]')!
    body.scrollTop = 47
    fireEvent.click(within(dialog).getByRole('button', { name: /Open Main Floor Automatic Cleaning Report/ }))

    session.attributes = { ...LEGACY_VACUUM_OUTCOMES }
    view.rerender(<DashboardViewPage activePath="vacuums" onNavigate={() => undefined} path="vacuums" />)

    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(within(dialog).getByRole('heading', { name: 'Main Floor · Automatic Cleaning Report' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Dining Room Failed')).toBeInTheDocument()
    expect(within(dialog).queryByRole('tablist', { name: 'Main Floor modal sections' })).not.toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to Vacuum Controls' }))

    const legacySection = await waitFor(() => {
      const note = within(dialog).getByRole('note', { name: 'Cleaned' })
      const section = note.closest<HTMLElement>('section')
      expect(section).toBeTruthy()
      return section!
    })
    await waitFor(() => expect(legacySection).toHaveFocus())
    expect(body.scrollTop).toBe(47)
    expect(within(dialog).getByRole('tablist', { name: 'Main Floor modal sections' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /Automatic Cleaning Report for/ })).not.toBeInTheDocument()
  })

  it('preserves the outcome detail while the shared sheet performs its mounted close animation', async () => {
    mockEntities['sensor.main_floor_vacuum_coordinator_session_state'].attributes = {
      while_away_outcomes: structuredClone(NINE_ROOM_VACUUM_OUTCOME_CONTRACT),
    }
    render(<DashboardViewPage activePath="vacuums" onNavigate={() => undefined} path="vacuums" />)
    fireEvent.click(screen.getByRole('button', { name: /Main Floor Docked/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: /Open Main Floor Automatic Cleaning Report/ }))
    const detailTitle = within(dialog).getByRole('heading', { name: 'Main Floor · Automatic Cleaning Report' })

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))

    await waitFor(() => expect(dialog).toHaveAttribute('data-state', 'closed'))
    expect(detailTitle).toBeInTheDocument()
    expect(dialog).toHaveAttribute('inert')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('shows an incomplete report state while keeping legacy details secondary', async () => {
    mockEntities['sensor.main_floor_vacuum_coordinator_session_state'].attributes = {
      ...LEGACY_VACUUM_OUTCOMES,
      while_away_outcomes: {
        ...structuredClone(NINE_ROOM_VACUUM_OUTCOME_CONTRACT),
        complete: false,
      },
    }
    render(<DashboardViewPage activePath="vacuums" onNavigate={() => undefined} path="vacuums" />)
    fireEvent.click(screen.getByRole('button', { name: /Main Floor Docked/i }))
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByRole('heading', { name: 'Main Floor Cleaning Report' })).toBeInTheDocument()
    expect(within(dialog).getByText('Report Still Being Prepared')).toBeInTheDocument()
    expect(within(dialog).getByText('Final counts are not available.')).toBeInTheDocument()
    expect(within(dialog).getByText('Cleaned Gym')).not.toBeVisible()
    expect(within(dialog).getByText('Could not clean Dining Room because the clean water tank is empty')).not.toBeVisible()
    expect(within(dialog).queryByRole('button', { name: /Automatic Cleaning Report for/ })).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Show Main Floor Unstructured Report Details' }))
    expect(within(dialog).getByText('Cleaned Gym')).toBeVisible()
    expect(within(dialog).getByText('Could not clean Dining Room because the clean water tank is empty')).toBeVisible()
  })

  it.each([
    ['docked', 'mdi:home', 'vacuum'],
    ['idle', 'mdi:robot-vacuum', 'neutral'],
    ['cleaning', 'mdi:broom', 'vacuum'],
    ['paused', 'mdi:pause-circle', 'warning'],
    ['returning', 'mdi:home-import-outline', 'vacuum'],
    ['error', 'mdi:alert-circle', 'danger'],
    ['unavailable', 'mdi:robot-vacuum-off', 'neutral'],
  ])('renders the %s vacuum card with its reusable state icon and tone', (state, icon, tone) => {
    mockEntities['vacuum.valetudo_exaltedsneakydeer'].state = state
    render(<DashboardViewPage activePath="vacuums" onNavigate={() => undefined} path="vacuums" />)

    const robotSection = screen.getByRole('heading', { name: 'Robot Vacuums' }).closest('section')
    const card = within(robotSection as HTMLElement).getByLabelText(/^Main Floor/)
    expect(card).toHaveAttribute('data-icon', icon)
    expect(card).toHaveAttribute('data-tone', tone)
  })

  it('shows robot vacuums and auto-clean controls in the same order on the Vacuums route', () => {
    render(<DashboardViewPage activePath="vacuums" onNavigate={() => undefined} path="vacuums" />)

    const robotSection = screen.getByRole('heading', { name: 'Robot Vacuums' }).closest('section')
    expect(robotSection).toBeTruthy()
    const robotGrid = within(robotSection as HTMLElement).getByRole('group', { name: 'Robot vacuums' })
    expect(robotGrid).toHaveAttribute('data-dynamic-grid', 'true')
    expect(robotGrid.lastElementChild).toHaveAttribute('data-dynamic-grid-span', '2')
    const mainFloorVacuum = within(robotSection as HTMLElement).getByLabelText(/Main Floor/)
    const musicRoomVacuum = within(robotSection as HTMLElement).getByLabelText(/^Music Room/)
    const theaterRoomVacuum = within(robotSection as HTMLElement).getByLabelText(/Theater Room/)
    expect(mainFloorVacuum.compareDocumentPosition(musicRoomVacuum) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(musicRoomVacuum.compareDocumentPosition(theaterRoomVacuum) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const autoCleanSection = screen.getByRole('heading', { name: 'Auto-Clean' }).closest('section')
    expect(autoCleanSection).toBeTruthy()
    const autoCleanGrid = within(autoCleanSection as HTMLElement).getByRole('group', { name: 'Vacuum auto-clean controls' })
    expect(autoCleanGrid).toHaveAttribute('data-dynamic-grid', 'true')
    expect(autoCleanGrid.lastElementChild).toHaveAttribute('data-dynamic-grid-span', '2')
    const buttons = within(autoCleanSection as HTMLElement).getAllByRole('button')
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Main Floor Enabled',
      'Music Room Enabled',
      'Theater Room Enabled',
    ])

    fireEvent.click(buttons[0])
    fireEvent.click(buttons[1])
    fireEvent.click(buttons[2])

    expect(mockCallServiceCalls).toEqual([
      { domain: 'switch', service: 'turn_on', target: 'switch.main_floor_vacuum_coordinator_pause' },
      { domain: 'automation', service: 'turn_off', target: 'automation.automatically_vacuum_or_mop_music_room' },
      { domain: 'automation', service: 'turn_off', target: 'automation.automatically_vacuum_theater_room_on_schedule' },
    ])
  })

  it('keeps every room vacuum title aligned with its shared vacuum configuration', () => {
    const roomVacuumCards = Object.values(ROOM_PAGE_CONFIGS)
      .flatMap((room) => room.sourceSections)
      .flatMap((section) => section.cards)
      .filter((card) => card.kind === 'vacuum')

    expect(roomVacuumCards).toHaveLength(VACUUMS.length)
    for (const card of roomVacuumCards) {
      const vacuum = VACUUMS.find((candidate) => candidate.entityId === card.entityId)
      expect(vacuum?.title).toBe(card.title)
      expect(card.subtitleEntityIds).toBeUndefined()
    }
  })

  it('opens the real Vacuums route modal from a vacuum URL hash', async () => {
    mockEntities['vacuum.valetudo_exaltedsneakydeer'].state = 'unavailable'
    window.history.replaceState(null, '', `${window.location.pathname}#main-floor-robot-vacuum`)
    render(<DashboardViewPage activePath="vacuums" onNavigate={() => undefined} path="vacuums" />)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Main Floor Robot Vacuum' })).toBeInTheDocument()
  })

  it('preloads the Vacuums route without opening a vacuum URL hash modal', () => {
    window.history.replaceState(null, '', `${window.location.pathname}#main-floor-robot-vacuum`)
    render(<DashboardViewPage activePath="vacuums" onNavigate={() => undefined} path="vacuums" preload />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Robot Vacuums' })).toBeInTheDocument()
    const tile = screen.getByLabelText('Main Floor Unavailable')
    expect(tile.tagName).toBe('DIV')
    expect(tile).not.toHaveAttribute('data-modal-opener')
    expect(screen.queryByRole('button', { name: /Main Floor Unavailable/ })).not.toBeInTheDocument()
  })
})
