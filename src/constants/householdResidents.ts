export const HOUSEHOLD_RESIDENT = {
  STEPH: 'steph',
  STEPHEN: 'stephen',
} as const

export type HouseholdResident = (typeof HOUSEHOLD_RESIDENT)[keyof typeof HOUSEHOLD_RESIDENT]

export interface HouseholdResidentProfile {
  aliases: readonly string[]
  haUserId: string
  key: HouseholdResident
  name: string
}

export const HOUSEHOLD_RESIDENTS: Record<HouseholdResident, HouseholdResidentProfile> = {
  [HOUSEHOLD_RESIDENT.STEPHEN]: {
    aliases: ['stephen', 'stephen-fenton', 'sfenton'],
    haUserId: '64089b5683944c39b4f944c8f76830b0',
    key: HOUSEHOLD_RESIDENT.STEPHEN,
    name: 'Stephen',
  },
  [HOUSEHOLD_RESIDENT.STEPH]: {
    aliases: ['steph', 'stephanie'],
    haUserId: '43cb71bbd1cb4860b2a7de4c829020f0',
    key: HOUSEHOLD_RESIDENT.STEPH,
    name: 'Steph',
  },
}

function normalized(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase()
}

export function householdResidentForHaUserId(haUserId: string | null | undefined) {
  const userId = normalized(haUserId)
  if (!userId) return undefined
  return Object.values(HOUSEHOLD_RESIDENTS).find((resident) => normalized(resident.haUserId) === userId)?.key
}

export function householdResidentName(resident: HouseholdResident) {
  return HOUSEHOLD_RESIDENTS[resident].name
}

export function otherHouseholdResident(resident: HouseholdResident) {
  return resident === HOUSEHOLD_RESIDENT.STEPHEN
    ? HOUSEHOLD_RESIDENT.STEPH
    : HOUSEHOLD_RESIDENT.STEPHEN
}
