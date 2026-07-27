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
import { VACATION_MODE_ENTITY_ID } from '../../constants/portedDashboard'
import { useDashboardUrl } from '../../hooks/useDashboardUrl'

export const DAILY_REPORT_EXPIRED_FOOD_SCOPE = 'daily-report-expired-food'

export const DAILY_REPORT_MODAL_STYLE: ModalSheetStyle = {
  '--modal-desktop-max-width': '620px',
  '--modal-desktop-width': '620px',
}

export interface DailyReportContext {
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
    const count = Number(state.entities[EVERSHELF_EXPIRED_ITEMS_ENTITY_ID]?.state)
    return Number.isFinite(count) ? count : null
  })
}

export function useDailyReportContext(): DailyReportContext {
  const dashboardUrl = useDashboardUrl()
  const haUser = useUser()
  const vacationMode = useHass((state) => state.entities[VACATION_MODE_ENTITY_ID]?.state === 'on')
  const user = dailyReportUserConfig(dailyReportUserKeyFromUrl(dashboardUrl)) ?? dailyReportUserConfigForHaUserId(haUser?.id)

  return { title: dailyReportTitle(user), user, vacationMode }
}
