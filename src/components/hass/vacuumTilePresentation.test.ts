import { describe, expect, it } from 'vitest'
import { vacuumTilePresentation } from './vacuumTilePresentation'

describe('vacuumTilePresentation', () => {
  it.each([
    ['docked', '100', 'Docked • 100%', 'mdi:home', 'vacuum', false, 'rgba(67, 160, 71, 0.48)'],
    ['idle', 'not-a-number', 'Idle', 'mdi:robot-vacuum', 'neutral', false, 'rgba(255, 255, 255, 0.1)'],
    ['cleaning', '72', 'Cleaning • 72%', 'mdi:broom', 'vacuum', false, 'rgba(0, 150, 136, 0.58)'],
    ['paused', '51', 'Paused • 51%', 'mdi:pause-circle', 'warning', false, 'rgba(251, 140, 0, 0.5)'],
    ['returning', '28', 'Returning • 28%', 'mdi:home-import-outline', 'vacuum', false, 'rgba(30, 136, 229, 0.5)'],
    ['error', '0', 'Error • 0%', 'mdi:alert-circle', 'danger', false, 'rgba(229, 57, 53, 0.5)'],
    ['unavailable', '87', 'Unavailable', 'mdi:robot-vacuum-off', 'neutral', true, undefined],
    ['unknown', '87', 'Unknown', 'mdi:robot-vacuum-off', 'neutral', true, undefined],
    [undefined, '87', 'Unavailable', 'mdi:robot-vacuum-off', 'neutral', true, undefined],
  ])('maps %s to one truthful tile presentation', (state, battery, subtitle, icon, tileTone, muted, backgroundColor) => {
    expect(vacuumTilePresentation(state, battery)).toMatchObject({
      backgroundColor,
      icon,
      muted,
      subtitle,
      tileTone,
    })
  })

  it('omits unreadable and unavailable battery states without producing NaN', () => {
    expect(vacuumTilePresentation('docked', 'unknown').subtitle).toBe('Docked')
    expect(vacuumTilePresentation('docked', 'unavailable').subtitle).toBe('Docked')
    expect(vacuumTilePresentation('docked', '').subtitle).toBe('Docked')
    expect(vacuumTilePresentation('docked', 'battery low').subtitle).toBe('Docked')
  })
})
