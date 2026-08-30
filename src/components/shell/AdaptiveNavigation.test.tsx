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
})
