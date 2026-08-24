import { render, screen, within } from '@testing-library/react'
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
      <AppShell activePath="security" bottomNav={<nav aria-label="Test navigation" />} onNavigate={() => undefined} pageMeasure="reading">
        <div>Page content</div>
      </AppShell>,
    )

    expect(document.querySelector('[data-app-shell="true"]')).toHaveAttribute('data-page-measure', 'reading')
    expect(document.querySelector('[data-adaptive-navigation="rail"]')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Test navigation' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Security' })).toHaveAttribute('aria-current', 'page')
  })
})
