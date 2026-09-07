import { FRONT_DOOR as F, type HaRecord } from '../../lib/frontDoorUnsecuredConfig'

// Sanitized structural fixture: real affected clauses, unrelated behavior represented by sentinels.
export function coordinatorFixture(): HaRecord {
  const pass = {
    variables: {
      classification: `{% if is_state('${F.lock}', 'jammed') %}unsafe_lock_jammed\n{% elif is_state('${F.presence}', 'not_home') and is_state('${F.contact}', 'off') and not is_state('${F.lock}', 'locked') and lock_age | float(0) >= 35 %}unsecured_while_away\n{% elif session_trigger == 'lock_failed_to_lock' %}lock_failed_to_secure\n{% else %}visitor_or_delivery{% endif %}`,
      recommended_action: "{% set c = classification | trim %}{% if c in ['unsafe_lock_jammed', 'door_left_open', 'unsecured_while_away', 'lock_failed_to_secure'] %}would_escalate{% else %}would_notify_once{% endif %}",
      push_level: "{% set c = classification | trim %}{% if c == 'unsecured_while_away' %}critical{% elif c in ['unsafe_lock_jammed', 'door_left_open', 'lock_failed_to_secure'] %}time-sensitive{% elif c == 'visitor_or_delivery' %}active{% else %}passive{% endif %}",
      plain_summary: "{% if c == 'unsafe_lock_jammed' %}The front door lock is jammed. Open Security to review it.\n{% elif c == 'unsecured_while_away' %}The front door is unlocked and nobody is home. Open Security to secure it.\n{% elif c == 'lock_failed_to_secure' %}The front door did not lock. Open Security to try again.\n{% else %}Visitor sentinel{% endif %}",
      notification_title: "{% if c == 'unsafe_lock_jammed' %}Front Door · Lock Jammed\n{% elif c == 'unsecured_while_away' %}Front Door · Unlocked While Away\n{% else %}Front Door · Visitor{% endif %}",
      notification_location_label: "{% if c in ['unsafe_lock_jammed', 'unsecured_while_away', 'door_left_open'] %}Front Door{% else %}Driveway{% endif %}",
      notification_url: "{% if notification_location_label == 'Front Door' %}/sfenton-react-dash/home?path=security#camera-front-door{% else %}/sfenton-react-dash/home?path=security#camera-driveway{% endif %}",
      update_quality_present: "{{ c in ['unsecured_while_away', 'unsafe_lock_jammed', 'visitor_or_delivery'] }}",
      unrelated: 'Do not modify visitor, alarm, jam, or failed-lock ownership.',
    },
  }
  return {
    id: F.coordinatorId, alias: 'Front Entry Journey Coordinator', description: 'Existing journey behavior.',
    triggers: [
      { trigger: 'state', entity_id: F.lock, to: 'unlocked', for: { seconds: 35 }, id: 'unsecured_away_35s' },
      { trigger: 'state', entity_id: F.lock, to: 'jammed', id: 'lock_jammed' },
      { trigger: 'state', entity_id: F.contact, to: 'on', for: { seconds: 60 }, id: 'door_left_open_60s' },
    ],
    conditions: [{ condition: 'template', value_template: '{{ startup_guard }}' }],
    actions: [
      { delay: { seconds: "{% set immediate_ids = ['lock_jammed', 'unsecured_away_35s', 'door_closed'] %}{{ 0 if session_trigger in immediate_ids else 18 }}" } },
      structuredClone(pass),
      { action: F.recipient, data: { title: '{{ notification_title }}', data: { entity_id: 'camera.front_door_camera', url: '{{ notification_url }}', push: { 'interruption-level': '{{ push_level }}' }, actions: [{ action: 'URI', title: 'Open Security', uri: '{{ notification_url }}' }] } } },
      { delay: { seconds: 90 } },
      structuredClone(pass),
      { action: 'logbook.log', data: { message: 'Unrelated summary sentinel.' } },
    ],
    mode: 'restart', trace: { stored_traces: 50 },
  }
}
