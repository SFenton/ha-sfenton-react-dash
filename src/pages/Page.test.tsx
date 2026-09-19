import { render, screen } from '@testing-library/react'
import { Page } from './Page'
import { resetMockHass } from '../test/mocks/hakitCoreState'

describe('Page', () => {
  beforeEach(() => {
    resetMockHass()
  })

  it('exposes a typed content measure and one page-content container', () => {
    render(
      <Page measure="reading" title="Tasks">
        <div>Task content</div>
      </Page>,
    )

    const main = screen.getByRole('main')
    expect(main).toHaveAttribute('data-page-measure', 'reading')
    expect(main.querySelectorAll('[class*="scrollContent"]')).toHaveLength(1)
    expect(screen.getByText('Task content')).toBeInTheDocument()
  })

  it('resets the page scroller when the route key changes', () => {
    const { rerender } = render(
      <Page scrollResetKey="overview" title="Home">
        <div style={{ height: '2000px' }}>Long content</div>
      </Page>,
    )

    const scroller = screen.getByRole('main').querySelector<HTMLElement>('[data-page-scroller="true"]')
    if (!scroller) throw new Error('Missing page scroller')
    scroller.scrollTop = 240

    rerender(
      <Page scrollResetKey="vacation" title="Vacation">
        <div style={{ height: '2000px' }}>Long content</div>
      </Page>,
    )

    expect(scroller.scrollTop).toBe(0)
  })
})
