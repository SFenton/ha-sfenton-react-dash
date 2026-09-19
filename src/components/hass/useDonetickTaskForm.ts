import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useHass, useUser } from '@hakit/core'
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
import { COMMON_COPY_NAMESPACE, HOUSEHOLD_COPY_KEYS, copy } from '../../i18n'
import { HOUSEHOLD_RESIDENT, householdResidentForHaUserId, householdResidentName } from '../../constants/householdResidents'

type CallService = (params: Record<string, unknown>) => Promise<unknown> | unknown

interface UseDonetickTaskFormOptions {
  active: boolean
  assigneeOptions?: readonly DonetickAssigneeOption[]
  defaultAssignee?: string
  editTarget?: DonetickTaskEditTarget
  onBusyChange?: (busy: boolean) => void
  onComplete: () => void
  onDeleted?: () => void
  onSaved?: () => void
}

export interface DonetickTaskFormController {
  availableAssignees: readonly DonetickAssigneeOption[]
  busy: boolean
  deleting: boolean
  editMode: boolean
  error: string | null
  form: DonetickTaskFormState
  handleDelete: () => void
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void
  loading: boolean
  normalizeRepeatEvery: () => void
  recurrenceOptions: readonly DonetickAssigneeOption[]
  showCustomInterval: boolean
  showRecurrenceDays: boolean
  submitting: boolean
  task: DonetickTaskFormRecord | null
  taskName: string
  updateField: (field: keyof DonetickTaskFormState, value: DonetickTaskFormState[keyof DonetickTaskFormState]) => void
  updateRecurrence: (recurrence: string) => void
  updateRepeatEvery: (value: string) => void
}

const DEFAULT_HOUSEHOLD_ASSIGNEES = [
  { resident: HOUSEHOLD_RESIDENT.STEPHEN, value: '1' },
  { resident: HOUSEHOLD_RESIDENT.STEPH, value: '2' },
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

export function useDonetickTaskForm({
  active,
  assigneeOptions,
  defaultAssignee = '',
  editTarget,
  onBusyChange,
  onComplete,
  onDeleted,
  onSaved,
}: UseDonetickTaskFormOptions): DonetickTaskFormController {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const timeZone = useHass((state) => (state.config as { time_zone?: string }).time_zone)
  const viewerResident = householdResidentForHaUserId(useUser()?.id)
  const [form, setForm] = useState(() => initialDonetickTaskFormState(defaultAssignee))
  const [initialForm, setInitialForm] = useState(() => initialDonetickTaskFormState(defaultAssignee))
  const [task, setTask] = useState<DonetickTaskFormRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(active && editTarget))
  const [deleting, setDeleting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const requestIdRef = useRef(0)
  const formSessionKey = `${String(active)}\u001f${defaultAssignee}\u001f${editTarget?.todoEntityId ?? ''}\u001f${editTarget?.taskId ?? ''}`
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
      : [
          { label: 'Anyone', value: '' },
          ...DEFAULT_HOUSEHOLD_ASSIGNEES.map(({ resident, value }) => ({
            label: resident === viewerResident
              ? copy(COMMON_COPY_NAMESPACE, HOUSEHOLD_COPY_KEYS.you)
              : householdResidentName(resident),
            value,
          })),
          { label: 'Home Improvement', value: '3' },
        ]
    if (!form.assignee || configured.some((option) => option.value === form.assignee)) return configured
    return [...configured, { label: `User ${form.assignee}`, value: form.assignee }]
  }, [assigneeOptions, form.assignee, viewerResident])

  if (appliedFormSessionKey !== formSessionKey) {
    const nextForm = initialDonetickTaskFormState(editTarget ? '' : defaultAssignee)
    setAppliedFormSessionKey(formSessionKey)
    setForm(nextForm)
    setInitialForm(nextForm)
    setTask(null)
    setError(null)
    setLoading(Boolean(active && editTarget))
    setDeleting(false)
    setSubmitting(false)
  }

  useEffect(() => {
    if (!active || !editTarget) return undefined

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
  }, [active, callService, defaultAssignee, editTarget, timeZone])

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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!taskName || busy || loading || (editMode && !task)) return

    setSubmitting(true)
    onBusyChange?.(true)
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
        onComplete()
      })
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : editMode ? 'Unable to save task' : 'Unable to create task')
      })
      .finally(() => {
        setSubmitting(false)
        onBusyChange?.(false)
      })
  }

  const handleDelete = () => {
    if (!editTarget || !task || busy || loading) return
    if (!window.confirm(`Delete ${task.name}?`)) return

    setDeleting(true)
    onBusyChange?.(true)
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
        onComplete()
      })
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Unable to delete task')
      })
      .finally(() => {
        setDeleting(false)
        onBusyChange?.(false)
      })
  }

  return {
    availableAssignees,
    busy,
    deleting,
    editMode,
    error,
    form,
    handleDelete,
    handleSubmit,
    loading,
    normalizeRepeatEvery,
    recurrenceOptions,
    showCustomInterval,
    showRecurrenceDays,
    submitting,
    task,
    taskName,
    updateField,
    updateRecurrence,
    updateRepeatEvery,
  }
}
