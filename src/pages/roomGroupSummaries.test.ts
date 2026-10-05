import type { HassEntity } from 'home-assistant-js-websocket'
import type { EntityGroupConfig } from '../constants/atAGlance'
import { contactGroupOpenSummary, contactItemKind } from './roomGroupSummaries'

function contact(entityId: string, state: string): HassEntity {
  return { entity_id: entityId, state, attributes: {}, context: { id: '', parent_id: null, user_id: null }, last_changed: '', last_updated: '' }
}

function group(items: EntityGroupConfig['items']): EntityGroupConfig {
  return { title: 'Test Contact Sensors', items }
}

describe('roomGroupSummaries', () => {
  it('classifies contact items as windows or doors', () => {
    expect(contactItemKind({ title: 'PC Window', entityId: 'binary_sensor.office_window' })).toBe('window')
    expect(contactItemKind({ title: 'Side', entityId: 'binary_sensor.garage_window_side' })).toBe('window')
    expect(contactItemKind({ title: 'Front', entityId: 'binary_sensor.front_door' })).toBe('door')
  })

  it('summarizes single and multiple contacts of one kind', () => {
    const single = group([{ title: 'Front Door', entityId: 'binary_sensor.front' }])
    expect(contactGroupOpenSummary(single, { 'binary_sensor.front': contact('binary_sensor.front', 'off') })).toBe('Door Closed')
    expect(contactGroupOpenSummary(single, { 'binary_sensor.front': contact('binary_sensor.front', 'on') })).toBe('Door Open')

    const windows = group([
      { title: 'Left Window', entityId: 'binary_sensor.left' },
      { title: 'Right Window', entityId: 'binary_sensor.right' },
    ])
    expect(contactGroupOpenSummary(windows, {})).toBe('All Windows Closed')
    expect(contactGroupOpenSummary(windows, { 'binary_sensor.left': contact('binary_sensor.left', 'on') })).toBe('1 Window Open')
    expect(contactGroupOpenSummary(windows, {
      'binary_sensor.left': contact('binary_sensor.left', 'on'),
      'binary_sensor.right': contact('binary_sensor.right', 'on'),
    })).toBe('All Windows Open')
  })

  it('summarizes mixed door and window groups by open kind', () => {
    const mixed = group([
      { title: 'Window', entityId: 'binary_sensor.window' },
      { title: 'Door', entityId: 'binary_sensor.door' },
    ])
    expect(contactGroupOpenSummary(mixed, {})).toBe('All Closed')
    expect(contactGroupOpenSummary(mixed, { 'binary_sensor.door': contact('binary_sensor.door', 'on') })).toBe('Door Open')
    expect(contactGroupOpenSummary(mixed, {
      'binary_sensor.window': contact('binary_sensor.window', 'on'),
      'binary_sensor.door': contact('binary_sensor.door', 'on'),
    })).toBe('Window Open, Door Open')
  })
})
