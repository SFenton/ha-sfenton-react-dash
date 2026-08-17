import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SelectActionField } from './SelectActionField'

describe('SelectActionField', () => {
  it('keeps native selection and the adjacent command isolated', () => {
    const onAction = vi.fn()
    const onChange = vi.fn()
    render(
      <SelectActionField
        actionLabel="Set"
        label="Timer"
        onAction={onAction}
        onChange={onChange}
        options={[
          { label: '5 minutes', value: '5' },
          { label: '10 minutes', value: '10' },
        ]}
        value="5"
      />,
    )

    const select = screen.getByRole('combobox', { name: 'Timer' })
    const action = screen.getByRole('button', { name: 'Set' })
    expect(select.closest('[data-select-action-field]')).toHaveAttribute('role', 'group')
    expect(action).toHaveAttribute('data-action-kind', 'command')

    fireEvent.change(select, { target: { value: '10' } })
    fireEvent.click(action)

    expect(onChange).toHaveBeenCalledWith('10')
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('supports a hidden visual label and independently disabled action', () => {
    render(
      <SelectActionField
        actionDisabled
        actionLabel="Set"
        hideLabel
        label="Timer"
        onAction={vi.fn()}
        onChange={vi.fn()}
        options={[{ label: '30 minutes', value: '30' }]}
        value="30"
      />,
    )

    expect(screen.queryByText('Timer')).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Timer' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Set' })).toBeDisabled()
  })
})
