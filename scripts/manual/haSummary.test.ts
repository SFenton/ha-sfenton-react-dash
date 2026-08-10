import { manualHaSummaryGeneratedAt } from './haSummary'

describe('App Manual Home Assistant summary date', () => {
  it('keeps one stable public timestamp for every sync on the same UTC day', () => {
    expect(manualHaSummaryGeneratedAt('2026-08-08T00:01:02.003Z')).toBe('2026-08-08T00:00:00.000Z')
    expect(manualHaSummaryGeneratedAt('2026-08-08T23:59:59.999Z')).toBe('2026-08-08T00:00:00.000Z')
  })

  it('rejects invalid inventory timestamps', () => {
    expect(() => manualHaSummaryGeneratedAt('not-a-date')).toThrow('Invalid Home Assistant inventory timestamp')
  })
})
