import { ModalSheet, type ModalSheetStyle } from '../core/ModalSheet'
import {
  DonetickTaskFormBody,
  DonetickTaskFormFooter,
} from './DonetickTaskFormPage'
import { useDonetickTaskForm } from './useDonetickTaskForm'
import type { DonetickAssigneeOption, DonetickTaskEditTarget } from './donetickTaskForm'

const EDIT_TASK_MODAL_STYLE: ModalSheetStyle = {
  '--modal-desktop-height': 'min(940px, calc(var(--dashboard-visible-height, var(--dashboard-viewport-height, 100dvh)) - 64px))',
}

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
      contentStyle={editTarget ? EDIT_TASK_MODAL_STYLE : undefined}
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
