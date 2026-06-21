import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { ModalSheet } from './ModalSheet'

function ModalSheetHarness() {
  const [open, setOpen] = useState(true)

  return (
    <>
      <button type="button">Host page swipe target</button>
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
  })

  it('closes from the custom backdrop without enabling body scroll locking', async () => {
    render(<ModalSheetHarness />)

    expect(document.body).not.toHaveAttribute('data-scroll-locked')
    fireEvent.pointerDown(document.body.querySelector('[data-modal-sheet-overlay]') as Element)

    await waitFor(() => expect(screen.getByRole('dialog')).toHaveAttribute('data-state', 'closed'))
    expect(document.body).not.toHaveAttribute('data-scroll-locked')
  })
})
