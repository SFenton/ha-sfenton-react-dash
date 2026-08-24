import { DASHBOARD_ROUTES } from '../src/constants/routes'

export const RESPONSIVE_ROUTES = DASHBOARD_ROUTES.map((route) => route.path)
export const RESPONSIVE_ROUTE_TITLES = new Map(DASHBOARD_ROUTES.map((route) => [
  route.path,
  route.path === 'overview'
    ? 'Home'
    : route.path === 'guests-staying-over'
      ? 'Guest Controls'
      : route.title,
]))

export const RESPONSIVE_VIEWPORTS = [
  { height: 852, name: 'phone-portrait', width: 393 },
  { height: 393, name: 'phone-landscape', width: 852 },
  { height: 1180, name: 'ipad-portrait', width: 820 },
  { height: 820, name: 'ipad-landscape', width: 1180 },
  { height: 900, name: 'desktop', width: 1440 },
  { height: 1080, name: 'wide-desktop', width: 1920 },
] as const

export type ResponsiveRoute = (typeof RESPONSIVE_ROUTES)[number]
export type ResponsiveViewport = typeof RESPONSIVE_VIEWPORTS[number]
