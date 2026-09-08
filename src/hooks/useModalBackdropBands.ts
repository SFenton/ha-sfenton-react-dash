import { useCallback, useLayoutEffect, useRef, useState, type RefCallback } from 'react'

// Real blur needs sampling overlap inside opaque surfaces, not just geometric edge coverage.
export const MODAL_BACKDROP_MAX_BAND_AREA_RATIO = 0.25

interface RectLike {
  bottom: number
  height: number
  left: number
  right: number
  top: number
  width: number
}

interface ModalBackdropBands {
  contentRef: RefCallback<HTMLDivElement>
  overlayRef: RefCallback<HTMLDivElement>
}

const MODAL_OVERLAY_SELECTOR = '[data-modal-sheet-overlay="true"]'
const PORTAL_SELECTOR = '[data-base-ui-portal]'
const BAND_SELECTOR = '[data-modal-backdrop-band]'
const GEOMETRY_TOLERANCE_PX = 2
const LIFECYCLE_ATTRIBUTES = [
  'data-closed',
  'data-ending-style',
  'data-starting-style',
  'data-swipe-dismiss',
  'data-swiping',
] as const

function clipRectangle(rectangle: RectLike, bounds: RectLike) {
  const left = Math.max(bounds.left, rectangle.left)
  const right = Math.min(bounds.right, rectangle.right)
  const top = Math.max(bounds.top, rectangle.top)
  const bottom = Math.min(bounds.bottom, rectangle.bottom)
  return right > left && bottom > top ? { bottom, left, right, top } : null
}

function rectangleUnionArea(rectangles: RectLike[], bounds: RectLike) {
  const clipped = rectangles.map((rectangle) => clipRectangle(rectangle, bounds)).filter((rectangle): rectangle is NonNullable<typeof rectangle> => Boolean(rectangle))
  const xs = [...new Set([bounds.left, bounds.right, ...clipped.flatMap((rectangle) => [rectangle.left, rectangle.right])])].sort((first, second) => first - second)
  let area = 0
  for (let index = 0; index < xs.length - 1; index += 1) {
    const left = xs[index]
    const right = xs[index + 1]
    const midpoint = (left + right) / 2
    const intervals = clipped
      .filter((rectangle) => midpoint >= rectangle.left && midpoint < rectangle.right)
      .map((rectangle) => [rectangle.top, rectangle.bottom] as const)
      .sort((first, second) => first[0] - second[0])
    let coveredHeight = 0
    let currentTop = 0
    let currentBottom = 0
    let activeInterval = false
    for (const [top, bottom] of intervals) {
      if (!activeInterval || top > currentBottom) {
        if (activeInterval) coveredHeight += currentBottom - currentTop
        currentTop = top
        currentBottom = bottom
        activeInterval = true
      } else {
        currentBottom = Math.max(currentBottom, bottom)
      }
    }
    if (activeInterval) coveredHeight += currentBottom - currentTop
    area += (right - left) * coveredHeight
  }
  return area
}

export function modalBackdropBandAreaRatio(bands: RectLike[], overlay: RectLike) {
  if (
    !Number.isFinite(overlay.width)
    || !Number.isFinite(overlay.height)
    || overlay.width <= 0
    || overlay.height <= 0
  ) {
    return 1
  }
  return Math.min(1, rectangleUnionArea(bands, overlay) / (overlay.width * overlay.height))
}

export function mobileBottomSheetGeometryEligible(content: RectLike, overlay: RectLike) {
  if (
    !Number.isFinite(content.width)
    || !Number.isFinite(content.height)
    || content.width <= 0
    || content.height <= 0
    || overlay.width <= 0
    || overlay.height <= 0
  ) {
    return false
  }
  return content.left - overlay.left <= GEOMETRY_TOLERANCE_PX
    && overlay.right - content.right <= GEOMETRY_TOLERANCE_PX
    && overlay.bottom - content.bottom <= GEOMETRY_TOLERANCE_PX
    && overlay.bottom - content.bottom >= -GEOMETRY_TOLERANCE_PX
    && content.top >= overlay.top - GEOMETRY_TOLERANCE_PX
}

export function popupTransformAtRest(transform: string) {
  if (!transform || transform === 'none') return true
  if (typeof DOMMatrixReadOnly !== 'undefined') {
    try {
      const matrix = new DOMMatrixReadOnly(transform)
      return Math.abs(matrix.m41) <= 1 && Math.abs(matrix.m42) <= 1
    } catch {
      return false
    }
  }
  const match = transform.match(/^matrix(3d)?\(([^)]+)\)$/)
  if (!match) return false
  const values = match[2].split(',').map((value) => Number.parseFloat(value.trim()))
  const x = match[1] ? values[12] : values[4]
  const y = match[1] ? values[13] : values[5]
  return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) <= 1 && Math.abs(y) <= 1
}

export function opaqueBackdropColor(color: string) {
  const match = color.match(/^rgba?\(([^)]+)\)$/)
  if (!match) return false
  const channels = match[1].split(/[,/]/).map((value) => value.trim())
  return channels.length === 3 || (channels.length === 4 && Number(channels[3]) === 1)
}

function backdropFilterSupported() {
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') return false
  return CSS.supports('backdrop-filter', 'blur(1px)')
    || CSS.supports('-webkit-backdrop-filter', 'blur(1px)')
}

function baseUiTransitionActive(element: HTMLElement) {
  return LIFECYCLE_ATTRIBUTES.some((attribute) => element.hasAttribute(attribute))
    || element.hasAttribute('data-nested-drawer-open')
    || element.hasAttribute('data-nested-drawer-swiping')
}

function ownedEventTarget(target: EventTarget | null, content: HTMLElement, overlay: HTMLElement) {
  return target instanceof Node && (content.contains(target) || overlay.contains(target))
}

function nodeIncludesModalOverlay(node: Node) {
  return node instanceof Element
    && (node.matches(MODAL_OVERLAY_SELECTOR) || Boolean(node.querySelector(MODAL_OVERLAY_SELECTOR)))
}

function nodeIncludesPortal(node: Node) {
  return node instanceof Element
    && (node.matches(PORTAL_SELECTOR) || Boolean(node.querySelector(PORTAL_SELECTOR)))
}

function currentBandRectangles(overlay: HTMLElement) {
  return Array.from(overlay.querySelectorAll<HTMLElement>(BAND_SELECTOR)).map((band) => band.getBoundingClientRect())
}

function connectedModalOverlays() {
  return Array.from(document.querySelectorAll<HTMLElement>(MODAL_OVERLAY_SELECTOR)).filter((overlay) => overlay.isConnected)
}

function stationaryTransformTransition(element: HTMLElement) {
  if (typeof CSSTransition === 'undefined' || typeof KeyframeEffect === 'undefined' || typeof DOMMatrixReadOnly === 'undefined' || typeof element.getAnimations !== 'function') return false
  const transitions = element.getAnimations().filter((animation) => (
    animation instanceof CSSTransition && animation.transitionProperty === 'transform'
  ))
  if (transitions.length === 0) return false
  return transitions.every((transition) => {
    if (!(transition.effect instanceof KeyframeEffect)) return false
    const frames = transition.effect.getKeyframes()
    return frames.length > 1 && frames.every((frame) => {
      if (typeof frame.transform !== 'string') return false
      try {
        return new DOMMatrixReadOnly(frame.transform).isIdentity
      } catch {
        return false
      }
    })
  })
}

export function useModalBackdropBands(enabled: boolean): ModalBackdropBands {
  const contentNodeRef = useRef<HTMLDivElement>(null)
  const overlayNodeRef = useRef<HTMLDivElement>(null)
  const [refVersion, setRefVersion] = useState(0)
  const contentRef = useCallback((node: HTMLDivElement | null) => {
    if (contentNodeRef.current === node) return
    contentNodeRef.current = node
    setRefVersion((version) => version + 1)
  }, [])
  const overlayRef = useCallback((node: HTMLDivElement | null) => {
    if (overlayNodeRef.current === node) return
    overlayNodeRef.current = node
    setRefVersion((version) => version + 1)
  }, [])

  useLayoutEffect(() => {
    const content = contentNodeRef.current
    const overlay = overlayNodeRef.current
    if (!content || !overlay) return undefined

    let generation = 0
    let settleFrame = 0
    let settleTimer = 0
    let pageActive = true
    let windowActive = true
    const activePointers = new Set<number>()
    const activeTouches = new Set<number>()
    const activeTransitions = new Set<string>()
    const clearFrame = () => {
      if (settleFrame) window.cancelAnimationFrame(settleFrame)
      settleFrame = 0
    }
    const disable = () => {
      overlay.removeAttribute('data-exposed-backdrop-bands')
    }
    const hardFallback = () => {
      generation += 1
      clearFrame()
      disable()
    }
    if (
      !enabled
      || !backdropFilterSupported()
      || typeof window.ResizeObserver === 'undefined'
      || typeof window.MutationObserver === 'undefined'
    ) {
      disable()
      return undefined
    }

    const forcedColors = typeof window.matchMedia === 'function'
      ? window.matchMedia('(forced-colors: active)')
      : null
    const eligible = () => {
      const contentStyle = getComputedStyle(content)
      if (
        !pageActive
        || !windowActive
        || document.visibilityState === 'hidden'
        || activePointers.size > 0
        || activeTouches.size > 0
        || activeTransitions.size > 0
        || forcedColors?.matches
        || baseUiTransitionActive(content)
        || baseUiTransitionActive(overlay)
        || content.dataset.state !== 'open'
        || content.dataset.centeredLayout === 'true'
        || !popupTransformAtRest(contentStyle.transform)
        || !opaqueBackdropColor(contentStyle.backgroundColor)
        || Number(contentStyle.opacity) < 1
        || Number(getComputedStyle(overlay).opacity) < 1
      ) {
        return false
      }
      const overlays = connectedModalOverlays()
      if (overlays.length !== 1 || overlays[0] !== overlay) return false
      const contentBounds = content.getBoundingClientRect()
      const overlayBounds = overlay.getBoundingClientRect()
      if (!mobileBottomSheetGeometryEligible(contentBounds, overlayBounds)) return false
      const bands = currentBandRectangles(overlay)
      if (bands.length !== 4) return false
      const topBand = overlay.querySelector<HTMLElement>('[data-modal-backdrop-band="top"]')
      if (!topBand) return false
      const topRadius = Math.max(
        Number.parseFloat(getComputedStyle(content).borderTopLeftRadius) || 0,
        Number.parseFloat(getComputedStyle(content).borderTopRightRadius) || 0,
      )
      const topBandBounds = topBand.getBoundingClientRect()
      if (
        topBandBounds.top > overlayBounds.top + 1
        || topBandBounds.left > overlayBounds.left + 1
        || topBandBounds.right < overlayBounds.right - 1
        || topBandBounds.bottom < contentBounds.top + topRadius - 1
      ) {
        return false
      }
      return modalBackdropBandAreaRatio(bands, overlayBounds) <= MODAL_BACKDROP_MAX_BAND_AREA_RATIO
    }
    const sync = () => {
      if (eligible()) {
        if (!overlay.hasAttribute('data-exposed-backdrop-bands')) overlay.setAttribute('data-exposed-backdrop-bands', 'true')
      } else {
        disable()
      }
    }
    const schedule = () => {
      clearFrame()
      const scheduledGeneration = ++generation
      settleFrame = window.requestAnimationFrame(() => {
        settleFrame = 0
        if (scheduledGeneration === generation) sync()
      })
    }
    const releaseIfIdle = () => {
      if (activePointers.size === 0 && activeTouches.size === 0) sync()
    }
    const blockPointer = (event: PointerEvent) => {
      if (!ownedEventTarget(event.target, content, overlay)) return
      activePointers.add(event.pointerId)
      hardFallback()
    }
    const releasePointer = (event: PointerEvent) => {
      if (!activePointers.delete(event.pointerId)) return
      releaseIfIdle()
    }
    const handleLostPointerCapture = (event: PointerEvent) => {
      if (event.buttons === 0) releasePointer(event)
    }
    const blockTouch = (event: TouchEvent) => {
      if (!ownedEventTarget(event.target, content, overlay)) return
      for (const touch of event.changedTouches) activeTouches.add(touch.identifier)
      hardFallback()
    }
    const releaseTouch = (event: TouchEvent) => {
      let releasedOwnedTouch = false
      for (const touch of event.changedTouches) {
        if (activeTouches.delete(touch.identifier)) releasedOwnedTouch = true
      }
      if (releasedOwnedTouch) releaseIfIdle()
    }
    const clearInteractions = () => {
      activePointers.clear()
      activeTouches.clear()
    }
    const lifecycleTransitionKey = (event: TransitionEvent) => {
      if (event.target === content && (event.propertyName === 'transform' || event.propertyName === 'opacity')) {
        return `content:${event.propertyName}`
      }
      if (event.target === overlay && event.propertyName === 'opacity') return 'overlay:opacity'
      return null
    }
    const handleTransitionStart = (event: TransitionEvent) => {
      const key = lifecycleTransitionKey(event)
      if (!key) return
      // Base UI removes scale(1) after a tap, creating a 500ms identity-to-identity transition.
      if (key === 'content:transform' && stationaryTransformTransition(content)) return
      activeTransitions.add(key)
      hardFallback()
    }
    const handleTransitionEnd = (event: TransitionEvent) => {
      const key = lifecycleTransitionKey(event)
      if (!key) return
      activeTransitions.delete(key)
      if (activeTransitions.size === 0) sync()
    }
    const handleMutation = () => {
      if (baseUiTransitionActive(content) || baseUiTransitionActive(overlay)) hardFallback()
      else sync()
    }
    const observedPortals = new Set<Element>()
    function refreshPortalObservations() {
      const portals = Array.from(document.querySelectorAll(PORTAL_SELECTOR))
      if (portals.length === observedPortals.size && portals.every((portal) => observedPortals.has(portal))) return

      // MutationObserver has no unobserve(): rebuild its targets to release detached portals.
      portalObserver.disconnect()
      observedPortals.clear()
      portalObserver.observe(document.body, { childList: true })
      for (const portal of portals) {
        observedPortals.add(portal)
        portalObserver.observe(portal, { childList: true })
      }
    }
    function handlePortalMutation(records: MutationRecord[]) {
      const changedNodes = records.flatMap((record) => [...record.addedNodes, ...record.removedNodes])
      const portalsChanged = changedNodes.some(nodeIncludesPortal)
      if (portalsChanged) refreshPortalObservations()
      if (!portalsChanged && !changedNodes.some(nodeIncludesModalOverlay)) return
      if (connectedModalOverlays().length !== 1) hardFallback()
      else schedule()
    }
    const handleVisibilityChange = () => {
      clearInteractions()
      if (document.visibilityState === 'visible') schedule()
      else hardFallback()
    }
    const handlePageHide = () => {
      pageActive = false
      clearInteractions()
      hardFallback()
    }
    const handlePageShow = () => {
      pageActive = true
      clearInteractions()
      activeTransitions.clear()
      schedule()
    }
    const handleWindowBlur = () => {
      windowActive = false
      clearInteractions()
      hardFallback()
    }
    const handleWindowFocus = () => {
      windowActive = true
      schedule()
    }
    const handleForcedColors = () => {
      if (forcedColors?.matches) hardFallback()
      else schedule()
    }

    const resizeObserver = new ResizeObserver(schedule)
    resizeObserver.observe(content)
    resizeObserver.observe(overlay)
    const mutationObserver = new MutationObserver(handleMutation)
    mutationObserver.observe(content, {
      attributeFilter: [
        'data-centered-layout',
        'data-closed',
        'data-ending-style',
        'data-nested-drawer-open',
        'data-nested-drawer-swiping',
        'data-starting-style',
        'data-state',
        'data-swipe-dismiss',
        'data-swiping',
        'style',
      ],
      attributes: true,
    })
    mutationObserver.observe(overlay, {
      attributeFilter: [
        'data-closed',
        'data-ending-style',
        'data-starting-style',
        'data-swipe-dismiss',
        'data-swiping',
      ],
      attributes: true,
    })
    const portalObserver = new MutationObserver(handlePortalMutation)
    portalObserver.observe(document.body, { childList: true })
    refreshPortalObservations()

    document.addEventListener('pointerdown', blockPointer, true)
    document.addEventListener('pointerup', releasePointer, true)
    document.addEventListener('pointercancel', releasePointer, true)
    document.addEventListener('lostpointercapture', handleLostPointerCapture, true)
    document.addEventListener('touchstart', blockTouch, { capture: true, passive: true })
    document.addEventListener('touchend', releaseTouch, true)
    document.addEventListener('touchcancel', releaseTouch, true)
    content.addEventListener('transitionrun', handleTransitionStart)
    content.addEventListener('transitionstart', handleTransitionStart)
    content.addEventListener('transitionend', handleTransitionEnd)
    content.addEventListener('transitioncancel', handleTransitionEnd)
    overlay.addEventListener('transitionrun', handleTransitionStart)
    overlay.addEventListener('transitionstart', handleTransitionStart)
    overlay.addEventListener('transitionend', handleTransitionEnd)
    overlay.addEventListener('transitioncancel', handleTransitionEnd)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('pageshow', handlePageShow)
    window.addEventListener('blur', handleWindowBlur)
    window.addEventListener('focus', handleWindowFocus)
    forcedColors?.addEventListener('change', handleForcedColors)
    schedule()
    settleTimer = window.setTimeout(schedule, 650)

    return () => {
      generation += 1
      window.clearTimeout(settleTimer)
      clearFrame()
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      portalObserver.disconnect()
      observedPortals.clear()
      document.removeEventListener('pointerdown', blockPointer, true)
      document.removeEventListener('pointerup', releasePointer, true)
      document.removeEventListener('pointercancel', releasePointer, true)
      document.removeEventListener('lostpointercapture', handleLostPointerCapture, true)
      document.removeEventListener('touchstart', blockTouch, true)
      document.removeEventListener('touchend', releaseTouch, true)
      document.removeEventListener('touchcancel', releaseTouch, true)
      content.removeEventListener('transitionrun', handleTransitionStart)
      content.removeEventListener('transitionstart', handleTransitionStart)
      content.removeEventListener('transitionend', handleTransitionEnd)
      content.removeEventListener('transitioncancel', handleTransitionEnd)
      overlay.removeEventListener('transitionrun', handleTransitionStart)
      overlay.removeEventListener('transitionstart', handleTransitionStart)
      overlay.removeEventListener('transitionend', handleTransitionEnd)
      overlay.removeEventListener('transitioncancel', handleTransitionEnd)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('pageshow', handlePageShow)
      window.removeEventListener('blur', handleWindowBlur)
      window.removeEventListener('focus', handleWindowFocus)
      forcedColors?.removeEventListener('change', handleForcedColors)
      disable()
    }
  }, [enabled, refVersion])

  return { contentRef, overlayRef }
}
