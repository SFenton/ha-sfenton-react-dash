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

    expect(screen.getByRole('heading', { name: 'Main Floor Cleaning Report' })).toBeInTheDocument()
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
  it('groups one authoritative row per room under static separators', () => {
    render(<VacuumOutcomeDetail contract={cloneContract()} vacuum={vacuum} />)

    const groupHeaders = [...document.querySelectorAll<HTMLElement>('[data-group] > div:first-child')]
    expect(groupHeaders.map((header) => header.textContent)).toEqual([
      'Error',
      'Interrupted',
      'Work Still Due',
      'Completed',
    ])
    const failed = screen.getByLabelText('Dining Room Failed')
    expect(failed).toBeInTheDocument()
    expect(within(failed).getByText('Failed')).toHaveClass(/visuallyHidden/)
    expect(within(failed).queryByRole('button')).not.toBeInTheDocument()
    expect(within(failed).queryByText('Room Event History')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Hallway Interrupted')).toBeInTheDocument()
    expect(screen.getByLabelText('Kitchen Not Attempted')).toBeInTheDocument()
    expect(screen.getByLabelText('Master Bedroom Closet Completed')).toBeInTheDocument()
    const interrupted = screen.getByLabelText('Hallway Interrupted')
    expect(within(interrupted).getByText('Interrupted')).toHaveClass(/visuallyHidden/)
    expect(interrupted).toHaveTextContent('Cleaning was interrupted because someone returned home.')
    expect(interrupted).not.toHaveTextContent('The vacuum-only attempt was interrupted before completion.')
    expect(interrupted).not.toHaveTextContent('Vacuuming remains due.')
    expect(within(interrupted).queryByRole('button')).not.toBeInTheDocument()
    expect(within(interrupted).queryByText('Room Event History')).not.toBeInTheDocument()
    expect(within(screen.getByLabelText('Gym Completed')).getByText('Completed')).toHaveClass(/visuallyHidden/)
    expect(document.querySelector('[data-vacuum-outcome-detail="true"]')).toHaveAttribute('data-modal-detail-autofocus', 'true')
    expect(document.querySelectorAll('[data-group] > button')).toHaveLength(0)
    expect(document.querySelector('[data-modal-disclosure="right-chevron"]')).not.toBeInTheDocument()
  })

  it('renders v2 uncertainty, partial credit, and structured evidence without treating uncertainty as failure', () => {
    render(<VacuumOutcomeDetail contract={parsedContract(EVIDENCE_RICH_V2_VACUUM_OUTCOME_PAYLOAD)} vacuum={vacuum} />)

    const groupHeaders = [...document.querySelectorAll<HTMLElement>('[data-group] > div:first-child')]
    expect(groupHeaders.map((header) => header.textContent)).toEqual([
      'Completion Unverified',
      'Work Still Due',
    ])

    const gym = screen.getByLabelText('Gym Completion Unverified')
    expect(gym).toHaveAttribute('data-status', 'uncertain')
    expect(gym).toHaveTextContent('Vacuuming completion could not be verified.')
    expect(gym).toHaveTextContent('Observed 1 of 2 requested iterations.')
    expect(within(gym).getAllByText('Physical Work')[0]).toBeInTheDocument()
    expect(within(gym).getAllByText('Substantial')[0]).toBeInTheDocument()
    expect(gym).toHaveTextContent('Vacuuming remains due.')
    expect(gym).not.toHaveTextContent('Failed')

    const gymEvidence = within(gym).getByRole('button', { name: 'Show Gym Cleaning Evidence' })
    expect(gymEvidence).toHaveAttribute('data-action-kind', 'command')
    fireEvent.click(gymEvidence)
    expect(within(gym).getByText('Duration').nextElementSibling).toHaveTextContent(
      'Passed • Observed: 1,500 seconds • Minimum: 120 seconds • Reset Count: 1',
    )
    expect(within(gym).getByText('Iterations').nextElementSibling).toHaveTextContent(
      'Unverified • Observed: 1 • Requested: 2',
    )
    expect(within(gym).getByText('Completion').nextElementSibling).toHaveTextContent('Uncertain')

    const office = screen.getByLabelText('Office Completion Unverified')
    expect(office).toHaveTextContent('Telemetry recovery was not coherent within 300 seconds.')
    fireEvent.click(within(office).getByRole('button', { name: 'Show Office Cleaning Evidence' }))
    expect(within(office).getByText('Duration').nextElementSibling).toHaveTextContent(
      'Passed Lower Bound • Lower Bound: 1,440 seconds • Minimum: 120 seconds • Reset Count: 1 • Attribution Uncertain',
    )
    expect(within(office).getByText('Telemetry').nextElementSibling).toHaveTextContent('Unresolved')
    expect(within(office).getByText('Source Outage Duration').nextElementSibling).toHaveTextContent('258 seconds')

    const livingRoom = screen.getByLabelText('Living Room Partially Complete')
    expect(livingRoom).toHaveTextContent('The vacuuming and mopping attempt was partially completed.')
    expect(livingRoom).toHaveTextContent('Home Assistant credited vacuuming; work may remain.')
    expect(livingRoom).toHaveTextContent('Mopping remains due.')
    expect(livingRoom).not.toHaveTextContent('Failed')
  })

  it('renders current evidence-free v2 uncertainty without legacy or raw failure wording', () => {
    render(<VacuumOutcomeDetail contract={parsedContract(EVIDENCE_FREE_V2_VACUUM_OUTCOME_PAYLOAD)} vacuum={vacuum} />)

    const office = screen.getByLabelText('Office Completion Unverified')
    expect(office).toHaveTextContent('Vacuuming completion could not be verified.')
    expect(office).toHaveTextContent('Vacuuming remains due.')
    expect(office).not.toHaveTextContent('Could not clean')
    expect(office).not.toHaveTextContent('The vacuum outcome reason was not recognized.')
    expect(within(office).getByText('Floor completion time was unavailable during dock servicing after error sensor is unavailable')).not.toBeVisible()
    expect(within(office).queryByRole('button', { name: /Cleaning Evidence/ })).not.toBeInTheDocument()
  })

  it('keeps the core v2 outcome when only its optional evidence is malformed', () => {
    const payload = structuredClone(EVIDENCE_RICH_V2_VACUUM_OUTCOME_PAYLOAD)
    const room = record(payload.rooms[0])
    const attempt = record(room.latest_attempt)
    record(record(attempt.evidence).duration).minimum = 'bad'

    render(<VacuumOutcomeDetail contract={parsedContract(payload)} vacuum={vacuum} />)

    const gym = screen.getByLabelText('Gym Completion Unverified')
    expect(gym).toHaveTextContent('Vacuuming completion could not be verified.')
    expect(gym).toHaveTextContent('Evidence Unavailable')
    expect(within(gym).queryByRole('button', { name: /Cleaning Evidence/ })).not.toBeInTheDocument()
  })

  it('shows a full vacuum-and-mop failure as one cause plus concise remaining work', () => {
    render(<VacuumOutcomeDetail contract={cloneContract()} vacuum={vacuum} />)

    const row = screen.getByLabelText('Dining Room Failed')
    const collapsed = row.children[1] as HTMLElement
    expect(within(collapsed).queryByText('Vacuuming and mopping the room failed.')).not.toBeInTheDocument()
    expect(within(collapsed).getAllByText("The mop dock's clean-water tank was empty; refill it.")).toHaveLength(1)
    expect(within(collapsed).getByText('Vacuuming and mopping remain.')).toHaveClass(/errorOutstandingLine/)
    expect(within(collapsed).queryByText('Combined vacuuming and mopping remain due.')).not.toBeInTheDocument()
    expect(within(row).getByText('Failed')).toHaveClass(/visuallyHidden/)
    expect(within(row).queryByRole('button')).not.toBeInTheDocument()
    expect(within(row).queryByText('Room Event History')).not.toBeInTheDocument()
  })

  it('shows the completed and remaining operations when a failed room has partial cleaning credit', () => {
    const contract = contractForRooms(['dining_room'])
    const room = contract.rooms[0]
    room.credit = { operation: 'vacuum', status: 'partial' }
    room.outstanding = { operation: 'mop', reason: room.outstanding?.reason ?? null }

    render(<VacuumOutcomeDetail contract={contract} vacuum={vacuum} />)

    const row = screen.getByLabelText('Dining Room Failed')
    expect(row).toHaveTextContent("The mop dock's clean-water tank was empty; refill it.")
    expect(within(row).getByText('Vacuuming is complete; mopping remains.')).toHaveClass(/errorOutstandingLine/)
    expect(row).not.toHaveTextContent('Mopping remains due.')
  })

  it('keeps a vacuum-only failure cause-only because the remaining work is implicit', () => {
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

    const office = screen.getByLabelText('Office Failed')
    expect(office).toHaveTextContent('The auto-empty dock dust bag was full or its dust duct was blocked.')
    expect(office).not.toHaveTextContent('Vacuuming remains')
    expect(within(office).queryByRole('button')).not.toBeInTheDocument()
  })

  it('keeps Office completed while retaining its prior failed attempt in history', () => {
    render(<VacuumOutcomeDetail contract={cloneContract()} vacuum={vacuum} />)

    const office = screen.getByLabelText('Office Completed')
    expect(within(office.children[1] as HTMLElement).getByText('Vacuuming completed for the room.')).toBeInTheDocument()
    const history = within(office).getByRole('button', { name: 'Show Office History' })
    fireEvent.click(history)
    const events = within(office).getAllByRole('listitem')
    expect(events).toHaveLength(2)
    expect(events[0]).toHaveTextContent('Vacuuming the room without mopping failed.')
    expect(events[0]).toHaveTextContent('The auto-empty dock dust bag was full or its dust duct was blocked.')
    expect(events[1]).toHaveTextContent('Vacuuming completed for the room.')
    const diagnostics = within(office).getByRole('button', { name: 'Show Office Technical Vacuum Diagnostics' })
    expect(within(office).getByText('Auto-Empty Dock dust bag full or dust duct clogged')).not.toBeVisible()
    fireEvent.click(diagnostics)
    expect(within(office).getByText('Auto-Empty Dock dust bag full or dust duct clogged')).toBeVisible()
  })

  it('leaves a routine one-event completion as noninteractive state', () => {
    render(<VacuumOutcomeDetail contract={contractForRooms(['gym'])} vacuum={vacuum} />)

    const gym = screen.getByLabelText('Gym Completed')
    expect(gym).toHaveAttribute('data-action-kind', 'state')
    expect(within(gym).queryByRole('button')).not.toBeInTheDocument()
  })

  it('keeps an interrupted room to one truthful fallback sentence when no cause is available', () => {
    const contract = contractForRooms(['hallway'])
    const room = contract.rooms[0]
    contract.events[0].reason = null
    room.latest_attempt = { ...room.latest_attempt!, reason: null }
    room.outstanding = { operation: 'vacuum', reason: null }

    render(<VacuumOutcomeDetail contract={contract} vacuum={vacuum} />)

    const hallway = screen.getByLabelText('Hallway Interrupted')
    expect(hallway).toHaveTextContent('The vacuum-only attempt was interrupted before completion.')
    expect(hallway).not.toHaveTextContent('Cleaning was interrupted because someone returned home.')
    expect(hallway).not.toHaveTextContent('Vacuuming remains due.')
    expect(within(hallway).queryByRole('button')).not.toBeInTheDocument()
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
    expect(failedRow).toHaveTextContent('The vacuum could not reach the requested room.')
    expect(failedRow).toHaveTextContent('Vacuuming and mopping remain.')
    expect(failedRow).not.toHaveTextContent('Attempt Reason')
    expect(failedRow).not.toHaveTextContent('Work Blocker')
    expect(failedRow).not.toHaveTextContent("The mop dock's clean-water tank was empty; refill it.")
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

  it('uses the latest failed-attempt cause when the outstanding reason differs', () => {
    const contract = contractForRooms(['dining_room'])
    const room = contract.rooms[0]
    const resultReason = reason('verification.duration_below_minimum', { minimum_seconds: 120, observed_seconds: 60 })
    const outstandingReason = reason('verification.duration_below_minimum', { minimum_seconds: 120, observed_seconds: 30 })
    room.latest_attempt = { ...room.latest_attempt!, reason: resultReason }
    room.outstanding = { ...room.outstanding!, reason: outstandingReason }
    room.reasons_coincide = false

    render(<VacuumOutcomeDetail contract={contract} vacuum={vacuum} />)
    const collapsed = screen.getByLabelText('Dining Room Failed').children[1] as HTMLElement
    expect(collapsed).toHaveTextContent('Room cleaning lasted 60 seconds, below the required minimum of 120 seconds.')
    expect(collapsed).toHaveTextContent('Vacuuming and mopping remain.')
    expect(collapsed).not.toHaveTextContent('Attempt Reason')
    expect(collapsed).not.toHaveTextContent('Work Blocker')
    expect(collapsed).not.toHaveTextContent('Room cleaning lasted 30 seconds, below the required minimum of 120 seconds.')
  })

  it('keeps an unknown failed reason household-safe without exposing raw diagnostics', () => {
    const contract = contractForRooms(['dining_room'])
    const room = contract.rooms[0]
    const event = contract.events.find((candidate) => candidate.id === room.latest_attempt?.event_id)!
    const unknown = reason('unknown')
    event.reason = unknown
    room.latest_attempt = { ...room.latest_attempt!, reason: unknown }
    room.outstanding = { operation: 'vacuum_mop', reason: unknown }
    room.reasons_coincide = true

    render(<VacuumOutcomeDetail contract={contract} vacuum={vacuum} />)
    const row = screen.getByLabelText('Dining Room Failed')
    expect(row).toHaveTextContent('The vacuum outcome reason was not recognized.')
    expect(within(row).queryByText(unknown.raw)).not.toBeInTheDocument()
    expect(within(row).queryByRole('button')).not.toBeInTheDocument()
  })

  it('uses 44px command targets and defines no press-only or chevron treatment', () => {
    expect(styles).toMatch(/\.historyButton\s*\{[^}]*min-height:\s*44px;/s)
    expect(styles).toMatch(/\.diagnosticsButton\s*\{[^}]*min-height:\s*44px;/s)
    expect(styles).toMatch(/\.evidenceButton\s*\{[^}]*min-height:\s*44px;/s)
    expect(styles).toMatch(/\.protocolButton\s*\{[^}]*min-height:\s*44px;/s)
    expect(styles).toMatch(/\.attemptBadge\s*\{[^}]*min-width:\s*22px;[^}]*padding:\s*0 5px;/s)
    expect(styles).toMatch(/\.errorOutstandingLine\s*\{[^}]*color:\s*var\(--color-text\);/s)
    expect(styles).not.toMatch(/\.groupButton/)
    expect(styles).not.toMatch(/:active/)
    expect(styles).not.toMatch(/chevron/i)
  })

  it('renders a two-digit attempt badge without changing the disclosure width', () => {
    const contract = contractForRooms(['office'])
    contract.rooms[0].occurrence_count = 12
    render(<VacuumOutcomeDetail contract={contract} vacuum={vacuum} />)

    const history = screen.getByRole('button', { name: 'Show Office History' })
    expect(history).toHaveAttribute('data-has-attempt-count', 'true')
    expect(within(history).getByText('12')).toBeInTheDocument()
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
