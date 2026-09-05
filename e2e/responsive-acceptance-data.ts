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
  { height: 741, name: 'passport-foldable-landscape', width: 1152 },
] as const

export interface SafeAreaInsets {
  bottom: number
  left: number
  right: number
  top: number
}

export type MobileHardwareClass = 'dynamic-island' | 'notch' | 'punch-hole' | 'rectangular' | 'tablet'

export interface MobileGeometryProfile {
  hardwareClass: MobileHardwareClass
  insets: SafeAreaInsets
  name: string
  note: string
  physicalMaskEmulated: false
  viewport: {
    height: number
    width: number
  }
}

export const MOBILE_GEOMETRY_PROFILES = [
  {
    hardwareClass: 'dynamic-island',
    insets: { bottom: 34, left: 0, right: 0, top: 59 },
    name: 'island-phone-portrait',
    note: 'Synthetic Dynamic-Island-class portrait stress profile.',
    physicalMaskEmulated: false,
    viewport: { height: 852, width: 393 },
  },
  {
    hardwareClass: 'dynamic-island',
    insets: { bottom: 21, left: 59, right: 44, top: 0 },
    name: 'island-phone-landscape-left',
    note: 'Synthetic asymmetric landscape profile with the larger unsafe inset on the left.',
    physicalMaskEmulated: false,
    viewport: { height: 393, width: 852 },
  },
  {
    hardwareClass: 'dynamic-island',
    insets: { bottom: 21, left: 44, right: 59, top: 0 },
    name: 'island-phone-landscape-right',
    note: 'Mirrored synthetic landscape profile proving neither horizontal side is hard-coded.',
    physicalMaskEmulated: false,
    viewport: { height: 393, width: 852 },
  },
  {
    hardwareClass: 'notch',
    insets: { bottom: 34, left: 0, right: 0, top: 47 },
    name: 'notched-phone-portrait',
    note: 'Synthetic notched-iPhone portrait stress profile.',
    physicalMaskEmulated: false,
    viewport: { height: 844, width: 390 },
  },
  {
    hardwareClass: 'notch',
    insets: { bottom: 21, left: 44, right: 44, top: 0 },
    name: 'notched-phone-landscape',
    note: 'Synthetic symmetric notched-phone landscape stress profile.',
    physicalMaskEmulated: false,
    viewport: { height: 390, width: 844 },
  },
  {
    hardwareClass: 'rectangular',
    insets: { bottom: 0, left: 0, right: 0, top: 0 },
    name: 'rectangular-phone-portrait',
    note: 'Zero-inset iPhone SE-class portrait baseline.',
    physicalMaskEmulated: false,
    viewport: { height: 667, width: 375 },
  },
  {
    hardwareClass: 'rectangular',
    insets: { bottom: 0, left: 0, right: 0, top: 0 },
    name: 'rectangular-phone-landscape',
    note: 'Zero-inset iPhone SE-class landscape baseline.',
    physicalMaskEmulated: false,
    viewport: { height: 375, width: 667 },
  },
  {
    hardwareClass: 'rectangular',
    insets: { bottom: 0, left: 0, right: 0, top: 0 },
    name: 'small-rectangular-landscape',
    note: 'Smallest supported zero-inset landscape reflow profile.',
    physicalMaskEmulated: false,
    viewport: { height: 320, width: 568 },
  },
  {
    hardwareClass: 'punch-hole',
    insets: { bottom: 24, left: 0, right: 0, top: 24 },
    name: 'android-punch-portrait',
    note: 'Synthetic Android WebView system-bar and punch-hole stress profile.',
    physicalMaskEmulated: false,
    viewport: { height: 915, width: 412 },
  },
  {
    hardwareClass: 'punch-hole',
    insets: { bottom: 24, left: 48, right: 0, top: 0 },
    name: 'android-punch-landscape-left',
    note: 'Synthetic Android landscape cutout/system-bar stress profile.',
    physicalMaskEmulated: false,
    viewport: { height: 412, width: 915 },
  },
  {
    hardwareClass: 'punch-hole',
    insets: { bottom: 24, left: 0, right: 48, top: 0 },
    name: 'android-punch-landscape-right',
    note: 'Mirrored synthetic Android landscape cutout/system-bar stress profile.',
    physicalMaskEmulated: false,
    viewport: { height: 412, width: 915 },
  },
  {
    hardwareClass: 'tablet',
    insets: { bottom: 34, left: 44, right: 44, top: 40 },
    name: 'tablet-inset-portrait',
    note: 'Synthetic tablet/multiwindow inset stress profile for centered dialogs.',
    physicalMaskEmulated: false,
    viewport: { height: 1180, width: 820 },
  },
] as const satisfies readonly MobileGeometryProfile[]

export const ROUTE_SAFE_AREA_PROFILES = MOBILE_GEOMETRY_PROFILES.filter((profile) => [
  'island-phone-portrait',
  'island-phone-landscape-left',
  'island-phone-landscape-right',
  'rectangular-phone-landscape',
  'android-punch-landscape-right',
].includes(profile.name))

export type ResponsiveRoute = (typeof RESPONSIVE_ROUTES)[number]
export type ResponsiveViewport = typeof RESPONSIVE_VIEWPORTS[number]
