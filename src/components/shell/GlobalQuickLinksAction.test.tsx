import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QUICK_ACCESS_ITEMS, SECURITY_ENTITY } from '../../constants/atAGlance'
import { SHOW_OUTDOOR_FAUCETS_ENTITY_ID } from '../../constants/sprinklers'
import { mockCallServiceCalls, mockEntities, resetMockHass } from '../../test/mocks/hakitCoreState'
import { GlobalQuickLinksAction } from './GlobalQuickLinksAction'

describe('GlobalQuickLinksAction', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', window.location.pathname)
    resetMockHass()
    mockEntities[SHOW_OUTDOOR_FAUCETS_ENTITY_ID].state = 'off'
  })

  it('uses production portrait tiles and changes only the density and row-fill policy on rotation', async () => {
    const previousWidth = window.innerWidth
    const previousHeight = window.innerHeight
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 393 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 852 })
    const view = render(<GlobalQuickLinksAction onNavigate={vi.fn()} />)
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Quick Links' }))
      const dialog = await screen.findByRole('dialog', { name: 'Quick Links' })
      const grid = within(dialog).getByRole('group', { name: 'Quick Links' })
      const rooms = within(grid).getByRole('button', { name: 'Rooms' })
      expect(grid).toHaveAttribute('data-dynamic-grid-fill-rows', 'true')
      expect(rooms.querySelector('svg')).toHaveAttribute('width', '24')
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 852 })
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 393 })
      fireEvent(window, new Event('resize'))
      expect(grid).toHaveAttribute('data-dynamic-grid-fill-rows', 'except-last')
      expect(rooms.querySelector('svg')).toHaveAttribute('width', '18')
      expect(within(grid).getByRole('button', { name: 'Rooms' })).toBe(rooms)
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 393 })
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 852 })
      fireEvent(window, new Event('resize'))
      expect(grid).toHaveAttribute('data-dynamic-grid-fill-rows', 'true')
      expect(rooms.querySelector('svg')).toHaveAttribute('width', '24')
      expect(mockCallServiceCalls).toHaveLength(0)
    } finally {
      view.unmount()
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: previousWidth })
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: previousHeight })
    }
  })

  it('opens the typed Quick Links grid and closes through the shared sheet before navigating', async () => {
    const navigate = vi.fn()
    render(<GlobalQuickLinksAction onNavigate={navigate} />)

    const trigger = screen.getByRole('button', { name: 'Quick Links' })
    expect(trigger).toHaveTextContent('')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
    expect(trigger).toHaveAttribute('data-action-kind', 'modal')
    expect(trigger).toHaveAttribute('data-modal-opener-exception', 'floating-action')
    expect(trigger).toHaveAttribute('title', 'Quick Links')
    expect(screen.queryByRole('button', { name: 'Vacuums' })).not.toBeInTheDocument()

    fireEvent.click(trigger)

    const dialog = await screen.findByRole('dialog', { name: 'Quick Links' })
    const grid = within(dialog).getByRole('group', { name: 'Quick Links' })
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(grid).toHaveAttribute('data-dynamic-grid', 'true')
    expect(grid).toHaveAttribute('data-dynamic-grid-item-sizing', 'content-aware')
    expect(within(grid).getAllByRole('button')[0]).toHaveAccessibleName('Rooms')
    expect(within(grid).getAllByRole('button').map((button) => button.getAttribute('data-action-kind'))).toEqual(
      QUICK_ACCESS_ITEMS.filter((item) => !item.visibilityEntityId).map((item) => item.action.kind),
    )
    expect(within(grid).getByRole('button', { name: 'Rooms' })).toHaveAttribute('data-modal-opener', 'true')
    expect(within(grid).getByRole('button', { name: 'Food & Recipes 35 Items • 6 Expiring Soon' })).toHaveAttribute('data-navigation-opener', 'true')
    expect(within(grid).getByRole('button', { name: /^Security System / })).toHaveAttribute('data-modal-opener', 'true')
    expect(within(grid).queryByRole('button', { name: 'Sprinklers' })).not.toBeInTheDocument()
    expect(mockCallServiceCalls).toHaveLength(0)

    fireEvent.click(within(grid).getByRole('button', { name: 'Food & Recipes 35 Items • 6 Expiring Soon' }))

    expect(navigate).toHaveBeenCalledWith('food')
    expect(dialog).toHaveAttribute('data-closing', 'true')
    expect(mockCallServiceCalls).toHaveLength(0)
  })

  it('opens Rooms as the first same-sheet detail and restores focus on Back', async () => {
    const navigate = vi.fn()
    render(<GlobalQuickLinksAction onNavigate={navigate} />)

    fireEvent.click(screen.getByRole('button', { name: 'Quick Links' }))
    const dialog = await screen.findByRole('dialog', { name: 'Quick Links' })
    expect(dialog).toHaveAttribute('data-scroll-mode', 'body')
    const roomsTile = within(dialog).getByRole('button', { name: 'Rooms' })
    fireEvent.click(roomsTile)

    expect(within(dialog).getByRole('heading', { name: 'Rooms' })).toBeInTheDocument()
    expect(dialog).toHaveAttribute('data-scroll-mode', 'panes')
    expect(within(dialog).getByRole('button', { name: 'Back' })).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getAllByRole('button', { name: / area$/ })[0]).toHaveFocus())

    fireEvent.click(within(dialog).getByRole('button', { name: 'Back' }))
    expect(dialog).toHaveAttribute('data-scroll-mode', 'body')
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Rooms' })).toHaveFocus())

    fireEvent.click(within(dialog).getByRole('button', { name: 'Rooms' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Living Room area' }))
    expect(navigate).toHaveBeenCalledWith('living-room')
  })

  it('keeps Security in one sheet and restores the overview tile on Back', async () => {
    mockEntities[SECURITY_ENTITY].state = 'armed_night'
    render(<GlobalQuickLinksAction onNavigate={() => undefined} />)

    fireEvent.click(screen.getByRole('button', { name: 'Quick Links' }))
    const dialog = await screen.findByRole('dialog', { name: 'Quick Links' })
    const securityTile = within(dialog).getByRole('button', { name: 'Security System Armed Night' })
    expect(securityTile).toHaveStyle('--tile-color: rgba(142, 36, 170, 0.5)')

    fireEvent.click(securityTile)

    expect(within(dialog).getByRole('heading', { name: 'Security System' })).toBeInTheDocument()
    expect(within(dialog).getByText('Armed Night')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Back' })).toBeInTheDocument()
    expect(window.location.hash).toBe('')
    await waitFor(() => expect(dialog.querySelector('[data-modal-detail-autofocus="true"]')).toHaveFocus())

    fireEvent.click(within(dialog).getByRole('button', { name: 'Back' }))

    expect(within(dialog).getByRole('heading', { name: 'Quick Links' })).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Security System Armed Night' })).toHaveFocus())
  })

  it('shows the Sprinklers destination only while Outdoor Faucets is enabled', async () => {
    const navigate = vi.fn()
    const view = render(<GlobalQuickLinksAction onNavigate={navigate} />)
    fireEvent.click(screen.getByRole('button', { name: 'Quick Links' }))
    const dialog = await screen.findByRole('dialog', { name: 'Quick Links' })
    expect(within(dialog).queryByRole('button', { name: 'Sprinklers' })).not.toBeInTheDocument()

    mockEntities[SHOW_OUTDOOR_FAUCETS_ENTITY_ID].state = 'on'
    view.rerender(<GlobalQuickLinksAction onNavigate={navigate} />)

    const sprinklers = within(dialog).getByRole('button', { name: 'Sprinklers' })
    expect(sprinklers).toHaveAttribute('data-navigation-opener', 'true')
    fireEvent.click(sprinklers)
    expect(navigate).toHaveBeenCalledWith('sprinklers')
  })
})
