import { useEffect, useState } from 'react'
import { useEntity, useHass } from '@hakit/core'
import { MaterialIcon } from '../core/Icon'
import { asEntityName, formatCompactEntityState } from './entityState'
import styles from './TodoListPanel.module.css'

interface TodoItem {
  summary?: string
  status?: string
  uid?: string
}

interface TodoListPanelProps {
  entityId: string
  title: string
}

interface HassConnection {
  sendMessagePromise?: <T>(message: Record<string, unknown>) => Promise<T>
}

function itemStatus(item: TodoItem) {
  if (item.status === 'completed') return 'Done'
  if (item.status === 'needs_action') return 'Open'
  return item.status ?? 'Open'
}

export function TodoListPanel({ entityId, title }: TodoListPanelProps) {
  const entity = useEntity(asEntityName(entityId), { returnNullIfNotFound: true })
  const connection = useHass((state) => state.connection) as unknown as HassConnection | undefined
  const [items, setItems] = useState<TodoItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!connection?.sendMessagePromise) return undefined

    connection
      .sendMessagePromise<{ items?: TodoItem[] }>({ type: 'todo/item/list', entity_id: entityId })
      .then((response) => {
        if (!cancelled) setItems(response.items ?? [])
      })
      .catch((caughtError: unknown) => {
        if (!cancelled) setError(caughtError instanceof Error ? caughtError.message : 'Unable to load list')
      })

    return () => {
      cancelled = true
    }
  }, [connection, entityId])

  const openItems = items.filter((item) => item.status !== 'completed')

  return (
    <article className={styles.panel} aria-label={`${title} todo list`}>
      <header className={styles.header}>
        <span className={styles.icon} aria-hidden="true"><MaterialIcon name="mdi:clipboard-list" size={26} /></span>
        <span className={styles.copy}>
          <span className={styles.title}>{title}</span>
          <span className={styles.subtitle}>{error ?? `${openItems.length} open - ${formatCompactEntityState(entity, 'Ready')}`}</span>
        </span>
      </header>
      {openItems.length > 0 && (
        <ul className={styles.items}>
          {openItems.slice(0, 5).map((item, index) => (
            <li className={styles.item} key={item.uid ?? `${entityId}-${index}`}>
              <span>{item.summary ?? 'Untitled task'}</span>
              <small>{itemStatus(item)}</small>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}