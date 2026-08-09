import { useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type TouchEvent } from 'react'
import styles from './CardCarousel.module.css'

interface CardCarouselProps {
  ariaLabel: string
  columns?: number
  pages: ReactNode[][]
}

type CardCarouselStyle = CSSProperties & {
  '--carousel-columns': number
}

export function CardCarousel({ ariaLabel, columns = 2, pages }: CardCarouselProps) {
  const touchStartXRef = useRef<number | null>(null)
  const [activePage, setActivePage] = useState(0)
  const currentPage = Math.max(0, Math.min(pages.length - 1, activePage))

  const goToPage = (pageIndex: number) => {
    if (pages.length === 0) return
    setActivePage(((pageIndex % pages.length) + pages.length) % pages.length)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    goToPage(currentPage + (event.key === 'ArrowRight' ? 1 : -1))
  }

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null
  }

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const startX = touchStartXRef.current
    touchStartXRef.current = null
    const endX = event.changedTouches[0]?.clientX
    if (startX === null || endX === undefined) return
    const deltaX = endX - startX
    if (deltaX > 40) goToPage(currentPage - 1)
    if (deltaX < -40) goToPage(currentPage + 1)
  }

  return (
    <div
      className={styles.carousel}
      data-active-page={currentPage + 1}
      data-card-carousel="true"
      data-columns={columns}
      style={{ '--carousel-columns': columns } as CardCarouselStyle}
    >
      <div
        aria-label={ariaLabel}
        aria-roledescription="carousel"
        className={styles.viewport}
        onKeyDown={handleKeyDown}
        onTouchEnd={handleTouchEnd}
        onTouchStart={handleTouchStart}
        role="region"
        tabIndex={0}
      >
        <div
          className={styles.track}
          style={{ transform: `translate3d(-${currentPage * 100}%, 0, 0)` }}
        >
          {pages.map((page, pageIndex) => {
            const active = pageIndex === currentPage
            return (
              <div
                aria-hidden={active ? undefined : 'true'}
                aria-label={`Page ${pageIndex + 1} of ${pages.length}`}
                aria-roledescription="slide"
                className={styles.page}
                data-carousel-page={pageIndex + 1}
                inert={!active}
                key={`carousel-page-${pageIndex}`}
                role="group"
              >
                {page.map((card, cardIndex) => (
                  <div data-carousel-card="true" key={`carousel-card-${pageIndex}-${cardIndex}`}>{card}</div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
      <div aria-label={`${ariaLabel} pages`} className={styles.dots} role="group">
        {pages.map((_, index) => (
          <button
            aria-current={currentPage === index ? 'page' : undefined}
            aria-label={`Go to page ${index + 1}`}
            className={styles.dotButton}
            key={`carousel-dot-${index}`}
            onClick={() => goToPage(index)}
            onPointerUp={(event) => event.currentTarget.blur()}
            type="button"
          >
            <span aria-hidden="true" className={styles.dot} />
          </button>
        ))}
      </div>
    </div>
  )
}
