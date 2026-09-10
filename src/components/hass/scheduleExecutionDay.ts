export const SCHEDULE_WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
export type ScheduleWeekday = typeof SCHEDULE_WEEKDAYS[number]
export type AlarmDaySemantics = 'execution' | 'bedtime'

export function alarmExecutionDay(day: ScheduleWeekday, powerOff: string | undefined, semantics: AlarmDaySemantics): ScheduleWeekday {
  if (semantics === 'execution') return day
  const valid = /^(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(powerOff ?? '')
  const hour = valid ? Number(powerOff?.split(':')[0]) : 9
  return hour <= 12
    ? SCHEDULE_WEEKDAYS[(SCHEDULE_WEEKDAYS.indexOf(day) + 1) % 7]
    : day
}

export function alarmSourceDay(
  wakeDay: ScheduleWeekday,
  schedule: Partial<Record<ScheduleWeekday, { power?: { off?: string } }>> | undefined,
  semantics: AlarmDaySemantics,
): ScheduleWeekday {
  if (semantics === 'execution') return wakeDay
  return SCHEDULE_WEEKDAYS.find(day => alarmExecutionDay(day, schedule?.[day]?.power?.off, semantics) === wakeDay)
    ?? SCHEDULE_WEEKDAYS[(SCHEDULE_WEEKDAYS.indexOf(wakeDay) + 6) % 7]
}
