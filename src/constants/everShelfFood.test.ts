import { describe, expect, it } from 'vitest'
import { EVERSHELF_EXPIRING_SOON_ENTITY_ID, EVERSHELF_TOTAL_ITEMS_ENTITY_ID, allFoodSubtitle } from './everShelfFood'

const SPACE_ENTITIES = {
  'sensor.evershelf_items_in_pantry': { state: '12' },
  'sensor.evershelf_items_in_fridge': { state: '8' },
  'sensor.evershelf_items_in_freezer': { state: '5' },
  'sensor.kitchen_evershelf_items_in_spice_rack': { state: '6' },
  'sensor.kitchen_evershelf_items_in_cabinet': { state: '4' },
}

describe('allFoodSubtitle', () => {
  it('uses the aggregate EverShelf sensors that back the All Food card', () => {
    expect(allFoodSubtitle({
      ...SPACE_ENTITIES,
      [EVERSHELF_TOTAL_ITEMS_ENTITY_ID]: { state: '120' },
      [EVERSHELF_EXPIRING_SOON_ENTITY_ID]: { state: '1' },
    })).toBe('120 Items • 1 Expiring Soon')
  })

  it('falls back to the same HA food-space sensors when the total sensor is unavailable', () => {
    expect(allFoodSubtitle({
      ...SPACE_ENTITIES,
      [EVERSHELF_TOTAL_ITEMS_ENTITY_ID]: { state: 'unavailable' },
      [EVERSHELF_EXPIRING_SOON_ENTITY_ID]: { state: '6' },
    })).toBe('35 Items • 6 Expiring Soon')
  })

  it('treats missing, non-numeric, and negative HA values as zero', () => {
    expect(allFoodSubtitle({
      'sensor.evershelf_items_in_pantry': { state: '3' },
      'sensor.evershelf_items_in_fridge': { state: '-2' },
      [EVERSHELF_TOTAL_ITEMS_ENTITY_ID]: { state: 'unknown' },
      [EVERSHELF_EXPIRING_SOON_ENTITY_ID]: { state: 'unavailable' },
    })).toBe('3 Items • 0 Expiring Soon')
  })
})
