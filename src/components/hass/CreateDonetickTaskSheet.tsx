import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useHass } from '@hakit/core'
import { CheckboxRow } from '../core/CheckboxRow'
import { MaterialIcon } from '../core/Icon'
import { ModalSheet } from '../core/ModalSheet'
import { NativePickerField } from '../core/NativePickerField'
import { DashboardPageLoading } from '../shell/DashboardPageLoading'
import {
  donetickRepeatEveryValue,
  donetickTaskFormServiceData,
  donetickTaskFormState,
  donetickTaskFromServiceResult,
  initialDonetickTaskFormState,
  type DonetickAssigneeOption,
  type DonetickTaskEditTarget,
  type DonetickTaskFormRecord,
  type DonetickTaskFormState,
} from './donetickTaskForm'
import styles from './CreateDonetickTaskSheet.module.css'

type CallService = (params: Record<string, unknown>) => Promise<unknown> | unknown

interface CreateDonetickTaskSheetProps {
  assigneeOptions?: readonly DonetickAssigneeOption[]
  defaultAssignee?: string
  editTarget?: DonetickTaskEditTarget
  open: boolean
  onClose: () => void
  onDeleted?: () => void
  onSaved?: () => void
}

const DEFAULT_ASSIGNEE_OPTIONS = [
  { label: 'Anyone', value: '' },
  { label: 'Stephen', value: '1' },
  { label: 'Steph', value: '2' },
  { label: 'Home Improvement', value: '3' },
] as const

const PRIORITY_OPTIONS = [
  { label: 'None', value: 'none' },
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

const EDIT_RECURRENCE_OPTIONS = [
  ...RECURRENCE_OPTIONS,
  { label: 'Adaptive', value: 'adaptive' },
] as const

const TASK_FORM_ID = 'create-donetick-task-form'

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

export function CreateDonetickTaskSheet({
  assigneeOptions,
  defaultAssignee = '',
  editTarget,
  open,
  onClose,
  onDeleted,
  onSaved,
}: CreateDonetickTaskSheetProps) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const timeZone = useHass((state) => (state.config as { time_zone?: string }).time_zone)
  const [form, setForm] = useState(() => initialDonetickTaskFormState(defaultAssignee))
  const [initialForm, setInitialForm] = useState(() => initialDonetickTaskFormState(defaultAssignee))
  const [task, setTask] = useState<DonetickTaskFormRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(open && editTarget))
  const [deleting, setDeleting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const requestIdRef = useRef(0)
  const formSessionKey = `${String(open)}\u001f${defaultAssignee}\u001f${editTarget?.todoEntityId ?? ''}\u001f${editTarget?.taskId ?? ''}`
  const [appliedFormSessionKey, setAppliedFormSessionKey] = useState(formSessionKey)
  const editMode = Boolean(editTarget)
  const busy = deleting || submitting
  const taskName = form.name.trim()
  const showCustomInterval = form.recurrence === 'interval'
  const showRecurrenceDays = form.recurrence === 'days_of_the_week'
  const recurrenceOptions = editMode ? EDIT_RECURRENCE_OPTIONS : RECURRENCE_OPTIONS
  const availableAssignees = useMemo(() => {
    const configured = assigneeOptions?.length
      ? [{ label: 'Anyone', value: '' }, ...assigneeOptions.filter((option) => option.value)]
      : [...DEFAULT_ASSIGNEE_OPTIONS]
    if (!form.assignee || configured.some((option) => option.value === form.assignee)) return configured
    return [...configured, { label: `User ${form.assignee}`, value: form.assignee }]
  }, [assigneeOptions, form.assignee])

  if (appliedFormSessionKey !== formSessionKey) {
    const nextForm = initialDonetickTaskFormState(editTarget ? '' : defaultAssignee)
    setAppliedFormSessionKey(formSessionKey)
    setForm(nextForm)
    setInitialForm(nextForm)
    setTask(null)
    setError(null)
    setLoading(Boolean(open && editTarget))
    setDeleting(false)
    setSubmitting(false)
  }

  useEffect(() => {
    if (!open || !editTarget) return undefined

    const requestId = ++requestIdRef.current
    void Promise.resolve(
      callService({
        domain: 'donetick',
        returnResponse: true,
        service: 'get_task',
        serviceData: {
          config_entry_id: editTarget.todoEntityId,
          task_id: editTarget.taskId,
        },
      }),
    )
      .then((result) => {
        if (requestIdRef.current !== requestId) return
        const loadedTask = donetickTaskFromServiceResult(result)
        const nextForm = donetickTaskFormState(loadedTask, timeZone)
        setTask(loadedTask)
        setForm(nextForm)
        setInitialForm(nextForm)
      })
      .catch((caughtError: unknown) => {
        if (requestIdRef.current !== requestId) return
        setError(caughtError instanceof Error ? caughtError.message : 'Unable to load task')
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setLoading(false)
      })

    return () => {
      if (requestIdRef.current === requestId) requestIdRef.current += 1
    }
  }, [callService, defaultAssignee, editTarget, open, timeZone])

  const updateField = (field: keyof DonetickTaskFormState, value: DonetickTaskFormState[keyof DonetickTaskFormState]) => {
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
    setForm((current) => ({ ...current, recurrenceInterval: donetickRepeatEveryValue(current.recurrenceInterval) }))
  }

  const handleClose = () => {
    if (busy) return
    onClose()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!taskName || busy || loading || (editMode && !task)) return

    setSubmitting(true)
    setError(null)
    void Promise.resolve(
      callService({
        domain: 'donetick',
        service: editMode ? 'update_task_form' : 'create_task_form',
        serviceData: donetickTaskFormServiceData(form, editTarget ? {
          configEntryId: editTarget.todoEntityId,
          initialForm,
          taskId: editTarget.taskId,
        } : undefined),
      }),
    )
      .then(() => {
        onSaved?.()
        onClose()
      })
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : editMode ? 'Unable to save task' : 'Unable to create task')
      })
      .finally(() => setSubmitting(false))
  }

  const handleDelete = () => {
    if (!editTarget || !task || busy || loading) return
    if (!window.confirm(`Delete ${task.name}?`)) return

    setDeleting(true)
    setError(null)
    void Promise.resolve(
      callService({
        domain: 'todo',
        service: 'remove_item',
        serviceData: { item: editTarget.itemUid },
        target: editTarget.todoEntityId,
      }),
    )
      .then(() => {
        onDeleted?.()
        onClose()
      })
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Unable to delete task')
      })
      .finally(() => setDeleting(false))
  }

  const footer = editMode ? (
    <div className={styles.sheetFooter}>
      <button className={styles.deleteAction} disabled={busy || loading || !task} onClick={handleDelete} type="button">
        <MaterialIcon name="mdi:delete" size={20} />
        <span>{deleting ? 'Deleting...' : 'Delete Task'}</span>
      </button>
      <button className={styles.primaryAction} disabled={!taskName || busy || loading || !task} form={TASK_FORM_ID} type="submit">
        <MaterialIcon name="mdi:content-save" size={20} />
        <span>{submitting ? 'Saving...' : 'Save Task'}</span>
      </button>
    </div>
  ) : (
    <button className={styles.primaryAction} disabled={!taskName || busy || loading} form={TASK_FORM_ID} type="submit">
      <MaterialIcon name="mdi:checkbox-marked-circle" size={20} />
      <span>{submitting ? 'Creating...' : 'Create Task'}</span>
    </button>
  )

  return (
    <ModalSheet
      footer={footer}
      onClose={handleClose}
      open={open}
      title={editMode ? 'Edit Task' : 'Create Task'}
    >
      {loading ? (
        <DashboardPageLoading className={styles.loading} label="Loading task" phase="loading" />
      ) : (
      <form aria-busy={busy ? 'true' : undefined} className={styles.form} id={TASK_FORM_ID} onSubmit={handleSubmit}>
        {error && <p className={styles.error}>{error}</p>}
        <label className={styles.field}>
          <span>Task Name</span>
          <input autoComplete="off" name="name" onChange={(event) => updateField('name', event.target.value)} required type="text" value={form.name} />
        </label>
        <label className={styles.field}>
          <span>Assignee</span>
          <select name="assignee" onChange={(event) => updateField('assignee', event.target.value)} value={form.assignee}>
            {availableAssignees.map((option) => <option key={option.value || 'anyone'} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <fieldset className={styles.fieldset}>
          <legend>Hide On Vacation</legend>
          <CheckboxRow
            active={form.hideOnVacation}
            alignWrappedToIconTop
            aria-label="Hide While On Vacation"
            className={styles.hideOnVacationRow}
            onClick={() => updateField('hideOnVacation', !form.hideOnVacation)}
            subtitle="This task will not show up in your chores lists while Vacation Mode is active."
            title="Hide While On Vacation"
          />
        </fieldset>
        <label className={styles.field}>
          <span>Description</span>
          <textarea name="description" onChange={(event) => updateField('description', event.target.value)} rows={4} value={form.description} />
        </label>
        <div className={styles.twoColumn}>
          <NativePickerField label="Due Date" name="due_date" onChange={(value) => updateField('dueDate', value)} type="date" value={form.dueDate} />
          <NativePickerField label="Due Time" name="due_time" onChange={(value) => updateField('dueTime', value)} type="time" value={form.dueTime} />
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
            {recurrenceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
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
      )}
    </ModalSheet>
  )
}