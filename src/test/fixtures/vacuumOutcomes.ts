import type {
  VacuumOutcomeContract,
  VacuumOutcomeEvent,
  VacuumOutcomeReason,
  VacuumOutcomeRoom,
} from '../../components/hass/vacuumOutcomes'

const cleanWaterReason: VacuumOutcomeReason = {
  category: 'mop_resource',
  code: 'mop.clean_water_empty',
  data: {},
  raw: 'Mop Dock Clean Water Tank empty',
}

const dustbagReason: VacuumOutcomeReason = {
  category: 'dock',
  code: 'dock.dustbag_full_or_duct_blocked',
  data: {},
  raw: 'Auto-Empty Dock dust bag full or dust duct clogged',
}

const returnedHomeReason: VacuumOutcomeReason = {
  category: 'occupancy',
  code: 'occupancy.person_arrived',
  data: {},
  raw: 'Tracked person arrived home',
}

function attemptEvent({
  id,
  mode,
  reason,
  result,
  roomId,
  roomName,
  sequence,
  sessionId,
  time,
}: {
  id: string
  mode: 'fallback_vacuum' | 'vacuum' | 'vacuum_mop'
  reason: VacuumOutcomeReason | null
  result: 'completed' | 'failed' | 'interrupted'
  roomId: string
  roomName: string
  sequence: number
  sessionId: string
  time: string
}): VacuumOutcomeEvent {
  return {
    attempt_mode: mode,
    attempt_result: result,
    day: '2026-08-19',
    id,
    kind: result === 'completed' ? 'cleaned' : 'failed',
    occurred_at: time,
    reason,
    room_id: roomId,
    room_name: roomName,
    sequence,
    session_id: sessionId,
    type: 'attempt',
  }
}

function deferralEvent({
  id,
  roomId,
  roomName,
  sequence,
  sessionId,
  time,
}: {
  id: string
  roomId: string
  roomName: string
  sequence: number
  sessionId: string
  time: string
}): VacuumOutcomeEvent {
  return {
    day: '2026-08-19',
    id,
    kind: 'skipped',
    occurred_at: time,
    outstanding_operation: 'vacuum_mop',
    reason: cleanWaterReason,
    room_id: roomId,
    room_name: roomName,
    sequence,
    session_id: sessionId,
    type: 'deferral',
  }
}

const events: VacuumOutcomeEvent[] = [
  attemptEvent({
    id: 'session-one:dining-room:attempt',
    mode: 'vacuum_mop',
    reason: cleanWaterReason,
    result: 'failed',
    roomId: 'dining_room',
    roomName: 'Dining Room',
    sequence: 1,
    sessionId: 'session-one',
    time: '2026-08-19T16:01:00+00:00',
  }),
  deferralEvent({
    id: 'session-one:dining-room:deferral',
    roomId: 'dining_room',
    roomName: 'Dining Room',
    sequence: 2,
    sessionId: 'session-one',
    time: '2026-08-19T16:02:00+00:00',
  }),
  deferralEvent({
    id: 'session-one:kitchen:deferral',
    roomId: 'kitchen',
    roomName: 'Kitchen',
    sequence: 3,
    sessionId: 'session-one',
    time: '2026-08-19T16:03:00+00:00',
  }),
  deferralEvent({
    id: 'session-one:master-bathroom:deferral',
    roomId: 'master_bathroom',
    roomName: 'Master Bathroom',
    sequence: 4,
    sessionId: 'session-one',
    time: '2026-08-19T16:04:00+00:00',
  }),
  deferralEvent({
    id: 'session-one:guest-bathroom:deferral',
    roomId: 'guest_bathroom',
    roomName: 'Guest Bathroom',
    sequence: 5,
    sessionId: 'session-one',
    time: '2026-08-19T16:05:00+00:00',
  }),
  attemptEvent({
    id: 'session-one:gym:attempt',
    mode: 'vacuum',
    reason: null,
    result: 'completed',
    roomId: 'gym',
    roomName: 'Gym',
    sequence: 6,
    sessionId: 'session-one',
    time: '2026-08-19T16:10:00+00:00',
  }),
  attemptEvent({
    id: 'session-one:office:attempt',
    mode: 'vacuum',
    reason: dustbagReason,
    result: 'failed',
    roomId: 'office',
    roomName: 'Office',
    sequence: 7,
    sessionId: 'session-one',
    time: '2026-08-19T16:15:00+00:00',
  }),
  attemptEvent({
    id: 'session-two:dining-room:attempt',
    mode: 'vacuum_mop',
    reason: cleanWaterReason,
    result: 'failed',
    roomId: 'dining_room',
    roomName: 'Dining Room',
    sequence: 8,
    sessionId: 'session-two',
    time: '2026-08-19T19:01:00+00:00',
  }),
  deferralEvent({
    id: 'session-two:dining-room:deferral',
    roomId: 'dining_room',
    roomName: 'Dining Room',
    sequence: 9,
    sessionId: 'session-two',
    time: '2026-08-19T19:02:00+00:00',
  }),
  attemptEvent({
    id: 'session-two:office:attempt',
    mode: 'vacuum',
    reason: null,
    result: 'completed',
    roomId: 'office',
    roomName: 'Office',
    sequence: 10,
    sessionId: 'session-two',
    time: '2026-08-19T19:10:00+00:00',
  }),
  attemptEvent({
    id: 'session-two:guest-room:attempt',
    mode: 'vacuum',
    reason: null,
    result: 'completed',
    roomId: 'guest_room',
    roomName: 'Guest Room',
    sequence: 11,
    sessionId: 'session-two',
    time: '2026-08-19T19:12:00+00:00',
  }),
  attemptEvent({
    id: 'session-two:closet:attempt',
    mode: 'vacuum',
    reason: null,
    result: 'completed',
    roomId: 'master_bedroom_closet',
    roomName: 'Master Bedroom Closet',
    sequence: 12,
    sessionId: 'session-two',
    time: '2026-08-19T19:14:00+00:00',
  }),
  attemptEvent({
    id: 'session-two:hallway:attempt',
    mode: 'vacuum',
    reason: returnedHomeReason,
    result: 'interrupted',
    roomId: 'hallway',
    roomName: 'Hallway',
    sequence: 13,
    sessionId: 'session-two',
    time: '2026-08-19T19:20:00+00:00',
  }),
]

function deferredRoom(roomId: string, roomName: string, eventId: string, sequence: number): VacuumOutcomeRoom {
  return {
    credit: { operation: null, status: 'none' },
    event_ids: [eventId],
    first_occurred_at: events[sequence - 1].occurred_at,
    last_occurred_at: events[sequence - 1].occurred_at,
    last_sequence: sequence,
    latest_attempt: null,
    occurrence_count: 0,
    outstanding: { operation: 'vacuum_mop', reason: cleanWaterReason },
    reasons_coincide: false,
    required_operation: 'vacuum_mop',
    room_id: roomId,
    room_name: roomName,
    status: 'deferred',
  }
}

function completedRoom(roomId: string, roomName: string, eventId: string, sequence: number): VacuumOutcomeRoom {
  return {
    credit: { operation: 'vacuum', status: 'full' },
    event_ids: [eventId],
    first_occurred_at: events[sequence - 1].occurred_at,
    last_occurred_at: events[sequence - 1].occurred_at,
    last_sequence: sequence,
    latest_attempt: { event_id: eventId, mode: 'vacuum', reason: null, result: 'completed' },
    occurrence_count: 1,
    outstanding: null,
    reasons_coincide: false,
    required_operation: 'vacuum',
    room_id: roomId,
    room_name: roomName,
    status: 'completed',
  }
}

export const NINE_ROOM_VACUUM_OUTCOME_CONTRACT: VacuumOutcomeContract = {
  complete: true,
  day: '2026-08-19',
  events,
  rooms: [
    {
      credit: { operation: null, status: 'none' },
      event_ids: [
        'session-one:dining-room:attempt',
        'session-one:dining-room:deferral',
        'session-two:dining-room:attempt',
        'session-two:dining-room:deferral',
      ],
      first_occurred_at: events[0].occurred_at,
      last_occurred_at: events[8].occurred_at,
      last_sequence: 9,
      latest_attempt: {
        event_id: 'session-two:dining-room:attempt',
        mode: 'vacuum_mop',
        reason: cleanWaterReason,
        result: 'failed',
      },
      occurrence_count: 2,
      outstanding: { operation: 'vacuum_mop', reason: cleanWaterReason },
      reasons_coincide: true,
      required_operation: 'vacuum_mop',
      room_id: 'dining_room',
      room_name: 'Dining Room',
      status: 'failed',
    },
    deferredRoom('kitchen', 'Kitchen', 'session-one:kitchen:deferral', 3),
    deferredRoom('master_bathroom', 'Master Bathroom', 'session-one:master-bathroom:deferral', 4),
    deferredRoom('guest_bathroom', 'Guest Bathroom', 'session-one:guest-bathroom:deferral', 5),
    completedRoom('gym', 'Gym', 'session-one:gym:attempt', 6),
    {
      credit: { operation: 'vacuum', status: 'full' },
      event_ids: ['session-one:office:attempt', 'session-two:office:attempt'],
      first_occurred_at: events[6].occurred_at,
      last_occurred_at: events[9].occurred_at,
      last_sequence: 10,
      latest_attempt: {
        event_id: 'session-two:office:attempt',
        mode: 'vacuum',
        reason: null,
        result: 'completed',
      },
      occurrence_count: 2,
      outstanding: null,
      reasons_coincide: false,
      required_operation: 'vacuum',
      room_id: 'office',
      room_name: 'Office',
      status: 'completed',
    },
    completedRoom('guest_room', 'Guest Room', 'session-two:guest-room:attempt', 11),
    completedRoom('master_bedroom_closet', 'Master Bedroom Closet', 'session-two:closet:attempt', 12),
    {
      credit: { operation: null, status: 'none' },
      event_ids: ['session-two:hallway:attempt'],
      first_occurred_at: events[12].occurred_at,
      last_occurred_at: events[12].occurred_at,
      last_sequence: 13,
      latest_attempt: {
        event_id: 'session-two:hallway:attempt',
        mode: 'vacuum',
        reason: returnedHomeReason,
        result: 'interrupted',
      },
      occurrence_count: 1,
      outstanding: { operation: 'vacuum', reason: returnedHomeReason },
      reasons_coincide: true,
      required_operation: 'vacuum',
      room_id: 'hallway',
      room_name: 'Hallway',
      status: 'interrupted',
    },
  ],
  version: 1,
}

export const LEGACY_VACUUM_OUTCOMES = {
  while_away_cleaned: ['Cleaned Gym', 'Cleaned Office'],
  while_away_issues: ['Could not clean Dining Room because the clean water tank is empty'],
}

export const MISLEADING_V2_LEGACY_VACUUM_OUTCOMES = {
  while_away_cleaned: [],
  while_away_issues: ['Could not clean Office because floor completion time was unavailable during dock servicing'],
}

const iterationsIncompleteReason = {
  category: 'verification',
  code: 'verification.iterations_incomplete',
  data: {
    observed_iterations: 1,
    requested_iterations: 2,
  },
  raw: 'Observed 1 of 2 requested iterations',
}

const telemetryOutageReason = {
  category: 'availability',
  code: 'telemetry.source_outage_unresolved',
  data: {
    timeout_seconds: 300,
  },
  raw: 'Telemetry recovery was not coherent within 300s',
}

const evidenceFreeReason = {
  category: 'unknown',
  code: 'unknown',
  data: {},
  raw: 'Floor completion time was unavailable during dock servicing after error sensor is unavailable',
}

const partialReason = {
  category: 'mop_resource',
  code: 'mop.clean_water_empty',
  data: {},
  raw: 'Mop Dock Clean Water Tank empty',
}

const gymEvidence = {
  physical_work: {
    status: 'substantial',
    cleaning_observed: true,
    segment_cleaning_observed: true,
    target_room_dwell_seconds: 1480,
  },
  duration: {
    status: 'passed',
    observed: 1500,
    minimum: 120,
    unit: 'seconds',
    reset_count: 1,
    attribution_uncertain: false,
  },
  area: {
    status: 'passed',
    observed: 161,
    minimum: 100,
    unit: 'square_inches',
    reset_count: 1,
    attribution_uncertain: false,
  },
  iterations: {
    status: 'unverified',
    requested: 2,
    observed: 1,
  },
  completion: {
    status: 'uncertain',
    reason: 'Observed 1 of 2 requested iterations',
  },
}

const officeEvidence = {
  physical_work: {
    status: 'substantial',
    cleaning_observed: true,
    segment_cleaning_observed: true,
    target_room_dwell_seconds: 1420,
  },
  duration: {
    status: 'passed_lower_bound',
    observed: null,
    minimum: 120,
    unit: 'seconds',
    reset_count: 1,
    attribution_uncertain: true,
    lower_bound: 1440,
  },
  area: {
    status: 'passed_lower_bound',
    observed: null,
    minimum: 100,
    unit: 'square_inches',
    reset_count: 1,
    attribution_uncertain: true,
    lower_bound: 161,
  },
  iterations: {
    status: 'verified',
    requested: 1,
    observed: 1,
  },
  completion: {
    status: 'uncertain',
    reason: 'Telemetry recovery was not coherent within 300s',
  },
  telemetry: {
    source_outage_count: 1,
    source_outage_seconds: 258,
    status: 'unresolved',
  },
}

const livingRoomEvidence = {
  physical_work: {
    status: 'observed',
    cleaning_observed: true,
    segment_cleaning_observed: true,
    target_room_dwell_seconds: 90,
  },
  duration: {
    status: 'passed',
    observed: 180,
    minimum: 120,
    unit: 'seconds',
    reset_count: 0,
    attribution_uncertain: false,
  },
  area: {
    status: 'not_required',
    observed: 80,
    minimum: 0,
    unit: 'square_inches',
    reset_count: 0,
    attribution_uncertain: false,
  },
  iterations: {
    status: 'verified',
    requested: 1,
    observed: 1,
  },
  completion: {
    status: 'incomplete',
    reason: 'Mop Dock Clean Water Tank empty',
  },
}

export const EVIDENCE_FREE_V2_VACUUM_OUTCOME_PAYLOAD = {
  complete: true,
  day: '2026-09-17',
  events: [
    {
      attempt_mode: 'vacuum',
      attempt_result: 'uncertain',
      day: '2026-09-17',
      id: 'session-retained:office:attempt',
      kind: 'failed',
      occurred_at: '2026-09-17T15:31:19.933826+00:00',
      reason: evidenceFreeReason,
      room_id: 'office',
      room_name: 'Office',
      sequence: 88,
      session_id: 'session-retained',
      type: 'attempt',
    },
  ],
  rooms: [
    {
      credit: { operation: null, status: 'none' },
      event_ids: ['session-retained:office:attempt'],
      first_occurred_at: '2026-09-17T15:31:19.933826+00:00',
      last_occurred_at: '2026-09-17T15:31:19.933826+00:00',
      last_sequence: 88,
      latest_attempt: {
        event_id: 'session-retained:office:attempt',
        mode: 'vacuum',
        reason: evidenceFreeReason,
        result: 'uncertain',
      },
      occurrence_count: 1,
      outstanding: {
        operation: 'vacuum',
        reason: evidenceFreeReason,
      },
      reasons_coincide: true,
      required_operation: 'vacuum',
      room_id: 'office',
      room_name: 'Office',
      status: 'uncertain',
    },
  ],
  version: 2,
}

export const EVIDENCE_RICH_V2_VACUUM_OUTCOME_PAYLOAD = {
  complete: true,
  day: '2026-09-18',
  events: [
    {
      attempt_mode: 'vacuum',
      attempt_result: 'uncertain',
      day: '2026-09-18',
      evidence: gymEvidence,
      id: 'session-v2:gym:attempt',
      kind: 'failed',
      occurred_at: '2026-09-18T15:24:56.024797+00:00',
      reason: iterationsIncompleteReason,
      room_id: 'gym',
      room_name: 'Gym',
      sequence: 101,
      session_id: 'session-v2',
      type: 'attempt',
    },
    {
      attempt_mode: 'vacuum',
      attempt_result: 'uncertain',
      day: '2026-09-18',
      evidence: officeEvidence,
      id: 'session-v2:office:attempt',
      kind: 'failed',
      occurred_at: '2026-09-18T15:31:19.933826+00:00',
      reason: telemetryOutageReason,
      room_id: 'office',
      room_name: 'Office',
      sequence: 102,
      session_id: 'session-v2',
      type: 'attempt',
    },
    {
      attempt_mode: 'vacuum_mop',
      attempt_result: 'partial',
      day: '2026-09-18',
      evidence: livingRoomEvidence,
      id: 'session-v2:living-room:attempt',
      kind: 'failed',
      occurred_at: '2026-09-18T15:40:00+00:00',
      reason: partialReason,
      room_id: 'living_room',
      room_name: 'Living Room',
      sequence: 103,
      session_id: 'session-v2',
      type: 'attempt',
    },
  ],
  rooms: [
    {
      credit: { operation: null, status: 'none' },
      event_ids: ['session-v2:gym:attempt'],
      first_occurred_at: '2026-09-18T15:24:56.024797+00:00',
      last_occurred_at: '2026-09-18T15:24:56.024797+00:00',
      last_sequence: 101,
      latest_attempt: {
        evidence: gymEvidence,
        event_id: 'session-v2:gym:attempt',
        mode: 'vacuum',
        reason: iterationsIncompleteReason,
        result: 'uncertain',
      },
      occurrence_count: 1,
      outstanding: {
        operation: 'vacuum',
        reason: iterationsIncompleteReason,
      },
      reasons_coincide: true,
      required_operation: 'vacuum',
      room_id: 'gym',
      room_name: 'Gym',
      status: 'uncertain',
    },
    {
      credit: { operation: null, status: 'none' },
      event_ids: ['session-v2:office:attempt'],
      first_occurred_at: '2026-09-18T15:31:19.933826+00:00',
      last_occurred_at: '2026-09-18T15:31:19.933826+00:00',
      last_sequence: 102,
      latest_attempt: {
        evidence: officeEvidence,
        event_id: 'session-v2:office:attempt',
        mode: 'vacuum',
        reason: telemetryOutageReason,
        result: 'uncertain',
      },
      occurrence_count: 1,
      outstanding: {
        operation: 'vacuum',
        reason: telemetryOutageReason,
      },
      reasons_coincide: true,
      required_operation: 'vacuum',
      room_id: 'office',
      room_name: 'Office',
      status: 'uncertain',
    },
    {
      credit: { operation: 'vacuum', status: 'partial' },
      event_ids: ['session-v2:living-room:attempt'],
      first_occurred_at: '2026-09-18T15:40:00+00:00',
      last_occurred_at: '2026-09-18T15:40:00+00:00',
      last_sequence: 103,
      latest_attempt: {
        evidence: livingRoomEvidence,
        event_id: 'session-v2:living-room:attempt',
        mode: 'vacuum_mop',
        reason: partialReason,
        result: 'partial',
      },
      occurrence_count: 1,
      outstanding: {
        operation: 'mop',
        reason: partialReason,
      },
      reasons_coincide: true,
      required_operation: 'vacuum_mop',
      room_id: 'living_room',
      room_name: 'Living Room',
      status: 'partial',
    },
  ],
  version: 2,
}

export const INCOMPLETE_V2_VACUUM_OUTCOME_PAYLOAD = {
  ...EVIDENCE_FREE_V2_VACUUM_OUTCOME_PAYLOAD,
  complete: false,
}

export const MALFORMED_V2_VACUUM_OUTCOME_PAYLOAD = {
  ...EVIDENCE_FREE_V2_VACUUM_OUTCOME_PAYLOAD,
  rooms: [
    {
      ...EVIDENCE_FREE_V2_VACUUM_OUTCOME_PAYLOAD.rooms[0],
      room_name: '',
    },
  ],
}

export const FUTURE_VACUUM_OUTCOME_PAYLOAD = {
  ...EVIDENCE_FREE_V2_VACUUM_OUTCOME_PAYLOAD,
  version: 3,
}
