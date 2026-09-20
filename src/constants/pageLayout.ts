import {
  HOME_ALL_FOOD_ROUTE_PATH,
  HOME_CABINET_ROUTE_PATH,
  HOME_FOOD_ROUTE_PATH,
  HOME_FREEZER_ROUTE_PATH,
  HOME_FRIDGE_ROUTE_PATH,
  HOME_GROCERY_LIST_ROUTE_PATH,
  HOME_PANTRY_ROUTE_PATH,
  HOME_RECIPES_ROUTE_PATH,
  HOME_SPICE_RACK_ROUTE_PATH,
  SOLO_TRIP_ROUTE_PATH,
  VACATION_MODE_ROUTE_PATH,
} from './routes'

export type PageMeasure = 'dashboard' | 'media' | 'reading'

const READING_MEASURE_PATHS = new Set([
  HOME_GROCERY_LIST_ROUTE_PATH,
  HOME_ALL_FOOD_ROUTE_PATH,
  HOME_PANTRY_ROUTE_PATH,
  HOME_FRIDGE_ROUTE_PATH,
  HOME_FREEZER_ROUTE_PATH,
  HOME_SPICE_RACK_ROUTE_PATH,
  HOME_CABINET_ROUTE_PATH,
  'chores',
  'groceries',
  'home-improvement-chores',
  'admin',
  'guests-staying-over',
  'mach-e',
  'settings',
  'special-device-modes',
  'stephens-chores',
  'stephs-chores',
  'to-do',
  'unassigned-chores',
  'vacation',
  SOLO_TRIP_ROUTE_PATH,
  VACATION_MODE_ROUTE_PATH,
])

const MEDIA_MEASURE_PATHS = new Set([
  HOME_FOOD_ROUTE_PATH,
  HOME_RECIPES_ROUTE_PATH,
])

export function pageMeasureForPath(path: string): PageMeasure {
  if (READING_MEASURE_PATHS.has(path)) return 'reading'
  if (MEDIA_MEASURE_PATHS.has(path)) return 'media'
  return 'dashboard'
}
