import {
  duoDisplayModeForEnvironment,
  usesDuoNavigationLayout,
  type DuoDisplayEnvironment,
} from './duoLayout'

const baseEnvironment: DuoDisplayEnvironment = {
  maxTouchPoints: 1,
  screenHeight: 678,
  screenWidth: 466,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)',
  viewportHeight: 678,
  viewportWidth: 466,
}

describe('duoDisplayModeForEnvironment', () => {
  it('recognizes the outer and inner Duo displays without a model user-agent token', () => {
    expect(duoDisplayModeForEnvironment(baseEnvironment)).toBe('outer')
    expect(duoDisplayModeForEnvironment({
      ...baseEnvironment,
      screenHeight: 626,
      screenWidth: 890,
      viewportHeight: 626,
      viewportWidth: 890,
    })).toBe('inner')
  })

  it('uses posture and viewport segments to distinguish a folded inner display', () => {
    const innerEnvironment = {
      ...baseEnvironment,
      screenHeight: 626,
      screenWidth: 890,
      viewportHeight: 626,
      viewportWidth: 890,
    }
    expect(duoDisplayModeForEnvironment({ ...innerEnvironment, devicePosture: 'folded' })).toBe('folded')
    expect(duoDisplayModeForEnvironment({ ...innerEnvironment, viewportSegmentCount: 2 })).toBe('folded')
  })

  it('does not classify similarly sized non-iPhone browsers as Duo', () => {
    expect(duoDisplayModeForEnvironment({
      ...baseEnvironment,
      userAgent: 'Mozilla/5.0 (Linux; Android 16; Pixel Fold)',
    })).toBeNull()
    expect(duoDisplayModeForEnvironment({
      ...baseEnvironment,
      maxTouchPoints: 0,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    })).toBeNull()
  })

  it('supports a development preview that follows mounted viewport changes', () => {
    expect(duoDisplayModeForEnvironment({
      ...baseEnvironment,
      preview: 'auto',
      userAgent: 'Desktop preview',
    })).toBe('outer')
    expect(duoDisplayModeForEnvironment({
      ...baseEnvironment,
      preview: 'auto',
      userAgent: 'Desktop preview',
      viewportHeight: 626,
      viewportWidth: 890,
    })).toBe('inner')
  })
})

describe('usesDuoNavigationLayout', () => {
  it('uses the standard shell for an unfolded portrait display only', () => {
    expect(usesDuoNavigationLayout('inner', 626, 890)).toBe(false)
    expect(usesDuoNavigationLayout('inner', 890, 626)).toBe(true)
    expect(usesDuoNavigationLayout('outer', 466, 678)).toBe(true)
    expect(usesDuoNavigationLayout('folded', 626, 890)).toBe(true)
    expect(usesDuoNavigationLayout(null, 626, 890)).toBe(false)
  })
})
