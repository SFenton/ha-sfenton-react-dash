import { useState } from 'react'
import type { ReactNode } from 'react'
import { CHORE_BLUE } from '../../constants/portedDashboard'
import { FloatingActionButton } from '../core/FloatingActionButton'
import { CreateDonetickTaskSheet } from '../hass/CreateDonetickTaskSheet'
import { CreateGroceryItemSheet } from '../hass/CreateGroceryItemSheet'
import { EverShelfInventoryFloatingActions } from '../hass/EverShelfInventoryPanel'
import type { EverShelfInventoryControls } from '../hass/EverShelfInventoryControls'
import { ScanItemCameraSheet } from '../hass/ScanItemCameraSheet'
import { RoomPickerButton } from '../../pages/AtAGlancePage'
import { createTaskDefaultAssignee, dashboardRoomNameFromPath, isEverShelfInventoryRoute } from './dashboardFloatingAction'
import { HOME_GROCERY_LIST_ROUTE_PATH } from '../../constants/routes'

interface DashboardFloatingActionProps {
  inventoryControls?: EverShelfInventoryControls
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

function ScanItemButton() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <FloatingActionButton color={CHORE_BLUE} icon="mdi:barcode-scan" label="Scan Item" onClick={() => setModalOpen(true)} />
      <ScanItemCameraSheet onClose={() => setModalOpen(false)} open={modalOpen} />
    </>
  )
}

export function DashboardFloatingAction({ inventoryControls, onNavigate, path }: DashboardFloatingActionProps) {
  const createTaskAssignee = createTaskDefaultAssignee(path)
  const primaryAction = (() => {
    if (path === 'kitchen') return <ScanItemButton key="scan-item" />
    if (path === 'overview' || dashboardRoomNameFromPath(path)) return <RoomPickerButton key="rooms" onNavigate={onNavigate} />
    if (path === 'groceries' || path === HOME_GROCERY_LIST_ROUTE_PATH) return <CreateGroceryButton key="grocery" />
    if (createTaskAssignee !== null) return <CreateChoreButton defaultAssignee={createTaskAssignee} key={`chore-${createTaskAssignee}`} />
    return null
  })()
  const secondaryActions: ReactNode[] = []

  if (isEverShelfInventoryRoute(path) && inventoryControls) secondaryActions.push(<EverShelfInventoryFloatingActions controls={inventoryControls} key="inventory-controls" />)
  if (!primaryAction && secondaryActions.length === 0) return null
  return (
    <>
      {primaryAction}
      {secondaryActions}
    </>
  )
}
