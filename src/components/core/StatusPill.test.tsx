import { render, screen } from '@testing-library/react'
import { StatusPill } from './StatusPill'

describe('StatusPill', () => {
  it('groups its icon, label, value, and compact detail under one accessible fact', () => {
    const { container } = render(
      <StatusPill
        detail="Aug 7, 2026"
        grouped
        icon="mdi:progress-clock"
        label="Freshness"
        tone="ok"
        value="Current"
      />,
    )

    const pill = screen.getByRole('group', { name: 'Freshness Current Aug 7, 2026' })
    expect(pill).toHaveAttribute('data-icon', 'mdi:progress-clock')
    expect(pill).toHaveAttribute('data-tone', 'ok')
    expect(pill.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(container).toHaveTextContent('Freshness')
    expect(container).toHaveTextContent('Current')
    expect(container).toHaveTextContent('Aug 7, 2026')
  })

  it.each(['warning', 'unavailable'] as const)('exposes the %s tone for status facts', (tone) => {
    render(<StatusPill grouped icon="mdi:progress-clock" label="Freshness" tone={tone} value="Unknown" />)
    expect(screen.getByRole('group', { name: 'Freshness Unknown' })).toHaveAttribute('data-tone', tone)
  })
})
