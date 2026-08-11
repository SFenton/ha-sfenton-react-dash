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
