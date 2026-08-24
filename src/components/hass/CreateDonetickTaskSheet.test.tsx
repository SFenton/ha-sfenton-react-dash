import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockCallServiceCalls, mockDonetickTasksById, resetMockHass } from '../../test/mocks/hakitCoreState'
import { CreateDonetickTaskSheet } from './CreateDonetickTaskSheet'

const HIDE_TITLE = 'Hide While On Vacation'
const HIDE_SUBTITLE = 'This task will not show up in your chores lists while Vacation Mode is active.'

function renderSheet(defaultAssignee = '') {
  return render(<CreateDonetickTaskSheet defaultAssignee={defaultAssignee} onClose={vi.fn()} open />)
}

const EDIT_TARGET = {
  itemUid: '240--2026-08-03 16:30:00+00:00',
  taskId: 240,
  todoEntityId: 'todo.stephen_s_upcoming',
}

function renderEditSheet(onClose = vi.fn(), onDeleted = vi.fn(), onSaved = vi.fn(), onBusyChange = vi.fn()) {
  mockDonetickTasksById[240] = {
    assignees: [2],
    assigned_to: 2,
    description: 'Use the tall ladder',
    frequency: 2,
    frequency_metadata: { unit: 'weeks' },
    frequency_type: 'interval',
    hide_on_vacation: false,
    id: 240,
    name: 'Clean the gutters',
    next_due_date: '2026-08-03T16:30:00+00:00',
    priority: 3,
  }
  return {
    onClose,
    onBusyChange,
    onDeleted,
    onSaved,
    view: render(<CreateDonetickTaskSheet editTarget={EDIT_TARGET} onBusyChange={onBusyChange} onClose={onClose} onDeleted={onDeleted} onSaved={onSaved} open />),
  }
}

describe('CreateDonetickTaskSheet Hide On Vacation metadata', () => {
  beforeEach(() => resetMockHass())

  it('defaults checked with the exact fieldset heading, title, and subtitle', () => {
    renderSheet()

    expect(screen.getByRole('dialog', { name: 'Create Task' }).style.getPropertyValue('--modal-desktop-height')).toBe('')
    expect(screen.getByText('Hide On Vacation', { selector: 'legend' })).toBeInTheDocument()
    expect(screen.getByText(HIDE_TITLE, { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText(HIDE_SUBTITLE, { selector: 'small' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: HIDE_TITLE })).toHaveAttribute('aria-pressed', 'true')
  })

  it('toggles the checkbox to false', () => {
    renderSheet()

    const checkbox = screen.getByRole('button', { name: HIDE_TITLE })
    fireEvent.click(checkbox)

    expect(checkbox).toHaveAttribute('aria-pressed', 'false')
  })

  it('resets checked on close, reopen, and default-assignee changes', () => {
    const onClose = vi.fn()
    const view = render(<CreateDonetickTaskSheet defaultAssignee="1" onClose={onClose} open />)
    const checkbox = screen.getByRole('button', { name: HIDE_TITLE })

    fireEvent.click(checkbox)
    expect(checkbox).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    view.rerender(<CreateDonetickTaskSheet defaultAssignee="1" onClose={onClose} open={false} />)
    view.rerender(<CreateDonetickTaskSheet defaultAssignee="1" onClose={onClose} open />)
    expect(screen.getByRole('button', { name: HIDE_TITLE })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: HIDE_TITLE }))
    view.rerender(<CreateDonetickTaskSheet defaultAssignee="2" onClose={onClose} open />)
    expect(screen.getByRole('button', { name: HIDE_TITLE })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Assignee')).toHaveValue('2')
  })

  it.each([
    ['true', true, false],
    ['false', false, true],
  ])('submits hide_on_vacation %s', async (_label, expected, toggle) => {
    renderSheet()
    fireEvent.change(screen.getByLabelText('Task Name'), { target: { value: 'Metadata task' } })
    if (toggle) fireEvent.click(screen.getByRole('button', { name: HIDE_TITLE }))
    fireEvent.click(screen.getByRole('button', { name: 'Create Task' }))

    await waitFor(() => expect(mockCallServiceCalls).toEqual([
      {
        domain: 'donetick',
        service: 'create_task_form',
        serviceData: {
          assignees: '',
          description: '',
          due_date: '',
          hide_on_vacation: expected,
          name: 'Metadata task',
          priority: 'critical',
          recurrence: 'no_repeat',
          recurrence_days: [],
          recurrence_interval: 1,
          recurrence_unit: 'days',
        },
      },
    ]))
  })
})

describe('CreateDonetickTaskSheet edit mode', () => {
  beforeEach(() => resetMockHass())

  it('loads the full DoneTick task into the shared form', async () => {
    renderEditSheet()

    expect(await screen.findByRole('heading', { name: 'Edit Task' })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Edit Task' })).toHaveStyle({
      '--modal-desktop-height': 'min(940px, calc(var(--dashboard-visible-height, var(--dashboard-viewport-height, 100dvh)) - 64px))',
    })
    await waitFor(() => expect(screen.getByLabelText('Task Name')).toHaveValue('Clean the gutters'))
    expect(screen.getByLabelText('Assignee')).toHaveValue('2')
    expect(screen.getByLabelText('Description')).toHaveValue('Use the tall ladder')
    expect(screen.getByLabelText('Due Date')).toHaveValue('2026-08-03')
    expect(screen.getByLabelText('Priority')).toHaveValue('high')
    expect(screen.getByLabelText('Recurrence')).toHaveValue('interval')
    expect(screen.getByLabelText('Repeat Every')).toHaveValue('2')
    expect(screen.getByLabelText('Interval Unit')).toHaveValue('weeks')
    expect(screen.getByRole('button', { name: HIDE_TITLE })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Delete Task' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Task' })).toBeInTheDocument()
    expect(mockCallServiceCalls[0]).toEqual({
      domain: 'donetick',
      returnResponse: true,
      service: 'get_task',
      serviceData: {
        config_entry_id: 'todo.stephen_s_upcoming',
        task_id: 240,
      },
    })
  })

  it('saves changed assignment, due date, and recurrence through update_task_form', async () => {
    const { onBusyChange, onClose, onSaved } = renderEditSheet()
    await waitFor(() => expect(screen.getByLabelText('Task Name')).toHaveValue('Clean the gutters'))

    fireEvent.change(screen.getByLabelText('Assignee'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Due Date'), { target: { value: '2026-08-10' } })
    fireEvent.change(screen.getByLabelText('Due Time'), { target: { value: '08:45' } })
    fireEvent.change(screen.getByLabelText('Recurrence'), { target: { value: 'days_of_the_week' } })
    const recurrenceDays = screen.getByLabelText('Days of Week') as HTMLSelectElement
    for (const option of recurrenceDays.options) option.selected = option.value === 'monday' || option.value === 'thursday'
    fireEvent.change(recurrenceDays)
    fireEvent.click(screen.getByRole('button', { name: 'Save Task' }))

    await waitFor(() => expect(mockCallServiceCalls.at(-1)).toEqual({
      domain: 'donetick',
      service: 'update_task_form',
      serviceData: {
        assignees: '3',
        config_entry_id: 'todo.stephen_s_upcoming',
        description: 'Use the tall ladder',
        due_date: '2026-08-10T08:45:00',
        hide_on_vacation: false,
        name: 'Clean the gutters',
        priority: 'high',
        recurrence: 'days_of_the_week',
        recurrence_days: ['monday', 'thursday'],
        recurrence_interval: 1,
        recurrence_unit: 'days',
        task_id: 240,
      },
    }))
    expect(onSaved).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onBusyChange.mock.calls).toEqual([[true], [false]])
  })

  it('confirms and deletes through the source todo entity', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { onClose, onDeleted } = renderEditSheet()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete Task' })).toBeEnabled())

    fireEvent.click(screen.getByRole('button', { name: 'Delete Task' }))

    await waitFor(() => expect(mockCallServiceCalls.at(-1)).toEqual({
      domain: 'todo',
      service: 'remove_item',
      serviceData: { item: EDIT_TARGET.itemUid },
      target: EDIT_TARGET.todoEntityId,
    }))
    expect(confirmSpy).toHaveBeenCalledWith('Delete Clean the gutters?')
    expect(onDeleted).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    confirmSpy.mockRestore()
  })
})
