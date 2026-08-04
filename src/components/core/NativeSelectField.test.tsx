import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NativeSelectField } from './NativeSelectField'

describe('NativeSelectField', () => {
  it('shows the selected label and reports native selection changes', () => {
    const onChange = vi.fn()
    render(
      <NativeSelectField
        icon="mdi:fan"
        label="Mode"
        onChange={onChange}
        options={[
          { label: 'Manual', value: 'manual' },
          { label: 'Auto Humidity', value: 'auto' },
          { label: 'Sleep', value: 'sleep' },
        ]}
        value="auto"
      />,
    )

    const select = screen.getByRole('combobox', { name: 'Mode' })
    expect(select).toHaveValue('auto')
    expect(select.closest('[data-native-select-field]')).toHaveAttribute('data-native-select-field', 'true')
    expect(select.closest('[data-native-select-field]')).toHaveAttribute('data-has-icon', 'true')
    expect(select.closest('[data-native-select-field]')?.querySelector('svg')).toBeInTheDocument()
    expect(screen.getAllByText('Auto Humidity')).toHaveLength(2)
    fireEvent.change(select, { target: { value: 'sleep' } })
    expect(onChange).toHaveBeenCalledWith('sleep')
  })

  it('supports compact disabled fields and optional blur after selection', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <NativeSelectField
        blurOnChange
        hideLabel
        label="Cleaning Passes"
        onChange={onChange}
        options={[
          { label: '1x', value: '1' },
          { label: '2x', value: '2' },
        ]}
        selectedLabel="One pass"
        value="1"
      />,
    )

    const select = screen.getByRole('combobox', { name: 'Cleaning Passes' })
    const field = select.closest('[data-native-select-field]')
    expect(field).toHaveAttribute('data-label-hidden', 'true')
    expect(screen.queryByText('Cleaning Passes')).not.toBeInTheDocument()
    expect(screen.getByText('One pass')).toBeInTheDocument()

    select.focus()
    fireEvent.change(select, { target: { value: '2' } })
    expect(select).not.toHaveFocus()
    expect(onChange).toHaveBeenCalledWith('2')

    rerender(
      <NativeSelectField
        disabled
        hideLabel
        label="Cleaning Passes"
        onChange={onChange}
        options={[
          { label: '1x', value: '1' },
          { label: '2x', value: '2' },
        ]}
        value="1"
      />,
    )

    expect(screen.getByRole('combobox', { name: 'Cleaning Passes' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Cleaning Passes' }).closest('[data-native-select-field]')).toHaveAttribute('data-disabled', 'true')
  })
})
