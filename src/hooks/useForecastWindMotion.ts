import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import {
  WEATHER_DATA_TRANSITION_MS,
  WIND_ROTATION_EASING,
  shortestBearingDelta,
} from '../components/hass/weatherPresentation'

interface ForecastWindMotionOptions {
  enabled: boolean
  revision: string
}

interface PaintedWindTransform {
  rotation: number
  translateX: number
}

interface WindArrowSnapshot {
  arrow: HTMLElement
  finalCenter: number
  painted: PaintedWindTransform
  previousBearing: number | undefined
  previousFinalCenter: number | undefined
  targetBearing: number | undefined
}

const ARROW_SELECTOR = '[data-forecast-wind-arrow="true"]'
const RANGE_SELECTOR = '[data-forecast-wind-range="true"]'

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function targetBearing(arrow: HTMLElement) {
  const value = Number(arrow.dataset.windDestinationBearing)
  return Number.isFinite(value) ? value : undefined
}

export function readPaintedForecastWindTransform(
  arrow: HTMLElement,
  fallbackRotation = 0,
): PaintedWindTransform {
  if (typeof DOMMatrixReadOnly === 'undefined') {
    return { rotation: fallbackRotation, translateX: 0 }
  }

  const transform = getComputedStyle(arrow).transform
  if (!transform || transform === 'none') {
    return { rotation: fallbackRotation, translateX: 0 }
  }

  try {
    const matrix = new DOMMatrixReadOnly(transform)
    return {
      rotation: (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI,
      translateX: matrix.e,
    }
  } catch {
    return { rotation: fallbackRotation, translateX: 0 }
  }
}

function finalArrowCenter(arrow: HTMLElement, translateX: number) {
  const bounds = arrow.getBoundingClientRect()
  return bounds.left + bounds.width / 2 - translateX
}

function windArrows(list: HTMLElement) {
  return Array.from(list.querySelectorAll<HTMLElement>(ARROW_SELECTOR))
}

export function useForecastWindMotion<T extends HTMLElement>({
  enabled,
  revision,
}: ForecastWindMotionOptions): RefObject<T | null> {
  const listRef = useRef<T>(null)
  const animationsRef = useRef(new Map<HTMLElement, Animation>())
  const finalCentersRef = useRef(new Map<HTMLElement, number>())
  const targetBearingsRef = useRef(new Map<HTMLElement, number | undefined>())

  const cancelAnimations = () => {
    for (const animation of animationsRef.current.values()) animation.cancel()
    animationsRef.current.clear()
  }

  const refreshFinalCenters = () => {
    const list = listRef.current
    if (!list) return
    const arrows = windArrows(list)
    const currentArrows = new Set(arrows)
    for (const arrow of arrows) {
      const bearing = targetBearing(arrow)
      const painted = readPaintedForecastWindTransform(arrow, bearing ?? 0)
      finalCentersRef.current.set(arrow, finalArrowCenter(arrow, painted.translateX))
      targetBearingsRef.current.set(arrow, bearing)
    }
    for (const arrow of finalCentersRef.current.keys()) {
      if (!currentArrows.has(arrow)) {
        finalCentersRef.current.delete(arrow)
        targetBearingsRef.current.delete(arrow)
      }
    }
  }

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    if (!enabled) {
      cancelAnimations()
      finalCentersRef.current.clear()
      targetBearingsRef.current.clear()
      return
    }

    const arrows = windArrows(list)
    const currentArrows = new Set(arrows)
    const snapshots: WindArrowSnapshot[] = arrows.map((arrow) => {
      const target = targetBearing(arrow)
      const previousBearing = targetBearingsRef.current.get(arrow)
      const painted = readPaintedForecastWindTransform(
        arrow,
        previousBearing ?? target ?? 0,
      )
      return {
        arrow,
        finalCenter: finalArrowCenter(arrow, painted.translateX),
        painted,
        previousBearing,
        previousFinalCenter: finalCentersRef.current.get(arrow),
        targetBearing: target,
      }
    })

    cancelAnimations()
    const reducedMotion = prefersReducedMotion()
    const pendingAnimations: Animation[] = []
    const trackAnimation = (
      arrow: HTMLElement,
      animation: Animation,
      finalRotation: number,
    ) => {
      animationsRef.current.set(arrow, animation)
      pendingAnimations.push(animation)
      animation.onfinish = () => {
        if (animationsRef.current.get(arrow) !== animation) return
        animationsRef.current.delete(arrow)
        animation.cancel()
        const nextPainted = readPaintedForecastWindTransform(arrow, finalRotation)
        finalCentersRef.current.set(arrow, finalArrowCenter(arrow, nextPainted.translateX))
      }
      animation.oncancel = () => {
        if (animationsRef.current.get(arrow) === animation) {
          animationsRef.current.delete(arrow)
        }
      }
    }

    for (const snapshot of snapshots) {
      const {
        arrow,
        finalCenter,
        painted,
        previousBearing,
        previousFinalCenter,
        targetBearing: target,
      } = snapshot
      finalCentersRef.current.set(arrow, finalCenter)
      targetBearingsRef.current.set(arrow, target)

      const targetRotation = target ?? 0
      if (
        reducedMotion
        || previousFinalCenter === undefined
      ) {
        arrow.style.transform = `translateX(0px) rotate(${targetRotation}deg)`
        continue
      }

      const startTranslateX = previousFinalCenter + painted.translateX - finalCenter
      if (previousBearing === undefined || target === undefined) {
        arrow.style.transform = `translateX(0px) rotate(${targetRotation}deg)`
        if (typeof arrow.animate !== 'function' || Math.abs(startTranslateX) < 0.5) {
          continue
        }

        const animation = arrow.animate(
          [
            { transform: `translateX(${startTranslateX}px) rotate(${targetRotation}deg)` },
            { transform: `translateX(0px) rotate(${targetRotation}deg)` },
          ],
          {
            duration: WEATHER_DATA_TRANSITION_MS,
            easing: WIND_ROTATION_EASING,
          },
        )
        trackAnimation(arrow, animation, targetRotation)
        continue
      }

      const rotationDelta = shortestBearingDelta(painted.rotation, target)
      const finalRotation = painted.rotation + rotationDelta
      arrow.style.transform = `translateX(0px) rotate(${finalRotation}deg)`

      if (
        typeof arrow.animate !== 'function'
        || (Math.abs(startTranslateX) < 0.5 && Math.abs(rotationDelta) < 0.01)
      ) {
        continue
      }

      const animation = arrow.animate(
        [
          { transform: `translateX(${startTranslateX}px) rotate(${painted.rotation}deg)` },
          { transform: `translateX(0px) rotate(${finalRotation}deg)` },
        ],
        {
          duration: WEATHER_DATA_TRANSITION_MS,
          easing: WIND_ROTATION_EASING,
        },
      )
      trackAnimation(arrow, animation, finalRotation)
    }

    const sharedStartTime = document.timeline?.currentTime ?? null
    if (sharedStartTime !== null) {
      pendingAnimations.forEach((animation) => {
        animation.startTime = sharedStartTime
      })
    }

    for (const arrow of finalCentersRef.current.keys()) {
      if (!currentArrows.has(arrow)) {
        finalCentersRef.current.delete(arrow)
        targetBearingsRef.current.delete(arrow)
      }
    }
  }, [enabled, revision])

  useEffect(() => {
    const list = listRef.current
    if (!enabled || !list) return undefined

    let cancelled = false
    const refresh = () => refreshFinalCenters()
    const ResizeObserverConstructor = window.ResizeObserver
    const observer = typeof ResizeObserverConstructor === 'undefined'
      ? null
      : new ResizeObserverConstructor(refresh)
    if (observer) {
      observer.observe(list)
      list.querySelectorAll<HTMLElement>(RANGE_SELECTOR).forEach((range) => observer.observe(range))
    } else {
      window.addEventListener('resize', refresh)
    }
    document.fonts?.ready.then(() => {
      if (!cancelled) refresh()
    }).catch(() => undefined)

    return () => {
      cancelled = true
      observer?.disconnect()
      if (!observer) window.removeEventListener('resize', refresh)
    }
  }, [enabled, revision])

  useEffect(() => () => cancelAnimations(), [])

  return listRef
}
