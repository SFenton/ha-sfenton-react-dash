import { useMemo, useState, type CSSProperties } from 'react'
import { CountBadge } from '../core/CountBadge'
import { EmptyState } from '../core/EmptyState'
import { GlassTile } from '../core/GlassTile'
import { MaterialIcon } from '../core/Icon'
import { EverShelfInventoryPanel, type EverShelfInventoryDetailsTarget } from './EverShelfInventoryPanel'
import { useEverShelfInventoryControls } from './EverShelfInventoryControls'
import { TodoListPanel } from './TodoListPanel'
import { DAILY_REPORT_EXPIRED_FOOD_SCOPE, dailyReportExpiredFoodControls, useExpiredFoodCount, type DailyReportContext } from './dailyReportModal'
import { DAILY_REPORT_TABS, DAILY_REPORT_USERS, dailyReportRouteUrl, type DailyReportTab } from '../../constants/dailyReport'
import { dashboardHref, pushDashboardUrl } from '../../hooks/dashboardLocation'
import { useImmediateVisualTab, useSmoothDisplayedModalTab } from '../../hooks/useSmoothDisplayedModalTab'
import { VACATION_EMPTY_DESCRIPTION } from '../../constants/portedDashboard'
import type { DonetickTaskEditTarget } from './donetickTaskForm'
import styles from './DailyReportModalContent.module.css'

const NO_EXPIRED_FOOD_EMPTY_STATE = {
  description: 'Everything in the kitchen is still within date.',
  layout: 'modal',
  title: 'No Expired Food',
} as const

/** Only actionable tabs badge; upcoming chores are informational so they never get one. */
export function DailyReportModalNav({ activeTab, counts, onTabChange }: { activeTab: DailyReportTab; counts?: Partial<Record<DailyReportTab, number>>; onTabChange: (tab: DailyReportTab) => void }) {
  const { clearVisualTab, setVisualTabNow, visualActiveTab } = useImmediateVisualTab(activeTab)
  const navStyle = { '--daily-report-nav-cols': DAILY_REPORT_TABS.length } as CSSProperties

  return (
    <nav aria-label="Daily report sections" className={styles.nav} style={navStyle}>
      {DAILY_REPORT_TABS.map((item) => {
        const isActive = visualActiveTab === item.tab
        const count = counts?.[item.tab] ?? 0
        return (
          <button
            aria-current={activeTab === item.tab ? 'page' : undefined}
            aria-label={count > 0 ? `${item.label}, ${count} ${count === 1 ? 'item' : 'items'}` : item.label}
            className={styles.navButton}
            data-active={isActive}
            key={item.tab}
            onBlur={clearVisualTab}
            onClick={() => {
              setVisualTabNow(item.tab)
              onTabChange(item.tab)
            }}
            onPointerCancel={clearVisualTab}
            onPointerDown={() => setVisualTabNow(item.tab)}
            type="button"
          >
            <span className={styles.navIcon}>
              <MaterialIcon name={item.icon} size={22} />
              <CountBadge className={styles.navBadge} count={count} />
            </span>
          </button>
        )
      })}
    </nav>
  )
}

function DailyReportTodoTab({ emptyDescription, emptyTitle, entityId, onEditTask, reloadVersion, title, vacationMode }: { emptyDescription: string; emptyTitle: string; entityId: string; onEditTask: (target: DonetickTaskEditTarget) => void; reloadVersion: number; title: string; vacationMode: boolean }) {
  const [visibleItemCount, setVisibleItemCount] = useState<number | null>(null)

  return (
    <section aria-label={title} className={styles.tabSection} data-empty={visibleItemCount === 0 ? 'true' : undefined}>
      <TodoListPanel entityId={entityId} hideCompleted onEditTask={onEditTask} onVisibleItemsChange={setVisibleItemCount} reloadVersion={reloadVersion} title={title} />
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
      <EverShelfInventoryPanel controls={lockedControls} emptyState={NO_EXPIRED_FOOD_EMPTY_STATE} location="all" onOpenDetails={onOpenDetails} title="Expired Food" />
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
  const { displayedTab, transitionState } = useSmoothDisplayedModalTab(activeTab)

  if (!user) return <DailyReportUserPicker />

  return (
    <div className={styles.panel} data-modal-tab-transition-state={transitionState} data-tab={displayedTab}>
      {displayedTab === 'overdue' && <DailyReportTodoTab emptyDescription="You are all caught up on chores that slipped past their due date." emptyTitle="No Chores Due" entityId={user.todoEntityIds.overdue} onEditTask={onEditTask} reloadVersion={reloadVersion} title="Overdue Chores" vacationMode={vacationMode} />}
      {displayedTab === 'upcoming' && <DailyReportTodoTab emptyDescription="There is nothing else on your schedule for the rest of today." emptyTitle="No Chores Upcoming" entityId={user.todoEntityIds.upcoming} onEditTask={onEditTask} reloadVersion={reloadVersion} title="Upcoming Chores" vacationMode={vacationMode} />}
      {displayedTab === 'expired-food' && <DailyReportExpiredFoodTab onOpenDetails={onOpenInventoryDetails} vacationMode={vacationMode} />}
    </div>
  )
}
