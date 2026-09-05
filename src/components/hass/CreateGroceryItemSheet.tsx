import { useState, type FormEvent } from 'react'
import { useHass } from '@hakit/core'
import { MaterialIcon } from '../core/Icon'
import { ModalSheet, type ModalCenteredGeometry } from '../core/ModalSheet'
import styles from './CreateDonetickTaskSheet.module.css'

type CallService = (params: Record<string, unknown>) => Promise<unknown> | void

interface CreateGroceryItemSheetProps {
  entityId: string
  open: boolean
  onClose: () => void
}

const FORM_ID = 'create-grocery-item-form'
const CREATE_GROCERY_ITEM_CENTERED_GEOMETRY = {
  blockPolicy: 'fixed',
  blockSize: '360px',
  id: 'create-grocery-item',
  inlineSize: '560px',
} satisfies ModalCenteredGeometry

export function CreateGroceryItemSheet({ entityId, open, onClose }: CreateGroceryItemSheetProps) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const [item, setItem] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const itemName = item.trim()

  const handleClose = () => {
    if (submitting) return
    setItem('')
    setError(null)
    onClose()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!itemName || submitting) return

    setSubmitting(true)
    setError(null)
    void Promise.resolve(
      callService({
        domain: 'todo',
        service: 'add_item',
        target: entityId,
        serviceData: { item: itemName },
      }),
    )
      .then(() => handleClose())
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Unable to add grocery item')
      })
      .finally(() => setSubmitting(false))
  }

  return (
    <ModalSheet
      centeredGeometry={CREATE_GROCERY_ITEM_CENTERED_GEOMETRY}
      footer={(
        <button className={styles.primaryAction} disabled={!itemName || submitting} form={FORM_ID} type="submit">
          <MaterialIcon name="mdi:checkbox-marked-circle" size={20} />
          <span>{submitting ? 'Adding...' : 'Add Item'}</span>
        </button>
      )}
      onClose={handleClose}
      open={open}
      size="form"
      title="Add Grocery Item"
    >
      <form className={styles.form} id={FORM_ID} onSubmit={handleSubmit}>
        {error && <p className={styles.error}>{error}</p>}
        <label className={styles.field}>
          <span>Item</span>
          <input autoComplete="off" name="item" onChange={(event) => setItem(event.target.value)} required type="text" value={item} />
        </label>
      </form>
    </ModalSheet>
  )
}