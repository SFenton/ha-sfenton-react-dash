import chalk from 'chalk'
import { config } from 'dotenv'

config({ path: '.env', quiet: true })
config({ path: '.env.development', quiet: true })

type EntityRegistryEntry = {
  disabled_by?: string | null
  device_id?: string | null
  entity_id: string
  name?: string | null
  original_name?: string | null
  platform?: string
  unique_id?: string
}

type DeviceRegistryEntry = {
  area_id?: string | null
  config_entries?: string[]
  connections?: [string, string][]
  id: string
  identifiers?: [string, string][]
  manufacturer?: string | null
  model?: string | null
  name?: string | null
  name_by_user?: string | null
  suggested_area?: string | null
}

type AreaRegistryEntry = {
  area_id: string
  name: string
}

type HassState = {
  attributes: Record<string, unknown>
  entity_id: string
  state: string
}

type Z2mDevice = {
  definition?: {
    description?: string
    model?: string
    vendor?: string
  }
  friendly_name?: string
  ieee_address?: string
  interview_completed?: boolean
  model_id?: string
  supported?: boolean
}

type SensorPlan = {
  areaGroup: string
  currentDeviceName: string
  currentEntities: Record<string, string>
  expectedIeee: `0x${string}`
  key: string
  label: string
  notes?: string[]
  targetDeviceName: string
  targetEntities: Record<string, string>
}

const HA_URL = process.env.VITE_HA_URL
const HA_TOKEN = process.env.VITE_HA_TOKEN

const HALLWAY_SENSORS: SensorPlan[] = [
  {
    areaGroup: 'hallway',
    key: 'guestBathGym',
    label: 'Hallway guest-room side',
    currentDeviceName: 'Hallway (Guest/Bath/Gym) Presence Sensor',
    expectedIeee: '0x54ef44100146dc08',
    targetDeviceName: 'Hallway (Guest/Bath/Gym) Presence Sensor',
    currentEntities: {
      occupancy: 'binary_sensor.hallway_guest_bath_gym_presence_occupancy',
      occupancyRlc: 'sensor.hallway_guest_bath_gym_presence_sensor_occupancy',
      temperature: 'sensor.hallway_guest_bath_gym_presence_temperature',
      humidity: 'sensor.hallway_guest_bath_gym_presence_humidity',
      illuminance: 'sensor.hallway_guest_bath_gym_presence_illuminance',
    },
    targetEntities: {
      occupancy: 'binary_sensor.hallway_guest_bath_gym_presence_occupancy',
      motion: 'binary_sensor.hallway_guest_bath_gym_presence_motion',
      occupancyRlc: 'sensor.hallway_guest_bath_gym_presence_sensor_occupancy',
      temperature: 'sensor.hallway_guest_bath_gym_presence_temperature',
      humidity: 'sensor.hallway_guest_bath_gym_presence_humidity',
      illuminance: 'sensor.hallway_guest_bath_gym_presence_illuminance',
    },
  },
  {
    areaGroup: 'hallway',
    key: 'officeBedroom',
    label: 'Hallway office/bedroom side',
    currentDeviceName: 'Hallway (Office/Bedroom) Presence Sensor',
    expectedIeee: '0x54ef44100146ca84',
    targetDeviceName: 'Hallway (Office/Bedroom) Presence Sensor',
    currentEntities: {
      occupancy: 'binary_sensor.hallway_office_bedroom_presence_occupancy',
      occupancyRlc: 'sensor.hallway_office_bedroom_presence_sensor_occupancy',
      temperature: 'sensor.hallway_office_bedroom_presence_temperature',
      humidity: 'sensor.hallway_office_bedroom_presence_humidity',
      illuminance: 'sensor.hallway_office_bedroom_presence_illuminance',
    },
    targetEntities: {
      occupancy: 'binary_sensor.hallway_office_bedroom_presence_occupancy',
      motion: 'binary_sensor.hallway_office_bedroom_presence_motion',
      occupancyRlc: 'sensor.hallway_office_bedroom_presence_sensor_occupancy',
      temperature: 'sensor.hallway_office_bedroom_presence_temperature',
      humidity: 'sensor.hallway_office_bedroom_presence_humidity',
      illuminance: 'sensor.hallway_office_bedroom_presence_illuminance',
    },
  },
  {
    areaGroup: 'hallway',
    key: 'entryway',
    label: 'Hallway entryway/living-room side',
    currentDeviceName: 'Hallway/Entryway/Living Room Presence Sensor',
    expectedIeee: '0x54ef44100146f60f',
    targetDeviceName: 'Hallway/Entryway/Living Room Presence Sensor',
    currentEntities: {
      occupancy: 'binary_sensor.entryway_presence_occupancy',
      occupancyRlc: 'sensor.hallway_entryway_living_room_presence_sensor_occupancy',
      temperature: 'sensor.entryway_presence_temperature',
      humidity: 'sensor.entryway_presence_humidity',
      illuminance: 'sensor.entryway_presence_illuminance',
    },
    targetEntities: {
      occupancy: 'binary_sensor.entryway_presence_occupancy',
      motion: 'binary_sensor.entryway_presence_motion',
      occupancyRlc: 'sensor.hallway_entryway_living_room_presence_sensor_occupancy',
      temperature: 'sensor.entryway_presence_temperature',
      humidity: 'sensor.entryway_presence_humidity',
      illuminance: 'sensor.entryway_presence_illuminance',
    },
    notes: ['Entryway PBL currently references sensor.entryway_presence_occupancy, which does not exist in live states. Re-check this during apply.'],
  },
]

const MASTER_SENSORS: SensorPlan[] = [
  {
    areaGroup: 'master',
    key: 'masterBedroomWindow',
    label: 'Master bedroom window side',
    currentDeviceName: 'Master Bedroom Window Presence Sensor',
    expectedIeee: '0x54ef44100146f191',
    targetDeviceName: 'Master Bedroom Window Presence Sensor',
    currentEntities: {
      occupancy: 'binary_sensor.master_bedroom_window_presence_occupancy',
      occupancyRlc: 'sensor.master_bedroom_window_presence_sensor_occupancy',
      temperature: 'sensor.master_bedroom_window_presence_temperature',
      humidity: 'sensor.master_bedroom_window_presence_humidity',
      illuminance: 'sensor.master_bedroom_window_presence_illuminance',
    },
    targetEntities: {
      occupancy: 'binary_sensor.master_bedroom_window_presence_occupancy',
      motion: 'binary_sensor.master_bedroom_window_presence_motion',
      occupancyRlc: 'sensor.master_bedroom_window_presence_sensor_occupancy',
      temperature: 'sensor.master_bedroom_window_presence_temperature',
      humidity: 'sensor.master_bedroom_window_presence_humidity',
      illuminance: 'sensor.master_bedroom_window_presence_illuminance',
    },
  },
  {
    areaGroup: 'master',
    key: 'masterBedroomBathroom',
    label: 'Master bedroom bathroom side',
    currentDeviceName: 'Master Bedroom Bathroom Presence Sensor',
    expectedIeee: '0x54ef4410014ae9cb',
    targetDeviceName: 'Master Bedroom Bathroom Presence Sensor',
    currentEntities: {
      occupancy: 'binary_sensor.master_bedroom_bathroom_presence_occupancy',
      occupancyRlc: 'sensor.master_bedroom_bathroom_presence_sensor_occupancy',
      temperature: 'sensor.master_bedroom_bathroom_presence_temperature',
      humidity: 'sensor.master_bedroom_bathroom_presence_humidity',
      illuminance: 'sensor.master_bedroom_bathroom_presence_illuminance',
    },
    targetEntities: {
      occupancy: 'binary_sensor.master_bedroom_bathroom_presence_occupancy',
      motion: 'binary_sensor.master_bedroom_bathroom_presence_motion',
      occupancyRlc: 'sensor.master_bedroom_bathroom_presence_sensor_occupancy',
      temperature: 'sensor.master_bedroom_bathroom_presence_temperature',
      humidity: 'sensor.master_bedroom_bathroom_presence_humidity',
      illuminance: 'sensor.master_bedroom_bathroom_presence_illuminance',
    },
  },
  {
    areaGroup: 'master',
    key: 'masterBedroomCloset',
    label: 'Master bedroom closet side',
    currentDeviceName: 'Master Bedroom Closet Presence Sensor',
    expectedIeee: '0x54ef44100146eb59',
    targetDeviceName: 'Master Bedroom Closet Presence Sensor',
    currentEntities: {
      occupancy: 'binary_sensor.master_bedroom_closet_presence_occupancy',
      occupancyRlc: 'sensor.master_bedroom_closet_presence_sensor_occupancy',
      temperature: 'sensor.master_bedroom_closet_presence_temperature',
      humidity: 'sensor.master_bedroom_closet_presence_humidity',
      illuminance: 'sensor.master_bedroom_closet_presence_illuminance',
    },
    targetEntities: {
      occupancy: 'binary_sensor.master_bedroom_closet_presence_occupancy',
      motion: 'binary_sensor.master_bedroom_closet_presence_motion',
      occupancyRlc: 'sensor.master_bedroom_closet_presence_sensor_occupancy',
      temperature: 'sensor.master_bedroom_closet_presence_temperature',
      humidity: 'sensor.master_bedroom_closet_presence_humidity',
      illuminance: 'sensor.master_bedroom_closet_presence_illuminance',
    },
  },
  {
    areaGroup: 'master',
    key: 'masterBathroom',
    label: 'Master bathroom',
    currentDeviceName: 'Master Bathroom Presense Sensor',
    expectedIeee: '0x54ef44100146f64c',
    targetDeviceName: 'Master Bathroom Presence Sensor',
    currentEntities: {
      occupancy: 'binary_sensor.master_bathroom_presence_occupancy',
      occupancyRlc: 'sensor.master_bathroom_presence_sensor_occupancy',
      temperature: 'sensor.master_bathroom_presence_temperature',
      humidity: 'sensor.master_bathroom_presence_humidity',
      illuminance: 'sensor.master_bathroom_presence_illuminance',
    },
    targetEntities: {
      occupancy: 'binary_sensor.master_bathroom_presence_occupancy',
      motion: 'binary_sensor.master_bathroom_presence_motion',
      occupancyRlc: 'sensor.master_bathroom_presence_sensor_occupancy',
      temperature: 'sensor.master_bathroom_presence_temperature',
      humidity: 'sensor.master_bathroom_presence_humidity',
      illuminance: 'sensor.master_bathroom_presence_illuminance',
    },
    notes: ['The current Matter device name is misspelled as "Presense"; target naming corrects this to "Presence" after Z2M pairing.'],
  },
]

const GUEST_GYM_KITCHEN_SENSORS: SensorPlan[] = [
  {
    areaGroup: 'guest-gym-kitchen',
    key: 'guestRoom',
    label: 'Guest room main',
    currentDeviceName: 'Guest Room Presence Sensor',
    expectedIeee: '0x54ef44100146e2e2',
    targetDeviceName: 'Guest Room Presence Sensor',
    currentEntities: {
      occupancy: 'binary_sensor.guest_room_presence_occupancy',
      occupancyRlc: 'sensor.guest_room_presence_sensor_occupancy',
      temperature: 'sensor.guest_room_presence_temperature',
      humidity: 'sensor.guest_room_presence_humidity',
      illuminance: 'sensor.guest_room_presence_illuminance',
    },
    targetEntities: {
      occupancy: 'binary_sensor.guest_room_presence_occupancy',
      motion: 'binary_sensor.guest_room_presence_motion',
      occupancyRlc: 'sensor.guest_room_presence_sensor_occupancy',
      temperature: 'sensor.guest_room_presence_temperature',
      humidity: 'sensor.guest_room_presence_humidity',
      illuminance: 'sensor.guest_room_presence_illuminance',
    },
  },
  {
    areaGroup: 'guest-gym-kitchen',
    key: 'guestRoomClosetFacing',
    label: 'Guest room closet-facing',
    currentDeviceName: 'Guest Room Closet Facing Presence Sensor',
    expectedIeee: '0x54ef441001497be3',
    targetDeviceName: 'Guest Room Closet Facing Presence Sensor',
    currentEntities: {
      occupancy: 'binary_sensor.guest_room_closet_facing_presence_occupancy',
      occupancyRlc: 'sensor.guest_room_closet_facing_presence_sensor_occupancy',
      temperature: 'sensor.guest_room_closet_facing_presence_temperature',
      humidity: 'sensor.guest_room_closet_facing_presence_humidity',
      illuminance: 'sensor.guest_room_closet_facing_presence_illuminance',
    },
    targetEntities: {
      occupancy: 'binary_sensor.guest_room_closet_facing_presence_occupancy',
      motion: 'binary_sensor.guest_room_closet_facing_presence_motion',
      occupancyRlc: 'sensor.guest_room_closet_facing_presence_sensor_occupancy',
      temperature: 'sensor.guest_room_closet_facing_presence_temperature',
      humidity: 'sensor.guest_room_closet_facing_presence_humidity',
      illuminance: 'sensor.guest_room_closet_facing_presence_illuminance',
    },
  },
  {
    areaGroup: 'guest-gym-kitchen',
    key: 'gym',
    label: 'Gym',
    currentDeviceName: 'Gym Presence Sensor',
    expectedIeee: '0x54ef44100146b48d',
    targetDeviceName: 'Gym Presence Sensor',
    currentEntities: {
      occupancy: 'binary_sensor.gym_presence_occupancy',
      occupancyRlc: 'sensor.gym_presence_sensor_occupancy',
      temperature: 'sensor.gym_presence_temperature',
      humidity: 'sensor.gym_presence_humidity',
      illuminance: 'sensor.gym_presence_illuminance',
    },
    targetEntities: {
      occupancy: 'binary_sensor.gym_presence_occupancy',
      motion: 'binary_sensor.gym_presence_motion',
      occupancyRlc: 'sensor.gym_presence_sensor_occupancy',
      temperature: 'sensor.gym_presence_temperature',
      humidity: 'sensor.gym_presence_humidity',
      illuminance: 'sensor.gym_presence_illuminance',
    },
  },
  {
    areaGroup: 'guest-gym-kitchen',
    key: 'kitchen',
    label: 'Kitchen',
    currentDeviceName: 'Kitchen Presence Sensor',
    expectedIeee: '0x54ef44100146f067',
    targetDeviceName: 'Kitchen Presence Sensor',
    currentEntities: {
      occupancy: 'binary_sensor.kitchen_wall_presence_occupancy',
      occupancyRlc: 'sensor.kitchen_presence_sensor_occupancy',
      temperature: 'sensor.kitchen_wall_presence_temperature',
      humidity: 'sensor.kitchen_wall_presence_humidity',
      illuminance: 'sensor.kitchen_wall_presence_illuminance',
    },
    targetEntities: {
      occupancy: 'binary_sensor.kitchen_wall_presence_occupancy',
      motion: 'binary_sensor.kitchen_wall_presence_motion',
      occupancyRlc: 'sensor.kitchen_presence_sensor_occupancy',
      temperature: 'sensor.kitchen_wall_presence_temperature',
      humidity: 'sensor.kitchen_wall_presence_humidity',
      illuminance: 'sensor.kitchen_wall_presence_illuminance',
    },
  },
  {
    areaGroup: 'guest-gym-kitchen',
    key: 'guestBathroom',
    label: 'Guest bathroom main',
    currentDeviceName: 'Guest Bathroom Presence Sensor',
    expectedIeee: '0x54ef44100146f0dd',
    targetDeviceName: 'Guest Bathroom Presence Sensor',
    currentEntities: {
      occupancy: 'binary_sensor.guest_bathroom_presence_occupancy',
      occupancyRlc: 'sensor.guest_bathroom_presence_sensor_occupancy',
      temperature: 'sensor.guest_bathroom_presence_temperature',
      humidity: 'sensor.guest_bathroom_presence_humidity',
      illuminance: 'sensor.guest_bathroom_presence_illuminance',
    },
    targetEntities: {
      occupancy: 'binary_sensor.guest_bathroom_presence_occupancy',
      motion: 'binary_sensor.guest_bathroom_presence_motion',
      occupancyRlc: 'sensor.guest_bathroom_presence_sensor_occupancy',
      temperature: 'sensor.guest_bathroom_presence_temperature',
      humidity: 'sensor.guest_bathroom_presence_humidity',
      illuminance: 'sensor.guest_bathroom_presence_illuminance',
    },
  },
  {
    areaGroup: 'guest-gym-kitchen',
    key: 'guestBathroomEntry',
    label: 'Guest bathroom entry',
    currentDeviceName: 'Guest Bathroom Entry Presence Sensor',
    expectedIeee: '0x54ef4410014aea57',
    targetDeviceName: 'Guest Bathroom Entry Presence Sensor',
    currentEntities: {
      occupancy: 'binary_sensor.guest_bathroom_entry_presence_occupancy',
      occupancyRlc: 'sensor.guest_bathroom_entry_presence_sensor_occupancy',
      temperature: 'sensor.guest_bathroom_entry_presence_temperature',
      humidity: 'sensor.guest_bathroom_entry_presence_humidity',
      illuminance: 'sensor.guest_bathroom_entry_presence_illuminance',
    },
    targetEntities: {
      occupancy: 'binary_sensor.guest_bathroom_entry_presence_occupancy',
      motion: 'binary_sensor.guest_bathroom_entry_presence_motion',
      occupancyRlc: 'sensor.guest_bathroom_entry_presence_sensor_occupancy',
      temperature: 'sensor.guest_bathroom_entry_presence_temperature',
      humidity: 'sensor.guest_bathroom_entry_presence_humidity',
      illuminance: 'sensor.guest_bathroom_entry_presence_illuminance',
    },
  },
]

const LIVING_FRONT_DINING_SENSORS: SensorPlan[] = [
  {
    areaGroup: 'living-front-dining',
    key: 'livingRoomBar',
    label: 'Living room bar',
    currentDeviceName: 'Living Room Bar Presence Sensor',
    expectedIeee: '0x54ef44100149ab20',
    targetDeviceName: 'Living Room Bar Presence Sensor',
    currentEntities: {
      occupancy: 'binary_sensor.living_room_bar_presence_occupancy',
      occupancyRlc: 'sensor.living_room_bar_presence_sensor_occupancy',
      temperature: 'sensor.living_room_bar_presence_temperature',
      humidity: 'sensor.living_room_bar_presence_humidity',
      illuminance: 'sensor.living_room_bar_presence_illuminance',
    },
    targetEntities: {
      occupancy: 'binary_sensor.living_room_bar_presence_occupancy',
      motion: 'binary_sensor.living_room_bar_presence_motion',
      occupancyRlc: 'sensor.living_room_bar_presence_sensor_occupancy',
      temperature: 'sensor.living_room_bar_presence_temperature',
      humidity: 'sensor.living_room_bar_presence_humidity',
      illuminance: 'sensor.living_room_bar_presence_illuminance',
    },
  },
  {
    areaGroup: 'living-front-dining',
    key: 'livingRoomFireplace',
    label: 'Living room fireplace',
    currentDeviceName: 'Living Room Fireplace Presence Sensor',
    expectedIeee: '0x54ef4410014ae496',
    targetDeviceName: 'Living Room Fireplace Presence Sensor',
    currentEntities: {
      occupancy: 'binary_sensor.living_room_fireplace_presence_occupancy',
      occupancyRlc: 'sensor.living_room_fireplace_presence_sensor_occupancy',
      temperature: 'sensor.living_room_fireplace_presence_temperature',
      humidity: 'sensor.living_room_fireplace_presence_humidity',
      illuminance: 'sensor.living_room_fireplace_presence_illuminance',
    },
    targetEntities: {
      occupancy: 'binary_sensor.living_room_fireplace_presence_occupancy',
      motion: 'binary_sensor.living_room_fireplace_presence_motion',
      occupancyRlc: 'sensor.living_room_fireplace_presence_sensor_occupancy',
      temperature: 'sensor.living_room_fireplace_presence_temperature',
      humidity: 'sensor.living_room_fireplace_presence_humidity',
      illuminance: 'sensor.living_room_fireplace_presence_illuminance',
    },
  },
  {
    areaGroup: 'living-front-dining',
    key: 'livingRoomKitchenWall',
    label: 'Living room kitchen wall',
    currentDeviceName: 'Living Room Kitchen Wall Presence Sensor',
    expectedIeee: '0x54ef441001497be5',
    targetDeviceName: 'Living Room Kitchen Wall Presence Sensor',
    currentEntities: {
      occupancy: 'binary_sensor.living_room_kitchen_wall_presence_occupancy',
      occupancyRlc: 'sensor.living_room_kitchen_wall_presence_sensor_occupancy',
      temperature: 'sensor.living_room_kitchen_wall_presence_temperature',
      humidity: 'sensor.living_room_kitchen_wall_presence_humidity',
      illuminance: 'sensor.living_room_kitchen_wall_presence_illuminance',
    },
    targetEntities: {
      occupancy: 'binary_sensor.living_room_kitchen_wall_presence_occupancy',
      motion: 'binary_sensor.living_room_kitchen_wall_presence_motion',
      occupancyRlc: 'sensor.living_room_kitchen_wall_presence_sensor_occupancy',
      temperature: 'sensor.living_room_kitchen_wall_presence_temperature',
      humidity: 'sensor.living_room_kitchen_wall_presence_humidity',
      illuminance: 'sensor.living_room_kitchen_wall_presence_illuminance',
    },
  },
  {
    areaGroup: 'living-front-dining',
    key: 'livingRoomBackWall',
    label: 'Living room back wall',
    currentDeviceName: 'Living Room Presence Sensor',
    expectedIeee: '0x54ef44100146b39a',
    targetDeviceName: 'Living Room Presence Sensor',
    currentEntities: {
      occupancy: 'binary_sensor.living_room_back_wall_presence_occupancy',
      occupancyRlc: 'sensor.living_room_back_wall_presence_sensor_occupancy',
      temperature: 'sensor.living_room_back_wall_presence_temperature',
      humidity: 'sensor.living_room_back_wall_presence_humidity',
      illuminance: 'sensor.living_room_back_wall_presence_illuminance',
    },
    targetEntities: {
      occupancy: 'binary_sensor.living_room_back_wall_presence_occupancy',
      motion: 'binary_sensor.living_room_back_wall_presence_motion',
      occupancyRlc: 'sensor.living_room_back_wall_presence_sensor_occupancy',
      temperature: 'sensor.living_room_back_wall_presence_temperature',
      humidity: 'sensor.living_room_back_wall_presence_humidity',
      illuminance: 'sensor.living_room_back_wall_presence_illuminance',
    },
    notes: ['This device is the living-room back-wall sensor; the current Matter device name omits "Back Wall" but its entity IDs include living_room_back_wall.'],
  },
  {
    areaGroup: 'living-front-dining',
    key: 'frontDoor',
    label: 'Front door',
    currentDeviceName: 'Front Door Presence Sensor',
    expectedIeee: '0x54ef4410014ae274',
    targetDeviceName: 'Front Door Presence Sensor',
    currentEntities: {
      occupancy: 'binary_sensor.front_door_presence_occupancy',
      occupancyRlc: 'sensor.front_door_presence_sensor_occupancy',
      temperature: 'sensor.front_door_presence_temperature',
      humidity: 'sensor.front_door_presence_humidity',
      illuminance: 'sensor.front_door_presence_illuminance',
    },
    targetEntities: {
      occupancy: 'binary_sensor.front_door_presence_occupancy',
      motion: 'binary_sensor.front_door_presence_motion',
      occupancyRlc: 'sensor.front_door_presence_sensor_occupancy',
      temperature: 'sensor.front_door_presence_temperature',
      humidity: 'sensor.front_door_presence_humidity',
      illuminance: 'sensor.front_door_presence_illuminance',
    },
  },
  {
    areaGroup: 'living-front-dining',
    key: 'diningRoom',
    label: 'Dining room',
    currentDeviceName: 'Dining Room Presence Sensor',
    expectedIeee: '0x54ef44100146ca70',
    targetDeviceName: 'Dining Room Presence Sensor',
    currentEntities: {
      occupancy: 'binary_sensor.dining_room_presence_occupancy',
      occupancyRlc: 'sensor.dining_room_presence_sensor_occupancy',
      temperature: 'sensor.dining_room_presence_temperature',
      humidity: 'sensor.dining_room_presence_humidity',
      illuminance: 'sensor.dining_room_presence_illuminance',
    },
    targetEntities: {
      occupancy: 'binary_sensor.dining_room_presence_occupancy',
      motion: 'binary_sensor.dining_room_presence_motion',
      occupancyRlc: 'sensor.dining_room_presence_sensor_occupancy',
      temperature: 'sensor.dining_room_presence_temperature',
      humidity: 'sensor.dining_room_presence_humidity',
      illuminance: 'sensor.dining_room_presence_illuminance',
    },
  },
]

const SENSOR_GROUPS: Record<string, SensorPlan[]> = {
  all: [...HALLWAY_SENSORS, ...MASTER_SENSORS, ...GUEST_GYM_KITCHEN_SENSORS, ...LIVING_FRONT_DINING_SENSORS],
  'guest-gym-kitchen': GUEST_GYM_KITCHEN_SENSORS,
  hallway: HALLWAY_SENSORS,
  'living-front-dining': LIVING_FRONT_DINING_SENSORS,
  master: MASTER_SENSORS,
}

let nextMessageId = 1

function requireEnv(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing ${name} in .env or .env.development`)
  return value
}

function on(ws: WebSocket, event: string, handler: EventListener): void {
  ws.addEventListener(event, handler)
}

function off(ws: WebSocket, event: string, handler: EventListener): void {
  ws.removeEventListener(event, handler)
}

function waitEvent(ws: WebSocket, event: string): Promise<Event> {
  return new Promise((resolve, reject) => {
    const handler = (value: Event) => {
      off(ws, event, handler)
      off(ws, 'error', errorHandler)
      resolve(value)
    }
    const errorHandler = (value: Event) => {
      off(ws, event, handler)
      off(ws, 'error', errorHandler)
      reject(value)
    }

    on(ws, event, handler)
    on(ws, 'error', errorHandler)
  })
}

async function eventText(value: Event | MessageEvent): Promise<string> {
  const data = 'data' in value ? value.data : value

  if (typeof data === 'string') return data
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data)
  if (data instanceof Blob) return data.text()

  return String(data)
}

async function nextMessage(ws: WebSocket): Promise<Record<string, unknown>> {
  return JSON.parse(await eventText((await waitEvent(ws, 'message')) as MessageEvent)) as Record<string, unknown>
}

function sendMessage<TResult>(ws: WebSocket, type: string, extra: Record<string, unknown> = {}): Promise<TResult> {
  const id = nextMessageId++
  ws.send(JSON.stringify({ id, type, ...extra }))

  return new Promise((resolve, reject) => {
    const handler = async (raw: Event) => {
      const message = JSON.parse(await eventText(raw as MessageEvent)) as { error?: unknown; id?: number; result?: TResult; success?: boolean }
      if (message.id !== id) return

      off(ws, 'message', handler)

      if (message.success === false) reject(new Error(JSON.stringify(message.error)))
      else resolve(message.result as TResult)
    }

    on(ws, 'message', handler)
  })
}

function waitForMqttTopic(ws: WebSocket, topic: string, timeoutMs = 10_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      off(ws, 'message', handler)
      reject(new Error(`Timed out waiting for ${topic}`))
    }, timeoutMs)

    const handler = async (raw: Event) => {
      const message = JSON.parse(await eventText(raw as MessageEvent)) as { event?: { data?: { payload?: string; topic?: string }; payload?: string; topic?: string }; type?: string }
      if (message.type !== 'event') return

      const eventTopic = message.event?.topic ?? message.event?.data?.topic
      if (eventTopic !== topic) return

      clearTimeout(timer)
      off(ws, 'message', handler)
      resolve(message.event?.payload ?? message.event?.data?.payload ?? '[]')
    }

    on(ws, 'message', handler)
  })
}

async function connectToHass(): Promise<WebSocket> {
  const haUrl = requireEnv(HA_URL, 'VITE_HA_URL')
  const token = requireEnv(HA_TOKEN, 'VITE_HA_TOKEN')
  const ws = new WebSocket(`${haUrl.replace(/^http/, 'ws')}/api/websocket`)

  await waitEvent(ws, 'open')
  await nextMessage(ws)
  ws.send(JSON.stringify({ access_token: token, type: 'auth' }))

  const auth = await nextMessage(ws)
  if (auth.type !== 'auth_ok') throw new Error('Home Assistant authentication failed')

  return ws
}

async function fetchStates(): Promise<HassState[]> {
  const haUrl = requireEnv(HA_URL, 'VITE_HA_URL')
  const token = requireEnv(HA_TOKEN, 'VITE_HA_TOKEN')
  const response = await fetch(`${haUrl}/api/states`, { headers: { Authorization: `Bearer ${token}` } })

  if (!response.ok) throw new Error(`Failed to fetch HA states: ${response.status}`)

  return response.json() as Promise<HassState[]>
}

async function readZigbee2MqttDevices(ws: WebSocket): Promise<Z2mDevice[]> {
  const payloadPromise = waitForMqttTopic(ws, 'zigbee2mqtt/bridge/devices')
  await sendMessage(ws, 'mqtt/subscribe', { topic: 'zigbee2mqtt/bridge/devices' })

  return JSON.parse(await payloadPromise) as Z2mDevice[]
}

function findCurrentDevice(plan: SensorPlan, devices: DeviceRegistryEntry[], entities: EntityRegistryEntry[]): DeviceRegistryEntry | undefined {
  for (const entityId of Object.values(plan.currentEntities)) {
    const currentEntity = entities.find(entity => entity.entity_id === entityId)
    const device = currentEntity?.device_id ? devices.find(candidate => candidate.id === currentEntity.device_id) : undefined
    if (device) return device
  }

  const normalizedName = plan.currentDeviceName.toLowerCase()
  return devices.find(device => (device.name_by_user ?? device.name ?? '').toLowerCase() === normalizedName)
}

function compactEntity(entityId: string, entities: EntityRegistryEntry[], stateById: Map<string, HassState>) {
  const entry = entities.find(entity => entity.entity_id === entityId)
  const state = stateById.get(entityId)

  return {
    deviceClass: state?.attributes.device_class ?? null,
    disabledBy: entry?.disabled_by ?? null,
    entityId,
    existsInRegistry: Boolean(entry),
    existsInState: Boolean(state),
    platform: entry?.platform ?? null,
    state: state?.state ?? null,
  }
}

function buildRawZ2mEntityMap(expectedIeee: string) {
  return {
    humidity: `sensor.${expectedIeee}_humidity`,
    illuminance: `sensor.${expectedIeee}_illuminance`,
    motion: `binary_sensor.${expectedIeee}_pir_detection`,
    occupancy: `binary_sensor.${expectedIeee}_presence`,
    temperature: `sensor.${expectedIeee}_temperature`,
  }
}

async function main() {
  const json = process.argv.includes('--json')
  const areaArgIndex = process.argv.findIndex(arg => arg === '--area' || arg === '--group')
  const areaGroup = areaArgIndex >= 0 ? process.argv[areaArgIndex + 1] : 'hallway'
  const plans = SENSOR_GROUPS[areaGroup]

  if (!plans) {
    throw new Error(`Unknown sensor group "${areaGroup}". Expected one of: ${Object.keys(SENSOR_GROUPS).join(', ')}`)
  }

  const ws = await connectToHass()

  try {
    const [entities, devices, areas, states, z2mDevices] = await Promise.all([
      sendMessage<EntityRegistryEntry[]>(ws, 'config/entity_registry/list'),
      sendMessage<DeviceRegistryEntry[]>(ws, 'config/device_registry/list'),
      sendMessage<AreaRegistryEntry[]>(ws, 'config/area_registry/list'),
      fetchStates(),
      readZigbee2MqttDevices(ws),
    ])

    const stateById = new Map(states.map(state => [state.entity_id, state]))
    const areaById = new Map(areas.map(area => [area.area_id, area.name]))

    const report = plans.map(plan => {
      const currentDevice = findCurrentDevice(plan, devices, entities)
      const z2mDevice = z2mDevices.find(device => device.ieee_address?.toLowerCase() === plan.expectedIeee.toLowerCase())
      const currentSerials = currentDevice?.identifiers?.flatMap(([, value]) => value.match(/[0-9a-f]{16}/gi) ?? []) ?? []

      return {
        ...plan,
        currentDevice: currentDevice
          ? {
              area: areaById.get(currentDevice.area_id ?? currentDevice.suggested_area ?? '') ?? currentDevice.area_id ?? currentDevice.suggested_area ?? null,
              id: currentDevice.id,
              identifiers: currentDevice.identifiers ?? [],
              model: currentDevice.model,
              name: currentDevice.name_by_user ?? currentDevice.name,
              serials: currentSerials,
            }
          : null,
        currentEntityStates: Object.fromEntries(Object.entries(plan.currentEntities).map(([key, entityId]) => [key, compactEntity(entityId, entities, stateById)])),
        expectedRawZ2mEntities: buildRawZ2mEntityMap(plan.expectedIeee),
        targetEntityStates: Object.fromEntries(Object.entries(plan.targetEntities).map(([key, entityId]) => [key, compactEntity(entityId, entities, stateById)])),
        z2m: z2mDevice
          ? {
              definition: z2mDevice.definition ?? null,
              friendlyName: z2mDevice.friendly_name,
              ieeeAddress: z2mDevice.ieee_address,
              interviewCompleted: z2mDevice.interview_completed,
              modelId: z2mDevice.model_id,
              supported: z2mDevice.supported,
            }
          : null,
        z2mReady: Boolean(z2mDevice),
      }
    })

    if (json) {
      console.log(JSON.stringify(report, null, 2))
      return
    }

    console.info(chalk.bold(`${areaGroup === 'all' ? 'All' : areaGroup[0].toUpperCase() + areaGroup.slice(1)} Z2M Migration Prep`))
    console.info(chalk.gray('Run with --json for machine-readable output. Use --area hallway, --area master, or --area all.'))

    for (const item of report) {
      console.info('')
      console.info(chalk.cyan(item.label))
      console.info(`  Matter serial / expected Zigbee IEEE: ${chalk.bold(item.expectedIeee)}`)
      console.info(`  Current device: ${item.currentDevice?.name ?? chalk.red('not found')}`)
      console.info(`  Target Z2M friendly name: ${item.targetDeviceName}`)
      console.info(`  Z2M status: ${item.z2mReady ? chalk.green('present') : chalk.yellow('not paired yet')}`)
      if (item.z2m) console.info(`  Z2M friendly name now: ${item.z2m.friendlyName}`)

      console.info('  Preserve these HA entity IDs:')
      for (const [key, entityId] of Object.entries(item.targetEntities)) {
        console.info(`    ${key.padEnd(12)} ${entityId}`)
      }

      console.info('  Raw Z2M IDs to look for immediately after pairing:')
      for (const [key, entityId] of Object.entries(item.expectedRawZ2mEntities)) {
        console.info(`    ${key.padEnd(12)} ${entityId}`)
      }

      for (const note of item.notes ?? []) console.info(chalk.yellow(`  Note: ${note}`))
    }
  } finally {
    ws.close()
  }
}

await main()