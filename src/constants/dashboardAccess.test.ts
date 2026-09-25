import { HOUSEHOLD_RESIDENT } from './householdResidents'
import {
  ADMIN_TODO_ROUTE_PATH,
  isDashboardPathVisibleToResident,
  SETTINGS_ROUTE_PATH,
  visibleDashboardPathForResident,
} from './dashboardAccess'

describe('dashboard access', () => {
  it('hides only the Admin To-Do route from Steph', () => {
    expect(isDashboardPathVisibleToResident(ADMIN_TODO_ROUTE_PATH, HOUSEHOLD_RESIDENT.STEPH)).toBe(false)
    expect(visibleDashboardPathForResident(ADMIN_TODO_ROUTE_PATH, HOUSEHOLD_RESIDENT.STEPH)).toBe(SETTINGS_ROUTE_PATH)
    expect(isDashboardPathVisibleToResident(SETTINGS_ROUTE_PATH, HOUSEHOLD_RESIDENT.STEPH)).toBe(true)
    expect(isDashboardPathVisibleToResident(ADMIN_TODO_ROUTE_PATH, HOUSEHOLD_RESIDENT.STEPHEN)).toBe(true)
    expect(isDashboardPathVisibleToResident(ADMIN_TODO_ROUTE_PATH, undefined)).toBe(true)
    expect(isDashboardPathVisibleToResident(ADMIN_TODO_ROUTE_PATH, null)).toBe(true)
  })
})
