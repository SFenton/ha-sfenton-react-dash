import type { CSSProperties } from 'react'

type SliderTarget = 'high' | 'low' | 'value'

type ControlSliderCircularProps = {
  className?: string
  colors?: {
    color?: string
    highColor?: string
    lowColor?: string
  }
  disabled?: boolean
  dual?: boolean
  high?: number | string
  inactive?: boolean
  label?: string
  low?: number | string
  max?: number
  min?: number
  onChange?: (value: number, type: SliderTarget) => void
  onChangeApplied?: (value: number, type: SliderTarget) => void
  onPointerUpCapture?: () => void
  readonly?: boolean
  value?: number | string
}

export function ControlSliderCircular({ className, colors, disabled, dual, high, inactive, label, low, max, min, onChange, onChangeApplied, onPointerUpCapture, readonly, value }: ControlSliderCircularProps) {
  const values = dual ? [{ type: 'low' as const, value: low }, { type: 'high' as const, value: high }] : [{ type: 'value' as const, value }]
  const style = {
    '--ha-control-slider-color': colors?.color,
    '--ha-control-slider-high-color': colors?.highColor,
    '--ha-control-slider-low-color': colors?.lowColor,
  } as CSSProperties
  return (
    <div className={className} data-inactive={inactive ? 'true' : 'false'} data-testid="control-slider-circular" style={style}>
      {values.map((slider) => (
        <input
          aria-label={label}
          aria-readonly={readonly}
          disabled={disabled}
          key={slider.type}
          max={max}
          min={min}
          onChange={(event) => onChange?.(Number(event.currentTarget.value), slider.type)}
          onPointerUp={(event) => {
            onPointerUpCapture?.()
            onChangeApplied?.(Number(event.currentTarget.value), slider.type)
          }}
          type="range"
          value={slider.value ?? min ?? 0}
        />
      ))}
    </div>
  )
}

export function ThemeProvider() {
  return null
}

type ColorPickerProps = {
  entity: string
  className?: string
}

export function ColorPicker({ entity, className }: ColorPickerProps) {
  return <div className={className} data-testid="color-picker" data-entity={entity} />
}