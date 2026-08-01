import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AtAGlancePage } from './AtAGlancePage'
import { DashboardViewPage } from './DashboardViewPage'
import { mockDonetickTasksById, mockEntities, mockState, mockTodoItemsByEntity, resetMockHass } from '../test/mocks/hakitCoreState'

const OVERDUE_ENTITY_ID = 'todo.stephen_s_past_due_with_unassigned'
const UPCOMING_ENTITY_ID = 'todo.stephen_s_due_today_with_unassigned'
const EXPIRED_ITEMS_ENTITY_ID = 'sensor.evershelf_expired_items'
const VACATION_MODE_ENTITY_ID = 'input_boolean.vacation_mode'
const DEFAULT_EXPIRED_LIST = mockEntities[EXPIRED_ITEMS_ENTITY_ID].attributes.expired_list

// The badge and the Expired Food tab count the sensor's expired_list on the local calendar rather
// than trusting its UTC-derived state, so tests have to seed the list, not the state.
function setExpiredFood(count: number) {
  const past = new Date()
  past.setDate(past.getDate() - 5)
  const expiryDate = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`
  mockEntities[EXPIRED_ITEMS_ENTITY_ID].attributes.expired_list = Array.from({ length: count }, (_, index) => ({
    brand: '',
    days_remaining: -5,
    expiry_date: expiryDate,
    inventory_id: 900 + index,
    location: 'frigo',
    name: `Expired Item ${index + 1}`,
    quantity: 1,
  }))
  mockEntities[EXPIRED_ITEMS_ENTITY_ID].state = String(count)
}

function setDashboardUrl(url: string) {
  window.history.replaceState(null, '', url)
}

function summaryUrl(search: string, hash = '#daily-report') {
  return `/sfenton-react-dash/home${search}${hash}`
}

function renderHome() {
  return render(<AtAGlancePage activePath="overview" onNavigate={() => {}} />)
}

describe('Daily summary modal', () => {
  beforeEach(() => {
    resetMockHass()
    mockEntities[EXPIRED_ITEMS_ENTITY_ID].attributes.expired_list = DEFAULT_EXPIRED_LIST
    mockEntities[VACATION_MODE_ENTITY_ID].state = 'off'
    mockTodoItemsByEntity[OVERDUE_ENTITY_ID] = [
      { uid: '240--2026-07-24 17:30:00+00:00', summary: 'Take out the trash', status: 'needs_action', due: '2026-07-24T17:30:00+00:00' },
    ]
    mockTodoItemsByEntity[UPCOMING_ENTITY_ID] = [
      { uid: '222--2026-12-31 23:30:00+00:00', summary: 'Water the plants', status: 'needs_action', due: '2026-12-31T23:30:00+00:00' },
    ]
    mockDonetickTasksById[240] = {
      assignees: [1],
      assigned_to: 1,
      description: 'Use both bins',
      frequency: 1,
      frequency_metadata: {},
      frequency_type: 'once',
      hide_on_vacation: true,
      id: 240,
      name: 'Take out the trash',
      next_due_date: '2026-07-24T17:30:00+00:00',
      priority: 3,
    }
    mockDonetickTasksById[222] = {
      assignees: [1],
      assigned_to: 1,
      description: 'Soak the porch planters',
      frequency: 1,
      frequency_metadata: {},
      frequency_type: 'weekly',
      hide_on_vacation: true,
      id: 222,
      name: 'Water the plants',
      next_due_date: '2026-12-31T23:30:00+00:00',
      priority: 1,
    }
    setDashboardUrl(summaryUrl('?path=overview&user=stephen'))
  })

  afterEach(() => {
    setDashboardUrl('/')
  })

  it('opens from the deep link titled for the requested user without a subtitle', async () => {
    renderHome()

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText("Stephen's Summary")).toBeInTheDocument()
    expect(dialog).toHaveAttribute('data-has-subtitle', 'false')
    expect(await within(dialog).findByText('Take out the trash')).toBeInTheDocument()
  })

  it('titles the summary for the other household user', async () => {
    setDashboardUrl(summaryUrl('?path=overview&user=steph'))
    renderHome()

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { level: 2, name: "Steph's Summary" })).toBeInTheDocument()
  })

  it('uses icon-only tabs for overdue, upcoming, and expired food', async () => {
    mockEntities[OVERDUE_ENTITY_ID].state = '0'
    setExpiredFood(0)
    renderHome()

    const dialog = await screen.findByRole('dialog')
    const nav = within(dialog).getByRole('navigation', { name: 'Daily report sections' })
    const tabButtons = within(nav).getAllByRole('button')
    expect(tabButtons.map((button) => button.getAttribute('aria-label'))).toEqual(['Overdue Chores', 'Upcoming Chores', 'Expired Food'])
    for (const button of tabButtons) expect(button).toHaveTextContent('')
  })

  it('badges the overdue and expired food tabs but never upcoming', async () => {
    mockEntities[OVERDUE_ENTITY_ID].state = '2'
    mockEntities[UPCOMING_ENTITY_ID].state = '7'
    setExpiredFood(4)
    renderHome()

    const dialog = await screen.findByRole('dialog')
    const nav = within(dialog).getByRole('navigation', { name: 'Daily report sections' })

    expect(within(within(nav).getByRole('button', { name: /^Overdue Chores/ })).getByText('2')).toBeInTheDocument()
    expect(within(within(nav).getByRole('button', { name: /^Expired Food/ })).getByText('4')).toBeInTheDocument()

    const upcoming = within(nav).getByRole('button', { name: /^Upcoming Chores/ })
    expect(upcoming.querySelector('[data-count]')).toBeNull()
    expect(upcoming).toHaveAccessibleName('Upcoming Chores')
  })

  it('caps modal nav badges at 9+ and hides them at zero', async () => {
    mockEntities[OVERDUE_ENTITY_ID].state = '0'
    setExpiredFood(32)
    renderHome()

    const dialog = await screen.findByRole('dialog')
    const nav = within(dialog).getByRole('navigation', { name: 'Daily report sections' })

    expect(within(within(nav).getByRole('button', { name: /^Expired Food/ })).getByText('9+')).toBeInTheDocument()
    expect(within(nav).getByRole('button', { name: 'Overdue Chores' }).querySelector('[data-count]')).toBeNull()
  })

  it('drops the expired food nav badge while Vacation Mode is on', async () => {
    mockEntities[VACATION_MODE_ENTITY_ID].state = 'on'
    mockEntities[OVERDUE_ENTITY_ID].state = '2'
    setExpiredFood(32)
    renderHome()

    const dialog = await screen.findByRole('dialog')
    const nav = within(dialog).getByRole('navigation', { name: 'Daily report sections' })

    expect(within(within(nav).getByRole('button', { name: /^Overdue Chores/ })).getByText('2')).toBeInTheDocument()
    expect(within(nav).getByRole('button', { name: 'Expired Food' }).querySelector('[data-count]')).toBeNull()
  })

  it('keeps a section header for the active tab outside the modal scroller', async () => {
    renderHome()

    const dialog = await screen.findByRole('dialog')
    const bodyHeader = dialog.querySelector('[data-modal-sheet-body-header="true"]')
    expect(bodyHeader).not.toBeNull()
    expect(bodyHeader?.contains(dialog.querySelector('[data-modal-sheet-body="true"]'))).toBe(false)
    expect(within(bodyHeader as HTMLElement).getByRole('heading', { level: 2, name: 'Overdue Chores' })).toBeInTheDocument()

    const nav = within(dialog).getByRole('navigation', { name: 'Daily report sections' })
    fireEvent.click(within(nav).getByRole('button', { name: /^Expired Food/ }))
    expect(within(bodyHeader as HTMLElement).getByRole('heading', { level: 2, name: 'Expired Food' })).toBeInTheDocument()
  })

  it('switches between the overdue, upcoming, and expired food tabs', async () => {
    renderHome()

    const dialog = await screen.findByRole('dialog')
    const nav = within(dialog).getByRole('navigation', { name: 'Daily report sections' })
    expect(await within(dialog).findByText('Take out the trash')).toBeInTheDocument()

    fireEvent.click(within(nav).getByRole('button', { name: /^Upcoming Chores/ }))
    expect(await within(dialog).findByText('Water the plants')).toBeInTheDocument()
    expect(within(dialog).queryByText('Take out the trash')).not.toBeInTheDocument()

    fireEvent.click(within(nav).getByRole('button', { name: /^Expired Food/ }))
    await waitFor(() => expect(within(dialog).getByLabelText('Expired Food inventory list')).toBeInTheDocument())
    expect(within(dialog).queryByText('Water the plants')).not.toBeInTheDocument()
  })

  it('opens the shared task editor from overdue and upcoming chore rows', async () => {
    renderHome()

    const summaryDialog = await screen.findByRole('dialog', { name: "Stephen's Summary" })
    const overdueRegion = within(summaryDialog).getByRole('region', { name: 'Overdue Chores' })
    fireEvent.click(within(overdueRegion).getByRole('button', { name: 'Edit Take out the trash' }))

    const editDialog = await screen.findByRole('dialog', { name: 'Edit Task' })
    await waitFor(() => expect(within(editDialog).getByLabelText('Task Name')).toHaveValue('Take out the trash'))
    expect(within(editDialog).getByLabelText('Description')).toHaveValue('Use both bins')
    expect(within(editDialog).getByRole('button', { name: 'Save Task' })).toBeInTheDocument()

    fireEvent.click(within(editDialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(editDialog).toHaveAttribute('data-state', 'closed'))
    expect(summaryDialog).toHaveAttribute('data-state', 'open')

    const nav = summaryDialog.querySelector('nav[aria-label="Daily report sections"]')
    expect(nav).not.toBeNull()
    fireEvent.click(within(nav as HTMLElement).getByRole('button', { name: /^Upcoming Chores/, hidden: true }))
    const upcomingRegion = await within(summaryDialog).findByRole('region', { name: 'Upcoming Chores' })
    expect(within(upcomingRegion).getByRole('button', { name: 'Edit Water the plants' })).toBeInTheDocument()
  })

  it('renders expired food rows with the food page row UX', async () => {
    renderHome()

    const dialog = await screen.findByRole('dialog')
    const nav = within(dialog).getByRole('navigation', { name: 'Daily report sections' })
    fireEvent.click(within(nav).getByRole('button', { name: /^Expired Food/ }))

    const [expiredRow] = await within(dialog).findAllByLabelText(/^Milk Expired on /, {}, { timeout: 3000 })
    expect(expiredRow).toHaveAttribute('data-expiry-tone', 'expired')
    expect(within(expiredRow).getByRole('button', { name: 'Edit Milk' })).toBeInTheDocument()
    expect(within(expiredRow).getByRole('button', { name: 'Delete Milk' })).toBeInTheDocument()
    expect(within(expiredRow).getByRole('button', { name: 'Add Milk to shopping list' })).toBeInTheDocument()
  })

  it('shows a centred modal empty state when a tab has nothing to report', async () => {
    mockTodoItemsByEntity[OVERDUE_ENTITY_ID] = []
    renderHome()

    const dialog = await screen.findByRole('dialog')
    const empty = await within(dialog).findByRole('heading', { level: 2, name: 'No Chores Due' })
    const emptySection = empty.closest('section')
    expect(emptySection).toHaveAttribute('data-empty-layout', 'modal')
    expect(within(emptySection as HTMLElement).getByText('You are all caught up on chores that slipped past their due date.')).toBeInTheDocument()
  })

  // Titles stay identical across vacation and non-vacation; only the supporting line changes.
  it('keeps empty state titles consistent between vacation and non-vacation', async () => {
    mockTodoItemsByEntity[UPCOMING_ENTITY_ID] = []
    setExpiredFood(0)
    renderHome()

    const dialog = await screen.findByRole('dialog')
    const nav = within(dialog).getByRole('navigation', { name: 'Daily report sections' })

    fireEvent.click(within(nav).getByRole('button', { name: /^Upcoming Chores/ }))
    expect(await within(dialog).findByRole('heading', { level: 2, name: 'No Chores Upcoming' })).toBeInTheDocument()
    expect(within(dialog).getByText('There is nothing else on your schedule for the rest of today.')).toBeInTheDocument()

    fireEvent.click(within(nav).getByRole('button', { name: /^Expired Food/ }))
    expect(await within(dialog).findByRole('heading', { level: 2, name: 'No Expired Food' })).toBeInTheDocument()
    expect(within(dialog).getByText('Everything in the kitchen is still within date.')).toBeInTheDocument()
  })

  it('uses vacation copy for the empty chore tabs while Vacation Mode is on', async () => {
    mockEntities[VACATION_MODE_ENTITY_ID].state = 'on'
    mockTodoItemsByEntity[OVERDUE_ENTITY_ID] = []
    mockTodoItemsByEntity[UPCOMING_ENTITY_ID] = []
    renderHome()

    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByRole('heading', { level: 2, name: 'No Chores Due' })).toBeInTheDocument()
    expect(within(dialog).getByText('Enjoy vacation!')).toBeInTheDocument()

    const nav = within(dialog).getByRole('navigation', { name: 'Daily report sections' })
    fireEvent.click(within(nav).getByRole('button', { name: /^Upcoming Chores/ }))
    expect(await within(dialog).findByRole('heading', { level: 2, name: 'No Chores Upcoming' })).toBeInTheDocument()
    expect(within(dialog).getByText('Enjoy vacation!')).toBeInTheDocument()
  })

  it('hides expired food behind vacation copy when items are still expired', async () => {
    mockEntities[VACATION_MODE_ENTITY_ID].state = 'on'
    renderHome()

    const dialog = await screen.findByRole('dialog')
    const nav = within(dialog).getByRole('navigation', { name: 'Daily report sections' })
    fireEvent.click(within(nav).getByRole('button', { name: /^Expired Food/ }))

    expect(await within(dialog).findByRole('heading', { level: 2, name: 'Expired Food Hidden' })).toBeInTheDocument()
    expect(within(dialog).getByText('Enjoy vacation!')).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Expired Food inventory list')).not.toBeInTheDocument()
  })

  it('reports no expired food on vacation only when the count is a confirmed zero', async () => {
    mockEntities[VACATION_MODE_ENTITY_ID].state = 'on'
    setExpiredFood(0)
    renderHome()

    const dialog = await screen.findByRole('dialog')
    const nav = within(dialog).getByRole('navigation', { name: 'Daily report sections' })
    fireEvent.click(within(nav).getByRole('button', { name: /^Expired Food/ }))

    expect(await within(dialog).findByRole('heading', { level: 2, name: 'No Expired Food' })).toBeInTheDocument()
    expect(within(dialog).getByText('Enjoy vacation!')).toBeInTheDocument()
  })

  it('shows a modal empty state when nothing has expired', async () => {
    setExpiredFood(0)
    renderHome()

    const dialog = await screen.findByRole('dialog')
    const nav = within(dialog).getByRole('navigation', { name: 'Daily report sections' })
    fireEvent.click(within(nav).getByRole('button', { name: /^Expired Food/ }))

    const empty = await within(dialog).findByRole('heading', { level: 2, name: 'No Expired Food' })
    expect(empty.closest('section')).toHaveAttribute('data-empty-layout', 'modal')
    expect(within(dialog).queryByLabelText('Expired Food inventory list')).not.toBeInTheDocument()
  })

  it('falls back to the signed-in Home Assistant user when no user param is present', async () => {
    setDashboardUrl(summaryUrl('?path=overview'))
    renderHome()

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText("Stephen's Summary")).toBeInTheDocument()
  })

  it('offers a user picker when the summary user cannot be resolved', async () => {
    mockState.user = null
    setDashboardUrl(summaryUrl('?path=overview&user=someone-else'))
    renderHome()

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Summary')).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Whose Summary?' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Stephen' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Steph' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('navigation', { name: 'Daily report sections' })).not.toBeInTheDocument()
  })

  it('badges the profile button with overdue chores plus expired food', async () => {
    setDashboardUrl('/sfenton-react-dash/home?path=overview')
    mockEntities[OVERDUE_ENTITY_ID].state = '4'
    setExpiredFood(3)
    renderHome()

    const profile = screen.getByRole('button', { name: /^Open Stephen's Summary/ })
    expect(within(profile).getByText('7')).toBeInTheDocument()
    expect(profile).toHaveAccessibleName("Open Stephen's Summary, 7 items need attention")
  })

  it('excludes upcoming chores from the profile badge', async () => {
    setDashboardUrl('/sfenton-react-dash/home?path=overview')
    mockEntities[OVERDUE_ENTITY_ID].state = '1'
    mockEntities[UPCOMING_ENTITY_ID].state = '5'
    setExpiredFood(0)
    renderHome()

    const profile = screen.getByRole('button', { name: /^Open Stephen's Summary/ })
    expect(within(profile).getByText('1')).toBeInTheDocument()
    expect(profile).toHaveAccessibleName("Open Stephen's Summary, 1 item needs attention")
  })

  it('caps the profile badge at 9+', async () => {
    setDashboardUrl('/sfenton-react-dash/home?path=overview')
    mockEntities[OVERDUE_ENTITY_ID].state = '4'
    setExpiredFood(32)
    renderHome()

    expect(within(screen.getByRole('button', { name: /^Open Stephen's Summary/ })).getByText('9+')).toBeInTheDocument()
  })

  it('drops the profile badge when nothing needs attention', async () => {
    setDashboardUrl('/sfenton-react-dash/home?path=overview')
    mockEntities[OVERDUE_ENTITY_ID].state = '0'
    setExpiredFood(0)
    renderHome()

    const profile = screen.getByRole('button', { name: "Open Stephen's Summary" })
    expect(profile.querySelector('[data-count]')).toBeNull()
  })

  it('leaves expired food out of the badge while Vacation Mode is on', async () => {
    setDashboardUrl('/sfenton-react-dash/home?path=overview')
    mockEntities[VACATION_MODE_ENTITY_ID].state = 'on'
    mockEntities[OVERDUE_ENTITY_ID].state = '2'
    setExpiredFood(32)
    renderHome()

    expect(within(screen.getByRole('button', { name: /^Open Stephen's Summary/ })).getByText('2')).toBeInTheDocument()
  })

  it('opens on the overdue tab when a notification link asks for auto selection', async () => {
    mockEntities[OVERDUE_ENTITY_ID].state = '2'
    setExpiredFood(5)
    setDashboardUrl(summaryUrl('?path=overview&user=stephen&tab=auto'))
    renderHome()

    const dialog = await screen.findByRole('dialog')
    const header = dialog.querySelector('[data-modal-sheet-body-header="true"]') as HTMLElement
    expect(within(header).getByRole('heading', { level: 2, name: 'Overdue Chores' })).toBeInTheDocument()
  })

  it('falls through to expired food when nothing is overdue', async () => {
    mockEntities[OVERDUE_ENTITY_ID].state = '0'
    mockEntities[UPCOMING_ENTITY_ID].state = '4'
    setExpiredFood(5)
    setDashboardUrl(summaryUrl('?path=overview&user=stephen&tab=auto'))
    renderHome()

    const dialog = await screen.findByRole('dialog')
    const header = dialog.querySelector('[data-modal-sheet-body-header="true"]') as HTMLElement
    expect(within(header).getByRole('heading', { level: 2, name: 'Expired Food' })).toBeInTheDocument()
  })

  it('falls through to upcoming when only upcoming chores remain', async () => {
    mockEntities[OVERDUE_ENTITY_ID].state = '0'
    mockEntities[UPCOMING_ENTITY_ID].state = '4'
    setExpiredFood(0)
    setDashboardUrl(summaryUrl('?path=overview&user=stephen&tab=auto'))
    renderHome()

    const dialog = await screen.findByRole('dialog')
    const header = dialog.querySelector('[data-modal-sheet-body-header="true"]') as HTMLElement
    expect(within(header).getByRole('heading', { level: 2, name: 'Upcoming Chores' })).toBeInTheDocument()
  })

  it('honours an explicit tab request from a link', async () => {
    mockEntities[OVERDUE_ENTITY_ID].state = '9'
    setDashboardUrl(summaryUrl('?path=overview&user=stephen&tab=upcoming'))
    renderHome()

    const dialog = await screen.findByRole('dialog')
    const header = dialog.querySelector('[data-modal-sheet-body-header="true"]') as HTMLElement
    expect(within(header).getByRole('heading', { level: 2, name: 'Upcoming Chores' })).toBeInTheDocument()
  })

  it('consumes the tab request so a later manual open keeps the chosen tab', async () => {
    mockEntities[OVERDUE_ENTITY_ID].state = '0'
    setExpiredFood(5)
    setDashboardUrl(summaryUrl('?path=overview&user=stephen&tab=auto'))
    renderHome()

    const dialog = await screen.findByRole('dialog')
    const header = dialog.querySelector('[data-modal-sheet-body-header="true"]') as HTMLElement
    expect(within(header).getByRole('heading', { level: 2, name: 'Expired Food' })).toBeInTheDocument()
    await waitFor(() => expect(window.location.search).not.toContain('tab=auto'))
  })

  it('leaves the tab alone when the link makes no request', async () => {
    mockEntities[OVERDUE_ENTITY_ID].state = '0'
    setExpiredFood(5)
    setDashboardUrl(summaryUrl('?path=overview&user=stephen'))
    renderHome()

    const dialog = await screen.findByRole('dialog')
    const header = dialog.querySelector('[data-modal-sheet-body-header="true"]') as HTMLElement
    expect(within(header).getByRole('heading', { level: 2, name: 'Overdue Chores' })).toBeInTheDocument()
  })

  it('stays closed when no summary hash is present', () => {
    setDashboardUrl('/sfenton-react-dash/home?path=overview')
    renderHome()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens from the header profile button on the home page', async () => {
    setDashboardUrl('/sfenton-react-dash/home?path=overview')
    renderHome()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Open Stephen's Summary/ }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { level: 2, name: "Stephen's Summary" })).toBeInTheDocument()
  })

  it('opens from the header profile button on a non-home page', async () => {
    setDashboardUrl('/sfenton-react-dash/home?path=vacuums')
    render(<DashboardViewPage activePath="vacuums" onNavigate={() => {}} path="vacuums" />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Open Stephen's Summary/ }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { level: 2, name: "Stephen's Summary" })).toBeInTheDocument()
    expect(within(dialog).getByRole('navigation', { name: 'Daily report sections' })).toBeInTheDocument()
  })

  it('does not open a page sheet for the app-level summary hash', async () => {
    setDashboardUrl(summaryUrl('?path=vacuums&user=stephen'))
    render(<DashboardViewPage activePath="vacuums" onNavigate={() => {}} path="vacuums" />)

    const dialogs = await screen.findAllByRole('dialog')
    expect(dialogs).toHaveLength(1)
    expect(within(dialogs[0]).getByRole('heading', { level: 2, name: "Stephen's Summary" })).toBeInTheDocument()
  })
})
