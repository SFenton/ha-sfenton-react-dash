import { useMemo, useState, type CSSProperties } from 'react'
import { Description } from '../core/Description'
import { EmptyState } from '../core/EmptyState'
import { GlassTile } from '../core/GlassTile'
import { MaterialIcon } from '../core/Icon'
import { EverShelfInventoryPanel } from './EverShelfInventoryPanel'
import { useEverShelfInventoryControls } from './EverShelfInventoryControls'
import { TodoListPanel } from './TodoListPanel'
import { DAILY_REPORT_EXPIRED_FOOD_SCOPE, dailyReportExpiredFoodControls, type DailyReportContext } from './dailyReportModal'
import { DAILY_REPORT_TABS, DAILY_REPORT_USERS, dailyReportRouteUrl, type DailyReportTab } from '../../constants/dailyReport'
import { dashboardHref, pushDashboardUrl } from '../../hooks/dashboardLocation'
import { useImmediateVisualTab, useSmoothDisplayedModalTab } from '../../hooks/useSmoothDisplayedModalTab'
import styles from './DailyReportModalContent.module.css'

export function DailyReportModalNav({ activeTab, onTabChange }: { activeTab: DailyReportTab; onTabChange: (tab: DailyReportTab) => void }) {
  const { clearVisualTab, setVisualTabNow, visualActiveTab } = useImmediateVisualTab(activeTab)
  const navStyle = { '--daily-report-nav-cols': DAILY_REPORT_TABS.length } as CSSProperties

  return (
    <nav aria-label="Daily report sections" className={styles.nav} style={navStyle}>
      {DAILY_REPORT_TABS.map((item) => {
        const isActive = visualActiveTab === item.tab
        return (
          <button
            aria-current={activeTab === item.tab ? 'page' : undefined}
            aria-label={item.label}
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
            <MaterialIcon name={item.icon} size={22} />
          </button>
        )
      })}
    </nav>
  )
}

function DailyReportTodoTab({ emptyLabel, entityId, title }: { emptyLabel: string; entityId: string; title: string }) {
  const [visibleItemCount, setVisibleItemCount] = useState<number | null>(null)

  return (
    <section aria-label={title} className={styles.tabSection}>
      <TodoListPanel entityId={entityId} hideCompleted onVisibleItemsChange={setVisibleItemCount} title={title} />
      {visibleItemCount === 0 && <Description className={styles.tabEmpty}>{emptyLabel}</Description>}
    </section>
  )
}

function DailyReportExpiredFoodTab() {
  const controls = useEverShelfInventoryControls(DAILY_REPORT_EXPIRED_FOOD_SCOPE)
  const lockedControls = useMemo(() => dailyReportExpiredFoodControls(controls), [controls])

  return (
    <section aria-label="Expired Food" className={styles.tabSection}>
      <EverShelfInventoryPanel controls={lockedControls} emptyFilteredMessage="Nothing has passed its expiration date." location="all" title="Expired Food" />
    </section>
  )
}

function DailyReportUserPicker() {
  return (
    <div className={styles.picker}>
      <EmptyState description="This summary is personalized. Pick whose summary to open, or use the deep link from the morning or evening summary notification." title="Whose summary?" />
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

export function DailyReportModalContent({ activeTab, context }: { activeTab: DailyReportTab; context: DailyReportContext }) {
  const { user } = context
  const { displayedTab, transitionState } = useSmoothDisplayedModalTab(activeTab)

  if (!user) return <DailyReportUserPicker />

  return (
    <div className={styles.panel} data-modal-tab-transition-state={transitionState} data-tab={displayedTab}>
      {displayedTab === 'overdue' && <DailyReportTodoTab emptyLabel="Nothing is overdue. Nice work." entityId={user.todoEntityIds.overdue} title="Overdue Chores" />}
      {displayedTab === 'upcoming' && <DailyReportTodoTab emptyLabel="Nothing else is scheduled for today." entityId={user.todoEntityIds.upcoming} title="Upcoming Chores" />}
      {displayedTab === 'expired-food' && <DailyReportExpiredFoodTab />}
    </div>
  )
}
