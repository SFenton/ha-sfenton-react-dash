import { AREA_ITEMS } from '../../constants/atAGlance'
import { HOME_ALL_FOOD_ROUTE_PATH, HOME_CABINET_ROUTE_PATH, HOME_FOOD_ROUTE_PATH, HOME_FREEZER_ROUTE_PATH, HOME_FRIDGE_ROUTE_PATH, HOME_GROCERY_LIST_ROUTE_PATH, HOME_PANTRY_ROUTE_PATH, HOME_SPICE_RACK_ROUTE_PATH } from '../../constants/routes'

export function dashboardRoomNameFromPath(path: string) {
  return AREA_ITEMS.find((area) => area.route.endsWith(`/${path}`))?.title
}

export function createTaskDefaultAssignee(path: string) {
  if (path === 'chores' || path === 'unassigned-chores') return ''
  if (path === 'stephens-chores') return '1'
  if (path === 'stephs-chores') return '2'
  if (path === 'home-improvement-chores') return '3'
  return null
}

export function isEverShelfInventoryRoute(path: string) {
  return path === HOME_ALL_FOOD_ROUTE_PATH || path === HOME_PANTRY_ROUTE_PATH || path === HOME_FRIDGE_ROUTE_PATH || path === HOME_FREEZER_ROUTE_PATH || path === HOME_SPICE_RACK_ROUTE_PATH || path === HOME_CABINET_ROUTE_PATH
}

export function hasDashboardFloatingAction(path: string) {
  return path === 'overview' || Boolean(dashboardRoomNameFromPath(path)) || path === 'groceries' || path === HOME_GROCERY_LIST_ROUTE_PATH || path === HOME_FOOD_ROUTE_PATH || isEverShelfInventoryRoute(path) || createTaskDefaultAssignee(path) !== null
}
