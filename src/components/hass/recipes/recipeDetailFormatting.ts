export function recipeDetailIdempotencyKey(recipeId: number) {
  const timestamp = Date.now().toString(36)
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
  return `react-recipe:${Math.max(1, Math.round(recipeId))}:${timestamp}:${random}`
    .replace(/[^A-Za-z0-9._:-]/g, '-')
    .slice(0, 128)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 3,
    useGrouping: true,
  }).format(value)
}

export function formatRecipeYield(quantity: number | null, unit: string | null) {
  if (quantity === null || !unit) return null
  const normalizedUnit = unit.trim().toLowerCase()
  if (/^(portion|portions|serving|servings|serve|serves|person|persons|people)$/.test(normalizedUnit)) {
    return `Serves ${formatNumber(quantity)}`
  }
  return `Makes ${formatNumber(quantity)} ${unit}`
}

export function formatRecipeDuration(seconds: number | null) {
  if (seconds === null) return null
  if (seconds < 60) return `${seconds} sec`
  const totalMinutes = Math.round(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  if (minutes === 0) return `${hours} hr`
  return `${hours} hr ${minutes} min`
}

export function formatRecipeNumber(value: number) {
  return formatNumber(value)
}
