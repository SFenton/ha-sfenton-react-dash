import i18n from './init'
import { copy, copyRef, resolveCopy } from './copy'
import { formatList, formatNumber } from './formatters'

describe('copy runtime', () => {
  it('resolves modular English keys', () => {
    expect(copy('common', 'actions.apply')).toBe('Apply')
    expect(copy('shell', 'navigation.dashboardSections')).toBe('Dashboard sections')
  })

  it('supports interpolation and English plurals', () => {
    expect(copy('pageFood', 'inventory.items', { count: 1 })).toBe('1 Item')
    expect(copy('pageFood', 'inventory.items', { count: 3 })).toBe('3 Items')
    expect(copy('pageSecurity', 'controls.setMode', { mode: 'Night' })).toBe('Set security system to Night')
  })

  it('resolves typed copy references', () => {
    expect(resolveCopy(copyRef('modalCamera', 'controls', { title: 'Front Door' }))).toBe('Front Door camera controls')
  })

  it('fails loudly for a missing key in tests', () => {
    expect(() => copy('common', 'missing.key' as never)).toThrow('Invalid copy (missing key): common:missing.key')
  })

  it('fails before i18next can erase missing interpolation tokens', () => {
    expect(() => copy('modalCamera', 'controls')).toThrow('Invalid copy (missing interpolation value): modalCamera:controls')
    expect(() => copy('modalCamera', 'controls', { title: undefined })).toThrow('Invalid copy (missing interpolation value): modalCamera:controls')
  })

  it('uses only eagerly bundled English resources', () => {
    expect(i18n.language).toBe('en')
    expect(i18n.options.supportedLngs).toContain('en')
    expect(i18n.options.react?.useSuspense).toBe(false)
  })

  it('uses shared locale-aware formatters', () => {
    expect(formatNumber(1234)).toBe('1,234')
    expect(formatList(['Lights', 'Climate', 'Security'])).toBe('Lights, Climate, and Security')
  })
})
