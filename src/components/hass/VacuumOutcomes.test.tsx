// @covers src/components/hass/vacuumOutcomePresentation.ts
// @covers src/i18n/locales/en/modals/vacuum.json
import { fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { VACUUMS } from '../../constants/portedDashboard'
import { copy, type CopyKey, type CopyValues } from '../../i18n'
import {
  EVIDENCE_FREE_V2_VACUUM_OUTCOME_PAYLOAD,
  EVIDENCE_RICH_V2_VACUUM_OUTCOME_PAYLOAD,
  FUTURE_VACUUM_OUTCOME_PAYLOAD,
  INCOMPLETE_V2_VACUUM_OUTCOME_PAYLOAD,
  LEGACY_VACUUM_OUTCOMES,
  MALFORMED_V2_VACUUM_OUTCOME_PAYLOAD,
  NINE_ROOM_VACUUM_OUTCOME_CONTRACT,
} from '../../test/fixtures/vacuumOutcomes'
import { parseVacuumOutcomeContract, vacuumWhileAwayPresentation, type VacuumOutcomeContract, type VacuumOutcomeReason } from './vacuumOutcomes'
import {
  VacuumOutcomeDetail,
  VacuumOutcomeOverview,
  VacuumOutcomeProtocolNotice,
} from './VacuumOutcomes'
import { countVacuumOutcomes, vacuumOutcomeReasonValue } from './vacuumOutcomePresentation'

const styles = readFileSync(resolve(process.cwd(), 'src/components/hass/VacuumOutcomes.module.css'), 'utf8')
const vacuum = VACUUMS.find((candidate) => candidate.coordinatorSessionEntityId)!

function cloneContract() {
  return structuredClone(NINE_ROOM_VACUUM_OUTCOME_CONTRACT)
}

function parsedContract(payload: unknown): VacuumOutcomeContract {
  const contract = parseVacuumOutcomeContract(structuredClone(payload))
  if (!contract) throw new Error('Expected valid vacuum outcome fixture')
  return contract
}

function record(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected record fixture')
  return value as Record<string, unknown>
}

function historicalLostMopContract() {
  const payload = structuredClone(EVIDENCE_RICH_V2_VACUUM_OUTCOME_PAYLOAD)
  const room = record(payload.rooms[2])
  const attempt = record(room.latest_attempt)
  const event = record(payload.events[2])
  const historicalReason = { category: 'unknown', code: 'unknown', data: {}, raw: 'Lost mop pad' }
  room.room_id = 'dining_room'
  room.room_name = 'Dining Room'
  room.status = 'interrupted'
  attempt.result = 'interrupted'
  attempt.reason = structuredClone(historicalReason)
  room.credit = { operation: null, status: 'none' }
  room.outstanding = { operation: 'vacuum_mop', reason: structuredClone(historicalReason) }
  event.room_id = 'dining_room'
  event.room_name = 'Dining Room'
  event.kind = 'failed'
  event.attempt_result = 'interrupted'
  event.reason = structuredClone(historicalReason)
  return parsedContract(payload)
}

function protocolPresentation(payload: unknown) {
  const presentation = vacuumWhileAwayPresentation({
    ...LEGACY_VACUUM_OUTCOMES,
    while_away_outcomes: structuredClone(payload),
  })
  if (
    presentation.kind !== 'incomplete'
    && presentation.kind !== 'malformed'
    && presentation.kind !== 'incompatible'
  ) {
    throw new Error('Expected protocol presentation fixture')
  }
  return presentation
}

function contractForRooms(roomIds: string[]) {
  const contract = cloneContract()
  contract.rooms = contract.rooms.filter((room) => roomIds.includes(room.room_id))
  const eventIds = new Set(contract.rooms.flatMap((room) => room.event_ids))
  contract.events = contract.events.filter((event) => eventIds.has(event.id))
  return contract
}

function reason(code: string, data: Record<string, unknown> = {}): VacuumOutcomeReason {
  return { category: 'test', code, data, raw: `RAW ${code}` }
}

function translatedReason(outcomeReason: VacuumOutcomeReason, roomNames: Record<string, string> = {}) {
  return vacuumOutcomeReasonValue(
    (key: CopyKey<'modalVacuum'>, values?: CopyValues) => copy('modalVacuum', key, values),
    outcomeReason,
    roomNames,
  )
}

describe('VacuumOutcomeOverview', () => {
  it('renders one compact modal opener with authoritative complete and outstanding counts', () => {
    const onOpen = vi.fn()
    render(<VacuumOutcomeOverview contract={cloneContract()} onOpen={onOpen} vacuum={vacuum} />)

    expect(screen.getByRole('heading', { name: 'Main Floor Cleaning Report (9)' })).toBeInTheDocument()
    const opener = screen.getByRole('button', { name: 'Open Main Floor Automatic Cleaning Report for Aug 19, 2026' })
    expect(opener).toHaveAttribute('data-action-kind', 'modal')
    expect(opener).toHaveAttribute('data-modal-opener', 'true')
    expect(opener.parentElement).toHaveAttribute('data-modal-detail-trigger', 'vacuum-outcomes')
    expect(opener.querySelector('[data-modal-disclosure="right-chevron"]')).toBeInTheDocument()
    expect(opener).toHaveAttribute('data-tone', 'danger')
    expect(opener).toHaveAttribute('data-icon', 'mdi:alert-circle')
    expect(opener).toHaveTextContent('Aug 19, 2026')
    expect(opener).toHaveTextContent('4 Rooms Completed • 4 Rooms Need Attention • 1 Error')

    fireEvent.click(opener)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('renders an all-complete summary while keeping detail available', () => {
    const contract = contractForRooms(['gym', 'office', 'guest_room', 'master_bedroom_closet'])
    render(<VacuumOutcomeOverview contract={contract} onOpen={() => undefined} vacuum={vacuum} />)

    const opener = screen.getByRole('button', { name: /Open Main Floor Automatic Cleaning Report/ })
    expect(opener).toHaveTextContent('4 Rooms Completed')
    expect(opener).not.toHaveTextContent('Need Attention')
    expect(opener).not.toHaveTextContent('Errors')
    expect(opener).toHaveAttribute('data-tone', 'presence')
  })

  it('omits completed counts when only attention and errors are pertinent', () => {
    const contract = contractForRooms(['dining_room'])
    render(<VacuumOutcomeOverview contract={contract} onOpen={() => undefined} vacuum={vacuum} />)

    const opener = screen.getByRole('button', { name: /Open Main Floor Automatic Cleaning Report/ })
    expect(opener).toHaveTextContent('1 Room Needs Attention • 1 Error')
    expect(opener).not.toHaveTextContent('Completed')
  })

  it('keeps interrupted rooms out of the Needs Attention subtitle metric', () => {
    const contract = contractForRooms(['gym', 'hallway'])
    render(<VacuumOutcomeOverview contract={contract} onOpen={() => undefined} vacuum={vacuum} />)

    const opener = screen.getByRole('button', { name: /Open Main Floor Automatic Cleaning Report/ })
    expect(opener).toHaveTextContent('1 Room Completed')
    expect(opener).not.toHaveTextContent('Need Attention')
    expect(opener).not.toHaveTextContent('Error')
    expect(opener).toHaveAttribute('data-tone', 'security')
    expect(opener).toHaveAttribute('data-icon', 'mdi:pause-circle')
  })

  it('states the all-room denominator when detail includes completed and interrupted rooms', () => {
    const contract = contractForRooms(['dining_room', 'kitchen', 'master_bathroom', 'gym', 'hallway'])
    render(
      <>
        <VacuumOutcomeOverview contract={contract} onOpen={() => undefined} vacuum={vacuum} />
        <VacuumOutcomeDetail contract={contract} vacuum={vacuum} />
      </>,
    )

    expect(screen.getByRole('heading', { name: 'Main Floor Cleaning Report (5)' })).toBeInTheDocument()
    const opener = screen.getByRole('button', { name: /Open Main Floor Automatic Cleaning Report/ })
    expect(opener).toHaveTextContent('1 Room Completed • 3 Rooms Need Attention • 1 Error')
    expect(document.querySelectorAll('[data-vacuum-outcome-chip="true"]')).toHaveLength(5)
  })

  it('keeps unverified completion distinct from errors and outstanding work', () => {
    render(
      <VacuumOutcomeOverview
        contract={parsedContract(EVIDENCE_RICH_V2_VACUUM_OUTCOME_PAYLOAD)}
        onOpen={() => undefined}
        vacuum={vacuum}
      />,
    )

    const opener = screen.getByRole('button', { name: /Open Main Floor Automatic Cleaning Report/ })
    expect(opener).toHaveTextContent('2 Rooms Unverified • 3 Rooms Need Attention')
    expect(opener).not.toHaveTextContent('Error')
    expect(opener).toHaveAttribute('data-tone', 'warning')
    expect(opener).toHaveAttribute('data-icon', 'mdi:help-circle-outline')
  })
})

describe('VacuumOutcomeDetail', () => {
  it('renders one noninteractive status chip per room in backend order', () => {
    render(<VacuumOutcomeDetail contract={cloneContract()} vacuum={vacuum} />)

    const detail = document.querySelector('[data-vacuum-outcome-detail="true"]')
    const grid = screen.getByRole('group', { name: 'Main Floor Cleaning Report' })
    const chips = [...document.querySelectorAll<HTMLElement>('[data-vacuum-outcome-chip="true"]')]

    expect(detail).toHaveAttribute('data-modal-detail-autofocus', 'true')
    expect(grid).toHaveAttribute('data-dynamic-grid-item-sizing', 'uniform')
    expect(grid).toHaveAttribute('data-dynamic-grid-layout', 'fill')
    expect(chips.map((chip) => chip.dataset.roomId)).toEqual([
      'dining_room',
      'kitchen',
      'master_bathroom',
      'guest_bathroom',
      'gym',
      'office',
      'guest_room',
      'master_bedroom_closet',
      'hallway',
    ])
    expect(chips.every((chip) => chip.dataset.actionKind === 'state')).toBe(true)
    expect(document.querySelector('[data-group]')).not.toBeInTheDocument()
    expect(document.querySelector('[data-modal-disclosure]')).not.toBeInTheDocument()
    expect(screen.queryByText('Room Event History')).not.toBeInTheDocument()
    expect(screen.queryByText('Cleaning Evidence')).not.toBeInTheDocument()
    expect(screen.queryByText('Vacuum Diagnostics')).not.toBeInTheDocument()
    expect(within(detail as HTMLElement).queryByRole('button')).not.toBeInTheDocument()

    const failed = document.querySelector<HTMLElement>('[data-room-id="dining_room"]')!
    const failedPill = within(failed).getByRole('group')
    expect(failedPill).toHaveAttribute('data-tone', 'danger')
    expect(failedPill).toHaveAttribute('data-icon', 'mdi:alert-circle')
    expect(failedPill).toHaveAccessibleName(
      "Dining Room Failed The mop dock's clean-water tank was empty; refill it.",
    )

    const deferred = document.querySelector<HTMLElement>('[data-room-id="kitchen"]')!
    expect(within(deferred).getByRole('group')).toHaveAttribute('data-tone', 'warning')
    expect(within(deferred).getByRole('group')).toHaveAttribute('data-icon', 'mdi:clock-outline')
    expect(deferred).toHaveTextContent("The mop dock's clean-water tank was empty; refill it.")
    expect(deferred).not.toHaveTextContent('Vacuuming and mopping were deferred before any attempt.')

    const completed = document.querySelector<HTMLElement>('[data-room-id="gym"]')!
    expect(within(completed).getByRole('group')).toHaveAttribute('data-tone', 'ok')
    expect(within(completed).getByRole('group')).toHaveAttribute('data-icon', 'mdi:check-circle')
    expect(completed).toHaveTextContent('Vacuuming completed for the room.')

    const interrupted = document.querySelector<HTMLElement>('[data-room-id="hallway"]')!
    expect(within(interrupted).getByRole('group')).toHaveAttribute('data-tone', 'warning')
    expect(within(interrupted).getByRole('group')).toHaveAttribute('data-icon', 'mdi:pause-circle')
    expect(interrupted).toHaveTextContent('Cleaning was interrupted because someone returned home.')
  })

  it('uses one concise status detail for uncertainty and partial completion', () => {
    render(<VacuumOutcomeDetail contract={parsedContract(EVIDENCE_RICH_V2_VACUUM_OUTCOME_PAYLOAD)} vacuum={vacuum} />)

    const gym = document.querySelector<HTMLElement>('[data-room-id="gym"]')!
    expect(within(gym).getByRole('group')).toHaveAttribute('data-tone', 'warning')
    expect(within(gym).getByRole('group')).toHaveAttribute('data-icon', 'mdi:help-circle-outline')
    expect(gym).toHaveTextContent('Completion Unverified')
    expect(gym).toHaveTextContent('Observed 1 of 2 requested iterations.')
    expect(gym).not.toHaveTextContent('Vacuuming completion could not be verified.')
    expect(gym).not.toHaveTextContent('Vacuuming remains due.')
    expect(gym).not.toHaveTextContent('Physical Work')

    const office = document.querySelector<HTMLElement>('[data-room-id="office"]')!
    expect(office).toHaveTextContent('Telemetry recovery was not coherent within 300 seconds.')
    expect(office).not.toHaveTextContent('Passed Lower Bound')
    expect(office).not.toHaveTextContent('Source Outage Duration')

    const livingRoom = document.querySelector<HTMLElement>('[data-room-id="living_room"]')!
    expect(within(livingRoom).getByRole('group')).toHaveAttribute('data-tone', 'warning')
    expect(within(livingRoom).getByRole('group')).toHaveAttribute('data-icon', 'mdi:progress-check')
    expect(livingRoom).toHaveTextContent('Partially Complete')
    expect(livingRoom).toHaveTextContent('Mopping remains due.')
    expect(livingRoom).not.toHaveTextContent('Home Assistant credited vacuuming')
    expect(livingRoom).not.toHaveTextContent("The mop dock's clean-water tank was empty")

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('presents a reconciled attempt as a consistent completed chip', () => {
    const presentation = vacuumWhileAwayPresentation(
      { while_away_outcomes: structuredClone(EVIDENCE_RICH_V2_VACUUM_OUTCOME_PAYLOAD) },
      { gym: 'session-v2:gym:attempt' },
    )
    if (presentation.kind !== 'typed') throw new Error('Expected reconciled typed presentation')

    render(<VacuumOutcomeDetail contract={presentation.contract} vacuum={vacuum} />)

    const gym = document.querySelector<HTMLElement>('[data-room-id="gym"]')!
    expect(gym).toHaveAttribute('data-reconciled', 'true')
    expect(gym).toHaveAttribute('data-status', 'completed')
    expect(within(gym).getByRole('group')).toHaveAttribute('data-tone', 'ok')
    expect(gym).toHaveTextContent('Completed')
    expect(gym).toHaveTextContent('Vacuuming completed for the room.')
    expect(gym).not.toHaveTextContent('Observed 1 of 2 requested iterations.')
    expect(gym).not.toHaveTextContent('Vacuuming remains due.')
  })

  it('falls back to the safe primary outcome when a reason is unknown or optional evidence is malformed', () => {
    const evidenceFree = parsedContract(EVIDENCE_FREE_V2_VACUUM_OUTCOME_PAYLOAD)
    const view = render(<VacuumOutcomeDetail contract={evidenceFree} vacuum={vacuum} />)

    const office = document.querySelector<HTMLElement>('[data-room-id="office"]')!
    expect(office).toHaveTextContent('Vacuuming completion could not be verified.')
    expect(office).not.toHaveTextContent('The vacuum outcome reason was not recognized.')
    expect(office).not.toHaveTextContent('Floor completion time was unavailable during dock servicing after error sensor is unavailable')

    const payload = structuredClone(EVIDENCE_RICH_V2_VACUUM_OUTCOME_PAYLOAD)
    const room = record(payload.rooms[0])
    const attempt = record(room.latest_attempt)
    record(record(attempt.evidence).duration).minimum = 'bad'
    view.rerender(<VacuumOutcomeDetail contract={parsedContract(payload)} vacuum={vacuum} />)

    const gym = document.querySelector<HTMLElement>('[data-room-id="gym"]')!
    expect(gym).toHaveTextContent('Observed 1 of 2 requested iterations.')
    expect(gym).not.toHaveTextContent('Evidence Unavailable')
  })

  it('keeps failed rooms to one principal explanation even when partial credit exists', () => {
    const contract = contractForRooms(['dining_room'])
    const view = render(<VacuumOutcomeDetail contract={contract} vacuum={vacuum} />)

    const fullFailure = document.querySelector<HTMLElement>('[data-room-id="dining_room"]')!
    expect(fullFailure).toHaveTextContent("The mop dock's clean-water tank was empty; refill it.")
    expect(fullFailure).not.toHaveTextContent('Vacuuming and mopping remain.')
    expect(fullFailure).not.toHaveTextContent('Vacuuming and mopping the room failed.')

    contract.rooms[0].credit = { operation: 'vacuum', status: 'partial' }
    contract.rooms[0].outstanding = { operation: 'mop', reason: contract.rooms[0].outstanding?.reason ?? null }
    view.rerender(<VacuumOutcomeDetail contract={contract} vacuum={vacuum} />)

    const partialFailure = document.querySelector<HTMLElement>('[data-room-id="dining_room"]')!
    expect(partialFailure).toHaveTextContent("The mop dock's clean-water tank was empty; refill it.")
    expect(partialFailure).not.toHaveTextContent('Vacuuming is complete; mopping remains.')
    expect(partialFailure).not.toHaveTextContent('Mopping remains due.')
  })

  it('keeps a vacuum-only failure concise and does not manufacture remaining-work copy', () => {
    const contract = contractForRooms(['office'])
    const room = contract.rooms[0]
    const failedEvent = contract.events[0]
    if (failedEvent.type !== 'attempt') throw new Error('Expected attempt fixture')
    room.status = 'failed'
    room.credit = { operation: null, status: 'none' }
    room.latest_attempt = {
      event_id: failedEvent.id,
      mode: failedEvent.attempt_mode,
      reason: failedEvent.reason,
      result: 'failed',
    }
    room.outstanding = { operation: 'vacuum', reason: failedEvent.reason }

    render(<VacuumOutcomeDetail contract={contract} vacuum={vacuum} />)

    const office = document.querySelector<HTMLElement>('[data-room-id="office"]')!
    expect(office).toHaveTextContent('The auto-empty dock dust bag was full or its dust duct was blocked.')
    expect(office).not.toHaveTextContent('Vacuuming remains')
  })

  it('uses the primary attempt sentence instead of raw or parser-oriented unknown reason copy', () => {
    const contract = contractForRooms(['dining_room'])
    const room = contract.rooms[0]
    const event = contract.events.find((candidate) => candidate.id === room.latest_attempt?.event_id)!
    const unknown = reason('unknown')
    event.reason = unknown
    room.latest_attempt = { ...room.latest_attempt!, reason: unknown }
    room.outstanding = { operation: 'vacuum_mop', reason: unknown }
    room.reasons_coincide = true

    render(<VacuumOutcomeDetail contract={contract} vacuum={vacuum} />)

    const chip = document.querySelector<HTMLElement>('[data-room-id="dining_room"]')!
    expect(chip).toHaveTextContent('Vacuuming and mopping the room failed.')
    expect(chip).not.toHaveTextContent('The vacuum outcome reason was not recognized.')
    expect(chip).not.toHaveTextContent(unknown.raw)
  })

  it('renders the historical lost-mop payload with the canonical attachment guidance', () => {
    render(<VacuumOutcomeDetail contract={historicalLostMopContract()} vacuum={vacuum} />)

    const chip = document.querySelector<HTMLElement>('[data-room-id="dining_room"]')!
    expect(chip).toHaveTextContent('Interrupted')
    expect(chip).toHaveTextContent("The vacuum's mop attachment was missing; attach it before mopping.")
    expect(chip).not.toHaveTextContent('Vacuuming and mopping the room was interrupted.')
    expect(chip).not.toHaveTextContent('Lost mop pad')
  })

  it('defines only the status-chip layout for room outcomes', () => {
    expect(styles).toMatch(/\.outcomeGrid\s*\{[^}]*width:\s*100%;/s)
    expect(styles).toMatch(/\.roomChip\s*\{[^}]*min-width:\s*0;[^}]*height:\s*100%;/s)
    expect(styles).not.toMatch(/\.roomRow|\.groupHeader|\.historyButton|\.evidenceButton|\.diagnosticsButton/)
    expect(styles).not.toMatch(/:active/)
    expect(styles).not.toMatch(/chevron/i)
  })
})

describe('VacuumOutcomeProtocolNotice', () => {
  it.each([
    [
      'incomplete',
      INCOMPLETE_V2_VACUUM_OUTCOME_PAYLOAD,
      'Report Still Being Prepared',
      'Final counts are not available.',
    ],
    [
      'malformed',
      MALFORMED_V2_VACUUM_OUTCOME_PAYLOAD,
      'Report Could Not Be Read',
      'Structured cleaning results are unavailable.',
    ],
    [
      'incompatible',
      FUTURE_VACUUM_OUTCOME_PAYLOAD,
      'Dashboard Update Required',
      'This cleaning report uses an unsupported version.',
    ],
  ])('renders an explicit %s report state with collapsed secondary legacy details', (
    kind,
    payload,
    title,
    description,
  ) => {
    const presentation = protocolPresentation(payload)
    render(<VacuumOutcomeProtocolNotice presentation={presentation} vacuum={vacuum} />)

    const notice = document.querySelector(`[data-vacuum-outcome-protocol="${kind}"]`)
    expect(notice).toBeInTheDocument()
    expect(screen.getByText(title)).toBeInTheDocument()
    expect(screen.getByText(description)).toBeInTheDocument()
    expect(screen.getByText('Cleaned Gym')).not.toBeVisible()
    expect(screen.getByText('Could not clean Dining Room because the clean water tank is empty')).not.toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Show Main Floor Unstructured Report Details' }))
    expect(screen.getByText('These details may be inconsistent with the typed status.')).toBeVisible()
    expect(screen.getByText('Cleaned Gym')).toBeVisible()
    expect(screen.getByText('Could not clean Dining Room because the clean water tank is empty')).toBeVisible()
  })
})

describe('vacuum outcome reason copy', () => {
  const cases: Array<[string, VacuumOutcomeReason, Record<string, string>?]> = [
    ['fresh water missing', reason('mop.fresh_water_unavailable', { state: 'missing' })],
    ['fresh water unknown', reason('mop.fresh_water_unavailable', { state: 'unknown' })],
    ['fresh water unavailable', reason('mop.fresh_water_unavailable', { state: 'unavailable' })],
    ['clean water empty', reason('mop.clean_water_empty')],
    ['dustbag or duct', reason('dock.dustbag_full_or_duct_blocked')],
    ['someone returned', reason('occupancy.person_arrived')],
    ['low battery', reason('power.low_battery')],
    ['dispatch timeout', reason('dispatch.timeout', { timeout_seconds: 30 })],
    ['dispatch failed', reason('dispatch.failed')],
    ['short duration', reason('verification.duration_below_minimum', { minimum_seconds: 120, observed_seconds: 60 })],
    ['small area', reason('verification.area_below_minimum', { minimum_area: 1000, observed_area: 400 })],
    ['short dwell', reason('verification.estimated_dwell_below_minimum', { minimum_seconds: 30, observed_seconds: 12 })],
    ['wrong room', reason('verification.wrong_room', {
      commanded_room_id: 'office',
      commanded_seconds: 20,
      dominant_room_id: 'hallway',
      dominant_seconds: 45,
    }), { hallway: 'Hallway', office: 'Office' }],
    ['stuck', reason('navigation.stuck')],
    ['room unreachable', reason('navigation.room_unreachable')],
    ['dock unreachable', reason('navigation.dock_unreachable')],
    ['resume timeout', reason('recovery.native_resume_timeout', { timeout_seconds: 90 })],
    ['cleaning not observed', reason('execution.cleaning_not_observed')],
    ['segment not observed', reason('execution.segment_not_observed')],
    ['cancelled', reason('operation.cancelled')],
    ['attachment missing', reason('mop.attachment_missing')],
    ['dirty water', reason('mop.dirty_water_unavailable')],
    ['detergent', reason('mop.detergent_unavailable')],
    ['mop hardware', reason('mop.hardware_unavailable')],
    ['ambiguous duration attribution', reason('telemetry.counter_attribution_ambiguous', { measurement: 'time' })],
    ['ambiguous area attribution', reason('telemetry.counter_attribution_ambiguous', { measurement: 'area' })],
    ['unresolved telemetry outage', reason('telemetry.source_outage_unresolved', { timeout_seconds: 300 })],
    ['telemetry identity conflict', reason('telemetry.task_identity_conflict')],
    ['incomplete iterations', reason('verification.iterations_incomplete', { observed_iterations: 1, requested_iterations: 2 })],
    ['uncertain iterations', reason('verification.iterations_uncertain')],
    ['unavailable duration measurement', reason('verification.measurement_unavailable', { measurement: 'time' })],
    ['unavailable area measurement', reason('verification.measurement_unavailable', { measurement: 'area' })],
    ['unknown code', reason('future.new_reason')],
  ]

  it.each(cases)('localizes %s without rendering raw diagnostics or missing markers', (_name, outcomeReason, roomNames = {}) => {
    const rendered = translatedReason(outcomeReason, roomNames)
    expect(rendered).not.toContain('[missing:')
    expect(rendered).not.toContain(outcomeReason.raw)
  })

  it.each([
    [
      'dispatch.timeout',
      {},
      'The room-cleaning request timed out without a verified duration; try again.',
    ],
    [
      'recovery.native_resume_timeout',
      {},
      'The vacuum resume request timed out without a verified duration; try again.',
    ],
    [
      'verification.duration_below_minimum',
      {},
      'Room-cleaning duration fell below the required minimum without verified values; retry.',
    ],
    [
      'verification.area_below_minimum',
      { minimum_area: 1000, observed_area: 400 },
      'The cleaned area of the room was below the required minimum.',
    ],
    [
      'verification.estimated_dwell_below_minimum',
      {},
      'Estimated time in the requested room was below the required minimum; reliable values were unavailable.',
    ],
  ])('keeps recognized %s reasons specific when structured values are incomplete', (code, data, expected) => {
    const rendered = translatedReason(reason(code, data))
    expect(rendered).toBe(expected)
    expect(rendered).not.toBe('The vacuum outcome reason was not recognized.')
    expect(rendered).not.toMatch(/\b(?:400|1000)\b/)
  })

  it('uses a roomless wrong-room sentence when a configured title cannot be resolved', () => {
    const rendered = translatedReason(reason('verification.wrong_room', {
      commanded_room_id: 'office',
      commanded_seconds: 20,
      dominant_room_id: 'unmapped',
      dominant_seconds: 45,
    }), { office: 'Office' })

    expect(rendered).toBe('Observed cleaning time was dominated elsewhere, with 45 seconds versus 20 seconds in the requested room.')
  })

  it('uses an uncertainty-specific generic explanation for an unknown future reason', () => {
    const rendered = vacuumOutcomeReasonValue(
      (key: CopyKey<'modalVacuum'>, values?: CopyValues) => copy('modalVacuum', key, values),
      reason('future.new_uncertain_reason'),
      {},
      'uncertain',
    )

    expect(rendered).toBe('Completion could not be verified from the available vacuum data.')
  })

  it('summarizes the exact nine-room state without reducing event history', () => {
    expect(countVacuumOutcomes(cloneContract())).toMatchObject({
      attention: 1,
      completed: 4,
      due: 5,
      interrupted: 1,
      needsAttention: 4,
      unverified: 0,
    })
  })

  it('counts v2 uncertainty separately while deriving outstanding work from the projection', () => {
    expect(countVacuumOutcomes(parsedContract(EVIDENCE_RICH_V2_VACUUM_OUTCOME_PAYLOAD))).toEqual({
      attention: 0,
      completed: 0,
      due: 3,
      interrupted: 0,
      needsAttention: 3,
      unverified: 2,
    })
  })
})
