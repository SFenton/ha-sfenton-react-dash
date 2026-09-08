import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ModalSheet, type ModalCenteredGeometry } from './ModalSheet'

const modalSheetCss = readFileSync(resolve(process.cwd(), 'src/components/core/ModalSheet.module.css'), 'utf8')
const tokensCss = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8')

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

const INITIAL_CENTERED_GEOMETRY = {
  blockPolicy: 'fixed',
  blockSize: '620px',
  id: 'initial-flow',
  inlineSize: '720px',
} satisfies ModalCenteredGeometry

const NEXT_CENTERED_GEOMETRY = {
  blockPolicy: 'fixed',
  blockSize: '760px',
  id: 'next-flow',
  inlineSize: '980px',
} satisfies ModalCenteredGeometry
const UPDATED_INITIAL_CENTERED_GEOMETRY = {
  blockPolicy: 'fixed',
  blockSize: '760px',
  id: 'initial-flow',
  inlineSize: '980px',
} satisfies ModalCenteredGeometry

describe('ModalSheet mounted orientation', () => {
  it('remeasures the rendered presentation without needing a tab update or a resize observer', () => {
    const width = window.innerWidth
    const height = window.innerHeight
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 393 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 852 })
    const view = render(<ModalSheet onClose={() => undefined} open title="Rotation controls"><div /></ModalSheet>)
    const dialog = screen.getByRole('dialog')
    const measure = dialog.querySelector('[data-modal-content-measure="true"]')!
    Object.defineProperty(measure, 'clientWidth', {
      configurable: true,
      get: () => dialog.getAttribute('data-modal-presentation') === 'landscape-dialog' ? 688 : 359,
    })
    try {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 852 })
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 393 })
      fireEvent(window, new Event('resize'))
      expect(dialog).toHaveAttribute('data-modal-presentation', 'landscape-dialog')
      expect(dialog).toHaveAttribute('data-modal-body-tier', 'wide')

      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 393 })
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 852 })
      fireEvent(window, new Event('resize'))
      expect(dialog).toHaveAttribute('data-modal-presentation', 'sheet')
      expect(dialog).toHaveAttribute('data-modal-body-tier', 'compact')
    } finally {
      view.unmount()
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
    }
  })
})

describe('ModalSheet', () => {
  it('keeps the current header actions outside the body and mounted through close', () => {
    const view = render(
      <ModalSheet headerActions={<button type="button">First header action</button>} onClose={() => undefined} open title="Header actions">
        Body content
      </ModalSheet>,
    )
    const dialog = screen.getByRole('dialog')
    view.rerender(
      <ModalSheet headerActions={<button type="button">Current header action</button>} onClose={() => undefined} open title="Header actions">
        Body content
      </ModalSheet>,
    )
    const action = within(dialog).getByRole('button', { name: 'Current header action' })
    expect(dialog.querySelector('[data-modal-sheet-header-actions]')).toContainElement(action)
    expect(dialog.querySelector('[data-modal-sheet-body]')).not.toContainElement(action)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    view.rerender(<ModalSheet onClose={() => undefined} open={false} title="Header actions">Body content</ModalSheet>)
    expect(dialog).toHaveAttribute('data-closing', 'true')
    expect(action).toBeInTheDocument()
  })

  it('remeasures full-width content while open and retains its width policy during close', () => {
    const width = window.innerWidth
    const height = window.innerHeight
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 })
    const view = render(<ModalSheet onClose={() => undefined} open title="Width policy"><div /></ModalSheet>)
    const dialog = screen.getByRole('dialog')
    const measure = dialog.querySelector('[data-modal-content-measure="true"]')!
    Object.defineProperty(measure, 'clientWidth', {
      configurable: true,
      get: () => dialog.getAttribute('data-modal-content-width') === 'full' ? 1050 : 450,
    })
    try {
      expect(dialog).toHaveAttribute('data-modal-content-width', 'readable')
      view.rerender(<ModalSheet contentWidth="full" onClose={() => undefined} open title="Width policy"><div /></ModalSheet>)
      expect(dialog).toHaveAttribute('data-modal-content-width', 'full')
      expect(dialog).toHaveAttribute('data-modal-body-tier', 'wide')
      fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
      view.rerender(<ModalSheet contentWidth="readable" onClose={() => undefined} open={false} title="Width policy"><div /></ModalSheet>)
      expect(dialog).toHaveAttribute('data-modal-content-width', 'full')
      expect(dialog).toHaveAttribute('data-modal-body-tier', 'wide')
    } finally {
      view.unmount()
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
    }
  })

  it('exposes typed size, scroll, and navigation intents', () => {
    render(
      <ModalSheet
        navigation={<span data-testid="modal-navigation" />}
        onClose={() => undefined}
        open
        scrollMode="panes"
        size="form"
        surfaceDecoration={<span data-testid="modal-decoration" />}
        title=""
      >
        <div />
      </ModalSheet>,
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('data-size', 'form')
    expect(dialog).toHaveAttribute('data-scroll-mode', 'panes')
    expect(dialog).toHaveAttribute('data-has-navigation', 'true')
    expect(dialog).toHaveAttribute('data-has-surface-decoration', 'true')
    expect(dialog.querySelector('[data-modal-sheet-navigation="true"]')).toContainElement(screen.getByTestId('modal-navigation'))
    expect(dialog.querySelector('[data-modal-sheet-surface-decoration="true"]')).toContainElement(screen.getByTestId('modal-decoration'))
  })

  it('defaults to automatic backdrop bands and keeps the full policy explicit', () => {
    const view = render(
      <ModalSheet onClose={() => undefined} open title="Automatic backdrop">
        <div />
      </ModalSheet>,
    )

    let dialog = screen.getByRole('dialog')
    let overlay = document.querySelector('[data-modal-sheet-overlay="true"]')
    expect(dialog).toHaveAttribute('data-backdrop-policy', 'auto')
    expect(overlay).toHaveAttribute('data-backdrop-policy', 'auto')
    expect(overlay?.querySelector('[data-modal-backdrop-layer="true"]')).toHaveAttribute('aria-hidden', 'true')
    expect(overlay?.querySelector('[data-modal-backdrop-scrim="true"]')).toHaveAttribute('aria-hidden', 'true')
    expect(overlay?.querySelectorAll('[data-modal-backdrop-band]')).toHaveLength(4)
    expect(overlay?.querySelectorAll('[data-modal-backdrop-band][aria-hidden="true"]')).toHaveLength(4)
    expect(overlay?.querySelector('[data-modal-backdrop-proxy="true"]')).toBeInTheDocument()

    view.rerender(
      <ModalSheet backdropPolicy="full" onClose={() => undefined} open title="Full backdrop">
        <div />
      </ModalSheet>,
    )

    dialog = screen.getByRole('dialog')
    overlay = document.querySelector('[data-modal-sheet-overlay="true"]')
    expect(dialog).toHaveAttribute('data-backdrop-policy', 'full')
    expect(overlay).toHaveAttribute('data-backdrop-policy', 'full')
    expect(overlay?.querySelector('[data-modal-backdrop-layer="true"]')).not.toBeInTheDocument()
    expect(dialog).toHaveStyle({ '--modal-surface-backing': 'var(--rd-modal-surface-opaque)' })
  })

  it('fails closed for unsupported inline geometry and unaudited custom surfaces', () => {
    const view = render(
      <ModalSheet contentStyle={{ height: '400px' }} onClose={() => undefined} open title="Custom geometry">
        <div />
      </ModalSheet>,
    )

    expect(screen.getByRole('dialog')).toHaveAttribute('data-backdrop-policy', 'full')

    view.rerender(
      <ModalSheet contentStyle={{ borderRadius: '80px 80px 0 0' }} onClose={() => undefined} open title="Custom radius">
        <div />
      </ModalSheet>,
    )
    expect(screen.getByRole('dialog')).toHaveAttribute('data-backdrop-policy', 'full')

    view.rerender(
      <ModalSheet contentStyle={{ '--color-modal-surface': 'rgba(8, 14, 23, 0.9)' }} onClose={() => undefined} open title="Custom surface">
        <div />
      </ModalSheet>,
    )
    expect(screen.getByRole('dialog')).toHaveAttribute('data-backdrop-policy', 'full')

    view.rerender(
      <ModalSheet
        contentStyle={{ '--color-modal-surface': 'rgba(8, 14, 23, 0.9)' }}
        onClose={() => undefined}
        open
        surfaceDecoration={<span />}
        surfaceDecorationOccludesBackdrop
        title="Audited custom surface"
      >
        <div />
      </ModalSheet>,
    )
    expect(screen.getByRole('dialog')).toHaveAttribute('data-backdrop-policy', 'auto')
    expect(screen.getByRole('dialog').querySelector('[data-modal-backdrop-occluder="opaque"]')).toBeInTheDocument()
  })

  it('retains navigation, decoration, and typed layout intent during the mounted close frame', () => {
    const view = render(
      <ModalSheet backdropPolicy="full" navigation={<span data-testid="closing-navigation" />} onClose={() => undefined} open scrollMode="panes" size="workspace" surfaceDecoration={<span data-testid="closing-decoration" />} title="">
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
    expect(dialog).toHaveAttribute('data-backdrop-policy', 'full')
    expect(screen.getByTestId('closing-navigation')).toBeInTheDocument()
    expect(screen.getByTestId('closing-decoration')).toBeInTheDocument()
  })

  it('freezes declared centered geometry for one open epoch while allowing content changes', () => {
    const view = render(
      <ModalSheet
        centeredGeometry={INITIAL_CENTERED_GEOMETRY}
        contentStyle={{ '--modal-title-font-size': '1rem' }}
        navigation={<span>Initial navigation</span>}
        onClose={() => undefined}
        open
        size="standard"
        title="Initial title"
      >
        Initial content
      </ModalSheet>,
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('data-modal-geometry-intent', 'initial-flow')
    expect(dialog).toHaveAttribute('data-modal-block-policy', 'fixed')
    expect(dialog).toHaveAttribute('data-size', 'standard')
    expect(dialog).toHaveStyle({
      '--modal-centered-block-size': '620px',
      '--modal-centered-inline-size': '720px',
      '--modal-centered-max-block-size': '620px',
      '--modal-centered-max-inline-size': '720px',
      '--modal-title-font-size': '1rem',
    })

    view.rerender(
      <ModalSheet
        centeredGeometry={UPDATED_INITIAL_CENTERED_GEOMETRY}
        contentStyle={{ '--modal-title-font-size': '0.9rem' }}
        onClose={() => undefined}
        open
        size="workspace"
        title="Updated title"
      >
        Updated content
      </ModalSheet>,
    )

    expect(dialog).toHaveAttribute('data-modal-geometry-intent', 'initial-flow')
    expect(dialog).toHaveAttribute('data-size', 'standard')
    expect(dialog).toHaveStyle({
      '--modal-centered-block-size': '620px',
      '--modal-centered-inline-size': '720px',
      '--modal-title-font-size': '0.9rem',
    })
    expect(within(dialog).getByRole('heading', { name: 'Updated title' })).toBeInTheDocument()
    expect(within(dialog).getByText('Updated content')).toBeInTheDocument()
    expect(within(dialog).queryByText('Initial navigation')).not.toBeInTheDocument()
  })

  it('adopts a new centered geometry when the logical identity changes while open', () => {
    const view = render(
      <ModalSheet centeredGeometry={INITIAL_CENTERED_GEOMETRY} onClose={() => undefined} open size="standard" title="Initial">
        Initial content
      </ModalSheet>,
    )
    const dialog = screen.getByRole('dialog')

    view.rerender(
      <ModalSheet centeredGeometry={NEXT_CENTERED_GEOMETRY} onClose={() => undefined} open size="workspace" title="Next">
        Next content
      </ModalSheet>,
    )

    expect(dialog).toHaveAttribute('data-modal-geometry-intent', 'next-flow')
    expect(dialog).toHaveAttribute('data-size', 'workspace')
    expect(dialog).toHaveStyle({
      '--modal-centered-block-size': '760px',
      '--modal-centered-inline-size': '980px',
    })
  })

  it('adopts the latest centered geometry on the next open epoch and freezes it while closing', () => {
    const view = render(
      <ModalSheet centeredGeometry={INITIAL_CENTERED_GEOMETRY} onClose={() => undefined} open={false} title="Closed">
        Closed content
      </ModalSheet>,
    )

    view.rerender(
      <ModalSheet centeredGeometry={NEXT_CENTERED_GEOMETRY} onClose={() => undefined} open size="workspace" title="Open">
        Open content
      </ModalSheet>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('data-modal-geometry-intent', 'next-flow')
    expect(dialog).toHaveAttribute('data-size', 'workspace')
    expect(dialog).toHaveStyle({
      '--modal-centered-block-size': '760px',
      '--modal-centered-inline-size': '980px',
    })

    view.rerender(
      <ModalSheet centeredGeometry={INITIAL_CENTERED_GEOMETRY} onClose={() => undefined} open={false} size="compact" title="Closing">
        Closing content
      </ModalSheet>,
    )
    expect(dialog).toHaveAttribute('data-modal-geometry-intent', 'next-flow')
    expect(dialog).toHaveAttribute('data-size', 'workspace')
    expect(dialog).toHaveAttribute('data-state', 'closed')
  })

  it('disables nested glass backdrop filters inside the moving modal surface', () => {
    expect(modalSheetCss).toMatch(/\.content \[data-tone\]\[data-variant='card'\],\s*\.content \[data-modal-tab-nav='true'\]\s*\{[^}]*-webkit-backdrop-filter:\s*none;\s*backdrop-filter:\s*none;/s)
  })

  it('composites the full scrim above CSS-derived blur bands and uses opaque backing', () => {
    expect(modalSheetCss).toMatch(/\.overlay\s*\{[^}]*background:\s*var\(--color-modal-overlay\);[^}]*-webkit-backdrop-filter:\s*var\(--blur-modal\);\s*backdrop-filter:\s*var\(--blur-modal\);/s)
    expect(modalSheetCss).toMatch(/\.overlayBand\s*\{[^}]*visibility:\s*hidden;[^}]*background:\s*var\(--rd-transparent\);[^}]*backdrop-filter:\s*var\(--blur-modal\);/s)
    expect(modalSheetCss).toMatch(/\.overlay\[data-exposed-backdrop-bands='true'\]\s*\{[^}]*-webkit-backdrop-filter:\s*none;\s*backdrop-filter:\s*none;/s)
    expect(modalSheetCss).toMatch(/\.backdropScrim\s*\{[^}]*inset:\s*0;[^}]*background:\s*var\(--color-modal-overlay\);/s)
    expect(modalSheetCss).toContain('background: var(--modal-surface-backing, var(--color-modal-surface))')
    expect(modalSheetCss).toMatch(/\.content,\s*\.backdropGeometryProxy\s*\{[^}]*height:\s*var\(--modal-mobile-height,\s*90dvh\);[^}]*max-height:\s*min\(\s*var\(--modal-mobile-max-height,\s*90dvh\),[^}]*--dashboard-visible-height[^}]*--rd-safe-top/s)
    expect(modalSheetCss).toMatch(/\.overlay\[data-exposed-backdrop-bands='true'\]\[data-modal-presentation='landscape-dialog'\]\s*\{[^}]*-webkit-backdrop-filter:\s*var\(--blur-modal\);\s*backdrop-filter:\s*var\(--blur-modal\);/s)
    expect(modalSheetCss).toMatch(/margin-bottom:\s*calc\(-1 \* var\(--modal-backdrop-band-overlap\)\);[\s\S]*top:\s*var\(--modal-backdrop-band-overlap\);/)
    expect(tokensCss).toMatch(/--color-modal-surface:\s*rgba\(24,\s*24,\s*24,\s*0\.97\);/)
    expect(tokensCss).toMatch(/--rd-modal-surface-opaque:\s*rgb\(24,\s*24,\s*24\);/)
  })

  it('keeps navigation and landscape density independent from outer modal geometry', () => {
    expect(modalSheetCss).not.toMatch(/data-has-navigation[^}]*\{[^}]*height:/s)
    expect(modalSheetCss).not.toMatch(/data-landscape-density[^}]*\{[^}]*height:/s)
  })

  it('switches to a no-drag landscape dialog and freezes that presentation while closing', async () => {
    const originalWidth = window.innerWidth
    const originalHeight = window.innerHeight
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 393 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 852 })
    const view = render(
      <ModalSheet onClose={() => undefined} open title="Responsive controls">
        <div />
      </ModalSheet>,
    )

    try {
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('data-modal-presentation', 'sheet')
      expect(dialog).toHaveAttribute('data-landscape-density', 'compact')
      expect(dialog).toHaveAttribute('data-modal-body-tier', 'compact')
      expect(dialog.querySelector('[data-mobile-drag-handle="true"]')).not.toBeNull()

      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 852 })
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 393 })
      fireEvent(window, new Event('resize'))
      await waitFor(() => expect(dialog).toHaveAttribute('data-modal-presentation', 'landscape-dialog'))
      expect(dialog).toHaveAttribute('data-landscape-density', 'compact')
      expect(dialog.querySelector('[data-mobile-drag-handle="true"]')).toBeNull()

      view.rerender(
        <ModalSheet onClose={() => undefined} open={false} title="Responsive controls">
          <div />
        </ModalSheet>,
      )
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 393 })
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 852 })
      fireEvent(window, new Event('resize'))
      expect(dialog).toHaveAttribute('data-modal-presentation', 'landscape-dialog')
      expect(dialog).toHaveAttribute('data-modal-body-tier', 'compact')
    } finally {
      view.unmount()
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth })
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalHeight })
      fireEvent(window, new Event('resize'))
    }
  })

  it('publishes and freezes a measured body tier during the mounted close frame', async () => {
    const view = render(
      <ModalSheet onClose={() => undefined} open title="Measured controls">
        <div />
      </ModalSheet>,
    )
    const dialog = screen.getByRole('dialog')
    const contentMeasure = dialog.querySelector('[data-modal-content-measure="true"]') as HTMLDivElement
    Object.defineProperty(contentMeasure, 'clientWidth', { configurable: true, value: 720 })
    fireEvent(window, new Event('resize'))
    await waitFor(() => expect(dialog).toHaveAttribute('data-modal-body-tier', 'wide'))

    view.rerender(
      <ModalSheet onClose={() => undefined} open={false} title="Measured controls">
        <div />
      </ModalSheet>,
    )
    Object.defineProperty(contentMeasure, 'clientWidth', { configurable: true, value: 300 })
    fireEvent(window, new Event('resize'))
    expect(dialog).toHaveAttribute('data-modal-body-tier', 'wide')
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
      expect(observeSpy).toHaveBeenCalledTimes(initialObservations + 2)
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
