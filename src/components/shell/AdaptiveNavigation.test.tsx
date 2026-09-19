import { fireEvent, render, screen } from '@testing-library/react'
import { AdaptiveNavigation } from './AdaptiveNavigation'
import { resetMockHass } from '../../test/mocks/hakitCoreState'
import { NavigationLayoutContext } from './NavigationLayoutContext'

describe('AdaptiveNavigation', () => {
  beforeEach(() => {
    resetMockHass()
  })

  it('uses the shared primary route data and active-route semantics', () => {
    const onNavigate = vi.fn()
    render(
      <NavigationLayoutContext.Provider value="rail">
        <AdaptiveNavigation activePath="living-room" onNavigate={onNavigate} />
      </NavigationLayoutContext.Provider>,
    )

    expect(screen.getByRole('button', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Settings' })).not.toHaveAttribute('aria-current')
    const chores = screen.getByRole('button', { name: /Chores/ })
    expect(chores.lastElementChild).toHaveAttribute('data-count')

    fireEvent.click(screen.getByRole('button', { name: 'Security' }))
    expect(onNavigate).toHaveBeenCalledWith('security')
  })

  it('prioritizes Home, the active section, and Settings when three Duo routes fit', () => {
    render(
      <NavigationLayoutContext.Provider value="duo">
        <AdaptiveNavigation activePath="thermostat" duoRouteCount={3} onNavigate={() => undefined} />
      </NavigationLayoutContext.Provider>,
    )

    expect(screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
      'Home',
      'Climate',
      'Settings',
      'Show all navigation',
    ])
    expect(screen.getByRole('button', { name: 'Climate' })).toHaveAttribute('aria-current', 'page')
  })

  it.each([
    [1, ['Home', 'Show all navigation']],
    [2, ['Home', 'Settings', 'Show all navigation']],
    [5, ['Home', 'Security', 'Climate', 'Chores, 1 overdue', 'Settings']],
  ] as const)('renders the expected controls when %i Duo routes fit', (duoRouteCount, expectedLabels) => {
    render(
      <NavigationLayoutContext.Provider value="duo">
        <AdaptiveNavigation
          activePath="overview"
          duoRouteCount={duoRouteCount}
          onNavigate={() => undefined}
        />
      </NavigationLayoutContext.Provider>,
    )

    expect(screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual(
      expectedLabels,
    )
  })
})
