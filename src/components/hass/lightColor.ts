export type LightRgb = [number, number, number]
export type LightHs = [number, number]

export function readLightRgb(rgbColor: unknown): LightRgb | null {
  if (Array.isArray(rgbColor) && rgbColor.length === 3 && rgbColor.every((value) => typeof value === 'number')) {
    return [rgbColor[0] as number, rgbColor[1] as number, rgbColor[2] as number]
  }
  return null
}

export function readLightHs(hsColor: unknown): LightHs | null {
  if (Array.isArray(hsColor) && hsColor.length === 2 && hsColor.every((value) => typeof value === 'number')) {
    return [hsColor[0] as number, hsColor[1] as number]
  }
  return null
}

export function lightRgbCss(rgb: LightRgb) {
  return `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`
}

export function lightRgbToHs([red, green, blue]: LightRgb): LightHs {
  const r = red / 255
  const g = green / 255
  const b = blue / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  const saturation = max === 0 ? 0 : (delta / max) * 100
  let hue = 0
  if (delta) {
    if (max === r) hue = 60 * (((g - b) / delta) % 6)
    else if (max === g) hue = 60 * ((b - r) / delta + 2)
    else hue = 60 * ((r - g) / delta + 4)
  }
  return [(hue + 360) % 360, saturation]
}

export function lightHsToRgb([hue, saturationPercent]: LightHs): LightRgb {
  const saturation = Math.max(0, Math.min(100, saturationPercent)) / 100
  const chroma = saturation
  const section = ((hue % 360) + 360) % 360 / 60
  const x = chroma * (1 - Math.abs(section % 2 - 1))
  const [r, g, b] = section < 1 ? [chroma, x, 0]
    : section < 2 ? [x, chroma, 0]
      : section < 3 ? [0, chroma, x]
        : section < 4 ? [0, x, chroma]
          : section < 5 ? [x, 0, chroma]
            : [chroma, 0, x]
  const white = 1 - chroma
  return [r, g, b].map((channel) => Math.round((channel + white) * 255)) as LightRgb
}
