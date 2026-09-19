import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  NAVIGATION_RAIL_QUERY,
  NAVIGATION_SHORT_LANDSCAPE_QUERY,
  NAVIGATION_WIDE_QUERY,
  navigationLayoutForViewport,
  navigationLayoutFromMatches,
  type NavigationLayout,
} from './navigationLayout'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

describe('navigationLayoutForViewport', () => {
  it.each([
    [{ width: 393, height: 852 }, 'bottom'],
    [{ width: 852, height: 393 }, 'drawer-only'],
    [{ width: 842, height: 836 }, 'bottom'],
    [{ width: 1152, height: 741 }, 'drawer-only'],
    [{ width: 1180, height: 820 }, 'rail'],
    [{ width: 1440, height: 900 }, 'rail'],
    [{ width: 1119, height: 819 }, 'bottom'],
    [{ width: 1119, height: 820 }, 'bottom'],
    [{ width: 1120, height: 819 }, 'drawer-only'],
    [{ width: 1120, height: 820 }, 'rail'],
    [{ width: 1121, height: 820 }, 'rail'],
    [{ width: 1120, height: 821 }, 'rail'],
    [{ width: 1119, height: 500 }, 'drawer-only'],
    [{ width: 1119, height: 501 }, 'bottom'],
    [{ width: 1120, height: 500 }, 'drawer-only'],
    [{ width: 1120, height: 501 }, 'drawer-only'],
    [{ width: 500, height: 500 }, 'bottom'],
  ] satisfies Array<[{ height: number, width: number }, NavigationLayout]>)(
    'classifies $0 as $1',
    (viewport, expected) => {
      expect(navigationLayoutForViewport(viewport)).toBe(expected)
    },
  )

  it('uses the same precedence for media-query matches', () => {
    expect(navigationLayoutFromMatches({ duo: true, rail: true, shortLandscape: true, wide: true })).toBe('duo')
    expect(navigationLayoutFromMatches({ rail: true, shortLandscape: true, wide: true })).toBe('rail')
    expect(navigationLayoutFromMatches({ rail: false, shortLandscape: false, wide: true })).toBe('drawer-only')
    expect(navigationLayoutFromMatches({ rail: false, shortLandscape: true, wide: false })).toBe('drawer-only')
    expect(navigationLayoutFromMatches({ rail: false, shortLandscape: false, wide: false })).toBe('bottom')
  })

  it('lets a verified Duo profile override ordinary viewport breakpoints', () => {
    expect(navigationLayoutForViewport({ height: 626, width: 890 }, true)).toBe('duo')
    expect(navigationLayoutForViewport({ height: 678, width: 466 }, true)).toBe('duo')
  })

  it('exports the exact media queries used by the viewport store', () => {
    expect(NAVIGATION_WIDE_QUERY).toBe('(min-width: 1120px)')
    expect(NAVIGATION_RAIL_QUERY).toBe('(min-width: 1120px) and (min-height: 820px)')
    expect(NAVIGATION_SHORT_LANDSCAPE_QUERY).toBe('(orientation: landscape) and (max-height: 500px)')
  })

  it('keeps navigation breakpoint literals out of shell components and styles', () => {
    const shellFiles = [
      'src/components/shell/AdaptiveNavigation.module.css',
      'src/components/shell/AdaptiveNavigation.tsx',
      'src/components/shell/AppHeader.module.css',
      'src/components/shell/AppHeader.tsx',
      'src/components/shell/AppShell.module.css',
      'src/components/shell/AppShell.tsx',
      'src/components/shell/BottomNav.module.css',
      'src/components/shell/BottomNav.tsx',
      'src/components/shell/NavigationLayoutContext.ts',
    ]

    for (const relativePath of shellFiles) {
      const source = fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8')
      expect(source, relativePath).not.toMatch(/\b(?:1119|1120|819|820)px\b/)
    }
  })
})
