import { WAKE_LIGHT_WEEKDAYS, wakeLightAlarmLinkKey, type WakeLightBedSide, type WakeLightWeekday } from './wakeLightContract'

export interface BedAlarmSlot {
  day: WakeLightWeekday
  time: string
}

export type BedAlarmSide = WakeLightBedSide

export interface WakeLightBedTarget {
  available: boolean
  side: BedAlarmSide
  slots: readonly BedAlarmSlot[]
  title: string
}

/** Bed-alarm capability handed to the wake light modal by the page that owns the bed schedule. */
export interface WakeLightBedProvisioning {
  createAlarms: (side: BedAlarmSide, days: readonly WakeLightWeekday[], time: string) => void
  targets: readonly WakeLightBedTarget[]
}

export interface BedAlarmProvisionPlan {
  createDays: WakeLightWeekday[]
  linkKeysOff: string[]
  linkKeysOn: string[]
}

interface BedAlarmProvisionInput {
  alarmLinks: Record<string, boolean>
  days: readonly WakeLightWeekday[]
  linked: boolean
  slots: readonly BedAlarmSlot[]
  sourceRef: string
  time: string
}

/** Normalize a bed schedule time to the strict `HH:MM` shape wake-light link keys require. */
export function normalizedBedAlarmTime(value: string) {
  const match = /^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?$/.exec(value.trim())
  if (!match) return null
  const hour = Number(match[1])
  return hour > 23 ? null : `${String(hour).padStart(2, '0')}:${match[2]}`
}

function orderedWeekdays(days: readonly WakeLightWeekday[]) {
  return WAKE_LIGHT_WEEKDAYS.filter(day => days.includes(day))
}

/** Return the weekdays that already hold a bed alarm at one time on one side. */
export function bedAlarmDaysAtTime(slots: readonly BedAlarmSlot[], time: string): WakeLightWeekday[] {
  const target = normalizedBedAlarmTime(time)
  if (!target) return []
  const matched = slots.filter(slot => normalizedBedAlarmTime(slot.time) === target).map(slot => slot.day)
  return orderedWeekdays([...new Set(matched)])
}

/**
 * Plan one side of a cross-bed wake alarm creation.
 *
 * Both "Add to <bed>" toggles start off, and every side is synchronized on save. An enabled
 * toggle creates the bed alarm when that side has none at the day/time, or turns the wake link
 * on when it already exists. A toggle left off turns that side's wake link off for a matching
 * bed alarm. Link keys are per source ref, so a plan for one side can never change the other
 * side's wake-light link: the other bed keeps driving the room wake light when it still wants
 * to. Bed alarms are only ever created, never deleted.
 */
export function planBedAlarmProvision({
  alarmLinks, days, linked, slots, sourceRef, time,
}: BedAlarmProvisionInput): BedAlarmProvisionPlan | null {
  const target = normalizedBedAlarmTime(time)
  if (!target || !sourceRef) return null
  const existing = new Set(bedAlarmDaysAtTime(slots, target))
  const plan: BedAlarmProvisionPlan = { createDays: [], linkKeysOff: [], linkKeysOn: [] }
  for (const day of orderedWeekdays([...new Set(days)])) {
    const key = wakeLightAlarmLinkKey(sourceRef, day, target)
    const currentlyLinked = alarmLinks[key] !== false
    const exists = existing.has(day)
    if (!exists && linked) plan.createDays.push(day)
    if (linked && !currentlyLinked) plan.linkKeysOn.push(key)
    if (!linked && exists && currentlyLinked) plan.linkKeysOff.push(key)
  }
  return plan
}

export function bedAlarmPlanIsEmpty(plan: BedAlarmProvisionPlan | null) {
  return !plan || (!plan.createDays.length && !plan.linkKeysOff.length && !plan.linkKeysOn.length)
}
