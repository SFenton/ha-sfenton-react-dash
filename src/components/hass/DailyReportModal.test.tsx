import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DAILY_REPORT_HASH } from '../../constants/dailyReport'
import { resetMockHass } from '../../test/mocks/hakitCoreState'

const testDoubles = vi.hoisted(() => ({
  setController: null as ((state: { error: string | null; retainsDismissedView: boolean }) => void) | null,
}))

vi.mock('../core/ModalSheet', () => ({
  ModalSheet: ({ backLabel, children, onBack, onClose, open, title }: { backLabel?: string; children: React.ReactNode; onBack?: () => void; onClose: () => void; open: boolean; title: string }) => (
    open ? (
      <div aria-label={title} role="dialog">
        {onBack && <button onClick={onBack} type="button">{backLabel}</button>}
        <button aria-label="Close" onClick={onClose} type="button">Close</button>
        {children}
      </div>
    ) : null
  ),
}))

vi.mock('./DailyReportModalContent', () => ({
  DailyReportModalContent: ({ onOpenInventoryDetails }: { onOpenInventoryDetails: (target: unknown) => void }) => (
    <button
      onClick={() => onOpenInventoryDetails({
        item: { id: 'mock-canned-beans', name: 'Canned Beans' },
        location: 'all',
        locationLabel: 'inventory',
      })}
      type="button"
    >
      Open expired food detail
    </button>
  ),
  DailyReportModalNav: () => null,
}))

vi.mock('./EverShelfInventoryPanel', () => ({
  EverShelfInventoryDetailsPage: () => <div>Inventory detail</div>,
  EverShelfInventoryDetailsPageHost: ({ children }: { children: (controller: { dismissalBlocked: boolean; error: string | null; retainsDismissedView: boolean; title: string }) => React.ReactNode }) => {
    const [controllerState, setControllerState] = useState({ error: null as string | null, retainsDismissedView: false })
    testDoubles.setController = setControllerState
    return children({ ...controllerState, dismissalBlocked: false, title: 'Canned Beans' })
  },
}))

import { DailyReportModal } from './DailyReportModal'

describe('DailyReportModal prepared inventory dismissal', () => {
  beforeEach(() => {
    resetMockHass()
    window.history.replaceState(null, '', `/sfenton-react-dash/home${DAILY_REPORT_HASH}`)
    testDoubles.setController = null
  })

  afterEach(() => {
    window.history.replaceState(null, '', '/sfenton-react-dash/home')
  })

  it('allows Summary Back and Close while prepared work remains pending', () => {
    render(<DailyReportModal />)

    fireEvent.click(screen.getByRole('button', { name: 'Open expired food detail' }))
    expect(screen.getByRole('dialog', { name: 'Canned Beans' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back to expired food' }))
    expect(screen.getByRole('dialog', { name: "Stephen's Summary" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open expired food detail' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(window.location.hash).toBe('')
  })

  it('closes a prepared-error detail when the hash is dismissed', () => {
    render(<DailyReportModal />)

    fireEvent.click(screen.getByRole('button', { name: 'Open expired food detail' }))
    act(() => {
      testDoubles.setController?.({ error: 'Unable to update prepared food', retainsDismissedView: false })
    })
    expect(screen.getByRole('dialog', { name: 'Canned Beans' })).toBeInTheDocument()
    act(() => {
      window.history.replaceState(null, '', '/sfenton-react-dash/home')
      window.dispatchEvent(new Event('hashchange'))
    })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(window.location.hash).toBe('')
  })

  it('retains an edit or delete error detail until intentional close', () => {
    render(<DailyReportModal />)

    fireEvent.click(screen.getByRole('button', { name: 'Open expired food detail' }))
    act(() => {
      testDoubles.setController?.({ error: 'Unable to update item', retainsDismissedView: true })
      window.history.replaceState(null, '', '/sfenton-react-dash/home')
      window.dispatchEvent(new Event('hashchange'))
    })

    expect(screen.getByRole('dialog', { name: 'Canned Beans' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(window.location.hash).toBe('')
  })

  it('does not reopen after a late prepared error arrives after dismissal', () => {
    render(<DailyReportModal />)

    fireEvent.click(screen.getByRole('button', { name: 'Open expired food detail' }))
    act(() => {
      window.history.replaceState(null, '', '/sfenton-react-dash/home')
      window.dispatchEvent(new Event('hashchange'))
    })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    act(() => {
      testDoubles.setController?.({ error: 'Unable to update prepared food', retainsDismissedView: false })
    })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(window.location.hash).toBe('')
  })
})
