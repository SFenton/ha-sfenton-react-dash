import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { materialIconPath } from './iconPaths'
import { ScheduleCollection, ScheduleDetailFooter, ScheduleListRow } from './ScheduleFlow'
import { ToggleControl } from './ToggleControl'

describe('ScheduleFlow', () => {
  it('renders master state, full-width rows, and the add action', () => {
    const onAdd = vi.fn()
    const onEdit = vi.fn()
    const onToggle = vi.fn()
    render(
      <ScheduleCollection
        addAction={{ focusKey: 'add-alarm', label: 'Add Alarm', onClick: onAdd }}
        control={{
          active: true,
          description: 'Schedules run on Home Assistant.',
          icon: 'mdi:alarm-check',
          label: 'Alarm Schedule Enabled',
          onToggle,
          subtitle: '1 alarm configured',
        }}
        empty={false}
        emptyText="No alarms yet."
        itemsTitle="Alarms"
      >
        <ScheduleListRow
          accessibleLabel="Monday alarm enabled"
          active
          focusKey="monday-alarm"
          onClick={onEdit}
          primary="Monday Alarm"
          secondary="6:30 AM"
          tertiary="Enabled"
        />
      </ScheduleCollection>,
    )

    const master = screen.getByRole('button', { name: /Alarm Schedule Enabled/ })
    expect(master).toHaveStyle({ '--tile-color': 'rgba(0, 150, 136, 0.58)' })
    fireEvent.click(master)
    fireEvent.click(screen.getByRole('button', { name: 'Monday alarm enabled' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Alarm' }))

    expect(onToggle).toHaveBeenCalledOnce()
    expect(onEdit).toHaveBeenCalledOnce()
    expect(onAdd).toHaveBeenCalledOnce()
    const row = screen.getByRole('button', { name: 'Monday alarm enabled' })
    expect(row).toHaveAttribute('data-active', 'true')
    expect(row).toHaveAttribute('data-modal-detail-trigger', 'monday-alarm')
    expect(row.querySelectorAll('[data-dynamic-grid-label="true"]')).toHaveLength(3)
    expect(materialIconPath('mdi:alarm-check')).not.toBe(materialIconPath('mdi:unregistered-schedule-icon'))
  })

  it('renders loading, empty, error, disabled, and read-only states', () => {
    const { rerender } = render(
      <ScheduleCollection
        addAction={{ disabled: true, focusKey: 'add', label: 'Add Schedule', onClick: vi.fn() }}
        empty
        emptyText="No schedules yet."
        error="Could not load schedules."
        itemsTitle="Activities"
        loading
        loadingText="Loading scheduled activities…"
      />,
    )

    expect(screen.getByText('Loading scheduled activities…')).toBeInTheDocument()
    expect(screen.queryByText('No schedules yet.')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load schedules.')
    expect(screen.getByRole('button', { name: 'Add Schedule' })).toBeDisabled()

    rerender(
      <ScheduleCollection
        empty
        emptyText="No schedules yet."
        itemsTitle="Activities"
        readOnlyText="Schedule editing is unavailable."
      />,
    )
    expect(screen.getByText('No schedules yet.')).toBeInTheDocument()
    expect(screen.getByText('Schedule editing is unavailable.')).toBeInTheDocument()
  })

  it('keeps a trailing switch outside the navigation button and isolates pointer and keyboard activation', () => {
    const onEdit = vi.fn()
    const onToggle = vi.fn()
    const { container } = render(
      <ScheduleListRow
        accessibleLabel='Edit Monday alarm'
        focusKey='monday-alarm'
        onClick={onEdit}
        primary='Monday Alarm'
        secondary='Enabled'
        trailingControl={<ToggleControl checked label='Monday alarm' onChange={onToggle} />}
      />,
    )

    const row = screen.getByRole('button', { name: 'Edit Monday alarm' })
    const toggle = screen.getByRole('switch', { name: 'Turn off Monday alarm' })
    const shell = row.closest('[data-schedule-list-row]')
    expect(shell).toContainElement(toggle)
    expect(row).not.toContainElement(toggle)
    expect(container.querySelector('button button')).toBeNull()
    expect(row).toHaveAttribute('data-has-trailing-control', 'true')

    fireEvent.keyDown(toggle, { code: 'Space', key: ' ' })
    expect(onToggle).toHaveBeenCalledOnce()
    expect(onToggle).toHaveBeenCalledWith(false)
    expect(onEdit).not.toHaveBeenCalled()

    fireEvent.click(row)
    expect(onEdit).toHaveBeenCalledOnce()
  })

  it('shares add/save/delete footer actions', () => {
    const onDelete = vi.fn()
    const onSave = vi.fn()
    render(
      <ScheduleDetailFooter
        deleteAction={{ icon: 'mdi:delete', label: 'Delete Alarm', onClick: onDelete }}
        primaryAction={{ icon: 'mdi:content-save', label: 'Save Alarm', onClick: onSave }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete Alarm' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save Alarm' }))
    expect(onDelete).toHaveBeenCalledOnce()
    expect(onSave).toHaveBeenCalledOnce()
  })
})
