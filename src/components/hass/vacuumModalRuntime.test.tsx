import { expect, it, describe } from 'vitest'
import { VACUUMS } from '../../constants/portedDashboard'
import { VACUUM_COMMAND_NONE, VACUUM_COMMAND_NORMAL, VACUUM_COMMAND_RESTRICTED } from './vacuumStatus'
import { vacuumModalTabsForMode, vacuumRuntimeMode } from './vacuumModalRuntime'

const mainFloorVacuum = VACUUMS.find((vacuum) => vacuum.title === 'Main Floor')

if (!mainFloorVacuum) throw new Error('Expected Main Floor vacuum fixture')

describe('vacuumModalRuntime', () => {
  it.each([
    ['docked normal', { commandPolicyMode: VACUUM_COMMAND_NORMAL, displayState: 'docked', liveError: '', liveStatusFlag: 'none' }, 'full'],
    ['idle normal', { commandPolicyMode: VACUUM_COMMAND_NORMAL, displayState: 'idle', liveError: '', liveStatusFlag: 'none' }, 'full'],
    ['cleaning normal', { commandPolicyMode: VACUUM_COMMAND_NORMAL, displayState: 'cleaning', liveError: '', liveStatusFlag: 'none' }, 'minimal'],
    ['error low battery', { commandPolicyMode: VACUUM_COMMAND_NORMAL, displayState: 'error', liveError: 'Low battery', liveStatusFlag: 'none' }, 'minimal'],
    ['docked resumable', { commandPolicyMode: VACUUM_COMMAND_NORMAL, displayState: 'docked', liveError: '', liveStatusFlag: 'resumable' }, 'minimal'],
    ['restricted docked', { commandPolicyMode: VACUUM_COMMAND_RESTRICTED, displayState: 'docked', liveError: '', liveStatusFlag: 'none' }, 'minimal'],
    ['none unavailable', { commandPolicyMode: VACUUM_COMMAND_NONE, displayState: 'unavailable', liveError: 'unavailable', liveStatusFlag: 'unavailable' }, 'minimal'],
  ])('classifies %s as %s', (_label, snapshot, expected) => {
    expect(vacuumRuntimeMode(snapshot)).toBe(expected)
  })

  it('filters tabs by runtime mode and dock status', () => {
    expect(vacuumModalTabsForMode(mainFloorVacuum, 'full').map((tab) => tab.label)).toEqual([
      'Controls',
      'Rooms',
      'Auto-Clean',
      'Actions',
      'Info',
    ])
    expect(vacuumModalTabsForMode(mainFloorVacuum, 'minimal').map((tab) => tab.label)).toEqual([
      'Controls',
      'Auto-Clean',
      'Info',
    ])
    expect(vacuumModalTabsForMode(mainFloorVacuum, 'minimal', 'cleaning').map((tab) => tab.label)).toEqual([
      'Controls',
      'Auto-Clean',
      'Actions',
      'Info',
    ])
  })
})
