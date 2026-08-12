import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type Rgba = [number, number, number, number]

function variable(source: string, name: string) {
  const match = source.match(new RegExp(`${name.replaceAll('-', '\\-')}\\s*:\\s*([^;]+);`))
  if (!match) throw new Error(`Missing ${name}`)
  return match[1].trim()
}

function parseColor(value: string): Rgba {
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    return [
      Number.parseInt(value.slice(1, 3), 16),
      Number.parseInt(value.slice(3, 5), 16),
      Number.parseInt(value.slice(5, 7), 16),
      1,
    ]
  }

  const rgba = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i)
  if (!rgba) throw new Error(`Unsupported color ${value}`)
  return [
    Number(rgba[1]),
    Number(rgba[2]),
    Number(rgba[3]),
    rgba[4] === undefined ? 1 : Number(rgba[4]),
  ]
}

function composite(foreground: Rgba, background: Rgba): Rgba {
  const alpha = foreground[3] + background[3] * (1 - foreground[3])
  return [
    (foreground[0] * foreground[3] + background[0] * background[3] * (1 - foreground[3])) / alpha,
    (foreground[1] * foreground[3] + background[1] * background[3] * (1 - foreground[3])) / alpha,
    (foreground[2] * foreground[3] + background[2] * background[3] * (1 - foreground[3])) / alpha,
    alpha,
  ]
}

function channel(value: number) {
  const normalized = value / 255
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4
}

function luminance(color: Rgba) {
  return 0.2126 * channel(color[0]) + 0.7152 * channel(color[1]) + 0.0722 * channel(color[2])
}

function contrast(left: Rgba, right: Rgba) {
  const first = luminance(left)
  const second = luminance(right)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

describe('current UX contrast tokens', () => {
  it('keeps primary and muted text above the WCAG AA body-text floor', () => {
    const source = readFileSync(resolve('src/styles/tokens.css'), 'utf8')
    const canvas: Rgba = [17, 23, 35, 1]
    const modal = composite(parseColor(variable(source, '--color-modal-surface')), canvas)
    const content = parseColor(variable(source, '--color-text'))
    const mutedOnCanvas = composite(parseColor(variable(source, '--color-text-muted')), canvas)
    const mutedOnModal = composite(parseColor(variable(source, '--color-text-muted')), modal)

    expect(contrast(content, canvas)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(mutedOnCanvas, canvas)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(content, modal)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(mutedOnModal, modal)).toBeGreaterThanOrEqual(4.5)
  })
})
