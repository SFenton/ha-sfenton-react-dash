import { render, screen } from '@testing-library/react'
import { InfoBox } from './InfoBox'

describe('InfoBox', () => {
  it('renders a reusable success note with title and text', () => {
    render(<InfoBox title="Hint">Use a double tap.</InfoBox>)

    const note = screen.getByRole('note', { name: 'Hint' })
    expect(note).toHaveAttribute('data-tone', 'success')
    expect(note).toHaveTextContent('Use a double tap.')
  })

  it('supports warning and neutral variants used by vacuum summaries', () => {
    const { rerender } = render(<InfoBox title="Issues" tone="warning"><ul><li>Blocked</li></ul></InfoBox>)
    expect(screen.getByRole('note', { name: 'Issues' })).toHaveAttribute('data-tone', 'warning')

    rerender(<InfoBox title="Selected Rooms" tone="neutral">None</InfoBox>)
    expect(screen.getByRole('note', { name: 'Selected Rooms' })).toHaveAttribute('data-tone', 'neutral')
  })
})
