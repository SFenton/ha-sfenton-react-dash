export type HaRecord = Record<string, unknown>

export const MASTER_BEDROOM_PBL = {
  pbl: 'switch.master_bedroom_presence_master_bedroom_presence_allowed',
  light: 'light.master_bedroom',
  wakeLight: 'sensor.master_bedroom_wake_light',
  eligible: 'binary_sensor.master_bedroom_pbl_overnight_recovery_eligible',
  eligibleEntryId: '01M1A27N9QY9SA8Y5AQTW1ZJJ0',
  manualOffAt: 'input_datetime.master_bedroom_pbl_manual_off_at',
  bedPauseHelperId: 'master_bedroom_pbl_bed_pause_override_at',
  bedPause: 'input_text.master_bedroom_pbl_bed_pause_override_at',
  recoveryAutomationId: '1788118381307',
  evidenceAutomationId: '1792508000001',
  leftSide: 'binary_sensor.master_bedroom_sleepypod_eight_pod_left_bed_occupancy',
  rightSide: 'binary_sensor.master_bedroom_sleepypod_eight_pod_right_bed_occupancy',
  stephenHome: 'binary_sensor.household_journey_stephen_home',
  stephHome: 'binary_sensor.household_journey_steph_home',
} as const

const M = MASTER_BEDROOM_PBL

/** Bed-pause evidence stays usable for 18 hours so an evening pause cannot resume the following evening. */
export const BED_PAUSE_MAX_AGE_SECONDS = 18 * 3600
/** A PBL pause within this many seconds of a wake-light cancellation is the cancellation turning the lights off. */
export const WAKE_CANCELLATION_WINDOW_SECONDS = 60
export const ADAPTIVE_BED_CLEAR_UNTIL = '20:00:00'

export const ADAPTIVE_BRANCHES = {
  bothHome: 'Adaptive bed clear with both residents home',
  oneHome: 'Adaptive bed clear with exactly one resident home',
  allAway: 'Adaptive bed clear with everyone away',
} as const

export const bedPauseHelper = {
  domain: 'input_text',
  id: M.bedPauseHelperId,
  config: { name: 'Master Bedroom PBL Bed Pause Override At', min: 0, max: 100, mode: 'text', icon: 'mdi:bed-clock' },
} as const

export const ELIGIBILITY_STATE_TEMPLATE = [
  `{% set pbl = '${M.pbl}' %}`,
  `{% set override_raw = state_attr(pbl, 'external_override_at') %}`,
  '{% set override_ts = as_timestamp(override_raw, 0) %}',
  `{% set manual_off_ts = as_timestamp(states('${M.manualOffAt}'), 0) %}`,
  "{% set paused = is_state(pbl, 'on') and state_attr(pbl, 'automation_paused') == true and state_attr(pbl, 'external_override_policy') == 'pause' and override_ts > 0 %}",
  "{% set overnight = state_attr(pbl, 'external_override_source') in ['homekit_batch', 'homekit_single'] and override_ts >= as_timestamp(today_at('00:00') - timedelta(hours=2, minutes=30)) and override_ts <= as_timestamp(today_at('03:00')) and manual_off_ts <= override_ts %}",
  `{% set bed_pause = states('${M.bedPause}') == override_raw | string and 0 <= as_timestamp(now()) - override_ts <= ${BED_PAUSE_MAX_AGE_SECONDS} %}`,
  '{{ paused and (overnight or bed_pause) }}',
].join('')

const WAKE_CANCELLATION_TEMPLATE = [
  `{% set cancellation = state_attr('${M.wakeLight}', 'last_cancellation') %}`,
  `{% set override_ts = as_timestamp(state_attr('${M.pbl}', 'external_override_at'), 0) %}`,
  "{% set wake_ts = as_timestamp(cancellation.at if cancellation is mapping and cancellation.at is defined else none, 0) %}",
  `{{ override_ts > 0 and wake_ts > 0 and (override_ts - wake_ts) | abs <= ${WAKE_CANCELLATION_WINDOW_SECONDS} }}`,
].join('')

const sideInBed = (side: string, home: string): HaRecord => ({
  condition: 'and',
  conditions: [
    { condition: 'trigger', id: 'pause' },
    { condition: 'state', entity_id: side, state: 'on' },
    { condition: 'state', entity_id: home, state: 'on' },
  ],
})

export function bedPauseEvidenceAutomation(): HaRecord {
  return {
    id: M.evidenceAutomationId,
    alias: 'Master Bedroom PBL - Bed Pause Evidence',
    description: 'Records a master-bedroom PBL pause that began while a home resident occupied their SleepyPod side, or that a wake-light cancellation caused, so Daytime Recovery can restore PBL once the bed clears. Never controls a light.',
    triggers: [
      { trigger: 'state', entity_id: M.pbl, attribute: 'external_override_at', id: 'pause' },
      { trigger: 'state', entity_id: M.wakeLight, attribute: 'last_cancellation', id: 'wake_cancelled' },
    ],
    conditions: [
      { condition: 'state', entity_id: M.pbl, attribute: 'automation_paused', state: true },
      { condition: 'state', entity_id: M.pbl, attribute: 'external_override_policy', state: 'pause' },
      {
        condition: 'or',
        conditions: [
          sideInBed(M.leftSide, M.stephenHome),
          sideInBed(M.rightSide, M.stephHome),
          { condition: 'template', value_template: WAKE_CANCELLATION_TEMPLATE },
        ],
      },
    ],
    actions: [
      {
        action: 'input_text.set_value',
        target: { entity_id: M.bedPause },
        data: { value: `{{ state_attr('${M.pbl}', 'external_override_at') | string }}` },
      },
    ],
    mode: 'queued',
    max: 5,
  }
}

const LIGHT_GATE: HaRecord = {
  condition: 'or',
  conditions: [
    { condition: 'state', entity_id: M.light, state: 'off', for: { minutes: 5 } },
    { condition: 'state', entity_id: M.light, state: 'on', for: { minutes: 1 } },
  ],
}

const LEASE_GUARD: HaRecord = {
  condition: 'not',
  conditions: [
    { condition: 'state', entity_id: M.pbl, attribute: 'control_lease_state', state: ['active', 'recovering'] },
  ],
}

const sideClear = (side: string, home: string): HaRecord => ({
  condition: 'or',
  conditions: [
    { condition: 'state', entity_id: side, state: 'off', for: { seconds: 10 } },
    { condition: 'state', entity_id: home, state: 'off', for: { minutes: 5 } },
  ],
})

export const RECOVERY_DESCRIPTION = 'Restores the active master-bedroom PBL flow after an eligible pause: an overnight HomeKit bedroom-light pause, or any pause that began while a home resident was in bed or that a wake-light cancellation caused. The adaptive-bed path restores once every SleepyPod side is clear for 10 seconds (05:00-20:00); a side whose owner has been away for 5 minutes counts as clear. Existing all-away, attributed-room, shower, and PC/arrival paths remain fallbacks. The bedroom light must be off for five minutes or on for one minute with no active control lease, and recovery never directly controls a light.'

const clone = <T>(value: T): T => structuredClone(value)
const isRecord = (value: unknown): value is HaRecord => typeof value === 'object' && value !== null && !Array.isArray(value)
const canonical = (value: unknown): unknown => Array.isArray(value)
  ? value.map(canonical)
  : isRecord(value) ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value
/** Compares HA configs without depending on the key order Home Assistant stores. */
export const sameConfig = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
const same = sameConfig

function isLightOffGate(condition: HaRecord) {
  return condition.condition === 'state' && condition.entity_id === M.light && condition.state === 'off'
}

function isBothSidesClear(condition: HaRecord) {
  return condition.condition === 'state' && same(condition.entity_id, [M.leftSide, M.rightSide]) && condition.state === 'off'
}

/** Applies the bed-clear recovery fixes to the live Daytime Recovery automation; idempotent, and throws on unexpected drift. */
export function patchDaytimeRecovery(source: HaRecord): HaRecord {
  const config = clone(source)
  if (config.id !== M.recoveryAutomationId) throw new Error('Unexpected Daytime Recovery automation id.')
  const conditions = config.conditions
  if (!Array.isArray(conditions)) throw new Error('Daytime Recovery has no global conditions.')
  const gateIndex = conditions.findIndex((condition) => isRecord(condition) && (isLightOffGate(condition) || same(condition, LIGHT_GATE)))
  if (gateIndex < 0) throw new Error('Daytime Recovery light gate drifted.')
  conditions[gateIndex] = clone(LIGHT_GATE)
  if (!conditions.some((condition) => same(condition, LEASE_GUARD))) conditions.splice(gateIndex + 1, 0, clone(LEASE_GUARD))

  const choose = (config.actions as HaRecord[] | undefined)?.[0]?.choose
  if (!Array.isArray(choose)) throw new Error('Daytime Recovery choose block drifted.')
  for (const alias of Object.values(ADAPTIVE_BRANCHES)) {
    const branch = choose.find((option) => isRecord(option) && option.alias === alias) as HaRecord | undefined
    const branchConditions = branch?.conditions
    if (!Array.isArray(branchConditions)) throw new Error(`Daytime Recovery branch drifted: ${alias}.`)
    const time = branchConditions.find((condition) => isRecord(condition) && condition.condition === 'time') as HaRecord | undefined
    if (!time || time.after !== '05:00:00') throw new Error(`Daytime Recovery window drifted: ${alias}.`)
    time.before = ADAPTIVE_BED_CLEAR_UNTIL
    if (alias === ADAPTIVE_BRANCHES.bothHome) {
      if (!branchConditions.some((condition) => isRecord(condition) && isBothSidesClear(condition))) {
        throw new Error('Daytime Recovery both-home bed condition drifted.')
      }
      continue
    }
    const sidesIndex = branchConditions.findIndex((condition) => isRecord(condition) && isBothSidesClear(condition))
    const perSide: HaRecord = { condition: 'and', conditions: [sideClear(M.leftSide, M.stephenHome), sideClear(M.rightSide, M.stephHome)] }
    if (sidesIndex >= 0) branchConditions[sidesIndex] = perSide
    else if (!branchConditions.some((condition) => same(condition, perSide))) throw new Error(`Daytime Recovery bed condition drifted: ${alias}.`)
  }
  config.description = RECOVERY_DESCRIPTION
  return config
}

/** Returns the template options-flow input that installs the extended eligibility state. */
export function eligibilityOptions(current: HaRecord): HaRecord {
  if (current.template_type !== 'binary_sensor') throw new Error('Eligibility helper is not a binary_sensor template.')
  const state = String(current.state ?? '')
  if (state !== ELIGIBILITY_STATE_TEMPLATE && !state.includes("external_override_source') in ['homekit_batch', 'homekit_single']")) {
    throw new Error('Eligibility template drifted.')
  }
  return { ...clone(current), state: ELIGIBILITY_STATE_TEMPLATE }
}
