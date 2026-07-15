import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { act } from 'react'
import { vi } from 'vitest'
import { materialIconPath } from '../components/core/iconPaths'
import { INVENTORY_SEARCH_DEBOUNCE_MS } from '../components/hass/EverShelfInventoryControls'
import { MEDIA_REMOTE_MODAL_STYLE } from '../components/hass/mediaRemoteModalStyle'
import { valueToThermostatPoint } from '../components/hass/thermostatDialGeometry'
import { VACUUM_MODAL_STYLE } from '../components/hass/vacuumModalStyle'
import { DashboardViewPage } from './DashboardViewPage'
import { CONTACT_GROUPS } from '../constants/atAGlance'
import { ROOM_PAGE_CONFIGS, ROOM_PAGE_ORDER } from '../constants/roomPages'
import { entity, mockCallServiceCalls, mockEntities, mockFreeSleepScheduleAttributes, mockState, mockTodoItemsByEntity, resetMockHass } from '../test/mocks/hakitCoreState'

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

const ROOM_SOURCE_SECURITY_SIZED_MODAL_STYLE = {
  '--modal-desktop-height': 'auto',
  '--modal-desktop-max-width': '500px',
  '--modal-desktop-width': '500px',
}
const MODAL_TAB_TEST_SETTLE_MS = 340

type RoleScope = Pick<typeof screen, 'getByRole'>

async function settleModalTabTransition() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, MODAL_TAB_TEST_SETTLE_MS))
  })
}

async function clickModalTab(scope: RoleScope, name: string) {
  const button = scope.getByRole('button', { name })
  fireEvent.pointerDown(button)
  fireEvent.click(button)
  await settleModalTabTransition()
  return button
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
  return quantity && quantity > 1 ? `Quantity ${quantity} - ${label}` : label
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
    mockEntities['alarm_control_panel.aqara_hub_m3_0056_security_system_2'].state = 'armed_home'
    mockEntities['binary_sensor.all_contact_sensors'].state = 'off'
    mockEntities['binary_sensor.contact_sensors'].state = 'off'
    CONTACT_GROUPS.flatMap((group) => group.items).forEach((item) => {
      mockEntities[item.entityId].state = 'off'
    })
    mockEntities['select.living_room_air_purifier_fan_mode'].state = 'Auto'
    mockEntities['select.living_room_air_purifier_auto_mode'].state = 'Default'
    mockEntities['fan.living_room_air_purifier_levoit_purifier'].attributes.percentage = 33
    mockEntities['vacuum.valetudo_exaltedsneakydeer'].state = 'docked'
    mockEntities['sensor.valetudo_exaltedsneakydeer_status_flag'].state = 'ready'
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
    mockEntities['binary_sensor.nightcanvasrestful_left_alarm_vibrating'].state = 'off'
    mockEntities['binary_sensor.nightcanvasrestful_left_presence'].state = 'on'
    mockEntities['binary_sensor.nightcanvasrestful_right_alarm_vibrating'].state = 'off'
    mockEntities['binary_sensor.nightcanvasrestful_right_presence'].state = 'off'
    mockEntities['media_player.theater_room_shield'].state = 'off'
    mockEntities['media_player.theater'].state = 'off'
    mockEntities['media_player.sony_projector'].state = 'off'
    mockEntities['switch.guest_bathroom_fan_switch_top'].state = 'off'
    mockEntities['switch.guest_bathroom_towel_rack_switch_top'].state = 'on'
    mockEntities['switch.master_bathroom_fan_switch_top'].state = 'off'
    mockEntities['switch.master_bathroom_towel_rack_switch_top'].state = 'on'
    mockEntities['cover.left_door'].state = 'closed'
    mockEntities['cover.right_door'].state = 'closed'
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

  it('shows the Rooms FAB on room pages and navigates through the room picker', async () => {
    const navigate = vi.fn()
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={navigate} path="master-bedroom" />)

    const roomsButton = screen.getByRole('button', { name: 'Rooms' })
    expect(roomsButton).toHaveTextContent('Rooms')
    fireEvent.click(roomsButton)

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
      expect(floatingDock).toContainElement(screen.getByRole('button', { name: 'Rooms' }))
      expect(within(floatingDock as HTMLElement).getAllByRole('button').map((button) => button.textContent?.trim())).toEqual(['Scan Item', 'Rooms'])
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
      expect(screen.getByRole('button', { name: 'Scan Barcode Again' })).toBeEnabled()
      expect(screen.queryByText('Source: mock')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Live item scan camera feed')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
      expect(camera.stop).toHaveBeenCalled()

      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      await waitFor(() => expect(camera.stop).toHaveBeenCalled())
    } finally {
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

      expect(await screen.findByRole('status')).toHaveTextContent('Processing...')
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

      expect(await screen.findByRole('status')).toHaveTextContent('Processing...')
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
    fireEvent.click(screen.getAllByRole('button', { name: /Climate/i })[0])
    let dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getAllByRole('heading', { name: 'Living Room Climate' })).toHaveLength(1)
    expect(within(dialog).getByText('69°F - 72°F')).toBeInTheDocument()
    view.unmount()
    window.history.replaceState(null, '', window.location.pathname)

    view = renderLivingRoom()
    fireEvent.click(screen.getAllByRole('button', { name: /Occupancy/i })[0])
    dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getAllByRole('heading', { name: 'Living Room Occupancy' })).toHaveLength(1)
    expect(within(dialog).getByText('Occupied')).toBeInTheDocument()
    view.unmount()
    window.history.replaceState(null, '', window.location.pathname)

    renderLivingRoom()
    fireEvent.click(screen.getAllByRole('button', { name: /Air Quality/i })[0])
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
    expect(dialog).toHaveStyle(ROOM_SOURCE_SECURITY_SIZED_MODAL_STYLE)
    expect(within(dialog).getByRole('heading', { name: 'Guest Room: Vent' })).toBeInTheDocument()
    expect(within(dialog).getByRole('article', { name: /^Vent Open$/i })).toBeInTheDocument()
    view.unmount()
    window.history.replaceState(null, '', window.location.pathname)

    view = renderGuestRoom()
    fireEvent.click(screen.getByRole('button', { name: /^Lights On$/i }))
    dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveStyle(ROOM_SOURCE_SECURITY_SIZED_MODAL_STYLE)
    expect(screen.getByRole('heading', { name: 'Guest Room Lights' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /TV Light On/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bed Light Off/i })).toBeInTheDocument()
    view.unmount()
    window.history.replaceState(null, '', window.location.pathname)

    view = renderGuestRoom()
    fireEvent.click(screen.getByRole('button', { name: /^Climate 69°F - 71°F$/i }))
    dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveStyle(ROOM_SOURCE_SECURITY_SIZED_MODAL_STYLE)
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
    expect(dialog).toHaveStyle(ROOM_SOURCE_SECURITY_SIZED_MODAL_STYLE)
    expect(within(dialog).getByRole('heading', { name: 'Guest Room Occupancy' })).toBeInTheDocument()
    expect(within(dialog).getByText('Detected')).toBeInTheDocument()
    view.unmount()
    window.history.replaceState(null, '', window.location.pathname)

    view = renderGuestRoom()
    fireEvent.click(screen.getByRole('button', { name: /^Window Closed$/i }))
    dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveStyle(ROOM_SOURCE_SECURITY_SIZED_MODAL_STYLE)
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
    expect(dialog).toHaveStyle(ROOM_SOURCE_SECURITY_SIZED_MODAL_STYLE)
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
    expect(screen.getByText('Disables automatic locking of the front door. Useful for when contractors are over, or we have people frequently entering/leaving the home.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Front Door Auto-Lock On/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Front Door Auto-Lock On/i })).toHaveStyle({ '--card-rgb': '67 160 71' })
    expect(screen.getByRole('heading', { name: 'Living Room Power Recovery' })).toBeInTheDocument()
    expect(screen.getByText('If the living room switch loses power and comes back with the relay off, run this to temporarily couple the top paddle, unlock the relay, turn power back on, relock it, and return the paddle to decoupled mode.')).toBeInTheDocument()
    const recoveryButton = screen.getByRole('button', { name: 'Attempt to turn power back on in Living Room' })
    expect(recoveryButton).toHaveAttribute('data-automation-target', 'automation.attempt_to_turn_power_back_on_in_living_room')
    expect(recoveryButton.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:flash'))
    expect(screen.getByRole('heading', { name: 'Presence-Based Light Overrides' })).toBeInTheDocument()
    expect(screen.getByText('Enable or disable presence-based lighting in specific rooms. Useful for when we have company, or need to quickly keep lights on or off without using the voice commands.')).toBeInTheDocument()
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
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveAttribute('data-surface', 'hass-popup')
    expect(screen.getByRole('heading', { name: 'Presence-Based Overrides' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Living Room On · Active/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Living Room On · Active/i })).toHaveStyle({ '--card-rgb': '67 160 71' })
    expect(screen.getByRole('button', { name: /Living Room On · Active/i }).querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:lightbulb-auto'))
    expect(screen.getByRole('button', { name: /Upper Deck On · Active/i })).toBeInTheDocument()
    fireEvent.click(recoveryButton)
    fireEvent.click(screen.getByRole('button', { name: /Living Room On · Active/i }))

    expect(mockCallServiceCalls).toEqual([
      {
        domain: 'automation',
        service: 'trigger',
        target: 'automation.attempt_to_turn_power_back_on_in_living_room',
      },
      {
        domain: 'script',
        service: 'toggle_presence_lighting_override',
        serviceData: { presence_switch: 'switch.living_room_presence_living_room_lights_presence_allowed' },
      },
    ])
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
    fireEvent.click(admin)
    expect(navigate).toHaveBeenLastCalledWith('admin')

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
    expect(hassSettings).toHaveAttribute('data-external-path', '/config')
  })

  it('keeps the Settings bottom nav item active on settings subpages', () => {
    render(<DashboardViewPage activePath="vacation" onNavigate={() => undefined} path="vacation" />)

    const bottomNav = screen.getByRole('navigation', { name: 'Dashboard sections' })
    expect(within(bottomNav).getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-current', 'page')
  })

  it('renders the Vacation page and blocks Vacation Mode until the checklist is complete', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 14, 10, 1, 0))
    const navigate = vi.fn()

    try {
      render(<DashboardViewPage activePath="settings" onNavigate={navigate} path="vacation" />)

      expect(screen.getByRole('heading', { name: 'Vacation' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Vacation Mode' })).toBeInTheDocument()
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

    try {
      render(<DashboardViewPage activePath="settings" onNavigate={() => undefined} path="vacation" />)

      const vacationMode = screen.getByRole('button', { name: 'Vacation Mode Off' })
      fireEvent.click(vacationMode)

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { hidden: true, name: 'Vacation Mode Pending' })).toHaveStyle({ '--card-rgb': '30 136 229' })
      expect(screen.getByRole('button', { hidden: true, name: 'Vacation Mode Pending' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.queryByRole('heading', { name: 'Vacation Dates' })).not.toBeInTheDocument()
      const dialog = screen.getByRole('dialog', { name: 'Confirm Vacation' })
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
    render(<DashboardViewPage activePath="settings" onNavigate={() => undefined} path="vacation" />)

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

  it('keeps the Whole Home thermostat range colors visible while the aggregate climate is off', () => {
    render(<DashboardViewPage activePath="ecobee" onNavigate={() => undefined} path="ecobee" />)

    expect(screen.getByRole('region', { name: /Whole Home thermostat Idle 71.0°F 72.0 · 74.0/i })).toBeInTheDocument()
    expect(screen.getAllByTestId('control-slider-circular')[0]).toHaveStyle({ '--ha-control-slider-color': 'rgba(255, 255, 255, 0.78)', '--ha-control-slider-high-color': '#2c8e98', '--ha-control-slider-low-color': '#cd5401' })
    expect(screen.getAllByTestId('control-slider-circular')[0]).toHaveAttribute('data-inactive', 'false')
  })

  it('renders HA-owned vacation, non-vacation, and guest home-away transitions without inferring from raw inputs', async () => {
    const view = render(<DashboardViewPage activePath="ecobee" onNavigate={() => undefined} path="ecobee" />)

    expect(screen.queryByLabelText(/Whole Home (?:Away|Vacation) Mode/)).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Whole Home thermostat Idle 71.0°F 72.0 · 74.0/i })).toBeInTheDocument()

    mockEntities['input_boolean.vacation_mode'].state = 'on'
    mockEntities['binary_sensor.thermostat_contact_sensors_away_mode_active'].state = 'on'
    mockEntities['sensor.thermostat_effective_home_away'].state = 'Away'
    mockEntities['sensor.thermostat_home_away_reason'].state = 'Vacation Mode is active and everyone is away; TCS is using Eco Away targets.'
    view.rerender(<DashboardViewPage activePath="ecobee" onNavigate={() => undefined} path="ecobee" />)

    const hero = screen.getByRole('region', { name: /Whole Home thermostat Idle 71.0°F 62.0 · 78.0/i })
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
    view.rerender(<DashboardViewPage activePath="ecobee" onNavigate={() => undefined} path="ecobee" />)

    expect(screen.getByRole('region', { name: /Whole Home thermostat Idle 71.0°F 63.0 · 78.0/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Whole Home Away Mode')).toBeInTheDocument()
    expect(screen.getByText('Away Mode Active. The room may be cooler or warmer than your heat/cool targets to save energy while away.')).toBeInTheDocument()

    mockEntities['input_boolean.vacation_mode'].state = 'on'
    mockEntities['sensor.thermostat_effective_home_away'].state = 'Home'
    mockEntities['sensor.thermostat_home_away_reason'].state = 'Guest stay protection is active during Vacation Mode, so TCS is enforcing home-style temperatures.'
    mockEntities['climate.thermostat_contact_sensors_living_room_virtual_thermostat'].attributes.away_mode_active = false
    view.rerender(<DashboardViewPage activePath="ecobee" onNavigate={() => undefined} path="ecobee" />)

    expect(screen.queryByLabelText(/Whole Home (?:Away|Vacation) Mode/)).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Whole Home thermostat Idle 71.0°F 72.0 · 74.0/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Living Room 70.2°F · Inactive' }))
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
    const view = render(<DashboardViewPage activePath="ecobee" onNavigate={() => undefined} path="ecobee" />)

    let wholeHomeDial = screen.getByRole('region', { name: /Whole Home thermostat Idle 71.0°F 62.0 · 78.0/i })
    expectRangeHandlePositions(wholeHomeDial, 62, 78)
    expect(screen.getByLabelText('Whole Home Vacation Mode')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Living Room 70.2°F · Inactive' }))
    const dialog = await screen.findByRole('dialog', { name: 'Living Room' })
    let roomDial = within(dialog).getByRole('region', { name: /Living Room thermostat Idle 70.2°F 72.0 · 74.0/i })
    expectRangeHandlePositions(roomDial, 72, 74)
    expect(within(dialog).getByLabelText('Living Room Vacation Mode')).toBeInTheDocument()

    mockEntities['input_boolean.vacation_mode'].state = 'off'
    mockEntities['sensor.thermostat_home_away_reason'].state = 'Everyone is away; TCS is keeping Eco active without heating or cooling.'
    view.rerender(<DashboardViewPage activePath="ecobee" onNavigate={() => undefined} path="ecobee" />)

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
    view.rerender(<DashboardViewPage activePath="ecobee" onNavigate={() => undefined} path="ecobee" />)

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
    render(<DashboardViewPage activePath="ecobee" onNavigate={() => undefined} path="ecobee" />)

    fireEvent.click(screen.getByRole('button', { name: 'Living Room 70.2°F · Inactive' }))
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
    window.history.replaceState(null, '', '/at-a-glance/ecobee#living-room')

    const view = render(<DashboardViewPage activePath="ecobee" onNavigate={() => undefined} path="ecobee" />)

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
    const view = render(<DashboardViewPage activePath="ecobee" onNavigate={() => undefined} path="ecobee" />)

    expect(screen.getByLabelText(/Thermostat Hub Off/i)).toHaveAttribute('data-thermal-status', 'cool')

    view.unmount()
    mockEntities['climate.thermostat_hub_w200'].attributes.hvac_action = 'heating'
    render(<DashboardViewPage activePath="ecobee" onNavigate={() => undefined} path="ecobee" />)

    expect(screen.getByLabelText(/Thermostat Hub Off/i)).toHaveAttribute('data-thermal-status', 'heat')
  })

  it('uses HASS climate dropdowns for Thermostat Hub mode and fan mode when exposed', async () => {
    mockEntities['climate.thermostat_hub_w200'].attributes.fan_modes = ['auto', 'off']
    mockEntities['climate.thermostat_hub_w200'].attributes.fan_mode = 'auto'
    render(<DashboardViewPage activePath="ecobee" onNavigate={() => undefined} path="ecobee" />)

    fireEvent.click(screen.getByLabelText(/Thermostat Hub Mode Off/i))
    let pickerSheet = await screen.findByRole('dialog')
    fireEvent.click(within(pickerSheet).getByRole('button', { name: 'Heat' }))
    expect(mockCallServiceCalls).toContainEqual({ domain: 'climate', service: 'set_hvac_mode', target: 'climate.thermostat_hub_w200', serviceData: { hvac_mode: 'heat' } })

    fireEvent.click(screen.getByLabelText(/Thermostat Hub Fan Auto/i))
    pickerSheet = await screen.findByRole('dialog')
    fireEvent.click(within(pickerSheet).getByRole('button', { name: 'Off' }))
    expect(mockCallServiceCalls).toContainEqual({ domain: 'climate', service: 'set_fan_mode', target: 'climate.thermostat_hub_w200', serviceData: { fan_mode: 'off' } })
  })

  it('renders open Ecobee contact sensors as thermostat glass cards', () => {
    mockEntities['binary_sensor.contact_sensors'].state = 'on'
    mockEntities['binary_sensor.office_window_contact_sensor_contact'].state = 'on'
    mockEntities['binary_sensor.master_bedroom_street_window_contact_sensor_contact'].state = 'on'

    render(<DashboardViewPage activePath="ecobee" onNavigate={() => undefined} path="ecobee" />)

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
    render(<DashboardViewPage activePath="ecobee" onNavigate={() => undefined} path="ecobee" />)

    expect(screen.getByLabelText(/Thermostat Hub Off/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Thermostat Hub Mode Off/i)).toBeInTheDocument()
    expect(screen.queryByText('73.4 °F')).not.toBeInTheDocument()
    expect(screen.queryByText('38.0%')).not.toBeInTheDocument()
  })

  it('ports the Ecobee thermostat page with source controls and room popups', async () => {
    mockEntities['climate.thermostat_contact_sensors_global_virtual_thermostat'].attributes.hvac_action = 'heating'
    mockEntities['climate.thermostat_contact_sensors_living_room_virtual_thermostat'].attributes.current_temperature = null
    render(<DashboardViewPage activePath="ecobee" onNavigate={() => undefined} path="ecobee" />)

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

    expect(screen.getByRole('button', { name: 'Living Room 70.2°F · Inactive' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Office 71.6°F · Active' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Master Bedroom 71.0°F · Active' })).toBeInTheDocument()

    const ecoMode = screen.getByRole('button', { name: /^Eco Mode On$/i })
    expect(ecoMode).toHaveAttribute('aria-pressed', 'true')
    expect(ecoMode.closest('[data-active]')).toHaveAttribute('data-active', 'true')
    expect(screen.getByLabelText(/Eco Mode Critical Tracking Track Select Critical/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Eco Behavior When Away Keep Eco Active/i)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/Eco Mode Critical Tracking Track Select Critical/i))
    const pickerSheet = await screen.findByRole('dialog')
    expect(pickerSheet).toHaveAttribute('data-surface', 'hass-popup')
    expect(within(pickerSheet).getByRole('group', { name: 'Eco Mode Critical Tracking options' })).toHaveAttribute('data-layout', 'card-grid')
    expect(within(pickerSheet).getByRole('button', { name: 'Track Select Critical' }).querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:thermometer-check'))
    expect(within(pickerSheet).getByRole('button', { name: 'Track Select Critical' }).querySelectorAll('path')).toHaveLength(1)
    expect(within(pickerSheet).getByRole('button', { name: 'Track Select Active' }).querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:thermometer-alert'))
    fireEvent.click(within(pickerSheet).getByRole('button', { name: 'Track Select Critical' }))
    await waitFor(() => expect(pickerSheet).toHaveAttribute('data-state', 'closed'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText(/Enable Eco Mode to only track active rooms/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Predictive Comfort' })).toBeInTheDocument()
    expect(screen.getByText(/Use forecast weather, humidity, indoor sensors, and learned heat-load patterns/i)).toBeInTheDocument()
    const predictiveComfort = screen.getByRole('button', { name: /^Predictive Comfort Off$/i })
    expect(predictiveComfort).toHaveAttribute('aria-pressed', 'false')
    expect(predictiveComfort.closest('[data-active]')).toHaveAttribute('data-active', 'false')
    expect(screen.queryByRole('button', { name: 'Turn off Predictive Comfort' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open Predictive Comfort controls' })).not.toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'Track Selected Rooms' })).toBeInTheDocument()
    const trackSelectedSection = screen.getByRole('heading', { name: 'Track Selected Rooms' }).closest('section') as HTMLElement
    const livingRoomTrack = within(trackSelectedSection).getByRole('button', { name: 'Living Room' })
    const officeTrack = within(trackSelectedSection).getByRole('button', { name: 'Office' })
    expect(livingRoomTrack).toHaveAttribute('aria-pressed', 'true')
    expect(officeTrack).toHaveAttribute('aria-pressed', 'false')
    expect(within(livingRoomTrack).queryByText('On')).not.toBeInTheDocument()
    expect(within(officeTrack).queryByText('Off')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Force Track Critical Temperature' })).toBeInTheDocument()
    const forceCriticalSection = screen.getByRole('heading', { name: 'Force Track Critical Temperature' }).closest('section') as HTMLElement
    expect(within(forceCriticalSection).getByRole('button', { name: 'Music Room' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(forceCriticalSection).getByRole('button', { name: 'Theater Room' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(forceCriticalSection).queryByRole('button', { name: /^Master Bedroom$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Track Only When Occupied' })).toBeInTheDocument()
    const trackOnlyWhenOccupiedSection = screen.getByRole('heading', { name: 'Track Only When Occupied' }).closest('section') as HTMLElement
    expect(screen.getByText(/Choose which rooms should stay out of thermostat decisions until they are occupied/i)).toBeInTheDocument()
    expect(within(trackOnlyWhenOccupiedSection).getByRole('button', { name: /^Living Room$/i })).toHaveAttribute('aria-pressed', 'false')
    expect(within(trackOnlyWhenOccupiedSection).getByRole('button', { name: /^Office$/i })).toHaveAttribute('aria-pressed', 'false')
    expect(within(trackOnlyWhenOccupiedSection).getByRole('button', { name: /^Master Bedroom$/i })).toHaveAttribute('aria-pressed', 'false')
    expect(within(trackOnlyWhenOccupiedSection).getByRole('button', { name: /^Guest Bathroom$/i })).toHaveAttribute('aria-pressed', 'true')
    expect(within(trackOnlyWhenOccupiedSection).getByRole('button', { name: /^Master Bathroom$/i })).toHaveAttribute('aria-pressed', 'true')
    expect(within(trackOnlyWhenOccupiedSection).queryByRole('button', { name: /Occupied Only/i })).not.toBeInTheDocument()

    fireEvent.click(ecoMode)
    fireEvent.click(predictiveComfort)
    fireEvent.click(screen.getByRole('button', { name: /^Automatic Thermostat On$/i }))
    expect(mockCallServiceCalls).toEqual([
      { domain: 'homeassistant', service: 'toggle', target: 'switch.thermostat_contact_sensors_eco_mode' },
      { domain: 'switch', service: 'turn_on', target: 'switch.thermostat_contact_sensors_predictive_comfort_mode' },
      { domain: 'homeassistant', service: 'toggle', target: 'input_boolean.enable_disable_thermostat_contact_sensors_integration' },
    ])

    const roomOpener = screen.getByRole('button', { name: 'Living Room 70.2°F · Inactive' })
    expect(roomOpener.querySelector('[data-modal-disclosure="right-chevron"]')).toBeInTheDocument()
    fireEvent.click(roomOpener)
    expect(await screen.findByRole('dialog')).toHaveAttribute('data-surface', 'hass-popup')
    expect(screen.getByRole('heading', { name: 'Living Room' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Living Room Vents' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Living Room thermostat Idle --°F 72.0 · 74.0/i })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /Living Room thermostat Idle 0.0°F/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Decrease Living Room target temperature/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Increase Living Room target temperature/i })).not.toBeInTheDocument()
    expect(screen.getByRole('article', { name: /^Vent 1 Open$/i })).toBeInTheDocument()
    expect(screen.getByRole('article', { name: /^Vent 2 Open$/i })).toBeInTheDocument()
  })

  it('toggles occupancy-only thermostat rooms from the Ecobee page', () => {
    render(<DashboardViewPage activePath="ecobee" onNavigate={() => undefined} path="ecobee" />)

    const trackOnlyWhenOccupiedSection = screen.getByRole('heading', { name: 'Track Only When Occupied' }).closest('section') as HTMLElement
    const livingRoomGate = within(trackOnlyWhenOccupiedSection).getByRole('button', { name: /^Living Room$/i })
    const guestBathroomGate = within(trackOnlyWhenOccupiedSection).getByRole('button', { name: /^Guest Bathroom$/i })
    const masterBathroomGate = within(trackOnlyWhenOccupiedSection).getByRole('button', { name: /^Master Bathroom$/i })

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

  it('keeps the Ecobee room modal title stable while closing', async () => {
    render(<DashboardViewPage activePath="ecobee" onNavigate={() => undefined} path="ecobee" />)

    fireEvent.click(screen.getByRole('button', { name: 'Living Room 70.2°F · Inactive' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Living Room' })).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    const closingDialog = screen.queryByRole('dialog')
    if (closingDialog) {
      expect(within(closingDialog).getByRole('heading', { name: 'Living Room' })).toBeInTheDocument()
      expect(within(closingDialog).queryByRole('heading', { name: 'Thermostat' })).not.toBeInTheDocument()
    }
  })

  it('opens Predictive Comfort controls when active and powers it off from the card action', async () => {
    mockEntities['switch.thermostat_contact_sensors_predictive_comfort_mode'].state = 'on'
    render(<DashboardViewPage activePath="climate" onNavigate={() => undefined} path="ecobee" />)

    const predictiveComfort = screen.getByRole('button', { name: /^Predictive Comfort On · Idle$/i })
    expect(screen.getByRole('button', { name: 'Turn off Predictive Comfort' })).toBeInTheDocument()
    const predictiveControls = screen.getByRole('button', { name: 'Open Predictive Comfort controls' })
    expect(predictiveControls).toBeInTheDocument()
    expect(predictiveControls.querySelector('[data-modal-disclosure="right-chevron"]')).toBeInTheDocument()
    expect(predictiveControls.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:chevron-right'))

    fireEvent.click(predictiveComfort)
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('data-surface', 'hass-popup')
    expect(within(dialog).getByRole('heading', { name: 'Predictive Comfort' })).toBeInTheDocument()
    expect(within(dialog).getByText(/^Idle$/i)).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Controls' })).toBeInTheDocument()
    const autoAdjustDescription = within(dialog).getByText(/nudge the thermostat target before the house drifts out of range/i)
    const autoAdjustButton = within(dialog).getByRole('button', { name: /^Auto Setpoint Adjustments Off$/i })
    const hvacModeDescription = within(dialog).getByText(/switch between heat and cool when a proactive correction needs it/i)
    const hvacModeButton = within(dialog).getByRole('button', { name: /^HVAC Mode Changes Off$/i })
    const awayDescription = within(dialog).getByText(/only act when someone is home/i)
    const awayButton = within(dialog).getByRole('button', { name: /^Predictive Comfort While Away Off$/i })
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
    render(<DashboardViewPage activePath="climate" onNavigate={() => undefined} path="ecobee" />)

    const predictiveComfort = screen.getByRole('button', { name: 'Predictive Comfort On · Pre-Cool' })
    expect(screen.queryByText('Pre Cool')).not.toBeInTheDocument()

    fireEvent.click(predictiveComfort)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Pre-Cool')).toBeInTheDocument()
    expect(within(dialog).queryByText('Pre Cool')).not.toBeInTheDocument()
  })

  it('turns Predictive Comfort off from the active card power action', () => {
    mockEntities['switch.thermostat_contact_sensors_predictive_comfort_mode'].state = 'on'
    render(<DashboardViewPage activePath="climate" onNavigate={() => undefined} path="ecobee" />)

    expect(screen.getByRole('button', { name: 'Turn off Predictive Comfort' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Predictive Comfort controls' })).toBeInTheDocument()

    mockCallServiceCalls.length = 0
    fireEvent.click(screen.getByRole('button', { name: 'Turn off Predictive Comfort' }))
    expect(mockCallServiceCalls).toEqual([
      { domain: 'switch', service: 'turn_off', target: 'switch.thermostat_contact_sensors_predictive_comfort_mode' },
    ])
    expect(screen.queryByRole('button', { name: 'Turn off Predictive Comfort' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open Predictive Comfort controls' })).not.toBeInTheDocument()
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
    mockEntities['humidifier.master_bedroom_humidifier'].state = 'unavailable'
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    expect(screen.getByLabelText(/Humidifier Unavailable/i)).toHaveAttribute('data-muted', 'true')
    const headings = screen.getAllByRole('heading').map((heading) => heading.textContent)
    expect(headings.indexOf('SleepyPod')).toBeGreaterThan(-1)
    expect(headings.indexOf('SleepyPod')).toBeLessThan(headings.indexOf('Climate'))
    expect(headings.indexOf('Media')).toBeLessThan(headings.indexOf('Climate'))
    expect(screen.getByRole('button', { name: /Stephen's Bed Cooling • -1/i })).toHaveStyle('--tile-color: rgba(25, 84, 130, 0.6)')
    expect(screen.getByRole('button', { name: /Steph's Bed Off/i })).toHaveAttribute('data-muted', 'true')
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
    const climateOnlyCard = screen.getByLabelText(/Stephen's Bed Off/i)
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
    const levelOnlyCard = screen.getByLabelText(/Stephen's Bed Off/i)
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

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Cooling • -2/i }))

    const dialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
    expect(within(dialog).getByRole('button', { name: 'Alarms' })).toBeInTheDocument()
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
    ['bedtime', 'Tonight', 'sleepypod_stephen_temperature_tonight'],
    ['bedtime', 'All Nights', 'sleepypod_stephen_bedtime_temperature_all_nights'],
    ['asleep', 'Tonight', 'sleepypod_stephen_temperature_tonight'],
    ['asleep', 'All Nights', 'sleepypod_stephen_asleep_temperature_all_nights'],
    ['dawn', 'Tonight', 'sleepypod_stephen_temperature_tonight'],
    ['dawn', 'All Nights', 'sleepypod_stephen_dawn_temperature_all_nights'],
  ])('prompts during %s and routes %s through %s', async (phase, choice, service) => {
    setupStephenSleepypodLevelControl(phase)
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Cooling • -2/i }))
    const bedDialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
    fireEvent.keyDown(within(bedDialog).getByRole('slider', { name: "Stephen's Bed target level" }), { key: 'ArrowLeft' })

    const scopeDialog = await screen.findByRole('dialog', { name: 'Set Bed Temperature' })
    expect(scopeDialog).toHaveTextContent(new RegExp(`Stephen's Bed • ${phase} • -3`, 'i'))
    await waitFor(() => expect(within(scopeDialog).getByRole('button', { name: 'Tonight' })).toHaveFocus())
    expect(mockCallServiceCalls).toEqual([])

    fireEvent.click(within(scopeDialog).getByRole('button', { name: choice }))

    await waitFor(() => expect(mockCallServiceCalls).toEqual([{
      domain: 'script',
      service,
      serviceData: { level: -3 },
    }]))
    await waitFor(() => expect(scopeDialog).toHaveAttribute('data-state', 'closed'))
    expect(scopeDialog).toHaveAttribute('data-closing', 'true')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Set Bed Temperature' })).not.toBeInTheDocument())
    expect(within(bedDialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -3/i })).toBeInTheDocument()
    await waitFor(() => expect(within(bedDialog).getByRole('slider', { name: "Stephen's Bed target level" })).toHaveFocus())
    expect(mockCallServiceCalls.some((call) => call.domain === 'number')).toBe(false)
  })

  it('cancels active-phase temperature changes from the action, close button, and backdrop', async () => {
    setupStephenSleepypodLevelControl('asleep')
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Cooling • -2/i }))
    const bedDialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
    const targetSlider = within(bedDialog).getByRole('slider', { name: "Stephen's Bed target level" })

    const openScopePrompt = async () => {
      fireEvent.keyDown(targetSlider, { key: 'ArrowLeft' })
      return screen.findByRole('dialog', { name: 'Set Bed Temperature' })
    }

    let scopeDialog = await openScopePrompt()
    fireEvent.click(within(scopeDialog).getByRole('button', { name: 'Cancel' }))
    expect(scopeDialog).toHaveTextContent("Stephen's Bed • Asleep • -3")
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Set Bed Temperature' })).not.toBeInTheDocument())
    await waitFor(() => expect(targetSlider).toHaveFocus())

    scopeDialog = await openScopePrompt()
    fireEvent.click(within(scopeDialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Set Bed Temperature' })).not.toBeInTheDocument())
    await waitFor(() => expect(targetSlider).toHaveFocus())

    scopeDialog = await openScopePrompt()
    const overlays = document.querySelectorAll('[data-modal-sheet-overlay]')
    fireEvent.pointerDown(overlays[overlays.length - 1])
    await waitFor(() => expect(scopeDialog).toHaveAttribute('data-state', 'closed'))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Set Bed Temperature' })).not.toBeInTheDocument())
    await waitFor(() => expect(targetSlider).toHaveFocus())

    expect(mockCallServiceCalls).toEqual([])
    expect(within(bedDialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -2/i })).toBeInTheDocument()
  })

  it('does not steal a newer parent-modal focus choice after the scope prompt closes', async () => {
    setupStephenSleepypodLevelControl('asleep')
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Cooling • -2/i }))
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
    expect(mockCallServiceCalls).toEqual([])
  })

  it('closes a stale scope prompt when HA advances the schedule phase', async () => {
    setupStephenSleepypodLevelControl('bedtime')
    const view = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Cooling • -2/i }))
    const bedDialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
    fireEvent.keyDown(within(bedDialog).getByRole('slider', { name: "Stephen's Bed target level" }), { key: 'ArrowLeft' })
    const scopeDialog = await screen.findByRole('dialog', { name: 'Set Bed Temperature' })

    act(() => {
      mockEntities['sensor.sleepypod_stephen_schedule_phase'].state = 'asleep'
      view.rerender(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    })

    await waitFor(() => expect(scopeDialog).toHaveAttribute('data-state', 'closed'))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Set Bed Temperature' })).not.toBeInTheDocument())
    expect(mockCallServiceCalls).toEqual([])
    expect(within(bedDialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -2/i })).toBeInTheDocument()
  })

  it('closes the scope prompt without a command when the SleepyPod adapter becomes unavailable', async () => {
    setupStephenSleepypodLevelControl('bedtime')
    const view = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Cooling • -2/i }))
    const bedDialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
    fireEvent.keyDown(within(bedDialog).getByRole('slider', { name: "Stephen's Bed target level" }), { key: 'ArrowLeft' })
    const scopeDialog = await screen.findByRole('dialog', { name: 'Set Bed Temperature' })
    const retainedTonightAction = within(scopeDialog).getByRole('button', { name: 'Tonight' })

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
      expect(mockCallServiceCalls).toEqual([])
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })

  it('reverts optimistic feedback when HA leaves the phase used by a completed choice', async () => {
    setupStephenSleepypodLevelControl('bedtime')
    const view = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Cooling • -2/i }))
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

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Cooling • -2/i }))
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

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Cooling • -2/i }))
    const dialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })

    expect(within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -2/i })).toHaveAttribute('aria-disabled', 'true')
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

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Cooling • -2/i }))

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

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Off/i }))
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

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Cooling • -3/i }))

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

  it('shows SleepyPod multi-alarm configuration and writes schedule changes to the SleepyPod MQTT topic', async () => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
    const mondayAlarms = [
      { alarmTemperature: 82, duration: 30, enabled: true, time: '06:30', vibrationIntensity: 100, vibrationPattern: 'rise' },
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

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Cooling • -2/i }))
    const dialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
    await clickModalTab(within(dialog), 'Alarms')

    const mondaySection = within(dialog).getByRole('region', { name: "Stephen's Bed Monday alarms" })
    expect(within(mondaySection).getByText('2 alarms')).toBeInTheDocument()
    fireEvent.click(within(mondaySection).getByRole('switch', { name: "Disable Stephen's Bed Monday alarm" }))

    await waitFor(() => expect(mockCallServiceCalls).toHaveLength(1))
    expect(mockCallServiceCalls[0]).toMatchObject({
      domain: 'mqtt',
      service: 'publish',
      serviceData: { topic: 'sleepypod/eight-pod/cmd/set-schedules' },
    })
    const payload = JSON.parse(String((mockCallServiceCalls[0].serviceData as { payload: string }).payload))
    expect(payload.left.monday.alarms).toEqual([
      expect.objectContaining({ enabled: false, time: '06:30' }),
      expect.objectContaining({ enabled: true, time: '07:15' }),
    ])
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

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Cooling • -2/i }))

    const dialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })

    expect(within(dialog).queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('heading', { name: 'Top Button' })).not.toBeInTheDocument()
    expect(mockCallServiceCalls.some(call => call.domain === 'mqtt' && call.service === 'publish')).toBe(false)
  })

  it('shows signed positive Free Sleep target levels on cards and modal readouts', async () => {
    mockEntities['number.nightcanvasrestful_left_target_temperature'].state = '2'
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    const bedCard = screen.getByRole('button', { name: /Stephen's Bed Heating • \+2/i })
    expect(bedCard).toBeInTheDocument()

    fireEvent.click(bedCard)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText("Stephen's Bed: Heating • +2")).toBeInTheDocument()
    expect(within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Heating \+2/i })).toBeInTheDocument()
  })

  it('opens the Master Bedroom humidifier modal with power, target, and mode controls', async () => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Humidifier On/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Master Bedroom Humidifier' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Master Bedroom humidifier controls')).toBeInTheDocument()
    expect(within(dialog).getByText('Current Humidity')).toBeInTheDocument()
    expect(within(dialog).getByText('41%')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Target Humidity 45%')).toBeInTheDocument()
    expect(within(dialog).queryByText(/interactive controls available from this view/i)).not.toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: /Turn Off On/i }))
    fireEvent.click(within(dialog).getByRole('button', { name: /Increase Target 50%/i }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Normal' }))

    expect(within(dialog).getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true')
    expect(mockCallServiceCalls).toEqual([
      { domain: 'humidifier', service: 'toggle', target: 'humidifier.master_bedroom_humidifier' },
      { domain: 'humidifier', service: 'set_humidity', target: 'humidifier.master_bedroom_humidifier', serviceData: { humidity: 50 } },
      { domain: 'humidifier', service: 'set_mode', target: 'humidifier.master_bedroom_humidifier', serviceData: { mode: 'normal' } },
    ])
  })

  it('opens Free Sleep bed modals with MQTT status and native controls', async () => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Cooling • -1/i }))

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
    expect(within(dialog).getByRole('button', { name: 'Alarm Schedule Disabled' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(dialog).queryByRole('article', { name: /Stephen's Bed Monday alarm disabled/i })).not.toBeInTheDocument()

    await clickModalTab(within(dialog), 'Status')
    expect(within(dialog).getByRole('heading', { name: 'Status' })).toBeInTheDocument()
    expect(within(dialog).getByText('Current Temp')).toBeInTheDocument()
    expect(within(dialog).getByText('86°F')).toBeInTheDocument()
    expect(within(dialog).getByText('Presence')).toBeInTheDocument()
    expect(within(dialog).getByText('In Bed')).toBeInTheDocument()
    expect(within(dialog).getByText('Time Remaining')).toBeInTheDocument()
    expect(within(dialog).getByText('2h')).toBeInTheDocument()
    expect(within(dialog).getByText('Alarm')).toBeInTheDocument()
    expect(within(dialog).getByText('Quiet')).toBeInTheDocument()

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

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Cooling • -1/i }))

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

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Cooling • -1/i }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))

    await waitFor(() => expect(dialog).toHaveAttribute('data-state', 'closed'))
  })

  it('falls back to the Free Sleep bedtime MQTT command before the text entity is discovered', async () => {
    mockEntities['text.master_bedroom_eight_sleep_pod_5_left_bedtime'].state = 'unavailable'
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Cooling • -1/i }))

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

      fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Cooling • -1/i }))

      const dialog = await screen.findByRole('dialog')
      scrollTo.mockClear()
      await clickModalTab(within(dialog), 'Status')

      expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
    } finally {
      if (originalScrollTo) Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: originalScrollTo })
      else Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo')
    }
  })

  it('starts Free Sleep hot flash mode from the bed modal', async () => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Cooling • -1/i }))

    const dialog = await screen.findByRole('dialog')
    await clickModalTab(within(dialog), 'Special Modes')
    const hotFlash = within(dialog).getByRole('button', { name: 'Hot Flash Mode Inactive' })
    expect(hotFlash.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:snowflake'))

    fireEvent.click(hotFlash)

    expect(within(dialog).getByText("Stephen's Bed: Hot Flash Mode")).toBeInTheDocument()
    expect(within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -10/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Hot Flash Mode Active' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Stephen's Bed Hot Flash Mode/i, hidden: true }).some((button) => button.getAttribute('data-muted') === 'false')).toBe(true)
    expect(mockCallServiceCalls).toEqual([
      { domain: 'input_button', service: 'press', target: 'input_button.eight_sleep_stephen_hot_flash' },
    ])
  })

  it('shows active Free Sleep hot flash countdown and cancel action', async () => {
    mockEntities['input_boolean.eight_sleep_steph_hot_flash_active'].state = 'on'
    mockEntities['timer.eight_sleep_steph_hot_flash'].state = 'active'
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Bed Hot Flash Mode/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText("Steph's Bed: Hot Flash Mode")).toBeInTheDocument()
    await clickModalTab(within(dialog), 'Special Modes')
    expect(within(dialog).getByRole('button', { name: 'Hot Flash Mode Active' })).toBeInTheDocument()
    expect(within(dialog).getByText('12:34')).toBeInTheDocument()
    const cancel = within(dialog).getByRole('button', { name: "Cancel Steph's Bed hot flash mode" })
    expect(cancel.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:close'))

    fireEvent.click(cancel)

    expect(within(dialog).getByText("Steph's Bed: Off")).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Hot Flash Mode Inactive' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Steph's Bed Off/i, hidden: true }).some((button) => button.getAttribute('data-muted') === 'true')).toBe(true)
    expect(mockCallServiceCalls).toEqual([
      { domain: 'input_button', service: 'press', target: 'input_button.eight_sleep_steph_cancel_hot_flash' },
    ])
  })

  it('uses Free Sleep target state and restore timestamp fallback during active Hot Flash mode', async () => {
    mockEntities['input_boolean.eight_sleep_stephen_hot_flash_active'].state = 'on'
    mockEntities['timer.eight_sleep_stephen_hot_flash'].state = 'idle'
    mockEntities['number.nightcanvasrestful_left_target_temperature'].state = '-10'
    mockEntities['input_datetime.eight_sleep_stephen_hot_flash_restore_at'].attributes.timestamp = (Date.now() + (14 * 60 + 34) * 1000) / 1000
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Hot Flash Mode/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText("Stephen's Bed: Hot Flash Mode")).toBeInTheDocument()
    expect(within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -10/i })).toHaveAttribute('aria-disabled', 'true')
    expect(within(dialog).queryByRole('slider', { name: "Stephen's Bed target level" })).not.toBeInTheDocument()
    expect(within(dialog).getByText('Hot Flash Mode controls the target.')).toBeInTheDocument()
    await clickModalTab(within(dialog), 'Special Modes')
    expect(within(dialog).getByRole('button', { name: 'Hot Flash Mode Active' })).toBeInTheDocument()
    expect(within(dialog).getByText('14:34')).toBeInTheDocument()
  })

  it('cancels an in-flight target edit when Hot Flash mode takes ownership', async () => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Cooling • -1/i }))
    const dialog = await screen.findByRole('dialog')
    await clickModalTab(within(dialog), 'Special Modes')
    vi.useFakeTimers()
    try {
      fireEvent.keyDown(within(dialog).getByRole('slider', { name: "Stephen's Bed target level" }), { key: 'ArrowLeft' })
      expect(within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -2/i })).toBeInTheDocument()
      fireEvent.click(within(dialog).getByRole('button', { name: 'Hot Flash Mode Inactive' }))

      expect(within(dialog).getByRole('region', { name: /Stephen's Bed thermostat Cooling -10/i })).toHaveAttribute('aria-disabled', 'true')
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

  it('shows Free Sleep snooze and cancel actions while a side alarm is active', async () => {
    mockEntities['binary_sensor.nightcanvasrestful_right_alarm_vibrating'].state = 'on'
    const { rerender } = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Bed Off/i }))

    let dialog = await screen.findByRole('dialog')
    await clickModalTab(within(dialog), 'Alarms')
    expect(within(dialog).getByRole('group', { name: "Steph's Bed active alarm actions" })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /Snooze Alarm/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /Cancel Alarm/i })).toBeInTheDocument()
    await clickModalTab(within(dialog), 'Status')
    expect(within(dialog).getByText('Vibrating')).toBeInTheDocument()
    await clickModalTab(within(dialog), 'Alarms')

    fireEvent.click(within(dialog).getByRole('button', { name: /Snooze Alarm/i }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'number', service: 'set_value', target: 'number.steph_s_eight_sleep_side_alarm_snooze_minutes', serviceData: { value: 10 } },
      { domain: 'button', service: 'press', target: 'button.steph_s_eight_sleep_side_alarm_snooze' },
      { domain: 'button', service: 'press', target: 'button.nightcanvasrestful_clear_alarm' },
    ])
    expect(mockEntities['binary_sensor.nightcanvasrestful_right_alarm_vibrating'].state).toBe('off')

    act(() => {
      rerender(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    })
    dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByRole('button', { name: /Snooze Alarm/i })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /Cancel Alarm/i })).not.toBeInTheDocument()

    mockEntities['binary_sensor.nightcanvasrestful_right_alarm_vibrating'].state = 'on'
    act(() => {
      rerender(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    })

    dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: /Snooze Alarm/i })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: /Cancel Alarm/i }))
    expect(mockCallServiceCalls[mockCallServiceCalls.length - 1]).toEqual({ domain: 'button', service: 'press', target: 'button.nightcanvasrestful_clear_alarm' })
  })

  it('adds and controls configured Free Sleep alarms from the bed modal', async () => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Cooling • -1/i }))
    const dialog = await screen.findByRole('dialog')
    await clickModalTab(within(dialog), 'Alarms')
    const alarmSchedule = within(dialog).getByRole('button', { name: 'Alarm Schedule Disabled' })
    expect(within(dialog).queryByRole('button', { name: 'Add Alarm' })).not.toBeInTheDocument()

    fireEvent.click(alarmSchedule)

    expect(within(dialog).getByRole('button', { name: 'Alarm Schedule Enabled' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).getByRole('button', { name: 'Add Alarm' })).toBeInTheDocument()
    expect(within(dialog).getByText('No alarms yet. Add one to choose days and a time.')).toBeInTheDocument()
    expect(within(dialog).queryByRole('article', { name: /Stephen's Bed Monday alarm/i })).not.toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Alarm' }))
    expect(within(dialog).getByRole('button', { name: 'Alarm Schedule Enabled' })).toHaveAttribute('aria-pressed', 'true')
    const addAlarm = within(dialog).getByRole('group', { name: "Add Stephen's Bed alarm" })
    expect(within(addAlarm).getByRole('button', { name: 'New alarm time 7:00 AM' }).querySelector('svg')).not.toBeNull()
    fireEvent.click(within(addAlarm).getByRole('button', { name: /Alarm days Choose days/i }))
    const mondayOption = within(addAlarm).getByRole('option', { name: 'Monday' })
    fireEvent.click(mondayOption)
    fireEvent.click(within(addAlarm).getByRole('option', { name: 'Wednesday' }))
    expect(mondayOption).toHaveAttribute('aria-selected', 'true')
    expect(mondayOption.querySelector('svg')).toBeNull()
    expect(within(addAlarm).getByRole('button', { name: /Alarm days Monday, Wednesday/i })).toBeInTheDocument()
    fireEvent.change(within(addAlarm).getByLabelText('New alarm time'), { target: { value: '06:45' } })
    fireEvent.click(within(addAlarm).getByRole('button', { name: 'Add Alarm' }))

    expect(within(dialog).getByRole('article', { name: /Stephen's Bed Monday alarm enabled/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('article', { name: /Stephen's Bed Wednesday alarm enabled/i })).toBeInTheDocument()
    expect(within(dialog).getByRole('switch', { name: "Disable Stephen's Bed Monday alarm" })).toHaveAttribute('aria-checked', 'true')
    expect(within(dialog).getByLabelText("Stephen's Bed Monday alarm time")).toHaveValue('06:45')
    expect(within(dialog).getAllByText('6:45 AM').length).toBeGreaterThanOrEqual(2)
    expect(mockCallServiceCalls[0]).toEqual({ domain: 'switch', service: 'turn_on', target: 'switch.nightcanvasrestful_left_alarms_enabled' })
    await waitFor(() => expect(mockCallServiceCalls).toHaveLength(2))
    expect(mockCallServiceCalls[1]).toMatchObject({
      domain: 'mqtt',
      service: 'publish',
      serviceData: { topic: 'free-sleep/NightCanvasRestful/schedules/set' },
    })
    const addedPayload = JSON.parse(String((mockCallServiceCalls[1].serviceData as { payload: string }).payload))
    expect(addedPayload.left.sunday.alarms).toEqual([expect.objectContaining({ enabled: true, time: '06:45' })])
    expect(addedPayload.left.tuesday.alarms).toEqual([expect.objectContaining({ enabled: true, time: '06:45' })])

    const originalShowPicker = HTMLInputElement.prototype.showPicker
    const showPicker = vi.fn()
    Object.defineProperty(HTMLInputElement.prototype, 'showPicker', { configurable: true, value: showPicker })
    try {
      fireEvent.click(within(dialog).getByRole('button', { name: "Stephen's Bed Monday alarm time 6:45 AM" }))
      expect(showPicker).toHaveBeenCalledTimes(1)
    } finally {
      if (originalShowPicker) Object.defineProperty(HTMLInputElement.prototype, 'showPicker', { configurable: true, value: originalShowPicker })
      else Reflect.deleteProperty(HTMLInputElement.prototype, 'showPicker')
    }

    fireEvent.change(within(dialog).getByLabelText("Stephen's Bed Monday alarm time"), { target: { value: '06:50' } })
    await waitFor(() => expect(mockCallServiceCalls).toHaveLength(3))
    expect(mockCallServiceCalls[2]).toMatchObject({
      domain: 'mqtt',
      service: 'publish',
      serviceData: { topic: 'free-sleep/NightCanvasRestful/schedules/set' },
    })
    const changedPayload = JSON.parse(String((mockCallServiceCalls[2].serviceData as { payload: string }).payload))
    expect(changedPayload.left.sunday.alarms).toEqual([expect.objectContaining({ enabled: true, time: '06:50' })])

    fireEvent.click(within(dialog).getByRole('switch', { name: "Disable Stephen's Bed Monday alarm" }))

    await waitFor(() => expect(mockCallServiceCalls).toHaveLength(4))
    expect(mockCallServiceCalls.slice(1)).toHaveLength(3)
    for (const call of mockCallServiceCalls.slice(1)) {
      expect(call).toMatchObject({
        domain: 'mqtt',
        service: 'publish',
        serviceData: { topic: 'free-sleep/NightCanvasRestful/schedules/set' },
      })
    }
    const disabledPayload = JSON.parse(String((mockCallServiceCalls[3].serviceData as { payload: string }).payload))
    expect(disabledPayload.left.sunday.alarms).toEqual([expect.objectContaining({ enabled: false, time: '06:50' })])
    expect(disabledPayload.left.tuesday.alarms).toEqual([expect.objectContaining({ enabled: true, time: '06:45' })])
  })

  it('allows multiple Free Sleep alarms on the same day', async () => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Bed Off/i }))
    const dialog = await screen.findByRole('dialog')
    await clickModalTab(within(dialog), 'Alarms')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Alarm Schedule Disabled' }))

    const sundaySection = within(dialog).getByRole('region', { name: "Steph's Bed Sunday alarms" })
    expect(within(sundaySection).getByText('Sunday')).toBeInTheDocument()
    expect(within(sundaySection).getByText('2 alarms')).toBeInTheDocument()
    expect(within(sundaySection).getByRole('article', { name: /Steph's Bed Sunday alarm enabled/i })).toBeInTheDocument()
    expect(within(sundaySection).getByRole('article', { name: /Steph's Bed Sunday alarm 2 enabled/i })).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Alarm' }))
    const addAlarm = within(dialog).getByRole('group', { name: "Add Steph's Bed alarm" })
    fireEvent.click(within(addAlarm).getByRole('button', { name: /Alarm days Choose days/i }))
    fireEvent.click(within(addAlarm).getByRole('option', { name: 'Sunday' }))
    fireEvent.change(within(addAlarm).getByLabelText('New alarm time'), { target: { value: '08:00' } })
    fireEvent.click(within(addAlarm).getByRole('button', { name: 'Add Alarm' }))

    expect(within(sundaySection).getByText('3 alarms')).toBeInTheDocument()
    expect(within(sundaySection).getByRole('article', { name: /Steph's Bed Sunday alarm 3 enabled/i })).toBeInTheDocument()
    expect(mockCallServiceCalls[0]).toEqual({ domain: 'switch', service: 'turn_on', target: 'switch.nightcanvasrestful_right_alarms_enabled' })
    await waitFor(() => expect(mockCallServiceCalls).toHaveLength(2))
    const addedPayload = JSON.parse(String((mockCallServiceCalls[1].serviceData as { payload: string }).payload))
    expect(addedPayload.right.saturday.alarms).toEqual([
      expect.objectContaining({ enabled: true, time: '06:30' }),
      expect.objectContaining({ enabled: true, time: '07:15' }),
      expect.objectContaining({ enabled: true, time: '08:00' }),
    ])
  })

  it('keeps an enabled Free Sleep alarm toggle mounted and on while editing its time', async () => {
    const { rerender } = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Bed Off/i }))
    const dialog = await screen.findByRole('dialog')
    await clickModalTab(within(dialog), 'Alarms')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Alarm Schedule Disabled' }))
    const sundaySection = within(dialog).getByRole('region', { name: "Steph's Bed Sunday alarms" })
    const alarmToggle = within(sundaySection).getByRole('switch', { exact: true, name: "Disable Steph's Bed Sunday alarm" })

    fireEvent.change(within(sundaySection).getByLabelText("Steph's Bed Sunday alarm time"), { target: { value: '06:35' } })

    expect(alarmToggle).toHaveAttribute('aria-checked', 'true')
    expect(within(sundaySection).queryByRole('switch', { exact: true, name: "Enable Steph's Bed Sunday alarm" })).not.toBeInTheDocument()
    await waitFor(() => expect(mockCallServiceCalls).toHaveLength(2))
    const changedPayload = JSON.parse(String((mockCallServiceCalls[1].serviceData as { payload: string }).payload))
    expect(changedPayload.right.saturday.alarms).toEqual([
      expect.objectContaining({ enabled: true, time: '06:35' }),
      expect.objectContaining({ enabled: true, time: '07:15' }),
    ])

    act(() => {
      rerender(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    })

    const confirmedSundaySection = within(screen.getByRole('dialog')).getByRole('region', { name: "Steph's Bed Sunday alarms" })
    const confirmedAlarmToggle = within(confirmedSundaySection).getByRole('switch', { exact: true, name: "Disable Steph's Bed Sunday alarm" })
    expect(confirmedAlarmToggle).toBe(alarmToggle)
    expect(confirmedAlarmToggle).toHaveAttribute('aria-checked', 'true')
    expect(within(confirmedSundaySection).getByLabelText("Steph's Bed Sunday alarm time")).toHaveValue('06:35')
  })

  it('confirms before deleting a Free Sleep alarm and removes only that alarm from the backend schedule', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    try {
      fireEvent.click(screen.getByRole('button', { name: /Steph's Bed Off/i }))
      const dialog = await screen.findByRole('dialog')
      await clickModalTab(within(dialog), 'Alarms')
      fireEvent.click(within(dialog).getByRole('button', { name: 'Alarm Schedule Disabled' }))
      const sundaySection = within(dialog).getByRole('region', { name: "Steph's Bed Sunday alarms" })

      fireEvent.click(within(sundaySection).getByRole('button', { name: "Delete Steph's Bed Sunday alarm" }))

      expect(confirm).toHaveBeenCalledWith("Delete Steph's Bed Sunday alarm at 6:30 AM?")
      expect(within(sundaySection).getByText('2 alarms')).toBeInTheDocument()
      expect(mockCallServiceCalls).toEqual([{ domain: 'switch', service: 'turn_on', target: 'switch.nightcanvasrestful_right_alarms_enabled' }])

      confirm.mockReturnValue(true)
      fireEvent.click(within(sundaySection).getByRole('button', { name: "Delete Steph's Bed Sunday alarm" }))

      expect(within(sundaySection).getByText('1 alarm')).toBeInTheDocument()
      await waitFor(() => expect(mockCallServiceCalls).toHaveLength(2))
      const deletePayload = JSON.parse(String((mockCallServiceCalls[1].serviceData as { payload: string }).payload))
      expect(deletePayload.right.saturday.alarms).toEqual([expect.objectContaining({ enabled: true, time: '07:15' })])
    } finally {
      confirm.mockRestore()
    }
  })

  it('debounces Free Sleep alarm toggle MQTT sync to the final expected state', async () => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Bed Off/i }))
    const dialog = await screen.findByRole('dialog')
    await clickModalTab(within(dialog), 'Alarms')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Alarm Schedule Disabled' }))
    const sundaySection = within(dialog).getByRole('region', { name: "Steph's Bed Sunday alarms" })

    fireEvent.click(within(sundaySection).getByRole('switch', { name: "Disable Steph's Bed Sunday alarm" }))
    expect(within(sundaySection).getByRole('switch', { name: "Enable Steph's Bed Sunday alarm" })).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(within(sundaySection).getByRole('switch', { name: "Enable Steph's Bed Sunday alarm" }))
    expect(within(sundaySection).getByRole('switch', { name: "Disable Steph's Bed Sunday alarm" })).toHaveAttribute('aria-checked', 'true')
    expect(mockCallServiceCalls).toEqual([{ domain: 'switch', service: 'turn_on', target: 'switch.nightcanvasrestful_right_alarms_enabled' }])

    await waitFor(() => expect(mockCallServiceCalls).toHaveLength(2))
    const finalPayload = JSON.parse(String((mockCallServiceCalls[1].serviceData as { payload: string }).payload))
    expect(finalPayload.right.saturday.alarms).toEqual([
      expect.objectContaining({ enabled: true, time: '06:30' }),
      expect.objectContaining({ enabled: true, time: '07:15' }),
    ])
  })

  it('keeps rapid Free Sleep alarm double-clicks on the latest local intent', async () => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Bed Off/i }))
    const dialog = await screen.findByRole('dialog')
    await clickModalTab(within(dialog), 'Alarms')
    const masterToggle = within(dialog).getByRole('button', { name: 'Alarm Schedule Disabled' })
    act(() => {
      fireEvent.click(masterToggle)
      fireEvent.click(masterToggle)
    })

    expect(within(dialog).getByRole('button', { name: 'Alarm Schedule Disabled' })).toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([
      { domain: 'switch', service: 'turn_on', target: 'switch.nightcanvasrestful_right_alarms_enabled' },
      { domain: 'switch', service: 'turn_off', target: 'switch.nightcanvasrestful_right_alarms_enabled' },
    ])
  })

  it('keeps rapid Free Sleep individual alarm double-clicks on the latest local intent', async () => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Bed Off/i }))
    const dialog = await screen.findByRole('dialog')
    await clickModalTab(within(dialog), 'Alarms')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Alarm Schedule Disabled' }))
    const sundaySection = within(dialog).getByRole('region', { name: "Steph's Bed Sunday alarms" })
    const alarmToggle = within(sundaySection).getByRole('switch', { exact: true, name: "Disable Steph's Bed Sunday alarm" })

    act(() => {
      fireEvent.click(alarmToggle)
      fireEvent.click(alarmToggle)
    })

    expect(within(sundaySection).getByRole('switch', { exact: true, name: "Disable Steph's Bed Sunday alarm" })).toHaveAttribute('aria-checked', 'true')
    await waitFor(() => expect(mockCallServiceCalls).toHaveLength(2))
    const finalPayload = JSON.parse(String((mockCallServiceCalls[1].serviceData as { payload: string }).payload))
    expect(finalPayload.right.saturday.alarms).toEqual([
      expect.objectContaining({ enabled: true, time: '06:30' }),
      expect.objectContaining({ enabled: true, time: '07:15' }),
    ])
  })

  it('does not let stale off confirmations clear a rapid Free Sleep alarm on intent', async () => {
    const { rerender } = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Bed Off/i }))
    const dialog = await screen.findByRole('dialog')
    await clickModalTab(within(dialog), 'Alarms')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Alarm Schedule Disabled' }))
    const sundaySection = within(dialog).getByRole('region', { name: "Steph's Bed Sunday alarms" })
    fireEvent.click(within(sundaySection).getByRole('switch', { exact: true, name: "Disable Steph's Bed Sunday alarm" }))
    expect(within(sundaySection).getByRole('switch', { exact: true, name: "Enable Steph's Bed Sunday alarm" })).toHaveAttribute('aria-checked', 'false')

    const backendOffAttributes = mockFreeSleepScheduleAttributes()
    backendOffAttributes.right.saturday.alarm.enabled = false
    backendOffAttributes.right.saturday.alarms[0].enabled = false
    mockEntities['sensor.nightcanvasrestful_schedules'].attributes = backendOffAttributes

    act(() => {
      rerender(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('switch', { exact: true, name: "Enable Steph's Bed Sunday alarm" }))
    })

    const updatedSundaySection = within(screen.getByRole('dialog')).getByRole('region', { name: "Steph's Bed Sunday alarms" })
    expect(within(updatedSundaySection).getByRole('switch', { exact: true, name: "Disable Steph's Bed Sunday alarm" })).toHaveAttribute('aria-checked', 'true')
    await waitFor(() => expect(mockCallServiceCalls).toHaveLength(2))
    const finalPayload = JSON.parse(String((mockCallServiceCalls[1].serviceData as { payload: string }).payload))
    expect(finalPayload.right.saturday.alarms).toEqual([
      expect.objectContaining({ enabled: true, time: '06:30' }),
      expect.objectContaining({ enabled: true, time: '07:15' }),
    ])
  })

  it('turns on an off Free Sleep side from the thermostat tap target', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Bed Off/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText("Steph's Bed: Off")).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: "Turn on Steph's Bed" }))

    expect(confirm).not.toHaveBeenCalled()
    expect(within(dialog).getByRole('button', { name: "Turn off Steph's Bed" })).toBeInTheDocument()
    expect(within(dialog).getByText("Steph's Bed: Idle • 0")).toBeInTheDocument()
    expect(within(dialog).getByRole('region', { name: /Steph's Bed thermostat Idle 0/i })).toBeInTheDocument()
    expect(within(dialog).queryByText('Tap the thermostat to turn on the Pod.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Steph's Bed Idle • 0/i, hidden: true })).toHaveAttribute('data-muted', 'false')
    expect(mockCallServiceCalls).toEqual([
      { domain: 'switch', service: 'turn_on', target: 'switch.nightcanvasrestful_right_power' },
    ])

    confirm.mockRestore()
  })

  it('keeps the Free Sleep hero dial stable during brief MQTT availability blips', async () => {
    const { rerender } = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Cooling • -1/i }))
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

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Cooling • -1/i }))
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

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Cooling • -1/i }))
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
      expect(screen.getByRole('button', { name: /Stephen's Bed Cooling • -2/i, hidden: true })).toHaveAttribute('data-muted', 'false')

      await waitFor(() => expect(mockCallServiceCalls).toEqual([
        { domain: 'number', service: 'set_value', target: 'number.nightcanvasrestful_left_target_temperature', serviceData: { value: -2 } },
      ]))
    } finally {
      rectSpy.mockRestore()
    }
  })

  it('updates Free Sleep schedule stage temperatures through preserved helpers', async () => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Cooling • -1/i }))
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

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Cooling • -1/i }))
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

    fireEvent.click(screen.getByRole('button', { name: /Steph's Bed Off/i }))
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

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Cooling • -1/i }))
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
    expect(screen.getByRole('button', { name: /Stephen's Bed Off/i, hidden: true })).toHaveAttribute('data-muted', 'true')

    confirm.mockRestore()
  })

  it('disables Free Sleep target changes when that bed side is off', async () => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Bed Off/i }))

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

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Cooling • -1/i }))
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

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Cooling • -1/i }))
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

    fireEvent.click(screen.getByRole('button', { name: /^Living Room SHIELD Off$/i }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveStyle(MEDIA_REMOTE_MODAL_STYLE)
    expect(dialog).toHaveAttribute('data-has-footer', 'true')
    expect(screen.getByRole('heading', { name: 'Living Room SHIELD Remote' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Power' })).not.toBeInTheDocument()
    expect(screen.getByText('Power Off')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Power' }).closest('[data-scroll-region]')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Sonos Volume' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Navigation' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Controls' })).toBeInTheDocument()
    expect(within(dialog).getByRole('group', { name: 'Living Room SHIELD remote controls' })).toBeInTheDocument()
    expect(within(dialog).getByRole('group', { name: 'Living Room SHIELD Controls' })).toBeInTheDocument()
    expect(within(dialog).getByRole('navigation', { name: 'Living Room SHIELD modal sections' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Controls' })).toHaveAttribute('aria-current', 'page')
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

    fireEvent.click(screen.getByRole('button', { name: /^Living Room SHIELD Off$/i }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveAttribute('data-has-footer', 'true')
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

  it('keeps the mobile remote scroll offset when switching modal tabs', async () => {
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
      fireEvent.click(screen.getByRole('button', { name: /^Living Room SHIELD Off$/i }))

      const dialog = await screen.findByRole('dialog')
      const panel = dialog.querySelector<HTMLElement>('[data-scroll-region="media-remote-panel"]')
      expect(panel).toBeInTheDocument()

      panel!.scrollTop = 137
      await clickModalTab(within(dialog), 'Apps')

      expect(panel).toHaveAttribute('data-tab', 'apps')
      expect(panel!.scrollTop).toBe(137)
    } finally {
      Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia })
    }
  })

  it('ports media app cards inside remote modals with YAML service payloads', async () => {
    mockEntities['media_player.living_room_shield_2'].state = 'playing'
    let view = render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)
    fireEvent.click(screen.getByRole('button', { name: /^Living Room SHIELD Off$/i }))
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
    fireEvent.click(screen.getByRole('button', { name: /^Theater Room Off$/i }))
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

    fireEvent.click(screen.getByRole('button', { name: /^Nintendo Switch Off$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Theater SHIELD Off$/i }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', service: 'theater_room_nintendo_switch' },
      { domain: 'script', service: 'theater_room_tv_movie' },
    ])
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
    expect(screen.getByRole('button', { name: /Music Room Docked • 100%/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Robot Vacuum Docked/i })).not.toBeInTheDocument()
  })

  it('matches Theater Room source media app, PC, and vacuum cards', () => {
    render(<DashboardViewPage activePath="theater-room" onNavigate={() => undefined} path="theater-room" />)

    fireEvent.click(screen.getByRole('button', { name: 'Plex' }))
    fireEvent.click(screen.getByRole('button', { name: /Theater Room PC Off/i }))

    expect(screen.getByRole('button', { name: /Theater Room Docked • 99%/i })).toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([
      { domain: 'script', service: 'launch_app_on_media_player', serviceData: { entity: 'media_player.theater_room_shield', remote_entity: 'remote.theater_shield_remote', app_id: 'com.plexapp.android', turn_on_projector: true } },
      { domain: 'input_button', service: 'press', target: 'input_button.theater_pc_on' },
    ])
  })

  it('runs bathroom switch cards and preserves source switch colors', () => {
    render(<DashboardViewPage activePath="guest-bathroom" onNavigate={() => undefined} path="guest-bathroom" />)

    const fan = screen.getByRole('button', { name: /Fan Off/i })
    const towelRack = screen.getByRole('button', { name: /Towel Rack On/i })
    expect(towelRack).toHaveStyle('--tile-color: rgba(136, 64, 26, 0.6)')

    fireEvent.click(fan)
    fireEvent.click(towelRack)

    expect(mockCallServiceCalls).toEqual([
      { domain: 'homeassistant', service: 'toggle', target: 'switch.guest_bathroom_fan_switch_top' },
      { domain: 'homeassistant', service: 'toggle', target: 'switch.guest_bathroom_towel_rack_switch_top' },
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

    fireEvent.click(screen.getByRole('button', { name: /^Theater Room Off$/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Theater Room SHIELD Remote' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Yamaha Volume' })).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Yamaha Volume volume' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Volume Down' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Devices' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Devices' })).not.toBeInTheDocument()
    expect(screen.getByText('Power Off')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Power' })).toHaveStyle({ color: 'rgb(255, 0, 0)' })
    const remoteControls = within(screen.getByRole('dialog')).getByRole('group', { name: 'Theater Room SHIELD remote controls' })
    expect(screen.getByRole('button', { name: 'Power' }).compareDocumentPosition(remoteControls) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(remoteControls.closest('[data-scroll-region="media-remote-panel"]')).toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: 'Power' }))
    fireEvent.click(screen.getByRole('button', { name: 'Right' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    fireEvent.click(screen.getByRole('button', { name: 'Volume Up' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }))

    await clickModalTab(within(screen.getByRole('dialog')), 'Devices')
    expect(screen.getByRole('button', { name: 'Devices' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { name: 'Devices' })).toBeInTheDocument()
    expect(remoteControls.closest('[data-scroll-region="media-remote-panel"]')).toHaveAttribute('data-tab', 'devices')
    expect(screen.queryByRole('heading', { name: 'Yamaha Volume' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Projector Off/i })).toHaveAttribute('data-tone', 'media')
    expect(screen.getByRole('button', { name: /Projector Off/i })).toHaveAttribute('data-icon', 'mdi:projector')
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

    fireEvent.click(screen.getByRole('button', { name: /^Theater Room Off$/i }))

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
    expect(dialog).toHaveStyle(VACUUM_MODAL_STYLE)
    expect(screen.getByRole('heading', { name: 'Living Room: Robot Vacuum' })).toBeInTheDocument()
    expect(screen.queryByText('Main Floor Robot Vacuum')).not.toBeInTheDocument()
    const mapPane = within(dialog).getByRole('group', { name: 'Main Floor map and status' })
    const controlsPane = within(dialog).getByRole('group', { name: 'Main Floor controls, zones, auto-clean, actions, info' })
    const modalNav = within(dialog).getByRole('navigation', { name: 'Main Floor modal sections' })
    const modalNavButtons = within(modalNav).getAllByRole('button')
    expect(modalNavButtons.map((button) => button.getAttribute('aria-label'))).toEqual(['Controls', 'Zones', 'Auto-Clean', 'Actions', 'Info'])
    expect(modalNavButtons[2].querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:robot-vacuum-off'))
    expect(modalNavButtons[3].querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:flash'))
    expect(modalNavButtons[4].querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:information-outline'))
    expect(within(mapPane).getByRole('region', { name: 'Main Floor Valetudo map' })).toBeInTheDocument()
    expect(within(mapPane).getByText('Battery')).toBeInTheDocument()
    expect(within(mapPane).queryByRole('heading', { name: 'Consumables' })).not.toBeInTheDocument()
    expect(within(mapPane).queryByRole('heading', { name: 'Bin State' })).not.toBeInTheDocument()
    expect(screen.queryByText('No error')).not.toBeInTheDocument()
    expect(within(controlsPane).queryByRole('heading', { name: 'Vacuum Controls' })).not.toBeInTheDocument()
    expect(within(controlsPane).getAllByRole('heading').map((heading) => heading.textContent)).toEqual(['Docked', 'Power Settings'])
    expect(screen.queryByRole('button', { name: 'Empty Dock' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Mode options' })).not.toBeInTheDocument()
    const modeSelect = screen.getByRole('combobox', { name: /Mode Vacuum/i })
    expect(modeSelect).toHaveValue('vacuum')
    expect(modeSelect.closest('[data-layout]')).toHaveAttribute('data-layout', 'default')
    expect(modeSelect.closest('[data-has-description]')).toHaveAttribute('data-has-description', 'true')
    const modeDescription = screen.getByText('Choose whether the robot vacuums, mops, or combines both for the next run.')
    expect(modeDescription).toBeInTheDocument()
    expect(modeDescription.closest('[data-native-select]')).toBeNull()
    expect(modeDescription.compareDocumentPosition(modeSelect) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByText('Set the cleaning mode, suction, and water level before starting the next run.')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Mode' })).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Fan Balanced/i })).toHaveValue('balanced')
    expect(screen.getByText('Adjust suction strength for carpets, hard floors, and quieter cleaning.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Fan' })).not.toBeInTheDocument()
    expect(screen.queryByText('Cleaning Passes')).not.toBeInTheDocument()
    const cleaningPassesSelect = screen.getByRole('combobox', { name: /Cleaning Passes 1x/i })
    const cleaningSetupDescription = screen.getByText('Choose how many passes the vacuum should make, then start cleaning with the selected zones.')
    expect(cleaningSetupDescription).toBeInTheDocument()
    expect(cleaningSetupDescription.closest('[data-native-select]')).toBeNull()
    expect(cleaningSetupDescription.closest('button')).toBeNull()
    expect(cleaningSetupDescription.compareDocumentPosition(cleaningPassesSelect) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(cleaningPassesSelect).toHaveValue('1')
    expect(cleaningPassesSelect.closest('[data-layout]')).toHaveAttribute('data-layout', 'cleaning')
    expect(cleaningPassesSelect.closest('[data-has-description]')).toHaveAttribute('data-has-description', 'false')
    expect(cleaningPassesSelect.closest('[data-has-icon]')).toHaveAttribute('data-has-icon', 'false')
    expect(cleaningPassesSelect.closest('[data-label-hidden]')).toHaveAttribute('data-label-hidden', 'true')
    expect(within(cleaningPassesSelect).getAllByRole('option').map((option) => option.textContent)).toEqual(['1x', '2x', '3x'])
    expect(screen.queryByRole('dialog', { name: 'Cleaning Passes' })).not.toBeInTheDocument()
    const cleanButton = screen.getByRole('button', { name: 'Clean' })
    expect(cleaningSetupDescription.compareDocumentPosition(cleanButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(cleanButton).toHaveAttribute('data-icon', 'mdi:play')
    await clickModalTab(within(dialog), 'Zones')
    const zonesHeading = within(controlsPane).getByRole('heading', { name: 'Zones' })
    expect(screen.getByText('Select any zones to focus cleaning in those areas. If you press clean and no zones are selected, we will clean all zones on the Main Floor.')).toBeInTheDocument()
    expect(screen.getByText('Zones are not selectable or changeable while cleaning is ongoing.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /living room/i }).querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:sofa'))
    await clickModalTab(within(dialog), 'Auto-Clean')
    const autoCleanHeading = within(controlsPane).getByRole('heading', { name: 'Disabled Auto-Clean Rooms' })
    expect(autoCleanHeading).toBeInTheDocument()
    expect(screen.getByText('Check rooms that should be skipped when the coordinator starts an automatic away clean. Use this for closed doors, guests, or projects on the floor; manual selected-room cleans still use the Zones tab.')).toBeInTheDocument()
    const livingRoomAutoClean = screen.getByRole('button', { name: 'Living Room auto-clean enabled' })
    expect(livingRoomAutoClean).toHaveAttribute('aria-pressed', 'false')
    expect(livingRoomAutoClean.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:checkbox-blank-outline'))
    expect(within(livingRoomAutoClean).queryByText(/auto-clean/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Closet auto-clean enabled' })).toBeInTheDocument()
    await clickModalTab(within(dialog), 'Actions')
    const additionalControlsHeading = within(controlsPane).getByRole('heading', { name: 'Additional Controls' })
    expect(additionalControlsHeading).toBeInTheDocument()
    expect(zonesHeading).not.toBeInTheDocument()
    expect(autoCleanHeading).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Empty Dock' }).querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:delete-restore'))
    await clickModalTab(within(dialog), 'Info')
    expect(within(controlsPane).getAllByRole('heading').map((heading) => heading.textContent)).toEqual(['Bin State', 'Consumables'])
    expect(within(controlsPane).getByRole('heading', { name: 'Bin State' })).toBeInTheDocument()
    expect(within(controlsPane).getByRole('heading', { name: 'Consumables' })).toBeInTheDocument()
    expect(within(controlsPane).getByRole('group', { name: 'Main Brush 204h left' })).toBeInTheDocument()
    expect(within(controlsPane).getByRole('group', { name: 'Dustbag OK' })).toBeInTheDocument()
  })

  it('runs source-derived vacuum modal services without activating hidden actions', async () => {
    const { rerender } = render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    fireEvent.click(screen.getByRole('button', { name: /Main Floor Docked/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Locate' }))
    fireEvent.change(screen.getByRole('combobox', { name: /Fan Balanced/i }), { target: { value: 'turbo' } })
    expect(screen.getByRole('combobox', { name: /Fan Turbo/i })).toHaveValue('turbo')
    await clickModalTab(within(screen.getByRole('dialog')), 'Actions')
    fireEvent.click(screen.getByRole('button', { name: 'Empty Dock' }))
    await clickModalTab(within(screen.getByRole('dialog')), 'Zones')
    fireEvent.click(screen.getByRole('button', { name: 'Living Room' }))
    await clickModalTab(within(screen.getByRole('dialog')), 'Auto-Clean')
    fireEvent.click(screen.getByRole('button', { name: 'Office auto-clean enabled' }))
    await clickModalTab(within(screen.getByRole('dialog')), 'Controls')
    fireEvent.click(screen.getByRole('button', { name: 'Clean' }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'vacuum', service: 'locate', target: 'vacuum.valetudo_exaltedsneakydeer' },
      { domain: 'select', service: 'select_option', target: 'select.valetudo_exaltedsneakydeer_fan', serviceData: { option: 'turbo' } },
      { domain: 'button', service: 'press', target: 'button.valetudo_exaltedsneakydeer_trigger_auto_empty_dock' },
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
      { domain: 'input_boolean', service: 'turn_on', target: 'input_boolean.roborock_living_room_toggle' },
      { domain: 'switch', service: 'turn_on', target: 'switch.main_floor_vacuum_coordinator_office_auto_clean_disabled' },
      { domain: 'script', service: 'main_floor_vacuum_clean_selected_segments', target: undefined },
    ]), { timeout: 1500 })
  })

  it('keeps mapped vacuum error text visible in the modal status area', async () => {
    mockEntities['vacuum.valetudo_exaltedsneakydeer'].state = 'error'
    mockEntities['sensor.valetudo_exaltedsneakydeer_error'].state = 'Brush stuck'
    mockEntities['input_text.main_floor_vacuum_error_message'].state = 'Main brush is stuck under the sofa'
    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    fireEvent.click(screen.getByRole('button', { name: /Main Floor Error/i }))

    const errorMessage = await screen.findByRole('alert')
    const statusPill = screen.getByText('Status').closest('[data-icon]')
    expect(within(errorMessage).getByText('Main brush is stuck under the sofa')).toBeInTheDocument()
    expect(statusPill).toHaveAttribute('data-icon', 'mdi:alert-circle')
    expect(statusPill).toHaveAttribute('data-tone', 'danger')
    expect(statusPill?.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:alert-circle'))
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dock' })).toBeInTheDocument()
  })

  it('opens Theater Room vacuum with map and full Valetudo power controls', async () => {
    render(<DashboardViewPage activePath="theater-room" onNavigate={() => undefined} path="theater-room" />)

    fireEvent.click(screen.getByRole('button', { name: /Theater Room Docked/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Theater Room: Robot Vacuum' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Theater Room Valetudo map' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Theater Room modal sections' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Controls' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Actions' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Info' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Zones' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rooms' })).not.toBeInTheDocument()
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
      { domain: 'homeassistant', service: 'toggle', target: 'cover.left_door' },
      { domain: 'homeassistant', service: 'toggle', target: 'cover.right_door' },
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

  it('renders the Food home sub-page with food spaces and a Scan Item FAB', () => {
    const navigate = vi.fn()
    render(<DashboardViewPage activePath="food" onNavigate={navigate} path="food" />)

    expect(screen.getByRole('heading', { name: 'Food' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'All Food' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Food Spaces' })).toBeInTheDocument()
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
    render(<DashboardViewPage activePath="back-deck" onNavigate={() => undefined} path="back-deck" />)

    expect(screen.getByRole('heading', { name: 'Grill' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Bear Grills Off/i })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Bear Grills Off')).toHaveAttribute('data-muted', 'true')
    expect(screen.queryByText('Pellet Level')).not.toBeInTheDocument()
    expect(screen.queryByText('Keep Warm')).not.toBeInTheDocument()

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
    const stephenPc = screen.getByRole('button', { name: /Stephen's PC On/i })
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
    expect(screen.queryByRole('heading', { name: 'Mach-E' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Doors Locked/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/not available in the React dashboard yet/i)).not.toBeInTheDocument()
  })

  it('shows Guest Presence Security on the Security page when a guest room is active', async () => {
    mockEntities['input_boolean.guests_staying_in_music_room'].state = 'on'
    render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    expect(screen.getByRole('heading', { name: 'Guest Presence Security' })).toBeInTheDocument()
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

    mockEntities['cover.left_door'].state = 'open'
    mockEntities['cover.right_door'].state = 'open'
    const openView = render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    expect(screen.getByRole('button', { name: /Left Door Open/i })).toHaveAttribute('data-tone', 'danger')
    expect(screen.getByRole('button', { name: /Left Door Open/i })).toHaveAttribute('data-muted', 'false')
    expect(screen.getByRole('button', { name: /Right Door Open/i })).toHaveAttribute('data-tone', 'danger')
    expect(screen.getByRole('button', { name: /Right Door Open/i })).toHaveAttribute('data-muted', 'false')
    openView.unmount()

    mockEntities['cover.left_door'].state = 'closing'
    mockEntities['cover.right_door'].state = 'closing'
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

  it('runs explicit lock services and YAML toggle actions for garage doors', () => {
    render(<DashboardViewPage activePath="security" onNavigate={() => undefined} path="security" />)

    fireEvent.click(screen.getByRole('button', { name: /Front Door Locked/i }))
    fireEvent.click(screen.getByRole('button', { name: /Left Door Closed/i }))

    expect(mockCallServiceCalls).toEqual([
      { domain: 'lock', service: 'unlock', target: 'lock.aqara_smart_lock_u400' },
      { domain: 'homeassistant', service: 'toggle', target: 'cover.left_door' },
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
    const cannedBeansLabel = testExpiryLabel(3, 2)
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
    await waitFor(() => expect(within(allFoodList).getAllByRole('group', { name: /Expires|Expired|No expiration date/i })).toHaveLength(12))
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
    await waitFor(() => expect(within(pantryList).getAllByRole('group', { name: /Expires|Expired|No expiration date/i })).toHaveLength(3))
    expect(screen.getByRole('button', { name: 'Sort' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument()
    expect(within(pantryList).getAllByRole('group', { name: /Expires|Expired|No expiration date/i }).map((row) => row.getAttribute('aria-label'))).toEqual([
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
    expect(screen.getByLabelText('Expiration date for Almond Flour item 1')).toHaveAttribute('type', 'date')
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
    expect(within(cannedBeansRow).queryByRole('button', { name: 'Edit Canned Beans' })).not.toBeInTheDocument()
    expect(within(cannedBeansRow).queryByRole('button', { name: 'Delete Canned Beans' })).not.toBeInTheDocument()
    const viewCannedBeansButton = within(cannedBeansRow).getByRole('button', { name: 'View Canned Beans individual items' })
    expect(viewCannedBeansButton).toHaveAttribute('data-modal-disclosure-button', 'true')
    expect(viewCannedBeansButton.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:chevron-right'))
    fireEvent.click(viewCannedBeansButton)
    expect(await screen.findByRole('dialog', { name: /Canned Beans/i })).toBeInTheDocument()
    expect(screen.queryByText('Individual pantry items')).not.toBeInTheDocument()
    const expirationInput = screen.getByLabelText('Expiration date for Canned Beans item 1')
    expect(expirationInput).toHaveAttribute('type', 'date')
    expect(screen.queryByRole('button', { name: 'Save Canned Beans item 1' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete Canned Beans item 1' })).toHaveClass(/deleteAction/)

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const callCountBeforeDeniedDelete = mockCallServiceCalls.length
    fireEvent.click(screen.getByRole('button', { name: 'Delete Canned Beans item 1' }))
    expect(confirmSpy).toHaveBeenCalledWith('Delete Canned Beans item 1 from the pantry?')
    expect(mockCallServiceCalls).toHaveLength(callCountBeforeDeniedDelete)
    confirmSpy.mockRestore()

    fireEvent.change(expirationInput, { target: { value: '2026-09-30' } })
    expect(screen.getByRole('button', { name: 'Save Canned Beans item 1' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save Canned Beans item 1' }))
      await Promise.resolve()
    })
    expect(mockCallServiceCalls).toContainEqual({
      domain: 'evershelf',
      service: 'update_inventory_item',
      serviceData: { expiry_date: '2026-09-30', inventory_id: 102 },
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
    await waitFor(() => expect(within(fridgeList).getAllByRole('group', { name: /Expires|Expired|No expiration date/i })).toHaveLength(3))
    expect(within(fridgeList).getAllByRole('group', { name: /Expires|Expired|No expiration date/i }).map((row) => row.getAttribute('aria-label'))).toEqual([
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
    const deleteQuantityPromptSpy = vi.spyOn(window, 'prompt').mockReturnValue('1')
    const deleteConfirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(within(greekYogurtRow).getByRole('button', { name: 'Delete Greek Yogurt' }))
    expect(deleteQuantityPromptSpy).toHaveBeenCalledWith('Quantity of Greek Yogurt to delete (available: 2).', '1')
    expect(deleteConfirmSpy).not.toHaveBeenCalled()
    expect(mockCallServiceCalls).toContainEqual({
      domain: 'evershelf',
      service: 'delete_inventory',
      serviceData: { inventory_id: 203, quantity: 1 },
    })
    await waitFor(() => expect(within(fridgeList).getByRole('group', { name: `Greek Yogurt ${testExpiryLabel(5)}` })).toBeInTheDocument())
    deleteQuantityPromptSpy.mockRestore()
    deleteConfirmSpy.mockRestore()

    mockCallServiceCalls.length = 0
    fridgeView.unmount()
    render(<DashboardViewPage activePath="freezer" onNavigate={() => undefined} path="freezer" />)

    expect(screen.getByRole('heading', { name: 'Freezer' })).toBeInTheDocument()
    const freezerList = await screen.findByLabelText('Freezer inventory list')
    await waitFor(() => expect(within(freezerList).getAllByRole('group', { name: /Expires|Expired|No expiration date/i })).toHaveLength(2))
    expect(within(freezerList).getAllByRole('group', { name: /Expires|Expired|No expiration date/i }).map((row) => row.getAttribute('aria-label'))).toEqual([
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
    await waitFor(() => expect(within(spiceRackList).getAllByRole('group', { name: /Expires|Expired|No expiration date/i })).toHaveLength(2))
    expect(within(spiceRackList).getAllByRole('group', { name: /Expires|Expired|No expiration date/i }).map((row) => row.getAttribute('aria-label'))).toEqual([
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
    await waitFor(() => expect(within(cabinetList).getAllByRole('group', { name: /Expires|Expired|No expiration date/i })).toHaveLength(2))
    expect(within(cabinetList).getAllByRole('group', { name: /Expires|Expired|No expiration date/i }).map((row) => row.getAttribute('aria-label'))).toEqual([
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
    await waitFor(() => expect(within(fridgeList).getAllByRole('group', { name: /Expires|Expired|No expiration date/i })).toHaveLength(3))
    expect(within(fridgeList).getAllByRole('group', { name: /Expires|Expired|No expiration date/i }).map((row) => row.getAttribute('aria-label'))).toEqual([
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
    expect(within(floatingDock as HTMLElement).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual(['Search inventory', 'Sort', 'Filter', 'Scan Item'])
    expect(within(floatingDock as HTMLElement).getAllByRole('button').map((button) => button.textContent?.trim())).toEqual(['Search', '', '', ''])
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
    expect(within(fridgeList).getAllByRole('group', { name: /Expires|Expired|No expiration date/i }).map((row) => row.getAttribute('aria-label'))).toEqual([
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
    expect(within(fridgeList).getAllByRole('group', { name: /Expires|Expired|No expiration date/i }).map((row) => row.getAttribute('aria-label'))).toEqual([
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
    expect(within(fridgeList).getAllByRole('group', { name: /Expires|Expired|No expiration date/i }).map((row) => row.getAttribute('aria-label'))).toEqual([
      `Greek Yogurt ${greekYogurtLabel}`,
    ])
  })

  it('searches inventory from the floating action dock with Festival-style debounce, clear, and collapse behavior', async () => {
    const greekYogurtLabel = testExpiryLabel(5, 2)
    const milkLabel = testExpiryLabel(-400)
    const salsaLabel = testExpiryLabel(370)
    render(<DashboardViewPage activePath="fridge" onNavigate={() => undefined} path="fridge" />)

    const fridgeList = await screen.findByLabelText('Fridge inventory list')
    await waitFor(() => expect(within(fridgeList).getAllByRole('group', { name: /Expires|Expired|No expiration date/i })).toHaveLength(3))
    const floatingDock = document.querySelector('[data-floating-action-dock="true"]') as HTMLElement
    const searchButton = within(floatingDock).getByRole('button', { name: 'Search inventory' })

    fireEvent.click(searchButton)

    const searchInput = await screen.findByLabelText('Search inventory')
    await waitFor(() => expect(searchInput).toHaveFocus())
    expect(screen.getByRole('button', { name: 'Sort' }).closest('span')).toHaveAttribute('data-collapsed', 'true')
    expect(screen.getByRole('button', { name: 'Filter' }).closest('span')).toHaveAttribute('data-collapsed', 'true')

    fireEvent.change(searchInput, { target: { value: 'milk' } })

    expect(searchInput).toHaveValue('milk')
    expect(screen.getByRole('button', { name: 'Clear Search' })).toBeInTheDocument()
    expect(within(fridgeList).getAllByRole('group', { name: /Expires|Expired|No expiration date/i })).toHaveLength(3)

    await waitFor(
      () => expect(within(fridgeList).getAllByRole('group', { name: /Expires|Expired|No expiration date/i }).map((row) => row.getAttribute('aria-label'))).toEqual([
        `Milk ${milkLabel}`,
      ]),
      { timeout: INVENTORY_SEARCH_DEBOUNCE_MS + 500 },
    )

    fireEvent.change(searchInput, { target: { value: 'dragonfruit' } })

    await waitFor(
      () => expect(screen.getByRole('heading', { name: 'No matching items' })).toBeInTheDocument(),
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
      () => expect(within(fridgeList).getAllByRole('group', { name: /Expires|Expired|No expiration date/i }).map((row) => row.getAttribute('aria-label'))).toEqual([
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

      expect(await screen.findByRole('heading', { name: 'No items found' })).toBeInTheDocument()
      expect(screen.getByText('Scan an item to add it to your pantry.')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'No items found' }).closest('[data-empty-layout]')).toHaveAttribute('data-empty-layout', 'centered')
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

      expect(await screen.findByRole('heading', { name: 'Unable to load Freezer' })).toBeInTheDocument()
      expect(screen.getByText('Freezer is unavailable')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Unable to load Freezer' }).closest('[data-empty-layout]')).toHaveAttribute('data-empty-layout', 'centered')
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
      { destination: 'fridge', label: 'Fridge', location: 'frigo', path: 'all-food' },
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
  })

  it('renders chore tasks as Ecobee-style checkbox rows with optional subtitles', async () => {
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
    const describedTask = within(dueTodayList).getByRole('button', { name: /Replace HVAC filter\s+Use MERV 13 · Due in 2 days/i })
    const plainTask = within(dueTodayList).getByRole('button', { name: 'Take out trash' })

    expect(describedTask.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:checkbox-blank-outline'))
    expect(within(describedTask).getByText('Use MERV 13 · Due in 2 days')).toBeInTheDocument()
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
    expect(screen.getByRole('button', { name: /Groceries 2 items/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Stephen's Tasks 5 active tasks/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Steph's Tasks No active tasks/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Unassigned Tasks 17 active tasks/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Groceries 2 items/i }))
    expect(navigate).toHaveBeenCalledWith('groceries')

    expect(screen.getByRole('heading', { name: 'Past Due' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Evening Tasks' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Afternoon Tasks' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'No Due Date' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Upcoming' })).toBeInTheDocument()
    expect(screen.getAllByLabelText(/todo list$/)).toHaveLength(4)
    expect(within(screen.getByLabelText('Past Due todo list')).queryByText('Active')).not.toBeInTheDocument()
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

    const eveningList = await screen.findByLabelText('Evening Tasks todo list')
    fireEvent.click(within(eveningList).getByRole('button', { name: /Mock task one/i }))

    expect(mockCallServiceCalls).toContainEqual({
      domain: 'todo',
      service: 'update_item',
      target: 'todo.steph_s_evening_with_unassigned',
      serviceData: { item: 'todo.steph_s_evening_with_unassigned-1', status: 'completed' },
    })
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
    expect(await screen.findByRole('heading', { name: 'No groceries listed' })).toBeInTheDocument()
    expect(screen.getByText('Add some groceries via the YAML app for now to see them appear here.')).toBeInTheDocument()
    await waitFor(() => expect(scroller).toHaveAttribute('data-scroll-lock', 'true'))
    expect(screen.getByRole('heading', { name: 'No groceries listed' }).closest('[data-empty-todo-page]')).toHaveAttribute('data-empty-todo-page', 'true')
  })

  it('renders an empty task state when a todo page has no visible task sections', async () => {
    for (const entityId of ['todo.steph_s_past_due', 'todo.steph_s_due_today', 'todo.steph_s_upcoming', 'todo.steph_s_no_due_date']) {
      mockTodoItemsByEntity[entityId] = []
      mockEntities[entityId] = entity(entityId, '1')
    }

    render(<DashboardViewPage activePath="stephs-chores" onNavigate={() => undefined} path="stephs-chores" />)

    expect(await screen.findByRole('heading', { name: 'No Tasks!' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByLabelText(/todo list$/)).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'No Tasks!' }).parentElement).toHaveAttribute('data-empty-layout', 'centered')
    expect(screen.getByRole('heading', { name: 'No Tasks!' }).parentElement).toHaveAttribute('data-empty-typography', 'festival')
    expect(Array.from(screen.getByRole('main').children)[1]).toHaveAttribute('data-scroll-lock', 'true')
    expect(screen.getByText('You have no tasks due- nice job!')).toBeInTheDocument()
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
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveAttribute('data-state', 'closed'))
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
    const { rerender } = render(<DashboardViewPage activePath="chores" onNavigate={() => undefined} path="chores" />)

    expect(await screen.findByRole('button', { name: 'Add Task' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }))
    expect(within(await screen.findByRole('dialog')).getByLabelText('Assignee')).toHaveValue('')

    rerender(<DashboardViewPage activePath="stephens-chores" onNavigate={() => undefined} path="stephens-chores" />)
    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }))
    expect(within(await screen.findByRole('dialog')).getByLabelText('Assignee')).toHaveValue('1')

    rerender(<DashboardViewPage activePath="stephs-chores" onNavigate={() => undefined} path="stephs-chores" />)
    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }))
    expect(within(await screen.findByRole('dialog')).getByLabelText('Assignee')).toHaveValue('2')

    rerender(<DashboardViewPage activePath="unassigned-chores" onNavigate={() => undefined} path="unassigned-chores" />)
    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }))
    expect(within(await screen.findByRole('dialog')).getByLabelText('Assignee')).toHaveValue('')

    rerender(<DashboardViewPage activePath="home-improvement-chores" onNavigate={() => undefined} path="home-improvement-chores" />)
    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }))
    expect(within(await screen.findByRole('dialog')).getByLabelText('Assignee')).toHaveValue('3')

    rerender(<DashboardViewPage activePath="groceries" onNavigate={() => undefined} path="groceries" />)
    expect(screen.queryByRole('button', { name: 'Add Task' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Groceries' })).toBeInTheDocument()
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
    expect(within(list).getByRole('button', { name: /Review reminders/i })).toBeInTheDocument()

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

  it('renders the shared empty state when the Settings To-Do list is empty', async () => {
    mockTodoItemsByEntity['todo.groceries'] = []
    mockEntities['todo.groceries'].state = '0'
    render(<DashboardViewPage activePath="settings" onNavigate={() => undefined} path="to-do" />)

    const emptyHeading = await screen.findByRole('heading', { name: 'No to-do tasks' })

    expect(emptyHeading.parentElement).toHaveAttribute('data-empty-layout', 'centered')
    expect(emptyHeading.parentElement).toHaveAttribute('data-empty-typography', 'festival')
    expect(screen.getByText('Use Add Task to create an admin to-do.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Admin To-Do todo list')).not.toBeInTheDocument()
  })

  it('renders the thermostat route as a dedicated Ecobee port', () => {
    render(<DashboardViewPage activePath="ecobee" onNavigate={() => undefined} path="ecobee" />)

    expect(screen.getByRole('heading', { name: 'Thermostat' })).toBeInTheDocument()
    expect(screen.queryByText(/not available in the React dashboard yet/i)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Eco Mode' })).toBeInTheDocument()
  })

  it('keeps vacuum modal controls optimistic while Valetudo state is still stale', async () => {
    const { rerender } = render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    fireEvent.click(screen.getByRole('button', { name: /Main Floor Docked/i }))

    const dialog = await screen.findByRole('dialog')
    const controlsPane = within(dialog).getByRole('group', { name: 'Main Floor controls, zones, auto-clean, actions, info' })
    const modeSelect = screen.getByRole('combobox', { name: /Mode Vacuum/i })
    modeSelect.focus()
    expect(modeSelect).toHaveFocus()
    fireEvent.change(modeSelect, { target: { value: 'mop' } })

    expect(mockEntities['select.valetudo_exaltedsneakydeer_mode'].state).toBe('vacuum')
    expect(screen.getByRole('combobox', { name: /Mode Mop/i })).toHaveValue('mop')
    expect(Array.from(screen.getByRole<HTMLSelectElement>('combobox', { name: /Mode Mop/i }).options).map((option) => option.text)).toEqual(['Vacuum And Mop', 'Mop', 'Vacuum', 'Vacuum Then Mop'])
    expect(screen.getByRole('combobox', { name: /Mode Mop/i })).not.toHaveFocus()
    expect(screen.queryByRole('combobox', { name: /Fan/i })).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Water Medium/i })).toHaveValue('medium')

    const cleaningPasses = screen.getByRole('combobox', { name: /Cleaning Passes 1x/i })
    fireEvent.change(cleaningPasses, { target: { value: '3' } })

    expect(mockEntities['input_select.main_floor_vacuum_cleaning_passes'].state).toBe('1')
    expect(screen.getByRole('combobox', { name: /Cleaning Passes 3x/i })).toHaveValue('3')

    fireEvent.click(screen.getByRole('button', { name: 'Clean' }))

    expect(mockEntities['vacuum.valetudo_exaltedsneakydeer'].state).toBe('docked')
    expect(within(controlsPane).getByRole('heading', { name: 'Cleaning' })).toBeInTheDocument()
    expect(within(controlsPane).queryByRole('button', { name: 'Clean' })).not.toBeInTheDocument()
    expect(within(controlsPane).getByRole('button', { name: 'Pause' })).toBeDisabled()
    expect(within(controlsPane).getByRole('button', { name: 'Stop' })).toBeDisabled()

    await clickModalTab(within(dialog), 'Zones')
    const livingRoomZone = screen.getByRole('button', { name: 'Living Room' })
    expect(livingRoomZone).toBeDisabled()

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

  it('keeps manual vacuum starts locked past the generic optimistic timeout', async () => {
    const { rerender } = render(<DashboardViewPage activePath="theater-room" onNavigate={() => undefined} path="theater-room" />)

    fireEvent.click(screen.getByRole('button', { name: /Theater Room Docked/i }))

    const dialog = await screen.findByRole('dialog')
    const controlsPane = within(dialog).getByRole('group', { name: 'Theater Room controls, actions, info' })
    vi.useFakeTimers()
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Clean' }))

      expect(mockEntities['vacuum.valetudo_politefatherlykingfisher'].state).toBe('docked')
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

  it('toggles vacuum zones optimistically while Home Assistant input booleans are still stale', async () => {
    render(<DashboardViewPage activePath="living-room" onNavigate={() => undefined} path="living-room" />)

    fireEvent.click(screen.getByRole('button', { name: /Main Floor Docked/i }))
    const dialog = await screen.findByRole('dialog')
    await clickModalTab(within(dialog), 'Zones')

    const livingRoomZone = screen.getByRole('button', { name: 'Living Room' })
    expect(livingRoomZone).toHaveAttribute('data-active', 'false')

    fireEvent.click(livingRoomZone)

    expect(mockEntities['input_boolean.roborock_living_room_toggle'].state).toBe('off')
    expect(livingRoomZone).toHaveAttribute('data-active', 'true')
    expect(mockCallServiceCalls).toEqual([
      { domain: 'input_boolean', service: 'turn_on', target: 'input_boolean.roborock_living_room_toggle' },
    ])
  })

  it('opens available vacuum cards as modal controls and leaves unavailable cards inert', async () => {
    render(<DashboardViewPage activePath="vacuums" onNavigate={() => undefined} path="vacuums" />)

    expect(screen.getByLabelText('Music Room')).toHaveAttribute('data-icon', 'mdi:robot-vacuum-off')
    const mainFloorVacuum = screen.getByRole('button', { name: /main floor docked/i })
    expect(mainFloorVacuum).toHaveAttribute('data-tone', 'vacuum')
    expect(mainFloorVacuum).toHaveAttribute('data-icon', 'mdi:home')
    fireEvent.click(mainFloorVacuum)

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveStyle(VACUUM_MODAL_STYLE)
    expect(screen.getByRole('heading', { name: 'Main Floor Robot Vacuum' })).toBeInTheDocument()
    const mapPane = within(dialog).getByRole('group', { name: 'Main Floor map and status' })
    const controlsPane = within(dialog).getByRole('group', { name: 'Main Floor controls, zones, auto-clean, actions, info' })
    expect(within(mapPane).getByRole('region', { name: 'Main Floor Valetudo map' })).toBeInTheDocument()
    expect(within(mapPane).getByText('Battery')).toBeInTheDocument()
    expect(screen.queryByText('No error')).not.toBeInTheDocument()
    expect(within(controlsPane).getAllByRole('heading').map((heading) => heading.textContent)).toEqual(['Docked', 'Power Settings'])
    const fanSelect = screen.getByRole('combobox', { name: /Fan Balanced/i })
    expect(fanSelect).toHaveValue('balanced')
    expect(fanSelect.closest('[data-layout]')).toHaveAttribute('data-layout', 'default')
    expect(fanSelect.closest('[data-has-description]')).toHaveAttribute('data-has-description', 'true')
    const fanDescription = screen.getByText('Adjust suction strength for carpets, hard floors, and quieter cleaning.')
    expect(fanDescription).toBeInTheDocument()
    expect(fanDescription.closest('[data-native-select]')).toBeNull()
    expect(fanDescription.compareDocumentPosition(fanSelect) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByText('Set the cleaning mode, suction, and water level before starting the next run.')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Fan' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clean' })).toBeInTheDocument()
    await clickModalTab(within(dialog), 'Zones')
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
    const mainFloorVacuum = within(robotSection as HTMLElement).getByLabelText(/Main Floor/)
    const musicRoomVacuum = within(robotSection as HTMLElement).getByLabelText(/^Music Room/)
    const theaterRoomVacuum = within(robotSection as HTMLElement).getByLabelText(/Theater Room/)
    expect(mainFloorVacuum.compareDocumentPosition(musicRoomVacuum) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(musicRoomVacuum.compareDocumentPosition(theaterRoomVacuum) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const autoCleanSection = screen.getByRole('heading', { name: 'Auto-Clean' }).closest('section')
    expect(autoCleanSection).toBeTruthy()
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

  it('opens the real Vacuums route modal from a vacuum URL hash', async () => {
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
  })
})
