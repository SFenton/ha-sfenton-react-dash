import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
  return null
}

function setWindowSize(width: number, height: number) {
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
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
    await new Promise((resolve) => window.setTimeout(resolve, 280))
  })
}

describe('useDashboardViewport', () => {
  beforeEach(() => {
    setWindowSize(390, 800)
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
})
