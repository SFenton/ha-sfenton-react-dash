import { describe, expect, it } from 'vitest'
import { SOLO_TRIP_ROUTE_PATH, VACATION_MODE_ROUTE_PATH } from './routes'
import { RESPONSIVE_ROUTES, RESPONSIVE_ROUTE_TITLES } from '../../e2e/responsive-acceptance-data'

// @covers e2e/responsive-acceptance-data.ts
describe('responsive acceptance data', () => {
  it('keeps auxiliary away-mode routes in the shared responsive route inventory', () => {
    expect(RESPONSIVE_ROUTES).toContain(SOLO_TRIP_ROUTE_PATH)
    expect(RESPONSIVE_ROUTES).toContain(VACATION_MODE_ROUTE_PATH)
    expect(RESPONSIVE_ROUTE_TITLES.get(SOLO_TRIP_ROUTE_PATH)).toBe('Solo Trip')
    expect(RESPONSIVE_ROUTE_TITLES.get(VACATION_MODE_ROUTE_PATH)).toBe('Vacation Mode')
  })
})
