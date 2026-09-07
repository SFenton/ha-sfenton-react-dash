import { frontDoorUnsecuredCopy as copy } from './frontDoorUnsecuredCopy'

export type HaRecord = Record<string, unknown>
export interface HaAutomation extends HaRecord {
  id: string
  alias: string
  description: string
  triggers: HaRecord[]
  conditions: HaRecord[]
  actions: HaRecord[]
  mode: string
}

export const FRONT_DOOR = {
  lock: 'lock.aqara_smart_lock_u400',
  contact: 'binary_sensor.front_door_contact_sensor_contact',
  presence: 'group.household_presence',
  person: 'person.stephen_fenton',
  alarm: 'alarm_control_panel.aqara_hub_m3_0056_security_system_2',
  guests: [
    'input_boolean.guests_staying_in_guest_room',
    'input_boolean.guests_staying_in_music_room',
    'input_boolean.guests_staying_in_theater_room',
  ],
  recipient: 'notify.stephen_s_phone',
  url: '/sfenton-react-dash/home?path=security',
  panelUrl: '/sfenton-react-panel?path=security',
  tagPrefix: 'sfenton-front-door-unsecured-',
  actionPrefix: 'FRONT_DOOR_LOCK_',
  coordinatorId: '1777137745051',
  coordinator: 'automation.front_entry_journey_classifier_shadow',
  controllerId: 'sfenton_front_door_unsecured_lifecycle_v1',
  controller: 'automation.front_door_unsecured_lifecycle',
  reconcilerId: 'sfenton_front_door_unsecured_reconcile_v1',
  reconciler: 'automation.front_door_unsecured_reconcile',
} as const

export const UNSECURED_HELPERS = {
  phase: 'input_select.front_door_unsecured_phase',
  incident: 'input_text.front_door_unsecured_incident_id',
  opened: 'input_number.front_door_unsecured_opened_epoch',
  wake: 'input_datetime.front_door_unsecured_wake_at',
  attention: 'input_boolean.front_door_unsecured_attention_used',
  notice: 'input_text.front_door_unsecured_last_notice_key',
  retired: 'input_text.front_door_unsecured_last_retired_id',
} as const

export const UNSECURED_PHASES = [
  'idle', 'waiting', 'qualifying', 'active', 'expired', 'lock_pending', 'lock_failed', 'lock_cancelled', 'retiring',
] as const

export interface ManagedHelper {
  domain: 'input_select' | 'input_text' | 'input_number' | 'input_datetime' | 'input_boolean'
  id: string
  config: HaRecord
}

const helper = (entity: string, name: string, config: HaRecord = {}): ManagedHelper => ({
  domain: entity.split('.')[0] as ManagedHelper['domain'],
  id: entity.split('.')[1],
  config: { name, ...config },
})

export const frontDoorUnsecuredHelpers: ManagedHelper[] = [
  helper(UNSECURED_HELPERS.phase, 'Front Door Unsecured Phase', { options: [...UNSECURED_PHASES] }),
  helper(UNSECURED_HELPERS.incident, 'Front Door Unsecured Incident ID', { min: 0, max: 100, mode: 'text' }),
  helper(UNSECURED_HELPERS.opened, 'Front Door Unsecured Opened Epoch', { min: 0, max: 4102444800, step: 0.001, mode: 'box' }),
  helper(UNSECURED_HELPERS.wake, 'Front Door Unsecured Wake At', { has_date: true, has_time: true }),
  helper(UNSECURED_HELPERS.attention, 'Front Door Unsecured Attention Used'),
  helper(UNSECURED_HELPERS.notice, 'Front Door Unsecured Last Notice Key', { min: 0, max: 255, mode: 'text' }),
  helper(UNSECURED_HELPERS.retired, 'Front Door Unsecured Last Retired ID', { min: 0, max: 100, mode: 'text' }),
]

const s = (entity: string) => `states('${entity}')`
const state = (entity: string, value: string | readonly string[], seconds?: number): HaRecord => ({
  condition: 'state', entity_id: entity, state: value,
  ...(seconds === undefined ? {} : { for: { seconds } }),
})
const template = (value: string): HaRecord => ({ condition: 'template', value_template: `{{ ${value} }}` })
const any = (...conditions: HaRecord[]): HaRecord => ({ condition: 'or', conditions })
const all = (...conditions: HaRecord[]): HaRecord => ({ condition: 'and', conditions })
const not = (...conditions: HaRecord[]): HaRecord => ({ condition: 'not', conditions })
const phase = (...values: string[]) => state(UNSECURED_HELPERS.phase, values)
const variables = (values: HaRecord): HaRecord => ({ variables: values })
const stop = (reason: string): HaRecord => ({ stop: reason })
const branch = (conditions: HaRecord[], sequence: HaRecord[]) => ({ conditions, sequence })
const iff = (alias: string, conditions: HaRecord[], then: HaRecord[], otherwise?: HaRecord[]): HaRecord => ({
  alias, if: conditions, then, ...(otherwise ? { else: otherwise } : {}),
})
const service = (action: string, entity: string | undefined, data?: HaRecord): HaRecord => ({
  action, ...(entity ? { target: { entity_id: entity } } : {}), ...(data ? { data } : {}),
})
const text = (entity: string, value: string) => service('input_text.set_value', entity, { value })
const setPhase = (value: string) => service('input_select.select_option', UNSECURED_HELPERS.phase, { option: value })
const wakeIn = (seconds: number) => service('input_datetime.set_datetime', UNSECURED_HELPERS.wake, {
  timestamp: `{{ (as_timestamp(now()) + ${seconds}) | round(0, 'ceil') | int }}`,
})
const persist = () => service('homeassistant.save_persistent_states', undefined)
const audit = (outcome: string): HaRecord => service('logbook.log', undefined, {
  name: 'Front Door Unsecured Lifecycle',
  entity_id: FRONT_DOOR.controller,
  message: `${outcome}; incident={{ ${s(UNSECURED_HELPERS.incident)} }}; phase={{ ${s(UNSECURED_HELPERS.phase)} }}; event={{ event_id }}.`,
})

const away = () => state(FRONT_DOOR.presence, 'not_home', 30)
const home = () => state(FRONT_DOOR.presence, 'home', 30)
const eligible = () => all(away(), state(FRONT_DOOR.lock, 'unlocked'), state(FRONT_DOOR.contact, 'off'))
const guestsOn = () => any(...FRONT_DOOR.guests.map((id) => state(id, 'on')))
const guestsOff = () => all(...FRONT_DOOR.guests.map((id) => state(id, 'off')))
const deadlinePassed = () => template(`as_timestamp(now()) >= (state_attr('${UNSECURED_HELPERS.wake}', 'timestamp') | float(0))`)
const terminalNow = () => any(state(FRONT_DOOR.lock, 'locked'), home())

function clear(idExpression: string): HaRecord {
  return service(FRONT_DOOR.recipient, undefined, {
    message: 'clear_notification',
    data: { tag: `${FRONT_DOOR.tagPrefix}{{ ${idExpression} }}` },
  })
}

function retire(): HaRecord[] {
  return [
    variables({ retiring_id: `{{ ${s(UNSECURED_HELPERS.incident)} }}`, retired_in_run: true }),
    text(UNSECURED_HELPERS.retired, '{{ retiring_id }}'),
    setPhase('retiring'),
    persist(),
    iff('Clear only the reserved incident', [template(`${s(UNSECURED_HELPERS.notice)} not in ['', 'unknown', 'unavailable']`)], [
      clear('retiring_id'),
    ]),
    audit('Retired exposure; locking is confirmed only when the lock state is locked'),
    setPhase('idle'),
    text(UNSECURED_HELPERS.incident, ''),
    text(UNSECURED_HELPERS.notice, ''),
    persist(),
  ]
}

function noticeActions(): HaRecord[] {
  const sourceFacts = `[${[FRONT_DOOR.lock, FRONT_DOOR.contact, FRONT_DOOR.presence, FRONT_DOOR.alarm, ...FRONT_DOOR.guests, UNSECURED_HELPERS.phase].map(s).join(', ')}] | join('|')`
  const messages = { ...copy.messages }
  const titles: Record<keyof typeof messages, string> = {
    guest: copy.titles.unlocked, away: copy.titles.unlocked,
    uncertain: copy.titles.unlocked, armedAway: copy.titles.unlocked,
    pending: copy.titles.pending, open: copy.titles.attention,
    unavailable: copy.titles.attention, changing: copy.titles.attention,
    jammed: copy.titles.attention, failed: copy.titles.failed, expired: copy.titles.expired, cancelled: copy.titles.attention,
  }
  const kind = (value: keyof typeof messages) => [variables({ notice_kind: value })]
  const uri = { action: 'URI', title: copy.openSecurity, uri: FRONT_DOOR.url, icon: 'sfsymbols:shield' }
  const lockAction = `{ 'action': '${FRONT_DOOR.actionPrefix}' ~ ${s(UNSECURED_HELPERS.incident)}, 'title': ${JSON.stringify(copy.action)}, 'authenticationRequired': true, 'activationMode': 'background', 'icon': 'sfsymbols:lock' }`
  return [
    iff('Only a reserved notice can be updated', [
      not(phase('active', 'expired', 'lock_pending', 'lock_failed', 'lock_cancelled')),
    ], [stop('No issued incident to present')]),
    iff('The triggered alarm owns urgent notifications', [state(FRONT_DOOR.alarm, 'triggered')], [
      stop('Alarm notification owns current urgency'),
    ]),
    iff('Do not assert residents are away while presence is unresolved', [
      phase('active'), state(FRONT_DOOR.lock, 'unlocked'), state(FRONT_DOOR.contact, 'off'),
      not(state(FRONT_DOOR.presence, 'not_home')),
    ], [stop('Awaiting confirmed presence before routine wording')]),
    variables({
      notice_kind: 'unavailable', attention_now: false, notice_messages: messages, notice_titles: titles,
      source_snapshot: `{{ ${sourceFacts} }}`,
      previous_notice_key: `{{ ${s(UNSECURED_HELPERS.notice)} }}`,
      previous_attention: `{{ ${s(UNSECURED_HELPERS.attention)} }}`,
    }),
    {
      choose: [
        branch([phase('lock_pending')], kind('pending')),
        branch([phase('lock_failed')], kind('failed')),
        branch([phase('lock_cancelled')], kind('cancelled')),
        branch([state(FRONT_DOOR.lock, 'jammed')], kind('jammed')),
        branch([state(FRONT_DOOR.contact, 'on')], kind('open')),
        branch([state(FRONT_DOOR.lock, ['locking', 'unlocking'])], kind('changing')),
        branch([not(all(state(FRONT_DOOR.lock, 'unlocked'), state(FRONT_DOOR.contact, 'off')))], kind('unavailable')),
        branch([phase('expired')], kind('expired')),
        branch([state(FRONT_DOOR.alarm, 'armed_away')], kind('armedAway')),
        branch([guestsOn()], kind('guest')),
        branch([guestsOff()], kind('away')),
      ],
      default: kind('uncertain'),
    },
    variables({
      can_lock_action: `{{ ${s(UNSECURED_HELPERS.phase)} == 'active' and is_state('${FRONT_DOOR.lock}', 'unlocked') and is_state('${FRONT_DOOR.contact}', 'off') and as_timestamp(now()) < (state_attr('${UNSECURED_HELPERS.wake}', 'timestamp') | float(0)) and (state_attr('${FRONT_DOOR.person}', 'user_id') | default('', true) | length) > 0 }}`,
      notice_key: "{{ notice_kind ~ ':' ~ ('action' if can_lock_action else 'view') }}",
    }),
    iff('Reserve at most one attention alert for this exposure', [
      phase('active', 'expired'), eligible(), state(UNSECURED_HELPERS.attention, 'off'),
      any(state(FRONT_DOOR.alarm, 'armed_away'), guestsOff()),
    ], [
      variables({ attention_now: true }),
      service('input_boolean.turn_on', UNSECURED_HELPERS.attention),
    ]),
    iff('Suppress unchanged submissions', [
      template(`notice_key == ${s(UNSECURED_HELPERS.notice)} and not attention_now`),
    ], [stop('Presentation unchanged')]),
    text(UNSECURED_HELPERS.notice, '{{ notice_key }}'),
    persist(),
    iff('Do not submit a resolved exposure', [terminalNow()], [...retire(), stop('Resolved before submission')]),
    iff('Reconcile source changes before notification submission', [template(`(${sourceFacts}) != source_snapshot`)], [
      text(UNSECURED_HELPERS.notice, '{{ previous_notice_key }}'),
      iff('No notification was attempted; release the unused reservation', [template("attention_now and previous_attention == 'off'")], [
        service('input_boolean.turn_off', UNSECURED_HELPERS.attention),
      ]),
      iff('An unissued incident must requalify after losing its source facts', [
        template("previous_notice_key == ''"), not(eligible()),
      ], [setPhase('waiting')]),
      persist(), stop('Source facts changed before submission'),
    ]),
    service(FRONT_DOOR.recipient, undefined, {
      title: '{{ notice_titles[notice_kind] }}',
      message: '{{ notice_messages[notice_kind] }}',
      data: {
        tag: `${FRONT_DOOR.tagPrefix}{{ ${s(UNSECURED_HELPERS.incident)} }}`,
        group: 'front-door-unsecured',
        url: FRONT_DOOR.url,
        clickAction: FRONT_DOOR.url,
        alert_once: '{{ not attention_now }}',
        push: {
          'interruption-level': "{{ 'time-sensitive' if attention_now else 'passive' }}",
          sound: "{{ 'default' if attention_now else 'none' }}",
        },
        actions: `{{ ([${lockAction}] if can_lock_action else []) + [${JSON.stringify(uri)}] }}`,
      },
    }),
    audit('Submitted reserved presentation'),
    iff('Recall a resolution arriving during submission', [terminalNow()], retire()),
  ]
}

export function frontDoorUnsecuredController(): HaAutomation {
  const actionIdentity = template(`trigger is defined and trigger.platform == 'event' and trigger.event.event_type == 'mobile_app_notification_action' and (state_attr('${FRONT_DOOR.person}', 'user_id') | default('', true) | length) > 0 and trigger.event.context.user_id == state_attr('${FRONT_DOOR.person}', 'user_id') and ${s(UNSECURED_HELPERS.incident)} not in ['', 'unknown', 'unavailable'] and trigger.event.data.action == '${FRONT_DOOR.actionPrefix}' ~ ${s(UNSECURED_HELPERS.incident)}`)
  const authorized = [
    actionIdentity,
    phase('active'),
    { condition: 'numeric_state', entity_id: UNSECURED_HELPERS.opened, above: 0 },
    not(deadlinePassed()),
  ]
  return {
    id: FRONT_DOOR.controllerId,
    alias: 'Front Door Unsecured Lifecycle',
    description: 'Managed by ha-sfenton-react-dash/front-door-unsecured v1. Serialized resident-away exposure, silent guest policy, incident-bound authenticated lock action, confirmed-state recall, and persisted deadlines. Generic state triggers retain source timestamps for stale-event fencing; no device IDs or journey-window ownership.',
    mode: 'queued', max: 100, max_exceeded: 'warning', trace: { stored_traces: 50 },
    triggers: [
      { trigger: 'state', entity_id: FRONT_DOOR.lock, to: null, id: 'lock' },
      { trigger: 'state', entity_id: FRONT_DOOR.contact, to: null, id: 'contact' },
      { trigger: 'state', entity_id: FRONT_DOOR.presence, to: null, id: 'presence' },
      { trigger: 'state', entity_id: FRONT_DOOR.presence, to: 'home', for: { seconds: 30 }, id: 'home_stable' },
      { trigger: 'state', entity_id: FRONT_DOOR.presence, to: 'not_home', for: { seconds: 30 }, id: 'away_stable' },
      { trigger: 'state', entity_id: [...FRONT_DOOR.guests, FRONT_DOOR.alarm], to: null, id: 'policy' },
      { trigger: 'time', at: UNSECURED_HELPERS.wake, id: 'deadline' },
      { trigger: 'event', event_type: 'mobile_app_notification_action', id: 'notification_action' },
    ],
    conditions: [],
    actions: [
      variables({
        retired_in_run: false,
        event_id: "{{ trigger.id if trigger is defined and trigger.id is defined else 'reconcile' }}",
        event_epoch: "{{ as_timestamp(trigger.to_state.last_changed, 0) if trigger is defined and trigger.platform == 'state' and trigger.to_state is not none else 0 }}",
        recovery: "{{ trigger is not defined or trigger.platform is not defined or trigger.platform not in ['state', 'time', 'event'] or (trigger.platform == 'state' and (trigger.from_state is none or trigger.from_state.state in ['unknown', 'unavailable'])) }}",
      }),
      iff('Helpers must be available before any action', [
        any(...Object.values(UNSECURED_HELPERS).map((id) => state(id, ['unknown', 'unavailable']))),
      ], [stop('Lifecycle storage is not available')]),
      iff('Validate native notification action before side effects', [template("event_id == 'notification_action'")], [
        iff('Reject unauthorized stale expired or consumed actions', [not(all(...authorized))], [
          audit('Rejected notification action'), stop('Notification action rejected'),
        ]),
        iff('Resolved exposure requires only recall', [terminalNow()], [
          ...retire(), stop('Exposure already resolved; no command'),
        ]),
        iff('Require a known closed door and unlocked lock', [
          not(all(state(FRONT_DOOR.contact, 'off'), state(FRONT_DOOR.lock, 'unlocked'))),
        ], [audit('Rejected unsafe contact or lock state'), stop('Door is not safe for a lock command')]),
        variables({ accepted_expiry: `{{ state_attr('${UNSECURED_HELPERS.wake}', 'timestamp') | float(0) }}` }),
        wakeIn(20), setPhase('lock_pending'), persist(),
        iff('Recheck terminal resolution after the persistence boundary', [terminalNow()], [
          ...retire(), stop('Exposure resolved before lock dispatch'),
        ]),
        iff('Recheck hardware and ticket safety immediately before dispatch', [
          all(state(FRONT_DOOR.contact, 'off'), state(FRONT_DOOR.lock, 'unlocked')),
          actionIdentity, template('as_timestamp(now()) < accepted_expiry'),
        ], [
          { ...service('lock.lock', FRONT_DOOR.lock), alias: 'One explicit lock-only command; deadline reports failure', continue_on_error: true },
          audit('Consumed notification action and requested lock'),
        ], [
          setPhase('lock_cancelled'), persist(), audit('Consumed action cancelled before dispatch; no retry'),
        ]),
      ]),
      iff('Reject corrupt active metadata rather than authorize a command', [
        not(phase('idle')),
        any(template(`${s(UNSECURED_HELPERS.incident)} == ''`), { condition: 'numeric_state', entity_id: UNSECURED_HELPERS.opened, below: 1 }),
      ], [audit('Invalid persisted incident metadata'), stop('Incident needs storage recovery')]),
      iff('Confirmed terminal evidence fences the current exposure', [
        not(phase('idle')),
        any(
          terminalNow(),
          template(`event_epoch >= (${s(UNSECURED_HELPERS.opened)} | float(0)) and ((event_id == 'lock' and trigger.to_state.state == 'locked') or event_id == 'home_stable')`),
        ),
      ], retire()),
      iff('Reconcile the most recent retired tag without touching a newer tag', [
        template(`event_id == 'reconcile' and not retired_in_run and ${s(UNSECURED_HELPERS.retired)} not in ['', 'unknown', 'unavailable'] and ${s(UNSECURED_HELPERS.retired)} != ${s(UNSECURED_HELPERS.incident)}`),
      ], [clear(s(UNSECURED_HELPERS.retired))]),
      iff('Create an exposure only from a verified unlocked away state', [
        phase('idle'), away(), state(FRONT_DOOR.lock, 'unlocked'),
      ], [
        text(UNSECURED_HELPERS.incident, '{{ context.id }}'),
        service('input_number.set_value', UNSECURED_HELPERS.opened, {
          value: `{{ [as_timestamp(states.${FRONT_DOOR.lock}.last_changed, 0), as_timestamp(states.${FRONT_DOOR.presence}.last_changed, 0)] | max }}`,
        }),
        text(UNSECURED_HELPERS.notice, ''),
        iff('Recovery never creates a fresh audible incident', [template('recovery or event_id == \'reconcile\'')], [
          service('input_boolean.turn_on', UNSECURED_HELPERS.attention),
        ], [service('input_boolean.turn_off', UNSECURED_HELPERS.attention)]),
        setPhase('waiting'), persist(), audit('Opened exposure'),
      ]),
      iff('No incident is active', [phase('idle')], [stop('No unsecured-away exposure')]),
      iff('Repair an interrupted retirement', [phase('retiring')], [...retire(), stop('Retirement reconciled')]),
      iff('Qualification is continuous but never resets an issued incident', [phase('waiting', 'qualifying')], [
        iff('Pause qualification when source facts are not confirmed', [not(eligible())], [
          setPhase('waiting'), persist(), stop('Waiting for known closed unlocked away state'),
        ]),
        iff('Start the closed-unlocked qualification deadline', [phase('waiting')], [
          wakeIn(35), setPhase('qualifying'), persist(), stop('Qualification scheduled'),
        ]),
        iff('Wait for the persisted qualification deadline', [not(deadlinePassed())], [stop('Qualification pending')]),
        iff('Requalify after a missed transition or restart', [
          not(all(state(FRONT_DOOR.presence, 'not_home', 65), state(FRONT_DOOR.lock, 'unlocked', 35), state(FRONT_DOOR.contact, 'off', 35))),
        ], [wakeIn(35), persist(), stop('Continuous qualification restarted')]),
        iff('Leave a triggered alarm to its existing owner', [state(FRONT_DOOR.alarm, 'triggered')], [stop('Alarm owns urgency')]),
        wakeIn(1800), setPhase('active'),
      ]),
      iff('Expire the action without resolving the exposure', [phase('active'), deadlinePassed()], [
        setPhase('expired'), persist(),
      ]),
      iff('Report unconfirmed commands without retrying', [phase('lock_pending'), deadlinePassed()], [
        setPhase('lock_failed'), persist(), audit('Lock confirmation deadline expired'),
      ]),
      ...noticeActions(),
    ],
  }
}

export function frontDoorUnsecuredReconciler(): HaAutomation {
  const reconcile = service('automation.trigger', FRONT_DOOR.controller, { skip_condition: false })
  return {
    id: FRONT_DOOR.reconcilerId,
    alias: 'Front Door Unsecured Reconcile',
    description: 'Managed by ha-sfenton-react-dash/front-door-unsecured v1. Reconcile restored lifecycle immediately and after source-state stabilization, without replaying lock commands or resetting incidents.',
    mode: 'restart',
    triggers: [
      { trigger: 'homeassistant', event: 'start' },
      { trigger: 'event', event_type: 'automation_reloaded' },
    ],
    conditions: [state(FRONT_DOOR.controller, 'on')],
    actions: [reconcile, { delay: { seconds: 30 } }, reconcile],
  }
}
