import { CheckboxRow } from '../core/CheckboxRow'
import { ModalActionFooter } from '../core/ModalActionFooter'
import { NativePickerField } from '../core/NativePickerField'
import { DashboardPageLoading } from '../shell/DashboardPageLoading'
import type { DonetickTaskFormController } from './useDonetickTaskForm'
import styles from './CreateDonetickTaskSheet.module.css'

const PRIORITY_OPTIONS = [
  { label: 'None', value: 'none' },
  { label: 'P1', value: 'low' },
  { label: 'P2', value: 'medium' },
  { label: 'P3', value: 'high' },
  { label: 'P4', value: 'critical' },
] as const

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

const TASK_FORM_ID = 'create-donetick-task-form'

export function DonetickTaskFormFooter({ controller }: { controller: DonetickTaskFormController }) {
  const { busy, deleting, editMode, handleDelete, loading, submitting, task, taskName } = controller

  if (!editMode) {
    return (
      <ModalActionFooter primary={{ disabled: !taskName || busy || loading, form: TASK_FORM_ID, icon: 'mdi:checkbox-marked-circle', label: submitting ? 'Creating...' : 'Create Task', type: 'submit' }} />
    )
  }

  return (
    <ModalActionFooter
      destructive={{ disabled: busy || loading || !task, icon: 'mdi:delete', label: deleting ? 'Deleting...' : 'Delete Task', onClick: handleDelete }}
      primary={{ disabled: !taskName || busy || loading || !task, form: TASK_FORM_ID, icon: 'mdi:content-save', label: submitting ? 'Saving...' : 'Save Task', type: 'submit' }}
    />
  )
}

export function DonetickTaskFormBody({ controller }: { controller: DonetickTaskFormController }) {
  const {
    availableAssignees,
    busy,
    error,
    form,
    handleSubmit,
    loading,
    normalizeRepeatEvery,
    recurrenceOptions,
    showCustomInterval,
    showRecurrenceDays,
    updateField,
    updateRecurrence,
    updateRepeatEvery,
  } = controller

  if (loading) return <DashboardPageLoading className={styles.loading} label="Loading task" phase="loading" />

  return (
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
  )
}
