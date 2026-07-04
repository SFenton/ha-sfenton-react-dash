import { useEffect } from 'react'

const KEYBOARD_OPEN_THRESHOLD_PX = 80
const KEYBOARD_SETTLE_MS = 260
const MIN_VIEWPORT_HEIGHT_PX = 320
const KEYBOARD_ATTR = 'data-dashboard-keyboard'
const EMBEDDED_ATTR = 'data-dashboard-embedded'
const KEYBOARD_SETTLED_ATTR = 'data-dashboard-keyboard-settled'

function sameOriginTopWindow() {
  try {
    if (window.top && window.top !== window) {
      void window.top.document
      return window.top
    }
  } catch {
    return window
  }
  return window
}

function roundedCssPx(value: number) {
  return `${Math.max(0, Math.round(value))}px`
}

function readViewportMetrics(viewportWindow: Window) {
  const viewport = viewportWindow.visualViewport ?? window.visualViewport
  const viewportHeight = viewport?.height ?? window.innerHeight
  const viewportWidth = viewport?.width ?? window.innerWidth
  const viewportTop = viewport?.offsetTop ?? 0
  const viewportBottom = viewportTop + viewportHeight
  const ownLayoutHeight = Math.max(
    window.innerHeight || 0,
    document.documentElement.clientHeight || 0,
  )
  const layoutHeight = Math.max(
    ownLayoutHeight,
    viewportWindow.innerHeight || 0,
    viewportBottom,
  )
  const layoutWidth = Math.max(
    window.innerWidth || 0,
    document.documentElement.clientWidth || 0,
    viewportWindow.innerWidth || 0,
    viewportWidth,
  )

  return {
    layoutHeight,
    layoutWidth,
    ownLayoutHeight,
    viewportBottom,
    viewportHeight,
    viewportWidth,
  }
}

export function useDashboardViewport() {
  useEffect(() => {
    const root = document.documentElement
    const viewportWindow = sameOriginTopWindow()
    if (viewportWindow !== window) root.setAttribute(EMBEDDED_ATTR, 'true')
    let baselineHeight = 0
    let frameId: number | null = null
    let delayedUpdateId: number | null = null
    let settleTimerId: number | null = null

    const setKeyboardState = (keyboardInset: number, keyboardOverlayInset: number) => {
      if (settleTimerId !== null) {
        window.clearTimeout(settleTimerId)
        settleTimerId = null
      }

      if (keyboardInset > 0) {
        root.setAttribute(KEYBOARD_ATTR, 'open')
        if (root.getAttribute(KEYBOARD_SETTLED_ATTR) !== 'open') {
          root.style.removeProperty('--dashboard-keyboard-settled-overlay-inset')
          settleTimerId = window.setTimeout(() => {
            root.style.setProperty('--dashboard-keyboard-settled-overlay-inset', roundedCssPx(keyboardOverlayInset))
            root.setAttribute(KEYBOARD_SETTLED_ATTR, 'open')
            settleTimerId = null
          }, KEYBOARD_SETTLE_MS)
        }
      } else {
        root.removeAttribute(KEYBOARD_ATTR)
        root.removeAttribute(KEYBOARD_SETTLED_ATTR)
        root.style.removeProperty('--dashboard-keyboard-settled-overlay-inset')
      }
    }

    const updateViewportVars = () => {
      const metrics = readViewportMetrics(viewportWindow)
      const currentBaseline = Math.max(baselineHeight, metrics.layoutHeight, metrics.viewportBottom)
      const rawKeyboardInset = Math.max(0, currentBaseline - metrics.viewportBottom)
      const keyboardInset = rawKeyboardInset >= KEYBOARD_OPEN_THRESHOLD_PX ? rawKeyboardInset : 0
      const contentAlreadyResized = keyboardInset > 0 && metrics.ownLayoutHeight <= metrics.viewportHeight + KEYBOARD_OPEN_THRESHOLD_PX
      const keyboardOverlayInset = contentAlreadyResized ? 0 : keyboardInset
      const visibleHeight = keyboardInset > 0
        ? Math.max(MIN_VIEWPORT_HEIGHT_PX, metrics.viewportHeight)
        : Math.max(MIN_VIEWPORT_HEIGHT_PX, metrics.layoutHeight)

      if (keyboardInset === 0) {
        baselineHeight = currentBaseline
      }

      root.style.setProperty('--dashboard-layout-height', roundedCssPx(metrics.layoutHeight))
      root.style.setProperty('--dashboard-layout-width', roundedCssPx(metrics.layoutWidth))
      root.style.setProperty('--dashboard-viewport-height', roundedCssPx(visibleHeight))
      root.style.setProperty('--dashboard-viewport-width', roundedCssPx(metrics.layoutWidth))
      root.style.setProperty('--dashboard-keyboard-inset', roundedCssPx(keyboardInset))
      root.style.setProperty('--dashboard-keyboard-overlay-inset', roundedCssPx(keyboardOverlayInset))
      setKeyboardState(keyboardInset, keyboardOverlayInset)
    }

    const scheduleUpdate = () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId)
      frameId = window.requestAnimationFrame(() => {
        frameId = null
        updateViewportVars()
      })
    }

    const captureBaseline = () => {
      const metrics = readViewportMetrics(viewportWindow)
      baselineHeight = Math.max(baselineHeight, metrics.layoutHeight, metrics.viewportBottom)
      scheduleUpdate()
      if (delayedUpdateId !== null) window.clearTimeout(delayedUpdateId)
      delayedUpdateId = window.setTimeout(scheduleUpdate, 120)
    }

    const addWindowListener = (targetWindow: Window, type: keyof WindowEventMap, listener: EventListener) => {
      try {
        targetWindow.addEventListener(type, listener)
      } catch {
        // Cross-origin top windows cannot be observed; current-window listeners remain active.
      }
    }

    const removeWindowListener = (targetWindow: Window, type: keyof WindowEventMap, listener: EventListener) => {
      try {
        targetWindow.removeEventListener(type, listener)
      } catch {
        // Cross-origin top windows cannot be observed; current-window listeners remain active.
      }
    }

    const observedViewports = new Set([
      viewportWindow.visualViewport,
      window.visualViewport,
    ].filter((viewport): viewport is VisualViewport => viewport !== null))

    updateViewportVars()
    window.addEventListener('focusin', captureBaseline, true)
    window.addEventListener('focusout', scheduleUpdate, true)
    window.addEventListener('orientationchange', captureBaseline)
    window.addEventListener('resize', scheduleUpdate)
    addWindowListener(viewportWindow, 'resize', scheduleUpdate)
    addWindowListener(viewportWindow, 'orientationchange', captureBaseline)
    for (const viewport of observedViewports) {
      viewport?.addEventListener('resize', scheduleUpdate)
      viewport?.addEventListener('scroll', scheduleUpdate)
    }

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId)
      if (delayedUpdateId !== null) window.clearTimeout(delayedUpdateId)
      if (settleTimerId !== null) window.clearTimeout(settleTimerId)
      window.removeEventListener('focusin', captureBaseline, true)
      window.removeEventListener('focusout', scheduleUpdate, true)
      window.removeEventListener('orientationchange', captureBaseline)
      window.removeEventListener('resize', scheduleUpdate)
      removeWindowListener(viewportWindow, 'resize', scheduleUpdate)
      removeWindowListener(viewportWindow, 'orientationchange', captureBaseline)
      for (const viewport of observedViewports) {
        viewport?.removeEventListener('resize', scheduleUpdate)
        viewport?.removeEventListener('scroll', scheduleUpdate)
      }
      root.removeAttribute(KEYBOARD_ATTR)
      root.removeAttribute(EMBEDDED_ATTR)
      root.removeAttribute(KEYBOARD_SETTLED_ATTR)
      root.style.removeProperty('--dashboard-layout-height')
      root.style.removeProperty('--dashboard-layout-width')
      root.style.removeProperty('--dashboard-viewport-height')
      root.style.removeProperty('--dashboard-viewport-width')
      root.style.removeProperty('--dashboard-keyboard-inset')
      root.style.removeProperty('--dashboard-keyboard-overlay-inset')
      root.style.removeProperty('--dashboard-keyboard-settled-overlay-inset')
    }
  }, [])
}
