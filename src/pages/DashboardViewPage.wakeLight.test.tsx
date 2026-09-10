import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { MASTER_BEDROOM_WAKE_LIGHT } from '../constants/wakeLights'
import { mockCallServiceCalls, resetMockHass } from '../test/mocks/hakitCoreState'
import { DashboardViewPage } from './DashboardViewPage'

describe('DashboardViewPage wake-light alarms', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', window.location.pathname)
    resetMockHass()
  })

  it('shows the generic room tile before SleepyPod and opens the hash-backed modal', async () => {
    render(<DashboardViewPage activePath="master-bedroom" onNavigate={() => undefined} path="master-bedroom" />)

    const headings = screen.getAllByRole('heading').map((heading) => heading.textContent)
    expect(headings.indexOf('Sleep & Wake')).toBeGreaterThan(-1)
    expect(headings.indexOf('Sleep & Wake')).toBeLessThan(headings.indexOf('SleepyPod'))

    fireEvent.click(screen.getByRole('button', { name: /Wake-Light Alarms Next Alarm: \d+\/\d+ 6:30 AM/i }))

    const dialog = await screen.findByRole('dialog', { name: 'Master Bedroom Wake-Light Alarms' })
    expect(window.location.hash).toBe(MASTER_BEDROOM_WAKE_LIGHT.hash)
    expect(within(dialog).getByRole('tab', { name: 'Wake Alarms' })).toHaveAttribute('aria-selected', 'true')
  })

  it('preloads inert wake-light geometry without issuing a command', async () => {
    render(
      <DashboardViewPage
        activePath="master-bedroom"
        onNavigate={() => undefined}
        path="master-bedroom"
        preload
        preloadHashes={[MASTER_BEDROOM_WAKE_LIGHT.hash]}
      />,
    )

    await waitFor(() => expect(document.querySelector('[data-wake-light-preload="master-bedroom"]')).toBeInTheDocument())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mockCallServiceCalls).toEqual([])
  })
})
// @covers src/constants/roomPages.ts
