import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FieldActionButton } from './FieldActionButton'

describe('FieldActionButton', () => {
  it('exposes the shared primary command treatment', () => {
    const onClick = vi.fn()
    render(<FieldActionButton label="Confirm" onClick={onClick} variant="primary" />)

    const button = screen.getByRole('button', { name: 'Confirm' })
    expect(button).toHaveAttribute('data-action-kind', 'command')
    expect(button).toHaveAttribute('data-variant', 'primary')
    expect(button).toHaveAttribute('type', 'button')

    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
