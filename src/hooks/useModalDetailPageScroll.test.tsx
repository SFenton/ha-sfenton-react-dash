import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useModalDetailPageScroll } from './useModalDetailPageScroll'

function DetailHarness() {
  const [page, setPage] = useState<'detail' | 'overview'>('overview')
  const [restoreFocusReady, setRestoreFocusReady] = useState(true)
  const [triggerRevision, setTriggerRevision] = useState(0)
  const { bodyElementRef, enterDetailPage, leaveDetailPage, resetDetailPageScroll } = useModalDetailPageScroll(
    page,
    undefined,
    { restoreFocusReady },
  )

  return (
    <div aria-label="Detail harness" role="dialog">
      <button onClick={() => setTriggerRevision((revision) => revision + 1)}>Replace opener</button>
      <button onClick={() => setRestoreFocusReady(true)}>Finish layout</button>
      <button onClick={resetDetailPageScroll}>Cancel restore</button>
      <button>Alternate action</button>
      <div ref={bodyElementRef}>
        {page === 'overview' ? (
          <div data-modal-detail-trigger="report" key={triggerRevision}>
            <button onClick={() => {
              enterDetailPage('report')
              setPage('detail')
            }}>
              Open report {triggerRevision}
            </button>
          </div>
        ) : (
          <button data-modal-detail-autofocus="true" onClick={() => {
            leaveDetailPage()
            setRestoreFocusReady(false)
            setPage('overview')
          }}>
            Back
          </button>
        )}
      </div>
    </div>
  )
}

function openAndReturn() {
  const opener = screen.getByRole('button', { name: 'Open report 0' })
  opener.focus()
  fireEvent.click(opener)
  const back = screen.getByRole('button', { name: 'Back' })
  back.focus()
  fireEvent.click(back)
  return screen.getByRole('button', { name: 'Open report 0' })
}

async function settleAnimationFrames(count = 4) {
  for (let frame = 0; frame < count; frame += 1) {
    await act(async () => {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
    })
  }
}

describe('useModalDetailPageScroll', () => {
  it('restores the current keyed opener after a deferred replacement settles', async () => {
    render(<DetailHarness />)
    const transientOpener = openAndReturn()

    act(() => screen.getByRole('button', { name: 'Replace opener' }).click())
    expect(transientOpener.isConnected).toBe(false)
    act(() => screen.getByRole('button', { name: 'Finish layout' }).click())

    await waitFor(() => expect(screen.getByRole('button', { name: 'Open report 1' })).toHaveFocus())
  })

  it('does not steal focus from a connected target selected while restoration is deferred', async () => {
    render(<DetailHarness />)
    openAndReturn()
    const alternate = screen.getByRole('button', { name: 'Alternate action' })
    alternate.focus()

    act(() => screen.getByRole('button', { name: 'Replace opener' }).click())
    act(() => screen.getByRole('button', { name: 'Finish layout' }).click())
    await settleAnimationFrames()

    expect(alternate).toHaveFocus()
  })

  it('cancels a deferred restoration when the detail stack resets', async () => {
    render(<DetailHarness />)
    openAndReturn()

    act(() => screen.getByRole('button', { name: 'Cancel restore' }).click())
    act(() => screen.getByRole('button', { name: 'Replace opener' }).click())
    act(() => screen.getByRole('button', { name: 'Finish layout' }).click())
    await settleAnimationFrames()

    expect(screen.getByRole('button', { name: 'Open report 1' })).not.toHaveFocus()
  })
})
