import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardViewPage } from './DashboardViewPage'
import { VACATION_PRE_CHECKLIST_ITEMS } from '../constants/portedDashboard'
import {
  acknowledgePendingMockHouseholdAwayCommands,
  entity,
  mockCallServiceCalls,
  mockEntities,
  mockState,
  resetMockHass,
  resolvePendingMockHouseholdAwayCommands,
  setMockCallServiceOutcome,
  setMockEntityAttribute,
  setMockEntityState,
  setMockUser,
} from '../test/mocks/hakitCoreState'
import { materialIconPath } from '../components/core/iconPaths'
import { HOUSEHOLD_RESIDENT, HOUSEHOLD_RESIDENTS, householdResidentForHaUserId } from '../constants/householdResidents'

const STATUS_ENTITY = 'sensor.household_away_status'

function setupSoloTripSnapshot(state: 'activating' | 'active' | 'degraded' | 'ending' | 'restore_required' | 'scheduled', overrides: {
  commandAvailable?: boolean
  contractVersion?: number
  effects?: { sleepypod_live_follow: boolean; sleepypod_schedule: boolean; wake_light_source: boolean }
  traveler?: 'steph' | 'stephen'
} = {}) {
  const traveler = overrides.traveler ?? 'stephen'
  setMockEntityState(STATUS_ENTITY, state)
  setMockEntityAttribute(STATUS_ENTITY, 'mode', 'solo_trip')
  setMockEntityAttribute(STATUS_ENTITY, 'traveler', traveler)
  setMockEntityAttribute(STATUS_ENTITY, 'home_resident', traveler === 'stephen' ? 'steph' : 'stephen')
  setMockEntityAttribute(STATUS_ENTITY, 'command_available', overrides.commandAvailable ?? true)
  setMockEntityAttribute(STATUS_ENTITY, 'contract_version', overrides.contractVersion ?? 1)
  setMockEntityAttribute(STATUS_ENTITY, 'starts_at', '2099-01-01T09:00:00')
  setMockEntityAttribute(STATUS_ENTITY, 'ends_at', '2099-01-03T17:00:00')
  setMockEntityAttribute(STATUS_ENTITY, 'effects', overrides.effects ?? {
    sleepypod_live_follow: state === 'active',
    sleepypod_schedule: state === 'active',
    wake_light_source: state === 'active',
  })
  setMockEntityAttribute(STATUS_ENTITY, 'blockers', state === 'restore_required' ? ['sleepypod_schedule_diverged'] : [])
}

function setupVacationSnapshot() {
  setMockEntityState(STATUS_ENTITY, 'active')
  setMockEntityAttribute(STATUS_ENTITY, 'mode', 'vacation')
  setMockEntityAttribute(STATUS_ENTITY, 'traveler', 'none')
  setMockEntityAttribute(STATUS_ENTITY, 'home_resident', 'none')
  setMockEntityAttribute(STATUS_ENTITY, 'command_available', true)
}

function renderSoloTripPage(path = 'solo-trip') {
  return render(<DashboardViewPage activePath="settings" onNavigate={() => undefined} path={path} />)
}

function soloTripToggle() {
  const toggle = document.querySelector<HTMLButtonElement>('button[role="switch"][aria-label^="Solo Trip"]')
  if (!toggle) throw new Error('Missing Solo Trip toggle')
  return toggle
}

function selectTraveler(name: 'Stephen' | 'Steph') {
  const resident = name === 'Stephen' ? HOUSEHOLD_RESIDENT.STEPHEN : HOUSEHOLD_RESIDENT.STEPH
  const title = householdResidentForHaUserId(mockState.user?.id) === resident ? 'You' : name
  fireEvent.click(screen.getByRole('button', { name: title, exact: true }))
}

function householdAwayCalls() {
  return mockCallServiceCalls.filter((call) => call.domain === 'script' && call.service === 'household_away_command')
}

function latestHouseholdAwayCall() {
  return householdAwayCalls().at(-1) as Record<string, unknown>
}

async function elapseHouseholdAwayTimeout() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000)
  })
}

function expectExactServiceKeys(call: Record<string, unknown>, keys: string[]) {
  const serviceData = call.serviceData as Record<string, unknown>
  expect(Object.keys(serviceData).sort()).toEqual(keys.sort())
}

function setupModernSleepypod() {
  mockEntities['climate.sleepypod_eight_pod_left_side'] = entity('climate.sleepypod_eight_pod_left_side', 'heat', {
    current_temperature: 81,
    hvac_modes: ['off', 'heat'],
    max_temp: 110,
    min_temp: 55,
    target_temp_step: 1,
    temperature: 77,
  })
  mockEntities['climate.sleepypod_eight_pod_right_side'] = entity('climate.sleepypod_eight_pod_right_side', 'heat', {
    current_temperature: 77,
    hvac_modes: ['off', 'heat'],
    max_temp: 110,
    min_temp: 55,
    target_temp_step: 1,
    temperature: 77,
  })
  mockEntities['number.master_bedroom_sleepypod_eight_pod_left_target_level'] = entity('number.master_bedroom_sleepypod_eight_pod_left_target_level', '-2', {
    max: 10,
    min: -10,
    step: 1,
  })
  mockEntities['number.master_bedroom_sleepypod_eight_pod_right_target_level'] = entity('number.master_bedroom_sleepypod_eight_pod_right_target_level', '0', {
    max: 10,
    min: -10,
    step: 1,
  })
}

// @covers src/pages/DashboardViewPage.tsx
// @covers src/components/core/iconPaths.ts
// @covers src/components/hass/householdAway/SoloTripChooserCard.tsx
// @covers src/components/hass/householdAway/SoloTripEditorModal.tsx
// @covers src/components/hass/householdAway/SoloTripStatusSection.tsx
// @covers src/components/hass/householdAway/householdAwayContract.ts
// @covers src/components/hass/householdAway/householdAwayLabels.ts
// @covers src/test/mocks/hakitCoreState.ts
// @covers src/constants/householdAway.ts
// @covers src/constants/routes.ts
// @covers src/i18n/index.ts
// @covers src/i18n/locales/en/pages/vacation.json
// @covers src/i18n/resources.ts
// @covers src/i18n/locales/en/pages/soloTrip.json
// @covers src/pages/DashboardViewPage.module.css
describe('DashboardViewPage Solo Trip', () => {
  beforeEach(() => {
    vi.useRealTimers()
    window.history.replaceState(null, '', window.location.pathname)
    resetMockHass()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('keeps the dedicated Solo Trip page under Settings navigation and backs out to Settings', () => {
    const onNavigate = vi.fn()
    render(<DashboardViewPage activePath="settings" onNavigate={onNavigate} path="solo-trip" />)

    expect(screen.getByText('Enable or disable Solo Trip mode for the house.')).toBeInTheDocument()
    expect(screen.getByText('Select the user that will be away from home')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
    expect(onNavigate).toHaveBeenCalledWith('settings')

    const bottomNav = document.querySelector('[data-adaptive-navigation="bottom"]')!
    expect(within(bottomNav).getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-current', 'page')
    expect(within(bottomNav).queryByRole('button', { name: 'Solo Trip' })).not.toBeInTheDocument()
  })

  it('groups the page into exactly two responsive sections without SettingsSection wrappers', () => {
    renderSoloTripPage()

    expect(document.querySelectorAll('[data-responsive-section-grid="true"]')).toHaveLength(1)
    expect(document.querySelectorAll('[data-responsive-section-item="true"]')).toHaveLength(2)
    expect(document.querySelectorAll('[data-settings-section="true"]')).toHaveLength(0)
    expect(screen.getAllByRole('heading', { name: 'Solo Trip' })).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'Away From Home' })).toBeInTheDocument()
  })

  it('shows the Vacation chooser and routes each option to its dedicated page', () => {
    const onNavigate = vi.fn()
    render(<DashboardViewPage activePath="settings" onNavigate={onNavigate} path="vacation" />)

    const chooser = screen.getByRole('navigation', { name: 'Away modes' })
    expect(chooser).toHaveAttribute('data-settings-link-list', 'true')
    expect(chooser).not.toHaveAttribute('data-dynamic-grid')
    const vacation = within(chooser).getByRole('button', { name: /Vacation Set away dates and prepare the house for vacation./i })
    const soloTrip = within(chooser).getByRole('button', { name: /Solo Trip One traveler, one home resident/i })

    expect(vacation.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:airplane'))
    expect(soloTrip.querySelector('path')).toHaveAttribute('d', materialIconPath('mdi:bag-suitcase'))

    fireEvent.click(vacation)
    fireEvent.click(soloTrip)

    expect(onNavigate).toHaveBeenNthCalledWith(1, 'vacation-mode')
    expect(onNavigate).toHaveBeenNthCalledWith(2, 'solo-trip')
  })

  it('keeps the toggle visible but disabled until a traveler is selected', () => {
    renderSoloTripPage()

    expect(screen.getByText('Enable or disable Solo Trip mode for the house.')).toBeInTheDocument()
    expect(screen.getByText('Select the user that will be away from home')).toBeInTheDocument()
    expect(soloTripToggle()).toHaveAttribute('aria-checked', 'false')
    expect(soloTripToggle()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'You', exact: true })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Steph', exact: true })).toHaveAttribute('aria-pressed', 'false')

    selectTraveler('Stephen')

    expect(screen.getByRole('button', { name: 'You', exact: true })).toHaveAttribute('aria-pressed', 'true')
    expect(soloTripToggle()).toBeEnabled()
    expect(householdAwayCalls()).toEqual([])
  })

  it('personalizes member buttons from the signed-in Home Assistant user and falls back safely', () => {
    setMockUser({ id: HOUSEHOLD_RESIDENTS.steph.haUserId, name: 'Steph' })
    const view = renderSoloTripPage()
    expect(screen.getByRole('button', { name: 'Stephen', exact: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'You', exact: true })).toBeInTheDocument()

    view.unmount()
    setMockUser({ id: 'unknown-user', name: 'Unknown' })
    renderSoloTripPage()
    expect(screen.getByRole('button', { name: 'Stephen', exact: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Steph', exact: true })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'You', exact: true })).not.toBeInTheDocument()
  })

  it('opens the date modal without calling Home Assistant or checking the toggle', () => {
    renderSoloTripPage()
    selectTraveler('Stephen')
    const toggle = soloTripToggle()

    fireEvent.click(toggle)

    const dialog = screen.getByRole('dialog', { name: 'Schedule Solo Trip' })
    expect(dialog).toBeInTheDocument()
    expect(dialog.querySelector('[data-schedule-confirmation-form="true"]')).toBeInTheDocument()
    expect(dialog.querySelector('[data-schedule-confirmation-fields="true"]')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Schedule Solo Trip' })).toHaveAttribute('data-variant', 'primary')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(householdAwayCalls()).toEqual([])
    expect(screen.queryByRole('button', { name: 'Steph', exact: true })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'You', exact: true })).not.toBeInTheDocument()
  })

  it('discards local modal edits on close without writing', async () => {
    renderSoloTripPage()
    selectTraveler('Stephen')
    fireEvent.click(soloTripToggle())
    const originalDate = (screen.getByLabelText('Departure Date') as HTMLInputElement).value

    fireEvent.change(screen.getByLabelText('Departure Date'), { target: { value: '2099-01-08' } })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Schedule Solo Trip' })).not.toBeInTheDocument())
    expect(householdAwayCalls()).toEqual([])

    fireEvent.click(soloTripToggle())
    expect((screen.getByLabelText('Departure Date') as HTMLInputElement).value).toBe(originalDate)
  })

  it('accepts a past departure, schedules once, and then shows only editable return fields', async () => {
    renderSoloTripPage()
    selectTraveler('Stephen')
    fireEvent.click(soloTripToggle())

    fireEvent.change(screen.getByLabelText('Departure Date'), { target: { value: '2025-01-02' } })
    fireEvent.change(screen.getByLabelText('Departure Time'), { target: { value: '09:15' } })
    fireEvent.change(screen.getByLabelText('Return Date'), { target: { value: '2099-01-05' } })
    fireEvent.change(screen.getByLabelText('Return Time'), { target: { value: '18:45' } })
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Solo Trip' }))

    await waitFor(() => expect(householdAwayCalls()).toHaveLength(1))
    expectExactServiceKeys(latestHouseholdAwayCall(), [
      'end_date',
      'end_time',
      'expected_revision',
      'mode',
      'operation',
      'request_id',
      'start_date',
      'start_time',
      'traveler',
    ])
    expect(latestHouseholdAwayCall()).toMatchObject({
      domain: 'script',
      returnResponse: true,
      service: 'household_away_command',
      serviceData: {
        end_date: '2099-01-05',
        end_time: '18:45',
        mode: 'solo_trip',
        operation: 'schedule',
        start_date: '2025-01-02',
        start_time: '09:15',
        traveler: 'stephen',
      },
    })

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Schedule Solo Trip' })).not.toBeInTheDocument())
    expect(soloTripToggle()).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('heading', { name: 'Solo Trip Scheduled' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Departure Date')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Departure Time')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Return Date')).toBeEnabled()
    expect(screen.getByLabelText('Return Time')).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument()
    expect(screen.queryByRole('note', { name: 'Stephen Away' })).not.toBeInTheDocument()
  })

  it('preserves the modal draft and validation state when scheduling fails', async () => {
    setMockCallServiceOutcome('script', 'household_away_command', 'reject')
    renderSoloTripPage()
    selectTraveler('Stephen')
    fireEvent.click(soloTripToggle())

    fireEvent.change(screen.getByLabelText('Departure Date'), { target: { value: '2099-01-02' } })
    fireEvent.change(screen.getByLabelText('Departure Time'), { target: { value: '09:15' } })
    fireEvent.change(screen.getByLabelText('Return Date'), { target: { value: '2099-01-05' } })
    fireEvent.change(screen.getByLabelText('Return Time'), { target: { value: '18:45' } })
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Solo Trip' }))

    await waitFor(() => expect(screen.getByText('Home Assistant could not apply the Solo Trip change. Try again.')).toBeInTheDocument())
    expect(screen.getByRole('dialog', { name: 'Schedule Solo Trip' })).toBeInTheDocument()
    expect((screen.getByLabelText('Return Time') as HTMLInputElement).value).toBe('18:45')
  })

  it('updates return date and time automatically through update_end', async () => {
    setupSoloTripSnapshot('scheduled')
    renderSoloTripPage()

    expect(screen.queryByRole('button', { name: 'End Solo Trip Now' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel Solo Trip' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Return Date'), { target: { value: '2099-01-04' } })

    await waitFor(() => expect(householdAwayCalls()).toHaveLength(1))
    expect(latestHouseholdAwayCall()).toMatchObject({
      serviceData: {
        end_date: '2099-01-04',
        end_time: '17:00',
        operation: 'update_end',
      },
    })

    mockCallServiceCalls.length = 0
    await waitFor(() => expect(screen.getByLabelText('Return Time')).toBeEnabled())
    fireEvent.change(screen.getByLabelText('Return Time'), { target: { value: '18:30' } })

    await waitFor(() => expect(householdAwayCalls()).toHaveLength(1))
    expectExactServiceKeys(latestHouseholdAwayCall(), [
      'end_date',
      'end_time',
      'expected_revision',
      'operation',
      'request_id',
    ])
    expect(latestHouseholdAwayCall()).toMatchObject({
      serviceData: {
        end_date: '2099-01-04',
        end_time: '18:30',
        operation: 'update_end',
      },
    })
    expect(screen.queryByLabelText('Departure Time')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Departure Date')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Return Date')).toBeEnabled()
    expect(screen.getByLabelText('Return Time')).toBeEnabled()
    expect(screen.queryByRole('button', { name: /Change|Save|Cancel/ })).not.toBeInTheDocument()
  })

  it('keeps an invalid return local until it is in the future', async () => {
    setupSoloTripSnapshot('scheduled')
    renderSoloTripPage()

    fireEvent.change(screen.getByLabelText('Return Date'), { target: { value: '2020-01-04' } })

    expect(screen.getByRole('alert')).toHaveTextContent('Return date/time must be in the future.')
    expect(householdAwayCalls()).toEqual([])

    fireEvent.change(screen.getByLabelText('Return Date'), { target: { value: '2099-01-04' } })

    await waitFor(() => expect(householdAwayCalls()).toHaveLength(1))
    expect(screen.queryByText('Return date/time must be in the future.')).not.toBeInTheDocument()
  })

  it('uses the Solo Trip toggle as the scheduled cancel path', async () => {
    setupSoloTripSnapshot('scheduled')
    renderSoloTripPage()

    fireEvent.click(soloTripToggle())

    await waitFor(() => expect(householdAwayCalls()).toHaveLength(1))
    expectExactServiceKeys(latestHouseholdAwayCall(), ['expected_revision', 'operation', 'request_id'])
    expect(latestHouseholdAwayCall()).toMatchObject({ serviceData: { operation: 'cancel' } })
    await waitFor(() => expect(soloTripToggle()).toHaveAttribute('aria-checked', 'false'))
  })

  it('shows active confirmed state truthfully', () => {
    setupSoloTripSnapshot('active')
    renderSoloTripPage()
    const awayTraveler = document.querySelector<HTMLElement>('article[aria-label="You Away"]')!
    const homeResident = document.querySelector<HTMLElement>('article[aria-label="Steph Home"]')!
    const activeNotice = screen.getByRole('note', { name: 'Stephen Away' })
    const description = screen.getByText('Enable or disable Solo Trip mode for the house.')
    const soloTripSection = description.closest('section')!

    expect(activeNotice).toHaveTextContent(
      "While you are away from home and the Solo Trip setting is enabled in settings, Steph's controls and alarms will control the entire bed.",
    )
    expect(screen.getAllByRole('note', { name: 'Stephen Away' })).toHaveLength(1)
    expect(soloTripSection).toContainElement(activeNotice)
    expect(activeNotice.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getAllByRole('heading', { name: 'Stephen Away' })).toHaveLength(1)
    expect(activeNotice).toContainElement(screen.getByRole('heading', { name: 'Stephen Away' }))
    expect(awayTraveler.tagName).toBe('ARTICLE')
    expect(awayTraveler).toHaveAttribute('data-disabled', 'true')
    expect(awayTraveler).toHaveAttribute('data-muted', 'false')
    expect(awayTraveler).not.toHaveAttribute('aria-pressed')
    expect(homeResident.tagName).toBe('ARTICLE')
    expect(homeResident).toHaveAttribute('data-disabled', 'true')
    expect(homeResident).toHaveAttribute('data-muted', 'true')
    expect(homeResident).not.toHaveAttribute('aria-pressed')
    expect(screen.queryByRole('button', { name: 'End Solo Trip Now' })).not.toBeInTheDocument()
  })

  it('keeps active Solo Trip copy truthful for the home resident and unknown viewers', () => {
    setupSoloTripSnapshot('active')
    setMockUser({ id: HOUSEHOLD_RESIDENTS.steph.haUserId, name: 'Steph' })
    const homeView = renderSoloTripPage()
    expect(screen.getByRole('note', { name: 'Stephen Away' })).toHaveTextContent(
      'While Stephen is away from home and the Solo Trip setting is enabled in settings, your controls and alarms will control the entire bed.',
    )

    homeView.unmount()
    setMockUser({ id: 'unknown-user', name: 'Unknown' })
    renderSoloTripPage()
    expect(screen.getByRole('note', { name: 'Stephen Away' })).toHaveTextContent(
      'While Stephen is away from home and the Solo Trip setting is enabled in settings, your controls and alarms will control the entire bed.',
    )
  })

  it('personalizes the inverse active traveler without assuming Stephen is the viewer', () => {
    setupSoloTripSnapshot('active', { traveler: 'steph' })
    setMockUser({ id: HOUSEHOLD_RESIDENTS.steph.haUserId, name: 'Steph' })
    renderSoloTripPage()

    expect(screen.getByRole('note', { name: 'Steph Away' })).toHaveTextContent(
      "While you are away from home and the Solo Trip setting is enabled in settings, Stephen's controls and alarms will control the entire bed.",
    )
    expect(document.querySelector('article[aria-label="You Away"]')).toBeInTheDocument()
    expect(document.querySelector('article[aria-label="Stephen Home"]')).toBeInTheDocument()
  })

  it('shows active unconfirmed state with a title-only neutral away chip', () => {
    setupSoloTripSnapshot('active', {
      effects: { sleepypod_live_follow: false, sleepypod_schedule: true, wake_light_source: true },
    })
    renderSoloTripPage()
    const notice = screen.getByRole('note', { name: 'Stephen Away' })
    expect(notice).toHaveAttribute('data-tone', 'neutral')
    expect(notice).toHaveTextContent('Stephen Away')
    expect(notice).not.toHaveTextContent('controls and alarms will control the entire bed')
    expect(screen.getByText('Solo Trip is active, but some requested effects are still waiting for Home Assistant confirmation.')).toBeInTheDocument()
  })

  it('uses the toggle as the activating end-now command without a separate action', async () => {
    setupSoloTripSnapshot('activating', {
      effects: { sleepypod_live_follow: false, sleepypod_schedule: false, wake_light_source: false },
    })
    renderSoloTripPage()

    expect(soloTripToggle()).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'End Solo Trip Now' })).not.toBeInTheDocument()
    fireEvent.click(soloTripToggle())

    await waitFor(() => expect(householdAwayCalls()).toHaveLength(1))
    expect(latestHouseholdAwayCall()).toMatchObject({ serviceData: { operation: 'end_now' } })
  })

  it('uses the toggle as the degraded end path and keeps recovery copy truthful', async () => {
    setupSoloTripSnapshot('degraded', {
      effects: { sleepypod_live_follow: false, sleepypod_schedule: true, wake_light_source: true },
    })
    renderSoloTripPage()

    expect(screen.getByRole('heading', { name: 'Solo Trip Degraded' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'End Solo Trip Now' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Return Date')).toBeEnabled()
    expect(screen.getByLabelText('Return Time')).toBeEnabled()
    fireEvent.click(soloTripToggle())

    await waitFor(() => expect(householdAwayCalls()).toHaveLength(1))
    expect(latestHouseholdAwayCall()).toMatchObject({ serviceData: { operation: 'end_now' } })
  })

  it('locks ending state while Solo Trip is restoring normal settings', () => {
    setupSoloTripSnapshot('ending')
    renderSoloTripPage()
    expect(soloTripToggle()).toHaveAttribute('aria-checked', 'true')
    expect(soloTripToggle()).toBeDisabled()
    expect(screen.getByRole('heading', { name: 'Ending Solo Trip' })).toBeInTheDocument()
  })

  it('locks restore-required state while retaining truthful recovery actions', async () => {
    setupSoloTripSnapshot('restore_required')
    renderSoloTripPage()
    const notice = screen.getByRole('note', { name: 'Stephen Away' })
    const description = screen.getByText('Enable or disable Solo Trip mode for the house.')
    expect(soloTripToggle()).toBeDisabled()
    expect(notice).toHaveAttribute('data-tone', 'neutral')
    expect(notice.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByLabelText('Return Date')).toBeEnabled()
    expect(screen.getByLabelText('Return Time')).toBeEnabled()
    expect(screen.getByRole('heading', { name: 'Solo Trip Needs Attention' })).toBeInTheDocument()
    expect(screen.queryByText('sleepypod_schedule_diverged')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Restore Saved Schedule' }))
    await waitFor(() => expect(householdAwayCalls()).toHaveLength(1))
    expect(latestHouseholdAwayCall()).toMatchObject({
      serviceData: { operation: 'resolve_restore', resolve_action: 'restore_saved' },
    })
  })

  it.each([
    ['Keep Current Schedule', 'keep_current'],
    ['Restore Saved Schedule', 'restore_saved'],
  ] as const)('locks a timed-out %s action until restore-required state clears', async (label, resolveAction) => {
    vi.useFakeTimers()
    setupSoloTripSnapshot('restore_required')
    setMockCallServiceOutcome('script', 'household_away_command', 'pending')
    renderSoloTripPage()

    fireEvent.click(screen.getByRole('button', { name: label }))
    expect(householdAwayCalls()).toHaveLength(1)
    expect(latestHouseholdAwayCall()).toMatchObject({
      serviceData: { operation: 'resolve_restore', resolve_action: resolveAction },
    })
    await elapseHouseholdAwayTimeout()

    expect(screen.getAllByText('Home Assistant did not confirm the Solo Trip change. Wait for the dashboard to refresh before sending another request.')).not.toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Keep Current Schedule' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Restore Saved Schedule' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: label }))
    expect(householdAwayCalls()).toHaveLength(1)

    await act(async () => resolvePendingMockHouseholdAwayCommands())
    expect(screen.queryByRole('heading', { name: 'Solo Trip Needs Attention' })).not.toBeInTheDocument()
  })

  it.each([
    ['the status entity is missing', () => {
      const original = mockEntities[STATUS_ENTITY]
      delete mockEntities[STATUS_ENTITY]
      return () => { mockEntities[STATUS_ENTITY] = original }
    }],
    ['the status contract is incompatible', () => {
      setMockEntityAttribute(STATUS_ENTITY, 'contract_version', 2)
      return () => undefined
    }],
    ['commands are unavailable', () => {
      setMockEntityAttribute(STATUS_ENTITY, 'command_available', false)
      return () => undefined
    }],
  ])('keeps both sections visible and fail-closed when %s', (_label, makeUnavailable) => {
    const restore = makeUnavailable()
    try {
      renderSoloTripPage()
      expect(screen.getByText('Enable or disable Solo Trip mode for the house.')).toBeInTheDocument()
      expect(screen.getByText('Select the user that will be away from home')).toBeInTheDocument()
      selectTraveler('Stephen')
      expect(soloTripToggle()).toBeDisabled()
      expect(screen.getByText('Solo Trip scheduling is unavailable. Complete Household Away setup, then try again.')).toBeInTheDocument()
      expect(householdAwayCalls()).toEqual([])
    } finally {
      restore()
    }
  })

  it('blocks Solo Trip setup while Vacation Mode is engaged', () => {
    setupVacationSnapshot()
    renderSoloTripPage()

    expect(soloTripToggle()).toBeDisabled()
    expect(screen.getByText('Vacation Mode is already engaged. Turn it off before scheduling Solo Trip.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Stephen', exact: true })).not.toBeInTheDocument()
  })

  it('routes Vacation entry directly to the dedicated Solo Trip page when Solo Trip is engaged', () => {
    setupSoloTripSnapshot('scheduled')
    renderSoloTripPage('vacation')
    expect(screen.queryByRole('heading', { name: 'Solo Trip Scheduled' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Return Date')).toBeEnabled()
    expect(screen.queryByLabelText('Departure Date')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Away modes' })).not.toBeInTheDocument()
  })

  it('retains VacationModePage fallback activating End Now action', () => {
    setupSoloTripSnapshot('activating')
    render(<DashboardViewPage activePath="settings" onNavigate={() => undefined} path="vacation-mode" />)

    expect(screen.getByRole('button', { name: 'End Solo Trip Now' })).toBeInTheDocument()
  })

  it('writes Vacation intent directly to its native helpers', async () => {
    for (const item of VACATION_PRE_CHECKLIST_ITEMS) mockEntities[item.entityId].state = 'on'
    mockEntities['input_datetime.vacation_start'].state = '2099-01-01 09:00:00'
    mockEntities['input_datetime.vacation_end'].state = '2099-01-02 09:00:00'
    render(<DashboardViewPage activePath="settings" onNavigate={() => undefined} path="vacation-mode" />)
    fireEvent.click(screen.getByRole('button', { name: /Vacation Mode Off/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm Vacation' }))

    await waitFor(() => expect(mockCallServiceCalls).toContainEqual(expect.objectContaining({
      domain: 'input_datetime',
      service: 'set_datetime',
      target: 'input_datetime.vacation_start',
    })))
    expect(mockCallServiceCalls.some((call) => call.domain === 'script' && call.service === 'household_away_command')).toBe(false)

    mockCallServiceCalls.length = 0
    fireEvent.click(screen.getByRole('button', { name: /Vacation Mode On/ }))
    await waitFor(() => expect(mockCallServiceCalls).toContainEqual(expect.objectContaining({
      domain: 'input_boolean',
      service: 'turn_off',
      target: 'input_boolean.vacation_mode',
    })))
  })

  it('keeps a pending schedule modal open until the authoritative snapshot changes', async () => {
    setMockCallServiceOutcome('script', 'household_away_command', 'pending')
    renderSoloTripPage()
    selectTraveler('Stephen')
    fireEvent.click(soloTripToggle())
    fireEvent.change(screen.getByLabelText('Departure Date'), { target: { value: '2099-01-02' } })
    fireEvent.change(screen.getByLabelText('Departure Time'), { target: { value: '09:15' } })
    fireEvent.change(screen.getByLabelText('Return Date'), { target: { value: '2099-01-05' } })
    fireEvent.change(screen.getByLabelText('Return Time'), { target: { value: '18:45' } })
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Solo Trip' }))

    expect(screen.getByRole('dialog', { name: 'Schedule Solo Trip' })).toBeInTheDocument()
    expect(soloTripToggle()).toBeDisabled()
    await act(async () => resolvePendingMockHouseholdAwayCommands())
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Schedule Solo Trip' })).not.toBeInTheDocument())
  })

  it('ignores unrelated schedule revisions until the authoritative schedule matches', async () => {
    setMockCallServiceOutcome('script', 'household_away_command', 'pending')
    renderSoloTripPage()
    selectTraveler('Stephen')
    fireEvent.click(soloTripToggle())
    fireEvent.change(screen.getByLabelText('Departure Date'), { target: { value: '2099-01-02' } })
    fireEvent.change(screen.getByLabelText('Departure Time'), { target: { value: '09:15' } })
    fireEvent.change(screen.getByLabelText('Return Date'), { target: { value: '2099-01-05' } })
    fireEvent.change(screen.getByLabelText('Return Time'), { target: { value: '18:45' } })
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Solo Trip' }))

    await waitFor(() => expect(householdAwayCalls()).toHaveLength(1))
    act(() => setMockEntityAttribute(STATUS_ENTITY, 'revision', 1))
    await act(async () => acknowledgePendingMockHouseholdAwayCommands())

    act(() => setMockEntityAttribute(STATUS_ENTITY, 'revision', 2))
    expect(screen.getByRole('dialog', { name: 'Schedule Solo Trip' })).toBeInTheDocument()
    expect((screen.getByLabelText('Return Time') as HTMLInputElement).value).toBe('18:45')

    act(() => {
      setMockEntityState(STATUS_ENTITY, 'scheduled')
      setMockEntityAttribute(STATUS_ENTITY, 'mode', 'solo_trip')
      setMockEntityAttribute(STATUS_ENTITY, 'traveler', 'stephen')
      setMockEntityAttribute(STATUS_ENTITY, 'home_resident', 'steph')
      setMockEntityAttribute(STATUS_ENTITY, 'starts_at', '2099-01-02T09:15:00')
      setMockEntityAttribute(STATUS_ENTITY, 'ends_at', '2099-01-05T18:45:00')
      setMockEntityAttribute(STATUS_ENTITY, 'revision', 3)
    })

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Schedule Solo Trip' })).not.toBeInTheDocument())
  })

  it('ignores unrelated return revisions until the authoritative return matches', async () => {
    setupSoloTripSnapshot('scheduled')
    setMockCallServiceOutcome('script', 'household_away_command', 'pending')
    renderSoloTripPage()
    fireEvent.change(screen.getByLabelText('Return Date'), { target: { value: '2099-01-04' } })

    await waitFor(() => expect(householdAwayCalls()).toHaveLength(1))
    act(() => setMockEntityAttribute(STATUS_ENTITY, 'revision', 1))
    await act(async () => acknowledgePendingMockHouseholdAwayCommands())

    act(() => setMockEntityAttribute(STATUS_ENTITY, 'revision', 2))
    expect(screen.getByLabelText('Return Date')).toBeDisabled()
    expect((screen.getByLabelText('Return Date') as HTMLInputElement).value).toBe('2099-01-04')

    act(() => {
      setMockEntityAttribute(STATUS_ENTITY, 'ends_at', '2099-01-04T17:00:00')
      setMockEntityAttribute(STATUS_ENTITY, 'revision', 3)
    })

    await waitFor(() => expect(screen.getByLabelText('Return Date')).toBeEnabled())
  })

  it('keeps an acknowledged cancel locked until the authoritative mode exits', async () => {
    setupSoloTripSnapshot('scheduled')
    setMockCallServiceOutcome('script', 'household_away_command', 'pending')
    renderSoloTripPage()

    fireEvent.click(soloTripToggle())
    await waitFor(() => expect(householdAwayCalls()).toHaveLength(1))
    act(() => setMockEntityAttribute(STATUS_ENTITY, 'revision', 1))
    await act(async () => acknowledgePendingMockHouseholdAwayCommands())

    act(() => setMockEntityAttribute(STATUS_ENTITY, 'revision', 2))
    expect(soloTripToggle()).toBeDisabled()
    fireEvent.click(soloTripToggle())
    expect(householdAwayCalls()).toHaveLength(1)

    act(() => {
      setMockEntityState(STATUS_ENTITY, 'idle')
      setMockEntityAttribute(STATUS_ENTITY, 'mode', 'none')
      setMockEntityAttribute(STATUS_ENTITY, 'traveler', 'none')
      setMockEntityAttribute(STATUS_ENTITY, 'home_resident', 'none')
      setMockEntityAttribute(STATUS_ENTITY, 'starts_at', null)
      setMockEntityAttribute(STATUS_ENTITY, 'ends_at', null)
      setMockEntityAttribute(STATUS_ENTITY, 'revision', 3)
    })

    await waitFor(() => expect(soloTripToggle()).toHaveAttribute('aria-checked', 'false'))
    expect(householdAwayCalls()).toHaveLength(1)
  })

  it('locks a timed-out schedule request until the authoritative snapshot arrives', async () => {
    vi.useFakeTimers()
    setMockCallServiceOutcome('script', 'household_away_command', 'pending')
    renderSoloTripPage()
    selectTraveler('Stephen')
    fireEvent.click(soloTripToggle())
    fireEvent.change(screen.getByLabelText('Departure Date'), { target: { value: '2099-01-02' } })
    fireEvent.change(screen.getByLabelText('Departure Time'), { target: { value: '09:15' } })
    fireEvent.change(screen.getByLabelText('Return Date'), { target: { value: '2099-01-05' } })
    fireEvent.change(screen.getByLabelText('Return Time'), { target: { value: '18:45' } })
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Solo Trip' }))

    expect(householdAwayCalls()).toHaveLength(1)
    await elapseHouseholdAwayTimeout()

    expect(screen.getByText('Home Assistant did not confirm the Solo Trip change. Wait for the dashboard to refresh before sending another request.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Schedule Solo Trip' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Schedule Solo Trip' }))
    expect(householdAwayCalls()).toHaveLength(1)

    await act(async () => resolvePendingMockHouseholdAwayCommands())
    expect(soloTripToggle()).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('heading', { name: 'Solo Trip Scheduled' })).not.toBeInTheDocument()
    const pageReturnDate = screen.getAllByLabelText('Return Date').find((field) => !field.closest('[role="dialog"]'))
    expect(pageReturnDate).toBeEnabled()
  })

  it('locks a timed-out cancel request until the authoritative snapshot arrives', async () => {
    vi.useFakeTimers()
    setupSoloTripSnapshot('scheduled')
    setMockCallServiceOutcome('script', 'household_away_command', 'pending')
    renderSoloTripPage()

    fireEvent.click(soloTripToggle())
    expect(householdAwayCalls()).toHaveLength(1)
    await elapseHouseholdAwayTimeout()

    expect(screen.getAllByText('Home Assistant did not confirm the Solo Trip change. Wait for the dashboard to refresh before sending another request.')).not.toHaveLength(0)
    expect(soloTripToggle()).toBeDisabled()
    fireEvent.click(soloTripToggle())
    expect(householdAwayCalls()).toHaveLength(1)

    await act(async () => resolvePendingMockHouseholdAwayCommands())
    expect(soloTripToggle()).toHaveAttribute('aria-checked', 'false')
  })

  it('locks a timed-out end-now request until the authoritative snapshot arrives', async () => {
    vi.useFakeTimers()
    setupSoloTripSnapshot('activating', {
      effects: { sleepypod_live_follow: false, sleepypod_schedule: false, wake_light_source: false },
    })
    setMockCallServiceOutcome('script', 'household_away_command', 'pending')
    renderSoloTripPage()

    fireEvent.click(soloTripToggle())
    expect(householdAwayCalls()).toHaveLength(1)
    await elapseHouseholdAwayTimeout()

    expect(screen.getAllByText('Home Assistant did not confirm the Solo Trip change. Wait for the dashboard to refresh before sending another request.')).not.toHaveLength(0)
    expect(soloTripToggle()).toBeDisabled()
    fireEvent.click(soloTripToggle())
    expect(householdAwayCalls()).toHaveLength(1)

    await act(async () => resolvePendingMockHouseholdAwayCommands())
    expect(soloTripToggle()).toHaveAttribute('aria-checked', 'false')
  })

  it('locks a timed-out return update until the authoritative snapshot arrives', async () => {
    vi.useFakeTimers()
    setupSoloTripSnapshot('scheduled')
    setMockCallServiceOutcome('script', 'household_away_command', 'pending')
    renderSoloTripPage()
    fireEvent.change(screen.getByLabelText('Return Date'), { target: { value: '2099-01-04' } })

    expect(householdAwayCalls()).toHaveLength(1)
    await elapseHouseholdAwayTimeout()

    expect(screen.getAllByText('Home Assistant did not confirm the Solo Trip change. Wait for the dashboard to refresh before sending another request.')).toHaveLength(1)
    expect(screen.getByLabelText('Return Date')).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Return Date'), { target: { value: '2099-01-05' } })
    expect(householdAwayCalls()).toHaveLength(1)

    await act(async () => resolvePendingMockHouseholdAwayCommands())
    expect(screen.getByLabelText('Return Date')).toBeEnabled()
  })

  it('keeps the traveler bed visible and read-only during an active Solo Trip', async () => {
    setupModernSleepypod()
    setupSoloTripSnapshot('active')
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    const travelerTile = screen.getByRole('button', { name: /Your Side Away · Read Only/ })
    expect(travelerTile).toHaveAttribute('data-muted', 'true')
    fireEvent.click(travelerTile)

    const dialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
    expect(within(dialog).getByRole('note', { name: 'Stephen Away' })).toHaveTextContent(
      "Your bed side is view-only during an active Solo Trip. Make changes from Steph's bed side.",
    )
    expect(within(dialog).getAllByRole('note', { name: 'Stephen Away' })).toHaveLength(1)
    expect(dialog.querySelectorAll('[data-eight-sleep-away-chip="true"]')).toHaveLength(1)
    expect(within(dialog).getByRole('button', { name: /Stephen's Bed Power Control · Read-Only During Solo Trip/ })).toBeDisabled()
    expect(within(dialog).queryByRole('slider', { name: "Stephen's Bed target level" })).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Alarms' }))
    expect(await within(dialog).findByRole('button', { name: 'Add Alarm' })).toBeDisabled()
    expect(mockCallServiceCalls).toEqual([])
  })

  it('personalizes the traveler-side bed notice for home and unknown viewers', async () => {
    setupModernSleepypod()
    setupSoloTripSnapshot('active')
    setMockUser({ id: HOUSEHOLD_RESIDENTS.steph.haUserId, name: 'Steph' })
    const homeView = render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Stephen's Side Away · Read Only/ }))
    const homeDialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
    expect(within(homeDialog).getByRole('note', { name: 'Stephen Away' })).toHaveTextContent(
      "Stephen's bed side is view-only during an active Solo Trip. Make changes from your bed side.",
    )

    homeView.unmount()
    window.history.replaceState(null, '', window.location.pathname)
    setMockUser({ id: 'unknown-user', name: 'Unknown' })
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)
    fireEvent.click(screen.getByRole('button', { name: /Stephen's Bed Away · Read Only/ }))
    const unknownDialog = await screen.findByRole('dialog', { name: "Stephen's Bed" })
    expect(within(unknownDialog).getByRole('note', { name: 'Stephen Away' })).toHaveTextContent(
      "This traveler bed side is view-only during an active Solo Trip. Make changes from Steph's bed side.",
    )
    expect(mockCallServiceCalls).toEqual([])
  })

  it.each([
    ['stephen', "Steph's Bed", "Steph's Side", 'right', "While you are away from home and the Solo Trip setting is enabled in settings, Steph's controls and alarms will control the entire bed."],
    ['steph', "Stephen's Bed", 'Your Side', 'left', 'While Steph is away from home and the Solo Trip setting is enabled in settings, your controls and alarms will control the entire bed.'],
  ] as const)('routes %s-away home-side power and stage controls through one whole-bed command path', async (traveler, homeBedTitle, homeSideTitle, side, notice) => {
    setupModernSleepypod()
    setupSoloTripSnapshot('active', { traveler })
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: new RegExp(`${homeSideTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} Whole Bed`) }))
    const dialog = await screen.findByRole('dialog', { name: `${homeBedTitle} · Whole Bed` })
    const awayTitle = `${traveler === 'stephen' ? 'Stephen' : 'Steph'} Away`
    expect(within(dialog).getByRole('note', { name: awayTitle })).toHaveTextContent(notice)
    expect(dialog.querySelectorAll('[data-eight-sleep-away-chip="true"]')).toHaveLength(1)

    fireEvent.keyDown(within(dialog).getByRole('slider', { name: `${homeBedTitle} target level` }), { key: 'ArrowRight' })
    await waitFor(() => expect(mockCallServiceCalls).toContainEqual(expect.objectContaining({
      domain: 'script',
      service: 'household_away_command',
      serviceData: expect.objectContaining({
        action: 'set_outside_level',
        operation: 'sleepypod_command',
        side,
      }),
    })))
    expect(mockCallServiceCalls.some((call) => call.domain === 'number')).toBe(false)

    mockCallServiceCalls.length = 0
    fireEvent.click(within(dialog).getByRole('button', { name: new RegExp(`Increase ${homeBedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} Asleep level`) }))
    await waitFor(() => expect(mockCallServiceCalls).toContainEqual(expect.objectContaining({
      domain: 'script',
      service: 'household_away_command',
      serviceData: expect.objectContaining({
        action: 'set_stage_level',
        operation: 'sleepypod_command',
        phase: 'asleep',
        side,
      }),
    })))
    expect(mockCallServiceCalls.some((call) => call.domain === 'input_number' || call.domain === 'mqtt')).toBe(false)

    mockCallServiceCalls.length = 0
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(within(dialog).getByRole('button', { name: new RegExp(`Turn off ${homeBedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }))
    await waitFor(() => expect(mockCallServiceCalls).toContainEqual(expect.objectContaining({
      domain: 'script',
      service: 'household_away_command',
      serviceData: expect.objectContaining({
        action: 'set_power',
        enabled: false,
        operation: 'sleepypod_command',
        side,
      }),
    })))
    expect(mockCallServiceCalls.some((call) => call.domain === 'climate' || call.domain === 'switch')).toBe(false)
  })

  it('routes the home-side active alarm stop through the native command script', async () => {
    setupModernSleepypod()
    setupSoloTripSnapshot('active')
    mockEntities['sensor.master_bedroom_sleepypod_eight_pod_right_alarm_state'].state = 'ringing'
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    fireEvent.click(screen.getByRole('button', { name: /Steph's Side Whole Bed/ }))
    const dialog = await screen.findByRole('dialog', { name: "Steph's Bed · Whole Bed" })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Snooze' }))
    await waitFor(() => expect(mockCallServiceCalls).toContainEqual(expect.objectContaining({
      domain: 'script',
      service: 'household_away_command',
      serviceData: expect.objectContaining({
        action: 'snooze_alarm',
        operation: 'sleepypod_command',
        side: 'right',
      }),
    })))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Stop Alarm' }))

    await waitFor(() => expect(mockCallServiceCalls).toContainEqual(expect.objectContaining({
      domain: 'script',
      service: 'household_away_command',
      serviceData: expect.objectContaining({
        action: 'stop_alarm',
        operation: 'sleepypod_command',
        side: 'right',
      }),
    })))
    expect(mockCallServiceCalls.some((call) => call.domain === 'button')).toBe(false)
  })
})
