import { ControlToggle } from '@hakit/components'
import { useRef, useState, type KeyboardEvent } from 'react'
import styles from './ToggleControl.module.css'

interface ToggleControlProps {
  checked: boolean
  disabled?: boolean
  label: string
  onChange: (checked: boolean) => void
}

export function ToggleControl({
  checked,
  disabled = false,
  label,
  onChange,
}: ToggleControlProps) {
  const pointerFocusRef = useRef(false)
  const [keyboardFocus, setKeyboardFocus] = useState(false)

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    setKeyboardFocus(true)
    if (disabled || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    event.stopPropagation()
    onChange(!checked)
  }

  const handlePointerDown = () => {
    pointerFocusRef.current = true
    setKeyboardFocus(false)
  }

  const handleFocus = () => {
    setKeyboardFocus(!pointerFocusRef.current)
    pointerFocusRef.current = false
  }

  return (
    <ControlToggle
      aria-disabled={disabled}
      aria-label={(checked ? 'Turn off ' : 'Turn on ') + label}
      checked={checked}
      className={styles.control}
      color='#30be97'
      data-keyboard-focus={keyboardFocus ? 'true' : 'false'}
      disabled={disabled}
      onBlur={() => {
        pointerFocusRef.current = false
        setKeyboardFocus(false)
      }}
      onChange={onChange}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      style={{ height: 34, maxHeight: 34, maxWidth: 56, minHeight: 34, minWidth: 56, width: 56 }}
      tabIndex={disabled ? -1 : 0}
      thickness={34}
      vertical={false}
    />
  )
}
