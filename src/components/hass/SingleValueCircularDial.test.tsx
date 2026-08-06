import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SingleValueCircularDial } from './SingleValueCircularDial'

describe('SingleValueCircularDial', () => {
  it('supports keyboard value changes through the shared handle', () => {
    const onCommit = vi.fn()
    render(
      <SingleValueCircularDial
        actionText="Level"
        ariaLabel="Example level 4"
        color="#00aa88"
        handleAriaLabel="Example level"
        max={9}
        min={0}
        onCommit={onCommit}
        primaryText={String}
        step={1}
        value={4}
      />,
    )

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Example level' }), { key: 'ArrowRight' })
    expect(onCommit).toHaveBeenCalledWith(5)
  })
})
