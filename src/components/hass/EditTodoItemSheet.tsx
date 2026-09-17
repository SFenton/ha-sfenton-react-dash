import { useRef, useState, type FormEvent } from 'react'
import { useHass } from '@hakit/core'
import { MaterialIcon } from '../core/Icon'
import { ModalSheet, type ModalCenteredGeometry } from '../core/ModalSheet'
import { useCopy } from '../../i18n'
import type { AdminTodoEditTarget } from './adminTodoEdit'
import styles from './EditTodoItemSheet.module.css'

type CallService = (params: Record<string, unknown>) => Promise<unknown> | void

interface EditTodoItemSheetProps {
  editTarget: AdminTodoEditTarget
  onClose: () => void
  onSaved: () => void
  open: boolean
}

const FORM_ID = 'edit-admin-todo-item-form'
const TODO_EDIT_I18N = { namespace: 'core' } as const
const EDIT_TODO_ITEM_CENTERED_GEOMETRY = {
  blockPolicy: 'fixed',
  blockSize: '360px',
  id: 'edit-todo-item',
  inlineSize: '560px',
} satisfies ModalCenteredGeometry

export function EditTodoItemSheet({ editTarget, onClose, onSaved, open }: EditTodoItemSheetProps) {
  const copy = useCopy(TODO_EDIT_I18N.namespace)
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const [draft, setDraft] = useState(editTarget.originalTitle)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const trimmedDraft = draft.trim()
  const canReset = !submitting && (draft !== editTarget.originalTitle || Boolean(error))
  const canSave = Boolean(editTarget.itemUid) && Boolean(trimmedDraft) && trimmedDraft !== editTarget.originalTitle.trim() && !submitting

  const handleClose = () => {
    if (submitting || submittingRef.current) return
    setDraft(editTarget.originalTitle)
    setError(null)
    onClose()
  }

  const handleReset = () => {
    if (!canReset) return
    setDraft(editTarget.originalTitle)
    setError(null)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSave || !editTarget.itemUid || submittingRef.current) return

    submittingRef.current = true
    setSubmitting(true)
    setError(null)
    try {
      void Promise.resolve(callService({
        domain: 'todo',
        service: 'update_item',
        target: editTarget.todoEntityId,
        serviceData: { item: editTarget.itemUid, rename: trimmedDraft },
      }))
        .then(() => {
          onSaved()
          onClose()
        })
        .catch((caughtError: unknown) => {
          setError(caughtError instanceof Error ? caughtError.message : copy('todo.editServiceError'))
        })
        .finally(() => {
          submittingRef.current = false
          setSubmitting(false)
        })
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : copy('todo.editServiceError'))
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <ModalSheet
      centeredGeometry={EDIT_TODO_ITEM_CENTERED_GEOMETRY}
      footer={(
        <div className={styles.footer}>
          <button className={styles.resetAction} disabled={!canReset} onClick={handleReset} type="button">
            {copy('todo.reset')}
          </button>
          <button aria-busy={submitting ? 'true' : undefined} className={styles.saveAction} disabled={!canSave} form={FORM_ID} type="submit">
            <MaterialIcon name="mdi:check" size={20} />
            <span>{submitting ? copy('todo.saving') : copy('todo.save')}</span>
          </button>
        </div>
      )}
      onClose={handleClose}
      open={open}
      size="form"
      title={copy('todo.editTitle')}
    >
      <form className={styles.form} id={FORM_ID} onSubmit={handleSubmit}>
        {error && <p aria-live="polite" className={styles.error} role="alert">{error}</p>}
        {!editTarget.itemUid && <p className={styles.error} role="alert">{copy('todo.identityUnavailable')}</p>}
        <label className={styles.field}>
          <span>{copy('todo.taskName')}</span>
          <input autoComplete="off" disabled={submitting} name="taskName" onChange={(event) => setDraft(event.target.value)} required type="text" value={draft} />
        </label>
      </form>
    </ModalSheet>
  )
}
