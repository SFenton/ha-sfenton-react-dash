function twoDigits(value: number) {
  return String(value).padStart(2, '0')
}

export function formatTimerRemaining(totalSeconds: number) {
  const remaining = Math.max(0, Math.ceil(totalSeconds))
  const hours = Math.floor(remaining / 3600)
  const minutes = Math.floor((remaining % 3600) / 60)
  const seconds = remaining % 60
  if (hours > 0) return `${twoDigits(hours)}:${twoDigits(minutes)}:${twoDigits(seconds)}`
  return `${twoDigits(minutes)}:${twoDigits(seconds)}`
}
