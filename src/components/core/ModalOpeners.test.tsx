import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { Card } from './Card'
import { GlassTile } from './GlassTile'
import { MaterialIcon } from './Icon'
import { ModalOpenerRow } from './ModalOpenerRow'
import { OptionPickerDialog } from './OptionPickerDialog'

function PickerHarness() {
  const [open, setOpen] = useState(true)
  return (
    <OptionPickerDialog
      onClose={() => setOpen(false)}
      onSelect={() => undefined}
      open={open}
      options={[{ label: 'Automatic', value: 'auto' }]}
      presentation="sheet"
      title="Mode"
      value="auto"
    />
  )
}

describe('shared modal opener primitives', () => {
  it('adds a decorative right chevron without changing a GlassTile accessible name', () => {
    render(<GlassTile disclosure icon="mdi:shield" onClick={() => undefined} subtitle="Armed Home" title="Security System" />)

    const opener = screen.getByRole('button', { name: 'Security System Armed Home' })
    expect(opener).toHaveAttribute('data-modal-opener', 'true')
    expect(opener.querySelectorAll('[data-modal-disclosure="right-chevron"]')).toHaveLength(1)
  })

  it('does not infer modal disclosure from an ordinary tile action', () => {
    render(<GlassTile icon="mdi:power" onClick={() => undefined} title="Toggle Light" />)

    const action = screen.getByRole('button', { name: 'Toggle Light' })
    expect(action).not.toHaveAttribute('data-modal-opener')
    expect(action.querySelector('[data-modal-disclosure]')).not.toBeInTheDocument()
  })

  it('supports state-dependent Card disclosure', () => {
    const { rerender } = render(
      <Card disclosure icon={<MaterialIcon name="mdi:airplane" />} onClick={() => undefined} subtitle="Off" title="Vacation Mode" />,
    )

    expect(screen.getByRole('button', { name: 'Vacation Mode' })).toHaveAttribute('data-modal-opener', 'true')
    rerender(<Card icon={<MaterialIcon name="mdi:airplane" />} onClick={() => undefined} subtitle="On" title="Vacation Mode" />)
    expect(screen.getByRole('button', { name: 'Vacation Mode' })).not.toHaveAttribute('data-modal-opener')
  })

  it('preserves row labels, behavior, and disabled state', () => {
    const onClick = vi.fn()
    const { rerender } = render(<ModalOpenerRow onClick={onClick} subtitle="70 F - Inactive" title="Living Room" />)

    const opener = screen.getByRole('button', { name: 'Living Room 70 F - Inactive' })
    fireEvent.click(opener)
    expect(onClick).toHaveBeenCalledOnce()
    expect(opener.querySelector('[data-modal-disclosure="right-chevron"]')).toBeInTheDocument()

    rerender(<ModalOpenerRow disabled onClick={onClick} subtitle="Unavailable" title="Living Room" />)
    expect(screen.getByRole('button', { name: 'Living Room Unavailable' })).toBeDisabled()
  })

  it('keeps sheet pickers mounted for the shared close animation', async () => {
    render(<PickerHarness />)

    const dialog = screen.getByRole('dialog', { name: 'Mode' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))

    await waitFor(() => expect(dialog).toHaveAttribute('data-state', 'closed'))
    expect(dialog).toHaveAttribute('data-closing', 'true')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Mode' })).not.toBeInTheDocument())
  })
})
