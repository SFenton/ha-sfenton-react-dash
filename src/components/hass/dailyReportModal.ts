import { useUser } from '@hakit/core'
import type { ModalSheetStyle } from '../core/ModalSheet'
import type { EverShelfInventoryControls } from './EverShelfInventoryControls'
import {
  dailyReportTitle,
  dailyReportUserConfig,
  dailyReportUserConfigForHaUserId,
  dailyReportUserKeyFromUrl,
  type DailyReportUserConfig,
} from '../../constants/dailyReport'
import { useDashboardUrl } from '../../hooks/useDashboardUrl'

export const DAILY_REPORT_EXPIRED_FOOD_SCOPE = 'daily-report-expired-food'

export const DAILY_REPORT_MODAL_STYLE: ModalSheetStyle = {
  '--modal-desktop-max-width': '620px',
  '--modal-desktop-width': '620px',
}

export interface DailyReportContext {
  title: string
  user: DailyReportUserConfig | undefined
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

export function useDailyReportContext(): DailyReportContext {
  const dashboardUrl = useDashboardUrl()
  const haUser = useUser()
  const user = dailyReportUserConfig(dailyReportUserKeyFromUrl(dashboardUrl)) ?? dailyReportUserConfigForHaUserId(haUser?.id)

  return { title: dailyReportTitle(user), user }
}
