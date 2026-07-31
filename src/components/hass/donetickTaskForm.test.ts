import { describe, expect, it } from 'vitest'
import {
  donetickTaskFormServiceData,
  donetickTaskFormState,
  donetickTaskFromServiceResult,
  donetickTaskIdFromUid,
  initialDonetickTaskFormState,
} from './donetickTaskForm'

describe('DoneTick task form mapping', () => {
  it('parses the stable numeric task ID from a todo UID', () => {
    expect(donetickTaskIdFromUid('240--2026-07-22 04:00:04+00:00')).toBe(240)
    expect(donetickTaskIdFromUid('not-donetick')).toBeNull()
  })

  it('maps the response into local form values', () => {
    const task = donetickTaskFromServiceResult({
      response: {
        assignees: [1, 2],
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
      },
    })

    expect(donetickTaskFormState(task, 'America/Los_Angeles')).toEqual({
      assignee: '2',
      description: 'Use the tall ladder',
      dueDate: '2026-08-03',
      dueTime: '09:30',
      hideOnVacation: false,
      name: 'Clean the gutters',
      priority: 'high',
      recurrence: 'interval',
      recurrenceDays: [],
      recurrenceInterval: '2',
      recurrenceUnit: 'weeks',
    })
  })

  it('omits unchanged assignment while sending every editable value', () => {
    const initial = {
      ...initialDonetickTaskFormState('2'),
      dueDate: '2026-08-03',
      dueTime: '09:30',
      name: 'Clean the gutters',
      recurrence: 'days_of_the_week',
      recurrenceDays: ['monday', 'friday'],
    }

    expect(donetickTaskFormServiceData(initial, {
      configEntryId: 'todo.stephen_s_upcoming',
      initialForm: initial,
      taskId: 240,
    })).toEqual({
      config_entry_id: 'todo.stephen_s_upcoming',
      description: '',
      due_date: '2026-08-03T09:30:00',
      hide_on_vacation: true,
      name: 'Clean the gutters',
      priority: 'critical',
      recurrence: 'days_of_the_week',
      recurrence_days: ['monday', 'friday'],
      recurrence_interval: 1,
      recurrence_unit: 'days',
      task_id: 240,
    })
  })

  it('sends an explicit empty assignment when the user selects Anyone', () => {
    const initial = { ...initialDonetickTaskFormState('2'), name: 'Task' }
    const form = { ...initial, assignee: '' }

    expect(donetickTaskFormServiceData(form, { initialForm: initial, taskId: 9 })).toMatchObject({
      assignees: '',
      task_id: 9,
    })
  })
})
