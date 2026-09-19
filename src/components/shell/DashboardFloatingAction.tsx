import { useState } from 'react'
import { ADMIN_TODO_ENTITY_ID, CHORE_BLUE } from '../../constants/portedDashboard'
import { PAGE_FOOD_COPY_KEYS, PAGE_FOOD_COPY_NAMESPACE, useCopy } from '../../i18n'
import { FloatingActionButton } from '../core/FloatingActionButton'
import { CreateDonetickTaskSheet } from '../hass/CreateDonetickTaskSheet'
import { CreateGroceryItemSheet } from '../hass/CreateGroceryItemSheet'
import { CreateTodoItemSheet } from '../hass/CreateTodoItemSheet'
import { EverShelfInventoryFloatingActions } from '../hass/EverShelfInventoryPanel'
import type { EverShelfInventoryControls } from '../hass/EverShelfInventoryControls'
import { RecipeFloatingActions } from '../hass/recipes/RecipeFloatingActions'
import type { RecipeControls } from '../hass/recipes/useRecipeControls'
import { ScanItemCameraSheet, type EverShelfLocation } from '../hass/ScanItemCameraSheet'
import { createTaskDefaultAssignee, isEverShelfInventoryRoute } from './dashboardFloatingAction'
import { HOME_CABINET_ROUTE_PATH, HOME_FOOD_ROUTE_PATH, HOME_FREEZER_ROUTE_PATH, HOME_FRIDGE_ROUTE_PATH, HOME_GROCERY_LIST_ROUTE_PATH, HOME_PANTRY_ROUTE_PATH, HOME_RECIPES_ROUTE_PATH, HOME_SPICE_RACK_ROUTE_PATH } from '../../constants/routes'
import { DuoPageActionHub, type DuoPageAction } from './DuoPageActionHub'
import { useNavigationLayout } from './NavigationLayoutContext'

interface DashboardFloatingActionProps {
  inventoryControls?: EverShelfInventoryControls
  path: string
  recipeControls?: RecipeControls
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

function CreateAdminTodoButton() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <FloatingActionButton color={CHORE_BLUE} icon="mdi:plus" label="Add Task" onClick={() => setModalOpen(true)} />
      <CreateTodoItemSheet entityId={ADMIN_TODO_ENTITY_ID} onClose={() => setModalOpen(false)} open={modalOpen} />
    </>
  )
}

function scanItemDefaultLocation(path: string): EverShelfLocation | undefined {
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

export function DashboardFloatingAction({ inventoryControls, path, recipeControls }: DashboardFloatingActionProps) {
  const layout = useNavigationLayout()
  const foodCopy = useCopy(PAGE_FOOD_COPY_NAMESPACE)
  const [duoScanOpen, setDuoScanOpen] = useState(false)
  const isDuo = layout === 'duo'

  if (path === HOME_RECIPES_ROUTE_PATH) {
    if (!recipeControls) return null
    const recipeActions: readonly DuoPageAction[] = [
      {
        active: recipeControls.sortActive,
        icon: 'mdi:swap-vertical',
        id: 'recipe-sort',
        label: foodCopy(PAGE_FOOD_COPY_KEYS.actions.sort),
        onActivate: recipeControls.openSortSheet,
      },
      {
        active: recipeControls.filterActive,
        icon: 'mdi:tune-vertical',
        id: 'recipe-filter',
        label: foodCopy(PAGE_FOOD_COPY_KEYS.actions.filter),
        onActivate: recipeControls.openFilterSheet,
      },
    ]
    return (
      <>
        <RecipeFloatingActions controls={recipeControls} showSecondaryActions={!isDuo} />
        {isDuo && <DuoPageActionHub actions={recipeActions} />}
      </>
    )
  }

  const createTaskAssignee = createTaskDefaultAssignee(path)
  const defaultScanLocation = scanItemDefaultLocation(path)
  const inventoryRoute = isEverShelfInventoryRoute(path)
  const inventoryReady = !inventoryRoute || inventoryControls?.inventoryLoadPhase === 'content'
  const inventorySearchVisible = Boolean(
    inventoryRoute
    && inventoryControls
    && inventoryReady
    && (inventoryControls.inventoryItemCount !== 0 || inventoryControls.searchActive),
  )
  const primaryAction = (() => {
    if (path === 'kitchen' || path === HOME_FOOD_ROUTE_PATH) return <ScanItemButton key="scan-item" />
    if (path === 'groceries' || path === HOME_GROCERY_LIST_ROUTE_PATH) return <CreateGroceryButton key="grocery" />
    if (path === 'to-do') return <CreateAdminTodoButton key="admin-todo" />
    if (createTaskAssignee !== null) return <CreateChoreButton defaultAssignee={createTaskAssignee} key={`chore-${createTaskAssignee}`} />
    return null
  })()

  if (inventoryRoute && inventoryControls && inventoryReady) {
    if (!inventorySearchVisible) {
      return <ScanItemButton defaultLocation={defaultScanLocation} iconOnly={isDuo} />
    }
    const inventoryActions: readonly DuoPageAction[] = [
      {
        active: inventoryControls.sortActive,
        icon: 'mdi:swap-vertical',
        id: 'inventory-sort',
        label: foodCopy('actions.sort'),
        onActivate: inventoryControls.openSortSheet,
      },
      {
        active: inventoryControls.filterActive,
        icon: 'mdi:tune-vertical',
        id: 'inventory-filter',
        label: foodCopy('actions.filter'),
        onActivate: inventoryControls.openFilterSheet,
      },
      {
        icon: 'mdi:barcode-scan',
        id: 'inventory-scan',
        label: foodCopy(PAGE_FOOD_COPY_KEYS.actions.scanItem),
        onActivate: () => setDuoScanOpen(true),
      },
    ]
    return (
      <>
        <EverShelfInventoryFloatingActions controls={inventoryControls} showSecondaryActions={!isDuo} />
        {isDuo ? (
          <>
            <DuoPageActionHub actions={inventoryActions} />
            <ScanItemCameraSheet defaultLocation={defaultScanLocation} onClose={() => setDuoScanOpen(false)} open={duoScanOpen} />
          </>
        ) : (
          <ScanItemButton defaultLocation={defaultScanLocation} iconOnly />
        )}
      </>
    )
  }

  if (!primaryAction) return null
  return (
    <>
      {primaryAction}
    </>
  )
}
