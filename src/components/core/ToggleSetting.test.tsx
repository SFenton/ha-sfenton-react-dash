import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ToggleSetting } from './ToggleSetting'

describe('ToggleSetting', () => {
  it('reports the next checked state', () => {
    const onChange = vi.fn()
    render(<ToggleSetting checked icon="mdi:alarm-check" label="Alarm" onChange={onChange} />)

    const toggle = screen.getByRole('switch', { name: 'Turn off Alarm' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(toggle).toHaveStyle({ height: '34px', maxHeight: '34px', maxWidth: '56px', minHeight: '34px', minWidth: '56px', width: '56px' })
    fireEvent.click(toggle)
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('does not change while disabled', () => {
    const onChange = vi.fn()
    render(<ToggleSetting checked={false} disabled icon="mdi:monitor" label="Display" onChange={onChange} />)

    const toggle = screen.getByRole('switch', { name: 'Turn on Display' })
    expect(toggle).toHaveAttribute('data-disabled', 'true')
    fireEvent.click(toggle)
    expect(onChange).not.toHaveBeenCalled()
  })
})
