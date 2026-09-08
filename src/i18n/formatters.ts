export const APP_LANGUAGE = 'en'
export const APP_LOCALE = 'en-US'

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat(APP_LOCALE, options).format(value)
}

export function formatDate(
  value: Date | number,
  options?: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat(APP_LOCALE, options).format(value)
}

export function formatList(
  values: readonly string[],
  options?: Intl.ListFormatOptions,
) {
  return new Intl.ListFormat(APP_LOCALE, options).format(values)
}

export function formatClockTime(value: Date | number, timeZone?: string) {
  return formatDate(value, { hour: 'numeric', hour12: true, minute: '2-digit', timeZone })
}

export function formatHourLabel(value: Date | number, timeZone?: string) {
  return formatDate(value, { hour: 'numeric', hour12: true, timeZone })
}

export interface ZonedDateParts {
  day: number
  hour: number
  minute: number
  month: number
  year: number
}

export function zonedDateParts(value: Date | number, timeZone?: string): ZonedDateParts {
  const parts = new Intl.DateTimeFormat(APP_LOCALE, {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(typeof value === 'number' ? new Date(value) : value)
  const lookup = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? '0')
  return {
    day: lookup('day'),
    hour: lookup('hour'),
    minute: lookup('minute'),
    month: lookup('month'),
    year: lookup('year'),
  }
}
