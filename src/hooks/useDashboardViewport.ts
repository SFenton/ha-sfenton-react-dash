import { useEffect } from 'react'
import { DASHBOARD_ROUTE_CHANGE_EVENT, dashboardEventTargets } from './dashboardLocation'

const KEYBOARD_OPEN_THRESHOLD_PX = 80
const KEYBOARD_SETTLE_MS = 260
const VIEWPORT_RECOVERY_DELAY_MS = 360
const BASELINE_FOLLOW_UP_DELAY_MS = 120
const MIN_VIEWPORT_HEIGHT_PX = 320
const KEYBOARD_ATTR = 'data-dashboard-keyboard'
const EMBEDDED_ATTR = 'data-dashboard-embedded'
const KEYBOARD_SETTLED_ATTR = 'data-dashboard-keyboard-settled'
const NON_KEYBOARD_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
])

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

function keyboardInputFocused() {
  const activeElement = document.activeElement
  if (activeElement instanceof HTMLTextAreaElement) return !activeElement.disabled && !activeElement.readOnly
  if (activeElement instanceof HTMLSelectElement) return !activeElement.disabled
  if (activeElement instanceof HTMLInputElement) {
    return !activeElement.disabled && !activeElement.readOnly && !NON_KEYBOARD_INPUT_TYPES.has(activeElement.type)
  }
  return activeElement instanceof HTMLElement && activeElement.isContentEditable
}

function readViewportMetrics(viewportWindow: Window) {
  const viewport = viewportWindow.visualViewport ?? window.visualViewport
  const viewportHeight = viewport?.height ?? window.innerHeight
  const viewportWidth = viewport?.width ?? window.innerWidth
  const viewportTop = viewport?.offsetTop ?? 0
  const viewportBottom = viewportTop + viewportHeight
  const ownLayoutHeight = window.innerHeight || document.documentElement.clientHeight || 0
  const ownLayoutWidth = window.innerWidth || document.documentElement.clientWidth || 0
  const layoutHeight = Math.max(
    ownLayoutHeight,
    viewportWindow.innerHeight || 0,
    viewportBottom,
  )
  const layoutWidth = Math.max(
    ownLayoutWidth,
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
    let baselineWidth = 0
    let lastKeyboardInset = 0
    let keyboardOpen = false
    let frameId: number | null = null
    let baselineUpdateId: number | null = null
    let recoveryUpdateId: number | null = null
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
      const widthChanged = baselineWidth > 0 && Math.abs(metrics.layoutWidth - baselineWidth) >= KEYBOARD_OPEN_THRESHOLD_PX
      if (baselineHeight === 0 || widthChanged) {
        const resizedLayoutBaseline = Math.max(metrics.layoutHeight, metrics.viewportBottom)
        const resizedKeyboardInset = Math.max(0, metrics.layoutHeight - metrics.viewportBottom)
        baselineHeight = widthChanged && keyboardOpen && resizedKeyboardInset === 0
          ? Math.max(resizedLayoutBaseline, metrics.viewportBottom + lastKeyboardInset)
          : resizedLayoutBaseline
        baselineWidth = metrics.layoutWidth
      }

      let currentBaseline = Math.max(baselineHeight, metrics.layoutHeight, metrics.viewportBottom)
      const rawKeyboardInset = Math.max(0, currentBaseline - metrics.viewportBottom)
      const contractedForKeyboard = rawKeyboardInset >= KEYBOARD_OPEN_THRESHOLD_PX || (keyboardOpen && rawKeyboardInset > 0)
      const nonTouchLayoutResize = (navigator.maxTouchPoints ?? 0) === 0
        && metrics.layoutHeight <= metrics.viewportHeight + KEYBOARD_OPEN_THRESHOLD_PX
      const keyboardInset = contractedForKeyboard && !nonTouchLayoutResize && (keyboardInputFocused() || keyboardOpen) ? rawKeyboardInset : 0
      if (contractedForKeyboard && keyboardInset === 0) {
        currentBaseline = Math.max(metrics.layoutHeight, metrics.viewportBottom)
        baselineHeight = currentBaseline
      }
      const contentAlreadyResized = keyboardInset > 0 && metrics.ownLayoutHeight <= metrics.viewportHeight + KEYBOARD_OPEN_THRESHOLD_PX
      const keyboardOverlayInset = contentAlreadyResized ? 0 : keyboardInset
      const visibleHeight = keyboardInset > 0
        ? Math.max(MIN_VIEWPORT_HEIGHT_PX, metrics.viewportHeight)
        : Math.max(MIN_VIEWPORT_HEIGHT_PX, metrics.layoutHeight)

      if (keyboardInset === 0) {
        baselineHeight = currentBaseline
        baselineWidth = metrics.layoutWidth
      }
      keyboardOpen = keyboardInset > 0
      lastKeyboardInset = keyboardInset

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

    const scheduleBaselineUpdate = () => {
      scheduleUpdate()
      if (baselineUpdateId !== null) window.clearTimeout(baselineUpdateId)
      baselineUpdateId = window.setTimeout(() => {
        baselineUpdateId = null
        scheduleUpdate()
      }, BASELINE_FOLLOW_UP_DELAY_MS)
    }

    const captureBaseline = () => {
      const metrics = readViewportMetrics(viewportWindow)
      baselineHeight = Math.max(baselineHeight, metrics.layoutHeight, metrics.viewportBottom)
      scheduleBaselineUpdate()
    }

    const recoverViewport = () => {
      scheduleUpdate()
      if (recoveryUpdateId !== null) window.clearTimeout(recoveryUpdateId)
      recoveryUpdateId = window.setTimeout(() => {
        recoveryUpdateId = null
        if (!keyboardInputFocused()) keyboardOpen = false
        scheduleUpdate()
      }, VIEWPORT_RECOVERY_DELAY_MS)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') recoverViewport()
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
    const lifecycleWindows = new Set([window, viewportWindow])
    const routeEventTargets = dashboardEventTargets()

    updateViewportVars()
    window.addEventListener('focusin', captureBaseline, true)
    window.addEventListener('focusout', recoverViewport, true)
    window.addEventListener('orientationchange', captureBaseline)
    window.addEventListener('resize', scheduleUpdate)
    addWindowListener(viewportWindow, 'resize', scheduleUpdate)
    addWindowListener(viewportWindow, 'orientationchange', captureBaseline)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    for (const targetWindow of lifecycleWindows) {
      addWindowListener(targetWindow, 'pageshow', recoverViewport)
    }
    for (const target of routeEventTargets) {
      target.addEventListener(DASHBOARD_ROUTE_CHANGE_EVENT, recoverViewport)
      target.addEventListener('popstate', recoverViewport)
    }
    for (const viewport of observedViewports) {
      viewport?.addEventListener('resize', scheduleUpdate)
      viewport?.addEventListener('scroll', scheduleUpdate)
    }

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId)
      if (baselineUpdateId !== null) window.clearTimeout(baselineUpdateId)
      if (recoveryUpdateId !== null) window.clearTimeout(recoveryUpdateId)
      if (settleTimerId !== null) window.clearTimeout(settleTimerId)
      window.removeEventListener('focusin', captureBaseline, true)
      window.removeEventListener('focusout', recoverViewport, true)
      window.removeEventListener('orientationchange', captureBaseline)
      window.removeEventListener('resize', scheduleUpdate)
      removeWindowListener(viewportWindow, 'resize', scheduleUpdate)
      removeWindowListener(viewportWindow, 'orientationchange', captureBaseline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      for (const targetWindow of lifecycleWindows) {
        removeWindowListener(targetWindow, 'pageshow', recoverViewport)
      }
      for (const target of routeEventTargets) {
        target.removeEventListener(DASHBOARD_ROUTE_CHANGE_EVENT, recoverViewport)
        target.removeEventListener('popstate', recoverViewport)
      }
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
