import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DASHBOARD_ROUTE_CHANGE_EVENT } from './dashboardLocation'
import { useDashboardViewport } from './useDashboardViewport'

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

async function waitForKeyboardSettle() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 420))
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
    document.documentElement.removeAttribute('data-dashboard-keyboard-settled')
    document.documentElement.removeAttribute('style')
  })

  afterEach(() => {
    cleanup()
    document.documentElement.removeAttribute('data-dashboard-keyboard')
    document.documentElement.removeAttribute('data-dashboard-keyboard-settled')
    document.documentElement.removeAttribute('style')
    setMaxTouchPoints(0)
  })

  it('publishes JS-derived viewport dimensions for shell CSS', () => {
    render(<DashboardViewportHarness />)

    expect(document.documentElement.style.getPropertyValue('--dashboard-layout-height')).toBe('800px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-layout-width')).toBe('390px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-viewport-height')).toBe('800px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-viewport-width')).toBe('390px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-keyboard-inset')).toBe('0px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-keyboard-overlay-inset')).toBe('0px')
    expect(document.documentElement).not.toHaveAttribute('data-dashboard-keyboard')
    expect(document.documentElement).not.toHaveAttribute('data-dashboard-keyboard-settled')
  })

  it('marks the dashboard keyboard state and shrinks the visible viewport when the visual viewport contracts', async () => {
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
    expect(document.documentElement.style.getPropertyValue('--dashboard-viewport-height')).toBe('520px')
    expect(document.documentElement).not.toHaveAttribute('data-dashboard-keyboard-settled')

    await waitForKeyboardSettle()
    expect(document.documentElement).toHaveAttribute('data-dashboard-keyboard-settled', 'open')

    viewport.height = 800
    viewport.dispatchEvent(new Event('resize'))
    window.dispatchEvent(new Event('resize'))
    await flushViewportUpdate()

    expect(document.documentElement).not.toHaveAttribute('data-dashboard-keyboard')
    expect(document.documentElement).not.toHaveAttribute('data-dashboard-keyboard-settled')
    expect(document.documentElement.style.getPropertyValue('--dashboard-keyboard-inset')).toBe('0px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-keyboard-overlay-inset')).toBe('0px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-viewport-height')).toBe('800px')
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
  })

  it('recovers after focus leaves an input when the visual viewport restores without a resize event', async () => {
    const viewport = createVisualViewport(390, 800)
    render(<DashboardViewportHarness />)
    focusKeyboardInput()

    viewport.height = 520
    viewport.dispatchEvent(new Event('resize'))
    await flushViewportUpdate()
    expect(document.documentElement.style.getPropertyValue('--dashboard-viewport-height')).toBe('520px')

    act(() => screen.getByRole('textbox', { name: 'Keyboard input' }).blur())
    await flushViewportUpdate()
    viewport.height = 800
    await waitForViewportRecovery()

    expect(document.documentElement).not.toHaveAttribute('data-dashboard-keyboard')
    expect(document.documentElement.style.getPropertyValue('--dashboard-viewport-height')).toBe('800px')
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
  })

  it('uses the resized layout inset when orientation changes with the keyboard open', async () => {
    const viewport = createVisualViewport(390, 800)
    render(<DashboardViewportHarness />)
    focusKeyboardInput()

    setWindowSize(390, 520)
    viewport.height = 520
    viewport.dispatchEvent(new Event('resize'))
    await flushViewportUpdate()
    expect(document.documentElement.style.getPropertyValue('--dashboard-keyboard-inset')).toBe('280px')

    setWindowSize(800, 390)
    viewport.width = 800
    viewport.height = 320
    window.dispatchEvent(new Event('orientationchange'))
    await flushViewportUpdate()

    expect(document.documentElement).toHaveAttribute('data-dashboard-keyboard', 'open')
    expect(document.documentElement.style.getPropertyValue('--dashboard-keyboard-inset')).toBe('70px')
    expect(document.documentElement.style.getPropertyValue('--dashboard-viewport-height')).toBe('320px')

    act(() => screen.getByRole('textbox', { name: 'Keyboard input' }).blur())
    viewport.height = 390
    await waitForViewportRecovery()

    expect(document.documentElement).not.toHaveAttribute('data-dashboard-keyboard')
    expect(document.documentElement.style.getPropertyValue('--dashboard-viewport-height')).toBe('390px')
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
