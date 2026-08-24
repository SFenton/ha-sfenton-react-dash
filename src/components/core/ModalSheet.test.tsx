import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ModalSheet } from './ModalSheet'

const modalSheetCss = readFileSync(resolve(process.cwd(), 'src/components/core/ModalSheet.module.css'), 'utf8')

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

function DelayedCloseModalSheetHarness() {
  const [closeRequested, setCloseRequested] = useState(false)
  const [open, setOpen] = useState(true)

  return (
    <>
      <button disabled={!closeRequested} onClick={() => setOpen(false)} type="button">Commit delayed close</button>
      <ModalSheet onClose={() => setCloseRequested(true)} open={open} title="Delayed controls">
        Delayed modal content
      </ModalSheet>
    </>
  )
}

function InitiallyClosedModalSheetHarness() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button onClick={() => setOpen(true)} type="button">Open first modal</button>
      <ModalSheet onClose={() => setOpen(false)} open={open} title="First open controls">
        First open modal content
      </ModalSheet>
    </>
  )
}

describe('ModalSheet', () => {
  it('exposes typed size, scroll, and navigation intents', () => {
    render(
      <ModalSheet
        navigation={<span data-testid="modal-navigation" />}
        onClose={() => undefined}
        open
        scrollMode="panes"
        size="form"
        title=""
      >
        <div />
      </ModalSheet>,
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('data-size', 'form')
    expect(dialog).toHaveAttribute('data-scroll-mode', 'panes')
    expect(dialog).toHaveAttribute('data-has-navigation', 'true')
    expect(dialog.querySelector('[data-modal-sheet-navigation="true"]')).toContainElement(screen.getByTestId('modal-navigation'))
  })

  it('retains navigation and typed layout intent during the mounted close frame', () => {
    const view = render(
      <ModalSheet navigation={<span data-testid="closing-navigation" />} onClose={() => undefined} open scrollMode="panes" size="workspace" title="">
        <div />
      </ModalSheet>,
    )

    const dialog = screen.getByRole('dialog')
    view.rerender(
      <ModalSheet navigation={undefined} onClose={() => undefined} open={false} size="compact" title="">
        <div />
      </ModalSheet>,
    )

    expect(dialog).toHaveAttribute('data-state', 'closed')
    expect(dialog).toHaveAttribute('data-size', 'workspace')
    expect(dialog).toHaveAttribute('data-scroll-mode', 'panes')
    expect(screen.getByTestId('closing-navigation')).toBeInTheDocument()
  })

  it('disables nested glass backdrop filters inside the moving modal surface', () => {
    expect(modalSheetCss).toMatch(/\.content \[data-tone\]\[data-variant='card'\],\s*\.content \[data-modal-tab-nav='true'\]\s*\{[^}]*backdrop-filter:\s*none;[^}]*-webkit-backdrop-filter:\s*none;/s)
  })

  it('keeps centered tabbed sheets at a stable viewport-bounded height', () => {
    expect(modalSheetCss).toMatch(/\.content\[data-has-navigation='true'\]\s*\{\s*height:\s*min\(\s*760px,\s*calc\(var\(--dashboard-visible-height,[^}]+- 64px\)\s*\);/s)
  })

  it('leaves touch ownership to the drawer without forcing scroll position or directional touch-action', () => {
    render(<ModalSheetObserverHarness />)

    const body = document.querySelector('[data-modal-sheet-body="true"]') as HTMLDivElement
    Object.defineProperty(body, 'clientHeight', { configurable: true, value: 100 })
    Object.defineProperty(body, 'scrollHeight', { configurable: true, value: 220 })
    Object.defineProperty(body, 'scrollTop', { configurable: true, value: 0, writable: true })

    body.scrollTop = -0.5
    fireEvent.scroll(body)
    expect(body.scrollTop).toBe(-0.5)
    expect(body.style.touchAction).toBe('')
    expect(body).not.toHaveAttribute('data-modal-sheet-scrollable')
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

  it('makes the closing sheet inert and releases the dismissal input shield on the next frame', async () => {
    render(<ModalSheetHarness />)

    const dialog = screen.getByRole('dialog')
    expect(document.body).not.toHaveAttribute('data-scroll-locked')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))

    await waitFor(() => expect(dialog).toHaveAttribute('data-state', 'closed'))
    expect(dialog).toHaveAttribute('data-closing', 'true')
    expect(dialog).toHaveAttribute('inert')
    const overlay = document.body.querySelector('[data-modal-sheet-overlay]')
    expect(overlay).toHaveAttribute('data-closed')
    expect(overlay).toHaveAttribute('data-closing', 'true')
    expect(modalSheetCss).toMatch(/\.overlay\[data-closing='true'\],\s*\.overlay\[data-closed\]\s*\{[^}]*pointer-events:\s*none !important;/s)
    expect(modalSheetCss).toMatch(/\.overlay\[data-input-shielded='true'\]\s*\{[^}]*pointer-events:\s*auto !important;/s)
    expect(document.body).not.toHaveAttribute('data-scroll-locked')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Host page swipe target' })).toBeInTheDocument()
  })

  it('closes from the custom backdrop without enabling body scroll locking', async () => {
    render(<ModalSheetHarness />)

    const dialog = screen.getByRole('dialog')
    expect(document.body).not.toHaveAttribute('data-scroll-locked')
    fireEvent.click(document.body.querySelector('[data-modal-sheet-overlay]') as Element)

    await waitFor(() => expect(dialog).toHaveAttribute('data-state', 'closed'))
    expect(document.body).not.toHaveAttribute('data-scroll-locked')
  })

  it('allows internal close events on a fresh open', async () => {
    render(<ModalSheetHarness />)

    const dialog = screen.getByRole('dialog')
    await waitFor(() => expect(dialog).toHaveAttribute('data-open'))
    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => expect(dialog).toHaveAttribute('data-state', 'closed'))
  })

  it('does not treat a pending close request as a rapid reopen', async () => {
    render(<DelayedCloseModalSheetHarness />)

    const dialog = screen.getByRole('dialog')
    await waitFor(() => expect(dialog).toHaveAttribute('data-open'))
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(dialog).toHaveAttribute('data-state', 'open')
    expect(dialog).toHaveAttribute('data-rapid-reopen', 'false')
    fireEvent.click(screen.getByRole('button', { hidden: true, name: 'Commit delayed close' }))
    await waitFor(() => expect(dialog).toHaveAttribute('data-state', 'closed'))
  })

  it('treats the first open as a normal open rather than a rapid reopen', async () => {
    render(<InitiallyClosedModalSheetHarness />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open first modal' }))

    const dialog = await screen.findByRole('dialog', { name: 'First open controls' })
    expect(dialog).toHaveAttribute('data-state', 'open')
    expect(dialog).toHaveAttribute('data-rapid-reopen', 'false')
  })

  it('reopens without stale swipe styles and remains closable', async () => {
    render(<ModalSheetHarness />)

    const dialog = screen.getByRole('dialog')
    await waitFor(() => expect(dialog).toHaveAttribute('data-open'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(dialog).toHaveAttribute('data-state', 'closed'))

    fireEvent.click(screen.getByText('Host page swipe target'))
    const reopenedDialog = await screen.findByRole('dialog')
    expect(reopenedDialog).toHaveAttribute('data-state', 'open')
    expect(reopenedDialog).toHaveAttribute('data-rapid-reopen', 'true')
    expect(reopenedDialog.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px')

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => expect(reopenedDialog).toHaveAttribute('data-state', 'closed'))
  })
})
