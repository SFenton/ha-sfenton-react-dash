import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ModalActionButton, ModalActionFooter } from './ModalActionFooter'

describe('ModalActionFooter', () => {
  it('renders destructive and primary actions with independent disabled states', () => {
    const onDelete = vi.fn()
    const onSave = vi.fn()
    render(
      <ModalActionFooter
        destructive={{ icon: 'mdi:delete', label: 'Delete Activity', onClick: onDelete }}
        primary={{ disabled: true, icon: 'mdi:content-save', label: 'Save Activity', onClick: onSave }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete Activity' }))
    expect(onDelete).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Delete Activity' })).toHaveAttribute('data-tone', 'destructive')
    expect(screen.getByRole('button', { name: 'Save Activity' })).toHaveAttribute('data-tone', 'primary')
    expect(screen.getByRole('button', { name: 'Save Activity' })).toBeDisabled()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('reuses the modal action treatment for warning and neutral controls', () => {
    render(
      <>
        <ModalActionButton action={{ icon: 'mdi:pause', label: 'Pause' }} tone="warning" />
        <ModalActionButton action={{ icon: 'mdi:home', label: 'Dock' }} tone="neutral" />
      </>,
    )

    expect(screen.getByRole('button', { name: 'Pause' })).toHaveAttribute('data-modal-action-button', 'true')
    expect(screen.getByRole('button', { name: 'Pause' })).toHaveAttribute('data-tone', 'warning')
    expect(screen.getByRole('button', { name: 'Dock' })).toHaveAttribute('data-tone', 'neutral')
  })
})
