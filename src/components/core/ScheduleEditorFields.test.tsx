import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ScheduleEditorFields } from './ScheduleEditorFields'
import { resolveScheduleDefaultDays } from './scheduleDays'
import { isValidScheduleTime } from './scheduleTime'

const DAYS = [
  { label: 'Sunday', value: 'sunday' },
  { label: 'Monday', value: 'monday' },
  { label: 'Tuesday', value: 'tuesday' },
] as const

function ScheduleEditorHarness({ onDaysChange }: { onDaysChange: (days: string[]) => void }) {
  const [days, setDays] = useState<string[]>(['tuesday'])
  const [name, setName] = useState('Night')
  const [time, setTime] = useState('07:00')

  return (
    <ScheduleEditorFields
      dayOptions={DAYS}
      days={days}
      nameField={{ label: 'Name', onChange: setName, value: name }}
      onDaysChange={(nextDays) => {
        setDays(nextDays)
        onDaysChange(nextDays)
      }}
      timeFields={[{ label: 'Time', onChange: setTime, value: time }]}
    />
  )
}

describe('ScheduleEditorFields', () => {
  it('defaults schedule creation to Monday through Friday by option value', () => {
    const options = [
      { value: 'sunday' },
      { value: 'monday' },
      { value: 'tuesday' },
      { value: 'wednesday' },
      { value: 'thursday' },
      { value: 'friday' },
      { value: 'saturday' },
    ] as const

    expect(resolveScheduleDefaultDays(options)).toEqual(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
  })

  it('honors explicit consumer day overrides, including an empty selection', () => {
    expect(resolveScheduleDefaultDays(DAYS, ['sunday'])).toEqual(['sunday'])
    expect(resolveScheduleDefaultDays(DAYS, [])).toEqual([])
  })

  it('validates native 24-hour time values', () => {
    expect(isValidScheduleTime('00:00')).toBe(true)
    expect(isValidScheduleTime('23:59')).toBe(true)
    expect(isValidScheduleTime('')).toBe(false)
    expect(isValidScheduleTime('24:00')).toBe(false)
  })

  it('uses ordered day toggles with shared name and native time fields', () => {
    const onDaysChange = vi.fn()
    render(<ScheduleEditorHarness onDaysChange={onDaysChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Monday' }))
    expect(onDaysChange).toHaveBeenLastCalledWith(['monday', 'tuesday'])
    expect(screen.getByRole('button', { name: 'Monday' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Morning' } })
    expect(screen.getByLabelText('Name')).toHaveValue('Morning')

    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '06:45' } })
    expect(screen.getByLabelText('Time')).toHaveValue('06:45')
  })

  it('does not select consumer-disabled days', () => {
    const onDaysChange = vi.fn()
    render(
      <ScheduleEditorFields
        dayOptions={[
          { disabled: true, label: 'Sunday', value: 'sunday' },
          { label: 'Monday', value: 'monday' },
        ]}
        days={[]}
        onDaysChange={onDaysChange}
        timeFields={[{ label: 'Time', onChange: vi.fn(), value: '07:00' }]}
      />,
    )

    const sunday = screen.getByRole('button', { name: 'Sunday' })
    expect(sunday).toBeDisabled()
    fireEvent.click(sunday)
    expect(onDaysChange).not.toHaveBeenCalled()
  })
})
