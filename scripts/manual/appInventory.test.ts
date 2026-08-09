import { isManualAppInventoryEntityId } from './appInventory'

describe('App Manual app inventory entity detection', () => {
  it('keeps real entity references and excludes the optional-hook sentinel', () => {
    expect(isManualAppInventoryEntityId('vacuum.main_floor')).toBe(true)
    expect(isManualAppInventoryEntityId('sensor.react_dash_optional_entity_not_configured')).toBe(false)
    expect(isManualAppInventoryEntityId('not-an-entity')).toBe(false)
  })
})
