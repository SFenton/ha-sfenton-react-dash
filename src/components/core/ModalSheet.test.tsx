import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
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

function ModalSheetObserverHarness() {
  const [contentVersion, setContentVersion] = useState(0)
  const [footerVisible, setFooterVisible] = useState(true)

  return (
    <ModalSheet
      footer={footerVisible ? <span>Footer {contentVersion}</span> : undefined}
      onClose={() => undefined}
      open
      subtitle={`Status ${contentVersion}`}
      title="Observer controls"
    >
      <button onClick={() => setContentVersion((current) => current + 1)} type="button">Update content</button>
      <button onClick={() => setFooterVisible((current) => !current)} type="button">Toggle footer</button>
    </ModalSheet>
  )
}

describe('ModalSheet', () => {
  it('updates touch arbitration when mounted content changes scrollability', async () => {
    render(<ModalSheetObserverHarness />)

    const body = document.querySelector('[data-modal-sheet-body="true"]') as HTMLDivElement
    Object.defineProperty(body, 'clientHeight', { configurable: true, value: 100 })
    Object.defineProperty(body, 'scrollHeight', { configurable: true, value: 220 })
    Object.defineProperty(body, 'scrollTop', { configurable: true, value: 0, writable: true })
    const content = document.createElement('span')
    body.append(content)

    await waitFor(() => expect(body).toHaveAttribute('data-modal-sheet-scrollable', 'true'))
    expect(body.style.touchAction).toBe('pan-down')

    body.scrollTop = 12
    fireEvent.scroll(body)
    expect(body.style.touchAction).toBe('pan-y')

    body.scrollTop = 0.5
    fireEvent.scroll(body)
    expect(body.style.touchAction).toBe('pan-y')

    body.scrollTop = -0.5
    fireEvent.scroll(body)
    expect(body.scrollTop).toBe(0)
    expect(body.style.touchAction).toBe('pan-down')

    Object.defineProperty(body, 'scrollHeight', { configurable: true, value: 80 })
    content.setAttribute('aria-expanded', 'true')

    await waitFor(() => expect(body).toHaveAttribute('data-modal-sheet-scrollable', 'false'))
    expect(body.style.touchAction).toBe('none')
  })

  it('keeps its body observer stable when footer and subtitle content change without changing layout presence', async () => {
    const originalWindowResizeObserver = window.ResizeObserver
    window.ResizeObserver = globalThis.ResizeObserver
    const observeSpy = vi.spyOn(window.ResizeObserver.prototype, 'observe')
    const disconnectSpy = vi.spyOn(window.ResizeObserver.prototype, 'disconnect')
    const { unmount } = render(<ModalSheetObserverHarness />)

    try {
      fireEvent.click(screen.getByRole('button', { name: 'Toggle footer' }))
      await waitFor(() => expect(screen.queryByText('Footer 0')).not.toBeInTheDocument())
      await waitFor(() => expect(observeSpy).toHaveBeenCalled())
      fireEvent.click(screen.getByRole('button', { name: 'Toggle footer' }))
      await waitFor(() => expect(screen.getByText('Footer 0')).toBeInTheDocument())
      const initialObservations = observeSpy.mock.calls.length
      const initialDisconnects = disconnectSpy.mock.calls.length

      fireEvent.click(screen.getByRole('button', { name: 'Update content' }))
      await waitFor(() => expect(screen.getByText('Footer 1')).toBeInTheDocument())
      expect(observeSpy).toHaveBeenCalledTimes(initialObservations)
      expect(disconnectSpy).toHaveBeenCalledTimes(initialDisconnects)

      fireEvent.click(screen.getByRole('button', { name: 'Toggle footer' }))
      await waitFor(() => expect(screen.queryByText('Footer 1')).not.toBeInTheDocument())
      expect(observeSpy).toHaveBeenCalledTimes(initialObservations + 1)
      expect(disconnectSpy).toHaveBeenCalledTimes(initialDisconnects + 1)
    } finally {
      unmount()
      observeSpy.mockRestore()
      disconnectSpy.mockRestore()
      window.ResizeObserver = originalWindowResizeObserver
    }
  })

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

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('data-rapid-reopen', 'false')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(dialog).toHaveAttribute('data-state', 'closed'))
    dialog.style.transform = 'translate3d(0, 180px, 0)'
    dialog.style.transition = 'none'

    fireEvent.click(screen.getByText('Host page swipe target'))
    await waitFor(() => expect(dialog).toHaveAttribute('data-state', 'open'))
    expect(dialog).toHaveAttribute('data-rapid-reopen', 'true')
    expect(dialog.style.transform).toBe('')
    expect(dialog.style.transition).toBe('')

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(dialog).toHaveAttribute('data-state', 'open')
  })
})
