import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dispatchDashboardRouteChange, pushDashboardUrl } from '../../hooks/dashboardLocation'
import { AppHeader } from './AppHeader'
import { NavigationLayoutContext } from './NavigationLayoutContext'

vi.mock('../hass/dailyReportModal', () => ({
  useDailyReportContext: () => ({ badgeCount: 0, overdueCount: 0, title: 'Summary' }),
}))

vi.mock('../../hooks/dashboardLocation', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../hooks/dashboardLocation')>(),
  dispatchDashboardRouteChange: vi.fn(),
  pushDashboardUrl: vi.fn(),
}))

describe('AppHeader back navigation', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each(
    (['bottom', 'drawer-only', 'rail'] as const).flatMap((layout) => (
      [true, false].map((customBack) => ({ customBack, layout }))
    )),
  )('omits the menu in $layout with custom back handler $customBack', ({ customBack, layout }) => {
    const navigate = vi.fn()
    const back = vi.fn()
    render(
      <NavigationLayoutContext.Provider value={layout}>
        <AppHeader backPath="overview" onBack={customBack ? back : undefined} onNavigate={navigate} title="Living Room" />
      </NavigationLayoutContext.Provider>,
    )
    expect(screen.queryByRole('button', { name: 'Open navigation menu', hidden: true })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
    expect(customBack ? back : navigate).toHaveBeenCalledWith('overview')
    expect(customBack ? navigate : back).not.toHaveBeenCalled()
  })

  it('preserves the profile action on a back page without adding a hamburger', () => {
    render(
      <NavigationLayoutContext.Provider value="drawer-only">
        <AppHeader backPath="overview" onNavigate={vi.fn()} title="Living Room" />
      </NavigationLayoutContext.Provider>,
    )
    expect(screen.queryByRole('button', { name: 'Open navigation menu', hidden: true })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open Summary' }))
    expect(pushDashboardUrl).toHaveBeenCalledWith('#daily-report')
    expect(dispatchDashboardRouteChange).toHaveBeenCalledOnce()
  })
})
