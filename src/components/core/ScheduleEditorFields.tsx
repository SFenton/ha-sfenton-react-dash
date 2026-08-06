import type { CSSProperties, ReactNode } from 'react'
import { NativePickerField } from './NativePickerField'
import type { ScheduleDayValueOption } from './scheduleDays'
import styles from './ScheduleEditorFields.module.css'

export interface ScheduleDayOption<TDay extends string> extends ScheduleDayValueOption<TDay> {
  disabled?: boolean
  label: string
  shortLabel?: string
}

interface ScheduleNameField {
  label: string
  maxLength?: number
  onChange: (value: string) => void
  value: string
}

interface ScheduleTimeField {
  ariaLabel?: string
  label: string
  onChange: (value: string) => void
  value: string
}

interface ScheduleEditorFieldsProps<TDay extends string> {
  children?: ReactNode
  dayOptions: readonly ScheduleDayOption<TDay>[]
  days: readonly TDay[]
  disabled?: boolean
  nameField?: ScheduleNameField
  onDaysChange: (days: TDay[]) => void
  showDays?: boolean
  timeFields: readonly ScheduleTimeField[]
}

export function ScheduleEditorFields<TDay extends string>({
  children,
  dayOptions,
  days,
  disabled = false,
  nameField,
  onDaysChange,
  showDays = true,
  timeFields,
}: ScheduleEditorFieldsProps<TDay>) {
  const toggleDay = (day: TDay) => {
    if (dayOptions.find((option) => option.value === day)?.disabled) return
    const nextDays = days.includes(day)
      ? days.filter((candidate) => candidate !== day)
      : dayOptions.filter((option) => days.includes(option.value) || option.value === day).map((option) => option.value)
    onDaysChange(nextDays)
  }
  const dayGridStyle = { '--schedule-day-count': dayOptions.length } as CSSProperties
  const timeGridStyle = { '--schedule-time-count': Math.max(1, timeFields.length) } as CSSProperties

  return (
    <div aria-busy={disabled ? 'true' : undefined} className={styles.editor} data-disabled={disabled ? 'true' : 'false'} inert={disabled ? true : undefined}>
      {nameField && (
        <label className={styles.field}>
          <span>{nameField.label}</span>
          <input data-modal-detail-autofocus="true" disabled={disabled} maxLength={nameField.maxLength} onChange={(event) => nameField.onChange(event.currentTarget.value)} value={nameField.value} />
        </label>
      )}

      {showDays && (
        <div className={styles.field}>
          <span>Days</span>
          <div className={styles.dayGrid} style={dayGridStyle}>
            {dayOptions.map((option) => (
              <button
                aria-label={option.label}
                aria-pressed={days.includes(option.value)}
                data-modal-detail-autofocus={!nameField && option === dayOptions[0] ? 'true' : undefined}
                data-active={days.includes(option.value) ? 'true' : 'false'}
                disabled={disabled || option.disabled}
                key={option.value}
                onClick={() => toggleDay(option.value)}
                type="button"
              >
                {option.shortLabel ?? option.label.slice(0, 1).toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.timeGrid} style={timeGridStyle}>
        {timeFields.map((field) => (
          <NativePickerField
            ariaLabel={field.ariaLabel}
            className={styles.timePicker}
            detailAutoFocus={!nameField && !showDays && field === timeFields[0]}
            disabled={disabled}
            key={field.label}
            label={field.label}
            onChange={field.onChange}
            type="time"
            value={field.value}
          />
        ))}
      </div>

      {children}
    </div>
  )
}
