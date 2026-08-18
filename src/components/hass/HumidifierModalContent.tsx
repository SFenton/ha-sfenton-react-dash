import { useEntity, useHass, useUser } from '@hakit/core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HUMIDIFIER_MIST_PRESETS, HUMIDIFIER_MODES, HUMIDIFIER_WARM_LEVELS, type HumidifierConfig, type HumidifierMode } from '../../constants/humidifiers'
import { HUMIDIFIER_MODAL_TABS, type HumidifierModalTab } from '../../constants/surfaceSemantics'
import { useImmediateVisualTab, useSmoothDisplayedModalTab } from '../../hooks/useSmoothDisplayedModalTab'
import { useOptimisticState } from '../../hooks/useOptimisticState'
import { useScheduleDetailPage } from '../../hooks/useScheduleDetailPage'
import { Description } from '../core/Description'
import { GlassTile } from '../core/GlassTile'
import { InlineAlert } from '../core/InlineAlert'
import { MaterialIcon } from '../core/Icon'
import { ModalSheet } from '../core/ModalSheet'
import { NativeSelectField } from '../core/NativeSelectField'
import { NumberStepper } from '../core/Stepper'
import { ScheduleEditorFields } from '../core/ScheduleEditorFields'
import { ScheduleCollection, ScheduleDetailFooter, ScheduleListRow } from '../core/ScheduleFlow'
import { isValidScheduleTime } from '../core/scheduleTime'
import { SectionHeader } from '../core/SectionHeader'
import { StatusPill, type StatusPillTone } from '../core/StatusPill'
import { ToggleSetting } from '../core/ToggleSetting'
import { asEntityName, titleCaseState } from './entityState'
import { HUMIDIFIER_MODAL_DETAIL_STYLE, HUMIDIFIER_MODAL_SCHEDULES_STYLE, HUMIDIFIER_MODAL_STYLE } from './humidifierModalStyle'
import { SingleValueCircularDial } from './SingleValueCircularDial'
import {
  HUMIDIFIER_WEEKDAYS,
  createHumidifierScheduleRule,
  formatScheduleDays,
  formatScheduleTime,
  scheduleConflicts,
  scheduleProfileSummary,
  scheduleRules,
  scheduleUpdateMessage,
  type HassSchedule,
  type HumidifierScheduleRule,
  type HumidifierWeekday,
  type ScheduleConflict,
} from './humidifierSchedule'
import styles from './HumidifierModalContent.module.css'

type CallService = (params: Record<string, unknown>) => void
type Entity = ReturnType<typeof useEntity>

interface HassConnection {
  sendMessagePromise?: <T>(message: Record<string, unknown>) => Promise<T>
}

interface HumidifierModalContentProps {
  config: HumidifierConfig
  roomTitle: string
}

interface HumidifierControlState {
  blocked: boolean
  currentHumidity: number | null
  currentTemperatureText: string
  displayOn: boolean
  fault: 'tank' | 'water' | null
  humidifying: boolean
  mistLevel: number
  mode: HumidifierMode
  powerOn: boolean
  targetHumidity: number
  targetHumidityValid: boolean
  timerMinutes: number
  timerRemaining: number | null
  unavailable: boolean
  warmLevel: number
}

interface HumidifierActions {
  setDisplay: (on: boolean) => void
  setLevel: (level: number) => void
  setMode: (mode: HumidifierMode) => void
  setTargetHumidity: (humidity: number) => void
  setTimerMinutes: (minutes: number) => void
  setWarmLevel: (level: number) => void
  togglePower: () => void
}

const DEFAULT_TARGET_HUMIDITY = 50
const HUMIDIFIER_OPTIMISTIC_REVERT_MS = 8000
const DIAL_MIN = 0
const DIAL_MAX = 9
const DIAL_STEP = 1

function isUnavailable(entity: Entity | null | undefined) {
  return !entity || entity.state === 'unknown' || entity.state === 'unavailable'
}

function numberState(entity: Entity | null | undefined) {
  const value = Number(entity?.state)
  return Number.isFinite(value) ? value : null
}

function clamped(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function displayTemperature(entity: Entity | null | undefined) {
  if (isUnavailable(entity)) return 'Unavailable'
  const value = numberState(entity)
  if (value === null) return titleCaseState(entity?.state ?? 'unavailable')
  const unit = typeof entity?.attributes.unit_of_measurement === 'string' ? entity.attributes.unit_of_measurement : '°'
  return `${Math.round(value)}${unit}`
}

function formatHumidity(value: number | null) {
  return value === null ? 'Unavailable' : `${Math.round(value)}%`
}

function formatDurationMinutes(minutes: number) {
  if (minutes <= 0) return 'Off'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`
}

function formatDurationSeconds(seconds: number | null) {
  if (seconds === null || seconds <= 0) return 'Off'
  return formatDurationMinutes(Math.max(1, Math.ceil(seconds / 60)))
}

function warmLevelLabel(level: number) {
  return HUMIDIFIER_WARM_LEVELS.find((option) => option.value === level)?.label ?? `Level ${level}`
}

function modeDisplayLabel(mode: HumidifierMode) {
  return mode === 'Target Humidity' ? 'Auto Humidity' : mode
}

function statusTone(state: HumidifierControlState): StatusPillTone {
  if (state.unavailable) return 'unavailable'
  if (state.fault === 'tank') return 'danger'
  if (state.fault === 'water') return 'warning'
  if (state.humidifying) return 'active'
  if (state.powerOn) return 'ok'
  return 'neutral'
}

function scheduleRuleId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `humidifier-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function scheduleConflictMessage(conflict: ScheduleConflict) {
  return `This activity overlaps another activity on ${titleCaseState(conflict.day)}.`
}

function ModeTile({ active, disabled, icon, label, onClick, subtitle }: { active: boolean; disabled: boolean; icon: string; label: string; onClick: () => void; subtitle?: string }) {
  return (
    <div className={styles.modeTile} data-disabled={disabled}>
      <GlassTile compact backgroundColor={active ? 'rgba(0, 150, 136, 0.58)' : undefined} icon={icon} isOff={!active} onClick={disabled ? undefined : onClick} pressed={active} subtitle={subtitle} title={label} tone={active ? 'climate' : 'neutral'} />
    </div>
  )
}

function HumidifierModalNav({ activeTab, onTabChange }: { activeTab: HumidifierModalTab; onTabChange: (tab: HumidifierModalTab) => void }) {
  const { clearVisualTab, setVisualTabNow, visualActiveTab } = useImmediateVisualTab(activeTab)

  return (
    <nav aria-label="Humidifier modal sections" className={styles.modalNav}>
      {HUMIDIFIER_MODAL_TABS.map((item) => {
        const active = visualActiveTab === item.tab
        return (
          <button
            aria-current={activeTab === item.tab ? 'page' : undefined}
            aria-label={item.label}
            className={[styles.modalNavButton, active ? styles.modalNavButtonActive : ''].filter(Boolean).join(' ')}
            key={item.tab}
            onBlur={clearVisualTab}
            onClick={() => {
              setVisualTabNow(item.tab)
              onTabChange(item.tab)
            }}
            onPointerCancel={clearVisualTab}
            onPointerDown={() => setVisualTabNow(item.tab)}
            type="button"
          >
            <MaterialIcon name={item.icon} size={22} />
          </button>
        )
      })}
    </nav>
  )
}

function HumidifierHero({ actions, state }: { actions: HumidifierActions; state: HumidifierControlState }) {
  const sleepMode = state.mode === 'Sleep'
  const canSetLevel = !state.blocked && !sleepMode
  const dialValue = state.powerOn ? state.mistLevel : 0
  const readout = sleepMode ? 'Sleep' : state.powerOn ? String(dialValue) : 'Off'
  const hint: string | null = state.unavailable
    ? 'Humidifier controls are unavailable.'
    : state.fault === 'tank'
      ? 'Reinsert the water tank to restore controls.'
      : state.fault === 'water'
        ? 'Refill the tank to restore output controls.'
        : sleepMode
          ? 'Sleep mode controls output automatically.'
          : state.powerOn
            ? 'Drag the dial to adjust mist output.'
            : null

  return (
    <div className={styles.hero}>
      <SingleValueCircularDial
        ariaLabel={`Humidifier mist level ${readout}`}
        actionText={state.powerOn && !sleepMode ? 'Mist Level' : undefined}
        color="rgba(48, 190, 151, 0.96)"
        disabled={!canSetLevel}
        handleAriaLabel="Mist level"
        inactive={!state.powerOn || sleepMode}
        max={DIAL_MAX}
        min={DIAL_MIN}
        off={!state.powerOn}
        onCommit={(value) => actions.setLevel(clamped(Math.round(value), DIAL_MIN, DIAL_MAX))}
        primaryText={(value) => sleepMode ? 'Sleep' : state.powerOn ? String(value) : 'OFF'}
        primaryTextVariant={sleepMode ? 'wide-status' : undefined}
        secondaryText={state.powerOn ? `${formatHumidity(state.currentHumidity)} current` : undefined}
        step={DIAL_STEP}
        value={dialValue}
      />
      <button
        className={styles.powerButton}
        data-active={state.powerOn ? 'true' : 'false'}
        disabled={state.unavailable || (!state.powerOn && Boolean(state.fault))}
        onClick={actions.togglePower}
        type="button"
      >
        <MaterialIcon name="mdi:power" size={20} />
        <span>{state.powerOn ? 'Turn Off' : 'Turn On'}</span>
      </button>
      {hint && <Description className={styles.heroHint}>{hint}</Description>}
    </div>
  )
}

function TargetHumidityDial({ actions, state }: { actions: HumidifierActions; state: HumidifierControlState }) {
  return (
    <div className={styles.targetDial}>
      <SingleValueCircularDial
        actionText="Target Humidity"
        ariaLabel={`Target humidity ${state.targetHumidity}%`}
        color="rgba(48, 190, 151, 0.96)"
        disabled={state.blocked}
        handleAriaLabel="Target humidity"
        max={80}
        min={40}
        onCommit={actions.setTargetHumidity}
        primaryText={(value) => String(value)}
        primaryUnit="%"
        secondaryText={`${formatHumidity(state.currentHumidity)} current`}
        size="compact"
        step={5}
        trails={[
          { color: 'rgba(67, 160, 71, 0.92)', from: 40, id: 'comfort', to: 50 },
          { color: 'rgba(251, 140, 0, 0.9)', from: 60, id: 'high', to: 80 },
        ]}
        value={state.targetHumidity}
      />
    </div>
  )
}

function ControlsPanel({ actions, state }: { actions: HumidifierActions; state: HumidifierControlState }) {
  const sleepMode = state.mode === 'Sleep'
  const controlsDisabled = state.blocked

  return (
    <div className={styles.panelStack}>
      <section className={styles.section}>
        <SectionHeader title="Mode" />
        <div className={styles.modeGrid}>
          {HUMIDIFIER_MODES.map((option) => (
            <ModeTile active={state.mode === option.value} disabled={controlsDisabled} icon={option.icon} key={option.value} label={option.label} onClick={() => actions.setMode(option.value)} />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <SectionHeader title="Mist Output" />
        <Description>Use the dial for exact levels, or choose a quick preset.</Description>
        <div className={styles.modeGrid}>
          {HUMIDIFIER_MIST_PRESETS.map((preset) => (
            <ModeTile active={state.powerOn && state.mistLevel === preset.value} disabled={controlsDisabled || sleepMode} icon={preset.icon} key={preset.value} label={preset.label} onClick={() => actions.setLevel(preset.value)} subtitle={`Level ${preset.value}`} />
          ))}
        </div>
      </section>

      {state.mode === 'Target Humidity' && (
        <section className={styles.section}>
          <SectionHeader title="Target Humidity" />
          {!state.targetHumidityValid && <InlineAlert icon="mdi:water-percent">Choose a target before relying on Auto Humidity.</InlineAlert>}
          <TargetHumidityDial actions={actions} state={state} />
          {state.targetHumidity > 60
            ? <InlineAlert>Targets above 60% can encourage condensation and mold.</InlineAlert>
            : <Description>40–50% is the recommended comfort range for most homes.</Description>}
        </section>
      )}

      <section className={styles.section}>
        <SectionHeader title="Warm Mist" />
        <div className={styles.modeGrid}>
          {HUMIDIFIER_WARM_LEVELS.map((option) => (
            <ModeTile active={state.warmLevel === option.value} disabled={controlsDisabled || sleepMode} icon={option.icon} key={option.value} label={option.label} onClick={() => actions.setWarmLevel(option.value)} />
          ))}
        </div>
      </section>

      {state.powerOn && (
        <section className={styles.section}>
          <SectionHeader title="Device Timer" />
          <Description>This one-shot timer turns the humidifier off. Recurring activities live in Schedules.</Description>
          <NumberStepper
            decrementLabel="Decrease device timer"
            disabled={controlsDisabled}
            formatValue={formatDurationMinutes}
            icon="mdi:clock-outline"
            incrementLabel="Increase device timer"
            label="Turn Off In"
            max={720}
            min={0}
            onChange={actions.setTimerMinutes}
            step={30}
            value={state.timerMinutes}
          />
          {state.timerRemaining !== null && state.timerRemaining > 0 && (
            <button className={styles.secondaryAction} onClick={() => actions.setTimerMinutes(0)} type="button">
              <MaterialIcon name="mdi:close" size={18} />
              Cancel timer · {formatDurationSeconds(state.timerRemaining)} remaining
            </button>
          )}
        </section>
      )}

      {state.powerOn && (
        <section className={`${styles.section} ${styles.displaySection}`}>
          <SectionHeader title="Display" />
          <ToggleSetting checked={state.displayOn} disabled={controlsDisabled || sleepMode} icon="mdi:monitor" label="Display" onChange={actions.setDisplay} />
        </section>
      )}
    </div>
  )
}

function ScheduleEditor({
  conflictText,
  disabled,
  draft,
  onChange,
}: {
  conflictText?: string
  disabled: boolean
  draft: HumidifierScheduleRule
  onChange: (rule: HumidifierScheduleRule) => void
}) {
  const hasDays = draft.days.length > 0
  const hasValidTimes = isValidScheduleTime(draft.start) && isValidScheduleTime(draft.end)
  const setDraft = (update: (current: HumidifierScheduleRule) => HumidifierScheduleRule) => onChange(update(draft))

  return (
    <ScheduleEditorFields
      dayOptions={HUMIDIFIER_WEEKDAYS.map((day) => ({ label: titleCaseState(day), value: day }))}
      days={draft.days}
      disabled={disabled}
      nameField={{ label: 'Name', maxLength: 40, onChange: (label) => setDraft((current) => ({ ...current, label })), value: draft.label }}
      onDaysChange={(days: HumidifierWeekday[]) => setDraft((current) => ({ ...current, days }))}
      timeFields={[
        { label: 'Start', onChange: (start) => setDraft((current) => ({ ...current, start })), value: draft.start },
        { label: 'End', onChange: (end) => setDraft((current) => ({ ...current, end })), value: draft.end },
      ]}
    >
      <NativeSelectField
        className={styles.scheduleSelectField}
        label="Mode"
        onChange={(value) => {
          const mode = value as HumidifierMode
          setDraft((current) => ({ ...current, display: mode === 'Sleep' ? false : current.display, mode }))
        }}
        options={HUMIDIFIER_MODES.map((mode) => ({ label: mode.label, value: mode.value }))}
        value={draft.mode}
      />

      {draft.mode !== 'Sleep' && (
        <div className={styles.activityDialGrid} data-count={draft.mode === 'Target Humidity' ? '2' : '1'}>
          <section className={styles.section}>
            <SectionHeader title="Mist Level" />
            <SingleValueCircularDial
              actionText="Mist Level"
              ariaLabel={`Scheduled mist level ${draft.mistLevel}`}
              color="rgba(48, 190, 151, 0.96)"
              handleAriaLabel="Scheduled mist level"
              max={9}
              min={1}
              onCommit={(mistLevel) => setDraft((current) => ({ ...current, mistLevel }))}
              primaryText={String}
              size="compact"
              step={1}
              value={draft.mistLevel}
            />
          </section>
          {draft.mode === 'Target Humidity' && (
            <section className={styles.section}>
              <SectionHeader title="Target Humidity" />
              <SingleValueCircularDial
                actionText="Target Humidity"
                ariaLabel={`Scheduled target humidity ${draft.targetHumidity}%`}
                color="rgba(48, 190, 151, 0.96)"
                handleAriaLabel="Scheduled target humidity"
                max={80}
                min={40}
                onCommit={(targetHumidity) => setDraft((current) => ({ ...current, targetHumidity }))}
                primaryText={String}
                primaryUnit="%"
                size="compact"
                step={5}
                trails={[
                  { color: 'rgba(67, 160, 71, 0.92)', from: 40, id: 'comfort', to: 50 },
                  { color: 'rgba(251, 140, 0, 0.9)', from: 60, id: 'high', to: 80 },
                ]}
                value={draft.targetHumidity}
              />
            </section>
          )}
        </div>
      )}

      {draft.mode !== 'Sleep' && (
        <section className={styles.section}>
          <SectionHeader title="Warm Mist" />
          <div className={styles.modeGrid}>
            {HUMIDIFIER_WARM_LEVELS.map((option) => (
              <ModeTile active={draft.warmLevel === option.value} disabled={false} icon={option.icon} key={option.value} label={option.label} onClick={() => setDraft((current) => ({ ...current, warmLevel: option.value }))} />
            ))}
          </div>
        </section>
      )}

      {draft.mode !== 'Sleep' && (
        <section className={`${styles.section} ${styles.displaySection}`}>
          <SectionHeader title="Display" />
          <ToggleSetting checked={draft.display} disabled={false} icon="mdi:monitor" label="Display" onChange={(display) => setDraft((current) => ({ ...current, display }))} />
        </section>
      )}

      {!hasDays && <InlineAlert>Select at least one day.</InlineAlert>}
      {!hasValidTimes && <InlineAlert>Choose valid start and end times.</InlineAlert>}
      {conflictText && <InlineAlert>{conflictText}</InlineAlert>}
    </ScheduleEditorFields>
  )
}

interface HumidifierScheduleController {
  activeRuleId?: string
  canEdit: boolean
  clearError: () => void
  enabled: boolean
  error: string | null
  loading: boolean
  masterAvailable: boolean
  ready: boolean
  rules: HumidifierScheduleRule[]
  saveRules: (nextRules: HumidifierScheduleRule[]) => Promise<boolean>
  saving: boolean
  scheduleActive: boolean
  toggleEnabled: () => void
  vacationActive: boolean
}

function useHumidifierScheduleController(config: HumidifierConfig): HumidifierScheduleController {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const connection = useHass((state) => state.connection) as unknown as HassConnection
  const scheduleEnabledEntity = useEntity(asEntityName(config.scheduleEnabledEntityId), { returnNullIfNotFound: true })
  const scheduleEntity = useEntity(asEntityName(config.scheduleEntityId), { returnNullIfNotFound: true })
  const vacationModeEntity = useEntity(asEntityName(config.vacationModeEntityId), { returnNullIfNotFound: true })
  const user = useUser() as { is_admin?: boolean } | null
  const canEdit = user?.is_admin !== false
  const masterAvailable = Boolean(scheduleEnabledEntity && !isUnavailable(scheduleEnabledEntity))
  const liveEnabled = scheduleEnabledEntity?.state === 'on'
  const scheduleActive = scheduleEntity?.state === 'on'
  const vacationActive = vacationModeEntity?.state === 'on'
  const activeRuleId = typeof scheduleEntity?.attributes.rule_id === 'string' ? scheduleEntity.attributes.rule_id : undefined
  const [enabled, commitEnabled] = useOptimisticState(liveEnabled, { clearOn: 'confirmation', revertMs: HUMIDIFIER_OPTIMISTIC_REVERT_MS })
  const [schedule, setSchedule] = useState<HassSchedule | null>(null)
  const [rules, setRules] = useState<HumidifierScheduleRule[]>([])
  const scheduleApiAvailable = Boolean(connection?.sendMessagePromise)
  const [loading, setLoading] = useState(scheduleApiAvailable)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(scheduleApiAvailable ? null : 'Home Assistant schedule editing is unavailable.')

  useEffect(() => {
    let cancelled = false
    if (!connection?.sendMessagePromise) return undefined

    connection.sendMessagePromise<HassSchedule[]>({ type: 'schedule/list' })
      .then((items) => {
        if (cancelled) return
        const found = items.find((item) => item.id === config.scheduleId)
        if (!found) {
          setError('The humidifier schedule helper was not found.')
          return
        }
        setSchedule(found)
        setRules(scheduleRules(found))
        setError(null)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load scheduled activities.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [config.scheduleId, connection])

  const toggleEnabled = () => {
    if (!masterAvailable) return
    const next = !enabled
    commitEnabled(next)
    callService({ domain: 'input_boolean', service: next ? 'turn_on' : 'turn_off', target: config.scheduleEnabledEntityId })
  }

  const saveRules = async (nextRules: HumidifierScheduleRule[]) => {
    if (!schedule || !connection.sendMessagePromise) return false
    const conflicts = scheduleConflicts(nextRules)
    if (conflicts.length) {
      setError(scheduleConflictMessage(conflicts[0]))
      return false
    }
    setSaving(true)
    setError(null)
    try {
      const updated = await connection.sendMessagePromise<HassSchedule>(scheduleUpdateMessage(schedule, nextRules))
      setSchedule(updated)
      setRules(scheduleRules(updated))
      if (rules.length === 0 && nextRules.length > 0 && !enabled && !vacationActive && masterAvailable) {
        commitEnabled(true)
        callService({ domain: 'input_boolean', service: 'turn_on', target: config.scheduleEnabledEntityId })
      } else if (nextRules.length === 0 && enabled && masterAvailable) {
        commitEnabled(false)
        callService({ domain: 'input_boolean', service: 'turn_off', target: config.scheduleEnabledEntityId })
      }
      return true
    } catch {
      setError('Could not save scheduled activities.')
      return false
    } finally {
      setSaving(false)
    }
  }

  return {
    activeRuleId,
    canEdit,
    clearError: () => setError(null),
    enabled,
    error,
    loading,
    masterAvailable,
    ready: Boolean(schedule),
    rules,
    saveRules,
    saving,
    scheduleActive,
    toggleEnabled,
    vacationActive,
  }
}

function SchedulesPanel({ controller, onAdd, onEdit }: { controller: HumidifierScheduleController; onAdd: () => void; onEdit: (rule: HumidifierScheduleRule) => void }) {
  const { activeRuleId, canEdit, enabled, error, loading, masterAvailable, ready, rules, saving, scheduleActive, toggleEnabled, vacationActive } = controller
  return (
    <ScheduleCollection
      addAction={canEdit ? { disabled: loading || saving || !ready, focusKey: 'add-scheduled-activity', label: 'Add Scheduled Activity', onClick: onAdd } : undefined}
      control={{
        active: enabled,
        description: 'Schedules run on Home Assistant. Manual changes last until the next activity or restart/reconnect recovery.',
        disabled: !masterAvailable || rules.length === 0 || vacationActive,
        icon: 'mdi:calendar',
        label: !masterAvailable ? 'Scheduling Unavailable' : vacationActive ? 'Paused for Vacation' : enabled ? 'Scheduling On' : 'Scheduling Paused',
        onToggle: toggleEnabled,
        subtitle: !masterAvailable ? 'Home Assistant schedule control is unavailable' : vacationActive ? 'Vacation mode disables scheduled runs' : scheduleActive ? 'Activity running now' : rules.length === 0 ? 'Add an activity to enable scheduling' : `${rules.length} ${rules.length === 1 ? 'activity' : 'activities'} configured`,
      }}
      empty={rules.length === 0}
      emptyText="No activities yet. Add morning, evening, or overnight profiles."
      error={error}
      itemsTitle="Activities"
      loading={loading}
      loadingText="Loading scheduled activities…"
      readOnlyText={!canEdit ? 'Only Home Assistant administrators can edit scheduled activities.' : undefined}
    >
      {rules.map((rule) => (
        <ScheduleListRow
          active={scheduleActive && activeRuleId === rule.id}
          disabled={!canEdit || saving}
          focusKey={rule.id}
          key={rule.id}
          onClick={() => onEdit(rule)}
          primary={rule.label}
          secondary={`${formatScheduleDays(rule.days)} · ${formatScheduleTime(rule.start, rule.end)}`}
          tertiary={`${scheduleProfileSummary(rule)}${scheduleActive && activeRuleId === rule.id ? ' • Active now' : ''}`}
        />
      ))}
    </ScheduleCollection>
  )
}

function InfoPanel({ state }: { state: HumidifierControlState }) {
  const outputValue = state.fault === 'tank' ? 'Tank Removed' : state.fault === 'water' ? 'Water Low' : state.humidifying ? 'Humidifying' : state.powerOn ? 'Idle' : 'Off'
  const outputTone = statusTone(state)
  const waterValue = state.fault === 'water' || state.fault === 'tank' ? 'Low' : 'OK'
  const waterTone: StatusPillTone = state.fault ? 'warning' : 'ok'
  const tankValue = state.fault === 'tank' ? 'Removed' : 'Installed'
  const tankTone: StatusPillTone = state.fault === 'tank' ? 'danger' : 'ok'

  return (
    <div className={styles.panelStack}>
      <section className={styles.section}>
        <SectionHeader title="Device State" />
        <div className={styles.infoGrid}>
          <StatusPill grouped icon="mdi:air-humidifier" label="Output" tone={outputTone} value={outputValue} />
          <StatusPill grouped icon="mdi:water" label="Water" tone={waterTone} value={waterValue} />
          <StatusPill grouped icon="mdi:water" label="Tank" tone={tankTone} value={tankValue} />
          <StatusPill grouped icon="mdi:fan-auto" label="Mode" value={modeDisplayLabel(state.mode)} />
          <StatusPill grouped icon="mdi:monitor" label="Display" value={state.displayOn ? 'On' : 'Off'} />
          <StatusPill grouped icon="mdi:fire" label="Warm Mist" value={warmLevelLabel(state.warmLevel)} />
        </div>
      </section>

      <section className={styles.section}>
        <SectionHeader title="Environment" />
        <div className={styles.infoGrid}>
          <StatusPill grouped icon="mdi:water-percent" label="Humidity" value={formatHumidity(state.currentHumidity)} />
          <StatusPill grouped icon="mdi:thermometer" label="Temperature" value={state.currentTemperatureText} />
          <StatusPill grouped icon="mdi:air-humidifier" label="Mist Level" value={state.powerOn ? `Level ${state.mistLevel}` : `Saved ${state.mistLevel}`} />
          <StatusPill grouped icon="mdi:clock-outline" label="Timer" value={formatDurationSeconds(state.timerRemaining)} />
        </div>
      </section>

    </div>
  )
}

function useHumidifierController(config: HumidifierConfig) {
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const powerEntity = useEntity(asEntityName(config.powerEntityId), { returnNullIfNotFound: true })
  const modeEntity = useEntity(asEntityName(config.modeEntityId), { returnNullIfNotFound: true })
  const mistEntity = useEntity(asEntityName(config.mistLevelEntityId), { returnNullIfNotFound: true })
  const targetEntity = useEntity(asEntityName(config.targetHumidityEntityId), { returnNullIfNotFound: true })
  const warmEntity = useEntity(asEntityName(config.warmLevelEntityId), { returnNullIfNotFound: true })
  const timerEntity = useEntity(asEntityName(config.timerMinutesEntityId), { returnNullIfNotFound: true })
  const timerRemainingEntity = useEntity(asEntityName(config.timerRemainingEntityId), { returnNullIfNotFound: true })
  const displayEntity = useEntity(asEntityName(config.displayEntityId), { returnNullIfNotFound: true })
  const humidityEntity = useEntity(asEntityName(config.currentHumidityEntityId), { returnNullIfNotFound: true })
  const temperatureEntity = useEntity(asEntityName(config.currentTemperatureEntityId), { returnNullIfNotFound: true })
  const waterLowEntity = useEntity(asEntityName(config.waterLowEntityId), { returnNullIfNotFound: true })
  const tankRemovedEntity = useEntity(asEntityName(config.tankRemovedEntityId), { returnNullIfNotFound: true })
  const humidifyingEntity = useEntity(asEntityName(config.humidifyingEntityId), { returnNullIfNotFound: true })
  const unavailable = isUnavailable(powerEntity)
  const livePowerOn = powerEntity?.state === 'on'
  const liveMode = HUMIDIFIER_MODES.some((option) => option.value === modeEntity?.state) ? modeEntity?.state as HumidifierMode : 'Manual'
  const liveMistLevel = clamped(Math.round(numberState(mistEntity) ?? 5), 1, 9)
  const rawTargetHumidity = numberState(targetEntity)
  const liveTargetValid = rawTargetHumidity !== null && rawTargetHumidity >= 40 && rawTargetHumidity <= 80
  const liveTargetHumidity = liveTargetValid ? rawTargetHumidity : DEFAULT_TARGET_HUMIDITY
  const liveWarmLevel = clamped(Math.round(numberState(warmEntity) ?? 0), 0, 3)
  const liveTimerMinutes = clamped(Math.round(numberState(timerEntity) ?? 0), 0, 720)
  const liveDisplayOn = displayEntity?.state === 'on'
  const [powerOn, commitPowerOn] = useOptimisticState(livePowerOn, { clearOn: 'confirmation', revertMs: HUMIDIFIER_OPTIMISTIC_REVERT_MS })
  const [mode, commitMode] = useOptimisticState(liveMode, { clearOn: 'confirmation', revertMs: HUMIDIFIER_OPTIMISTIC_REVERT_MS })
  const [mistLevel, commitMistLevel] = useOptimisticState(liveMistLevel, { clearOn: 'confirmation', revertMs: HUMIDIFIER_OPTIMISTIC_REVERT_MS })
  const [targetHumidity, commitTargetHumidity] = useOptimisticState(liveTargetHumidity, { clearOn: 'confirmation', revertMs: HUMIDIFIER_OPTIMISTIC_REVERT_MS })
  const [targetHumidityValid, commitTargetHumidityValid] = useOptimisticState(liveTargetValid, { clearOn: 'confirmation', revertMs: HUMIDIFIER_OPTIMISTIC_REVERT_MS })
  const [warmLevel, commitWarmLevel] = useOptimisticState(liveWarmLevel, { clearOn: 'confirmation', revertMs: HUMIDIFIER_OPTIMISTIC_REVERT_MS })
  const [timerMinutes, commitTimerMinutes] = useOptimisticState(liveTimerMinutes, { clearOn: 'confirmation', revertMs: HUMIDIFIER_OPTIMISTIC_REVERT_MS })
  const [displayOn, commitDisplayOn] = useOptimisticState(liveDisplayOn, { clearOn: 'confirmation', revertMs: HUMIDIFIER_OPTIMISTIC_REVERT_MS })
  const currentHumidity = numberState(humidityEntity)
  const timerRemaining = numberState(timerRemainingEntity)
  const fault = tankRemovedEntity?.state === 'on' ? 'tank' : waterLowEntity?.state === 'on' ? 'water' : null
  const blocked = unavailable || Boolean(fault)
  const state: HumidifierControlState = {
    blocked,
    currentHumidity,
    currentTemperatureText: displayTemperature(temperatureEntity),
    displayOn,
    fault,
    humidifying: humidifyingEntity?.state === 'on',
    mistLevel,
    mode,
    powerOn,
    targetHumidity,
    targetHumidityValid,
    timerMinutes,
    timerRemaining,
    unavailable,
    warmLevel,
  }

  const actions: HumidifierActions = useMemo(() => ({
    setDisplay: (on: boolean) => {
      commitDisplayOn(on)
      callService({ domain: 'switch', service: on ? 'turn_on' : 'turn_off', target: config.displayEntityId })
    },
    setLevel: (level: number) => {
      const next = clamped(Math.round(level), 0, 9)
      commitPowerOn(next > 0)
      if (next > 0) commitMistLevel(next)
      callService({ domain: 'script', service: config.setLevelScriptService, serviceData: { level: next } })
    },
    setMode: (nextMode: HumidifierMode) => {
      commitMode(nextMode)
      callService({ domain: 'select', service: 'select_option', target: config.modeEntityId, serviceData: { option: nextMode } })
    },
    setTargetHumidity: (humidity: number) => {
      const next = clamped(Math.round(humidity / 5) * 5, 40, 80)
      commitTargetHumidity(next)
      commitTargetHumidityValid(true)
      callService({ domain: 'number', service: 'set_value', target: config.targetHumidityEntityId, serviceData: { value: next } })
    },
    setTimerMinutes: (minutes: number) => {
      const next = clamped(Math.round(minutes / 30) * 30, 0, 720)
      commitTimerMinutes(next)
      callService({ domain: 'number', service: 'set_value', target: config.timerMinutesEntityId, serviceData: { value: next } })
    },
    setWarmLevel: (level: number) => {
      const next = clamped(Math.round(level), 0, 3)
      commitWarmLevel(next)
      callService({ domain: 'number', service: 'set_value', target: config.warmLevelEntityId, serviceData: { value: next } })
    },
    togglePower: () => {
      const next = !powerOn
      commitPowerOn(next)
      callService({ domain: 'switch', service: next ? 'turn_on' : 'turn_off', target: config.powerEntityId })
    },
  }), [callService, commitDisplayOn, commitMistLevel, commitMode, commitPowerOn, commitTargetHumidity, commitTargetHumidityValid, commitTimerMinutes, commitWarmLevel, config, powerOn])

  return { actions, state }
}

function humidifierSubtitle(state: HumidifierControlState) {
  if (state.unavailable) return 'Unavailable'
  if (!state.powerOn) return 'Off'
  if (state.fault === 'tank') return 'Tank Removed'
  if (state.fault === 'water') return 'Water Low'
  return [state.humidifying ? 'Humidifying' : 'On', formatHumidity(state.currentHumidity)].filter(Boolean).join(' • ')
}

function HumidifierMainPage({
  activeTab,
  actions,
  onAddActivity,
  onEditActivity,
  roomTitle,
  scheduleController,
  state,
  onPanelElementChange,
}: {
  activeTab: HumidifierModalTab
  actions: HumidifierActions
  onAddActivity: () => void
  onEditActivity: (rule: HumidifierScheduleRule) => void
  roomTitle: string
  scheduleController: HumidifierScheduleController
  state: HumidifierControlState
  onPanelElementChange?: (element: HTMLDivElement | null) => void
}) {
  const { displayedTab, transitionState } = useSmoothDisplayedModalTab(activeTab)

  return (
    <div aria-label={`${roomTitle} humidifier controls`} className={styles.modalSheetPage}>
      <div className={styles.modalBody}>
        <div className={styles.heroColumn}>
          <HumidifierHero actions={actions} state={state} />
          {state.fault === 'tank' && <InlineAlert>Tank removed — reinsert it before turning the humidifier on.</InlineAlert>}
          {state.fault === 'water' && <InlineAlert>Water is low — refill the tank before turning the humidifier on.</InlineAlert>}
          <div className={styles.heroStatusGrid}>
            <StatusPill icon="mdi:water-percent" label="Current Humidity" value={formatHumidity(state.currentHumidity)} />
            <StatusPill icon="mdi:thermometer" label="Temperature" value={state.currentTemperatureText} />
          </div>
        </div>
        <div aria-label={`${roomTitle} humidifier ${displayedTab} panel`} className={styles.modalPanel} data-modal-tab-transition-state={transitionState} data-tab={displayedTab} ref={onPanelElementChange}>
          {displayedTab === 'controls' && <ControlsPanel actions={actions} state={state} />}
          {displayedTab === 'schedules' && <SchedulesPanel controller={scheduleController} onAdd={onAddActivity} onEdit={onEditActivity} />}
          {displayedTab === 'info' && <InfoPanel state={state} />}
        </div>
      </div>
    </div>
  )
}

interface HumidifierActivityPage {
  editingId: string | null
  rule: HumidifierScheduleRule
}

export function HumidifierModal({ config, onClose, open, roomTitle }: HumidifierModalContentProps & { onClose: () => void; open: boolean }) {
  const { actions, state } = useHumidifierController(config)
  const scheduleController = useHumidifierScheduleController(config)
  const [activeTab, setActiveTab] = useState<HumidifierModalTab>('controls')
  const [activityPage, setActivityPage] = useState<HumidifierActivityPage | null>(null)
  const [previousOpen, setPreviousOpen] = useState(open)
  const activityOperationRef = useRef(0)
  const schedulePanelRef = useRef<HTMLDivElement | null>(null)
  const { bodyElementRef: modalBodyRef, closeDetailPage, detailOpen, openDetailPage, resetDetailPage } = useScheduleDetailPage(activityPage, setActivityPage, schedulePanelRef)
  const setSchedulePanelElement = useCallback((element: HTMLDivElement | null) => {
    schedulePanelRef.current = element
  }, [])
  if (open !== previousOpen) {
    setPreviousOpen(open)
    if (!open && activityPage) resetDetailPage()
  }

  const openActivityPage = (page: HumidifierActivityPage, returnFocusKey: string) => {
    activityOperationRef.current += 1
    scheduleController.clearError()
    openDetailPage(page, returnFocusKey)
  }
  const closeActivityPage = () => {
    activityOperationRef.current += 1
    closeDetailPage()
  }
  const addActivity = () => {
    const rule = createHumidifierScheduleRule(scheduleRuleId())
    openActivityPage({
      editingId: null,
      rule: {
        ...rule,
        display: state.displayOn,
        mistLevel: state.mistLevel,
        mode: state.mode,
        targetHumidity: state.targetHumidity,
        warmLevel: state.warmLevel,
      },
    }, 'add-scheduled-activity')
  }
  const editActivity = (rule: HumidifierScheduleRule) => openActivityPage({ editingId: rule.id, rule }, rule.id)
  const updateActivity = (rule: HumidifierScheduleRule) => {
    activityOperationRef.current += 1
    setActivityPage((current) => current ? { ...current, rule } : current)
  }
  const activityRules = activityPage
    ? activityPage.editingId
      ? scheduleController.rules.map((candidate) => candidate.id === activityPage.editingId ? activityPage.rule : candidate)
      : [...scheduleController.rules, activityPage.rule]
    : scheduleController.rules
  const activityConflict = activityPage ? scheduleConflicts(activityRules)[0] : undefined
  const activityInvalid = Boolean(activityPage && (
    activityPage.rule.days.length === 0
    || !activityPage.rule.label.trim()
    || !isValidScheduleTime(activityPage.rule.start)
    || !isValidScheduleTime(activityPage.rule.end)
    || activityConflict
  ))

  const saveActivity = async () => {
    if (!activityPage || activityInvalid) return
    const operation = activityOperationRef.current
    const normalizedRule = { ...activityPage.rule, label: activityPage.rule.label.trim() }
    const nextRules = activityPage?.editingId
      ? scheduleController.rules.map((candidate) => candidate.id === activityPage.editingId ? normalizedRule : candidate)
      : [...scheduleController.rules, normalizedRule]
    if (await scheduleController.saveRules(nextRules) && operation === activityOperationRef.current) closeActivityPage()
  }
  const deleteActivity = async () => {
    if (!activityPage?.editingId) return
    const operation = activityOperationRef.current
    if (await scheduleController.saveRules(scheduleController.rules.filter((candidate) => candidate.id !== activityPage.editingId)) && operation === activityOperationRef.current) closeActivityPage()
  }

  return (
    <ModalSheet
      backLabel="Back to schedules"
      bodyElementRef={modalBodyRef}
      contentStyle={detailOpen ? HUMIDIFIER_MODAL_DETAIL_STYLE : activeTab === 'schedules' ? HUMIDIFIER_MODAL_SCHEDULES_STYLE : HUMIDIFIER_MODAL_STYLE}
      footer={activityPage ? (
        <ScheduleDetailFooter
          deleteAction={activityPage.editingId ? { disabled: scheduleController.saving, icon: 'mdi:delete', label: 'Delete Activity', onClick: () => void deleteActivity() } : undefined}
          primaryAction={{ disabled: activityInvalid || scheduleController.saving, icon: 'mdi:content-save', label: scheduleController.saving ? 'Saving...' : 'Save Activity', onClick: () => void saveActivity() }}
        />
      ) : <HumidifierModalNav activeTab={activeTab} onTabChange={setActiveTab} />}
      onBack={detailOpen && !scheduleController.saving ? closeActivityPage : undefined}
      onClose={() => {
        activityOperationRef.current += 1
        resetDetailPage()
        onClose()
      }}
      open={open}
      scrollResetKey={activeTab}
      subtitle={detailOpen ? undefined : humidifierSubtitle(state)}
      title={detailOpen ? activityPage?.editingId ? activityPage.rule.label : `Add ${config.title} Schedule` : config.title}
    >
      {activityPage ? (
        <ScheduleEditor
          conflictText={activityConflict ? scheduleConflictMessage(activityConflict) : scheduleController.error ?? undefined}
          disabled={scheduleController.saving}
          draft={activityPage.rule}
          onChange={updateActivity}
        />
      ) : (
        <HumidifierMainPage
          activeTab={activeTab}
          actions={actions}
          onAddActivity={addActivity}
          onEditActivity={editActivity}
          onPanelElementChange={setSchedulePanelElement}
          roomTitle={roomTitle}
          scheduleController={scheduleController}
          state={state}
        />
      )}
    </ModalSheet>
  )
}

export function HumidifierModalContent({ config, roomTitle }: HumidifierModalContentProps) {
  const { actions, state } = useHumidifierController(config)
  const scheduleController = useHumidifierScheduleController(config)
  return (
    <HumidifierMainPage
      activeTab="controls"
      actions={actions}
      onAddActivity={() => undefined}
      onEditActivity={() => undefined}
      onPanelElementChange={undefined}
      roomTitle={roomTitle}
      scheduleController={scheduleController}
      state={state}
    />
  )
}
