import { AREA_ITEMS } from '../../constants/atAGlance'

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

export function hasDashboardFloatingAction(path: string) {
  return path === 'overview' || Boolean(dashboardRoomNameFromPath(path)) || path === 'groceries' || createTaskDefaultAssignee(path) !== null
}
