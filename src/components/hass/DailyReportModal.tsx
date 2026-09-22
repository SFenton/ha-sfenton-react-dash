import { useEffect, useState } from 'react'
import { useHass } from '@hakit/core'
import { ModalSheet } from '../core/ModalSheet'
import { SectionHeader } from '../core/SectionHeader'
import { DailyReportModalContent, DailyReportModalNav } from './DailyReportModalContent'
import { DAILY_REPORT_CENTERED_GEOMETRY, DAILY_REPORT_MODAL_STYLE, useDailyReportContext, type DailyReportContext } from './dailyReportModal'
import { DonetickTaskFormBody, DonetickTaskFormFooter } from './DonetickTaskFormPage'
import {
  EverShelfInventoryDetailsPage,
  EverShelfInventoryDetailsPageHost,
  type EverShelfInventoryDetailsController,
  type EverShelfInventoryDetailsTarget,
} from './EverShelfInventoryPanel'
import { useDonetickTaskForm } from './useDonetickTaskForm'
import type { DonetickTaskEditTarget } from './donetickTaskForm'
import type { DonetickTaskFormController } from './useDonetickTaskForm'
import {
  DAILY_REPORT_AUTO_TAB,
  DAILY_REPORT_HASH,
  DAILY_REPORT_TAB_QUERY_KEY,
  dailyReportAutoTab,
  dailyReportTabLabel,
  dailyReportTabRequestFromUrl,
  type DailyReportTab,
} from '../../constants/dailyReport'
import { dashboardPathWithSearch, replaceDashboardUrl } from '../../hooks/dashboardLocation'
import { useDashboardUrl } from '../../hooks/useDashboardUrl'
import { useHashModal } from '../../hooks/useHashModal'
import styles from './DailyReportModalContent.module.css'

/** Drops the consumed `tab` param so reopening later does not re-run the notification's selection. */
function clearTabRequest() {
  const current = dashboardPathWithSearch()
  if (!current) return
  const [pathname, search] = current.split('?')
  if (!search) return
  const params = new URLSearchParams(search)
  if (!params.has(DAILY_REPORT_TAB_QUERY_KEY)) return
  params.delete(DAILY_REPORT_TAB_QUERY_KEY)
  const query = params.toString()
  replaceDashboardUrl(`${pathname}${query ? `?${query}` : ''}${DAILY_REPORT_HASH}`)
}
function DailyReportModalView({ activeTab, context, editingTask, inventoryDetails, inventoryDetailsTarget, onCloseHash, onEditTask, onOpenInventoryDetails, onSetActiveTab, onSetEditingTask, onSetInventoryDetailsTarget, open, reloadVersion, taskForm }: {
  activeTab: DailyReportTab
  context: DailyReportContext
  editingTask: DonetickTaskEditTarget | null
  inventoryDetails: EverShelfInventoryDetailsController
  inventoryDetailsTarget: EverShelfInventoryDetailsTarget | null
  onCloseHash: () => void
  onEditTask: (target: DonetickTaskEditTarget) => void
  onOpenInventoryDetails: (target: EverShelfInventoryDetailsTarget) => void
  onSetActiveTab: (tab: DailyReportTab) => void
  onSetEditingTask: (target: DonetickTaskEditTarget | null) => void
  onSetInventoryDetailsTarget: (target: EverShelfInventoryDetailsTarget | null) => void
  open: boolean
  reloadVersion: number
  taskForm: DonetickTaskFormController
}) {
  const editingTaskPage = Boolean(editingTask)
  const editingInventoryPage = Boolean(inventoryDetailsTarget)
  const detailPage = editingTaskPage || editingInventoryPage
  const detailDismissalBlocked = editingTaskPage
    ? taskForm.busy
    : editingInventoryPage
      ? inventoryDetails.dismissalBlocked
      : false

  useEffect(() => {
    if (!open && inventoryDetailsTarget && !inventoryDetails.retainsDismissedView) onSetInventoryDetailsTarget(null)
  }, [inventoryDetails.retainsDismissedView, inventoryDetailsTarget, onSetInventoryDetailsTarget, open])

  const modalOpen = open
    || Boolean(editingTaskPage && (taskForm.busy || taskForm.error))
    || Boolean(editingInventoryPage && inventoryDetails.retainsDismissedView)
  const showSummary = () => {
    if (detailDismissalBlocked) return
    onSetEditingTask(null)
    onSetInventoryDetailsTarget(null)
  }

  return (
    <ModalSheet
      backLabel={editingInventoryPage ? 'Back to expired food' : 'Back to daily summary'}
      bodyHeader={!detailPage && context.user && activeTab !== 'upcoming' ? <SectionHeader className={styles.summarySectionHeader} title={dailyReportTabLabel(activeTab)} /> : undefined}
      centeredGeometry={DAILY_REPORT_CENTERED_GEOMETRY}
      contentStyle={DAILY_REPORT_MODAL_STYLE}
      footer={editingTaskPage
        ? <DonetickTaskFormFooter controller={taskForm} />
        : undefined}
      navigation={!detailPage && context.user
        ? <DailyReportModalNav activeTab={activeTab} counts={{ 'expired-food': context.expiredFoodCount, overdue: context.overdueCount }} onTabChange={onSetActiveTab} />
        : undefined}
      onBack={detailPage ? showSummary : undefined}
      onClose={() => {
        if (detailDismissalBlocked) return
        onSetEditingTask(null)
        onSetInventoryDetailsTarget(null)
        onCloseHash()
      }}
      open={modalOpen}
      scrollResetKey={editingTaskPage
        ? `task-${editingTask?.taskId ?? ''}`
        : editingInventoryPage
          ? `inventory-${inventoryDetailsTarget?.item.inventory_id ?? inventoryDetailsTarget?.item.id ?? 'item'}`
          : activeTab}
      size="standard"
      title={editingTaskPage ? 'Edit Task' : editingInventoryPage ? inventoryDetails.title : context.title}
    >
      {editingTaskPage
        ? <DonetickTaskFormBody controller={taskForm} />
        : editingInventoryPage
          ? <EverShelfInventoryDetailsPage controller={inventoryDetails} />
          : <DailyReportModalContent activeTab={activeTab} context={context} onEditTask={onEditTask} onOpenInventoryDetails={onOpenInventoryDetails} reloadVersion={reloadVersion} />}
    </ModalSheet>
  )
}

/** App-level summary modal. Rendered once by the shell so any route can open `#daily-report`. */
export function DailyReportModal() {
  const { closeHash, hash } = useHashModal({ appLevel: true })
  const dashboardUrl = useDashboardUrl()
  const context = useDailyReportContext()
  const noDueDateCount = useHass((state) => actionableCount(context.user ? state.entities[context.user.todoEntityIds.noDueDate]?.state : undefined))
  const [activeTab, setActiveTab] = useState<DailyReportTab>('overdue')
  const [previousOpen, setPreviousOpen] = useState(false)
  const [consumedTabUrl, setConsumedTabUrl] = useState<string | undefined>()
  const [editingTask, setEditingTask] = useState<DonetickTaskEditTarget | null>(null)
  const [inventoryDetailsTarget, setInventoryDetailsTarget] = useState<EverShelfInventoryDetailsTarget | null>(null)
  const [todoReloadVersion, setTodoReloadVersion] = useState(0)
  const open = hash === DAILY_REPORT_HASH

  // Honour the requested tab only on the transition into open, so a manual tab change sticks.
  if (open !== previousOpen) {
    setPreviousOpen(open)
    if (open) {
      const requested = dailyReportTabRequestFromUrl(dashboardUrl)
      if (requested) {
        setActiveTab(requested === DAILY_REPORT_AUTO_TAB
          ? dailyReportAutoTab({ expiredFood: context.expiredFoodCount, overdue: context.overdueCount, upcoming: context.upcomingCount + noDueDateCount })
          : requested)
        setConsumedTabUrl(dashboardUrl)
      }
    }
  }

  useEffect(() => {
    if (!consumedTabUrl) return
    clearTabRequest()
  }, [consumedTabUrl])

  const refreshTodoLists = () => {
    setTodoReloadVersion((current) => current + 1)
  }

  const finishEditing = () => {
    setEditingTask(null)
  }

  const finishInventoryDetails = () => {
    setInventoryDetailsTarget(null)
  }

  const taskForm = useDonetickTaskForm({
    active: Boolean(editingTask),
    editTarget: editingTask ?? undefined,
    onComplete: finishEditing,
    onDeleted: refreshTodoLists,
    onSaved: refreshTodoLists,
  })

  if (!open && editingTask && !taskForm.busy && !taskForm.error) setEditingTask(null)
  const openTaskEditor = (target: DonetickTaskEditTarget) => {
    setInventoryDetailsTarget(null)
    setEditingTask(target)
  }

  const openInventoryDetails = (target: EverShelfInventoryDetailsTarget) => {
    setEditingTask(null)
    setInventoryDetailsTarget(target)
  }

  return (
    <EverShelfInventoryDetailsPageHost
      active={Boolean(inventoryDetailsTarget)}
      onComplete={finishInventoryDetails}
      target={inventoryDetailsTarget}
    >
      {(inventoryDetails) => (
        <DailyReportModalView
          activeTab={activeTab}
          context={context}
          editingTask={editingTask}
          inventoryDetails={inventoryDetails}
          inventoryDetailsTarget={inventoryDetailsTarget}
          onCloseHash={closeHash}
          onEditTask={openTaskEditor}
          onOpenInventoryDetails={openInventoryDetails}
          onSetActiveTab={setActiveTab}
          onSetEditingTask={setEditingTask}
          onSetInventoryDetailsTarget={setInventoryDetailsTarget}
          open={open}
          reloadVersion={todoReloadVersion}
          taskForm={taskForm}
        />
      )}
    </EverShelfInventoryDetailsPageHost>
  )
}

function actionableCount(state: string | undefined) {
  const count = Number(state)
  return Number.isFinite(count) && count > 0 ? count : 0
}
