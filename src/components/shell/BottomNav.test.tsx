import { fireEvent, render, screen, within } from '@testing-library/react'
import { BottomNav } from './BottomNav'
import { mockEntities, resetMockHass } from '../../test/mocks/hakitCoreState'

const OVERDUE_ENTITY_ID = 'todo.stephen_s_past_due_with_unassigned'

describe('BottomNav', () => {
  beforeEach(() => {
    resetMockHass()
  })

  it('badges only the Chores tab, with the overdue chore count', () => {
    mockEntities[OVERDUE_ENTITY_ID].state = '3'

    render(<BottomNav activePath="overview" onNavigate={() => {}} />)

    const chores = screen.getByRole('button', { name: /^Chores/ })
    expect(within(chores).getByText('3')).toBeInTheDocument()
    expect(chores).toHaveAccessibleName('Chores, 3 overdue')

    for (const label of ['Home', 'Security', 'Climate', 'Settings']) {
      expect(screen.getByRole('button', { name: label }).querySelector('[data-count]')).toBeNull()
    }
  })

  it('caps the Chores badge at 9+ and hides it when nothing is overdue', () => {
    mockEntities[OVERDUE_ENTITY_ID].state = '14'
    const { unmount } = render(<BottomNav activePath="overview" onNavigate={() => {}} />)
    expect(within(screen.getByRole('button', { name: /^Chores/ })).getByText('9+')).toBeInTheDocument()
    unmount()

    mockEntities[OVERDUE_ENTITY_ID].state = '0'
    render(<BottomNav activePath="overview" onNavigate={() => {}} />)
    const chores = screen.getByRole('button', { name: 'Chores' })
    expect(chores.querySelector('[data-count]')).toBeNull()
  })

  it('leaves expired food out of the Chores badge', () => {
    mockEntities[OVERDUE_ENTITY_ID].state = '1'
    mockEntities['sensor.evershelf_expired_items'].attributes.expired_list = [
      { expiry_date: '2020-01-01', inventory_id: 1, name: 'Ancient Milk' },
      { expiry_date: '2020-01-02', inventory_id: 2, name: 'Ancient Bread' },
    ]

    render(<BottomNav activePath="overview" onNavigate={() => {}} />)

    expect(within(screen.getByRole('button', { name: /^Chores/ })).getByText('1')).toBeInTheDocument()
  })

  it('updates the visual active tab on pointer down before route navigation commits', () => {
    const onNavigate = vi.fn()

    render(<BottomNav activePath="overview" onNavigate={onNavigate} />)

    const homeTab = screen.getByRole('button', { name: 'Home' })
    const securityTab = screen.getByRole('button', { name: 'Security' })

    expect(homeTab).toHaveAttribute('data-active', 'true')
    expect(homeTab).toHaveAttribute('aria-current', 'page')

    fireEvent.pointerDown(securityTab)

    expect(securityTab).toHaveAttribute('data-active', 'true')
    expect(securityTab).not.toHaveAttribute('aria-current')
    expect(homeTab).toHaveAttribute('aria-current', 'page')
    expect(onNavigate).not.toHaveBeenCalled()

    fireEvent.click(securityTab)

    expect(onNavigate).toHaveBeenCalledWith('security')
  })

  it('restores the route-backed active tab when a pointer interaction is cancelled', () => {
    const onNavigate = vi.fn()

    render(<BottomNav activePath="overview" onNavigate={onNavigate} />)

    const homeTab = screen.getByRole('button', { name: 'Home' })
    const securityTab = screen.getByRole('button', { name: 'Security' })

    fireEvent.pointerDown(securityTab)
    expect(securityTab).toHaveAttribute('data-active', 'true')

    fireEvent.pointerCancel(securityTab)

    expect(homeTab).toHaveAttribute('data-active', 'true')
    expect(onNavigate).not.toHaveBeenCalled()
  })
})
