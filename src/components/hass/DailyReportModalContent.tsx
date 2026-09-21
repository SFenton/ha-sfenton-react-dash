import { useMemo, useState } from 'react'
import { EmptyState } from '../core/EmptyState'
import { GlassTile } from '../core/GlassTile'
import { ModalIconTabNav } from '../core/ModalTabNav'
import { SectionHeader } from '../core/SectionHeader'
import { modalTabId, modalTabPanelId } from '../core/modalTabIds'
import { EverShelfInventoryPanel, type EverShelfInventoryDetailsTarget } from './EverShelfInventoryPanel'
import { useEverShelfInventoryControls } from './EverShelfInventoryControls'
import { TodoListPanel } from './TodoListPanel'
import { DAILY_REPORT_EXPIRED_FOOD_SCOPE, dailyReportExpiredFoodControls, useExpiredFoodCount, type DailyReportContext } from './dailyReportModal'
import { DAILY_REPORT_TABS, DAILY_REPORT_USERS, dailyReportRouteUrl, type DailyReportTab } from '../../constants/dailyReport'
import { dashboardHref, pushDashboardUrl } from '../../hooks/dashboardLocation'
import { TODO_PAGES, VACATION_EMPTY_DESCRIPTION } from '../../constants/portedDashboard'
import { CORE_COPY_KEYS, CORE_COPY_NAMESPACE, useCopy } from '../../i18n'
import type { DonetickTaskEditTarget } from './donetickTaskForm'
import styles from './DailyReportModalContent.module.css'
const NO_EXPIRED_FOOD_EMPTY_STATE = {
  description: 'Everything in the kitchen is still within date.',
  layout: 'modal',
  title: 'No Expired Food',
} as const
const DAILY_REPORT_TAB_ID_PREFIX = 'daily-report'
const DAILY_REPORT_TAB_PANEL_ID = modalTabPanelId(DAILY_REPORT_TAB_ID_PREFIX, 'content')

/** Only actionable tabs badge; upcoming chores are informational so they never get one. */
export function DailyReportModalNav({ activeTab, counts, onTabChange }: { activeTab: DailyReportTab; counts?: Partial<Record<DailyReportTab, number>>; onTabChange: (tab: DailyReportTab) => void }) {
  const copy = useCopy(CORE_COPY_NAMESPACE)

  return (
    <ModalIconTabNav
      activeTab={activeTab}
      idPrefix={DAILY_REPORT_TAB_ID_PREFIX}
      label={copy(CORE_COPY_KEYS.modal.dailyReportSections)}
      onTabChange={onTabChange}
      panelId={DAILY_REPORT_TAB_PANEL_ID}
      tabs={DAILY_REPORT_TABS.map((item) => {
        const count = counts?.[item.tab] ?? 0
        return {
          ...item,
          ariaLabel: count > 0 ? copy(CORE_COPY_KEYS.modal.tabItemCount, { count, label: item.label }) : item.label,
          badgeCount: count,
        }
      })}
    />
  )
}

function DailyReportTodoTab({ emptyDescription, emptyTitle, entityId, onEditTask, reloadVersion, title, vacationMode }: { emptyDescription: string; emptyTitle: string; entityId: string; onEditTask: (target: DonetickTaskEditTarget) => void; reloadVersion: number; title: string; vacationMode: boolean }) {
  const [visibleItemCount, setVisibleItemCount] = useState<number | null>(null)

  return (
    <section aria-label={title} className={styles.tabSection} data-empty={visibleItemCount === 0 ? 'true' : undefined}>
      <TodoListPanel entityId={entityId} hideCompleted layout="responsive-grid" onEditTask={onEditTask} onVisibleItemsChange={setVisibleItemCount} reloadVersion={reloadVersion} rowVariant="summary" title={title} />
      {visibleItemCount === 0 && (
        <EmptyState description={vacationMode ? VACATION_EMPTY_DESCRIPTION : emptyDescription} layout="modal" title={emptyTitle} />
      )}
    </section>
  )
}

function DailyReportExpiredFoodTab({ onOpenDetails, vacationMode }: { onOpenDetails: (target: EverShelfInventoryDetailsTarget) => void; vacationMode: boolean }) {
  const controls = useEverShelfInventoryControls(DAILY_REPORT_EXPIRED_FOOD_SCOPE)
  const lockedControls = useMemo(() => dailyReportExpiredFoodControls(controls), [controls])
  const expiredCount = useExpiredFoodCount()

  // Nothing in the kitchen can be dealt with from away, so vacation suppresses the list entirely.
  // Only claim there is none when the count is a confirmed zero; an unavailable sensor stays "hidden".
  if (vacationMode) {
    return (
      <section aria-label="Expired Food" className={styles.tabSection}>
        <EmptyState description={VACATION_EMPTY_DESCRIPTION} layout="modal" title={expiredCount === 0 ? 'No Expired Food' : 'Expired Food Hidden'} />
      </section>
    )
  }

  if (expiredCount === 0) {
    return (
      <section aria-label="Expired Food" className={styles.tabSection}>
        <EmptyState {...NO_EXPIRED_FOOD_EMPTY_STATE} />
      </section>
    )
  }

  return (
    <section aria-label="Expired Food" className={styles.tabSection}>
      <EverShelfInventoryPanel controls={lockedControls} emptyState={NO_EXPIRED_FOOD_EMPTY_STATE} layout="responsive-grid" location="all" onOpenDetails={onOpenDetails} rowVariant="summary" title="Expired Food" />
    </section>
  )
}

function DailyReportUserPicker() {
  return (
    <div className={styles.picker}>
      <EmptyState description="This summary is personalized. Pick whose summary to open, or use the deep link from the morning or evening summary notification." layout="compact" title="Whose Summary?" />
      <div className={styles.pickerGrid}>
        {DAILY_REPORT_USERS.map((user) => (
          <GlassTile
            backgroundColor={`rgba(${user.color.r}, ${user.color.g}, ${user.color.b}, 0.72)`}
            icon="mdi:account-check"
            key={user.key}
            onClick={() => pushDashboardUrl(dailyReportRouteUrl(user.key, dashboardHref()))}
            title={user.name}
          />
        ))}
      </div>
    </div>
  )
}

export function DailyReportModalContent({ activeTab, context, onEditTask, onOpenInventoryDetails, reloadVersion }: { activeTab: DailyReportTab; context: DailyReportContext; onEditTask: (target: DonetickTaskEditTarget) => void; onOpenInventoryDetails: (target: EverShelfInventoryDetailsTarget) => void; reloadVersion: number }) {
  const { user, vacationMode } = context

  if (!user) return <DailyReportUserPicker />

  return (
    <div aria-labelledby={modalTabId(DAILY_REPORT_TAB_ID_PREFIX, activeTab)} className={styles.panel} data-tab={activeTab} id={DAILY_REPORT_TAB_PANEL_ID} role="tabpanel">
      {activeTab === 'overdue' && <DailyReportTodoTab emptyDescription="You are all caught up on chores that slipped past their due date." emptyTitle="No Chores Due" entityId={user.todoEntityIds.overdue} onEditTask={onEditTask} reloadVersion={reloadVersion} title="Overdue Chores" vacationMode={vacationMode} />}
      {activeTab === 'upcoming' && <DailyReportUpcomingTab emptyDescription="There is nothing else on your schedule for the rest of today." emptyTitle="No Chores Upcoming" noDueDateEntityId={user.todoEntityIds.noDueDate} noDueDateTitle={dailyReportNoDueDateTitle(user.choresPath)} onEditTask={onEditTask} reloadVersion={reloadVersion} title="Upcoming Chores" upcomingEntityId={user.todoEntityIds.upcoming} vacationMode={vacationMode} />}
      {activeTab === 'expired-food' && <DailyReportExpiredFoodTab onOpenDetails={onOpenInventoryDetails} vacationMode={vacationMode} />}
    </div>
  )
}

function dailyReportNoDueDateTitle(choresPath: string) {
  return TODO_PAGES[choresPath].lists.find((list) => list.countBucket === 'no-due-date')!.title
}

function DailyReportUpcomingTab({ emptyDescription, emptyTitle, noDueDateEntityId, noDueDateTitle, onEditTask, reloadVersion, title, upcomingEntityId, vacationMode }: { emptyDescription: string; emptyTitle: string; noDueDateEntityId: string; noDueDateTitle: string; onEditTask: (target: DonetickTaskEditTarget) => void; reloadVersion: number; title: string; upcomingEntityId: string; vacationMode: boolean }) {
  const [upcomingItemCount, setUpcomingItemCount] = useState<number | null>(null)
  const [noDueDateItemCount, setNoDueDateItemCount] = useState<number | null>(null)
  const [upcomingError, setUpcomingError] = useState(false)
  const [noDueDateError, setNoDueDateError] = useState(false)
  const empty = upcomingItemCount === 0 && noDueDateItemCount === 0 && !upcomingError && !noDueDateError

  return (
    <section aria-label={title} className={styles.tabSection} data-empty={empty ? 'true' : undefined}>
      <div data-daily-report-todo-section="upcoming" hidden={upcomingItemCount === 0 && !upcomingError}>
        <TodoListPanel entityId={upcomingEntityId} hideCompleted layout="responsive-grid" onEditTask={onEditTask} onErrorChange={setUpcomingError} onVisibleItemsChange={setUpcomingItemCount} reloadVersion={reloadVersion} rowVariant="summary" title={title} />
      </div>
      <section aria-label={noDueDateTitle} data-daily-report-todo-section="no-due-date" hidden={noDueDateItemCount === 0 && !noDueDateError}>
        <SectionHeader className={styles.summarySectionHeader} title={noDueDateTitle} />
        <TodoListPanel entityId={noDueDateEntityId} hideCompleted layout="responsive-grid" onEditTask={onEditTask} onErrorChange={setNoDueDateError} onVisibleItemsChange={setNoDueDateItemCount} reloadVersion={reloadVersion} rowVariant="summary" title={noDueDateTitle} />
      </section>
      {empty && <EmptyState description={vacationMode ? VACATION_EMPTY_DESCRIPTION : emptyDescription} layout="modal" title={emptyTitle} />}
    </section>
  )
}
