import type { CSSProperties, FocusEvent, KeyboardEvent, PointerEvent } from 'react'

type SliderTarget = 'high' | 'low' | 'value'

type ControlSliderCircularProps = {
  'aria-hidden'?: boolean | 'false' | 'true'
  className?: string
  colors?: {
    color?: string
    highColor?: string
    lowColor?: string
  }
  current?: number
  disabled?: boolean
  dual?: boolean
  high?: number | string
  inactive?: boolean
  inert?: boolean
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

export function ControlSliderCircular({ 'aria-hidden': ariaHidden, className, colors, current, disabled, dual, high, inactive, inert, label, low, max, min, onChange, onChangeApplied, onPointerUpCapture, readonly, step, value }: ControlSliderCircularProps) {
  const values = dual ? [{ type: 'low' as const, value: low }, { type: 'high' as const, value: high }] : [{ type: 'value' as const, value }]
  const style = {
    '--ha-control-slider-color': colors?.color,
    '--ha-control-slider-high-color': colors?.highColor,
    '--ha-control-slider-low-color': colors?.lowColor,
  } as CSSProperties
  return (
    <div aria-hidden={ariaHidden} className={className} data-hakit-current={current} data-inactive={inactive ? 'true' : 'false'} data-testid="control-slider-circular" inert={inert} style={style}>
      {!disabled && values.map((slider) => (
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
  'data-keyboard-focus'?: string
  disabled?: boolean
  offIcon?: string
  onBlur?: (event: FocusEvent<HTMLDivElement>) => void
  onChange?: (checked: boolean) => void
  onFocus?: (event: FocusEvent<HTMLDivElement>) => void
  onIcon?: string
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void
  style?: CSSProperties
  thickness?: number
  vertical?: boolean
}

export function ControlToggle({ checked = false, className, disabled, onBlur, onChange, onFocus, onKeyDown, onPointerDown, style, ...props }: ControlToggleProps) {
  return (
    <div
      aria-checked={checked}
      aria-disabled={props['aria-disabled']}
      aria-label={props['aria-label']}
      className={className}
      data-disabled={disabled ? 'true' : 'false'}
      data-keyboard-focus={props['data-keyboard-focus']}
      onBlur={onBlur}
      onClick={() => {
        if (!disabled) onChange?.(!checked)
      }}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
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