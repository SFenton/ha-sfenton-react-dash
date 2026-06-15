import type { CSSProperties, KeyboardEvent } from 'react'

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
  step?: number
  value?: number | string
}

export function ControlSliderCircular({ className, colors, disabled, dual, high, inactive, label, low, max, min, onChange, onChangeApplied, onPointerUpCapture, readonly, step, value }: ControlSliderCircularProps) {
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
          step={step}
          type="range"
          value={slider.value ?? min ?? 0}
        />
      ))}
    </div>
  )
}

type ControlToggleProps = {
  'aria-disabled'?: boolean
  'aria-label'?: string
  checked?: boolean
  className?: string
  color?: string
  disabled?: boolean
  offIcon?: string
  onChange?: (checked: boolean) => void
  onIcon?: string
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void
  style?: CSSProperties
  thickness?: number
  vertical?: boolean
}

export function ControlToggle({ checked = false, className, disabled, onChange, onKeyDown, style, ...props }: ControlToggleProps) {
  return (
    <div
      aria-checked={checked}
      aria-disabled={props['aria-disabled']}
      aria-label={props['aria-label']}
      className={className}
      data-disabled={disabled ? 'true' : 'false'}
      onClick={() => {
        if (!disabled) onChange?.(!checked)
      }}
      onKeyDown={onKeyDown}
      role="switch"
      style={style}
      tabIndex={disabled ? -1 : 0}
    />
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