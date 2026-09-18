import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DASHBOARD_ROUTE_CHANGE_EVENT } from './dashboardLocation'
import {
  armDashboardKeyboardPrediction,
  clearDashboardKeyboardPrediction,
  isDashboardKeyboardInput,
  shouldResetDashboardViewportPan,
  useDashboardViewport,
} from './useDashboardViewport'

type FakeVisualViewport = EventTarget & {
  height: number
  offsetTop: number
  pageLeft: number
  pageTop: number
  scale: number
  width: number
}

function DashboardViewportHarness() {
  useDashboardViewport()
  return <input aria-label="Keyboard input" />
}

function setWindowSize(width: number, height: number) {
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
}

function setMaxTouchPoints(value: number) {
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value })
}

function createVisualViewport(width: number, height: number) {
  const viewport = new EventTarget() as FakeVisualViewport
  viewport.height = height
  viewport.offsetTop = 0
  viewport.pageLeft = 0
  viewport.pageTop = 0
  viewport.scale = 1
  viewport.width = width
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
  return viewport
}

async function flushViewportUpdate() {
  await act(async () => {
    await new Promise((resolve) => window.requestAnimationFrame(resolve))
  })
}

async function waitForViewportRecovery() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 400))
  })
}

function focusKeyboardInput() {
  act(() => screen.getByRole('textbox', { name: 'Keyboard input' }).focus())
}

describe('useDashboardViewport', () => {
  beforeEach(() => {
    setWindowSize(390, 800)
    setMaxTouchPoints(1)
    createVisualViewport(390, 800)
    document.documentElement.removeAttribute('data-dashboard-keyboard')
    document.documentElement.removeAttribute('data-dashboard-kb-arming')
    document.documentElement.removeAttribute('data-dashboard-kb-masked')
    document.documentElement.removeAttribute('style')
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    document.documentElement.removeAttribute('data-dashboard-keyboard')
    document.documentElement.removeAttribute('data-dashboard-kb-arming')
    document.documentElement.removeAttribute('data-dashboard-kb-masked')
    document.documentElement.removeAttribute('style')
    clearDashboardKeyboardPrediction()
    window.localStorage.clear()
    setMaxTouchPoints(0)
  })

  it('publishes JS-derived viewport dimensions for shell CSS', () => {
    render(<DashboardViewportHarness />)

    expect(document.documentElement.style.getPropertyValue('--dashboard-layout-height')).toBe('800px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-layout-width')).toBe('390px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-viewport-height')).toBe('800px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-visible-height')).toBe('800px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-viewport-width')).toBe('390px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-keyboard-inset')).toBe('0px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-keyboard-overlay-inset')).toBe('0px')
    expect(document.documentElement).not.toHaveAttribute('data-dashboard-keyboard')
  })

  it('identifies only editable controls that can summon the software keyboard', () => {
    const text = document.createElement('input')
    const button = document.createElement('input')
    const textarea = document.createElement('textarea')
    const select = document.createElement('select')
    const editable = document.createElement('div')
    button.type = 'button'
    editable.setAttribute('contenteditable', 'true')

    expect(isDashboardKeyboardInput(text)).toBe(true)
    expect(isDashboardKeyboardInput(textarea)).toBe(true)
    expect(isDashboardKeyboardInput(select)).toBe(true)
    expect(isDashboardKeyboardInput(editable)).toBe(true)
    expect(isDashboardKeyboardInput(button)).toBe(false)
    text.readOnly = true
    expect(isDashboardKeyboardInput(text)).toBe(false)
  })

  it('resets only embedded outer-window keyboard pans', () => {
    expect(shouldResetDashboardViewportPan({
      embedded: true,
      keyboardInset: 369,
      scrollY: 369,
      visualOffsetTop: 369,
    })).toBe(true)
    expect(shouldResetDashboardViewportPan({
      embedded: false,
      keyboardInset: 369,
      scrollY: 369,
      visualOffsetTop: 369,
    })).toBe(false)
    expect(shouldResetDashboardViewportPan({
      embedded: true,
      keyboardInset: 0,
      scrollY: 369,
      visualOffsetTop: 369,
    })).toBe(false)
    expect(shouldResetDashboardViewportPan({
      embedded: true,
      keyboardInset: 369,
      scrollY: 0,
      visualOffsetTop: 0,
    })).toBe(false)
  })

  it('uses a masked conservative prediction until the first keyboard measurement is cached', () => {
    const prediction = armDashboardKeyboardPrediction()

    expect(prediction.fromCache).toBe(false)
    expect(prediction.predictedInset).toBe(440)
    expect(document.documentElement).toHaveAttribute('data-dashboard-kb-arming', 'true')
    expect(document.documentElement).toHaveAttribute('data-dashboard-kb-masked', 'true')
    expect(document.documentElement.style.getPropertyValue('--dashboard-keyboard-predicted-inset')).toBe('440px')
  })

  it('uses a valid cached prediction without masking the search field', () => {
    window.localStorage.setItem('react-dash-keyboard-v1:portrait:800', '280')

    const prediction = armDashboardKeyboardPrediction()

    expect(prediction).toEqual({ fromCache: true, predictedInset: 280 })
    expect(document.documentElement).toHaveAttribute('data-dashboard-kb-arming', 'true')
    expect(document.documentElement).not.toHaveAttribute('data-dashboard-kb-masked')
    expect(document.documentElement.style.getPropertyValue('--dashboard-keyboard-predicted-inset')).toBe('280px')
  })

  it('marks the dashboard keyboard state without shrinking the child shell when the visual viewport contracts', async () => {
    const viewport = createVisualViewport(390, 800)
    render(<DashboardViewportHarness />)
    focusKeyboardInput()

    viewport.height = 520
    viewport.dispatchEvent(new Event('resize'))
    window.dispatchEvent(new Event('resize'))
    await flushViewportUpdate()

    expect(document.documentElement).toHaveAttribute('data-dashboard-keyboard', 'open')
    expect(document.documentElement.style.getPropertyValue('--dashboard-keyboard-inset')).toBe('280px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-keyboard-overlay-inset')).toBe('280px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-viewport-height')).toBe('800px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-visible-height')).toBe('520px')

    viewport.height = 800
    viewport.dispatchEvent(new Event('resize'))
    window.dispatchEvent(new Event('resize'))
    await flushViewportUpdate()
    expect(document.documentElement).not.toHaveAttribute('data-dashboard-keyboard')
    expect(document.documentElement.style.getPropertyValue('--dashboard-keyboard-inset')).toBe('0px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-keyboard-overlay-inset')).toBe('0px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-viewport-height')).toBe('800px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-visible-height')).toBe('800px')
  })

  it('does not lift overlay controls again when the iframe layout has already resized', async () => {
    const viewport = createVisualViewport(390, 800)
    render(<DashboardViewportHarness />)
    focusKeyboardInput()

    setWindowSize(390, 520)
    viewport.height = 520
    viewport.dispatchEvent(new Event('resize'))
    window.dispatchEvent(new Event('resize'))
    await flushViewportUpdate()

    expect(document.documentElement).toHaveAttribute('data-dashboard-keyboard', 'open')
    expect(document.documentElement.style.getPropertyValue('--dashboard-keyboard-inset')).toBe('280px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-keyboard-overlay-inset')).toBe('0px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-viewport-height')).toBe('520px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-visible-height')).toBe('520px')
  })

  it('keeps the remaining overlay inset while an overlay keyboard is nearly closed', async () => {
    const viewport = createVisualViewport(390, 800)
    render(<DashboardViewportHarness />)
    focusKeyboardInput()

    viewport.height = 520
    viewport.dispatchEvent(new Event('resize'))
    await flushViewportUpdate()

    viewport.height = 750
    viewport.dispatchEvent(new Event('resize'))
    await flushViewportUpdate()

    expect(document.documentElement).toHaveAttribute('data-dashboard-keyboard', 'open')
    expect(document.documentElement.style.getPropertyValue('--dashboard-keyboard-inset')).toBe('50px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-keyboard-overlay-inset')).toBe('50px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-visible-height')).toBe('750px')
  })

  it('detects keyboard contraction independently of a matching visual viewport pan', async () => {
    const viewport = createVisualViewport(390, 800)
    render(<DashboardViewportHarness />)
    focusKeyboardInput()

    viewport.height = 520
    viewport.offsetTop = 280
    viewport.dispatchEvent(new Event('resize'))
    viewport.dispatchEvent(new Event('scroll'))
    await flushViewportUpdate()

    expect(document.documentElement).toHaveAttribute('data-dashboard-keyboard', 'open')
    expect(document.documentElement.style.getPropertyValue('--dashboard-keyboard-inset')).toBe('280px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-keyboard-overlay-inset')).toBe('280px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-viewport-height')).toBe('800px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-visible-height')).toBe('520px')
  })

  it('subtracts frame shrink from the keyboard overlay length', async () => {
    const viewport = createVisualViewport(390, 800)
    render(<DashboardViewportHarness />)
    focusKeyboardInput()

    setWindowSize(390, 650)
    viewport.height = 520
    viewport.dispatchEvent(new Event('resize'))
    window.dispatchEvent(new Event('resize'))
    await flushViewportUpdate()

    expect(document.documentElement).toHaveAttribute('data-dashboard-keyboard', 'open')
    expect(document.documentElement.style.getPropertyValue('--dashboard-keyboard-inset')).toBe('280px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-keyboard-overlay-inset')).toBe('130px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-viewport-height')).toBe('650px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-visible-height')).toBe('520px')
  })

  it('coalesces viewport event bursts into one animation-frame update using the latest metrics', async () => {
    const viewport = createVisualViewport(390, 800)
    const requestFrame = vi.spyOn(window, 'requestAnimationFrame')
    render(<DashboardViewportHarness />)
    focusKeyboardInput()
    await flushViewportUpdate()
    requestFrame.mockClear()

    viewport.height = 700
    viewport.dispatchEvent(new Event('resize'))
    viewport.height = 620
    viewport.dispatchEvent(new Event('scroll'))
    viewport.height = 520
    window.dispatchEvent(new Event('resize'))

    expect(requestFrame).toHaveBeenCalledTimes(1)
    await flushViewportUpdate()
    expect(document.documentElement.style.getPropertyValue('--dashboard-visible-height')).toBe('520px')

    requestFrame.mockRestore()
  })

  it('recovers after focus leaves an input when the visual viewport restores without a resize event', async () => {
    const viewport = createVisualViewport(390, 800)
    render(<DashboardViewportHarness />)
    focusKeyboardInput()

    viewport.height = 520
    viewport.dispatchEvent(new Event('resize'))
    await flushViewportUpdate()
    expect(document.documentElement.style.getPropertyValue('--dashboard-visible-height')).toBe('520px')

    act(() => screen.getByRole('textbox', { name: 'Keyboard input' }).blur())
    await flushViewportUpdate()
    viewport.height = 800
    await waitForViewportRecovery()

    expect(document.documentElement).not.toHaveAttribute('data-dashboard-keyboard')
    expect(document.documentElement.style.getPropertyValue('--dashboard-viewport-height')).toBe('800px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-visible-height')).toBe('800px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-keyboard-inset')).toBe('0px')
  })

  it('keeps keyboard recovery scheduled when focus moves to a button', async () => {
    const viewport = createVisualViewport(390, 800)
    render(
      <>
        <DashboardViewportHarness />
        <button type="button">Next</button>
      </>,
    )
    focusKeyboardInput()

    viewport.height = 520
    viewport.dispatchEvent(new Event('resize'))
    await flushViewportUpdate()
    act(() => {
      screen.getByRole('textbox', { name: 'Keyboard input' }).blur()
      screen.getByRole('button', { name: 'Next' }).focus()
    })
    await flushViewportUpdate()
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 180))
    })
    viewport.height = 800
    await waitForViewportRecovery()

    expect(document.documentElement).not.toHaveAttribute('data-dashboard-keyboard')
    expect(document.documentElement.style.getPropertyValue('--dashboard-viewport-height')).toBe('800px')
  })

  it.each([DASHBOARD_ROUTE_CHANGE_EVENT, 'pageshow', 'popstate'])('recovers a silently restored viewport on %s', async (eventName) => {
    const viewport = createVisualViewport(390, 800)
    render(<DashboardViewportHarness />)
    focusKeyboardInput()

    viewport.height = 520
    viewport.dispatchEvent(new Event('resize'))
    await flushViewportUpdate()
    act(() => screen.getByRole('textbox', { name: 'Keyboard input' }).blur())
    await flushViewportUpdate()
    viewport.height = 800
    window.dispatchEvent(new Event(eventName))
    await flushViewportUpdate()

    expect(document.documentElement).not.toHaveAttribute('data-dashboard-keyboard')
    expect(document.documentElement.style.getPropertyValue('--dashboard-viewport-height')).toBe('800px')
  })

  it('treats a desktop height resize without input focus as a layout resize', async () => {
    setWindowSize(1280, 900)
    setMaxTouchPoints(0)
    const viewport = createVisualViewport(1280, 900)
    render(<DashboardViewportHarness />)

    setWindowSize(1280, 650)
    viewport.height = 650
    window.dispatchEvent(new Event('resize'))
    viewport.dispatchEvent(new Event('resize'))
    await flushViewportUpdate()

    expect(document.documentElement).not.toHaveAttribute('data-dashboard-keyboard')
    expect(document.documentElement.style.getPropertyValue('--dashboard-layout-height')).toBe('650px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-viewport-height')).toBe('650px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-visible-height')).toBe('650px')
  })

  it('treats a focused desktop height resize as a layout resize', async () => {
    setWindowSize(1280, 900)
    setMaxTouchPoints(0)
    const viewport = createVisualViewport(1280, 900)
    render(<DashboardViewportHarness />)
    focusKeyboardInput()

    setWindowSize(1280, 650)
    viewport.height = 650
    window.dispatchEvent(new Event('resize'))
    viewport.dispatchEvent(new Event('resize'))
    await flushViewportUpdate()

    expect(document.documentElement).not.toHaveAttribute('data-dashboard-keyboard')
    expect(document.documentElement.style.getPropertyValue('--dashboard-layout-height')).toBe('650px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-viewport-height')).toBe('650px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-visible-height')).toBe('650px')
  })

  it('treats a focused narrow desktop height resize as a layout resize', async () => {
    setWindowSize(700, 900)
    setMaxTouchPoints(0)
    const viewport = createVisualViewport(700, 900)
    render(<DashboardViewportHarness />)
    focusKeyboardInput()

    setWindowSize(700, 650)
    viewport.height = 650
    window.dispatchEvent(new Event('resize'))
    viewport.dispatchEvent(new Event('resize'))
    await flushViewportUpdate()

    expect(document.documentElement).not.toHaveAttribute('data-dashboard-keyboard')
    expect(document.documentElement.style.getPropertyValue('--dashboard-layout-height')).toBe('650px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-viewport-height')).toBe('650px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-visible-height')).toBe('650px')
  })

  it('keeps a cached keyboard prediction monotone while the keyboard opens', async () => {
    const viewport = createVisualViewport(390, 800)
    render(<DashboardViewportHarness />)
    window.localStorage.setItem('react-dash-keyboard-v1:portrait:800', '280')
    armDashboardKeyboardPrediction()
    focusKeyboardInput()

    viewport.height = 700
    viewport.dispatchEvent(new Event('resize'))
    await flushViewportUpdate()
    expect(document.documentElement.style.getPropertyValue('--dashboard-keyboard-overlay-inset')).toBe('280px')

    viewport.height = 600
    viewport.dispatchEvent(new Event('resize'))
    await flushViewportUpdate()
    expect(document.documentElement.style.getPropertyValue('--dashboard-keyboard-overlay-inset')).toBe('280px')

    viewport.height = 520
    viewport.dispatchEvent(new Event('resize'))
    await flushViewportUpdate()
    expect(document.documentElement.style.getPropertyValue('--dashboard-keyboard-overlay-inset')).toBe('280px')
  })

  it('resets its baseline when orientation changes', async () => {
    const viewport = createVisualViewport(390, 800)
    render(<DashboardViewportHarness />)

    setWindowSize(800, 390)
    viewport.width = 800
    viewport.height = 390
    window.dispatchEvent(new Event('orientationchange'))
    await flushViewportUpdate()

    expect(document.documentElement).not.toHaveAttribute('data-dashboard-keyboard')
    expect(document.documentElement.style.getPropertyValue('--dashboard-layout-width')).toBe('800px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-viewport-height')).toBe('390px')
  })
})
