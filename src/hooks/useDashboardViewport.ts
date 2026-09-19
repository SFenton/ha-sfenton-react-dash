import { useEffect } from 'react'
import { DASHBOARD_ROUTE_CHANGE_EVENT, dashboardEventTargets } from './dashboardLocation'

export const DASHBOARD_KEYBOARD_STATE_EVENT = 'dashboard-keyboard-state'

export interface DashboardKeyboardStateDetail {
  open: boolean
}

const KEYBOARD_OPEN_THRESHOLD_PX = 80
const KEYBOARD_STABILITY_MS = 120
const KEYBOARD_ARMING_WATCHDOG_MS = 400
const KEYBOARD_MASK_REVEAL_MS = 110
const VIEWPORT_RECOVERY_DELAY_MS = 360
const BASELINE_FOLLOW_UP_DELAY_MS = 120
const MIN_VIEWPORT_HEIGHT_PX = 320
const KEYBOARD_ATTR = 'data-dashboard-keyboard'
const EMBEDDED_ATTR = 'data-dashboard-embedded'
const KEYBOARD_ARMING_ATTR = 'data-dashboard-kb-arming'
const KEYBOARD_MASKED_ATTR = 'data-dashboard-kb-masked'
const PREDICTED_KEYBOARD_INSET_VAR = '--dashboard-keyboard-predicted-inset'
const KEYBOARD_CACHE_PREFIX = 'react-dash-keyboard-v1'
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

interface PendingKeyboardPrediction {
  baselineHeight: number
  cacheKey: string
  fromCache: boolean
  predictedInset: number
  startedAt: number
}

interface DashboardViewportPanState {
  embedded: boolean
  keyboardInset: number
  scrollY: number
  visualOffsetTop: number
}

let pendingKeyboardPrediction: PendingKeyboardPrediction | null = null

export function shouldResetDashboardViewportPan({
  embedded,
  keyboardInset,
  scrollY,
  visualOffsetTop,
}: DashboardViewportPanState) {
  return embedded
    && keyboardInset > 0
    && (scrollY > 0 || visualOffsetTop > 0)
}

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

function sameOriginFrameElement(viewportWindow: Window) {
  if (viewportWindow === window) return null
  try {
    const frameElement = window.frameElement
    if (!frameElement) return null
    void frameElement.ownerDocument
    return frameElement
  } catch {
    return null
  }
}

function roundedCssPx(value: number) {
  return `${Math.max(0, Math.round(value))}px`
}

function setCssPx(root: HTMLElement, property: string, value: number) {
  const nextValue = roundedCssPx(value)
  if (root.style.getPropertyValue(property) !== nextValue) root.style.setProperty(property, nextValue)
}

export function isDashboardKeyboardInput(target: EventTarget | null) {
  if (target instanceof HTMLTextAreaElement) return !target.disabled && !target.readOnly
  if (target instanceof HTMLSelectElement) return !target.disabled
  if (target instanceof HTMLInputElement) {
    return !target.disabled && !target.readOnly && !NON_KEYBOARD_INPUT_TYPES.has(target.type)
  }
  return target instanceof HTMLElement
    && Boolean(target.isContentEditable || target.getAttribute('contenteditable') === 'true')
}

function keyboardInputFocused() {
  return isDashboardKeyboardInput(document.activeElement)
}

function viewportOrientation(width: number, height: number) {
  return width > height ? 'landscape' : 'portrait'
}

function viewportHeightBucket(height: number) {
  return Math.round(height / 25) * 25
}

function keyboardCacheKey(width: number, height: number) {
  return `${KEYBOARD_CACHE_PREFIX}:${viewportOrientation(width, height)}:${viewportHeightBucket(height)}`
}

function validKeyboardInset(value: number, baselineHeight: number) {
  return Number.isFinite(value)
    && value > KEYBOARD_OPEN_THRESHOLD_PX
    && value < baselineHeight * 0.7
}

function readCachedKeyboardInset(cacheKey: string, baselineHeight: number) {
  try {
    const value = Number(window.localStorage.getItem(cacheKey))
    return validKeyboardInset(value, baselineHeight) ? Math.min(value, baselineHeight * 0.7) : null
  } catch {
    return null
  }
}

function writeCachedKeyboardInset(cacheKey: string, value: number, baselineHeight: number) {
  if (!validKeyboardInset(value, baselineHeight)) return
  try {
    window.localStorage.setItem(cacheKey, String(Math.round(value)))
  } catch {
    // Storage can be unavailable or evicted in embedded WebViews.
  }
}

export function armDashboardKeyboardPrediction() {
  const viewportWindow = sameOriginTopWindow()
  const viewport = viewportWindow.visualViewport ?? window.visualViewport
  const baselineHeight = viewport?.height ?? viewportWindow.innerHeight ?? window.innerHeight
  const baselineWidth = viewport?.width ?? viewportWindow.innerWidth ?? window.innerWidth
  const cacheKey = keyboardCacheKey(baselineWidth, baselineHeight)
  const cachedInset = readCachedKeyboardInset(cacheKey, baselineHeight)
  const fallbackInset = Math.min(baselineHeight * 0.7, Math.max(KEYBOARD_OPEN_THRESHOLD_PX + 1, baselineHeight * 0.55))
  const predictedInset = Math.round(cachedInset ?? fallbackInset)
  const root = document.documentElement

  pendingKeyboardPrediction = {
    baselineHeight,
    cacheKey,
    fromCache: cachedInset !== null,
    predictedInset,
    startedAt: performance.now(),
  }
  root.style.setProperty(PREDICTED_KEYBOARD_INSET_VAR, roundedCssPx(predictedInset))
  root.setAttribute(KEYBOARD_ARMING_ATTR, 'true')
  if (cachedInset === null) root.setAttribute(KEYBOARD_MASKED_ATTR, 'true')
  else root.removeAttribute(KEYBOARD_MASKED_ATTR)

  return { fromCache: cachedInset !== null, predictedInset }
}

export function clearDashboardKeyboardPrediction() {
  pendingKeyboardPrediction = null
  const root = document.documentElement
  root.removeAttribute(KEYBOARD_ARMING_ATTR)
  root.removeAttribute(KEYBOARD_MASKED_ATTR)
  root.style.removeProperty(PREDICTED_KEYBOARD_INSET_VAR)
}

function readViewportMetrics(viewportWindow: Window, frameElement: Element | null) {
  const viewport = viewportWindow.visualViewport ?? window.visualViewport
  const viewportHeight = viewport?.height ?? viewportWindow.innerHeight ?? window.innerHeight
  const viewportWidth = viewport?.width ?? viewportWindow.innerWidth ?? window.innerWidth
  const ownLayoutHeight = window.innerHeight || document.documentElement.clientHeight || 0
  const ownLayoutWidth = window.innerWidth || document.documentElement.clientWidth || 0
  const frameHeight = frameElement?.getBoundingClientRect().height ?? ownLayoutHeight
  const layoutHeight = Math.max(ownLayoutHeight, frameHeight, viewportWindow.innerHeight || 0)
  const layoutWidth = Math.max(ownLayoutWidth, viewportWindow.innerWidth || 0, viewportWidth)

  return {
    frameHeight,
    layoutHeight,
    layoutWidth,
    viewportHeight,
    viewportWidth,
  }
}

export function useDashboardViewport() {
  useEffect(() => {
    const root = document.documentElement
    const viewportWindow = sameOriginTopWindow()
    const frameElement = sameOriginFrameElement(viewportWindow)
    if (viewportWindow !== window) root.setAttribute(EMBEDDED_ATTR, 'true')
    let baselineViewportHeight = 0
    let baselineFrameHeight = 0
    let baselineWidth = 0
    let lastKeyboardInset = 0
    let lastFrameShrink = 0
    let keyboardOpen = false
    let publishedKeyboardOpen = false
    let lastArmingKeyboardInset = 0
    let armingQuietReady = false
    let frameId: number | null = null
    let baselineUpdateId: number | null = null
    let recoveryUpdateId: number | null = null
    let armingWatchdogId: number | null = null
    let armingQuietId: number | null = null
    let maskRevealId: number | null = null

    const dispatchKeyboardState = (open: boolean) => {
      if (publishedKeyboardOpen === open) return
      publishedKeyboardOpen = open
      window.dispatchEvent(new CustomEvent<DashboardKeyboardStateDetail>(DASHBOARD_KEYBOARD_STATE_EVENT, {
        detail: { open },
      }))
    }

    const setKeyboardState = (open: boolean) => {
      if (open) {
        if (root.getAttribute(KEYBOARD_ATTR) !== 'open') root.setAttribute(KEYBOARD_ATTR, 'open')
      } else if (root.hasAttribute(KEYBOARD_ATTR)) {
        root.removeAttribute(KEYBOARD_ATTR)
      }
      dispatchKeyboardState(open)
    }

    const clearArmingWatchdog = () => {
      if (armingWatchdogId === null) return
      window.clearTimeout(armingWatchdogId)
      armingWatchdogId = null
    }

    const clearMaskReveal = () => {
      if (maskRevealId === null) return
      window.clearTimeout(maskRevealId)
      maskRevealId = null
    }

    const clearArmingQuiet = () => {
      if (armingQuietId === null) return
      window.clearTimeout(armingQuietId)
      armingQuietId = null
    }

    const releaseArming = (revealAfterTransition: boolean) => {
      clearArmingWatchdog()
      clearArmingQuiet()
      armingQuietReady = false
      root.removeAttribute(KEYBOARD_ARMING_ATTR)
      root.style.removeProperty(PREDICTED_KEYBOARD_INSET_VAR)
      pendingKeyboardPrediction = null
      if (root.hasAttribute(KEYBOARD_MASKED_ATTR) && revealAfterTransition) {
        clearMaskReveal()
        maskRevealId = window.setTimeout(() => {
          root.removeAttribute(KEYBOARD_MASKED_ATTR)
          maskRevealId = null
        }, KEYBOARD_MASK_REVEAL_MS)
      } else {
        root.removeAttribute(KEYBOARD_MASKED_ATTR)
      }
    }

    const updateViewportVars = () => {
      const metrics = readViewportMetrics(viewportWindow, frameElement)
      const widthChanged = baselineWidth > 0 && Math.abs(metrics.layoutWidth - baselineWidth) >= KEYBOARD_OPEN_THRESHOLD_PX
      if (baselineViewportHeight === 0 || baselineFrameHeight === 0) {
        baselineViewportHeight = metrics.viewportHeight
        baselineFrameHeight = metrics.frameHeight
        baselineWidth = metrics.layoutWidth
      } else if (widthChanged) {
        baselineViewportHeight = keyboardOpen
          ? metrics.viewportHeight + lastKeyboardInset
          : metrics.viewportHeight
        baselineFrameHeight = keyboardOpen
          ? metrics.frameHeight + lastFrameShrink
          : metrics.frameHeight
        baselineWidth = metrics.layoutWidth
      }

      const rawKeyboardInset = Math.max(0, baselineViewportHeight - metrics.viewportHeight)
      const frameShrink = Math.max(0, baselineFrameHeight - metrics.frameHeight)
      const contractedForKeyboard = rawKeyboardInset >= KEYBOARD_OPEN_THRESHOLD_PX || (keyboardOpen && rawKeyboardInset > 0)
      const nonTouchLayoutResize = (navigator.maxTouchPoints ?? 0) === 0
      const keyboardInset = contractedForKeyboard && !nonTouchLayoutResize && (keyboardInputFocused() || keyboardOpen)
        ? rawKeyboardInset
        : 0
      const measuredOverlayInset = keyboardInset > 0
        ? Math.min(metrics.frameHeight, Math.max(0, keyboardInset - frameShrink))
        : 0
      const arming = root.getAttribute(KEYBOARD_ARMING_ATTR) === 'true' && pendingKeyboardPrediction !== null
      let appliedOverlayInset = measuredOverlayInset

      if (arming && pendingKeyboardPrediction) {
        const prediction = pendingKeyboardPrediction
        const now = performance.now()
        const timedOut = now - prediction.startedAt >= KEYBOARD_ARMING_WATCHDOG_MS
        if (keyboardInset > 0) {
          if (Math.abs(keyboardInset - lastArmingKeyboardInset) > 1) {
            lastArmingKeyboardInset = keyboardInset
            armingQuietReady = false
            clearArmingQuiet()
            if (keyboardInset >= KEYBOARD_OPEN_THRESHOLD_PX) {
              armingQuietId = window.setTimeout(() => {
                armingQuietId = null
                armingQuietReady = true
                scheduleUpdate()
              }, KEYBOARD_STABILITY_MS)
            }
          }
          appliedOverlayInset = Math.max(measuredOverlayInset, prediction.predictedInset)
          const cachedExact = prediction.fromCache
            && frameShrink === 0
            && Math.abs(keyboardInset - prediction.predictedInset) <= 1
          if (cachedExact || armingQuietReady || timedOut) {
            if (frameShrink === 0) writeCachedKeyboardInset(prediction.cacheKey, keyboardInset, prediction.baselineHeight)
            appliedOverlayInset = measuredOverlayInset
            releaseArming(!prediction.fromCache)
          }
        } else if (timedOut) {
          releaseArming(false)
        }
      }

      const viewportHeight = Math.max(MIN_VIEWPORT_HEIGHT_PX, metrics.frameHeight)
      const visibleHeight = Math.max(MIN_VIEWPORT_HEIGHT_PX, metrics.frameHeight - measuredOverlayInset)

      if (keyboardInset === 0 && !keyboardInputFocused()) {
        baselineViewportHeight = metrics.viewportHeight
        baselineFrameHeight = metrics.frameHeight
        baselineWidth = metrics.layoutWidth
        lastArmingKeyboardInset = 0
        armingQuietReady = false
      }
      keyboardOpen = keyboardInset > 0
      lastKeyboardInset = keyboardInset
      lastFrameShrink = frameShrink

      setCssPx(root, '--dashboard-layout-height', metrics.layoutHeight)
      setCssPx(root, '--dashboard-layout-width', metrics.layoutWidth)
      setCssPx(root, '--dashboard-viewport-height', viewportHeight)
      setCssPx(root, '--dashboard-visible-height', visibleHeight)
      setCssPx(root, '--dashboard-viewport-width', metrics.layoutWidth)
      if (import.meta.env.DEV) setCssPx(root, '--dashboard-keyboard-inset', keyboardInset)
      setCssPx(root, '--dashboard-keyboard-overlay-inset', appliedOverlayInset)
      setKeyboardState(keyboardOpen)
      if (shouldResetDashboardViewportPan({
        embedded: frameElement !== null,
        keyboardInset,
        scrollY: viewportWindow.scrollY,
        visualOffsetTop: viewportWindow.visualViewport?.offsetTop ?? 0,
      })) {
        viewportWindow.scrollTo(0, 0)
      }
    }

    const scheduleUpdate = () => {
      if (frameId !== null) return
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
      const metrics = readViewportMetrics(viewportWindow, frameElement)
      baselineViewportHeight = metrics.viewportHeight
      baselineFrameHeight = metrics.frameHeight
      baselineWidth = metrics.layoutWidth
      lastArmingKeyboardInset = 0
      armingQuietReady = false
      clearArmingQuiet()
      clearArmingWatchdog()
      if (root.getAttribute(KEYBOARD_ARMING_ATTR) === 'true') {
        armingWatchdogId = window.setTimeout(() => {
          armingWatchdogId = null
          scheduleUpdate()
        }, KEYBOARD_ARMING_WATCHDOG_MS)
      }
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
      else releaseArming(false)
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
      clearArmingWatchdog()
      clearArmingQuiet()
      clearMaskReveal()
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
      setKeyboardState(false)
      root.removeAttribute(EMBEDDED_ATTR)
      clearDashboardKeyboardPrediction()
      root.style.removeProperty('--dashboard-layout-height')
      root.style.removeProperty('--dashboard-layout-width')
      root.style.removeProperty('--dashboard-viewport-height')
      root.style.removeProperty('--dashboard-visible-height')
      root.style.removeProperty('--dashboard-viewport-width')
      root.style.removeProperty('--dashboard-keyboard-inset')
      root.style.removeProperty('--dashboard-keyboard-overlay-inset')
    }
  }, [])
}
