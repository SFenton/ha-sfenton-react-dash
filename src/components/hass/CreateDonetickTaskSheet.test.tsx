import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockCallServiceCalls, resetMockHass } from '../../test/mocks/hakitCoreState'
import { CreateDonetickTaskSheet } from './CreateDonetickTaskSheet'

const HIDE_TITLE = 'Hide While On Vacation'
const HIDE_SUBTITLE = 'This task will not show up in your chores lists while Vacation Mode is active.'

function renderSheet(defaultAssignee = '') {
  return render(<CreateDonetickTaskSheet defaultAssignee={defaultAssignee} onClose={vi.fn()} open />)
}

describe('CreateDonetickTaskSheet Hide On Vacation metadata', () => {
  beforeEach(() => resetMockHass())

  it('defaults checked with the exact fieldset heading, title, and subtitle', () => {
    renderSheet()

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
