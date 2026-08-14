import { useEffect, useMemo, useRef, useState } from 'react'
import { useEntity, useHass } from '@hakit/core'
import { CheckboxRow } from '../core/CheckboxRow'
import { MaterialIcon } from '../core/Icon'
import { useTodoOptimisticStatuses, type TodoOptimisticStatuses } from '../../hooks/useTodoOptimisticStatuses'
import { useCopy } from '../../i18n'
import { donetickTaskIdFromUid, type DonetickTaskEditTarget } from './donetickTaskForm'
import { asEntityName } from './entityState'
import styles from './TodoListPanel.module.css'

const TODO_LIST_I18N = { namespace: 'core' } as const

interface TodoItem {
  description?: string
  due?: string
  due_date?: string
  due_datetime?: string
  summary?: string
  status?: string
  uid?: string
}

interface TodoListPanelProps {
  completionScript?: string
  entityId: string
  hideCompleted?: boolean
  onEditTask?: (target: DonetickTaskEditTarget) => void
  onVisibleItemsChange?: (count: number) => void
  optimisticStatuses?: TodoOptimisticStatuses
  reloadVersion?: number
  rowVariant?: 'settings'
  title: string
}

interface HassConnection {
  sendMessagePromise?: <T>(message: Record<string, unknown>) => Promise<T>
}

type CallService = (params: Record<string, unknown>) => Promise<unknown> | void

interface DueInfo {
  label: string
  tone: 'future' | 'overdue-hours' | 'overdue-long'
}

function todoIdentity(item: TodoItem) {
  return item.uid ?? item.summary ?? ''
}

function todoDue(item: TodoItem) {
  return item.due_datetime ?? item.due ?? item.due_date
}

function compactText(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function compactDescription(value: string | undefined) {
  return compactText(value)?.split(/\r?\n/, 1)[0]?.trim() || undefined
}

function batteryMaintenanceLevel(item: TodoItem) {
  const description = compactText(item.description)
  if (!description || !/\bMaintenance reference:\s*BATT-[A-Z0-9]+\b/i.test(description)) return undefined
  const level = description.match(/\bbattery is at\s+(\d+(?:\.\d+)?)%/i)?.[1]
  return level ? `${level}%` : undefined
}

function normalizeBatteryTaskTitle(title: string, batteryLevel: string | undefined) {
  if (!batteryLevel) return title
  return title.replace(/\bbattery\b/g, (word) => word.charAt(0).toUpperCase().concat(word.slice(1)))
}

function todoSubtitle(item: TodoItem, due: DueInfo | null, batteryLevel: string | undefined) {
  const detail = batteryLevel ? undefined : compactDescription(item.description)
  const subtitle = [due?.label, detail].filter((part): part is string => Boolean(part)).join(' · ')
  return subtitle || undefined
}

function relativeDueInfo(value: string | undefined): DueInfo | null {
  if (!value) return null
  const dueDate = new Date(value)
  if (Number.isNaN(dueDate.getTime())) return null

  const now = new Date()
  const diffMs = dueDate.getTime() - now.getTime()
  const absMs = Math.abs(diffMs)
  const hour = 60 * 60 * 1000
  const day = 24 * hour
  const week = 7 * day
  const month = 30 * day
  const overdue = diffMs < 0
  const unit = absMs < day ? 'hour' : absMs < 21 * day ? 'day' : absMs < 60 * day ? 'week' : 'month'
  const divisor = unit === 'hour' ? hour : unit === 'day' ? day : unit === 'week' ? week : month
  const amount = Math.max(1, Math.round(absMs / divisor))
  const label = `${amount} ${unit}${amount === 1 ? '' : 's'}`

  if (!overdue) return { label: `Due in ${label}`, tone: 'future' }
  return { label: `${label} overdue`, tone: unit === 'hour' ? 'overdue-hours' : 'overdue-long' }
}

function sortByDueDate(items: TodoItem[]) {
  return [...items].sort((left, right) => {
    const leftDue = todoDue(left)
    const rightDue = todoDue(right)
    if (!leftDue && !rightDue) return 0
    if (!leftDue) return 1
    if (!rightDue) return -1
    return new Date(leftDue).getTime() - new Date(rightDue).getTime()
  })
}

function applyPendingTodoStatuses(items: TodoItem[], pendingStatuses: TodoOptimisticStatuses['pendingStatuses']) {
  return items.map((item) => {
    const identity = todoIdentity(item)
    const pendingStatus = identity ? pendingStatuses[identity]?.status : undefined
    return pendingStatus ? { ...item, status: pendingStatus } : item
  })
}

export function TodoListPanel({ completionScript, entityId, hideCompleted = true, onEditTask, onVisibleItemsChange, optimisticStatuses, reloadVersion = 0, rowVariant, title }: TodoListPanelProps) {
  const copy = useCopy(TODO_LIST_I18N.namespace)
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true })
  const connection = useHass((state) => state.connection) as unknown as HassConnection | undefined
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const [items, setItems] = useState<TodoItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(false)
  const internalOptimisticStatuses = useTodoOptimisticStatuses()
  const todoOptimisticStatuses = optimisticStatuses ?? internalOptimisticStatuses
  const { clearStatus, commitStatus, confirmStatuses, pendingStatuses } = todoOptimisticStatuses
  const entityState = entity?.state
  const entityLastChanged = (entity as { last_changed?: string } | null)?.last_changed
  const entityLastUpdated = (entity as { last_updated?: string } | null)?.last_updated

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    if (!connection?.sendMessagePromise) return undefined

    connection
      .sendMessagePromise<{ items?: TodoItem[] }>({ type: 'todo/item/list', entity_id: entityId })
      .then((response) => {
        if (!cancelled) {
          setError(null)
          setItems(sortByDueDate(response.items ?? []))
        }
      })
      .catch((caughtError: unknown) => {
        if (!cancelled) {
          setError(caughtError instanceof Error ? caughtError.message : 'Unable to load list')
        }
      })

    return () => {
      cancelled = true
    }
  }, [connection, entityId, entityLastChanged, entityLastUpdated, entityState, reloadVersion])

  useEffect(() => {
    if (!items) return
    const timer = window.setTimeout(() => confirmStatuses(items), 0)
    return () => window.clearTimeout(timer)
  }, [confirmStatuses, items])

  const loadedItems = useMemo(() => items ?? [], [items])
  const displayedItems = useMemo(() => applyPendingTodoStatuses(loadedItems, pendingStatuses), [loadedItems, pendingStatuses])
  const visibleItems = hideCompleted ? displayedItems.filter((item) => item.status !== 'completed') : displayedItems

  useEffect(() => {
    if (!items || error) return
    onVisibleItemsChange?.(visibleItems.length)
  }, [error, items, onVisibleItemsChange, visibleItems.length])

  const toggleItem = (item: TodoItem) => {
    const identity = todoIdentity(item)
    if (!identity || !connection?.sendMessagePromise) return
    const nextStatus = item.status === 'completed' ? 'needs_action' : 'completed'
    const requestId = commitStatus(identity, nextStatus)
    const serviceCall = nextStatus === 'completed' && completionScript
      ? {
          domain: 'script',
          service: completionScript.replace(/^script\./, ''),
          serviceData: { item: identity },
        }
      : {
          domain: 'todo',
          service: 'update_item',
          target: entityId,
          serviceData: { item: identity, status: nextStatus },
        }
    void Promise.resolve(
      callService(serviceCall),
    )
      .then(() => {
        if (mountedRef.current) setError(null)
      })
      .catch((caughtError: unknown) => {
        clearStatus(identity, requestId)
        if (mountedRef.current) setError(caughtError instanceof Error ? caughtError.message : 'Unable to update task')
      })
  }

  return (
    <article aria-label={`${title} todo list`} className={styles.panel} data-row-variant={rowVariant}>
      {error && <span className={styles.error}>{error}</span>}
      {visibleItems.length > 0 && (
        <ul className={styles.items}>
          {visibleItems.map((item, index) => {
            const due = relativeDueInfo(todoDue(item))
            const batteryLevel = batteryMaintenanceLevel(item)
            const normalizedTitle = normalizeBatteryTaskTitle(compactText(item.summary) ?? 'Untitled task', batteryLevel)
            const titleText = batteryLevel
              ? copy('todo.batteryTaskTitle', { percentage: batteryLevel, title: normalizedTitle })
              : normalizedTitle
            const subtitle = todoSubtitle(item, due, batteryLevel)
            const taskId = donetickTaskIdFromUid(item.uid)
            const editTarget = onEditTask && taskId && item.uid
              ? { itemUid: item.uid, taskId, todoEntityId: entityId }
              : null
            return (
              <li className={styles.item} key={item.uid ?? `${entityId}-${index}`}>
                <div aria-label={`${titleText} task`} className={styles.itemRow} data-editable={editTarget ? 'true' : 'false'} role="group">
                  <CheckboxRow
                    active={item.status === 'completed'}
                    alignWrappedToIconTop={rowVariant === 'settings'}
                    aria-label={subtitle ? `${titleText} ${subtitle}` : titleText}
                    className={styles.itemButton}
                    data-due-tone={due?.tone}
                    onClick={() => toggleItem(item)}
                    subtitle={subtitle}
                    title={titleText}
                  />
                  {editTarget && (
                    <button
                      aria-label={`Edit ${titleText}`}
                      className={styles.editAction}
                      onClick={() => onEditTask?.(editTarget)}
                      type="button"
                    >
                      <MaterialIcon name="mdi:pencil" size={22} />
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </article>
  )
}