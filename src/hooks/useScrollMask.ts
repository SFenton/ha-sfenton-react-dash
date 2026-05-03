import { useCallback, useEffect, useRef, type RefObject } from 'react'

export interface ScrollMaskOptions {
  disabled?: boolean
  size?: number
}

const DEFAULT_SIZE = 40

export function useScrollMask(containerRef: RefObject<HTMLElement | null>, deps: readonly unknown[] = [], options: ScrollMaskOptions = {}) {
  const size = options.size ?? DEFAULT_SIZE
  const disabled = options.disabled ?? false
  const rafId = useRef(0)
  const hasMask = useRef(false)

  const update = useCallback(() => {
    const element = containerRef.current
    if (!element) return

    if (disabled) {
      if (hasMask.current) {
        hasMask.current = false
        element.style.maskImage = ''
        element.style.webkitMaskImage = ''
      }
      return
    }

    const atTop = element.scrollTop <= 0
    const atBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 1

    if (atTop && atBottom) {
      if (hasMask.current) {
        hasMask.current = false
        element.style.maskImage = ''
        element.style.webkitMaskImage = ''
      }
      return
    }

    const bottomEdge = element.clientHeight
    let mask: string

    if (atTop) {
      mask = `linear-gradient(to bottom, black ${bottomEdge - size}px, transparent ${bottomEdge}px)`
    } else if (atBottom) {
      mask = `linear-gradient(to bottom, transparent 0, black ${size}px)`
    } else {
      mask = `linear-gradient(to bottom, transparent 0, black ${size}px, black ${bottomEdge - size}px, transparent ${bottomEdge}px)`
    }

    hasMask.current = true
    element.style.maskImage = mask
    element.style.webkitMaskImage = mask
  }, [containerRef, disabled, size])

  const throttledUpdate = useCallback(() => {
    if (rafId.current) return
    rafId.current = requestAnimationFrame(() => {
      rafId.current = 0
      update()
    })
  }, [update])

  useEffect(() => () => cancelAnimationFrame(rafId.current), [])

  useEffect(() => {
    const element = containerRef.current
    if (!element || disabled) return undefined

    element.addEventListener('scroll', throttledUpdate, { passive: true })
    return () => element.removeEventListener('scroll', throttledUpdate)
  }, [containerRef, disabled, throttledUpdate])

  useEffect(() => {
    const element = containerRef.current
    if (!element || disabled) return undefined

    const resizeObserver = new ResizeObserver(throttledUpdate)
    resizeObserver.observe(element)
    return () => resizeObserver.disconnect()
  }, [containerRef, disabled, throttledUpdate])

  useEffect(() => {
    update()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update, ...deps])

  return throttledUpdate
}