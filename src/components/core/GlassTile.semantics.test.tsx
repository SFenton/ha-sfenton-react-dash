import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GlassTile } from './GlassTile'

describe('GlassTile semantics', () => {
  it('derives disclosure attributes only from modal or navigation semantics', () => {
    const { rerender } = render(
      <GlassTile icon="mdi:shield-home" onClick={vi.fn()} semantics={{ kind: 'navigate' }} title="Navigate" />,
    )

    const navigation = screen.getByRole('button', { name: 'Navigate' })
    expect(navigation).toHaveAttribute('data-navigation-opener', 'true')
    expect(navigation.querySelector('[data-modal-disclosure="right-chevron"]')).toBeInTheDocument()

    rerender(<GlassTile disclosure icon="mdi:flash" onClick={vi.fn()} semantics={{ kind: 'command' }} title="Run" />)

    const command = screen.getByRole('button', { name: 'Run' })
    expect(command).toHaveAttribute('data-action-kind', 'command')
    expect(command).not.toHaveAttribute('data-modal-opener')
    expect(command).not.toHaveAttribute('data-navigation-opener')
    expect(command.querySelector('[data-modal-disclosure]')).not.toBeInTheDocument()
  })

  it('uses switch semantics without exposing pressed-button state', () => {
    render(
      <GlassTile icon="mdi:toggle-switch" onClick={vi.fn()} semantics={{ kind: 'toggle', checked: true }} title="Toggle" />,
    )

    const toggle = screen.getByRole('switch', { name: 'Toggle' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(toggle).not.toHaveAttribute('aria-pressed')
  })
})
