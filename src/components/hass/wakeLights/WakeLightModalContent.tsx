import { useEntity } from '@hakit/core'
import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { WakeLightConfig, WakeLightSourceConfig, WakeLightSourceSide } from '../../../constants/wakeLights'
import { wakeLightSourceForSide } from '../../../constants/wakeLights'
import { copy as staticCopy, CORE_COPY_KEYS, CORE_COPY_NAMESPACE, formatDate, formatList, formatNumber, useCopy, WAKE_LIGHT_COPY_KEYS as C, WAKE_LIGHT_COPY_NAMESPACE, WAKE_LIGHT_PHASE_COPY_KEYS } from '../../../i18n'
import { useScheduleDetailPage } from '../../../hooks/useScheduleDetailPage'
import { useSmoothDisplayedModalTab } from '../../../hooks/useSmoothDisplayedModalTab'
import { Description } from '../../core/Description'
import { DynamicGrid } from '../../core/DynamicGrid'
import { FieldActionButton } from '../../core/FieldActionButton'
import { GlassTile } from '../../core/GlassTile'
import { InlineAlert } from '../../core/InlineAlert'
import { ModalSheet, type ModalCenteredGeometry } from '../../core/ModalSheet'
import { ModalIconTabNav, type ModalIconTabDefinition } from '../../core/ModalTabNav'
import { modalTabId, modalTabPanelId } from '../../core/modalTabIds'
import { NativePickerField } from '../../core/NativePickerField'
import { NativeSelectField } from '../../core/NativeSelectField'
import { RadioRow } from '../../core/RadioRow'
import { ScheduleEditorFields } from '../../core/ScheduleEditorFields'
import { ScheduleCollection, ScheduleDetailFooter, ScheduleListRow } from '../../core/ScheduleFlow'
import { SectionHeader } from '../../core/SectionHeader'
import { StatusPill } from '../../core/StatusPill'
import { ToggleControl } from '../../core/ToggleControl'
import { ToggleSetting } from '../../core/ToggleSetting'
import { asEntityName } from '../entityState'
import {
  bedAlarmPlanIsEmpty, planBedAlarmProvision,
  type BedAlarmSide, type WakeLightBedProvisioning, type WakeLightBedTarget,
} from './bedAlarmProvisioning'
import { useWakeLightController, type WakeLightController } from './useWakeLightController'
import {
  createWakeLightAlarm, formatWakeLightDate, formatWakeLightTime, validateWakeLightAlarm,
  vacationPermitsWakeLightRun, WAKE_LIGHT_ACTIVE_PHASES, WAKE_LIGHT_ALARM_KIND,
  WAKE_LIGHT_HOLD_MINUTES, WAKE_LIGHT_MODAL_TAB, WAKE_LIGHT_WEEKDAYS, WAKE_LIGHT_WEEKDAY_GROUPS,
  WAKE_LIGHT_PHASE, WAKE_LIGHT_RAMP_MINUTES, WAKE_LIGHT_SOURCE, WAKE_LIGHT_SOURCE_FAILURE_PREFIX,
  wakeLightAlarmLinkDays, wakeLightAlarmLinked, wakeLightAlarmLinkKey, wakeLightSnapshotFromEntity,
  type WakeLightAlarm, type WakeLightAlarmKind, type WakeLightModalTab,
  type WakeLightSnapshot, type WakeLightWeekday,
} from './wakeLightContract'
import styles from './WakeLightModalContent.module.css'

const GEOMETRY = {
  id: 'wake-light', blockPolicy: 'fixed', blockSize: '760px', inlineSize: '980px',
} satisfies ModalCenteredGeometry
const TAB_PREFIX = 'wake-light'
const PANEL_ID = modalTabPanelId(TAB_PREFIX, 'content')
const PRELOAD_SUBTITLE = staticCopy(WAKE_LIGHT_COPY_NAMESPACE, C.tile.unavailable)
type WakeCopy = ReturnType<typeof useCopy<typeof WAKE_LIGHT_COPY_NAMESPACE>>

function minutes(value: number) {
  return formatNumber(value, { style: 'unit', unit: 'minute', unitDisplay: 'short' })
}

function weekday(day: WakeLightWeekday, width: 'long' | 'short' = 'long') {
  return formatDate(new Date(2024, 0, 7 + WAKE_LIGHT_WEEKDAYS.indexOf(day)), { weekday: width })
}

function alarmId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `wake-alarm-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function editableAlarm(alarm: WakeLightAlarm) {
  return {
    bedSides: [...alarm.bedSides],
    date: alarm.date,
    enabled: alarm.enabled,
    kind: alarm.kind,
    label: alarm.label.trim(),
    localTime: alarm.localTime,
    rampMinutes: alarm.rampMinutes,
    weekdays: [...alarm.weekdays],
  }
}

function alarmDraftChanged(draft: WakeLightAlarm, initial: WakeLightAlarm | null) {
  return initial === null || JSON.stringify(editableAlarm(draft)) !== JSON.stringify(editableAlarm(initial))
}

function phaseLabel(snapshot: WakeLightSnapshot, copy: WakeCopy) {
  if (snapshot.phase === WAKE_LIGHT_PHASE.SNOOZED) return copy(C.phases.holding)
  return copy(WAKE_LIGHT_PHASE_COPY_KEYS[snapshot.phase])
}

function nextWakeParts(value: string) {
  const next = new Date(value)
  if (Number.isNaN(next.getTime())) return { date: '—', time: formatWakeLightTime(value) }
  return {
    date: formatDate(next, { day: 'numeric', month: 'numeric' }),
    time: formatWakeLightTime(value),
  }
}

function tileSubtitle(snapshot: WakeLightSnapshot, copy: WakeCopy, modal = false) {
  if (!snapshot.available) return copy(C.tile.unavailable)
  if (snapshot.phase === WAKE_LIGHT_PHASE.RECOVERING || snapshot.phase === WAKE_LIGHT_PHASE.SNOOZED) return phaseLabel(snapshot, copy)
  if (WAKE_LIGHT_ACTIVE_PHASES.includes(snapshot.phase)) {
    return copy(C.tile.activeProgress, { progress: Math.round(snapshot.commandedBrightnessPct) })
  }
  if (!snapshot.alarms.some(alarm => alarm.enabled)) return copy(modal ? C.tile.noActive : C.tile.noneEnabled)
  if (!vacationPermitsWakeLightRun(snapshot.safety.vacationState)) return copy(C.tile.vacationBlocked)
  if (snapshot.currentBlockers.length) return copy(C.phases.blocked)
  if (snapshot.nextWakeAt) {
    const { date, time } = nextWakeParts(snapshot.nextWakeAt)
    return snapshot.nextRampMinutes === null
      ? copy(C.tile.next, { date, time })
      : copy(C.tile.nextAndRamp, { date, duration: minutes(snapshot.nextRampMinutes), time })
  }
  return copy(C.phases.idle)
}

function ConnectedTile({ config, onOpen }: { config: WakeLightConfig; onOpen: () => void }) {
  const copy = useCopy(WAKE_LIGHT_COPY_NAMESPACE)
  const entity = useEntity(asEntityName(config.statusEntityId), { returnNullIfNotFound: true })
  const entityState = entity?.state
  const entityAttributes = entity?.attributes
  const snapshot = useMemo(() => wakeLightSnapshotFromEntity(
    config, entityState === undefined ? null : { state: entityState, attributes: entityAttributes },
  ), [config, entityAttributes, entityState])
  return <GlassTile icon="mdi:weather-sunset-up" isOff={!snapshot.available || !snapshot.alarms.some(alarm => alarm.enabled)}
    onClick={onOpen} progress={snapshot.phase === 'ramping' ? snapshot.progress : undefined}
    semantics={{ kind: 'modal' }} subtitle={tileSubtitle(snapshot, copy)} title={config.title} tone="light" />
}

export function WakeLightTile({ config, onOpen, preload = false }: {
  config: WakeLightConfig; onOpen: () => void; preload?: boolean
}) {
  return preload
    ? <GlassTile icon="mdi:weather-sunset-up" isOff subtitle={PRELOAD_SUBTITLE} title={config.title} tone="light" />
    : <ConnectedTile config={config} onOpen={onOpen} />
}

function tabs(copy: WakeCopy): readonly ModalIconTabDefinition<WakeLightModalTab>[] {
  return [
    { icon: 'mdi:alarm', label: copy(C.tabs.alarms), tab: WAKE_LIGHT_MODAL_TAB.ALARMS },
    { icon: 'mdi:tune-vertical', label: copy(C.tabs.defaults), tab: WAKE_LIGHT_MODAL_TAB.DEFAULTS },
  ]
}

function scheduleLabel(alarm: WakeLightAlarm, copy: WakeCopy) {
  if (alarm.kind === WAKE_LIGHT_ALARM_KIND.ONCE) return alarm.date ? formatWakeLightDate(alarm.date) : '—'
  const days = WAKE_LIGHT_WEEKDAYS.filter(day => alarm.weekdays.includes(day))
  if (days.length === 7) return copy(C.summary.everyDay)
  if (JSON.stringify(days) === JSON.stringify(WAKE_LIGHT_WEEKDAY_GROUPS.WEEKDAYS)) return copy(C.summary.weekdays)
  if (JSON.stringify(days) === JSON.stringify(WAKE_LIGHT_WEEKDAY_GROUPS.WEEKENDS)) return copy(C.summary.weekends)
  return formatList(days.map(day => weekday(day, 'short')))
}

function blockedMessage(code: string, copy: WakeCopy) {
  if (code.startsWith(WAKE_LIGHT_SOURCE_FAILURE_PREFIX)) return copy(C.blockers.source)
  if (code === 'pbl_not_ready') return copy(C.blockers.presence)
  if (code === 'blocker_not_off') return copy(C.blockers.blocker)
  if (code === 'legacy_brightness_255_lifecycle_unresolved') return copy(C.blockers.legacy)
  if (code === 'target_unavailable') return copy(C.blockers.target)
  if (code === 'vacation_not_off') return copy(C.tile.vacationBlocked)
  if (code === 'episode_duration_exceeded') return copy(C.feedback.episodeLimit)
  return copy(C.errors.unavailable)
}

function ActiveControls({ controller }: { controller: WakeLightController }) {
  const copy = useCopy(WAKE_LIGHT_COPY_NAMESPACE)
  const { snapshot } = controller
  if (!snapshot.activeOccurrences.length && !controller.stopping) return null
  return (
    <section className={styles.section} aria-busy={controller.stopping}>
      <SectionHeader title={copy(C.active.title)} />
      <FieldActionButton disabled={!snapshot.available || controller.stopping}
        label={controller.stopping ? copy(C.progress.stopping) : copy(C.active.stopEpisode)}
        onClick={() => void controller.endEpisode()} tone="danger" />
      <Description>{copy(C.behavior.activeStop)}</Description>
      <div className={styles.activeOccurrences}>
        {snapshot.activeOccurrences.map(item => (
          <div className={styles.activeOccurrence} key={item.id}>
            <div className={styles.activeOccurrenceSummary}>
              <strong>{snapshot.alarms.find(alarm => alarm.id === item.alarmId)?.label ?? formatWakeLightTime(item.wakeAt)}</strong>
              <span>{formatWakeLightTime(item.wakeAt)}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ReadinessAlerts({ controller }: { controller: WakeLightController }) {
  const copy = useCopy(WAKE_LIGHT_COPY_NAMESPACE)
  return controller.snapshot.currentBlockers.filter(code => code !== 'integration_unavailable').map(code => (
    <InlineAlert key={code}>{blockedMessage(code, copy)}</InlineAlert>
  ))
}

function AlarmsPanel({ config, controller, onAdd, onEdit, onOpenSource }: {
  config: WakeLightConfig
  controller: WakeLightController
  onAdd: () => void
  onEdit: (alarm: WakeLightAlarm) => void
  onOpenSource?: (sourceRef: string) => void
}) {
  const copy = useCopy(WAKE_LIGHT_COPY_NAMESPACE)
  const { snapshot } = controller
  return (
    <div className={styles.panelStack}>
      <ActiveControls controller={controller} />
      <ReadinessAlerts controller={controller} />
      <ScheduleCollection
        addAction={controller.canEdit ? {
          disabled: !snapshot.available,
          focusKey: 'add-wake-alarm', label: copy(C.schedule.add), onClick: onAdd,
        } : undefined}
        empty={!snapshot.alarms.length} emptyText={copy(C.schedule.empty)}
        itemsTitle={copy(C.sections.alarms)}
        readOnlyText={!controller.canEdit ? copy(C.schedule.adminOnly) : undefined}
      >
        {snapshot.alarms.map(alarm => {
          const source = config.sourceBindings.find(item => item.id === alarm.sourceRef)
          const displayLabel = source
            ? sourceAlarmLabel(alarm, source)
            : alarm.label
          const opensSource = alarm.source === WAKE_LIGHT_SOURCE.SLEEPYPOD && source && onOpenSource
          const sourceRef = alarm.sourceRef
          const linkKeys = sourceRef
            ? wakeLightAlarmLinkDays(alarm).map(day => wakeLightAlarmLinkKey(sourceRef, day, alarm.localTime))
            : []
          if (alarm.source !== WAKE_LIGHT_SOURCE.NATIVE && !opensSource) {
            return <StatusPill grouped icon="mdi:alarm" key={alarm.id} label={displayLabel}
              value={formatWakeLightTime(alarm.localTime)} />
          }
          return <ScheduleListRow active={alarm.enabled}
            disabled={alarm.source === WAKE_LIGHT_SOURCE.NATIVE
              && (!controller.canEdit || !snapshot.available || controller.isAlarmPending(alarm.id))}
            focusKey={alarm.id} icon={alarm.enabled ? 'mdi:alarm-check' : 'mdi:alarm-off'} key={alarm.id}
            onClick={() => {
              if (opensSource && alarm.sourceRef) onOpenSource(alarm.sourceRef)
              else onEdit(alarm)
            }}
            primary={displayLabel}
            secondary={copy(C.summary.scheduleAndTime, {
              schedule: scheduleLabel(alarm, copy), time: formatWakeLightTime(alarm.localTime),
            })}
            semantics={{ kind: 'modal' }}
            tertiary={opensSource ? copy(C.actions.sourceEditor) : alarm.rampMinutes === 0 ? copy(C.ramp.none) : minutes(alarm.rampMinutes)}
            trailingControl={alarm.source === WAKE_LIGHT_SOURCE.NATIVE ? (
              <ToggleControl checked={alarm.enabled}
                disabled={!controller.canEdit || !snapshot.available || controller.isAlarmPending(alarm.id)}
                label={alarm.label}
                onChange={enabled => { void controller.saveAlarm({ ...alarm, enabled }) }} />
            ) : (
              <ToggleControl checked={wakeLightAlarmLinked(snapshot.alarmLinks, alarm)}
                disabled={!controller.canEdit || !snapshot.available || controller.areAlarmLinksPending(linkKeys)}
                label={copy(C.binding.alarmToggle, { alarm: alarm.label })}
                onChange={enabled => {
                  if (linkKeys.length) void controller.setAlarmLink(linkKeys, enabled)
                }} />
            )} />
        })}
      </ScheduleCollection>
    </div>
  )
}

function sourceAlarmLabel(alarm: WakeLightAlarm, source: WakeLightSourceConfig) {
  return alarm.kind === WAKE_LIGHT_ALARM_KIND.WEEKLY && alarm.weekdays.length > 1
    ? source.alarmsLabel
    : source.alarmLabel
}

const DURATION_LABELS = [
  C.ramp.fiveMinutes,
  C.ramp.tenMinutes,
  C.ramp.fifteenMinutes,
  C.ramp.thirtyMinutes,
] as const

function DurationGrid({ disabled, label, onChange, values, value }: {
  disabled: boolean
  label: string
  onChange: (value: number) => void
  values: readonly number[]
  value: number
}) {
  const copy = useCopy(WAKE_LIGHT_COPY_NAMESPACE)
  return (
    <DynamicGrid ariaLabel={label} className={styles.rampGrid}
      columns={2} fillRows={false} itemSizing="uniform" layout="bounded" maxCellWidth={260} maxColumns={3}
      role="radiogroup">
      {values.map((minutesValue) => {
        const durationIndex = WAKE_LIGHT_HOLD_MINUTES.indexOf(
          minutesValue as (typeof WAKE_LIGHT_HOLD_MINUTES)[number],
        )
        return <RadioRow active={value === minutesValue} disabled={disabled} key={minutesValue}
          onClick={() => onChange(minutesValue)}
          title={minutesValue === 0 ? copy(C.ramp.none) : copy(DURATION_LABELS[durationIndex])} />
      })}
    </DynamicGrid>
  )
}

function RampDurationField({ disabled, onChange, separator = false, showLabel = true, value }: {
  disabled: boolean
  onChange: (value: number) => void
  separator?: boolean
  showLabel?: boolean
  value: number
}) {
  const copy = useCopy(WAKE_LIGHT_COPY_NAMESPACE)
  const label = copy(C.settings.ramp)
  return (
    <fieldset className={styles.rampField}>
      {showLabel && (separator ? <SectionHeader title={label} /> : <legend>{label}</legend>)}
      <DurationGrid disabled={disabled} label={label} onChange={onChange}
        values={WAKE_LIGHT_RAMP_MINUTES} value={value} />
    </fieldset>
  )
}

function DefaultsPanel({ controller }: { controller: WakeLightController }) {
  const copy = useCopy(WAKE_LIGHT_COPY_NAMESPACE)
  const disabled = !controller.canEdit || !controller.snapshot.available || controller.configurationPending
  const holdDisabled = disabled || controller.snapshot.contractVersion < 6
  return (
    <div className={styles.panelStack} aria-busy={controller.configurationPending}>
      <ReadinessAlerts controller={controller} />
      <section className={styles.section}>
        <SectionHeader title={copy(C.sections.defaults)} />
        <Description>{copy(C.settings.description)}</Description>
        <RampDurationField disabled={disabled} showLabel={false}
          onChange={rampMinutes => { void controller.updateDefaults({ ...controller.snapshot.defaults, rampMinutes }) }}
          value={controller.snapshot.defaults.rampMinutes} />
        {!WAKE_LIGHT_RAMP_MINUTES.includes(
          controller.snapshot.defaults.rampMinutes as (typeof WAKE_LIGHT_RAMP_MINUTES)[number],
        ) && <InlineAlert>{copy(C.editor.rampRequired)}</InlineAlert>}
      </section>
      <section className={styles.section}>
        <SectionHeader title={copy(C.settings.hold)} />
        <Description>{copy(C.settings.holdDescription, {
          duration: minutes(controller.snapshot.defaults.postWakeHoldMinutes),
        })}</Description>
        <DurationGrid disabled={holdDisabled} label={copy(C.settings.hold)}
          onChange={postWakeHoldMinutes => {
            void controller.updateDefaults({ ...controller.snapshot.defaults, postWakeHoldMinutes })
          }}
          values={WAKE_LIGHT_HOLD_MINUTES} value={controller.snapshot.defaults.postWakeHoldMinutes} />
        {controller.snapshot.contractVersion < 6 && <InlineAlert>{copy(C.settings.holdUpdateHint)}</InlineAlert>}
      </section>
    </div>
  )
}

function MainPage({ activeTab, config, controller, onAdd, onEdit, onOpenSource, panelRef }: {
  activeTab: WakeLightModalTab
  config: WakeLightConfig
  controller: WakeLightController
  onAdd: () => void
  onEdit: (alarm: WakeLightAlarm) => void
  onOpenSource?: (sourceRef: string) => void
  panelRef: RefObject<HTMLDivElement | null>
}) {
  const copy = useCopy(WAKE_LIGHT_COPY_NAMESPACE)
  const { displayedTab, transitionState } = useSmoothDisplayedModalTab(activeTab)
  useLayoutEffect(() => { if (panelRef.current) panelRef.current.scrollTop = 0 }, [displayedTab, panelRef])
  const { snapshot } = controller
  return (
    <div className={styles.modalSheetPage}>
      <div className={styles.modalBody}>
        <div aria-labelledby={modalTabId(TAB_PREFIX, displayedTab)} className={styles.modalPanel}
          data-modal-tab-transition-state={transitionState} data-scroll-region="wake-light-panel"
          data-tab={displayedTab} id={PANEL_ID} ref={panelRef} role="tabpanel">
          {!snapshot.compatible && <InlineAlert>{copy(C.behavior.protocol)}</InlineAlert>}
          {snapshot.compatible && !snapshot.available && <InlineAlert>{copy(C.errors.unavailable)}</InlineAlert>}
          {controller.error && <InlineAlert>{controller.error}</InlineAlert>}
          {displayedTab === WAKE_LIGHT_MODAL_TAB.ALARMS && (
            <AlarmsPanel config={config} controller={controller} onAdd={onAdd} onEdit={onEdit} onOpenSource={onOpenSource} />
          )}
          {displayedTab === WAKE_LIGHT_MODAL_TAB.DEFAULTS && <DefaultsPanel controller={controller} />}
        </div>
      </div>
    </div>
  )
}

interface BedTargetChoice {
  checked: boolean
  disabled: boolean
  label: string
  side: BedAlarmSide
}

function AlarmEditor({ bedTargets, controller, draft, onBedTargetChange, onChange, onReload }: {
  bedTargets?: readonly BedTargetChoice[]
  controller: WakeLightController
  draft: WakeLightAlarm
  onBedTargetChange?: (side: BedAlarmSide, value: boolean) => void
  onChange: (alarm: WakeLightAlarm) => void
  onReload: () => void
}) {
  const copy = useCopy(WAKE_LIGHT_COPY_NAMESPACE)
  const valid = validateWakeLightAlarm(draft)
  const disabled = !controller.canEdit || !controller.snapshot.available || controller.configurationPending
  const latest = controller.liveAlarms.find(alarm => alarm.id === draft.id)
  const stale = controller.errorCode === 'revision_conflict'
    && (controller.requiresAlarmReload || Boolean(latest && latest.revision !== draft.revision))
  const change = (value: Partial<WakeLightAlarm>) => onChange({ ...draft, ...value })
  const setKind = (kind: WakeLightAlarmKind) => {
    const fallback = createWakeLightAlarm(draft.id, draft.label)
    change({
      kind, date: kind === 'once' ? draft.date ?? fallback.date : null,
      weekdays: kind === 'weekly'
        ? draft.weekdays.length ? draft.weekdays : [...WAKE_LIGHT_WEEKDAY_GROUPS.WEEKDAYS]
        : [],
    })
  }
  return (
    <div aria-busy={controller.configurationPending} className={styles.editorStack}>
      <NativeSelectField disabled={disabled} label={copy(C.editor.alarmType)}
        onChange={value => setKind(value as WakeLightAlarmKind)} value={draft.kind}
        options={[{ label: copy(C.editor.scheduled), value: WAKE_LIGHT_ALARM_KIND.WEEKLY }, { label: copy(C.editor.oneTime), value: WAKE_LIGHT_ALARM_KIND.ONCE }]} />
      <ScheduleEditorFields dayOptions={WAKE_LIGHT_WEEKDAYS.map(day => ({
        label: weekday(day), shortLabel: weekday(day, 'short').slice(0, 2), value: day,
      }))} days={draft.weekdays} disabled={disabled}
        nameField={{ label: copy(C.editor.alarmName), maxLength: 40, onChange: label => change({ label }), value: draft.label }}
        onDaysChange={(weekdays: WakeLightWeekday[]) => change({ weekdays })} showDays={draft.kind === 'weekly'}
        timeFields={[{ label: copy(C.editor.wakeTime), onChange: localTime => change({ localTime }), value: draft.localTime }]}>
        {draft.kind === WAKE_LIGHT_ALARM_KIND.ONCE && (
          <NativePickerField disabled={disabled} label={copy(C.editor.alarmDate)}
            onChange={date => change({ date })} type="date" value={draft.date ?? ''} />
        )}
        <RampDurationField disabled={disabled} onChange={rampMinutes => change({ rampMinutes })}
          separator value={draft.rampMinutes} />
        <ToggleSetting checked={draft.enabled} disabled={disabled}
          icon={draft.enabled ? 'mdi:alarm-check' : 'mdi:alarm-off'}
          label={copy(C.editor.enabled)} onChange={enabled => change({ enabled })} />
        {bedTargets?.map(target => (
          <ToggleSetting checked={target.checked} disabled={disabled || target.disabled} icon="mdi:bed"
            key={target.side} label={target.label}
            onChange={value => onBedTargetChange?.(target.side, value)} />
        ))}
        {Boolean(bedTargets?.length) && draft.kind === WAKE_LIGHT_ALARM_KIND.ONCE
          && controller.snapshot.contractVersion < 5 && (
          <InlineAlert>{copy(C.editor.addToBedUpdateHint)}</InlineAlert>
        )}
        {!valid.nameValid && <InlineAlert>{copy(C.editor.nameRequired)}</InlineAlert>}
        {!valid.timeValid && <InlineAlert>{copy(C.editor.timeInvalid)}</InlineAlert>}
        {!valid.rampValid && <InlineAlert>{copy(C.editor.rampRequired)}</InlineAlert>}
        {!valid.daysValid && <InlineAlert>{copy(C.editor.daysRequired)}</InlineAlert>}
        {!valid.dateValid && <InlineAlert>{copy(C.editor.futureDateRequired)}</InlineAlert>}
        {controller.error && <InlineAlert>{controller.error}</InlineAlert>}
        {stale && (
          <FieldActionButton disabled={controller.configurationPending} label={copy(C.actions.reloadAlarm)} onClick={onReload} />
        )}
      </ScheduleEditorFields>
    </div>
  )
}

export function WakeLightModal({ bedProvisioning, config, onClose, onCloseComplete, onOpenSource, open, roomTitle }: {
  bedProvisioning?: WakeLightBedProvisioning
  config: WakeLightConfig
  onClose: () => void
  onCloseComplete?: () => void
  onOpenSource?: (sourceRef: string) => void
  open: boolean
  roomTitle: string
}) {
  const copy = useCopy(WAKE_LIGHT_COPY_NAMESPACE)
  const coreCopy = useCopy(CORE_COPY_NAMESPACE)
  const controller = useWakeLightController(config)
  const [activeTab, setActiveTab] = useState<WakeLightModalTab>(WAKE_LIGHT_MODAL_TAB.ALARMS)
  const [draft, setDraft] = useState<WakeLightAlarm | null>(null)
  const [initialDraft, setInitialDraft] = useState<WakeLightAlarm | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [bedSides, setBedSides] = useState<Partial<Record<BedAlarmSide, boolean>>>({})
  const [previousOpen, setPreviousOpen] = useState(open)
  const operation = useRef(0)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const { bodyElementRef, closeDetailPage, openDetailPage, resetDetailPage } = useScheduleDetailPage(draft, setDraft, panelRef)
  if (previousOpen !== open) {
    setPreviousOpen(open)
    if (open && draft) {
      setEditingId(null)
      setInitialDraft(null)
      setBedSides({})
      resetDetailPage()
    }
  }
  const changeTab = (tab: WakeLightModalTab) => {
    controller.clearError()
    if (bodyElementRef.current) bodyElementRef.current.scrollTop = 0
    if (panelRef.current) panelRef.current.scrollTop = 0
    setActiveTab(tab)
  }
  const closeEditor = () => {
    operation.current += 1
    setEditingId(null)
    setInitialDraft(null)
    setBedSides({})
    closeDetailPage()
  }
  const add = () => {
    operation.current += 1
    controller.clearError()
    setEditingId(null)
    setInitialDraft(null)
    setBedSides({})
    openDetailPage(createWakeLightAlarm(alarmId(), copy(C.editor.defaultName), new Date(), controller.snapshot.defaults), 'add-wake-alarm')
  }
  const edit = (alarm: WakeLightAlarm) => {
    operation.current += 1
    controller.clearError()
    setEditingId(alarm.id)
    setInitialDraft(alarm)
    setBedSides({})
    openDetailPage(alarm, alarm.id)
  }
  const bedTargetSourceRef = (target: WakeLightBedTarget) => (
    target.available ? wakeLightSourceForSide(config, target.side)?.id ?? null : null
  )
  // Both bed toggles start off regardless of what those beds are already doing.
  const bedTargetLinked = (target: WakeLightBedTarget) => bedSides[target.side] ?? false
  const bedTargetsVisible = Boolean(bedProvisioning) && !editingId
  const bedTargets = bedTargetsVisible && draft
    ? bedProvisioning?.targets.flatMap((target) => {
      const sourceRef = bedTargetSourceRef(target)
      return sourceRef
        ? [{
          checked: bedTargetLinked(target),
          disabled: draft.kind === WAKE_LIGHT_ALARM_KIND.ONCE
            && controller.snapshot.contractVersion < 5,
          label: copy(C.editor.addToBed, { bed: target.title }),
          side: target.side,
        }]
        : []
    })
    : undefined
  const applyBedTargets = async (saved: WakeLightAlarm) => {
    if (!bedProvisioning || editingId || saved.kind !== WAKE_LIGHT_ALARM_KIND.WEEKLY) return
    for (const target of bedProvisioning.targets) {
      const sourceRef = bedTargetSourceRef(target)
      if (!sourceRef) continue
      // Every side is synchronized to its toggle, which is off unless the user turned it on.
      const plan = planBedAlarmProvision({
        alarmLinks: controller.snapshot.alarmLinks, days: saved.weekdays, linked: bedTargetLinked(target),
        slots: target.slots, sourceRef, time: saved.localTime,
      })
      if (bedAlarmPlanIsEmpty(plan) || !plan) continue
      if (plan.createDays.length) bedProvisioning.createAlarms(target.side, plan.createDays, saved.localTime)
      if (plan.linkKeysOn.length) await controller.setAlarmLink(plan.linkKeysOn, true)
      if (plan.linkKeysOff.length) await controller.setAlarmLink(plan.linkKeysOff, false)
    }
  }
  const save = async () => {
    if (!draft || !validateWakeLightAlarm(draft).valid) return
    const current = operation.current
    const saved = {
      ...draft,
      bedSides: draft.kind === WAKE_LIGHT_ALARM_KIND.ONCE
        ? bedProvisioning?.targets
          .filter(target => bedTargetLinked(target))
          .map(target => target.side) ?? []
        : [],
      label: draft.label.trim(),
    }
    if (await controller.saveAlarm(saved) && current === operation.current) {
      await applyBedTargets(saved)
      closeEditor()
    }
  }
  const remove = async () => {
    if (!editingId) return
    const current = operation.current
    if (await controller.deleteAlarm(editingId) && current === operation.current) closeEditor()
  }
  const reload = () => {
    const latest = controller.liveAlarms.find(alarm => alarm.id === draft?.id)
    if (latest) {
      setDraft(latest)
      setInitialDraft(latest)
      setEditingId(latest.id)
    }
    controller.clearError()
  }
  const disabled = !controller.snapshot.available || !controller.canEdit || controller.configurationPending
  const latest = controller.liveAlarms.find(alarm => alarm.id === draft?.id)
  const stale = draft && controller.errorCode === 'revision_conflict'
    && (controller.requiresAlarmReload || Boolean(latest && latest.revision !== draft.revision))
  const dirty = draft ? alarmDraftChanged(draft, initialDraft) : false
  return (
    <ModalSheet backLabel={copy(C.editor.back)} bodyElementRef={bodyElementRef} centeredGeometry={GEOMETRY}
      footer={draft ? <ScheduleDetailFooter
        deleteAction={editingId ? { disabled, icon: 'mdi:delete', label: copy(C.editor.delete), onClick: () => void remove() } : undefined}
        primaryAction={{
          disabled: disabled || !dirty || !validateWakeLightAlarm(draft).valid || Boolean(stale),
          icon: 'mdi:content-save',
          label: copy(C.editor.save),
          onClick: () => void save(),
        }} /> : undefined}
      navigation={draft ? undefined : <ModalIconTabNav activeTab={activeTab} idPrefix={TAB_PREFIX}
        label={coreCopy(CORE_COPY_KEYS.modal.sectionNavigation, { title: config.title })} onTabChange={changeTab}
        panelId={PANEL_ID} tabs={tabs(copy)} />}
      onBack={draft && !controller.configurationPending ? closeEditor : undefined}
      onClose={() => { operation.current += 1; controller.clearError(); onClose() }}
      onCloseComplete={onCloseComplete} open={open} scrollMode={draft ? 'body' : 'panes'}
      retainLatestOnControlledClose
      scrollResetKey={activeTab} size="workspace"
      subtitle={draft ? undefined : tileSubtitle(controller.snapshot, copy, true)}
      title={draft
        ? editingId
          ? copy(C.editor.editTitle, { name: draft.label, room: roomTitle })
          : copy(C.editor.addTitle, { room: roomTitle })
        : copy(C.modalTitle, { room: roomTitle })}>
      {draft ? <AlarmEditor bedTargets={bedTargets} controller={controller} draft={draft}
        onBedTargetChange={(side, value) => setBedSides(current => ({ ...current, [side]: value }))}
        onChange={value => {
          operation.current += 1
          setDraft(value)
        }} onReload={reload} /> : <MainPage activeTab={activeTab} config={config} controller={controller}
        onAdd={add} onEdit={edit} onOpenSource={onOpenSource} panelRef={panelRef} />}
    </ModalSheet>
  )
}

export function WakeLightModalPreload({ config }: { config: WakeLightConfig }) {
  return <div aria-hidden="true" className={styles.preload} data-wake-light-preload={config.id}><span /><span /><span /></div>
}

export function SleepypodAlarmWakeLightToggle({ checked, config, disabled, localTime, onChange, side, weekday }: {
  checked?: boolean
  config: WakeLightConfig
  disabled?: boolean
  localTime: string
  onChange?: (value: boolean) => void
  side: WakeLightSourceSide
  weekday: WakeLightWeekday
}) {
  const copy = useCopy(WAKE_LIGHT_COPY_NAMESPACE)
  const controller = useWakeLightController(config)
  const source = wakeLightSourceForSide(config, side)
  const linkKey = source ? wakeLightAlarmLinkKey(source.id, weekday, localTime) : null
  const resolvedChecked = checked ?? (linkKey === null ? false : controller.snapshot.alarmLinks[linkKey] !== false)
  return (
    <ToggleSetting checked={resolvedChecked}
      disabled={Boolean(disabled) || !linkKey || !controller.canEdit || !controller.snapshot.available
        || controller.areAlarmLinksPending(linkKey ? [linkKey] : [])}
      icon="mdi:weather-sunset-up" label={copy(C.binding.label)}
      onChange={value => {
        if (onChange) onChange(value)
        else if (linkKey) void controller.setAlarmLink([linkKey], value)
      }} />
  )
}
