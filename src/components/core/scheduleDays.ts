export interface ScheduleDayValueOption<TDay extends string> {
  value: TDay
}

const DEFAULT_WEEKDAY_VALUES = new Set([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
])

export function resolveScheduleDefaultDays<TDay extends string>(
  dayOptions: readonly ScheduleDayValueOption<TDay>[],
  override?: readonly TDay[],
): TDay[] {
  const selectedValues = override === undefined
    ? new Set(dayOptions.filter((option) => DEFAULT_WEEKDAY_VALUES.has(option.value.toLowerCase())).map((option) => option.value))
    : new Set(override)

  return dayOptions.filter((option) => selectedValues.has(option.value)).map((option) => option.value)
}
