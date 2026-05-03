import { useCallback, useEffect, useRef, type RefObject } from 'react'

export interface ScrollFadeOptions {
  disabled?: boolean
  distance?: number
  stops?: ReadonlyArray<readonly [number, number]>
}

const DEFAULT_DISTANCE = 36
const DEFAULT_STOPS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.15, 0.01],
  [0.3, 0.03],
  [0.45, 0.08],
  [0.6, 0.18],
  [0.75, 0.4],
  [0.9, 0.7],
  [1, 1],
]

function clearMask(element: HTMLElement) {
  element.style.maskImage = ''
  element.style.webkitMaskImage = ''
}

export function useScrollFade(
  scrollRef: RefObject<HTMLElement | null>,
  listRef: RefObject<HTMLElement | null>,
  deps: readonly unknown[] = [],
  options: ScrollFadeOptions = {},
) {
  const distance = options.distance ?? DEFAULT_DISTANCE
  const disabled = options.disabled ?? false
  const stops = options.stops ?? DEFAULT_STOPS
  const rafId = useRef(0)
  const edgeChildrenRef = useRef(new Set<HTMLElement>())

  const applyMasks = useCallback(() => {
    const listElement = listRef.current
    const scrollElement = scrollRef.current
    if (!listElement || !scrollElement) return

    if (disabled) {
      for (const child of Array.from(listElement.children)) {
        clearMask(child as HTMLElement)
      }
      return
    }

    const scrollRect = scrollElement.getBoundingClientRect()
    const atTop = scrollElement.scrollTop <= 0
    const atBottom = scrollElement.scrollTop + scrollElement.clientHeight >= scrollElement.scrollHeight - 1
    const topFadeDistance = atTop ? 0 : Math.min(scrollElement.scrollTop, distance)

    for (const child of edgeChildrenRef.current) {
      const childRect = child.getBoundingClientRect()
      const needsTopFade = !atTop && childRect.top < scrollRect.top + topFadeDistance
      const needsBottomFade = !atBottom && childRect.bottom > scrollRect.bottom - distance

      if (!needsTopFade && !needsBottomFade) {
        clearMask(child)
        continue
      }

      const clipTop = scrollRect.top - childRect.top
      const clipBottom = scrollRect.bottom - childRect.top

      if (needsTopFade && needsBottomFade) {
        const topStops = stops.map(([position, opacity]) => `rgba(0, 0, 0, ${opacity}) ${clipTop + position * topFadeDistance}px`)
        const bottomStops = [...stops]
          .reverse()
          .map(([position, opacity]) => `rgba(0, 0, 0, ${opacity}) ${clipBottom - position * distance}px`)
        const mask = `linear-gradient(to bottom, ${topStops.join(', ')}, black ${clipTop + topFadeDistance}px, black ${clipBottom - distance}px, ${bottomStops.join(', ')})`
        child.style.maskImage = mask
        child.style.webkitMaskImage = mask
        continue
      }

      if (needsTopFade) {
        const maskStops = stops.map(([position, opacity]) => `rgba(0, 0, 0, ${opacity}) ${clipTop + position * topFadeDistance}px`)
        const mask = `linear-gradient(to bottom, ${maskStops.join(', ')})`
        child.style.maskImage = mask
        child.style.webkitMaskImage = mask
        continue
      }

      const maskStops = [...stops]
        .reverse()
        .map(([position, opacity]) => `rgba(0, 0, 0, ${opacity}) ${clipBottom - position * distance}px`)
      const mask = `linear-gradient(to bottom, ${maskStops.join(', ')})`
      child.style.maskImage = mask
      child.style.webkitMaskImage = mask
    }

    for (const child of Array.from(listElement.children)) {
      const childElement = child as HTMLElement
      if (!edgeChildrenRef.current.has(childElement)) {
        clearMask(childElement)
      }
    }
  }, [disabled, distance, listRef, scrollRef, stops])

  const throttledUpdate = useCallback(() => {
    if (rafId.current) return
    rafId.current = requestAnimationFrame(() => {
      rafId.current = 0
      applyMasks()
    })
  }, [applyMasks])

  useEffect(() => () => cancelAnimationFrame(rafId.current), [])

  useEffect(() => {
    const listElement = listRef.current
    const scrollElement = scrollRef.current
    if (!listElement || !scrollElement || disabled) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const childElement = entry.target as HTMLElement
          if (entry.isIntersecting) {
            edgeChildrenRef.current.add(childElement)
          } else {
            edgeChildrenRef.current.delete(childElement)
            clearMask(childElement)
          }
        }
        throttledUpdate()
      },
      {
        root: scrollElement,
        rootMargin: `${distance}px 0px ${distance}px 0px`,
        threshold: [0, 0.1, 0.9, 1],
      },
    )

    for (const child of Array.from(listElement.children)) {
      observer.observe(child)
    }

    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, distance, listRef, scrollRef, throttledUpdate, ...deps])

  useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement || disabled) return undefined

    scrollElement.addEventListener('scroll', throttledUpdate, { passive: true })
    return () => scrollElement.removeEventListener('scroll', throttledUpdate)
  }, [disabled, scrollRef, throttledUpdate])

  useEffect(() => {
    const scrollElement = scrollRef.current
    if (!scrollElement || disabled) return undefined

    const resizeObserver = new ResizeObserver(throttledUpdate)
    resizeObserver.observe(scrollElement)
    return () => resizeObserver.disconnect()
  }, [disabled, scrollRef, throttledUpdate])

  useEffect(() => {
    applyMasks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyMasks, ...deps])

  return throttledUpdate
}