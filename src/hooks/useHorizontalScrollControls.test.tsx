import { act, fireEvent, render, screen } from '@testing-library/react'
import { useLayoutEffect } from 'react'
import { useHorizontalScrollControls } from './useHorizontalScrollControls'

function Harness({ itemCount = 6 }: { itemCount?: number }) {
  const {
    canScrollNext,
    canScrollPrevious,
    currentPage,
    handleNavigationKeyDown,
    pageCount,
    scrollNext,
    scrollToPage,
    scrollPrevious,
    scrollerRef,
  } = useHorizontalScrollControls<HTMLDivElement>({ itemCount })

  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    Object.defineProperties(scroller, {
      clientWidth: { configurable: true, value: 220 },
      scrollWidth: { configurable: true, value: 540 },
    })
    scroller.style.setProperty('--weather-carousel-base-padding', '0px')
    Array.from(scroller.children).forEach((item, index) => {
      Object.defineProperties(item, {
        offsetLeft: { configurable: true, value: index * 90 },
        offsetWidth: { configurable: true, value: 80 },
      })
    })
    scroller.scrollTo = vi.fn((options: ScrollToOptions) => {
      scroller.scrollLeft = options.left ?? 0
      fireEvent.scroll(scroller)
    })
  }, [scrollerRef])

  return (
    <>
      <div data-testid="scroller" onKeyDown={handleNavigationKeyDown} ref={scrollerRef}>
        {Array.from({ length: itemCount }, (_, index) => <span data-carousel-item="true" key={index}>{index}</span>)}
      </div>
      <button aria-disabled={!canScrollPrevious} data-testid="previous" onClick={scrollPrevious} type="button">Previous</button>
      <button aria-disabled={!canScrollNext} data-testid="next" onClick={scrollNext} type="button">Next</button>
      <button data-testid="page-three" onClick={() => scrollToPage(2)} type="button">Page three</button>
      <output data-testid="page-state">{currentPage + 1}/{pageCount}</output>
    </>
  )
}

async function flushMeasurements() {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })
}

describe('useHorizontalScrollControls', () => {
  it('moves by a viewport-sized item-aligned page and updates boundaries', async () => {
    render(<Harness />)
    await flushMeasurements()

    const scroller = screen.getByTestId('scroller')
    expect(screen.getByTestId('previous')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByTestId('next')).toHaveAttribute('aria-disabled', 'false')
    expect(screen.getByTestId('page-state')).toHaveTextContent('1/3')

    fireEvent.click(screen.getByTestId('next'))
    expect(scroller.scrollTo).toHaveBeenLastCalledWith({ behavior: 'smooth', left: 180 })
    await flushMeasurements()
    expect(screen.getByTestId('previous')).toHaveAttribute('aria-disabled', 'false')
    expect(screen.getByTestId('page-state')).toHaveTextContent('2/3')

    fireEvent.click(screen.getByTestId('page-three'))
    expect(scroller.scrollTo).toHaveBeenLastCalledWith({ behavior: 'smooth', left: 320 })
    await flushMeasurements()
    expect(screen.getByTestId('next')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByTestId('page-state')).toHaveTextContent('3/3')
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
      expect(screen.getByTestId('scroller').scrollTo).toHaveBeenLastCalledWith({ behavior: 'auto', left: 180 })
    } finally {
      window.matchMedia = originalMatchMedia
    }
  })
})
