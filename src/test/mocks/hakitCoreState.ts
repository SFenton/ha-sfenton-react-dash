import { mockEntitiesFixture } from './appEntities'

export interface MockEntity {
  attributes: Record<string, unknown>
  entity_id: string
  state: string
}

export interface MockHassState {
  config: Record<string, unknown>
  connection: {
    sendMessagePromise: <T>(message: Record<string, unknown>) => Promise<T>
  }
  entities: Record<string, MockEntity>
  hassUrl: string
  helpers: {
    callService: (params: Record<string, unknown>) => unknown
    joinHassUrl: (path: string) => string
  }
  services: Record<string, unknown>
  user: { id: string; is_admin?: boolean; name: string } | null
}

export function entity(entityId: string, state: string, attributes: Record<string, unknown> = {}): MockEntity {
  return { attributes, entity_id: entityId, state }
}

const freeSleepLevelAttributes = { icon: 'mdi:thermometer-lines', max: 10, min: -10, step: 1, unit_of_measurement: '°' }

export const mockCallServiceCalls: Record<string, unknown>[] = []
export const mockScheduleMessages: Record<string, unknown>[] = []
export const mockTodoUpdateMessages: Record<string, unknown>[] = []
export const mockTodoItemsByEntity: Record<string, MockTodoItem[] | undefined> = {}
export const mockDonetickTasksById: Record<number, MockDonetickTask | undefined> = {}
const mockInventoryItemsByLocation: Record<string, Record<string, unknown>[] | undefined> = {}
let mockDonetickTaskLoadDelayMs = 0
let mockRecipeQueryDelayMs = 0

function configuredRecipeQueryDelayMs() {
  if (typeof window === 'undefined') return 0
  const configured = Number(new URLSearchParams(window.location.search).get('__mockRecipeQueryDelayMs') ?? 0)
  return Number.isFinite(configured) ? Math.max(0, configured) : 0
}

function configuredRecipeDetailDelayMs() {
  if (typeof window === 'undefined') return 0
  const configured = Number(new URLSearchParams(window.location.search).get('__mockRecipeDetailDelayMs') ?? 0)
  return Number.isFinite(configured) ? Math.max(0, configured) : 0
}

function configuredRecipeTotal() {
  if (typeof window === 'undefined') return 150
  const configured = Number(new URLSearchParams(window.location.search).get('__mockRecipeTotal') ?? 150)
  return Number.isFinite(configured) ? Math.max(0, Math.floor(configured)) : 150
}

function configuredRecipeGroceryState() {
  if (typeof window === 'undefined') return 'default'
  const configured = new URLSearchParams(window.location.search).get('__mockRecipeGroceryState')
  return configured === 'none' || configured === 'uncertain-only' || configured === 'unsupported'
    ? configured
    : 'default'
}

function configuredRecipeClosestMatchSource() {
  if (typeof window === 'undefined') return 'taxonomy_alias'
  return new URLSearchParams(window.location.search).get('__mockRecipeClosestMatchSource') === 'taxonomy_rule'
    ? 'taxonomy_rule'
    : 'taxonomy_alias'
}

function emptyHumidifierSchedule() {
  return {
    id: 'master_bedroom_humidifier',
    name: 'Master Bedroom Humidifier',
    icon: 'mdi:calendar-clock',
    sunday: [],
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
  }
}

let mockHumidifierSchedule = emptyHumidifierSchedule()

const mockDailyWeatherForecast = [
  { datetime: '2026-06-10T07:00:00+00:00', condition: 'sunny', temperature: 65, templow: 48, precipitation_probability: 0, precipitation: 0, humidity: 74, dew_point: 48, cloud_coverage: 57, wind_speed: 3.56, wind_gust_speed: 7.97, wind_bearing: 185, uv_index: 6.7 },
  { datetime: '2026-06-11T07:00:00+00:00', condition: 'sunny', temperature: 71, templow: 50, precipitation_probability: 0, precipitation: 0, humidity: 68, dew_point: 48, cloud_coverage: 14, wind_speed: 2.31, wind_gust_speed: 5.18, wind_bearing: 169, uv_index: 7.44 },
  { datetime: '2026-06-12T07:00:00+00:00', condition: 'partlycloudy', temperature: 72, templow: 51, precipitation_probability: 0, precipitation: 0, humidity: 66, dew_point: 49, cloud_coverage: 17, wind_speed: 3.18, wind_gust_speed: 6.94, wind_bearing: 212, uv_index: 7.09 },
  { datetime: '2026-06-13T07:00:00+00:00', condition: 'sunny', temperature: 78, templow: 57, precipitation_probability: 0, precipitation: 0, humidity: 65, dew_point: 53, cloud_coverage: 5, wind_speed: 4.58, wind_gust_speed: 9.06, wind_bearing: 183, uv_index: 7.37 },
  { datetime: '2026-06-14T07:00:00+00:00', condition: 'sunny', temperature: 86, templow: 60, precipitation_probability: 0, precipitation: 0, humidity: 58, dew_point: 55, cloud_coverage: 8, wind_speed: 4.08, wind_gust_speed: 8.01, wind_bearing: 187, uv_index: 7.45 },
  { datetime: '2026-06-15T07:00:00+00:00', condition: 'sunny', temperature: 90, templow: 63, precipitation_probability: 0, precipitation: 0, humidity: 55, dew_point: 57, cloud_coverage: 32, wind_speed: 2.31, wind_gust_speed: 5.09, wind_bearing: 149, uv_index: 6.69 },
  { datetime: '2026-06-16T07:00:00+00:00', condition: 'rainy', temperature: 84, templow: 59, precipitation_probability: 7, precipitation: 0, humidity: 55, dew_point: 56, cloud_coverage: 24, wind_speed: 3.96, wind_gust_speed: 7.89, wind_bearing: 157, uv_index: 7.36 },
]

const hourlyTemperatures = [57, 58, 60, 61, 63, 64, 65, 64, 62, 60, 58, 56, 55, 54, 53, 52, 51, 50, 49, 49, 50, 52, 55, 58]

const mockHourlyWeatherForecast = Array.from({ length: 24 }, (_, index) => {
  const forecastDate = new Date('2026-06-10T12:00:00-07:00')
  forecastDate.setHours(forecastDate.getHours() + index)
  return {
    datetime: forecastDate.toISOString(),
    condition: index < 3 ? 'cloudy' : index < 8 ? 'partlycloudy' : 'sunny',
    precipitation_probability: index < 6 ? 0 : 4,
    temperature: hourlyTemperatures[index],
    wind_bearing: 185,
    wind_gust_speed: 5 + (index % 5),
    wind_speed: 3 + (index % 4),
  }
})

function mockDateOffset(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function mockRecipeCard(id: number, title = `Recipe ${id}`) {
  return {
    id,
    dedupe_key: `mock-recipe:${id}`,
    title,
    image_url: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22584%22 height=%22480%22%3E%3Crect width=%22584%22 height=%22480%22 fill=%22%23f7f3eb%22/%3E%3C/svg%3E',
    thumbnail_url: null,
    source: 'Mock Kitchen',
    source_url: null,
    coverage: 82,
    matched_required: 9,
    required_total: 11,
    expiry_score: 14,
    soonest_expiry_days: 4,
    score: 91,
    cookable: true,
  }
}

function mockRecipeIngredient(
  position: number,
  name: string,
  state: 'in_stock' | 'missing' | 'staple' | 'uncertain',
  options: {
    amountText?: string | null
    closestMatch?: string | null
    displayName?: string | null
    matchedProduct?: string | null
    optional?: boolean | null
    quantityState?: 'display_only' | 'known' | 'unknown'
    relation?: string | null
    sourceText?: string | null
  } = {},
) {
  const closestMatchSource = configuredRecipeClosestMatchSource()
  return {
    key: `ri:${position}:${String(position + 1).padStart(16, '0')}`,
    position,
    name,
    ...(options.displayName ? { display_name: options.displayName } : {}),
    ...(options.sourceText ? { source_text: options.sourceText } : {}),
    ...(options.optional === undefined ? {} : { source_optional: options.optional }),
    ...(options.closestMatch
      ? {
          closest_match: {
            label: options.closestMatch,
            canonical_ingredient_id: 4_000 + position,
            taxonomy_node_id: 5_000 + position,
            mapping_source: closestMatchSource,
            confidence: closestMatchSource === 'taxonomy_rule' ? 1 : 0.86,
          },
        }
      : {}),
    amount: {
      quantity: null,
      quantity_max: null,
      unit: null,
      text: options.amountText ?? null,
    },
    inventory: {
      state,
      relation: options.relation ?? null,
      confidence: state === 'uncertain' ? 0.35 : 0.96,
      matched_product: options.matchedProduct
        ? { id: 2_000 + position, name: options.matchedProduct }
        : null,
      quantity_state: options.quantityState ?? 'unknown',
      quantity_sufficiency: 'unknown',
    },
    feedback_token: String(position + 1).padStart(64, 'a').slice(-64),
    user_override: null,
    identity_feedback: null,
    feedback_capabilities: {
      availability_override: true,
      identity: Boolean(options.closestMatch || options.matchedProduct),
      decision: true,
      assume_have: true,
      select_inventory_product: state !== 'staple',
      reject_current_match: state === 'in_stock' || state === 'staple',
      positive_identity: state !== 'staple',
      negative_identity: Boolean(options.matchedProduct),
    },
  }
}

function mockRecipeDetail(recipeId: number) {
  const externalOnly = recipeId < 1_000
  const groceryState = configuredRecipeGroceryState()
  const missingState = groceryState === 'none' || groceryState === 'uncertain-only' ? 'in_stock' : 'missing'
  const uncertainState = groceryState === 'none' ? 'in_stock' : 'uncertain'
  const title = externalOnly
    ? recipeId === 1
      ? 'Suggested Citrus Pantry Bowl with Roasted Garden Vegetables'
      : `Suggested Recipe ${recipeId}`
    : `Catalog Recipe ${recipeId - 999}`
  return {
    success: true,
    detail: {
      schema_version: 'recipe_detail_v1',
      id: recipeId,
      title,
      source: {
        connector: externalOnly ? 'cookidoo' : 'manual',
        label: externalOnly ? 'Cookidoo' : 'Manual',
        attribution: externalOnly ? 'Cookidoo' : 'Household recipe',
        external_id: externalOnly ? `mock-${recipeId}` : null,
        canonical_url: externalOnly
          ? `https://cookidoo.example.test/recipes/mock-${recipeId}`
          : `https://recipes.example.test/catalog/${recipeId}`,
        locale: 'en-US',
        content_language: externalOnly ? 'en' : null,
        rights_basis: externalOnly ? 'provider_metadata_v2' : 'user_authorized',
      },
      images: {
        primary: null,
        thumbnail: null,
      },
      general: {
        yield: { quantity: externalOnly ? 4 : 2, unit: externalOnly ? 'portions' : 'bowls' },
        prep_time_seconds: 600,
        cook_time_seconds: 1_200,
        active_time_seconds: 1_500,
        inactive_time_seconds: 300,
        total_time_seconds: 3_600,
        difficulty: 'Easy',
        primary_category: 'Dinner',
        devices: ['TM6', 'Oven'],
        optional_devices: ['Slow cooker'],
        equipment: ['Large bowl', 'Sheet pan'],
      },
      planner: {
        available: externalOnly,
        account_scope: 'configured_account',
        minimum_date: '2026-08-12',
        maximum_date: '2027-08-12',
        provider_action_token: externalOnly ? 'b'.repeat(64) : null,
        reason: externalOnly ? null : 'not_cookidoo',
      },
      ingredients: [
        mockRecipeIngredient(0, 'tomato', missingState, {
          amountText: '1 can',
          displayName: 'Canned tomatoes',
          quantityState: externalOnly ? 'display_only' : 'known',
          sourceText: '1 can diced tomatoes, drained',
        }),
        mockRecipeIngredient(1, 'Rice', 'in_stock', {
          amountText: '2 cups',
          displayName: 'Long-grain rice',
          matchedProduct: 'Long grain rice',
          quantityState: externalOnly ? 'display_only' : 'known',
          relation: 'exact',
          sourceText: '2 cups long-grain rice',
        }),
        mockRecipeIngredient(2, 'Salt', 'staple', {
          amountText: 'to taste',
          quantityState: 'display_only',
          sourceText: 'Salt',
        }),
        mockRecipeIngredient(3, 'Fresh herbs', uncertainState, {
          amountText: null,
          closestMatch: uncertainState === 'uncertain' ? 'Italian parsley' : null,
          matchedProduct: 'Dried herbs',
          optional: true,
          quantityState: 'unknown',
          relation: 'taxonomy_ancestor',
          sourceText: 'A handful of fresh Italian parsley',
        }),
        mockRecipeIngredient(4, 'Olive oil', 'in_stock', {
          amountText: '1 tablespoon',
          displayName: 'Extra-virgin olive oil',
          matchedProduct: 'Extra virgin olive oil',
          quantityState: externalOnly ? 'display_only' : 'known',
          relation: 'exact',
          sourceText: '1 tbsp extra-virgin olive oil',
        }),
        mockRecipeIngredient(5, 'onion', missingState, {
          amountText: '1 small',
          closestMatch: 'Yellow onion',
          displayName: 'Yellow Onion',
          quantityState: externalOnly ? 'display_only' : 'known',
          sourceText: '1 small yellow onion, diced',
        }),
        mockRecipeIngredient(6, 'Lemon', uncertainState, {
          amountText: '1',
          closestMatch: uncertainState === 'uncertain' ? 'Fresh lemon' : null,
          matchedProduct: 'Lemon juice',
          quantityState: 'unknown',
          relation: 'taxonomy_ancestor',
        }),
        mockRecipeIngredient(7, 'Black pepper', 'staple', {
          amountText: 'to taste',
          quantityState: 'display_only',
        }),
      ],
      ingredient_groups: externalOnly
        ? [
            {
              key: 'ingredient-group:one',
              index: 0,
              label: null,
              ingredient_keys: [
                'ri:0:0000000000000001',
                'ri:1:0000000000000002',
                'ri:2:0000000000000003',
                'ri:3:0000000000000004',
                'ri:4:0000000000000005',
              ],
              positions: [0, 1, 2, 3, 4],
            },
            {
              key: 'ingredient-group:two',
              index: 1,
              label: '',
              ingredient_keys: [
                'ri:5:0000000000000006',
                'ri:6:0000000000000007',
                'ri:7:0000000000000008',
              ],
              positions: [5, 6, 7],
            },
          ]
        : [
            {
              key: 'ingredient-group:bowl',
              index: 0,
              label: 'Bowl Ingredients',
              ingredient_keys: [
                'ri:0:0000000000000001',
                'ri:1:0000000000000002',
                'ri:2:0000000000000003',
                'ri:3:0000000000000004',
                'ri:4:0000000000000005',
              ],
            },
            {
              key: 'ingredient-group:finish',
              index: 1,
              label: 'Finishing Ingredients',
              ingredient_keys: [
                'ri:5:0000000000000006',
                'ri:6:0000000000000007',
                'ri:7:0000000000000008',
              ],
            },
          ],
      ingredients_truncated: false,
      grocery: {
        confirmed_missing_count: missingState === 'missing' ? 2 : 0,
        uncertain_count: uncertainState === 'uncertain' ? 2 : 0,
        blocked_reason: groceryState === 'uncertain-only'
          ? 'uncertain_only'
          : groceryState === 'none'
            ? 'no_missing'
            : groceryState === 'unsupported'
              ? 'unsupported'
              : null,
      },
      instructions: externalOnly
        ? {
            available: false,
            reason: 'provider_external_only',
            steps: ['Prohibited Cookidoo step text'],
            instruction_groups: [{
              key: 'instruction-group:prohibited',
              index: 0,
              label: 'Prohibited',
              steps: [{
                key: 'instruction-step:prohibited',
                index: 0,
                number: 1,
                text: 'Prohibited Cookidoo grouped step text',
              }],
            }],
            fallback_url: `https://cookidoo.example.test/recipes/mock-${recipeId}`,
            truncated: false,
          }
        : {
            available: true,
            reason: null,
            steps: [
              'Combine the prepared ingredients in a large bowl.',
              'Cook until the ingredients reach the intended texture.',
              'Divide into bowls and serve.',
            ],
            instruction_groups: [
              {
                key: 'instruction-group:prepare',
                index: 0,
                label: 'Prepare',
                steps: [
                  {
                    key: 'instruction-step:prepare-one',
                    index: 0,
                    number: 1,
                    text: 'Combine the prepared ingredients in a large bowl.',
                  },
                  {
                    key: 'instruction-step:prepare-two',
                    index: 1,
                    number: 2,
                    text: 'Cook until the ingredients reach the intended texture.',
                  },
                ],
              },
              {
                key: 'instruction-group:serve',
                index: 1,
                label: 'Serve',
                steps: [{
                  key: 'instruction-step:serve-one',
                  index: 0,
                  number: 3,
                  text: 'Divide into bowls and serve.',
                }],
              },
            ],
            fallback_url: null,
            truncated: false,
          },
      user_state: {
        favorite: false,
        hidden: false,
        rating: null,
        note: '',
        cooked_count: 0,
        last_cooked: null,
      },
      freshness: {
        retrieved_at: '2026-08-07T18:00:00Z',
        stale_at: '2026-08-14T18:00:00Z',
        updated_at: '2026-08-07T18:00:00Z',
        is_stale: false,
      },
      revision: {
        inventory: 12,
        ranking: 21,
        catalog: 34,
      },
      capabilities: {
        general: 'full',
        ingredients: 'checklist',
        instructions: externalOnly ? 'external_link' : 'local',
        quantities: externalOnly ? 'display_only' : 'known',
        grocery_add: groceryState !== 'unsupported',
        ingredient_feedback: true,
        ingredient_feedback_v2: true,
        planner: externalOnly,
      },
    },
  }
}

interface MockTodoItem {
  description?: string
  due?: string
  status: string
  summary: string
  uid: string
}

interface MockDonetickTask {
  assignees: number[]
  assigned_to: number | null
  description: string
  frequency: number
  frequency_metadata: Record<string, unknown>
  frequency_type: string
  hide_on_vacation: boolean
  id: number
  name: string
  next_due_date: string | null
  priority: number
}

const adminPresenceSwitchEntityIds = [
  'switch.living_room_presence_living_room_lights_presence_allowed',
  'switch.kitchen_presence_kitchen_lights_presence_allowed',
  'switch.hallway_presence_hallway_lights_presence_allowed',
  'switch.gym_presence_gym_light_presence_allowed',
  'switch.guest_bathroom_presence_guest_bathroom_dimmer_switch_presence_allowed',
  'switch.guest_room_presence_guest_room_presence_allowed',
  'switch.office_presence_office_light_presence_allowed',
  'switch.master_bedroom_presence_master_bedroom_presence_allowed',
  'switch.master_bathroom_presence_master_bathroom_dimmer_switch_presence_allowed',
  'switch.dining_room_presence_dining_room_dimmer_switch_presence_allowed',
  'switch.theater_room_presence_theater_room_presence_allowed',
  'switch.downstairs_hallway_presence_downstairs_hallway_light_presence_allowed',
  'switch.music_room_presence_music_room_lights_presence_allowed',
  'switch.upper_deck_presence_back_deck_lights_presence_allowed',
] as const

const adminAutoReEnableSwitchEntityIds = [
  'switch.living_room_auto_re_enable_presence_lighting',
  'switch.kitchen_auto_re_enable_presence_lighting',
  'switch.hallway_auto_re_enable_presence_lighting',
  'switch.gym_auto_re_enable_presence_lighting',
  'switch.guest_bathroom_auto_re_enable_presence_lighting',
  'switch.guest_room_auto_re_enable_presence_lighting',
  'switch.office_auto_re_enable_presence_lighting',
  'switch.master_bedroom_auto_re_enable_presence_lighting',
  'switch.master_bathroom_auto_re_enable_presence_lighting',
  'switch.dining_room_auto_re_enable_presence_lighting',
  'switch.theater_room_auto_re_enable_presence_lighting',
  'switch.downstairs_hallway_auto_re_enable_presence_lighting',
  'switch.music_room_auto_re_enable_presence_lighting',
  'switch.upper_deck_auto_re_enable_presence_lighting',
] as const

function mockSwitchEntities(entityIds: readonly string[], attributes: Record<string, unknown> = {}) {
  return Object.fromEntries(entityIds.map((entityId) => [entityId, entity(entityId, 'on', attributes)]))
}

const freeSleepAlarmOwners = ['stephen', 'steph'] as const
const freeSleepAlarmDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
const freeSleepScheduleSetTopic = 'free-sleep/NightCanvasRestful/schedules/set'
const sleepypodScheduleSetTopic = 'sleepypod/eight-pod/cmd/set-schedules'

function mockFreeSleepAlarmHelpers() {
  const entries: [string, MockEntity][] = []
  for (const owner of freeSleepAlarmOwners) {
    entries.push([`input_boolean.${owner}_alarms_enabled`, entity(`input_boolean.${owner}_alarms_enabled`, 'off')])
    for (const day of freeSleepAlarmDays) {
      entries.push([`input_boolean.${owner}_${day}_alarm_configured`, entity(`input_boolean.${owner}_${day}_alarm_configured`, 'off')])
      entries.push([`input_boolean.${owner}_${day}_alarm_enabled`, entity(`input_boolean.${owner}_${day}_alarm_enabled`, 'off')])
      entries.push([`input_datetime.${owner}_${day}_alarm_time`, entity(`input_datetime.${owner}_${day}_alarm_time`, '07:00:00', { has_date: false, has_time: true })])
    }
  }
  return Object.fromEntries(entries)
}

function mockAlarm(time: string, enabled = true) {
  return {
    alarmTemperature: 82,
    duration: 300,
    enabled,
    time,
    vibrationIntensity: 100,
    vibrationPattern: 'rise',
  }
}

function mockFreeSleepDailySchedule(on: string, off = '09:00', alarms: ReturnType<typeof mockAlarm>[] = []) {
  return {
    alarm: alarms[0],
    alarms,
    power: {
      off,
      on,
    },
  }
}

export function mockFreeSleepScheduleAttributes() {
  return {
    left: Object.fromEntries(freeSleepAlarmDays.map((day) => [day, mockFreeSleepDailySchedule('21:30')])) as Record<string, unknown>,
    right: Object.fromEntries(freeSleepAlarmDays.map((day) => [
      day,
      day === 'saturday'
        ? mockFreeSleepDailySchedule('22:00', '09:00', [mockAlarm('06:30'), mockAlarm('07:15')])
        : mockFreeSleepDailySchedule('22:00'),
    ])) as Record<string, unknown>,
  }
}

function cloneRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function applySchedulePayload(entityId: string, payload: unknown) {
  if (!isRecord(payload)) return
  const schedulesEntity = mockEntities[entityId]
  if (!schedulesEntity) return
  const nextAttributes = cloneRecord(schedulesEntity.attributes)
  for (const side of ['left', 'right'] as const) {
    const sidePayload = payload[side]
    if (!isRecord(sidePayload)) continue
    const sideAttributes = isRecord(nextAttributes[side]) ? cloneRecord(nextAttributes[side]) : {}
    for (const day of freeSleepAlarmDays) {
      const dayPayload = sidePayload[day]
      if (!isRecord(dayPayload)) continue
      const dayAttributes = isRecord(sideAttributes[day]) ? cloneRecord(sideAttributes[day]) : {}
      if (isRecord(dayPayload.power)) {
        dayAttributes.power = { ...(isRecord(dayAttributes.power) ? dayAttributes.power : {}), ...dayPayload.power }
      }
      if (isRecord(dayPayload.temperatures)) {
        dayAttributes.temperatures = { ...(isRecord(dayAttributes.temperatures) ? dayAttributes.temperatures : {}), ...dayPayload.temperatures }
      }
      const alarms = Array.isArray(dayPayload.alarms) ? cloneRecord(dayPayload.alarms) : []
      if (Array.isArray(dayPayload.alarms)) {
        dayAttributes.alarms = alarms
        if (alarms.length > 0) dayAttributes.alarm = alarms[0]
        else delete dayAttributes.alarm
      }
      sideAttributes[day] = dayAttributes
    }
    nextAttributes[side] = sideAttributes
  }
  schedulesEntity.attributes = nextAttributes
}

function applyFreeSleepSchedulePayload(payload: unknown) {
  applySchedulePayload('sensor.nightcanvasrestful_schedules', payload)
}

function applyMockCallServiceSideEffects(params: Record<string, unknown>) {
  if (params.domain === 'switch' && typeof params.target === 'string' && (params.service === 'turn_on' || params.service === 'turn_off')) {
    const switchEntity = mockEntities[params.target]
    if (switchEntity) switchEntity.state = params.service === 'turn_on' ? 'on' : 'off'
  }

  if (params.domain === 'number' && params.service === 'set_value' && typeof params.target === 'string') {
    const numberEntity = mockEntities[params.target]
    const value = isRecord(params.serviceData) ? params.serviceData.value : undefined
    if (numberEntity && value !== undefined) numberEntity.state = String(value)
  }

  if (params.domain === 'text' && params.service === 'set_value' && typeof params.target === 'string') {
    const textEntity = mockEntities[params.target]
    const value = isRecord(params.serviceData) ? params.serviceData.value : undefined
    if (textEntity && value !== undefined) textEntity.state = String(value)
  }

  if (params.domain === 'todo' && params.service === 'remove_item' && typeof params.target === 'string') {
    const item = isRecord(params.serviceData) ? params.serviceData.item : undefined
    const currentItems = mockTodoItemsByEntity[params.target]
    if (typeof item === 'string' && currentItems) {
      const nextItems = currentItems.filter((todoItem) => todoItem.uid !== item && todoItem.summary !== item)
      mockTodoItemsByEntity[params.target] = nextItems
      const todoEntity = mockEntities[params.target]
      if (todoEntity) {
        todoEntity.state = String(nextItems.filter((todoItem) => todoItem.status !== 'completed').length)
        Object.assign(todoEntity, { last_updated: new Date().toISOString() })
      }
    }
  }

  if (params.domain !== 'mqtt' || params.service !== 'publish') return
  const serviceData = isRecord(params.serviceData) ? params.serviceData : {}
  if (typeof serviceData.payload !== 'string') return
  if (serviceData.topic === freeSleepScheduleSetTopic) {
    applyFreeSleepSchedulePayload(JSON.parse(serviceData.payload))
    return
  }
  if (serviceData.topic === sleepypodScheduleSetTopic) {
    applySchedulePayload('sensor.master_bedroom_sleepypod_eight_pod_schedules', JSON.parse(serviceData.payload))
    return
  }
  for (const side of ['left', 'right'] as const) {
    if (serviceData.topic !== `free-sleep/NightCanvasRestful/${side}/schedule/bedtime/set`) continue
    mockEntities[`text.master_bedroom_eight_sleep_pod_5_${side}_bedtime`].state = serviceData.payload
    applyFreeSleepSchedulePayload({
      [side]: Object.fromEntries(freeSleepAlarmDays.map((day) => [day, { power: { on: serviceData.payload } }])),
    })
  }
}

type MockHassDebugApi = {
  calls: Record<string, unknown>[]
  freeSleepSchedules: () => Record<string, unknown>
  reset: () => void
  setHumidifierSchedule: (schedule: Record<string, unknown>) => void
  setEntityAttribute: (entityId: string, attribute: string, value: unknown) => void
  setEntityState: (entityId: string, state: string) => void
  setDonetickTask: (taskId: number, task: MockDonetickTask) => void
  setDonetickTaskLoadDelay: (delayMs: number) => void
  setRecipeQueryDelay: (delayMs: number) => void
  setInventoryItems: (location: string, items: Record<string, unknown>[]) => void
  setTodoItems: (entityId: string, items: MockTodoItem[]) => void
}

function exposeMockHassDebugApi() {
  if (typeof window === 'undefined') return
  ;(window as unknown as { __mockHass?: MockHassDebugApi }).__mockHass = {
    calls: mockCallServiceCalls,
    freeSleepSchedules: () => cloneRecord(mockEntities['sensor.nightcanvasrestful_schedules'].attributes),
    setHumidifierSchedule: (schedule) => {
      mockHumidifierSchedule = cloneRecord(schedule) as unknown as typeof mockHumidifierSchedule
    },
    setEntityAttribute: (entityId, attribute, value) => {
      const target = mockEntities[entityId]
      if (target) target.attributes = { ...target.attributes, [attribute]: value }
    },
    reset: resetMockHass,
    setEntityState: (entityId, state) => {
      const target = mockEntities[entityId]
      if (target) target.state = state
    },
    setDonetickTask: (taskId, task) => {
      mockDonetickTasksById[taskId] = task
    },
    setDonetickTaskLoadDelay: (delayMs) => {
      mockDonetickTaskLoadDelayMs = Math.max(0, delayMs)
    },
    setRecipeQueryDelay: (delayMs) => {
      mockRecipeQueryDelayMs = Math.max(0, delayMs)
    },
    setInventoryItems: (location, items) => {
      mockInventoryItemsByLocation[location] = cloneRecord(items)
    },
    setTodoItems: (entityId, items) => {
      mockTodoItemsByEntity[entityId] = items
    },
  }
}

const thermostatRoomMockData = [
  { key: 'living_room', title: 'Living Room', temperature: '70.2', occupancy: 'inactive', track: 'on', force: 'off', climate: 'climate.thermostat_contact_sensors_living_room_virtual_thermostat', vents: [['cover.living_room_vent_1_vent', 'open'], ['cover.living_room_vent_2_vent', 'open']] },
  { key: 'office', title: 'Office', temperature: '71.6', occupancy: 'active', track: 'off', force: 'off', climate: 'climate.thermostat_contact_sensors_office_virtual_thermostat', vents: [['cover.office_vent_vent', 'closed']] },
  { key: 'master_bedroom', title: 'Master Bedroom', temperature: '71.0', occupancy: 'active', track: 'on', force: 'off', climate: 'climate.thermostat_contact_sensors_master_bedroom_virtual_thermostat', vents: [['cover.master_bedroom_vent_2_vent', 'closed'], ['cover.master_bedroom_vent_3_vent', 'closed']] },
  { key: 'master_bathroom', title: 'Master Bathroom', temperature: '74.9', occupancy: 'inactive', track: 'on', force: 'off', trackOnlyWhenOccupied: 'on', climate: 'climate.thermostat_contact_sensors_master_bathroom_virtual_thermostat', vents: [['cover.master_bathroom_vent_vent', 'closed']] },
  { key: 'kitchen', title: 'Kitchen', temperature: '71.1', occupancy: 'inactive', track: 'on', force: 'off', climate: 'climate.thermostat_contact_sensors_kitchen_virtual_thermostat', vents: [['cover.kitchen_vent_vent', 'closed']] },
  { key: 'guest_room', title: 'Guest Room', temperature: '70.9', occupancy: 'inactive', track: 'on', force: 'off', climate: 'climate.thermostat_contact_sensors_guest_room_virtual_thermostat', vents: [['cover.guest_room_vent_vent', 'closed']] },
  { key: 'dining_room', title: 'Dining Room', temperature: '69.7', occupancy: 'inactive', track: 'on', force: 'off', climate: 'climate.thermostat_contact_sensors_dining_room_virtual_thermostat', vents: [['cover.dining_room_vent_vent', 'open']] },
  { key: 'gym', title: 'Gym', temperature: '70.6', occupancy: 'inactive', track: 'on', force: 'off', climate: 'climate.thermostat_contact_sensors_gym_virtual_thermostat', vents: [['cover.gym_vent_vent', 'closed']] },
  { key: 'guest_bathroom', title: 'Guest Bathroom', temperature: '76.9', occupancy: 'inactive', track: 'on', force: 'off', trackOnlyWhenOccupied: 'on', climate: 'climate.thermostat_contact_sensors_guest_bathroom_virtual_thermostat', vents: [['cover.guest_bathroom_vent_vent', 'closed']] },
  { key: 'music_room', title: 'Music Room', temperature: '70.6', occupancy: 'inactive', track: 'off', force: 'on', climate: 'climate.thermostat_contact_sensors_music_room_virtual_thermostat', vents: [['cover.music_room_vent_vent', 'closed']] },
  { key: 'theater_room', title: 'Theater Room', temperature: '70.5', occupancy: 'inactive', track: 'off', force: 'on', climate: 'climate.thermostat_contact_sensors_theater_room_virtual_thermostat', vents: [['cover.theater_room_vent_1_vent', 'open'], ['cover.theater_room_vent_2_vent', 'open']] },
] as const

function thermostatMockEntities() {
  const entries: [string, MockEntity][] = [
    [
      'climate.thermostat_contact_sensors_global_virtual_thermostat',
      entity('climate.thermostat_contact_sensors_global_virtual_thermostat', 'off', { current_temperature: 71, hvac_action: 'idle', hvac_modes: ['off', 'heat', 'cool', 'heat_cool'], target_temp_high: 74, target_temp_low: 72, temperature_unit: '°F' }),
    ],
    [
      'climate.thermostat_contact_sensors_eco_away_virtual_thermostat',
      entity('climate.thermostat_contact_sensors_eco_away_virtual_thermostat', 'heat_cool', { current_temperature: 71, effective_cool_target: 81, effective_heat_target: 59, hvac_modes: ['heat_cool'], is_currently_active: false, max_temp: 95, min_temp: 45, target_temp_high: 78, target_temp_low: 62, target_temp_step: 0.5, temperature_unit: '°F' }),
    ],
    ['climate.thermostat_hub_w200', entity('climate.thermostat_hub_w200', 'off', { current_temperature: 73.4, hvac_action: 'idle', hvac_modes: ['off', 'heat', 'cool', 'heat_cool'], target_temp_high: 74, target_temp_low: 72, temperature_unit: '°F' })],
    ['sensor.thermostat_hub_w200_temperature', entity('sensor.thermostat_hub_w200_temperature', '73.4', { unit_of_measurement: '°F' })],
    ['sensor.thermostat_hub_w200_humidity', entity('sensor.thermostat_hub_w200_humidity', '38.0', { unit_of_measurement: '%' })],
    ['switch.thermostat_contact_sensors_eco_mode', entity('switch.thermostat_contact_sensors_eco_mode', 'on')],
    ['switch.thermostat_contact_sensors_only_track_selected_rooms', entity('switch.thermostat_contact_sensors_only_track_selected_rooms', 'on')],
    ['switch.thermostat_contact_sensors_predictive_comfort_mode', entity('switch.thermostat_contact_sensors_predictive_comfort_mode', 'off')],
    ['switch.thermostat_contact_sensors_predictive_auto_adjust', entity('switch.thermostat_contact_sensors_predictive_auto_adjust', 'off')],
    ['switch.thermostat_contact_sensors_predictive_hvac_mode_changes', entity('switch.thermostat_contact_sensors_predictive_hvac_mode_changes', 'off')],
    ['switch.thermostat_contact_sensors_predictive_allow_away', entity('switch.thermostat_contact_sensors_predictive_allow_away', 'off')],
    [
      'sensor.living_room_thermostat_contact_sensors_predictive_comfort_mode',
      entity('sensor.living_room_thermostat_contact_sensors_predictive_comfort_mode', 'idle', {
        active_activity_entities: ['switch.office_pc'],
        adjustment_status: 'auto_adjust_disabled',
        comfort_high: 74,
        comfort_low: 71,
        forecast_high: 83,
        forecast_low: 68,
        indoor_temperature: 72.4,
        predicted_temperature: 74.8,
        reason: 'Forecast and current indoor conditions are inside the comfort band',
        weather_entity: 'weather.pirate_weather',
      }),
    ],
    ['input_boolean.enable_disable_thermostat_contact_sensors_integration', entity('input_boolean.enable_disable_thermostat_contact_sensors_integration', 'on')],
    ['binary_sensor.thermostat_contact_sensors_away_mode_active', entity('binary_sensor.thermostat_contact_sensors_away_mode_active', 'off')],
    ['sensor.thermostat_effective_home_away', entity('sensor.thermostat_effective_home_away', 'Home')],
    ['sensor.thermostat_home_away_reason', entity('sensor.thermostat_home_away_reason', 'A resident is home, so TCS is using home behavior.')],
    ['select.thermostat_contact_sensors_eco_mode_critical_tracking', entity('select.thermostat_contact_sensors_eco_mode_critical_tracking', 'Track Select Critical', { options: ['Do Not Track Critical', 'Track Select Critical', 'Track All Critical'] })],
    ['select.thermostat_contact_sensors_eco_behavior_when_away', entity('select.thermostat_contact_sensors_eco_behavior_when_away', 'Keep Eco Active', { options: ['Disable Eco When Away', 'Use Eco Away Targets', 'Keep Eco Active'] })],
  ]

  for (const room of thermostatRoomMockData) {
    entries.push([`sensor.thermostat_contact_sensors_${room.key}_temperature`, entity(`sensor.thermostat_contact_sensors_${room.key}_temperature`, room.temperature, { unit_of_measurement: '°F' })])
    entries.push([`sensor.thermostat_contact_sensors_${room.key}_occupancy`, entity(`sensor.thermostat_contact_sensors_${room.key}_occupancy`, room.occupancy, { friendly_name: `${room.title} Occupancy` })])
    entries.push([`switch.thermostat_contact_sensors_track_${room.key}`, entity(`switch.thermostat_contact_sensors_track_${room.key}`, room.track)])
    entries.push([`switch.thermostat_contact_sensors_${room.key}_force_track_when_critical`, entity(`switch.thermostat_contact_sensors_${room.key}_force_track_when_critical`, room.force)])
    entries.push([`switch.living_room_thermostat_contact_sensors_${room.key}_track_only_when_occupied`, entity(`switch.living_room_thermostat_contact_sensors_${room.key}_track_only_when_occupied`, 'trackOnlyWhenOccupied' in room ? room.trackOnlyWhenOccupied : 'off')])
    entries.push([room.climate, entity(room.climate, 'off', { away_mode_active: false, current_temperature: Number(room.temperature), effective_cool_target: 77, effective_heat_target: 69, hvac_action: 'idle', hvac_modes: ['off', 'heat', 'cool', 'heat_cool'], target_temp_high: 74, target_temp_low: 72, temperature_unit: '°F' })])
    for (const [ventEntityId, ventState] of room.vents) {
      if (ventEntityId === 'cover.guest_room_vent_vent' || ventEntityId === 'cover.kitchen_vent_vent') continue
      entries.push([ventEntityId, entity(ventEntityId, ventState)])
    }
  }

  return Object.fromEntries(entries)
}

function valetudoConsumableMockEntities(vacuumMapId: string, values: Partial<Record<string, string>> = {}) {
  const durationAttributes = { device_class: 'duration', icon: 'mdi:progress-wrench', state_class: 'measurement', unit_of_measurement: 'min' }
  const durationDefaults = {
    main_brush: '12240',
    main_filter: '3240',
    right_brush: '6240',
    sensor_cleaning: '120',
    wheel_cleaning: '120',
  }
  const statusDefaults = {
    detergent_dock_component: 'ok',
    dustbag_dock_component: 'ok',
    freshwater_dock_component: 'ok',
    wastewater_dock_component: 'ok',
  }

  return Object.fromEntries([
    ...Object.entries(durationDefaults).map(([suffix, defaultState]) => [
      `sensor.${vacuumMapId}_${suffix}`,
      entity(`sensor.${vacuumMapId}_${suffix}`, values[suffix] ?? defaultState, durationAttributes),
    ]),
    ...Object.entries(statusDefaults).map(([suffix, defaultState]) => [
      `sensor.${vacuumMapId}_${suffix}`,
      entity(`sensor.${vacuumMapId}_${suffix}`, values[suffix] ?? defaultState),
    ]),
  ])
}

const mainFloorAutoCleanDisabledRoomIds = [
  'living_room',
  'master_bedroom',
  'kitchen',
  'office',
  'hallway',
  'guest_room',
  'master_bathroom',
  'guest_bathroom',
  'gym',
  'master_bedroom_closet',
  'dining_room',
] as const

function mainFloorAutoCleanDisabledEntityId(roomId: string) {
  return `switch.main_floor_vacuum_coordinator_${roomId}_auto_clean_disabled`
}

function mainFloorAutoCleanDisabledMockEntities() {
  return Object.fromEntries(mainFloorAutoCleanDisabledRoomIds.map((roomId) => {
    const entityId = mainFloorAutoCleanDisabledEntityId(roomId)
    return [entityId, entity(entityId, 'off')]
  }))
}

// The source inventory also sees typed fallback IDs and service-shaped strings.
// Keep those inert and explicit instead of deriving fixture values from live HA.
function nonLiveReferenceMockEntities() {
  return {
    'binary_sensor.contact': entity('binary_sensor.contact', 'off'),
    'binary_sensor.sleepypod_unselected_pump_clog': entity('binary_sensor.sleepypod_unselected_pump_clog', 'off'),
    'binary_sensor.sleepypod_unselected_pump_stall': entity('binary_sensor.sleepypod_unselected_pump_stall', 'off'),
    'binary_sensor.unavailable': entity('binary_sensor.unavailable', 'off'),
    'button.press': entity('button.press', 'idle'),
    'climate.overview': entity('climate.overview', 'off', { current_temperature: 70, hvac_action: 'idle', hvac_modes: ['off', 'heat', 'cool'], temperature: 70, temperature_unit: '°F' }),
    'climate.sleepypod_unselected_side': entity('climate.sleepypod_unselected_side', 'off', { current_temperature: 70, hvac_action: 'idle', hvac_modes: ['off', 'heat'], temperature: 70, temperature_unit: '°F' }),
    'input_boolean.free_sleep_unselected_hot_flash_active': entity('input_boolean.free_sleep_unselected_hot_flash_active', 'off'),
    'input_boolean.unknown': entity('input_boolean.unknown', 'off'),
    'input_text.unavailable': entity('input_text.unavailable', ''),
    'light.unavailable': entity('light.unavailable', 'off'),
    'number.free_sleep_unselected_target_temperature': entity('number.free_sleep_unselected_target_temperature', '0', { max: 10, min: -10, step: 1 }),
    'number.sleepypod_unselected_target_level': entity('number.sleepypod_unselected_target_level', '0', { max: 10, min: -10, step: 1 }),
    'sensor.free_sleep_unselected_current_temperature': entity('sensor.free_sleep_unselected_current_temperature', '70', { device_class: 'temperature', unit_of_measurement: '°F' }),
    'sensor.sleepypod_unselected_metric': entity('sensor.sleepypod_unselected_metric', 'idle'),
    'sensor.sleepypod_unselected_schedule_phase': entity('sensor.sleepypod_unselected_schedule_phase', 'idle'),
    'sensor.unavailable': entity('sensor.unavailable', 'idle'),
    'switch.free_sleep_unselected_power': entity('switch.free_sleep_unselected_power', 'off'),
    'switch.office_pc': entity('switch.office_pc', 'off'),
    'vacuum.locate': entity('vacuum.locate', 'docked'),
    'vacuum.pause': entity('vacuum.pause', 'docked'),
    'vacuum.return_to_base': entity('vacuum.return_to_base', 'docked'),
    'vacuum.start': entity('vacuum.start', 'docked'),
    'vacuum.stop': entity('vacuum.stop', 'docked'),
  }
}

export const explicitMockEntities: Record<string, MockEntity> = {
  ...nonLiveReferenceMockEntities(),
  'alarm_control_panel.aqara_hub_m3_0056_security_system_2': entity('alarm_control_panel.aqara_hub_m3_0056_security_system_2', 'armed_home'),
  'binary_sensor.all_contact_sensors': entity('binary_sensor.all_contact_sensors', 'off'),
  'binary_sensor.contact_sensors': entity('binary_sensor.contact_sensors', 'off'),
  'binary_sensor.occupancy_sensors': entity('binary_sensor.occupancy_sensors', 'on'),
  'binary_sensor.front_yard_fault': entity('binary_sensor.front_yard_fault', 'off', { station_faults: [] }),
  'binary_sensor.front_yard_hub_connected': entity('binary_sensor.front_yard_hub_connected', 'on'),
  'binary_sensor.backyard_faucet_fault': entity('binary_sensor.backyard_faucet_fault', 'off', { station_faults: [] }),
  'binary_sensor.wi_fi_hub_connected': entity('binary_sensor.wi_fi_hub_connected', 'on'),
  'button.theater_pc_theaterroom_pc_shutdown': entity('button.theater_pc_theaterroom_pc_shutdown', 'unavailable'),
  'button.master_bedroom_sleepypod_eight_pod_left_alarm_snooze': entity('button.master_bedroom_sleepypod_eight_pod_left_alarm_snooze', 'unknown'),
  'button.master_bedroom_sleepypod_eight_pod_left_alarm_stop': entity('button.master_bedroom_sleepypod_eight_pod_left_alarm_stop', 'unknown'),
  'button.master_bedroom_sleepypod_eight_pod_right_alarm_snooze': entity('button.master_bedroom_sleepypod_eight_pod_right_alarm_snooze', 'unknown'),
  'button.master_bedroom_sleepypod_eight_pod_right_alarm_stop': entity('button.master_bedroom_sleepypod_eight_pod_right_alarm_stop', 'unknown'),
  'camera.doorbell_camera': entity('camera.doorbell_camera', 'idle'),
  'camera.garage_camera': entity('camera.garage_camera', 'recording'),
  'camera.lower_deck_camera': entity('camera.lower_deck_camera', 'recording'),
  'camera.upper_deck_camera_2': entity('camera.upper_deck_camera_2', 'recording'),
  'climate.thermostat_contact_sensors_global_virtual_thermostat': entity('climate.thermostat_contact_sensors_global_virtual_thermostat', 'heat', { current_temperature: 70, temperature: 71, temperature_unit: '°F' }),
  'climate.thermostat_hub_w200': entity('climate.thermostat_hub_w200', 'heat', { current_temperature: 70, temperature: 71, temperature_unit: '°F' }),
  'climate.stephen_s_eight_sleep_side_climate': entity('climate.stephen_s_eight_sleep_side_climate', 'heat_cool', { current_temperature: 86, temperature: 86, hvac_action: 'heating' }),
  'climate.steph_s_eight_sleep_side_climate': entity('climate.steph_s_eight_sleep_side_climate', 'off', { current_temperature: 72, temperature: 79, hvac_action: 'off' }),
  'climate.sleepypod_eight_pod_left_side': entity('climate.sleepypod_eight_pod_left_side', 'unavailable', { current_temperature: 81, hvac_modes: ['off', 'heat'], max_temp: 110, min_temp: 55, target_temp_step: 1, temperature: 77 }),
  'climate.sleepypod_eight_pod_right_side': entity('climate.sleepypod_eight_pod_right_side', 'unavailable', { current_temperature: 77, hvac_modes: ['off', 'heat'], max_temp: 110, min_temp: 55, target_temp_step: 1, temperature: null }),
  'number.master_bedroom_sleepypod_eight_pod_left_target_level': entity('number.master_bedroom_sleepypod_eight_pod_left_target_level', 'unavailable', { max: 10, min: -10, step: 1 }),
  'number.master_bedroom_sleepypod_eight_pod_right_target_level': entity('number.master_bedroom_sleepypod_eight_pod_right_target_level', 'unavailable', { max: 10, min: -10, step: 1 }),
  'number.nightcanvasrestful_left_target_temperature': entity('number.nightcanvasrestful_left_target_temperature', '-1', { ...freeSleepLevelAttributes }),
  'number.nightcanvasrestful_right_target_temperature': entity('number.nightcanvasrestful_right_target_temperature', '0', { ...freeSleepLevelAttributes }),
  'number.nightcanvasrestful_left_bedtime_temperature': entity('number.nightcanvasrestful_left_bedtime_temperature', '0', { ...freeSleepLevelAttributes }),
  'number.nightcanvasrestful_left_asleep_temperature': entity('number.nightcanvasrestful_left_asleep_temperature', '-1', { ...freeSleepLevelAttributes }),
  'number.nightcanvasrestful_left_dawn_temperature': entity('number.nightcanvasrestful_left_dawn_temperature', '0', { ...freeSleepLevelAttributes }),
  'number.nightcanvasrestful_right_bedtime_temperature': entity('number.nightcanvasrestful_right_bedtime_temperature', '0', { ...freeSleepLevelAttributes }),
  'number.nightcanvasrestful_right_asleep_temperature': entity('number.nightcanvasrestful_right_asleep_temperature', '0', { ...freeSleepLevelAttributes }),
  'number.nightcanvasrestful_right_dawn_temperature': entity('number.nightcanvasrestful_right_dawn_temperature', '0', { ...freeSleepLevelAttributes }),
  'text.master_bedroom_eight_sleep_pod_5_left_bedtime': entity('text.master_bedroom_eight_sleep_pod_5_left_bedtime', '21:30', { icon: 'mdi:bed-clock', mode: 'text' }),
  'text.master_bedroom_eight_sleep_pod_5_right_bedtime': entity('text.master_bedroom_eight_sleep_pod_5_right_bedtime', '22:00', { icon: 'mdi:bed-clock', mode: 'text' }),
  'sensor.nightcanvasrestful_left_current_temperature': entity('sensor.nightcanvasrestful_left_current_temperature', '86', { unit_of_measurement: '°F', device_class: 'temperature' }),
  'sensor.nightcanvasrestful_right_current_temperature': entity('sensor.nightcanvasrestful_right_current_temperature', '72', { unit_of_measurement: '°F', device_class: 'temperature' }),
  'sensor.nightcanvasrestful_left_seconds_remaining': entity('sensor.nightcanvasrestful_left_seconds_remaining', '7200', { unit_of_measurement: 's' }),
  'sensor.nightcanvasrestful_right_seconds_remaining': entity('sensor.nightcanvasrestful_right_seconds_remaining', '0', { unit_of_measurement: 's' }),
  'sensor.nightcanvasrestful_schedules': entity('sensor.nightcanvasrestful_schedules', 'ready', mockFreeSleepScheduleAttributes()),
  'sensor.front_yard_battery_level': entity('sensor.front_yard_battery_level', '12', { device_class: 'battery', unit_of_measurement: '%' }),
  'sensor.front_yard_next_watering': entity('sensor.front_yard_next_watering', '2026-08-13T19:00:00', { programs: ['a'] }),
  'sensor.front_yard_state': entity('sensor.front_yard_state', 'auto'),
  'sensor.front_yard_zone_history': entity('sensor.front_yard_zone_history', '2026-08-13T07:00:00', {
    budget: 100,
    consumption_gallons: 91,
    program: 'a',
    program_name: 'Front Yard',
    run_time: 15,
    start_time: '2026-08-13T07:00:00',
    status: 'complete',
  }),
  'sensor.backyard_faucet_battery_level': entity('sensor.backyard_faucet_battery_level', '100', { device_class: 'battery', unit_of_measurement: '%' }),
  'sensor.backyard_faucet_next_watering': entity('sensor.backyard_faucet_next_watering', 'unknown'),
  'sensor.backyard_faucet_state': entity('sensor.backyard_faucet_state', 'auto'),
  'sensor.bushes_zone_history': entity('sensor.bushes_zone_history', '2026-08-13T20:47:49', { program_name: 'manual', run_time: 10, start_time: '2026-08-13T20:47:49', status: 'complete' }),
  'sensor.house_zone_history': entity('sensor.house_zone_history', '2026-08-13T20:41:53', { program_name: 'manual', run_time: 0.6, start_time: '2026-08-13T20:41:53', status: 'skipped' }),
  'sensor.backyard_zone_history': entity('sensor.backyard_zone_history', '2026-08-13T20:42:58', { program_name: 'manual', run_time: 1.17, start_time: '2026-08-13T20:42:58', status: 'skipped' }),
  'sensor.sidewalk_zone_history': entity('sensor.sidewalk_zone_history', '2026-08-13T20:45:13', { program_name: 'manual', run_time: 1.83, start_time: '2026-08-13T20:45:13', status: 'skipped' }),
  'sensor.sleepypod_stephen_schedule_phase': entity('sensor.sleepypod_stephen_schedule_phase', 'outside'),
  'sensor.sleepypod_steph_schedule_phase': entity('sensor.sleepypod_steph_schedule_phase', 'outside'),
  'switch.nightcanvasrestful_left_power': entity('switch.nightcanvasrestful_left_power', 'on'),
  'switch.nightcanvasrestful_right_power': entity('switch.nightcanvasrestful_right_power', 'off'),
  'switch.nightcanvasrestful_left_away_mode': entity('switch.nightcanvasrestful_left_away_mode', 'off'),
  'switch.nightcanvasrestful_right_away_mode': entity('switch.nightcanvasrestful_right_away_mode', 'off'),
  'switch.nightcanvasrestful_left_alarms_enabled': entity('switch.nightcanvasrestful_left_alarms_enabled', 'off'),
  'switch.nightcanvasrestful_right_alarms_enabled': entity('switch.nightcanvasrestful_right_alarms_enabled', 'off'),
  'switch.front_yard_front_yard_program': entity('switch.front_yard_front_yard_program', 'on', {
    budget: 100,
    frequency: { days: [0, 1, 2, 3, 4, 5, 6], type: 'days' },
    program: 'a',
    run_times: [{ run_time: 15, station: 1 }],
    start_times: ['07:00', '19:00'],
  }),
  'switch.front_yard_rain_delay': entity('switch.front_yard_rain_delay', 'off'),
  'switch.front_yard_smart_watering': entity('switch.front_yard_smart_watering', 'on'),
  'switch.backyard_faucet_rain_delay': entity('switch.backyard_faucet_rain_delay', 'off'),
  'switch.backyard_faucet_bushes_smart_watering': entity('switch.backyard_faucet_bushes_smart_watering', 'on'),
  'switch.backyard_faucet_bushes_program': entity('switch.backyard_faucet_bushes_program', 'on', {
    budget: 100,
    frequency: { days: [0, 1, 2, 3, 4, 5, 6], type: 'days' },
    friendly_name: 'Backyard Faucet Bushes program',
    program: 'b',
    run_times: [{ run_time: 15, station: 1 }],
    start_times: ['07:20', '19:20'],
  }),
  'switch.backyard_faucet_house_program': entity('switch.backyard_faucet_house_program', 'on', {
    budget: 100,
    frequency: { days: [0, 1, 2, 3, 4, 5, 6], type: 'days' },
    friendly_name: 'Backyard Faucet House program',
    program: 'd',
    run_times: [{ run_time: 15, station: 2 }],
    start_times: ['08:20', '20:20'],
  }),
  'switch.backyard_faucet_backyard_program': entity('switch.backyard_faucet_backyard_program', 'off', {
    budget: 100,
    frequency: { days: [0, 1, 2, 3, 4, 5, 6], type: 'days' },
    friendly_name: 'Backyard Faucet Backyard program',
    program: 'c',
    run_times: [{ run_time: 15, station: 3 }],
    start_times: ['08:00', '20:00'],
  }),
  'switch.backyard_faucet_sidewalk_program': entity('switch.backyard_faucet_sidewalk_program', 'on', {
    budget: 100,
    frequency: { days: [0, 1, 2, 3, 4, 5, 6], type: 'days' },
    friendly_name: 'Backyard Faucet Sidewalk program',
    program: 'a',
    run_times: [{ run_time: 15, station: 4 }],
    start_times: ['07:40', '19:40'],
  }),
  'sensor.stephen_s_eight_sleep_side_active_level': entity('sensor.stephen_s_eight_sleep_side_active_level', '1', { raw_value: 9, api_field: 'leftTargetHeatingLevel', source: 'target_heating_level', unit_of_measurement: '°' }),
  'sensor.stephen_s_eight_sleep_side_asleep_level': entity('sensor.stephen_s_eight_sleep_side_asleep_level', '2', { raw_value: 17, api_field: 'initialSleepLevel', unit_of_measurement: '°' }),
  'sensor.stephen_s_eight_sleep_side_bedtime_level': entity('sensor.stephen_s_eight_sleep_side_bedtime_level', '-1', { raw_value: -13, api_field: 'bedTimeLevel', unit_of_measurement: '°' }),
  'sensor.stephen_s_eight_sleep_side_dawn_level': entity('sensor.stephen_s_eight_sleep_side_dawn_level', '2', { raw_value: 22, api_field: 'finalSleepLevel', unit_of_measurement: '°' }),
  'sensor.stephen_s_eight_sleep_side_now_level': entity('sensor.stephen_s_eight_sleep_side_now_level', 'unknown', { raw_value: null, api_field: 'overrideLevels.bedtime', has_override: false, source: 'overrideLevels', unit_of_measurement: '°' }),
  'sensor.steph_s_eight_sleep_side_active_level': entity('sensor.steph_s_eight_sleep_side_active_level', '0', { raw_value: 0, api_field: 'rightTargetHeatingLevel', source: 'target_heating_level', unit_of_measurement: '°' }),
  'sensor.steph_s_eight_sleep_side_asleep_level': entity('sensor.steph_s_eight_sleep_side_asleep_level', '1', { raw_value: 10, api_field: 'initialSleepLevel', unit_of_measurement: '°' }),
  'sensor.steph_s_eight_sleep_side_bedtime_level': entity('sensor.steph_s_eight_sleep_side_bedtime_level', '-5', { raw_value: -50, api_field: 'bedTimeLevel', unit_of_measurement: '°' }),
  'sensor.steph_s_eight_sleep_side_dawn_level': entity('sensor.steph_s_eight_sleep_side_dawn_level', '2', { raw_value: 20, api_field: 'finalSleepLevel', unit_of_measurement: '°' }),
  'sensor.steph_s_eight_sleep_side_now_level': entity('sensor.steph_s_eight_sleep_side_now_level', 'unknown', { raw_value: null, api_field: 'overrideLevels.bedtime', has_override: false, source: 'overrideLevels', unit_of_measurement: '°' }),
  'input_boolean.eight_sleep_stephen_hot_flash_active': entity('input_boolean.eight_sleep_stephen_hot_flash_active', 'off'),
  'input_boolean.eight_sleep_steph_hot_flash_active': entity('input_boolean.eight_sleep_steph_hot_flash_active', 'off'),
  'input_button.eight_sleep_stephen_cancel_hot_flash': entity('input_button.eight_sleep_stephen_cancel_hot_flash', 'unknown', { icon: 'mdi:close' }),
  'input_button.eight_sleep_stephen_hot_flash': entity('input_button.eight_sleep_stephen_hot_flash', 'unknown', { icon: 'mdi:snowflake' }),
  'input_button.eight_sleep_steph_cancel_hot_flash': entity('input_button.eight_sleep_steph_cancel_hot_flash', 'unknown', { icon: 'mdi:close' }),
  'input_button.eight_sleep_steph_hot_flash': entity('input_button.eight_sleep_steph_hot_flash', 'unknown', { icon: 'mdi:snowflake' }),
  'input_datetime.eight_sleep_stephen_hot_flash_restore_at': entity('input_datetime.eight_sleep_stephen_hot_flash_restore_at', '2026-06-07 00:00:00', { timestamp: 1780815600 }),
  'input_datetime.eight_sleep_steph_hot_flash_restore_at': entity('input_datetime.eight_sleep_steph_hot_flash_restore_at', '2026-06-07 00:00:00', { timestamp: 1780815600 }),
  'input_number.eight_sleep_stephen_asleep_level': entity('input_number.eight_sleep_stephen_asleep_level', '1'),
  'input_number.eight_sleep_stephen_bedtime_level': entity('input_number.eight_sleep_stephen_bedtime_level', '-5'),
  'input_number.eight_sleep_stephen_dawn_level': entity('input_number.eight_sleep_stephen_dawn_level', '2'),
  'input_number.eight_sleep_steph_asleep_level': entity('input_number.eight_sleep_steph_asleep_level', '1'),
  'input_number.eight_sleep_steph_bedtime_level': entity('input_number.eight_sleep_steph_bedtime_level', '-5'),
  'input_number.eight_sleep_steph_dawn_level': entity('input_number.eight_sleep_steph_dawn_level', '2'),
  ...mockFreeSleepAlarmHelpers(),
  'timer.eight_sleep_stephen_hot_flash': entity('timer.eight_sleep_stephen_hot_flash', 'idle'),
  'timer.eight_sleep_steph_hot_flash': entity('timer.eight_sleep_steph_hot_flash', 'active', { remaining: '0:12:34' }),
  'input_text.all_aqi_color': entity('input_text.all_aqi_color', 'rgba(0, 150, 136, 1)'),
  'input_text.all_aqi_range': entity('input_text.all_aqi_range', '1'),
  'input_text.all_climate_range': entity('input_text.all_climate_range', '68°F - 72°F'),
  'input_text.all_pm25_range': entity('input_text.all_pm25_range', '0μg/m³ - 1μg/m³'),
  'input_text.guest_room_aqi_color': entity('input_text.guest_room_aqi_color', 'rgba(0, 150, 136, 1)'),
  'input_text.guest_room_climate_color': entity('input_text.guest_room_climate_color', 'rgba(51, 193, 146, 1)'),
  'input_text.guest_room_climate_range': entity('input_text.guest_room_climate_range', '69°F - 71°F'),
  'input_text.guest_room_closet_climate_color': entity('input_text.guest_room_closet_climate_color', 'rgba(51, 193, 146, 1)'),
  'input_text.guest_room_presence_climate_color': entity('input_text.guest_room_presence_climate_color', 'rgba(51, 193, 146, 1)'),
  'input_text.living_room_aqi_color': entity('input_text.living_room_aqi_color', 'rgba(0, 150, 136, 1)'),
  'input_text.living_room_climate_range': entity('input_text.living_room_climate_range', '69°F - 72°F'),
  'input_text.master_bedroom_aqi_color': entity('input_text.master_bedroom_aqi_color', 'rgba(0, 150, 136, 1)'),
  'input_text.music_room_aqi_color': entity('input_text.music_room_aqi_color', 'rgba(0, 150, 136, 1)'),
  'input_text.office_aqi_color': entity('input_text.office_aqi_color', 'rgba(0, 150, 136, 1)'),
  'input_text.stephen_s_pc_power_state': entity('input_text.stephen_s_pc_power_state', 'Off'),
  'input_text.steph_s_pc_power_state': entity('input_text.steph_s_pc_power_state', 'Off'),
  'input_text.theater_room_aqi_color': entity('input_text.theater_room_aqi_color', 'rgba(0, 150, 136, 1)'),
  'input_text.theater_pc_power_state': entity('input_text.theater_pc_power_state', 'Off'),
  'input_boolean.stephen_s_pc_power': entity('input_boolean.stephen_s_pc_power', 'off'),
  'input_boolean.steph_s_pc_power': entity('input_boolean.steph_s_pc_power', 'off'),
  'input_boolean.theater_pc_power': entity('input_boolean.theater_pc_power', 'off'),
  'input_boolean.guests_staying_in_guest_room': entity('input_boolean.guests_staying_in_guest_room', 'off'),
  'input_boolean.guests_staying_in_music_room': entity('input_boolean.guests_staying_in_music_room', 'off'),
  'input_boolean.guests_staying_in_theater_room': entity('input_boolean.guests_staying_in_theater_room', 'off'),
  'input_boolean.vacation_mode': entity('input_boolean.vacation_mode', 'off'),
  'input_boolean.vacation_mode_invalid_dates_pending': entity('input_boolean.vacation_mode_invalid_dates_pending', 'off'),
  'input_boolean.vacation_checklist_turn_off_outdoor_sprinklers': entity('input_boolean.vacation_checklist_turn_off_outdoor_sprinklers', 'off'),
  'input_boolean.vacation_checklist_pour_boiling_water_down_the_drain': entity('input_boolean.vacation_checklist_pour_boiling_water_down_the_drain', 'off'),
  'input_boolean.vacation_checklist_make_the_bed': entity('input_boolean.vacation_checklist_make_the_bed', 'off'),
  'input_boolean.vacation_checklist_unload_and_check_dishwasher': entity('input_boolean.vacation_checklist_unload_and_check_dishwasher', 'off'),
  'input_boolean.vacation_checklist_trash_and_recycles_taken_out': entity('input_boolean.vacation_checklist_trash_and_recycles_taken_out', 'off'),
  'input_datetime.vacation_start': entity('input_datetime.vacation_start', '2026-06-14 10:01:00', { has_date: true, has_time: true }),
  'input_datetime.vacation_end': entity('input_datetime.vacation_end', '2026-06-15 10:01:00', { has_date: true, has_time: true }),
  'input_boolean.is_front_door_auto_lock_enabled': entity('input_boolean.is_front_door_auto_lock_enabled', 'on'),
  'input_boolean.high_aqi_mode': entity('input_boolean.high_aqi_mode', 'off'),
  'input_boolean.relay_control_mode': entity('input_boolean.relay_control_mode', 'off'),
  'input_boolean.show_outdoor_faucets': entity('input_boolean.show_outdoor_faucets', 'off'),
  'input_boolean.show_christmas_lights': entity('input_boolean.show_christmas_lights', 'off'),
  'input_boolean.is_driveway_recording': entity('input_boolean.is_driveway_recording', 'on'),
  'input_boolean.is_front_door_recording': entity('input_boolean.is_front_door_recording', 'off'),
  'input_boolean.is_lower_deck_recording': entity('input_boolean.is_lower_deck_recording', 'on'),
  'input_boolean.is_nintendo_switch_active': entity('input_boolean.is_nintendo_switch_active', 'off'),
  'input_boolean.is_theater_shield_active': entity('input_boolean.is_theater_shield_active', 'off'),
  'input_boolean.is_upper_deck_recording': entity('input_boolean.is_upper_deck_recording', 'on'),
  'light.lights': entity('light.lights', 'on'),
  'light.living_room': entity('light.living_room', 'on'),
  'light.living_room_front_left_light': entity('light.living_room_front_left_light', 'on'),
  'light.living_room_front_right_light': entity('light.living_room_front_right_light', 'off'),
  'light.living_room_back_left_light': entity('light.living_room_back_left_light', 'off'),
  'light.living_room_back_right_light': entity('light.living_room_back_right_light', 'on'),
  'light.guest_room': entity('light.guest_room', 'on'),
  'light.guest_room_bed_light': entity('light.guest_room_bed_light', 'off'),
  'light.guest_room_tv_light': entity('light.guest_room_tv_light', 'on'),
  'light.master_bedroom_closet_light': entity('light.master_bedroom_closet_light', 'off'),
  'media_player.living_room_shield': entity('media_player.living_room_shield', 'off'),
  'media_player.living_room_shield_2': entity('media_player.living_room_shield_2', 'off'),
  'media_player.master_bedroom_apple_tv': entity('media_player.master_bedroom_apple_tv', 'paused', { app_name: 'Apple TV' }),
  'media_player.primary_bedroom': entity('media_player.primary_bedroom', 'playing', { volume_level: 0.34 }),
  'media_player.sonos': entity('media_player.sonos', 'playing', { volume_level: 0.26 }),
  'media_player.sony_projector': entity('media_player.sony_projector', 'off'),
  'media_player.theater': entity('media_player.theater', 'off', { volume_level: 0.42 }),
  'media_player.theater_room_shield': entity('media_player.theater_room_shield', 'off'),
  'remote.living_room_shield': entity('remote.living_room_shield', 'on'),
  'remote.master_bedroom_apple_tv': entity('remote.master_bedroom_apple_tv', 'on'),
  'remote.theater_shield_remote': entity('remote.theater_shield_remote', 'on'),
  'lock.aqara_smart_lock_u400': entity('lock.aqara_smart_lock_u400', 'locked'),
  'lock.fordpass_3fmtk3su5mma09266_doorlock': entity('lock.fordpass_3fmtk3su5mma09266_doorlock', 'locked'),
  'sensor.living_room_back_wall_presence_temperature': entity('sensor.living_room_back_wall_presence_temperature', '70.1', { unit_of_measurement: '°F' }),
  'sensor.living_room_bar_presence_temperature': entity('sensor.living_room_bar_presence_temperature', '70.4', { unit_of_measurement: '°F' }),
  'sensor.living_room_kitchen_wall_presence_temperature': entity('sensor.living_room_kitchen_wall_presence_temperature', '69.8', { unit_of_measurement: '°F' }),
  'sensor.living_room_fireplace_presence_temperature': entity('sensor.living_room_fireplace_presence_temperature', '71.2', { unit_of_measurement: '°F' }),
  'sensor.living_room_presence_sensor_temperature': entity('sensor.living_room_presence_sensor_temperature', '70.1', { unit_of_measurement: '°F' }),
  'sensor.living_room_bar_presence_sensor_temperature_2': entity('sensor.living_room_bar_presence_sensor_temperature_2', '70.4', { unit_of_measurement: '°F' }),
  'sensor.living_room_kitchen_wall_presence_sensor_temperature_2': entity('sensor.living_room_kitchen_wall_presence_sensor_temperature_2', '69.8', { unit_of_measurement: '°F' }),
  'sensor.living_room_fireplace_presence_sensor_temperature_2': entity('sensor.living_room_fireplace_presence_sensor_temperature_2', '71.2', { unit_of_measurement: '°F' }),
  'sensor.guest_room_closet_facing_presence_temperature': entity('sensor.guest_room_closet_facing_presence_temperature', '70.2', { unit_of_measurement: '°F' }),
  'sensor.guest_room_closet_facing_presence_sensor_temperature': entity('sensor.guest_room_closet_facing_presence_sensor_temperature', '70.2', { unit_of_measurement: '°F' }),
  'sensor.guest_room_closet_facing_presence_sensor_temperature_2': entity('sensor.guest_room_closet_facing_presence_sensor_temperature_2', '70.2', { unit_of_measurement: '°F' }),
  'sensor.guest_room_presence_temperature': entity('sensor.guest_room_presence_temperature', '69.5', { unit_of_measurement: '°F' }),
  'sensor.guest_room_presence_sensor_temperature': entity('sensor.guest_room_presence_sensor_temperature', '69.5', { unit_of_measurement: '°F' }),
  'sensor.guest_room_presence_sensor_temperature_2': entity('sensor.guest_room_presence_sensor_temperature_2', '69.5', { unit_of_measurement: '°F' }),
  'cover.guest_room_vent_vent': entity('cover.guest_room_vent_vent', 'open'),
  'cover.living_room_vents': entity('cover.living_room_vents', 'open'),
  'cover.kitchen_vent_vent': entity('cover.kitchen_vent_vent', 'open'),
  'binary_sensor.guest_room_closet_facing_presence_occupancy': entity('binary_sensor.guest_room_closet_facing_presence_occupancy', 'off'),
  'binary_sensor.guest_room_closet_facing_presence_sensor_presence': entity('binary_sensor.guest_room_closet_facing_presence_sensor_presence', 'off'),
  'binary_sensor.guest_room_occupancy_sensors': entity('binary_sensor.guest_room_occupancy_sensors', 'on'),
  'binary_sensor.guest_room_presence_occupancy': entity('binary_sensor.guest_room_presence_occupancy', 'on'),
  'binary_sensor.guest_room_presence_sensor_presence': entity('binary_sensor.guest_room_presence_sensor_presence', 'on'),
  'binary_sensor.living_room_back_wall_presence_occupancy': entity('binary_sensor.living_room_back_wall_presence_occupancy', 'on'),
  'binary_sensor.living_room_bar_presence_occupancy': entity('binary_sensor.living_room_bar_presence_occupancy', 'off'),
  'binary_sensor.living_room_kitchen_wall_presence_occupancy': entity('binary_sensor.living_room_kitchen_wall_presence_occupancy', 'off'),
  'binary_sensor.living_room_fireplace_presence_occupancy': entity('binary_sensor.living_room_fireplace_presence_occupancy', 'off'),
  'binary_sensor.living_room_presence_sensor_presence': entity('binary_sensor.living_room_presence_sensor_presence', 'on'),
  'binary_sensor.living_room_bar_presence_sensor_presence': entity('binary_sensor.living_room_bar_presence_sensor_presence', 'off'),
  'binary_sensor.living_room_kitchen_wall_presence_sensor_presence': entity('binary_sensor.living_room_kitchen_wall_presence_sensor_presence', 'off'),
  'binary_sensor.living_room_fireplace_presence_sensor_presence': entity('binary_sensor.living_room_fireplace_presence_sensor_presence', 'off'),
  'binary_sensor.living_room_occupancy_sensors': entity('binary_sensor.living_room_occupancy_sensors', 'on'),
  'binary_sensor.master_bedroom_closet_presence_occupancy': entity('binary_sensor.master_bedroom_closet_presence_occupancy', 'off'),
  'binary_sensor.master_bedroom_closet_presence_sensor_presence': entity('binary_sensor.master_bedroom_closet_presence_sensor_presence', 'off'),
  'binary_sensor.dining_room_door_contact_sensor_contact': entity('binary_sensor.dining_room_door_contact_sensor_contact', 'off'),
  'binary_sensor.front_door_contact_sensor_contact': entity('binary_sensor.front_door_contact_sensor_contact', 'off'),
  'binary_sensor.garage_door_contact_sensor_contact': entity('binary_sensor.garage_door_contact_sensor_contact', 'off'),
  'binary_sensor.guest_room_window_contact_sensor_contact': entity('binary_sensor.guest_room_window_contact_sensor_contact', 'off'),
  'binary_sensor.gym_window_contact_sensor_contact': entity('binary_sensor.gym_window_contact_sensor_contact', 'off'),
  'binary_sensor.kitchen_door_contact_sensor_contact': entity('binary_sensor.kitchen_door_contact_sensor_contact', 'off'),
  'binary_sensor.living_room_window_contact_sensor_contact': entity('binary_sensor.living_room_window_contact_sensor_contact', 'off'),
  'binary_sensor.master_bedroom_street_window_contact_sensor_contact': entity('binary_sensor.master_bedroom_street_window_contact_sensor_contact', 'off'),
  'binary_sensor.music_room_door_contact_sensor_contact': entity('binary_sensor.music_room_door_contact_sensor_contact', 'off'),
  'binary_sensor.office_pc_window_sensor_contact': entity('binary_sensor.office_pc_window_sensor_contact', 'off'),
  'binary_sensor.office_window_contact_sensor_contact': entity('binary_sensor.office_window_contact_sensor_contact', 'off'),
  'sensor.master_bedroom_sleepypod_eight_pod_left_alarm_state': entity('sensor.master_bedroom_sleepypod_eight_pod_left_alarm_state', 'idle', { snoozed_until: null }),
  'binary_sensor.nightcanvasrestful_left_presence': entity('binary_sensor.nightcanvasrestful_left_presence', 'on'),
  'sensor.master_bedroom_sleepypod_eight_pod_right_alarm_state': entity('sensor.master_bedroom_sleepypod_eight_pod_right_alarm_state', 'idle', { snoozed_until: null }),
  'binary_sensor.nightcanvasrestful_right_presence': entity('binary_sensor.nightcanvasrestful_right_presence', 'off'),
  'binary_sensor.stephen_s_eight_sleep_side_bed_presence': entity('binary_sensor.stephen_s_eight_sleep_side_bed_presence', 'on'),
  'binary_sensor.steph_s_eight_sleep_side_bed_presence': entity('binary_sensor.steph_s_eight_sleep_side_bed_presence', 'off'),
  'binary_sensor.theater_room_door_contact_sensor_contact': entity('binary_sensor.theater_room_door_contact_sensor_contact', 'off'),
  'cover.left_door': entity('cover.left_door', 'closed'),
  'cover.right_door': entity('cover.right_door', 'closed'),
  'fan.air_purifier_levoit_purifier': entity('fan.air_purifier_levoit_purifier', 'on', { percentage: 33 }),
  'fan.guest_room_air_purifier_levoit_purifier': entity('fan.guest_room_air_purifier_levoit_purifier', 'on', { percentage: 33 }),
  'fan.living_room_air_purifier_levoit_purifier': entity('fan.living_room_air_purifier_levoit_purifier', 'on', { percentage: 33 }),
  'fan.master_bedroom_air_purifier_levoit_purifier': entity('fan.master_bedroom_air_purifier_levoit_purifier', 'on', { percentage: 33 }),
  'fan.office_air_purifier_levoit_purifier': entity('fan.office_air_purifier_levoit_purifier', 'on', { percentage: 33 }),
  'fan.theater_room_air_purifier_levoit_purifier': entity('fan.theater_room_air_purifier_levoit_purifier', 'on', { percentage: 33 }),
  'switch.lv600s_humidifier_power': entity('switch.lv600s_humidifier_power', 'on'),
  'switch.lv600s_humidifier_display': entity('switch.lv600s_humidifier_display', 'on'),
  'select.lv600s_humidifier_mode': entity('select.lv600s_humidifier_mode', 'Manual', { options: ['Manual', 'Target Humidity', 'Sleep'] }),
  'number.lv600s_humidifier_target_humidity': entity('number.lv600s_humidifier_target_humidity', '100', { max: 80, min: 40, mode: 'slider', step: 5 }),
  'number.lv600s_humidifier_mist_level': entity('number.lv600s_humidifier_mist_level', '5', { max: 9, min: 1, mode: 'slider', step: 1 }),
  'number.lv600s_humidifier_warm_level': entity('number.lv600s_humidifier_warm_level', '1', { max: 3, min: 0, mode: 'slider', step: 1 }),
  'number.lv600s_humidifier_timer_minutes': entity('number.lv600s_humidifier_timer_minutes', '0', { max: 720, min: 0, mode: 'box', step: 30 }),
  'sensor.lv600s_humidifier_current_humidity': entity('sensor.lv600s_humidifier_current_humidity', '46', { unit_of_measurement: '%' }),
  'sensor.lv600s_humidifier_current_temperature': entity('sensor.lv600s_humidifier_current_temperature', '71.6', { unit_of_measurement: '°F' }),
  'sensor.lv600s_humidifier_timer_remaining': entity('sensor.lv600s_humidifier_timer_remaining', '0', { unit_of_measurement: 's' }),
  'binary_sensor.lv600s_humidifier_water_low': entity('binary_sensor.lv600s_humidifier_water_low', 'off'),
  'binary_sensor.lv600s_humidifier_tank_removed': entity('binary_sensor.lv600s_humidifier_tank_removed', 'off'),
  'binary_sensor.lv600s_humidifier_humidifying': entity('binary_sensor.lv600s_humidifier_humidifying', 'on'),
  'schedule.master_bedroom_humidifier': entity('schedule.master_bedroom_humidifier', 'off', { next_event: null }),
  'input_boolean.master_bedroom_humidifier_schedule_enabled': entity('input_boolean.master_bedroom_humidifier_schedule_enabled', 'off'),
  'script.master_bedroom_humidifier_set_level': entity('script.master_bedroom_humidifier_set_level', 'off'),
  'script.master_bedroom_humidifier_apply_profile': entity('script.master_bedroom_humidifier_apply_profile', 'off'),
  'select.air_purifier_auto_mode': entity('select.air_purifier_auto_mode', 'Default'),
  'select.air_purifier_fan_mode': entity('select.air_purifier_fan_mode', 'Auto'),
  'binary_sensor.dishwasher_connectivity': entity('binary_sensor.dishwasher_connectivity', 'on'),
  'binary_sensor.dishwasher_remote_control': entity('binary_sensor.dishwasher_remote_control', 'on'),
  'binary_sensor.dishwasher_remote_start': entity('binary_sensor.dishwasher_remote_start', 'off'),
  'button.dishwasher_resume_program': entity('button.dishwasher_resume_program', 'unavailable'),
  'button.dishwasher_stop_program': entity('button.dishwasher_stop_program', 'unknown'),
  'input_boolean.dishwasher_clean_unopened': entity('input_boolean.dishwasher_clean_unopened', 'off'),
  'input_button.start_dishwasher': entity('input_button.start_dishwasher', '2026-01-07T18:54:25.606577+00:00'),
  'select.dishwasher_active_program': entity('select.dishwasher_active_program', 'unknown'),
  'select.dishwasher_selected_program': entity('select.dishwasher_selected_program', 'Eco 50', { options: ['Eco 50', 'Glass 40'] }),
  'switch.dishwasher_half_load': entity('switch.dishwasher_half_load', 'off'),
  'switch.dishwasher_hygiene': entity('switch.dishwasher_hygiene', 'unavailable'),
  'switch.dishwasher_power': entity('switch.dishwasher_power', 'off'),
  'switch.dishwasher_zeolite_dry': entity('switch.dishwasher_zeolite_dry', 'off'),
  'select.guest_room_air_purifier_auto_mode': entity('select.guest_room_air_purifier_auto_mode', 'Default'),
  'select.guest_room_air_purifier_fan_mode': entity('select.guest_room_air_purifier_fan_mode', 'Auto'),
  'select.living_room_air_purifier_auto_mode': entity('select.living_room_air_purifier_auto_mode', 'Default'),
  'select.living_room_air_purifier_fan_mode': entity('select.living_room_air_purifier_fan_mode', 'Auto'),
  'select.master_bedroom_air_purifier_auto_mode': entity('select.master_bedroom_air_purifier_auto_mode', 'Default'),
  'select.master_bedroom_air_purifier_fan_mode': entity('select.master_bedroom_air_purifier_fan_mode', 'Auto'),
  'select.office_air_purifier_auto_mode': entity('select.office_air_purifier_auto_mode', 'Default'),
  'select.office_air_purifier_fan_mode': entity('select.office_air_purifier_fan_mode', 'Auto'),
  'select.theater_room_air_purifier_auto_mode': entity('select.theater_room_air_purifier_auto_mode', 'Default'),
  'select.theater_room_air_purifier_fan_mode': entity('select.theater_room_air_purifier_fan_mode', 'Auto'),
  'sensor.bear_grills_probe_probe0': entity('sensor.bear_grills_probe_probe0', 'unavailable'),
  'sensor.d8478fa2ad0a_grill_state': entity('sensor.d8478fa2ad0a_grill_state', 'off'),
  'sensor.d8478fa2ad0a_pellet_level': entity('sensor.d8478fa2ad0a_pellet_level', '78'),
  'sensor.dishwasher_door': entity('sensor.dishwasher_door', 'closed'),
  'sensor.dishwasher_operation_state': entity('sensor.dishwasher_operation_state', 'ready'),
  'sensor.dishwasher_program_finish_time': entity('sensor.dishwasher_program_finish_time', 'unavailable'),
  'sensor.dishwasher_program_progress': entity('sensor.dishwasher_program_progress', '0'),
  'sensor.dishwasher_rinse_aid_nearly_empty': entity('sensor.dishwasher_rinse_aid_nearly_empty', 'off'),
  'sensor.dishwasher_salt_nearly_empty': entity('sensor.dishwasher_salt_nearly_empty', 'off'),
  'automation.automatically_vacuum_or_mop_music_room': entity('automation.automatically_vacuum_or_mop_music_room', 'on'),
  'automation.automatically_vacuum_theater_room_on_schedule': entity('automation.automatically_vacuum_theater_room_on_schedule', 'on'),
  'sensor.living_room_air_purifier_air_quality_index': entity('sensor.living_room_air_purifier_air_quality_index', '1'),
  'sensor.living_room_air_purifier_pm2_5': entity('sensor.living_room_air_purifier_pm2_5', '2', { unit_of_measurement: 'μg/m³' }),
  'sensor.air_purifier_air_quality_index': entity('sensor.air_purifier_air_quality_index', '1'),
  'sensor.air_purifier_pm2_5': entity('sensor.air_purifier_pm2_5', '2', { unit_of_measurement: 'μg/m³' }),
  'sensor.guest_room_air_purifier_air_quality_index': entity('sensor.guest_room_air_purifier_air_quality_index', '1'),
  'sensor.guest_room_air_purifier_pm2_5': entity('sensor.guest_room_air_purifier_pm2_5', '2', { unit_of_measurement: 'μg/m³' }),
  'sensor.master_bedroom_air_purifier_air_quality_index': entity('sensor.master_bedroom_air_purifier_air_quality_index', '1'),
  'sensor.master_bedroom_air_purifier_pm2_5': entity('sensor.master_bedroom_air_purifier_pm2_5', '2', { unit_of_measurement: 'μg/m³' }),
  'sensor.office_air_purifier_air_quality_index': entity('sensor.office_air_purifier_air_quality_index', '1'),
  'sensor.office_air_purifier_pm2_5': entity('sensor.office_air_purifier_pm2_5', '2', { unit_of_measurement: 'μg/m³' }),
  'sensor.theater_room_air_purifier_air_quality_index': entity('sensor.theater_room_air_purifier_air_quality_index', '1'),
  'sensor.theater_room_air_purifier_pm2_5': entity('sensor.theater_room_air_purifier_pm2_5', '2', { unit_of_measurement: 'μg/m³' }),
  'switch.d8478fa2ad0a_keep_warm_enabled': entity('switch.d8478fa2ad0a_keep_warm_enabled', 'off'),
  'switch.d8478fa2ad0a_super_smoke_enabled': entity('switch.d8478fa2ad0a_super_smoke_enabled', 'off'),
  'switch.guest_bathroom_fan_switch_top': entity('switch.guest_bathroom_fan_switch_top', 'off'),
  'switch.guest_bathroom_towel_rack_switch_top': entity('switch.guest_bathroom_towel_rack_switch_top', 'on'),
  'switch.main_floor_vacuum_coordinator_pause': entity('switch.main_floor_vacuum_coordinator_pause', 'off'),
  'switch.master_bathroom_fan_switch_top': entity('switch.master_bathroom_fan_switch_top', 'off'),
  'switch.master_bathroom_towel_rack_switch_top': entity('switch.master_bathroom_towel_rack_switch_top', 'on'),
  ...mockSwitchEntities(adminPresenceSwitchEntityIds, { automation_paused: false }),
  ...mockSwitchEntities(adminAutoReEnableSwitchEntityIds),
  'todo.shopping_list': entity('todo.shopping_list', '2'),
  'todo.groceries': entity('todo.groceries', '1'),
  'todo.stephen_s_tasks': entity('todo.stephen_s_tasks', '0'),
  'todo.steph_s_tasks': entity('todo.steph_s_tasks', '0'),
  'todo.home_improvement_s_tasks': entity('todo.home_improvement_s_tasks', '3'),
  'todo.unassigned_no_due_date': entity('todo.unassigned_no_due_date', '17'),
  'todo.stephen_s_past_due_with_unassigned': entity('todo.stephen_s_past_due_with_unassigned', '1'),
  'todo.stephen_s_evening_with_unassigned': entity('todo.stephen_s_evening_with_unassigned', '1'),
  'todo.stephen_s_afternoon_with_unassigned': entity('todo.stephen_s_afternoon_with_unassigned', '0'),
  'todo.stephen_s_morning_with_unassigned': entity('todo.stephen_s_morning_with_unassigned', '0'),
  'todo.stephen_s_all_day_with_unassigned': entity('todo.stephen_s_all_day_with_unassigned', '0'),
  'todo.stephen_s_no_due_date_with_unassigned': entity('todo.stephen_s_no_due_date_with_unassigned', '1'),
  'todo.stephen_s_upcoming_today_by_time_and_future_with_unassigned': entity('todo.stephen_s_upcoming_today_by_time_and_future_with_unassigned', '1'),
  'todo.steph_s_evening_with_unassigned': entity('todo.steph_s_evening_with_unassigned', '1'),
  'todo.steph_s_afternoon_with_unassigned': entity('todo.steph_s_afternoon_with_unassigned', '0'),
  'todo.steph_s_morning_with_unassigned': entity('todo.steph_s_morning_with_unassigned', '0'),
  'todo.steph_s_all_day_with_unassigned': entity('todo.steph_s_all_day_with_unassigned', '0'),
  'todo.steph_s_no_due_date_with_unassigned': entity('todo.steph_s_no_due_date_with_unassigned', '1'),
  'todo.steph_s_upcoming_today_by_time_and_future_with_unassigned': entity('todo.steph_s_upcoming_today_by_time_and_future_with_unassigned', '1'),
  'todo.stephen_s_upcoming_today_by_time_with_unassigned': entity('todo.stephen_s_upcoming_today_by_time_with_unassigned', '2'),
  'todo.stephen_s_due_today_with_unassigned': entity('todo.stephen_s_due_today_with_unassigned', '2'),
  'todo.steph_s_past_due_with_unassigned': entity('todo.steph_s_past_due_with_unassigned', '0'),
  'todo.steph_s_upcoming_today_by_time_with_unassigned': entity('todo.steph_s_upcoming_today_by_time_with_unassigned', '1'),
  'todo.steph_s_due_today_with_unassigned': entity('todo.steph_s_due_today_with_unassigned', '1'),
  'vacuum.valetudo_elatedusedram': entity('vacuum.valetudo_elatedusedram', 'unavailable'),
  'sensor.valetudo_elatedusedram_battery_level': entity('sensor.valetudo_elatedusedram_battery_level', 'unknown', { unit_of_measurement: '%' }),
  'sensor.valetudo_elatedusedram_status_flag': entity('sensor.valetudo_elatedusedram_status_flag', 'unknown'),
  'sensor.valetudo_elatedusedram_error': entity('sensor.valetudo_elatedusedram_error', 'unavailable'),
  ...valetudoConsumableMockEntities('valetudo_elatedusedram'),
  'input_text.music_room_vacuum_error_message': entity('input_text.music_room_vacuum_error_message', ''),
  'input_text.music_room_vacuum_mode': entity('input_text.music_room_vacuum_mode', 'Vacuum'),
  'select.valetudo_elatedusedram_mode': entity('select.valetudo_elatedusedram_mode', 'unavailable', { options: ['vacuum', 'mop', 'vacuum_and_mop'] }),
  'select.valetudo_elatedusedram_fan': entity('select.valetudo_elatedusedram_fan', 'unavailable', { options: ['quiet', 'balanced', 'turbo', 'max'] }),
  'select.valetudo_elatedusedram_water': entity('select.valetudo_elatedusedram_water', 'unavailable', { options: ['low', 'medium', 'high'] }),
  'input_select.music_room_vacuum_cleaning_passes': entity('input_select.music_room_vacuum_cleaning_passes', '1', { options: ['1', '2', '3'] }),
  'binary_sensor.valetudo_elatedusedram_mop_attachment': entity('binary_sensor.valetudo_elatedusedram_mop_attachment', 'on'),
  'sensor.valetudo_elatedusedram_dock_status': entity('sensor.valetudo_elatedusedram_dock_status', 'idle'),
  'camera.valetudo_elatedusedram_map_data': entity('camera.valetudo_elatedusedram_map_data', 'idle'),
  'input_boolean.clean_music_room': entity('input_boolean.clean_music_room', 'off'),
  'input_boolean.clean_downstairs_hallway': entity('input_boolean.clean_downstairs_hallway', 'off'),
  'input_boolean.clean_downstairs_bathroom': entity('input_boolean.clean_downstairs_bathroom', 'off'),
  'button.valetudo_elatedusedram_trigger_auto_empty_dock': entity('button.valetudo_elatedusedram_trigger_auto_empty_dock', 'unknown'),
  'vacuum.valetudo_politefatherlykingfisher': entity('vacuum.valetudo_politefatherlykingfisher', 'docked'),
  'sensor.valetudo_politefatherlykingfisher_battery_level': entity('sensor.valetudo_politefatherlykingfisher_battery_level', '99', { unit_of_measurement: '%' }),
  'sensor.valetudo_politefatherlykingfisher_status_flag': entity('sensor.valetudo_politefatherlykingfisher_status_flag', 'none'),
  'sensor.valetudo_politefatherlykingfisher_error': entity('sensor.valetudo_politefatherlykingfisher_error', 'No error'),
  ...valetudoConsumableMockEntities('valetudo_politefatherlykingfisher', {
    main_brush: '14700',
    main_filter: '5700',
    right_brush: '8700',
  }),
  'input_text.theater_room_vacuum_error_message': entity('input_text.theater_room_vacuum_error_message', ''),
  'select.valetudo_politefatherlykingfisher_mode': entity('select.valetudo_politefatherlykingfisher_mode', 'vacuum', { options: ['vacuum_and_mop', 'mop', 'vacuum', 'vacuum_then_mop'] }),
  'select.valetudo_politefatherlykingfisher_fan': entity('select.valetudo_politefatherlykingfisher_fan', 'balanced', { options: ['quiet', 'balanced', 'turbo', 'max'] }),
  'select.valetudo_politefatherlykingfisher_water': entity('select.valetudo_politefatherlykingfisher_water', 'medium', { options: ['min', 'low', 'medium', 'high', 'max'] }),
  'input_select.theater_room_vacuum_cleaning_passes': entity('input_select.theater_room_vacuum_cleaning_passes', '1', { options: ['1', '2', '3'] }),
  'binary_sensor.valetudo_politefatherlykingfisher_mop_attachment': entity('binary_sensor.valetudo_politefatherlykingfisher_mop_attachment', 'on'),
  'sensor.valetudo_politefatherlykingfisher_dock_status': entity('sensor.valetudo_politefatherlykingfisher_dock_status', 'idle'),
  'button.valetudo_politefatherlykingfisher_trigger_auto_empty_dock': entity('button.valetudo_politefatherlykingfisher_trigger_auto_empty_dock', 'unknown'),
  'camera.valetudo_politefatherlykingfisher_map_data': entity('camera.valetudo_politefatherlykingfisher_map_data', 'idle'),
  'vacuum.valetudo_exaltedsneakydeer': entity('vacuum.valetudo_exaltedsneakydeer', 'docked'),
  'sensor.valetudo_exaltedsneakydeer_battery_level': entity('sensor.valetudo_exaltedsneakydeer_battery_level', '99', { unit_of_measurement: '%' }),
  'sensor.valetudo_exaltedsneakydeer_status_flag': entity('sensor.valetudo_exaltedsneakydeer_status_flag', 'none'),
  'sensor.valetudo_exaltedsneakydeer_error': entity('sensor.valetudo_exaltedsneakydeer_error', 'No error'),
  ...valetudoConsumableMockEntities('valetudo_exaltedsneakydeer'),
  'input_text.main_floor_vacuum_error_message': entity('input_text.main_floor_vacuum_error_message', ''),
  'input_text.main_floor_vacuum_mode': entity('input_text.main_floor_vacuum_mode', 'Vacuum'),
  'select.valetudo_exaltedsneakydeer_mode': entity('select.valetudo_exaltedsneakydeer_mode', 'vacuum', { options: ['vacuum_and_mop', 'mop', 'vacuum', 'vacuum_then_mop'] }),
  'select.valetudo_exaltedsneakydeer_fan': entity('select.valetudo_exaltedsneakydeer_fan', 'balanced', { options: ['quiet', 'balanced', 'turbo', 'max'] }),
  'select.valetudo_exaltedsneakydeer_water': entity('select.valetudo_exaltedsneakydeer_water', 'medium', { options: ['low', 'medium', 'high'] }),
  'input_select.main_floor_vacuum_cleaning_passes': entity('input_select.main_floor_vacuum_cleaning_passes', '1', { options: ['1', '2', '3'] }),
  'binary_sensor.valetudo_exaltedsneakydeer_mop_attachment': entity('binary_sensor.valetudo_exaltedsneakydeer_mop_attachment', 'on'),
  'sensor.valetudo_exaltedsneakydeer_dock_status': entity('sensor.valetudo_exaltedsneakydeer_dock_status', 'idle'),
  'sensor.evershelf_items_in_pantry': entity('sensor.evershelf_items_in_pantry', '12', { unit_of_measurement: 'items' }),
  'sensor.evershelf_items_in_fridge': entity('sensor.evershelf_items_in_fridge', '8', { unit_of_measurement: 'items' }),
  'sensor.evershelf_items_in_freezer': entity('sensor.evershelf_items_in_freezer', '5', { unit_of_measurement: 'items' }),
  'sensor.kitchen_evershelf_items_in_spice_rack': entity('sensor.kitchen_evershelf_items_in_spice_rack', '6', { unit_of_measurement: 'items' }),
  'sensor.kitchen_evershelf_items_in_cabinet': entity('sensor.kitchen_evershelf_items_in_cabinet', '4', { unit_of_measurement: 'items' }),
  'sensor.evershelf_total_items': entity('sensor.evershelf_total_items', '35', { unit_of_measurement: 'items' }),
  'sensor.evershelf_expiring_soon': entity('sensor.evershelf_expiring_soon', '6', {
    expiring_list: [
      { days_remaining: 2, expiry_date: '2026-06-27', location: 'dispensa', name: 'Rice' },
      { days_remaining: 7, expiry_date: '2026-07-02', location: 'frigo', name: 'Milk' },
      { days_remaining: 8, expiry_date: '2026-07-03', location: 'frigo', name: 'Yogurt' },
      { days_remaining: 5, expiry_date: '2026-06-30', location: 'freezer', name: 'Waffles' },
      { days_remaining: 4, expiry_date: '2026-06-29', location: 'spice_rack', name: 'Paprika' },
      { days_remaining: 6, expiry_date: '2026-07-01', location: 'cabinet', name: 'Tea Bags' },
    ],
    unit_of_measurement: 'items',
  }),
  'sensor.evershelf_expired_items': entity('sensor.evershelf_expired_items', '2', {
    expired_list: [
      { brand: 'Tillamook', days_remaining: -6, expiry_date: '2026-06-19', inventory_id: 140, location: 'frigo', name: 'Premium Sour Cream', quantity: 1 },
      { brand: '', days_remaining: -21, expiry_date: '2026-06-04', inventory_id: 143, location: 'dispensa', name: 'Nachos', quantity: 2 },
    ],
    unit_of_measurement: 'items',
  }),
  'input_boolean.roborock_living_room_toggle': entity('input_boolean.roborock_living_room_toggle', 'off'),
  'input_boolean.roborock_master_bedroom_toggle': entity('input_boolean.roborock_master_bedroom_toggle', 'off'),
  'input_boolean.roborock_kitchen_toggle': entity('input_boolean.roborock_kitchen_toggle', 'off'),
  'input_boolean.roborock_office_toggle': entity('input_boolean.roborock_office_toggle', 'off'),
  'input_boolean.roborock_hallway_toggle': entity('input_boolean.roborock_hallway_toggle', 'off'),
  'input_boolean.roborock_guest_room_toggle': entity('input_boolean.roborock_guest_room_toggle', 'off'),
  'input_boolean.roborock_master_bathroom_toggle': entity('input_boolean.roborock_master_bathroom_toggle', 'off'),
  'input_boolean.roborock_guest_bathroom_toggle': entity('input_boolean.roborock_guest_bathroom_toggle', 'off'),
  'input_boolean.roborock_gym_toggle': entity('input_boolean.roborock_gym_toggle', 'off'),
  'input_boolean.roborock_master_bedroom_closet_toggle': entity('input_boolean.roborock_master_bedroom_closet_toggle', 'off'),
  'input_boolean.roborock_dining_room_toggle': entity('input_boolean.roborock_dining_room_toggle', 'off'),
  ...mainFloorAutoCleanDisabledMockEntities(),
  ...thermostatMockEntities(),
  'button.valetudo_exaltedsneakydeer_trigger_auto_empty_dock': entity('button.valetudo_exaltedsneakydeer_trigger_auto_empty_dock', 'unknown'),
  'camera.valetudo_exaltedsneakydeer_map_data': entity('camera.valetudo_exaltedsneakydeer_map_data', 'idle'),
  'input_boolean.manually_control_front_yard_lights': entity('input_boolean.manually_control_front_yard_lights', 'off', { icon: 'mdi:lightbulb' }),
  'input_select.front_yard_custom_lights': entity('input_select.front_yard_custom_lights', 'Default', { options: ['Default', 'Custom', 'Seahawks', "Valentine's Day"], icon: 'mdi:lightbulb-group' }),
  'light.front_door_exterior_left_light': entity('light.front_door_exterior_left_light', 'off', { brightness: null }),
  'light.front_door_exterior_light_v2': entity('light.front_door_exterior_light_v2', 'off', { brightness: null }),
  'light.front_door_bollard_1': entity('light.front_door_bollard_1', 'off', { brightness: null }),
  'light.front_door_bollard_2': entity('light.front_door_bollard_2', 'off', { brightness: null }),
  'light.front_door_bollard_3': entity('light.front_door_bollard_3', 'off', { brightness: null }),
  'light.front_door_bollard_4': entity('light.front_door_bollard_4', 'off', { brightness: null }),
  'light.front_door_bollard_5': entity('light.front_door_bollard_5', 'off', { brightness: null }),
  'light.front_door_bollard_6': entity('light.front_door_bollard_6', 'off', { brightness: null }),
  'weather.pirate_weather': entity('weather.pirate_weather', 'partlycloudy', { temperature: 45, temperature_unit: '°F' }),
  'select.front_yard_device_mode': entity('select.front_yard_device_mode', 'auto', { options: ['auto', 'off'] }),
  'select.backyard_faucet_device_mode': entity('select.backyard_faucet_device_mode', 'auto', { options: ['auto', 'off'] }),
  'valve.front_yard_zone': entity('valve.front_yard_zone', 'closed', {
    device_class: 'water',
    device_name: 'Front Yard',
    manual_preset_runtime: 300,
    next_start_programs: ['a'],
    next_start_time: '2026-08-13T19:00:00',
    smart_watering_enabled: true,
    station: 1,
    zone_name: 'Front Yard',
  }),
  'valve.backyard_faucet_bushes_zone': entity('valve.backyard_faucet_bushes_zone', 'closed', { device_name: 'Backyard Faucet', station: 1, zone_name: 'Sidewalk (New)' }),
  'valve.backyard_faucet_house_zone': entity('valve.backyard_faucet_house_zone', 'closed', { device_name: 'Backyard Faucet', station: 2, zone_name: 'Bushes (New)' }),
  'valve.backyard_faucet_backyard_zone': entity('valve.backyard_faucet_backyard_zone', 'closed', { device_name: 'Backyard Faucet', station: 3, zone_name: 'Backyard' }),
  'valve.backyard_faucet_sidewalk_zone': entity('valve.backyard_faucet_sidewalk_zone', 'closed', { device_name: 'Backyard Faucet', station: 4, zone_name: 'House' }),
}

export function mergeMockEntityMaps(
  generated: Record<string, MockEntity>,
  explicit: Record<string, MockEntity>,
) {
  return { ...generated, ...explicit }
}

export const mockEntities: Record<string, MockEntity> = mergeMockEntityMaps(mockEntitiesFixture, explicitMockEntities)

function todoItems(entityId: unknown) {
  const entityKey = String(entityId)
  return {
    items: mockTodoItemsByEntity[entityKey] ?? [
      { uid: '1001--2026-06-04 17:30:00+00:00', summary: 'Mock task one', status: 'needs_action', due: '2026-06-04T17:30:00+00:00' },
      { uid: '1002--None', summary: 'Mock task two', status: 'needs_action' },
    ],
  }
}

export function resetMockHass() {
  mockCallServiceCalls.length = 0
  mockScheduleMessages.length = 0
  mockTodoUpdateMessages.length = 0
  for (const entityId of Object.keys(mockTodoItemsByEntity)) delete mockTodoItemsByEntity[entityId]
  for (const taskId of Object.keys(mockDonetickTasksById)) delete mockDonetickTasksById[Number(taskId)]
  for (const location of Object.keys(mockInventoryItemsByLocation)) delete mockInventoryItemsByLocation[location]
  mockDonetickTaskLoadDelayMs = 0
  mockRecipeQueryDelayMs = 0
  mockState.user = { id: '64089b5683944c39b4f944c8f76830b0', is_admin: true, name: 'Stephen' }
  mockEntities['input_boolean.show_outdoor_faucets'].state = 'off'
  mockEntities['binary_sensor.front_yard_fault'].state = 'off'
  mockEntities['binary_sensor.front_yard_hub_connected'].state = 'on'
  mockEntities['binary_sensor.backyard_faucet_fault'].state = 'off'
  mockEntities['binary_sensor.wi_fi_hub_connected'].state = 'on'
  mockEntities['select.backyard_faucet_device_mode'].state = 'auto'
  mockEntities['select.front_yard_device_mode'].state = 'auto'
  mockEntities['sensor.front_yard_battery_level'].state = '12'
  mockEntities['sensor.front_yard_next_watering'].state = '2026-08-13T19:00:00'
  mockEntities['sensor.front_yard_state'].state = 'auto'
  mockEntities['sensor.backyard_faucet_battery_level'].state = '100'
  mockEntities['sensor.backyard_faucet_next_watering'].state = 'unknown'
  mockEntities['sensor.backyard_faucet_state'].state = 'auto'
  mockEntities['switch.front_yard_front_yard_program'].state = 'on'
  mockEntities['switch.front_yard_rain_delay'].state = 'off'
  mockEntities['switch.front_yard_smart_watering'].state = 'on'
  mockEntities['switch.backyard_faucet_rain_delay'].state = 'off'
  mockEntities['switch.backyard_faucet_bushes_smart_watering'].state = 'on'
  mockEntities['switch.backyard_faucet_bushes_program'].state = 'on'
  mockEntities['switch.backyard_faucet_house_program'].state = 'on'
  mockEntities['switch.backyard_faucet_backyard_program'].state = 'off'
  mockEntities['switch.backyard_faucet_sidewalk_program'].state = 'on'
  mockEntities['valve.front_yard_zone'].state = 'closed'
  mockEntities['valve.backyard_faucet_bushes_zone'].state = 'closed'
  mockEntities['valve.backyard_faucet_house_zone'].state = 'closed'
  mockEntities['valve.backyard_faucet_backyard_zone'].state = 'closed'
  mockEntities['valve.backyard_faucet_sidewalk_zone'].state = 'closed'
  mockEntities['sensor.nightcanvasrestful_schedules'].attributes = mockFreeSleepScheduleAttributes()
  mockEntities['sensor.sleepypod_stephen_schedule_phase'].state = 'outside'
  mockEntities['sensor.sleepypod_steph_schedule_phase'].state = 'outside'
  mockEntities['switch.nightcanvasrestful_left_alarms_enabled'].state = 'off'
  mockEntities['switch.nightcanvasrestful_right_alarms_enabled'].state = 'off'
  for (const owner of freeSleepAlarmOwners) {
    mockEntities[`input_boolean.${owner}_alarms_enabled`].state = 'off'
    for (const day of freeSleepAlarmDays) {
      mockEntities[`input_boolean.${owner}_${day}_alarm_configured`].state = 'off'
      mockEntities[`input_boolean.${owner}_${day}_alarm_enabled`].state = 'off'
      mockEntities[`input_datetime.${owner}_${day}_alarm_time`].state = '07:00:00'
    }
  }
  mockEntities['sensor.master_bedroom_sleepypod_eight_pod_left_alarm_state'].state = 'idle'
  mockEntities['sensor.master_bedroom_sleepypod_eight_pod_left_alarm_state'].attributes.snoozed_until = null
  mockEntities['sensor.master_bedroom_sleepypod_eight_pod_right_alarm_state'].state = 'idle'
  mockEntities['sensor.master_bedroom_sleepypod_eight_pod_right_alarm_state'].attributes.snoozed_until = null
  for (const room of thermostatRoomMockData) {
    mockEntities[`switch.living_room_thermostat_contact_sensors_${room.key}_track_only_when_occupied`].state = 'trackOnlyWhenOccupied' in room ? room.trackOnlyWhenOccupied : 'off'
    mockEntities[room.climate].attributes.away_mode_active = false
  }
  for (const roomId of mainFloorAutoCleanDisabledRoomIds) {
    mockEntities[mainFloorAutoCleanDisabledEntityId(roomId)].state = 'off'
  }
  mockEntities['automation.automatically_vacuum_or_mop_music_room'].state = 'on'
  mockEntities['automation.automatically_vacuum_theater_room_on_schedule'].state = 'on'
  mockEntities['vacuum.valetudo_elatedusedram'].state = 'unavailable'
  mockEntities['vacuum.valetudo_politefatherlykingfisher'].state = 'docked'
  mockEntities['vacuum.valetudo_exaltedsneakydeer'].state = 'docked'
  mockEntities['binary_sensor.valetudo_elatedusedram_mop_attachment'].state = 'on'
  mockEntities['binary_sensor.valetudo_politefatherlykingfisher_mop_attachment'].state = 'on'
  mockEntities['binary_sensor.valetudo_exaltedsneakydeer_mop_attachment'].state = 'on'
  mockEntities['sensor.valetudo_elatedusedram_dock_status'].state = 'idle'
  mockEntities['sensor.valetudo_politefatherlykingfisher_dock_status'].state = 'idle'
  mockEntities['sensor.valetudo_exaltedsneakydeer_dock_status'].state = 'idle'
  mockEntities['sensor.valetudo_exaltedsneakydeer_battery_level'].state = '99'
  mockEntities['sensor.valetudo_exaltedsneakydeer_status_flag'].state = 'none'
  mockEntities['sensor.valetudo_exaltedsneakydeer_error'].state = 'No error'
  mockEntities['input_text.main_floor_vacuum_error_message'].state = ''
  mockEntities['select.valetudo_exaltedsneakydeer_mode'].state = 'vacuum'
  mockEntities['select.valetudo_exaltedsneakydeer_fan'].state = 'balanced'
  mockEntities['select.valetudo_exaltedsneakydeer_water'].state = 'medium'
  mockEntities['input_select.main_floor_vacuum_cleaning_passes'].state = '1'
  mockEntities['sensor.valetudo_exaltedsneakydeer_main_brush'].state = '12240'
  mockEntities['sensor.valetudo_exaltedsneakydeer_right_brush'].state = '6240'
  mockEntities['sensor.valetudo_exaltedsneakydeer_main_filter'].state = '3240'
  mockEntities['sensor.valetudo_exaltedsneakydeer_sensor_cleaning'].state = '120'
  mockEntities['sensor.valetudo_exaltedsneakydeer_wheel_cleaning'].state = '120'
  mockEntities['input_boolean.guests_staying_in_guest_room'].state = 'off'
  mockEntities['input_boolean.guests_staying_in_music_room'].state = 'off'
  mockEntities['input_boolean.guests_staying_in_theater_room'].state = 'off'
  mockEntities['input_boolean.high_aqi_mode'].state = 'off'
  mockEntities['binary_sensor.thermostat_contact_sensors_away_mode_active'].state = 'off'
  mockEntities['sensor.thermostat_effective_home_away'].state = 'Home'
  mockEntities['sensor.thermostat_home_away_reason'].state = 'A resident is home, so TCS is using home behavior.'
  mockEntities['select.thermostat_contact_sensors_eco_behavior_when_away'].state = 'Keep Eco Active'
  mockEntities['switch.main_floor_vacuum_coordinator_pause'].state = 'off'
  mockEntities['switch.lv600s_humidifier_power'].state = 'on'
  mockEntities['switch.lv600s_humidifier_display'].state = 'on'
  mockEntities['select.lv600s_humidifier_mode'].state = 'Manual'
  mockEntities['number.lv600s_humidifier_target_humidity'].state = '100'
  mockEntities['number.lv600s_humidifier_mist_level'].state = '5'
  mockEntities['number.lv600s_humidifier_warm_level'].state = '1'
  mockEntities['number.lv600s_humidifier_timer_minutes'].state = '0'
  mockEntities['sensor.lv600s_humidifier_current_humidity'].state = '46'
  mockEntities['sensor.lv600s_humidifier_current_temperature'].state = '71.6'
  mockEntities['sensor.lv600s_humidifier_timer_remaining'].state = '0'
  mockEntities['binary_sensor.lv600s_humidifier_water_low'].state = 'off'
  mockEntities['binary_sensor.lv600s_humidifier_tank_removed'].state = 'off'
  mockEntities['binary_sensor.lv600s_humidifier_humidifying'].state = 'on'
  mockEntities['input_boolean.master_bedroom_humidifier_schedule_enabled'].state = 'off'
  mockHumidifierSchedule = emptyHumidifierSchedule()
  exposeMockHassDebugApi()
}

export const mockState: MockHassState = {
  config: {},
  connection: {
    sendMessagePromise: async <T,>(message: Record<string, unknown>) => {
      if (message.type === 'schedule/list') return [cloneRecord(mockHumidifierSchedule)] as T
      if (message.type === 'schedule/update') {
        mockScheduleMessages.push(cloneRecord(message))
        mockHumidifierSchedule = {
          id: String(message.schedule_id),
          name: String(message.name),
          icon: typeof message.icon === 'string' ? message.icon : undefined,
          sunday: cloneRecord(Array.isArray(message.sunday) ? message.sunday : []),
          monday: cloneRecord(Array.isArray(message.monday) ? message.monday : []),
          tuesday: cloneRecord(Array.isArray(message.tuesday) ? message.tuesday : []),
          wednesday: cloneRecord(Array.isArray(message.wednesday) ? message.wednesday : []),
          thursday: cloneRecord(Array.isArray(message.thursday) ? message.thursday : []),
          friday: cloneRecord(Array.isArray(message.friday) ? message.friday : []),
          saturday: cloneRecord(Array.isArray(message.saturday) ? message.saturday : []),
        }
        return cloneRecord(mockHumidifierSchedule) as T
      }
      if (message.type === 'todo/item/list') return todoItems(message.entity_id) as T
      if (message.type === 'todo/item/update') {
        mockTodoUpdateMessages.push(message)
        return {} as T
      }
      if (message.type === 'call_service' && message.domain === 'weather' && message.service === 'get_forecasts') {
        return { service_response: { 'weather.pirate_weather': { forecast: mockDailyWeatherForecast } } } as T
      }
      if (message.type === 'calendar/event/list') return { events: [] } as T
      return {} as T
    },
  },
  entities: mockEntities,
  hassUrl: 'http://mock-hass.local',
  helpers: {
    callService: (params) => {
      mockCallServiceCalls.push(params)
      applyMockCallServiceSideEffects(params)
      if (params.domain === 'weather' && params.service === 'get_forecasts' && params.returnResponse === true) {
        const forecast = (params.serviceData as { type?: string } | undefined)?.type === 'hourly' ? mockHourlyWeatherForecast : mockDailyWeatherForecast
        return Promise.resolve({ response: { 'weather.pirate_weather': { forecast } } })
      }
      if (params.domain === 'donetick' && params.service === 'get_task' && params.returnResponse === true) {
        const taskId = Number((params.serviceData as { task_id?: unknown } | undefined)?.task_id)
        const defaultTask: MockDonetickTask = {
          assignees: [1],
          assigned_to: 1,
          description: taskId === 1001 ? 'Mock task description' : '',
          frequency: 1,
          frequency_metadata: {},
          frequency_type: 'once',
          hide_on_vacation: true,
          id: taskId,
          name: taskId === 1002 ? 'Mock task two' : 'Mock task one',
          next_due_date: taskId === 1001 ? '2026-06-04T17:30:00+00:00' : null,
          priority: 4,
        }
        const response = { response: mockDonetickTasksById[taskId] ?? defaultTask }
        return mockDonetickTaskLoadDelayMs > 0
          ? new Promise((resolve) => window.setTimeout(() => resolve(response), mockDonetickTaskLoadDelayMs))
          : Promise.resolve(response)
      }
      if (params.domain === 'evershelf' && params.service === 'resolve_barcode' && params.returnResponse === true) {
        const barcode = (params.serviceData as { barcode?: string } | undefined)?.barcode
        return Promise.resolve({
          response: {
            barcode,
            found: true,
            product: { brand: 'Ferrero', id: 42, image_url: 'https://example.test/nutella.jpg', name: 'Nutella' },
            source: 'mock',
          },
        })
      }
      if (params.domain === 'evershelf' && params.service === 'prepare_scanned_product' && params.returnResponse === true) {
        const productId = Number((params.serviceData as { product_id?: unknown } | undefined)?.product_id)
        return Promise.resolve({
          response: {
            id: Number.isFinite(productId) && productId > 0 ? productId : 123,
            product_fingerprint: 'f'.repeat(64),
            success: true,
          },
        })
      }
      if (params.domain === 'evershelf' && params.service === 'suggest_location' && params.returnResponse === true) {
        return Promise.resolve({
          response: {
            confidence: 0.4,
            location: 'unknown',
            source: 'gemini',
            success: true,
          },
        })
      }
      if (params.domain === 'evershelf' && params.service === 'read_expiry_image' && params.returnResponse === true) {
        return Promise.resolve({
          response: {
            expiry_date: '2026-06-30',
            raw_text: 'EXP 06/30/2026',
            source: 'mock_ocr',
            success: true,
          },
        })
      }
      if (params.domain === 'evershelf' && params.service === 'recipe_query' && params.returnResponse === true) {
        const serviceData = params.serviceData as { cursor?: string; kind?: string; limit?: number; q?: string; sort?: string } | undefined
        if (serviceData?.kind === 'recommendations') {
          const recommendationCount = Math.max(1, Math.min(100, Number(serviceData.limit ?? 30)))
          return Promise.resolve({
            response: {
              kind: 'recommendations',
              recommendation_id: 'mock-recommendations',
              items: Array.from({ length: recommendationCount }, (_, index) => mockRecipeCard(
                index + 1,
                index === 0
                  ? 'Suggested Citrus Pantry Bowl with Roasted Garden Vegetables'
                  : `Suggested Recipe ${index + 1}`,
              )),
            },
          })
        }
        const offset = Number(serviceData?.cursor ?? 0)
        const query = serviceData?.q?.trim()
        const catalogTotal = configuredRecipeTotal()
        const pageSize = Math.max(0, Math.min(50, catalogTotal - offset))
        const items = Array.from({ length: pageSize }, (_, index) => {
          const id = 1_000 + offset + index
          return mockRecipeCard(id, query ? `${query} Recipe ${offset + index + 1}` : `Catalog Recipe ${offset + index + 1}`)
        })
        const nextOffset = offset + items.length
        const response = {
          response: {
            kind: 'browse',
            criteria_hash: `mock-criteria-${query ?? 'all'}`,
            snapshot_id: 'mock-snapshot',
            items,
            next_cursor: nextOffset < catalogTotal ? String(nextOffset) : null,
            has_more: nextOffset < catalogTotal,
            total: catalogTotal,
            ranking_status: 'ready',
            catalog_revision: 1,
            inventory_revision: 1,
          },
        }
        const delay = Math.max(
          mockRecipeQueryDelayMs,
          configuredRecipeQueryDelayMs(),
          serviceData?.cursor
            ? 250
            : serviceData?.sort && serviceData.sort !== 'availability'
              ? 1_200
              : 0,
        )
        return delay > 0
          ? new Promise((resolve) => window.setTimeout(() => resolve(response), delay))
          : Promise.resolve(response)
      }
      if (params.domain === 'evershelf' && params.service === 'recipe_hydration' && params.returnResponse === true) {
        const query = (params.serviceData as { query?: string } | undefined)?.query ?? 'Search'
        return Promise.resolve({
          response: {
            search_id: 'mock-search',
            status: 'complete',
            processed_count: 1,
            total_count: 1,
            progress: 100,
            exhausted: true,
            next_poll_ms: null,
            new_items: [mockRecipeCard(9_000, `${query} Remote Recipe`)],
          },
        })
      }
      if (params.domain === 'evershelf' && params.service === 'recipe_detail' && params.returnResponse === true) {
        const recipeId = Number((params.serviceData as { recipe_id?: unknown } | undefined)?.recipe_id)
        const response = { response: mockRecipeDetail(recipeId) }
        const delay = configuredRecipeDetailDelayMs()
        return delay > 0
          ? new Promise((resolve) => window.setTimeout(() => resolve(response), delay))
          : Promise.resolve(response)
      }
      if (params.domain === 'evershelf' && params.service === 'recipe_grocery_add' && params.returnResponse === true) {
        const serviceData = params.serviceData as {
          idempotency_key?: string
          recipe_id?: number
          selections?: { key?: string; position?: number }[]
        } | undefined
        const selections = Array.isArray(serviceData?.selections) ? serviceData.selections : []
        const partialFailure = typeof window !== 'undefined'
          && new URLSearchParams(window.location.search).get('__mockRecipeGroceryPartial') === 'true'
        const outcomes = selections.map((selection, index) => ({
          key: String(selection.key ?? ''),
          position: Number(selection.position ?? index),
          outcome: 'added',
          normalized_name: `Synthetic ingredient ${index + 1}`,
          amount_text: null,
        }))
        return Promise.resolve({
          response: {
            success: !partialFailure,
            partial_failure: partialFailure || undefined,
            recipe_id: serviceData?.recipe_id,
            idempotency_key: serviceData?.idempotency_key,
            replayed: false,
            outcomes,
            ha_mirror: {
              success: !partialFailure,
              todo_entity_id: 'todo.shopping_list',
              outcomes: outcomes.map((outcome, index) => ({
                key: outcome.key,
                position: outcome.position,
                name: outcome.normalized_name,
                backend_outcome: outcome.outcome,
                outcome: partialFailure && index === 0 ? 'failed' : 'added',
              })),
              summary: {
                added: partialFailure ? Math.max(0, outcomes.length - 1) : outcomes.length,
                already_present: 0,
                skipped: 0,
                failed: partialFailure && outcomes.length > 0 ? 1 : 0,
              },
            },
            summary: {
              backend: {
                added: outcomes.length,
                already_listed: 0,
                now_in_stock: 0,
                unresolved: 0,
                failed: 0,
              },
              ha_mirror: {
                added: partialFailure ? Math.max(0, outcomes.length - 1) : outcomes.length,
                already_present: 0,
                skipped: 0,
                failed: partialFailure && outcomes.length > 0 ? 1 : 0,
              },
            },
          },
        })
      }
      if (
        params.domain === 'evershelf'
        && (
          params.service === 'recipe_ingredient_override'
          || params.service === 'recipe_identity_feedback'
          || params.service === 'recipe_ingredient_decision'
          || params.service === 'recipe_planner_add'
        )
        && params.returnResponse === true
      ) {
        return Promise.resolve({
          response: {
            success: true,
            ...(params.serviceData as Record<string, unknown>),
          },
        })
      }
      if (params.domain === 'evershelf' && params.service === 'list_inventory' && params.returnResponse === true) {
        const location = (params.serviceData as { location?: string } | undefined)?.location
        const search = (params.serviceData as { q?: string } | undefined)?.q
        const fixtureInventory = mockInventoryItemsByLocation[location ?? 'all']
        if (fixtureInventory) {
          const normalizedSearch = search?.trim().toLocaleLowerCase()
          const inventory = normalizedSearch
            ? fixtureInventory.filter((item) => String(item.name ?? '').toLocaleLowerCase().includes(normalizedSearch))
            : fixtureInventory
          return Promise.resolve({
            response: {
              inventory: cloneRecord(inventory),
              ...(normalizedSearch ? { search: search?.trim(), source: 'ha_sensor_product_search' } : {}),
            },
          })
        }
        const fridgeInventory = [
          { expiry_date: mockDateOffset(370), id: 204, location: 'frigo', name: 'Salsa', product_id: 2004, unit: 'pz', vacuum_sealed: false },
          { expiry_date: mockDateOffset(-400), id: 205, location: 'frigo', name: 'Milk', product_id: 2005, unit: 'pz', vacuum_sealed: false },
          { expiry_date: mockDateOffset(5), id: 203, location: 'frigo', name: 'Greek Yogurt', product_id: 2003, quantity: 2, unit: 'pz', vacuum_sealed: false },
        ]
        const freezerInventory = [
          { expiry_date: mockDateOffset(190), id: 304, location: 'freezer', name: 'Waffles' },
          { expiry_date: mockDateOffset(20), id: 303, location: 'freezer', name: 'Frozen Peas' },
        ]
        const spiceRackInventory = [
          { expiry_date: mockDateOffset(400), id: 404, location: 'spice_rack', name: 'Cumin' },
          { expiry_date: mockDateOffset(4), id: 403, location: 'spice_rack', name: 'Paprika' },
        ]
        const cabinetInventory = [
          { expiry_date: mockDateOffset(6), id: 503, location: 'cabinet', name: 'Tea Bags' },
          { expiry_date: mockDateOffset(80), id: 504, location: 'cabinet', name: 'Paper Plates' },
        ]
        const pantryInventory = [
          { expiry_date: mockDateOffset(40), id: 103, location: 'dispensa', name: 'Ziti', product_id: 1003, unit: 'pz', vacuum_sealed: false },
          { expiry_date: mockDateOffset(3), id: 102, location: 'dispensa', name: 'Canned Beans', product_id: 1002, quantity: 1, unit: 'pz', vacuum_sealed: false },
          { expiry_date: mockDateOffset(3), id: 106, location: 'dispensa', name: 'Canned Beans', product_id: 1002, quantity: 1, unit: 'pz', vacuum_sealed: false },
          { expiry_date: mockDateOffset(200), id: 107, location: 'dispensa', name: 'Canned Beans', product_id: 1002, quantity: 3, unit: 'pz', vacuum_sealed: false },
          { expiry_date: mockDateOffset(-10), id: 101, location: 'dispensa', name: 'Almond Flour', product_id: 1001, unit: 'pz', vacuum_sealed: false },
        ]
        const inventory = location === 'frigo'
          ? fridgeInventory
          : location === 'freezer'
            ? freezerInventory
            : location === 'spice_rack'
              ? spiceRackInventory
              : location === 'cabinet'
                ? cabinetInventory
                : location
                  ? pantryInventory
                  : [...pantryInventory, ...fridgeInventory, ...freezerInventory, ...spiceRackInventory, ...cabinetInventory]
        // EverShelf's taxonomy search collapses a product's inventory rows into one aggregated entry
        // that only carries inventory_ids, so searches mirror that shape instead of returning rows.
        if (search?.trim().toLocaleLowerCase().includes('beans')) {
          return Promise.resolve({
            response: {
              inventory: [
                {
                  expiry_date: mockDateOffset(3),
                  inventory_count: 3,
                  inventory_id: null,
                  inventory_ids: [102, 106, 107],
                  location: 'dispensa',
                  name: 'Canned Beans',
                  product_id: 1002,
                  quantity: 5,
                  unit: 'pz',
                  vacuum_sealed: false,
                },
              ],
              search: search.trim(),
              source: 'ha_sensor_product_search',
            },
          })
        }
        return Promise.resolve({ response: { inventory } })
      }
      if (params.domain === 'evershelf' && params.service === 'add_scanned_item' && params.returnResponse === true) {
        const serviceData = params.serviceData as { name?: string } | undefined
        if (serviceData?.name === 'Fail Item') {
          return Promise.resolve({
            response: {
              message: 'Mock add failure',
              success: false,
            },
          })
        }
        return Promise.resolve({
          response: {
            inventory: {
              new_qty: 1,
              total_qty: 1,
              unit: 'pz',
            },
            product_id: 123,
            success: true,
          },
        })
      }
    },
    joinHassUrl: (path) => `http://mock-hass.local${path}`,
  },
  services: {
    script: {
      main_floor_vacuum_clean_zone: {},
      main_floor_vacuum_mop_dock_clean: {},
      main_floor_vacuum_mop_dock_dry: {},
      music_room_vacuum_clean_zone: {},
      music_room_vacuum_mop_dock_clean: {},
      music_room_vacuum_mop_dock_dry: {},
      theater_room_vacuum_clean_zone: {},
      theater_room_vacuum_mop_dock_clean: {},
      theater_room_vacuum_mop_dock_dry: {},
    },
    valetudo_vacuum_coordinator: {
      dock_action: {},
    },
  },
  user: { id: '64089b5683944c39b4f944c8f76830b0', is_admin: true, name: 'Stephen' },
}

exposeMockHassDebugApi()
