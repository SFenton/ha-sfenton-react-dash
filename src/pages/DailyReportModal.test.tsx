import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AtAGlancePage } from './AtAGlancePage'
import { DashboardViewPage } from './DashboardViewPage'
import { mockState, mockTodoItemsByEntity, resetMockHass } from '../test/mocks/hakitCoreState'

const OVERDUE_ENTITY_ID = 'todo.stephen_s_past_due_with_unassigned'
const UPCOMING_ENTITY_ID = 'todo.stephen_s_due_today_with_unassigned'

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
    mockTodoItemsByEntity[OVERDUE_ENTITY_ID] = [
      { uid: 'overdue-1', summary: 'Take out the trash', status: 'needs_action', due: '2026-07-24T17:30:00+00:00' },
    ]
    mockTodoItemsByEntity[UPCOMING_ENTITY_ID] = [
      { uid: 'upcoming-1', summary: 'Water the plants', status: 'needs_action', due: '2026-12-31T23:30:00+00:00' },
    ]
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
    renderHome()

    const dialog = await screen.findByRole('dialog')
    const nav = within(dialog).getByRole('navigation', { name: 'Daily report sections' })
    const tabButtons = within(nav).getAllByRole('button')
    expect(tabButtons.map((button) => button.getAttribute('aria-label'))).toEqual(['Overdue Chores', 'Upcoming Chores', 'Expired Food'])
    for (const button of tabButtons) expect(button).toHaveTextContent('')
  })

  it('keeps a section header for the active tab outside the modal scroller', async () => {
    renderHome()

    const dialog = await screen.findByRole('dialog')
    const bodyHeader = dialog.querySelector('[data-modal-sheet-body-header="true"]')
    expect(bodyHeader).not.toBeNull()
    expect(bodyHeader?.contains(dialog.querySelector('[data-modal-sheet-body="true"]'))).toBe(false)
    expect(within(bodyHeader as HTMLElement).getByRole('heading', { level: 2, name: 'Overdue Chores' })).toBeInTheDocument()

    const nav = within(dialog).getByRole('navigation', { name: 'Daily report sections' })
    fireEvent.click(within(nav).getByRole('button', { name: 'Expired Food' }))
    expect(within(bodyHeader as HTMLElement).getByRole('heading', { level: 2, name: 'Expired Food' })).toBeInTheDocument()
  })

  it('switches between the overdue, upcoming, and expired food tabs', async () => {
    renderHome()

    const dialog = await screen.findByRole('dialog')
    const nav = within(dialog).getByRole('navigation', { name: 'Daily report sections' })
    expect(await within(dialog).findByText('Take out the trash')).toBeInTheDocument()

    fireEvent.click(within(nav).getByRole('button', { name: 'Upcoming Chores' }))
    expect(await within(dialog).findByText('Water the plants')).toBeInTheDocument()
    expect(within(dialog).queryByText('Take out the trash')).not.toBeInTheDocument()

    fireEvent.click(within(nav).getByRole('button', { name: 'Expired Food' }))
    await waitFor(() => expect(within(dialog).getByLabelText('Expired Food inventory list')).toBeInTheDocument())
    expect(within(dialog).queryByText('Water the plants')).not.toBeInTheDocument()
  })

  it('renders expired food rows with the food page row UX', async () => {
    renderHome()

    const dialog = await screen.findByRole('dialog')
    const nav = within(dialog).getByRole('navigation', { name: 'Daily report sections' })
    fireEvent.click(within(nav).getByRole('button', { name: 'Expired Food' }))

    const [expiredRow] = await within(dialog).findAllByLabelText(/^Milk Expired on /, {}, { timeout: 3000 })
    expect(expiredRow).toHaveAttribute('data-expiry-tone', 'expired')
    expect(within(expiredRow).getByRole('button', { name: 'Edit Milk' })).toBeInTheDocument()
    expect(within(expiredRow).getByRole('button', { name: 'Delete Milk' })).toBeInTheDocument()
    expect(within(expiredRow).getByRole('button', { name: 'Add Milk to shopping list' })).toBeInTheDocument()
  })

  it('shows empty copy when a tab has nothing to report', async () => {
    mockTodoItemsByEntity[OVERDUE_ENTITY_ID] = []
    renderHome()

    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('Nothing is overdue. Nice work.')).toBeInTheDocument()
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
    expect(within(dialog).getByRole('heading', { name: 'Whose summary?' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Stephen' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Steph' })).toBeInTheDocument()
    expect(within(dialog).queryByRole('navigation', { name: 'Daily report sections' })).not.toBeInTheDocument()
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
    fireEvent.click(screen.getByRole('button', { name: "Open Stephen's Summary" }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { level: 2, name: "Stephen's Summary" })).toBeInTheDocument()
  })

  it('opens from the header profile button on a non-home page', async () => {
    setDashboardUrl('/sfenton-react-dash/home?path=vacuums')
    render(<DashboardViewPage activePath="vacuums" onNavigate={() => {}} path="vacuums" />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: "Open Stephen's Summary" }))

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
