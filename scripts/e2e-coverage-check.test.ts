import {
  coverageDrift,
  nestedTestDeclarations,
  validateCoverage,
} from './e2e-coverage-check'

describe('Playwright declaration placement', () => {
  it('rejects tests hidden inside a running test or browser callback', () => {
    const failures = nestedTestDeclarations(`
test('outer', async ({ page }) => {
  test('nested', () => {})
  await page.evaluate(() => {
    test('browser-only', () => {})
  })
})
`, 'fixture.spec.ts')
    expect(failures).toEqual([
      'fixture.spec.ts:3: test declaration is nested inside another test',
      'fixture.spec.ts:5: test declaration is nested inside browser code',
    ])
  })

  it('allows suites, parameterized loops, steps, and conditional runtime skips', () => {
    expect(nestedTestDeclarations(`
test.describe.serial('suite', () => {
  for (const viewport of viewports) {
    test('case', async () => {
      test.skip(!supported, 'Unsupported hardware')
      await test.step('rotate', async () => {})
    })
  }
})
`, 'fixture.spec.ts')).toEqual([])
  })
})

describe('Playwright coverage corpus', () => {
  it.each(['self', 'cycle', 'not-direct'] as const)('rejects %s geometry ownership', (kind) => {
    const coverage = [
      { area: 'First', landscape: 'owned', landscapeOwner: kind === 'self' ? 'first.spec.ts' : 'second.spec.ts', safeArea: 'direct', spec: 'first.spec.ts' },
      { area: 'Second', landscape: kind === 'not-direct' ? 'not-applicable' : 'owned', landscapeOwner: 'first.spec.ts', note: 'Not geometry coverage', safeArea: 'direct', spec: 'second.spec.ts' },
    ] as const
    expect(() => validateCoverage(['first.spec.ts', 'second.spec.ts'], coverage)).toThrow(/cyclic|does not provide direct coverage/)
  })

  it('detects missing, stale, and duplicate spec entries', () => {
    const coverage = [
      {
        area: 'Example',
        landscape: 'direct',
        safeArea: 'direct',
        spec: 'covered.spec.ts',
      },
      {
        area: 'Duplicate',
        landscape: 'direct',
        safeArea: 'direct',
        spec: 'covered.spec.ts',
      },
      {
        area: 'Stale',
        landscape: 'direct',
        safeArea: 'direct',
        spec: 'stale.spec.ts',
      },
    ] as const

    expect(coverageDrift(['covered.spec.ts', 'missing.spec.ts'], coverage)).toEqual({
      duplicateEntries: ['covered.spec.ts'],
      missingEntries: ['missing.spec.ts'],
      staleEntries: ['stale.spec.ts'],
    })
  })

  it('requires owners and not-applicable rationales', () => {
    expect(() => validateCoverage(['fixture.spec.ts'], [{
      area: 'Fixture',
      landscape: 'owned',
      safeArea: 'not-applicable',
      spec: 'fixture.spec.ts',
    }])).toThrow(/missing landscapeOwner/)
  })
})
