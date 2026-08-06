import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ToggleControl } from './ToggleControl'

describe('ToggleControl', () => {
  it('exposes the reusable 56 by 34 HAKit switch contract', () => {
    const onChange = vi.fn()
    render(<ToggleControl checked label='Monday alarm' onChange={onChange} />)

    const toggle = screen.getByRole('switch', { name: 'Turn off Monday alarm' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(toggle).toHaveStyle({ height: '34px', maxHeight: '34px', maxWidth: '56px', minHeight: '34px', minWidth: '56px', width: '56px' })
    fireEvent.click(toggle)
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it.each(['Enter', ' '])('supports %s keyboard activation', (key) => {
    const onChange = vi.fn()
    render(<ToggleControl checked={false} label='Monday alarm' onChange={onChange} />)

    fireEvent.keyDown(screen.getByRole('switch', { name: 'Turn on Monday alarm' }), { key })

    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('shows focus styling only for non-pointer focus', () => {
    render(<ToggleControl checked label='Monday alarm' onChange={vi.fn()} />)

    const toggle = screen.getByRole('switch', { name: 'Turn off Monday alarm' })
    fireEvent.focus(toggle)
    expect(toggle).toHaveAttribute('data-keyboard-focus', 'true')
    fireEvent.blur(toggle)
    fireEvent.pointerDown(toggle)
    fireEvent.focus(toggle)
    expect(toggle).toHaveAttribute('data-keyboard-focus', 'false')
    fireEvent.blur(toggle)
    fireEvent.focus(toggle)
    expect(toggle).toHaveAttribute('data-keyboard-focus', 'true')
  })

  it('fails closed while disabled', () => {
    const onChange = vi.fn()
    render(<ToggleControl checked={false} disabled label='Monday alarm' onChange={onChange} />)

    const toggle = screen.getByRole('switch', { name: 'Turn on Monday alarm' })
    expect(toggle).toHaveAttribute('data-disabled', 'true')
    expect(toggle).toHaveAttribute('aria-disabled', 'true')
    expect(toggle).toHaveAttribute('tabindex', '-1')
    fireEvent.keyDown(toggle, { key: 'Enter' })
    fireEvent.click(toggle)
    expect(onChange).not.toHaveBeenCalled()
  })
})
