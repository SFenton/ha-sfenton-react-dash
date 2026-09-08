export const SNOW_FLAKE_COUNT = 34
export const SNOW_NARROW_FLAKE_COUNT = 28
export const SNOW_STATIC_FLAKE_COUNT = 12
export const SNOW_WIDE_MIN_WIDTH = 700

export type SnowDepth = 'near' | 'middle' | 'far'
export type SnowCrystal = 'dendrite' | 'fern' | 'plate' | 'grain'

function crystalPath(branchLength: number, secondBranch = false, plate = false) {
  const segments: string[] = []
  for (let arm = 0; arm < 6; arm += 1) {
    const angle = (arm * Math.PI) / 3 - Math.PI / 2
    const x = Math.cos(angle)
    const y = Math.sin(angle)
    const point = (radius: number, side = 0) => `${(10 + x * radius - y * side).toFixed(3)} ${(10 + y * radius + x * side).toFixed(3)}`
    segments.push(`M10 10L${point(8.5)}`)
    if (branchLength > 0) segments.push(`M${point(6.5, -branchLength)}L${point(4.5)}L${point(6.5, branchLength)}`)
    if (secondBranch) segments.push(`M${point(7.9, -0.9)}L${point(6.6)}L${point(7.9, 0.9)}`)
  }
  if (plate) {
    const points = Array.from({ length: 6 }, (_, index) => {
      const angle = index * Math.PI / 3 - Math.PI / 2
      return `${(10 + Math.cos(angle) * 3.2).toFixed(3)} ${(10 + Math.sin(angle) * 3.2).toFixed(3)}`
    })
    segments.push(`M${points.join('L')}Z`)
  }
  return segments.join('')
}

export const SNOW_CRYSTAL_PATHS: Record<SnowCrystal, string> = {
  dendrite: crystalPath(2.2, true),
  fern: crystalPath(1.7),
  plate: crystalPath(1.1, false, true),
  grain: crystalPath(0),
}

const SNOW_X = [7, 46, 81, 22, 63, 94, 34, 13, 73, 55, 4, 88, 27, 68, 40, 97, 17, 59, 78, 49, 9, 85, 30, 65, 19, 92, 52, 38, 75, 24, 61, 44, 12, 83]

export const SNOW_FLAKES = Array.from({ length: SNOW_FLAKE_COUNT }, (_, index) => {
  const depth: SnowDepth = index % 6 === 0 ? 'near' : index % 2 === 1 ? 'middle' : 'far'
  const variant = Math.floor(index / 3) % 3
  const duration = depth === 'near'
    ? 14.2 + ((index * 17) % 39) / 10
    : depth === 'middle'
      ? 18.1 + ((index * 13) % 53) / 10
      : 24.3 + ((index * 19) % 68) / 10
  const angle = ((index * 47) % 120) - 60
  const sway = depth === 'near' ? 22 : depth === 'middle' ? 15 : 8
  const drift = ((index * 11) % 31) - 15
  const phase = ((index * 23 + 17) % 101) / 101 * Math.PI * 2
  const turn = ((index * 19) % 61) - 30
  const trajectory = Array.from({ length: 9 }, (_, point) => {
    const progress = point / 8
    return {
      x: Number((drift * progress + sway * (Math.sin(phase + progress * Math.PI * 2 * (0.45 + index % 5 * 0.1)) - Math.sin(phase))).toFixed(3)),
      angle: Number((angle + turn * progress + 7 * (Math.cos(phase + progress * Math.PI * 1.2) - Math.cos(phase))).toFixed(3)),
    }
  })

  return {
    angle,
    delay: -Number((duration * ((((index * 41 + 29) % 103) + 0.5) / 103)).toFixed(3)),
    depth,
    shape: (depth === 'near' ? ['dendrite', 'fern', 'plate'][variant] : depth === 'middle' ? variant === 2 ? 'plate' : 'fern' : 'grain') as SnowCrystal,
    duration: Number(duration.toFixed(1)),
    opacity: depth === 'near' ? 0.6 + Math.floor(index / 6) % 3 * 0.04 : depth === 'middle' ? 0.44 + index % 4 * 0.03 : 0.26 + Math.floor(index / 2) % 3 * 0.04,
    size: depth === 'near' ? 12 : depth === 'middle' ? 8 : 5,
    staticY: 9 + ((index * 31 + 7) % 83),
    sway,
    trajectory,
    x: SNOW_X[index],
  }
})

const STAR_POSITIONS = [
  [4, 13], [13, 6], [23, 18], [32, 8], [43, 23], [51, 11], [64, 5],
  [73, 19], [84, 9], [94, 28], [8, 33], [19, 29], [28, 44], [39, 36],
  [53, 43], [61, 31], [76, 39], [89, 47], [96, 58], [5, 61], [16, 51],
  [24, 65], [35, 57], [45, 71], [57, 59], [67, 68], [79, 59], [86, 74],
  [13, 82], [29, 78], [38, 92], [52, 83], [65, 90], [75, 82], [92, 88],
] as const

export const NIGHT_STARS = STAR_POSITIONS.map(([x, y], index) => ({
  x, y,
  size: index % 7 === 0 ? 1.7 : index % 3 === 0 ? 1.25 : 0.9,
  opacity: index % 7 === 0 ? 0.48 : 0.22 + index % 4 * 0.04,
}))

export const WIND_WISPS = [
  { top: 9, left: -8, width: 92, duration: 21, delay: -4.5, path: 'M-30 65C65 20 135 90 255 53S435 26 620 44' },
  { top: 29, left: 30, width: 68, duration: 27, delay: -15.2, path: 'M-30 42C100 95 175 7 305 44S468 86 620 35' },
  { top: 53, left: -12, width: 82, duration: 24, delay: -9.4, path: 'M-30 70C88 28 155 54 285 63S450 14 620 47' },
  { top: 77, left: 18, width: 60, duration: 31, delay: -24.1, path: 'M-30 45C110 12 182 93 340 50S490 32 620 65' },
] as const
