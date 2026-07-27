import { useHass, useUser } from '@hakit/core'
import type { ModalSheetStyle } from '../core/ModalSheet'
import type { EverShelfInventoryControls } from './EverShelfInventoryControls'
import {
  EVERSHELF_EXPIRED_ITEMS_ENTITY_ID,
  dailyReportTitle,
  dailyReportUserConfig,
  dailyReportUserConfigForHaUserId,
  dailyReportUserKeyFromUrl,
  type DailyReportUserConfig,
} from '../../constants/dailyReport'
import { countLocallyExpired } from './expiryDate'
import { VACATION_MODE_ENTITY_ID } from '../../constants/portedDashboard'
import { useDashboardUrl } from '../../hooks/useDashboardUrl'

export const DAILY_REPORT_EXPIRED_FOOD_SCOPE = 'daily-report-expired-food'

export const DAILY_REPORT_MODAL_STYLE: ModalSheetStyle = {
  '--modal-desktop-max-width': '620px',
  '--modal-desktop-width': '620px',
}

export interface DailyReportContext {
  /** Overdue chores plus expired food; upcoming chores are deliberately excluded. */
  badgeCount: number
  expiredFoodCount: number
  overdueCount: number
  upcomingCount: number
  title: string
  user: DailyReportUserConfig | undefined
  vacationMode: boolean
}

/** Locks the shared inventory controls to the expired filter so the report reuses the food page row UX. */
export function dailyReportExpiredFoodControls(controls: EverShelfInventoryControls): EverShelfInventoryControls {
  return {
    ...controls,
    debouncedSearchQuery: '',
    filterActive: true,
    filterMode: 'expired',
    searchActive: false,
    searchQuery: '',
    sortDirection: 'ascending',
    sortMode: 'expiry',
  }
}

export function useExpiredFoodCount() {
  return useHass((state) => {
    const entity = state.entities[EVERSHELF_EXPIRED_ITEMS_ENTITY_ID]
    if (!entity) return null
    return countLocallyExpired(entity.attributes?.expired_list)
  })
}

function actionableCount(state: string | undefined) {
  const count = Number(state)
  return Number.isFinite(count) && count > 0 ? count : 0
}

export function useDailyReportContext(): DailyReportContext {
  const dashboardUrl = useDashboardUrl()
  const haUser = useUser()
  const vacationMode = useHass((state) => state.entities[VACATION_MODE_ENTITY_ID]?.state === 'on')
  const user = dailyReportUserConfig(dailyReportUserKeyFromUrl(dashboardUrl)) ?? dailyReportUserConfigForHaUserId(haUser?.id)
  const overdueCount = useHass((state) => actionableCount(user ? state.entities[user.todoEntityIds.overdue]?.state : undefined))
  const upcomingCount = useHass((state) => actionableCount(user ? state.entities[user.todoEntityIds.upcoming]?.state : undefined))
  // Vacation puts expired food on hold, so it must not nag from the badge either.
  const expiredFoodCount = useHass((state) => (vacationMode ? 0 : countLocallyExpired(state.entities[EVERSHELF_EXPIRED_ITEMS_ENTITY_ID]?.attributes?.expired_list)))

  const scopedOverdueCount = user ? overdueCount : 0
  const scopedExpiredFoodCount = user ? expiredFoodCount : 0

  return {
    badgeCount: scopedOverdueCount + scopedExpiredFoodCount,
    expiredFoodCount: scopedExpiredFoodCount,
    overdueCount: scopedOverdueCount,
    title: dailyReportTitle(user),
    upcomingCount: user ? upcomingCount : 0,
    user,
    vacationMode,
  }
}
