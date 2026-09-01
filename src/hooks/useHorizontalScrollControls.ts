import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'

interface HorizontalScrollState {
  canScrollNext: boolean
  canScrollPrevious: boolean
  currentPage: number
  hasOverflow: boolean
  pageCount: number
  pageStartIndices: number[]
}

interface HorizontalScrollControlsOptions {
  enabled?: boolean
  itemCount: number
  minimumHiddenItems?: number
  revision?: number | string
}

export interface HorizontalScrollControls<T extends HTMLElement> extends HorizontalScrollState {
  handleNavigationKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  scrollNext: () => void
  scrollToPage: (page: number) => void
  scrollPrevious: () => void
  scrollerRef: RefObject<T | null>
}

const EDGE_TOLERANCE_PX = 1
const OVERFLOW_HIDE_RATIO = 0.75

function carouselItems(element: HTMLElement) {
  return Array.from(element.querySelectorAll<HTMLElement>(':scope > [data-carousel-item="true"]'))
}

function itemPitch(items: readonly HTMLElement[]) {
  if (items.length > 1) {
    const pitch = items[1].offsetLeft - items[0].offsetLeft
    if (pitch > 0) return pitch
  }
  return items[0]?.offsetWidth ?? 0
}

function baseInlinePadding(element: HTMLElement) {
  const value = Number.parseFloat(getComputedStyle(element).getPropertyValue('--weather-carousel-base-padding'))
  return Number.isFinite(value) ? value : 0
}

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useHorizontalScrollControls<T extends HTMLElement>({
  enabled = true,
  itemCount,
  minimumHiddenItems = 1,
  revision = 0,
}: HorizontalScrollControlsOptions): HorizontalScrollControls<T> {
  const scrollerRef = useRef<T>(null)
  const frameRef = useRef(0)
  const pageOffsetsRef = useRef<number[]>([0])
  const [state, setState] = useState<HorizontalScrollState>({
    canScrollNext: false,
    canScrollPrevious: false,
    currentPage: 0,
    hasOverflow: false,
    pageCount: 1,
    pageStartIndices: [],
  })

  const measure = useCallback(() => {
    frameRef.current = 0
    const element = scrollerRef.current
    if (!enabled || !element) return
    const items = carouselItems(element)
    const pitch = itemPitch(items)
    const first = items[0]
    const last = items.at(-1)
    const contentWidth = first && last ? last.offsetLeft + last.offsetWidth - first.offsetLeft : 0
    const viewportWidth = Math.max(0, element.clientWidth - baseInlinePadding(element) * 2)
    const hiddenPixels = Math.max(0, contentWidth - viewportWidth)
    const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth)

    setState((current) => {
      const showThreshold = pitch * minimumHiddenItems
      const hideThreshold = showThreshold * OVERFLOW_HIDE_RATIO
      const hasOverflow = pitch > 0 && hiddenPixels >= (current.hasOverflow ? hideThreshold : showThreshold)
      const visibleItems = Math.max(1, items.filter((item) => item.offsetLeft - (first?.offsetLeft ?? 0) + item.offsetWidth <= viewportWidth + EDGE_TOLERANCE_PX).length)
      const pageCount = hasOverflow ? Math.max(2, Math.ceil(items.length / visibleItems)) : 1
      const firstOffset = first?.offsetLeft ?? 0
      const pageOffsets = Array.from({ length: pageCount }, (_, page) => (
        page === pageCount - 1
          ? maxScroll
          : Math.min(maxScroll, Math.max(0, (items[page * visibleItems]?.offsetLeft ?? firstOffset) - firstOffset))
      ))
      const pageStartIndices = pageCount > 1
        ? Array.from({ length: pageCount - 1 }, (_, page) => Math.min(items.length - 1, page * visibleItems))
        : []
      pageOffsetsRef.current = pageOffsets
      const currentPage = pageOffsets.reduce((closestIndex, offset, index) => (
        Math.abs(offset - element.scrollLeft) < Math.abs(pageOffsets[closestIndex] - element.scrollLeft) ? index : closestIndex
      ), 0)
      const next = {
        canScrollNext: hasOverflow && currentPage < pageCount - 1,
        canScrollPrevious: hasOverflow && currentPage > 0,
        currentPage,
        hasOverflow,
        pageCount,
        pageStartIndices,
      }
      const samePageStarts = current.pageStartIndices.length === next.pageStartIndices.length
        && current.pageStartIndices.every((value, index) => value === next.pageStartIndices[index])
      return current.canScrollNext === next.canScrollNext
        && current.canScrollPrevious === next.canScrollPrevious
        && current.currentPage === next.currentPage
        && current.hasOverflow === next.hasOverflow
        && current.pageCount === next.pageCount
        && samePageStarts
        ? current
        : next
    })
  }, [enabled, minimumHiddenItems])

  const scheduleMeasure = useCallback(() => {
    if (!enabled || frameRef.current) return
    frameRef.current = window.requestAnimationFrame(measure)
  }, [enabled, measure])

  useEffect(() => {
    const element = scrollerRef.current
    if (!enabled || !element) return undefined

    element.addEventListener('scroll', scheduleMeasure, { passive: true })
    const ResizeObserverConstructor = window.ResizeObserver
    const observer = typeof ResizeObserverConstructor === 'undefined'
      ? null
      : new ResizeObserverConstructor(scheduleMeasure)
    if (observer) observer.observe(element)
    else window.addEventListener('resize', scheduleMeasure)
    scheduleMeasure()

    return () => {
      element.removeEventListener('scroll', scheduleMeasure)
      observer?.disconnect()
      if (!observer) window.removeEventListener('resize', scheduleMeasure)
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current)
      frameRef.current = 0
    }
  }, [enabled, itemCount, revision, scheduleMeasure])

  useEffect(() => {
    scheduleMeasure()
  }, [scheduleMeasure, state.hasOverflow])

  const scrollToPage = useCallback((page: number) => {
    const element = scrollerRef.current
    if (!enabled || !element) return
    const target = pageOffsetsRef.current[Math.min(pageOffsetsRef.current.length - 1, Math.max(0, page))]
    if (target === undefined) return
    element.scrollTo({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', left: target })
  }, [enabled])

  const scrollPrevious = useCallback(() => {
    if (state.canScrollPrevious) scrollToPage(state.currentPage - 1)
  }, [scrollToPage, state.canScrollPrevious, state.currentPage])

  const scrollNext = useCallback(() => {
    if (state.canScrollNext) scrollToPage(state.currentPage + 1)
  }, [scrollToPage, state.canScrollNext, state.currentPage])

  const handleNavigationKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      scrollPrevious()
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      scrollNext()
    } else if (event.key === 'Home') {
      event.preventDefault()
      scrollToPage(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      scrollToPage(state.pageCount - 1)
    }
  }, [scrollNext, scrollPrevious, scrollToPage, state.pageCount])

  return {
    canScrollNext: enabled && state.canScrollNext,
    canScrollPrevious: enabled && state.canScrollPrevious,
    currentPage: state.currentPage,
    handleNavigationKeyDown,
    hasOverflow: enabled && state.hasOverflow,
    pageCount: state.pageCount,
    pageStartIndices: state.pageStartIndices,
    scrollNext,
    scrollToPage,
    scrollPrevious,
    scrollerRef,
  }
}
