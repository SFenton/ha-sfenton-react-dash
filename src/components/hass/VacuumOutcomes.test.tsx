import { fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { VACUUMS } from '../../constants/portedDashboard'
import { copy, type CopyKey, type CopyValues } from '../../i18n'
import { NINE_ROOM_VACUUM_OUTCOME_CONTRACT } from '../../test/fixtures/vacuumOutcomes'
import type { VacuumOutcomeReason } from './vacuumOutcomes'
import {
  VacuumOutcomeDetail,
  VacuumOutcomeOverview,
} from './VacuumOutcomes'
import { countVacuumOutcomes, vacuumOutcomeReasonValue } from './vacuumOutcomePresentation'

const styles = readFileSync(resolve(process.cwd(), 'src/components/hass/VacuumOutcomes.module.css'), 'utf8')
const vacuum = VACUUMS.find((candidate) => candidate.coordinatorSessionEntityId)!

function cloneContract() {
  return structuredClone(NINE_ROOM_VACUUM_OUTCOME_CONTRACT)
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

    expect(screen.getByRole('heading', { name: 'While You Were Away' })).toBeInTheDocument()
    const opener = screen.getByRole('button', { name: 'Open Main Floor Cleaning Outcomes for Aug 19, 2026' })
    expect(opener).toHaveAttribute('data-action-kind', 'modal')
    expect(opener).toHaveAttribute('data-modal-detail-trigger', 'vacuum-outcomes')
    expect(opener.querySelector('[data-modal-disclosure="right-chevron"]')).toBeInTheDocument()
    expect(opener).toHaveTextContent('4 Rooms Done Today')
    expect(opener).toHaveTextContent('5 Rooms Need Cleaning')
    expect(opener).toHaveTextContent('1 Room Failure • Review')
    expect(opener).toHaveTextContent('1 Room Interruption')

    fireEvent.click(opener)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('renders an all-complete summary while keeping detail available', () => {
    const contract = contractForRooms(['gym', 'office', 'guest_room', 'master_bedroom_closet'])
    render(<VacuumOutcomeOverview contract={contract} onOpen={() => undefined} vacuum={vacuum} />)

    const opener = screen.getByRole('button', { name: /Open Main Floor Cleaning Outcomes/ })
    expect(opener).toHaveTextContent('4 Rooms Done Today')
    expect(opener).toHaveTextContent('0 Rooms Need Cleaning')
    expect(opener).toHaveTextContent('All Rooms Complete')
  })
})

describe('VacuumOutcomeDetail', () => {
  it('groups one authoritative row per room in fixed order and collapses completed rooms', () => {
    render(<VacuumOutcomeDetail contract={cloneContract()} vacuum={vacuum} />)

    const groupButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-group] > button')]
    expect(groupButtons.map((button) => button.textContent)).toEqual([
      'Needs Attention1',
      'Interrupted1',
      'Work Still Due3',
      'Fully Completed4',
    ])
    expect(groupButtons.map((button) => button.getAttribute('aria-expanded'))).toEqual(['true', 'true', 'true', 'false'])
    expect(screen.getAllByLabelText('Dining Room Failed')).toHaveLength(1)
    expect(screen.getByLabelText('Hallway Interrupted')).toBeInTheDocument()
    expect(screen.getByLabelText('Kitchen Not Attempted')).toBeInTheDocument()
    expect(groupButtons[0]).toHaveAttribute('data-modal-detail-autofocus', 'true')
    expect(groupButtons.every((button) => button.getAttribute('data-action-kind') === 'command')).toBe(true)
    expect(document.querySelector('[data-modal-disclosure="right-chevron"]')).not.toBeInTheDocument()
  })

  it('shows Dining as one failed row with two attempts, four history events, and one repeated cause', () => {
    render(<VacuumOutcomeDetail contract={cloneContract()} vacuum={vacuum} />)

    const row = screen.getByLabelText('Dining Room Failed')
    const collapsed = row.children[1] as HTMLElement
    expect(within(collapsed).getByText('Vacuuming and mopping the room failed.')).toBeInTheDocument()
    expect(within(collapsed).getByText('Combined vacuuming and mopping remain due.')).toBeInTheDocument()
    expect(within(collapsed).getAllByText("The mop dock's clean-water tank was empty; refill it.")).toHaveLength(1)
    const history = within(row).getByRole('button', { name: 'Show Dining Room History' })
    expect(history).toHaveAttribute('data-action-kind', 'command')
    expect(history).toHaveAttribute('aria-expanded', 'false')
    expect(within(history).getByText('2')).toBeInTheDocument()
    expect(within(row).getByText('2 Clean Attempts').className).toContain('visuallyHidden')

    fireEvent.click(history)
    expect(history).toHaveAttribute('aria-expanded', 'true')
    expect(within(row).getAllByRole('listitem')).toHaveLength(4)
  })

  it('keeps Office completed while retaining its prior failed attempt in history', () => {
    render(<VacuumOutcomeDetail contract={cloneContract()} vacuum={vacuum} />)
    fireEvent.click(screen.getByRole('button', { name: /Fully Completed/ }))

    const office = screen.getByLabelText('Office Completed')
    expect(within(office.children[1] as HTMLElement).getByText('Vacuuming completed for the room.')).toBeInTheDocument()
    const history = within(office).getByRole('button', { name: 'Show Office History' })
    fireEvent.click(history)
    const events = within(office).getAllByRole('listitem')
    expect(events).toHaveLength(2)
    expect(events[0]).toHaveTextContent('Vacuuming the room without mopping failed.')
    expect(events[0]).toHaveTextContent('The auto-empty dock dust bag was full or its dust duct was blocked.')
    expect(events[1]).toHaveTextContent('Vacuuming completed for the room.')
  })

  it('leaves a routine one-event completion as noninteractive state', () => {
    render(<VacuumOutcomeDetail contract={contractForRooms(['gym'])} vacuum={vacuum} />)

    const gym = screen.getByLabelText('Gym Completed')
    expect(gym).toHaveAttribute('data-action-kind', 'state')
    expect(within(gym).queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders fallback partial credit and distinct fallback failure reasons truthfully', () => {
    const partial = contractForRooms(['dining_room'])
    const partialRoom = partial.rooms[0]
    const fallbackEvent = partial.events.find((event) => event.id === 'session-two:dining-room:attempt')!
    if (fallbackEvent.type !== 'attempt') throw new Error('Expected attempt fixture')
    fallbackEvent.attempt_mode = 'fallback_vacuum'
    fallbackEvent.attempt_result = 'completed'
    fallbackEvent.reason = null
    partialRoom.status = 'partial'
    partialRoom.credit = { operation: 'vacuum', status: 'partial' }
    partialRoom.latest_attempt = {
      event_id: fallbackEvent.id,
      mode: 'fallback_vacuum',
      reason: null,
      result: 'completed',
    }
    partialRoom.outstanding = {
      operation: 'mop',
      reason: partial.events[0].reason,
    }
    partialRoom.reasons_coincide = false

    const view = render(<VacuumOutcomeDetail contract={partial} vacuum={vacuum} />)
    const partialRow = screen.getByLabelText('Dining Room Partially Complete')
    expect(partialRow).toHaveTextContent('Fallback vacuuming completed for the room; mopping was not confirmed.')
    expect(partialRow).toHaveTextContent('Mopping remains due.')

    const failed = contractForRooms(['dining_room'])
    const failedRoom = failed.rooms[0]
    const failedEvent = failed.events.find((event) => event.id === 'session-two:dining-room:attempt')!
    if (failedEvent.type !== 'attempt') throw new Error('Expected attempt fixture')
    const unreachable = reason('navigation.room_unreachable')
    failedEvent.attempt_mode = 'fallback_vacuum'
    failedEvent.attempt_result = 'failed'
    failedEvent.reason = unreachable
    failedRoom.latest_attempt = {
      event_id: failedEvent.id,
      mode: 'fallback_vacuum',
      reason: unreachable,
      result: 'failed',
    }
    failedRoom.outstanding = {
      operation: 'vacuum_mop',
      reason: failed.events[1].reason,
    }
    failedRoom.reasons_coincide = false

    view.rerender(<VacuumOutcomeDetail contract={failed} vacuum={vacuum} />)
    const failedRow = screen.getByLabelText('Dining Room Failed')
    expect(failedRow).toHaveTextContent('Attempt Reason')
    expect(failedRow).toHaveTextContent('The vacuum could not reach the requested room.')
    expect(failedRow).toHaveTextContent('Work Blocker')
    expect(failedRow).toHaveTextContent("The mop dock's clean-water tank was empty; refill it.")
  })

  it('deduplicates different raw reasons that render to the same household sentence', () => {
    const contract = contractForRooms(['dining_room'])
    const room = contract.rooms[0]
    const resultReason = { ...room.latest_attempt!.reason!, raw: 'Firmware clean-water empty A' }
    const outstandingReason = { ...room.outstanding!.reason!, raw: 'Firmware clean-water empty B' }
    room.latest_attempt = { ...room.latest_attempt!, reason: resultReason }
    room.outstanding = { ...room.outstanding!, reason: outstandingReason }
    room.reasons_coincide = false

    render(<VacuumOutcomeDetail contract={contract} vacuum={vacuum} />)
    const collapsed = screen.getByLabelText('Dining Room Failed').children[1] as HTMLElement
    expect(within(collapsed).getAllByText("The mop dock's clean-water tank was empty; refill it.")).toHaveLength(1)
    expect(within(collapsed).queryByText('Attempt Reason')).not.toBeInTheDocument()
    expect(within(collapsed).queryByText('Work Blocker')).not.toBeInTheDocument()
  })

  it('keeps labelled causes when the same reason code renders different structured data', () => {
    const contract = contractForRooms(['dining_room'])
    const room = contract.rooms[0]
    const resultReason = reason('verification.duration_below_minimum', { minimum_seconds: 120, observed_seconds: 60 })
    const outstandingReason = reason('verification.duration_below_minimum', { minimum_seconds: 120, observed_seconds: 30 })
    room.latest_attempt = { ...room.latest_attempt!, reason: resultReason }
    room.outstanding = { ...room.outstanding!, reason: outstandingReason }
    room.reasons_coincide = false

    render(<VacuumOutcomeDetail contract={contract} vacuum={vacuum} />)
    const collapsed = screen.getByLabelText('Dining Room Failed').children[1] as HTMLElement
    expect(collapsed).toHaveTextContent('Attempt Reason')
    expect(collapsed).toHaveTextContent('Room cleaning lasted 60 seconds, below the required minimum of 120 seconds.')
    expect(collapsed).toHaveTextContent('Work Blocker')
    expect(collapsed).toHaveTextContent('Room cleaning lasted 30 seconds, below the required minimum of 120 seconds.')
  })

  it('keeps raw diagnostics subordinate and opens them by default for an unknown reason', () => {
    const contract = contractForRooms(['hallway'])
    const room = contract.rooms[0]
    const event = contract.events[0]
    const unknown = reason('unknown')
    event.reason = unknown
    room.latest_attempt = { ...room.latest_attempt!, reason: unknown }
    room.outstanding = { operation: 'vacuum', reason: unknown }
    room.reasons_coincide = true

    render(<VacuumOutcomeDetail contract={contract} vacuum={vacuum} />)
    const row = screen.getByLabelText('Hallway Interrupted')
    expect(row).toHaveTextContent('The vacuum outcome reason was not recognized.')
    expect(within(row).getByText(unknown.raw)).not.toBeVisible()

    fireEvent.click(within(row).getByRole('button', { name: 'Show Hallway History' }))
    const diagnostic = within(row).getByText(unknown.raw)
    expect(diagnostic.closest('ul')).not.toHaveAttribute('hidden')
    expect(within(row).getByRole('button', { name: 'Hide Hallway Technical Vacuum Diagnostics' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('uses 44px command targets and defines no press-only or chevron treatment', () => {
    expect(styles).toMatch(/\.historyButton\s*\{[^}]*min-height:\s*44px;/s)
    expect(styles).toMatch(/\.diagnosticsButton\s*\{[^}]*min-height:\s*44px;/s)
    expect(styles).toMatch(/\.attemptBadge\s*\{[^}]*min-width:\s*22px;[^}]*padding:\s*0 5px;/s)
    expect(styles).not.toMatch(/:active/)
    expect(styles).not.toMatch(/chevron/i)
  })

  it('renders a two-digit attempt badge without changing the disclosure width', () => {
    const contract = contractForRooms(['dining_room'])
    contract.rooms[0].occurrence_count = 12
    render(<VacuumOutcomeDetail contract={contract} vacuum={vacuum} />)

    const history = screen.getByRole('button', { name: 'Show Dining Room History' })
    expect(history).toHaveAttribute('data-has-attempt-count', 'true')
    expect(within(history).getByText('12')).toBeInTheDocument()
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

  it('summarizes the exact nine-room state without reducing event history', () => {
    expect(countVacuumOutcomes(cloneContract())).toMatchObject({
      attention: 1,
      completed: 4,
      due: 5,
      interrupted: 1,
    })
  })
})
