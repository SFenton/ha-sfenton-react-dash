import { useState, type FormEvent } from 'react'
import { useHass } from '@hakit/core'
import { MaterialIcon } from '../core/Icon'
import { ModalSheet } from '../core/ModalSheet'
import styles from './CreateDonetickTaskSheet.module.css'

type CallService = (params: Record<string, unknown>) => Promise<unknown> | void

interface CreateDonetickTaskSheetProps {
  defaultAssignee?: string
  open: boolean
  onClose: () => void
}

const ASSIGNEE_OPTIONS = [
  { label: 'Anyone', value: '' },
  { label: 'Stephen', value: '1' },
  { label: 'Steph', value: '2' },
  { label: 'Home Improvement', value: '3' },
] as const

const PRIORITY_OPTIONS = [
  { label: 'P1', value: 'low' },
  { label: 'P2', value: 'medium' },
  { label: 'P3', value: 'high' },
  { label: 'P4', value: 'critical' },
] as const

const RECURRENCE_OPTIONS = [
  { label: 'No Recurrence', value: 'no_repeat' },
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
  { label: 'Custom Interval', value: 'interval' },
  { label: 'Specific Days of Week', value: 'days_of_the_week' },
] as const

const CREATE_TASK_FORM_ID = 'create-donetick-task-form'

const RECURRENCE_UNIT_OPTIONS = [
  { label: 'Days', value: 'days' },
  { label: 'Weeks', value: 'weeks' },
  { label: 'Months', value: 'months' },
  { label: 'Years', value: 'years' },
] as const

const RECURRENCE_DAY_OPTIONS = [
  { label: 'Monday', value: 'monday' },
  { label: 'Tuesday', value: 'tuesday' },
  { label: 'Wednesday', value: 'wednesday' },
  { label: 'Thursday', value: 'thursday' },
  { label: 'Friday', value: 'friday' },
  { label: 'Saturday', value: 'saturday' },
  { label: 'Sunday', value: 'sunday' },
] as const

type FormState = ReturnType<typeof initialFormState>

function initialFormState(defaultAssignee = '') {
  return {
    assignee: defaultAssignee,
    description: '',
    dueDate: '',
    dueTime: '',
    name: '',
    priority: 'critical',
    recurrence: 'no_repeat',
    recurrenceDays: [] as string[],
    recurrenceInterval: '1',
    recurrenceUnit: 'days',
  }
}

function normalizeTime(value: string) {
  if (!value) return ''
  return value.length === 5 ? `${value}:00` : value
}

function sourceDueValue(dueDate: string, dueTime: string) {
  const normalizedDueTime = normalizeTime(dueTime)
  if (dueDate) return `${dueDate}T${normalizedDueTime || '12:00:00'}`
  return normalizedDueTime
}

function formatDueDate(value: string) {
  if (!value) return ''
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(year, month - 1, day))
}

function formatDueTime(value: string) {
  if (!value) return ''
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date)
}

function repeatEveryValue(value: string) {
  const amount = Number.parseInt(value, 10)
  if (!Number.isFinite(amount) || amount < 1) return '1'
  return String(Math.min(amount, 365))
}

export function CreateDonetickTaskSheet({ defaultAssignee = '', open, onClose }: CreateDonetickTaskSheetProps) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const [form, setForm] = useState(() => initialFormState(defaultAssignee))
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const taskName = form.name.trim()
  const showCustomInterval = form.recurrence === 'interval'
  const showRecurrenceDays = form.recurrence === 'days_of_the_week'

  const updateField = (field: keyof FormState, value: string | string[]) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const updateRecurrence = (recurrence: string) => {
    setForm((current) => ({
      ...current,
      recurrence,
      recurrenceDays: recurrence === 'days_of_the_week' ? current.recurrenceDays : [],
    }))
  }

  const updateRepeatEvery = (value: string) => {
    updateField('recurrenceInterval', value.replace(/\D/g, ''))
  }

  const normalizeRepeatEvery = () => {
    setForm((current) => ({ ...current, recurrenceInterval: repeatEveryValue(current.recurrenceInterval) }))
  }

  const handleClose = () => {
    if (submitting) return
    setForm(initialFormState(defaultAssignee))
    setError(null)
    onClose()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!taskName || submitting) return

    setSubmitting(true)
    setError(null)
    void Promise.resolve(
      callService({
        domain: 'donetick',
        service: 'create_task_form',
        serviceData: {
          assignees: form.assignee || '',
          description: form.description,
          due_date: sourceDueValue(form.dueDate, form.dueTime),
          name: taskName,
          priority: form.priority || 'none',
          recurrence: form.recurrence || 'no_repeat',
          recurrence_days: showRecurrenceDays ? form.recurrenceDays : [],
          recurrence_interval: showCustomInterval ? Number(form.recurrenceInterval) || 1 : 1,
          recurrence_unit: showCustomInterval ? form.recurrenceUnit || 'days' : 'days',
        },
      }),
    )
      .then(() => {
        handleClose()
      })
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Unable to create task')
      })
      .finally(() => setSubmitting(false))
  }

  return (
    <ModalSheet
      footer={(
        <button className={styles.primaryAction} disabled={!taskName || submitting} form={CREATE_TASK_FORM_ID} type="submit">
          <MaterialIcon name="mdi:checkbox-marked-circle" size={20} />
          <span>{submitting ? 'Creating...' : 'Create Task'}</span>
        </button>
      )}
      onClose={handleClose}
      open={open}
      title="Create Task"
    >
      <form className={styles.form} id={CREATE_TASK_FORM_ID} onSubmit={handleSubmit}>
        {error && <p className={styles.error}>{error}</p>}
        <label className={styles.field}>
          <span>Task Name</span>
          <input autoComplete="off" name="name" onChange={(event) => updateField('name', event.target.value)} required type="text" value={form.name} />
        </label>
        <label className={styles.field}>
          <span>Assignee</span>
          <select name="assignee" onChange={(event) => updateField('assignee', event.target.value)} value={form.assignee}>
            {ASSIGNEE_OPTIONS.map((option) => <option key={option.value || 'anyone'} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          <span>Description</span>
          <textarea name="description" onChange={(event) => updateField('description', event.target.value)} rows={4} value={form.description} />
        </label>
        <div className={styles.twoColumn}>
          <label className={styles.field}>
            <span>Due Date</span>
            <span className={styles.pickerShell} data-empty={form.dueDate ? 'false' : 'true'}>
              <span className={styles.pickerValue} aria-hidden="true">{formatDueDate(form.dueDate)}</span>
              <input aria-label="Due Date" className={styles.nativePickerInput} name="due_date" onChange={(event) => updateField('dueDate', event.target.value)} type="date" value={form.dueDate} />
            </span>
          </label>
          <label className={styles.field}>
            <span>Due Time</span>
            <span className={styles.pickerShell} data-empty={form.dueTime ? 'false' : 'true'}>
              <span className={styles.pickerValue} aria-hidden="true">{formatDueTime(form.dueTime)}</span>
              <input aria-label="Due Time" className={styles.nativePickerInput} name="due_time" onChange={(event) => updateField('dueTime', event.target.value)} type="time" value={form.dueTime} />
            </span>
          </label>
        </div>
        <label className={styles.field}>
          <span>Priority</span>
          <select name="priority" onChange={(event) => updateField('priority', event.target.value)} required value={form.priority}>
            {PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          <span>Recurrence</span>
          <select name="recurrence" onChange={(event) => updateRecurrence(event.target.value)} required value={form.recurrence}>
            {RECURRENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        {showCustomInterval && (
          <div className={styles.twoColumn}>
            <div className={styles.field}>
              <label htmlFor="create-task-recurrence-interval">Repeat Every</label>
              <input aria-describedby="recurrence-interval-description" id="create-task-recurrence-interval" inputMode="numeric" name="recurrence_interval" onBlur={normalizeRepeatEvery} onChange={(event) => updateRepeatEvery(event.target.value)} pattern="[0-9]*" type="text" value={form.recurrenceInterval} />
              <small id="recurrence-interval-description">For Custom Interval - how often to repeat</small>
            </div>
            <div className={styles.field}>
              <label htmlFor="create-task-recurrence-unit">Interval Unit</label>
              <select aria-describedby="recurrence-unit-description" id="create-task-recurrence-unit" name="recurrence_unit" onChange={(event) => updateField('recurrenceUnit', event.target.value)} value={form.recurrenceUnit}>
                {RECURRENCE_UNIT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <small id="recurrence-unit-description">For Custom Interval - days, weeks, months, or years</small>
            </div>
          </div>
        )}
        {showRecurrenceDays && (
          <div className={styles.field}>
            <label htmlFor="create-task-recurrence-days">Days of Week</label>
            <select
              aria-describedby="recurrence-days-description"
              id="create-task-recurrence-days"
              multiple
              name="recurrence_days"
              onChange={(event) => updateField('recurrenceDays', Array.from(event.target.selectedOptions, (option) => option.value))}
              value={form.recurrenceDays}
            >
              {RECURRENCE_DAY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <small id="recurrence-days-description">For Specific Days of Week - select which days</small>
          </div>
        )}
      </form>
    </ModalSheet>
  )
}