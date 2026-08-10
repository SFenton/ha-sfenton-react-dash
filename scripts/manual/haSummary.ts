export function manualHaSummaryGeneratedAt(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid Home Assistant inventory timestamp: ${value}`)
  return `${date.toISOString().slice(0, 10)}T00:00:00.000Z`
}
