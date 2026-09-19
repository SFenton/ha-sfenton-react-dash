export type HaRecord = Record<string, unknown>
export type HotFlashSide = 'left' | 'right'
export type HotFlashAction = 'activate' | 'cancel' | 'power_heat' | 'power_off' | 'reconcile' | 'target'
export type HotFlashReportKind = 'climate' | 'deadline' | 'reload' | 'startup' | 'target' | 'temperature' | 'timer' | 'watchdog'

export interface HotFlashRequestedBy {
  left: string
  right: string
}

export const HOT_FLASH = {
  brokerId: 'sleepypod_hot_flash_broker',
  broker: 'script.sleepypod_hot_flash_broker',
  sides: {
    left: {
      climate: 'climate.sleepypod_eight_pod_left_side',
      currentTemperature: 'sensor.nightcanvasrestful_left_current_temperature',
      target: 'number.master_bedroom_sleepypod_eight_pod_left_target_level',
      activate: 'input_button.eight_sleep_stephen_hot_flash',
      cancel: 'input_button.eight_sleep_stephen_cancel_hot_flash',
      schedulePhase: 'sensor.sleepypod_stephen_schedule_phase',
    },
    right: {
      climate: 'climate.sleepypod_eight_pod_right_side',
      currentTemperature: 'sensor.nightcanvasrestful_right_current_temperature',
      target: 'number.master_bedroom_sleepypod_eight_pod_right_target_level',
      activate: 'input_button.eight_sleep_steph_hot_flash',
      cancel: 'input_button.eight_sleep_steph_cancel_hot_flash',
      schedulePhase: 'sensor.sleepypod_steph_schedule_phase',
    },
  },
  helpers: {
    leftPhase: 'input_select.sleepypod_hot_flash_left_phase',
    leftTargetPayload: 'input_number.sleepypod_hot_flash_left_target_payload',
    leftRestoreAt: 'input_datetime.sleepypod_hot_flash_left_restore_at',
    leftTimer: 'timer.sleepypod_hot_flash_left',
    rightPhase: 'input_select.sleepypod_hot_flash_right_phase',
    rightTargetPayload: 'input_number.sleepypod_hot_flash_right_target_payload',
    rightRestoreAt: 'input_datetime.sleepypod_hot_flash_right_restore_at',
    rightTimer: 'timer.sleepypod_hot_flash_right',
    sharedPhase: 'input_select.sleepypod_hot_flash_shared_phase',
    baselineMode: 'input_select.sleepypod_hot_flash_baseline_mode',
    desiredMode: 'input_select.sleepypod_hot_flash_desired_mode',
  },
  legacy: {
    leftActive: 'input_boolean.eight_sleep_stephen_hot_flash_active',
    rightActive: 'input_boolean.eight_sleep_steph_hot_flash_active',
    leftRequestedBy: 'input_text.eight_sleep_stephen_hot_flash_requested_by',
    rightRequestedBy: 'input_text.eight_sleep_steph_hot_flash_requested_by',
  },
} as const

export const HOT_FLASH_SIDE_PHASES = ['idle', 'cooling', 'holding', 'restore_pending', 'superseded'] as const
export const HOT_FLASH_SHARED_PHASES = ['idle', 'leased', 'restore_pending'] as const
export const HOT_FLASH_MODES = ['heat', 'off'] as const

export const HOT_FLASH_TRANSITION_CONTRACT = [
  { from: 'idle', event: 'activate', to: 'cooling', obligation: 'Persist the selected side target and the fixed activation-plus-45-minute ceiling before device commands.' },
  { from: 'cooling', event: 'first report below -9.5 and 56F', to: 'holding', obligation: 'Set a non-extending deadline at min(first qualification plus 15 minutes, activation ceiling).' },
  { from: 'cooling|holding', event: 'cancel or deadline', to: 'restore_pending', obligation: 'Keep the saved target durable until the target entity confirms it.' },
  { from: 'cooling|holding|restore_pending', event: 'new owned target intent', to: 'superseded', obligation: 'Invalidate the old restore target and retry only the newer target.' },
  { from: 'restore_pending|superseded', event: 'matching target report', to: 'idle', obligation: 'Clear the legacy active projection only after confirmation.' },
  { from: 'leased', event: 'last active side leaves', to: 'restore_pending', obligation: 'Restore the latest bed-wide intent only after all side target obligations resolve.' },
  { from: 'restore_pending', event: 'both climates confirm desired mode', to: 'idle', obligation: 'Never treat a service call as mode confirmation.' },
] as const

export interface ManagedHelper {
  domain: 'input_datetime' | 'input_number' | 'input_select' | 'timer'
  id: string
  config: HaRecord
}

const helper = (entity: string, name: string, config: HaRecord = {}): ManagedHelper => ({
  domain: entity.split('.')[0] as ManagedHelper['domain'],
  id: entity.split('.')[1],
  config: { name, ...config },
})

export const hotFlashHelpers: ManagedHelper[] = [
  helper(HOT_FLASH.helpers.leftPhase, 'SleepyPod Hot Flash Left Phase', { options: [...HOT_FLASH_SIDE_PHASES] }),
  helper(HOT_FLASH.helpers.leftTargetPayload, 'SleepyPod Hot Flash Left Target Payload', { min: -10, max: 10, step: 1, mode: 'box' }),
  helper(HOT_FLASH.helpers.leftRestoreAt, 'SleepyPod Hot Flash Left Restore At', { has_date: true, has_time: true }),
  helper(HOT_FLASH.helpers.leftTimer, 'SleepyPod Hot Flash Left', { duration: '00:15:00', restore: true }),
  helper(HOT_FLASH.helpers.rightPhase, 'SleepyPod Hot Flash Right Phase', { options: [...HOT_FLASH_SIDE_PHASES] }),
  helper(HOT_FLASH.helpers.rightTargetPayload, 'SleepyPod Hot Flash Right Target Payload', { min: -10, max: 10, step: 1, mode: 'box' }),
  helper(HOT_FLASH.helpers.rightRestoreAt, 'SleepyPod Hot Flash Right Restore At', { has_date: true, has_time: true }),
  helper(HOT_FLASH.helpers.rightTimer, 'SleepyPod Hot Flash Right', { duration: '00:15:00', restore: true }),
  helper(HOT_FLASH.helpers.sharedPhase, 'SleepyPod Hot Flash Shared Phase', { options: [...HOT_FLASH_SHARED_PHASES] }),
  helper(HOT_FLASH.helpers.baselineMode, 'SleepyPod Hot Flash Baseline Mode', { options: [...HOT_FLASH_MODES] }),
  helper(HOT_FLASH.helpers.desiredMode, 'SleepyPod Hot Flash Desired Mode', { options: [...HOT_FLASH_MODES] }),
]

const service = (action: string, entityId?: string, data?: HaRecord): HaRecord => ({
  action,
  ...(entityId ? { target: { entity_id: entityId } } : {}),
  ...(data ? { data } : {}),
})
const template = (value: string): HaRecord => ({ condition: 'template', value_template: `{{ ${value} }}` })
const state = (entityId: string, value: string | string[]): HaRecord => ({ condition: 'state', entity_id: entityId, state: value })
const persist = () => service('homeassistant.save_persistent_states')
const side = (which: HotFlashSide) => HOT_FLASH.sides[which]
const otherSide = (which: HotFlashSide): HotFlashSide => which === 'left' ? 'right' : 'left'
const sideHelper = (which: HotFlashSide) => ({
  phase: HOT_FLASH.helpers[`${which}Phase` as 'leftPhase' | 'rightPhase'],
  targetPayload: HOT_FLASH.helpers[`${which}TargetPayload` as 'leftTargetPayload' | 'rightTargetPayload'],
  restoreAt: HOT_FLASH.helpers[`${which}RestoreAt` as 'leftRestoreAt' | 'rightRestoreAt'],
  timer: HOT_FLASH.helpers[`${which}Timer` as 'leftTimer' | 'rightTimer'],
})
const legacyProjection = (which: HotFlashSide) => ({
  active: which === 'left' ? HOT_FLASH.legacy.leftActive : HOT_FLASH.legacy.rightActive,
  requestedBy: which === 'left' ? HOT_FLASH.legacy.leftRequestedBy : HOT_FLASH.legacy.rightRequestedBy,
})
const sidePhase = (which: HotFlashSide, values: string | string[]) => state(sideHelper(which).phase, values)
const targetAvailableExpression = (which: HotFlashSide) => `states('${side(which).target}') not in ['unknown', 'unavailable']`
const climatesAvailableExpression = () => (
  `states('${side('left').climate}') not in ['unknown', 'unavailable'] and `
  + `states('${side('right').climate}') not in ['unknown', 'unavailable']`
)
const targetAvailable = (which: HotFlashSide) => template(targetAvailableExpression(which))
const climatesAvailable = () => template(climatesAvailableExpression())
const activeMemberExpression = (which: HotFlashSide) => `states('${sideHelper(which).phase}') in ['cooling', 'holding']`
const noActiveMembersExpression = () => `not (${activeMemberExpression('left')}) and not (${activeMemberExpression('right')})`
const recentAdmissionExpression = () => (
  `(${activeMemberExpression('left')} and `
  + `(state_attr('${sideHelper('left').restoreAt}', 'timestamp') | float(0)) > (as_timestamp(now()) + 2640)) or `
  + `(${activeMemberExpression('right')} and `
  + `(state_attr('${sideHelper('right').restoreAt}', 'timestamp') | float(0)) > (as_timestamp(now()) + 2640))`
)
const noSideObligationsExpression = () => (
  `states('${sideHelper('left').phase}') == 'idle' and states('${sideHelper('right').phase}') == 'idle'`
)
const desiredModeConfirmedExpression = () => (
  `states('${side('left').climate}') == states('${HOT_FLASH.helpers.desiredMode}') and `
  + `states('${side('right').climate}') == states('${HOT_FLASH.helpers.desiredMode}')`
)
const targetMatchesPayloadExpression = (which: HotFlashSide) => (
  `states('${side(which).target}') not in ['unknown', 'unavailable'] and `
  + `(states('${side(which).target}') | float(99)) == (states('${sideHelper(which).targetPayload}') | float(98))`
)

const directBrokerCall = (
  action: HotFlashAction,
  sideName: HotFlashSide | 'shared',
  extra: HaRecord = {},
) => service(HOT_FLASH.broker, undefined, { action, side: sideName, ...extra })

function logDeferred(message: string) {
  return service('logbook.log', undefined, {
    name: 'SleepyPod Hot Flash',
    message,
  })
}

function tryTargetCommand(which: HotFlashSide, value: string | number) {
  return {
    if: [targetAvailable(which)],
    then: [
      service('number.set_value', side(which).target, { value }),
    ],
    else: [logDeferred(`${which} target delivery remains pending because the target entity is unavailable.`)],
  }
}

function tryDesiredModeCommand() {
  return {
    if: [climatesAvailable()],
    then: [
      service('climate.set_hvac_mode', side('left').climate, { hvac_mode: `{{ states('${HOT_FLASH.helpers.desiredMode}') }}` }),
      service('climate.set_hvac_mode', side('right').climate, { hvac_mode: `{{ states('${HOT_FLASH.helpers.desiredMode}') }}` }),
    ],
    else: [logDeferred('Bed-wide mode delivery remains pending because one or both climate entities are unavailable.')],
  }
}

function confirmSide(which: HotFlashSide) {
  const helperSet = sideHelper(which)
  const projection = legacyProjection(which)
  return {
    if: [
      sidePhase(which, ['restore_pending', 'superseded']),
      template(targetMatchesPayloadExpression(which)),
    ],
    then: [
      service('input_select.select_option', helperSet.phase, { option: 'idle' }),
      service('input_boolean.turn_off', projection.active),
      persist(),
    ],
  }
}

function markSideDue(which: HotFlashSide) {
  const helperSet = sideHelper(which)
  return {
    if: [
      sidePhase(which, ['cooling', 'holding']),
      template(`as_timestamp(now()) >= (state_attr('${helperSet.restoreAt}', 'timestamp') | float(0))`),
    ],
    then: [
      service('input_select.select_option', helperSet.phase, { option: 'restore_pending' }),
      service('timer.cancel', helperSet.timer),
      persist(),
    ],
  }
}

function handleTargetConflict(which: HotFlashSide) {
  const current = side(which)
  const helperSet = sideHelper(which)
  const projection = legacyProjection(which)
  const other = otherSide(which)
  const expected = (
    `states('${helperSet.phase}') in ['cooling', 'holding'] and `
    + `(states('${current.target}') | float(99)) != -10 and not (${recentAdmissionExpression()})`
  )
  return {
    if: [
      template(`report_kind == 'target' and report_side == '${which}'`),
      template("from_state_name not in ['', 'unknown', 'unavailable']"),
      targetAvailable(which),
      template(expected),
    ],
    then: [
      service('input_number.set_value', helperSet.targetPayload, { value: `{{ states('${current.target}') | float }}` }),
      service('input_select.select_option', helperSet.phase, { option: 'idle' }),
      service('timer.cancel', helperSet.timer),
      service('input_boolean.turn_off', projection.active),
      service('input_select.select_option', HOT_FLASH.helpers.baselineMode, { option: 'heat' }),
      service('input_select.select_option', HOT_FLASH.helpers.desiredMode, { option: 'heat' }),
      service('input_select.select_option', HOT_FLASH.helpers.sharedPhase, {
        option: `{{ 'leased' if ${activeMemberExpression(other)} else 'restore_pending' }}`,
      }),
      persist(),
    ],
  }
}

function startHoldIfQualified(which: HotFlashSide) {
  const current = side(which)
  const helperSet = sideHelper(which)
  const deadline = (
    `[state_attr('${helperSet.restoreAt}', 'timestamp') | float(0), as_timestamp(now()) + 900] | min`
  )
  return {
    if: [
      sidePhase(which, 'cooling'),
      template(`states('${current.target}') | float(99) < -9.5`),
      template(`state_attr('${current.climate}', 'current_temperature') | float(999) < 56`),
    ],
    then: [
      service('input_datetime.set_datetime', helperSet.restoreAt, { timestamp: `{{ (${deadline}) | int }}` }),
      service('input_select.select_option', helperSet.phase, { option: 'holding' }),
      service('timer.start', helperSet.timer, {
        duration: `{{ [1, ((${deadline}) - as_timestamp(now())) | int] | max }}`,
      }),
      persist(),
    ],
  }
}

function retrySide(which: HotFlashSide) {
  const current = side(which)
  const helperSet = sideHelper(which)
  return [
    {
      if: [
        sidePhase(which, ['cooling', 'holding']),
        targetAvailable(which),
        template(`states('${current.target}') | float(99) != -10`),
      ],
      then: [service('number.set_value', current.target, { value: -10 })],
    },
    {
      if: [
        sidePhase(which, ['restore_pending', 'superseded']),
        targetAvailable(which),
        template(`not (${targetMatchesPayloadExpression(which)})`),
      ],
      then: [service('number.set_value', current.target, { value: `{{ states('${helperSet.targetPayload}') | float }}` })],
    },
  ]
}

function reconcileShared() {
  return [
    {
      if: [
        state(HOT_FLASH.helpers.sharedPhase, 'leased'),
        template(noActiveMembersExpression()),
      ],
      then: [
        service('input_select.select_option', HOT_FLASH.helpers.desiredMode, {
          option: `{{ states('${HOT_FLASH.helpers.baselineMode}') }}`,
        }),
        service('input_select.select_option', HOT_FLASH.helpers.sharedPhase, { option: 'restore_pending' }),
        persist(),
      ],
    },
    {
      if: [
        state(HOT_FLASH.helpers.sharedPhase, 'leased'),
        template(`not (${desiredModeConfirmedExpression()})`),
      ],
      then: [tryDesiredModeCommand()],
    },
    {
      if: [
        state(HOT_FLASH.helpers.sharedPhase, 'restore_pending'),
        template(noSideObligationsExpression()),
        template(`not (${desiredModeConfirmedExpression()})`),
      ],
      then: [tryDesiredModeCommand()],
    },
    {
      if: [
        state(HOT_FLASH.helpers.sharedPhase, 'restore_pending'),
        template(noSideObligationsExpression()),
        template(desiredModeConfirmedExpression()),
      ],
      then: [
        service('input_select.select_option', HOT_FLASH.helpers.sharedPhase, { option: 'idle' }),
        persist(),
      ],
    },
  ]
}

function reconcileAll() {
  return [
    markSideDue('left'),
    markSideDue('right'),
    handleTargetConflict('left'),
    handleTargetConflict('right'),
    confirmSide('left'),
    confirmSide('right'),
    startHoldIfQualified('left'),
    startHoldIfQualified('right'),
    ...retrySide('left'),
    ...retrySide('right'),
    ...reconcileShared(),
  ]
}

function activateSide(which: HotFlashSide) {
  const current = side(which)
  const helperSet = sideHelper(which)
  const projection = legacyProjection(which)
  const firstLeaseAdmission = (
    `states('${HOT_FLASH.helpers.sharedPhase}') != 'idle' or (`
    + `states('${side('left').climate}') == states('${side('right').climate}') and `
    + `states('${side('left').climate}') in ['heat', 'off'])`
  )
  return [
    {
      if: [sidePhase(which, ['cooling', 'holding'])],
      then: [{ stop: `${which} Hot Flash is already active; duplicate activation is idempotent.` }],
    },
    {
      if: [template(`states('${helperSet.phase}') != 'idle'`)],
      then: [{ stop: `${which} Hot Flash has an unresolved target obligation.` }],
    },
    {
      if: [state(HOT_FLASH.helpers.sharedPhase, 'restore_pending')],
      then: [{ stop: 'Bed-wide Hot Flash finalization is still pending.' }],
    },
    {
      if: [template(`not (${firstLeaseAdmission})`)],
      then: [{ stop: 'First Hot Flash activation requires coherent heat or off climate state.' }],
    },
    {
      if: [template(`not (${targetAvailableExpression(which)})`)],
      then: [{ stop: `${which} target is unavailable; activation made no changes.` }],
    },
    {
      if: [template(`not (${climatesAvailableExpression()})`)],
      then: [{ stop: 'Both climate entities must be available before activation.' }],
    },
    service('input_number.set_value', helperSet.targetPayload, { value: `{{ states('${current.target}') | float }}` }),
    service('input_datetime.set_datetime', helperSet.restoreAt, { timestamp: '{{ (as_timestamp(now()) + 2700) | int }}' }),
    service('input_select.select_option', helperSet.phase, { option: 'cooling' }),
    service('input_boolean.turn_on', projection.active),
    service('input_text.set_value', projection.requestedBy, { value: '{{ requested_by_name }}' }),
    {
      if: [state(HOT_FLASH.helpers.sharedPhase, 'idle')],
      then: [
        service('input_select.select_option', HOT_FLASH.helpers.baselineMode, {
          option: `{{ states('${side('left').climate}') }}`,
        }),
        service('input_select.select_option', HOT_FLASH.helpers.desiredMode, { option: 'heat' }),
        service('input_select.select_option', HOT_FLASH.helpers.sharedPhase, { option: 'leased' }),
      ],
    },
    persist(),
    service('climate.set_hvac_mode', side('left').climate, { hvac_mode: 'heat' }),
    service('climate.set_hvac_mode', side('right').climate, { hvac_mode: 'heat' }),
    service('number.set_value', current.target, { value: -10 }),
  ]
}

function cancelSide(which: HotFlashSide) {
  const helperSet = sideHelper(which)
  return [
    {
      if: [template(`states('${helperSet.phase}') not in ['cooling', 'holding']`)],
      then: [{ stop: `${which} Hot Flash is not active.` }],
    },
    service('input_select.select_option', helperSet.phase, { option: 'restore_pending' }),
    service('timer.cancel', helperSet.timer),
    persist(),
    tryTargetCommand(which, `{{ states('${helperSet.targetPayload}') | float }}`),
    ...reconcileShared(),
  ]
}

function setTargetIntent(which: HotFlashSide) {
  const current = side(which)
  const helperSet = sideHelper(which)
  const projection = legacyProjection(which)
  const other = otherSide(which)
  return [
    {
      if: [
        sidePhase(which, 'idle'),
        targetAvailable(which),
        template(`states('${current.target}') | float(99) == requested_level`),
      ],
      then: [{ stop: `${which} target already matches the requested level.` }],
    },
    service('input_number.set_value', helperSet.targetPayload, { value: '{{ requested_level }}' }),
    service('input_select.select_option', helperSet.phase, { option: 'superseded' }),
    service('timer.cancel', helperSet.timer),
    service('input_boolean.turn_off', projection.active),
    service('input_select.select_option', HOT_FLASH.helpers.baselineMode, { option: 'heat' }),
    service('input_select.select_option', HOT_FLASH.helpers.desiredMode, { option: 'heat' }),
    service('input_select.select_option', HOT_FLASH.helpers.sharedPhase, {
      option: `{{ 'leased' if ${activeMemberExpression(other)} else 'restore_pending' }}`,
    }),
    persist(),
    tryTargetCommand(which, '{{ requested_level }}'),
    ...reconcileShared(),
  ]
}

function setPowerOffIntent() {
  return [
    service('input_select.select_option', HOT_FLASH.helpers.baselineMode, { option: 'off' }),
    service('input_select.select_option', HOT_FLASH.helpers.desiredMode, { option: 'off' }),
    service('input_select.select_option', HOT_FLASH.helpers.sharedPhase, { option: 'restore_pending' }),
    {
      if: [sidePhase('left', ['cooling', 'holding'])],
      then: [
        service('input_select.select_option', sideHelper('left').phase, { option: 'restore_pending' }),
        service('timer.cancel', sideHelper('left').timer),
      ],
    },
    {
      if: [sidePhase('right', ['cooling', 'holding'])],
      then: [
        service('input_select.select_option', sideHelper('right').phase, { option: 'restore_pending' }),
        service('timer.cancel', sideHelper('right').timer),
      ],
    },
    persist(),
    ...reconcileAll(),
  ]
}

function setPowerHeatIntent() {
  return [
    service('input_select.select_option', HOT_FLASH.helpers.baselineMode, { option: 'heat' }),
    service('input_select.select_option', HOT_FLASH.helpers.desiredMode, { option: 'heat' }),
    service('input_select.select_option', HOT_FLASH.helpers.sharedPhase, {
      option: `{{ 'leased' if (${activeMemberExpression('left')}) or (${activeMemberExpression('right')}) else 'restore_pending' }}`,
    }),
    persist(),
    ...reconcileAll(),
  ]
}

function adoptExternalClimateIntent() {
  return {
    if: [
      template("report_kind == 'climate' and from_state_name not in ['', 'unknown', 'unavailable']"),
      template('from_state_name != to_state_name'),
      template(`states('${HOT_FLASH.helpers.sharedPhase}') != 'restore_pending'`),
      template(
        `to_state_name in ['heat', 'off'] and states('${side('left').climate}') == to_state_name and `
        + `states('${side('right').climate}') == to_state_name and states('${HOT_FLASH.helpers.desiredMode}') != to_state_name`,
      ),
    ],
    then: [
      service('input_select.select_option', HOT_FLASH.helpers.baselineMode, { option: '{{ to_state_name }}' }),
      service('input_select.select_option', HOT_FLASH.helpers.desiredMode, { option: '{{ to_state_name }}' }),
      {
        if: [template("to_state_name == 'off'")],
        then: [
          service('input_select.select_option', HOT_FLASH.helpers.sharedPhase, { option: 'restore_pending' }),
          {
            if: [sidePhase('left', ['cooling', 'holding'])],
            then: [
              service('input_select.select_option', sideHelper('left').phase, { option: 'restore_pending' }),
              service('timer.cancel', sideHelper('left').timer),
            ],
          },
          {
            if: [sidePhase('right', ['cooling', 'holding'])],
            then: [
              service('input_select.select_option', sideHelper('right').phase, { option: 'restore_pending' }),
              service('timer.cancel', sideHelper('right').timer),
            ],
          },
        ],
        else: [
          service('input_select.select_option', HOT_FLASH.helpers.sharedPhase, {
            option: `{{ 'leased' if (${activeMemberExpression('left')}) or (${activeMemberExpression('right')}) else 'restore_pending' }}`,
          }),
        ],
      },
      persist(),
    ],
  }
}

export function hotFlashBroker(): HaRecord {
  return {
    alias: 'SleepyPod Hot Flash recovery broker',
    description: 'Queued Home Assistant owner for per-side Hot Flash targets, fixed deadlines, shared HVAC intent, and outage recovery.',
    mode: 'queued',
    max: 100,
    max_exceeded: 'error',
    fields: {
      action: { required: true, selector: { text: {} } },
      side: { required: false, selector: { text: {} } },
      level: { required: false, selector: { number: { min: -10, max: 10, step: 1 } } },
      requested_by: { required: false, selector: { text: {} } },
      report_kind: { required: false, selector: { text: {} } },
      from_state: { required: false, selector: { text: {} } },
      to_state: { required: false, selector: { text: {} } },
    },
    sequence: [
      {
        variables: {
          action_name: "{{ action | default('') }}",
          which: "{{ side | default('shared') }}",
          requested_level: '{{ level | default(99) | float(99) }}',
          requested_by_name: "{{ requested_by | default('') }}",
          report_kind: "{{ report_kind | default('watchdog') }}",
          report_side: "{{ side | default('shared') }}",
          from_state_name: "{{ from_state | default('') }}",
          to_state_name: "{{ to_state | default('') }}",
        },
      },
      {
        if: [
          template("action_name == 'target' and (requested_level < -10 or requested_level > 10)"),
        ],
        then: [{ stop: 'SleepyPod target must be between -10 and +10.' }],
      },
      {
        choose: [
          { conditions: [template("action_name == 'activate' and which == 'left'")], sequence: activateSide('left') },
          { conditions: [template("action_name == 'activate' and which == 'right'")], sequence: activateSide('right') },
          { conditions: [template("action_name == 'cancel' and which == 'left'")], sequence: cancelSide('left') },
          { conditions: [template("action_name == 'cancel' and which == 'right'")], sequence: cancelSide('right') },
          { conditions: [template("action_name == 'target' and which == 'left'")], sequence: setTargetIntent('left') },
          { conditions: [template("action_name == 'target' and which == 'right'")], sequence: setTargetIntent('right') },
          { conditions: [template("action_name == 'power_off'")], sequence: setPowerOffIntent() },
          { conditions: [template("action_name == 'power_heat'")], sequence: setPowerHeatIntent() },
          {
            conditions: [template("action_name == 'reconcile'")],
            sequence: [
              adoptExternalClimateIntent(),
              ...reconcileAll(),
            ],
          },
        ],
        default: [{ stop: 'Unsupported SleepyPod Hot Flash broker action.' }],
      },
    ],
  }
}

interface TargetWrapper {
  id: string
  owner: 'steph' | 'stephen'
  phase: 'asleep' | 'bedtime' | 'dawn' | 'outside_schedule' | 'tonight'
  side: HotFlashSide
}

export const HOT_FLASH_TARGET_WRAPPERS: readonly TargetWrapper[] = [
  { id: 'sleepypod_stephen_temperature_tonight', owner: 'stephen', phase: 'tonight', side: 'left' },
  { id: 'sleepypod_stephen_temperature_outside_schedule', owner: 'stephen', phase: 'outside_schedule', side: 'left' },
  { id: 'sleepypod_stephen_bedtime_temperature_all_nights', owner: 'stephen', phase: 'bedtime', side: 'left' },
  { id: 'sleepypod_stephen_asleep_temperature_all_nights', owner: 'stephen', phase: 'asleep', side: 'left' },
  { id: 'sleepypod_stephen_dawn_temperature_all_nights', owner: 'stephen', phase: 'dawn', side: 'left' },
  { id: 'sleepypod_steph_temperature_tonight', owner: 'steph', phase: 'tonight', side: 'right' },
  { id: 'sleepypod_steph_temperature_outside_schedule', owner: 'steph', phase: 'outside_schedule', side: 'right' },
  { id: 'sleepypod_steph_bedtime_temperature_all_nights', owner: 'steph', phase: 'bedtime', side: 'right' },
  { id: 'sleepypod_steph_asleep_temperature_all_nights', owner: 'steph', phase: 'asleep', side: 'right' },
  { id: 'sleepypod_steph_dawn_temperature_all_nights', owner: 'steph', phase: 'dawn', side: 'right' },
] as const

function referenceTargetScript(wrapper: TargetWrapper): HaRecord {
  const current = side(wrapper.side)
  const titleOwner = wrapper.owner[0].toUpperCase() + wrapper.owner.slice(1)
  const stageEntity = wrapper.phase === 'tonight' || wrapper.phase === 'outside_schedule'
    ? null
    : `input_number.eight_sleep_${wrapper.owner}_${wrapper.phase}_level`
  const guard = wrapper.phase === 'tonight'
    ? state(current.schedulePhase, ['bedtime', 'asleep', 'dawn'])
    : wrapper.phase === 'outside_schedule'
      ? state(current.schedulePhase, 'outside')
      : state(current.schedulePhase, wrapper.phase)
  const label = wrapper.phase === 'outside_schedule'
    ? 'Outside Schedule'
    : wrapper.phase === 'tonight'
      ? 'Tonight'
      : `${wrapper.phase[0].toUpperCase()}${wrapper.phase.slice(1)} All Nights`
  return {
    alias: `SleepyPod ${titleOwner} Temperature ${label}`,
    mode: 'restart',
    fields: {
      level: {
        name: 'Target level',
        required: true,
        selector: { number: { min: -10, max: 10, step: 1 } },
      },
    },
    sequence: [
      guard,
      ...(stageEntity ? [service('input_number.set_value', stageEntity, { value: '{{ level }}' })] : []),
      service('number.set_value', current.target, { value: '{{ level }}' }),
    ],
  }
}

function matchesStateGuard(value: unknown, entityId: string, expectedState: string | string[]) {
  if (!value || typeof value !== 'object') return false
  const record = value as HaRecord
  return record.condition === 'state'
    && record.entity_id === entityId
    && JSON.stringify(record.state) === JSON.stringify(expectedState)
}

function matchesRecurringWrite(value: unknown, entityId: string) {
  if (!value || typeof value !== 'object') return false
  const record = value as HaRecord
  const target = record.target as HaRecord | undefined
  const data = record.data as HaRecord | undefined
  return record.action === 'input_number.set_value'
    && target?.entity_id === entityId
    && data?.value === '{{ level }}'
}

function matchesCurrentTargetWrite(value: unknown, wrapper: TargetWrapper) {
  if (!value || typeof value !== 'object') return false
  const record = value as HaRecord
  const target = record.target as HaRecord | undefined
  const data = record.data as HaRecord | undefined
  if (record.action === 'number.set_value') {
    return target?.entity_id === side(wrapper.side).target && data?.value === '{{ level }}'
  }
  return record.action === HOT_FLASH.broker
    && data?.action === 'target'
    && data?.side === wrapper.side
    && data?.level === '{{ level }}'
}

function transformTargetScript(wrapper: TargetWrapper, original?: HaRecord | null): HaRecord {
  const base = original ?? referenceTargetScript(wrapper)
  if (base.mode !== 'restart') throw new Error(`Target wrapper ${wrapper.id} must remain mode restart.`)
  const fields = base.fields as Record<string, HaRecord> | undefined
  if (!fields || Object.keys(fields).length !== 1 || fields.level?.required !== true) {
    throw new Error(`Target wrapper ${wrapper.id} must retain its single required level field.`)
  }
  const sequence = base.sequence
  if (!Array.isArray(sequence)) throw new Error(`Target wrapper ${wrapper.id} has no sequence.`)
  const expectedLength = wrapper.phase === 'tonight' || wrapper.phase === 'outside_schedule' ? 2 : 3
  if (sequence.length !== expectedLength) throw new Error(`Target wrapper ${wrapper.id} changed shape; refusing a lossy transform.`)
  const expectedGuardState = wrapper.phase === 'tonight'
    ? ['bedtime', 'asleep', 'dawn']
    : wrapper.phase === 'outside_schedule'
      ? 'outside'
      : wrapper.phase
  if (!matchesStateGuard(sequence[0], side(wrapper.side).schedulePhase, expectedGuardState)) {
    throw new Error(`Target wrapper ${wrapper.id} changed its schedule guard.`)
  }
  if (expectedLength === 3) {
    const recurringEntity = `input_number.eight_sleep_${wrapper.owner}_${wrapper.phase}_level`
    if (!matchesRecurringWrite(sequence[1], recurringEntity)) {
      throw new Error(`Target wrapper ${wrapper.id} changed its recurring write contract.`)
    }
  }
  if (!matchesCurrentTargetWrite(sequence.at(-1), wrapper)) {
    throw new Error(`Target wrapper ${wrapper.id} changed its current-target write contract.`)
  }
  return {
    ...base,
    sequence: [
      sequence[0],
      ...(expectedLength === 3 ? [sequence[1]] : []),
      directBrokerCall('target', wrapper.side, { level: '{{ level }}' }),
    ],
  }
}

export function hotFlashRecoveryScripts(originals: Record<string, HaRecord | null> = {}): Record<string, HaRecord> {
  return Object.fromEntries(HOT_FLASH_TARGET_WRAPPERS.map((wrapper) => [
    wrapper.id,
    transformTargetScript(wrapper, originals[`script.${wrapper.id}`]),
  ]))
}

function sideOwnerAutomation(which: HotFlashSide, requestedBy: string, configId?: string, alias?: string) {
  const current = side(which)
  const owner = which === 'left' ? 'stephen' : 'steph'
  return {
    id: configId ?? `eight_sleep_${owner}_hot_flash_mode`,
    alias: alias ?? `Eight Sleep ${owner[0].toUpperCase()}${owner.slice(1)} Hot Flash Mode`,
    mode: 'queued',
    max: 20,
    max_exceeded: 'error',
    triggers: [
      { trigger: 'state', entity_id: current.activate, from: null, to: null, id: 'activate' },
      { trigger: 'state', entity_id: current.cancel, from: null, to: null, id: 'cancel' },
    ],
    conditions: [],
    actions: [
      {
        choose: [
          {
            conditions: [{ condition: 'trigger', id: 'activate' }],
            sequence: [directBrokerCall('activate', which, { requested_by: requestedBy })],
          },
          {
            conditions: [{ condition: 'trigger', id: 'cancel' }],
            sequence: [directBrokerCall('cancel', which)],
          },
        ],
      },
    ],
  }
}

function reportCall(which: HotFlashSide, reportKind: HotFlashReportKind) {
  return directBrokerCall('reconcile', which, {
    report_kind: reportKind,
    from_state: '{{ trigger.from_state.state if trigger.from_state is defined and trigger.from_state is not none else "" }}',
    to_state: '{{ trigger.to_state.state if trigger.to_state is defined and trigger.to_state is not none else "" }}',
  })
}

export function hotFlashRecoveryAutomations(
  requestedBy: HotFlashRequestedBy,
  originals: Record<string, HaRecord | null> = {},
): HaRecord[] {
  return [
    {
      id: 'sleepypod_hot_flash_state_reconciler',
      alias: 'SleepyPod Hot Flash State Reconciler',
      mode: 'queued',
      max: 100,
      max_exceeded: 'error',
      triggers: [
        { trigger: 'state', entity_id: side('left').target, from: null, to: null, for: '00:00:05', id: 'left_target' },
        { trigger: 'state', entity_id: side('right').target, from: null, to: null, for: '00:00:05', id: 'right_target' },
        { trigger: 'state', entity_id: side('left').climate, from: null, to: null, for: '00:00:05', id: 'left_climate' },
        { trigger: 'state', entity_id: side('right').climate, from: null, to: null, for: '00:00:05', id: 'right_climate' },
        { trigger: 'state', entity_id: side('left').currentTemperature, from: null, to: null, id: 'left_temperature' },
        { trigger: 'state', entity_id: side('right').currentTemperature, from: null, to: null, id: 'right_temperature' },
        { trigger: 'time', at: sideHelper('left').restoreAt, id: 'left_deadline' },
        { trigger: 'time', at: sideHelper('right').restoreAt, id: 'right_deadline' },
        { trigger: 'event', event_type: 'timer.finished', event_data: { entity_id: sideHelper('left').timer }, id: 'left_timer' },
        { trigger: 'event', event_type: 'timer.finished', event_data: { entity_id: sideHelper('right').timer }, id: 'right_timer' },
        { trigger: 'homeassistant', event: 'start', id: 'startup' },
        { trigger: 'event', event_type: 'automation_reloaded', id: 'reload' },
        { trigger: 'time_pattern', minutes: '/1', id: 'watchdog' },
      ],
      conditions: [],
      actions: [
        {
          choose: [
            { conditions: [{ condition: 'trigger', id: 'left_target' }], sequence: [reportCall('left', 'target')] },
            { conditions: [{ condition: 'trigger', id: 'right_target' }], sequence: [reportCall('right', 'target')] },
            { conditions: [{ condition: 'trigger', id: 'left_climate' }], sequence: [reportCall('left', 'climate')] },
            { conditions: [{ condition: 'trigger', id: 'right_climate' }], sequence: [reportCall('right', 'climate')] },
            { conditions: [{ condition: 'trigger', id: 'left_temperature' }], sequence: [reportCall('left', 'temperature')] },
            { conditions: [{ condition: 'trigger', id: 'right_temperature' }], sequence: [reportCall('right', 'temperature')] },
            { conditions: [{ condition: 'trigger', id: 'left_deadline' }], sequence: [reportCall('left', 'deadline')] },
            { conditions: [{ condition: 'trigger', id: 'right_deadline' }], sequence: [reportCall('right', 'deadline')] },
            { conditions: [{ condition: 'trigger', id: 'left_timer' }], sequence: [reportCall('left', 'timer')] },
            { conditions: [{ condition: 'trigger', id: 'right_timer' }], sequence: [reportCall('right', 'timer')] },
          ],
          default: [directBrokerCall('reconcile', 'shared', { report_kind: '{{ trigger.id }}' })],
        },
      ],
    },
    {
      id: 'sleepypod_hot_flash_startup_followup',
      alias: 'SleepyPod Hot Flash Startup Followup',
      mode: 'restart',
      triggers: [{ trigger: 'homeassistant', event: 'start' }],
      conditions: [],
      actions: [
        { delay: { seconds: 30 } },
        directBrokerCall('reconcile', 'shared', { report_kind: 'startup' }),
      ],
    },
    sideOwnerAutomation(
      'left',
      requestedBy.left,
      typeof originals['automation.eight_sleep_stephen_hot_flash_mode']?.id === 'string'
        ? originals['automation.eight_sleep_stephen_hot_flash_mode'].id as string
        : undefined,
      typeof originals['automation.eight_sleep_stephen_hot_flash_mode']?.alias === 'string'
        ? originals['automation.eight_sleep_stephen_hot_flash_mode'].alias as string
        : undefined,
    ),
    sideOwnerAutomation(
      'right',
      requestedBy.right,
      typeof originals['automation.eight_sleep_steph_hot_flash_mode']?.id === 'string'
        ? originals['automation.eight_sleep_steph_hot_flash_mode'].id as string
        : undefined,
      typeof originals['automation.eight_sleep_steph_hot_flash_mode']?.alias === 'string'
        ? originals['automation.eight_sleep_steph_hot_flash_mode'].alias as string
        : undefined,
    ),
  ]
}

function requestedByMap(value: HotFlashRequestedBy | string): HotFlashRequestedBy {
  const result = typeof value === 'string' ? { left: value, right: value } : value
  for (const [which, requestedBy] of Object.entries(result)) {
    if (!requestedBy || requestedBy.length > 1000 || requestedBy.includes('\0')) {
      throw new Error(`${which} requested_by must come from fresh local runtime configuration.`)
    }
  }
  return result
}

export function hotFlashRecoveryConfig(
  requestedBy: HotFlashRequestedBy | string,
  originals: Record<string, HaRecord | null> = {},
) {
  const binding = requestedByMap(requestedBy)
  return {
    requestedBy: binding,
    broker: hotFlashBroker(),
    scripts: hotFlashRecoveryScripts(originals),
    automations: hotFlashRecoveryAutomations(binding, originals),
    helpers: hotFlashHelpers,
  }
}
