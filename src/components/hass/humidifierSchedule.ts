import type { HumidifierMode } from '../../constants/humidifiers'
import { resolveScheduleDefaultDays } from '../core/scheduleDays'

export const HUMIDIFIER_WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
export type HumidifierWeekday = (typeof HUMIDIFIER_WEEKDAYS)[number]

export interface HassScheduleBlock {
  data?: Record<string, boolean | number | string>
  from: string
  to: string
}

export type HassScheduleDays = Record<HumidifierWeekday, HassScheduleBlock[]>

export interface HassSchedule extends HassScheduleDays {
  icon?: string
  id: string
  name: string
}

export interface HumidifierScheduleRule {
  days: HumidifierWeekday[]
  display: boolean
  end: string
  id: string
  label: string
  mistLevel: number
  mode: HumidifierMode
  start: string
  targetHumidity: number
  warmLevel: number
}

export interface ScheduleConflict {
  day: HumidifierWeekday
  firstRuleId: string
  secondRuleId: string
}

const DAY_LABELS: Record<HumidifierWeekday, string> = {
  sunday: 'Sun',
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
}

function normalizedTime(value: string, fallback: string) {
  const match = /^(\d{1,2}):(\d{2})/.exec(value)
  if (!match) return fallback
  const hour = Math.min(24, Math.max(0, Number(match[1])))
  const minute = Math.min(59, Math.max(0, Number(match[2])))
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
}

function isHumidifierMode(value: unknown): value is HumidifierMode {
  return value === 'Manual' || value === 'Target Humidity' || value === 'Sleep'
}

function nextWeekday(day: HumidifierWeekday) {
  return HUMIDIFIER_WEEKDAYS[(HUMIDIFIER_WEEKDAYS.indexOf(day) + 1) % HUMIDIFIER_WEEKDAYS.length]
}

function ruleData(rule: HumidifierScheduleRule): Record<string, boolean | number | string> {
  return {
    display: rule.display,
    end_time: rule.end,
    label: rule.label,
    mist_level: rule.mistLevel,
    mode: rule.mode,
    rule_days: rule.days.join(','),
    rule_id: rule.id,
    start_time: rule.start,
    target_humidity: rule.targetHumidity,
    warm_level: rule.warmLevel,
  }
}

export function emptyScheduleDays(): HassScheduleDays {
  return {
    sunday: [],
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
  }
}

export function createHumidifierScheduleRule(id: string, defaultDays?: readonly HumidifierWeekday[]): HumidifierScheduleRule {
  return {
    days: resolveScheduleDefaultDays(HUMIDIFIER_WEEKDAYS.map((value) => ({ value })), defaultDays),
    display: false,
    end: '07:00',
    id,
    label: 'Night',
    mistLevel: 4,
    mode: 'Sleep',
    start: '22:00',
    targetHumidity: 50,
    warmLevel: 0,
  }
}

export function scheduleRules(schedule: HassSchedule | null | undefined): HumidifierScheduleRule[] {
  if (!schedule) return []
  const rules = new Map<string, HumidifierScheduleRule>()

  for (const day of HUMIDIFIER_WEEKDAYS) {
    for (const block of schedule[day] ?? []) {
      const data = block.data
      const id = typeof data?.rule_id === 'string' ? data.rule_id : ''
      if (!id || rules.has(id)) continue
      const mode = isHumidifierMode(data?.mode) ? data.mode : 'Manual'
      const encodedDays = typeof data?.rule_days === 'string' ? data.rule_days.split(',') : [day]
      const days = encodedDays.filter((candidate): candidate is HumidifierWeekday => HUMIDIFIER_WEEKDAYS.includes(candidate as HumidifierWeekday))
      rules.set(id, {
        days: days.length ? days : [day],
        display: data?.display !== false,
        end: normalizedTime(typeof data?.end_time === 'string' ? data.end_time : block.to, '07:00'),
        id,
        label: typeof data?.label === 'string' && data.label.trim() ? data.label.trim() : 'Scheduled activity',
        mistLevel: clampNumber(data?.mist_level, 1, 9, 5),
        mode,
        start: normalizedTime(typeof data?.start_time === 'string' ? data.start_time : block.from, '22:00'),
        targetHumidity: clampNumber(data?.target_humidity, 40, 80, 50),
        warmLevel: clampNumber(data?.warm_level, 0, 3, 0),
      })
    }
  }

  return [...rules.values()].sort((a, b) => a.start.localeCompare(b.start) || a.label.localeCompare(b.label))
}

export function scheduleDaysFromRules(rules: HumidifierScheduleRule[]): HassScheduleDays {
  const days = emptyScheduleDays()

  for (const rule of rules) {
    const start = normalizedTime(rule.start, '22:00')
    const end = normalizedTime(rule.end, '07:00')
    const data = ruleData({ ...rule, end, start })
    const overnight = end <= start

    for (const day of rule.days) {
      if (overnight) {
        days[day].push({ data, from: start, to: '24:00' })
        if (end !== '00:00') days[nextWeekday(day)].push({ data, from: '00:00', to: end })
      } else {
        days[day].push({ data, from: start, to: end })
      }
    }
  }

  for (const day of HUMIDIFIER_WEEKDAYS) {
    days[day].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to))
  }

  return days
}

export function scheduleConflicts(rules: HumidifierScheduleRule[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = []
  const days = scheduleDaysFromRules(rules)

  for (const day of HUMIDIFIER_WEEKDAYS) {
    const blocks = days[day]
    for (let index = 1; index < blocks.length; index += 1) {
      const previous = blocks[index - 1]
      const current = blocks[index]
      if (previous.to <= current.from) continue
      conflicts.push({
        day,
        firstRuleId: String(previous.data?.rule_id ?? ''),
        secondRuleId: String(current.data?.rule_id ?? ''),
      })
    }
  }

  return conflicts
}

export function scheduleUpdateMessage(schedule: HassSchedule, rules: HumidifierScheduleRule[]) {
  return {
    type: 'schedule/update',
    schedule_id: schedule.id,
    name: schedule.name,
    icon: schedule.icon ?? 'mdi:calendar-clock',
    ...scheduleDaysFromRules(rules),
  }
}

export function formatScheduleDays(days: HumidifierWeekday[]) {
  const uniqueDays = HUMIDIFIER_WEEKDAYS.filter((day) => days.includes(day))
  if (uniqueDays.length === 7) return 'Every day'
  if (uniqueDays.join(',') === 'monday,tuesday,wednesday,thursday,friday') return 'Weekdays'
  if (uniqueDays.join(',') === 'sunday,saturday') return 'Weekends'
  return uniqueDays.map((day) => DAY_LABELS[day]).join(', ')
}

export function formatScheduleTime(start: string, end: string) {
  return `${formatClockTime(start)}–${formatClockTime(end)}`
}

export function formatClockTime(value: string) {
  const normalized = normalizedTime(value, '00:00')
  const [hourText, minute] = normalized.split(':')
  const hour = Number(hourText) % 24
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minute} ${suffix}`
}

export function scheduleProfileSummary(rule: HumidifierScheduleRule) {
  if (rule.mode === 'Sleep') return 'Sleep'
  if (rule.mode === 'Target Humidity') return `Auto ${rule.targetHumidity}% • Mist ${rule.mistLevel}`
  return `Manual • Mist ${rule.mistLevel} • Warm ${rule.warmLevel}`
}
