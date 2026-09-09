import { act, fireEvent, render, screen } from '@testing-library/react'
import { useLayoutEffect } from 'react'
import { useHorizontalScrollControls } from './useHorizontalScrollControls'

interface HarnessProps {
  basePadding?: number
  clientWidth?: number
  gap?: number
  inlinePadding?: number
  itemCount?: number
  itemWidth?: number
}

function Harness({
  basePadding = 10,
  clientWidth = 220,
  gap = 10,
  inlinePadding = 10,
  itemCount = 5,
  itemWidth = 80,
}: HarnessProps) {
  const {
    canScrollNext,
    canScrollPrevious,
    currentPage,
    handleNavigationKeyDown,
    pageCount,
    pageStartIndices,
    scrollNext,
    scrollToPage,
    scrollPrevious,
    scrollerRef,
  } = useHorizontalScrollControls<HTMLDivElement>({ itemCount })

  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const items = Array.from(scroller.children) as HTMLElement[]
    const leadingSpace = (item: HTMLElement) => Number.parseFloat(item.style.getPropertyValue('--weather-carousel-page-leading-space')) || 0
    const trailingSpace = (item: HTMLElement) => Number.parseFloat(item.style.getPropertyValue('--weather-carousel-page-trailing-space')) || 0
    const pageSpace = (item: HTMLElement) => leadingSpace(item) + trailingSpace(item)
    Object.defineProperties(scroller, {
      clientWidth: { configurable: true, value: clientWidth },
      scrollWidth: {
        configurable: true,
        get: () => (
          inlinePadding * 2
          + itemCount * itemWidth
          + Math.max(0, itemCount - 1) * gap
          + items.reduce((total, item) => total + pageSpace(item), 0)
        ),
      },
    })
    scroller.style.paddingLeft = `${inlinePadding}px`
    scroller.style.paddingRight = `${inlinePadding}px`
    scroller.style.setProperty('--weather-carousel-base-padding', `${basePadding}px`)
    items.forEach((item, index) => {
      Object.defineProperties(item, {
        offsetLeft: {
          configurable: true,
          get: () => (
            inlinePadding
            + index * (itemWidth + gap)
            + items.slice(0, index).reduce((total, precedingItem) => total + pageSpace(precedingItem), 0)
            + leadingSpace(item)
          ),
        },
        offsetWidth: { configurable: true, value: itemWidth },
      })
    })
    scroller.scrollTo = vi.fn((options: ScrollToOptions) => {
      scroller.scrollLeft = Math.min(scroller.scrollWidth - scroller.clientWidth, options.left ?? 0)
      fireEvent.scroll(scroller)
    })
  }, [basePadding, clientWidth, gap, inlinePadding, itemCount, itemWidth, scrollerRef])

  return (
    <>
      <div data-testid="scroller" onKeyDown={handleNavigationKeyDown} ref={scrollerRef}>
        {Array.from({ length: itemCount }, (_, index) => <span data-carousel-item="true" data-testid={`item-${index}`} key={index}>{index}</span>)}
      </div>
      <button aria-disabled={!canScrollPrevious} data-testid="previous" onClick={scrollPrevious} type="button">Previous</button>
      <button aria-disabled={!canScrollNext} data-testid="next" onClick={scrollNext} type="button">Next</button>
      <button data-testid="page-three" onClick={() => scrollToPage(2)} type="button">Page three</button>
      <output data-testid="page-state">{currentPage + 1}/{pageCount}</output>
      <output data-testid="page-starts">{pageStartIndices.join(',')}</output>
    </>
  )
}

async function flushMeasurements() {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
}

describe('useHorizontalScrollControls', () => {
  it('creates complete pages and left-aligns an incomplete final page', async () => {
    render(<Harness />)
    await flushMeasurements()

    const scroller = screen.getByTestId('scroller')
    expect(screen.getByTestId('previous')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByTestId('next')).toHaveAttribute('aria-disabled', 'false')
    expect(screen.getByTestId('page-state')).toHaveTextContent('1/3')
    expect(screen.getByTestId('page-starts')).toHaveTextContent('0,2,4')
    expect(screen.getByTestId('item-0').style.getPropertyValue('--weather-carousel-page-leading-space')).toBe('15px')
    expect(screen.getByTestId('item-1').style.getPropertyValue('--weather-carousel-page-trailing-space')).toBe('5px')
    expect(screen.getByTestId('item-2').style.getPropertyValue('--weather-carousel-page-leading-space')).toBe('15px')
    expect(screen.getByTestId('item-3').style.getPropertyValue('--weather-carousel-page-trailing-space')).toBe('5px')
    expect(screen.getByTestId('item-4').style.getPropertyValue('--weather-carousel-page-leading-space')).toBe('')
    expect(screen.getByTestId('item-4').style.getPropertyValue('--weather-carousel-page-trailing-space')).toBe('120px')

    fireEvent.click(screen.getByTestId('next'))
    expect(scroller.scrollTo).toHaveBeenLastCalledWith({ behavior: 'smooth', left: 200 })
    await flushMeasurements()
    expect(screen.getByTestId('previous')).toHaveAttribute('aria-disabled', 'false')
    expect(screen.getByTestId('page-state')).toHaveTextContent('2/3')

    fireEvent.click(screen.getByTestId('page-three'))
    expect(scroller.scrollTo).toHaveBeenLastCalledWith({ behavior: 'smooth', left: 400 })
    await flushMeasurements()
    expect(screen.getByTestId('next')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByTestId('page-state')).toHaveTextContent('3/3')
    expect(scroller.scrollLeft).toBe(scroller.scrollWidth - scroller.clientWidth)
  })

  it('uses the rendered control gutters when calculating page capacity', async () => {
    render(<Harness basePadding={2} clientWidth={300} inlinePadding={50} itemCount={6} />)
    await flushMeasurements()

    expect(screen.getByTestId('page-state')).toHaveTextContent('1/3')
    expect(screen.getByTestId('page-starts')).toHaveTextContent('0,2,4')
  })

  it('enables paging when even a small part of an item would be clipped', async () => {
    render(<Harness clientWidth={278} itemCount={3} />)
    await flushMeasurements()

    expect(screen.getByTestId('next')).toHaveAttribute('aria-disabled', 'false')
    expect(screen.getByTestId('page-state')).toHaveTextContent('1/2')
    expect(screen.getByTestId('page-starts')).toHaveTextContent('0,2')
  })

  it('centers the complete item set when paging is unnecessary', async () => {
    render(<Harness clientWidth={300} itemCount={2} />)
    await flushMeasurements()

    expect(screen.getByTestId('page-state')).toHaveTextContent('1/1')
    expect(screen.getByTestId('page-starts')).toBeEmptyDOMElement()
    expect(screen.getByTestId('item-0').style.getPropertyValue('--weather-carousel-page-leading-space')).toBe('55px')
    expect(screen.getByTestId('item-1').style.getPropertyValue('--weather-carousel-page-trailing-space')).toBe('55px')
  })

  it('uses immediate scrolling when reduced motion is requested', async () => {
    const originalMatchMedia = window.matchMedia
    window.matchMedia = vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })
    try {
      render(<Harness />)
      await flushMeasurements()
      fireEvent.click(screen.getByTestId('next'))
      expect(screen.getByTestId('scroller').scrollTo).toHaveBeenLastCalledWith({ behavior: 'auto', left: 200 })
    } finally {
      window.matchMedia = originalMatchMedia
    }
  })
})
