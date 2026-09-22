import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useHass } from '@hakit/core'
import { PAGE_SETTINGS_COPY_KEYS, PAGE_SETTINGS_COPY_NAMESPACE, useCopy } from '../../i18n'
import { Description } from '../core/Description'
import { MaterialIcon } from '../core/Icon'
import { ModalSheet, type ModalCenteredGeometry } from '../core/ModalSheet'
import styles from './CreateDonetickTaskSheet.module.css'

type CallService = (params: Record<string, unknown>) => Promise<unknown> | void
interface HassConnection {
  options?: { auth?: { accessToken?: string } }
}

interface CreateTodoItemSheetProps {
  entityId: string
  open: boolean
  onClose: () => void
}

const FORM_ID = 'create-admin-todo-item-form'
const IMAGES_DESCRIPTION_ID = 'create-admin-todo-images-description'
const IMAGES_INPUT_ID = 'create-admin-todo-images'
const MAX_IMAGES = 4
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const IMAGE_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const CREATE_TODO_ITEM_CENTERED_GEOMETRY = {
  blockPolicy: 'fixed',
  blockSize: '360px',
  id: 'create-todo-item',
  inlineSize: '560px',
} satisfies ModalCenteredGeometry

export function CreateTodoItemSheet({ entityId, open, onClose }: CreateTodoItemSheetProps) {
  const copy = useCopy(PAGE_SETTINGS_COPY_NAMESPACE)
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const connection = useHass((state) => state.connection) as unknown as HassConnection | undefined
  const [task, setTask] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [imageInputKey, setImageInputKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const taskName = task.trim()

  const handleClose = () => {
    if (submitting) return
    setTask('')
    setImages([])
    setImageInputKey((value) => value + 1)
    setError(null)
    onClose()
  }

  const handleImagesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = [...(event.target.files ?? [])]
    if (selected.length > MAX_IMAGES) {
      setImages([])
      setError(copy(PAGE_SETTINGS_COPY_KEYS.items.todo.tooManyImages))
      setImageInputKey((value) => value + 1)
      return
    }
    if (selected.some((image) => !IMAGE_MEDIA_TYPES.has(image.type))) {
      setImages([])
      setError(copy(PAGE_SETTINGS_COPY_KEYS.items.todo.unsupportedImage))
      setImageInputKey((value) => value + 1)
      return
    }
    if (selected.some((image) => image.size > MAX_IMAGE_BYTES)) {
      setImages([])
      setError(copy(PAGE_SETTINGS_COPY_KEYS.items.todo.imageTooLarge))
      setImageInputKey((value) => value + 1)
      return
    }
    setImages(selected)
    setError(null)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!taskName || submitting) return

    setSubmitting(true)
    setError(null)
    const request = images.length > 0
      ? (() => {
        const formData = new FormData()
        formData.set('entity_id', entityId)
        formData.set('item', taskName)
        images.forEach((image) => formData.append('images', image, image.name))
        const headers = new Headers()
        const token = connection?.options?.auth?.accessToken
        if (token) headers.set('Authorization', `Bearer ${token}`)
        return fetch('/api/sfenton_admin_todo', {
          body: formData,
          credentials: 'same-origin',
          headers,
          method: 'POST',
        }).then((response) => {
          if (!response.ok) throw new Error('Admin To-Do upload failed')
        })
      })()
      : Promise.resolve(
        callService({
          domain: 'todo',
          service: 'add_item',
          target: entityId,
          serviceData: { item: taskName },
        }),
      )

    void request
      .then(() => handleClose())
      .catch(() => {
        setError(copy(PAGE_SETTINGS_COPY_KEYS.items.todo.addFailed))
      })
      .finally(() => setSubmitting(false))
  }

  return (
    <ModalSheet
      centeredGeometry={CREATE_TODO_ITEM_CENTERED_GEOMETRY}
      footer={(
        <button className={styles.primaryAction} disabled={!taskName || submitting} form={FORM_ID} type="submit">
          <MaterialIcon name="mdi:checkbox-marked-circle" size={20} />
          <span>
            {submitting
              ? copy(PAGE_SETTINGS_COPY_KEYS.items.todo.adding)
              : copy(PAGE_SETTINGS_COPY_KEYS.items.todo.addTask)}
          </span>
        </button>
      )}
      onClose={handleClose}
      open={open}
      size="form"
      title={copy(PAGE_SETTINGS_COPY_KEYS.items.todo.addTask)}
    >
      <form className={styles.form} id={FORM_ID} onSubmit={handleSubmit}>
        {error && <p className={styles.error}>{error}</p>}
        <Description>{copy(PAGE_SETTINGS_COPY_KEYS.items.todo.githubSyncDisclosure)}</Description>
        <label className={styles.field}>
          <span>{copy(PAGE_SETTINGS_COPY_KEYS.items.todo.taskLabel)}</span>
          <input autoComplete="off" maxLength={1000} name="task" onChange={(event) => setTask(event.target.value)} required type="text" value={task} />
        </label>
        <div className={styles.field}>
          <label htmlFor={IMAGES_INPUT_ID}>
            {copy(PAGE_SETTINGS_COPY_KEYS.items.todo.imagesLabel)}
          </label>
          <input
            accept="image/png,image/jpeg,image/webp"
            aria-describedby={IMAGES_DESCRIPTION_ID}
            id={IMAGES_INPUT_ID}
            key={imageInputKey}
            multiple
            name="images"
            onChange={handleImagesChange}
            type="file"
          />
          <small id={IMAGES_DESCRIPTION_ID}>
            {copy(PAGE_SETTINGS_COPY_KEYS.items.todo.imagesDescription)}
          </small>
        </div>
      </form>
    </ModalSheet>
  )
}
