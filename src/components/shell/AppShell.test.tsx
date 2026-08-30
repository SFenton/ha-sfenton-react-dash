import { act, render, screen, waitFor, within } from '@testing-library/react'
import { createMatchMediaController } from '../../test/mocks/matchMedia'
import { Page } from '../../pages/Page'
import { BottomNav } from './BottomNav'
import { AppShell } from './AppShell'

describe('AppShell', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders Quick Links as the rightmost action when a page has no local FAB', () => {
    render(
      <AppShell bottomNav={<nav aria-label="Test navigation" />} onNavigate={() => undefined}>
        <div>Page content</div>
      </AppShell>,
    )

    const dock = document.querySelector('[data-floating-action-dock="true"]') as HTMLElement
    expect(within(dock).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual(['Quick Links'])
  })

  it('keeps page actions before the global Quick Links action', () => {
    render(
      <AppShell
        bottomNav={<nav aria-label="Test navigation" />}
        floatingAction={<button type="button">Page action</button>}
        onNavigate={() => undefined}
      >
        <div>Page content</div>
      </AppShell>,
    )

    const dock = document.querySelector('[data-floating-action-dock="true"]') as HTMLElement
    expect(within(dock).getAllByRole('button').map((button) => button.textContent)).toEqual(['Page action', ''])
    expect(within(dock).getAllByRole('button').at(-1)).toHaveAccessibleName('Quick Links')
  })

  it('suppresses the floating action dock with the rest of the chrome', () => {
    render(
      <AppShell bottomNav={<nav aria-label="Test navigation" />} chromeHidden onNavigate={() => undefined}>
        <div>Page content</div>
      </AppShell>,
    )

    expect(document.querySelector('[data-floating-action-dock="true"]')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Quick Links' })).not.toBeInTheDocument()
  })

  it('mounts both CSS-adaptive navigation surfaces without a resize gap', () => {
    render(
      <AppShell activePath="security" bottomNav={<BottomNav activePath="security" onNavigate={() => undefined} />} onNavigate={() => undefined} pageMeasure="reading">
        <div>Page content</div>
      </AppShell>,
    )

    expect(document.querySelector('[data-app-shell="true"]')).toHaveAttribute('data-page-measure', 'reading')
    expect(document.querySelector('[data-adaptive-navigation="rail"]')).toBeInTheDocument()
    expect(document.querySelector('[data-adaptive-navigation="bottom"]')).toBeInTheDocument()
    expect(document.querySelector('[data-adaptive-navigation="rail"]')).toHaveAttribute('hidden')
    expect(screen.getByRole('button', { name: 'Security' })).toHaveAttribute('aria-current', 'page')
  })

  it('updates every adaptive shell surface from the shared viewport snapshot', () => {
    const media = createMatchMediaController({ height: 741, width: 1152 })
    vi.stubGlobal('matchMedia', media.matchMedia)
    render(
      <AppShell activePath="overview" bottomNav={<BottomNav activePath="overview" onNavigate={() => undefined} />} onNavigate={() => undefined}>
        <div>Page content</div>
      </AppShell>,
    )

    const shell = document.querySelector('[data-app-shell="true"]')
    const rail = document.querySelector('[data-adaptive-navigation="rail"]')
    const bottom = document.querySelector('[data-adaptive-navigation="bottom"]')
    expect(shell).toHaveAttribute('data-navigation-layout', 'drawer-only')
    expect(rail).toHaveAttribute('hidden')
    expect(bottom).toHaveAttribute('hidden')

    act(() => media.setViewport({ height: 820, width: 1180 }))
    expect(shell).toHaveAttribute('data-navigation-layout', 'rail')
    expect(rail).not.toHaveAttribute('hidden')
    expect(bottom).toHaveAttribute('hidden')

    act(() => media.setViewport({ height: 852, width: 393 }))
    expect(shell).toHaveAttribute('data-navigation-layout', 'bottom')
    expect(rail).toHaveAttribute('hidden')
    expect(bottom).not.toHaveAttribute('hidden')
  })

  it('keeps page header navigation aligned with the shell during resize', () => {
    const media = createMatchMediaController({ height: 741, width: 1152 })
    vi.stubGlobal('matchMedia', media.matchMedia)
    render(
      <AppShell activePath="living-room" bottomNav={<BottomNav activePath="living-room" onNavigate={() => undefined} />} onNavigate={() => undefined}>
        <Page activePath="living-room" backPath="overview" onNavigate={() => undefined} title="Living Room">
          <div>Room content</div>
        </Page>
      </AppShell>,
    )

    expect(document.querySelector('[data-app-shell="true"]')).toHaveAttribute('data-navigation-layout', 'drawer-only')
    expect(screen.getByRole('button', { name: 'Go back' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Open navigation menu' })).toBeVisible()

    act(() => media.setViewport({ height: 820, width: 1180 }))
    expect(document.querySelector('[data-app-shell="true"]')).toHaveAttribute('data-navigation-layout', 'rail')
    expect(screen.queryByRole('button', { name: 'Open navigation menu' })).not.toBeInTheDocument()
    expect(document.querySelector('[data-adaptive-navigation="rail"]')).not.toHaveAttribute('hidden')
  })

  it('moves focus between persistent navigation surfaces when their mode changes', async () => {
    const media = createMatchMediaController({ height: 852, width: 393 })
    vi.stubGlobal('matchMedia', media.matchMedia)
    render(
      <AppShell activePath="security" bottomNav={<BottomNav activePath="security" onNavigate={() => undefined} />} onNavigate={() => undefined}>
        <div>Page content</div>
      </AppShell>,
    )

    screen.getByRole('button', { name: 'Security' }).focus()
    expect(screen.getByRole('button', { name: 'Security' })).toHaveFocus()

    act(() => media.setViewport({ height: 820, width: 1180 }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Security' })).toHaveFocus()
      expect(screen.getByRole('button', { name: 'Security' }).closest('[data-adaptive-navigation]')).toHaveAttribute('data-adaptive-navigation', 'rail')
    })
  })

  it('moves a focused closed-drawer opener into the rail', async () => {
    const media = createMatchMediaController({ height: 741, width: 1152 })
    vi.stubGlobal('matchMedia', media.matchMedia)
    render(
      <AppShell activePath="overview" bottomNav={<BottomNav activePath="overview" onNavigate={() => undefined} />} onNavigate={() => undefined}>
        <Page activePath="overview" onNavigate={() => undefined} title="Home">
          <div>Page content</div>
        </Page>
      </AppShell>,
    )

    screen.getByRole('button', { name: 'Open navigation menu' }).focus()
    act(() => media.setViewport({ height: 820, width: 1180 }))

    await waitFor(() => {
      const railHome = document.querySelector<HTMLButtonElement>('[data-adaptive-navigation="rail"] button[aria-current="page"]')
      expect(railHome).toHaveFocus()
    })
  })
})
