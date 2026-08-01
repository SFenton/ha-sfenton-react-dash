import { useEffect, useState } from 'react'
import { ModalSheet } from '../core/ModalSheet'
import { SectionHeader } from '../core/SectionHeader'
import { DailyReportModalContent, DailyReportModalNav } from './DailyReportModalContent'
import { DAILY_REPORT_MODAL_STYLE, useDailyReportContext } from './dailyReportModal'
import { DonetickTaskFormBody, DonetickTaskFormFooter } from './DonetickTaskFormPage'
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

  const taskForm = useDonetickTaskForm({
    active: Boolean(editingTask),
    editTarget: editingTask ?? undefined,
    onComplete: finishEditing,
    onDeleted: refreshTodoLists,
    onSaved: refreshTodoLists,
  })

  if (!open && editingTask && !taskForm.busy && !taskForm.error) setEditingTask(null)

  const openTaskEditor = (target: DonetickTaskEditTarget) => {
    setEditingTask(target)
  }

  const showSummary = () => {
    if (!taskForm.busy) setEditingTask(null)
  }

  const editing = Boolean(editingTask)
  const modalOpen = open || Boolean(editingTask && (taskForm.busy || taskForm.error))

  return (
    <ModalSheet
      backLabel="Back to daily summary"
      bodyHeader={!editing && context.user ? <SectionHeader title={dailyReportTabLabel(activeTab)} /> : undefined}
      contentStyle={DAILY_REPORT_MODAL_STYLE}
      footer={editing
        ? <DonetickTaskFormFooter controller={taskForm} />
        : context.user
          ? <DailyReportModalNav activeTab={activeTab} counts={{ 'expired-food': context.expiredFoodCount, overdue: context.overdueCount }} onTabChange={setActiveTab} />
          : undefined}
      onBack={editing ? showSummary : undefined}
      onClose={() => {
        if (taskForm.busy) return
        setEditingTask(null)
        closeHash()
      }}
      open={modalOpen}
      scrollResetKey={editing ? `task-${editingTask?.taskId ?? ''}` : activeTab}
      title={editing ? 'Edit Task' : context.title}
    >
      {editing
        ? <DonetickTaskFormBody controller={taskForm} />
        : (
        <DailyReportModalContent activeTab={activeTab} context={context} onEditTask={openTaskEditor} reloadVersion={todoReloadVersion} />
          )}
    </ModalSheet>
  )
}
