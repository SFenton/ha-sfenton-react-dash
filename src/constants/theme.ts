/**
 * Shared design tokens ported from FortniteFestivalWeb's `@festival/theme`.
 *
 * These mirror the mobile-app look (system font stack, icon sizes, header/nav
 * typography) so dashboard headers, navigation, and controls share one source
 * of truth. Values are in px unless noted.
 */

/** System font stack — no web fonts, matches the native iOS/Android feel. */
export const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

/** Font sizes (px). */
export const Font = {
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  title: 22,
  '2xl': 24,
  display: 28,
  letterSpacingWide: 0.5,
} as const

/** Font weights. */
export const Weight = {
  normal: 400,
  semibold: 600,
  bold: 700,
  heavy: 800,
} as const

/** Line heights (px for fixed, unitless for ratios). */
export const LineHeight = {
  none: 0,
  sm: 16,
  md: 18,
  lg: 20,
  snug: 1.4,
  relaxed: 1.5,
  loose: 1.6,
} as const

/** Icon sizes (px). */
export const IconSize = {
  xs: 14,
  action: 16,
  chevron: 16,
  default: 20,
  tab: 20,
  back: 22,
  nav: 22,
  sm: 24,
  md: 28,
  profile: 32,
  lg: 40,
  xl: 48,
  fab: 18,
} as const

/** Spacing scale (px). */
export const Gap = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 8,
  lg: 10,
  xl: 12,
  section: 24,
  container: 64,
} as const

/** Corner radii (px). */
export const Radius = {
  xs: 8,
  sm: 10,
  md: 12,
  lg: 16,
  full: 999,
} as const

/** Shared touch-target / layout sizes (px). */
export const Layout = {
  /** Minimum comfortable touch target (hamburger, header action buttons). */
  thumb: 44,
  paddingHorizontal: 20,
  paddingTop: 16,
  paddingBottom: 4,
  /** Fixed width for the leading icon cell in mobile headers. */
  headerIconSlot: 28,
  /** Negative left margin for mobile header icon optical alignment. */
  headerIconNudge: -6,
  entryRowHeight: 48,
} as const

/** Z-index scale. */
export const ZIndex = {
  base: 1,
  overlay: 2,
  dropdown: 10,
  fixedFooter: 50,
  popover: 100,
  modalOverlay: 1000,
} as const

/** Subset of FFW color tokens relevant to chrome (text/nav/glass). */
export const Colors = {
  textPrimary: '#FFFFFF',
  textSecondary: '#D7DEE8',
  textTertiary: '#9AA6B2',
  textSubtle: '#B8C0CC',
  accentPurple: '#7C3AED',
  glassBorder: 'rgba(255,255,255,0.08)',
  glassNav: 'rgba(11,3,24,0.40)',
  surfaceFrosted: 'rgba(11,3,24,0.85)',
} as const
