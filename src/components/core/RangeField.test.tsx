import { fireEvent, render, screen } from '@testing-library/react'
import { RangeField } from './RangeField'

describe('RangeField', () => {
  it('preserves immediate change behavior when no commit callback is configured', () => {
    const onChange = vi.fn()

    render(<RangeField label="Coverage" max={100} min={0} onChange={onChange} step={5} value={50} />)
    fireEvent.change(screen.getByRole('slider', { name: 'Coverage' }), { target: { value: '65' } })

    expect(onChange).toHaveBeenCalledWith(65)
  })

  it('commits the latest drag value once and does not duplicate it on blur', () => {
    const onChange = vi.fn()
    const onCommit = vi.fn()

    render(<RangeField label="Brightness" max={100} min={1} onChange={onChange} onCommit={onCommit} step={1} value={40} />)
    const slider = screen.getByRole('slider', { name: 'Brightness' })
    fireEvent.change(slider, { target: { value: '55' } })
    fireEvent.change(slider, { target: { value: '70' } })

    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onCommit).not.toHaveBeenCalled()

    fireEvent.pointerUp(slider)
    fireEvent.blur(slider)

    expect(onCommit).toHaveBeenCalledOnce()
    expect(onCommit).toHaveBeenCalledWith(70)
  })

  it('commits keyboard changes on key release', () => {
    const onCommit = vi.fn()

    render(<RangeField label="Brightness" max={100} min={1} onChange={() => undefined} onCommit={onCommit} step={1} value={40} />)
    const slider = screen.getByRole('slider', { name: 'Brightness' })
    fireEvent.change(slider, { target: { value: '41' } })
    fireEvent.keyUp(slider, { key: 'ArrowRight' })

    expect(onCommit).toHaveBeenCalledWith(41)
  })

  it('can replace the numeric output and accessible value with an unavailable label', () => {
    render(<RangeField disabled label="Brightness" max={100} min={1} onChange={() => undefined} step={1} value={1} valueText="Unavailable" />)

    expect(screen.getByText('Unavailable')).toBeInTheDocument()
    expect(screen.getByRole('slider', { name: 'Brightness' })).toHaveAttribute('aria-valuetext', 'Unavailable')
  })
})
