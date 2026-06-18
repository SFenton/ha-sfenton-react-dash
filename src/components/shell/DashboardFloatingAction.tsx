import { useState } from 'react'
import { CHORE_BLUE } from '../../constants/portedDashboard'
import { FloatingActionButton } from '../core/FloatingActionButton'
import { CreateDonetickTaskSheet } from '../hass/CreateDonetickTaskSheet'
import { CreateGroceryItemSheet } from '../hass/CreateGroceryItemSheet'
import { RoomPickerButton } from '../../pages/AtAGlancePage'
import { createTaskDefaultAssignee, dashboardRoomNameFromPath } from './dashboardFloatingAction'

interface DashboardFloatingActionProps {
  onNavigate: (path: string) => void
  path: string
}

function CreateChoreButton({ defaultAssignee }: { defaultAssignee: string }) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <FloatingActionButton color={CHORE_BLUE} icon="mdi:plus" label="Add Task" onClick={() => setModalOpen(true)} />
      <CreateDonetickTaskSheet defaultAssignee={defaultAssignee} onClose={() => setModalOpen(false)} open={modalOpen} />
    </>
  )
}

function CreateGroceryButton() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <FloatingActionButton color={CHORE_BLUE} icon="mdi:plus" label="Add Groceries" onClick={() => setModalOpen(true)} />
      <CreateGroceryItemSheet entityId="todo.shopping_list" onClose={() => setModalOpen(false)} open={modalOpen} />
    </>
  )
}

export function DashboardFloatingAction({ onNavigate, path }: DashboardFloatingActionProps) {
  const createTaskAssignee = createTaskDefaultAssignee(path)

  if (path === 'overview' || dashboardRoomNameFromPath(path)) return <RoomPickerButton key={path} onNavigate={onNavigate} />
  if (path === 'groceries') return <CreateGroceryButton key={path} />
  if (createTaskAssignee !== null) return <CreateChoreButton defaultAssignee={createTaskAssignee} key={path} />
  return null
}
