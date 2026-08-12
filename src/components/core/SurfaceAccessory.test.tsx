import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SurfaceAccessory } from './SurfaceAccessory'

describe('SurfaceAccessory', () => {
  it('reserves chevrons for modal and navigation disclosure', () => {
    const { rerender } = render(<SurfaceAccessory semantics={{ kind: 'modal' }} />)
    expect(document.querySelector('[data-modal-disclosure="right-chevron"]')).toBeInTheDocument()

    rerender(<SurfaceAccessory semantics={{ kind: 'command' }} />)
    expect(document.querySelector('[data-modal-disclosure]')).not.toBeInTheDocument()

    rerender(<SurfaceAccessory semantics={{ kind: 'external' }} />)
    expect(document.querySelector('[data-surface-accessory="external"]')).toBeInTheDocument()
    expect(document.querySelector('[data-modal-disclosure]')).not.toBeInTheDocument()
  })

  it('renders a selection marker only for the selected state', () => {
    const { rerender } = render(<SurfaceAccessory semantics={{ kind: 'selection', selected: false }} />)
    expect(screen.queryByText(/./)).not.toBeInTheDocument()
    expect(document.querySelector('[data-surface-accessory="selection"]')).not.toBeInTheDocument()

    rerender(<SurfaceAccessory semantics={{ kind: 'selection', selected: true }} />)
    expect(document.querySelector('[data-surface-accessory="selection"]')).toBeInTheDocument()
  })
})
