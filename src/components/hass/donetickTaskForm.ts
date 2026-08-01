export interface DonetickAssigneeOption {
  label: string
  value: string
}

export interface DonetickTaskEditTarget {
  itemUid: string
  taskId: number
  todoEntityId: string
}

export interface DonetickTaskFormRecord {
  assignees: number[]
  assigned_to: number | null
  description: string
  frequency: number
  frequency_metadata: Record<string, unknown>
  frequency_type: string
  hide_on_vacation: boolean
  id: number
  name: string
  next_due_date: string | null
  priority: number
}

export interface DonetickTaskFormState {
  assignee: string
  description: string
  dueDate: string
  dueTime: string
  hideOnVacation: boolean
  name: string
  priority: string
  recurrence: string
  recurrenceDays: string[]
  recurrenceInterval: string
  recurrenceUnit: string
}

interface TaskFormServiceDataOptions {
  configEntryId?: string
  initialForm?: DonetickTaskFormState
  taskId?: number
}

const PRIORITY_VALUES = ['none', 'low', 'medium', 'high', 'critical'] as const
const RECURRENCE_VALUES = ['no_repeat', 'daily', 'weekly', 'monthly', 'yearly', 'interval', 'days_of_the_week', 'adaptive'] as const
const RECURRENCE_UNITS = ['days', 'weeks', 'months', 'years'] as const
const RECURRENCE_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object')
}

function numberValue(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : undefined
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function numberArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const number = numberValue(item)
    return number === undefined ? [] : [number]
  })
}

function serviceResponse(result: unknown) {
  if (!isRecord(result)) return result
  return result.response ?? result.service_response ?? result
}

function recurrenceValue(value: string | undefined) {
  const normalized = value === 'once' ? 'no_repeat' : value
  return RECURRENCE_VALUES.includes(normalized as (typeof RECURRENCE_VALUES)[number]) ? normalized as string : 'no_repeat'
}

function recurrenceUnit(value: unknown) {
  return RECURRENCE_UNITS.includes(value as (typeof RECURRENCE_UNITS)[number]) ? value as string : 'days'
}

function recurrenceDays(value: unknown) {
  return stringArray(value).filter((day) => RECURRENCE_DAYS.includes(day as (typeof RECURRENCE_DAYS)[number]))
}

function localDateTimeParts(value: string | null, timeZone?: string) {
  if (!value) return { dueDate: '', dueTime: '' }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { dueDate: '', dueTime: '' }

  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(date)
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  const year = read('year')
  const month = read('month')
  const day = read('day')
  const hour = read('hour')
  const minute = read('minute')
  return {
    dueDate: year && month && day ? `${year}-${month}-${day}` : '',
    dueTime: hour && minute ? `${hour}:${minute}` : '',
  }
}

export function initialDonetickTaskFormState(defaultAssignee = ''): DonetickTaskFormState {
  return {
    assignee: defaultAssignee,
    description: '',
    dueDate: '',
    dueTime: '',
    hideOnVacation: true,
    name: '',
    priority: 'critical',
    recurrence: 'no_repeat',
    recurrenceDays: [],
    recurrenceInterval: '1',
    recurrenceUnit: 'days',
  }
}

export function donetickTaskIdFromUid(uid: string | undefined) {
  if (!uid) return null
  const taskId = Number.parseInt(uid.split('--', 1)[0], 10)
  return Number.isFinite(taskId) && taskId > 0 ? taskId : null
}

export function donetickTaskFromServiceResult(result: unknown): DonetickTaskFormRecord {
  const response = serviceResponse(result)
  if (!isRecord(response)) throw new Error('DoneTick returned an invalid task response')

  const id = numberValue(response.id)
  const name = stringValue(response.name)
  if (!id || !name) throw new Error('DoneTick returned an incomplete task response')

  return {
    assignees: numberArray(response.assignees),
    assigned_to: numberValue(response.assigned_to) ?? null,
    description: stringValue(response.description) ?? '',
    frequency: Math.max(1, numberValue(response.frequency) ?? 1),
    frequency_metadata: isRecord(response.frequency_metadata) ? response.frequency_metadata : {},
    frequency_type: stringValue(response.frequency_type) ?? 'once',
    hide_on_vacation: booleanValue(response.hide_on_vacation, true),
    id,
    name,
    next_due_date: stringValue(response.next_due_date) ?? null,
    priority: Math.max(0, Math.min(4, numberValue(response.priority) ?? 0)),
  }
}

export function donetickTaskFormState(task: DonetickTaskFormRecord, timeZone?: string): DonetickTaskFormState {
  const due = localDateTimeParts(task.next_due_date, timeZone)
  const metadata = task.frequency_metadata
  const selectedAssignee = task.assigned_to ?? task.assignees[0]
  const priority = PRIORITY_VALUES[task.priority] ?? 'none'

  return {
    assignee: selectedAssignee ? String(selectedAssignee) : '',
    description: task.description,
    dueDate: due.dueDate,
    dueTime: due.dueTime,
    hideOnVacation: task.hide_on_vacation,
    name: task.name,
    priority,
    recurrence: recurrenceValue(task.frequency_type),
    recurrenceDays: recurrenceDays(metadata.days),
    recurrenceInterval: String(task.frequency),
    recurrenceUnit: recurrenceUnit(metadata.unit),
  }
}

export function normalizeDonetickTime(value: string) {
  if (!value) return ''
  return value.length === 5 ? `${value}:00` : value
}

export function donetickSourceDueValue(dueDate: string, dueTime: string) {
  const normalizedDueTime = normalizeDonetickTime(dueTime)
  if (dueDate) return `${dueDate}T${normalizedDueTime || '12:00:00'}`
  return normalizedDueTime
}

export function donetickRepeatEveryValue(value: string) {
  const amount = Number.parseInt(value, 10)
  if (!Number.isFinite(amount) || amount < 1) return '1'
  return String(Math.min(amount, 365))
}

export function donetickTaskFormServiceData(form: DonetickTaskFormState, options: TaskFormServiceDataOptions = {}) {
  const showCustomInterval = form.recurrence === 'interval'
  const showRecurrenceDays = form.recurrence === 'days_of_the_week'
  const serviceData: Record<string, unknown> = {
    description: form.description,
    due_date: donetickSourceDueValue(form.dueDate, form.dueTime),
    hide_on_vacation: form.hideOnVacation,
    name: form.name.trim(),
    priority: form.priority || 'none',
    recurrence: form.recurrence || 'no_repeat',
    recurrence_days: showRecurrenceDays ? form.recurrenceDays : [],
    recurrence_interval: showCustomInterval ? Number(form.recurrenceInterval) || 1 : 1,
    recurrence_unit: showCustomInterval ? form.recurrenceUnit || 'days' : 'days',
  }

  if (!options.initialForm || form.assignee !== options.initialForm.assignee) {
    serviceData.assignees = form.assignee || ''
  }
  if (options.taskId !== undefined) serviceData.task_id = options.taskId
  if (options.configEntryId) serviceData.config_entry_id = options.configEntryId
  return serviceData
}
