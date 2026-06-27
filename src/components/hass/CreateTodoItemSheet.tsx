import { useState, type FormEvent } from 'react'
import { useHass } from '@hakit/core'
import { MaterialIcon } from '../core/Icon'
import { ModalSheet } from '../core/ModalSheet'
import styles from './CreateDonetickTaskSheet.module.css'

type CallService = (params: Record<string, unknown>) => Promise<unknown> | void

interface CreateTodoItemSheetProps {
  entityId: string
  open: boolean
  onClose: () => void
}

const FORM_ID = 'create-admin-todo-item-form'

export function CreateTodoItemSheet({ entityId, open, onClose }: CreateTodoItemSheetProps) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const [task, setTask] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const taskName = task.trim()

  const handleClose = () => {
    if (submitting) return
    setTask('')
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
        domain: 'todo',
        service: 'add_item',
        target: entityId,
        serviceData: { item: taskName },
      }),
    )
      .then(() => handleClose())
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Unable to add task')
      })
      .finally(() => setSubmitting(false))
  }

  return (
    <ModalSheet
      footer={(
        <button className={styles.primaryAction} disabled={!taskName || submitting} form={FORM_ID} type="submit">
          <MaterialIcon name="mdi:checkbox-marked-circle" size={20} />
          <span>{submitting ? 'Adding...' : 'Add Task'}</span>
        </button>
      )}
      onClose={handleClose}
      open={open}
      title="Add Task"
    >
      <form className={styles.form} id={FORM_ID} onSubmit={handleSubmit}>
        {error && <p className={styles.error}>{error}</p>}
        <label className={styles.field}>
          <span>Task</span>
          <input autoComplete="off" name="task" onChange={(event) => setTask(event.target.value)} required type="text" value={task} />
        </label>
      </form>
    </ModalSheet>
  )
}
