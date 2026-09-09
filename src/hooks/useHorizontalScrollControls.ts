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
  revision?: number | string
}

export interface HorizontalScrollControls<T extends HTMLElement> extends HorizontalScrollState {
  handleNavigationKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  scrollNext: () => void
  scrollToPage: (page: number) => void
  scrollPrevious: () => void
  scrollerRef: RefObject<T | null>
}

const PAGE_LEADING_SPACE_PROPERTY = '--weather-carousel-page-leading-space'
const PAGE_TRAILING_SPACE_PROPERTY = '--weather-carousel-page-trailing-space'

function carouselItems(element: HTMLElement) {
  return Array.from(element.querySelectorAll<HTMLElement>(':scope > [data-carousel-item="true"]'))
}

function cssPixels(value: string) {
  const pixels = Number.parseFloat(value)
  return Number.isFinite(pixels) ? pixels : 0
}

function baseInlinePadding(element: HTMLElement) {
  return cssPixels(getComputedStyle(element).getPropertyValue('--weather-carousel-base-padding'))
}

function clearPageSpacing(items: readonly HTMLElement[]) {
  items.forEach((item) => {
    item.style.removeProperty(PAGE_LEADING_SPACE_PROPERTY)
    item.style.removeProperty(PAGE_TRAILING_SPACE_PROPERTY)
  })
}

interface CarouselPage {
  endIndex: number
  leadingSpace: number
  startIndex: number
  trailingSpace: number
}

function carouselPages(items: readonly HTMLElement[], viewportWidth: number) {
  const pages: CarouselPage[] = []
  let startIndex = 0

  while (startIndex < items.length) {
    const pageStart = items[startIndex].offsetLeft
    let endIndex = startIndex

    while (
      endIndex + 1 < items.length
      && items[endIndex + 1].offsetLeft + items[endIndex + 1].offsetWidth - pageStart <= viewportWidth
    ) {
      endIndex += 1
    }

    const nextIndex = endIndex + 1
    const pageContentWidth = items[endIndex].offsetLeft + items[endIndex].offsetWidth - pageStart
    const unusedSpace = Math.max(0, viewportWidth - pageContentWidth)
    const leadingSpace = unusedSpace / 2
    const gapAfterPage = nextIndex < items.length
      ? items[nextIndex].offsetLeft - items[endIndex].offsetLeft - items[endIndex].offsetWidth
      : 0

    pages.push({
      endIndex,
      leadingSpace,
      startIndex,
      trailingSpace: nextIndex < items.length
        ? viewportWidth - leadingSpace - pageContentWidth - gapAfterPage
        : unusedSpace - leadingSpace,
    })
    startIndex = nextIndex
  }

  const pageCapacity = Math.max(...pages.map((page) => page.endIndex - page.startIndex + 1))
  const finalPage = pages.at(-1)
  if (pages.length > 1 && finalPage && finalPage.endIndex - finalPage.startIndex + 1 < pageCapacity) {
    finalPage.trailingSpace += finalPage.leadingSpace
    finalPage.leadingSpace = 0
  }

  return pages
}

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useHorizontalScrollControls<T extends HTMLElement>({
  enabled = true,
  itemCount,
  revision = 0,
}: HorizontalScrollControlsOptions): HorizontalScrollControls<T> {
  const scrollerRef = useRef<T>(null)
  const frameRef = useRef(0)
  const layoutSignatureRef = useRef('')
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
    if (items.length === 0) return

    const computedStyle = getComputedStyle(element)
    const paddingStart = cssPixels(computedStyle.paddingLeft)
    const paddingEnd = cssPixels(computedStyle.paddingRight)
    const signature = [element.clientWidth, paddingStart, paddingEnd, items.length, revision].join(':')

    if (layoutSignatureRef.current !== signature) {
      clearPageSpacing(items)

      const first = items[0]
      const last = items.at(-1)
      const contentWidth = last ? last.offsetLeft + last.offsetWidth - first.offsetLeft : 0
      const baseViewportWidth = Math.max(0, element.clientWidth - baseInlinePadding(element) * 2)
      const hasOverflow = contentWidth > baseViewportWidth
      const viewportWidth = hasOverflow
        ? Math.max(0, element.clientWidth - paddingStart - paddingEnd)
        : baseViewportWidth
      const pages = carouselPages(items, viewportWidth)

      pages.forEach((page) => {
        if (page.leadingSpace > 0) {
          items[page.startIndex].style.setProperty(PAGE_LEADING_SPACE_PROPERTY, `${page.leadingSpace}px`)
        }
        if (page.trailingSpace !== 0) {
          items[page.endIndex].style.setProperty(PAGE_TRAILING_SPACE_PROPERTY, `${page.trailingSpace}px`)
        }
      })

      const firstOffset = first.offsetLeft - pages[0].leadingSpace
      const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth)
      pageOffsetsRef.current = hasOverflow
        ? pages.map((page) => Math.min(maxScroll, Math.max(0, items[page.startIndex].offsetLeft - page.leadingSpace - firstOffset)))
        : [0]
      layoutSignatureRef.current = signature

      setState((current) => {
        const pageStartIndices = hasOverflow ? pages.map((page) => page.startIndex) : []
        const currentPage = pageOffsetsRef.current.reduce((closestIndex, offset, index) => (
          Math.abs(offset - element.scrollLeft) < Math.abs(pageOffsetsRef.current[closestIndex] - element.scrollLeft)
            ? index
            : closestIndex
        ), 0)
        const next = {
          canScrollNext: hasOverflow && currentPage < pageOffsetsRef.current.length - 1,
          canScrollPrevious: hasOverflow && currentPage > 0,
          currentPage,
          hasOverflow,
          pageCount: hasOverflow ? pages.length : 1,
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
      return
    }

    setState((current) => {
      const currentPage = pageOffsetsRef.current.reduce((closestIndex, offset, index) => (
        Math.abs(offset - element.scrollLeft) < Math.abs(pageOffsetsRef.current[closestIndex] - element.scrollLeft)
          ? index
          : closestIndex
      ), 0)
      const next = {
        ...current,
        canScrollNext: current.hasOverflow && currentPage < current.pageCount - 1,
        canScrollPrevious: current.hasOverflow && currentPage > 0,
        currentPage,
      }
      return current.canScrollNext === next.canScrollNext
        && current.canScrollPrevious === next.canScrollPrevious
        && current.currentPage === next.currentPage
        ? current
        : next
    })
  }, [enabled, revision])

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
      layoutSignatureRef.current = ''
      clearPageSpacing(carouselItems(element))
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
