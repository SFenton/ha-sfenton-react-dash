import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { ModalSheet } from './ModalSheet'

function ModalSheetHarness() {
  const [open, setOpen] = useState(true)

  return (
    <>
      <button onClick={() => setOpen(true)} type="button">Host page swipe target</button>
      <ModalSheet onClose={() => setOpen(false)} open={open} title="Room controls">
        <button type="button">Modal action</button>
      </ModalSheet>
    </>
  )
}

describe('ModalSheet', () => {
  it('makes the closing sheet inert and releases background pointer locking during exit animation', async () => {
    render(<ModalSheetHarness />)

    const dialog = screen.getByRole('dialog')
    expect(document.body).not.toHaveAttribute('data-scroll-locked')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))

    await waitFor(() => expect(dialog).toHaveAttribute('data-state', 'closed'))
    expect(dialog).toHaveAttribute('data-closing', 'true')
    expect(dialog).toHaveAttribute('inert')
    expect(document.body.querySelector('[data-modal-sheet-overlay]')).not.toBeInTheDocument()
    expect(document.body).not.toHaveAttribute('data-scroll-locked')
    await waitFor(() => expect(document.body.style.pointerEvents).not.toBe('none'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Host page swipe target' })).toBeInTheDocument()
  })

  it('closes from the custom backdrop without enabling body scroll locking', async () => {
    render(<ModalSheetHarness />)

    expect(document.body).not.toHaveAttribute('data-scroll-locked')
    fireEvent.pointerDown(document.body.querySelector('[data-modal-sheet-overlay]') as Element)

    await waitFor(() => expect(screen.getByRole('dialog')).toHaveAttribute('data-state', 'closed'))
    expect(document.body).not.toHaveAttribute('data-scroll-locked')
  })

  it('allows internal close events on a fresh open', async () => {
    render(<ModalSheetHarness />)

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => expect(screen.getByRole('dialog')).toHaveAttribute('data-state', 'closed'))
  })

  it('ignores stale internal close events immediately after reopening', async () => {
    render(<ModalSheetHarness />)

    expect(screen.getByRole('dialog')).toHaveAttribute('data-rapid-reopen', 'false')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveAttribute('data-state', 'closed'))

    fireEvent.click(screen.getByText('Host page swipe target'))
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveAttribute('data-state', 'open'))
    expect(screen.getByRole('dialog')).toHaveAttribute('data-rapid-reopen', 'true')

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.getByRole('dialog')).toHaveAttribute('data-state', 'open')
  })
})
