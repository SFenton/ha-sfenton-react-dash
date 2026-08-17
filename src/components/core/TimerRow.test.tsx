import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TimerRow } from './TimerRow'
import { formatTimerRemaining } from './timerFormatting'

describe('TimerRow', () => {
  it('formats sub-hour and hour-plus durations with stable digits', () => {
    expect(formatTimerRemaining(0)).toBe('00:00')
    expect(formatTimerRemaining(65)).toBe('01:05')
    expect(formatTimerRemaining(3599)).toBe('59:59')
    expect(formatTimerRemaining(3600)).toBe('01:00:00')
    expect(formatTimerRemaining(3661)).toBe('01:01:01')
  })

  it('exposes remaining time and a reusable clear command', () => {
    const onClear = vi.fn()
    render(
      <TimerRow
        ariaLabel="Timer 01:05"
        clearLabel="Clear"
        onClear={onClear}
        value="01:05"
      />,
    )

    expect(screen.getByRole('group', { name: 'Timer 01:05' })).toBeInTheDocument()
    expect(screen.queryByText('Time remaining')).not.toBeInTheDocument()
    const clear = screen.getByRole('button', { name: 'Clear' })
    expect(clear).toHaveAttribute('data-tone', 'danger')
    fireEvent.click(clear)
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})
