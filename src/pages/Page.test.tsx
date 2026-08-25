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
})
