import { describe, expect, it } from 'vitest'
import { materialIconPath } from '../core/iconPaths'
import {
  VACUUM_CONSUMABLE_WARNING_MINUTES,
  vacuumConsumableVisual,
  vacuumStateVisual,
} from './vacuumVisualState'

describe('vacuumStateVisual', () => {
  it.each([
    ['docked', 'mdi:home', 'ok', 'vacuum', 'rgba(67, 160, 71, 0.48)'],
    ['idle', 'mdi:robot-vacuum', 'neutral', 'neutral', 'rgba(255, 255, 255, 0.1)'],
    ['cleaning', 'mdi:broom', 'active', 'vacuum', 'rgba(0, 150, 136, 0.58)'],
    ['paused', 'mdi:pause-circle', 'warning', 'warning', 'rgba(251, 140, 0, 0.5)'],
    ['returning', 'mdi:home-import-outline', 'returning', 'vacuum', 'rgba(30, 136, 229, 0.5)'],
    ['error', 'mdi:alert-circle', 'danger', 'danger', 'rgba(229, 57, 53, 0.5)'],
    ['unavailable', 'mdi:robot-vacuum-off', 'unavailable', 'neutral', undefined],
    ['unknown', 'mdi:robot-vacuum-off', 'unavailable', 'neutral', undefined],
    [undefined, 'mdi:robot-vacuum-off', 'unavailable', 'neutral', undefined],
  ])('maps %s to its icon and tone', (state, icon, tone, tileTone, backgroundColor) => {
    expect(vacuumStateVisual(state)).toMatchObject({ backgroundColor, icon, tileTone, tone })
  })

  it('keeps unexpected available states visible without claiming a known condition', () => {
    expect(vacuumStateVisual('charging')).toMatchObject({
      icon: 'mdi:robot-vacuum',
      tileTone: 'neutral',
      tone: 'neutral',
    })
  })
})

describe('vacuumConsumableVisual', () => {
  it.each([
    ['status', 'ok', 'mdi:brush', 'ok'],
    ['status', 'empty', 'mdi:alert-circle', 'warning'],
    ['status', 'unavailable', 'mdi:help-circle-outline', 'unavailable'],
    ['duration', String(VACUUM_CONSUMABLE_WARNING_MINUTES + 1), 'mdi:brush', 'neutral'],
    ['duration', String(VACUUM_CONSUMABLE_WARNING_MINUTES), 'mdi:timer-alert-outline', 'warning'],
    ['duration', '0', 'mdi:wrench-clock', 'danger'],
    ['duration', 'unavailable', 'mdi:help-circle-outline', 'unavailable'],
  ] as const)('maps %s state %s to %s and %s', (valueKind, state, icon, tone) => {
    expect(vacuumConsumableVisual('mdi:brush', valueKind, state)).toEqual({ icon, tone })
  })

  it('registers every state and maintenance icon instead of falling back to Home', () => {
    const fallback = materialIconPath('mdi:not-a-real-icon')
    const icons = [
      'mdi:alert-circle',
      'mdi:bottle-tonic',
      'mdi:brush',
      'mdi:brush-variant',
      'mdi:help-circle-outline',
      'mdi:home-import-outline',
      'mdi:pause-circle',
      'mdi:radar',
      'mdi:robot-vacuum-off',
      'mdi:timer-alert-outline',
      'mdi:tire',
      'mdi:water-off',
      'mdi:wrench-clock',
    ]

    for (const icon of icons) expect(materialIconPath(icon), icon).not.toBe(fallback)
  })
})
