import { describe, expect, it } from 'vitest'
import {
  HOUSEHOLD_RESIDENT,
  HOUSEHOLD_RESIDENTS,
  householdResidentForHaUserId,
  householdResidentName,
  otherHouseholdResident,
} from './householdResidents'

describe('household residents', () => {
  it('resolves only known signed-in Home Assistant users', () => {
    expect(householdResidentForHaUserId(HOUSEHOLD_RESIDENTS.stephen.haUserId)).toBe('stephen')
    expect(householdResidentForHaUserId(HOUSEHOLD_RESIDENTS.steph.haUserId.toUpperCase())).toBe('steph')
    expect(householdResidentForHaUserId('unknown-user')).toBeUndefined()
    expect(householdResidentForHaUserId(null)).toBeUndefined()
  })

  it('keeps resident names and counterparts stable', () => {
    expect(householdResidentName(HOUSEHOLD_RESIDENT.STEPHEN)).toBe('Stephen')
    expect(householdResidentName(HOUSEHOLD_RESIDENT.STEPH)).toBe('Steph')
    expect(otherHouseholdResident(HOUSEHOLD_RESIDENT.STEPHEN)).toBe(HOUSEHOLD_RESIDENT.STEPH)
    expect(otherHouseholdResident(HOUSEHOLD_RESIDENT.STEPH)).toBe(HOUSEHOLD_RESIDENT.STEPHEN)
  })
})
