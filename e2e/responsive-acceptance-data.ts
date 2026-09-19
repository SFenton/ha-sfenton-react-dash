import { DASHBOARD_ROUTES, SOLO_TRIP_ROUTE_PATH, VACATION_MODE_ROUTE_PATH } from '../src/constants/routes'

const AUXILIARY_RESPONSIVE_ROUTES = [
  { path: SOLO_TRIP_ROUTE_PATH, title: 'Solo Trip' },
  { path: VACATION_MODE_ROUTE_PATH, title: 'Vacation Mode' },
] as const

const RESPONSIVE_ROUTE_ENTRIES = [
  ...DASHBOARD_ROUTES.map((route) => ({
    path: route.path,
    title: route.path === 'overview'
      ? 'Home'
      : route.path === 'guests-staying-over'
        ? 'Guest Controls'
        : route.title,
  })),
  ...AUXILIARY_RESPONSIVE_ROUTES,
] as const

export const RESPONSIVE_ROUTES = RESPONSIVE_ROUTE_ENTRIES.map((route) => route.path)
export const RESPONSIVE_ROUTE_TITLES = new Map(RESPONSIVE_ROUTE_ENTRIES.map((route) => [
  route.path,
  route.path === 'stephens-chores' ? 'Your Chores' : route.title,
]))

export const VIEWPORTS = {
  'phone-portrait': { height: 852, name: 'phone-portrait', width: 393 },
  'phone-landscape': { height: 393, name: 'phone-landscape', width: 852 },
  'ipad-portrait': { height: 1180, name: 'ipad-portrait', width: 820 },
  'ipad-landscape': { height: 820, name: 'ipad-landscape', width: 1180 },
  desktop: { height: 900, name: 'desktop', width: 1440 },
  'wide-desktop': { height: 1080, name: 'wide-desktop', width: 1920 },
  'passport-foldable-landscape': { height: 741, name: 'passport-foldable-landscape', width: 1152 },
  'square-foldable-landscape': { height: 836, name: 'square-foldable-landscape', width: 842 },
  'passport-foldable-portrait': { height: 1152, name: 'passport-foldable-portrait', width: 741 },
} as const

export const CANONICAL_VIEWPORT_NAMES = [
  'phone-portrait', 'phone-landscape', 'passport-foldable-landscape', 'square-foldable-landscape',
  'ipad-portrait', 'ipad-landscape', 'desktop', 'wide-desktop',
] as const

// The broad sweep intentionally uses one compact-wide representative.
export const RESPONSIVE_VIEWPORTS = [
  VIEWPORTS['phone-portrait'], VIEWPORTS['phone-landscape'], VIEWPORTS['ipad-portrait'],
  VIEWPORTS['ipad-landscape'], VIEWPORTS.desktop, VIEWPORTS['wide-desktop'],
  VIEWPORTS['passport-foldable-landscape'],
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

export const LAYOUT_PROFILES: Record<string, { viewport: { width: number; height: number }; insets: SafeAreaInsets }> = {
  ...Object.fromEntries(Object.entries(VIEWPORTS).map(([name, viewport]) => [
    name, { viewport, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
  ])),
  ...Object.fromEntries(MOBILE_GEOMETRY_PROFILES.map(({ name, viewport, insets }) => [name, { viewport, insets }])),
  'intermediate-landscape': { viewport: { width: 734, height: 343 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
  'rail-below': { viewport: { width: 1119, height: 819 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
  'rail-at': { viewport: { width: 1120, height: 820 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
  'rail-above': { viewport: { width: 1121, height: 821 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
  'dialog-block-798': { viewport: { width: 1152, height: 798 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
  'dialog-block-799': { viewport: { width: 1152, height: 799 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
  'dialog-block-800': { viewport: { width: 1152, height: 800 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } },
}

export function layoutProfile(name: string) {
  const profile = LAYOUT_PROFILES[name]
  if (!profile) throw new Error(`Unknown layout profile: ${name}`)
  return profile
}

export const LAYOUT_JOURNEYS = {
  modal: [
    'island-phone-portrait', 'island-phone-landscape-left', 'island-phone-landscape-right',
    'rectangular-phone-landscape', 'small-rectangular-landscape', 'intermediate-landscape',
    'ipad-portrait', 'ipad-landscape', 'passport-foldable-landscape', 'square-foldable-landscape',
    'desktop', 'wide-desktop', 'island-phone-portrait',
  ],
  navigation: [
    'phone-portrait', 'phone-landscape', 'phone-portrait', 'desktop', 'phone-portrait',
    'ipad-portrait', 'ipad-landscape', 'ipad-portrait',
    'passport-foldable-portrait', 'passport-foldable-landscape', 'passport-foldable-portrait',
    'square-foldable-landscape', 'rail-below', 'rail-at', 'rail-above', 'wide-desktop', 'phone-portrait',
  ],
} as const
