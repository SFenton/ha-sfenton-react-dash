import { HOUSEHOLD_RESIDENT, type HouseholdResident } from './householdResidents'

export const ADMIN_TODO_ROUTE_PATH = 'to-do'
export const SETTINGS_ROUTE_PATH = 'settings'

export function isDashboardPathVisibleToResident(path: string, resident: HouseholdResident | null | undefined) {
  return path !== ADMIN_TODO_ROUTE_PATH || resident !== HOUSEHOLD_RESIDENT.STEPH
}

export function visibleDashboardPathForResident(path: string, resident: HouseholdResident | null | undefined) {
  return isDashboardPathVisibleToResident(path, resident) ? path : SETTINGS_ROUTE_PATH
}
