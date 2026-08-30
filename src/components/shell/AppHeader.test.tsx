import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { resetMockHass } from '../../test/mocks/hakitCoreState'
import type { NavigationLayout } from '../../constants/navigationLayout'
import { AdaptiveNavigation } from './AdaptiveNavigation'
import { AppHeader } from './AppHeader'
import { NavigationLayoutContext } from './NavigationLayoutContext'

function renderHeader(layout: NavigationLayout, props: Partial<React.ComponentProps<typeof AppHeader>> = {}) {
  const onNavigate = props.onNavigate ?? vi.fn()
  const view = render(
    <NavigationLayoutContext.Provider value={layout}>
      <AdaptiveNavigation activePath={props.activePath ?? 'overview'} onNavigate={onNavigate} />
      <AppHeader activePath="overview" onNavigate={onNavigate} title="Home" {...props} />
    </NavigationLayoutContext.Provider>,
  )

  return {
    ...view,
    onNavigate,
    rerenderWithLayout(nextLayout: NavigationLayout) {
      view.rerender(
        <NavigationLayoutContext.Provider value={nextLayout}>
          <AdaptiveNavigation activePath={props.activePath ?? 'overview'} onNavigate={onNavigate} />
          <AppHeader activePath="overview" onNavigate={onNavigate} title="Home" {...props} />
        </NavigationLayoutContext.Provider>,
      )
    },
  }
}

describe('AppHeader adaptive navigation', () => {
  beforeEach(() => {
    resetMockHass()
  })

  it('shows the correct root and back-path controls for every layout', () => {
    const bottom = renderHeader('bottom')
    expect(screen.getByRole('button', { name: 'Open navigation menu' })).toBeVisible()
    expect(document.querySelector('[data-adaptive-navigation="rail"]')).toHaveAttribute('hidden')
    bottom.unmount()

    const drawer = renderHeader('drawer-only', { backPath: 'overview', title: 'Living Room' })
    expect(screen.getByRole('button', { name: 'Go back' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Open navigation menu' })).toBeVisible()
    drawer.unmount()

    renderHeader('rail')
    expect(screen.queryByRole('button', { name: 'Open navigation menu' })).not.toBeInTheDocument()
    expect(document.querySelector('[data-adaptive-navigation="rail"]')).not.toHaveAttribute('hidden')
  })

  it('keeps the drawer mounted through its close animation', async () => {
    renderHeader('drawer-only')
    const opener = screen.getByRole('button', { name: 'Open navigation menu' })

    fireEvent.click(opener)
    const drawer = document.querySelector('[data-adaptive-navigation="drawer"]') as HTMLElement
    await waitFor(() => expect(within(drawer).getByRole('menuitem', { name: 'Home' })).toHaveFocus())

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(drawer).toHaveAttribute('data-state', 'closed')
    expect(document.querySelector('[data-adaptive-navigation="drawer"]')).toBeInTheDocument()
    expect(opener).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes an open drawer atomically and hands focus to the active rail item', async () => {
    const view = renderHeader('drawer-only')
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    expect(document.querySelector('[data-adaptive-navigation="drawer"]')).toBeVisible()

    view.rerenderWithLayout('rail')

    expect(document.querySelector('[data-adaptive-navigation="drawer"]')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Home' })).toHaveFocus())
  })

  it('closes the drawer without restoring focus when navigation is selected', () => {
    const onNavigate = vi.fn()
    renderHeader('drawer-only', { onNavigate })
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }))

    fireEvent.click(screen.getByRole('menuitem', { name: 'Security' }))

    expect(onNavigate).toHaveBeenCalledWith('security')
    expect(document.querySelector('[data-adaptive-navigation="drawer"]')).toHaveAttribute('data-state', 'closed')
  })

  it('keeps keyboard focus inside the open drawer', async () => {
    renderHeader('drawer-only')
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    const drawer = document.querySelector('[data-adaptive-navigation="drawer"]') as HTMLElement
    const home = within(drawer).getByRole('menuitem', { name: 'Home' })
    const settings = within(drawer).getByRole('menuitem', { name: 'Settings' })
    await waitFor(() => expect(home).toHaveFocus())

    settings.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(home).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(settings).toHaveFocus()
  })

  it('keeps page actions available while the permanent rail is active', () => {
    renderHeader('rail', {
      actions: [{ icon: 'mdi:cog', label: 'Page settings', onClick: vi.fn() }],
    })

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }))

    expect(screen.getByRole('menu', { name: 'Page actions' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Page settings' })).toBeVisible()
  })
})
