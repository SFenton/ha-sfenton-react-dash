import { useHass } from '@hakit/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { HassEntity } from 'home-assistant-js-websocket'
import { Description } from '../core/Description'
import { DynamicGrid } from '../core/DynamicGrid'
import { GlassTile } from '../core/GlassTile'
import { MaterialIcon } from '../core/Icon'
import { InlineAlert } from '../core/InlineAlert'
import { ModalActionButton } from '../core/ModalActionFooter'
import { ModalSheet } from '../core/ModalSheet'
import { NativePickerField } from '../core/NativePickerField'
import { ScheduleEditorFields, type ScheduleDayOption } from '../core/ScheduleEditorFields'
import { ScheduleListRow } from '../core/ScheduleFlow'
import { SectionHeader } from '../core/SectionHeader'
import { NumberStepper } from '../core/Stepper'
import { StatusPill, type StatusPillTone } from '../core/StatusPill'
import { ToggleControl } from '../core/ToggleControl'
import { ToggleSetting } from '../core/ToggleSetting'
import { SPRINKLER_MANUAL_RUNTIME_MINUTES, type SprinklerControllerConfig } from '../../constants/sprinklers'
import { formatDate, formatList, formatNumber, useCopy } from '../../i18n'
import { useHashModal } from '../../hooks/useHashModal'
import { useModalDetailPageScroll } from '../../hooks/useModalDetailPageScroll'
import { useOptimisticState } from '../../hooks/useOptimisticState'
import { titleCaseState } from './entityState'
import { buildSprinklerSnapshot, SPRINKLER_STATUS, type SprinklerProgramSnapshot, type SprinklerZoneSnapshot } from './sprinklerState'
import styles from './SprinklerController.module.css'

const DETAIL_OVERVIEW = 0
const DETAIL_SCHEDULE = 1
const DETAIL_WATER = 2
const OPTIMISTIC_REVERT_MS = 10_000
type SprinklerDetailPage = typeof DETAIL_OVERVIEW | typeof DETAIL_SCHEDULE | typeof DETAIL_WATER
type SprinklerDay = '0' | '1' | '2' | '3' | '4' | '5' | '6'

interface CallServiceParams {
  domain: string
  service: string
  serviceData?: Record<string, unknown>
  target?: string
}

type CallService = (params: CallServiceParams) => unknown

function formatClockTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value
  return formatDate(new Date(2000, 0, 1, hours, minutes), { hour: 'numeric', minute: '2-digit' })
}

function formatTimestamp(value: Date | null, fallback: string) {
  return value ? formatDate(value, { hour: 'numeric', minute: '2-digit' }) : fallback
}

function serviceErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : String(error)
}

function controllerStatusValue(status: ReturnType<typeof buildSprinklerSnapshot>['status'], mode: string, unavailable: string, watering: string, fault: string) {
  if (status === SPRINKLER_STATUS.unavailable) return unavailable
  if (status === SPRINKLER_STATUS.watering) return watering
  if (status === SPRINKLER_STATUS.fault) return fault
  return titleCaseState(mode)
}

function controllerStatusTone(status: ReturnType<typeof buildSprinklerSnapshot>['status'], modeOff: boolean): StatusPillTone {
  if (status === SPRINKLER_STATUS.unavailable) return 'unavailable'
  if (status === SPRINKLER_STATUS.fault) return 'danger'
  if (status === SPRINKLER_STATUS.watering) return 'active'
  if (modeOff) return 'warning'
  return 'ok'
}

function programWithDraft(program: SprinklerProgramSnapshot, days: SprinklerDay[], startTimes: string[], budget: number): SprinklerProgramSnapshot {
  return { ...program, budget, days: days.map(Number), startTimes }
}

function dayKey(days: number[]) {
  return days.join(',')
}

function daysFromKey(value: string) {
  if (!value) return []
  return value.split(',').map(Number).filter(Number.isFinite)
}

function startTimeKey(startTimes: string[]) {
  return startTimes.join('|')
}

function startTimesFromKey(value: string) {
  return value ? value.split('|') : []
}

function enabledKey(zones: SprinklerZoneSnapshot[]) {
  return zones.map((zone) => zone.program.enabled ? '1' : '0').join('')
}

function replaceEnabledAt(value: string, index: number, enabled: boolean) {
  return value.split('').map((entry, currentIndex) => currentIndex === index ? (enabled ? '1' : '0') : entry).join('')
}

function displayProgramName(zoneName: string, fallback: (zone: string) => string) {
  return fallback(zoneName)
}

export function SprinklerController({ config }: { config: SprinklerControllerConfig }) {
  const t = useCopy('pageSprinklers')
  const common = useCopy('common')
  const entities = useHass((state) => state.entities) as Record<string, HassEntity | undefined>
  const callService = useHass((state) => state.helpers.callService) as unknown as CallService
  const liveSnapshot = useMemo(() => buildSprinklerSnapshot(entities, config), [config, entities])
  const [displayActiveValve, commitActiveValve, resetActiveValve] = useOptimisticState(liveSnapshot.activeValveEntityId ?? '', { clearOn: 'confirmation', revertMs: OPTIMISTIC_REVERT_MS })
  const [displayRainDelay, commitRainDelay, resetRainDelay] = useOptimisticState(liveSnapshot.rainDelay, { clearOn: 'confirmation', revertMs: OPTIMISTIC_REVERT_MS })
  const [displaySmartWatering, commitSmartWatering, resetSmartWatering] = useOptimisticState(liveSnapshot.smartWatering, { clearOn: 'confirmation', revertMs: OPTIMISTIC_REVERT_MS })
  const [displayEnabledKey, commitEnabledKey, resetEnabledKey] = useOptimisticState(enabledKey(liveSnapshot.zones), { clearOn: 'confirmation', revertMs: OPTIMISTIC_REVERT_MS })
  const [detailPage, setDetailPage] = useState<SprinklerDetailPage>(DETAIL_OVERVIEW)
  const [selectedZoneIndex, setSelectedZoneIndex] = useState(0)
  const [selectedProgramIndex, setSelectedProgramIndex] = useState(0)
  const selectedProgramLive = liveSnapshot.zones[selectedProgramIndex]?.program ?? liveSnapshot.zones[0]?.program
  const [displayProgramBudget, commitProgramBudget, resetProgramBudget] = useOptimisticState(selectedProgramLive?.budget ?? 100, { clearOn: 'confirmation', revertMs: OPTIMISTIC_REVERT_MS })
  const [displayProgramDays, commitProgramDays, resetProgramDays] = useOptimisticState(dayKey(selectedProgramLive?.days ?? []), { clearOn: 'confirmation', revertMs: OPTIMISTIC_REVERT_MS })
  const [displayProgramStartTimes, commitProgramStartTimes, resetProgramStartTimes] = useOptimisticState(startTimeKey(selectedProgramLive?.startTimes ?? []), { clearOn: 'confirmation', revertMs: OPTIMISTIC_REVERT_MS })
  const [durationMinutes, setDurationMinutes] = useState<number>(SPRINKLER_MANUAL_RUNTIME_MINUTES.default)
  const [draftDays, setDraftDays] = useState<SprinklerDay[]>([])
  const [draftStartTimes, setDraftStartTimes] = useState<string[]>([])
  const [draftBudget, setDraftBudget] = useState(100)
  const [serviceError, setServiceError] = useState<string | null>(null)
  const { hash, openHash, closeHash } = useHashModal()
  const modalOpen = hash === config.modalHash
  const previousModalOpen = useRef(modalOpen)
  const { bodyElementRef, enterDetailPage, leaveDetailPage, resetDetailPageScroll } = useModalDetailPageScroll(detailPage)
  const ui = useMemo(() => ({
    addStart: t('actions.addStartTime'),
    apply: common('actions.apply'),
    backyard: t('backyard.title'),
    battery: t('labels.battery'),
    budget: t('labels.wateringBudget'),
    budgetDown: t('budget.decrease'),
    budgetUp: t('budget.increase'),
    closed: common('states.closed'),
    connected: t('states.connected'),
    controller: t('labels.controller'),
    controlsHeading: t('sections.controls'),
    everyDay: t('schedule.everyDay'),
    fault: t('states.fault'),
    friday: t('schedule.days.friday'),
    front: t('frontYard.title'),
    hub: t('labels.hub'),
    last: t('labels.lastWatering'),
    monday: t('schedule.days.monday'),
    next: t('labels.nextWatering'),
    noHistory: t('states.noHistory'),
    noSchedule: t('states.notScheduled'),
    off: common('states.off'),
    programEnabled: t('labels.programEnabled'),
    rain: t('labels.rainDelay'),
    runtime: t('labels.runTime'),
    runtimeDown: t('duration.decrease'),
    runtimeUp: t('duration.increase'),
    saturday: t('schedule.days.saturday'),
    scheduleHeading: t('sections.schedule'),
    settingsHeading: t('sections.settings'),
    smart: t('labels.smartWatering'),
    startsHeading: t('sections.startTimes'),
    stateHeading: t('sections.status'),
    stop: t('actions.stopWatering'),
    sunday: t('schedule.days.sunday'),
    thursday: t('schedule.days.thursday'),
    tuesday: t('schedule.days.tuesday'),
    unavailable: common('states.unavailable'),
    unknown: common('states.unknown'),
    watering: t('states.watering'),
    waterStart: t('actions.startWatering'),
    wednesday: t('schedule.days.wednesday'),
    programStart: t('actions.startProgram'),
    zonesHeading: t('sections.zones'),
    budgetValue: (percentage: number) => t('budget.value', { percentage: formatNumber(percentage) }),
    controllerLine: (mode: string, next: string) => t('controller.subtitle', { mode, next }),
    durationValue: (minutes: number) => t('duration.value', { minutes: formatNumber(minutes) }),
    lowBattery: (percentage: number) => t('alerts.lowBattery', { percentage: formatNumber(percentage) }),
    programFallback: (zone: string) => t('schedule.fallbackProgram', { zone }),
    programLine: (summary: string, details: string, program: string) => t('schedule.accessibleLabel', { details, program, summary }),
    programMeta: (zone: string, minutes: number, budget: number) => t('schedule.detailsWithZone', { budget: formatNumber(budget), minutes: formatNumber(minutes), zone }),
    removeStart: (number: number) => t('actions.removeStartTime', { number }),
    scheduleLine: (days: string, times: string) => t('schedule.summary', { days, times }),
    scheduleRunTime: (minutes: number) => t('schedule.runTimeReadOnly', { minutes: formatNumber(minutes) }),
    startAt: (number: number) => t('schedule.startTime', { number }),
    zoneLine: (zone: string) => t('zone.accessibleLabel', { zone }),
  }), [common, t])
  const controllerNames = { backyard: ui.backyard, frontYard: ui.front }
  const controllerName = controllerNames[config.id]
  const dayOptions = useMemo<ScheduleDayOption<SprinklerDay>[]>(() => [
    { label: ui.sunday, shortLabel: 'S', value: '0' },
    { label: ui.monday, shortLabel: 'M', value: '1' },
    { label: ui.tuesday, shortLabel: 'T', value: '2' },
    { label: ui.wednesday, shortLabel: 'W', value: '3' },
    { label: ui.thursday, shortLabel: 'T', value: '4' },
    { label: ui.friday, shortLabel: 'F', value: '5' },
    { label: ui.saturday, shortLabel: 'S', value: '6' },
  ], [ui])
  const displayWatering = liveSnapshot.available && displayActiveValve.length > 0
  const canStartWatering = liveSnapshot.available && liveSnapshot.mode !== 'off' && !displayWatering
  const nextStart = liveSnapshot.nextStartUnknown
    ? ui.unknown
    : formatTimestamp(liveSnapshot.nextStart, liveSnapshot.available ? ui.noSchedule : ui.unavailable)
  const lastStart = formatTimestamp(liveSnapshot.lastRun.startTime, ui.noHistory)
  const controllerStatus = controllerStatusValue(liveSnapshot.status, liveSnapshot.mode, ui.unavailable, ui.watering, ui.fault)
  const controllerSubtitle = liveSnapshot.available ? ui.controllerLine(controllerStatus, nextStart) : ui.unavailable
  const selectedZone = liveSnapshot.zones[selectedZoneIndex] ?? liveSnapshot.zones[0]
  const selectedProgramZone = liveSnapshot.zones[selectedProgramIndex] ?? liveSnapshot.zones[0]
  const selectedProgram = selectedProgramZone
    ? {
      ...selectedProgramZone.program,
      budget: displayProgramBudget,
      days: daysFromKey(displayProgramDays),
      startTimes: startTimesFromKey(displayProgramStartTimes),
    }
    : null

  useEffect(() => {
    if (modalOpen && !previousModalOpen.current) {
      setDetailPage(DETAIL_OVERVIEW)
      setServiceError(null)
      resetDetailPageScroll()
    }
    previousModalOpen.current = modalOpen
  }, [modalOpen, resetDetailPageScroll])

  const runService = async (params: CallServiceParams, resetOptimistic?: () => void) => {
    setServiceError(null)
    try {
      await Promise.resolve(callService(params))
      return true
    } catch (error) {
      resetOptimistic?.()
      setServiceError(serviceErrorMessage(error))
      return false
    }
  }

  const openController = () => {
    setDetailPage(DETAIL_OVERVIEW)
    setServiceError(null)
    resetDetailPageScroll()
    openHash(config.modalHash)
  }

  const openWater = (index: number) => {
    setSelectedZoneIndex(index)
    setServiceError(null)
    enterDetailPage(`zone-${index}`)
    setDetailPage(DETAIL_WATER)
  }

  const openSchedule = (index: number) => {
    const zone = liveSnapshot.zones[index]
    if (!zone) return
    setSelectedProgramIndex(index)
    setDraftDays(zone.program.days.map(String) as SprinklerDay[])
    setDraftStartTimes(zone.program.startTimes.length > 0 ? [...zone.program.startTimes] : ['07:00'])
    setDraftBudget(zone.program.budget)
    setServiceError(null)
    enterDetailPage(`program-${index}`)
    setDetailPage(DETAIL_SCHEDULE)
  }

  const closeDetail = () => {
    leaveDetailPage()
    setServiceError(null)
    setDetailPage(DETAIL_OVERVIEW)
  }

  const startWatering = async () => {
    if (!selectedZone) return
    commitActiveValve(selectedZone.config.valveEntityId, { revertMs: OPTIMISTIC_REVERT_MS })
    const succeeded = await runService({
      domain: 'bhyve',
      service: 'start_watering',
      serviceData: { entity_id: selectedZone.config.valveEntityId, minutes: durationMinutes },
    }, resetActiveValve)
    if (succeeded) closeDetail()
  }

  const stopWatering = () => {
    const entityId = displayActiveValve || liveSnapshot.zones[0]?.config.valveEntityId
    if (!entityId) return
    commitActiveValve('', { revertMs: OPTIMISTIC_REVERT_MS })
    void runService({
      domain: 'bhyve',
      service: 'stop_watering',
      serviceData: { entity_id: entityId },
    }, resetActiveValve)
  }

  const startProgram = () => {
    if (!selectedProgramZone) return
    commitActiveValve(selectedProgramZone.config.valveEntityId, { revertMs: OPTIMISTIC_REVERT_MS })
    void runService({
      domain: 'bhyve',
      service: 'start_program',
      serviceData: { entity_id: selectedProgramZone.program.entityId },
    }, resetActiveValve)
  }

  const toggleSwitch = (
    entityId: string,
    next: boolean,
    commit: (value: boolean, options?: { revertMs?: number }) => void,
    reset: () => void,
  ) => {
    commit(next, { revertMs: OPTIMISTIC_REVERT_MS })
    void runService({ domain: 'switch', service: next ? 'turn_on' : 'turn_off', target: entityId }, reset)
  }

  const toggleProgram = (index: number, next: boolean) => {
    const zone = liveSnapshot.zones[index]
    if (!zone) return
    commitEnabledKey(replaceEnabledAt(displayEnabledKey, index, next), { revertMs: OPTIMISTIC_REVERT_MS })
    void runService({
      domain: 'switch',
      service: next ? 'turn_on' : 'turn_off',
      target: zone.program.entityId,
    }, resetEnabledKey)
  }

  const saveSchedule = async () => {
    if (!selectedProgram || !selectedProgramZone) return
    const startTimes = draftStartTimes.filter(Boolean)
    const nextProgram = programWithDraft(selectedProgram, draftDays, startTimes, draftBudget)
    commitProgramBudget(nextProgram.budget, { revertMs: OPTIMISTIC_REVERT_MS })
    commitProgramDays(dayKey(nextProgram.days), { revertMs: OPTIMISTIC_REVERT_MS })
    commitProgramStartTimes(startTimeKey(nextProgram.startTimes), { revertMs: OPTIMISTIC_REVERT_MS })
    const succeeded = await runService({
      domain: 'bhyve',
      service: 'update_program',
      serviceData: {
        budget: draftBudget,
        entity_id: selectedProgramZone.program.entityId,
        frequency: { days: draftDays.map(Number), type: 'days' },
        start_times: startTimes,
      },
    }, () => {
      resetProgramBudget()
      resetProgramDays()
      resetProgramStartTimes()
    })
    if (succeeded) closeDetail()
  }

  const removeStartTime = (index: number) => {
    setDraftStartTimes((current) => current.length <= 1 ? current : current.filter((_, currentIndex) => currentIndex !== index))
  }

  const programForIndex = (index: number) => {
    const zone = liveSnapshot.zones[index]
    if (!zone) return null
    return index === selectedProgramIndex && selectedProgram ? selectedProgram : zone.program
  }

  const programEnabledAt = (index: number) => displayEnabledKey[index] === '1'
  const selectedProgramName = selectedProgramZone && selectedProgram
    ? displayProgramName(selectedProgramZone.name, ui.programFallback)
    : ui.scheduleHeading
  const modalTitle = detailPage === DETAIL_WATER
    ? selectedZone?.name ?? controllerName
    : detailPage === DETAIL_SCHEDULE
      ? selectedProgramName
      : controllerName
  const modalSubtitle = detailPage === DETAIL_OVERVIEW
    ? controllerSubtitle
    : detailPage === DETAIL_WATER
      ? ui.zoneLine(selectedZone?.name ?? controllerName)
      : selectedProgramZone?.name
  const modalFooter = detailPage === DETAIL_WATER
    ? (
      <ModalActionButton action={{
        disabled: !canStartWatering || !selectedZone?.available,
        icon: 'mdi:sprinkler-variant',
        label: ui.waterStart,
        onClick: () => void startWatering(),
      }} />
    )
    : detailPage === DETAIL_SCHEDULE
      ? (
        <ModalActionButton action={{
          disabled: !selectedProgram?.available || draftDays.length === 0 || draftStartTimes.length === 0 || draftStartTimes.some((time) => !time),
          icon: 'mdi:check',
          label: ui.apply,
          onClick: () => void saveSchedule(),
        }} />
      )
      : undefined

  const overview = (
    <div className={styles.modalStack}>
      {serviceError && <InlineAlert>{serviceError}</InlineAlert>}

      <SectionHeader title={ui.stateHeading} />
      <div className={styles.statusGrid}>
        <StatusPill icon={liveSnapshot.status === SPRINKLER_STATUS.watering ? 'mdi:sprinkler-variant' : 'mdi:information-outline'} label={ui.controller} tone={controllerStatusTone(liveSnapshot.status, controllerStatus === ui.off)} value={controllerStatus} />
        <StatusPill icon="mdi:battery" label={ui.battery} tone={liveSnapshot.batteryLow ? 'warning' : 'neutral'} value={liveSnapshot.batteryPercent === null ? ui.unavailable : `${formatNumber(liveSnapshot.batteryPercent)}%`} />
        <StatusPill icon="mdi:calendar-clock" label={ui.next} value={nextStart} />
        <StatusPill detail={liveSnapshot.lastRun.runTimeMinutes === null ? undefined : ui.durationValue(liveSnapshot.lastRun.runTimeMinutes)} icon="mdi:history" label={ui.last} value={lastStart} />
      </div>

      <SectionHeader title={ui.zonesHeading} />
      <div className={styles.list}>
        {liveSnapshot.zones.map((zone, index) => {
          const active = displayActiveValve === zone.config.valveEntityId
          const zoneState = !zone.available ? ui.unavailable : active ? ui.watering : ui.closed
          const lastRun = formatTimestamp(zone.lastRun.startTime, ui.noHistory)
          return (
            <ScheduleListRow
              accessibleLabel={ui.zoneLine(zone.name)}
              active={active}
              disabled={!zone.available || (displayWatering && !active)}
              focusKey={`zone-${index}`}
              icon="mdi:sprinkler-variant"
              key={zone.config.valveEntityId}
              onClick={() => openWater(index)}
              primary={zone.name}
              semantics={{ kind: 'modal' }}
              secondary={zoneState}
              tertiary={lastRun}
            />
          )
        })}
      </div>

      <SectionHeader title={ui.controlsHeading} />
      <DynamicGrid ariaLabel={ui.controlsHeading} className={styles.controlGrid} columns={2}>
        <GlassTile compact disabled={!displayWatering} icon="mdi:water-off" onClick={stopWatering} semantics={{ kind: 'command' }} title={ui.stop} tone="danger" />
      </DynamicGrid>

      <SectionHeader title={ui.settingsHeading} />
      <div className={styles.settingList}>
        <ToggleSetting checked={displayRainDelay} disabled={!liveSnapshot.available} icon="mdi:weather-pouring" label={ui.rain} onChange={(next) => toggleSwitch(config.rainDelayEntityId, next, commitRainDelay, resetRainDelay)} />
        <ToggleSetting checked={displaySmartWatering} disabled={!liveSnapshot.available} icon="mdi:auto-fix" label={ui.smart} onChange={(next) => toggleSwitch(config.smartWateringEntityId, next, commitSmartWatering, resetSmartWatering)} />
      </div>

      <SectionHeader title={ui.scheduleHeading} />
      <div className={styles.list}>
        {liveSnapshot.zones.map((zone, index) => {
          const program = programForIndex(index)
          if (!program) return null
          const programName = displayProgramName(zone.name, ui.programFallback)
          const labels = program.days.map((day) => dayOptions.find((option) => option.value === String(day))?.label).filter((label): label is string => Boolean(label))
          const days = labels.length === 7 ? ui.everyDay : formatList(labels)
          const times = formatList(program.startTimes.map(formatClockTime))
          const summary = ui.scheduleLine(days || ui.unavailable, times || ui.unavailable)
          const details = ui.programMeta(zone.name, program.runTimeMinutes ?? 0, program.budget)
          return (
            <ScheduleListRow
              accessibleLabel={ui.programLine(summary, details, programName)}
              active={programEnabledAt(index)}
              disabled={!program.available}
              focusKey={`program-${index}`}
              icon="mdi:calendar-clock"
              key={program.entityId}
              onClick={() => openSchedule(index)}
              primary={programName}
              semantics={{ kind: 'modal' }}
              secondary={summary}
              tertiary={details}
              trailingControl={<ToggleControl checked={programEnabledAt(index)} disabled={!program.available} label={programName} onChange={(next) => toggleProgram(index, next)} />}
            />
          )
        })}
      </div>
    </div>
  )

  const waterDetail = (
    <div className={styles.modalStack}>
      {serviceError && <InlineAlert>{serviceError}</InlineAlert>}
      <NumberStepper ariaLabel={ui.runtime} decrementLabel={ui.runtimeDown} disabled={!canStartWatering || !selectedZone?.available} formatValue={ui.durationValue} icon="mdi:timer-outline" incrementLabel={ui.runtimeUp} label={ui.runtime} max={SPRINKLER_MANUAL_RUNTIME_MINUTES.max} min={SPRINKLER_MANUAL_RUNTIME_MINUTES.min} onChange={setDurationMinutes} value={durationMinutes} />
    </div>
  )

  const scheduleDetail = selectedProgram && selectedProgramZone ? (
    <div className={styles.modalStack}>
      {serviceError && <InlineAlert>{serviceError}</InlineAlert>}
      <ToggleSetting checked={programEnabledAt(selectedProgramIndex)} disabled={!selectedProgram.available} icon="mdi:calendar-check" label={ui.programEnabled} onChange={(next) => toggleProgram(selectedProgramIndex, next)} />
      <GlassTile compact disabled={!canStartWatering || !programEnabledAt(selectedProgramIndex)} icon="mdi:play" onClick={startProgram} semantics={{ kind: 'command' }} title={ui.programStart} tone="switch" />
      <ScheduleEditorFields dayOptions={dayOptions} days={draftDays} disabled={!selectedProgram.available} onDaysChange={setDraftDays} timeFields={[]}>
        <div className={styles.startTimeStack}>
          <SectionHeader title={ui.startsHeading} />
          {draftStartTimes.map((time, index) => (
            <div className={styles.startTimeRow} key={`${index}-${time}`}>
              <NativePickerField ariaLabel={ui.startAt(index + 1)} detailAutoFocus={index === 0} disabled={!selectedProgram.available} label={ui.startAt(index + 1)} onChange={(nextTime) => setDraftStartTimes((current) => current.map((currentTime, currentIndex) => currentIndex === index ? nextTime : currentTime))} type="time" value={time} />
              <button aria-label={ui.removeStart(index + 1)} className={styles.removeStartTime} data-action-kind="command" disabled={!selectedProgram.available || draftStartTimes.length <= 1} onClick={() => removeStartTime(index)} type="button">
                <MaterialIcon name="mdi:minus" size={20} />
              </button>
            </div>
          ))}
          <button className={styles.addStartTime} data-action-kind="command" disabled={!selectedProgram.available} onClick={() => setDraftStartTimes((current) => [...current, '07:00'])} type="button">
            <MaterialIcon name="mdi:plus" size={20} />
            {ui.addStart}
          </button>
        </div>
        <NumberStepper ariaLabel={ui.budget} decrementLabel={ui.budgetDown} disabled={!selectedProgram.available} formatValue={ui.budgetValue} icon="mdi:percent" incrementLabel={ui.budgetUp} label={ui.budget} max={200} min={0} onChange={setDraftBudget} step={5} value={draftBudget} />
        <Description>{ui.scheduleRunTime(selectedProgram.runTimeMinutes ?? 0)}</Description>
      </ScheduleEditorFields>
    </div>
  ) : null

  return (
    <>
      <div className={styles.pageStack}>
        {liveSnapshot.batteryLow && liveSnapshot.batteryPercent !== null && <InlineAlert icon="mdi:battery-alert">{ui.lowBattery(liveSnapshot.batteryPercent)}</InlineAlert>}
        <GlassTile icon="mdi:sprinkler-variant" isOff={!liveSnapshot.available} onClick={openController} semantics={{ kind: 'modal' }} subtitle={controllerSubtitle} title={controllerName} tone={liveSnapshot.batteryLow ? 'warning' : liveSnapshot.watering ? 'switch' : 'neutral'} />
        <div className={styles.statusGrid}>
          <StatusPill icon="mdi:battery" label={ui.battery} tone={liveSnapshot.batteryLow ? 'warning' : 'neutral'} value={liveSnapshot.batteryPercent === null ? ui.unavailable : `${formatNumber(liveSnapshot.batteryPercent)}%`} />
          <StatusPill icon="mdi:calendar-clock" label={ui.next} value={nextStart} />
          <StatusPill icon="mdi:history" label={ui.last} value={lastStart} />
          <StatusPill icon="mdi:access-point" label={ui.hub} tone={liveSnapshot.hubConnected ? 'ok' : 'unavailable'} value={liveSnapshot.hubConnected ? ui.connected : ui.unavailable} />
        </div>
      </div>

      <ModalSheet bodyElementRef={bodyElementRef} footer={modalFooter} onBack={detailPage === DETAIL_OVERVIEW ? undefined : closeDetail} onClose={closeHash} open={modalOpen} scrollResetKey={detailPage} subtitle={modalSubtitle} title={modalTitle}>
        {detailPage === DETAIL_WATER ? waterDetail : detailPage === DETAIL_SCHEDULE ? scheduleDetail : overview}
      </ModalSheet>
    </>
  )
}
