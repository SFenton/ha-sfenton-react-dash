export type SleepypodAlarmState = "idle" | "ringing" | "snoozed" | "unavailable"

export function sleepypodAlarmState(value: string | undefined): SleepypodAlarmState {
  if (value === "idle" || value === "ringing" || value === "snoozed") return value
  return "unavailable"
}

export function isSleepypodAlarmActive(state: SleepypodAlarmState) {
  return state === "ringing" || state === "snoozed"
}

function parsedEpochSeconds(epochSeconds: unknown) {
  const parsed = typeof epochSeconds === "number" ? epochSeconds : Number(epochSeconds)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

export function sleepypodSnoozeRemainingText(snoozedUntil: unknown, nowMs: number) {
  const epochSeconds = parsedEpochSeconds(snoozedUntil)
  if (epochSeconds === null) return null
  const totalSeconds = Math.max(0, Math.ceil((epochSeconds * 1000 - nowMs) / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, "0")} Remaining`
}

export function sleepypodAlarmStatusText(state: SleepypodAlarmState) {
  if (state === "ringing") return "Ringing"
  if (state === "snoozed") return "Snoozed"
  if (state === "idle") return "Idle"
  return "Unavailable"
}
