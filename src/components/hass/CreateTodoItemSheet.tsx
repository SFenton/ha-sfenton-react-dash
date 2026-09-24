import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useHass } from '@hakit/core'
import { PAGE_SETTINGS_COPY_KEYS, PAGE_SETTINGS_COPY_NAMESPACE, useCopy } from '../../i18n'
import type { ControlSemantics } from '../core/controlSemantics'
import { Description } from '../core/Description'
import { MaterialIcon } from '../core/Icon'
import { ModalSheet, type ModalCenteredGeometry } from '../core/ModalSheet'
import styles from './CreateDonetickTaskSheet.module.css'
import imageStyles from './CreateTodoItemSheet.module.css'

type CallService = (params: Record<string, unknown>) => Promise<unknown> | void
interface HassConnection {
  options?: { auth?: { accessToken?: string } }
}

interface CreateTodoItemSheetProps {
  entityId: string
  open: boolean
  onClose: () => void
}

interface SelectedImage {
  file: File
  id: number
}

interface SelectedImagePreviewProps {
  disabled: boolean
  file: File
  onRemove: () => void
  position: number
  removeLabel: string
  setRemoveButtonRef: (button: HTMLButtonElement | null) => void
}

const FORM_ID = 'create-admin-todo-item-form'
const IMAGES_DESCRIPTION_ID = 'create-admin-todo-images-description'
const IMAGES_INPUT_ID = 'create-admin-todo-images'
const IMAGES_LABEL_ID = 'create-admin-todo-images-label'
const MAX_IMAGES = 4
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const IMAGE_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const REMOVE_IMAGE_SEMANTICS = { kind: 'command' } satisfies ControlSemantics
const TODO_ITEM_I18N = { namespace: 'core' } as const
const CREATE_TODO_ITEM_CENTERED_GEOMETRY = {
  blockPolicy: 'fixed',
  blockSize: '360px',
  id: 'create-todo-item',
  inlineSize: '560px',
} satisfies ModalCenteredGeometry

function SelectedImagePreview({ disabled, file, onRemove, position, removeLabel, setRemoveButtonRef }: SelectedImagePreviewProps) {
  const descriptionId = useId()
  const previewRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    const preview = previewRef.current
    if (!preview) return undefined
    const objectUrl = URL.createObjectURL(file)
    preview.src = objectUrl
    return () => {
      preview.removeAttribute('src')
      URL.revokeObjectURL(objectUrl)
    }
  }, [file])

  return (
    <li className={imageStyles.previewItem} data-selected-image-preview="true">
      <img alt={file.name} className={imageStyles.previewImage} ref={previewRef} />
      <button
        aria-describedby={descriptionId}
        aria-label={removeLabel}
        className={imageStyles.removeImage}
        data-action-kind={REMOVE_IMAGE_SEMANTICS.kind}
        data-selected-image-remove="true"
        disabled={disabled}
        onClick={onRemove}
        ref={setRemoveButtonRef}
        type="button"
      >
        <MaterialIcon name="mdi:close" size={19} />
        <span className={imageStyles.removeDescription} id={descriptionId}>{position}. {file.name}</span>
      </button>
    </li>
  )
}

export function CreateTodoItemSheet({ entityId, open, onClose }: CreateTodoItemSheetProps) {
  const copy = useCopy(PAGE_SETTINGS_COPY_NAMESPACE)
  const coreCopy = useCopy(TODO_ITEM_I18N.namespace)
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const connection = useHass((state) => state.connection) as unknown as HassConnection | undefined
  const [task, setTask] = useState('')
  const [images, setImages] = useState<SelectedImage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const imageInputRef = useRef<HTMLInputElement | null>(null)
  const nextImageIdRef = useRef(1)
  const removeButtonRefs = useRef(new Map<number, HTMLButtonElement>())
  const taskName = task.trim()

  const handleClose = () => {
    if (submitting) return
    setTask('')
    setImages([])
    if (imageInputRef.current) imageInputRef.current.value = ''
    setError(null)
    onClose()
  }

  const handleImagesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = [...(event.target.files ?? [])]
    event.currentTarget.value = ''
    if (selected.length > MAX_IMAGES) {
      setImages([])
      setError(copy(PAGE_SETTINGS_COPY_KEYS.items.todo.tooManyImages))
      return
    }
    if (selected.some((image) => !IMAGE_MEDIA_TYPES.has(image.type))) {
      setImages([])
      setError(copy(PAGE_SETTINGS_COPY_KEYS.items.todo.unsupportedImage))
      return
    }
    if (selected.some((image) => image.size > MAX_IMAGE_BYTES)) {
      setImages([])
      setError(copy(PAGE_SETTINGS_COPY_KEYS.items.todo.imageTooLarge))
      return
    }
    setImages(selected.map((file) => ({ file, id: nextImageIdRef.current++ })))
    setError(null)
  }

  const handleRemoveImage = (imageId: number, index: number) => {
    if (submitting) return
    const focusImage = images[index + 1] ?? images[index - 1]
    const focusTarget = focusImage
      ? removeButtonRefs.current.get(focusImage.id)
      : imageInputRef.current
    focusTarget?.focus()
    setImages((current) => current.filter((image) => image.id !== imageId))
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
        images.forEach(({ file }) => formData.append('images', file, file.name))
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
        <div className={styles.field} data-todo-image-field="true">
          <label htmlFor={IMAGES_INPUT_ID} id={IMAGES_LABEL_ID}>
            {copy(PAGE_SETTINGS_COPY_KEYS.items.todo.imagesLabel)}
          </label>
          {images.length > 0 && (
            <ul
              aria-labelledby={IMAGES_LABEL_ID}
              className={imageStyles.previewList}
              data-selected-image-previews="true"
            >
              {images.map((image, index) => {
                const position = index + 1
                return (
                  <SelectedImagePreview
                    disabled={submitting}
                    file={image.file}
                    key={image.id}
                    onRemove={() => handleRemoveImage(image.id, index)}
                    position={position}
                    removeLabel={coreCopy('modal.close')}
                    setRemoveButtonRef={(button) => {
                      if (button) removeButtonRefs.current.set(image.id, button)
                      else removeButtonRefs.current.delete(image.id)
                    }}
                  />
                )
              })}
            </ul>
          )}
          <input
            accept="image/png,image/jpeg,image/webp"
            aria-describedby={IMAGES_DESCRIPTION_ID}
            disabled={submitting}
            id={IMAGES_INPUT_ID}
            multiple
            name="images"
            onChange={handleImagesChange}
            ref={imageInputRef}
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
