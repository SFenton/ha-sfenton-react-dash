import { useRef, useState, type KeyboardEvent, type ReactNode, type UIEvent } from 'react'
import styles from './CardCarousel.module.css'

interface CardCarouselProps {
  ariaLabel: string
  columns?: number
  pages: ReactNode[][]
}

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function CardCarousel({ ariaLabel, columns = 2, pages }: CardCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Array<HTMLDivElement | null>>([])
  const [activePage, setActivePage] = useState(0)
  const currentPage = Math.max(0, Math.min(pages.length - 1, activePage))

  const scrollToPage = (pageIndex: number) => {
    const boundedIndex = Math.max(0, Math.min(pages.length - 1, pageIndex))
    const track = trackRef.current
    const target = pageRefs.current[boundedIndex]
    const firstPage = pageRefs.current[0]
    if (!track || !target || !firstPage) return
    setActivePage(boundedIndex)
    track.scrollTo({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      left: target.offsetLeft - firstPage.offsetLeft,
      top: 0,
    })
  }

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const track = event.currentTarget
    const nearestPage = pageRefs.current.reduce((nearest, page, index) => {
      if (!page) return nearest
      const distance = Math.abs((page.offsetLeft - (pageRefs.current[0]?.offsetLeft ?? 0)) - track.scrollLeft)
      return distance < nearest.distance ? { distance, index } : nearest
    }, { distance: Number.POSITIVE_INFINITY, index: 0 })
    if (nearestPage.index !== currentPage) setActivePage(nearestPage.index)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    scrollToPage(currentPage + (event.key === 'ArrowRight' ? 1 : -1))
  }

  return (
    <div className={styles.carousel} data-card-carousel="true" data-columns={columns}>
      <div
        aria-label={ariaLabel}
        className={styles.track}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        ref={trackRef}
        role="region"
        aria-roledescription="carousel"
        tabIndex={0}
      >
        {pages.map((page, pageIndex) => (
          <div
            aria-label={`Page ${pageIndex + 1} of ${pages.length}`}
            className={styles.page}
            data-carousel-page={pageIndex + 1}
            key={`carousel-page-${pageIndex}`}
            ref={(node) => {
              pageRefs.current[pageIndex] = node
            }}
            role="group"
            aria-roledescription="slide"
          >
            {page.map((card, cardIndex) => (
              <div data-carousel-card="true" key={`carousel-card-${pageIndex}-${cardIndex}`}>{card}</div>
            ))}
          </div>
        ))}
      </div>
      <div aria-label={`${ariaLabel} pages`} className={styles.dots} role="group">
        {pages.map((_, index) => (
          <button
            aria-current={currentPage === index ? 'page' : undefined}
            aria-label={`Go to page ${index + 1}`}
            className={styles.dotButton}
            key={`carousel-dot-${index}`}
            onClick={() => scrollToPage(index)}
            type="button"
          >
            <span aria-hidden="true" className={styles.dot} />
          </button>
        ))}
      </div>
    </div>
  )
}
