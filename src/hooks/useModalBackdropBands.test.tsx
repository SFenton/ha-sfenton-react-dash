import { act, fireEvent, render, screen } from '@testing-library/react'
import {
  MODAL_BACKDROP_MAX_BAND_AREA_RATIO,
  mobileBottomSheetGeometryEligible,
  modalBackdropBandAreaRatio,
  opaqueBackdropColor,
  popupTransformAtRest,
  useModalBackdropBands,
} from './useModalBackdropBands'

function rect(left: number, top: number, width: number, height: number) {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
  }
}

describe('modal backdrop band eligibility', () => {
  it('accepts a full-width mobile bottom sheet and rejects centered geometry', () => {
    expect(mobileBottomSheetGeometryEligible(rect(0, 85, 393, 767), rect(0, 0, 393, 852))).toBe(true)
    expect(mobileBottomSheetGeometryEligible(rect(171, 67, 1098, 753), rect(0, 0, 1440, 900))).toBe(false)
  })

  it('keeps standard sheets under the area gate and rejects the compact bed prompt', () => {
    const overlay = rect(0, 0, 393, 852)
    const standardBands = [
      rect(0, 0, 393, 117),
      rect(0, 850, 393, 2),
      rect(0, 117, 2, 733),
      rect(391, 117, 2, 733),
    ]
    const compactBands = [
      rect(0, 0, 393, 454),
      rect(0, 850, 393, 2),
      rect(0, 454, 2, 396),
      rect(391, 454, 2, 396),
    ]

    expect(modalBackdropBandAreaRatio(standardBands, overlay)).toBeLessThanOrEqual(MODAL_BACKDROP_MAX_BAND_AREA_RATIO)
    expect(modalBackdropBandAreaRatio(compactBands, overlay)).toBeGreaterThan(MODAL_BACKDROP_MAX_BAND_AREA_RATIO)
  })

  it('requires the popup transform to be at rest', () => {
    expect(popupTransformAtRest('none')).toBe(true)
    expect(popupTransformAtRest('matrix(1, 0, 0, 1, 0, 0)')).toBe(true)
    expect(popupTransformAtRest('matrix(1, 0, 0, 1, 0, 120)')).toBe(false)
  })

  it('does not mistake near-opaque paint for an opaque backing', () => {
    expect(opaqueBackdropColor('rgb(24, 24, 24)')).toBe(true)
    expect(opaqueBackdropColor('rgba(24, 24, 24, 1)')).toBe(true)
    expect(opaqueBackdropColor('rgba(24, 24, 24, 0.97)')).toBe(false)
    expect(opaqueBackdropColor('rgba(8, 14, 23, 0.9)')).toBe(false)
    expect(opaqueBackdropColor('transparent')).toBe(false)
  })
})

function BackdropHarness({ enabled = true }: { enabled?: boolean }) {
  const { contentRef, overlayRef } = useModalBackdropBands(enabled)
  return (
    <div data-base-ui-portal="">
      <div data-modal-sheet-overlay="true" data-testid="overlay" ref={overlayRef} style={{ opacity: 1 }}>
        <span data-modal-backdrop-band="top" />
        <span data-modal-backdrop-band="left" />
        <span data-modal-backdrop-band="right" />
        <span data-modal-backdrop-band="bottom" />
      </div>
      <div
        data-centered-layout="false"
        data-state="open"
        data-testid="content"
        ref={contentRef}
        style={{ backgroundColor: 'rgb(24, 24, 24)', borderRadius: '30px 30px 0 0', opacity: 1, transform: 'none' }}
      >
        <button type="button">Content control</button>
      </div>
    </div>
  )
}

describe('enabled modal backdrop lifecycle', () => {
  const observers: Array<{ targets: Set<Node> }> = []
  const resizeObservers: Array<{ targets: Set<Element> }> = []
  const frames = new Map<number, FrameRequestCallback>()
  let nextFrame = 0

  async function settle() {
    for (let index = 0; index < 3; index += 1) {
      await act(async () => {
        const pending = [...frames.values()]
        frames.clear()
        pending.forEach((callback) => callback(0))
        await Promise.resolve()
      })
    }
  }

  function pointer(type: string, id: number, buttons: number) {
    const event = new Event(type, { bubbles: true })
    Object.defineProperties(event, {
      buttons: { value: buttons },
      pointerId: { value: id },
      pointerType: { value: 'mouse' },
    })
    fireEvent(screen.getByTestId('content'), event)
  }

  beforeEach(() => {
    vi.useFakeTimers()
    observers.length = 0
    resizeObservers.length = 0
    frames.clear()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    vi.stubGlobal('CSS', { supports: () => true })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = ++nextFrame
      frames.set(id, callback)
      return id
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
    const OriginalMutationObserver = window.MutationObserver
    vi.stubGlobal('MutationObserver', class extends OriginalMutationObserver {
      targets = new Set<Node>()

      constructor(callback: MutationCallback) {
        super(callback)
        observers.push(this)
      }

      observe(target: Node, options?: MutationObserverInit) {
        this.targets.add(target)
        super.observe(target, options)
      }

      disconnect() {
        this.targets.clear()
        super.disconnect()
      }
    })
    vi.stubGlobal('ResizeObserver', class {
      targets = new Set<Element>()

      constructor() {
        resizeObservers.push(this)
      }

      observe(target: Element) {
        this.targets.add(target)
      }

      disconnect() {
        this.targets.clear()
      }
    })
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.getAttribute('data-testid') === 'content') return new DOMRect(0, 85, 393, 767)
      const band = this.getAttribute('data-modal-backdrop-band')
      if (band === 'top') return new DOMRect(0, 0, 393, 149)
      if (band === 'bottom') return new DOMRect(0, 820, 393, 32)
      if (band === 'left') return new DOMRect(0, 149, 2, 671)
      if (band === 'right') return new DOMRect(391, 149, 2, 671)
      return new DOMRect(0, 0, 393, 852)
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('does not construct observers or timers while disabled', () => {
    const timer = vi.spyOn(window, 'setTimeout')
    render(<BackdropHarness enabled={false} />)
    expect(observers).toHaveLength(0)
    expect(resizeObservers).toHaveLength(0)
    expect(timer).not.toHaveBeenCalled()
    expect(frames.size).toBe(0)
  })

  it('keeps capture loss and unrelated releases separate from the owned pressed pointer', async () => {
    render(<BackdropHarness />)
    await settle()
    const overlay = screen.getByTestId('overlay')
    expect(overlay).toHaveAttribute('data-exposed-backdrop-bands', 'true')
    pointer('pointerdown', 7, 1)
    pointer('lostpointercapture', 7, 1)
    pointer('pointerup', 8, 0)
    await settle()
    expect(overlay).not.toHaveAttribute('data-exposed-backdrop-bands')
    pointer('pointerup', 7, 0)
    await settle()
    expect(overlay).toHaveAttribute('data-exposed-backdrop-bands', 'true')
  })

  it('releases removed portal targets without closing the parent modal', async () => {
    render(<BackdropHarness />)
    await settle()
    const baselineTargets = observers.reduce((sum, observer) => sum + observer.targets.size, 0)
    for (let index = 0; index < 16; index += 1) {
      const portal = document.createElement('div')
      portal.setAttribute('data-base-ui-portal', '')
      document.body.append(portal)
      await settle()
      const child = document.createElement('div')
      child.setAttribute('data-modal-sheet-overlay', 'true')
      portal.append(child)
      await settle()
      expect(screen.getByTestId('overlay')).not.toHaveAttribute('data-exposed-backdrop-bands')
      portal.remove()
      await settle()
      expect(screen.getByTestId('overlay')).toHaveAttribute('data-exposed-backdrop-bands', 'true')
      expect(observers.every((observer) => [...observer.targets].every((target) => target.isConnected))).toBe(true)
      expect(observers.reduce((sum, observer) => sum + observer.targets.size, 0)).toBe(baselineTargets)
    }
  })

  it('cannot reactivate from the settle timer after pagehide or window blur', async () => {
    render(<BackdropHarness />)
    await settle()
    const overlay = screen.getByTestId('overlay')
    fireEvent(window, new Event('pagehide'))
    await act(async () => vi.advanceTimersByTimeAsync(700))
    await settle()
    expect(overlay).not.toHaveAttribute('data-exposed-backdrop-bands')
    fireEvent(window, new Event('pageshow'))
    await settle()
    expect(overlay).toHaveAttribute('data-exposed-backdrop-bands', 'true')
    fireEvent(window, new Event('blur'))
    fireEvent(window, new Event('pageshow'))
    await settle()
    expect(overlay).not.toHaveAttribute('data-exposed-backdrop-bands')
    fireEvent(window, new Event('focus'))
    await settle()
    expect(overlay).toHaveAttribute('data-exposed-backdrop-bands', 'true')
  })

  it('disconnects all observation targets and cancels pending work on unmount', async () => {
    const { unmount } = render(<BackdropHarness />)
    await settle()
    expect(observers.some((observer) => observer.targets.size > 0)).toBe(true)
    unmount()
    expect(observers.every((observer) => observer.targets.size === 0)).toBe(true)
    expect(resizeObservers.every((observer) => observer.targets.size === 0)).toBe(true)
    expect(frames.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })
})
