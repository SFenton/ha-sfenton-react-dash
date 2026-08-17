import { fireEvent, render, screen } from '@testing-library/react'
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

  it('renders a measured two-control rail as sibling buttons without event bleed', () => {
    const onMain = vi.fn()
    const onLock = vi.fn()
    const onPower = vi.fn()
    render(
      <GlassTile
        controls={[
          {
            ariaLabel: 'Lock',
            disabled: false,
            icon: 'mdi:lock',
            id: 'lock',
            onPress: onLock,
            semantics: { kind: 'toggle', checked: true },
          },
          {
            ariaLabel: 'Power',
            disabled: false,
            icon: 'mdi:power',
            id: 'power',
            onPress: onPower,
            semantics: { kind: 'toggle', checked: false },
          },
        ]}
        icon="mdi:fan"
        onClick={onMain}
        semantics={{ kind: 'modal' }}
        title="Fan"
      />,
    )

    const main = screen.getByRole('button', { name: 'Fan' })
    const lock = screen.getByRole('switch', { name: 'Lock' })
    const power = screen.getByRole('switch', { name: 'Power' })
    const rail = lock.closest('[data-glass-tile-control-rail="true"]')

    expect(main).toHaveAttribute('data-modal-opener', 'true')
    expect(main).toHaveStyle('--tile-controls-width: 96px')
    expect(lock).toHaveAttribute('aria-checked', 'true')
    expect(lock).toHaveAttribute('data-checked', 'true')
    expect(power).toHaveAttribute('aria-checked', 'false')
    expect(rail).toContainElement(lock)
    expect(rail).toContainElement(power)
    expect(main).not.toContainElement(rail)
    expect(main.querySelector('button')).toBeNull()

    fireEvent.click(lock)
    fireEvent.click(power)
    expect(onLock).toHaveBeenCalledTimes(1)
    expect(onPower).toHaveBeenCalledTimes(1)
    expect(onMain).not.toHaveBeenCalled()

    fireEvent.click(main)
    expect(onMain).toHaveBeenCalledTimes(1)
  })

  it('keeps the legacy trailing control outside the main tile button', () => {
    const onMain = vi.fn()
    const onTrailing = vi.fn()
    render(
      <GlassTile
        icon="mdi:fan"
        onClick={onMain}
        title="Legacy"
        trailingControl={<button aria-label="Legacy control" onClick={onTrailing} type="button" />}
      />,
    )

    const main = screen.getByRole('button', { name: 'Legacy' })
    const trailing = screen.getByRole('button', { name: 'Legacy control' })
    expect(main).not.toContainElement(trailing)
    expect(trailing.closest('[data-glass-tile-control-shell="legacy"]')).toBe(main.parentElement)

    fireEvent.click(trailing)
    expect(onTrailing).toHaveBeenCalledTimes(1)
    expect(onMain).not.toHaveBeenCalled()
  })

  it('renders command rail semantics without toggle state', () => {
    const onCommand = vi.fn()
    render(
      <GlassTile
        controls={[{
          ariaLabel: 'Run',
          disabled: false,
          icon: 'mdi:play',
          id: 'run',
          onPress: onCommand,
          semantics: { kind: 'command' },
        }]}
        icon="mdi:fan"
        onClick={vi.fn()}
        title="Commands"
      />,
    )

    const command = screen.getByRole('button', { name: 'Run' })
    expect(command).toHaveAttribute('data-action-kind', 'command')
    expect(command).not.toHaveAttribute('aria-checked')
    fireEvent.click(command)
    expect(onCommand).toHaveBeenCalledTimes(1)
  })
})
