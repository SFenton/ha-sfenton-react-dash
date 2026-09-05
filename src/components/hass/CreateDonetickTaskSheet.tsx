import { ModalSheet, type ModalCenteredGeometry } from '../core/ModalSheet'
import {
  DonetickTaskFormBody,
  DonetickTaskFormFooter,
} from './DonetickTaskFormPage'
import { useDonetickTaskForm } from './useDonetickTaskForm'
import type { DonetickAssigneeOption, DonetickTaskEditTarget } from './donetickTaskForm'

const DONETICK_TASK_CENTERED_GEOMETRY = {
  blockPolicy: 'fixed',
  blockSize: '820px',
  id: 'donetick-task',
  inlineSize: '560px',
} satisfies ModalCenteredGeometry

interface CreateDonetickTaskSheetProps {
  assigneeOptions?: readonly DonetickAssigneeOption[]
  defaultAssignee?: string
  editTarget?: DonetickTaskEditTarget
  open: boolean
  onBusyChange?: (busy: boolean) => void
  onClose: () => void
  onDeleted?: () => void
  onSaved?: () => void
}

export function CreateDonetickTaskSheet({
  assigneeOptions,
  defaultAssignee = '',
  editTarget,
  open,
  onBusyChange,
  onClose,
  onDeleted,
  onSaved,
}: CreateDonetickTaskSheetProps) {
  const controller = useDonetickTaskForm({
    active: open,
    assigneeOptions,
    defaultAssignee,
    editTarget,
    onBusyChange,
    onComplete: onClose,
    onDeleted,
    onSaved,
  })

  return (
    <ModalSheet
      centeredGeometry={DONETICK_TASK_CENTERED_GEOMETRY}
      footer={<DonetickTaskFormFooter controller={controller} />}
      onClose={() => {
        if (!controller.busy) onClose()
      }}
      open={open}
      size="form"
      title={editTarget ? 'Edit Task' : 'Create Task'}
    >
      <DonetickTaskFormBody controller={controller} />
    </ModalSheet>
  )
}
