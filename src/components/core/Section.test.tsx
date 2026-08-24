import { render, screen } from '@testing-library/react'
import { Section } from './Section'

describe('Section', () => {
  it('renders a semantic section with description, content, and forwarded span', () => {
    render(
      <Section className="custom-section" contentClassName="custom-content" description="Section guidance." gap={12} id="house-controls" span="full" title="House Controls">
        <button type="button">Run control</button>
      </Section>,
    )

    const heading = screen.getByRole('heading', { level: 2, name: 'House Controls' })
    const section = heading.closest('section')
    const item = section?.parentElement

    expect(section).toHaveAttribute('id', 'house-controls')
    expect(section).toHaveClass('custom-section')
    expect(section).toHaveStyle({ '--section-gap': '12px' })
    expect(item).toHaveAttribute('data-responsive-section-item', 'true')
    expect(item).toHaveAttribute('data-span', 'full')
    expect(screen.getByText('Section guidance.')).toBeInTheDocument()
    expect(section?.querySelector('[data-section-content="true"]')).toHaveClass('custom-content')
    expect(section?.querySelector('[data-section-content="true"]')).toContainElement(screen.getByRole('button', { name: 'Run control' }))
    expect(section?.querySelector('span[aria-hidden="true"][class*="separator"]')).toBeInTheDocument()
  })

  it('can omit the separator without changing heading semantics', () => {
    render(
      <Section separator={false} title="Quiet Section">
        <span>Content</span>
      </Section>,
    )

    const section = screen.getByRole('heading', { level: 2, name: 'Quiet Section' }).closest('section')
    expect(section?.querySelector('span[aria-hidden="true"][class*="separator"]')).not.toBeInTheDocument()
  })

  it.each(['auto', 'wide', 'full'] as const)('forwards the %s responsive span', (span) => {
    render(
      <Section span={span} title={`${span} section`}>
        <span>Content</span>
      </Section>,
    )

    expect(screen.getByRole('heading', { name: `${span} section` }).closest('[data-responsive-section-item="true"]')).toHaveAttribute('data-span', span)
  })
})
