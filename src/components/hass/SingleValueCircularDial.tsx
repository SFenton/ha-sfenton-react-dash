import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { CircularControlDial, type CircularDialPrimaryVariant, type CircularDialTrail } from './CircularControlDial'
import { circularDialPointIsOnRing, circularDialValueFromPoint } from './circularDialGeometry'

interface SingleValueCircularDialProps {
  actionText?: string
  ariaLabel: string
  color: string
  disabled?: boolean
  handleAriaLabel: string
  inactive?: boolean
  max: number
  min: number
  off?: boolean
  onCommit: (value: number) => void
  primaryText: (value: number) => string
  primaryTextVariant?: CircularDialPrimaryVariant
  primaryUnit?: string
  secondaryText?: string
  size?: 'compact' | 'modal' | 'page'
  step: number
  trails?: CircularDialTrail[]
  value: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function SingleValueCircularDial({
  actionText,
  ariaLabel,
  color,
  disabled = false,
  handleAriaLabel,
  inactive = false,
  max,
  min,
  off = false,
  onCommit,
  primaryText,
  primaryTextVariant,
  primaryUnit,
  secondaryText,
  size = 'modal',
  step,
  trails = [],
  value,
}: SingleValueCircularDialProps) {
  const dialRef = useRef<HTMLDivElement>(null)
  const activePointer = useRef<number | null>(null)
  const tapCandidate = useRef<{ moved: boolean; pointerId: number; startX: number; startY: number } | null>(null)
  const [dragValue, setDragValue] = useState<number | null>(null)
  const displayValue = dragValue ?? value

  const valueFromPointer = (event: PointerEvent<HTMLElement>) => {
    const rect = dialRef.current?.getBoundingClientRect()
    if (!rect) return null
    return circularDialValueFromPoint(rect, event.clientX, event.clientY, min, max, step)
  }

  const commit = (nextValue: number) => {
    if (disabled) return
    setDragValue(null)
    onCommit(clamp(nextValue, min, max))
  }

  const startHandleDrag = (event: PointerEvent<HTMLSpanElement>) => {
    if (disabled) return
    const nextValue = valueFromPointer(event)
    if (nextValue === null) return
    event.preventDefault()
    event.stopPropagation()
    activePointer.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragValue(nextValue)
  }

  const moveHandleDrag = (event: PointerEvent<HTMLSpanElement>) => {
    if (activePointer.current !== event.pointerId) return
    const nextValue = valueFromPointer(event)
    if (nextValue === null) return
    event.preventDefault()
    setDragValue(nextValue)
  }

  const endHandleDrag = (event: PointerEvent<HTMLSpanElement>) => {
    if (activePointer.current !== event.pointerId) return
    const nextValue = valueFromPointer(event)
    activePointer.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (nextValue !== null) commit(nextValue)
  }

  const startDialTap = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) return
    tapCandidate.current = { moved: false, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY }
  }

  const moveDialTap = (event: PointerEvent<HTMLDivElement>) => {
    const candidate = tapCandidate.current
    if (!candidate || candidate.pointerId !== event.pointerId || candidate.moved) return
    if (Math.hypot(event.clientX - candidate.startX, event.clientY - candidate.startY) > 8) candidate.moved = true
  }

  const cancelDialTap = (event: PointerEvent<HTMLDivElement>) => {
    if (tapCandidate.current?.pointerId === event.pointerId) tapCandidate.current = null
  }

  const endDialTap = (event: PointerEvent<HTMLDivElement>) => {
    const candidate = tapCandidate.current
    if (!candidate || candidate.pointerId !== event.pointerId) return
    tapCandidate.current = null
    if (candidate.moved) return
    const rect = dialRef.current?.getBoundingClientRect()
    if (!rect || !circularDialPointIsOnRing(rect, event.clientX, event.clientY)) return
    const nextValue = valueFromPointer(event)
    if (nextValue === null) return
    event.preventDefault()
    event.stopPropagation()
    commit(nextValue)
  }

  const adjustFromKeyboard = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (disabled) return
    let nextValue: number | null = null
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') nextValue = displayValue + step
    if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') nextValue = displayValue - step
    if (event.key === 'Home') nextValue = min
    if (event.key === 'End') nextValue = max
    if (event.key === 'PageUp') nextValue = displayValue + step * 5
    if (event.key === 'PageDown') nextValue = displayValue - step * 5
    if (nextValue === null) return
    event.preventDefault()
    commit(nextValue)
  }

  return (
    <CircularControlDial
      actionText={actionText}
      ariaLabel={ariaLabel}
      colors={{ color, highColor: color, lowColor: color }}
      current={displayValue}
      disabled={disabled}
      handles={disabled ? [] : [{
        ariaLabel: handleAriaLabel,
        ariaValueText: primaryText(displayValue),
        color,
        dragging: dragValue !== null,
        id: 'value',
        onKeyDown: adjustFromKeyboard,
        onPointerCancel: endHandleDrag,
        onPointerDown: startHandleDrag,
        onPointerMove: moveHandleDrag,
        onPointerUp: endHandleDrag,
        value: displayValue,
      }]}
      inactive={inactive}
      label={handleAriaLabel}
      max={max}
      min={min}
      mode="full"
      off={off}
      onChange={setDragValue}
      onChangeApplied={commit}
      onPointerCancel={cancelDialTap}
      onPointerDown={startDialTap}
      onPointerMove={moveDialTap}
      onPointerUp={endDialTap}
      primaryText={primaryText(displayValue)}
      primaryTextVariant={primaryTextVariant}
      primaryUnit={primaryUnit}
      readonly={disabled}
      ref={dialRef}
      secondaryText={secondaryText}
      size={size}
      step={step}
      trails={trails}
      value={displayValue}
    />
  )
}
