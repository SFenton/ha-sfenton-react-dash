import { useState } from 'react'
import type { ReactNode } from 'react'
import { CHORE_BLUE } from '../../constants/portedDashboard'
import { FloatingActionButton } from '../core/FloatingActionButton'
import { CreateDonetickTaskSheet } from '../hass/CreateDonetickTaskSheet'
import { CreateGroceryItemSheet } from '../hass/CreateGroceryItemSheet'
import { EverShelfInventoryFloatingActions } from '../hass/EverShelfInventoryPanel'
import type { EverShelfInventoryControls } from '../hass/EverShelfInventoryControls'
import { ScanItemCameraSheet, type EverShelfLocation } from '../hass/ScanItemCameraSheet'
import { RoomPickerButton } from '../../pages/AtAGlancePage'
import { createTaskDefaultAssignee, dashboardRoomNameFromPath, isEverShelfInventoryRoute } from './dashboardFloatingAction'
import { HOME_ALL_FOOD_ROUTE_PATH, HOME_CABINET_ROUTE_PATH, HOME_FOOD_ROUTE_PATH, HOME_FREEZER_ROUTE_PATH, HOME_FRIDGE_ROUTE_PATH, HOME_GROCERY_LIST_ROUTE_PATH, HOME_PANTRY_ROUTE_PATH, HOME_SPICE_RACK_ROUTE_PATH } from '../../constants/routes'

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

function scanItemDefaultLocation(path: string): EverShelfLocation | undefined {
  if (path === HOME_ALL_FOOD_ROUTE_PATH) return 'frigo'
  if (path === HOME_PANTRY_ROUTE_PATH) return 'dispensa'
  if (path === HOME_FRIDGE_ROUTE_PATH) return 'frigo'
  if (path === HOME_FREEZER_ROUTE_PATH) return 'freezer'
  if (path === HOME_SPICE_RACK_ROUTE_PATH) return 'spice_rack'
  if (path === HOME_CABINET_ROUTE_PATH) return 'cabinet'
  return undefined
}

function ScanItemButton({ defaultLocation, iconOnly = false }: { defaultLocation?: EverShelfLocation; iconOnly?: boolean }) {
  const [modalOpen, setModalOpen] = useState(false)
  const button = iconOnly
    ? <FloatingActionButton ariaLabel="Scan Item" color={CHORE_BLUE} icon="mdi:barcode-scan" onClick={() => setModalOpen(true)} />
    : <FloatingActionButton color={CHORE_BLUE} icon="mdi:barcode-scan" label="Scan Item" onClick={() => setModalOpen(true)} />

  return (
    <>
      {button}
      <ScanItemCameraSheet defaultLocation={defaultLocation} onClose={() => setModalOpen(false)} open={modalOpen} />
    </>
  )
}

export function DashboardFloatingAction({ inventoryControls, onNavigate, path }: DashboardFloatingActionProps) {
  const createTaskAssignee = createTaskDefaultAssignee(path)
  const defaultScanLocation = scanItemDefaultLocation(path)
  const inventoryRoute = isEverShelfInventoryRoute(path)
  const inventoryReady = !inventoryRoute || inventoryControls?.inventoryLoadPhase === 'content'
  const primaryAction = (() => {
    if (path === 'kitchen' || path === HOME_FOOD_ROUTE_PATH) return <ScanItemButton key="scan-item" />
    if (path === 'overview' || dashboardRoomNameFromPath(path)) return <RoomPickerButton key="rooms" onNavigate={onNavigate} />
    if (path === 'groceries' || path === HOME_GROCERY_LIST_ROUTE_PATH) return <CreateGroceryButton key="grocery" />
    if (createTaskAssignee !== null) return <CreateChoreButton defaultAssignee={createTaskAssignee} key={`chore-${createTaskAssignee}`} />
    return null
  })()
  const secondaryActions: ReactNode[] = []

  if (path === 'kitchen') secondaryActions.push(<RoomPickerButton key="rooms" onNavigate={onNavigate} />)
  if (inventoryRoute && inventoryControls && inventoryReady) secondaryActions.push(<EverShelfInventoryFloatingActions controls={inventoryControls} key="inventory-controls" />)
  if (inventoryRoute && inventoryReady) secondaryActions.push(<ScanItemButton defaultLocation={defaultScanLocation} iconOnly={inventoryControls?.inventoryItemCount !== 0} key={`scan-item-${defaultScanLocation ?? 'default'}`} />)
  if (!primaryAction && secondaryActions.length === 0) return null
  return (
    <>
      {primaryAction}
      {secondaryActions}
    </>
  )
}
