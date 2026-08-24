import { useEffect, useState } from 'react'
import { ModalSheet } from '../core/ModalSheet'
import { SectionHeader } from '../core/SectionHeader'
import { DailyReportModalContent, DailyReportModalNav } from './DailyReportModalContent'
import { DAILY_REPORT_MODAL_STYLE, useDailyReportContext } from './dailyReportModal'
import { DonetickTaskFormBody, DonetickTaskFormFooter } from './DonetickTaskFormPage'
import {
  EverShelfInventoryDetailsPage,
  EverShelfInventoryDetailsPageHost,
  type EverShelfInventoryDetailsTarget,
} from './EverShelfInventoryPanel'
import { useDonetickTaskForm } from './useDonetickTaskForm'
import type { DonetickTaskEditTarget } from './donetickTaskForm'
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

/** App-level summary modal. Rendered once by the shell so any route can open `#daily-report`. */
export function DailyReportModal() {
  const { closeHash, hash } = useHashModal({ appLevel: true })
  const dashboardUrl = useDashboardUrl()
  const context = useDailyReportContext()
  const [activeTab, setActiveTab] = useState<DailyReportTab>('overdue')
  const [previousOpen, setPreviousOpen] = useState(false)
  const [consumedTabUrl, setConsumedTabUrl] = useState<string | undefined>()
  const [editingTask, setEditingTask] = useState<DonetickTaskEditTarget | null>(null)
  const [inventoryDetailsTarget, setInventoryDetailsTarget] = useState<EverShelfInventoryDetailsTarget | null>(null)
  const [inventoryDetailsBusy, setInventoryDetailsBusy] = useState(false)
  const [inventoryDetailsError, setInventoryDetailsError] = useState<string | null>(null)
  const [todoReloadVersion, setTodoReloadVersion] = useState(0)
  const open = hash === DAILY_REPORT_HASH

  // Honour the requested tab only on the transition into open, so a manual tab change sticks.
  if (open !== previousOpen) {
    setPreviousOpen(open)
    if (open) {
      const requested = dailyReportTabRequestFromUrl(dashboardUrl)
      if (requested) {
        setActiveTab(requested === DAILY_REPORT_AUTO_TAB
          ? dailyReportAutoTab({ expiredFood: context.expiredFoodCount, overdue: context.overdueCount, upcoming: context.upcomingCount })
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
    setInventoryDetailsError(null)
  }

  const taskForm = useDonetickTaskForm({
    active: Boolean(editingTask),
    editTarget: editingTask ?? undefined,
    onComplete: finishEditing,
    onDeleted: refreshTodoLists,
    onSaved: refreshTodoLists,
  })

  if (!open && editingTask && !taskForm.busy && !taskForm.error) setEditingTask(null)
  if (!open && inventoryDetailsTarget && !inventoryDetailsBusy && !inventoryDetailsError) setInventoryDetailsTarget(null)

  const openTaskEditor = (target: DonetickTaskEditTarget) => {
    setInventoryDetailsTarget(null)
    setEditingTask(target)
  }

  const openInventoryDetails = (target: EverShelfInventoryDetailsTarget) => {
    setEditingTask(null)
    setInventoryDetailsBusy(false)
    setInventoryDetailsError(null)
    setInventoryDetailsTarget(target)
  }

  return (
    <EverShelfInventoryDetailsPageHost
      active={Boolean(inventoryDetailsTarget)}
      onBusyChange={setInventoryDetailsBusy}
      onComplete={finishInventoryDetails}
      onErrorChange={setInventoryDetailsError}
      target={inventoryDetailsTarget}
    >
      {(inventoryDetails) => {
        const editingTaskPage = Boolean(editingTask)
        const editingInventoryPage = Boolean(inventoryDetailsTarget)
        const detailPage = editingTaskPage || editingInventoryPage
        const detailBusy = editingTaskPage ? taskForm.busy : editingInventoryPage ? inventoryDetails.busy : false
        const modalOpen = open
          || Boolean(editingTaskPage && (taskForm.busy || taskForm.error))
          || Boolean(editingInventoryPage && (inventoryDetailsBusy || inventoryDetailsError))
        const showSummary = () => {
          if (detailBusy) return
          setEditingTask(null)
          setInventoryDetailsTarget(null)
          setInventoryDetailsError(null)
        }

        return (
          <ModalSheet
            backLabel={editingInventoryPage ? 'Back to expired food' : 'Back to daily summary'}
            bodyHeader={!detailPage && context.user ? <SectionHeader title={dailyReportTabLabel(activeTab)} /> : undefined}
            contentStyle={DAILY_REPORT_MODAL_STYLE}
            footer={editingTaskPage
              ? <DonetickTaskFormFooter controller={taskForm} />
              : undefined}
            navigation={!detailPage && context.user
              ? <DailyReportModalNav activeTab={activeTab} counts={{ 'expired-food': context.expiredFoodCount, overdue: context.overdueCount }} onTabChange={setActiveTab} />
              : undefined}
            onBack={detailPage ? showSummary : undefined}
            onClose={() => {
              if (detailBusy) return
              setEditingTask(null)
              setInventoryDetailsTarget(null)
              setInventoryDetailsError(null)
              closeHash()
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
                : <DailyReportModalContent activeTab={activeTab} context={context} onEditTask={openTaskEditor} onOpenInventoryDetails={openInventoryDetails} reloadVersion={todoReloadVersion} />}
          </ModalSheet>
        )
      }}
    </EverShelfInventoryDetailsPageHost>
  )
}
